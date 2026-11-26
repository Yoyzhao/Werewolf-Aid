import { expect, test } from '@playwright/test';

import { expectNoHorizontalOverflow } from './helpers';

const EVIDENCE = '.artifacts/e2e/T-020';

const SUCCESS_CONTENT = [
  '信息整理：预言家已查验 3 号，结果为查杀。',
  '可疑对象：3 号与 7 号互相保人，发言与记录矛盾。',
  '下一步建议：白天优先听 3 号解释，再决定放逐顺序。',
  '依据：3 号信息记录、3 号第 1 轮发言要点。',
].join('\n');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('lrs.guide.v1', '1');
  });
});

test('助手 AI：配置后请求成功并展示三段结果', async ({ page }) => {
  const relayBodies: Array<Record<string, unknown>> = [];

  await page.route('**/api/v1/session', (route) =>
    route.fulfill({
      json: { csrfToken: 'c'.repeat(64), expiresAt: Date.now() + 60_000 },
    }),
  );
  await page.route('**/api/v1/ai/relay', async (route) => {
    relayBodies.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({ json: { ok: true, content: SUCCESS_CONTENT } });
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: '助手', exact: true }).click();
  await expect(page.getByRole('heading', { name: '我的身份档案' })).toBeVisible();

  await page.getByRole('button', { name: '预言家' }).click();
  await page.getByRole('button', { name: '3 号 查杀' }).click();
  await page.getByLabel('接口地址').fill('https://api.example.com/v1/chat/completions');
  await page.getByLabel('模型名').fill('gpt-test');
  await page.getByLabel('API Key').fill('sk-e2e-test');
  await page.getByRole('button', { name: '保存配置' }).click();
  await expect(page.getByText('已配置')).toBeVisible();

  await page.getByRole('button', { name: '让军师整理' }).click();
  const result = page.getByRole('region', { name: 'AI 分析结果' });
  await expect(result).toContainText('信息整理：预言家已查验 3 号，结果为查杀。');
  await expect(result).toContainText('可疑对象：3 号与 7 号互相保人');
  await expect(result).toContainText('下一步建议：白天优先听 3 号解释');
  await expect(page.getByText('AI 分析仅供参考，可能出错，请自行判断。')).toBeVisible();

  expect(relayBodies).toHaveLength(1);
  const body = relayBodies[0] ?? {};
  expect(Object.keys(body).sort()).toEqual([
    'apiKey',
    'baseUrl',
    'maxTokens',
    'messages',
    'model',
    'temperature',
  ]);
  const messages = body.messages as Array<{ role: string; content: string }>;
  expect(messages[0]?.role).toBe('system');
  expect(messages[1]?.content).toContain('【我的身份】');
  expect(messages[1]?.content).toContain('预言家');
  expect(messages[1]?.content).toContain('3 号：查杀');

  await expectNoHorizontalOverflow(page, '助手 AI 390');
  await page
    .locator('section[aria-labelledby="ai-config-title"]')
    .screenshot({ path: `${EVIDENCE}/assistant-ai-form-390.png` });
  await page
    .locator('section[aria-labelledby="ai-panel-title"]')
    .screenshot({ path: `${EVIDENCE}/assistant-ai-result-390.png` });
});

test('助手 AI：真实 API 拒绝私网地址并提示修改配置', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/');
  await page.getByRole('button', { name: /我的助手/ }).click();
  await expect(page.getByRole('heading', { name: '我的身份档案' })).toBeVisible();

  await page.getByLabel('接口地址').fill('https://127.0.0.1/v1');
  await page.getByLabel('模型名').fill('gpt-test');
  await page.getByLabel('API Key').fill('sk-e2e-test');
  await page.getByRole('button', { name: '保存配置' }).click();
  await expect(page.getByText('已配置')).toBeVisible();

  await page.getByRole('button', { name: '让军师整理' }).click();
  await expect(page.getByRole('alert')).toContainText('该地址不被允许，请使用 HTTPS 公网地址');
  await expect(page.getByText('请修改配置后重试。')).toBeVisible();
  await expect(page.getByRole('button', { name: '重试' })).toHaveCount(0);

  await expectNoHorizontalOverflow(page, '助手 AI 320');
  await page
    .locator('section[aria-labelledby="ai-panel-title"]')
    .screenshot({ path: `${EVIDENCE}/assistant-ai-error-320.png` });

  await page.setViewportSize({ width: 430, height: 932 });
  await expectNoHorizontalOverflow(page, '助手 AI 430');
  await page
    .locator('section[aria-labelledby="ai-panel-title"]')
    .screenshot({ path: `${EVIDENCE}/assistant-ai-error-430.png` });
});

test('助手 AI：配置持久化，Key 默认不跨刷新', async ({ page }) => {
  const baseUrl = 'https://api.example.com/v1/chat/completions';
  await page.goto('/');
  await page.getByRole('button', { name: /我的助手/ }).click();
  await expect(page.getByRole('heading', { name: '我的身份档案' })).toBeVisible();

  await page.getByLabel('接口地址').fill(baseUrl);
  await page.getByLabel('模型名').fill('gpt-test');
  await page.getByLabel('API Key').fill('sk-e2e-test');
  await page.getByRole('button', { name: '保存配置' }).click();
  await expect(page.getByText('已配置')).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: /我的助手/ }).click();
  await expect(page.getByLabel('接口地址')).toHaveValue(baseUrl);
  await expect(page.getByLabel('模型名')).toHaveValue('gpt-test');
  await expect(
    page.getByText('还没有配置 AI。填写接口地址、模型名和 Key 后即可让军师整理。'),
  ).toBeVisible();
  await expect(page.getByLabel('API Key')).toHaveAttribute('placeholder', 'sk-...');
});

test('助手 AI：勾选记住后 Key 在刷新后仍可用', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /我的助手/ }).click();
  await expect(page.getByRole('heading', { name: '我的身份档案' })).toBeVisible();

  await page.getByLabel('接口地址').fill('https://api.example.com/v1/chat/completions');
  await page.getByLabel('模型名').fill('gpt-test');
  await page.getByLabel('API Key').fill('sk-e2e-test');
  await page.getByLabel('记住本次会话').check();
  await page.getByRole('button', { name: '保存配置' }).click();
  await expect(page.getByText('已配置')).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: /我的助手/ }).click();
  await expect(page.getByText('已配置')).toBeVisible();
  await expect(page.getByLabel('API Key')).toHaveAttribute('placeholder', '已保存，留空保持不变');
});
