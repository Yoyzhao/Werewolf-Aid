import type { PlayerView } from '@lrs/game-engine';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetRoomSession } from '../lib/room-api';
import {
  setPlayerSocketFactory,
  usePlayerRoomStore,
  type PlayerSocketLike,
} from './player-room-store';

class FakeSocket implements PlayerSocketLike {
  connected = true;

  readonly handlers = new Map<string, Array<(payload?: unknown) => void>>();

  on(event: string, handler: (payload?: unknown) => void): unknown {
    const list = this.handlers.get(event) ?? [];
    list.push(handler);
    this.handlers.set(event, list);
    return this;
  }

  emit(event: string, payload?: unknown): void {
    for (const handler of this.handlers.get(event) ?? []) handler(payload);
  }

  disconnect(): void {
    if (!this.connected) return;
    this.connected = false;
    this.emit('disconnect');
  }
}

const ROOM = {
  code: '483920',
  boardId: 'pre-witch-hunter-guard',
  phase: 'NIGHT',
  status: 'active',
  joinExpiresAt: Date.now() + 600_000,
  expiresAt: Date.now() + 86_400_000,
} as const;

const VIEW: PlayerView = {
  phase: 'NIGHT',
  round: 1,
  status: 'active',
  alive: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  sheriffNo: null,
  events: [],
  result: null,
  mySeat: 5,
  role: 'VILLAGER',
};

function jsonResponse(status: number, data: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  } as unknown as Response;
}

interface MockState {
  viewStatus: number;
  envelope: { version: number; phase: string; view: PlayerView | null };
}

function installFetch(state: MockState): ReturnType<typeof vi.fn> {
  const mock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    if (url === '/api/v1/session') {
      return jsonResponse(200, { csrfToken: 'c'.repeat(64), expiresAt: Date.now() + 60_000 });
    }
    if (url === `/api/v1/rooms/${ROOM.code}/public`) return jsonResponse(200, ROOM);
    if (url === `/api/v1/rooms/${ROOM.code}/join` && method === 'POST') {
      return jsonResponse(200, { status: 'pending', applicantId: 's_applicant' });
    }
    if (url === `/api/v1/rooms/${ROOM.code}/view`) {
      if (state.viewStatus !== 200) {
        return jsonResponse(state.viewStatus, {
          error: { code: 'FORBIDDEN', message: '无权查看该房间视图' },
        });
      }
      return jsonResponse(200, state.envelope);
    }
    if (url === `/api/v1/rooms/${ROOM.code}/leave` && method === 'POST') {
      return jsonResponse(200, { status: 'cancelled' });
    }
    throw new Error(`unexpected fetch: ${method} ${url}`);
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}

let sockets: FakeSocket[] = [];

function installSocketFactory(): void {
  sockets = [];
  setPlayerSocketFactory(() => {
    const socket = new FakeSocket();
    sockets.push(socket);
    return socket;
  });
}

async function enterBound(state: MockState): Promise<FakeSocket> {
  await usePlayerRoomStore.getState().init(ROOM.code);
  await usePlayerRoomStore.getState().applySeat(5);
  expect(usePlayerRoomStore.getState().stage).toBe('pending');

  state.viewStatus = 200;
  state.envelope = { version: 1, phase: 'NIGHT', view: VIEW };
  await vi.advanceTimersByTimeAsync(1500);

  expect(usePlayerRoomStore.getState().stage).toBe('bound');
  const socket = sockets[0];
  if (!socket) throw new Error('未创建 Socket');
  socket.emit('connect');
  await vi.advanceTimersByTimeAsync(0);
  return socket;
}

beforeEach(() => {
  vi.useFakeTimers();
  window.localStorage.clear();
  resetRoomSession();
  usePlayerRoomStore.getState().dispose();
  usePlayerRoomStore.setState(usePlayerRoomStore.getInitialState(), true);
});

afterEach(() => {
  usePlayerRoomStore.getState().dispose();
  setPlayerSocketFactory(null);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('联机玩家状态', () => {
  it('申请 → 等待确认 → 绑定 → 按版本更新视图', async () => {
    const state: MockState = {
      viewStatus: 403,
      envelope: { version: 0, phase: 'SETUP', view: null },
    };
    installFetch(state);
    installSocketFactory();

    const socket = await enterBound(state);
    expect(usePlayerRoomStore.getState().connection).toBe('online');

    socket.emit('room.view', {
      type: 'room.view',
      version: 2,
      phase: 'NIGHT',
      view: { ...VIEW, round: 2 },
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(usePlayerRoomStore.getState().version).toBe(2);
    expect(usePlayerRoomStore.getState().view?.round).toBe(2);

    socket.emit('room.view', {
      type: 'room.view',
      version: 1,
      phase: 'NIGHT',
      view: VIEW,
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(usePlayerRoomStore.getState().version).toBe(2);
    expect(usePlayerRoomStore.getState().view?.round).toBe(2);
  });

  it('连续 3 次重连失败后切换 5 秒轮询并更新版本', async () => {
    const state: MockState = {
      viewStatus: 403,
      envelope: { version: 0, phase: 'SETUP', view: null },
    };
    installFetch(state);
    installSocketFactory();

    const socket = await enterBound(state);
    socket.emit('connect_error', { data: { code: 'NETWORK' } });
    expect(usePlayerRoomStore.getState().connection).toBe('reconnecting');

    await vi.advanceTimersByTimeAsync(1000);
    sockets[1]?.emit('connect_error', { data: { code: 'NETWORK' } });
    await vi.advanceTimersByTimeAsync(2000);
    sockets[2]?.emit('connect_error', { data: { code: 'NETWORK' } });
    await vi.advanceTimersByTimeAsync(4000);
    expect(sockets).toHaveLength(4);
    sockets[3]?.emit('connect_error', { data: { code: 'NETWORK' } });
    await vi.advanceTimersByTimeAsync(0);

    expect(usePlayerRoomStore.getState().connection).toBe('polling');

    state.envelope = { version: 3, phase: 'NIGHT', view: { ...VIEW, round: 3 } };
    await vi.advanceTimersByTimeAsync(5000);
    expect(usePlayerRoomStore.getState().version).toBe(3);
    expect(usePlayerRoomStore.getState().view?.round).toBe(3);
  });

  it('被解绑后回到申请页并清除本机绑定', async () => {
    const state: MockState = {
      viewStatus: 403,
      envelope: { version: 0, phase: 'SETUP', view: null },
    };
    installFetch(state);
    installSocketFactory();

    const socket = await enterBound(state);
    socket.emit('room.error', { type: 'room.error', code: 'FORBIDDEN', message: '解绑' });
    await vi.advanceTimersByTimeAsync(0);

    const playerState = usePlayerRoomStore.getState();
    expect(playerState.stage).toBe('join');
    expect(playerState.error).toContain('解绑');
    expect(window.localStorage.getItem('lrs.room.player.v1')).toBeNull();
  });

  it('房间关闭后进入结束页', async () => {
    const state: MockState = {
      viewStatus: 403,
      envelope: { version: 0, phase: 'SETUP', view: null },
    };
    installFetch(state);
    installSocketFactory();

    const socket = await enterBound(state);
    socket.emit('room.closed', { type: 'room.closed', reason: 'settled' });
    await vi.advanceTimersByTimeAsync(0);

    const playerState = usePlayerRoomStore.getState();
    expect(playerState.stage).toBe('closed');
    expect(playerState.closedReason).toBe('settled');
    expect(playerState.connection).toBe('closed');
  });

  it('待确认时可取消申请', async () => {
    const state: MockState = {
      viewStatus: 403,
      envelope: { version: 0, phase: 'SETUP', view: null },
    };
    installFetch(state);

    await usePlayerRoomStore.getState().init(ROOM.code);
    await usePlayerRoomStore.getState().applySeat(5);
    expect(usePlayerRoomStore.getState().stage).toBe('pending');
    expect(window.localStorage.getItem('lrs.room.player.v1')).toContain('483920');

    await usePlayerRoomStore.getState().cancelApplication();
    expect(usePlayerRoomStore.getState().stage).toBe('join');
    expect(window.localStorage.getItem('lrs.room.player.v1')).toBeNull();
  });
});
