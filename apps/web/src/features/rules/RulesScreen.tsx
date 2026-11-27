import { ArrowLeft, ChevronDown, Search } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { ROLE_DEFINITIONS } from '@lrs/game-engine';
import {
  getRoleGuide,
  ROLE_GUIDES,
  RULE_BOARDS,
  RULES_FLOWS,
  RULES_FOOTER,
  TERMS,
  TERM_CATEGORIES,
  TERM_CATEGORY_LABELS,
  type RuleRoleId,
  type TermEntry,
} from '@lrs/rules-content';

import { BottomTabs } from '../../components/BottomTabs';
import { RoleAvatar } from '../../components/RoleAvatar';
import { searchRules, splitHighlight } from '../../lib/rules-search';
import { useGameStore } from '../../stores/game-store';

const CAMP_LABELS = { good: '好人阵营', wolf: '狼人阵营' } as const;
const KIND_LABELS = { god: '神职', villager: '平民', wolf: '狼人' } as const;

const INPUT_CLASS =
  'mt-1 min-h-11 w-full rounded-xl border border-line-strong bg-surface-2 px-3 text-sm text-parchment placeholder:text-faint focus:border-gold focus:outline-none';

interface RuleAccordionProps {
  readonly title: string;
  readonly hint?: string;
  readonly defaultOpen?: boolean;
  readonly children: ReactNode;
}

function RuleAccordion({ title, hint, defaultOpen = false, children }: RuleAccordionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <details
      className="card group"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-semibold text-parchment [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
        {hint ? <span className="ml-auto text-xs font-normal text-faint">{hint}</span> : null}
        <ChevronDown
          size={16}
          className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''} ${
            hint ? '' : 'ml-auto'
          }`}
        />
      </summary>
      <div className="mt-3 border-t border-line pt-3 text-sm leading-6 text-muted">{children}</div>
    </details>
  );
}

function Highlight({ text, query }: { readonly text: string; readonly query: string }) {
  return (
    <>
      {splitHighlight(text, query).map((part, index) =>
        part.match ? (
          <mark key={index} className="rounded bg-gold/30 px-0.5 text-parchment">
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}

function TermCard({ term }: { readonly term: TermEntry }) {
  return (
    <article className="rounded-xl border border-line bg-surface-2 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-parchment">{term.term}</h3>
        <span className="chip">{TERM_CATEGORY_LABELS[term.category]}</span>
        {term.aliases.length ? (
          <span className="ml-auto text-[11px] text-faint">别名：{term.aliases.join('、')}</span>
        ) : null}
      </div>
      <p className="mt-1.5 text-sm leading-6 text-muted">{term.summary}</p>
      <p className="mt-1 text-xs leading-6 text-faint">{term.detail}</p>
    </article>
  );
}

export function RulesScreen() {
  const goHome = useGameStore((state) => state.goHome);
  const [selectedRole, setSelectedRole] = useState<RuleRoleId>('SEER');
  const [tab, setTab] = useState<'content' | 'terms'>('content');
  const [query, setQuery] = useState('');

  const definition = ROLE_DEFINITIONS[selectedRole];
  const guide = getRoleGuide(selectedRole);
  const keyword = query.trim();
  const hits = keyword ? searchRules(keyword) : [];

  return (
    <div className="screen-body pb-32">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">规则与攻略 · 只读</p>
          <h1>月蚀规则书</h1>
          <p className="lead">板子、角色、流程；冲突判定以开局约定为准。</p>
        </div>
        <button type="button" className="btn ghost" onClick={goHome}>
          <ArrowLeft size={16} />
          返回大厅
        </button>
      </div>

      <label className="mt-4 block text-[11.5px] text-faint">
        搜索规则与术语
        <span className="relative mt-1 block">
          <Search
            size={15}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint"
          />
          <input
            aria-label="搜索规则与术语"
            className={`${INPUT_CLASS} pl-9`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索板子、角色、流程或术语"
            maxLength={40}
          />
        </span>
      </label>

      {keyword ? (
        <section className="mt-4" aria-label="搜索结果">
          <div className="card-head">
            <h2 className="text-xs tracking-[0.14em] text-faint uppercase">搜索结果</h2>
            <span className="hint">{hits.length} 条</span>
          </div>
          {hits.length ? (
            <div className="space-y-2">
              {hits.map((hit) => (
                <article
                  key={`${hit.kind}-${hit.id}`}
                  className="rounded-xl border border-line bg-surface-2 p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="chip">{hit.category}</span>
                    <h3 className="text-sm font-semibold text-parchment">
                      <Highlight text={hit.title} query={keyword} />
                    </h3>
                    <span className="ml-auto text-[11px] text-faint">{hit.subtitle}</span>
                  </div>
                  <p className="mt-1.5 text-xs leading-6 break-words text-muted">
                    <Highlight text={hit.text} query={keyword} />
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <div className="card">
              <p className="text-sm text-faint">没有找到相关术语，试试更短的关键词</p>
            </div>
          )}
        </section>
      ) : (
        <>
          <div className="mt-4 flex gap-2" role="tablist" aria-label="规则视图">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'content'}
              className={`btn ${tab === 'content' ? 'primary' : 'ghost'}`}
              onClick={() => setTab('content')}
            >
              规则内容
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'terms'}
              className={`btn ${tab === 'terms' ? 'primary' : 'ghost'}`}
              onClick={() => setTab('terms')}
            >
              术语表
            </button>
          </div>

          {tab === 'terms' ? (
            <section aria-label="术语表">
              <p className="mt-3 text-xs text-faint">
                按板子、角色、流程、判定、口语分类；共 {TERMS.length} 条。
              </p>
              {TERM_CATEGORIES.map((category) => {
                const items = TERMS.filter((term) => term.category === category);
                if (items.length === 0) return null;
                return (
                  <div key={category} className="mt-4">
                    <h2 className="mb-2 text-xs tracking-[0.14em] text-faint uppercase">
                      {TERM_CATEGORY_LABELS[category]}
                    </h2>
                    <div className="space-y-2">
                      {items.map((term) => (
                        <TermCard key={term.id} term={term} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </section>
          ) : (
            <div>
              <h2 className="mt-2 mb-2 text-xs tracking-[0.14em] text-faint uppercase">板子</h2>
              {RULE_BOARDS.map((board, index) => {
                const goodSlots = board.roles.filter(
                  (slot) => ROLE_DEFINITIONS[slot.roleId].camp === 'good',
                );
                const wolfSlots = board.roles.filter(
                  (slot) => ROLE_DEFINITIONS[slot.roleId].camp === 'wolf',
                );
                const goodCount = goodSlots.reduce((total, slot) => total + slot.count, 0);
                const wolfCount = wolfSlots.reduce((total, slot) => total + slot.count, 0);

                return (
                  <RuleAccordion
                    key={board.id}
                    title={`${board.name}（${board.playerCount} 人）`}
                    hint={board.winRule}
                    defaultOpen={index === 0}
                  >
                    <div className="space-y-1.5">
                      <p>
                        <b className="text-parchment">好人 {goodCount}</b>：
                        {goodSlots
                          .map((slot) => `${ROLE_DEFINITIONS[slot.roleId].name} ${slot.count}`)
                          .join(' · ')}
                      </p>
                      <p>
                        <b className="text-parchment">狼人 {wolfCount}</b>：
                        {wolfSlots
                          .map((slot) => `${ROLE_DEFINITIONS[slot.roleId].name} ${slot.count}`)
                          .join(' · ')}
                      </p>
                      <p>
                        <b className="text-parchment">夜间顺序</b>：
                        {board.nightOrder
                          .map((roleId) => ROLE_DEFINITIONS[roleId].name)
                          .join(' → ')}
                      </p>
                      <p>
                        <b className="text-parchment">胜负</b>：{board.winRule} —— 狼全灭好人胜；
                        神全灭或民全灭狼胜。
                      </p>
                      <p className="text-faint">{board.summary}</p>
                    </div>
                  </RuleAccordion>
                );
              })}

              <h2 className="mt-6 mb-2 text-xs tracking-[0.14em] text-faint uppercase">角色图鉴</h2>
              <div
                className="grid grid-cols-2 gap-2 sm:grid-cols-4"
                role="group"
                aria-label="角色图鉴"
              >
                {ROLE_GUIDES.map((item) => {
                  const itemDefinition = ROLE_DEFINITIONS[item.roleId];
                  const selected = item.roleId === selectedRole;
                  return (
                    <button
                      key={item.roleId}
                      type="button"
                      className={`min-h-20 rounded-xl border p-2.5 text-left ${
                        selected ? 'border-gold bg-gold/10' : 'border-line bg-surface-2'
                      }`}
                      aria-pressed={selected}
                      aria-label={itemDefinition.name}
                      onClick={() => setSelectedRole(item.roleId)}
                    >
                      <span className="flex items-center gap-2">
                        <RoleAvatar roleId={item.roleId} size={28} />
                        <span className="text-sm font-semibold text-parchment">
                          {itemDefinition.name}
                        </span>
                      </span>
                      <span className="mt-1.5 flex flex-wrap gap-1">
                        <span className="chip">{CAMP_LABELS[itemDefinition.camp]}</span>
                        <span className="chip">{KIND_LABELS[itemDefinition.kind]}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <section
                className="mt-3 rounded-xl border border-line bg-surface-2 p-4"
                aria-live="polite"
              >
                <div className="flex items-center gap-3">
                  <RoleAvatar roleId={selectedRole} size={44} />
                  <div>
                    <h3>{definition.name}</h3>
                    <p className="mt-0.5 text-xs text-faint">
                      {CAMP_LABELS[definition.camp]} · {KIND_LABELS[definition.kind]}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted">{definition.skill}</p>

                {guide.limits.length ? (
                  <div className="mt-3">
                    <h4 className="text-xs font-semibold text-gold-soft">限制</h4>
                    <div className="chips mt-1.5">
                      {guide.limits.map((limit) => (
                        <span key={limit} className="chip">
                          {limit}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <h4 className="text-xs font-semibold text-gold-soft">常见打法</h4>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-xs leading-6 text-muted">
                      {guide.tactics.map((text) => (
                        <li key={text}>{text}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-gold-soft">易错点</h4>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-xs leading-6 text-muted">
                      {guide.mistakes.map((text) => (
                        <li key={text}>{text}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>

              <h2 className="mt-6 mb-2 text-xs tracking-[0.14em] text-faint uppercase">流程</h2>
              {RULES_FLOWS.map((flow) => (
                <RuleAccordion key={flow.id} title={flow.title} defaultOpen={flow.id === 'night'}>
                  <ul className="list-disc space-y-1 pl-5">
                    {flow.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ul>
                </RuleAccordion>
              ))}
            </div>
          )}
        </>
      )}

      <div className="mt-6 rounded-xl border border-line bg-surface px-4 py-3 text-center">
        <p className="text-xs text-faint">{RULES_FOOTER.text}</p>
        <p className="mt-1 text-[11px] text-faint">来源：{RULES_FOOTER.sources.join('、')}</p>
      </div>

      <BottomTabs active="rules" />
    </div>
  );
}
