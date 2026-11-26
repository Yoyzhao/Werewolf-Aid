import { BUILT_IN_BOARDS, getBoard, PLAYER_COUNT, type BoardId } from './boards.js';
import { isRoleId, ROLE_DEFINITIONS, type RoleId } from './roles.js';
import { checkWin, computeNightDeaths, validateNightActionRules } from './rules.js';

export type Phase =
  | 'SETUP'
  | 'DEAL'
  | 'NIGHT'
  | 'SHERIFF'
  | 'DAWN'
  | 'SPEECH'
  | 'SELF_EXPLODE'
  | 'VOTE'
  | 'SETTLE'
  | 'CHECK_WIN'
  | 'RESULT';

export type ResumePhase = 'SHERIFF' | 'DAWN' | 'SPEECH' | 'NIGHT';

export type DealMode = 'A' | 'B' | 'C';

export type Winner = 'good' | 'wolf';

export type DeathCause =
  'WOLF' | 'POISON' | 'VOTE' | 'HUNTER' | 'WOLF_KING' | 'SELF_EXPLODE' | 'SAME_GUARD_SAVE';

export type WitchPotion = 'ANTIDOTE' | 'POISON';

export interface GameOptions {
  readonly sheriffElection: boolean;
  readonly witchSelfSaveFirstNight: boolean;
}

export interface SeatState {
  readonly no: number;
  readonly role: RoleId | null;
  readonly alive: boolean;
  readonly idiotRevealed: boolean;
  readonly deathCause: DeathCause | null;
  readonly deathRound: number | null;
}

export interface Ballot {
  readonly voter: number;
  readonly target: number | null;
  readonly weight: number;
}

export type SheriffStage = 'signup' | 'speech' | 'withdraw' | 'vote' | 'pk' | 'done';

export interface SheriffElectionState {
  readonly stage: SheriffStage;
  readonly candidates: readonly number[];
  readonly withdrawn: readonly number[];
  readonly ballots: readonly Ballot[];
  readonly pkCandidates: readonly number[];
  readonly elected: number | null;
}

export interface NightAction {
  readonly round: number;
  readonly step: number;
  readonly roleId: RoleId;
  readonly target: number | null;
  readonly potion: WitchPotion | null;
}

export type PublicEventType =
  | 'SELF_EXPLODE'
  | 'SHERIFF_ELECTED'
  | 'SHERIFF_NONE'
  | 'EXILE'
  | 'NO_EXILE'
  | 'DEATH'
  | 'NO_DEATH'
  | 'IDIOT_REVEALED'
  | 'HUNTER_SHOOT'
  | 'BADGE_TRANSFER'
  | 'BADGE_DESTROYED'
  | 'WOLF_KING_TAKE';

export interface PublicEvent {
  readonly seq: number;
  readonly round: number;
  readonly phase: Phase;
  readonly type: PublicEventType;
  readonly seatNos: readonly number[];
  readonly cause?: DeathCause;
}

export interface GameResult {
  readonly winner: Winner;
  readonly round: number;
}

export interface GameState {
  readonly schemaVersion: 1;
  readonly boardId: BoardId;
  readonly phase: Phase;
  readonly status: 'active' | 'finished';
  readonly round: number;
  readonly nightStep: number;
  readonly dealMode: DealMode;
  readonly options: GameOptions;
  readonly seats: readonly SeatState[];
  readonly sheriffNo: number | null;
  readonly sheriffElection: SheriffElectionState | null;
  readonly nightActions: readonly NightAction[];
  readonly ballots: readonly Ballot[];
  readonly pkCandidates: readonly number[];
  readonly voteRound: 1 | 2;
  readonly exiledSeat: number | null;
  readonly exileResolved: boolean;
  readonly explodingSeat: number | null;
  readonly interruptedPhase: 'SHERIFF' | 'SPEECH' | null;
  readonly pendingHunterNo: number | null;
  readonly pendingBadge: boolean;
  readonly pendingWolfKingTake: boolean;
  readonly lastNightDeaths: readonly number[];
  readonly resumeTo: ResumePhase | null;
  readonly events: readonly PublicEvent[];
  readonly result: GameResult | null;
}

export interface SeatAssignment {
  readonly seatNo: number;
  readonly roleId: RoleId;
}

export type GameAction =
  | {
      readonly type: 'START_DEAL';
      readonly boardId: BoardId;
      readonly dealMode: DealMode;
      readonly options?: Partial<GameOptions>;
    }
  | { readonly type: 'DEAL_DONE'; readonly assignments: readonly SeatAssignment[] }
  | {
      readonly type: 'NIGHT_ACTION';
      readonly roleId: RoleId;
      readonly target: number | null;
      readonly potion?: WitchPotion;
    }
  | { readonly type: 'NIGHT_STEP_NEXT' }
  | { readonly type: 'NIGHT_DONE' }
  | { readonly type: 'SHERIFF_SIGNUP'; readonly candidates: readonly number[] }
  | { readonly type: 'SHERIFF_SPEECH_DONE' }
  | { readonly type: 'SHERIFF_WITHDRAW'; readonly withdrawn: readonly number[] }
  | { readonly type: 'SHERIFF_VOTE'; readonly ballots: readonly Ballot[] }
  | { readonly type: 'SHERIFF_DONE' }
  | { readonly type: 'SELF_EXPLODE'; readonly seatNo: number }
  | { readonly type: 'WOLF_KING_TAKE'; readonly target: number | null }
  | { readonly type: 'EXPLODE_RESOLVED' }
  | { readonly type: 'DAWN_DONE' }
  | { readonly type: 'HUNTER_SHOOT'; readonly target: number | null }
  | { readonly type: 'BADGE_TRANSFER'; readonly target: number }
  | { readonly type: 'BADGE_DESTROY' }
  | { readonly type: 'SPEECH_DONE' }
  | { readonly type: 'RECORD_BALLOT'; readonly voter: number; readonly target: number | null }
  | { readonly type: 'VOTE_CLOSE' }
  | { readonly type: 'RESOLVE_EXILE' }
  | { readonly type: 'SETTLE_DONE' }
  | { readonly type: 'RESOLVE_WIN' };

export type GameErrorCode =
  | 'INVALID_STATE'
  | 'INVALID_ACTION'
  | 'INVALID_SEAT'
  | 'INVALID_ROLE'
  | 'INVALID_ASSIGNMENT'
  | 'INVALID_TARGET'
  | 'INVALID_VOTER'
  | 'INVALID_BALLOT'
  | 'NOT_ALLOWED';

export type ApplyActionResult =
  | { readonly ok: true; readonly state: GameState }
  | { readonly ok: false; readonly code: GameErrorCode; readonly message: string };

const DEFAULT_BOARD_ID: BoardId = 'pre-witch-hunter-guard';

function fail(code: GameErrorCode, message: string): ApplyActionResult {
  return { ok: false, code, message };
}

function isSeatNo(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= PLAYER_COUNT;
}

function createSeats(): SeatState[] {
  return Array.from({ length: PLAYER_COUNT }, (_, index) => ({
    no: index + 1,
    role: null,
    alive: true,
    idiotRevealed: false,
    deathCause: null,
    deathRound: null,
  }));
}

function emptySheriffElection(): SheriffElectionState {
  return {
    stage: 'signup',
    candidates: [],
    withdrawn: [],
    ballots: [],
    pkCandidates: [],
    elected: null,
  };
}

function boardOptions(boardId: BoardId): GameOptions {
  const board = getBoard(boardId);
  return {
    sheriffElection: board.options.sheriffElection,
    witchSelfSaveFirstNight: board.options.witchSelfSaveFirstNight,
  };
}

function emptyState(boardId: BoardId, options: GameOptions): GameState {
  return {
    schemaVersion: 1,
    boardId,
    phase: 'SETUP',
    status: 'active',
    round: 1,
    nightStep: 0,
    dealMode: 'A',
    options,
    seats: createSeats(),
    sheriffNo: null,
    sheriffElection: null,
    nightActions: [],
    ballots: [],
    pkCandidates: [],
    voteRound: 1,
    exiledSeat: null,
    exileResolved: false,
    explodingSeat: null,
    interruptedPhase: null,
    pendingHunterNo: null,
    pendingBadge: false,
    pendingWolfKingTake: false,
    lastNightDeaths: [],
    resumeTo: null,
    events: [],
    result: null,
  };
}

export function createGame(
  boardId: BoardId = DEFAULT_BOARD_ID,
  options?: Partial<GameOptions>,
): GameState {
  return {
    ...emptyState(boardId, { ...boardOptions(boardId), ...options }),
    phase: 'SETUP',
  };
}

export function getSeat(state: GameState, seatNo: number): SeatState | undefined {
  return state.seats.find((seat) => seat.no === seatNo);
}

export function getAliveSeatNos(state: GameState): number[] {
  return state.seats.filter((seat) => seat.alive).map((seat) => seat.no);
}

export function getCurrentNightRole(state: GameState): RoleId | null {
  if (state.phase !== 'NIGHT') return null;
  return getBoard(state.boardId).nightOrder[state.nightStep] ?? null;
}

function updateSeat(
  seats: readonly SeatState[],
  seatNo: number,
  patch: Partial<SeatState>,
): SeatState[] {
  return seats.map((seat) => (seat.no === seatNo ? { ...seat, ...patch } : seat));
}

function appendEvent(
  state: GameState,
  type: PublicEventType,
  seatNos: readonly number[],
  phase: Phase,
  cause?: DeathCause,
): readonly PublicEvent[] {
  return [
    ...state.events,
    {
      seq: state.events.length + 1,
      round: state.round,
      phase,
      type,
      seatNos,
      ...(cause ? { cause } : {}),
    },
  ];
}

function killSeat(
  seats: readonly SeatState[],
  seatNo: number,
  cause: DeathCause,
  round: number,
): SeatState[] {
  return updateSeat(seats, seatNo, {
    alive: false,
    deathCause: cause,
    deathRound: round,
  });
}

function hasNightAction(state: GameState, step: number): boolean {
  return state.nightActions.some((action) => action.round === state.round && action.step === step);
}

function currentNightAction(state: GameState): NightAction | undefined {
  return state.nightActions.find(
    (action) => action.round === state.round && action.step === state.nightStep,
  );
}

function startDeal(
  state: GameState,
  action: Extract<GameAction, { type: 'START_DEAL' }>,
): ApplyActionResult {
  if (state.phase !== 'SETUP') {
    return fail('INVALID_STATE', '只有 SETUP 阶段可以开始发牌');
  }
  if (!Object.hasOwn(BUILT_IN_BOARDS, action.boardId)) {
    return fail('INVALID_ACTION', `未知板子 ${String(action.boardId)}`);
  }
  if (!['A', 'B', 'C'].includes(action.dealMode)) {
    return fail('INVALID_ACTION', `未知发牌模式 ${String(action.dealMode)}`);
  }

  const boardId = action.boardId;
  const options = { ...boardOptions(boardId), ...action.options };
  return {
    ok: true,
    state: {
      ...emptyState(boardId, options),
      phase: 'DEAL',
      dealMode: action.dealMode,
    },
  };
}

function dealDone(
  state: GameState,
  action: Extract<GameAction, { type: 'DEAL_DONE' }>,
): ApplyActionResult {
  if (state.phase !== 'DEAL') {
    return fail('INVALID_STATE', '只有 DEAL 阶段可以完成发牌');
  }

  const assignments = action.assignments;
  if (assignments.length !== PLAYER_COUNT) {
    return fail('INVALID_ASSIGNMENT', `发牌必须覆盖 ${PLAYER_COUNT} 个座位`);
  }

  const assigned = new Map<number, RoleId>();
  for (const item of assignments) {
    if (!isSeatNo(item.seatNo)) {
      return fail('INVALID_SEAT', `非法座位号 ${item.seatNo}`);
    }
    if (assigned.has(item.seatNo)) {
      return fail('INVALID_ASSIGNMENT', `座位 ${item.seatNo} 重复分配`);
    }
    if (!isRoleId(item.roleId)) {
      return fail('INVALID_ROLE', `未知角色 ${String(item.roleId)}`);
    }
    assigned.set(item.seatNo, item.roleId);
  }

  const expected = new Map<RoleId, number>();
  for (const slot of getBoard(state.boardId).roles) {
    expected.set(slot.roleId, slot.count);
  }
  const actual = new Map<RoleId, number>();
  for (const roleId of assigned.values()) {
    actual.set(roleId, (actual.get(roleId) ?? 0) + 1);
  }
  for (const [roleId, count] of expected) {
    if ((actual.get(roleId) ?? 0) !== count) {
      return fail('INVALID_ASSIGNMENT', `角色 ${roleId} 数量与板子构成不一致`);
    }
  }
  for (const roleId of actual.keys()) {
    if (!expected.has(roleId)) {
      return fail('INVALID_ASSIGNMENT', `角色 ${roleId} 不在板子构成中`);
    }
  }

  const seats = state.seats.map((seat) => ({
    ...seat,
    role: assigned.get(seat.no) ?? null,
  }));

  return {
    ok: true,
    state: {
      ...state,
      seats,
      phase: 'NIGHT',
      round: 1,
      nightStep: 0,
    },
  };
}

function nightAction(
  state: GameState,
  action: Extract<GameAction, { type: 'NIGHT_ACTION' }>,
): ApplyActionResult {
  if (state.phase !== 'NIGHT') {
    return fail('INVALID_STATE', '只有 NIGHT 阶段可以录入夜间动作');
  }

  const board = getBoard(state.boardId);
  const currentRole = board.nightOrder[state.nightStep];
  if (!currentRole) {
    return fail('INVALID_STATE', '当前没有待执行的夜间步骤');
  }
  if (action.roleId !== currentRole) {
    return fail('INVALID_ROLE', `当前步骤应记录 ${currentRole} 的动作`);
  }

  if (action.target !== null) {
    if (!isSeatNo(action.target)) {
      return fail('INVALID_TARGET', `非法目标座位 ${action.target}`);
    }
    const targetSeat = getSeat(state, action.target);
    if (!targetSeat?.alive) {
      return fail('INVALID_TARGET', `目标座位 ${action.target} 不在场`);
    }
  }

  if (action.roleId === 'SEER' && action.target === null) {
    return fail('INVALID_TARGET', '预言家必须选择查验目标');
  }

  let potion: WitchPotion | null = null;
  if (action.roleId === 'WITCH') {
    if (action.potion && action.target === null) {
      return fail('INVALID_TARGET', '使用药剂时必须选择目标');
    }
    if (!action.potion && action.target !== null) {
      return fail('INVALID_ACTION', '女巫未使用药剂时不应选择目标');
    }
    potion = action.potion ?? null;
  } else if (action.potion) {
    return fail('INVALID_ACTION', '只有女巫可以使用药剂');
  }

  if (action.target === null && !['GUARD', 'WOLF', 'WITCH'].includes(action.roleId)) {
    return fail('INVALID_TARGET', `${action.roleId} 必须选择目标`);
  }

  const violation = validateNightActionRules(state, {
    roleId: action.roleId,
    target: action.target,
    potion: action.potion,
  });
  if (violation) {
    return fail(violation.code, violation.message);
  }

  const record: NightAction = {
    round: state.round,
    step: state.nightStep,
    roleId: action.roleId,
    target: action.target,
    potion,
  };
  const nightActions = [
    ...state.nightActions.filter(
      (item) => !(item.round === state.round && item.step === state.nightStep),
    ),
    record,
  ];

  return { ok: true, state: { ...state, nightActions } };
}

function nightStepNext(state: GameState): ApplyActionResult {
  if (state.phase !== 'NIGHT') {
    return fail('INVALID_STATE', '只有 NIGHT 阶段可以推进夜间步骤');
  }
  const board = getBoard(state.boardId);
  if (!currentNightAction(state)) {
    return fail('NOT_ALLOWED', '当前夜间步骤尚未记录动作');
  }
  if (state.nightStep + 1 >= board.nightOrder.length) {
    return fail('INVALID_ACTION', '已是最后一个夜间步骤，请使用 NIGHT_DONE');
  }
  return { ok: true, state: { ...state, nightStep: state.nightStep + 1 } };
}

function nightDone(state: GameState): ApplyActionResult {
  if (state.phase !== 'NIGHT') {
    return fail('INVALID_STATE', '只有 NIGHT 阶段可以结束夜晚');
  }
  const board = getBoard(state.boardId);
  for (let step = 0; step < board.nightOrder.length; step += 1) {
    if (!hasNightAction(state, step)) {
      return fail('NOT_ALLOWED', '还有夜间步骤未记录动作');
    }
  }

  const resumeTo: ResumePhase =
    state.round === 1 && state.options.sheriffElection ? 'SHERIFF' : 'DAWN';

  const deaths = computeNightDeaths(state);
  let seats = state.seats;
  let events = [...state.events];
  const pushNightEvent = (
    type: PublicEventType,
    seatNos: readonly number[],
    cause?: DeathCause,
  ): void => {
    events = [
      ...events,
      {
        seq: events.length + 1,
        round: state.round,
        phase: 'NIGHT',
        type,
        seatNos,
        ...(cause ? { cause } : {}),
      },
    ];
  };

  if (deaths.length === 0) {
    pushNightEvent('NO_DEATH', []);
  }
  for (const death of deaths) {
    seats = killSeat(seats, death.seatNo, death.cause, state.round);
    pushNightEvent('DEATH', [death.seatNo], death.cause);
  }

  const pendingHunterNo =
    deaths.find(
      (death) => death.cause === 'WOLF' && getSeat(state, death.seatNo)?.role === 'HUNTER',
    )?.seatNo ?? null;

  return {
    ok: true,
    state: {
      ...state,
      seats,
      events,
      phase: 'CHECK_WIN',
      resumeTo,
      pendingHunterNo,
      pendingBadge: deaths.some((death) => death.seatNo === state.sheriffNo),
      lastNightDeaths: deaths.map((death) => death.seatNo),
      sheriffElection: state.options.sheriffElection ? emptySheriffElection() : null,
    },
  };
}

function sheriffSignup(
  state: GameState,
  action: Extract<GameAction, { type: 'SHERIFF_SIGNUP' }>,
): ApplyActionResult {
  if (state.phase !== 'SHERIFF' || state.sheriffElection?.stage !== 'signup') {
    return fail('INVALID_STATE', '当前不在竞选报名阶段');
  }

  const candidates: number[] = [];
  for (const seatNo of action.candidates) {
    if (!isSeatNo(seatNo)) {
      return fail('INVALID_SEAT', `非法座位号 ${seatNo}`);
    }
    if (candidates.includes(seatNo)) {
      return fail('INVALID_ACTION', `座位 ${seatNo} 重复上警`);
    }
    if (!getSeat(state, seatNo)?.alive) {
      return fail('INVALID_SEAT', `座位 ${seatNo} 不在场，不能上警`);
    }
    candidates.push(seatNo);
  }

  const stage: SheriffStage = candidates.length === 0 ? 'done' : 'speech';
  return {
    ok: true,
    state: {
      ...state,
      sheriffElection: { ...state.sheriffElection, candidates, stage },
    },
  };
}

function sheriffSpeechDone(state: GameState): ApplyActionResult {
  if (state.phase !== 'SHERIFF' || state.sheriffElection?.stage !== 'speech') {
    return fail('INVALID_STATE', '当前不在竞选发言阶段');
  }
  return {
    ok: true,
    state: {
      ...state,
      sheriffElection: { ...state.sheriffElection, stage: 'withdraw' },
    },
  };
}

function sheriffWithdraw(
  state: GameState,
  action: Extract<GameAction, { type: 'SHERIFF_WITHDRAW' }>,
): ApplyActionResult {
  const election = state.sheriffElection;
  if (state.phase !== 'SHERIFF' || election?.stage !== 'withdraw') {
    return fail('INVALID_STATE', '当前不在退水阶段');
  }

  const withdrawn: number[] = [];
  for (const seatNo of action.withdrawn) {
    if (!election.candidates.includes(seatNo)) {
      return fail('INVALID_ACTION', `座位 ${seatNo} 未上警，不能退水`);
    }
    if (withdrawn.includes(seatNo)) {
      return fail('INVALID_ACTION', `座位 ${seatNo} 重复退水`);
    }
    withdrawn.push(seatNo);
  }

  const remaining = election.candidates.filter((seatNo) => !withdrawn.includes(seatNo));
  const stage: SheriffStage = remaining.length === 0 ? 'done' : 'vote';
  return {
    ok: true,
    state: {
      ...state,
      sheriffElection: {
        ...election,
        withdrawn,
        stage,
        ballots: [],
        elected: null,
      },
    },
  };
}

function tallyBallots(ballots: readonly Ballot[]): { target: number; total: number }[] {
  const totals = new Map<number, number>();
  for (const ballot of ballots) {
    if (ballot.target === null) continue;
    totals.set(ballot.target, (totals.get(ballot.target) ?? 0) + ballot.weight);
  }
  return [...totals.entries()].map(([target, total]) => ({ target, total }));
}

function maxTargets(totals: readonly { target: number; total: number }[]): number[] {
  const max = Math.max(0, ...totals.map((item) => item.total));
  if (max === 0) return [];
  return totals.filter((item) => item.total === max).map((item) => item.target);
}

function sheriffVote(
  state: GameState,
  action: Extract<GameAction, { type: 'SHERIFF_VOTE' }>,
): ApplyActionResult {
  const election = state.sheriffElection;
  if (state.phase !== 'SHERIFF' || !election) {
    return fail('INVALID_STATE', '当前不在竞选投票阶段');
  }
  if (election.stage !== 'vote' && election.stage !== 'pk') {
    return fail('INVALID_STATE', '当前不在竞选投票阶段');
  }

  const eligibleTargets =
    election.stage === 'pk'
      ? election.pkCandidates
      : election.candidates.filter((seatNo) => !election.withdrawn.includes(seatNo));
  const voters = getAliveSeatNos(state).filter((seatNo) => !election.candidates.includes(seatNo));

  const seenVoters = new Set<number>();
  const ballots: Ballot[] = [];
  for (const ballot of action.ballots) {
    if (!voters.includes(ballot.voter)) {
      return fail('INVALID_VOTER', `座位 ${ballot.voter} 无竞选投票权`);
    }
    if (seenVoters.has(ballot.voter)) {
      return fail('INVALID_BALLOT', `座位 ${ballot.voter} 重复投票`);
    }
    if (ballot.target !== null) {
      if (!eligibleTargets.includes(ballot.target)) {
        return fail('INVALID_TARGET', `座位 ${ballot.target} 不是本轮候选人`);
      }
      if (!getSeat(state, ballot.target)?.alive) {
        return fail('INVALID_TARGET', `座位 ${ballot.target} 不在场`);
      }
    }
    seenVoters.add(ballot.voter);
    ballots.push({ voter: ballot.voter, target: ballot.target, weight: 1 });
  }

  const leaders = maxTargets(tallyBallots(ballots));
  if (leaders.length === 0) {
    return {
      ok: true,
      state: {
        ...state,
        sheriffElection: {
          ...election,
          stage: 'done',
          ballots,
          elected: null,
        },
        events: appendEvent(state, 'SHERIFF_NONE', [], 'SHERIFF'),
      },
    };
  }

  if (leaders.length > 1) {
    if (election.stage === 'pk') {
      return {
        ok: true,
        state: {
          ...state,
          sheriffElection: {
            ...election,
            stage: 'done',
            ballots,
            elected: null,
          },
          events: appendEvent(state, 'SHERIFF_NONE', [], 'SHERIFF'),
        },
      };
    }
    return {
      ok: true,
      state: {
        ...state,
        sheriffElection: {
          ...election,
          stage: 'pk',
          ballots: [],
          pkCandidates: leaders,
          elected: null,
        },
      },
    };
  }

  const elected = leaders[0] ?? null;
  return {
    ok: true,
    state: {
      ...state,
      sheriffNo: elected,
      sheriffElection: {
        ...election,
        stage: 'done',
        ballots,
        elected,
      },
      events: elected ? appendEvent(state, 'SHERIFF_ELECTED', [elected], 'SHERIFF') : state.events,
    },
  };
}

function sheriffDone(state: GameState): ApplyActionResult {
  if (state.phase !== 'SHERIFF' || state.sheriffElection?.stage !== 'done') {
    return fail('INVALID_STATE', '竞选尚未结束');
  }
  return { ok: true, state: { ...state, phase: 'DAWN' } };
}

function selfExplode(
  state: GameState,
  action: Extract<GameAction, { type: 'SELF_EXPLODE' }>,
): ApplyActionResult {
  if (state.phase !== 'SHERIFF' && state.phase !== 'SPEECH') {
    return fail('INVALID_STATE', '只有竞选或发言阶段可以自爆');
  }
  if (state.phase === 'SHERIFF' && state.sheriffElection?.stage === 'done') {
    return fail('NOT_ALLOWED', '竞选已结束，不能自爆');
  }

  const seat = getSeat(state, action.seatNo);
  if (!seat) {
    return fail('INVALID_SEAT', `非法座位号 ${action.seatNo}`);
  }
  if (!seat.alive) {
    return fail('INVALID_SEAT', `座位 ${action.seatNo} 不在场`);
  }
  if (!seat.role || ROLE_DEFINITIONS[seat.role].camp !== 'wolf') {
    return fail('INVALID_ROLE', `座位 ${action.seatNo} 不是狼人`);
  }

  const interruptedPhase = state.phase;
  const sheriffElection =
    state.phase === 'SHERIFF' && state.sheriffElection
      ? { ...state.sheriffElection, stage: 'done' as const, elected: null }
      : state.sheriffElection;

  const seats = killSeat(state.seats, action.seatNo, 'SELF_EXPLODE', state.round);
  const remainingWolves = seats.filter(
    (item) => item.alive && item.role && ROLE_DEFINITIONS[item.role].camp === 'wolf',
  ).length;

  return {
    ok: true,
    state: {
      ...state,
      phase: 'SELF_EXPLODE',
      status: 'active',
      seats,
      sheriffNo: interruptedPhase === 'SHERIFF' ? null : state.sheriffNo,
      sheriffElection,
      explodingSeat: action.seatNo,
      interruptedPhase,
      pendingBadge: state.sheriffNo === action.seatNo,
      pendingWolfKingTake: seat.role === 'WOLF_KING' && remainingWolves > 0,
      events: appendEvent(state, 'SELF_EXPLODE', [action.seatNo], interruptedPhase),
    },
  };
}

function wolfKingTake(
  state: GameState,
  action: Extract<GameAction, { type: 'WOLF_KING_TAKE' }>,
): ApplyActionResult {
  if (state.phase !== 'SELF_EXPLODE') {
    return fail('INVALID_STATE', '只有自爆结算阶段可以带走玩家');
  }
  if (!state.pendingWolfKingTake || state.explodingSeat === null) {
    return fail('NOT_ALLOWED', '当前没有白狼王带人');
  }
  if (action.target !== null) {
    if (!isSeatNo(action.target) || !getSeat(state, action.target)?.alive) {
      return fail('INVALID_TARGET', `非法目标座位 ${action.target}`);
    }
  }

  let seats = state.seats;
  if (action.target !== null) {
    seats = killSeat(seats, action.target, 'WOLF_KING', state.round);
  }
  const seatNos =
    action.target === null ? [state.explodingSeat] : [state.explodingSeat, action.target];

  return {
    ok: true,
    state: {
      ...state,
      seats,
      pendingWolfKingTake: false,
      pendingBadge:
        state.pendingBadge || (action.target !== null && action.target === state.sheriffNo),
      events: appendEvent(state, 'WOLF_KING_TAKE', seatNos, 'SELF_EXPLODE'),
    },
  };
}

function explodeResolved(state: GameState): ApplyActionResult {
  if (state.phase !== 'SELF_EXPLODE') {
    return fail('INVALID_STATE', '当前没有待结算的自爆');
  }
  if (state.pendingWolfKingTake) {
    return fail('NOT_ALLOWED', '白狼王尚未处理带人');
  }
  if (state.pendingBadge) {
    return fail('NOT_ALLOWED', '警徽尚未处理');
  }
  return {
    ok: true,
    state: {
      ...state,
      phase: 'CHECK_WIN',
      resumeTo: 'NIGHT',
    },
  };
}

function dawnDone(state: GameState): ApplyActionResult {
  if (state.phase !== 'DAWN') {
    return fail('INVALID_STATE', '只有 DAWN 阶段可以公布死讯');
  }
  if (state.pendingHunterNo !== null) {
    return fail('NOT_ALLOWED', '猎人尚未开枪');
  }
  if (state.pendingBadge) {
    return fail('NOT_ALLOWED', '警徽尚未处理');
  }
  return {
    ok: true,
    state: {
      ...state,
      phase: 'CHECK_WIN',
      resumeTo: 'SPEECH',
    },
  };
}

function hunterShoot(
  state: GameState,
  action: Extract<GameAction, { type: 'HUNTER_SHOOT' }>,
): ApplyActionResult {
  if (state.phase !== 'DAWN' && state.phase !== 'SETTLE') {
    return fail('INVALID_STATE', '只有 DAWN 或 SETTLE 阶段可以开枪');
  }
  const hunterNo = state.pendingHunterNo;
  if (hunterNo === null) {
    return fail('NOT_ALLOWED', '当前没有待处理的猎人开枪');
  }
  if (action.target !== null) {
    if (!isSeatNo(action.target) || !getSeat(state, action.target)?.alive) {
      return fail('INVALID_TARGET', `非法目标座位 ${action.target}`);
    }
  }

  let seats = state.seats;
  if (action.target !== null) {
    seats = killSeat(seats, action.target, 'HUNTER', state.round);
  }
  const seatNos = action.target === null ? [hunterNo] : [hunterNo, action.target];

  return {
    ok: true,
    state: {
      ...state,
      seats,
      pendingHunterNo: null,
      pendingBadge:
        state.pendingBadge || (action.target !== null && action.target === state.sheriffNo),
      events: appendEvent(state, 'HUNTER_SHOOT', seatNos, state.phase),
    },
  };
}

function badgeTransfer(
  state: GameState,
  action: Extract<GameAction, { type: 'BADGE_TRANSFER' }>,
): ApplyActionResult {
  if (state.phase !== 'DAWN' && state.phase !== 'SETTLE' && state.phase !== 'SELF_EXPLODE') {
    return fail('INVALID_STATE', '当前阶段不能处理警徽');
  }
  if (!state.pendingBadge) {
    return fail('NOT_ALLOWED', '当前没有待处理的警徽');
  }
  if (!isSeatNo(action.target) || !getSeat(state, action.target)?.alive) {
    return fail('INVALID_TARGET', `非法警徽继任座位 ${action.target}`);
  }
  if (action.target === state.sheriffNo) {
    return fail('INVALID_TARGET', '警徽不能移交给原警长');
  }

  return {
    ok: true,
    state: {
      ...state,
      sheriffNo: action.target,
      pendingBadge: false,
      events: appendEvent(state, 'BADGE_TRANSFER', [action.target], state.phase),
    },
  };
}

function badgeDestroy(state: GameState): ApplyActionResult {
  if (state.phase !== 'DAWN' && state.phase !== 'SETTLE' && state.phase !== 'SELF_EXPLODE') {
    return fail('INVALID_STATE', '当前阶段不能处理警徽');
  }
  if (!state.pendingBadge) {
    return fail('NOT_ALLOWED', '当前没有待处理的警徽');
  }
  return {
    ok: true,
    state: {
      ...state,
      sheriffNo: null,
      pendingBadge: false,
      events: appendEvent(state, 'BADGE_DESTROYED', [], state.phase),
    },
  };
}

function speechDone(state: GameState): ApplyActionResult {
  if (state.phase !== 'SPEECH') {
    return fail('INVALID_STATE', '只有 SPEECH 阶段可以进入投票');
  }
  return {
    ok: true,
    state: {
      ...state,
      phase: 'VOTE',
      ballots: [],
      pkCandidates: [],
      voteRound: 1,
      exiledSeat: null,
      exileResolved: false,
    },
  };
}

function isEligibleVoter(state: GameState, seatNo: number): boolean {
  const seat = getSeat(state, seatNo);
  return Boolean(seat && seat.alive && !seat.idiotRevealed);
}

function recordBallot(
  state: GameState,
  action: Extract<GameAction, { type: 'RECORD_BALLOT' }>,
): ApplyActionResult {
  if (state.phase !== 'VOTE') {
    return fail('INVALID_STATE', '只有 VOTE 阶段可以录入投票');
  }
  if (!isEligibleVoter(state, action.voter)) {
    return fail('INVALID_VOTER', `座位 ${action.voter} 无放逐投票权`);
  }
  if (action.target !== null) {
    if (!isSeatNo(action.target) || !getSeat(state, action.target)?.alive) {
      return fail('INVALID_TARGET', `非法投票目标 ${action.target}`);
    }
    if (getSeat(state, action.target)?.idiotRevealed) {
      return fail('INVALID_TARGET', `白痴翻牌后不再成为放逐目标`);
    }
    if (state.voteRound === 2 && !state.pkCandidates.includes(action.target)) {
      return fail('INVALID_TARGET', `PK 轮只能投 ${state.pkCandidates.join('、')} 号`);
    }
  }

  const weight = action.voter === state.sheriffNo ? 1.5 : 1;
  const ballots = [
    ...state.ballots.filter((ballot) => ballot.voter !== action.voter),
    { voter: action.voter, target: action.target, weight },
  ];
  return { ok: true, state: { ...state, ballots } };
}

function voteClose(state: GameState): ApplyActionResult {
  if (state.phase !== 'VOTE') {
    return fail('INVALID_STATE', '只有 VOTE 阶段可以结算投票');
  }

  const leaders = maxTargets(tallyBallots(state.ballots));
  if (leaders.length === 0) {
    return {
      ok: true,
      state: {
        ...state,
        phase: 'SETTLE',
        exiledSeat: null,
        exileResolved: false,
        ballots: [],
        events: appendEvent(state, 'NO_EXILE', [], 'VOTE'),
      },
    };
  }

  if (leaders.length > 1) {
    if (state.voteRound === 2) {
      return {
        ok: true,
        state: {
          ...state,
          phase: 'SETTLE',
          exiledSeat: null,
          exileResolved: false,
          ballots: [],
          events: appendEvent(state, 'NO_EXILE', [], 'VOTE'),
        },
      };
    }
    return {
      ok: true,
      state: {
        ...state,
        ballots: [],
        pkCandidates: leaders,
        voteRound: 2,
      },
    };
  }

  const exiledSeat = leaders[0] ?? null;
  return {
    ok: true,
    state: {
      ...state,
      phase: 'SETTLE',
      exiledSeat,
      exileResolved: false,
      ballots: state.ballots,
      events: exiledSeat ? appendEvent(state, 'EXILE', [exiledSeat], 'VOTE') : state.events,
    },
  };
}

function resolveExile(state: GameState): ApplyActionResult {
  if (state.phase !== 'SETTLE') {
    return fail('INVALID_STATE', '只有 SETTLE 阶段可以结算放逐');
  }
  if (state.exiledSeat === null) {
    return fail('NOT_ALLOWED', '本轮无人出局');
  }
  if (state.exileResolved) {
    return fail('NOT_ALLOWED', '放逐已结算');
  }
  const seat = getSeat(state, state.exiledSeat);
  if (!seat) {
    return fail('INVALID_SEAT', `非法座位号 ${state.exiledSeat}`);
  }

  const isIdiot = seat.role === 'IDIOT' && !seat.idiotRevealed;
  const seats = isIdiot
    ? updateSeat(state.seats, seat.no, { idiotRevealed: true })
    : killSeat(state.seats, seat.no, 'VOTE', state.round);

  return {
    ok: true,
    state: {
      ...state,
      seats,
      exileResolved: true,
      pendingHunterNo: !isIdiot && seat.role === 'HUNTER' ? seat.no : state.pendingHunterNo,
      pendingBadge: state.pendingBadge || seat.no === state.sheriffNo,
      events: isIdiot
        ? appendEvent(state, 'IDIOT_REVEALED', [seat.no], 'SETTLE')
        : appendEvent(state, 'DEATH', [seat.no], 'SETTLE', 'VOTE'),
    },
  };
}

function settleDone(state: GameState): ApplyActionResult {
  if (state.phase !== 'SETTLE') {
    return fail('INVALID_STATE', '只有 SETTLE 阶段可以结束结算');
  }
  if (state.exiledSeat !== null && !state.exileResolved) {
    return fail('NOT_ALLOWED', '放逐结果尚未结算');
  }
  if (state.pendingHunterNo !== null) {
    return fail('NOT_ALLOWED', '猎人尚未开枪');
  }
  if (state.pendingBadge) {
    return fail('NOT_ALLOWED', '警徽尚未处理');
  }
  return {
    ok: true,
    state: {
      ...state,
      phase: 'CHECK_WIN',
      resumeTo: 'NIGHT',
    },
  };
}

function resolveWin(state: GameState): ApplyActionResult {
  if (state.phase !== 'CHECK_WIN') {
    return fail('INVALID_STATE', '只有 CHECK_WIN 阶段可以确认胜负');
  }

  const winner = checkWin(state);
  if (winner) {
    return {
      ok: true,
      state: {
        ...state,
        phase: 'RESULT',
        status: 'finished',
        result: { winner, round: state.round },
        resumeTo: null,
      },
    };
  }

  const resumeTo = state.resumeTo;
  if (!resumeTo) {
    return fail('INVALID_STATE', '缺少 CHECK_WIN 的返回阶段');
  }

  const base: GameState = {
    ...state,
    phase: resumeTo,
    resumeTo: null,
    explodingSeat: null,
    interruptedPhase: null,
  };

  if (resumeTo === 'NIGHT') {
    return {
      ok: true,
      state: {
        ...base,
        round: state.round + 1,
        nightStep: 0,
        sheriffElection: null,
        sheriffNo: state.sheriffNo,
        pendingHunterNo: null,
        pendingBadge: false,
        pendingWolfKingTake: false,
        exiledSeat: null,
        exileResolved: false,
        ballots: [],
        pkCandidates: [],
        voteRound: 1,
      },
    };
  }
  if (resumeTo === 'SHERIFF') {
    return {
      ok: true,
      state: {
        ...base,
        sheriffElection: emptySheriffElection(),
      },
    };
  }
  return { ok: true, state: base };
}

export function applyAction(state: GameState, action: GameAction): ApplyActionResult {
  switch (action.type) {
    case 'START_DEAL':
      return startDeal(state, action);
    case 'DEAL_DONE':
      return dealDone(state, action);
    case 'NIGHT_ACTION':
      return nightAction(state, action);
    case 'NIGHT_STEP_NEXT':
      return nightStepNext(state);
    case 'NIGHT_DONE':
      return nightDone(state);
    case 'SHERIFF_SIGNUP':
      return sheriffSignup(state, action);
    case 'SHERIFF_SPEECH_DONE':
      return sheriffSpeechDone(state);
    case 'SHERIFF_WITHDRAW':
      return sheriffWithdraw(state, action);
    case 'SHERIFF_VOTE':
      return sheriffVote(state, action);
    case 'SHERIFF_DONE':
      return sheriffDone(state);
    case 'SELF_EXPLODE':
      return selfExplode(state, action);
    case 'WOLF_KING_TAKE':
      return wolfKingTake(state, action);
    case 'EXPLODE_RESOLVED':
      return explodeResolved(state);
    case 'DAWN_DONE':
      return dawnDone(state);
    case 'HUNTER_SHOOT':
      return hunterShoot(state, action);
    case 'BADGE_TRANSFER':
      return badgeTransfer(state, action);
    case 'BADGE_DESTROY':
      return badgeDestroy(state);
    case 'SPEECH_DONE':
      return speechDone(state);
    case 'RECORD_BALLOT':
      return recordBallot(state, action);
    case 'VOTE_CLOSE':
      return voteClose(state);
    case 'RESOLVE_EXILE':
      return resolveExile(state);
    case 'SETTLE_DONE':
      return settleDone(state);
    case 'RESOLVE_WIN':
      return resolveWin(state);
    default:
      return fail('INVALID_ACTION', '未知动作');
  }
}

export function createSnapshot(state: GameState): GameState {
  return structuredClone(state);
}

export function restoreSnapshot(snapshot: GameState): GameState {
  return structuredClone(snapshot);
}
