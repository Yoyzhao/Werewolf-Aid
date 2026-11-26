import * as Dialog from '@radix-ui/react-dialog';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';

const GUIDE_STEPS = [
  {
    title: '选板子',
    description: '选择预女猎守或预女猎白，确认 12 位玩家编号。编号固定为 1–12。',
  },
  {
    title: '发牌',
    description: '三种发牌方式任选：接力查看、线下逐步确认、实体牌录入。身份只给对应玩家看。',
  },
  {
    title: '按卡片主持',
    description:
      '跟着夜间与白天卡片逐步操作，系统负责判定胜负。赛前请保持页面打开，游戏中不要清理浏览器数据。',
  },
] as const;

export interface GuideDialogProps {
  readonly open: boolean;
  readonly onDismiss: () => void;
}

export function GuideDialog({ open, onDismiss }: GuideDialogProps) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  const current = GUIDE_STEPS[step] ?? GUIDE_STEPS[0];
  const isLast = step === GUIDE_STEPS.length - 1;

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onDismiss()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[min(440px,calc(100%-32px))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-line-strong bg-surface p-5 shadow-2xl">
          <p className="eyebrow">第一次来 · 3 步上手</p>
          <Dialog.Title className="text-xl font-semibold text-parchment">
            {current.title}
          </Dialog.Title>
          <Dialog.Description className="mt-2 min-h-[96px] text-sm leading-7 text-muted">
            {current.description}
          </Dialog.Description>

          <div className="flex gap-1.5" aria-label={`引导进度 ${step + 1} / ${GUIDE_STEPS.length}`}>
            {GUIDE_STEPS.map((item, index) => (
              <span
                key={item.title}
                className={`h-1 flex-1 rounded-full ${
                  index <= step ? 'bg-gold' : 'bg-line-strong'
                }`}
              />
            ))}
          </div>

          <div className="mt-5 flex items-center gap-2">
            <button type="button" className="btn ghost" onClick={onDismiss}>
              跳过
            </button>
            <span className="flex-1" />
            <button
              type="button"
              className="btn ghost"
              disabled={step === 0}
              onClick={() => setStep((value) => Math.max(0, value - 1))}
              aria-label="上一步"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={() => (isLast ? onDismiss() : setStep((value) => value + 1))}
            >
              {isLast ? (
                '开始主持'
              ) : (
                <>
                  下一步
                  <ChevronRight size={16} />
                </>
              )}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
