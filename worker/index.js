import { accessIdentity } from './access.js';
import { mcpReply, supportsProtocol } from './mcp.js';
import { HttpError, recipeStore } from './recipes.js';

const noCache = { 'Cache-Control': 'no-store' };
const prefix = '/admin/';

function json(value, status = 200) {
  return Response.json(value, { status, headers: noCache });
}

async function readJson(request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') ?? '')) {
    throw new HttpError(415, 'Expected application/json.');
  }
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'Missing request body.');
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let size = 0;
  let text = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 160_000) {
        await reader.cancel();
        throw new HttpError(413, 'Request is too large.');
      }
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'Invalid JSON.');
  }
}

function editorAssets(request, env, pathname) {
  const url = new URL(request.url);
  url.pathname = pathname === '/' ? '/index.html' : pathname;
  return env.ASSETS.fetch(new Request(url, request));
}

function accountName(identity) {
  return identity.name || identity.email.split('@')[0];
}

async function assets(request, env, pathname, identity, readOnly) {
  const response = await editorAssets(request, env, pathname);
  const headers = new Headers(response.headers);
  headers.set('Content-Security-Policy', "script-src 'self' https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js; form-action 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
  headers.set('X-Content-Type-Options', 'nosniff');
  if (identity) headers.set('Cache-Control', 'private, no-store');
  const result = new Response(response.body, { status: response.status, headers });
  if (!identity || pathname !== '/' || !response.ok ||
      !headers.get('Content-Type')?.startsWith('text/html')) return result;

  const rewriter = new HTMLRewriter()
    .on('#editorAccount', { element: element => element.removeAttribute('hidden') })
    .on('#editorAccountName', { element: element => element.setInnerContent(accountName(identity)) });
  if (readOnly) {
    rewriter.on('meta[name="kuchtik-host"]', {
      element: element => element.setAttribute('content', 'readonly-worker'),
    });
  }
  return rewriter.transform(result);
}

async function handleMcp(request, env, url) {
  if (url.pathname !== '/mcp') throw new HttpError(404, 'Not found.');
  const origin = request.headers.get('Origin');
  if (origin && ![url.origin, 'https://chatgpt.com'].includes(origin)) {
    throw new HttpError(403, 'Origin is not allowed.');
  }
  const identity = await accessIdentity(request, env, env.ACCESS_MCP_AUD);
  if (!identity) throw new HttpError(401, 'Cloudflare Access authentication required.');
  if (request.method !== 'POST') {
    return new Response(null, { status: 405, headers: { ...noCache, Allow: 'POST' } });
  }
  if (!supportsProtocol(request.headers.get('MCP-Protocol-Version'))) {
    throw new HttpError(400, 'Unsupported MCP protocol version.');
  }
  const writer = env.MCP_WRITER_EMAIL?.trim().toLowerCase();
  const result = await mcpReply(await readJson(request), recipeStore(env), identity, !!writer && identity.email === writer);
  return result ? json(result) : new Response(null, { status: 202, headers: noCache });
}

function publicRecipe({ metadata, ...recipe }) {
  const publicMetadata = { ...metadata };
  delete publicMetadata.sha;
  return { ...recipe, metadata: publicMetadata };
}

async function handleEditorApi(request, env, url, identity) {
  if (url.pathname === prefix + 'api/session' && request.method === 'GET') {
    return json({ authenticated: true, displayName: accountName(identity) });
  }

  const store = recipeStore(env);
  if (url.pathname === prefix + 'api/catalog' && request.method === 'GET') return json(await store.all());
  const match = /^\/admin\/api\/recipes(?:\/([a-z0-9-]+\.json))?$/.exec(url.pathname);
  if (!match) throw new HttpError(404, 'Not found.');
  const filename = match[1];
  if (request.method === 'GET') return json(filename ? await store.get(filename) : await store.list());

  if (request.headers.get('Origin') !== url.origin) throw new HttpError(403, 'Origin is not allowed.');
  const operation = filename ? { PUT: 'update', DELETE: 'delete' }[request.method]
    : { POST: 'create' }[request.method];
  if (!operation) throw new HttpError(405, 'Method not allowed.');
  const data = await readJson(request);
  return json(await store.write(operation, filename, data?.recipe, data?.revision, identity),
    operation === 'create' ? 201 : 200);
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      const preview = env.PREVIEW === '1';
      const integrationPreview = preview && url.hostname === env.PREVIEW_INTEGRATION_HOST && !!env.RECIPES_DB;
      if (preview ? integrationPreview && url.pathname === '/mcp' : env.PREVIEW === '0' && url.hostname === env.MCP_HOST) {
        return await handleMcp(request, env, url);
      }
      if (!preview && (env.PREVIEW !== '0' || url.hostname !== env.WEB_HOST)) throw new HttpError(404, 'Not found.');

      const editor = url.pathname === '/admin' || url.pathname.startsWith(prefix);
      let identity;
      if (editor || preview) {
        identity = await accessIdentity(request, env, env.ACCESS_WEB_AUD);
        if (!identity) throw new HttpError(401, 'Cloudflare Access authentication required.');
      }
      if (preview && editor && !integrationPreview) throw new HttpError(404, 'Not found.');
      if (url.pathname === '/admin') return Response.redirect(new URL(prefix + url.search, url), 308);
      if (url.pathname.startsWith(prefix + 'api/')) return await handleEditorApi(request, env, url, identity);
      const publicMatch = /^\/api\/recipes(?:\/([a-z0-9-]+\.json))?$/.exec(url.pathname);
      if (publicMatch) {
        if (request.method !== 'GET') {
          return new Response(null, { status: 405, headers: { ...noCache, Allow: 'GET' } });
        }
        const store = recipeStore(env);
        const filename = publicMatch[1];
        return json(filename ? publicRecipe(await store.get(filename)) : (await store.all()).map(publicRecipe));
      }
      const pathname = editor ? '/' + url.pathname.slice(prefix.length) : url.pathname;
      return await assets(request, env, pathname, identity, preview && !integrationPreview);
    } catch (error) {
      return error instanceof HttpError ? json({ error: error.message }, error.status)
        : json({ error: 'Kuchtik could not complete the request.' }, 502);
    }
  },
};
