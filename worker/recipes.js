import { generateFilenameFromRecipeName, validateRecipe } from '../src/utils/recipeUtils.js';

const encoder = new TextEncoder();

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function isRecipeFilename(value) {
  return typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*\.json$/.test(value);
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

function readRecipe({ filename, revision, data }) {
  const recipe = JSON.parse(data);
  return { ...recipe, metadata: { ...recipe.metadata, id: filename.slice(0, -5), filename, sha: revision } };
}

export function recipeStore(env) {
  const db = env.RECIPES_DB;
  if (!db) throw new HttpError(503, 'Recipe storage is not configured.');

  async function list() {
    const { results } = await db.prepare('SELECT filename FROM recipes ORDER BY filename').all();
    return results.map(row => row.filename);
  }

  async function all() {
    const { results } = await db.prepare('SELECT filename, revision, data FROM recipes ORDER BY filename').all();
    return results.map(readRecipe);
  }

  async function get(filename) {
    assertFilename(filename);
    const row = await db.prepare('SELECT filename, revision, data FROM recipes WHERE filename = ?')
      .bind(filename).first();
    if (!row) throw new HttpError(404, 'Recipe not found.');
    return readRecipe(row);
  }

  async function write(operation, filename, recipe, revision, identity) {
    if (operation === 'create') filename = generateFilenameFromRecipeName(recipe?.name);
    assertFilename(filename);
    if (operation !== 'create' && !/^[a-f0-9]{40}$/i.test(revision ?? '')) {
      throw new HttpError(400, 'A recipe revision is required.');
    }

    let statement;
    let nextRevision = null;
    if (operation === 'delete') {
      statement = db.prepare('DELETE FROM recipes WHERE filename = ? AND revision = ?')
        .bind(filename, revision);
    } else {
      if (!isValidRecipe(recipe)) throw new HttpError(400, 'Invalid recipe data.');
      const metadata = { ...recipe.metadata, id: filename.slice(0, -5), filename };
      delete metadata.sha;
      metadata.lastModified = new Date().toISOString();
      if (operation === 'create') {
        metadata.createdAt = metadata.lastModified;
        metadata.author = identity.email.split('@')[0];
      }
      const data = JSON.stringify({ ...recipe, metadata });
      if (encoder.encode(data).length > 128_000) throw new HttpError(413, 'Recipe is too large.');
      nextRevision = [...crypto.getRandomValues(new Uint8Array(20))]
        .map(byte => byte.toString(16).padStart(2, '0')).join('');
      statement = operation === 'create'
        ? db.prepare('INSERT INTO recipes (filename, revision, data) VALUES (?, ?, ?) ON CONFLICT(filename) DO NOTHING')
          .bind(filename, nextRevision, data)
        : db.prepare('UPDATE recipes SET revision = ?, data = ? WHERE filename = ? AND revision = ?')
          .bind(nextRevision, data, filename, revision);
    }

    const result = await statement.run();
    if (result.meta.changes !== 1) {
      throw new HttpError(409, 'Recipe changed or already exists. Reload it before saving.');
    }
    return { filename, revision: nextRevision };
  }

  return { list, all, get, write };
}
