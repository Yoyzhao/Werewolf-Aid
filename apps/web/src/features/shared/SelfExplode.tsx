import * as Dialog from '@radix-ui/react-dialog';
import { Flame, ShieldOff } from 'lucide-react';
import { useState } from 'react';
import { getSeat, ROLE_DEFINITIONS } from '@lrs/game-engine';

import { DaySubFlow } from '../../components/DaySubFlow';
import { FlowBar } from '../../components/FlowBar';
import { SeatGrid, type SeatItem } from '../../components/SeatGrid';
import { UndoButton } from '../../components/UndoButton';
import { roleName } from '../../lib/board';
import { useGameStore } from '../../stores/game-store';

export interface SelfExplodeDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

export function SelfExplodeDialog({ open, onOpenChange }: SelfExplodeDialogProps) {
  const game = useGameStore((state) => state.game);
  const dispatch = useGameStore((state) => state.dispatch);
  const [seatNo, setSeatNo] = useState<number | null>(null);

  if (!game) return null;
  const wolves = game.seats.filter(
    (seat) => seat.alive && seat.role !== null && ROLE_DEFINITIONS[seat.role].camp === 'wolf',
  );

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[min(420px,calc(100%-32px))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-line-strong bg-surface p-5 shadow-2xl">
          <p className="eyebrow">危险操作 · 二次确认</p>
          <Dialog.Title className="text-lg font-semibold text-parchment">确认自爆</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm leading-6 text-muted">
            选择自爆的狼人座位。自爆会中止当前流程；白狼王可带走一人，警长需处理警徽。
          </Dialog.Description>

          <div className="mt-4 flex flex-wrap gap-2">
            {wolves.map((seat) => (
              <button
                key={seat.no}
                type="button"
                className="pick-btn"
                aria-pressed={seatNo === seat.no}
                onClick={() => setSeatNo(seat.no)}
              >
                {seat.no} 号 {seat.role ? roleName(seat.role) : ''}
              </button>
            ))}
          </div>

          <div className="mt-5 flex gap-2.5">
            <Dialog.Close asChild>
              <button type="button" className="btn ghost flex-1">
                取消
              </button>
            </Dialog.Close>
            <button
              type="button"
              className="btn danger flex-1"
              disabled={seatNo === null}
              onClick={() => {
                if (seatNo === null) return;
                const result = dispatch({ type: 'SELF_EXPLODE', seatNo });
                if (result.ok) {
                  setSeatNo(null);
                  onOpenChange(false);
                }
              }}
            >
              <Flame size={16} />
              确认自爆
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function SelfExplodePanel() {
  const game = useGameStore((state) => state.game);
  const dispatch = useGameStore((state) => state.dispatch);
  const [takeTarget, setTakeTarget] = useState<number | null>(null);
  const [badgeTarget, setBadgeTarget] = useState<number | null>(null);

  if (!game || game.phase !== 'SELF_EXPLODE' || game.explodingSeat === null) {
    return null;
  }

  const exploding = getSeat(game, game.explodingSeat);
  const aliveItems: SeatItem[] = game.seats.map((seat) => ({
    no: seat.no,
    label: seat.alive ? '在场' : '出局',
    dead: !seat.alive,
    current:
      (game.pendingWolfKingTake && takeTarget === seat.no) ||
      (game.pendingBadge && badgeTarget === seat.no),
  }));
  const canFinish = !game.pendingWolfKingTake && !game.pendingBadge;
  const interruptedView = game.interruptedPhase === 'SHERIFF' ? 'sheriff' : 'speech';
  const firstDay = game.round === 1 && game.options.sheriffElection;

  return (
    <div className="screen-body">
      <div className="deal-head">
        <div className="flex h-[74px] w-[74px] shrink-0 items-center justify-center rounded-full border border-[#5a2b2e] bg-[rgb(229_72_77/10%)] text-[#ffd7d8]">
          <Flame size={30} />
        </div>
        <div>
          <p className="eyebrow">自爆结算</p>
          <h1 className="text-[22px]">{exploding?.no} 号自爆</h1>
          <p className="lead">
            {exploding?.role ? roleName(exploding.role) : '狼人'}已出局；处理带人与警徽后检查胜负。
          </p>
        </div>
      </div>

      <FlowBar view={interruptedView} />
      <DaySubFlow view={interruptedView} firstDay={firstDay} />

      <section className="card">
        <div className="card-head">
          <h3>白狼王带人</h3>
          <span className="hint">{game.pendingWolfKingTake ? '待处理' : '不适用'}</span>
        </div>
        {game.pendingWolfKingTake ? (
          <>
            <p className="sub-line mb-2">选择一名存活玩家带走，或跳过。</p>
            <SeatGrid
              items={aliveItems}
              onSelect={(seatNo) => {
                setTakeTarget(seatNo);
                dispatch({ type: 'WOLF_KING_TAKE', target: seatNo });
              }}
              ariaLabel="白狼王带人目标"
            />
            <button
              type="button"
              className="btn ghost mt-3"
              onClick={() => {
                setTakeTarget(null);
                dispatch({ type: 'WOLF_KING_TAKE', target: null });
              }}
            >
              不带人
            </button>
          </>
        ) : (
          <p className="text-sm text-faint">本次自爆不触发带人。</p>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h3>警徽处理</h3>
          <span className="hint">{game.pendingBadge ? '待处理' : '无'}</span>
        </div>
        {game.pendingBadge ? (
          <>
            <p className="sub-line mb-2">警长已出局：选择存活继任，或撕毁警徽。</p>
            <SeatGrid
              items={aliveItems}
              onSelect={(seatNo) => {
                setBadgeTarget(seatNo);
                dispatch({ type: 'BADGE_TRANSFER', target: seatNo });
              }}
              ariaLabel="警徽继任目标"
            />
            <button
              type="button"
              className="danger-link mt-3"
              onClick={() => dispatch({ type: 'BADGE_DESTROY' })}
            >
              <ShieldOff size={15} className="mr-1 inline" />
              撕毁警徽
            </button>
          </>
        ) : (
          <p className="text-sm text-faint">无需处理警徽。</p>
        )}
      </section>

      <div className="actionbar">
        <div className="actionbar-in">
          <UndoButton />
          <button
            type="button"
            className="btn primary"
            disabled={!canFinish}
            onClick={() => dispatch({ type: 'EXPLODE_RESOLVED' })}
          >
            完成自爆结算
          </button>
        </div>
      </div>
    </div>
  );
}
