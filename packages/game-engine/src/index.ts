export const GAME_ENGINE_VERSION = '0.1.0' as const;

export interface Seat {
  readonly no: number;
  readonly alive: boolean;
}

export {
  isRoleId,
  ROLE_DEFINITIONS,
  type Camp,
  type NightActionKind,
  type RoleDefinition,
  type RoleId,
  type RoleKind,
} from './roles.js';

export {
  BOARD_PRE_WITCH_HUNTER_GUARD,
  BOARD_PRE_WITCH_HUNTER_IDIOT,
  BUILT_IN_BOARDS,
  getBoard,
  PLAYER_COUNT,
  validateBoard,
  WOLF_TOTAL,
  type Board,
  type BoardId,
  type BoardOptions,
  type BoardRoleSlot,
  type BoardValidationCode,
  type BoardValidationIssue,
  type BoardValidationResult,
  type LastWordsRule,
  type WinRule,
} from './boards.js';

export {
  applyAction,
  createGame,
  createSnapshot,
  getAliveSeatNos,
  getCurrentNightRole,
  getSeat,
  restoreSnapshot,
  type ApplyActionResult,
  type Ballot,
  type DealMode,
  type DeathCause,
  type GameAction,
  type GameErrorCode,
  type GameOptions,
  type GameResult,
  type GameState,
  type NightAction,
  type Phase,
  type PublicEvent,
  type PublicEventType,
  type ResumePhase,
  type SeatAssignment,
  type SeatState,
  type SheriffElectionState,
  type SheriffStage,
  type Winner,
  type WitchPotion,
} from './state-machine.js';

export {
  checkWin,
  computeNightDeaths,
  validateNightActionRules,
  type NightDeath,
  type RuleViolation,
} from './rules.js';

export {
  buildPrivateView,
  buildPublicView,
  buildViews,
  isNightActionAllowed,
  validateGameState,
  type GameStateIssue,
  type GameStateIssueCode,
  type GameStateValidationResult,
  type GameViews,
  type GuardRecord,
  type PlayerView,
  type PrivateNightAction,
  type PublicView,
  type RevealedRole,
  type SeerCheck,
  type WitchPotions,
} from './views.js';
