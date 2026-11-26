import { expect, test } from '@playwright/test';

import { enterNight, expectNoHorizontalOverflow, playFirstNight } from './helpers';

const EVIDENCE = 'docs/test/evidence/M1/T-030';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('lrs.guide.v1', '1');
  });
});

test('模式 C 首夜 → 竞选 → 死讯 → 发言 → 投票', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterNight(page);
  await expect(page.getByText('第 1 夜 · 第 1 / 4 步')).toBeVisible();
  await page.screenshot({ path: `${EVIDENCE}/night-guard-390.png` });

  await playFirstNight(page);

  await expect(page.getByRole('heading', { name: '警长竞选' })).toBeVisible();
  await page.screenshot({ path: `${EVIDENCE}/sheriff-signup-390.png` });

  await page.getByRole('button', { name: '无人上警 · 本局无警长' }).click();
  await expect(page.getByRole('heading', { name: '本局无警长' })).toBeVisible();
  await page.getByRole('button', { name: '公布死讯' }).click();

  await expect(page.getByRole('heading', { name: '天亮了' })).toBeVisible();
  await expect(page.getByText('平安夜：昨夜无人出局')).toBeVisible();
  await page.screenshot({ path: `${EVIDENCE}/dawn-peace-390.png` });

  await page.getByRole('button', { name: '进入发言' }).click();
  await expect(page.getByRole('heading', { name: '依次发言' })).toBeVisible();
  await page.screenshot({ path: `${EVIDENCE}/speech-390.png` });

  await page.getByRole('button', { name: '进入投票' }).click();
  await expect(page.getByRole('heading', { name: '放逐投票' })).toBeVisible();
  await page.screenshot({ path: `${EVIDENCE}/vote-entry-390.png` });
});

test('夜间/竞选/死讯/发言在 320 与 430 宽度无横向滚动', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterNight(page);

  for (const width of [320, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await expectNoHorizontalOverflow(page, `${width}px 夜间`);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await playFirstNight(page);
  await expect(page.getByRole('heading', { name: '警长竞选' })).toBeVisible();

  await page.setViewportSize({ width: 430, height: 844 });
  await expectNoHorizontalOverflow(page, '430px 竞选');
  await page.screenshot({ path: `${EVIDENCE}/sheriff-430.png` });
  await page.setViewportSize({ width: 320, height: 844 });
  await expectNoHorizontalOverflow(page, '320px 竞选');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '无人上警 · 本局无警长' }).click();
  await page.getByRole('button', { name: '公布死讯' }).click();
  await expect(page.getByRole('heading', { name: '天亮了' })).toBeVisible();

  for (const width of [320, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await expectNoHorizontalOverflow(page, `${width}px 死讯`);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '进入发言' }).click();
  await expect(page.getByRole('heading', { name: '依次发言' })).toBeVisible();

  await page.setViewportSize({ width: 320, height: 844 });
  await expectNoHorizontalOverflow(page, '320px 发言');
  await page.screenshot({ path: `${EVIDENCE}/speech-320.png` });
  await page.setViewportSize({ width: 430, height: 844 });
  await expectNoHorizontalOverflow(page, '430px 发言');
});
