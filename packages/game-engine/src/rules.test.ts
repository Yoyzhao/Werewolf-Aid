import { describe, expect, it } from 'vitest';

import { checkWin } from './rules.js';
import {
  applyAction,
  createGame,
  getSeat,
  type ApplyActionResult,
  type GameErrorCode,
  type GameState,
  type SeatAssignment,
  type WitchPotion,
} from './state-machine.js';

const GUARD_ASSIGNMENTS: SeatAssignment[] = [
  { seatNo: 1, roleId: 'SEER' },
  { seatNo: 2, roleId: 'WITCH' },
  { seatNo: 3, roleId: 'HUNTER' },
  { seatNo: 4, roleId: 'GUARD' },
  { seatNo: 5, roleId: 'VILLAGER' },
  { seatNo: 6, roleId: 'VILLAGER' },
  { seatNo: 7, roleId: 'VILLAGER' },
  { seatNo: 8, roleId: 'VILLAGER' },
  { seatNo: 9, roleId: 'WOLF' },
  { seatNo: 10, roleId: 'WOLF' },
  { seatNo: 11, roleId: 'WOLF' },
  { seatNo: 12, roleId: 'WOLF' },
];

const IDIOT_ASSIGNMENTS: SeatAssignment[] = [
  { seatNo: 1, roleId: 'SEER' },
  { seatNo: 2, roleId: 'WITCH' },
  { seatNo: 3, roleId: 'HUNTER' },
  { seatNo: 4, roleId: 'IDIOT' },
  { seatNo: 5, roleId: 'VILLAGER' },
  { seatNo: 6, roleId: 'VILLAGER' },
  { seatNo: 7, roleId: 'VILLAGER' },
  { seatNo: 8, roleId: 'VILLAGER' },
  { seatNo: 9, roleId: 'WOLF' },
  { seatNo: 10, roleId: 'WOLF' },
  { seatNo: 11, roleId: 'WOLF' },
  { seatNo: 12, roleId: 'WOLF_KING' },
];

function must(result: ApplyActionResult): GameState {
  if (!result.ok) throw new Error(`${result.code}: ${result.message}`);
  return result.state;
}

function expectError(result: ApplyActionResult, code: GameErrorCode): void {
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.code).toBe(code);
}

function start(
  boardId: 'pre-witch-hunter-guard' | 'pre-witch-hunter-idiot' = 'pre-witch-hunter-guard',
  options?: Parameters<typeof createGame>[1],
): GameState {
  let state = createGame(boardId, options);
  state = must(
    applyAction(state, {
      type: 'START_DEAL',
      boardId,
      dealMode: 'B',
      options,
    }),
  );
  return must(
    applyAction(state, {
      type: 'DEAL_DONE',
      assignments: boardId === 'pre-witch-hunter-guard' ? GUARD_ASSIGNMENTS : IDIOT_ASSIGNMENTS,
    }),
  );
}

interface NightPlan {
  readonly guard: number | null;
  readonly wolf: number | null;
  readonly seer?: number;
  readonly witch?: { readonly potion: WitchPotion; readonly target: number } | null;
}

function guardNight(state: GameState, plan: NightPlan): GameState {
  state = must(applyAction(state, { type: 'NIGHT_ACTION', roleId: 'GUARD', target: plan.guard }));
  state = must(applyAction(state, { type: 'NIGHT_STEP_NEXT' }));
  state = must(
    applyAction(state, { type: 'NIGHT_ACTION', roleId: 'SEER', target: plan.seer ?? 9 }),
  );
  state = must(applyAction(state, { type: 'NIGHT_STEP_NEXT' }));
  state = must(applyAction(state, { type: 'NIGHT_ACTION', roleId: 'WOLF', target: plan.wolf }));
  state = must(applyAction(state, { type: 'NIGHT_STEP_NEXT' }));
  state = plan.witch
    ? must(
        applyAction(state, {
          type: 'NIGHT_ACTION',
          roleId: 'WITCH',
          target: plan.witch.target,
          potion: plan.witch.potion,
        }),
      )
    : must(applyAction(state, { type: 'NIGHT_ACTION', roleId: 'WITCH', target: null }));
  return must(applyAction(state, { type: 'NIGHT_DONE' }));
}

function idiotNight(state: GameState, plan: Omit<NightPlan, 'guard'>): GameState {
  state = must(
    applyAction(state, { type: 'NIGHT_ACTION', roleId: 'SEER', target: plan.seer ?? 9 }),
  );
  state = must(applyAction(state, { type: 'NIGHT_STEP_NEXT' }));
  state = must(applyAction(state, { type: 'NIGHT_ACTION', roleId: 'WOLF', target: plan.wolf }));
  state = must(applyAction(state, { type: 'NIGHT_STEP_NEXT' }));
  state = plan.witch
    ? must(
        applyAction(state, {
          type: 'NIGHT_ACTION',
          roleId: 'WITCH',
          target: plan.witch.target,
          potion: plan.witch.potion,
        }),
      )
    : must(applyAction(state, { type: 'NIGHT_ACTION', roleId: 'WITCH', target: null }));
  return must(applyAction(state, { type: 'NIGHT_DONE' }));
}

function toSpeech(state: GameState): GameState {
  state = must(applyAction(state, { type: 'RESOLVE_WIN' }));
  if (state.phase === 'DAWN') {
    state = must(applyAction(state, { type: 'DAWN_DONE' }));
  }
  return must(applyAction(state, { type: 'RESOLVE_WIN' }));
}

function toVote(state: GameState): GameState {
  state = toSpeech(state);
  return must(applyAction(state, { type: 'SPEECH_DONE' }));
}

describe('夜间结算', () => {
  it('狼刀未被守护/解药时目标死亡并写入公开事件', () => {
    const state = guardNight(start('pre-witch-hunter-guard', { sheriffElection: false }), {
      guard: null,
      wolf: 5,
    });

    expect(getSeat(state, 5)?.alive).toBe(false);
    expect(getSeat(state, 5)?.deathCause).toBe('WOLF');
    expect(state.lastNightDeaths).toEqual([5]);
    expect(state.events.at(-1)).toMatchObject({
      type: 'DEATH',
      seatNos: [5],
      cause: 'WOLF',
    });
  });

  it('守卫守护成功为平安夜', () => {
    const state = guardNight(start('pre-witch-hunter-guard', { sheriffElection: false }), {
      guard: 5,
      wolf: 5,
    });

    expect(getSeat(state, 5)?.alive).toBe(true);
    expect(state.lastNightDeaths).toEqual([]);
    expect(state.events.at(-1)).toMatchObject({ type: 'NO_DEATH' });
  });

  it('女巫解药救下当夜被刀者', () => {
    const state = guardNight(start('pre-witch-hunter-guard', { sheriffElection: false }), {
      guard: null,
      wolf: 5,
      witch: { potion: 'ANTIDOTE', target: 5 },
    });

    expect(getSeat(state, 5)?.alive).toBe(true);
    expect(state.events.at(-1)).toMatchObject({ type: 'NO_DEATH' });
  });

  it('同守同救目标死亡', () => {
    const state = guardNight(start('pre-witch-hunter-guard', { sheriffElection: false }), {
      guard: 5,
      wolf: 5,
      witch: { potion: 'ANTIDOTE', target: 5 },
    });

    expect(getSeat(state, 5)?.alive).toBe(false);
    expect(getSeat(state, 5)?.deathCause).toBe('SAME_GUARD_SAVE');
  });

  it('毒药无视守护', () => {
    const state = guardNight(start('pre-witch-hunter-guard', { sheriffElection: false }), {
      guard: 5,
      wolf: 5,
      witch: { potion: 'POISON', target: 5 },
    });

    expect(getSeat(state, 5)?.alive).toBe(false);
    expect(getSeat(state, 5)?.deathCause).toBe('POISON');
  });

  it('守卫不可连续两夜守护同一人', () => {
    const base = start('pre-witch-hunter-guard', { sheriffElection: false });
    const state: GameState = {
      ...base,
      round: 2,
      nightStep: 0,
      nightActions: [{ round: 1, step: 0, roleId: 'GUARD', target: 5, potion: null }],
    };

    expectError(
      applyAction(state, { type: 'NIGHT_ACTION', roleId: 'GUARD', target: 5 }),
      'INVALID_TARGET',
    );
    const next = must(applyAction(state, { type: 'NIGHT_ACTION', roleId: 'GUARD', target: 6 }));
    expect(next.nightActions.at(-1)).toMatchObject({ roleId: 'GUARD', target: 6 });
  });

  it('女巫药剂整局只能使用一次，解药只能救当夜被刀者', () => {
    const base = start('pre-witch-hunter-guard', { sheriffElection: false });
    const state: GameState = {
      ...base,
      round: 2,
      nightStep: 3,
      nightActions: [
        { round: 1, step: 3, roleId: 'WITCH', target: 5, potion: 'ANTIDOTE' },
        { round: 2, step: 2, roleId: 'WOLF', target: 6, potion: null },
      ],
    };

    expectError(
      applyAction(state, {
        type: 'NIGHT_ACTION',
        roleId: 'WITCH',
        target: 6,
        potion: 'ANTIDOTE',
      }),
      'INVALID_ACTION',
    );

    const fresh: GameState = {
      ...state,
      nightActions: [{ round: 2, step: 2, roleId: 'WOLF', target: 6, potion: null }],
    };
    expectError(
      applyAction(fresh, {
        type: 'NIGHT_ACTION',
        roleId: 'WITCH',
        target: 7,
        potion: 'ANTIDOTE',
      }),
      'INVALID_TARGET',
    );
  });

  it('女巫首夜自救受设置控制', () => {
    let off = start('pre-witch-hunter-guard', {
      sheriffElection: false,
      witchSelfSaveFirstNight: false,
    });
    off = must(applyAction(off, { type: 'NIGHT_ACTION', roleId: 'GUARD', target: null }));
    off = must(applyAction(off, { type: 'NIGHT_STEP_NEXT' }));
    off = must(applyAction(off, { type: 'NIGHT_ACTION', roleId: 'SEER', target: 9 }));
    off = must(applyAction(off, { type: 'NIGHT_STEP_NEXT' }));
    off = must(applyAction(off, { type: 'NIGHT_ACTION', roleId: 'WOLF', target: 2 }));
    off = must(applyAction(off, { type: 'NIGHT_STEP_NEXT' }));
    expectError(
      applyAction(off, {
        type: 'NIGHT_ACTION',
        roleId: 'WITCH',
        target: 2,
        potion: 'ANTIDOTE',
      }),
      'INVALID_TARGET',
    );

    let on = start('pre-witch-hunter-guard', { sheriffElection: false });
    on = must(applyAction(on, { type: 'NIGHT_ACTION', roleId: 'GUARD', target: null }));
    on = must(applyAction(on, { type: 'NIGHT_STEP_NEXT' }));
    on = must(applyAction(on, { type: 'NIGHT_ACTION', roleId: 'SEER', target: 9 }));
    on = must(applyAction(on, { type: 'NIGHT_STEP_NEXT' }));
    on = must(applyAction(on, { type: 'NIGHT_ACTION', roleId: 'WOLF', target: 2 }));
    on = must(applyAction(on, { type: 'NIGHT_STEP_NEXT' }));
    on = must(
      applyAction(on, {
        type: 'NIGHT_ACTION',
        roleId: 'WITCH',
        target: 2,
        potion: 'ANTIDOTE',
      }),
    );
    on = must(applyAction(on, { type: 'NIGHT_DONE' }));
    expect(getSeat(on, 2)?.alive).toBe(true);
  });
});

describe('胜负判定', () => {
  it('狼全灭好人胜；神全灭或民全灭狼胜', () => {
    const base = start('pre-witch-hunter-guard', { sheriffElection: false });
    expect(checkWin(base)).toBeNull();

    const noWolves: GameState = {
      ...base,
      seats: base.seats.map((seat) =>
        seat.role && (seat.role === 'WOLF' || seat.role === 'WOLF_KING')
          ? { ...seat, alive: false }
          : seat,
      ),
    };
    expect(checkWin(noWolves)).toBe('good');

    const noGods: GameState = {
      ...base,
      seats: base.seats.map((seat) =>
        seat.role && ['SEER', 'WITCH', 'HUNTER', 'GUARD', 'IDIOT'].includes(seat.role)
          ? { ...seat, alive: false }
          : seat,
      ),
    };
    expect(checkWin(noGods)).toBe('wolf');

    const noVillagers: GameState = {
      ...base,
      seats: base.seats.map((seat) =>
        seat.role === 'VILLAGER' ? { ...seat, alive: false } : seat,
      ),
    };
    expect(checkWin(noVillagers)).toBe('wolf');
  });

  it('夜间死亡结算后在 CHECK_WIN 自动判定狼胜', () => {
    let state = start('pre-witch-hunter-guard', { sheriffElection: false });
    state = must(applyAction(state, { type: 'NIGHT_ACTION', roleId: 'GUARD', target: null }));
    state = must(applyAction(state, { type: 'NIGHT_STEP_NEXT' }));
    state = must(applyAction(state, { type: 'NIGHT_ACTION', roleId: 'SEER', target: 9 }));
    state = must(applyAction(state, { type: 'NIGHT_STEP_NEXT' }));
    state = must(applyAction(state, { type: 'NIGHT_ACTION', roleId: 'WOLF', target: 1 }));
    state = must(applyAction(state, { type: 'NIGHT_STEP_NEXT' }));
    state = must(applyAction(state, { type: 'NIGHT_ACTION', roleId: 'WITCH', target: null }));
    state = {
      ...state,
      seats: state.seats.map((seat) =>
        seat.no === 2 || seat.no === 3 || seat.no === 4
          ? { ...seat, alive: false, deathCause: 'WOLF', deathRound: 1 }
          : seat,
      ),
    };
    state = must(applyAction(state, { type: 'NIGHT_DONE' }));
    state = must(applyAction(state, { type: 'RESOLVE_WIN' }));

    expect(state.phase).toBe('RESULT');
    expect(state.result).toEqual({ winner: 'wolf', round: 1 });
  });

  it('放逐最后一只狼后好人胜', () => {
    let state = toVote(
      guardNight(start('pre-witch-hunter-guard', { sheriffElection: false }), {
        guard: 5,
        wolf: 5,
      }),
    );
    state = {
      ...state,
      seats: state.seats.map((seat) =>
        seat.no === 9 || seat.no === 10 || seat.no === 11
          ? { ...seat, alive: false, deathCause: 'POISON', deathRound: 1 }
          : seat,
      ),
    };
    state = must(applyAction(state, { type: 'RECORD_BALLOT', voter: 1, target: 12 }));
    state = must(applyAction(state, { type: 'VOTE_CLOSE' }));
    state = must(applyAction(state, { type: 'RESOLVE_EXILE' }));
    state = must(applyAction(state, { type: 'SETTLE_DONE' }));
    state = must(applyAction(state, { type: 'RESOLVE_WIN' }));

    expect(state.phase).toBe('RESULT');
    expect(state.result).toEqual({ winner: 'good', round: 1 });
  });
});

describe('猎人', () => {
  it('猎人被刀后在 DAWN 开枪，未开枪不能公布死讯', () => {
    let state = guardNight(start('pre-witch-hunter-guard', { sheriffElection: false }), {
      guard: null,
      wolf: 3,
    });
    expect(state.pendingHunterNo).toBe(3);

    state = must(applyAction(state, { type: 'RESOLVE_WIN' }));
    expect(state.phase).toBe('DAWN');
    expectError(applyAction(state, { type: 'DAWN_DONE' }), 'NOT_ALLOWED');

    state = must(applyAction(state, { type: 'HUNTER_SHOOT', target: 9 }));
    expect(getSeat(state, 9)?.alive).toBe(false);
    expect(getSeat(state, 9)?.deathCause).toBe('HUNTER');
    expect(state.pendingHunterNo).toBeNull();

    state = must(applyAction(state, { type: 'DAWN_DONE' }));
    expect(state.phase).toBe('CHECK_WIN');
  });

  it('猎人被毒不能开枪', () => {
    let state = guardNight(start('pre-witch-hunter-guard', { sheriffElection: false }), {
      guard: null,
      wolf: 5,
      witch: { potion: 'POISON', target: 3 },
    });
    expect(state.pendingHunterNo).toBeNull();

    state = must(applyAction(state, { type: 'RESOLVE_WIN' }));
    state = must(applyAction(state, { type: 'DAWN_DONE' }));
    expect(state.phase).toBe('CHECK_WIN');
  });

  it('猎人被放逐后在 SETTLE 开枪，可跳过', () => {
    let state = toVote(
      guardNight(start('pre-witch-hunter-guard', { sheriffElection: false }), {
        guard: 5,
        wolf: 5,
      }),
    );
    state = must(applyAction(state, { type: 'RECORD_BALLOT', voter: 1, target: 3 }));
    state = must(applyAction(state, { type: 'VOTE_CLOSE' }));
    state = must(applyAction(state, { type: 'RESOLVE_EXILE' }));
    expect(state.pendingHunterNo).toBe(3);
    expectError(applyAction(state, { type: 'SETTLE_DONE' }), 'NOT_ALLOWED');

    state = must(applyAction(state, { type: 'HUNTER_SHOOT', target: null }));
    state = must(applyAction(state, { type: 'SETTLE_DONE' }));
    expect(state.phase).toBe('CHECK_WIN');
  });
});

describe('白痴与警徽', () => {
  function reachIdiotSettle(): GameState {
    let state = idiotNight(start('pre-witch-hunter-idiot', { sheriffElection: false }), {
      wolf: 5,
    });
    state = toVote(state);
    state = must(applyAction(state, { type: 'RECORD_BALLOT', voter: 1, target: 4 }));
    state = must(applyAction(state, { type: 'VOTE_CLOSE' }));
    return state;
  }

  it('白痴被放逐翻牌免死、失去投票权且不再成为放逐目标', () => {
    let state = reachIdiotSettle();
    state = must(applyAction(state, { type: 'RESOLVE_EXILE' }));

    expect(getSeat(state, 4)?.alive).toBe(true);
    expect(getSeat(state, 4)?.idiotRevealed).toBe(true);
    expect(state.events.at(-1)).toMatchObject({ type: 'IDIOT_REVEALED', seatNos: [4] });

    state = must(applyAction(state, { type: 'SETTLE_DONE' }));
    expect(state.phase).toBe('CHECK_WIN');

    const voteState: GameState = { ...state, phase: 'VOTE' };
    expectError(
      applyAction(voteState, { type: 'RECORD_BALLOT', voter: 1, target: 4 }),
      'INVALID_TARGET',
    );
  });

  it('警长夜间死亡后必须处理警徽才能结束 DAWN', () => {
    let state = start('pre-witch-hunter-guard');
    state = guardNight(state, { guard: 5, wolf: 5 });
    state = must(applyAction(state, { type: 'RESOLVE_WIN' }));
    state = must(applyAction(state, { type: 'SHERIFF_SIGNUP', candidates: [2] }));
    state = must(applyAction(state, { type: 'SHERIFF_SPEECH_DONE' }));
    state = must(applyAction(state, { type: 'SHERIFF_WITHDRAW', withdrawn: [] }));
    state = must(
      applyAction(state, {
        type: 'SHERIFF_VOTE',
        ballots: [{ voter: 1, target: 2, weight: 1 }],
      }),
    );
    state = must(applyAction(state, { type: 'SHERIFF_DONE' }));
    state = must(applyAction(state, { type: 'DAWN_DONE' }));
    state = must(applyAction(state, { type: 'RESOLVE_WIN' }));
    state = must(applyAction(state, { type: 'SPEECH_DONE' }));
    state = must(applyAction(state, { type: 'RECORD_BALLOT', voter: 1, target: 6 }));
    state = must(applyAction(state, { type: 'VOTE_CLOSE' }));
    state = must(applyAction(state, { type: 'RESOLVE_EXILE' }));
    state = must(applyAction(state, { type: 'SETTLE_DONE' }));
    state = must(applyAction(state, { type: 'RESOLVE_WIN' }));

    expect(state.phase).toBe('NIGHT');
    expect(state.round).toBe(2);

    state = guardNight(state, { guard: 7, wolf: 2 });
    expect(state.pendingBadge).toBe(true);
    state = must(applyAction(state, { type: 'RESOLVE_WIN' }));
    expect(state.phase).toBe('DAWN');
    expectError(applyAction(state, { type: 'DAWN_DONE' }), 'NOT_ALLOWED');

    state = must(applyAction(state, { type: 'BADGE_TRANSFER', target: 5 }));
    expect(state.sheriffNo).toBe(5);
    expect(state.pendingBadge).toBe(false);
    state = must(applyAction(state, { type: 'DAWN_DONE' }));
    expect(state.phase).toBe('CHECK_WIN');
  });
});

describe('白狼王自爆', () => {
  function toSpeechIdiot(): GameState {
    const state = idiotNight(start('pre-witch-hunter-idiot', { sheriffElection: false }), {
      wolf: 5,
    });
    return toSpeech(state);
  }

  it('自爆后可带走一人，未处理不能结束自爆结算', () => {
    let state = toSpeechIdiot();
    state = must(applyAction(state, { type: 'SELF_EXPLODE', seatNo: 12 }));
    expect(state.pendingWolfKingTake).toBe(true);
    expectError(applyAction(state, { type: 'EXPLODE_RESOLVED' }), 'NOT_ALLOWED');

    state = must(applyAction(state, { type: 'WOLF_KING_TAKE', target: 1 }));
    expect(getSeat(state, 1)?.alive).toBe(false);
    expect(getSeat(state, 1)?.deathCause).toBe('WOLF_KING');
    expect(state.pendingWolfKingTake).toBe(false);
    expect(state.events.at(-1)).toMatchObject({ type: 'WOLF_KING_TAKE', seatNos: [12, 1] });

    state = must(applyAction(state, { type: 'EXPLODE_RESOLVED' }));
    state = must(applyAction(state, { type: 'RESOLVE_WIN' }));
    expect(state.phase).toBe('NIGHT');
    expect(state.round).toBe(2);
  });

  it('最后一狼自爆不带人，好人胜', () => {
    let state = toSpeechIdiot();
    state = {
      ...state,
      seats: state.seats.map((seat) =>
        seat.no === 9 || seat.no === 10 || seat.no === 11
          ? { ...seat, alive: false, deathCause: 'POISON', deathRound: 1 }
          : seat,
      ),
    };
    state = must(applyAction(state, { type: 'SELF_EXPLODE', seatNo: 12 }));
    expect(state.pendingWolfKingTake).toBe(false);
    expectError(applyAction(state, { type: 'WOLF_KING_TAKE', target: 1 }), 'NOT_ALLOWED');

    state = must(applyAction(state, { type: 'EXPLODE_RESOLVED' }));
    state = must(applyAction(state, { type: 'RESOLVE_WIN' }));
    expect(state.phase).toBe('RESULT');
    expect(state.result).toEqual({ winner: 'good', round: 1 });
  });

  it('白狼王带走最后一神，狼胜', () => {
    let state = toSpeechIdiot();
    state = {
      ...state,
      seats: state.seats.map((seat) =>
        seat.no === 2 || seat.no === 3 || seat.no === 4
          ? { ...seat, alive: false, deathCause: 'WOLF', deathRound: 1 }
          : seat,
      ),
    };
    state = must(applyAction(state, { type: 'SELF_EXPLODE', seatNo: 12 }));
    state = must(applyAction(state, { type: 'WOLF_KING_TAKE', target: 1 }));
    state = must(applyAction(state, { type: 'EXPLODE_RESOLVED' }));
    state = must(applyAction(state, { type: 'RESOLVE_WIN' }));

    expect(state.phase).toBe('RESULT');
    expect(state.result).toEqual({ winner: 'wolf', round: 1 });
  });
});
