import { describe, expect, it } from 'vitest';

import { BUILT_IN_BOARDS, ROLE_DEFINITIONS } from '@lrs/game-engine';

import {
  getRoleGuide,
  getRuleBoard,
  ROLE_GUIDES,
  RULE_BOARDS,
  RULES_CONTENT,
  RULES_FLOWS,
  RULES_FOOTER,
  TERM_CATEGORIES,
  TERM_CATEGORY_LABELS,
  TERMS,
} from './index.js';

describe('规则内容', () => {
  it('覆盖两套板子，且构成、人数与夜序和 game-engine 一致', () => {
    expect(RULE_BOARDS).toHaveLength(2);

    for (const board of RULE_BOARDS) {
      const engineBoard = BUILT_IN_BOARDS[board.id];

      expect(engineBoard).toBeDefined();
      expect(board.name).toBe(engineBoard.name);
      expect(board.playerCount).toBe(engineBoard.playerCount);
      expect(board.nightOrder).toEqual(engineBoard.nightOrder);
      expect(board.roles.reduce((total, slot) => total + slot.count, 0)).toBe(
        engineBoard.playerCount,
      );
      expect(board.roles.map((slot) => `${slot.roleId}:${slot.count}`).sort()).toEqual(
        engineBoard.roles.map((slot) => `${slot.roleId}:${slot.count}`).sort(),
      );
    }
  });

  it('覆盖全部角色，且阵营、类型、技能与限制和 game-engine 一致', () => {
    expect(ROLE_GUIDES).toHaveLength(Object.keys(ROLE_DEFINITIONS).length);

    for (const guide of ROLE_GUIDES) {
      const definition = ROLE_DEFINITIONS[guide.roleId];

      expect(definition).toBeDefined();
      expect(guide.name).toBe(definition.name);
      expect(guide.camp).toBe(definition.camp);
      expect(guide.kind).toBe(definition.kind);
      expect(guide.skill).toBe(definition.skill);
      expect(guide.limits).toEqual(definition.limits);
    }
  });

  it('每个角色都有非空的常见打法与易错点', () => {
    for (const guide of ROLE_GUIDES) {
      expect(guide.tactics.length).toBeGreaterThanOrEqual(2);
      expect(guide.mistakes.length).toBeGreaterThanOrEqual(2);

      for (const text of [...guide.tactics, ...guide.mistakes]) {
        expect(text.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('两套板子的角色都能在角色图鉴中找到', () => {
    const guideIds = new Set(ROLE_GUIDES.map((guide) => guide.roleId));

    for (const board of RULE_BOARDS) {
      for (const slot of board.roles) {
        expect(guideIds.has(slot.roleId)).toBe(true);
      }
    }
  });

  it('流程按夜间、白天、胜负组织且步骤非空', () => {
    expect(RULES_FLOWS.map((flow) => flow.id)).toEqual(['night', 'day', 'win']);

    for (const flow of RULES_FLOWS) {
      expect(flow.title.trim().length).toBeGreaterThan(0);
      expect(flow.steps.length).toBeGreaterThan(0);

      for (const step of flow.steps) {
        expect(step.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('页脚声明与内容聚合保持固定文案', () => {
    expect(RULES_FOOTER.text).toBe('依据规则资料整理，以开局约定为准');
    expect(RULES_CONTENT.footer).toBe(RULES_FOOTER);
    expect(RULES_CONTENT.boards).toBe(RULE_BOARDS);
    expect(RULES_CONTENT.roles).toBe(ROLE_GUIDES);
    expect(RULES_CONTENT.flows).toBe(RULES_FLOWS);
    expect(RULES_CONTENT.terms).toBe(TERMS);
  });

  it('术语覆盖设计稿示例，分类、别名与解释完整', () => {
    const required = [
      '同守同救',
      '连守',
      '警徽流',
      '悍跳',
      '自爆',
      '金水',
      '查杀',
      '银水',
      '倒钩',
      '冲锋狼',
    ];
    const termNames = new Set(TERMS.map((term) => term.term));

    for (const name of required) {
      expect(termNames.has(name), `缺少术语：${name}`).toBe(true);
    }

    expect(new Set(TERMS.map((term) => term.id)).size).toBe(TERMS.length);
    expect(new Set(TERMS.map((term) => term.term)).size).toBe(TERMS.length);

    for (const term of TERMS) {
      expect(TERM_CATEGORIES).toContain(term.category);
      expect(TERM_CATEGORY_LABELS[term.category].trim().length).toBeGreaterThan(0);
      expect(term.summary.trim().length).toBeGreaterThan(0);
      expect(term.detail.trim().length).toBeGreaterThan(0);

      for (const alias of term.aliases) {
        expect(alias.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('查询函数返回对应板子与角色', () => {
    expect(getRuleBoard('pre-witch-hunter-guard').name).toBe('预女猎守');
    expect(getRuleBoard('pre-witch-hunter-idiot').name).toBe('预女猎白');
    expect(getRoleGuide('SEER').roleId).toBe('SEER');
    expect(getRoleGuide('WOLF_KING').camp).toBe('wolf');
  });
});
