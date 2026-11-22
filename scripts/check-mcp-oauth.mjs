const endpoint = new URL(process.argv[2] ?? 'https://kuchtik.tancer.cz/mcp');

function isHttps(url) {
  return url.protocol === 'https:' && !url.username && !url.password;
}

async function checkDiscovery() {
  if (!isHttps(endpoint) || endpoint.search || endpoint.hash) {
    throw new Error('Use an HTTPS MCP endpoint without credentials, a query or a fragment.');
  }

  const request = (url, options) => fetch(url, {
    redirect: 'manual',
    signal: AbortSignal.timeout(10_000),
    ...options,
  });
  const response = await request(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-11-25',
        capabilities: {},
        clientInfo: { name: 'kuchtik-oauth-check', version: '1.0.0' },
      },
    }),
  });

  if (response.status !== 401) {
    throw new Error('Expected an anonymous OAuth challenge (401), got HTTP ' + response.status + '. Check the Worker deployment and the exact Access destination.');
  }
  const challenge = response.headers.get('WWW-Authenticate') ?? '';
  const metadataUrl = /^Bearer\b/i.test(challenge) && challenge.match(/\bresource_metadata="([^"]+)"/i)?.[1];
  if (!metadataUrl) {
    throw new Error('Received HTTP 401 without a Bearer resource_metadata challenge. Check Managed OAuth on the Access application for this exact path.');
  }

  const discovery = new URL(metadataUrl);
  if (!isHttps(discovery) || discovery.origin !== endpoint.origin) {
    throw new Error('Expected Cloudflare resource metadata on the MCP endpoint’s HTTPS origin.');
  }
  const metadataResponse = await request(discovery, { headers: { Accept: 'application/json' } });
  if (!metadataResponse.ok) {
    throw new Error('OAuth resource metadata returned HTTP ' + metadataResponse.status + '.');
  }
  const metadata = await metadataResponse.json().catch(() => null);
  if (metadata?.resource !== endpoint.href) {
    throw new Error('OAuth resource metadata must identify the exact MCP endpoint URL.');
  }
  const servers = metadata.authorization_servers;
  if (!Array.isArray(servers) || servers.length === 0 ||
      !servers.every(server => typeof server === 'string' && URL.canParse(server) && isHttps(new URL(server)))) {
    throw new Error('OAuth resource metadata must list at least one HTTPS authorization server.');
  }

  console.log('OAuth discovery works for ' + endpoint.href + '. Verify sign-in and recipe reading in ChatGPT.');
}

checkDiscovery().catch(error => {
  console.error('MCP OAuth check failed: ' + error.message);
  process.exitCode = 1;
});
