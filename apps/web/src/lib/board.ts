import type { BoardId, DealMode, GameOptions, RoleId, SeatAssignment } from '@lrs/game-engine';
import { getBoard, ROLE_DEFINITIONS } from '@lrs/game-engine';

export const BOARD_IDS: readonly BoardId[] = ['pre-witch-hunter-guard', 'pre-witch-hunter-idiot'];

export const DEAL_MODES: readonly DealMode[] = ['A', 'B', 'C'];

export const DEAL_MODE_LABELS: Record<DealMode, string> = {
  A: '接力查看',
  B: '线下逐步确认',
  C: '实体牌录入',
};

export const DEAL_MODE_HINTS: Record<DealMode, string> = {
  A: '全屏遮罩，玩家自己点开身份，看完回遮罩。',
  B: '默认遮罩，主持人二次点击才显示身份，确认后进入下一位。',
  C: '线下发实体牌，主持人按 1→12 手动选择身份。',
};

export function boardRoleIds(boardId: BoardId): RoleId[] {
  const roles: RoleId[] = [];
  for (const slot of getBoard(boardId).roles) {
    for (let index = 0; index < slot.count; index += 1) roles.push(slot.roleId);
  }
  return roles;
}

export function shuffleAssignments(
  boardId: BoardId,
  random: () => number = Math.random,
): SeatAssignment[] {
  const pool = boardRoleIds(boardId);
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = pool[index];
    const target = pool[swapIndex];
    if (current === undefined || target === undefined) continue;
    pool[index] = target;
    pool[swapIndex] = current;
  }
  return pool.map((roleId, index) => ({ seatNo: index + 1, roleId }));
}

export function assignmentsToRecord(
  assignments: readonly SeatAssignment[],
): Record<number, RoleId> {
  return Object.fromEntries(assignments.map((item) => [item.seatNo, item.roleId]));
}

export function assignmentsFromRecord(record: Readonly<Record<number, RoleId>>): SeatAssignment[] {
  return Object.entries(record)
    .map(([seatNo, roleId]) => ({ seatNo: Number(seatNo), roleId }))
    .sort((left, right) => left.seatNo - right.seatNo);
}

export function assignedCount(assignments: Readonly<Record<number, RoleId>>): number {
  return Object.keys(assignments).length;
}

export function remainingRoleCount(
  boardId: BoardId,
  assignments: Readonly<Record<number, RoleId>>,
  roleId: RoleId,
): number {
  const total = boardRoleIds(boardId).filter((item) => item === roleId).length;
  const used = Object.values(assignments).filter((item) => item === roleId).length;
  return total - used;
}

export function roleName(roleId: RoleId): string {
  return ROLE_DEFINITIONS[roleId].name;
}

export function roleCamp(roleId: RoleId): 'good' | 'wolf' {
  return ROLE_DEFINITIONS[roleId].camp;
}

export function roleSkill(roleId: RoleId): string {
  return ROLE_DEFINITIONS[roleId].skill;
}

export function defaultOptions(boardId: BoardId): GameOptions {
  const board = getBoard(boardId);
  return {
    sheriffElection: board.options.sheriffElection,
    witchSelfSaveFirstNight: board.options.witchSelfSaveFirstNight,
  };
}
