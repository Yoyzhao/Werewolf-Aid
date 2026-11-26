import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyAction,
  createGame,
  type ApplyActionResult,
  type BoardId,
  type GameState,
  type RoleId,
} from '@lrs/game-engine';

import App from './App';
import { clearGameRecord } from './lib/storage';
import type { View } from './lib/types';
import { useGameStore } from './stores/game-store';

const GUARD_BOARD: BoardId = 'pre-witch-hunter-guard';
const IDIOT_BOARD: BoardId = 'pre-witch-hunter-idiot';

const GUARD_LINEUP: readonly RoleId[] = [
  'GUARD',
  'SEER',
  'WITCH',
  'HUNTER',
  'VILLAGER',
  'VILLAGER',
  'VILLAGER',
  'VILLAGER',
  'WOLF',
  'WOLF',
  'WOLF',
  'WOLF',
];

const IDIOT_LINEUP: readonly RoleId[] = [
  'SEER',
  'WITCH',
  'HUNTER',
  'IDIOT',
  'VILLAGER',
  'VILLAGER',
  'VILLAGER',
  'VILLAGER',
  'WOLF',
  'WOLF',
  'WOLF',
  'WOLF_KING',
];

function must(result: ApplyActionResult): GameState {
  if (!result.ok) throw new Error(result.message);
  return result.state;
}

function createDealtGame(boardId: BoardId, lineup: readonly RoleId[]): GameState {
  const created = createGame(boardId, { sheriffElection: false });
  const started = must(
    applyAction(created, {
      type: 'START_DEAL',
      boardId,
      dealMode: 'C',
      options: created.options,
    }),
  );
  return must(
    applyAction(started, {
      type: 'DEAL_DONE',
      assignments: lineup.map((roleId, index) => ({ seatNo: index + 1, roleId })),
    }),
  );
}

function toVote(game: GameState, overrides?: Partial<GameState>): GameState {
  return {
    ...game,
    phase: 'VOTE',
    round: 1,
    nightStep: 0,
    ballots: [],
    pkCandidates: [],
    voteRound: 1,
    exiledSeat: null,
    exileResolved: false,
    lastNightDeaths: [],
    events: [],
    ...overrides,
  };
}

function seedGame(game: GameState, view: Extract<View, 'night' | 'vote' | 'result'>): void {
  useGameStore.setState({
    initialized: true,
    view,
    boardId: game.boardId,
    dealMode: game.dealMode,
    options: game.options,
    game,
    history: [],
    draft: null,
    resumeRecord: null,
    resumeIncompatible: false,
    storageError: false,
    guideOpen: false,
  });
}

async function clickSeat(groupName: string, seatNo: number): Promise<void> {
  const group = screen.getByRole('group', { name: groupName });
  const code = String(seatNo).padStart(2, '0');
  const button = within(group)
    .getAllByRole('button')
    .find((item) => item.textContent?.startsWith(code));
  if (!button) throw new Error(`未找到 ${groupName} 中的 ${seatNo} 号座位`);
  await userEvent.click(button);
}

async function fillQuickVotes(target: number): Promise<void> {
  await userEvent.click(screen.getByRole('button', { name: '快速归票' }));
  await userEvent.click(screen.getByRole('button', { name: `${target} 号` }));
  const fill = screen.getByRole('button', { name: new RegExp(`^归票给 ${target} 号`) });
  await userEvent.click(fill);
}

async function confirmVoteSubmit(): Promise<void> {
  await userEvent.click(screen.getByRole('button', { name: '放逐并检查胜负' }));
  const dialog = await screen.findByRole('dialog');
  await userEvent.click(within(dialog).getByRole('button', { name: '放逐并检查胜负' }));
}

beforeEach(async () => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  await clearGameRecord();
  useGameStore.setState(useGameStore.getInitialState(), true);
  window.localStorage.setItem('lrs.guide.v1', '1');
});

describe('放逐投票', () => {
  it('逐票录入显示警长 1.5 票，快速归票后放逐进入下一夜', async () => {
    seedGame(toVote(createDealtGame(GUARD_BOARD, GUARD_LINEUP), { sheriffNo: 1 }), 'vote');
    render(<App />);

    expect(await screen.findByRole('heading', { name: '放逐投票' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '还有 12 位未录票' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: '投 5' }));
    expect(screen.getByText('5 号 · 1.5 票')).toBeInTheDocument();
    expect(screen.getByText('已录 1 / 12')).toBeInTheDocument();

    await fillQuickVotes(6);
    expect(screen.getByText('6 号 · 11 票')).toBeInTheDocument();

    const sheriffBallot = useGameStore
      .getState()
      .game?.ballots.find((ballot) => ballot.voter === 1);
    expect(sheriffBallot?.weight).toBe(1.5);

    await confirmVoteSubmit();
    expect(await screen.findByRole('heading', { name: '放逐结果' })).toBeInTheDocument();
    expect(screen.getByText('6 号被放逐')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '结束放逐，检查胜负' }));
    expect(await screen.findByRole('heading', { name: '天黑请闭眼' })).toBeInTheDocument();
    expect(useGameStore.getState().game?.round).toBe(2);
  });

  it('平票进入 PK 复投，再平本轮无人出局', async () => {
    seedGame(toVote(createDealtGame(GUARD_BOARD, GUARD_LINEUP)), 'vote');
    render(<App />);

    await screen.findByRole('heading', { name: '放逐投票' });
    for (let index = 0; index < 6; index += 1) {
      await userEvent.click(screen.getByRole('button', { name: '投 5' }));
    }
    for (let index = 0; index < 6; index += 1) {
      await userEvent.click(screen.getByRole('button', { name: '投 6' }));
    }
    await confirmVoteSubmit();

    expect(await screen.findByText(/平票：5 号、6 号/)).toBeInTheDocument();
    expect(useGameStore.getState().game?.voteRound).toBe(2);
    expect(screen.queryByRole('button', { name: '投 7' })).not.toBeInTheDocument();

    for (let index = 0; index < 6; index += 1) {
      await userEvent.click(screen.getByRole('button', { name: '投 5' }));
    }
    for (let index = 0; index < 6; index += 1) {
      await userEvent.click(screen.getByRole('button', { name: '投 6' }));
    }
    await confirmVoteSubmit();

    expect(await screen.findByText('本轮无人出局')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '结束放逐，检查胜负' }));
    expect(await screen.findByRole('heading', { name: '天黑请闭眼' })).toBeInTheDocument();
    expect(useGameStore.getState().game?.seats.every((seat) => seat.alive)).toBe(true);
  });

  it('白痴翻牌后无投票权且不再成为目标', async () => {
    const base = toVote(createDealtGame(IDIOT_BOARD, IDIOT_LINEUP));
    seedGame(
      {
        ...base,
        seats: base.seats.map((seat) => (seat.no === 4 ? { ...seat, idiotRevealed: true } : seat)),
      },
      'vote',
    );
    render(<App />);

    await screen.findByRole('heading', { name: '放逐投票' });
    expect(screen.getByText('已录 0 / 11')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '投 4' })).not.toBeInTheDocument();
  });

  it('白痴被放逐翻牌免死并失去投票权', async () => {
    seedGame(toVote(createDealtGame(IDIOT_BOARD, IDIOT_LINEUP)), 'vote');
    render(<App />);

    await screen.findByRole('heading', { name: '放逐投票' });
    await fillQuickVotes(4);
    await confirmVoteSubmit();

    expect(await screen.findByText('白痴翻牌：免死、保留发言、失去投票权。')).toBeInTheDocument();
    const idiot = useGameStore.getState().game?.seats.find((seat) => seat.no === 4);
    expect(idiot?.alive).toBe(true);
    expect(idiot?.idiotRevealed).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: '结束放逐，检查胜负' }));
    expect(await screen.findByRole('heading', { name: '天黑请闭眼' })).toBeInTheDocument();
  });

  it('猎人被放逐可开枪，警长死亡可移交警徽', async () => {
    seedGame(toVote(createDealtGame(GUARD_BOARD, GUARD_LINEUP), { sheriffNo: 4 }), 'vote');
    render(<App />);

    await screen.findByRole('heading', { name: '放逐投票' });
    await fillQuickVotes(4);
    await confirmVoteSubmit();

    expect(await screen.findByRole('heading', { name: '放逐结果' })).toBeInTheDocument();
    expect(screen.getByText('警徽处理')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '先处理技能与警徽' })).toBeDisabled();

    await clickSeat('猎人开枪目标', 9);
    await userEvent.click(screen.getByRole('button', { name: '确认开枪' }));

    await clickSeat('警徽继任目标', 2);
    await userEvent.click(screen.getByRole('button', { name: '移交警徽' }));
    expect(useGameStore.getState().game?.sheriffNo).toBe(2);

    await userEvent.click(screen.getByRole('button', { name: '结束放逐，检查胜负' }));
    expect(await screen.findByRole('heading', { name: '天黑请闭眼' })).toBeInTheDocument();
    const state = useGameStore.getState().game;
    expect(state?.round).toBe(2);
    expect(state?.seats.find((seat) => seat.no === 4)?.alive).toBe(false);
    expect(state?.seats.find((seat) => seat.no === 9)?.alive).toBe(false);
  });
});

describe('回退一步', () => {
  it('夜间推进后可回退，快照随对局落库', async () => {
    seedGame(createDealtGame(GUARD_BOARD, GUARD_LINEUP), 'night');
    render(<App />);

    await screen.findByRole('heading', { name: '天黑请闭眼' });
    await userEvent.click(screen.getByRole('button', { name: '空守' }));
    await userEvent.click(screen.getByRole('button', { name: '确认，下一位' }));
    expect(await screen.findByText('预言家请睁眼，请选择你要查验的人')).toBeInTheDocument();
    expect(useGameStore.getState().history).toHaveLength(1);
    expect(useGameStore.getState().resumeRecord?.history).toHaveLength(1);

    await userEvent.click(screen.getByRole('button', { name: '回退一步' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: '回退' }));

    expect(await screen.findByText('守卫请睁眼，请选择你要守护的人')).toBeInTheDocument();
    expect(useGameStore.getState().game?.nightStep).toBe(0);
    expect(useGameStore.getState().resumeRecord?.history).toHaveLength(0);
  });
});

describe('结算页', () => {
  function resultGame(): GameState {
    const base = createDealtGame(GUARD_BOARD, GUARD_LINEUP);
    return {
      ...base,
      phase: 'RESULT',
      status: 'finished',
      round: 2,
      seats: base.seats.map((seat) =>
        seat.no >= 9 ? { ...seat, alive: false, deathCause: 'VOTE' as const, deathRound: 2 } : seat,
      ),
      result: { winner: 'good', round: 2 },
      nightActions: [
        { round: 1, step: 0, roleId: 'GUARD', target: 5, potion: null },
        { round: 1, step: 1, roleId: 'SEER', target: 9, potion: null },
        { round: 1, step: 2, roleId: 'WOLF', target: 5, potion: null },
        { round: 1, step: 3, roleId: 'WITCH', target: 5, potion: 'ANTIDOTE' },
      ],
      events: [
        { seq: 1, round: 1, phase: 'NIGHT', type: 'NO_DEATH', seatNos: [] },
        { seq: 2, round: 1, phase: 'SHERIFF', type: 'SHERIFF_ELECTED', seatNos: [1] },
        { seq: 3, round: 2, phase: 'VOTE', type: 'EXILE', seatNos: [9] },
        { seq: 4, round: 2, phase: 'SETTLE', type: 'DEATH', seatNos: [9], cause: 'VOTE' },
      ],
    };
  }

  it('展示胜负、身份、逐夜记录与关键事件，且不可回退', async () => {
    seedGame(resultGame(), 'result');
    render(<App />);

    expect(await screen.findByRole('heading', { name: '结算' })).toBeInTheDocument();
    expect(screen.getByText('好人阵营胜利')).toBeInTheDocument();
    expect(screen.getByText('狼人全部出局')).toBeInTheDocument();
    expect(screen.getByText('预言家：查验 9 号（狼人）')).toBeInTheDocument();
    expect(screen.getByText('女巫：解药救 5 号')).toBeInTheDocument();
    expect(screen.getByText(/放逐投票最高票：9 号/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '回退一步' })).not.toBeInTheDocument();
  });

  it('再来一局回到开局设置并清空本局', async () => {
    seedGame(resultGame(), 'result');
    render(<App />);

    await screen.findByRole('heading', { name: '结算' });
    await userEvent.click(screen.getByRole('button', { name: '再来一局' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: '再来一局' }));

    expect(await screen.findByRole('heading', { name: '开局设置' })).toBeInTheDocument();
    const state = useGameStore.getState();
    expect(state.game).toBeNull();
    expect(state.resumeRecord).toBeNull();
  });

  it('清除本局返回首页并删除本地对局', async () => {
    seedGame(resultGame(), 'result');
    render(<App />);

    await screen.findByRole('heading', { name: '结算' });
    await userEvent.click(screen.getByRole('button', { name: '清除本局' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: '清除' }));

    expect(await screen.findByRole('heading', { name: '狼人杀助手' })).toBeInTheDocument();
    expect(useGameStore.getState().game).toBeNull();
    expect(useGameStore.getState().resumeRecord).toBeNull();
  });
});
