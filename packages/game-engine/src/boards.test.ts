import { describe, expect, it } from 'vitest';

import {
  BOARD_PRE_WITCH_HUNTER_GUARD,
  BOARD_PRE_WITCH_HUNTER_IDIOT,
  BUILT_IN_BOARDS,
  getBoard,
  PLAYER_COUNT,
  validateBoard,
  WOLF_TOTAL,
  type Board,
} from './boards.js';
import { ROLE_DEFINITIONS, type RoleId } from './roles.js';

function roleCounts(board: Board): Record<string, number> {
  return Object.fromEntries(board.roles.map((slot) => [slot.roleId, slot.count]));
}

function campTotal(board: Board, camp: 'good' | 'wolf'): number {
  return board.roles.reduce(
    (sum, slot) => sum + (ROLE_DEFINITIONS[slot.roleId].camp === camp ? slot.count : 0),
    0,
  );
}

function codesOf(board: Board): string[] {
  return validateBoard(board).issues.map((issue) => issue.code);
}

describe('角色元数据', () => {
  it('覆盖 8 个角色且阵营/类别/夜间动作符合附录 A', () => {
    expect(Object.keys(ROLE_DEFINITIONS).sort()).toEqual(
      ['GUARD', 'HUNTER', 'IDIOT', 'SEER', 'VILLAGER', 'WITCH', 'WOLF', 'WOLF_KING'].sort(),
    );

    expect(ROLE_DEFINITIONS.SEER).toMatchObject({
      camp: 'good',
      kind: 'god',
      nightAction: 'inspect',
    });
    expect(ROLE_DEFINITIONS.WITCH).toMatchObject({
      camp: 'good',
      kind: 'god',
      nightAction: 'potion',
    });
    expect(ROLE_DEFINITIONS.GUARD).toMatchObject({
      camp: 'good',
      kind: 'god',
      nightAction: 'protect',
    });
    expect(ROLE_DEFINITIONS.HUNTER).toMatchObject({ camp: 'good', kind: 'god', nightAction: null });
    expect(ROLE_DEFINITIONS.IDIOT).toMatchObject({ camp: 'good', kind: 'god', nightAction: null });
    expect(ROLE_DEFINITIONS.VILLAGER).toMatchObject({
      camp: 'good',
      kind: 'villager',
      nightAction: null,
    });
    expect(ROLE_DEFINITIONS.WOLF).toMatchObject({
      camp: 'wolf',
      kind: 'wolf',
      nightAction: 'kill',
    });
    expect(ROLE_DEFINITIONS.WOLF_KING).toMatchObject({
      camp: 'wolf',
      kind: 'wolf',
      nightAction: null,
    });
  });
});

describe('内置板子', () => {
  it('两套板子均通过配置校验', () => {
    expect(validateBoard(BOARD_PRE_WITCH_HUNTER_GUARD)).toEqual({ ok: true, issues: [] });
    expect(validateBoard(BOARD_PRE_WITCH_HUNTER_IDIOT)).toEqual({ ok: true, issues: [] });
  });

  it('预女猎守：4 神 + 4 民 + 4 普通狼，夜序守卫→预言家→狼人→女巫', () => {
    const board = BOARD_PRE_WITCH_HUNTER_GUARD;

    expect(board.playerCount).toBe(PLAYER_COUNT);
    expect(roleCounts(board)).toEqual({
      SEER: 1,
      WITCH: 1,
      HUNTER: 1,
      GUARD: 1,
      VILLAGER: 4,
      WOLF: 4,
    });
    expect(campTotal(board, 'good')).toBe(8);
    expect(campTotal(board, 'wolf')).toBe(WOLF_TOTAL);
    expect(board.nightOrder).toEqual(['GUARD', 'SEER', 'WOLF', 'WITCH']);
    expect(board.winRule).toBe('slaughter-side');
  });

  it('预女猎白：4 神 + 4 民 + 3 普通狼 + 1 白狼王，夜序预言家→狼人→女巫', () => {
    const board = BOARD_PRE_WITCH_HUNTER_IDIOT;

    expect(board.playerCount).toBe(PLAYER_COUNT);
    expect(roleCounts(board)).toEqual({
      SEER: 1,
      WITCH: 1,
      HUNTER: 1,
      IDIOT: 1,
      VILLAGER: 4,
      WOLF: 3,
      WOLF_KING: 1,
    });
    expect(campTotal(board, 'good')).toBe(8);
    expect(campTotal(board, 'wolf')).toBe(WOLF_TOTAL);
    expect(board.nightOrder).toEqual(['SEER', 'WOLF', 'WITCH']);
    expect(board.winRule).toBe('slaughter-side');
  });

  it('板子可通过 id 获取', () => {
    expect(getBoard('pre-witch-hunter-guard')).toBe(BOARD_PRE_WITCH_HUNTER_GUARD);
    expect(getBoard('pre-witch-hunter-idiot')).toBe(BOARD_PRE_WITCH_HUNTER_IDIOT);
    expect(Object.keys(BUILT_IN_BOARDS)).toEqual([
      'pre-witch-hunter-guard',
      'pre-witch-hunter-idiot',
    ]);
  });

  it('板子选项符合 P0 默认口径', () => {
    for (const board of Object.values(BUILT_IN_BOARDS)) {
      expect(board.options).toEqual({
        sheriffElection: true,
        witchSelfSaveFirstNight: true,
        lastWordsRule: 'first-night-and-daytime',
      });
    }
  });
});

describe('配置校验', () => {
  it('拒绝非 12 人板子', () => {
    const board: Board = { ...BOARD_PRE_WITCH_HUNTER_GUARD, playerCount: 11 };
    expect(codesOf(board)).toContain('PLAYER_COUNT_INVALID');
    expect(codesOf(board)).toContain('ROLE_COUNT_MISMATCH');
  });

  it('拒绝角色总数与人数不一致', () => {
    const board: Board = {
      ...BOARD_PRE_WITCH_HUNTER_GUARD,
      roles: BOARD_PRE_WITCH_HUNTER_GUARD.roles.filter((slot) => slot.roleId !== 'VILLAGER'),
    };
    expect(codesOf(board)).toContain('ROLE_COUNT_MISMATCH');
  });

  it('拒绝重复角色配置', () => {
    const board: Board = {
      ...BOARD_PRE_WITCH_HUNTER_GUARD,
      roles: [
        ...BOARD_PRE_WITCH_HUNTER_GUARD.roles.filter((slot) => slot.roleId !== 'VILLAGER'),
        { roleId: 'VILLAGER', count: 4 },
        { roleId: 'VILLAGER', count: 1 },
      ],
    };
    expect(codesOf(board)).toContain('DUPLICATE_ROLE');
  });

  it('拒绝非法的角色数量', () => {
    const board: Board = {
      ...BOARD_PRE_WITCH_HUNTER_GUARD,
      roles: BOARD_PRE_WITCH_HUNTER_GUARD.roles.map((slot) =>
        slot.roleId === 'VILLAGER' ? { roleId: 'VILLAGER', count: 0 } : slot,
      ),
    };
    expect(codesOf(board)).toContain('ROLE_COUNT_INVALID');
  });

  it('拒绝狼人总数不为 4', () => {
    const board: Board = {
      ...BOARD_PRE_WITCH_HUNTER_GUARD,
      roles: BOARD_PRE_WITCH_HUNTER_GUARD.roles.map((slot) =>
        slot.roleId === 'WOLF' ? { roleId: 'WOLF', count: 3 } : slot,
      ),
    };
    expect(codesOf(board)).toContain('WOLF_COUNT_INVALID');
  });

  it('拒绝非法狼人构成（2 白狼王 + 2 普通狼）', () => {
    const board: Board = {
      ...BOARD_PRE_WITCH_HUNTER_IDIOT,
      roles: BOARD_PRE_WITCH_HUNTER_IDIOT.roles.map((slot) => {
        if (slot.roleId === 'WOLF') return { roleId: 'WOLF', count: 2 };
        if (slot.roleId === 'WOLF_KING') return { roleId: 'WOLF_KING', count: 2 };
        return slot;
      }),
    };
    expect(codesOf(board)).toContain('WOLF_COMPOSITION_INVALID');
  });

  it('拒绝夜间顺序缺少夜间角色', () => {
    const board: Board = {
      ...BOARD_PRE_WITCH_HUNTER_GUARD,
      nightOrder: ['GUARD', 'SEER', 'WOLF'],
    };
    expect(codesOf(board)).toContain('NIGHT_ORDER_MISSING_ROLE');
  });

  it('拒绝夜间顺序包含无夜间动作的角色', () => {
    const board: Board = {
      ...BOARD_PRE_WITCH_HUNTER_GUARD,
      nightOrder: ['GUARD', 'SEER', 'WOLF', 'WITCH', 'VILLAGER'],
    };
    expect(codesOf(board)).toContain('NIGHT_ORDER_INACTIVE_ROLE');
  });

  it('拒绝夜间顺序重复角色', () => {
    const board: Board = {
      ...BOARD_PRE_WITCH_HUNTER_GUARD,
      nightOrder: ['GUARD', 'SEER', 'WOLF', 'WITCH', 'WITCH'],
    };
    expect(codesOf(board)).toContain('NIGHT_ORDER_DUPLICATE');
  });

  it('拒绝未知角色', () => {
    const board: Board = {
      ...BOARD_PRE_WITCH_HUNTER_GUARD,
      roles: [{ roleId: 'DRAGON' as RoleId, count: PLAYER_COUNT }],
    };
    expect(codesOf(board)).toContain('ROLE_COUNT_INVALID');
  });
});
