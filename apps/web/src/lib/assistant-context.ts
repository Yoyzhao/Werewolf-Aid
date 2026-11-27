import { ROLE_DEFINITIONS } from '@lrs/game-engine';

import { ASSISTANT_CONTEXT_LIMIT } from './assistant';
import { sanitizeFreeText } from './input-filter';
import type { AssistantRecord } from './types';

export interface AssistantContextPreview {
  readonly text: string;
  readonly length: number;
  readonly truncated: boolean;
}

function seatNumbers(record: AssistantRecord): number[] {
  return Object.keys(record.players)
    .map(Number)
    .sort((left, right) => left - right);
}

export function buildAssistantContext(record: AssistantRecord): AssistantContextPreview {
  const lines: string[] = [];

  lines.push('【我的身份】');
  if (record.roleId) {
    const definition = ROLE_DEFINITIONS[record.roleId];
    lines.push(`${definition.name}（${definition.camp === 'wolf' ? '狼人阵营' : '好人阵营'}）`);
    lines.push(`技能：${definition.skill}`);
  } else {
    lines.push('未选择身份');
  }

  lines.push('', '【当前局势】');
  lines.push(`轮次：第 ${record.round} 轮`);
  lines.push(`存活：${record.aliveSeats.length ? `${record.aliveSeats.join('、')} 号` : '无'}`);
  lines.push(`公开事件：${record.publicEvents.trim() || '暂无'}`);

  const seats = seatNumbers(record);
  const tagLines = seats
    .map((seatNo) => ({ seatNo, player: record.players[seatNo] }))
    .filter((item) => item.player && item.player.tags.length > 0)
    .map((item) => `${item.seatNo} 号：${item.player?.tags.join('、')}`);

  lines.push('', '【玩家标签】');
  lines.push(...(tagLines.length ? tagLines : ['暂无']));

  const infoLines = seats
    .map((seatNo) => ({ seatNo, player: record.players[seatNo] }))
    .filter((item) => item.player?.info.trim())
    .map((item) => `${item.seatNo} 号：${item.player?.info.trim()}`);

  lines.push('', '【信息记录】');
  lines.push(...(infoLines.length ? infoLines : ['暂无']));

  const speechLines: string[] = [];
  for (const seatNo of seats) {
    const player = record.players[seatNo];
    if (!player) continue;
    const rounds = Object.keys(player.speechByRound)
      .map(Number)
      .filter((round) => player.speechByRound[round]?.trim())
      .sort((left, right) => left - right);
    for (const round of rounds) {
      speechLines.push(`${seatNo} 号（第 ${round} 轮）：${player.speechByRound[round]?.trim()}`);
    }
  }

  lines.push('', '【发言要点】');
  lines.push(...(speechLines.length ? speechLines : ['暂无']));

  lines.push('', '【自由描述】');
  lines.push(sanitizeFreeText(record.freeText).trim() || '暂无');

  const raw = lines.join('\n');
  const truncated = raw.length > ASSISTANT_CONTEXT_LIMIT;

  return {
    text: truncated ? raw.slice(0, ASSISTANT_CONTEXT_LIMIT) : raw,
    length: raw.length,
    truncated,
  };
}
