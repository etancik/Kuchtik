import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const output = new URL('dist/', root);
await mkdir(output, { recursive: true });
await rm(new URL('src/', output), { recursive: true, force: true });
for (const entry of await readdir(output)) {
  if (!['index.html', 'style.css', 'favicon.svg'].includes(entry)) {
    throw new Error('Unexpected Worker asset: ' + entry);
  }
}
for (const path of ['style.css', 'favicon.svg']) {
  await cp(new URL(path, root), new URL(path, output));
}
await cp(new URL('src/', root), new URL('src/', output), {
  recursive: true,
  filter: path => !path.split(/[\\/]/).includes('__tests__'),
});
const html = await readFile(new URL('index.html', root), 'utf8');
await writeFile(new URL('index.html', output), html.replace('<head>', '<head>\n  <meta name="kuchtik-host" content="worker">'));
