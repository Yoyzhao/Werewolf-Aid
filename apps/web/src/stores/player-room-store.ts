import type { PlayerView } from '@lrs/game-engine';
import type { PublicRoom } from '@lrs/shared';
import { io } from 'socket.io-client';
import { create } from 'zustand';

import { getPlayerView, getPublicRoom, joinRoom, leaveRoom, RoomApiError } from '../lib/room-api';
import { clearPlayerBinding, loadPlayerBinding, savePlayerBinding } from '../lib/room-storage';

export type PlayerStage = 'entry' | 'loading' | 'join' | 'pending' | 'bound' | 'closed' | 'error';

export type PlayerConnection =
  'connecting' | 'online' | 'reconnecting' | 'polling' | 'offline' | 'closed';

export interface PlayerSocketLike {
  on(event: string, handler: (payload?: unknown) => void): unknown;
  disconnect(): void;
  readonly connected: boolean;
}

export type PlayerSocketFactory = (code: string) => PlayerSocketLike;

const defaultSocketFactory: PlayerSocketFactory = (code) =>
  io({
    path: '/ws/rooms',
    query: { code },
    withCredentials: true,
    reconnection: false,
    transports: ['websocket', 'polling'],
  }) as unknown as PlayerSocketLike;

let socketFactory: PlayerSocketFactory = defaultSocketFactory;

/** 组件测试注入假 Socket；传 null 恢复默认。 */
export function setPlayerSocketFactory(factory: PlayerSocketFactory | null): void {
  socketFactory = factory ?? defaultSocketFactory;
}

export interface PlayerRoomState {
  readonly code: string | null;
  readonly stage: PlayerStage;
  readonly room: PublicRoom | null;
  readonly error: string | null;
  readonly seatNo: number | null;
  readonly applicantId: string | null;
  readonly applying: boolean;
  readonly view: PlayerView | null;
  readonly version: number;
  readonly connection: PlayerConnection;
  readonly reconnectAttempt: number;
  readonly identityRevealed: boolean;
  readonly lastUpdatedAt: number | null;
  readonly closedReason: string | null;
}

export interface PlayerRoomActions {
  init: (code: string | null) => Promise<void>;
  applySeat: (seatNo: number) => Promise<void>;
  cancelApplication: () => Promise<void>;
  leave: () => void;
  revealIdentity: () => void;
  maskIdentity: () => void;
  retry: () => Promise<void>;
  handleOffline: () => void;
  handleOnline: () => void;
  dispose: () => void;
}

export type PlayerRoomStore = PlayerRoomState & PlayerRoomActions;

const CONFIRM_POLL_MS = 1500;
const FALLBACK_POLL_MS = 5000;
const RECONNECT_DELAYS = [1000, 2000, 4000];

let socket: PlayerSocketLike | null = null;
let confirmTimer: ReturnType<typeof setInterval> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let generation = 0;
let pollingMode = false;

function messageOf(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function clearConfirmTimer(): void {
  if (confirmTimer !== null) clearInterval(confirmTimer);
  confirmTimer = null;
}

function clearPollTimer(): void {
  if (pollTimer !== null) clearInterval(pollTimer);
  pollTimer = null;
}

function clearReconnectTimer(): void {
  if (reconnectTimer !== null) clearTimeout(reconnectTimer);
  reconnectTimer = null;
}

function stopRuntime(): void {
  generation += 1;
  clearConfirmTimer();
  clearPollTimer();
  clearReconnectTimer();
  const current = socket;
  socket = null;
  pollingMode = false;
  current?.disconnect();
}

function parseRoomView(payload: unknown): { version: number; view: PlayerView } | null {
  if (!payload || typeof payload !== 'object') return null;
  const value = payload as { version?: unknown; view?: unknown };
  if (typeof value.version !== 'number' || !value.view || typeof value.view !== 'object') {
    return null;
  }
  return { version: value.version, view: value.view as PlayerView };
}

function parseClosedReason(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return 'closed';
  const reason = (payload as { reason?: unknown }).reason;
  return typeof reason === 'string' ? reason : 'closed';
}

function parseErrorCode(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const code = (payload as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

function parseConnectErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const data = (error as { data?: { code?: unknown } }).data;
  return typeof data?.code === 'string' ? data.code : undefined;
}

const EMPTY_STATE: PlayerRoomState = {
  code: null,
  stage: 'entry',
  room: null,
  error: null,
  seatNo: null,
  applicantId: null,
  applying: false,
  view: null,
  version: 0,
  connection: 'connecting',
  reconnectAttempt: 0,
  identityRevealed: false,
  lastUpdatedAt: null,
  closedReason: null,
};

export const usePlayerRoomStore = create<PlayerRoomStore>((set, get) => {
  const applyEnvelope = (version: number, view: PlayerView | null): void => {
    set((state) =>
      version >= state.version ? { view, version, lastUpdatedAt: Date.now() } : state,
    );
  };

  const markUnbound = (): void => {
    stopRuntime();
    clearPlayerBinding();
    set({
      stage: 'join',
      seatNo: null,
      applicantId: null,
      view: null,
      version: 0,
      connection: 'closed',
      error: '你已被主持人解绑，可重新申请',
      identityRevealed: false,
    });
  };

  const markClosed = (reason: string): void => {
    stopRuntime();
    set({ stage: 'closed', connection: 'closed', closedReason: reason });
  };

  const syncView = async (gen: number): Promise<void> => {
    const code = get().code;
    if (!code) return;
    try {
      const envelope = await getPlayerView(code);
      if (gen !== generation) return;
      applyEnvelope(envelope.version, envelope.view);
    } catch (error) {
      if (gen !== generation) return;
      if (error instanceof RoomApiError && error.code === 'NOT_FOUND') {
        markClosed('expired');
      } else if (error instanceof RoomApiError && error.code === 'FORBIDDEN') {
        markUnbound();
      }
    }
  };

  const startPolling = (gen: number): void => {
    if (gen !== generation) return;
    pollingMode = true;
    clearPollTimer();
    clearReconnectTimer();
    set({ connection: 'polling' });

    const poll = async (): Promise<void> => {
      if (gen !== generation) return;
      const code = get().code;
      if (!code) return;
      try {
        const envelope = await getPlayerView(code);
        if (gen !== generation) return;
        applyEnvelope(envelope.version, envelope.view);
        set({ connection: 'polling' });
      } catch (error) {
        if (gen !== generation) return;
        if (error instanceof RoomApiError && error.code === 'NOT_FOUND') {
          markClosed('expired');
        } else if (error instanceof RoomApiError && error.code === 'FORBIDDEN') {
          markUnbound();
        }
      }
    };

    void poll();
    pollTimer = setInterval(() => void poll(), FALLBACK_POLL_MS);
  };

  const scheduleReconnect = (gen: number): void => {
    if (gen !== generation || get().stage !== 'bound') return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      set({ connection: 'offline' });
      return;
    }
    const attempt = get().reconnectAttempt + 1;
    if (attempt > 3) {
      startPolling(gen);
      return;
    }
    const delay = RECONNECT_DELAYS[attempt - 1] ?? 4000;
    set({ connection: 'reconnecting', reconnectAttempt: attempt });
    clearReconnectTimer();
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      if (gen === generation) connect(gen);
    }, delay);
  };

  function connect(gen: number): void {
    if (gen !== generation) return;
    const code = get().code;
    if (!code) return;

    const previous = socket;
    socket = null;
    previous?.disconnect();
    pollingMode = false;
    clearPollTimer();
    set({
      connection: get().reconnectAttempt > 0 ? 'reconnecting' : 'connecting',
    });

    const current = socketFactory(code);
    socket = current;

    current.on('connect', () => {
      if (gen !== generation || socket !== current) return;
      clearReconnectTimer();
      clearPollTimer();
      pollingMode = false;
      set({ connection: 'online', reconnectAttempt: 0 });
      void syncView(gen);
    });

    current.on('room.view', (payload) => {
      if (gen !== generation || socket !== current) return;
      const event = parseRoomView(payload);
      if (!event) return;
      applyEnvelope(event.version, event.view);
      set({ connection: 'online', reconnectAttempt: 0, lastUpdatedAt: Date.now() });
    });

    current.on('room.closed', (payload) => {
      if (gen !== generation || socket !== current) return;
      markClosed(parseClosedReason(payload));
    });

    current.on('room.error', (payload) => {
      if (gen !== generation || socket !== current) return;
      if (parseErrorCode(payload) === 'FORBIDDEN') markUnbound();
    });

    current.on('disconnect', () => {
      if (gen !== generation || socket !== current) return;
      scheduleReconnect(gen);
    });

    current.on('connect_error', (error) => {
      if (gen !== generation || socket !== current) return;
      const code = parseConnectErrorCode(error);
      if (code === 'FORBIDDEN') {
        markUnbound();
        return;
      }
      if (code === 'NOT_FOUND') {
        markClosed('expired');
        return;
      }
      scheduleReconnect(gen);
    });
  }

  const startConfirmPolling = (gen: number): void => {
    clearConfirmTimer();

    const check = async (): Promise<void> => {
      if (gen !== generation) return;
      const code = get().code;
      if (!code) return;
      try {
        const envelope = await getPlayerView(code);
        if (gen !== generation) return;
        clearConfirmTimer();
        const seatNo = get().seatNo;
        if (seatNo !== null) {
          savePlayerBinding({ code, seatNo, savedAt: Date.now() });
        }
        set({
          stage: 'bound',
          connection: 'connecting',
          view: envelope.view,
          version: envelope.version,
          lastUpdatedAt: Date.now(),
          error: null,
        });
        connect(gen);
      } catch (error) {
        if (gen !== generation) return;
        if (error instanceof RoomApiError && error.code === 'NOT_FOUND') {
          markClosed('expired');
        }
      }
    };

    void check();
    confirmTimer = setInterval(() => void check(), CONFIRM_POLL_MS);
  };

  return {
    ...EMPTY_STATE,

    init: async (code) => {
      stopRuntime();
      const gen = generation;

      if (!code) {
        set({ ...EMPTY_STATE });
        return;
      }

      set({ ...EMPTY_STATE, code, stage: 'loading' });

      try {
        const room = await getPublicRoom(code);
        if (gen !== generation) return;
        set({ room });

        const binding = loadPlayerBinding();
        if (binding !== null && binding.code === code) {
          set({ seatNo: binding.seatNo });
          try {
            const envelope = await getPlayerView(code);
            if (gen !== generation) return;
            set({
              stage: 'bound',
              connection: 'connecting',
              view: envelope.view,
              version: envelope.version,
              lastUpdatedAt: Date.now(),
            });
            connect(gen);
            return;
          } catch (error) {
            if (gen !== generation) return;
            if (error instanceof RoomApiError && error.code === 'NOT_FOUND') {
              markClosed('expired');
              return;
            }
            if (error instanceof RoomApiError && error.code === 'FORBIDDEN') {
              set({
                stage: 'pending',
                error: '等待主持人确认；若已被解绑，请取消后重新申请',
              });
              startConfirmPolling(gen);
              return;
            }
            set({
              stage: 'error',
              error: messageOf(error, '网络不可用，请检查网络后重试'),
            });
            return;
          }
        }

        set({ stage: 'join' });
      } catch (error) {
        if (gen !== generation) return;
        if (error instanceof RoomApiError && error.code === 'NOT_FOUND') {
          set({ stage: 'error', error: '配对码不存在或已过期' });
        } else {
          set({
            stage: 'error',
            error: messageOf(error, '网络不可用，请检查网络后重试'),
          });
        }
      }
    },

    applySeat: async (seatNo) => {
      if (get().applying) return;
      const code = get().code;
      if (!code) return;
      const gen = generation;
      set({ applying: true, seatNo, error: null });
      try {
        const result = await joinRoom(code, seatNo);
        if (gen !== generation) return;
        savePlayerBinding({ code, seatNo, savedAt: Date.now() });
        set({ applying: false, applicantId: result.applicantId });
        if (result.status === 'bound') {
          set({ stage: 'bound', connection: 'connecting' });
          connect(gen);
        } else {
          set({ stage: 'pending' });
          startConfirmPolling(gen);
        }
      } catch (error) {
        if (gen !== generation) return;
        set({
          applying: false,
          error: messageOf(error, '申请失败，请稍后重试'),
        });
      }
    },

    cancelApplication: async () => {
      const code = get().code;
      if (!code) return;
      const gen = generation;
      try {
        await leaveRoom(code);
        if (gen !== generation) return;
        clearConfirmTimer();
        clearPlayerBinding();
        set({
          stage: 'join',
          seatNo: null,
          applicantId: null,
          error: null,
        });
      } catch (error) {
        set({ error: messageOf(error, '取消失败，请稍后重试') });
      }
    },

    leave: () => {
      stopRuntime();
      clearPlayerBinding();
      set({ ...EMPTY_STATE });
    },

    revealIdentity: () => set({ identityRevealed: true }),
    maskIdentity: () => set({ identityRevealed: false }),

    retry: async () => {
      const code = get().code;
      await get().init(code);
    },

    handleOffline: () => {
      if (get().stage !== 'bound') return;
      clearPollTimer();
      clearReconnectTimer();
      set({ connection: 'offline' });
    },

    handleOnline: () => {
      if (get().stage !== 'bound') return;
      const gen = generation;
      if (pollingMode) {
        startPolling(gen);
        return;
      }
      set({ connection: 'reconnecting', reconnectAttempt: 0 });
      void syncView(gen).then(() => {
        if (gen === generation) connect(gen);
      });
    },

    dispose: () => {
      stopRuntime();
    },
  };
});
