import { generateFilenameFromRecipeName, validateRecipe } from '../src/utils/recipeUtils.js';

const api = 'https://api.github.com';
const repo = '/repos/etancik/Kuchtik';
const directory = repo + '/contents/recipes';
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const tokens = new Map();

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function isRecipeFilename(value) {
  return typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*\.json$/.test(value);
}

function encode64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64url(bytes) {
  return encode64(bytes).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function der(tag, bytes) {
  const length = bytes.length;
  const header = length < 128 ? [tag, length]
    : length < 256 ? [tag, 0x81, length] : [tag, 0x82, length >> 8, length & 0xff];
  const result = new Uint8Array(header.length + length);
  result.set(header);
  result.set(bytes, header.length);
  return result;
}

async function signAppJwt(env) {
  const pem = env.GITHUB_APP_PRIVATE_KEY;
  const body = pem.replace(/-----[^-]+-----|\s/g, '');
  let keyBytes = Uint8Array.from(atob(body), char => char.charCodeAt(0));
  if (pem.includes('BEGIN RSA PRIVATE KEY')) {
    // GitHub downloads PKCS#1 keys. Web Crypto imports the PKCS#8 wrapper.
    const rsaAlgorithm = [0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00];
    keyBytes = der(0x30, new Uint8Array([0x02, 0x01, 0x00, ...rsaAlgorithm, ...der(0x04, keyBytes)]));
  }
  const algorithm = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
  const privateKey = await crypto.subtle.importKey('pkcs8', keyBytes, algorithm, false, ['sign']);
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(encoder.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claims = base64url(encoder.encode(JSON.stringify({ iss: env.GITHUB_APP_ID, iat: now - 60, exp: now + 480 })));
  const input = header + '.' + claims;
  const signature = await crypto.subtle.sign(algorithm.name, privateKey, encoder.encode(input));
  return input + '.' + base64url(new Uint8Array(signature));
}

async function github(path, token, method = 'GET', body) {
  return fetch(api + path, {
    method,
    redirect: 'error',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
      'User-Agent': 'Kuchtik-Worker',
      'Cache-Control': 'no-cache',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function installationToken(env) {
  if (!env.GITHUB_APP_ID || !/^\d+$/.test(env.GITHUB_INSTALLATION_ID ?? '') || !env.GITHUB_APP_PRIVATE_KEY) {
    throw new HttpError(503, 'Recipe storage is not configured.');
  }
  const key = env.GITHUB_APP_ID + ':' + env.GITHUB_INSTALLATION_ID;
  const entry = tokens.get(key);
  if (entry?.expires > Date.now() + 60_000) return entry.token;
  const response = await github('/app/installations/' + env.GITHUB_INSTALLATION_ID + '/access_tokens',
    await signAppJwt(env), 'POST', { repositories: ['Kuchtik'], permissions: { contents: 'write' } });
  if (!response.ok) throw new HttpError(502, 'GitHub could not authorize recipe storage.');
  const result = await response.json();
  if (typeof result.token !== 'string' || !result.token) throw new HttpError(502, 'GitHub did not return a storage token.');
  tokens.set(key, { token: result.token, expires: Date.parse(result.expires_at) || 0 });
  return result.token;
}

function isStringArray(value) {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

function isValidRecipe(recipe) {
  return validateRecipe(recipe) &&
    typeof recipe.name === 'string' && !!recipe.name.trim() &&
    Array.isArray(recipe.ingredients) && recipe.ingredients.every(ingredient =>
      typeof ingredient === 'string' ||
      (ingredient && typeof ingredient.text === 'string' &&
        (ingredient.exportDefault === undefined || typeof ingredient.exportDefault === 'boolean'))) &&
    isStringArray(recipe.instructions) && isStringArray(recipe.tags) &&
    (recipe.notes === undefined || isStringArray(recipe.notes) || typeof recipe.notes === 'string') &&
    (recipe.cookingTime === undefined || ['string', 'number'].includes(typeof recipe.cookingTime)) &&
    (recipe.servings === undefined || ['string', 'number'].includes(typeof recipe.servings));
}

function assertFilename(filename) {
  if (!isRecipeFilename(filename)) throw new HttpError(400, 'Invalid recipe filename.');
}

function throwGitHubError(response, mutation = false) {
  if (mutation && [404, 409, 422].includes(response.status)) {
    throw new HttpError(409, 'Recipe changed or already exists. Reload it before saving.');
  }
  if (response.status === 404) throw new HttpError(404, 'Recipe not found.');
  throw new HttpError(502, 'GitHub could not complete the recipe operation.');
}

export function recipeStore(env) {
  if (!['0', '1'].includes(env.PREVIEW)) throw new HttpError(503, 'Recipe environment is not configured.');
  const branch = env.PREVIEW === '1' ? 'kuchtik-preview-recipes' : 'main';
  const ref = '?ref=' + branch;

  async function list() {
    const response = await github(directory + ref, await installationToken(env));
    if (!response.ok) throwGitHubError(response);
    const files = await response.json();
    return files.filter(file => file.type === 'file' && isRecipeFilename(file.name))
      .map(file => file.name);
  }

  async function get(filename) {
    assertFilename(filename);
    const response = await github(directory + '/' + filename + ref, await installationToken(env));
    if (!response.ok) throwGitHubError(response);
    const file = await response.json();
    const content = decoder.decode(Uint8Array.from(atob(file.content.replace(/\s/g, '')), char => char.charCodeAt(0)));
    const recipe = JSON.parse(content);
    const metadata = { ...recipe.metadata, id: filename.slice(0, -5), filename, sha: file.sha };
    return { ...recipe, metadata };
  }

  async function write(operation, filename, recipe, revision, identity) {
    if (operation === 'create') filename = generateFilenameFromRecipeName(recipe?.name);
    assertFilename(filename);
    if (operation !== 'create' && !/^[a-f0-9]{40}$/i.test(revision ?? '')) {
      throw new HttpError(400, 'A recipe revision is required.');
    }
    const body = { branch, message: operation + ' recipe ' + filename };
    if (operation !== 'create') body.sha = revision;
    if (operation !== 'delete') {
      if (!isValidRecipe(recipe)) throw new HttpError(400, 'Invalid recipe data.');
      const metadata = { ...recipe.metadata, id: filename.slice(0, -5), filename };
      delete metadata.sha;
      metadata.lastModified = new Date().toISOString();
      if (operation === 'create') {
        metadata.createdAt = metadata.lastModified;
        metadata.author = identity.email.split('@')[0];
      }
      const contents = encoder.encode(JSON.stringify({ ...recipe, metadata }, null, 2) + '\n');
      if (contents.length > 128_000) throw new HttpError(413, 'Recipe is too large.');
      body.content = encode64(contents);
    }
    const response = await github(directory + '/' + filename, await installationToken(env),
      operation === 'delete' ? 'DELETE' : 'PUT', body);
    if (!response.ok) throwGitHubError(response, true);
    const result = await response.json();
    return { filename, revision: result.content?.sha ?? null, commit: result.commit.sha };
  }

  return { list, get, write };
}
