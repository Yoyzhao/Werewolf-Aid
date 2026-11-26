import { expect, test } from '@playwright/test';

import { expectNoHorizontalOverflow } from './helpers';

const EVIDENCE = '.artifacts/e2e/T-018';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('lrs.guide.v1', '1');
  });
});

test('助手：身份、标签、记录与上下文预览', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: '助手', exact: true }).click();

  await expect(page.getByRole('heading', { name: '我的身份档案' })).toBeVisible();
  await page.getByRole('button', { name: '预言家' }).click();
  await page.getByRole('button', { name: '3 号 查杀' }).click();
  await page.getByLabel('3 号信息记录').fill('与 7 号互保');
  await page.getByLabel('3 号第 1 轮发言要点').fill('悍跳预言家');

  const context = page.getByRole('region', { name: 'AI 上下文预览内容' });
  await expect(context).toContainText('预言家（好人阵营）');
  await expect(context).toContainText('3 号：查杀');
  await expect(context).toContainText('3 号：与 7 号互保');
  await expect(context).toContainText('3 号（第 1 轮）：悍跳预言家');

  await expectNoHorizontalOverflow(page, '助手 390');
  await page.screenshot({ path: `${EVIDENCE}/assistant-390.png` });
});

test('助手：320 与 430 宽度无横向滚动', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/');
  await page.getByRole('button', { name: '我的助手', exact: true }).click();
  await expect(page.getByRole('heading', { name: '我的身份档案' })).toBeVisible();
  await expectNoHorizontalOverflow(page, '助手 320');

  await page.setViewportSize({ width: 430, height: 932 });
  await expectNoHorizontalOverflow(page, '助手 430');
  await page.screenshot({ path: `${EVIDENCE}/assistant-430.png` });
});
