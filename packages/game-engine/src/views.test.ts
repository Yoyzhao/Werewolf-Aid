import { describe, expect, it } from 'vitest';

import { getBoard, type BoardId } from './boards.js';
import { createGame, type GameState } from './state-machine.js';
import { applyAction } from './state-machine.js';
import { buildPrivateView, buildPublicView, buildViews, validateGameState } from './views.js';

function dealtState(boardId: BoardId = 'pre-witch-hunter-guard'): GameState {
  const board = getBoard(boardId);
  const assignments = board.roles
    .flatMap((slot) => Array.from({ length: slot.count }, () => slot.roleId))
    .map((roleId, index) => ({ seatNo: index + 1, roleId }));

  const started = applyAction(createGame(boardId), {
    type: 'START_DEAL',
    boardId,
    dealMode: 'C',
  });
  if (!started.ok) throw new Error(started.message);

  const dealt = applyAction(started.state, { type: 'DEAL_DONE', assignments });
  if (!dealt.ok) throw new Error(dealt.message);
  return dealt.state;
}

function withNightActions(state: GameState, actions: GameState['nightActions']): GameState {
  return { ...state, nightActions: [...state.nightActions, ...actions] };
}

describe('validateGameState', () => {
  it('接受合法的 SETUP 与已发牌状态', () => {
    expect(validateGameState(createGame()).valid).toBe(true);
    expect(validateGameState(dealtState()).valid).toBe(true);
  });

  it('拒绝重复座位号', () => {
    const state = dealtState();
    const seats = state.seats.map((seat, index) => (index === 1 ? { ...seat, no: 1 } : seat));
    const result = validateGameState({ ...state, seats });
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === 'INVALID_SEATS')).toBe(true);
  });

  it('拒绝与板子不一致的角色构成', () => {
    const state = dealtState();
    const seats = state.seats.map((seat, index) =>
      index === 0 ? { ...seat, role: 'VILLAGER' as const } : seat,
    );
    const result = validateGameState({ ...state, seats });
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === 'INVALID_ROLES')).toBe(true);
  });

  it('拒绝未结束却带结果、已结束却缺结果', () => {
    const state = dealtState();
    expect(
      validateGameState({
        ...state,
        phase: 'RESULT',
        status: 'active',
        result: null,
      }).valid,
    ).toBe(false);
    expect(
      validateGameState({
        ...state,
        phase: 'RESULT',
        status: 'finished',
        result: null,
      }).issues.some((issue) => issue.code === 'INVALID_RESULT'),
    ).toBe(true);
  });

  it('拒绝非法夜间动作目标与事件座位', () => {
    const state = withNightActions(dealtState(), [
      { round: 1, step: 1, roleId: 'SEER', target: 99, potion: null },
    ]);
    expect(validateGameState(state).valid).toBe(false);

    const badEvent: GameState = {
      ...dealtState(),
      events: [{ seq: 1, round: 1, phase: 'NIGHT', type: 'DEATH', seatNos: [99] }],
    };
    expect(validateGameState(badEvent).valid).toBe(false);
  });
});

describe('buildPublicView / buildPrivateView', () => {
  it('公开视图不泄露身份，结算后揭晓全部身份', () => {
    const state = dealtState();
    const publicView = buildPublicView(state);
    expect(publicView.alive).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(publicView.revealedRoles).toBeUndefined();
    expect(JSON.stringify(publicView)).not.toContain('WOLF');

    const finished: GameState = {
      ...state,
      phase: 'RESULT',
      status: 'finished',
      result: { winner: 'good', round: 1 },
    };
    const revealed = buildPublicView(finished);
    expect(revealed.revealedRoles).toHaveLength(12);
    expect(revealed.result).toEqual({ winner: 'good', round: 1 });
  });

  it('预言家只看到自己的查验结果', () => {
    const state = withNightActions(dealtState(), [
      { round: 1, step: 1, roleId: 'SEER', target: 9, potion: null },
    ]);
    const view = buildPrivateView(state, 1);
    expect(view?.role).toBe('SEER');
    expect(view?.checks).toEqual([{ target: 9, result: 'WOLF' }]);
    expect(view?.teammates).toBeUndefined();
    expect(view?.potions).toBeUndefined();
    expect(JSON.stringify(view)).not.toContain('"role":"WOLF"');
  });

  it('狼人看到狼队友，看不到查验与药剂', () => {
    const view = buildPrivateView(dealtState(), 9);
    expect(view?.role).toBe('WOLF');
    expect(view?.teammates).toEqual([10, 11, 12]);
    expect(view?.checks).toBeUndefined();
    expect(view?.potions).toBeUndefined();
  });

  it('女巫药剂状态随使用更新', () => {
    const fresh = buildPrivateView(dealtState(), 2);
    expect(fresh?.potions).toEqual({ antidote: true, poison: true });

    const used = withNightActions(dealtState(), [
      { round: 1, step: 3, roleId: 'WITCH', target: 9, potion: 'ANTIDOTE' },
    ]);
    expect(buildPrivateView(used, 2)?.potions).toEqual({ antidote: false, poison: true });
  });

  it('守卫看到自己的守护记录，平民没有私有字段', () => {
    const state = withNightActions(dealtState(), [
      { round: 1, step: 0, roleId: 'GUARD', target: 5, potion: null },
    ]);
    expect(buildPrivateView(state, 4)?.guarded).toEqual([{ round: 1, target: 5 }]);

    const villager = buildPrivateView(state, 5);
    expect(villager?.role).toBe('VILLAGER');
    expect(villager?.checks).toBeUndefined();
    expect(villager?.teammates).toBeUndefined();
    expect(villager?.potions).toBeUndefined();
    expect(villager?.guarded).toBeUndefined();
  });

  it('私有夜间动作只包含本人角色，狼队共享刀人', () => {
    const state = withNightActions(dealtState(), [
      { round: 1, step: 0, roleId: 'GUARD', target: 5, potion: null },
      { round: 1, step: 1, roleId: 'SEER', target: 9, potion: null },
      { round: 1, step: 2, roleId: 'WOLF', target: 5, potion: null },
      { round: 2, step: 3, roleId: 'WITCH', target: 3, potion: 'POISON' },
    ]);

    expect(buildPrivateView(state, 1)?.privateActions).toEqual([
      { round: 1, step: 1, roleId: 'SEER', target: 9, potion: null, result: 'WOLF' },
    ]);
    expect(buildPrivateView(state, 4)?.privateActions).toEqual([
      { round: 1, step: 0, roleId: 'GUARD', target: 5, potion: null },
    ]);
    expect(buildPrivateView(state, 2)?.privateActions).toEqual([
      { round: 2, step: 3, roleId: 'WITCH', target: 3, potion: 'POISON' },
    ]);
    expect(buildPrivateView(state, 9)?.privateActions).toEqual([
      { round: 1, step: 2, roleId: 'WOLF', target: 5, potion: null },
    ]);

    const villager = buildPrivateView(state, 5);
    expect(villager?.privateActions).toBeUndefined();
    expect(JSON.stringify(villager)).not.toContain('privateActions');
  });

  it('未发牌座位返回 null，buildViews 生成 12 个私有视图', () => {
    expect(buildPrivateView(createGame(), 1)).toBeNull();

    const views = buildViews(dealtState());
    expect(Object.keys(views.privateViews)).toHaveLength(12);
    expect(views.publicView.revealedRoles).toBeUndefined();
    expect(views.privateViews[1]?.mySeat).toBe(1);
    expect(views.privateViews[12]?.mySeat).toBe(12);
  });

  it('白狼王板子的狼队视图包含白狼王', () => {
    const state = dealtState('pre-witch-hunter-idiot');
    const wolfSeat = state.seats.find((seat) => seat.role === 'WOLF')?.no as number;
    const kingSeat = state.seats.find((seat) => seat.role === 'WOLF_KING')?.no as number;
    const view = buildPrivateView(state, wolfSeat);
    expect(view?.teammates).toContain(kingSeat);
    expect(view?.teammates).toHaveLength(3);
  });
});
