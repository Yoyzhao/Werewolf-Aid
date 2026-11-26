import { ArrowLeft, CheckCircle2, Eye } from 'lucide-react';
import { useState, type CSSProperties } from 'react';
import { getBoard } from '@lrs/game-engine';
import { toast } from 'sonner';

import { ConfirmDialog } from '../../components/ConfirmDialog';
import { FlowBar } from '../../components/FlowBar';
import { SeatGrid, type SeatItem } from '../../components/SeatGrid';
import { assignedCount, DEAL_MODE_LABELS } from '../../lib/board';
import { useGameStore } from '../../stores/game-store';

import { DealCover } from './DealCover';
import { ManualDeal } from './ManualDeal';

export function DealScreen() {
  const game = useGameStore((state) => state.game);
  const draft = useGameStore((state) => state.draft);
  const boardId = useGameStore((state) => state.boardId);
  const dealMode = useGameStore((state) => state.dealMode);
  const options = useGameStore((state) => state.options);
  const revealNext = useGameStore((state) => state.revealNext);
  const assignManualRole = useGameStore((state) => state.assignManualRole);
  const undoManualAssignment = useGameStore((state) => state.undoManualAssignment);
  const stepBackDeal = useGameStore((state) => state.stepBackDeal);
  const finishDeal = useGameStore((state) => state.finishDeal);
  const exitDeal = useGameStore((state) => state.exitDeal);
  const goSetup = useGameStore((state) => state.goSetup);

  const [coverSeat, setCoverSeat] = useState<number | null>(null);
  const [exitOpen, setExitOpen] = useState(false);
  const [backOpen, setBackOpen] = useState(false);

  if (!game || !draft) {
    return (
      <div className="screen-body">
        <div className="placeholder-card">
          <h2>尚未开局</h2>
          <p className="mt-2 text-sm text-muted">请先完成开局设置，再进入发牌。</p>
          <button type="button" className="btn primary mt-4" onClick={goSetup}>
            返回设置
          </button>
        </div>
      </div>
    );
  }

  const board = getBoard(boardId);
  const isManual = dealMode === 'C';
  const progress = isManual ? assignedCount(draft.assignments) : draft.revealed;
  const complete = progress >= 12;
  const currentNo = Math.min(progress + 1, 12);
  const modeName = DEAL_MODE_LABELS[dealMode];

  const seatItems: SeatItem[] = Array.from({ length: 12 }, (_, index) => {
    const no = index + 1;
    return {
      no,
      label: no <= progress ? '已发' : '待发',
      done: no <= progress,
      current: no === currentNo && !complete,
    };
  });

  const openCover = () => {
    if (complete) {
      toast('12 位玩家都已发牌');
      return;
    }
    setCoverSeat(currentNo);
  };

  const handleAdvance = () => {
    const wasLast = draft.revealed === 11;
    revealNext();
    setCoverSeat(null);
    if (wasLast) toast.success('发牌完成，可以进入天黑');
  };

  const handleBack = () => {
    if (progress > 0) {
      setBackOpen(true);
      return;
    }
    setExitOpen(true);
  };

  const coverRole = coverSeat === null ? undefined : draft.assignments[coverSeat];

  return (
    <>
      <div className="screen-body">
        <div className="deal-head">
          <div
            className="deal-ring"
            aria-hidden="true"
            style={{ '--p': `${Math.round((progress / 12) * 100)}%` } as CSSProperties}
          >
            <span className="no">{complete ? '✓' : currentNo}</span>
          </div>
          <div className="deal-head-copy min-w-0">
            <p className="eyebrow">主持 · 第 2 步 / 共 4 步</p>
            <h1>发牌 · {modeName}</h1>
            <p className="lead">
              {dealMode === 'A'
                ? '全屏遮罩 → 玩家查看身份 → 交回下一位。'
                : dealMode === 'B'
                  ? '默认遮罩，主持人二次点击才显示身份，确认后进入下一位。'
                  : '线下发实体牌 → 主持人按 1→12 手动选择身份 → 玩家不看屏。'}
            </p>
          </div>
        </div>

        <FlowBar view="deal" />

        {isManual ? (
          <ManualDeal
            boardId={boardId}
            assignments={draft.assignments}
            roles={board.roles}
            onAssign={assignManualRole}
            onUndo={undoManualAssignment}
          />
        ) : (
          <section className="card">
            <div className="card-head">
              <h3>发牌进度</h3>
              <span className="hint">{progress} / 12</span>
            </div>

            <SeatGrid items={seatItems} ariaLabel="发牌进度" />

            <div className="divider" />

            {complete ? (
              <div className="flex items-start gap-2 rounded-xl border border-[#27503f] bg-[rgb(70_185_138/9%)] p-3 text-sm text-good">
                <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
                <span>12 位玩家已全部完成，可以进入天黑。</span>
              </div>
            ) : (
              <button type="button" className="btn primary w-full" onClick={openCover}>
                <Eye size={17} />
                {dealMode === 'A' ? `呼叫 ${currentNo} 号查看` : `为 ${currentNo} 号显示身份`}
              </button>
            )}

            <p className="mt-2.5 text-xs text-faint">
              {dealMode === 'A'
                ? '遮罩中不显示身份；每位玩家只在自己那一步看到身份。'
                : '模式 B 默认遮罩；「显示身份」为二次操作，防止旁人误看。'}
            </p>
          </section>
        )}

        <div className="rail-card mt-4 hidden lg:block">
          <div className="card-head">
            <h3>本局信息</h3>
            <span className="hint">{progress} / 12</span>
          </div>
          <p className="text-sm font-semibold text-parchment">{board.name}</p>
          <p className="mt-1 text-xs text-faint">
            {modeName} · {options.sheriffElection ? '首夜竞选' : '无首夜竞选'} ·{' '}
            {options.witchSelfSaveFirstNight ? '首夜自救开' : '首夜自救关'}
          </p>
          <div className="divider" />
          <p className="text-xs leading-6 text-faint">
            {isManual
              ? '已录明细默认隐藏；核对需二次确认。12 人未满或构成不一致时不能进入天黑。'
              : '身份只在遮罩后的二次操作中展示；12 人完成前不能进入天黑。'}
          </p>
        </div>
      </div>

      <div className="actionbar">
        <div className="actionbar-in">
          <button type="button" className="btn ghost" onClick={handleBack}>
            <ArrowLeft size={16} />
            {progress > 0 ? '回退一步' : '退出本局'}
          </button>
          <button type="button" className="btn primary" disabled={!complete} onClick={finishDeal}>
            完成发牌，进入天黑
          </button>
        </div>
      </div>

      {coverSeat !== null && coverRole && dealMode !== 'C' ? (
        <DealCover
          mode={dealMode}
          seatNo={coverSeat}
          roleId={coverRole}
          onAdvance={handleAdvance}
        />
      ) : null}

      <ConfirmDialog
        open={backOpen}
        title="回退一步"
        description={`将撤销最近一次发牌记录（当前 ${progress} / 12）。确定回退吗？`}
        confirmLabel="回退"
        danger
        onConfirm={stepBackDeal}
        onOpenChange={setBackOpen}
      />

      <ConfirmDialog
        open={exitOpen}
        title="退出本局"
        description="当前发牌尚未完成，退出会清空本局发牌记录。确定退出吗？"
        confirmLabel="确认退出"
        danger
        onConfirm={exitDeal}
        onOpenChange={setExitOpen}
      />
    </>
  );
}
