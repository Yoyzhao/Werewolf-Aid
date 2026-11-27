import { expect, test } from '@playwright/test';

import { expectNoHorizontalOverflow } from './helpers';

const EVIDENCE = '.artifacts/e2e/T-042';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('lrs.guide.v1', '1');
  });
});

test('助手 AI：敏感信息提示与 500 字提交上限', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: '我的助手', exact: true }).click();
  await expect(page.getByRole('heading', { name: '我的身份档案' })).toBeVisible();

  await page.getByLabel('接口地址').fill('https://api.example.com/v1/chat/completions');
  await page.getByLabel('模型名').fill('gpt-test');
  await page.getByLabel('API Key').fill('sk-filter-e2e');
  await page.getByRole('button', { name: '保存配置' }).click();
  await expect(page.getByText('已配置')).toBeVisible();

  const freeText = page.getByLabel('自由描述');
  await freeText.fill('电话 13800138000，身份证 11010519491231002X');
  await expect(page.getByText('检测到疑似手机号、身份证号，请勿填写真实个人信息。')).toBeVisible();
  await page.screenshot({ path: `${EVIDENCE}/ai-filter-sensitive-390.png` });

  await freeText.fill('甲'.repeat(501));
  await expect(page.getByText('501 / 500')).toBeVisible();
  await expect(
    page.getByText('自由描述最多 500 字，当前 501 字；请精简后再让 AI 整理。'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: '让军师整理' })).toBeDisabled();
  await page.screenshot({ path: `${EVIDENCE}/ai-filter-limit-390.png` });

  await page.setViewportSize({ width: 320, height: 720 });
  await expectNoHorizontalOverflow(page, 'T-042 AI 过滤 320');
  await page.setViewportSize({ width: 430, height: 932 });
  await expectNoHorizontalOverflow(page, 'T-042 AI 过滤 430');
});
