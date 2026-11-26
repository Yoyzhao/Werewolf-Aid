import { expect, type Page } from '@playwright/test';

export const EVIDENCE_DIR = 'docs/test/evidence/M1';

export async function enterNight(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: /开始主持/ }).click();
  await page.getByRole('button', { name: /实体牌录入/ }).click();
  await page.getByRole('button', { name: /开始发牌/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: '开始' }).click();

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
    await page
      .getByRole('button', { name: new RegExp(`^${role} · 余 \\d+$`) })
      .first()
      .click();
  }

  await page.getByRole('button', { name: /完成发牌，进入天黑/ }).click();
  await expect(page.getByRole('heading', { name: '天黑请闭眼' })).toBeVisible();
}

export async function playFirstNight(page: Page, witch: 'save' | 'none' = 'save'): Promise<void> {
  await page.getByRole('button', { name: '空守' }).click();
  await page.getByRole('button', { name: '确认，下一位' }).click();

  await page
    .getByRole('group', { name: '预言家目标选择' })
    .getByRole('button', { name: /^09/ })
    .click();
  await expect(page.getByText('9 号是狼人（仅主持端可见）')).toBeVisible();
  await page.getByRole('button', { name: '确认，下一位' }).click();

  await expect(page.getByText(/9 号 狼人、10 号 狼人/)).toBeVisible();
  await page
    .getByRole('group', { name: '狼人目标选择' })
    .getByRole('button', { name: /^05/ })
    .click();
  await page.getByRole('button', { name: '确认，下一位' }).click();

  await expect(page.getByText('今晚 5 号被刀（仅女巫可见）。')).toBeVisible();
  if (witch === 'save') {
    await page.getByRole('button', { name: '解药救 5 号' }).click();
  } else {
    await page.getByRole('button', { name: '不用药' }).click();
  }
  await page.getByRole('button', { name: '天亮了，结算夜晚' }).click();
}

export async function enterVote(page: Page): Promise<void> {
  await enterNight(page);
  await playFirstNight(page, 'none');

  await expect(page.getByRole('heading', { name: '警长竞选' })).toBeVisible();
  await page.getByRole('button', { name: '无人上警 · 本局无警长' }).click();
  await page.getByRole('button', { name: '公布死讯' }).click();

  await expect(page.getByRole('heading', { name: '天亮了' })).toBeVisible();
  await page.getByRole('button', { name: '进入发言' }).click();
  await expect(page.getByRole('heading', { name: '依次发言' })).toBeVisible();
  await page.getByRole('button', { name: '进入投票' }).click();
  await expect(page.getByRole('heading', { name: '放逐投票' })).toBeVisible();
}

export async function expectNoHorizontalOverflow(page: Page, label: string): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `${label} 横向溢出`).toBeLessThanOrEqual(0);
}
