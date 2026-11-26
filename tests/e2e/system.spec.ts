import { expect, test, type Page } from '@playwright/test';

import { expectNoHorizontalOverflow } from './helpers';

const EVIDENCE = '.artifacts/e2e/T-022';

const GUARD_BOARD = {
  name: '预女猎守',
  roles: [
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
  ],
  hasGuard: true,
} as const;

const IDIOT_BOARD = {
  name: '预女猎白',
  roles: [
    '预言家',
    '女巫',
    '猎人',
    '白痴',
    '平民',
    '平民',
    '平民',
    '平民',
    '狼人',
    '狼人',
    '狼人',
    '白狼王',
  ],
  hasGuard: false,
} as const;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('lrs.guide.v1', '1');
  });
});

async function startManualDeal(
  page: Page,
  boardName: string,
  options: { goto?: boolean } = {},
): Promise<void> {
  if (options.goto !== false) await page.goto('/');
  await page.getByRole('button', { name: /开始主持/ }).click();
  if (boardName === '预女猎白') {
    await page.getByRole('button', { name: /预女猎白/ }).click();
  }
  await page.getByRole('button', { name: /实体牌录入/ }).click();
  await page.getByRole('button', { name: /开始发牌/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: '开始' }).click();
  await expect(page.getByRole('heading', { name: /发牌 · 实体牌录入/ })).toBeVisible();
}

async function assignRoles(page: Page, roles: readonly string[]): Promise<void> {
  for (const role of roles) {
    await page
      .getByRole('button', { name: new RegExp(`^${role} · 余 \\d+$`) })
      .first()
      .click();
  }
  await expect(page.getByText('12 位身份已录入完成')).toBeVisible();
  await page.getByRole('button', { name: /完成发牌，进入天黑/ }).click();
  await expect(page.getByRole('heading', { name: '天黑请闭眼' })).toBeVisible();
}

function seatPattern(seatNo: number): RegExp {
  return new RegExp(`^${String(seatNo).padStart(2, '0')}`);
}

async function playNight(
  page: Page,
  input: { hasGuard: boolean; seerTarget: number; killTarget: number },
): Promise<void> {
  if (input.hasGuard) {
    await page.getByRole('button', { name: '空守' }).click();
    await page.getByRole('button', { name: '确认，下一位' }).click();
  }

  await page
    .getByRole('group', { name: '预言家目标选择' })
    .getByRole('button', { name: seatPattern(input.seerTarget) })
    .click();
  await expect(page.getByRole('status').filter({ hasText: '仅主持端可见' })).toBeVisible();
  await page.getByRole('button', { name: '确认，下一位' }).click();

  await page
    .getByRole('group', { name: '狼人目标选择' })
    .getByRole('button', { name: seatPattern(input.killTarget) })
    .click();
  await page.getByRole('button', { name: '确认，下一位' }).click();

  await expect(page.getByText(new RegExp(`今晚 ${input.killTarget} 号被刀`))).toBeVisible();
  await page.getByRole('button', { name: '不用药' }).click();
  await page.getByRole('button', { name: '天亮了，结算夜晚' }).click();
}

async function playDayAndExile(
  page: Page,
  input: { sheriff: boolean; target: number },
): Promise<void> {
  if (input.sheriff) {
    await expect(page.getByRole('heading', { name: '警长竞选' })).toBeVisible();
    await page.getByRole('button', { name: '无人上警 · 本局无警长' }).click();
    await page.getByRole('button', { name: '公布死讯' }).click();
  }

  await expect(page.getByRole('heading', { name: '天亮了' })).toBeVisible();
  await page.getByRole('button', { name: '进入发言' }).click();
  await expect(page.getByRole('heading', { name: '依次发言' })).toBeVisible();
  await page.getByRole('button', { name: '进入投票' }).click();
  await expect(page.getByRole('heading', { name: '放逐投票' })).toBeVisible();

  await page.getByRole('button', { name: '快速归票' }).click();
  await page.getByRole('button', { name: `${input.target} 号`, exact: true }).click();
  await page.getByRole('button', { name: new RegExp(`^归票给 ${input.target} 号`) }).click();
  await page.getByRole('button', { name: '放逐并检查胜负' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '放逐并检查胜负' }).click();
  await expect(page.getByRole('heading', { name: '放逐结果' })).toBeVisible();
  await expect(page.getByText(`${input.target} 号被放逐`)).toBeVisible();
  await page.getByRole('button', { name: '结束放逐，检查胜负' }).click();
}

test('AC-2/AC-6/AC-18：模式 A 遮罩、二次揭示与回退', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: /开始主持/ }).click();
  await page.getByRole('button', { name: /接力查看/ }).click();
  await page.getByRole('button', { name: /开始发牌/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: '开始' }).click();

  await expect(page.getByRole('heading', { name: /发牌 · 接力查看/ })).toBeVisible();
  await page.getByRole('button', { name: /呼叫 1 号查看/ }).click();

  const cover = page.getByRole('dialog', { name: '身份遮罩' });
  await expect(cover.getByRole('heading', { name: '请把手机交给 1 号' })).toBeVisible();
  await expect(cover.getByText('狼人阵营')).toHaveCount(0);
  await expect(cover.getByText('好人阵营')).toHaveCount(0);

  await cover.getByRole('button', { name: '查看我的身份' }).click();
  await expect(cover.getByText('仅本人可见')).toBeVisible();
  await expect(cover.getByText(/阵营/)).toBeVisible();

  await cover.getByRole('button', { name: '重新遮罩' }).click();
  await expect(cover.getByRole('heading', { name: '请把手机交给 1 号' })).toBeVisible();
  await expect(cover.getByText('已重新遮罩，请交给下一位。')).toBeVisible();

  await cover.getByRole('button', { name: '查看我的身份' }).click();
  await cover.getByRole('button', { name: '我已记住，交给下一位' }).click();
  await expect(page.getByRole('button', { name: /呼叫 2 号查看/ })).toBeVisible();
  await page.screenshot({ path: `${EVIDENCE}/deal-mode-a-390.png` });

  await page.getByRole('button', { name: /回退一步/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: '回退' }).click();
  await expect(page.getByRole('button', { name: /呼叫 1 号查看/ })).toBeVisible();
  await expectNoHorizontalOverflow(page, 'T-022 模式 A 390');
});

test('AC-2/AC-6：模式 B 默认遮罩，二次点击才揭示', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: /开始主持/ }).click();
  await page.getByRole('button', { name: /线下逐步确认/ }).click();
  await page.getByRole('button', { name: /开始发牌/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: '开始' }).click();

  await expect(page.getByRole('heading', { name: /发牌 · 线下逐步确认/ })).toBeVisible();
  await page.getByRole('button', { name: /为 1 号显示身份/ }).click();

  const cover = page.getByRole('dialog', { name: '身份遮罩' });
  await expect(cover.getByRole('heading', { name: '请 1 号确认身份' })).toBeVisible();
  await expect(cover.getByText('狼人阵营')).toHaveCount(0);
  await expect(cover.getByText('好人阵营')).toHaveCount(0);

  await cover.getByRole('button', { name: '显示身份' }).click();
  await expect(cover.getByText('主持人二次揭示')).toBeVisible();
  await expect(cover.getByText(/阵营/)).toBeVisible();
  await cover.getByRole('button', { name: '1 号已确认' }).click();
  await expect(page.getByRole('button', { name: /为 2 号显示身份/ })).toBeVisible();
  await page.screenshot({ path: `${EVIDENCE}/deal-mode-b-390.png` });
});

async function playWolfWinByVillagers(
  page: Page,
  board: typeof GUARD_BOARD | typeof IDIOT_BOARD,
): Promise<void> {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await startManualDeal(page, board.name);
  await assignRoles(page, board.roles);

  await playNight(page, { hasGuard: board.hasGuard, seerTarget: 9, killTarget: 5 });
  await playDayAndExile(page, { sheriff: true, target: 6 });
  await expect(page.getByRole('heading', { name: '天黑请闭眼' })).toBeVisible();
  await expect(page.getByText(/第 2 夜/)).toBeVisible();

  await playNight(page, { hasGuard: board.hasGuard, seerTarget: 10, killTarget: 7 });
  await playDayAndExile(page, { sheriff: false, target: 8 });

  await expect(page.getByRole('heading', { name: '结算' })).toBeVisible();
  await expect(page.getByText('狼人阵营胜利')).toBeVisible();
  await expect(page.getByText('平民全部出局')).toBeVisible();
  await expect(page.getByText('身份揭晓')).toBeVisible();
  await expectNoHorizontalOverflow(page, `T-022 ${board.name} 结算 390`);
  await page.screenshot({
    path: `${EVIDENCE}/wolf-win-${board.hasGuard ? 'guard' : 'idiot'}-390.png`,
  });
}

test('AC-1/AC-4：预女猎守 12 人全流程到结算', async ({ page }) => {
  await playWolfWinByVillagers(page, GUARD_BOARD);
});

test('AC-1/AC-4：预女猎白 12 人全流程到结算', async ({ page }) => {
  await playWolfWinByVillagers(page, IDIOT_BOARD);
});

test('AC-5：页面加载后断网可完成开局、发牌、首夜与白天投票', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.context().setOffline(true);

  try {
    await startManualDeal(page, GUARD_BOARD.name, { goto: false });
    await assignRoles(page, GUARD_BOARD.roles);
    await playNight(page, { hasGuard: true, seerTarget: 9, killTarget: 5 });
    await playDayAndExile(page, { sheriff: true, target: 6 });

    await expect(page.getByRole('heading', { name: '天黑请闭眼' })).toBeVisible();
    await page.screenshot({ path: `${EVIDENCE}/offline-after-first-day-390.png` });
  } finally {
    await page.context().setOffline(false);
  }
});

test('AC-11：清空助手记录保留 AI 配置', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: /我的助手/ }).click();
  await expect(page.getByRole('heading', { name: '我的身份档案' })).toBeVisible();

  await page.getByLabel('接口地址').fill('https://api.example.com/v1/chat/completions');
  await page.getByLabel('模型名').fill('gpt-test');
  await page.getByLabel('API Key').fill('sk-t022-test');
  await page.getByRole('button', { name: '保存配置' }).click();
  await expect(page.getByText('已配置')).toBeVisible();

  await page.getByRole('button', { name: '守卫' }).click();
  await page.getByRole('button', { name: '3 号 金水' }).click();
  await page.getByRole('button', { name: '清空当前记录' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '清除' }).click();

  await expect(page.getByText('尚未选择身份。选择后显示技能与身份攻略。')).toBeVisible();
  await expect(page.getByText('已配置')).toBeVisible();
  await expect(page.getByLabel('接口地址')).toHaveValue(
    'https://api.example.com/v1/chat/completions',
  );
});
