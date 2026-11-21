const encoder = new TextEncoder();
const keySets = new Map();

function decodePart(value) {
  return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0));
}

function parsePart(value) {
  return JSON.parse(new TextDecoder().decode(decodePart(value)));
}

async function loadKeys(issuer, refresh = false) {
  const cached = keySets.get(issuer);
  if (!refresh && cached?.expires > Date.now()) return cached.keys;
  const response = await fetch(new URL('/cdn-cgi/access/certs', issuer));
  if (!response.ok) throw new Error('Access keys unavailable');
  const { keys } = await response.json();
  keySets.set(issuer, { keys, expires: Date.now() + 300_000 });
  return keys;
}

export async function accessIdentity(request, env, audience) {
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token || !audience || !env.ACCESS_ISSUER) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, payload, signature] = parts;
    const { alg, kid } = parsePart(header);
    const claims = parsePart(payload);
    const now = Date.now() / 1000;
    if (alg !== 'RS256' || typeof kid !== 'string' || claims.iss !== env.ACCESS_ISSUER ||
        ![claims.aud].flat().includes(audience) || !Number.isFinite(claims.exp) ||
        claims.exp <= now || (claims.nbf !== undefined && !(claims.nbf <= now)) ||
        typeof claims.sub !== 'string' || !claims.sub || typeof claims.email !== 'string' ||
        !claims.email) return null;

    const keys = await loadKeys(env.ACCESS_ISSUER);
    const jwk = keys.find(key => key.kid === kid) ??
      (await loadKeys(env.ACCESS_ISSUER, true)).find(key => key.kid === kid);
    if (!jwk) return null;
    const publicKey = await crypto.subtle.importKey('jwk', jwk, {
      name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256',
    }, false, ['verify']);
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey,
      decodePart(signature), encoder.encode(header + '.' + payload));
    return ok ? {
      email: claims.email.toLowerCase(),
      subject: claims.sub,
      name: typeof claims.name === 'string' ? claims.name.trim() : '',
    } : null;
  } catch {
    return null;
  }
}
