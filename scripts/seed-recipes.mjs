import { randomBytes } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const [, , directory, output] = process.argv;
if (!directory || !output) throw new Error('Usage: node scripts/seed-recipes.mjs <recipe-directory> <output.sql>');

const filenames = (await readdir(directory)).filter(name => name.endsWith('.json')).sort();
if (!filenames.length) throw new Error('No recipe JSON files found.');
const quote = text => "'" + text.replaceAll("'", "''") + "'";

const statements = [];
for (const filename of filenames) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*\.json$/.test(filename)) {
    throw new Error('Invalid recipe filename: ' + filename);
  }
  const recipe = JSON.parse(await readFile(join(directory, filename), 'utf8'));
  if (typeof recipe?.name !== 'string' || !recipe.name.trim()) {
    throw new Error('Missing recipe name: ' + filename);
  }
  const data = JSON.stringify(recipe);
  if (Buffer.byteLength(data) > 128_000) throw new Error('Recipe exceeds the storage limit: ' + filename);
  statements.push('INSERT INTO recipes (filename, revision, data) VALUES (' +
    [filename, randomBytes(20).toString('hex'), data].map(quote).join(', ') +
    ') ON CONFLICT(filename) DO NOTHING;');
}

await writeFile(output, statements.join('\n') + '\n', { flag: 'wx' });
console.log('Prepared ' + filenames.length + ' recipes for import.');
