import { cp, mkdir, readdir, rm } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const output = new URL('dist/', root);
await mkdir(output, { recursive: true });
await rm(new URL('src/', output), { recursive: true, force: true });
const rootAssets = ['index.html', 'style.css', 'favicon.svg', 'favicon.png', 'favicon.ico', 'apple-touch-icon.png'];
for (const entry of await readdir(output)) {
  if (!rootAssets.includes(entry)) {
    throw new Error('Unexpected Worker asset: ' + entry);
  }
}
for (const path of rootAssets) {
  await cp(new URL(path, root), new URL(path, output));
}
await cp(new URL('src/', root), new URL('src/', output), {
  recursive: true,
  filter: path => !path.split(/[\\/]/).includes('__tests__'),
});
