import { readFile } from 'node:fs/promises';

const modules = await Promise.all([
  import('../packages/shared/dist/index.js'),
  import('../packages/game-engine/dist/index.js'),
  import('../packages/rules-content/dist/index.js'),
  import('../apps/api/dist/app.js'),
]);

const [shared, engine, rulesContent, api] = modules;

const webDist = new URL('../apps/web/dist/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.webmanifest', webDist), 'utf8'));
const serviceWorker = await readFile(new URL('sw.js', webDist), 'utf8');
const precache = await readFile(new URL('precache.js', webDist), 'utf8');

const checks = [
  ['shared', typeof shared.API_VERSION === 'string'],
  [
    'game-engine',
    typeof engine.createGame === 'function' && typeof engine.applyAction === 'function',
  ],
  ['rules-content', typeof rulesContent.RULES_CONTENT_VERSION === 'string'],
  ['api', typeof api.buildApp === 'function'],
  [
    'pwa-manifest',
    manifest.start_url === '/' && Array.isArray(manifest.icons) && manifest.icons.length >= 2,
  ],
  ['pwa-sw', serviceWorker.includes('lrs-shell-') && serviceWorker.includes('lrs-sw-version')],
  ['pwa-precache', precache.includes('__PRECACHE_ASSETS__') && precache.includes('/assets/')],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length > 0) {
  console.error(`dist smoke failed: ${failed.map(([name]) => name).join(', ')}`);
  process.exit(1);
}

console.log(`dist smoke OK: ${checks.map(([name]) => name).join(', ')}`);
