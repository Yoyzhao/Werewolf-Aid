import type { PlayerView } from '@lrs/game-engine';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from './App';
import { resetRoomSession } from './lib/room-api';
import { clearGameRecord } from './lib/storage';
import { useGameStore } from './stores/game-store';
import { useHostRoomStore } from './stores/host-room-store';
import {
  setPlayerSocketFactory,
  usePlayerRoomStore,
  type PlayerSocketLike,
} from './stores/player-room-store';

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

const SEER_VIEW: PlayerView = {
  phase: 'NIGHT',
  round: 1,
  status: 'active',
  alive: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  sheriffNo: null,
  events: [],
  result: null,
  mySeat: 5,
  role: 'SEER',
  checks: [{ target: 9, result: 'WOLF' }],
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
  view: PlayerView | null;
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
        return jsonResponse(403, {
          error: { code: 'FORBIDDEN', message: '无权查看该房间视图' },
        });
      }
      return jsonResponse(200, { version: 1, phase: 'NIGHT', view: state.view });
    }
    if (url === `/api/v1/rooms/${ROOM.code}/leave` && method === 'POST') {
      return jsonResponse(200, { status: 'cancelled' });
    }
    throw new Error(`unexpected fetch: ${method} ${url}`);
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}

let fakeSockets: FakeSocket[] = [];

function installSocketFactory(): void {
  fakeSockets = [];
  setPlayerSocketFactory(() => {
    const socket = new FakeSocket();
    fakeSockets.push(socket);
    return socket;
  });
}

async function resetApp(): Promise<void> {
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.history.pushState({}, '', '/');
  await clearGameRecord();
  resetRoomSession();
  usePlayerRoomStore.getState().dispose();
  setPlayerSocketFactory(null);
  usePlayerRoomStore.setState(usePlayerRoomStore.getInitialState(), true);
  useGameStore.setState(useGameStore.getInitialState(), true);
  useHostRoomStore.setState(useHostRoomStore.getInitialState(), true);
}

beforeEach(async () => {
  await resetApp();
  window.localStorage.setItem('lrs.guide.v1', '1');
  installSocketFactory();
});

afterEach(() => {
  usePlayerRoomStore.getState().dispose();
  setPlayerSocketFactory(null);
  vi.unstubAllGlobals();
});

describe('联机玩家端', () => {
  it('输入配对码进入房间；无效配对码显示错误', async () => {
    const state: MockState = { viewStatus: 403, view: null };
    installFetch(state);

    window.history.pushState({}, '', '/join');
    render(<App />);

    expect(await screen.findByRole('heading', { name: '输入配对码' })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('配对码'), '483920');
    await userEvent.click(screen.getByRole('button', { name: /进入房间/ }));

    expect(await screen.findByRole('heading', { name: /加入房间 483920/ })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/join/483920');

    window.history.pushState({}, '', '/join/12ab');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(await screen.findByRole('heading', { name: '配对码无效' })).toBeInTheDocument();
  });

  it('申请后等待确认，绑定后默认遮罩身份并只显示本人私有信息', async () => {
    const state: MockState = { viewStatus: 403, view: null };
    installFetch(state);

    window.history.pushState({}, '', `/join/${ROOM.code}`);
    render(<App />);

    expect(await screen.findByRole('heading', { name: /加入房间 483920/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '05' }));
    await userEvent.click(screen.getByRole('button', { name: /申请绑定 5 号/ }));

    expect(await screen.findByText('等待主持人确认')).toBeInTheDocument();

    state.viewStatus = 200;
    state.view = SEER_VIEW;
    expect(await screen.findByText('身份已隐藏', {}, { timeout: 4000 })).toBeInTheDocument();

    const socket = fakeSockets[0];
    expect(socket).toBeDefined();
    socket?.emit('connect');
    socket?.emit('room.view', {
      type: 'room.view',
      version: 2,
      phase: 'NIGHT',
      view: SEER_VIEW,
    });

    await userEvent.click(screen.getByRole('button', { name: /查看我的身份/ }));
    expect(await screen.findByText('预言家')).toBeInTheDocument();
    expect(screen.getByText('9 号是')).toBeInTheDocument();
    expect(screen.queryByText('狼队友')).not.toBeInTheDocument();
    expect(screen.queryByText('白痴')).not.toBeInTheDocument();
  });

  it('房间结束后显示结束原因', async () => {
    const state: MockState = { viewStatus: 200, view: SEER_VIEW };
    installFetch(state);
    window.localStorage.setItem(
      'lrs.room.player.v1',
      JSON.stringify({ code: ROOM.code, seatNo: 5, savedAt: Date.now() }),
    );

    window.history.pushState({}, '', `/join/${ROOM.code}`);
    render(<App />);

    await waitFor(() => {
      expect(fakeSockets.length).toBeGreaterThan(0);
    });
    fakeSockets[0]?.emit('connect');
    expect(await screen.findByText('身份已隐藏', {}, { timeout: 4000 })).toBeInTheDocument();

    fakeSockets[0]?.emit('room.closed', { type: 'room.closed', reason: 'settled' });
    expect(await screen.findByRole('heading', { name: '房间已结束' })).toBeInTheDocument();
    expect(screen.getByText('本局已结算，房间数据已删除')).toBeInTheDocument();
  });
});
