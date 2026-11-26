import type { RoleId } from '@lrs/game-engine';
import { create } from 'zustand';

import {
  ASSISTANT_FREE_TEXT_LIMIT,
  ASSISTANT_MAX_ROUND,
  createEmptyAssistantRecord,
  createEmptyPlayerRecord,
} from '../lib/assistant';
import {
  clearAssistantRecord,
  loadAssistantRecord,
  saveAssistantRecord,
} from '../lib/assistant-storage';
import type { AssistantPlayerRecord, AssistantRecord } from '../lib/types';

const SAVE_DEBOUNCE_MS = 300;

export interface AssistantStoreState {
  readonly initialized: boolean;
  readonly dirty: boolean;
  readonly record: AssistantRecord;
  readonly storageError: boolean;
}

export interface AssistantStoreActions {
  init: () => Promise<void>;
  setRole: (roleId: RoleId | null) => void;
  setRound: (round: number) => void;
  toggleAlive: (seatNo: number) => void;
  toggleTag: (seatNo: number, tag: string) => void;
  setInfo: (seatNo: number, value: string) => void;
  setSpeech: (seatNo: number, value: string) => void;
  setPublicEvents: (value: string) => void;
  setFreeText: (value: string) => void;
  flushSave: () => Promise<void>;
  clearRecord: () => void;
  retrySave: () => void;
}

export type AssistantStore = AssistantStoreState & AssistantStoreActions;

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function updatePlayer(
  record: AssistantRecord,
  seatNo: number,
  updater: (player: AssistantPlayerRecord) => AssistantPlayerRecord,
): AssistantRecord {
  const current = record.players[seatNo] ?? createEmptyPlayerRecord();
  return {
    ...record,
    players: { ...record.players, [seatNo]: updater(current) },
    updatedAt: Date.now(),
  };
}

export const useAssistantStore = create<AssistantStore>((set, get) => {
  const persistNow = async (): Promise<void> => {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    if (!get().dirty) return;

    const record = get().record;
    try {
      await saveAssistantRecord(record);
      if (get().record === record) set({ dirty: false });
    } catch {
      set({ storageError: true });
    }
  };

  const persistSoon = (): void => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      void persistNow();
    }, SAVE_DEBOUNCE_MS);
  };

  const commit = (record: AssistantRecord, immediate: boolean): void => {
    set({ record, dirty: true, storageError: false });
    if (immediate) {
      void persistNow();
      return;
    }
    persistSoon();
  };

  return {
    initialized: false,
    dirty: false,
    record: createEmptyAssistantRecord(),
    storageError: false,

    init: async () => {
      if (get().initialized) return;
      const result = await loadAssistantRecord();
      if (result.kind === 'ok') {
        set({ initialized: true, record: result.record, dirty: false, storageError: false });
        return;
      }
      set({
        initialized: true,
        record: createEmptyAssistantRecord(),
        dirty: false,
        storageError: result.kind === 'error',
      });
    },

    setRole: (roleId) => {
      commit({ ...get().record, roleId, updatedAt: Date.now() }, true);
    },

    setRound: (round) => {
      const normalized = Math.min(ASSISTANT_MAX_ROUND, Math.max(1, Math.trunc(round)));
      commit({ ...get().record, round: normalized, updatedAt: Date.now() }, true);
    },

    toggleAlive: (seatNo) => {
      const { record } = get();
      const alive = record.aliveSeats.includes(seatNo);
      const aliveSeats = alive
        ? record.aliveSeats.filter((seat) => seat !== seatNo)
        : [...record.aliveSeats, seatNo].sort((left, right) => left - right);
      commit({ ...record, aliveSeats, updatedAt: Date.now() }, true);
    },

    toggleTag: (seatNo, tag) => {
      const trimmed = tag.trim();
      if (!trimmed) return;
      commit(
        updatePlayer(get().record, seatNo, (player) => {
          const active = player.tags.includes(trimmed);
          return {
            ...player,
            tags: active
              ? player.tags.filter((item) => item !== trimmed)
              : [...player.tags, trimmed],
          };
        }),
        true,
      );
    },

    setInfo: (seatNo, value) => {
      commit(
        updatePlayer(get().record, seatNo, (player) => ({ ...player, info: value })),
        false,
      );
    },

    setSpeech: (seatNo, value) => {
      const { record } = get();
      commit(
        updatePlayer(record, seatNo, (player) => ({
          ...player,
          speechByRound: { ...player.speechByRound, [record.round]: value },
        })),
        false,
      );
    },

    setPublicEvents: (value) => {
      commit({ ...get().record, publicEvents: value, updatedAt: Date.now() }, false);
    },

    setFreeText: (value) => {
      commit(
        {
          ...get().record,
          freeText: value.slice(0, ASSISTANT_FREE_TEXT_LIMIT),
          updatedAt: Date.now(),
        },
        false,
      );
    },

    flushSave: async () => {
      await persistNow();
    },

    clearRecord: () => {
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }
      void clearAssistantRecord().catch(() => set({ storageError: true }));
      set({
        record: createEmptyAssistantRecord(),
        dirty: false,
        storageError: false,
      });
    },

    retrySave: () => {
      set({ storageError: false });
      void persistNow();
    },
  };
});
