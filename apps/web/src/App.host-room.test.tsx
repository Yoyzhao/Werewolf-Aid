import { createGame } from '@lrs/game-engine';
import type { RoomSummary, SeatBinding } from '@lrs/shared';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from './App';
import { resetRoomSession } from './lib/room-api';
import { clearGameRecord } from './lib/storage';
import { useGameStore } from './stores/game-store';
import { useHostRoomStore } from './stores/host-room-store';

const ROOM = {
  roomId: 'r_test',
  code: '483920',
  boardId: 'pre-witch-hunter-guard',
  phase: 'SETUP',
  status: 'active',
  expiresAt: Date.now() + 86_400_000,
  joinExpiresAt: Date.now() + 600_000,
} as const;

function jsonResponse(status: number, data: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  } as unknown as Response;
}

function noContent(): Response {
  return { ok: true, status: 204, json: async () => undefined } as unknown as Response;
}

interface MockHost {
  readonly seats: SeatBinding[];
  version: number;
}

function installFetch(host: MockHost): ReturnType<typeof vi.fn> {
  const summary = (): RoomSummary => ({ ...ROOM, version: host.version, seats: [...host.seats] });
  const mock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};

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
    if (url === '/api/v1/rooms/recover' && method === 'POST') return jsonResponse(200, summary());
    if (url === `/api/v1/rooms/${ROOM.code}` && method === 'GET') {
      return jsonResponse(200, summary());
    }
    if (url === `/api/v1/rooms/${ROOM.code}/confirm` && method === 'POST') {
      const seatNo = Number(body.seatNo);
      const seat = host.seats.find((item) => item.seatNo === seatNo);
      if (seat) {
        host.seats.splice(host.seats.indexOf(seat), 1, {
          ...seat,
          status: 'bound',
          boundAt: Date.now(),
        });
      }
      return jsonResponse(200, { status: 'bound' });
    }
    if (url === `/api/v1/rooms/${ROOM.code}/unbind` && method === 'POST') {
      const seatNo = Number(body.seatNo);
      const index = host.seats.findIndex((item) => item.seatNo === seatNo);
      if (index >= 0) host.seats.splice(index, 1);
      return jsonResponse(200, { status: 'unbound' });
    }
    if (url === `/api/v1/rooms/${ROOM.code}/snapshot` && method === 'PUT') {
      host.version += 1;
      return jsonResponse(200, { version: host.version });
    }
    if (url === `/api/v1/rooms/${ROOM.code}/settle` && method === 'POST') {
      return jsonResponse(200, { status: 'settled' });
    }
    if (url === `/api/v1/rooms/${ROOM.code}` && method === 'DELETE') return noContent();
    throw new Error(`unexpected fetch: ${method} ${url}`);
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}

async function resetApp(): Promise<void> {
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.history.pushState({}, '', '/');
  await clearGameRecord();
  resetRoomSession();
  useHostRoomStore.getState().forget();
  useHostRoomStore.setState(useHostRoomStore.getInitialState(), true);
  useGameStore.setState(useGameStore.getInitialState(), true);
}

beforeEach(async () => {
  await resetApp();
  window.localStorage.setItem('lrs.guide.v1', '1');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function openHostRoom(): Promise<void> {
  render(<App />);
  await screen.findByRole('heading', { name: '狼人杀助手' });
  await userEvent.click(screen.getByRole('button', { name: /联机主持/ }));
  expect(await screen.findByRole('heading', { name: '房间与座位' })).toBeInTheDocument();
}

describe('联机主持端', () => {
  it('创建房间 → 刷新待确认 → 确认 → 解绑', async () => {
    const host: MockHost = { seats: [], version: 0 };
    installFetch(host);
    await openHostRoom();

    await userEvent.click(screen.getByRole('button', { name: /创建房间/ }));
    expect(await screen.findByText('483920')).toBeInTheDocument();

    host.seats.push({
      seatNo: 5,
      status: 'pending',
      applicantId: 's_applicant',
      appliedAt: Date.now(),
      boundAt: null,
    });
    await userEvent.click(screen.getByRole('button', { name: /刷新/ }));
    expect(await screen.findByText('待确认')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '确认' }));
    await waitFor(() => {
      expect(screen.getByText('已绑定')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /解绑/ }));
    await waitFor(() => {
      expect(screen.queryByText('已绑定')).not.toBeInTheDocument();
    });
    expect(window.localStorage.getItem('lrs.room.host.v1')).toContain('host-token');
  });

  it('刷新后按本机令牌恢复主持房间', async () => {
    const host: MockHost = {
      seats: [
        {
          seatNo: 3,
          status: 'bound',
          applicantId: 's_bound',
          appliedAt: Date.now(),
          boundAt: Date.now(),
        },
      ],
      version: 4,
    };
    const mock = installFetch(host);
    window.localStorage.setItem(
      'lrs.room.host.v1',
      JSON.stringify({
        roomId: ROOM.roomId,
        code: ROOM.code,
        hostToken: 'host-token',
        boardId: ROOM.boardId,
        createdAt: Date.now(),
      }),
    );

    await openHostRoom();
    expect(await screen.findByText('483920')).toBeInTheDocument();
    expect(await screen.findByText('已绑定')).toBeInTheDocument();

    const recoverCall = mock.mock.calls.find(([input]) => String(input).endsWith('/recover'));
    expect(recoverCall).toBeDefined();
    const recoverBody = JSON.parse(String(recoverCall?.[1]?.body)) as {
      code: string;
      hostToken: string;
    };
    expect(recoverBody.code).toBe(ROOM.code);
    expect(recoverBody.hostToken).toBe('host-token');
  });

  it('对局状态变化后自动写入快照', async () => {
    const host: MockHost = { seats: [], version: 0 };
    const mock = installFetch(host);
    await openHostRoom();
    await userEvent.click(screen.getByRole('button', { name: /创建房间/ }));
    await screen.findByText('483920');

    act(() => {
      useGameStore.setState({ game: createGame(), view: 'night' });
    });

    await waitFor(
      () => {
        const snapshotCall = mock.mock.calls.find(([input]) => String(input).endsWith('/snapshot'));
        expect(snapshotCall).toBeDefined();
        const body = JSON.parse(String(snapshotCall?.[1]?.body)) as {
          version: number;
          phase: string;
          gameState: { boardId: string };
        };
        expect(body.version).toBe(1);
        expect(body.phase).toBe('SETUP');
        expect(body.gameState.boardId).toBe('pre-witch-hunter-guard');
      },
      { timeout: 3000 },
    );
  });
});
