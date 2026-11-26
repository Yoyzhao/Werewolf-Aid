import type { BoardId, DealMode, GameOptions, GameState, RoleId } from '@lrs/game-engine';

export type View =
  | 'home'
  | 'assistant'
  | 'rules'
  | 'setup'
  | 'deal'
  | 'night'
  | 'sheriff'
  | 'dawn'
  | 'speech'
  | 'vote'
  | 'result';

export interface AssistantPlayerRecord {
  readonly tags: readonly string[];
  readonly info: string;
  readonly speechByRound: Readonly<Record<number, string>>;
}

export interface AssistantRecord {
  readonly schemaVersion: 1;
  readonly roleId: RoleId | null;
  readonly round: number;
  readonly aliveSeats: readonly number[];
  readonly publicEvents: string;
  readonly players: Readonly<Record<number, AssistantPlayerRecord>>;
  readonly freeText: string;
  readonly updatedAt: number;
}

export interface DealDraft {
  readonly assignments: Readonly<Record<number, RoleId>>;
  readonly revealed: number;
}

export interface StoredGameRecord {
  readonly schemaVersion: 1;
  readonly status: 'active' | 'finished';
  readonly phase: GameState['phase'];
  readonly view: View;
  readonly round: number;
  readonly nightStep: number;
  readonly state: GameState;
  readonly history: readonly GameState[];
  readonly boardId: BoardId;
  readonly dealMode: DealMode;
  readonly options: GameOptions;
  readonly dealDraft: DealDraft | null;
  readonly updatedAt: number;
}
