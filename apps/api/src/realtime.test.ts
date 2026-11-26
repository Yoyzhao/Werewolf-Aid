// @vitest-environment node
import { mkdtemp, rm } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { applyAction, createGame, getBoard, type BoardId, type GameState } from '@lrs/game-engine';
import {
  CSRF_HEADER,
  HOST_TOKEN_HEADER,
  SESSION_COOKIE_NAME,
  type CreateRoomResponse,
  type JoinRoomResponse,
} from '@lrs/shared';
import type { FastifyInstance } from 'fastify';
import { io as clientIo, type Socket as ClientSocket } from 'socket.io-client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from './app.js';
import type { AppConfig } from './config.js';

interface TestSession {
  readonly cookie: string;
  readonly csrfToken: string;
}

const BASE_CONFIG: Partial<AppConfig> = {
  nodeEnv: 'test',
  sessionSecret: 'realtime-test-secret',
  webDistDir: join(tmpdir(), 'lrs-ws-missing-web-dist'),
  roomTtlMs: 60_000,
  roomJoinTtlMs: 60_000,
  roomCleanupIntervalMs: 60_000,
  roomCreateRateLimitPerHour: 1000,
  roomJoinRateLimitPerMin: 1000,
  roomHostRateLimitPerMin: 1000,
};

let tempDir: string;
let app: FastifyInstance;
let port: number;
const clients: ClientSocket[] = [];

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'lrs-ws-'));
  app = await buildApp({
    config: { ...BASE_CONFIG, sqliteFile: join(tempDir, 'ws.sqlite') },
  });
  await app.listen({ port: 0, host: '127.0.0.1' });
  port = (app.server.address() as AddressInfo).port;
});

afterEach(() => {
  for (const client of clients.splice(0)) {
    client.disconnect();
  }
});

afterAll(async () => {
  await app.close();
  await rm(tempDir, { recursive: true, force: true });
});

async function startSession(instance: FastifyInstance = app): Promise<TestSession> {
  const response = await instance.inject({ method: 'GET', url: '/api/v1/session' });
  const cookie = response.cookies.find((item) => item.name === SESSION_COOKIE_NAME);
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

async function joinSeat(
  room: CreateRoomResponse,
  host: TestSession,
  seatNo: number,
  instance: FastifyInstance = app,
  extraHeaders: Record<string, string> = {},
): Promise<TestSession> {
  const player = await startSession(instance);
  const join = await instance.inject({
    method: 'POST',
    url: `/api/v1/rooms/${room.code}/join`,
    headers: {
      cookie: player.cookie,
      [CSRF_HEADER]: player.csrfToken,
      ...extraHeaders,
    },
    payload: { seatNo },
  });
  expect(join.statusCode).toBe(200);
  const applicant = join.json() as JoinRoomResponse;

  const confirm = await instance.inject({
    method: 'POST',
    url: `/api/v1/rooms/${room.code}/confirm`,
    headers: { ...hostHeaders(host, room.hostToken), ...extraHeaders },
    payload: { seatNo, applicantId: applicant.applicantId },
  });
  expect(confirm.statusCode).toBe(200);
  return player;
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

async function writeSnapshot(
  room: CreateRoomResponse,
  host: TestSession,
  version: number,
  state: GameState = dealtState(),
  instance: FastifyInstance = app,
  extraHeaders: Record<string, string> = {},
): Promise<void> {
  const response = await instance.inject({
    method: 'PUT',
    url: `/api/v1/rooms/${room.code}/snapshot`,
    headers: { ...hostHeaders(host, room.hostToken), ...extraHeaders },
    payload: { version, phase: state.phase, gameState: state },
  });
  expect(response.statusCode).toBe(200);
}

function connectClient(code: string, cookie?: string, origin?: string): ClientSocket {
  const extraHeaders: Record<string, string> = {};
  if (cookie) extraHeaders.cookie = cookie;
  if (origin) extraHeaders.origin = origin;
  const client = clientIo(`http://127.0.0.1:${port}`, {
    path: '/ws/rooms',
    transports: ['websocket'],
    reconnection: false,
    forceNew: true,
    timeout: 3000,
    query: { code },
    extraHeaders,
  });
  clients.push(client);
  return client;
}

interface RoomViewPayload {
  readonly type: 'room.view';
  readonly version: number;
  readonly phase: string;
  readonly view: {
    readonly mySeat: number;
    readonly role: string;
    readonly teammates?: readonly number[];
  };
}

interface ConnectErrorPayload {
  readonly message: string;
  readonly data?: { readonly code?: string };
}

function waitForConnect(client: ClientSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    client.once('connect', () => resolve());
    client.once('connect_error', (error: Error) => reject(error));
  });
}

function waitForConnectError(client: ClientSocket): Promise<ConnectErrorPayload> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout waiting connect_error')), 3000);
    client.once('connect_error', (error: Error & { data?: { code?: string } }) => {
      clearTimeout(timer);
      resolve({ message: error.message, data: error.data });
    });
    client.once('connect', () => reject(new Error('unexpected connect')));
  });
}

function nextEvent<T>(client: ClientSocket, event: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting ${event}`)), 3000);
    client.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

describe('Socket.IO 房间推送', () => {
  it('连接后收到当前视图，快照更新按版本递增推送', async () => {
    const host = await startSession();
    const room = await createRoom(host);
    const player = await joinSeat(room, host, 5);
    await writeSnapshot(room, host, 1);

    const client = connectClient(room.code, player.cookie);
    const firstView = nextEvent<RoomViewPayload>(client, 'room.view');
    await waitForConnect(client);

    const initial = await firstView;
    expect(initial.version).toBe(1);
    expect(initial.view.mySeat).toBe(5);
    expect(initial.view.role).toBe('VILLAGER');
    expect(initial.view.teammates).toBeUndefined();

    const versions: number[] = [initial.version];
    for (const version of [2, 3]) {
      const next = nextEvent<RoomViewPayload>(client, 'room.view');
      await writeSnapshot(room, host, version);
      versions.push((await next).version);
    }
    expect(versions).toEqual([1, 2, 3]);
  });

  it('未发牌时保持连接，发牌后收到首个视图', async () => {
    const host = await startSession();
    const room = await createRoom(host);
    const player = await joinSeat(room, host, 5);
    await writeSnapshot(room, host, 1, createGame());

    const client = connectClient(room.code, player.cookie);
    await waitForConnect(client);

    const views: RoomViewPayload[] = [];
    client.on('room.view', (payload: RoomViewPayload) => views.push(payload));
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(views).toEqual([]);
    expect(client.connected).toBe(true);

    const next = nextEvent<RoomViewPayload>(client, 'room.view');
    await writeSnapshot(room, host, 2);
    const view = await next;
    expect(view.version).toBe(2);
    expect(view.view.mySeat).toBe(5);
    expect(view.view.role).toBe('VILLAGER');
  });

  it('结算后推送 room.closed 并断开连接', async () => {
    const host = await startSession();
    const room = await createRoom(host);
    const player = await joinSeat(room, host, 6);
    await writeSnapshot(room, host, 1);

    const client = connectClient(room.code, player.cookie);
    const initial = nextEvent<RoomViewPayload>(client, 'room.view');
    await waitForConnect(client);
    await initial;

    const closed = nextEvent<{ type: string; reason: string }>(client, 'room.closed');
    const disconnected = nextEvent<string>(client, 'disconnect');
    const settle = await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${room.code}/settle`,
      headers: hostHeaders(host, room.hostToken),
      payload: { winner: 'GOOD' },
    });
    expect(settle.statusCode).toBe(200);

    expect(await closed).toMatchObject({ type: 'room.closed', reason: 'settled' });
    await disconnected;
  });

  it('未绑定、无会话、无效配对码均拒绝连接', async () => {
    const host = await startSession();
    const room = await createRoom(host);
    await joinSeat(room, host, 7);
    await writeSnapshot(room, host, 1);

    const anonymous = connectClient(room.code);
    expect((await waitForConnectError(anonymous)).data?.code).toBe('UNAUTHORIZED');

    const outsider = await startSession();
    const forbidden = connectClient(room.code, outsider.cookie);
    expect((await waitForConnectError(forbidden)).data?.code).toBe('FORBIDDEN');

    const missingCode = room.code === '000000' ? '000001' : '000000';
    const missing = connectClient(missingCode, outsider.cookie);
    expect((await waitForConnectError(missing)).data?.code).toBe('NOT_FOUND');

    const malformed = connectClient('abc', outsider.cookie);
    expect((await waitForConnectError(malformed)).data?.code).toBe('INVALID_REQUEST');
  });

  it('被解绑后立即收到 room.error 并断开', async () => {
    const host = await startSession();
    const room = await createRoom(host);
    const player = await joinSeat(room, host, 8);
    await writeSnapshot(room, host, 1);

    const client = connectClient(room.code, player.cookie);
    const initial = nextEvent<RoomViewPayload>(client, 'room.view');
    await waitForConnect(client);
    await initial;

    const error = nextEvent<{ code: string }>(client, 'room.error');
    const disconnected = nextEvent<string>(client, 'disconnect');
    const unbind = await app.inject({
      method: 'POST',
      url: `/api/v1/rooms/${room.code}/unbind`,
      headers: hostHeaders(host, room.hostToken),
      payload: { seatNo: 8 },
    });
    expect(unbind.statusCode).toBe(200);

    expect((await error).code).toBe('FORBIDDEN');
    await disconnected;
  });

  it('配置 PUBLIC_ORIGIN 时校验 WebSocket Origin', async () => {
    const origin = 'https://app.example.test';
    const isolated = await buildApp({
      config: {
        ...BASE_CONFIG,
        sqliteFile: join(tempDir, 'origin.sqlite'),
        publicOrigin: origin,
      },
    });
    await isolated.listen({ port: 0, host: '127.0.0.1' });
    const isolatedPort = (isolated.server.address() as AddressInfo).port;

    try {
      const host = await startSession(isolated);
      const room = await createRoom(host, isolated, { origin });
      const player = await joinSeat(room, host, 5, isolated, { origin });
      await writeSnapshot(room, host, 1, dealtState(), isolated, { origin });

      const url = `http://127.0.0.1:${isolatedPort}`;
      const noOrigin = clientIo(url, {
        path: '/ws/rooms',
        transports: ['websocket'],
        reconnection: false,
        forceNew: true,
        timeout: 3000,
        query: { code: room.code },
        extraHeaders: { cookie: player.cookie },
      });
      clients.push(noOrigin);
      await expect(waitForConnect(noOrigin)).rejects.toBeTruthy();

      const withOrigin = clientIo(url, {
        path: '/ws/rooms',
        transports: ['websocket'],
        reconnection: false,
        forceNew: true,
        timeout: 3000,
        query: { code: room.code },
        extraHeaders: { cookie: player.cookie, origin },
      });
      clients.push(withOrigin);
      const view = nextEvent<RoomViewPayload>(withOrigin, 'room.view');
      await waitForConnect(withOrigin);
      expect((await view).version).toBe(1);
    } finally {
      await isolated.close();
    }
  });
});
