import { del, get, set } from 'idb-keyval';

import { hasIndexedDb } from './storage';

const NOTES_KEY = 'lrs.notes.v1';

export interface NotesRecord {
  readonly schemaVersion: 1;
  readonly text: string;
  readonly updatedAt: number;
}

let memoryNotes: NotesRecord | null = null;

export type LoadNotesResult =
  | { readonly kind: 'none' }
  | { readonly kind: 'ok'; readonly notes: NotesRecord }
  | { readonly kind: 'incompatible' }
  | { readonly kind: 'error' };

function isNotesLike(value: unknown): value is NotesRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<NotesRecord>;
  return (
    record.schemaVersion === 1 &&
    typeof record.text === 'string' &&
    typeof record.updatedAt === 'number'
  );
}

export async function loadNotes(): Promise<LoadNotesResult> {
  try {
    const raw = hasIndexedDb() ? await get(NOTES_KEY) : memoryNotes;
    if (raw === undefined || raw === null) return { kind: 'none' };
    if (!raw || typeof raw !== 'object') return { kind: 'incompatible' };
    if ((raw as { schemaVersion?: unknown }).schemaVersion !== 1) {
      return { kind: 'incompatible' };
    }
    if (!isNotesLike(raw)) return { kind: 'error' };
    return { kind: 'ok', notes: raw };
  } catch {
    return { kind: 'error' };
  }
}

export async function saveNotes(notes: NotesRecord): Promise<void> {
  if (hasIndexedDb()) {
    await set(NOTES_KEY, notes);
    return;
  }
  memoryNotes = notes;
}

export async function clearNotes(): Promise<void> {
  memoryNotes = null;
  if (hasIndexedDb()) {
    await del(NOTES_KEY);
  }
}
