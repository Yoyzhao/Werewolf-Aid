import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyAction,
  createGame,
  type ApplyActionResult,
  type GameAction,
  type GameState,
  type RoleId,
  type WitchPotion,
} from '@lrs/game-engine';

import App from './App';
import { clearGameRecord } from './lib/storage';
import type { View } from './lib/types';
import { useGameStore } from './stores/game-store';

const BOARD_ID = 'pre-witch-hunter-guard' as const;

const ROLE_LINEUP: readonly RoleId[] = [
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

function must(result: ApplyActionResult): GameState {
  if (!result.ok) throw new Error(result.message);
  return result.state;
}

function doAction(state: GameState, action: GameAction): GameState {
  return must(applyAction(state, action));
}

function createDealtGame(options?: {
  readonly sheriffElection?: boolean;
  readonly witchSelfSaveFirstNight?: boolean;
}): GameState {
  const created = createGame(BOARD_ID, options);
  const started = doAction(created, {
    type: 'START_DEAL',
    boardId: BOARD_ID,
    dealMode: 'C',
    options: created.options,
  });
  return doAction(started, {
    type: 'DEAL_DONE',
    assignments: ROLE_LINEUP.map((roleId, index) => ({ seatNo: index + 1, roleId })),
  });
}

interface NightInput {
  readonly guard: number | null;
  readonly seer: number;
  readonly wolf: number | null;
  readonly witch?: { readonly target: number; readonly potion: WitchPotion };
}

function playNight(state: GameState, input: NightInput): GameState {
  let next = doAction(state, { type: 'NIGHT_ACTION', roleId: 'GUARD', target: input.guard });
  next = doAction(next, { type: 'NIGHT_STEP_NEXT' });
  next = doAction(next, { type: 'NIGHT_ACTION', roleId: 'SEER', target: input.seer });
  next = doAction(next, { type: 'NIGHT_STEP_NEXT' });
  next = doAction(next, { type: 'NIGHT_ACTION', roleId: 'WOLF', target: input.wolf });
  next = doAction(next, { type: 'NIGHT_STEP_NEXT' });
  next = input.witch
    ? doAction(next, {
        type: 'NIGHT_ACTION',
        roleId: 'WITCH',
        target: input.witch.target,
        potion: input.witch.potion,
      })
    : doAction(next, { type: 'NIGHT_ACTION', roleId: 'WITCH', target: null });
  return doAction(next, { type: 'NIGHT_DONE' });
}

function resolveCheckWin(state: GameState): GameState {
  return doAction(state, { type: 'RESOLVE_WIN' });
}

function electSheriff(state: GameState, seatNo: number): GameState {
  let next = doAction(state, { type: 'SHERIFF_SIGNUP', candidates: [seatNo] });
  next = doAction(next, { type: 'SHERIFF_SPEECH_DONE' });
  next = doAction(next, { type: 'SHERIFF_WITHDRAW', withdrawn: [] });
  const ballots = next.seats
    .filter((seat) => seat.alive && seat.no !== seatNo)
    .map((seat) => ({ voter: seat.no, target: seatNo, weight: 1 }));
  next = doAction(next, { type: 'SHERIFF_VOTE', ballots });
  return doAction(next, { type: 'SHERIFF_DONE' });
}

function seedGame(
  game: GameState,
  view: Extract<View, 'night' | 'sheriff' | 'dawn' | 'speech'>,
): void {
  useGameStore.setState({
    initialized: true,
    view,
    boardId: game.boardId,
    dealMode: game.dealMode,
    options: game.options,
    game,
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

function firstButton(name: string): HTMLElement {
  const button = screen.getAllByRole('button', { name })[0];
  if (!button) throw new Error(`未找到按钮：${name}`);
  return button;
}

async function castVotes(target: number, from: number, count: number): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    const buttons = screen.getAllByRole('button', { name: `投 ${target}` });
    const button = buttons[from + index];
    if (!button) throw new Error(`未找到第 ${from + index + 1} 位选民的投票按钮`);
    await userEvent.click(button);
  }
}

beforeEach(async () => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  await clearGameRecord();
  useGameStore.setState(useGameStore.getInitialState(), true);
  window.localStorage.setItem('lrs.guide.v1', '1');
});

describe('夜间流程', () => {
  it('按夜序推进：守卫空守、预言家私密结果、狼队名单、女巫解药', async () => {
    seedGame(createDealtGame(), 'night');
    render(<App />);

    expect(await screen.findByRole('heading', { name: '天黑请闭眼' })).toBeInTheDocument();
    expect(screen.getByText('第 1 夜 · 第 1 / 4 步')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '空守' }));
    expect(screen.getByText('本步已记录：空操作')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '确认，下一位' }));

    expect(await screen.findByText('预言家请睁眼，请选择你要查验的人')).toBeInTheDocument();
    await clickSeat('预言家目标选择', 9);
    expect(await screen.findByText('9 号是狼人（仅主持端可见）')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '确认，下一位' }));

    expect(await screen.findByText(/9 号 狼人、10 号 狼人/)).toBeInTheDocument();
    await clickSeat('狼人目标选择', 5);
    await userEvent.click(screen.getByRole('button', { name: '确认，下一位' }));

    expect(await screen.findByText('今晚 5 号被刀（仅女巫可见）。')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '解药救 5 号' }));
    expect(screen.getByText('本步已记录：5 号 · 解药')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '天亮了，结算夜晚' }));

    expect(await screen.findByRole('heading', { name: '警长竞选' })).toBeInTheDocument();
    const state = useGameStore.getState();
    expect(state.view).toBe('sheriff');
    expect(state.game?.phase).toBe('SHERIFF');
    expect(state.game?.lastNightDeaths).toEqual([]);
  });

  it('女巫：空刀不可解药，毒药目标后进入死讯', async () => {
    let game = createDealtGame({ sheriffElection: false });
    game = doAction(game, { type: 'NIGHT_ACTION', roleId: 'GUARD', target: null });
    game = doAction(game, { type: 'NIGHT_STEP_NEXT' });
    game = doAction(game, { type: 'NIGHT_ACTION', roleId: 'SEER', target: 9 });
    game = doAction(game, { type: 'NIGHT_STEP_NEXT' });
    game = doAction(game, { type: 'NIGHT_ACTION', roleId: 'WOLF', target: null });
    game = doAction(game, { type: 'NIGHT_STEP_NEXT' });
    seedGame(game, 'night');
    render(<App />);

    expect(await screen.findByText('今晚无人被刀（仅女巫可见）。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '解药（无人被刀）' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: '毒药' }));
    await clickSeat('女巫目标选择', 7);
    expect(screen.getByText('本步已记录：7 号 · 毒药')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '天亮了，结算夜晚' }));

    expect(await screen.findByRole('heading', { name: '天亮了' })).toBeInTheDocument();
    expect(screen.getByText('7 号出局')).toBeInTheDocument();
    expect(screen.getByText('7 号 · 被毒')).toBeInTheDocument();

    const state = useGameStore.getState();
    expect(state.game?.phase).toBe('DAWN');
    expect(state.view).toBe('dawn');
  });
});

describe('警长竞选', () => {
  function sheriffGame(): GameState {
    return resolveCheckWin(playNight(createDealtGame(), { guard: null, seer: 1, wolf: 5 }));
  }

  it('报名 → 发言 → 退水 → 警下投票 → 当选', async () => {
    seedGame(sheriffGame(), 'sheriff');
    render(<App />);

    expect(await screen.findByRole('heading', { name: '警长竞选' })).toBeInTheDocument();
    expect(screen.getByText('1 竞选')).toHaveAttribute('data-state', 'active');

    await clickSeat('上警报名', 9);
    await clickSeat('上警报名', 10);
    await userEvent.click(screen.getByRole('button', { name: '确认上警（2 人）' }));

    expect(await screen.findByText('0 / 2')).toBeInTheDocument();
    await userEvent.click(firstButton('标记发言'));
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '完成竞选发言' }));

    await userEvent.click(await screen.findByRole('button', { name: '10 号退水' }));
    await userEvent.click(screen.getByRole('button', { name: '确认退水（1 人）' }));

    expect(await screen.findByText('9 位选民')).toBeInTheDocument();
    await userEvent.click(firstButton('投 9'));
    await userEvent.click(screen.getByRole('button', { name: '提交警下投票' }));

    expect(await screen.findByText('9 号当选警长')).toBeInTheDocument();
    expect(useGameStore.getState().game?.sheriffNo).toBe(9);

    await userEvent.click(screen.getByRole('button', { name: '公布死讯' }));
    expect(await screen.findByRole('heading', { name: '天亮了' })).toBeInTheDocument();
    expect(screen.getByText('5 号出局')).toBeInTheDocument();
    expect(screen.getByText('5 号 · 被狼刀')).toBeInTheDocument();
  });

  it('无人上警时本局无警长，可直接公布死讯', async () => {
    seedGame(sheriffGame(), 'sheriff');
    render(<App />);

    await screen.findByRole('heading', { name: '警长竞选' });
    await userEvent.click(screen.getByRole('button', { name: '无人上警 · 本局无警长' }));

    expect(await screen.findByText('本局无警长')).toBeInTheDocument();
    expect(screen.getByText('警徽流失；进入死讯阶段。')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '公布死讯' }));
    expect(await screen.findByRole('heading', { name: '天亮了' })).toBeInTheDocument();
    expect(useGameStore.getState().game?.phase).toBe('DAWN');
  });

  it('平票进入 PK，复投再平则本局无警长', async () => {
    seedGame(sheriffGame(), 'sheriff');
    render(<App />);

    await screen.findByRole('heading', { name: '警长竞选' });
    await clickSeat('上警报名', 9);
    await clickSeat('上警报名', 10);
    await userEvent.click(screen.getByRole('button', { name: '确认上警（2 人）' }));
    await userEvent.click(await screen.findByRole('button', { name: '完成竞选发言' }));
    await userEvent.click(await screen.findByRole('button', { name: '确认退水（0 人）' }));

    await castVotes(9, 0, 4);
    await castVotes(10, 4, 4);
    await userEvent.click(screen.getByRole('button', { name: '提交警下投票' }));

    expect(await screen.findByText('平票 PK 复投')).toBeInTheDocument();
    expect(screen.getByText('仅平票候选人可被投；再平则本局无警长。')).toBeInTheDocument();

    await castVotes(9, 0, 4);
    await castVotes(10, 4, 4);
    await userEvent.click(screen.getByRole('button', { name: '提交警下投票' }));

    expect(await screen.findByText('本局无警长')).toBeInTheDocument();
    expect(useGameStore.getState().game?.sheriffNo).toBeNull();
  });
});

describe('死讯、遗言与技能', () => {
  function hunterDawnGame(): GameState {
    let game = resolveCheckWin(playNight(createDealtGame(), { guard: null, seer: 1, wolf: 4 }));
    game = doAction(game, { type: 'SHERIFF_SIGNUP', candidates: [] });
    return doAction(game, { type: 'SHERIFF_DONE' });
  }

  function badgeDawnGame(): GameState {
    let game = resolveCheckWin(playNight(createDealtGame(), { guard: null, seer: 1, wolf: 5 }));
    game = electSheriff(game, 1);
    game = doAction(game, { type: 'DAWN_DONE' });
    game = resolveCheckWin(game);
    game = doAction(game, { type: 'SPEECH_DONE' });
    game = doAction(game, { type: 'VOTE_CLOSE' });
    game = doAction(game, { type: 'SETTLE_DONE' });
    game = resolveCheckWin(game);
    game = playNight(game, { guard: null, seer: 9, wolf: 1 });
    return resolveCheckWin(game);
  }

  it('首夜死讯与遗言：猎人被刀可开枪并进入发言', async () => {
    seedGame(hunterDawnGame(), 'dawn');
    const { container } = render(<App />);

    expect(await screen.findByRole('heading', { name: '天亮了' })).toBeInTheDocument();
    expect(screen.getByText('4 号出局')).toBeInTheDocument();
    expect(screen.getByText('4 号 · 被狼刀')).toBeInTheDocument();
    expect(screen.getByText('首夜死亡有遗言')).toBeInTheDocument();

    await clickSeat('猎人开枪目标', 6);
    await userEvent.click(screen.getByRole('button', { name: '确认开枪' }));

    const state = useGameStore.getState();
    expect(state.game?.pendingHunterNo).toBeNull();
    expect(state.game?.seats.find((seat) => seat.no === 6)?.alive).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: '进入发言' }));
    expect(await screen.findByRole('heading', { name: '依次发言' })).toBeInTheDocument();

    const rows = container.querySelectorAll('.list-row');
    expect(rows[0]?.textContent).toContain('5 号');
  });

  it('第 2 夜死亡无遗言；警长死亡可移交警徽', async () => {
    seedGame(badgeDawnGame(), 'dawn');
    render(<App />);

    expect(await screen.findByRole('heading', { name: '天亮了' })).toBeInTheDocument();
    expect(screen.getByText('1 号出局')).toBeInTheDocument();
    expect(screen.getByText('本夜无遗言')).toBeInTheDocument();
    expect(screen.getByText('警徽处理')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '先处理技能与警徽' })).toBeDisabled();

    await clickSeat('警徽继任目标', 2);
    await userEvent.click(screen.getByRole('button', { name: '移交警徽' }));

    const state = useGameStore.getState().game;
    expect(state?.sheriffNo).toBe(2);
    expect(state?.pendingBadge).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: '进入发言' }));
    expect(await screen.findByRole('heading', { name: '依次发言' })).toBeInTheDocument();
  });

  it('警长死亡可撕毁警徽', async () => {
    seedGame(badgeDawnGame(), 'dawn');
    render(<App />);

    await screen.findByRole('heading', { name: '天亮了' });
    await userEvent.click(screen.getByRole('button', { name: '撕毁' }));

    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: '确认撕毁' }));

    const state = useGameStore.getState().game;
    expect(state?.sheriffNo).toBeNull();
    expect(state?.pendingBadge).toBe(false);
  });
});

describe('发言与自爆', () => {
  function speechGame(): GameState {
    let game = createDealtGame({ sheriffElection: false });
    game = resolveCheckWin(playNight(game, { guard: 5, seer: 1, wolf: 5 }));
    game = doAction(game, { type: 'DAWN_DONE' });
    return resolveCheckWin(game);
  }

  it('默认从 1 号发言；警长指定起点后顺序顺时针重排；可进入投票', async () => {
    seedGame(speechGame(), 'speech');
    const { container } = render(<App />);

    expect(await screen.findByRole('heading', { name: '依次发言' })).toBeInTheDocument();
    expect(screen.getByText('2 发言')).toHaveAttribute('data-state', 'active');

    const rows = container.querySelectorAll('.list-row');
    expect(rows[0]?.textContent).toContain('1 号');
    expect(rows).toHaveLength(12);

    await userEvent.click(firstButton('标记发言'));
    expect(screen.getByText('1 / 12')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('指定发言起始座位'), '6');
    const reordered = container.querySelectorAll('.list-row');
    expect(reordered[0]?.textContent).toContain('7 号');

    await userEvent.click(screen.getByRole('button', { name: '进入投票' }));
    expect(await screen.findByRole('heading', { name: '放逐投票' })).toBeInTheDocument();
    expect(useGameStore.getState().game?.phase).toBe('VOTE');
    expect(useGameStore.getState().view).toBe('vote');
  });

  it('狼人自爆后中止发言，结算完成进入下一夜', async () => {
    seedGame(speechGame(), 'speech');
    render(<App />);

    await screen.findByRole('heading', { name: '依次发言' });
    await userEvent.click(screen.getByRole('button', { name: '狼人自爆' }));

    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: '9 号 狼人' }));
    await userEvent.click(within(dialog).getByRole('button', { name: '确认自爆' }));

    expect(await screen.findByRole('heading', { name: '9 号自爆' })).toBeInTheDocument();
    expect(useGameStore.getState().game?.phase).toBe('SELF_EXPLODE');

    await userEvent.click(screen.getByRole('button', { name: '完成自爆结算' }));

    expect(await screen.findByRole('heading', { name: '天黑请闭眼' })).toBeInTheDocument();
    const state = useGameStore.getState();
    expect(state.game?.round).toBe(2);
    expect(state.game?.phase).toBe('NIGHT');
    expect(state.game?.seats.find((seat) => seat.no === 9)?.alive).toBe(false);
  });
});
