import { expect, test } from '@playwright/test';

import { expectNoHorizontalOverflow } from './helpers';

const EVIDENCE = '.artifacts/e2e/T-041';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('lrs.guide.v1', '1');
  });
});

test('规则页：术语表、跨范围搜索高亮与响应式', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: '先翻规则书' }).click();
  await expect(page.getByRole('heading', { name: '月蚀规则书' })).toBeVisible();
  await page.addStyleTag({ content: '.topbar{position:static!important}' });

  await page.getByRole('tab', { name: '术语表' }).click();
  await expect(page.getByRole('heading', { name: '同守同救' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '连守' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '判定' })).toBeVisible();
  await page.screenshot({ path: `${EVIDENCE}/terms-390.png`, fullPage: true });

  await page.getByLabel('搜索规则与术语').fill('金水');
  const results = page.getByRole('region', { name: '搜索结果' });
  await expect(results.getByRole('heading', { name: '金水' })).toBeVisible();
  await expect(results.getByRole('heading', { name: '预言家' })).toBeVisible();
  await expect(results.locator('mark').first()).toHaveText('金水');
  await page.screenshot({ path: `${EVIDENCE}/search-390.png`, fullPage: true });

  await page.getByLabel('搜索规则与术语').fill('完全不存在的关键词');
  await expect(page.getByText('没有找到相关术语，试试更短的关键词')).toBeVisible();

  await page.setViewportSize({ width: 320, height: 720 });
  await expectNoHorizontalOverflow(page, 'T-041 规则搜索 320');
  await page.screenshot({ path: `${EVIDENCE}/search-320.png`, fullPage: true });

  await page.setViewportSize({ width: 430, height: 932 });
  await expectNoHorizontalOverflow(page, 'T-041 规则搜索 430');
  await page.screenshot({ path: `${EVIDENCE}/search-430.png`, fullPage: true });
});

test('助手笔记：自动保存、刷新保留与手动引用', async ({ page }) => {
  const note = '7 号倒钩嫌疑，重点听发言；3 号金水可信';
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: '我的助手', exact: true }).click();
  await expect(page.getByRole('heading', { name: '我的身份档案' })).toBeVisible();

  await page.getByRole('tab', { name: '笔记' }).click();
  const notes = page.getByLabel('私人笔记');
  await notes.fill(note);
  await expect(page.getByText('已保存')).toBeVisible({ timeout: 5000 });

  await page.addStyleTag({ content: '.topbar{position:static!important}' });
  await page.screenshot({ path: `${EVIDENCE}/notes-390.png`, fullPage: true });
  await expectNoHorizontalOverflow(page, 'T-041 笔记 390');

  await page.setViewportSize({ width: 320, height: 720 });
  await expectNoHorizontalOverflow(page, 'T-041 笔记 320');
  await page.setViewportSize({ width: 430, height: 932 });
  await expectNoHorizontalOverflow(page, 'T-041 笔记 430');
  await page.screenshot({ path: `${EVIDENCE}/notes-430.png`, fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.getByRole('button', { name: '我的助手', exact: true }).click();
  await page.getByRole('tab', { name: '笔记' }).click();
  await expect(page.getByLabel('私人笔记')).toHaveValue(note);

  await page.getByRole('button', { name: '引用到自由描述' }).click();
  await page.getByRole('tab', { name: '记录' }).click();
  await expect(page.getByLabel('自由描述')).toHaveValue(`【笔记引用】${note}`);
  await expect(page.getByRole('region', { name: 'AI 上下文预览内容' })).toContainText(note);
});
