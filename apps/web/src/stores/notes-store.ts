import { create } from 'zustand';

import {
  clearNotes as clearStoredNotes,
  loadNotes,
  saveNotes,
  type NotesRecord,
} from '../lib/notes-storage';

const SAVE_DEBOUNCE_MS = 500;

export type NotesSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface NotesStoreState {
  readonly initialized: boolean;
  readonly text: string;
  readonly status: NotesSaveStatus;
}

export interface NotesStoreActions {
  init: () => Promise<void>;
  setText: (value: string) => void;
  flushSave: () => Promise<void>;
  clear: () => Promise<void>;
  retrySave: () => void;
}

export type NotesStore = NotesStoreState & NotesStoreActions;

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let lastSavedText = '';

function cancelTimer(): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
}

export const useNotesStore = create<NotesStore>((set, get) => {
  const persistNow = async (): Promise<void> => {
    cancelTimer();
    const { text, status } = get();

    if (text === lastSavedText) {
      if (status === 'saving') set({ status: text ? 'saved' : 'idle' });
      return;
    }

    try {
      const record: NotesRecord = { schemaVersion: 1, text, updatedAt: Date.now() };
      await saveNotes(record);
      lastSavedText = text;
      if (get().text === text) set({ status: text ? 'saved' : 'idle' });
    } catch {
      set({ status: 'error' });
    }
  };

  const persistSoon = (): void => {
    cancelTimer();
    saveTimer = setTimeout(() => {
      saveTimer = null;
      void persistNow();
    }, SAVE_DEBOUNCE_MS);
  };

  return {
    initialized: false,
    text: '',
    status: 'idle',

    init: async () => {
      if (get().initialized) return;
      const result = await loadNotes();
      if (result.kind === 'ok') {
        lastSavedText = result.notes.text;
        set({
          initialized: true,
          text: result.notes.text,
          status: result.notes.text ? 'saved' : 'idle',
        });
        return;
      }
      lastSavedText = '';
      set({
        initialized: true,
        text: '',
        status: result.kind === 'error' ? 'error' : 'idle',
      });
    },

    setText: (value) => {
      set({ text: value, status: 'saving' });
      persistSoon();
    },

    flushSave: async () => {
      await persistNow();
    },

    clear: async () => {
      cancelTimer();
      try {
        await clearStoredNotes();
        lastSavedText = '';
        set({ text: '', status: 'idle' });
      } catch {
        set({ status: 'error' });
      }
    },

    retrySave: () => {
      set({ status: 'saving' });
      void persistNow();
    },
  };
});

/** 仅测试使用：重置模块级防抖与已保存内容。 */
export function resetNotesRuntime(): void {
  cancelTimer();
  lastSavedText = '';
}
