// @vitest-environment node
import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  applyAction,
  createGame,
  getBoard,
  type BoardId,
  type GameState,
  type NightAction,
  type PlayerView,
} from '@lrs/game-engine';
import {
  CSRF_HEADER,
  HOST_TOKEN_HEADER,
  IDEMPOTENCY_HEADER,
  SESSION_COOKIE_NAME,
  type CreateRoomResponse,
  type JoinRoomResponse,
  type RoomSummary,
} from '@lrs/shared';
import Database from 'better-sqlite3';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from './app.js';
import type { AppConfig } from './config.js';

interface TestSession {
  readonly cookie: string;
  readonly csrfToken: string;
}

interface ViewEnvelope {
  readonly version: number;
  readonly phase: string;
  readonly view: PlayerView | null;
}

const BASE_CONFIG: Partial<AppConfig> = {
  nodeEnv: 'test',
  sessionSecret: 'room-test-secret',
  webDistDir: join(tmpdir(), 'lrs-room-missing-web-dist'),
  roomTtlMs: 60_000,
  roomJoinTtlMs: 60_000,
  roomCleanupIntervalMs: 60_000,
  roomCreateRateLimitPerHour: 1000,
  roomJoinRateLimitPerMin: 1000,
  roomHostRateLimitPerMin: 1000,
};

let tempDir: string;
let dbFile: string;
let app: FastifyInstance;

interface CaseApp {
  readonly app: FastifyInstance;
  readonly dbFile: string;
}

const extraApps: CaseApp[] = [];

async function makeApp(overrides: Partial<AppConfig>): Promise<CaseApp> {
  const file = join(tempDir, `rooms-${Math.random().toString(16).slice(2)}.sqlite`);
  const instance = await buildApp({
    config: { ...BASE_CONFIG, sqliteFile: file, ...overrides },
  });
  extraApps.push({ app: instance, dbFile: file });
  return { app: instance, dbFile: file };
}

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'lrs-rooms-'));
  dbFile = join(tempDir, 'rooms.sqlite');
  app = await buildApp({ config: { ...BASE_CONFIG, sqliteFile: dbFile } });
});

afterEach(async () => {
  await Promise.all(
    extraApps.splice(0).map(async ({ app: instance }) => {
      await instance.close();
    }),
  );
});

afterAll(async () => {
  await app.close();
  await rm(tempDir, { recursive: true, force: true });
});

async function startSession(instance: FastifyInstance = app): Promise<TestSession> {
  const response = await instance.inject({ method: 'GET', url: '/api/v1/session' });
  expect(response.statusCode).toBe(200);
  const cookie = response.cookies.find((item) => item.name === SESSION_COOKIE_NAME);
  expect(cookie).toBeDefined();
  return {
    cookie: `${SESSION_COOKIE_NAME}=${cookie?.value ?? ''}`,
    csrfToken: (response.json() as { csrfToken: string }).csrfToken,
  };
}

function hostHeaders(session: TestSession, hostToken?: string): Record<string, string> {
  return {
    cookie: session.cookie,
    [CSRF_HEADER]: session.csrfToken,
    ...(hostToken === undefined ? {} : { [HOST_TOKEN_HEADER]: hostToken }),
  };
}

async function createRoom(
  session: TestSession,
  instance: FastifyInstance = app,
  extraHeaders: Record<string, string> = {},
): Promise<CreateRoomResponse> {
  const response = await instance.inject({
    method: 'POST',
    url: '/api/v1/rooms',
    headers: { ...hostHeaders(session), ...extraHeaders },
    payload: { boardId: 'pre-witch-hunter-guard' },
  });
  expect(response.statusCode).toBe(201);
  return response.json() as CreateRoomResponse;
}

interface BoundPlayer {
  readonly session: TestSession;
  readonly applicantId: string;
}

async function joinSeat(
  room: CreateRoomResponse,
  host: TestSession,
  seatNo: number,
  playerSession?: TestSession,
): Promise<BoundPlayer> {
  const player = playerSession ?? (await startSession());
  const join = await app.inject({
    method: 'POST',
    url: `/api/v1/rooms/${room.code}/join`,
    headers: { cookie: player.cookie, [CSRF_HEADER]: player.csrfToken },
    payload: { seatNo },
  });
  expect(join.statusCode).toBe(200);
  const applicant = join.json() as JoinRoomResponse;

  const confirm = await app.inject({
    method: 'POST',
    url: `/api/v1/rooms/${room.code}/confirm`,
    headers: hostHeaders(host, room.hostToken),
    payload: { seatNo, applicantId: applicant.applicantId },
  });
  expect(confirm.statusCode).toBe(200);
  return { session: player, applicantId: applicant.applicantId };
}

function dealtState(
  boardId: BoardId = 'pre-witch-hunter-guard',
  extraActions: readonly NightAction[] = [],
): GameState {
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
  return { ...dealt.state, nightActions: [...dealt.state.nightActions, ...extraActions] };
}

async function writeSnapshot(
  room: CreateRoomResponse,
  host: TestSession,
  version: number,
  state: GameState,
): Promise<number> {
  const response = await app.inject({
    method: 'PUT',
    url: `/api/v1/rooms/${room.code}/snapshot`,
    headers: hostHeaders(host, room.hostToken),
    payload: { version, phase: state.phase, gameState: state },
  });
  return response.statusCode;
}

async function getView(
  room: CreateRoomResponse,
  player: TestSession,
): Promise<{ statusCode: number; body: ViewEnvelope }> {
  const response = await app.inject({
    method: 'GET',
    url: `/api/v1/rooms/${room.code}/view`,
    headers: { cookie: player.cookie },
  });
  return { statusCode: response.statusCode, body: response.json() as ViewEnvelope };
}

describe('房间生命周期', () => {
  it('创建 → 加入 → 确认 → 快照 → 视图 → 解绑 → 结算', async () => {
    const host = await startSession();
    const room = await createRoom(host);
    expect(room.code).toMatch(/^\d{6}$/);
    expect(room.hostToken.length).toBeGreaterThanOrEqual(32);

    const player = await startSession();
    const join = await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${room.code}/join`,
      headers: { cookie: player.cookie, [CSRF_HEADER]: player.csrfToken },
      payload: { seatNo: 5 },
    });
    expect(join.statusCode).toBe(200);
    const applicant = join.json() as JoinRoomResponse;
    expect(applicant.status).toBe('pending');

    const confirm = await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${room.code}/confirm`,
      headers: hostHeaders(host, room.hostToken),
      payload: { seatNo: 5, applicantId: applicant.applicantId },
    });
    expect(confirm.statusCode).toBe(200);

    expect(await writeSnapshot(room, host, 1, dealtState())).toBe(200);
    const view = await getView(room, player);
    expect(view.statusCode).toBe(200);
    expect(view.body.version).toBe(1);
    expect(view.body.view?.mySeat).toBe(5);
    expect(view.body.view?.role).toBe('VILLAGER');

    const unbind = await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${room.code}/unbind`,
      headers: hostHeaders(host, room.hostToken),
      payload: { seatNo: 5 },
    });
    expect(unbind.statusCode).toBe(200);
    expect((await getView(room, player)).statusCode).toBe(403);

    const settle = await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${room.code}/settle`,
      headers: hostHeaders(host, room.hostToken),
      payload: { winner: 'WOLVES', reason: '测试结算' },
    });
    expect(settle.statusCode).toBe(200);
    expect((settle.json() as { status: string }).status).toBe('settled');

    const summary = await app.inject({
      method: 'GET',
      url: `/api/v1/rooms/${room.code}`,
      headers: { [HOST_TOKEN_HEADER]: room.hostToken },
    });
    expect(summary.statusCode).toBe(404);
  });

  it('重复申请返回同一申请；同座位他人申请冲突；错误申请号不能确认', async () => {
    const host = await startSession();
    const room = await createRoom(host);
    const player = await startSession();

    const first = await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${room.code}/join`,
      headers: { cookie: player.cookie, [CSRF_HEADER]: player.csrfToken },
      payload: { seatNo: 3 },
    });
    const firstBody = first.json() as JoinRoomResponse;

    const repeat = await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${room.code}/join`,
      headers: { cookie: player.cookie, [CSRF_HEADER]: player.csrfToken },
      payload: { seatNo: 3 },
    });
    expect((repeat.json() as JoinRoomResponse).applicantId).toBe(firstBody.applicantId);

    const other = await startSession();
    const conflict = await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${room.code}/join`,
      headers: { cookie: other.cookie, [CSRF_HEADER]: other.csrfToken },
      payload: { seatNo: 3 },
    });
    expect(conflict.statusCode).toBe(409);

    const wrongConfirm = await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${room.code}/confirm`,
      headers: hostHeaders(host, room.hostToken),
      payload: { seatNo: 3, applicantId: 's_wrong' },
    });
    expect(wrongConfirm.statusCode).toBe(409);
  });

  it('确认单个座位不影响其他待确认申请', async () => {
    const host = await startSession();
    const room = await createRoom(host);
    const first = await startSession();
    const second = await startSession();

    const applySeat = async (session: TestSession, seatNo: number): Promise<string> => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/rooms/${room.code}/join`,
        headers: { cookie: session.cookie, [CSRF_HEADER]: session.csrfToken },
        payload: { seatNo },
      });
      expect(response.statusCode).toBe(200);
      return (response.json() as JoinRoomResponse).applicantId;
    };

    const firstApplicant = await applySeat(first, 1);
    const secondApplicant = await applySeat(second, 2);

    const confirmFirst = await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${room.code}/confirm`,
      headers: hostHeaders(host, room.hostToken),
      payload: { seatNo: 1, applicantId: firstApplicant },
    });
    expect(confirmFirst.statusCode).toBe(200);
    expect((await getView(room, first)).statusCode).toBe(200);
    expect((await getView(room, second)).statusCode).toBe(403);

    const confirmSecond = await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${room.code}/confirm`,
      headers: hostHeaders(host, room.hostToken),
      payload: { seatNo: 2, applicantId: secondApplicant },
    });
    expect(confirmSecond.statusCode).toBe(200);
  });

  it('同一会话改选编号只移动自己的申请', async () => {
    const host = await startSession();
    const room = await createRoom(host);
    const first = await startSession();
    const second = await startSession();

    const applySeat = async (session: TestSession, seatNo: number): Promise<string> => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/rooms/${room.code}/join`,
        headers: { cookie: session.cookie, [CSRF_HEADER]: session.csrfToken },
        payload: { seatNo },
      });
      expect(response.statusCode).toBe(200);
      return (response.json() as JoinRoomResponse).applicantId;
    };

    const firstAtSeat1 = await applySeat(first, 1);
    const secondAtSeat2 = await applySeat(second, 2);
    const firstAtSeat3 = await applySeat(first, 3);
    expect(firstAtSeat3).toBe(firstAtSeat1);

    const confirmSecond = await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${room.code}/confirm`,
      headers: hostHeaders(host, room.hostToken),
      payload: { seatNo: 2, applicantId: secondAtSeat2 },
    });
    expect(confirmSecond.statusCode).toBe(200);

    const staleSeat = await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${room.code}/confirm`,
      headers: hostHeaders(host, room.hostToken),
      payload: { seatNo: 1, applicantId: firstAtSeat1 },
    });
    expect(staleSeat.statusCode).toBe(404);

    const confirmMoved = await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${room.code}/confirm`,
      headers: hostHeaders(host, room.hostToken),
      payload: { seatNo: 3, applicantId: firstAtSeat3 },
    });
    expect(confirmMoved.statusCode).toBe(200);
  });

  it('创建/确认支持幂等键', async () => {
    const host = await startSession();
    const headers = { [IDEMPOTENCY_HEADER]: 'create-1' };
    const first = await createRoom(host, app, headers);
    const second = await createRoom(host, app, headers);
    expect(second.roomId).toBe(first.roomId);
    expect(second.hostToken).toBe(first.hostToken);

    const player = await startSession();
    const join = await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${first.code}/join`,
      headers: { cookie: player.cookie, [CSRF_HEADER]: player.csrfToken },
      payload: { seatNo: 1 },
    });
    const applicant = join.json() as JoinRoomResponse;

    const payload = { seatNo: 1, applicantId: applicant.applicantId };
    const confirmHeaders = {
      ...hostHeaders(host, first.hostToken),
      [IDEMPOTENCY_HEADER]: 'confirm-1',
    };
    const confirmFirst = await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${first.code}/confirm`,
      headers: confirmHeaders,
      payload,
    });
    const confirmSecond = await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${first.code}/confirm`,
      headers: confirmHeaders,
      payload,
    });
    expect(confirmFirst.statusCode).toBe(200);
    expect(confirmSecond.statusCode).toBe(200);
  });

  it('主持令牌只存哈希且不下发', async () => {
    const host = await startSession();
    const room = await createRoom(host);
    const sqlite = new Database(dbFile, { readonly: true });
    try {
      const row = sqlite
        .prepare('SELECT host_token_hash AS hash FROM rooms WHERE code = ?')
        .get(room.code) as { hash: string } | undefined;
      expect(row?.hash).toBe(createHash('sha256').update(room.hostToken).digest('hex'));
      expect(row?.hash).not.toBe(room.hostToken);
    } finally {
      sqlite.close();
    }

    const summary = await app.inject({
      method: 'GET',
      url: `/api/v1/rooms/${room.code}`,
      headers: { [HOST_TOKEN_HEADER]: room.hostToken },
    });
    expect(summary.body).not.toContain(room.hostToken);
    expect(summary.body).not.toContain('hostToken');
  });
});

describe('房间摘要、公开信息与取消申请', () => {
  it('摘要包含座位状态且不泄露会话；公开信息无需鉴权', async () => {
    const host = await startSession();
    const room = await createRoom(host);
    await joinSeat(room, host, 3);

    const pendingPlayer = await startSession();
    const pending = await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${room.code}/join`,
      headers: { cookie: pendingPlayer.cookie, [CSRF_HEADER]: pendingPlayer.csrfToken },
      payload: { seatNo: 4 },
    });
    expect(pending.statusCode).toBe(200);

    const summary = await app.inject({
      method: 'GET',
      url: `/api/v1/rooms/${room.code}`,
      headers: { [HOST_TOKEN_HEADER]: room.hostToken },
    });
    expect(summary.statusCode).toBe(200);
    const body = summary.json() as RoomSummary;
    expect(body.seats).toHaveLength(2);
    expect(body.seats.find((seat) => seat.seatNo === 3)?.status).toBe('bound');
    expect(body.seats.find((seat) => seat.seatNo === 4)?.status).toBe('pending');
    expect(summary.body).not.toContain('sessionId');
    expect(summary.body).not.toContain(pendingPlayer.cookie);

    const publicInfo = await app.inject({
      method: 'GET',
      url: `/api/v1/rooms/${room.code}/public`,
    });
    expect(publicInfo.statusCode).toBe(200);
    const publicBody = publicInfo.json() as Record<string, unknown>;
    expect(publicBody).toMatchObject({
      code: room.code,
      boardId: 'pre-witch-hunter-guard',
      status: 'active',
    });
    expect(publicInfo.body).not.toContain('hostToken');
    expect(publicInfo.body).not.toContain('roomId');

    const missingCode = room.code === '000000' ? '000001' : '000000';
    const missing = await app.inject({
      method: 'GET',
      url: `/api/v1/rooms/${missingCode}/public`,
    });
    expect(missing.statusCode).toBe(404);
  });

  it('玩家可取消待确认申请；已绑定后需主持人解绑', async () => {
    const host = await startSession();
    const room = await createRoom(host);
    const player = await startSession();

    const join = await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${room.code}/join`,
      headers: { cookie: player.cookie, [CSRF_HEADER]: player.csrfToken },
      payload: { seatNo: 7 },
    });
    const applicant = join.json() as JoinRoomResponse;

    const leave = await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${room.code}/leave`,
      headers: { cookie: player.cookie, [CSRF_HEADER]: player.csrfToken },
    });
    expect(leave.statusCode).toBe(200);
    expect((leave.json() as { status: string }).status).toBe('cancelled');

    const staleConfirm = await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${room.code}/confirm`,
      headers: hostHeaders(host, room.hostToken),
      payload: { seatNo: 7, applicantId: applicant.applicantId },
    });
    expect(staleConfirm.statusCode).toBe(404);

    await joinSeat(room, host, 8);
    const boundPlayer = await startSession();
    const boundJoin = await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${room.code}/join`,
      headers: { cookie: boundPlayer.cookie, [CSRF_HEADER]: boundPlayer.csrfToken },
      payload: { seatNo: 9 },
    });
    const boundApplicant = boundJoin.json() as JoinRoomResponse;
    await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${room.code}/confirm`,
      headers: hostHeaders(host, room.hostToken),
      payload: { seatNo: 9, applicantId: boundApplicant.applicantId },
    });

    const boundLeave = await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${room.code}/leave`,
      headers: { cookie: boundPlayer.cookie, [CSRF_HEADER]: boundPlayer.csrfToken },
    });
    expect(boundLeave.statusCode).toBe(409);
  });
});

describe('权限与 AC-13 视图过滤', () => {
  it('未绑定玩家、错误主持令牌与无令牌请求被拒绝', async () => {
    const host = await startSession();
    const room = await createRoom(host);
    const outsider = await startSession();

    expect((await getView(room, outsider)).statusCode).toBe(403);

    const summaryWithoutToken = await app.inject({
      method: 'GET',
      url: `/api/v1/rooms/${room.code}`,
    });
    expect(summaryWithoutToken.statusCode).toBe(403);

    const summaryWrongToken = await app.inject({
      method: 'GET',
      url: `/api/v1/rooms/${room.code}`,
      headers: { [HOST_TOKEN_HEADER]: 'wrong-token' },
    });
    expect(summaryWrongToken.statusCode).toBe(403);

    const snapshot = await app.inject({
      method: 'PUT',
      url: `/api/v1/rooms/${room.code}/snapshot`,
      headers: {
        cookie: host.cookie,
        [CSRF_HEADER]: host.csrfToken,
        [HOST_TOKEN_HEADER]: 'wrong-token',
      },
      payload: { version: 1, phase: 'NIGHT', gameState: dealtState() },
    });
    expect(snapshot.statusCode).toBe(403);
  });

  it('玩家只拿到自己的视图，不含原始状态与他人身份', async () => {
    const host = await startSession();
    const room = await createRoom(host);
    const villager = await joinSeat(room, host, 5);
    const wolf = await joinSeat(room, host, 9);
    const seer = await joinSeat(room, host, 1);

    const seerAction: NightAction = {
      round: 1,
      step: 1,
      roleId: 'SEER',
      target: 9,
      potion: null,
    };
    const state = dealtState('pre-witch-hunter-guard', [seerAction]);
    expect(await writeSnapshot(room, host, 1, state)).toBe(200);

    const villagerView = await getView(room, villager.session);
    expect(villagerView.statusCode).toBe(200);
    expect(villagerView.body.view?.role).toBe('VILLAGER');
    expect(villagerView.body.view?.teammates).toBeUndefined();
    expect(villagerView.body.view?.checks).toBeUndefined();
    expect(villagerView.body.view?.potions).toBeUndefined();
    expect(villagerView.body.view?.guarded).toBeUndefined();
    expect(villagerView.body.view?.revealedRoles).toBeUndefined();

    const serialized = JSON.stringify(villagerView.body);
    expect(serialized).not.toContain('nightActions');
    expect(serialized).not.toContain('state_json');
    expect(serialized).not.toContain('hostToken');
    expect(serialized).not.toContain('revealedRoles');

    const wolfView = await getView(room, wolf.session);
    expect(wolfView.body.view?.role).toBe('WOLF');
    expect(wolfView.body.view?.teammates).toEqual([10, 11, 12]);

    const seerView = await getView(room, seer.session);
    expect(seerView.body.view?.role).toBe('SEER');
    expect(seerView.body.view?.checks).toEqual([{ target: 9, result: 'WOLF' }]);
    expect(seerView.body.view?.teammates).toBeUndefined();
  });

  it('未发牌时视图为空；绑定玩家不能读取房间摘要', async () => {
    const host = await startSession();
    const room = await createRoom(host);
    const player = await joinSeat(room, host, 2);

    expect(await writeSnapshot(room, host, 1, dealtState())).toBe(200);

    const boundBeforeDealRoom = await createRoom(host);
    const waiting = await joinSeat(boundBeforeDealRoom, host, 2);
    expect(await writeSnapshot(boundBeforeDealRoom, host, 1, createGame())).toBe(200);
    expect((await getView(boundBeforeDealRoom, waiting.session)).body.view).toBeNull();

    const summary = await app.inject({
      method: 'GET',
      url: `/api/v1/rooms/${room.code}`,
      headers: { cookie: player.session.cookie },
    });
    expect(summary.statusCode).toBe(403);
  });
});

describe('快照版本与状态校验（AC-19）', () => {
  it('版本必须严格递增，旧版本返回 STALE_VERSION', async () => {
    const host = await startSession();
    const room = await createRoom(host);
    const state = dealtState();

    expect(await writeSnapshot(room, host, 1, state)).toBe(200);

    const stale = await app.inject({
      method: 'PUT',
      url: `/api/v1/rooms/${room.code}/snapshot`,
      headers: hostHeaders(host, room.hostToken),
      payload: { version: 1, phase: state.phase, gameState: state },
    });
    expect(stale.statusCode).toBe(409);
    expect(
      (stale.json() as { error: { code: string; details: { currentVersion: number } } }).error.code,
    ).toBe('STALE_VERSION');
    expect(
      (stale.json() as { error: { details: { currentVersion: number } } }).error.details
        .currentVersion,
    ).toBe(1);

    const older = await app.inject({
      method: 'PUT',
      url: `/api/v1/rooms/${room.code}/snapshot`,
      headers: hostHeaders(host, room.hostToken),
      payload: { version: 0, phase: state.phase, gameState: state },
    });
    expect(older.statusCode).toBe(400);

    expect(await writeSnapshot(room, host, 3, state)).toBe(200);

    const summary = await app.inject({
      method: 'GET',
      url: `/api/v1/rooms/${room.code}`,
      headers: { [HOST_TOKEN_HEADER]: room.hostToken },
    });
    expect((summary.json() as RoomSummary).version).toBe(3);
  });

  it('结构非法、phase 不一致、板子不一致返回 422', async () => {
    const host = await startSession();
    const room = await createRoom(host);
    const state = dealtState();

    const invalidStructure = await app.inject({
      method: 'PUT',
      url: `/api/v1/rooms/${room.code}/snapshot`,
      headers: hostHeaders(host, room.hostToken),
      payload: { version: 1, phase: 'NIGHT', gameState: { boardId: 'pre-witch-hunter-guard' } },
    });
    expect(invalidStructure.statusCode).toBe(422);
    expect((invalidStructure.json() as { error: { code: string } }).error.code).toBe(
      'INVALID_STATE',
    );

    const phaseMismatch = await app.inject({
      method: 'PUT',
      url: `/api/v1/rooms/${room.code}/snapshot`,
      headers: hostHeaders(host, room.hostToken),
      payload: { version: 1, phase: 'DAWN', gameState: state },
    });
    expect(phaseMismatch.statusCode).toBe(422);

    const boardMismatch = await app.inject({
      method: 'PUT',
      url: `/api/v1/rooms/${room.code}/snapshot`,
      headers: hostHeaders(host, room.hostToken),
      payload: {
        version: 1,
        phase: state.phase,
        gameState: dealtState('pre-witch-hunter-idiot'),
      },
    });
    expect(boardMismatch.statusCode).toBe(422);

    const invalidSeats = await app.inject({
      method: 'PUT',
      url: `/api/v1/rooms/${room.code}/snapshot`,
      headers: hostHeaders(host, room.hostToken),
      payload: { version: 1, phase: state.phase, gameState: { ...state, seats: [] } },
    });
    expect(invalidSeats.statusCode).toBe(422);
  });
});

describe('结算/解散删除数据（AC-14）', () => {
  function countRows(roomId: string): Record<string, number> {
    const sqlite = new Database(dbFile, { readonly: true });
    try {
      const count = (table: string): number => {
        const row = sqlite
          .prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE room_id = ?`)
          .get(roomId) as { n: number };
        return row.n;
      };
      const room = sqlite.prepare('SELECT COUNT(*) AS n FROM rooms WHERE id = ?').get(roomId) as {
        n: number;
      };
      return {
        rooms: room.n,
        room_seats: count('room_seats'),
        game_states: count('game_states'),
        snapshots: count('snapshots'),
      };
    } finally {
      sqlite.close();
    }
  }

  it('结算后四表相关行全部删除', async () => {
    const host = await startSession();
    const room = await createRoom(host);
    await joinSeat(room, host, 4);
    expect(await writeSnapshot(room, host, 1, dealtState())).toBe(200);
    expect(countRows(room.roomId)).toMatchObject({
      rooms: 1,
      room_seats: 1,
      game_states: 1,
      snapshots: 1,
    });

    const settle = await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${room.code}/settle`,
      headers: hostHeaders(host, room.hostToken),
      payload: { winner: 'GOOD' },
    });
    expect(settle.statusCode).toBe(200);
    expect(countRows(room.roomId)).toEqual({
      rooms: 0,
      room_seats: 0,
      game_states: 0,
      snapshots: 0,
    });
  });

  it('解散返回 204 并删除数据', async () => {
    const host = await startSession();
    const room = await createRoom(host);
    await joinSeat(room, host, 6);
    expect(await writeSnapshot(room, host, 1, dealtState())).toBe(200);

    const deleted = await app.inject({
      method: 'DELETE',
      url: `/api/v1/rooms/${room.code}`,
      headers: hostHeaders(host, room.hostToken),
    });
    expect(deleted.statusCode).toBe(204);
    expect(countRows(room.roomId)).toEqual({
      rooms: 0,
      room_seats: 0,
      game_states: 0,
      snapshots: 0,
    });
  });
});

describe('TTL 与限频', () => {
  it('过期房间可被清理且不可再访问', async () => {
    const { app: ttlApp } = await makeApp({
      roomTtlMs: 40,
      sqliteFile: join(tempDir, 'ttl.sqlite'),
    });
    const host = await startSession(ttlApp);
    const room = await createRoom(host, ttlApp);
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(ttlApp.roomService?.cleanupExpired()).toBeGreaterThanOrEqual(1);

    const summary = await ttlApp.inject({
      method: 'GET',
      url: `/api/v1/rooms/${room.code}`,
      headers: { [HOST_TOKEN_HEADER]: room.hostToken },
    });
    expect(summary.statusCode).toBe(404);
  });

  it('加入申请超过限频返回 429', async () => {
    const { app: limitedApp } = await makeApp({
      sqliteFile: join(tempDir, 'limited.sqlite'),
      roomJoinRateLimitPerMin: 2,
    });
    const host = await startSession(limitedApp);
    const room = await createRoom(host, limitedApp);

    const player = await startSession(limitedApp);
    const statuses: number[] = [];
    for (const seatNo of [1, 2, 3]) {
      const response = await limitedApp.inject({
        method: 'POST',
        url: `/api/v1/rooms/${room.code}/join`,
        headers: { cookie: player.cookie, [CSRF_HEADER]: player.csrfToken },
        payload: { seatNo },
      });
      statuses.push(response.statusCode);
    }
    expect(statuses).toEqual([200, 200, 429]);
  });
});

describe('会话签名', () => {
  it('未签名 Cookie 不能创建房间', async () => {
    const session = await startSession();
    const rawSessionId = session.cookie.slice(`${SESSION_COOKIE_NAME}=`.length).split('.')[0];
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/rooms',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${rawSessionId}`,
        [CSRF_HEADER]: session.csrfToken,
      },
      payload: {},
    });
    expect(response.statusCode).toBe(401);
  });
});
