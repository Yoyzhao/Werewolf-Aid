import { createGame } from '@lrs/game-engine';
import type { RoomSummary } from '@lrs/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetRoomSession } from '../lib/room-api';
import { useGameStore } from './game-store';
import { useHostRoomStore } from './host-room-store';

const ROOM: RoomSummary = {
  roomId: 'r_test',
  code: '483920',
  boardId: 'pre-witch-hunter-guard',
  phase: 'SETUP',
  status: 'active',
  version: 0,
  expiresAt: Date.now() + 86_400_000,
  joinExpiresAt: Date.now() + 600_000,
  seats: [],
};

function jsonResponse(status: number, data: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  } as unknown as Response;
}

interface FetchCall {
  readonly url: string;
  readonly method: string;
  readonly body: unknown;
}

function installFetch(snapshot: (call: FetchCall) => Response): {
  calls: FetchCall[];
  mock: ReturnType<typeof vi.fn>;
} {
  const calls: FetchCall[] = [];
  const mock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const body = init?.body ? (JSON.parse(String(init.body)) as unknown) : undefined;
    const call = { url, method, body };
    calls.push(call);

    if (url === '/api/v1/session') {
      return jsonResponse(200, { csrfToken: 'c'.repeat(64), expiresAt: Date.now() + 60_000 });
    }
    if (url === '/api/v1/rooms' && method === 'POST') {
      return jsonResponse(201, {
        roomId: ROOM.roomId,
        code: ROOM.code,
        hostToken: 'host-token',
        boardId: ROOM.boardId,
        joinExpiresAt: ROOM.joinExpiresAt,
        expiresAt: ROOM.expiresAt,
      });
    }
    if (url === '/api/v1/rooms/483920' && method === 'GET') {
      return jsonResponse(200, ROOM);
    }
    if (url === '/api/v1/rooms/483920/snapshot') {
      return snapshot(call);
    }
    throw new Error(`unexpected fetch: ${method} ${url}`);
  });
  vi.stubGlobal('fetch', mock);
  return { calls, mock };
}

async function createReadyRoom(): Promise<void> {
  await useHostRoomStore.getState().create('pre-witch-hunter-guard');
  expect(useHostRoomStore.getState().binding?.code).toBe(ROOM.code);
}

beforeEach(() => {
  window.localStorage.clear();
  resetRoomSession();
  useGameStore.setState(useGameStore.getInitialState(), true);
  useHostRoomStore.setState(useHostRoomStore.getInitialState(), true);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('联机主持房间状态', () => {
  it('创建房间后保存本机绑定并读取摘要', async () => {
    installFetch(() => jsonResponse(200, { version: 1 }));
    await createReadyRoom();

    const state = useHostRoomStore.getState();
    expect(state.status).toBe('ready');
    expect(state.binding?.hostToken).toBe('host-token');
    expect(state.summary?.code).toBe(ROOM.code);
    expect(window.localStorage.getItem('lrs.room.host.v1')).toContain('host-token');
  });

  it('快照失败后按退避重试，成功后记录版本', async () => {
    vi.useFakeTimers();
    let attempts = 0;
    const { calls } = installFetch(() => {
      attempts += 1;
      if (attempts === 1) {
        return jsonResponse(500, { error: { code: 'INTERNAL', message: 'boom' } });
      }
      return jsonResponse(200, { version: 1 });
    });

    await createReadyRoom();
    const game = createGame();
    useHostRoomStore.getState().scheduleSnapshot(game);

    await vi.advanceTimersByTimeAsync(300);
    expect(useHostRoomStore.getState().syncStatus).toBe('retry');

    await vi.advanceTimersByTimeAsync(1000);
    expect(useHostRoomStore.getState().syncStatus).toBe('synced');
    expect(useHostRoomStore.getState().syncVersion).toBe(1);

    const snapshotCalls = calls.filter((call) => call.url.endsWith('/snapshot'));
    expect(snapshotCalls).toHaveLength(2);
    expect((snapshotCalls[0]?.body as { version: number }).version).toBe(1);
    expect((snapshotCalls[1]?.body as { version: number }).version).toBe(1);
  });

  it('旧版本 409 时读取 currentVersion 并以新版本补写', async () => {
    vi.useFakeTimers();
    let attempts = 0;
    const { calls } = installFetch(() => {
      attempts += 1;
      if (attempts === 1) {
        return jsonResponse(409, {
          error: {
            code: 'STALE_VERSION',
            message: '快照版本过期',
            details: { currentVersion: 7 },
          },
        });
      }
      return jsonResponse(200, { version: 8 });
    });

    await createReadyRoom();
    useHostRoomStore.getState().scheduleSnapshot(createGame());
    await vi.advanceTimersByTimeAsync(300);
    await vi.advanceTimersByTimeAsync(0);

    expect(useHostRoomStore.getState().syncStatus).toBe('synced');
    expect(useHostRoomStore.getState().syncVersion).toBe(8);

    const snapshotCalls = calls.filter((call) => call.url.endsWith('/snapshot'));
    expect((snapshotCalls[0]?.body as { version: number }).version).toBe(1);
    expect((snapshotCalls[1]?.body as { version: number }).version).toBe(8);
  });

  it('创建房间时不把已结束的上一局写入快照', async () => {
    vi.useFakeTimers();
    const { calls } = installFetch(() => jsonResponse(200, { version: 1 }));
    const finished = {
      ...createGame(),
      phase: 'RESULT',
      status: 'finished',
      result: { winner: 'good', round: 1 },
    } as const;
    useGameStore.setState({ game: finished });

    await createReadyRoom();
    await vi.advanceTimersByTimeAsync(500);

    expect(calls.filter((call) => call.url.endsWith('/snapshot'))).toHaveLength(0);
  });

  it('房间不存在时停止同步并提示房间已结束', async () => {
    installFetch(() => jsonResponse(404, { error: { code: 'NOT_FOUND', message: 'gone' } }));
    await createReadyRoom();

    vi.useFakeTimers();
    useHostRoomStore.getState().scheduleSnapshot(createGame());
    await vi.advanceTimersByTimeAsync(300);

    expect(useHostRoomStore.getState().syncStatus).toBe('error');
    expect(useHostRoomStore.getState().syncError).toContain('房间已结束');
  });
});
