import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('lrs.guide.v1', '1');
  });
});

test('开局设置 → 模式 C 发牌 → 12 人进入天黑', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '狼人杀助手' })).toBeVisible();

  await page.getByRole('button', { name: /开始主持/ }).click();
  await expect(page.getByRole('heading', { name: '开局设置' })).toBeVisible();
  await expect(page.getByRole('button', { name: /预女猎守/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await page.getByRole('button', { name: /实体牌录入/ }).click();
  await page.getByRole('button', { name: /开始发牌/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: '开始' }).click();

  await expect(page.getByRole('heading', { name: /发牌 · 实体牌录入/ })).toBeVisible();
  await page.getByRole('button', { name: /预言家 · 余 1/ }).click();
  await expect(page.getByText('请为 2 号手动选择身份')).toBeVisible();
  await expect(page.getByRole('button', { name: /预言家 · 余 0/ })).toBeDisabled();

  await page.getByRole('button', { name: /撤销上一位/ }).click();
  await expect(page.getByText('请为 1 号手动选择身份')).toBeVisible();

  const roles = [
    '预言家',
    '女巫',
    '猎人',
    '守卫',
    '平民',
    '平民',
    '平民',
    '平民',
    '狼人',
    '狼人',
    '狼人',
    '狼人',
  ];
  for (const role of roles) {
    const tag = page.getByRole('button', { name: new RegExp(`^${role} · 余 \\d+$`) }).first();
    await tag.click();
  }

  await expect(page.getByText('12 位身份已录入完成')).toBeVisible();
  await page.getByRole('button', { name: /完成发牌，进入天黑/ }).click();
  await expect(page.getByRole('heading', { name: '天黑请闭眼' })).toBeVisible();
});

test('刷新后从首页继续模式 C 发牌', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /开始主持/ }).click();
  await page.getByRole('button', { name: /实体牌录入/ }).click();
  await page.getByRole('button', { name: /开始发牌/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: '开始' }).click();
  await page.getByRole('button', { name: /预言家 · 余 1/ }).click();
  await expect(page.getByText('请为 2 号手动选择身份')).toBeVisible();

  await page.reload();
  await expect(page.getByText(/继续上一局/)).toBeVisible();
  await page.getByRole('button', { name: '继续' }).click();

  await expect(page.getByRole('heading', { name: /发牌 · 实体牌录入/ })).toBeVisible();
  await expect(page.getByText('请为 2 号手动选择身份')).toBeVisible();
  await expect(page.getByText('1 / 12').first()).toBeVisible();
});

test('320 与 430 宽度无横向滚动', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: /开始主持/ }).click();
  await expect(page.getByRole('heading', { name: '开局设置' })).toBeVisible();

  for (const width of [320, 430]) {
    await page.setViewportSize({ width, height: 844 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `${width}px 横向溢出`).toBeLessThanOrEqual(0);
  }
});
