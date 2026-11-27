import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: '.artifacts/test-results',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'npm run dev -w @lrs/web',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: 'npm run dev:api',
      url: 'http://127.0.0.1:3000/api/v1/health',
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      // PWA 用例需要生产构建与 Service Worker；已有预览进程时直接复用。
      command: 'npm run build && npm run preview -w @lrs/web',
      url: 'http://localhost:4173',
      reuseExistingServer: true,
      timeout: 180_000,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
