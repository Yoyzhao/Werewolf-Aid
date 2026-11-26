import type { RoleId } from '@lrs/game-engine';

import type { AssistantPlayerRecord, AssistantRecord } from './types';

export const ASSISTANT_PRESET_TAGS = ['金水', '查杀', '悍跳嫌疑', '划水', '疑似狼'] as const;

export const ASSISTANT_SEAT_COUNT = 12;

export const ASSISTANT_FREE_TEXT_LIMIT = 2000;

export const ASSISTANT_CONTEXT_LIMIT = 20000;

export const ASSISTANT_MAX_ROUND = 99;

export function createEmptyPlayerRecord(): AssistantPlayerRecord {
  return { tags: [], info: '', speechByRound: {} };
}

export function createEmptyAssistantRecord(roleId: RoleId | null = null): AssistantRecord {
  return {
    schemaVersion: 1,
    roleId,
    round: 1,
    aliveSeats: Array.from({ length: ASSISTANT_SEAT_COUNT }, (_, index) => index + 1),
    publicEvents: '',
    players: {},
    freeText: '',
    updatedAt: Date.now(),
  };
}
