import { isRoleId, ROLE_DEFINITIONS, type RoleId } from './roles.js';

export type BoardId = 'pre-witch-hunter-guard' | 'pre-witch-hunter-idiot';

export type WinRule = 'slaughter-side';

export type LastWordsRule = 'first-night-and-daytime';

export interface BoardRoleSlot {
  readonly roleId: RoleId;
  readonly count: number;
}

export interface BoardOptions {
  readonly sheriffElection: boolean;
  readonly witchSelfSaveFirstNight: boolean;
  readonly lastWordsRule: LastWordsRule;
}

export interface Board {
  readonly id: BoardId;
  readonly name: string;
  readonly playerCount: number;
  readonly roles: readonly BoardRoleSlot[];
  readonly nightOrder: readonly RoleId[];
  readonly winRule: WinRule;
  readonly options: BoardOptions;
}

export const PLAYER_COUNT = 12;
export const WOLF_TOTAL = 4;

export const BOARD_PRE_WITCH_HUNTER_GUARD: Board = {
  id: 'pre-witch-hunter-guard',
  name: '预女猎守',
  playerCount: PLAYER_COUNT,
  roles: [
    { roleId: 'SEER', count: 1 },
    { roleId: 'WITCH', count: 1 },
    { roleId: 'HUNTER', count: 1 },
    { roleId: 'GUARD', count: 1 },
    { roleId: 'VILLAGER', count: 4 },
    { roleId: 'WOLF', count: 4 },
  ],
  nightOrder: ['GUARD', 'SEER', 'WOLF', 'WITCH'],
  winRule: 'slaughter-side',
  options: {
    sheriffElection: true,
    witchSelfSaveFirstNight: true,
    lastWordsRule: 'first-night-and-daytime',
  },
};

export const BOARD_PRE_WITCH_HUNTER_IDIOT: Board = {
  id: 'pre-witch-hunter-idiot',
  name: '预女猎白',
  playerCount: PLAYER_COUNT,
  roles: [
    { roleId: 'SEER', count: 1 },
    { roleId: 'WITCH', count: 1 },
    { roleId: 'HUNTER', count: 1 },
    { roleId: 'IDIOT', count: 1 },
    { roleId: 'VILLAGER', count: 4 },
    { roleId: 'WOLF', count: 3 },
    { roleId: 'WOLF_KING', count: 1 },
  ],
  nightOrder: ['SEER', 'WOLF', 'WITCH'],
  winRule: 'slaughter-side',
  options: {
    sheriffElection: true,
    witchSelfSaveFirstNight: true,
    lastWordsRule: 'first-night-and-daytime',
  },
};

export const BUILT_IN_BOARDS: Readonly<Record<BoardId, Board>> = {
  'pre-witch-hunter-guard': BOARD_PRE_WITCH_HUNTER_GUARD,
  'pre-witch-hunter-idiot': BOARD_PRE_WITCH_HUNTER_IDIOT,
};

export function getBoard(boardId: BoardId): Board {
  return BUILT_IN_BOARDS[boardId];
}

export type BoardValidationCode =
  | 'PLAYER_COUNT_INVALID'
  | 'EMPTY_ROLES'
  | 'ROLE_COUNT_INVALID'
  | 'ROLE_COUNT_MISMATCH'
  | 'DUPLICATE_ROLE'
  | 'WOLF_COUNT_INVALID'
  | 'WOLF_COMPOSITION_INVALID'
  | 'NIGHT_ORDER_UNKNOWN_ROLE'
  | 'NIGHT_ORDER_DUPLICATE'
  | 'NIGHT_ORDER_INACTIVE_ROLE'
  | 'NIGHT_ORDER_MISSING_ROLE';

export interface BoardValidationIssue {
  readonly code: BoardValidationCode;
  readonly message: string;
}

export interface BoardValidationResult {
  readonly ok: boolean;
  readonly issues: readonly BoardValidationIssue[];
}

export function validateBoard(board: Board): BoardValidationResult {
  const issues: BoardValidationIssue[] = [];

  if (board.playerCount !== PLAYER_COUNT) {
    issues.push({
      code: 'PLAYER_COUNT_INVALID',
      message: `人数必须为 ${PLAYER_COUNT}，当前为 ${board.playerCount}`,
    });
  }

  if (board.roles.length === 0) {
    issues.push({ code: 'EMPTY_ROLES', message: '板子必须包含角色' });
  }

  const seenRoles = new Set<string>();
  let total = 0;
  let wolfTotal = 0;
  let wolfCount = 0;
  let wolfKingCount = 0;

  for (const slot of board.roles) {
    if (!isRoleId(slot.roleId)) {
      issues.push({
        code: 'ROLE_COUNT_INVALID',
        message: `未知角色 ${String(slot.roleId)}`,
      });
      continue;
    }

    if (!Number.isInteger(slot.count) || slot.count <= 0) {
      issues.push({
        code: 'ROLE_COUNT_INVALID',
        message: `角色 ${slot.roleId} 的数量必须为正整数，当前为 ${slot.count}`,
      });
      continue;
    }

    if (seenRoles.has(slot.roleId)) {
      issues.push({
        code: 'DUPLICATE_ROLE',
        message: `角色 ${slot.roleId} 重复配置`,
      });
    }
    seenRoles.add(slot.roleId);

    const role = ROLE_DEFINITIONS[slot.roleId];
    total += slot.count;
    if (role.camp === 'wolf') {
      wolfTotal += slot.count;
      if (slot.roleId === 'WOLF') wolfCount = slot.count;
      if (slot.roleId === 'WOLF_KING') wolfKingCount = slot.count;
    }
  }

  if (total !== board.playerCount) {
    issues.push({
      code: 'ROLE_COUNT_MISMATCH',
      message: `角色总数 ${total} 与人数 ${board.playerCount} 不一致`,
    });
  }

  if (wolfTotal !== WOLF_TOTAL) {
    issues.push({
      code: 'WOLF_COUNT_INVALID',
      message: `狼人总数必须为 ${WOLF_TOTAL}，当前为 ${wolfTotal}`,
    });
  }

  const validComposition =
    (wolfKingCount === 0 && wolfCount === 4) || (wolfKingCount === 1 && wolfCount === 3);
  if (wolfTotal === WOLF_TOTAL && !validComposition) {
    issues.push({
      code: 'WOLF_COMPOSITION_INVALID',
      message: `狼人构成必须为 4 普通狼，或 3 普通狼 + 1 白狼王；当前 ${wolfCount} 普通狼 + ${wolfKingCount} 白狼王`,
    });
  }

  const seenNightOrder = new Set<string>();
  for (const roleId of board.nightOrder) {
    if (!isRoleId(roleId)) {
      issues.push({
        code: 'NIGHT_ORDER_UNKNOWN_ROLE',
        message: `夜间顺序包含未知角色 ${String(roleId)}`,
      });
      continue;
    }

    if (seenNightOrder.has(roleId)) {
      issues.push({
        code: 'NIGHT_ORDER_DUPLICATE',
        message: `夜间顺序中角色 ${roleId} 重复`,
      });
    }
    seenNightOrder.add(roleId);

    if (ROLE_DEFINITIONS[roleId].nightAction === null) {
      issues.push({
        code: 'NIGHT_ORDER_INACTIVE_ROLE',
        message: `角色 ${roleId} 无独立夜间动作，不应出现在夜间顺序中`,
      });
    }
  }

  for (const slot of board.roles) {
    if (!isRoleId(slot.roleId)) continue;
    const role = ROLE_DEFINITIONS[slot.roleId];
    if (role.nightAction !== null && !seenNightOrder.has(slot.roleId)) {
      issues.push({
        code: 'NIGHT_ORDER_MISSING_ROLE',
        message: `夜间角色 ${slot.roleId} 未出现在夜间顺序中`,
      });
    }
  }

  return { ok: issues.length === 0, issues };
}
