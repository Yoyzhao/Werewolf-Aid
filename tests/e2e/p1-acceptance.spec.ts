import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { applyAction, createGame, getBoard, type BoardId, type GameState } from '@lrs/game-engine';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import Database from 'better-sqlite3';

import { expectNoHorizontalOverflow } from './helpers';

const EVIDENCE = '.artifacts/e2e/T-045';
const CSRF_HEADER = 'x-csrf-token';
const HOST_TOKEN_HEADER = 'x-host-token';

interface ApiSession {
  readonly csrf: string;
}

interface CreatedRoom {
  readonly roomId: string;
  readonly code: string;
  readonly hostToken: string;
  readonly boardId: BoardId;
}

interface JoinResult {
  readonly status: 'pending' | 'bound';
  readonly applicantId: string;
}

interface RoomSummaryBody {
  readonly roomId: string;
  readonly code: string;
  readonly version: number;
  readonly phase: string;
  readonly seats: readonly {
    readonly seatNo: number;
    readonly status: 'pending' | 'bound';
    readonly applicantId: string;
  }[];
}

interface ViewEnvelope {
  readonly version: number;
  readonly phase: string;
  readonly view: {
    readonly mySeat: number;
    readonly role: string;
    readonly teammates?: readonly number[];
    readonly checks?: readonly unknown[];
    readonly potions?: unknown;
    readonly guarded?: readonly unknown[];
    readonly privateActions?: readonly unknown[];
  } | null;
}

function dealtState(boardId: BoardId = 'pre-witch-hunter-guard'): GameState {
  const board = getBoard(boardId);
  const assignments = board.roles
    .flatMap((slot) => Array.from({ length: slot.count }, () => slot.roleId))
    .map((roleId, index) => ({ seatNo: index + 1, roleId }));

  const started = applyAction(createGame(boardId), {
    type: 'START_DEAL',
    boardId,
    dealMode: 'C',
  });
  if (!started.ok) throw new Error(started.message);

  const dealt = applyAction(started.state, { type: 'DEAL_DONE', assignments });
  if (!dealt.ok) throw new Error(dealt.message);
  return dealt.state;
}

async function startSession(context: BrowserContext): Promise<ApiSession> {
  const response = await context.request.get('/api/v1/session');
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as { csrfToken: string };
  return { csrf: body.csrfToken };
}

async function createRoom(
  context: BrowserContext,
  session: ApiSession,
  boardId: BoardId = 'pre-witch-hunter-guard',
): Promise<CreatedRoom> {
  const response = await context.request.post('/api/v1/rooms', {
    headers: { [CSRF_HEADER]: session.csrf },
    data: { boardId },
  });
  expect(response.status()).toBe(201);
  const body = (await response.json()) as CreatedRoom;
  expect(body.code).toMatch(/^\d{6}$/);
  return body;
}

async function joinSeat(
  context: BrowserContext,
  session: ApiSession,
  room: CreatedRoom,
  seatNo: number,
): Promise<JoinResult> {
  const response = await context.request.post(`/api/v1/rooms/${room.code}/join`, {
    headers: { [CSRF_HEADER]: session.csrf },
    data: { seatNo },
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as JoinResult;
}

async function confirmSeat(
  context: BrowserContext,
  session: ApiSession,
  room: CreatedRoom,
  seatNo: number,
  applicantId: string,
): Promise<void> {
  const response = await context.request.post(`/api/v1/rooms/${room.code}/confirm`, {
    headers: {
      [CSRF_HEADER]: session.csrf,
      [HOST_TOKEN_HEADER]: room.hostToken,
    },
    data: { seatNo, applicantId },
  });
  expect(response.ok()).toBeTruthy();
}

async function putSnapshot(
  context: BrowserContext,
  session: ApiSession,
  room: CreatedRoom,
  version: number,
  state: GameState,
): Promise<{ status: number; body: unknown }> {
  const response = await context.request.put(`/api/v1/rooms/${room.code}/snapshot`, {
    headers: {
      [CSRF_HEADER]: session.csrf,
      [HOST_TOKEN_HEADER]: room.hostToken,
    },
    data: { version, phase: state.phase, gameState: state },
  });
  const text = await response.text();
  return { status: response.status(), body: text ? JSON.parse(text) : null };
}

async function summary(context: BrowserContext, room: CreatedRoom): Promise<RoomSummaryBody> {
  const response = await context.request.get(`/api/v1/rooms/${room.code}`, {
    headers: { [HOST_TOKEN_HEADER]: room.hostToken },
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as RoomSummaryBody;
}

async function view(
  context: BrowserContext,
  code: string,
  query = '',
): Promise<{ status: number; body: unknown }> {
  const response = await context.request.get(`/api/v1/rooms/${code}/view${query}`);
  const text = await response.text();
  return { status: response.status(), body: text ? JSON.parse(text) : null };
}

function playerVersion(page: Page): Promise<number> {
  return page
    .getByText(/^v\d+$/)
    .first()
    .textContent()
    .then((text) => Number((text ?? 'v0').slice(1)));
}

async function seedPlayerBinding(
  context: BrowserContext,
  code: string,
  seatNo: number,
): Promise<void> {
  await context.addInitScript(
    ({ roomCode, seat }) => {
      window.localStorage.setItem('lrs.guide.v1', '1');
      window.localStorage.setItem(
        'lrs.room.player.v1',
        JSON.stringify({ code: roomCode, seatNo: seat, savedAt: Date.now() }),
      );
      if (window.localStorage.getItem('lrs.test.transport') === 'allowed') return;

      // 故障注入：让 Socket.IO 的 WS 与 HTTP 轮询传输都立即失败，触发应用层 5s 轮询降级。
      window.localStorage.setItem('lrs.test.transport', 'blocked');
      class BlockedWebSocket {
        binaryType = 'arraybuffer';
        readyState = 3;
        onopen: (() => void) | null = null;
        onmessage: ((event: unknown) => void) | null = null;
        onerror: ((event: unknown) => void) | null = null;
        onclose: ((event: unknown) => void) | null = null;

        constructor() {
          setTimeout(() => {
            this.onerror?.({ type: 'error' });
            this.onclose?.({ type: 'close', code: 1006, wasClean: false });
          }, 0);
        }

        send(): void {}
        close(): void {}
        addEventListener(): void {}
        removeEventListener(): void {}
      }
      Object.defineProperty(window, 'WebSocket', {
        configurable: true,
        writable: true,
        value: BlockedWebSocket,
      });

      const originalOpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function (
        this: XMLHttpRequest,
        method: string,
        url: string | URL,
        async?: boolean,
        username?: string | null,
        password?: string | null,
      ): void {
        if (String(url).includes('/ws/rooms')) throw new Error('T-045 transport blocked');
        originalOpen.call(this, method, url, async ?? true, username, password);
      };

      const originalFetch = window.fetch.bind(window);
      window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
        const url =
          typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (url.includes('/ws/rooms')) {
          return Promise.reject(new Error('T-045 transport blocked'));
        }
        return originalFetch(input, init);
      }) as typeof fetch;
    },
    { roomCode: code, seat: seatNo },
  );
}

async function saveRaw(name: string, data: unknown): Promise<void> {
  await mkdir(`${EVIDENCE}/raw`, { recursive: true });
  await writeFile(`${EVIDENCE}/raw/${name}`, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function dbCandidates(): readonly string[] {
  return [resolve('apps/api/data/lrs.sqlite'), resolve('data/lrs.sqlite')];
}

/** 通过 roomId 定位真实数据库文件，避免依赖固定的启动目录。 */
function locateRoomDb(roomId: string): string {
  for (const file of dbCandidates()) {
    if (!existsSync(file)) continue;
    const sqlite = new Database(file);
    try {
      const row = sqlite.prepare('SELECT id FROM rooms WHERE id = ?').get(roomId) as
        { id: string } | undefined;
      if (row) return file;
    } finally {
      sqlite.close();
    }
  }
  throw new Error(`未找到包含房间 ${roomId} 的 SQLite 数据库；候选：${dbCandidates().join(', ')}`);
}

function countRoomRows(file: string, roomId: string): Record<string, number> {
  const sqlite = new Database(file);
  try {
    const tables = [
      ['rooms', 'id'],
      ['room_seats', 'room_id'],
      ['game_states', 'room_id'],
      ['snapshots', 'room_id'],
    ] as const;
    return Object.fromEntries(
      tables.map(([table, column]) => {
        const row = sqlite
          .prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${column} = ?`)
          .get(roomId) as { n: number };
        return [table, row.n];
      }),
    );
  } finally {
    sqlite.close();
  }
}

test('AC-12：输码加入并确认后 2 秒内看到公开快照', async ({ browser }) => {
  test.setTimeout(60_000);
  const hostContext = await browser.newContext();
  const playerContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const host = await startSession(hostContext);
  const room = await createRoom(hostContext, host);
  const state = dealtState(room.boardId);
  expect((await putSnapshot(hostContext, host, room, 1, state)).status).toBe(200);

  const playerPage = await playerContext.newPage();
  await playerContext.addInitScript(() => {
    window.localStorage.setItem('lrs.guide.v1', '1');
  });

  try {
    await playerPage.goto(`/join/${room.code}`);
    await expect(playerPage.getByRole('heading', { name: `加入房间 ${room.code}` })).toBeVisible();
    await playerPage.getByRole('button', { name: '09' }).click();

    const applyStartedAt = Date.now();
    await playerPage.getByRole('button', { name: /申请绑定 9 号/ }).click();
    await expect(playerPage.getByText('等待主持人确认')).toBeVisible();

    const pending = await summary(hostContext, room);
    const seat = pending.seats.find((item) => item.seatNo === 9);
    expect(seat?.status).toBe('pending');
    expect(seat?.applicantId).toBeTruthy();

    const confirmStartedAt = Date.now();
    await confirmSeat(hostContext, host, room, 9, seat?.applicantId ?? '');

    await expect(playerPage.getByRole('heading', { name: '公开进度' })).toBeVisible({
      timeout: 2000,
    });
    const confirmToViewMs = Date.now() - confirmStartedAt;
    const applyToViewMs = Date.now() - applyStartedAt;
    expect(confirmToViewMs).toBeLessThanOrEqual(2000);

    await expect(playerPage.getByText(/^v\d+$/).first()).toBeVisible();
    const version = await playerVersion(playerPage);
    expect(version).toBeGreaterThanOrEqual(1);

    await playerPage.getByRole('button', { name: /查看我的身份/ }).click();
    await expect(playerPage.getByText('狼人阵营')).toBeVisible();
    await expect(playerPage.getByText('身份已隐藏')).toHaveCount(0);
    await playerPage.screenshot({ path: `${EVIDENCE}/ac12-join-2s-390.png` });

    await playerPage.setViewportSize({ width: 320, height: 720 });
    await expectNoHorizontalOverflow(playerPage, 'T-045 AC-12 玩家视图 320');
    await playerPage.setViewportSize({ width: 390, height: 844 });

    await saveRaw('ac12-timings.json', {
      roomCode: room.code,
      confirmToViewMs,
      applyToViewMs,
      version,
      thresholdMs: 2000,
      pass: confirmToViewMs <= 2000,
    });
  } finally {
    await hostContext.close();
    await playerContext.close();
  }
});

test('AC-12：WS 不可用时 5 秒轮询降级，恢复后重连补齐版本', async ({ browser }) => {
  test.setTimeout(90_000);
  const hostContext = await browser.newContext();
  const playerContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const host = await startSession(hostContext);
  const room = await createRoom(hostContext, host);
  const state = dealtState(room.boardId);
  expect((await putSnapshot(hostContext, host, room, 1, state)).status).toBe(200);

  const player = await startSession(playerContext);
  const pending = await joinSeat(playerContext, player, room, 5);
  await confirmSeat(hostContext, host, room, 5, pending.applicantId);
  await seedPlayerBinding(playerContext, room.code, 5);

  const playerPage = await playerContext.newPage();
  try {
    await playerPage.goto(`/join/${room.code}`);
    await expect(playerPage.getByText('身份已隐藏')).toBeVisible({ timeout: 15_000 });
    await expect(playerPage.getByText(/已切换 5 秒刷新/).first()).toBeVisible({
      timeout: 25_000,
    });

    const beforePolling = await playerVersion(playerPage);
    await playerPage.screenshot({ path: `${EVIDENCE}/ac12-polling-390.png` });

    const writeStartedAt = Date.now();
    expect((await putSnapshot(hostContext, host, room, 2, state)).status).toBe(200);
    // 轮询周期 5s；并行全量回归时留 2s 负载容差。
    await expect
      .poll(() => playerVersion(playerPage), { timeout: 7_000, intervals: [500, 1000] })
      .toBeGreaterThan(beforePolling);
    const pollingToViewMs = Date.now() - writeStartedAt;
    expect(pollingToViewMs).toBeLessThanOrEqual(7_000);
    await playerPage.screenshot({ path: `${EVIDENCE}/ac12-polling-updated-390.png` });

    const pollingVersion = await playerVersion(playerPage);
    await playerPage.evaluate(() => window.localStorage.setItem('lrs.test.transport', 'allowed'));
    await playerPage.reload();
    await expect(playerPage.getByText('实时同步').first()).toBeVisible({ timeout: 15_000 });
    await expect(playerPage.getByText('身份已隐藏')).toBeVisible({ timeout: 15_000 });
    const recoveredVersion = await playerVersion(playerPage);
    expect(recoveredVersion).toBeGreaterThanOrEqual(pollingVersion);
    await playerPage.screenshot({ path: `${EVIDENCE}/ac12-reconnected-390.png` });

    await saveRaw('ac12-polling.json', {
      roomCode: room.code,
      versionBeforePolling: beforePolling,
      versionAfterPollingUpdate: pollingVersion,
      pollingToViewMs,
      pollingIntervalMs: 5_000,
      pollingThresholdMs: 7_000,
      versionAfterReconnect: recoveredVersion,
      connectionAfterReconnect: '实时同步',
    });
  } finally {
    await hostContext.close();
    await playerContext.close();
  }
});

test('AC-13：服务端只下发本人视图，越权读取/写入被拒绝', async ({ browser }) => {
  const hostContext = await browser.newContext();
  const playerContext = await browser.newContext();
  const wolfContext = await browser.newContext();
  const outsiderContext = await browser.newContext();
  const host = await startSession(hostContext);
  const room = await createRoom(hostContext, host);
  const state = dealtState(room.boardId);
  expect((await putSnapshot(hostContext, host, room, 1, state)).status).toBe(200);

  const player = await startSession(playerContext);
  const playerJoin = await joinSeat(playerContext, player, room, 5);
  await confirmSeat(hostContext, host, room, 5, playerJoin.applicantId);

  const wolf = await startSession(wolfContext);
  const wolfJoin = await joinSeat(wolfContext, wolf, room, 9);
  await confirmSeat(hostContext, host, room, 9, wolfJoin.applicantId);

  const outsider = await startSession(outsiderContext);

  try {
    const playerView = await view(playerContext, room.code, '?seatNo=9');
    expect(playerView.status).toBe(200);
    const envelope = playerView.body as ViewEnvelope;
    expect(envelope.version).toBe(1);
    expect(envelope.view?.mySeat).toBe(5);
    expect(envelope.view?.role).toBe('VILLAGER');
    expect(envelope.view?.teammates).toBeUndefined();
    expect(envelope.view?.checks).toBeUndefined();
    expect(envelope.view?.potions).toBeUndefined();
    expect(envelope.view?.guarded).toBeUndefined();

    const serialized = JSON.stringify(playerView.body);
    expect(serialized).not.toContain('gameState');
    expect(serialized).not.toContain('stateJson');
    expect(serialized).not.toContain('roleId');
    expect(serialized).not.toContain(room.hostToken);
    expect(serialized).not.toContain('hostToken');

    const wolfView = await view(wolfContext, room.code);
    expect(wolfView.status).toBe(200);
    const wolfEnvelope = wolfView.body as ViewEnvelope;
    expect(wolfEnvelope.view?.mySeat).toBe(9);
    expect(wolfEnvelope.view?.role).toBe('WOLF');
    expect(wolfEnvelope.view?.teammates).toEqual([10, 11, 12]);

    const unboundView = await view(outsiderContext, room.code);
    expect(unboundView.status).toBe(403);
    expect((unboundView.body as { error: { code: string } }).error.code).toBe('FORBIDDEN');

    const summaryWithoutToken = await playerContext.request.get(`/api/v1/rooms/${room.code}`);
    expect(summaryWithoutToken.status()).toBe(403);

    const snapshotWithoutToken = await playerContext.request.put(
      `/api/v1/rooms/${room.code}/snapshot`,
      {
        headers: { [CSRF_HEADER]: player.csrf },
        data: { version: 2, phase: state.phase, gameState: state },
      },
    );
    expect(snapshotWithoutToken.status()).toBe(403);
    expect(((await snapshotWithoutToken.json()) as { error: { code: string } }).error.code).toBe(
      'FORBIDDEN',
    );

    const snapshotWithWrongToken = await playerContext.request.put(
      `/api/v1/rooms/${room.code}/snapshot`,
      {
        headers: { [CSRF_HEADER]: player.csrf, [HOST_TOKEN_HEADER]: 'invalid-token' },
        data: { version: 2, phase: state.phase, gameState: state },
      },
    );
    expect(snapshotWithWrongToken.status()).toBe(403);

    const settleWithoutToken = await playerContext.request.post(
      `/api/v1/rooms/${room.code}/settle`,
      {
        headers: { [CSRF_HEADER]: player.csrf },
        data: { winner: 'WOLVES', reason: '越权尝试' },
      },
    );
    expect(settleWithoutToken.status()).toBe(403);

    const publicInfo = await outsiderContext.request.get(`/api/v1/rooms/${room.code}/public`);
    expect(publicInfo.status()).toBe(200);
    const publicBody = (await publicInfo.json()) as Record<string, unknown>;
    expect(Object.keys(publicBody).sort()).toEqual([
      'boardId',
      'code',
      'expiresAt',
      'joinExpiresAt',
      'phase',
      'status',
    ]);
    expect(JSON.stringify(publicBody)).not.toContain('seat');
    expect(JSON.stringify(publicBody)).not.toContain('session');

    const hijack = await outsiderContext.request.post(`/api/v1/rooms/${room.code}/join`, {
      headers: { [CSRF_HEADER]: outsider.csrf },
      data: { seatNo: 5 },
    });
    expect(hijack.status()).toBe(409);

    const moveBound = await wolfContext.request.post(`/api/v1/rooms/${room.code}/join`, {
      headers: { [CSRF_HEADER]: wolf.csrf },
      data: { seatNo: 5 },
    });
    expect(moveBound.status()).toBe(409);
    const wolfViewAfterMove = await view(wolfContext, room.code);
    expect((wolfViewAfterMove.body as ViewEnvelope).view?.mySeat).toBe(9);

    await saveRaw('ac13-player-view.json', {
      roomCode: room.code,
      seat: 5,
      status: playerView.status,
      body: playerView.body,
      wolfSeat9View: wolfView.body,
      checks: {
        mySeat: envelope.view?.mySeat,
        role: envelope.view?.role,
        noTeammates: envelope.view?.teammates === undefined,
        noPrivateCards:
          envelope.view?.checks === undefined &&
          envelope.view?.potions === undefined &&
          envelope.view?.guarded === undefined,
        noGameState: !serialized.includes('gameState') && !serialized.includes('stateJson'),
      },
    });
    await saveRaw('ac13-unauthorized.json', {
      roomCode: room.code,
      unboundView: unboundView.status,
      summaryWithoutToken: summaryWithoutToken.status(),
      snapshotWithoutToken: snapshotWithoutToken.status(),
      snapshotWithWrongToken: snapshotWithWrongToken.status(),
      settleWithoutToken: settleWithoutToken.status(),
      publicInfoKeys: Object.keys(publicBody).sort(),
      seatHijack: hijack.status(),
      moveBoundSeat: moveBound.status(),
      mySeatAfterMove: (wolfViewAfterMove.body as ViewEnvelope).view?.mySeat,
    });
  } finally {
    await hostContext.close();
    await playerContext.close();
    await wolfContext.close();
    await outsiderContext.close();
  }
});

test('AC-19：旧版本写入 409 拒绝，玩家只读取递增版本并可在重连后补齐', async ({ browser }) => {
  const hostContext = await browser.newContext();
  const playerContext = await browser.newContext();
  const host = await startSession(hostContext);
  const room = await createRoom(hostContext, host);
  const state = dealtState(room.boardId);
  const player = await startSession(playerContext);
  const pending = await joinSeat(playerContext, player, room, 5);
  await confirmSeat(hostContext, host, room, 5, pending.applicantId);

  try {
    const accepted: number[] = [];
    const rejected: { version: number; status: number; code?: string; currentVersion?: number }[] =
      [];

    const v1 = await putSnapshot(hostContext, host, room, 1, state);
    expect(v1.status).toBe(200);
    accepted.push((v1.body as { version: number }).version);

    const staleV1 = await putSnapshot(hostContext, host, room, 1, state);
    expect(staleV1.status).toBe(409);
    const staleBody = staleV1.body as {
      error: { code: string; details?: { currentVersion: number } };
    };
    expect(staleBody.error.code).toBe('STALE_VERSION');
    expect(staleBody.error.details?.currentVersion).toBe(1);
    rejected.push({
      version: 1,
      status: staleV1.status,
      code: staleBody.error.code,
      currentVersion: staleBody.error.details?.currentVersion,
    });

    const staleV0 = await putSnapshot(hostContext, host, room, 0, state);
    expect(staleV0.status).toBe(400);
    rejected.push({ version: 0, status: staleV0.status });

    const v2 = await putSnapshot(hostContext, host, room, 2, state);
    expect(v2.status).toBe(200);
    accepted.push((v2.body as { version: number }).version);

    const staleV2 = await putSnapshot(hostContext, host, room, 2, state);
    expect(staleV2.status).toBe(409);
    rejected.push({ version: 2, status: staleV2.status });

    const v3 = await putSnapshot(hostContext, host, room, 3, state);
    expect(v3.status).toBe(200);
    accepted.push((v3.body as { version: number }).version);

    const viewAfterReconnect = await view(playerContext, room.code);
    expect(viewAfterReconnect.status).toBe(200);
    expect((viewAfterReconnect.body as ViewEnvelope).version).toBe(3);

    const v4 = await putSnapshot(hostContext, host, room, 4, state);
    expect(v4.status).toBe(200);
    const viewAfterV4 = await view(playerContext, room.code);
    expect((viewAfterV4.body as ViewEnvelope).version).toBe(4);

    for (let index = 1; index < accepted.length; index += 1) {
      expect(accepted[index]).toBeGreaterThan(accepted[index - 1] ?? 0);
    }

    await saveRaw('ac19-version.json', {
      roomCode: room.code,
      acceptedVersions: accepted,
      rejectedVersions: rejected,
      viewVersionAfterReconnect: (viewAfterReconnect.body as ViewEnvelope).version,
      viewVersionAfterV4: (viewAfterV4.body as ViewEnvelope).version,
      monotonic: accepted.every(
        (version, index) => index === 0 || version > (accepted[index - 1] ?? 0),
      ),
    });
  } finally {
    await hostContext.close();
    await playerContext.close();
  }
});

test('AC-14：结算/解散后房间、座位、状态与快照数据全部删除', async ({ browser }) => {
  test.setTimeout(60_000);
  const hostContext = await browser.newContext();
  const playerContext = await browser.newContext();
  const host = await startSession(hostContext);
  const player = await startSession(playerContext);

  const settledRoom = await createRoom(hostContext, host);
  const settledState = dealtState(settledRoom.boardId);
  expect((await putSnapshot(hostContext, host, settledRoom, 1, settledState)).status).toBe(200);
  const settledJoin = await joinSeat(playerContext, player, settledRoom, 5);
  await confirmSeat(hostContext, host, settledRoom, 5, settledJoin.applicantId);

  const before = countRoomRows(locateRoomDb(settledRoom.roomId), settledRoom.roomId);
  expect(before).toEqual({ rooms: 1, room_seats: 1, game_states: 1, snapshots: 1 });

  const databaseFile = locateRoomDb(settledRoom.roomId);

  const settleResponse = await hostContext.request.post(
    `/api/v1/rooms/${settledRoom.code}/settle`,
    {
      headers: {
        [CSRF_HEADER]: host.csrf,
        [HOST_TOKEN_HEADER]: settledRoom.hostToken,
      },
      data: { winner: 'WOLVES', reason: 'T-045 AC-14 结算验证' },
    },
  );
  expect(settleResponse.status()).toBe(200);

  const summaryAfterSettle = await hostContext.request.get(`/api/v1/rooms/${settledRoom.code}`, {
    headers: { [HOST_TOKEN_HEADER]: settledRoom.hostToken },
  });
  expect(summaryAfterSettle.status()).toBe(404);
  expect((await view(playerContext, settledRoom.code)).status).toBe(404);
  expect(
    (await playerContext.request.get(`/api/v1/rooms/${settledRoom.code}/public`)).status(),
  ).toBe(404);

  const afterSettle = countRoomRows(databaseFile, settledRoom.roomId);
  expect(afterSettle).toEqual({ rooms: 0, room_seats: 0, game_states: 0, snapshots: 0 });

  const deletedRoom = await createRoom(hostContext, host);
  const deletedState = dealtState(deletedRoom.boardId);
  expect((await putSnapshot(hostContext, host, deletedRoom, 1, deletedState)).status).toBe(200);
  const deletedJoin = await joinSeat(playerContext, player, deletedRoom, 6);
  await confirmSeat(hostContext, host, deletedRoom, 6, deletedJoin.applicantId);
  const beforeDelete = countRoomRows(databaseFile, deletedRoom.roomId);
  expect(beforeDelete).toEqual({ rooms: 1, room_seats: 1, game_states: 1, snapshots: 1 });

  const deleteResponse = await hostContext.request.delete(`/api/v1/rooms/${deletedRoom.code}`, {
    headers: {
      [CSRF_HEADER]: host.csrf,
      [HOST_TOKEN_HEADER]: deletedRoom.hostToken,
    },
  });
  expect(deleteResponse.status()).toBe(204);
  const afterDelete = countRoomRows(databaseFile, deletedRoom.roomId);
  expect(afterDelete).toEqual({ rooms: 0, room_seats: 0, game_states: 0, snapshots: 0 });
  expect(
    (await playerContext.request.get(`/api/v1/rooms/${deletedRoom.code}/public`)).status(),
  ).toBe(404);

  try {
    await saveRaw('ac14-db-check.json', {
      settledRoom: {
        roomId: settledRoom.roomId,
        code: settledRoom.code,
        before,
        after: afterSettle,
        api: { summary: 404, view: 404, public: 404 },
      },
      deletedRoom: {
        roomId: deletedRoom.roomId,
        code: deletedRoom.code,
        before: beforeDelete,
        after: afterDelete,
        api: { deleteStatus: 204, public: 404 },
      },
      databaseFile,
    });
  } finally {
    await hostContext.close();
    await playerContext.close();
  }
});
