import { useState } from 'react';

import { ASSISTANT_PRESET_TAGS } from '../../lib/assistant';
import type { AssistantPlayerRecord } from '../../lib/types';

export interface AssistantPlayerRowProps {
  readonly seatNo: number;
  readonly player: AssistantPlayerRecord;
  readonly round: number;
  readonly onToggleTag: (tag: string) => void;
  readonly onInfoChange: (value: string) => void;
  readonly onSpeechChange: (value: string) => void;
}

const INPUT_CLASS =
  'min-h-11 min-w-0 flex-1 rounded-xl border border-line-strong bg-surface-2 px-3 text-sm text-parchment placeholder:text-faint focus:border-gold focus:outline-none';

const TEXTAREA_CLASS =
  'mt-1 w-full resize-y rounded-xl border border-line-strong bg-surface-2 p-2.5 text-sm leading-6 text-parchment placeholder:text-faint focus:border-gold focus:outline-none';

function isPresetTag(tag: string): boolean {
  return (ASSISTANT_PRESET_TAGS as readonly string[]).includes(tag);
}

export function AssistantPlayerRow({
  seatNo,
  player,
  round,
  onToggleTag,
  onInfoChange,
  onSpeechChange,
}: AssistantPlayerRowProps) {
  const [customTag, setCustomTag] = useState('');
  const customTags = player.tags.filter((tag) => !isPresetTag(tag));
  const hasRecord =
    player.info.trim().length > 0 ||
    Object.values(player.speechByRound).some((value) => value.trim().length > 0);

  const addCustomTag = (): void => {
    const tag = customTag.trim();
    if (!tag) return;
    if (!player.tags.includes(tag)) onToggleTag(tag);
    setCustomTag('');
  };

  return (
    <div
      className="border-t border-line pt-3 first:border-t-0 first:pt-0"
      role="group"
      aria-label={`${seatNo} 号记录`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-base font-semibold text-parchment">
          {String(seatNo).padStart(2, '0')}
        </span>
        <span className="text-xs text-faint">
          {player.tags.length ? `${player.tags.length} 个标签` : '未标记'}
        </span>
        {hasRecord ? <span className="chip ok">已记录</span> : null}
      </div>

      <div className="tag-grid" role="group" aria-label={`${seatNo} 号标签`}>
        {ASSISTANT_PRESET_TAGS.map((tag) => (
          <button
            key={tag}
            type="button"
            className="tag"
            aria-pressed={player.tags.includes(tag)}
            aria-label={`${seatNo} 号 ${tag}`}
            onClick={() => onToggleTag(tag)}
          >
            {tag}
          </button>
        ))}
        {customTags.map((tag) => (
          <button
            key={tag}
            type="button"
            className="tag"
            aria-pressed="true"
            aria-label={`${seatNo} 号 ${tag}`}
            onClick={() => onToggleTag(tag)}
          >
            {tag}
          </button>
        ))}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <input
          value={customTag}
          onChange={(event) => setCustomTag(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              addCustomTag();
            }
          }}
          placeholder="自定义标签"
          aria-label={`${seatNo} 号自定义标签`}
          maxLength={12}
          className={INPUT_CLASS}
        />
        <button
          type="button"
          className="btn ghost"
          aria-label={`为 ${seatNo} 号添加标签`}
          onClick={addCustomTag}
        >
          添加
        </button>
      </div>

      <label className="mt-2 block text-[11.5px] text-faint">
        信息记录
        <textarea
          aria-label={`${seatNo} 号信息记录`}
          value={player.info}
          onChange={(event) => onInfoChange(event.target.value)}
          rows={2}
          maxLength={2000}
          placeholder="身份判断、关系、可疑点"
          className={TEXTAREA_CLASS}
        />
      </label>

      <label className="mt-2 block text-[11.5px] text-faint">
        第 {round} 轮发言要点
        <textarea
          aria-label={`${seatNo} 号第 ${round} 轮发言要点`}
          value={player.speechByRound[round] ?? ''}
          onChange={(event) => onSpeechChange(event.target.value)}
          rows={2}
          maxLength={2000}
          placeholder="本轮发言要点"
          className={TEXTAREA_CLASS}
        />
      </label>
    </div>
  );
}
