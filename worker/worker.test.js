import test from 'node:test';
import assert from 'node:assert/strict';
import { createPrivateKey, createSign, generateKeyPairSync, createVerify } from 'node:crypto';
import worker from './index.js';
import { mcpReply } from './mcp.js';

const web = 'https://kuchtik-preview-tancer-kuchtik.etancik.workers.dev';
const mcp = web;
const branchWeb = 'https://feature-tancer-kuchtik.etancik.workers.dev';
const issuer = 'https://test.cloudflareaccess.com';
const writer = 'editor@example.test';
const revision = 'a'.repeat(40);
const commit = 'b'.repeat(40);
const recipe = { name: 'Řízky', ingredients: [{ text: 'sůl', exportDefault: false }], instructions: ['Osolit'], tags: ['oběd'] };
const accessKeys = generateKeyPairSync('rsa', { modulusLength: 2048 });
const gitHubKeys = generateKeyPairSync('rsa', { modulusLength: 2048 });

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

const env = {
  WEB_HOST: new URL(web).hostname,
  PREVIEW_INTEGRATION_HOST: new URL(web).hostname,
  PREVIEW: '1',
  ACCESS_ISSUER: issuer,
  ACCESS_WEB_AUD: 'web',
  ACCESS_MCP_AUD: 'mcp',
  MCP_WRITER_EMAIL: writer,
  GITHUB_APP_ID: '123',
  GITHUB_INSTALLATION_ID: '456',
  GITHUB_APP_PRIVATE_KEY: createPrivateKey(gitHubKeys.privateKey.export({ type: 'pkcs1', format: 'pem' }))
    .export({ type: 'pkcs1', format: 'pem' }),
  ASSETS: { fetch: request => new Response(new URL(request.url).pathname) },
};

test('Worker isolates Access audiences and writes preview edits with the read revision', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (input, options) => {
    const url = new URL(input);
    if (url.origin === issuer) {
      assert.equal(url.pathname, '/cdn-cgi/access/certs');
      return Response.json({ keys: [{ ...accessKeys.publicKey.export({ format: 'jwk' }), kid: 'test-key' }] });
    }

    assert.equal(url.origin, 'https://api.github.com');
    calls.push({ url, ...options });
    if (url.pathname === '/app/installations/456/access_tokens') {
      const [, jwt] = options.headers.Authorization.split(' ');
      const [header, claims, signature] = jwt.split('.');
      assert.equal(JSON.parse(Buffer.from(claims, 'base64url')).iss, '123');
      assert.ok(createVerify('RSA-SHA256').update(header + '.' + claims)
        .verify(gitHubKeys.publicKey, signature, 'base64url'));
      assert.deepEqual(JSON.parse(options.body), { repositories: ['Kuchtik'], permissions: { contents: 'write' } });
      return Response.json({ token: 'installation-token', expires_at: new Date(Date.now() + 3600_000).toISOString() });
    }
    assert.equal(url.pathname, '/repos/etancik/Kuchtik/contents/recipes/rizky.json');
    assert.equal(options.headers.Authorization, 'Bearer installation-token');
    if (options.method === 'GET') {
      assert.equal(url.searchParams.get('ref'), 'kuchtik-preview-recipes');
      return Response.json({ content: Buffer.from(JSON.stringify(recipe)).toString('base64'), sha: revision });
    }
    const data = JSON.parse(options.body);
    assert.equal(data.branch, 'kuchtik-preview-recipes');
    assert.equal(data.sha, revision);
    const saved = JSON.parse(Buffer.from(data.content, 'base64').toString());
    assert.equal(saved.name, 'Kuřecí řízky');
    assert.equal(saved.metadata.filename, 'rizky.json');
    assert.equal(saved.metadata.sha, undefined);
    assert.deepEqual(saved.ingredients, recipe.ingredients);
    return Response.json({ content: { sha: 'c'.repeat(40) }, commit: { sha: commit } });
  });

  assert.equal((await worker.fetch(request(web), env)).status, 401);
  assert.equal((await worker.fetch(request(web + '/admin/', { audience: 'mcp' }), env)).status, 401);
  const branchEnv = { ...env, GITHUB_APP_PRIVATE_KEY: undefined, PREVIEW_INTEGRATION_HOST: undefined };
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
  assert.equal(calls.length, 0);

  const invalid = structuredClone(call);
  invalid.params.arguments.revision = 'd'.repeat(40);
  assert.equal((await (await run(invalid)).json()).result.isError, true);
  assert.equal(calls.filter(call => call.method === 'PUT').length, 0);

  const result = await (await run(call)).json();
  assert.equal(result.result.isError, false);
  assert.equal(JSON.parse(result.result.content[0].text).commit, commit);
  assert.equal(calls.filter(call => call.method === 'PUT').length, 1);

  const editorWrite = await worker.fetch(request(web + '/admin/api/recipes/rizky.json', {
    audience: 'web', method: 'PUT', origin: web, body: { recipe: { ...recipe, name: 'Kuřecí řízky' }, revision },
  }), env);
  assert.equal(editorWrite.status, 200);
  assert.equal(calls.filter(call => call.method === 'PUT').length, 2);

  const foreignOrigin = await worker.fetch(request(web + '/admin/api/recipes/rizky.json', {
    audience: 'web', method: 'PUT', origin: branchWeb, body: { recipe, revision },
  }), env);
  assert.equal(foreignOrigin.status, 403);
  assert.equal(calls.filter(call => call.method === 'PUT').length, 2);
});

test('MCP negotiates protocol, hides writes for readers and returns empty notification replies', async () => {
  const message = { jsonrpc: '2.0', id: 1 };
  const response = await mcpReply({ ...message, method: 'initialize', params: { protocolVersion: '2025-06-18' } });
  assert.equal(response.result.protocolVersion, '2025-06-18');
  assert.equal(await mcpReply({ jsonrpc: '2.0', method: 'notifications/initialized' }), null);
  const { result } = await mcpReply({ ...message, method: 'tools/list' }, null, null, false);
  assert.deepEqual(result.tools.map(tool => tool.name), ['search_recipes', 'get_recipe']);
});
