import { expect, test } from '@playwright/test';

import { expectNoHorizontalOverflow } from './helpers';

const EVIDENCE = '.artifacts/e2e/T-034';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('lrs.guide.v1', '1');
  });
});

test('规则页：板子、角色、流程、页脚与响应式', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: '先翻规则书' }).click();

  await expect(page.getByRole('heading', { name: '月蚀规则书' })).toBeVisible();
  await expect(page.getByText('预女猎守').first()).toBeVisible();
  await expect(page.getByText('预女猎白').first()).toBeVisible();
  await expect(page.getByText('依据规则资料整理，以开局约定为准')).toBeVisible();

  await page.getByRole('button', { name: '白狼王' }).click();
  await expect(page.getByText('随狼人共同行动；白天自爆时可带走一名玩家。')).toBeVisible();
  await expect(page.getByText('自爆公开')).toBeVisible();

  await expectNoHorizontalOverflow(page, '规则 390');
  await page.screenshot({ path: `${EVIDENCE}/rules-390.png` });

  await page.setViewportSize({ width: 320, height: 640 });
  await expectNoHorizontalOverflow(page, '规则 320');

  await page.setViewportSize({ width: 430, height: 932 });
  await expectNoHorizontalOverflow(page, '规则 430');
  await page.screenshot({ path: `${EVIDENCE}/rules-430.png` });
});
