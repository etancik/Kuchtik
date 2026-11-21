import { spawnSync } from 'node:child_process';

const mode = process.argv[2];
const { WORKERS_CI, WORKERS_CI_BRANCH, WORKERS_CI_COMMIT_SHA, WORKERS_CI_BUILD_UUID } = process.env;
if (!['production', 'preview'].includes(mode) || WORKERS_CI !== '1' || !WORKERS_CI_BRANCH ||
    (mode === 'production') !== (WORKERS_CI_BRANCH === 'main') ||
    !/^[a-f0-9]{40}$/i.test(WORKERS_CI_COMMIT_SHA ?? '') ||
    !/^[a-f0-9-]{36}$/i.test(WORKERS_CI_BUILD_UUID ?? '')) {
  throw new Error('Deploy requires the corresponding Cloudflare Workers Builds branch and build context.');
}

if (WORKERS_CI_BRANCH === 'kuchtik-preview-recipes') {
  console.log('Recipe test data branch has no Worker preview.');
  process.exit(0);
}

const args = ['--yes', 'wrangler@4.151.2', mode === 'preview' ? 'preview' : 'deploy',
  '--message', 'Git ' + WORKERS_CI_COMMIT_SHA + ' / Build ' + WORKERS_CI_BUILD_UUID];

const result = spawnSync('npx', args, { stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
