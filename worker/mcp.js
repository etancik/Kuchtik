import { normalizeText } from '../src/utils/recipeUtils.js';
import { HttpError } from './recipes.js';

const versions = ['2025-11-25', '2025-06-18', '2025-03-26'];
const filename = { type: 'string', description: 'Recipe filename returned by search, including .json' };
const fields = ['name', 'ingredients', 'instructions', 'tags', 'notes', 'cookingTime', 'servings'];
const textArray = { type: 'array', items: { type: 'string' } };
const changes = {
  type: 'object',
  minProperties: 1,
  additionalProperties: false,
  properties: {
    name: { type: 'string' },
    ingredients: {
      type: 'array',
      items: { type: 'object', properties: { text: { type: 'string' }, exportDefault: { type: 'boolean' } },
        required: ['text'], additionalProperties: false },
    },
    instructions: textArray,
    tags: textArray,
    notes: textArray,
    cookingTime: { type: 'string' },
    servings: { type: 'number' },
  },
};

function tool(name, description, properties, required, annotations) {
  return {
    name, description,
    inputSchema: { type: 'object', properties, required, additionalProperties: false },
    annotations,
  };
}

const tools = [
  tool('search_recipes', 'Find recipes by name, ingredient, or tag. Leave query empty to list all recipes.',
    { query: { type: 'string' } }, [], { readOnlyHint: true, openWorldHint: false }),
  tool('get_recipe', 'Read a recipe and its current revision.',
    { filename }, ['filename'], { readOnlyHint: true, openWorldHint: false }),
  tool('update_recipe', 'Save requested changes to an existing recipe after showing the user the proposed changes and receiving their approval. Read the recipe first and pass its original revision. Array fields replace the corresponding whole array.',
    { filename, revision: { type: 'string', pattern: '^[a-fA-F0-9]{40}$' }, changes },
    ['filename', 'revision', 'changes'], { readOnlyHint: false, destructiveHint: true, openWorldHint: false }),
];

async function search(store, query = '') {
  if (typeof query !== 'string') throw new HttpError(400, 'Query must be text.');
  const term = normalizeText(query.trim());
  if (!term) return (await store.list()).map(filename => ({ filename }));
  const results = [];
  for (const recipe of await store.all()) {
    const searchable = [recipe.name, ...(recipe.tags ?? []), ...(recipe.ingredients ?? []).map(item => item?.text ?? item)];
    if (searchable.some(value => typeof value === 'string' && normalizeText(value).includes(term))) {
      results.push({ filename: recipe.metadata.filename, name: recipe.name, tags: recipe.tags ?? [] });
    }
  }
  return results;
}

function toolResult(value, isError = false) {
  return { content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value) }], isError };
}

async function callTool(params, store, identity, canWrite) {
  const args = params?.arguments ?? {};
  try {
    switch (params?.name) {
      case 'search_recipes':
        return toolResult(await search(store, args.query));
      case 'get_recipe':
        return toolResult(await store.get(args.filename));
      case 'update_recipe': {
        if (!canWrite) throw new HttpError(403, 'This account cannot write recipes via MCP.');
        if (!args.changes || !Object.keys(args.changes).length ||
            Object.keys(args.changes).some(key => !fields.includes(key))) {
          throw new HttpError(400, 'Specify the recipe fields to update.');
        }
        const recipe = await store.get(args.filename);
        if (recipe.metadata.sha !== args.revision) {
          throw new HttpError(409, 'Recipe changed. Reload it and review the proposed changes again.');
        }
        return toolResult(await store.write('update', args.filename, { ...recipe, ...args.changes }, args.revision, identity));
      }
      default:
        return toolResult('Unknown tool.', true);
    }
  } catch (error) {
    return toolResult(error instanceof HttpError ? error.message : 'Recipe operation failed.', true);
  }
}

export async function mcpReply(message, store, identity, canWrite) {
  const id = message?.id ?? null;
  const reply = { jsonrpc: '2.0', id };
  if (message?.jsonrpc !== '2.0' || typeof message.method !== 'string' ||
      ('id' in message && !['string', 'number'].includes(typeof message.id))) {
    return { ...reply, error: { code: -32600, message: 'Invalid request' } };
  }
  if (!Object.hasOwn(message, 'id')) return null;
  switch (message.method) {
    case 'initialize':
      return { ...reply, result: {
        protocolVersion: versions.includes(message.params?.protocolVersion) ? message.params.protocolVersion : versions[0],
        capabilities: { tools: {} }, serverInfo: { name: 'kuchtik', version: '1.0.0' },
      } };
    case 'ping':
      return { ...reply, result: {} };
    case 'tools/list':
      return { ...reply, result: { tools: canWrite ? tools : tools.slice(0, 2) } };
    case 'tools/call':
      return { ...reply, result: await callTool(message.params, store, identity, canWrite) };
    default:
      return { ...reply, error: { code: -32601, message: 'Method not found' } };
  }
}

export function supportsProtocol(version) {
  return !version || versions.includes(version);
}
