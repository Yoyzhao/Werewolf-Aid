const modules = await Promise.all([
  import('../packages/shared/dist/index.js'),
  import('../packages/game-engine/dist/index.js'),
  import('../packages/rules-content/dist/index.js'),
  import('../apps/api/dist/app.js'),
]);

const [shared, engine, rulesContent, api] = modules;

const checks = [
  ['shared', typeof shared.API_VERSION === 'string'],
  [
    'game-engine',
    typeof engine.createGame === 'function' && typeof engine.applyAction === 'function',
  ],
  ['rules-content', typeof rulesContent.RULES_CONTENT_VERSION === 'string'],
  ['api', typeof api.buildApp === 'function'],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length > 0) {
  console.error(`dist smoke failed: ${failed.map(([name]) => name).join(', ')}`);
  process.exit(1);
}

console.log(`dist smoke OK: ${checks.map(([name]) => name).join(', ')}`);
