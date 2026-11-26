import type { PublicEvent } from '@lrs/game-engine';

export const ROOM_PHASE_LABELS: Record<string, string> = {
  SETUP: '设置',
  DEAL: '发牌',
  NIGHT: '夜晚',
  SHERIFF: '竞选',
  DAWN: '死讯',
  SPEECH: '发言',
  SELF_EXPLODE: '自爆',
  VOTE: '投票',
  SETTLE: '结算',
  CHECK_WIN: '判定',
  RESULT: '已结束',
};

const CAUSE_LABELS: Record<string, string> = {
  WOLF: '被狼刀',
  POISON: '被毒',
  VOTE: '被放逐',
  HUNTER: '被猎人带走',
  WOLF_KING: '被白狼王带走',
  SELF_EXPLODE: '自爆',
  SAME_GUARD_SAVE: '同守同救',
};

export function describePublicEvent(event: PublicEvent): string {
  const seats = event.seatNos.length > 0 ? event.seatNos.map((no) => `${no} 号`).join('、') : '';
  switch (event.type) {
    case 'SELF_EXPLODE':
      return `${seats} 自爆`;
    case 'SHERIFF_ELECTED':
      return `${seats} 当选警长`;
    case 'SHERIFF_NONE':
      return '本局无警长';
    case 'EXILE':
      return `${seats} 被放逐`;
    case 'NO_EXILE':
      return '本轮无人出局';
    case 'DEATH': {
      const cause =
        event.cause === undefined ? '' : `（${CAUSE_LABELS[event.cause] ?? event.cause}）`;
      return `${seats} 出局${cause}`;
    }
    case 'NO_DEATH':
      return '平安夜';
    case 'IDIOT_REVEALED':
      return `${seats} 白痴翻牌免死`;
    case 'HUNTER_SHOOT':
      return `${seats} 猎人开枪`;
    case 'BADGE_TRANSFER':
      return `警徽移交给 ${seats}`;
    case 'BADGE_DESTROYED':
      return '警徽被撕毁';
    case 'WOLF_KING_TAKE':
      return `白狼王带走 ${seats}`;
    default:
      return seats ? `${seats} 发生事件` : '发生事件';
  }
}

export const CONNECTION_LABELS = {
  connecting: '正在连接…',
  online: '实时同步',
  reconnecting: '连接中断，正在重连',
  polling: '实时连接不可用，已切换 5 秒刷新',
  offline: '网络不可用，联机暂停',
  closed: '房间已结束',
} as const;

export const CLOSED_REASON_LABELS: Record<string, string> = {
  settled: '本局已结算，房间数据已删除',
  deleted: '主持人已解散房间',
  expired: '房间已过期',
};
