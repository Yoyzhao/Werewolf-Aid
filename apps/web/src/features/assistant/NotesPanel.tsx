import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ASSISTANT_FREE_TEXT_LIMIT } from '../../lib/assistant';
import { useAssistantStore } from '../../stores/assistant-store';
import { useNotesStore } from '../../stores/notes-store';

const STATUS_LABELS = {
  idle: '未编辑',
  saving: '保存中…',
  saved: '已保存',
  error: '保存失败',
} as const;

export function NotesPanel() {
  const initialized = useNotesStore((state) => state.initialized);
  const text = useNotesStore((state) => state.text);
  const status = useNotesStore((state) => state.status);
  const init = useNotesStore((state) => state.init);
  const setText = useNotesStore((state) => state.setText);
  const flushSave = useNotesStore((state) => state.flushSave);
  const clear = useNotesStore((state) => state.clear);
  const retrySave = useNotesStore((state) => state.retrySave);
  const setFreeText = useAssistantStore((state) => state.setFreeText);

  const [clearOpen, setClearOpen] = useState(false);

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(
    () => () => {
      void flushSave();
    },
    [flushSave],
  );

  const referenceToFreeText = (): void => {
    const note = text.trim();
    if (!note) return;

    const current = useAssistantStore.getState().record.freeText;
    const separator = current.trim() ? '\n\n' : '';
    const next = `${current}${separator}【笔记引用】${note}`;
    setFreeText(next);

    if (next.length > ASSISTANT_FREE_TEXT_LIMIT) {
      toast('自由描述已达上限，引用内容已截断');
    } else {
      toast('已引用到自由描述');
    }
  };

  if (!initialized) {
    return (
      <section className="card" aria-label="笔记面板">
        <p className="text-sm text-muted">正在读取笔记…</p>
      </section>
    );
  }

  return (
    <>
      <section className="card" aria-label="笔记面板">
        <div className="card-head">
          <h3>私人笔记</h3>
          <span className="hint" role="status">
            {STATUS_LABELS[status]}
          </span>
        </div>
        <p className="text-xs text-faint">
          自由记录你的判断与复盘；仅保存在本机 IndexedDB，不会自动进入 AI
          上下文。需要时再手动引用到自由描述。
        </p>

        <textarea
          aria-label="私人笔记"
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={8}
          placeholder="例如：首夜验 3 号查杀；7 号倒钩嫌疑；明天先听后置位发言…"
          className="mt-3 w-full resize-y rounded-xl border border-line-strong bg-surface-2 p-3 text-sm leading-6 text-parchment placeholder:text-faint focus:border-gold focus:outline-none"
        />

        {status === 'error' ? (
          <div className="warn-strip strong mt-3" role="alert">
            <span className="flex-1">笔记保存失败，刷新可能丢失。请勿关闭页面。</span>
            <button type="button" className="btn ghost" onClick={retrySave}>
              重试
            </button>
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn primary"
            disabled={!text.trim()}
            onClick={referenceToFreeText}
          >
            引用到自由描述
          </button>
          <button
            type="button"
            className="btn danger"
            disabled={!text}
            onClick={() => setClearOpen(true)}
          >
            清空笔记
          </button>
        </div>
      </section>

      <ConfirmDialog
        open={clearOpen}
        title="清空笔记"
        description="将删除本机保存的全部笔记内容，且不可恢复；助手记录与 AI 配置不受影响。"
        confirmLabel="清除"
        danger
        onConfirm={() => {
          void clear();
          toast('已清空笔记');
        }}
        onOpenChange={setClearOpen}
      />
    </>
  );
}
