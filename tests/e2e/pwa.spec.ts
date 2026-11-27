import { appendFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

const EVIDENCE = '.artifacts/e2e/T-043';
const SW_PATH = fileURLToPath(new URL('../../apps/web/dist/sw.js', import.meta.url));

test.use({ baseURL: 'http://localhost:4173' });
test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('lrs.guide.v1', '1');
  });
});

test('AC-15：离线冷启动打开应用壳并读取助手记录', async ({ page, context }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '狼人杀助手' })).toBeVisible();

  await page.waitForFunction(async () => {
    const registration = await navigator.serviceWorker.ready;
    return registration.active?.state === 'activated';
  });
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));

  await page.getByRole('button', { name: '我的助手', exact: true }).click();
  await expect(page.getByRole('heading', { name: '我的身份档案' })).toBeVisible();
  await page.getByRole('button', { name: '守卫' }).click();
  await page.getByLabel('自由描述').fill('离线前写入的助手记录');
  await page.waitForTimeout(800);

  await context.setOffline(true);
  try {
    await page.reload();
    await expect(page.getByText('离线模式')).toBeVisible();
    await expect(page.getByRole('heading', { name: '狼人杀助手' })).toBeVisible();
    await page.screenshot({ path: `${EVIDENCE}/offline-home-390.png` });

    await page.getByRole('button', { name: '我的助手', exact: true }).click();
    await expect(page.getByRole('heading', { name: '我的身份档案' })).toBeVisible();
    await expect(page.getByRole('button', { name: '守卫' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByLabel('自由描述')).toHaveValue('离线前写入的助手记录');
    await page.screenshot({ path: `${EVIDENCE}/offline-assistant-390.png` });
  } finally {
    await context.setOffline(false);
  }
});

test('manifest 可读取且 Service Worker 已注册', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    'href',
    '/manifest.webmanifest',
  );

  const response = await page.request.get('http://localhost:4173/manifest.webmanifest');
  expect(response.ok()).toBeTruthy();
  const manifest = (await response.json()) as { name?: string; icons?: unknown[] };
  expect(manifest.name).toContain('狼人杀助手');
  expect(manifest.icons?.length ?? 0).toBeGreaterThanOrEqual(2);

  await page.waitForFunction(() => navigator.serviceWorker.getRegistration().then(Boolean));
});

test('在线更新：检测到新版本并可刷新生效', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/');

  await page.waitForFunction(async () => {
    const registration = await navigator.serviceWorker.ready;
    return registration.active?.state === 'activated';
  });
  if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) {
    await page.reload();
  }
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));

  await appendFile(SW_PATH, `\n// e2e-update-${Date.now()}\n`);
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    await registration?.update();
  });

  await expect(page.getByText(/有新版本/)).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: `${EVIDENCE}/update-banner-390.png` });

  await page.getByRole('button', { name: '刷新更新' }).click();
  await expect(page.getByRole('heading', { name: '狼人杀助手' })).toBeVisible({
    timeout: 20_000,
  });
});
