import { expect, test } from '@playwright/test';

test('web scaffold loads', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('lrs.guide.v1', '1');
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '狼人杀助手' })).toBeVisible();
});
