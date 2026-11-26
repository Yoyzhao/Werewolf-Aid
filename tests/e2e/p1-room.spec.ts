import { applyAction, createGame, getBoard, type GameState } from '@lrs/game-engine';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

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

function overflowOf(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

test('主持创建房间 → 玩家申请 → 主持确认 → 快照推送 → 结算关闭', async ({ browser }) => {
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
    await expect(hostPage.getByRole('heading', { name: '狼人杀助手' })).toBeVisible();
    await hostPage.getByRole('button', { name: /联机主持/ }).click();
    await expect(hostPage.getByRole('heading', { name: '房间与座位' })).toBeVisible();
    await hostPage.getByRole('button', { name: /创建房间/ }).click();

    const codeLocator = hostPage.locator('.room-code');
    await expect(codeLocator).toBeVisible({ timeout: 10_000 });
    const code = (await codeLocator.textContent())?.trim() ?? '';
    expect(code).toMatch(/^\d{6}$/);
    await expect(hostPage.getByAltText(`加入房间 ${code} 的二维码`)).toBeVisible();

    await playerPage.goto(`/join/${code}`);
    await expect(playerPage.getByRole('heading', { name: `加入房间 ${code}` })).toBeVisible();
    await playerPage.getByRole('button', { name: '05' }).click();
    await playerPage.getByRole('button', { name: /申请绑定 5 号/ }).click();
    await expect(playerPage.getByText('等待主持人确认')).toBeVisible();

    await expect(hostPage.locator('[data-status="pending"]')).toHaveCount(1, {
      timeout: 10_000,
    });
    await hostPage.getByRole('button', { name: '确认' }).click();
    await expect(hostPage.locator('[data-status="bound"]')).toHaveCount(1, {
      timeout: 10_000,
    });

    await expect(playerPage.getByText('已加入房间，等待主持人开局与发牌…')).toBeVisible({
      timeout: 10_000,
    });

    await hostPage.setViewportSize({ width: 320, height: 720 });
    expect(await overflowOf(hostPage)).toBe(0);
    await hostPage.setViewportSize({ width: 430, height: 900 });
    expect(await overflowOf(hostPage)).toBe(0);

    const { hostToken } = await readHostBinding(hostPage);
    const token = await csrfToken(hostContext);
    const state = dealtState();
    const snapshot = await hostContext.request.put(`/api/v1/rooms/${code}/snapshot`, {
      headers: { 'x-host-token': hostToken, 'x-csrf-token': token },
      data: { version: 1, phase: state.phase, gameState: state },
    });
    expect(snapshot.ok()).toBeTruthy();

    await expect(playerPage.getByText('身份已隐藏')).toBeVisible({ timeout: 10_000 });
    await playerPage.getByRole('button', { name: /查看我的身份/ }).click();
    await expect(playerPage.getByText('平民')).toBeVisible();
    await expect(playerPage.getByText('公开进度')).toBeVisible();
    await expect(playerPage.getByText('狼队友')).toHaveCount(0);

    await playerPage.setViewportSize({ width: 320, height: 720 });
    expect(await overflowOf(playerPage)).toBe(0);
    await playerPage.setViewportSize({ width: 430, height: 900 });
    expect(await overflowOf(playerPage)).toBe(0);

    const settle = await hostContext.request.post(`/api/v1/rooms/${code}/settle`, {
      headers: { 'x-host-token': hostToken, 'x-csrf-token': token },
      data: { winner: 'GOOD' },
    });
    expect(settle.ok()).toBeTruthy();
    await expect(playerPage.getByRole('heading', { name: '房间已结束' })).toBeVisible({
      timeout: 10_000,
    });
  } finally {
    await hostContext.close();
    await playerContext.close();
  }
});

test('无效配对码提示', async ({ page }) => {
  await page.goto('/join/12ab');
  await expect(page.getByRole('heading', { name: '配对码无效' })).toBeVisible();

  await page.goto('/join/000001');
  await expect(page.getByRole('heading', { name: '无法加入' })).toBeVisible({ timeout: 10_000 });
});
