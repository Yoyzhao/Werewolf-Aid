import { del, get, set } from 'idb-keyval';

import { hasIndexedDb } from './storage';
import type { AssistantRecord } from './types';

const STORAGE_KEY = 'lrs.assistant.current.v1';

let memoryRecord: AssistantRecord | null = null;

export type LoadAssistantResult =
  | { readonly kind: 'none' }
  | { readonly kind: 'ok'; readonly record: AssistantRecord }
  | { readonly kind: 'incompatible' }
  | { readonly kind: 'error' };

function isRecordLike(value: unknown): value is AssistantRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<AssistantRecord>;
  return (
    record.schemaVersion === 1 &&
    (record.roleId === null || typeof record.roleId === 'string') &&
    typeof record.round === 'number' &&
    Array.isArray(record.aliveSeats) &&
    typeof record.publicEvents === 'string' &&
    typeof record.freeText === 'string' &&
    typeof record.updatedAt === 'number' &&
    Boolean(record.players) &&
    typeof record.players === 'object'
  );
}

export async function loadAssistantRecord(): Promise<LoadAssistantResult> {
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

export async function saveAssistantRecord(record: AssistantRecord): Promise<void> {
  if (hasIndexedDb()) {
    await set(STORAGE_KEY, record);
    return;
  }
  memoryRecord = record;
}

export async function clearAssistantRecord(): Promise<void> {
  memoryRecord = null;
  if (hasIndexedDb()) {
    await del(STORAGE_KEY);
  }
}
