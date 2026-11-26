import { del, get, set } from 'idb-keyval';

import type { StoredGameRecord } from './types';

const STORAGE_KEY = 'lrs.game.current.v1';

let memoryRecord: StoredGameRecord | null = null;

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

export type LoadGameResult =
  | { readonly kind: 'none' }
  | { readonly kind: 'ok'; readonly record: StoredGameRecord }
  | { readonly kind: 'incompatible' }
  | { readonly kind: 'error' };

function isRecordLike(value: unknown): value is StoredGameRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<StoredGameRecord>;
  return (
    record.schemaVersion === 1 &&
    typeof record.status === 'string' &&
    typeof record.phase === 'string' &&
    typeof record.view === 'string' &&
    Boolean(record.state) &&
    typeof record.state === 'object'
  );
}

export async function loadGameRecord(): Promise<LoadGameResult> {
  try {
    const raw = hasIndexedDb() ? await get(STORAGE_KEY) : memoryRecord;
    if (raw === undefined || raw === null) return { kind: 'none' };
    if (!raw || typeof raw !== 'object') return { kind: 'incompatible' };
    if ((raw as { schemaVersion?: unknown }).schemaVersion !== 1) {
      return { kind: 'incompatible' };
    }
    if (!isRecordLike(raw)) return { kind: 'error' };
    return { kind: 'ok', record: raw };
  } catch {
    return { kind: 'error' };
  }
}

export async function saveGameRecord(record: StoredGameRecord): Promise<void> {
  if (hasIndexedDb()) {
    await set(STORAGE_KEY, record);
    return;
  }
  memoryRecord = record;
}

export async function clearGameRecord(): Promise<void> {
  memoryRecord = null;
  if (hasIndexedDb()) {
    await del(STORAGE_KEY);
  }
}
