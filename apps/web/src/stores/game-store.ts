import {
  applyAction,
  createGame,
  type ApplyActionResult,
  type BoardId,
  type DealMode,
  type GameAction,
  type GameOptions,
  type GameState,
  type RoleId,
} from '@lrs/game-engine';
import { toast } from 'sonner';
import { create } from 'zustand';

import {
  assignedCount,
  assignmentsFromRecord,
  assignmentsToRecord,
  defaultOptions,
  remainingRoleCount,
  shuffleAssignments,
} from '../lib/board';
import { clearGameRecord, loadGameRecord, saveGameRecord } from '../lib/storage';
import type { DealDraft, StoredGameRecord, View } from '../lib/types';
import { releaseWakeLock } from '../lib/wake-lock';

const GUIDE_KEY = 'lrs.guide.v1';
const CAPABILITY_KEY = 'lrs.capability.dismissed.v1';
const MAX_HISTORY = 30;

const SNAPSHOT_ACTIONS: ReadonlySet<GameAction['type']> = new Set([
  'NIGHT_STEP_NEXT',
  'NIGHT_DONE',
  'SHERIFF_SIGNUP',
  'SHERIFF_SPEECH_DONE',
  'SHERIFF_WITHDRAW',
  'SHERIFF_VOTE',
  'SELF_EXPLODE',
  'WOLF_KING_TAKE',
  'EXPLODE_RESOLVED',
  'DAWN_DONE',
  'HUNTER_SHOOT',
  'BADGE_TRANSFER',
  'BADGE_DESTROY',
  'SPEECH_DONE',
  'VOTE_CLOSE',
  'SETTLE_DONE',
]);

function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeFlag(key: string): void {
  try {
    window.localStorage.setItem(key, '1');
  } catch {
    // 本地存储不可用时仅影响一次性提示，不阻塞对局。
  }
}

function viewForPhase(state: GameState): View {
  switch (state.phase) {
    case 'SETUP':
      return 'setup';
    case 'DEAL':
      return 'deal';
    case 'NIGHT':
      return 'night';
    case 'SHERIFF':
      return 'sheriff';
    case 'DAWN':
      return 'dawn';
    case 'SPEECH':
      return 'speech';
    case 'SELF_EXPLODE':
      return state.interruptedPhase === 'SHERIFF' ? 'sheriff' : 'speech';
    case 'VOTE':
    case 'SETTLE':
    case 'CHECK_WIN':
      return 'vote';
    case 'RESULT':
      return 'result';
  }
}

export interface GameStoreState {
  readonly initialized: boolean;
  readonly view: View;
  readonly boardId: BoardId;
  readonly dealMode: DealMode;
  readonly options: GameOptions;
  readonly game: GameState | null;
  readonly history: readonly GameState[];
  readonly draft: DealDraft | null;
  readonly resumeRecord: StoredGameRecord | null;
  readonly resumeIncompatible: boolean;
  readonly storageError: boolean;
  readonly guideOpen: boolean;
  readonly capabilityDismissed: boolean;
}

export interface GameStoreActions {
  init: () => Promise<void>;
  setView: (view: View) => void;
  goHome: () => void;
  goSetup: () => void;
  selectBoard: (boardId: BoardId) => void;
  selectDealMode: (mode: DealMode) => void;
  setSheriffElection: (enabled: boolean) => void;
  setWitchSelfSave: (enabled: boolean) => void;
  startDeal: () => void;
  revealNext: () => void;
  assignManualRole: (roleId: RoleId) => void;
  undoManualAssignment: () => void;
  stepBackDeal: () => void;
  finishDeal: () => void;
  exitDeal: () => void;
  dispatch: (action: GameAction) => ApplyActionResult;
  undoStep: () => void;
  playAgain: () => void;
  clearGame: () => void;
  resumeGame: () => void;
  discardResume: () => void;
  retrySave: () => void;
  dismissGuide: () => void;
  dismissCapability: () => void;
}

export type GameStore = GameStoreState & GameStoreActions;

function toRecord(state: GameStoreState): StoredGameRecord | null {
  if (!state.game) return null;
  return {
    schemaVersion: 1,
    status: state.game.status,
    phase: state.game.phase,
    view: state.view,
    round: state.game.round,
    nightStep: state.game.nightStep,
    state: state.game,
    history: state.history,
    boardId: state.boardId,
    dealMode: state.dealMode,
    options: state.options,
    dealDraft: state.draft,
    updatedAt: Date.now(),
  };
}

export const useGameStore = create<GameStore>((set, get) => {
  const persist = (): void => {
    const record = toRecord(get());
    if (!record) return;
    set({ resumeRecord: record });
    void saveGameRecord(record).catch(() => {
      set({ storageError: true });
    });
  };

  return {
    initialized: false,
    view: 'home',
    boardId: 'pre-witch-hunter-guard',
    dealMode: 'A',
    options: defaultOptions('pre-witch-hunter-guard'),
    game: null,
    history: [],
    draft: null,
    resumeRecord: null,
    resumeIncompatible: false,
    storageError: false,
    guideOpen: false,
    capabilityDismissed: false,

    init: async () => {
      if (get().initialized) return;
      set({ initialized: true, capabilityDismissed: readFlag(CAPABILITY_KEY) });
      const result = await loadGameRecord();
      if (result.kind === 'ok') {
        set({ resumeRecord: result.record });
      } else if (result.kind === 'incompatible') {
        set({ resumeIncompatible: true });
      } else if (result.kind === 'error') {
        toast.error('本地对局读取失败，可重试或重新开局');
      }
      if (!readFlag(GUIDE_KEY) && result.kind !== 'ok') {
        set({ guideOpen: true });
      }
    },

    setView: (view) => set({ view }),
    goHome: () => {
      releaseWakeLock();
      set({ view: 'home' });
    },
    goSetup: () => set({ view: 'setup' }),

    selectBoard: (boardId) => {
      set({
        boardId,
        options: defaultOptions(boardId),
      });
    },
    selectDealMode: (dealMode) => set({ dealMode }),
    setSheriffElection: (enabled) =>
      set((state) => ({ options: { ...state.options, sheriffElection: enabled } })),
    setWitchSelfSave: (enabled) =>
      set((state) => ({ options: { ...state.options, witchSelfSaveFirstNight: enabled } })),

    startDeal: () => {
      const { boardId, dealMode, options } = get();
      const created = createGame(boardId, options);
      const started = applyAction(created, {
        type: 'START_DEAL',
        boardId,
        dealMode,
        options,
      });
      if (!started.ok) {
        toast.error(started.message);
        return;
      }
      const draft: DealDraft =
        dealMode === 'C'
          ? { assignments: {}, revealed: 0 }
          : {
              assignments: assignmentsToRecord(shuffleAssignments(boardId)),
              revealed: 0,
            };
      set({
        game: started.state,
        history: [],
        draft,
        view: 'deal',
        storageError: false,
      });
      persist();
    },

    revealNext: () => {
      const { draft, dealMode, game } = get();
      if (!game || !draft || dealMode === 'C') return;
      if (draft.revealed >= 12) return;
      set({ draft: { ...draft, revealed: draft.revealed + 1 } });
      persist();
    },

    assignManualRole: (roleId) => {
      const { boardId, dealMode, draft, game } = get();
      if (!game || !draft || dealMode !== 'C') return;
      const used = assignedCount(draft.assignments);
      if (used >= 12) return;
      if (remainingRoleCount(boardId, draft.assignments, roleId) <= 0) {
        toast.error('该身份已录满');
        return;
      }
      set({
        draft: {
          ...draft,
          assignments: { ...draft.assignments, [used + 1]: roleId },
        },
      });
      persist();
    },

    undoManualAssignment: () => {
      const { dealMode, draft, game } = get();
      if (!game || !draft || dealMode !== 'C') return;
      const seatNos = Object.keys(draft.assignments)
        .map(Number)
        .sort((left, right) => left - right);
      const last = seatNos.at(-1);
      if (last === undefined) return;
      const assignments = { ...draft.assignments };
      delete assignments[last];
      set({ draft: { ...draft, assignments } });
      persist();
    },

    stepBackDeal: () => {
      const { dealMode, draft, game } = get();
      if (!game || !draft) return;
      if (dealMode === 'C') {
        get().undoManualAssignment();
        return;
      }
      if (draft.revealed <= 0) return;
      set({ draft: { ...draft, revealed: draft.revealed - 1 } });
      persist();
    },

    finishDeal: () => {
      const { draft, dealMode, game } = get();
      if (!game || !draft) return;
      if (dealMode === 'C') {
        if (assignedCount(draft.assignments) < 12) {
          toast.error('还有编号未录入，完成 12 位后才能进入天黑');
          return;
        }
      } else if (draft.revealed < 12) {
        toast.error('12 位玩家全部确认后才能进入天黑');
        return;
      }

      const assignments = assignmentsFromRecord(draft.assignments);
      const result = applyAction(game, { type: 'DEAL_DONE', assignments });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      set({
        game: result.state,
        draft: null,
        view: 'night',
        storageError: false,
      });
      releaseWakeLock();
      persist();
    },

    exitDeal: () => {
      releaseWakeLock();
      void clearGameRecord().catch(() => undefined);
      set({
        game: null,
        history: [],
        draft: null,
        view: 'setup',
        resumeRecord: null,
        resumeIncompatible: false,
        storageError: false,
      });
    },

    dispatch: (action) => {
      const { game, history } = get();
      if (!game) {
        return { ok: false, code: 'INVALID_STATE', message: '当前没有进行中的对局' };
      }

      const result = applyAction(game, action);
      if (!result.ok) {
        toast.error(result.message);
        return result;
      }

      const nextHistory = SNAPSHOT_ACTIONS.has(action.type)
        ? [...history, game].slice(-MAX_HISTORY)
        : history;

      let next = result.state;
      if (next.phase === 'SETTLE' && next.exiledSeat !== null && !next.exileResolved) {
        const resolved = applyAction(next, { type: 'RESOLVE_EXILE' });
        if (resolved.ok) next = resolved.state;
      }
      if (next.phase === 'CHECK_WIN') {
        const resolved = applyAction(next, { type: 'RESOLVE_WIN' });
        if (resolved.ok) next = resolved.state;
      }

      set({
        game: next,
        history: nextHistory,
        view: viewForPhase(next),
        storageError: false,
      });
      if (next.phase === 'RESULT') releaseWakeLock();
      persist();
      return { ok: true, state: next };
    },

    undoStep: () => {
      const { game, history } = get();
      if (!game || game.phase === 'RESULT' || history.length === 0) return;
      const previous = history[history.length - 1];
      if (!previous) return;
      set({
        game: previous,
        history: history.slice(0, -1),
        view: viewForPhase(previous),
        storageError: false,
      });
      persist();
    },

    playAgain: () => {
      releaseWakeLock();
      void clearGameRecord().catch(() => undefined);
      set({
        game: null,
        history: [],
        draft: null,
        view: 'setup',
        resumeRecord: null,
        resumeIncompatible: false,
        storageError: false,
      });
    },

    clearGame: () => {
      releaseWakeLock();
      void clearGameRecord().catch(() => undefined);
      set({
        game: null,
        history: [],
        draft: null,
        view: 'home',
        resumeRecord: null,
        resumeIncompatible: false,
        storageError: false,
      });
    },

    resumeGame: () => {
      const { resumeRecord } = get();
      if (!resumeRecord) return;
      set({
        boardId: resumeRecord.boardId,
        dealMode: resumeRecord.dealMode,
        options: resumeRecord.options,
        game: resumeRecord.state,
        history: resumeRecord.history ?? [],
        draft: resumeRecord.dealDraft,
        view: viewForPhase(resumeRecord.state),
        resumeIncompatible: false,
        storageError: false,
      });
    },

    discardResume: () => {
      void clearGameRecord().catch(() => undefined);
      set({
        resumeRecord: null,
        resumeIncompatible: false,
        game: null,
        history: [],
        draft: null,
        view: 'home',
      });
    },

    retrySave: () => {
      set({ storageError: false });
      persist();
    },

    dismissGuide: () => {
      writeFlag(GUIDE_KEY);
      set({ guideOpen: false });
    },

    dismissCapability: () => {
      writeFlag(CAPABILITY_KEY);
      set({ capabilityDismissed: true });
    },
  };
});
