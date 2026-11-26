import { ChevronDown, Moon, Sun } from 'lucide-react';

import type { TimelineGroup } from '../../lib/timeline';

export interface TimelineProps {
  readonly groups: readonly TimelineGroup[];
  readonly title?: string;
  readonly hint?: string;
}

export function Timeline({ groups, title = '复盘时间线', hint }: TimelineProps) {
  if (groups.length === 0) {
    return (
      <section className="card" aria-label={title}>
        <div className="card-head">
          <h3>{title}</h3>
          <span className="hint">0 段</span>
        </div>
        <p className="text-sm text-faint">本局暂无可展示的事件</p>
      </section>
    );
  }

  return (
    <section className="card" aria-label={title}>
      <div className="card-head">
        <h3>{title}</h3>
        <span className="hint">{hint ?? `${groups.length} 段`}</span>
      </div>
      <div className="space-y-2">
        {groups.map((group) => (
          <details
            key={group.key}
            className="rounded-xl border border-line bg-surface-2"
            open={group.defaultOpen ? true : undefined}
          >
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-semibold text-parchment [&::-webkit-details-marker]:hidden">
              {group.phase === 'night' ? (
                <Moon size={15} className="shrink-0 text-gold" />
              ) : (
                <Sun size={15} className="shrink-0 text-gold" />
              )}
              <span>{group.title}</span>
              <span className="ml-auto text-xs font-normal text-faint">
                {group.entries.length} 条
              </span>
              <ChevronDown size={16} className="shrink-0 text-faint" />
            </summary>
            <ul className="space-y-1.5 border-t border-line px-3 py-2.5">
              {group.entries.map((entry) => (
                <li key={entry.id} className="flex items-start gap-2 text-sm">
                  <span
                    className={`chip mt-0.5 shrink-0 ${
                      entry.visibility === 'private' ? 'priv' : ''
                    }`}
                  >
                    {entry.visibility === 'private' ? '私密' : '公开'}
                  </span>
                  <span className="min-w-0 break-words text-muted">{entry.text}</span>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </section>
  );
}
