import {
  getRoleGuide,
  ROLE_GUIDES,
  RULE_BOARDS,
  RULES_FLOWS,
  TERMS,
  TERM_CATEGORY_LABELS,
} from '@lrs/rules-content';

export type RulesSearchKind = 'board' | 'role' | 'flow' | 'term';

export interface RulesSearchHit {
  readonly id: string;
  readonly kind: RulesSearchKind;
  readonly category: string;
  readonly title: string;
  readonly subtitle: string;
  readonly text: string;
}

export interface HighlightPart {
  readonly text: string;
  readonly match: boolean;
}

const KIND_CATEGORIES: Record<RulesSearchKind, string> = {
  board: '板子',
  role: '角色',
  flow: '流程',
  term: '术语',
};

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function matches(text: string, query: string): boolean {
  return text.toLowerCase().includes(query);
}

function pickText(candidates: readonly string[], query: string, fallback: string): string {
  return candidates.find((text) => matches(text, query)) ?? fallback;
}

function hit(
  kind: RulesSearchKind,
  id: string,
  title: string,
  subtitle: string,
  text: string,
): RulesSearchHit {
  return { id, kind, category: KIND_CATEGORIES[kind], title, subtitle, text };
}

function searchTerms(query: string): RulesSearchHit[] {
  const hits: RulesSearchHit[] = [];

  for (const term of TERMS) {
    const alias = term.aliases.find((item) => matches(item, query));
    const fields = [term.summary, ...term.aliases, term.detail];
    if (
      !matches(term.term, query) &&
      !term.aliases.some((item) => matches(item, query)) &&
      !matches(term.summary, query) &&
      !matches(term.detail, query)
    ) {
      continue;
    }

    const text = alias ? `别名：${alias}` : pickText(fields, query, term.summary);
    hits.push(
      hit(
        'term',
        term.id,
        term.term,
        TERM_CATEGORY_LABELS[term.category],
        matches(text, query) ? text : term.summary,
      ),
    );
  }

  return hits;
}

function searchRoles(query: string): RulesSearchHit[] {
  const hits: RulesSearchHit[] = [];

  for (const guide of ROLE_GUIDES) {
    const fields = [guide.skill, ...guide.limits, ...guide.tactics, ...guide.mistakes];
    const matched = matches(guide.name, query) || fields.some((field) => matches(field, query));
    if (!matched) continue;

    hits.push(
      hit(
        'role',
        guide.roleId,
        guide.name,
        guide.camp === 'wolf' ? '狼人阵营' : '好人阵营',
        pickText(fields, query, guide.skill),
      ),
    );
  }

  return hits;
}

function searchBoards(query: string): RulesSearchHit[] {
  const hits: RulesSearchHit[] = [];

  for (const board of RULE_BOARDS) {
    const composition = board.roles
      .map((slot) => `${getRoleGuide(slot.roleId).name} ${slot.count}`)
      .join(' · ');
    const nightOrder = board.nightOrder.map((roleId) => getRoleGuide(roleId).name).join(' → ');
    const fields = [board.summary, board.winRule, composition, nightOrder];
    const matched = matches(board.name, query) || fields.some((field) => matches(field, query));
    if (!matched) continue;

    hits.push(
      hit(
        'board',
        board.id,
        `${board.name}（${board.playerCount} 人）`,
        board.winRule,
        pickText(fields, query, board.summary),
      ),
    );
  }

  return hits;
}

function searchFlows(query: string): RulesSearchHit[] {
  const hits: RulesSearchHit[] = [];

  for (const flow of RULES_FLOWS) {
    const matched = matches(flow.title, query) || flow.steps.some((step) => matches(step, query));
    if (!matched) continue;

    hits.push(
      hit(
        'flow',
        flow.id,
        flow.title,
        `${flow.steps.length} 步`,
        pickText(flow.steps, query, flow.steps[0] ?? ''),
      ),
    );
  }

  return hits;
}

/** 跨板子、角色、流程、术语的统一搜索。 */
export function searchRules(rawQuery: string): RulesSearchHit[] {
  const query = normalize(rawQuery);
  if (!query) return [];

  return [
    ...searchTerms(query),
    ...searchRoles(query),
    ...searchBoards(query),
    ...searchFlows(query),
  ];
}

/** 按关键词切分文本，供 `<mark>` 高亮。 */
export function splitHighlight(text: string, rawQuery: string): HighlightPart[] {
  const query = normalize(rawQuery);
  if (!query) return text ? [{ text, match: false }] : [];

  const haystack = text.toLowerCase();
  const parts: HighlightPart[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const found = haystack.indexOf(query, cursor);
    if (found === -1) {
      parts.push({ text: text.slice(cursor), match: false });
      break;
    }
    if (found > cursor) parts.push({ text: text.slice(cursor, found), match: false });
    parts.push({ text: text.slice(found, found + query.length), match: true });
    cursor = found + query.length;
  }

  return parts.filter((part) => part.text.length > 0);
}
