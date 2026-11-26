import {
  getSeat,
  ROLE_DEFINITIONS,
  type DeathCause,
  type GameState,
  type NightAction,
  type PlayerView,
  type PrivateNightAction,
  type PublicEvent,
} from '@lrs/game-engine';

import { roleName } from './board';

export type TimelineVisibility = 'public' | 'private';

export interface TimelineEntry {
  readonly id: string;
  readonly text: string;
  readonly visibility: TimelineVisibility;
}

export interface TimelineGroup {
  readonly key: string;
  readonly round: number;
  readonly phase: 'night' | 'day';
  readonly title: string;
  readonly entries: readonly TimelineEntry[];
  readonly defaultOpen: boolean;
}

const CAUSE_LABELS: Record<DeathCause, string> = {
  WOLF: '被狼刀',
  POISON: '被毒',
  VOTE: '被放逐',
  HUNTER: '被猎人带走',
  WOLF_KING: '被白狼王带走',
  SELF_EXPLODE: '自爆',
  SAME_GUARD_SAVE: '同守同救',
};

export function eventLabel(event: PublicEvent): string {
  const seats = event.seatNos.join('、');
  const day = event.phase === 'NIGHT' ? '夜' : '天';
  switch (event.type) {
    case 'NO_DEATH':
      return `第 ${event.round} 夜 · 平安夜`;
    case 'DEATH':
      return `第 ${event.round} ${day} · ${seats} 号出局（${
        event.cause ? CAUSE_LABELS[event.cause] : '出局'
      }）`;
    case 'SELF_EXPLODE':
      return `第 ${event.round} ${day} · ${seats} 号自爆`;
    case 'SHERIFF_ELECTED':
      return `第 ${event.round} 天 · ${seats} 号当选警长`;
    case 'SHERIFF_NONE':
      return `第 ${event.round} 天 · 本局无警长`;
    case 'EXILE':
      return `第 ${event.round} 天 · 放逐投票最高票：${seats} 号`;
    case 'NO_EXILE':
      return `第 ${event.round} 天 · 平票或弃票，本轮无人出局`;
    case 'IDIOT_REVEALED':
      return `第 ${event.round} 天 · ${seats} 号白痴翻牌：免死、失去投票权`;
    case 'HUNTER_SHOOT':
      return `第 ${event.round} ${day} · 猎人开枪：${seats} 号`;
    case 'BADGE_TRANSFER':
      return `第 ${event.round} ${day} · 警徽移交给 ${seats} 号`;
    case 'BADGE_DESTROYED':
      return `第 ${event.round} ${day} · 警徽被撕毁`;
    case 'WOLF_KING_TAKE':
      return `第 ${event.round} ${day} · 白狼王带人：${seats} 号`;
    default:
      return `第 ${event.round} ${day} · ${event.type}`;
  }
}

export function nightActionLabel(action: NightAction, game: GameState): string {
  switch (action.roleId) {
    case 'GUARD':
      return `守卫：${action.target === null ? '空守' : `守护 ${action.target} 号`}`;
    case 'SEER': {
      if (action.target === null) return '预言家：未查验';
      const seat = getSeat(game, action.target);
      const camp =
        seat?.role !== null && seat?.role !== undefined
          ? ROLE_DEFINITIONS[seat.role].camp === 'wolf'
            ? '狼人'
            : '好人'
          : '未知';
      return `预言家：查验 ${action.target} 号（${camp}）`;
    }
    case 'WOLF':
      return `狼人：${action.target === null ? '空刀' : `刀 ${action.target} 号`}`;
    case 'WITCH':
      if (action.potion === 'ANTIDOTE') return `女巫：解药救 ${action.target} 号`;
      if (action.potion === 'POISON') return `女巫：毒药 ${action.target} 号`;
      return '女巫：未用药';
    default:
      return roleName(action.roleId);
  }
}

function playerActionLabel(action: PrivateNightAction): string {
  switch (action.roleId) {
    case 'GUARD':
      return `你（守卫）：${action.target === null ? '空守' : `守护 ${action.target} 号`}`;
    case 'SEER': {
      if (action.target === null) return '你（预言家）：未查验';
      const result = action.result === 'WOLF' ? '狼人' : action.result === 'GOOD' ? '好人' : '未知';
      return `你（预言家）：查验 ${action.target} 号（${result}）`;
    }
    case 'WITCH':
      if (action.potion === 'ANTIDOTE') return `你（女巫）：解药救 ${action.target} 号`;
      if (action.potion === 'POISON') return `你（女巫）：毒药 ${action.target} 号`;
      return '你（女巫）：未用药';
    case 'WOLF':
      return `狼队：${action.target === null ? '空刀' : `刀 ${action.target} 号`}`;
    default:
      return `${roleName(action.roleId)}：夜间行动`;
  }
}

interface MutableGroup {
  readonly round: number;
  readonly phase: 'night' | 'day';
  readonly entries: TimelineEntry[];
}

function groupKey(round: number, phase: 'night' | 'day'): string {
  return `${round}:${phase}`;
}

function ensureGroup(
  groups: Map<string, MutableGroup>,
  round: number,
  phase: 'night' | 'day',
): MutableGroup {
  const key = groupKey(round, phase);
  const existing = groups.get(key);
  if (existing) return existing;
  const created: MutableGroup = { round, phase, entries: [] };
  groups.set(key, created);
  return created;
}

function finalize(groups: Map<string, MutableGroup>): TimelineGroup[] {
  const sorted = [...groups.values()].sort((left, right) => {
    if (left.round !== right.round) return left.round - right.round;
    return left.phase === right.phase ? 0 : left.phase === 'night' ? -1 : 1;
  });

  const nightRounds = sorted.filter((group) => group.phase === 'night').map((group) => group.round);
  const latestNight = nightRounds.length > 0 ? Math.max(...nightRounds) : null;
  const lastIndex = sorted.length - 1;

  return sorted.map((group, index) => ({
    key: groupKey(group.round, group.phase),
    round: group.round,
    phase: group.phase,
    title: `第 ${group.round} ${group.phase === 'night' ? '夜' : '天'}`,
    entries: group.entries,
    defaultOpen:
      latestNight === null
        ? index === lastIndex
        : group.phase === 'night' && group.round === latestNight,
  }));
}

/** 主持端完整时间线：夜间私密动作 + 公开事件。 */
export function buildHostTimeline(game: GameState): TimelineGroup[] {
  const groups = new Map<string, MutableGroup>();

  for (const action of game.nightActions) {
    ensureGroup(groups, action.round, 'night').entries.push({
      id: `action-${action.round}-${action.step}`,
      text: nightActionLabel(action, game),
      visibility: 'private',
    });
  }

  for (const event of game.events) {
    const phase = event.phase === 'NIGHT' ? 'night' : 'day';
    ensureGroup(groups, event.round, phase).entries.push({
      id: `event-${event.seq}`,
      text: eventLabel(event),
      visibility: 'public',
    });
  }

  return finalize(groups);
}

/** 玩家端时间线：公开事件 + 本人参与的夜间动作。 */
export function buildPlayerTimeline(view: PlayerView): TimelineGroup[] {
  const groups = new Map<string, MutableGroup>();

  for (const action of view.privateActions ?? []) {
    ensureGroup(groups, action.round, 'night').entries.push({
      id: `private-${action.round}-${action.step}`,
      text: playerActionLabel(action),
      visibility: 'private',
    });
  }

  for (const event of view.events) {
    const phase = event.phase === 'NIGHT' ? 'night' : 'day';
    ensureGroup(groups, event.round, phase).entries.push({
      id: `event-${event.seq}`,
      text: eventLabel(event),
      visibility: 'public',
    });
  }

  return finalize(groups);
}
