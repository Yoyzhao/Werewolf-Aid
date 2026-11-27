import { describe, expect, it } from 'vitest';

import { searchRules, splitHighlight } from './rules-search';

describe('searchRules', () => {
  it('空关键词不返回结果', () => {
    expect(searchRules('')).toEqual([]);
    expect(searchRules('   ')).toEqual([]);
  });

  it('跨术语与角色检索，命中解释字段', () => {
    const hits = searchRules('金水');

    expect(hits.some((hit) => hit.kind === 'term' && hit.title === '金水')).toBe(true);
    expect(hits.some((hit) => hit.kind === 'role' && hit.title === '预言家')).toBe(true);
    expect(hits.some((hit) => hit.text.includes('金水'))).toBe(true);
  });

  it('支持别名与板子、流程检索', () => {
    expect(searchRules('同守同救规则').some((hit) => hit.title === '同守同救')).toBe(true);
    expect(searchRules('预女猎白').some((hit) => hit.kind === 'board')).toBe(true);
    expect(searchRules('警长竞选').some((hit) => hit.kind === 'flow')).toBe(true);
  });

  it('无命中返回空数组', () => {
    expect(searchRules('完全不存在的关键词')).toEqual([]);
  });
});

describe('splitHighlight', () => {
  it('标出全部命中片段并保留原文', () => {
    const parts = splitHighlight('同守同救，再次同守同救', '同守同救');

    expect(parts.map((part) => part.text).join('')).toBe('同守同救，再次同守同救');
    expect(parts.filter((part) => part.match)).toHaveLength(2);
  });

  it('无命中时返回整段非高亮文本', () => {
    expect(splitHighlight('金水', '查杀')).toEqual([{ text: '金水', match: false }]);
  });

  it('大小写不敏感且空关键词不高亮', () => {
    const parts = splitHighlight('Wolf King', 'wolf');

    expect(parts[0]).toEqual({ text: 'Wolf', match: true });
    expect(splitHighlight('任意文本', '   ')).toEqual([{ text: '任意文本', match: false }]);
  });
});
