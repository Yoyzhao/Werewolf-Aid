import { expect, test, type BrowserContext, type Page } from '@playwright/test';

import { expectNoHorizontalOverflow } from './helpers';

const EVIDENCE = '.artifacts/e2e/T-044';

const ROLES = [
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
] as const;

function seatPattern(seatNo: number): RegExp {
  return new RegExp(`^${String(seatNo).padStart(2, '0')}`);
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

async function roomSummary(
  context: BrowserContext,
  code: string,
  hostToken: string,
): Promise<{ version: number; phase: string }> {
  const token = await csrfToken(context);
  const response = await context.request.get(`/api/v1/rooms/${code}`, {
    headers: { 'x-host-token': hostToken, 'x-csrf-token': token },
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as { version: number; phase: string };
}

async function playerVersion(page: Page): Promise<number> {
  const hint = page.getByText(/^v\d+$/).first();
  if ((await hint.count()) === 0) return 0;
  const text = (await hint.textContent()) ?? 'v0';
  return Number(text.slice(1));
}

async function waitForPlayerVersionAbove(page: Page, previous: number): Promise<void> {
  await expect
    .poll(() => playerVersion(page), { timeout: 20_000, intervals: [500, 1000] })
    .toBeGreaterThan(previous);
}

async function assignRoles(page: Page): Promise<void> {
  for (const role of ROLES) {
    await page
      .getByRole('button', { name: new RegExp(`^${role} · 余 \\d+$`) })
      .first()
      .click();
  }
  await expect(page.getByText('12 位身份已录入完成')).toBeVisible();
  await page.getByRole('button', { name: /完成发牌，进入天黑/ }).click();
  await expect(page.getByRole('heading', { name: '天黑请闭眼' })).toBeVisible();
}

async function finishNight(page: Page, seerTarget: number, killTarget: number): Promise<void> {
  await page
    .getByRole('group', { name: '预言家目标选择' })
    .getByRole('button', { name: seatPattern(seerTarget) })
    .click();
  await expect(page.getByText(new RegExp(`${seerTarget} 号是狼人（仅主持端可见）`))).toBeVisible();
  await page.getByRole('button', { name: '确认，下一位' }).click();

  await page
    .getByRole('group', { name: '狼人目标选择' })
    .getByRole('button', { name: seatPattern(killTarget) })
    .click();
  await page.getByRole('button', { name: '确认，下一位' }).click();

  await expect(page.getByText(new RegExp(`今晚 ${killTarget} 号被刀`))).toBeVisible();
  await page.getByRole('button', { name: '不用药' }).click();
  await page.getByRole('button', { name: '天亮了，结算夜晚' }).click();
}

async function playNight(
  page: Page,
  input: { hasGuard: boolean; seerTarget: number; killTarget: number },
): Promise<void> {
  if (input.hasGuard) {
    await page.getByRole('button', { name: '空守' }).click();
    await page.getByRole('button', { name: '确认，下一位' }).click();
  }
  await finishNight(page, input.seerTarget, input.killTarget);
}

async function playDay(page: Page, input: { sheriff: boolean; target: number }): Promise<void> {
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

test('联机主链路：创建→加入→确认→发牌→阶段快照→重连/恢复→结算', async ({ browser }) => {
  test.setTimeout(180_000);
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
  const versions: number[] = [];

  try {
    await hostPage.goto('/');
    await expect(hostPage.getByRole('heading', { name: '狼人杀助手' })).toBeVisible();
    await hostPage.getByRole('button', { name: /联机主持/ }).click();
    await hostPage.getByRole('button', { name: /创建房间/ }).click();
    const codeLocator = hostPage.locator('.room-code');
    await expect(codeLocator).toBeVisible({ timeout: 10_000 });
    const code = (await codeLocator.textContent())?.trim() ?? '';
    expect(code).toMatch(/^\d{6}$/);

    await playerPage.goto(`/join/${code}`);
    await expect(playerPage.getByRole('heading', { name: `加入房间 ${code}` })).toBeVisible();
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
    await expect(playerPage.getByText('已加入房间，等待主持人开局与发牌…')).toBeVisible({
      timeout: 10_000,
    });
    await hostPage.screenshot({ path: `${EVIDENCE}/host-room-bound-390.png` });
    await hostPage.setViewportSize({ width: 320, height: 720 });
    await expectNoHorizontalOverflow(hostPage, 'T-044 主持房间 320');
    await hostPage.setViewportSize({ width: 390, height: 844 });

    await hostPage.getByRole('button', { name: '进入开局设置' }).click();
    await expect(hostPage.getByRole('heading', { name: '开局设置' })).toBeVisible();
    await expect(hostPage.locator('[data-board="pre-witch-hunter-guard"]')).toBeDisabled();
    await expect(hostPage.getByText(/联机房间已锁定板子/)).toBeVisible();

    await hostPage.getByRole('button', { name: /实体牌录入/ }).click();
    await hostPage.getByRole('button', { name: /开始发牌/ }).click();
    await hostPage.getByRole('dialog').getByRole('button', { name: '开始' }).click();
    await expect(hostPage.getByRole('heading', { name: /发牌 · 实体牌录入/ })).toBeVisible();
    await assignRoles(hostPage);

    await expect(playerPage.getByRole('button', { name: /查看我的身份/ })).toBeVisible({
      timeout: 15_000,
    });
    const afterDealVersion = await playerVersion(playerPage);
    versions.push(afterDealVersion);
    expect(afterDealVersion).toBeGreaterThanOrEqual(1);

    await playerPage.getByRole('button', { name: /查看我的身份/ }).click();
    await expect(playerPage.getByText('狼人阵营')).toBeVisible();
    await expect(playerPage.getByText('狼队友', { exact: true })).toBeVisible();
    await expect(playerPage.getByText('10 号', { exact: true })).toBeVisible();
    const playerTimeline = playerPage.getByRole('region', { name: '复盘时间线' });
    await expect(playerTimeline).toBeVisible();
    await expect(playerTimeline.getByText(/预言家/)).toHaveCount(0);
    await expect(playerTimeline.getByText(/女巫/)).toHaveCount(0);
    await playerPage.screenshot({ path: `${EVIDENCE}/player-dealt-390.png` });

    const binding = await readHostBinding(hostPage);
    const summaryAfterDeal = await roomSummary(hostContext, code, binding.hostToken);
    expect(summaryAfterDeal.phase).toBe('NIGHT');
    expect(summaryAfterDeal.version).toBeGreaterThanOrEqual(afterDealVersion);

    // 主持端 API 失败时继续推进；恢复后补写快照并推送给玩家。
    let blockedSnapshots = 0;
    await hostContext.route('**/api/v1/rooms/**', (route) => {
      if (route.request().url().includes('/snapshot')) blockedSnapshots += 1;
      return route.abort();
    });
    await hostPage.getByRole('button', { name: '空守' }).click();
    await hostPage.getByRole('button', { name: '确认，下一位' }).click();
    await expect(hostPage.getByRole('group', { name: '预言家目标选择' })).toBeVisible();
    await hostPage.waitForTimeout(900);
    expect(blockedSnapshots).toBeGreaterThan(0);
    await hostContext.unroute('**/api/v1/rooms/**');

    await expect
      .poll(async () => (await roomSummary(hostContext, code, binding.hostToken)).version, {
        timeout: 20_000,
        intervals: [500, 1000],
      })
      .toBeGreaterThan(summaryAfterDeal.version);
    await waitForPlayerVersionAbove(playerPage, afterDealVersion);

    await finishNight(hostPage, 9, 5);
    await expect
      .poll(() => playerVersion(playerPage), { timeout: 15_000 })
      .toBeGreaterThan(afterDealVersion);
    await expect(playerTimeline.getByText(/狼队：刀 5 号/)).toBeVisible();
    await expect(playerTimeline.getByText(/5 号\s*出局/).first()).toBeVisible();
    versions.push(await playerVersion(playerPage));

    await playDay(hostPage, { sheriff: true, target: 6 });
    await expect(playerPage.getByText(/6 号\s*被放逐/).first()).toBeVisible({
      timeout: 15_000,
    });
    versions.push(await playerVersion(playerPage));

    // 玩家刷新后按本机绑定恢复，版本不回退。
    const beforePlayerReload = await playerVersion(playerPage);
    await playerPage.reload();
    await expect(playerPage.getByText('身份已隐藏')).toBeVisible({ timeout: 15_000 });
    expect(await playerVersion(playerPage)).toBeGreaterThanOrEqual(beforePlayerReload);
    await playerPage.screenshot({ path: `${EVIDENCE}/player-reconnect-390.png` });

    // 主持端刷新后恢复对局与房间，可从顶栏直接回到房间。
    const beforeHostReload = (await roomSummary(hostContext, code, binding.hostToken)).version;
    await hostPage.reload();
    await expect(hostPage.getByText(/继续上一局/)).toBeVisible({ timeout: 15_000 });
    await hostPage.getByRole('button', { name: '继续' }).click();
    await expect(hostPage.getByRole('heading', { name: '天黑请闭眼' })).toBeVisible();
    await expect(hostPage.getByText(/第 2 夜/)).toBeVisible();

    await hostPage.getByRole('button', { name: `打开联机房间 ${code}` }).click();
    await expect(hostPage.getByRole('heading', { name: '房间与座位' })).toBeVisible();
    await expect(hostPage.getByText(code).first()).toBeVisible();
    await expect
      .poll(async () => (await roomSummary(hostContext, code, binding.hostToken)).version, {
        timeout: 15_000,
      })
      .toBeGreaterThanOrEqual(beforeHostReload);
    await hostPage.screenshot({ path: `${EVIDENCE}/host-recovered-390.png` });
    await hostPage.getByRole('button', { name: '回到当前对局' }).click();
    await expect(hostPage.getByRole('heading', { name: '天黑请闭眼' })).toBeVisible();

    await playNight(hostPage, { hasGuard: true, seerTarget: 10, killTarget: 7 });
    await playDay(hostPage, { sheriff: false, target: 8 });

    await expect(hostPage.getByRole('heading', { name: '结算' })).toBeVisible();
    await expect(hostPage.getByText('狼人阵营胜利')).toBeVisible();
    await expect(hostPage.getByRole('region', { name: '联机房间' })).toBeVisible();
    await expect(hostPage.getByRole('button', { name: '去结算房间' })).toBeVisible();
    await hostPage.screenshot({ path: `${EVIDENCE}/host-result-room-390.png` });
    await hostPage.getByRole('region', { name: '联机房间' }).scrollIntoViewIfNeeded();
    await hostPage.screenshot({ path: `${EVIDENCE}/host-result-room-card-390.png` });
    await hostPage.setViewportSize({ width: 320, height: 720 });
    await expectNoHorizontalOverflow(hostPage, 'T-044 结算房间 320');
    await hostPage.setViewportSize({ width: 390, height: 844 });

    await expect(playerPage.getByText('狼人阵营胜利')).toBeVisible({ timeout: 15_000 });
    versions.push(await playerVersion(playerPage));

    await hostPage.getByRole('button', { name: '去结算房间' }).click();
    await expect(hostPage.getByRole('heading', { name: '房间与座位' })).toBeVisible();
    await hostPage.getByRole('button', { name: '结算房间（狼人胜）' }).click();
    await hostPage.getByRole('dialog').getByRole('button', { name: '确认结算' }).click();
    await expect(hostPage.getByRole('heading', { name: '狼人杀助手' })).toBeVisible();

    await expect(playerPage.getByRole('heading', { name: '房间已结束' })).toBeVisible({
      timeout: 15_000,
    });
    await playerPage.screenshot({ path: `${EVIDENCE}/player-closed-390.png` });

    const token = await csrfToken(hostContext);
    const deleted = await hostContext.request.get(`/api/v1/rooms/${code}`, {
      headers: { 'x-host-token': binding.hostToken, 'x-csrf-token': token },
    });
    expect(deleted.status()).toBe(404);

    for (let index = 1; index < versions.length; index += 1) {
      expect(versions[index]).toBeGreaterThanOrEqual(versions[index - 1] ?? 0);
    }
    expect(versions.at(-1) ?? 0).toBeGreaterThan(versions[0] ?? 0);
  } finally {
    await hostContext.close();
    await playerContext.close();
  }
});
