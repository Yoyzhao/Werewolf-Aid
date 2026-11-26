import { describe, expect, it } from 'vitest';

import type { BoardId } from './boards.js';
import { ROLE_DEFINITIONS } from './roles.js';
import {
  applyAction,
  createGame,
  createSnapshot,
  getCurrentNightRole,
  getSeat,
  restoreSnapshot,
  type ApplyActionResult,
  type GameErrorCode,
  type GameState,
  type SeatAssignment,
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

function assignmentsFor(boardId: BoardId): SeatAssignment[] {
  return boardId === 'pre-witch-hunter-guard' ? GUARD_ASSIGNMENTS : IDIOT_ASSIGNMENTS;
}

function must(result: ApplyActionResult): GameState {
  if (!result.ok) throw new Error(`${result.code}: ${result.message}`);
  return result.state;
}

function expectError(result: ApplyActionResult, code: GameErrorCode): void {
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.code).toBe(code);
}

function startedGame(
  boardId: BoardId = 'pre-witch-hunter-guard',
  options?: Parameters<typeof createGame>[1],
): GameState {
  let state = createGame(boardId, options);
  state = must(
    applyAction(state, {
      type: 'START_DEAL',
      boardId,
      dealMode: 'A',
      options,
    }),
  );
  state = must(applyAction(state, { type: 'DEAL_DONE', assignments: assignmentsFor(boardId) }));
  return state;
}

function passNight(state: GameState): GameState {
  if (state.boardId === 'pre-witch-hunter-guard') {
    state = must(applyAction(state, { type: 'NIGHT_ACTION', roleId: 'GUARD', target: 5 }));
    state = must(applyAction(state, { type: 'NIGHT_STEP_NEXT' }));
    state = must(applyAction(state, { type: 'NIGHT_ACTION', roleId: 'SEER', target: 9 }));
    state = must(applyAction(state, { type: 'NIGHT_STEP_NEXT' }));
    state = must(applyAction(state, { type: 'NIGHT_ACTION', roleId: 'WOLF', target: 5 }));
    state = must(applyAction(state, { type: 'NIGHT_STEP_NEXT' }));
    state = must(applyAction(state, { type: 'NIGHT_ACTION', roleId: 'WITCH', target: null }));
  } else {
    state = must(applyAction(state, { type: 'NIGHT_ACTION', roleId: 'SEER', target: 9 }));
    state = must(applyAction(state, { type: 'NIGHT_STEP_NEXT' }));
    state = must(applyAction(state, { type: 'NIGHT_ACTION', roleId: 'WOLF', target: 5 }));
    state = must(applyAction(state, { type: 'NIGHT_STEP_NEXT' }));
    state = must(applyAction(state, { type: 'NIGHT_ACTION', roleId: 'WITCH', target: null }));
  }
  return must(applyAction(state, { type: 'NIGHT_DONE' }));
}

function toSpeech(state: GameState): GameState {
  state = passNight(state);
  state = must(applyAction(state, { type: 'RESOLVE_WIN' }));

  if (state.phase === 'SHERIFF') {
    state = must(applyAction(state, { type: 'SHERIFF_SIGNUP', candidates: [] }));
    state = must(applyAction(state, { type: 'SHERIFF_DONE' }));
  }
  state = must(applyAction(state, { type: 'DAWN_DONE' }));
  state = must(applyAction(state, { type: 'RESOLVE_WIN' }));
  return state;
}

function toVote(state: GameState): GameState {
  state = toSpeech(state);
  return must(applyAction(state, { type: 'SPEECH_DONE' }));
}

describe('初始状态与发牌', () => {
  it('createGame 返回 SETUP 与 12 个未发牌座位', () => {
    const state = createGame();

    expect(state.phase).toBe('SETUP');
    expect(state.status).toBe('active');
    expect(state.round).toBe(1);
    expect(state.seats).toHaveLength(12);
    expect(state.seats.every((seat) => seat.alive && seat.role === null)).toBe(true);
    expect(state.options).toEqual({
      sheriffElection: true,
      witchSelfSaveFirstNight: true,
    });
  });

  it('SETUP 到 NIGHT：记录板子、模式、选项与身份映射', () => {
    const state = startedGame('pre-witch-hunter-idiot', { sheriffElection: false });

    expect(state.phase).toBe('NIGHT');
    expect(state.boardId).toBe('pre-witch-hunter-idiot');
    expect(state.dealMode).toBe('A');
    expect(state.round).toBe(1);
    expect(state.nightStep).toBe(0);
    expect(state.options.sheriffElection).toBe(false);
    expect(getCurrentNightRole(state)).toBe('SEER');
    expect(getSeat(state, 12)?.role).toBe('WOLF_KING');
  });

  it('拒绝角色构成不一致的发牌', () => {
    let state = createGame();
    state = must(
      applyAction(state, {
        type: 'START_DEAL',
        boardId: 'pre-witch-hunter-guard',
        dealMode: 'A',
      }),
    );
    const assignments = GUARD_ASSIGNMENTS.map((item) =>
      item.seatNo === 12 ? { ...item, roleId: 'VILLAGER' as const } : item,
    );

    expectError(applyAction(state, { type: 'DEAL_DONE', assignments }), 'INVALID_ASSIGNMENT');
  });

  it('拒绝缺座位的发牌', () => {
    let state = createGame();
    state = must(
      applyAction(state, {
        type: 'START_DEAL',
        boardId: 'pre-witch-hunter-guard',
        dealMode: 'B',
      }),
    );

    expectError(
      applyAction(state, {
        type: 'DEAL_DONE',
        assignments: GUARD_ASSIGNMENTS.slice(0, 11),
      }),
      'INVALID_ASSIGNMENT',
    );
  });

  it('拒绝非法阶段动作', () => {
    const state = createGame();
    expectError(
      applyAction(state, { type: 'NIGHT_ACTION', roleId: 'SEER', target: 1 }),
      'INVALID_STATE',
    );
    expectError(applyAction(state, { type: 'VOTE_CLOSE' }), 'INVALID_STATE');
  });
});

describe('夜间流程', () => {
  it('按夜序记录动作并在最后一步结束后进入 CHECK_WIN', () => {
    const state = passNight(startedGame());

    expect(state.phase).toBe('CHECK_WIN');
    expect(state.resumeTo).toBe('SHERIFF');
    expect(state.nightActions).toHaveLength(4);
    expect(state.nightActions.map((action) => action.roleId)).toEqual([
      'GUARD',
      'SEER',
      'WOLF',
      'WITCH',
    ]);
  });

  it('关闭竞选时夜晚结束直接回到 DAWN', () => {
    const state = passNight(startedGame('pre-witch-hunter-guard', { sheriffElection: false }));

    expect(state.phase).toBe('CHECK_WIN');
    expect(state.resumeTo).toBe('DAWN');
  });

  it('拒绝错误的夜间角色与空操作', () => {
    const state = startedGame();

    expectError(
      applyAction(state, { type: 'NIGHT_ACTION', roleId: 'SEER', target: 1 }),
      'INVALID_ROLE',
    );
    expectError(applyAction(state, { type: 'NIGHT_STEP_NEXT' }), 'NOT_ALLOWED');
    expectError(applyAction(state, { type: 'NIGHT_DONE' }), 'NOT_ALLOWED');
  });

  it('预言家必须选择目标，女巫药剂与目标需匹配', () => {
    let state = startedGame();
    state = must(applyAction(state, { type: 'NIGHT_ACTION', roleId: 'GUARD', target: 5 }));
    state = must(applyAction(state, { type: 'NIGHT_STEP_NEXT' }));

    expectError(
      applyAction(state, { type: 'NIGHT_ACTION', roleId: 'SEER', target: null }),
      'INVALID_TARGET',
    );
    state = must(applyAction(state, { type: 'NIGHT_ACTION', roleId: 'SEER', target: 9 }));
    state = must(applyAction(state, { type: 'NIGHT_STEP_NEXT' }));
    state = must(applyAction(state, { type: 'NIGHT_ACTION', roleId: 'WOLF', target: 5 }));
    state = must(applyAction(state, { type: 'NIGHT_STEP_NEXT' }));

    expectError(
      applyAction(state, {
        type: 'NIGHT_ACTION',
        roleId: 'WITCH',
        target: 5,
      }),
      'INVALID_ACTION',
    );
    expectError(
      applyAction(state, {
        type: 'NIGHT_ACTION',
        roleId: 'WITCH',
        target: null,
        potion: 'ANTIDOTE',
      }),
      'INVALID_TARGET',
    );

    state = must(
      applyAction(state, {
        type: 'NIGHT_ACTION',
        roleId: 'WITCH',
        target: 5,
        potion: 'ANTIDOTE',
      }),
    );
    expect(state.nightActions.at(-1)).toMatchObject({
      roleId: 'WITCH',
      target: 5,
      potion: 'ANTIDOTE',
    });
  });
});

describe('警长竞选', () => {
  it('无人上警时本局无警长并进入 DAWN', () => {
    let state = passNight(startedGame());
    state = must(applyAction(state, { type: 'RESOLVE_WIN' }));

    expect(state.phase).toBe('SHERIFF');
    expect(state.sheriffElection?.stage).toBe('signup');

    state = must(applyAction(state, { type: 'SHERIFF_SIGNUP', candidates: [] }));
    expect(state.sheriffElection?.stage).toBe('done');
    expect(state.sheriffElection?.elected).toBeNull();

    state = must(applyAction(state, { type: 'SHERIFF_DONE' }));
    expect(state.phase).toBe('DAWN');
    expect(state.sheriffNo).toBeNull();
  });

  it('报警下投票选出警长（警长 1 票）', () => {
    let state = passNight(startedGame());
    state = must(applyAction(state, { type: 'RESOLVE_WIN' }));
    state = must(applyAction(state, { type: 'SHERIFF_SIGNUP', candidates: [2, 5] }));
    state = must(applyAction(state, { type: 'SHERIFF_SPEECH_DONE' }));
    state = must(applyAction(state, { type: 'SHERIFF_WITHDRAW', withdrawn: [5] }));

    expect(state.sheriffElection?.stage).toBe('vote');
    expectError(
      applyAction(state, {
        type: 'SHERIFF_VOTE',
        ballots: [{ voter: 2, target: 2, weight: 1 }],
      }),
      'INVALID_VOTER',
    );

    state = must(
      applyAction(state, {
        type: 'SHERIFF_VOTE',
        ballots: [
          { voter: 1, target: 2, weight: 1 },
          { voter: 3, target: 2, weight: 1 },
          { voter: 4, target: null, weight: 1 },
        ],
      }),
    );
    expect(state.sheriffElection?.stage).toBe('done');
    expect(state.sheriffElection?.elected).toBe(2);
    expect(state.sheriffNo).toBe(2);
    expect(state.events.at(-1)).toMatchObject({ type: 'SHERIFF_ELECTED', seatNos: [2] });

    state = must(applyAction(state, { type: 'SHERIFF_DONE' }));
    expect(state.phase).toBe('DAWN');
    expect(state.sheriffNo).toBe(2);
  });

  it('平票进入 PK，再平则本局无警长', () => {
    let state = passNight(startedGame());
    state = must(applyAction(state, { type: 'RESOLVE_WIN' }));
    state = must(applyAction(state, { type: 'SHERIFF_SIGNUP', candidates: [2, 5] }));
    state = must(applyAction(state, { type: 'SHERIFF_SPEECH_DONE' }));
    state = must(applyAction(state, { type: 'SHERIFF_WITHDRAW', withdrawn: [] }));

    state = must(
      applyAction(state, {
        type: 'SHERIFF_VOTE',
        ballots: [
          { voter: 1, target: 2, weight: 1 },
          { voter: 3, target: 5, weight: 1 },
        ],
      }),
    );
    expect(state.sheriffElection?.stage).toBe('pk');
    expect(state.sheriffElection?.pkCandidates).toEqual([2, 5]);

    expectError(
      applyAction(state, {
        type: 'SHERIFF_VOTE',
        ballots: [{ voter: 1, target: 4, weight: 1 }],
      }),
      'INVALID_TARGET',
    );

    state = must(
      applyAction(state, {
        type: 'SHERIFF_VOTE',
        ballots: [
          { voter: 1, target: 2, weight: 1 },
          { voter: 3, target: 5, weight: 1 },
        ],
      }),
    );
    expect(state.sheriffElection?.stage).toBe('done');
    expect(state.sheriffElection?.elected).toBeNull();
    expect(state.sheriffNo).toBeNull();
    expect(state.events.at(-1)).toMatchObject({ type: 'SHERIFF_NONE' });
  });
});

describe('发言、投票与结算', () => {
  it('完整闭环：DAWN → SPEECH → VOTE → SETTLE → 下一夜', () => {
    let state = toVote(startedGame());

    expect(state.phase).toBe('VOTE');
    expect(state.voteRound).toBe(1);

    state = must(applyAction(state, { type: 'RECORD_BALLOT', voter: 1, target: 5 }));
    state = must(applyAction(state, { type: 'RECORD_BALLOT', voter: 2, target: 5 }));
    state = must(applyAction(state, { type: 'RECORD_BALLOT', voter: 4, target: null }));

    expect(state.ballots.find((ballot) => ballot.voter === 2)?.weight).toBe(1);

    state = must(applyAction(state, { type: 'VOTE_CLOSE' }));
    expect(state.phase).toBe('SETTLE');
    expect(state.exiledSeat).toBe(5);
    expect(state.events.at(-1)).toMatchObject({ type: 'EXILE', seatNos: [5] });

    state = must(applyAction(state, { type: 'RESOLVE_EXILE' }));
    expect(getSeat(state, 5)?.alive).toBe(false);
    expect(getSeat(state, 5)?.deathCause).toBe('VOTE');

    state = must(applyAction(state, { type: 'SETTLE_DONE' }));
    expect(state.phase).toBe('CHECK_WIN');
    expect(state.resumeTo).toBe('NIGHT');

    state = must(applyAction(state, { type: 'RESOLVE_WIN' }));
    expect(state.phase).toBe('NIGHT');
    expect(state.round).toBe(2);
    expect(state.nightStep).toBe(0);
  });

  it('警长放逐票按 1.5 计，重复录入覆盖同一票', () => {
    let state = passNight(startedGame());
    state = must(applyAction(state, { type: 'RESOLVE_WIN' }));
    state = must(applyAction(state, { type: 'SHERIFF_SIGNUP', candidates: [2] }));
    state = must(applyAction(state, { type: 'SHERIFF_SPEECH_DONE' }));
    state = must(applyAction(state, { type: 'SHERIFF_WITHDRAW', withdrawn: [] }));
    state = must(
      applyAction(state, {
        type: 'SHERIFF_VOTE',
        ballots: [
          { voter: 1, target: 2, weight: 1 },
          { voter: 3, target: 2, weight: 1 },
        ],
      }),
    );
    state = must(applyAction(state, { type: 'SHERIFF_DONE' }));
    state = must(applyAction(state, { type: 'DAWN_DONE' }));
    state = must(applyAction(state, { type: 'RESOLVE_WIN' }));
    state = must(applyAction(state, { type: 'SPEECH_DONE' }));

    expect(state.sheriffNo).toBe(2);

    state = must(applyAction(state, { type: 'RECORD_BALLOT', voter: 2, target: 3 }));
    state = must(applyAction(state, { type: 'RECORD_BALLOT', voter: 1, target: 3 }));
    state = must(applyAction(state, { type: 'RECORD_BALLOT', voter: 1, target: 4 }));

    expect(state.ballots).toHaveLength(2);
    expect(state.ballots.find((ballot) => ballot.voter === 2)).toMatchObject({
      target: 3,
      weight: 1.5,
    });
    expect(state.ballots.find((ballot) => ballot.voter === 1)).toMatchObject({
      target: 4,
      weight: 1,
    });
  });

  it('平票进入 PK，再平则本轮无人出局', () => {
    let state = toVote(startedGame('pre-witch-hunter-guard', { sheriffElection: false }));

    state = must(applyAction(state, { type: 'RECORD_BALLOT', voter: 1, target: 3 }));
    state = must(applyAction(state, { type: 'RECORD_BALLOT', voter: 2, target: 4 }));
    state = must(applyAction(state, { type: 'VOTE_CLOSE' }));

    expect(state.phase).toBe('VOTE');
    expect(state.voteRound).toBe(2);
    expect(state.pkCandidates).toEqual([3, 4]);
    expect(state.ballots).toHaveLength(0);

    expectError(
      applyAction(state, { type: 'RECORD_BALLOT', voter: 1, target: 5 }),
      'INVALID_TARGET',
    );
    state = must(applyAction(state, { type: 'RECORD_BALLOT', voter: 1, target: 3 }));
    state = must(applyAction(state, { type: 'RECORD_BALLOT', voter: 2, target: 4 }));
    state = must(applyAction(state, { type: 'VOTE_CLOSE' }));

    expect(state.phase).toBe('SETTLE');
    expect(state.exiledSeat).toBeNull();
    expect(state.events.at(-1)).toMatchObject({ type: 'NO_EXILE' });
  });

  it('白痴翻牌后无放逐投票权', () => {
    let state = createGame('pre-witch-hunter-idiot');
    state = must(
      applyAction(state, {
        type: 'START_DEAL',
        boardId: 'pre-witch-hunter-idiot',
        dealMode: 'C',
      }),
    );
    state = must(
      applyAction(state, {
        type: 'DEAL_DONE',
        assignments: IDIOT_ASSIGNMENTS,
      }),
    );
    state = toVote(state);
    state = {
      ...state,
      seats: state.seats.map((seat) => (seat.no === 4 ? { ...seat, idiotRevealed: true } : seat)),
    };

    expect(getSeat(state, 4)?.role).toBe('IDIOT');
    expectError(
      applyAction(state, { type: 'RECORD_BALLOT', voter: 4, target: 9 }),
      'INVALID_VOTER',
    );
  });
});

describe('自爆中断', () => {
  it('发言阶段自爆出局并交给 CHECK_WIN', () => {
    let state = toSpeech(startedGame());

    state = must(applyAction(state, { type: 'SELF_EXPLODE', seatNo: 10 }));
    expect(state.phase).toBe('SELF_EXPLODE');
    expect(getSeat(state, 10)?.alive).toBe(false);
    expect(getSeat(state, 10)?.deathCause).toBe('SELF_EXPLODE');
    expect(state.interruptedPhase).toBe('SPEECH');
    expect(state.events.at(-1)).toMatchObject({ type: 'SELF_EXPLODE', seatNos: [10] });

    state = must(applyAction(state, { type: 'EXPLODE_RESOLVED' }));
    expect(state.phase).toBe('CHECK_WIN');
    expect(state.resumeTo).toBe('NIGHT');

    state = must(applyAction(state, { type: 'RESOLVE_WIN' }));
    expect(state.phase).toBe('NIGHT');
    expect(state.round).toBe(2);
  });

  it('竞选阶段自爆吞警徽', () => {
    let state = passNight(startedGame());
    state = must(applyAction(state, { type: 'RESOLVE_WIN' }));
    state = must(applyAction(state, { type: 'SHERIFF_SIGNUP', candidates: [9] }));
    state = must(applyAction(state, { type: 'SHERIFF_SPEECH_DONE' }));
    state = must(applyAction(state, { type: 'SELF_EXPLODE', seatNo: 9 }));

    expect(state.phase).toBe('SELF_EXPLODE');
    expect(state.sheriffNo).toBeNull();
    expect(state.sheriffElection?.stage).toBe('done');
    expect(state.sheriffElection?.elected).toBeNull();

    state = must(applyAction(state, { type: 'EXPLODE_RESOLVED' }));
    state = must(applyAction(state, { type: 'RESOLVE_WIN' }));
    expect(state.phase).toBe('NIGHT');
    expect(state.round).toBe(2);
  });

  it('拒绝非狼人自爆与胜负确认前的自爆', () => {
    let state = toSpeech(startedGame());
    expectError(applyAction(state, { type: 'SELF_EXPLODE', seatNo: 1 }), 'INVALID_ROLE');

    state = passNight(startedGame());
    expectError(applyAction(state, { type: 'SELF_EXPLODE', seatNo: 9 }), 'INVALID_STATE');
  });
});

describe('结果与快照', () => {
  it('CHECK_WIN 按屠边判定胜利后进入只读 RESULT', () => {
    let goodWin = passNight(startedGame());
    goodWin = {
      ...goodWin,
      seats: goodWin.seats.map((seat) =>
        seat.role && ROLE_DEFINITIONS[seat.role].camp === 'wolf'
          ? { ...seat, alive: false, deathCause: 'POISON', deathRound: 1 }
          : seat,
      ),
    };
    goodWin = must(applyAction(goodWin, { type: 'RESOLVE_WIN' }));
    expect(goodWin.phase).toBe('RESULT');
    expect(goodWin.status).toBe('finished');
    expect(goodWin.result).toEqual({ winner: 'good', round: 1 });
    expectError(applyAction(goodWin, { type: 'RESOLVE_WIN' }), 'INVALID_STATE');

    let wolfWin = passNight(startedGame());
    wolfWin = {
      ...wolfWin,
      seats: wolfWin.seats.map((seat) =>
        seat.role && ROLE_DEFINITIONS[seat.role].kind === 'god'
          ? { ...seat, alive: false, deathCause: 'WOLF', deathRound: 1 }
          : seat,
      ),
    };
    wolfWin = must(applyAction(wolfWin, { type: 'RESOLVE_WIN' }));
    expect(wolfWin.phase).toBe('RESULT');
    expect(wolfWin.result).toEqual({ winner: 'wolf', round: 1 });
  });

  it('快照为深拷贝，可回退还原', () => {
    const state = toVote(startedGame());
    const snapshot = createSnapshot(state);

    expect(snapshot).toEqual(state);
    expect(snapshot.seats).not.toBe(state.seats);
    expect(snapshot.seats[0]).not.toBe(state.seats[0]);

    let advanced = must(applyAction(state, { type: 'RECORD_BALLOT', voter: 1, target: 3 }));
    advanced = must(applyAction(advanced, { type: 'VOTE_CLOSE' }));
    expect(advanced.phase).toBe('SETTLE');

    const restored = restoreSnapshot(snapshot);
    expect(restored.phase).toBe('VOTE');
    expect(restored.ballots).toHaveLength(0);
    expect(restored).not.toBe(snapshot);
    expect(restored.seats[1]).not.toBe(snapshot.seats[1]);
  });
});
