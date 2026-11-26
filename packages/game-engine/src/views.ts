import { BUILT_IN_BOARDS, PLAYER_COUNT, type Board, type BoardId } from './boards.js';
import { isRoleId, ROLE_DEFINITIONS, type RoleId } from './roles.js';
import type {
  GameResult,
  GameState,
  NightAction,
  Phase,
  PublicEvent,
  SeatState,
  WitchPotion,
} from './state-machine.js';

export type GameStateIssueCode =
  | 'INVALID_BOARD'
  | 'INVALID_SEATS'
  | 'INVALID_ROLES'
  | 'INVALID_STATUS'
  | 'INVALID_ACTIONS'
  | 'INVALID_EVENTS'
  | 'INVALID_RESULT';

export interface GameStateIssue {
  readonly code: GameStateIssueCode;
  readonly message: string;
}

export interface GameStateValidationResult {
  readonly valid: boolean;
  readonly issues: readonly GameStateIssue[];
}

export interface SeerCheck {
  readonly target: number;
  readonly result: 'WOLF' | 'GOOD';
}

export interface WitchPotions {
  readonly antidote: boolean;
  readonly poison: boolean;
}

export interface GuardRecord {
  readonly round: number;
  readonly target: number | null;
}

/** 本人参与的夜间动作；仅发给对应角色，用于玩家端时间线。 */
export interface PrivateNightAction {
  readonly round: number;
  readonly step: number;
  readonly roleId: RoleId;
  readonly target: number | null;
  readonly potion: WitchPotion | null;
  /** 仅预言家查验动作携带。 */
  readonly result?: 'WOLF' | 'GOOD';
}

export interface RevealedRole {
  readonly seatNo: number;
  readonly role: RoleId;
}

export interface PublicView {
  readonly phase: Phase;
  readonly round: number;
  readonly status: GameState['status'];
  readonly alive: readonly number[];
  readonly sheriffNo: number | null;
  readonly events: readonly PublicEvent[];
  readonly result: GameResult | null;
  /** 仅结算后下发，避免提前泄露身份。 */
  readonly revealedRoles?: readonly RevealedRole[];
}

export interface PlayerView extends PublicView {
  readonly mySeat: number;
  readonly role: RoleId;
  /** 仅狼人/白狼王可见。 */
  readonly teammates?: readonly number[];
  /** 仅预言家可见。 */
  readonly checks?: readonly SeerCheck[];
  /** 仅女巫可见（true 表示仍可用）。 */
  readonly potions?: WitchPotions;
  /** 仅守卫可见。 */
  readonly guarded?: readonly GuardRecord[];
  /** 本人参与的夜间动作（狼队为共同刀人）；其他角色不可见。 */
  readonly privateActions?: readonly PrivateNightAction[];
}

export interface GameViews {
  readonly publicView: PublicView;
  readonly privateViews: Record<number, PlayerView>;
}

const PHASES: readonly Phase[] = [
  'SETUP',
  'DEAL',
  'NIGHT',
  'SHERIFF',
  'DAWN',
  'SPEECH',
  'SELF_EXPLODE',
  'VOTE',
  'SETTLE',
  'CHECK_WIN',
  'RESULT',
];

const DEATH_CAUSES = new Set([
  'WOLF',
  'POISON',
  'VOTE',
  'HUNTER',
  'WOLF_KING',
  'SELF_EXPLODE',
  'SAME_GUARD_SAVE',
]);

const PUBLIC_EVENT_TYPES = new Set([
  'SELF_EXPLODE',
  'SHERIFF_ELECTED',
  'SHERIFF_NONE',
  'EXILE',
  'NO_EXILE',
  'DEATH',
  'NO_DEATH',
  'IDIOT_REVEALED',
  'HUNTER_SHOOT',
  'BADGE_TRANSFER',
  'BADGE_DESTROYED',
  'WOLF_KING_TAKE',
]);

function isSeatNo(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= PLAYER_COUNT;
}

function isWitchPotion(value: string): value is WitchPotion {
  return value === 'ANTIDOTE' || value === 'POISON';
}

function resolveBoard(boardId: BoardId): Board | undefined {
  return (BUILT_IN_BOARDS as Record<string, Board | undefined>)[boardId];
}

function seatOf(state: GameState, seatNo: number): SeatState | undefined {
  return state.seats.find((seat) => seat.no === seatNo);
}

function checkSeats(state: GameState, issues: GameStateIssue[]): void {
  if (state.seats.length !== PLAYER_COUNT) {
    issues.push({
      code: 'INVALID_SEATS',
      message: `座位数必须为 ${PLAYER_COUNT}，当前为 ${state.seats.length}`,
    });
  }

  const seen = new Set<number>();
  for (const seat of state.seats) {
    if (!isSeatNo(seat.no)) {
      issues.push({ code: 'INVALID_SEATS', message: `非法座位号：${seat.no}` });
      continue;
    }
    if (seen.has(seat.no)) {
      issues.push({ code: 'INVALID_SEATS', message: `座位号重复：${seat.no}` });
    }
    seen.add(seat.no);

    if (seat.role !== null && !isRoleId(seat.role)) {
      issues.push({ code: 'INVALID_ROLES', message: `座位 ${seat.no} 身份非法` });
    }

    if (seat.alive && (seat.deathCause !== null || seat.deathRound !== null)) {
      issues.push({
        code: 'INVALID_SEATS',
        message: `存活座位 ${seat.no} 不应带死亡信息`,
      });
    }
    if (!seat.alive) {
      if (seat.deathCause === null || !DEATH_CAUSES.has(seat.deathCause)) {
        issues.push({
          code: 'INVALID_SEATS',
          message: `出局座位 ${seat.no} 缺少合法死因`,
        });
      }
      if (seat.deathRound === null || seat.deathRound < 1) {
        issues.push({
          code: 'INVALID_SEATS',
          message: `出局座位 ${seat.no} 缺少死亡轮次`,
        });
      }
    }
  }
}

function checkComposition(state: GameState, board: Board, issues: GameStateIssue[]): void {
  if (state.phase === 'SETUP' || state.phase === 'DEAL') return;

  const expected = new Map<RoleId, number>();
  for (const slot of board.roles) expected.set(slot.roleId, slot.count);

  const actual = new Map<RoleId, number>();
  for (const seat of state.seats) {
    if (seat.role === null) {
      issues.push({
        code: 'INVALID_ROLES',
        message: `发牌后座位 ${seat.no} 身份为空`,
      });
      continue;
    }
    if (!isRoleId(seat.role)) continue;
    actual.set(seat.role, (actual.get(seat.role) ?? 0) + 1);
  }

  for (const [role, count] of expected) {
    if ((actual.get(role) ?? 0) !== count) {
      issues.push({
        code: 'INVALID_ROLES',
        message: `${role} 数量应为 ${count}，实际为 ${actual.get(role) ?? 0}`,
      });
    }
  }
  for (const [role, count] of actual) {
    if (!expected.has(role)) {
      issues.push({
        code: 'INVALID_ROLES',
        message: `板子不包含角色 ${role}（出现 ${count} 次）`,
      });
    }
  }
}

function checkNightActions(state: GameState, board: Board, issues: GameStateIssue[]): void {
  const boardRoles = new Set(board.roles.map((slot) => slot.roleId));
  for (const action of state.nightActions) {
    if (action.round < 1 || action.step < 0) {
      issues.push({ code: 'INVALID_ACTIONS', message: '夜间动作轮次/步骤非法' });
    }
    if (!isRoleId(action.roleId) || !boardRoles.has(action.roleId)) {
      issues.push({
        code: 'INVALID_ACTIONS',
        message: `夜间动作角色非法：${String(action.roleId)}`,
      });
    }
    if (action.target !== null && !isSeatNo(action.target)) {
      issues.push({
        code: 'INVALID_ACTIONS',
        message: `夜间动作目标非法：${action.target}`,
      });
    }
    if (action.potion !== null) {
      if (!isWitchPotion(action.potion)) {
        issues.push({ code: 'INVALID_ACTIONS', message: '女巫药剂类型非法' });
      }
      if (action.roleId !== 'WITCH') {
        issues.push({
          code: 'INVALID_ACTIONS',
          message: '非女巫动作不应携带药剂',
        });
      }
    }
  }
}

function checkEvents(state: GameState, issues: GameStateIssue[]): void {
  const seen = new Set<number>();
  for (const event of state.events) {
    if (!Number.isInteger(event.seq) || event.seq < 1 || seen.has(event.seq)) {
      issues.push({ code: 'INVALID_EVENTS', message: `事件序号非法：${event.seq}` });
    }
    seen.add(event.seq);
    if (!PUBLIC_EVENT_TYPES.has(event.type)) {
      issues.push({ code: 'INVALID_EVENTS', message: `事件类型非法：${String(event.type)}` });
    }
    for (const seatNo of event.seatNos) {
      if (!isSeatNo(seatNo)) {
        issues.push({ code: 'INVALID_EVENTS', message: `事件座位非法：${seatNo}` });
      }
    }
  }
}

function checkStatus(state: GameState, issues: GameStateIssue[]): void {
  const finished = state.status === 'finished';
  if (finished) {
    if (state.phase !== 'RESULT') {
      issues.push({ code: 'INVALID_STATUS', message: '已结束对局必须处于 RESULT' });
    }
    if (state.result === null) {
      issues.push({ code: 'INVALID_RESULT', message: '已结束对局缺少胜负结果' });
    }
    return;
  }

  if (state.phase === 'RESULT') {
    issues.push({ code: 'INVALID_STATUS', message: 'RESULT 阶段对局必须为 finished' });
  }
  if (state.result !== null) {
    issues.push({ code: 'INVALID_RESULT', message: '未结束对局不应带胜负结果' });
  }
}

function checkResult(state: GameState, issues: GameStateIssue[]): void {
  if (state.result === null) return;
  if (state.result.winner !== 'good' && state.result.winner !== 'wolf') {
    issues.push({ code: 'INVALID_RESULT', message: '胜负方非法' });
  }
  if (!Number.isInteger(state.result.round) || state.result.round < 1) {
    issues.push({ code: 'INVALID_RESULT', message: '结算轮次非法' });
  }
}

function checkMisc(state: GameState, issues: GameStateIssue[]): void {
  if (!PHASES.includes(state.phase)) {
    issues.push({ code: 'INVALID_STATUS', message: `阶段非法：${String(state.phase)}` });
  }
  if (!Number.isInteger(state.round) || state.round < 1) {
    issues.push({ code: 'INVALID_STATUS', message: '轮次非法' });
  }
  if (state.sheriffNo !== null && !isSeatNo(state.sheriffNo)) {
    issues.push({ code: 'INVALID_SEATS', message: `警长座位非法：${state.sheriffNo}` });
  }
  for (const death of state.lastNightDeaths) {
    if (!isSeatNo(death)) {
      issues.push({ code: 'INVALID_SEATS', message: `夜间死亡座位非法：${death}` });
    }
  }
  if (state.exiledSeat !== null && !isSeatNo(state.exiledSeat)) {
    issues.push({ code: 'INVALID_SEATS', message: `放逐座位非法：${state.exiledSeat}` });
  }
  if (state.pendingHunterNo !== null && !isSeatNo(state.pendingHunterNo)) {
    issues.push({ code: 'INVALID_SEATS', message: `待开枪猎人座位非法：${state.pendingHunterNo}` });
  }
  if (state.explodingSeat !== null && !isSeatNo(state.explodingSeat)) {
    issues.push({ code: 'INVALID_SEATS', message: `自爆座位非法：${state.explodingSeat}` });
  }
  for (const seatNo of state.pkCandidates) {
    if (!isSeatNo(seatNo)) {
      issues.push({ code: 'INVALID_SEATS', message: `PK 候选座位非法：${seatNo}` });
    }
  }
  for (const ballot of state.ballots) {
    if (!isSeatNo(ballot.voter) || (ballot.target !== null && !isSeatNo(ballot.target))) {
      issues.push({ code: 'INVALID_SEATS', message: '投票座位非法' });
    }
    if (ballot.weight !== 1 && ballot.weight !== 1.5) {
      issues.push({ code: 'INVALID_STATUS', message: '投票权重非法' });
    }
  }
}

/**
 * 校验服务端收到的完整对局状态；失败时由 API 映射为 422 INVALID_STATE。
 * 只做结构与板子一致性校验，不替代逐动作合法性校验。
 */
export function validateGameState(state: GameState): GameStateValidationResult {
  const issues: GameStateIssue[] = [];
  const board = resolveBoard(state.boardId);
  if (board === undefined) {
    issues.push({ code: 'INVALID_BOARD', message: `未知板子：${String(state.boardId)}` });
    return { valid: false, issues };
  }

  checkSeats(state, issues);
  checkComposition(state, board, issues);
  checkNightActions(state, board, issues);
  checkEvents(state, issues);
  checkStatus(state, issues);
  checkResult(state, issues);
  checkMisc(state, issues);

  return { valid: issues.length === 0, issues };
}

function buildRevealedRoles(state: GameState): readonly RevealedRole[] | undefined {
  if (state.status !== 'finished' && state.phase !== 'RESULT') return undefined;
  return state.seats
    .filter((seat) => seat.role !== null)
    .map((seat) => ({ seatNo: seat.no, role: seat.role as RoleId }))
    .sort((a, b) => a.seatNo - b.seatNo);
}

export function buildPublicView(state: GameState): PublicView {
  const revealedRoles = buildRevealedRoles(state);
  return {
    phase: state.phase,
    round: state.round,
    status: state.status,
    alive: state.seats.filter((seat) => seat.alive).map((seat) => seat.no),
    sheriffNo: state.sheriffNo,
    events: state.events,
    result: state.result,
    ...(revealedRoles === undefined ? {} : { revealedRoles }),
  };
}

function seerChecks(state: GameState, seatNo: number): SeerCheck[] {
  const checks: SeerCheck[] = [];
  for (const action of state.nightActions) {
    if (action.roleId !== 'SEER' || action.target === null) continue;
    const actor = seatOf(state, seatNo);
    if (actor === undefined || actor.role !== 'SEER') break;
    const target = seatOf(state, action.target);
    if (target === undefined || target.role === null) continue;
    checks.push({
      target: action.target,
      result: ROLE_DEFINITIONS[target.role].camp === 'wolf' ? 'WOLF' : 'GOOD',
    });
  }
  return checks;
}

function wolfTeammates(state: GameState, seatNo: number): number[] {
  return state.seats
    .filter(
      (seat) =>
        seat.no !== seatNo && seat.role !== null && ROLE_DEFINITIONS[seat.role].camp === 'wolf',
    )
    .map((seat) => seat.no)
    .sort((a, b) => a - b);
}

function witchPotions(state: GameState): WitchPotions {
  const used = (potion: WitchPotion): boolean =>
    state.nightActions.some((action) => action.potion === potion);
  return {
    antidote: !used('ANTIDOTE'),
    poison: !used('POISON'),
  };
}

function guardRecords(state: GameState): GuardRecord[] {
  return state.nightActions
    .filter((action) => action.roleId === 'GUARD')
    .map((action) => ({ round: action.round, target: action.target }));
}

function privateNightActions(state: GameState, role: RoleId): PrivateNightAction[] {
  const camp = ROLE_DEFINITIONS[role].camp;
  const actions: PrivateNightAction[] = [];

  for (const action of state.nightActions) {
    const own = camp === 'wolf' ? action.roleId === 'WOLF' : action.roleId === role;
    if (!own) continue;

    let result: 'WOLF' | 'GOOD' | undefined;
    if (role === 'SEER' && action.target !== null) {
      const target = seatOf(state, action.target);
      if (target?.role !== null && target?.role !== undefined) {
        result = ROLE_DEFINITIONS[target.role].camp === 'wolf' ? 'WOLF' : 'GOOD';
      }
    }

    actions.push({
      round: action.round,
      step: action.step,
      roleId: action.roleId,
      target: action.target,
      potion: action.potion,
      ...(result === undefined ? {} : { result }),
    });
  }

  return actions;
}

/**
 * 生成单个座位的私有视图；未发牌座位返回 null。
 * 调用方必须先通过 validateGameState，避免用非法状态生成视图。
 */
export function buildPrivateView(state: GameState, seatNo: number): PlayerView | null {
  const seat = seatOf(state, seatNo);
  if (seat === undefined || seat.role === null) return null;

  const role = seat.role;
  let view: PlayerView = {
    ...buildPublicView(state),
    mySeat: seat.no,
    role,
  };

  if (ROLE_DEFINITIONS[role].camp === 'wolf') {
    view = { ...view, teammates: wolfTeammates(state, seatNo) };
  } else if (role === 'SEER') {
    view = { ...view, checks: seerChecks(state, seatNo) };
  } else if (role === 'WITCH') {
    view = { ...view, potions: witchPotions(state) };
  } else if (role === 'GUARD') {
    view = { ...view, guarded: guardRecords(state) };
  }

  const actions = privateNightActions(state, role);
  return actions.length > 0 ? { ...view, privateActions: actions } : view;
}

/**
 * 生成公开视图与全部已发牌座位的私有视图。
 * 原始 gameState 不得通过 API 下发；玩家只能读取自己的 privateView。
 */
export function buildViews(state: GameState): GameViews {
  const privateViews: Record<number, PlayerView> = {};
  for (const seat of state.seats) {
    if (seat.role === null) continue;
    const view = buildPrivateView(state, seat.no);
    if (view !== null) privateViews[seat.no] = view;
  }
  return { publicView: buildPublicView(state), privateViews };
}

/** 供 API 判断某动作是否属于该板子，避免非法角色写入。 */
export function isNightActionAllowed(boardId: BoardId, action: NightAction): boolean {
  const board = resolveBoard(boardId);
  if (board === undefined) return false;
  return board.roles.some((slot) => slot.roleId === action.roleId);
}
