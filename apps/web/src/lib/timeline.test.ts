import { createGame, type GameState, type PlayerView } from '@lrs/game-engine';
import { describe, expect, it } from 'vitest';

import { buildHostTimeline, buildPlayerTimeline } from './timeline';

function hostGame(): GameState {
  const base = createGame();
  return {
    ...base,
    phase: 'RESULT',
    status: 'finished',
    round: 2,
    result: { winner: 'good', round: 2 },
    nightActions: [
      { round: 1, step: 0, roleId: 'GUARD', target: 5, potion: null },
      { round: 1, step: 1, roleId: 'SEER', target: 9, potion: null },
      { round: 1, step: 2, roleId: 'WOLF', target: 5, potion: null },
      { round: 1, step: 3, roleId: 'WITCH', target: 5, potion: 'ANTIDOTE' },
      { round: 2, step: 1, roleId: 'SEER', target: 10, potion: null },
    ],
    events: [
      { seq: 1, round: 1, phase: 'NIGHT', type: 'NO_DEATH', seatNos: [] },
      { seq: 2, round: 1, phase: 'SHERIFF', type: 'SHERIFF_ELECTED', seatNos: [1] },
      { seq: 3, round: 2, phase: 'VOTE', type: 'EXILE', seatNos: [9] },
    ],
    seats: base.seats.map((seat) =>
      seat.no === 9
        ? { ...seat, role: 'WOLF', alive: false, deathCause: 'VOTE', deathRound: 2 }
        : seat.no === 10
          ? { ...seat, role: 'WOLF' }
          : seat,
    ),
  };
}

describe('复盘时间线', () => {
  it('主持端按夜/天分组，默认展开最近一夜，夜间动作标记私密', () => {
    const groups = buildHostTimeline(hostGame());
    expect(groups.map((group) => group.title)).toEqual([
      '第 1 夜',
      '第 1 天',
      '第 2 夜',
      '第 2 天',
    ]);
    expect(groups.find((group) => group.key === '2:night')?.defaultOpen).toBe(true);
    expect(groups.find((group) => group.key === '1:night')?.defaultOpen).toBe(false);

    const firstNight = groups.find((group) => group.key === '1:night');
    expect(firstNight?.entries[0]).toMatchObject({
      text: '守卫：守护 5 号',
      visibility: 'private',
    });
    expect(firstNight?.entries.at(-1)).toMatchObject({
      text: '第 1 夜 · 平安夜',
      visibility: 'public',
    });
  });

  it('玩家端只合并公开事件与本人夜间动作', () => {
    const view: PlayerView = {
      phase: 'RESULT',
      round: 2,
      status: 'finished',
      alive: [1, 2, 3, 4, 5, 6, 7, 8],
      sheriffNo: 1,
      events: [
        { seq: 1, round: 1, phase: 'NIGHT', type: 'NO_DEATH', seatNos: [] },
        { seq: 2, round: 1, phase: 'SHERIFF', type: 'SHERIFF_ELECTED', seatNos: [1] },
      ],
      result: { winner: 'good', round: 2 },
      mySeat: 1,
      role: 'SEER',
      checks: [{ target: 9, result: 'WOLF' }],
      privateActions: [
        { round: 1, step: 1, roleId: 'SEER', target: 9, potion: null, result: 'WOLF' },
      ],
    };

    const groups = buildPlayerTimeline(view);
    expect(groups.map((group) => group.title)).toEqual(['第 1 夜', '第 1 天']);
    const night = groups[0];
    expect(night?.entries[0]).toMatchObject({
      text: '你（预言家）：查验 9 号（狼人）',
      visibility: 'private',
    });
    const serialized = JSON.stringify(groups);
    expect(serialized).not.toContain('守卫：');
    expect(serialized).not.toContain('狼人：刀');
    expect(serialized).not.toContain('女巫：');
  });

  it('没有可展示内容时返回空数组', () => {
    const view: PlayerView = {
      phase: 'NIGHT',
      round: 1,
      status: 'active',
      alive: [1, 2],
      sheriffNo: null,
      events: [],
      result: null,
      mySeat: 5,
      role: 'VILLAGER',
    };
    expect(buildPlayerTimeline(view)).toEqual([]);
  });
});
