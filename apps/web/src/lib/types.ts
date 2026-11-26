import type { BoardId, DealMode, GameOptions, GameState, RoleId } from '@lrs/game-engine';

export type View =
  'home' | 'setup' | 'deal' | 'night' | 'sheriff' | 'dawn' | 'speech' | 'vote' | 'result';

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
