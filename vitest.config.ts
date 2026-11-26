import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const resolvePath = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@lrs/shared': resolvePath('./packages/shared/src/index.ts'),
      '@lrs/game-engine': resolvePath('./packages/game-engine/src/index.ts'),
      '@lrs/rules-content': resolvePath('./packages/rules-content/src/index.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./apps/web/src/test/setup.ts'],
    include: ['apps/web/src/**/*.test.{ts,tsx}', 'packages/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: '.artifacts/coverage',
      include: ['apps/web/src/**', 'packages/**/src/**'],
    },
  },
});
