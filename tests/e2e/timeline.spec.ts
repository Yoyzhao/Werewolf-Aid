import { applyAction, createGame, getBoard, type GameState } from '@lrs/game-engine';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

import { expectNoHorizontalOverflow } from './helpers';

const EVIDENCE = '.artifacts/e2e/T-040';

const ROLE_SEQUENCE = [
  'GUARD',
  'SEER',
  'WITCH',
  'HUNTER',
  'VILLAGER',
  'VILLAGER',
  'VILLAGER',
  'VILLAGER',
  'WOLF',
  'WOLF',
  'WOLF',
  'WOLF',
] as const;

function finishedState(): GameState {
  return {
    schemaVersion: 1,
    boardId: 'pre-witch-hunter-guard',
    phase: 'RESULT',
    status: 'finished',
    round: 2,
    nightStep: 0,
    dealMode: 'C',
    options: { sheriffElection: true, witchSelfSaveFirstNight: true },
    seats: ROLE_SEQUENCE.map((role, index) => ({
      no: index + 1,
      role,
      alive: index < 8,
      idiotRevealed: false,
      deathCause: index < 8 ? null : 'VOTE',
      deathRound: index < 8 ? null : 2,
    })),
    sheriffNo: 2,
    sheriffElection: null,
    nightActions: [
      { round: 1, step: 0, roleId: 'GUARD', target: 5, potion: null },
      { round: 1, step: 1, roleId: 'SEER', target: 9, potion: null },
      { round: 1, step: 2, roleId: 'WOLF', target: 5, potion: null },
      { round: 1, step: 3, roleId: 'WITCH', target: 5, potion: 'ANTIDOTE' },
      { round: 2, step: 0, roleId: 'GUARD', target: 3, potion: null },
      { round: 2, step: 1, roleId: 'SEER', target: 10, potion: null },
      { round: 2, step: 2, roleId: 'WOLF', target: 7, potion: null },
      { round: 2, step: 3, roleId: 'WITCH', target: 10, potion: 'POISON' },
    ],
    ballots: [],
    pkCandidates: [],
    voteRound: 1,
    exiledSeat: null,
    exileResolved: false,
    explodingSeat: null,
    interruptedPhase: null,
    pendingHunterNo: null,
    pendingBadge: false,
    pendingWolfKingTake: false,
    lastNightDeaths: [],
    resumeTo: null,
    events: [
      { seq: 1, round: 1, phase: 'NIGHT', type: 'NO_DEATH', seatNos: [] },
      { seq: 2, round: 1, phase: 'SHERIFF', type: 'SHERIFF_ELECTED', seatNos: [2] },
      { seq: 3, round: 1, phase: 'VOTE', type: 'EXILE', seatNos: [9] },
      { seq: 4, round: 2, phase: 'DAWN', type: 'DEATH', seatNos: [7], cause: 'WOLF' },
      { seq: 5, round: 2, phase: 'VOTE', type: 'IDIOT_REVEALED', seatNos: [9, 10] },
      { seq: 6, round: 2, phase: 'VOTE', type: 'HUNTER_SHOOT', seatNos: [10] },
      { seq: 7, round: 2, phase: 'VOTE', type: 'BADGE_TRANSFER', seatNos: [3] },
    ],
    result: { winner: 'good', round: 2 },
  } as GameState;
}

function finishedRecord(state: GameState): Record<string, unknown> {
  return {
    schemaVersion: 1,
    status: 'finished',
    phase: 'RESULT',
    view: 'result',
    round: state.round,
    nightStep: 0,
    state,
    history: [],
    boardId: state.boardId,
    dealMode: state.dealMode,
    options: state.options,
    dealDraft: null,
    updatedAt: Date.now(),
  };
}

async function seedRecord(page: Page, record: Record<string, unknown>): Promise<void> {
  await page.goto('/');
  await page.evaluate(async (value) => {
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open('keyval-store', 1);
      open.onupgradeneeded = () => {
        open.result.createObjectStore('keyval');
      };
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction('keyval', 'readwrite');
        tx.objectStore('keyval').put(value, 'lrs.game.current.v1');
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      open.onerror = () => reject(open.error);
    });
  }, record);
  await page.reload();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('lrs.guide.v1', '1');
  });
});

test('主持端复盘时间线：完整事件、默认展开最近一夜与响应式', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedRecord(page, finishedRecord(finishedState()));

  await page.getByRole('button', { name: '查看上一局结果' }).click();
  await expect(page.getByRole('heading', { name: '结算' })).toBeVisible();

  const timeline = page.getByRole('region', { name: '复盘时间线' });
  await expect(timeline).toBeVisible();
  await expect(timeline).toContainText('守卫：守护 5 号');
  await expect(timeline).toContainText('预言家：查验 9 号（狼人）');
  await expect(timeline).toContainText('狼人：刀 5 号');
  await expect(timeline).toContainText('女巫：解药救 5 号');
  await expect(timeline).toContainText('第 1 夜 · 平安夜');
  await expect(timeline).toContainText('第 1 天 · 2 号当选警长');
  await expect(timeline).toContainText('第 1 天 · 放逐投票最高票：9 号');

  // 默认只展开最近一夜（第 2 夜）。
  await expect(page.locator('details[open]')).toHaveCount(1);
  const openSummary = page.locator('details[open] > summary');
  await expect(openSummary).toContainText('第 2 夜');

  // 展开各段用于完整截图。
  await timeline.getByText('第 1 夜', { exact: true }).click();
  await timeline.getByText('第 1 天', { exact: true }).click();
  await timeline.getByText('第 2 天', { exact: true }).click();
  await expect(timeline.getByText('守卫：守护 5 号')).toBeVisible();
  await expect(timeline.getByText('第 1 天 · 2 号当选警长')).toBeVisible();

  await page.addStyleTag({ content: '.topbar{position:static!important}' });
  await page.screenshot({ path: `${EVIDENCE}/host-timeline-390.png`, fullPage: true });
  await expectNoHorizontalOverflow(page, 'T-040 主持端时间线 390');

  await page.setViewportSize({ width: 320, height: 720 });
  await expectNoHorizontalOverflow(page, 'T-040 主持端时间线 320');
  await page.screenshot({ path: `${EVIDENCE}/host-timeline-320.png`, fullPage: true });

  await page.setViewportSize({ width: 430, height: 932 });
  await expectNoHorizontalOverflow(page, 'T-040 主持端时间线 430');
  await page.screenshot({ path: `${EVIDENCE}/host-timeline-430.png`, fullPage: true });
});

test('无事件时显示时间线空态', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = {
    ...finishedState(),
    nightActions: [],
    events: [],
  } as GameState;
  await seedRecord(page, finishedRecord(state));

  await page.getByRole('button', { name: '查看上一局结果' }).click();
  await expect(page.getByRole('heading', { name: '结算' })).toBeVisible();
  await expect(page.getByRole('region', { name: '复盘时间线' })).toContainText(
    '本局暂无可展示的事件',
  );
});

function dealtState(): GameState {
  const board = getBoard('pre-witch-hunter-guard');
  const assignments = board.roles
    .flatMap((slot) => Array.from({ length: slot.count }, () => slot.roleId))
    .map((roleId, index) => ({ seatNo: index + 1, roleId }));

  const started = applyAction(createGame('pre-witch-hunter-guard'), {
    type: 'START_DEAL',
    boardId: 'pre-witch-hunter-guard',
    dealMode: 'C',
  });
  if (!started.ok) throw new Error(started.message);

  const dealt = applyAction(started.state, { type: 'DEAL_DONE', assignments });
  if (!dealt.ok) throw new Error(dealt.message);
  return dealt.state;
}

function dawnState(): GameState {
  const state = dealtState();
  return {
    ...state,
    phase: 'DAWN',
    round: 1,
    nightStep: 4,
    nightActions: [
      { round: 1, step: 0, roleId: 'GUARD', target: 7, potion: null },
      { round: 1, step: 1, roleId: 'SEER', target: 9, potion: null },
      { round: 1, step: 2, roleId: 'WOLF', target: 5, potion: null },
      { round: 1, step: 3, roleId: 'WITCH', target: 5, potion: 'ANTIDOTE' },
    ],
    events: [{ seq: 1, round: 1, phase: 'NIGHT', type: 'NO_DEATH', seatNos: [] }],
  };
}

async function readHostBinding(page: Page): Promise<{ code: string; hostToken: string }> {
  const raw = await page.evaluate(() => window.localStorage.getItem('lrs.room.host.v1'));
  if (!raw) throw new Error('主持绑定未写入 localStorage');
  return JSON.parse(raw) as { code: string; hostToken: string };
}

async function csrfToken(context: BrowserContext): Promise<string> {
  const response = await context.request.get('/api/v1/session');
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as { csrfToken: string };
  return body.csrfToken;
}

test('玩家端时间线：公开事件 + 本人夜间动作，不泄露他人私密信息', async ({ browser }) => {
  const hostContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const playerContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await hostContext.addInitScript(() => {
    window.localStorage.setItem('lrs.guide.v1', '1');
  });
  await playerContext.addInitScript(() => {
    window.localStorage.setItem('lrs.guide.v1', '1');
  });
  const hostPage = await hostContext.newPage();
  const playerPage = await playerContext.newPage();

  try {
    await hostPage.goto('/');
    await hostPage.getByRole('button', { name: /联机主持/ }).click();
    await hostPage.getByRole('button', { name: /创建房间/ }).click();

    const codeLocator = hostPage.locator('.room-code');
    await expect(codeLocator).toBeVisible({ timeout: 10_000 });
    const code = (await codeLocator.textContent())?.trim() ?? '';

    await playerPage.goto(`/join/${code}`);
    await playerPage.getByRole('button', { name: '09' }).click();
    await playerPage.getByRole('button', { name: /申请绑定 9 号/ }).click();
    await expect(playerPage.getByText('等待主持人确认')).toBeVisible();

    await expect(hostPage.locator('[data-status="pending"]')).toHaveCount(1, {
      timeout: 10_000,
    });
    await hostPage.getByRole('button', { name: '确认' }).click();
    await expect(hostPage.locator('[data-status="bound"]')).toHaveCount(1, {
      timeout: 10_000,
    });

    const { hostToken } = await readHostBinding(hostPage);
    const token = await csrfToken(hostContext);
    const state = dawnState();
    const snapshot = await hostContext.request.put(`/api/v1/rooms/${code}/snapshot`, {
      headers: { 'x-host-token': hostToken, 'x-csrf-token': token },
      data: { version: 1, phase: state.phase, gameState: state },
    });
    expect(snapshot.ok()).toBeTruthy();

    await playerPage.getByRole('button', { name: /查看我的身份/ }).click();
    await expect(playerPage.getByText('狼人阵营')).toBeVisible();
    await expect(playerPage.getByText('与狼队友共同击杀一名玩家。')).toBeVisible();

    const timeline = playerPage.getByRole('region', { name: '复盘时间线' });
    await expect(timeline).toBeVisible({ timeout: 10_000 });
    await expect(timeline.getByText('狼队：刀 5 号')).toBeVisible();
    await expect(timeline.getByText('第 1 夜 · 平安夜')).toBeVisible();
    await expect(timeline.getByText(/预言家/)).toHaveCount(0);
    await expect(timeline.getByText(/女巫/)).toHaveCount(0);
    await expect(timeline.getByText(/守卫/)).toHaveCount(0);

    await playerPage.addStyleTag({ content: '.topbar{position:static!important}' });
    await playerPage.screenshot({ path: `${EVIDENCE}/player-timeline-390.png`, fullPage: true });
    await expectNoHorizontalOverflow(playerPage, 'T-040 玩家端时间线 390');

    await playerPage.setViewportSize({ width: 320, height: 720 });
    await expectNoHorizontalOverflow(playerPage, 'T-040 玩家端时间线 320');
    await playerPage.setViewportSize({ width: 430, height: 932 });
    await expectNoHorizontalOverflow(playerPage, 'T-040 玩家端时间线 430');
  } finally {
    await hostContext.close();
    await playerContext.close();
  }
});
