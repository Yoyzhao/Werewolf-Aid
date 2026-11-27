import type { GameState } from '@lrs/game-engine';
import type { RoomSummary } from '@lrs/shared';
import { create } from 'zustand';

import {
  confirmSeat,
  createRoom,
  deleteRoom,
  getRoomSummary,
  recoverRoom,
  RoomApiError,
  settleRoom,
  unbindSeat,
  writeRoomSnapshot,
} from '../lib/room-api';
import {
  clearHostBinding,
  loadHostBinding,
  saveHostBinding,
  type HostRoomBinding,
} from '../lib/room-storage';
import { useGameStore } from './game-store';

export type HostRoomStatus = 'idle' | 'creating' | 'ready' | 'error';
export type HostSyncStatus = 'idle' | 'writing' | 'retry' | 'synced' | 'error';

interface SnapshotWriterDeps {
  getBinding: () => HostRoomBinding | null;
  getVersion: () => number;
  onStatus: (status: HostSyncStatus, message?: string) => void;
  onVersion: (version: number, phase: string) => void;
}

const SNAPSHOT_DEBOUNCE_MS = 300;
const INITIAL_RETRY_MS = 1000;
const MAX_RETRY_MS = 15_000;

class SnapshotWriter {
  private active = false;

  private version = 0;

  private pending: GameState | null = null;

  private inFlight = false;

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  private retryDelay = INITIAL_RETRY_MS;

  constructor(private readonly deps: SnapshotWriterDeps) {}

  start(version: number, reset = false): void {
    this.active = true;
    this.version = reset ? version : Math.max(this.version, version);
    this.retryDelay = INITIAL_RETRY_MS;
  }

  stop(): void {
    this.active = false;
    this.pending = null;
    this.clearTimers();
  }

  schedule(state: GameState): void {
    if (!this.active) return;
    this.pending = state;
    if (this.debounceTimer !== null) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      void this.flush();
    }, SNAPSHOT_DEBOUNCE_MS);
  }

  retryNow(state?: GameState): void {
    if (state !== undefined) this.pending = state;
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    void this.flush();
  }

  private clearTimers(): void {
    if (this.debounceTimer !== null) clearTimeout(this.debounceTimer);
    if (this.retryTimer !== null) clearTimeout(this.retryTimer);
    this.debounceTimer = null;
    this.retryTimer = null;
  }

  private async flush(): Promise<void> {
    if (!this.active || this.inFlight || this.pending === null) return;
    const binding = this.deps.getBinding();
    if (!binding) return;

    const state = this.pending;
    this.pending = null;
    this.inFlight = true;
    const version = Math.max(this.version, this.deps.getVersion()) + 1;
    this.deps.onStatus('writing');

    try {
      const result = await writeRoomSnapshot(binding.code, binding.hostToken, version, state);
      this.version = Math.max(this.version, result.version);
      this.deps.onVersion(result.version, state.phase);
      this.deps.onStatus('synced');
      this.retryDelay = INITIAL_RETRY_MS;
    } catch (error) {
      if (error instanceof RoomApiError && error.code === 'STALE_VERSION') {
        const details = error.details as { currentVersion?: unknown } | undefined;
        const current = details?.currentVersion;
        if (typeof current === 'number') {
          this.version = Math.max(this.version, current);
          this.pending = state;
          return;
        }
      }
      if (
        error instanceof RoomApiError &&
        (error.code === 'NOT_FOUND' || error.code === 'FORBIDDEN')
      ) {
        this.active = false;
        this.deps.onStatus(
          'error',
          error.code === 'FORBIDDEN' ? '主持令牌失效，请重建房间' : '房间已结束，联机同步停止',
        );
        return;
      }
      this.pending = state;
      this.deps.onStatus('retry', '联机同步失败，正在重试；主持流程可继续');
      if (this.retryTimer === null) {
        this.retryTimer = setTimeout(() => {
          this.retryTimer = null;
          void this.flush();
        }, this.retryDelay);
        this.retryDelay = Math.min(this.retryDelay * 2, MAX_RETRY_MS);
      }
    } finally {
      this.inFlight = false;
      if (this.active && this.pending !== null && this.retryTimer === null) {
        void this.flush();
      }
    }
  }
}

export interface HostRoomState {
  readonly initialized: boolean;
  readonly binding: HostRoomBinding | null;
  readonly summary: RoomSummary | null;
  readonly status: HostRoomStatus;
  readonly error: string | null;
  readonly refreshError: string | null;
  readonly busySeat: number | null;
  readonly syncStatus: HostSyncStatus;
  readonly syncError: string | null;
  readonly syncVersion: number;
  readonly lastSyncedAt: number | null;
}

export interface HostRoomActions {
  init: () => Promise<void>;
  create: (boardId: string) => Promise<boolean>;
  retryRecover: () => Promise<void>;
  refresh: () => Promise<void>;
  confirm: (seatNo: number, applicantId: string) => Promise<void>;
  confirmAll: () => Promise<void>;
  unbind: (seatNo: number) => Promise<void>;
  settle: (winner: 'GOOD' | 'WOLVES') => Promise<boolean>;
  dissolve: () => Promise<boolean>;
  forget: () => void;
  scheduleSnapshot: (state: GameState) => void;
  retrySnapshot: () => void;
}

export type HostRoomStore = HostRoomState & HostRoomActions;

function messageOf(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export const useHostRoomStore = create<HostRoomStore>((set, get) => {
  const writer = new SnapshotWriter({
    getBinding: () => get().binding,
    getVersion: () => get().syncVersion,
    onStatus: (status, message) =>
      set({
        syncStatus: status,
        syncError: status === 'synced' ? null : (message ?? get().syncError),
        ...(status === 'synced' ? { lastSyncedAt: Date.now() } : {}),
      }),
    onVersion: (version, phase) =>
      set((state) => ({
        syncVersion: Math.max(state.syncVersion, version),
        summary: state.summary
          ? { ...state.summary, version: Math.max(state.summary.version, version), phase }
          : state.summary,
      })),
  });

  const applyRecovered = (binding: HostRoomBinding, summary: RoomSummary): void => {
    const nextBinding: HostRoomBinding = {
      ...binding,
      roomId: summary.roomId,
      boardId: summary.boardId,
    };
    saveHostBinding(nextBinding);
    set({
      binding: nextBinding,
      summary,
      status: 'ready',
      error: null,
      refreshError: null,
      syncVersion: summary.version,
      syncStatus: 'idle',
      syncError: null,
    });
    writer.start(summary.version);
    const game = useGameStore.getState().game;
    if (game) writer.schedule(game);
  };

  const recoverSaved = async (binding: HostRoomBinding): Promise<void> => {
    try {
      const summary = await recoverRoom(binding.code, binding.hostToken);
      applyRecovered(binding, summary);
    } catch (error) {
      if (
        error instanceof RoomApiError &&
        (error.code === 'NOT_FOUND' || error.code === 'FORBIDDEN')
      ) {
        writer.stop();
        clearHostBinding();
        set({
          binding: null,
          summary: null,
          status: 'idle',
          error:
            error.code === 'NOT_FOUND' ? '房间已结束，请重新创建' : '主持令牌已失效，请重建房间',
        });
        return;
      }
      set({
        status: 'error',
        error: messageOf(error, '恢复主持失败，请检查网络后重试'),
      });
    }
  };

  return {
    initialized: false,
    binding: null,
    summary: null,
    status: 'idle',
    error: null,
    refreshError: null,
    busySeat: null,
    syncStatus: 'idle',
    syncError: null,
    syncVersion: 0,
    lastSyncedAt: null,

    init: async () => {
      if (get().initialized) return;
      set({ initialized: true });
      const binding = loadHostBinding();
      if (!binding) return;
      set({ binding });
      await recoverSaved(binding);
    },

    create: async (boardId) => {
      if (get().status === 'creating') return false;
      set({ status: 'creating', error: null, refreshError: null });
      try {
        const created = await createRoom(boardId);
        const binding: HostRoomBinding = {
          roomId: created.roomId,
          code: created.code,
          hostToken: created.hostToken,
          boardId: created.boardId,
          createdAt: Date.now(),
        };
        saveHostBinding(binding);

        let summary: RoomSummary;
        try {
          summary = await getRoomSummary(created.code, created.hostToken);
        } catch {
          summary = {
            roomId: created.roomId,
            code: created.code,
            boardId: created.boardId,
            phase: 'SETUP',
            status: 'active',
            version: 0,
            expiresAt: created.expiresAt,
            joinExpiresAt: created.joinExpiresAt,
            seats: [],
          };
        }

        set({
          binding,
          summary,
          status: 'ready',
          error: null,
          refreshError: null,
          syncVersion: summary.version,
          syncStatus: 'idle',
          syncError: null,
          lastSyncedAt: null,
        });
        writer.start(summary.version, true);
        const game = useGameStore.getState().game;
        // 新房间不继承上一局已结束的结算状态，避免玩家加入时先看到旧结果。
        if (game?.status === 'active') writer.schedule(game);
        return true;
      } catch (error) {
        set({ status: 'error', error: messageOf(error, '创建房间失败，请稍后重试') });
        return false;
      }
    },

    retryRecover: async () => {
      const binding = get().binding;
      if (!binding) return;
      set({ error: null });
      await recoverSaved(binding);
    },

    refresh: async () => {
      const binding = get().binding;
      if (!binding) return;
      try {
        const summary = await getRoomSummary(binding.code, binding.hostToken);
        set((state) => ({
          summary,
          status: 'ready',
          refreshError: null,
          syncVersion: Math.max(state.syncVersion, summary.version),
        }));
        writer.start(summary.version);
      } catch (error) {
        if (
          error instanceof RoomApiError &&
          (error.code === 'NOT_FOUND' || error.code === 'FORBIDDEN')
        ) {
          writer.stop();
          clearHostBinding();
          set({
            binding: null,
            summary: null,
            status: 'idle',
            error:
              error.code === 'NOT_FOUND' ? '房间已结束，请重新创建' : '主持令牌已失效，请重建房间',
            syncStatus: 'idle',
          });
          return;
        }
        set({ refreshError: '房间状态刷新失败，正在重试' });
      }
    },

    confirm: async (seatNo, applicantId) => {
      const binding = get().binding;
      if (!binding) return;
      set({ busySeat: seatNo });
      try {
        await confirmSeat(binding.code, binding.hostToken, seatNo, applicantId);
        await get().refresh();
      } catch (error) {
        set({ error: messageOf(error, '确认失败，请刷新后重试') });
      } finally {
        set({ busySeat: null });
      }
    },

    confirmAll: async () => {
      const binding = get().binding;
      const summary = get().summary;
      if (!binding || !summary) return;
      const pending = summary.seats.filter((seat) => seat.status === 'pending');
      if (pending.length === 0) return;
      set({ busySeat: 0 });
      try {
        for (const seat of pending) {
          await confirmSeat(binding.code, binding.hostToken, seat.seatNo, seat.applicantId);
        }
      } catch (error) {
        set({ error: messageOf(error, '批量确认失败，请刷新后重试') });
      } finally {
        await get().refresh();
        set({ busySeat: null });
      }
    },

    unbind: async (seatNo) => {
      const binding = get().binding;
      if (!binding) return;
      set({ busySeat: seatNo });
      try {
        await unbindSeat(binding.code, binding.hostToken, seatNo);
        await get().refresh();
      } catch (error) {
        set({ error: messageOf(error, '解绑失败，请刷新后重试') });
      } finally {
        set({ busySeat: null });
      }
    },

    settle: async (winner) => {
      const binding = get().binding;
      if (!binding) return false;
      writer.stop();
      try {
        await settleRoom(binding.code, binding.hostToken, winner);
        clearHostBinding();
        set({
          binding: null,
          summary: null,
          status: 'idle',
          error: null,
          refreshError: null,
          syncStatus: 'idle',
          syncError: null,
          syncVersion: 0,
          lastSyncedAt: null,
        });
        return true;
      } catch (error) {
        writer.start(get().syncVersion);
        set({ error: messageOf(error, '结算失败，请稍后重试') });
        return false;
      }
    },

    dissolve: async () => {
      const binding = get().binding;
      if (!binding) return false;
      writer.stop();
      try {
        await deleteRoom(binding.code, binding.hostToken);
        clearHostBinding();
        set({
          binding: null,
          summary: null,
          status: 'idle',
          error: null,
          refreshError: null,
          syncStatus: 'idle',
          syncError: null,
          syncVersion: 0,
          lastSyncedAt: null,
        });
        return true;
      } catch (error) {
        writer.start(get().syncVersion);
        set({ error: messageOf(error, '解散失败，请稍后重试') });
        return false;
      }
    },

    forget: () => {
      writer.stop();
      clearHostBinding();
      set({
        binding: null,
        summary: null,
        status: 'idle',
        error: null,
        refreshError: null,
        syncStatus: 'idle',
        syncError: null,
        syncVersion: 0,
        lastSyncedAt: null,
      });
    },

    scheduleSnapshot: (state) => {
      writer.schedule(state);
    },

    retrySnapshot: () => {
      writer.retryNow(useGameStore.getState().game ?? undefined);
    },
  };
});

let hostSyncCleanup: (() => void) | null = null;

/** 监听本地对局变化，将最新完整状态排入快照写入队列。 */
export function startHostSync(): () => void {
  if (hostSyncCleanup) return hostSyncCleanup;
  const unsubscribe = useGameStore.subscribe((state, previous) => {
    if (state.game === previous.game || state.game === null) return;
    const host = useHostRoomStore.getState();
    if (!host.binding || host.status !== 'ready') return;
    host.scheduleSnapshot(state.game);
  });
  hostSyncCleanup = () => {
    unsubscribe();
    hostSyncCleanup = null;
  };
  return hostSyncCleanup;
}
