import test from 'node:test';
import assert from 'node:assert/strict';
import { createSign, generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from './index.js';
import { mcpReply } from './mcp.js';

const web = 'https://kuchtik-preview-tancer-kuchtik.etancik.workers.dev';
const mcp = web;
const branchWeb = 'https://feature-tancer-kuchtik.etancik.workers.dev';
const issuer = 'https://test.cloudflareaccess.com';
const writer = 'editor@example.test';
const revision = 'a'.repeat(40);
const recipe = { name: 'Řízky', ingredients: [{ text: 'sůl', exportDefault: false }], instructions: ['Osolit'], tags: ['oběd'] };
const accessKeys = generateKeyPairSync('rsa', { modulusLength: 2048 });

function assertion(audience, overrides = {}) {
  const parts = [{ alg: 'RS256', kid: 'test-key' },
    { aud: [audience], iss: issuer, sub: 'subject', exp: Date.now() / 1000 + 60, email: writer, ...overrides }]
    .map(part => Buffer.from(JSON.stringify(part)).toString('base64url'));
  parts.push(createSign('RSA-SHA256').update(parts.join('.')).sign(accessKeys.privateKey, 'base64url'));
  return parts.join('.');
}

function request(url, { audience, method = 'GET', origin, body, claims } = {}) {
  return new Request(url, {
    method,
    headers: {
      ...(audience ? { 'Cf-Access-Jwt-Assertion': assertion(audience, claims) } : {}),
      ...(origin ? { Origin: origin } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const previewEnv = {
  WEB_HOST: new URL(web).hostname,
  PREVIEW_INTEGRATION_HOST: new URL(web).hostname,
  PREVIEW: '1',
  ACCESS_ISSUER: issuer,
  ACCESS_WEB_AUD: 'web',
  ACCESS_MCP_AUD: 'mcp',
  MCP_WRITER_EMAIL: writer,
  ASSETS: { fetch: request => new Response(new URL(request.url).pathname) },
};

function createDatabase(t) {
  const database = new DatabaseSync(':memory:');
  t.after(() => database.close());
  database.exec(readFileSync(new URL('../migrations/0001_recipes.sql', import.meta.url), 'utf8'));
  database.prepare('INSERT INTO recipes VALUES (?, ?, ?)').run('rizky.json', revision, JSON.stringify(recipe));
  return {
    prepare(sql) {
      const statement = database.prepare(sql);
      const bind = (...values) => ({
        first: () => statement.get(...values) ?? null,
        all: () => ({ results: statement.all(...values) }),
        run: () => ({ meta: { changes: statement.run(...values).changes } }),
      });
      return { ...bind(), bind };
    },
  };
}

test('Worker shares D1 recipes across public, editor and MCP routes and rejects stale edits', async t => {
  const db = createDatabase(t);
  const env = { ...previewEnv, RECIPES_DB: db };
  t.mock.method(globalThis, 'fetch', async input => {
    const url = new URL(input);
    assert.equal(url.href, issuer + '/cdn-cgi/access/certs');
    return Response.json({ keys: [{ ...accessKeys.publicKey.export({ format: 'jwk' }), kid: 'test-key' }] });
  });

  assert.equal((await worker.fetch(request(web), env)).status, 401);
  assert.equal((await worker.fetch(request(web + '/admin/', { audience: 'mcp' }), env)).status, 401);
  const branchEnv = { ...env, PREVIEW_INTEGRATION_HOST: undefined };
  assert.equal((await worker.fetch(request(branchWeb + '/style.css', { audience: 'web' }), branchEnv)).status, 200);
  assert.equal((await worker.fetch(request(branchWeb + '/admin/', { audience: 'web' }), branchEnv)).status, 404);
  assert.equal((await worker.fetch(request(branchWeb + '/mcp', { audience: 'mcp' }), branchEnv)).status, 401);
  const html = await worker.fetch(request(web + '/admin/', { audience: 'web' }), env);
  assert.equal(await html.text(), '/index.html');
  assert.equal(html.headers.get('Cache-Control'), 'private, no-store');
  assert.equal((await worker.fetch(request(web + '/admin/', {
    audience: 'web', claims: { exp: 1 },
  }), env)).status, 401);

  const call = {
    jsonrpc: '2.0', id: 1, method: 'tools/call',
    params: { name: 'update_recipe', arguments: { filename: 'rizky.json', revision, changes: { name: 'Kuřecí řízky' } } },
  };
  const run = (body, options = {}) => worker.fetch(request(mcp + '/mcp', {
    audience: 'mcp', method: 'POST', body, ...options,
  }), env);
  assert.equal((await run(call, { audience: 'web' })).status, 401);
  assert.equal((await run(call, { origin: 'https://other.example' })).status, 403);
  const forbidden = await (await run(call, { claims: { email: 'reader@example.test' } })).json();
  assert.equal(forbidden.result.isError, true);
  const invalid = structuredClone(call);
  invalid.params.arguments.revision = 'd'.repeat(40);
  assert.equal((await (await run(invalid)).json()).result.isError, true);

  const result = await (await run(call)).json();
  assert.equal(result.result.isError, false);
  const saved = JSON.parse(result.result.content[0].text);
  assert.match(saved.revision, /^[a-f0-9]{40}$/);
  assert.notEqual(saved.revision, revision);

  const production = { ...env, PREVIEW: '0', WEB_HOST: 'kuchtik.tancer.cz', MCP_HOST: 'mcp-kuchtik.tancer.cz' };
  const live = 'https://' + production.WEB_HOST;
  const toolsList = { jsonrpc: '2.0', id: 2, method: 'tools/list' };
  const liveMcp = (host, audience) => worker.fetch(request(host + '/mcp', {
    audience, method: 'POST', body: toolsList,
  }), production);
  assert.equal((await liveMcp(live)).status, 401);
  assert.equal((await liveMcp(live, 'web')).status, 401);
  const liveTools = await liveMcp(live, 'mcp');
  assert.equal(liveTools.status, 200);
  const liveToolsBody = await liveTools.json();
  assert.ok(liveToolsBody.result.tools.some(tool => tool.name === 'update_recipe'));
  assert.ok(liveToolsBody.result.tools.some(tool => tool.name === 'create_recipe'));
  const legacyTools = await liveMcp('https://' + production.MCP_HOST, 'mcp');
  assert.equal(legacyTools.status, 200);
  assert.deepEqual(await legacyTools.json(), liveToolsBody);
  assert.equal((await liveMcp('https://other.example', 'mcp')).status, 404);

  const reader = await worker.fetch(request(live + '/api/recipes'), production);
  assert.equal(reader.headers.get('Cache-Control'), 'no-store');
  const [published] = await reader.json();
  assert.equal(published.name, 'Kuřecí řízky');
  assert.equal(published.metadata.sha, undefined);
  assert.equal((await worker.fetch(request(live + '/api/recipes', { method: 'POST' }), production)).status, 405);
  assert.equal((await worker.fetch(request(live + '/admin/api/catalog'), production)).status, 401);

  const sessionUrl = web + '/admin/api/session';
  assert.equal((await worker.fetch(request(sessionUrl, { audience: 'mcp' }), env)).status, 401);
  const session = await worker.fetch(request(sessionUrl, { audience: 'web', claims: { name: 'Test Editor' } }), env);
  assert.deepEqual(await session.json(), { authenticated: true, displayName: 'Test Editor' });
  const fallbackSession = await worker.fetch(request(sessionUrl, { audience: 'web' }), env);
  assert.deepEqual(await fallbackSession.json(), { authenticated: true, displayName: 'editor' });

  const editorCatalog = await worker.fetch(request(web + '/admin/api/catalog', { audience: 'web' }), env);
  assert.equal((await editorCatalog.json())[0].metadata.sha, saved.revision);
  const editorEdit = (revision, origin = web) => worker.fetch(request(web + '/admin/api/recipes/rizky.json', {
    audience: 'web', method: 'PUT', origin, body: { recipe, revision },
  }), env);
  assert.equal((await editorEdit(revision)).status, 409);
  assert.equal((await editorEdit(saved.revision, branchWeb)).status, 403);
  assert.equal((await editorEdit(saved.revision)).status, 200);
  assert.equal((await editorEdit(saved.revision)).status, 409);

  const create = () => worker.fetch(request(web + '/admin/api/recipes', {
    audience: 'web', method: 'POST', origin: web, body: { recipe: { ...recipe, name: 'Brambory' } },
  }), env);
  const created = await create();
  assert.equal(created.status, 201);
  assert.equal((await create()).status, 409);
  const latest = await created.json();
  const deleted = await worker.fetch(request(web + '/admin/api/recipes/' + latest.filename, {
    audience: 'web', method: 'DELETE', origin: web, body: { revision: latest.revision },
  }), env);
  assert.equal(deleted.status, 200);
  assert.equal((await worker.fetch(request(live + '/api/recipes/' + latest.filename), production)).status, 404);
});

test('MCP negotiates protocol, hides writes for readers and returns empty notification replies', async () => {
  const message = { jsonrpc: '2.0', id: 1 };
  const response = await mcpReply({ ...message, method: 'initialize', params: { protocolVersion: '2025-06-18' } });
  assert.equal(response.result.protocolVersion, '2025-06-18');
  assert.equal(await mcpReply({ jsonrpc: '2.0', method: 'notifications/initialized' }), null);
  const { result } = await mcpReply({ ...message, method: 'tools/list' }, null, null, false);
  assert.deepEqual(result.tools.map(tool => tool.name), ['search_recipes', 'get_recipe']);
});

test('MCP creates a new recipe with a catalog link and refuses duplicate or unauthorized writes', async t => {
  const env = { ...previewEnv, PREVIEW: '0', WEB_HOST: 'kuchtik.tancer.cz',
    MCP_HOST: 'mcp-kuchtik.tancer.cz', RECIPES_DB: createDatabase(t) };
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ keys: [{ ...accessKeys.publicKey.export({ format: 'jwk' }), kid: 'test-key' }] }));

  const create = async (newRecipe, claims) => {
    const response = await worker.fetch(request('https://' + env.MCP_HOST + '/mcp', {
      audience: 'mcp', method: 'POST', claims,
      body: { jsonrpc: '2.0', id: 1, method: 'tools/call',
        params: { name: 'create_recipe', arguments: { recipe: newRecipe } } },
    }), env);
    return (await response.json()).result;
  };
  const newRecipe = { ...recipe, name: 'Čočková polévka' };
  assert.equal((await create(newRecipe, { email: 'reader@example.test' })).isError, true);
  assert.equal((await create({ name: newRecipe.name })).isError, true);
  assert.equal((await create({ ...newRecipe, metadata: { author: 'other' } })).isError, true);

  const result = await create(newRecipe);
  assert.equal(result.isError, false);
  const saved = JSON.parse(result.content[0].text);
  assert.equal(saved.filename, 'cockova-polevka.json');
  assert.match(saved.revision, /^[a-f0-9]{40}$/);
  assert.equal(saved.url, 'https://kuchtik.tancer.cz/?recipe=cockova-polevka');
  assert.equal((await create({ ...newRecipe, tags: ['unwanted'] })).isError, true);

  const response = await worker.fetch(new Request('https://kuchtik.tancer.cz/api/recipes/' + saved.filename), env);
  assert.equal(response.status, 200);
  const stored = await response.json();
  assert.equal(stored.name, newRecipe.name);
  assert.deepEqual(stored.tags, newRecipe.tags);
});
