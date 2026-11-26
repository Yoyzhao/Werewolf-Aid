import { Eye, ShieldOff, Target } from 'lucide-react';
import { useState } from 'react';
import { getSeat, type DeathCause } from '@lrs/game-engine';

import { ConfirmDialog } from '../../components/ConfirmDialog';
import { DaySubFlow } from '../../components/DaySubFlow';
import { FlowBar } from '../../components/FlowBar';
import { SeatGrid, type SeatItem } from '../../components/SeatGrid';
import { UndoButton } from '../../components/UndoButton';
import { useGameStore } from '../../stores/game-store';

const CAUSE_LABELS: Record<DeathCause, string> = {
  WOLF: '被狼刀',
  POISON: '被毒',
  VOTE: '被放逐',
  HUNTER: '被猎人带走',
  WOLF_KING: '被白狼王带走',
  SELF_EXPLODE: '自爆',
  SAME_GUARD_SAVE: '同守同救',
};

export function DawnScreen() {
  const game = useGameStore((state) => state.game);
  const dispatch = useGameStore((state) => state.dispatch);

  const [hunterTarget, setHunterTarget] = useState<number | null>(null);
  const [badgeTarget, setBadgeTarget] = useState<number | null>(null);
  const [spoken, setSpoken] = useState<number[]>([]);
  const [skipped, setSkipped] = useState<number[]>([]);
  const [destroyOpen, setDestroyOpen] = useState(false);

  if (!game || game.phase !== 'DAWN') {
    return (
      <div className="screen-body">
        <div className="placeholder-card">
          <h2>当前不在死讯阶段</h2>
        </div>
      </div>
    );
  }

  const firstDay = game.round === 1 && game.options.sheriffElection;
  const deaths = game.lastNightDeaths;
  const deathSeats = deaths
    .map((seatNo) => getSeat(game, seatNo))
    .filter((seat): seat is NonNullable<typeof seat> => Boolean(seat));
  const lastWordSeats = game.round === 1 ? deathSeats : [];
  const aliveItems: SeatItem[] = game.seats.map((seat) => ({
    no: seat.no,
    label: seat.alive ? '在场' : '出局',
    dead: !seat.alive,
    current:
      (game.pendingHunterNo !== null && hunterTarget === seat.no) ||
      (game.pendingBadge && badgeTarget === seat.no),
  }));
  const blocked = game.pendingHunterNo !== null || game.pendingBadge;

  return (
    <>
      <div className="screen-body">
        <p className="eyebrow">第 {game.round} 天 · 死讯与遗言</p>
        <h1>天亮了</h1>
        <p className="lead">
          公布昨夜死讯；首夜死亡有遗言，猎人被刀在此开枪，警长死亡在此处理警徽。
        </p>

        <FlowBar view="dawn" />
        <DaySubFlow view="dawn" firstDay={firstDay} />

        <section className="dawn-banner">
          <p className="eyebrow">昨夜死讯</p>
          {deathSeats.length === 0 ? (
            <h2>平安夜：昨夜无人出局</h2>
          ) : (
            <>
              <h2>{deaths.join(' 号、')} 号出局</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {deathSeats.map((seat) => (
                  <span key={seat.no} className="chip priv">
                    {seat.no} 号 · {seat.deathCause ? CAUSE_LABELS[seat.deathCause] : '出局'}
                  </span>
                ))}
              </div>
            </>
          )}
        </section>

        {lastWordSeats.length > 0 ? (
          <section className="card">
            <div className="card-head">
              <h3>遗言</h3>
              <span className="hint">首夜死亡有遗言</span>
            </div>
            {lastWordSeats.map((seat) => {
              const hasSpoken = spoken.includes(seat.no);
              const hasSkipped = skipped.includes(seat.no);
              return (
                <div key={seat.no} className="list-row">
                  <div className="grow">
                    <b>{seat.no} 号</b>
                    <div className="text-xs text-faint">
                      {hasSpoken ? '已发言' : hasSkipped ? '已跳过' : '待发言'}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="pick-btn"
                    aria-pressed={hasSpoken}
                    onClick={() => {
                      setSkipped((current) => current.filter((item) => item !== seat.no));
                      setSpoken((current) =>
                        current.includes(seat.no)
                          ? current.filter((item) => item !== seat.no)
                          : [...current, seat.no],
                      );
                    }}
                  >
                    已发言
                  </button>
                  <button
                    type="button"
                    className="pick-btn"
                    aria-pressed={hasSkipped}
                    onClick={() => {
                      setSpoken((current) => current.filter((item) => item !== seat.no));
                      setSkipped((current) =>
                        current.includes(seat.no)
                          ? current.filter((item) => item !== seat.no)
                          : [...current, seat.no],
                      );
                    }}
                  >
                    跳过
                  </button>
                </div>
              );
            })}
          </section>
        ) : (
          <section className="card">
            <div className="card-head">
              <h3>遗言</h3>
              <span className="hint">本夜无遗言</span>
            </div>
            <p className="text-sm text-faint">第 2 夜及以后夜晚死亡无遗言；自爆默认无遗言。</p>
          </section>
        )}

        {game.pendingHunterNo !== null ? (
          <section className="card">
            <div className="card-head">
              <h3 className="flex items-center gap-2">
                <Target size={16} /> 猎人开枪
              </h3>
              <span className="hint">{game.pendingHunterNo} 号被刀</span>
            </div>
            <p className="sub-line mb-2">
              选择一名存活玩家带走，或跳过。被毒/被白狼王带走不可开枪。
            </p>
            <SeatGrid
              items={aliveItems}
              onSelect={(seatNo) => setHunterTarget(seatNo)}
              ariaLabel="猎人开枪目标"
            />
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="btn primary flex-1"
                disabled={hunterTarget === null}
                onClick={() => {
                  if (hunterTarget === null) return;
                  dispatch({ type: 'HUNTER_SHOOT', target: hunterTarget });
                  setHunterTarget(null);
                }}
              >
                确认开枪
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => dispatch({ type: 'HUNTER_SHOOT', target: null })}
              >
                跳过
              </button>
            </div>
          </section>
        ) : null}

        {game.pendingBadge ? (
          <section className="card">
            <div className="card-head">
              <h3>警徽处理</h3>
              <span className="hint">警长已出局</span>
            </div>
            <p className="sub-line mb-2">选择一名存活玩家继任，或撕毁警徽。</p>
            <SeatGrid
              items={aliveItems}
              onSelect={(seatNo) => setBadgeTarget(seatNo)}
              ariaLabel="警徽继任目标"
            />
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="btn primary flex-1"
                disabled={badgeTarget === null}
                onClick={() => {
                  if (badgeTarget === null) return;
                  dispatch({ type: 'BADGE_TRANSFER', target: badgeTarget });
                  setBadgeTarget(null);
                }}
              >
                移交警徽
              </button>
              <button type="button" className="danger-link" onClick={() => setDestroyOpen(true)}>
                <ShieldOff size={15} className="mr-1 inline" />
                撕毁
              </button>
            </div>
          </section>
        ) : null}

        <p className="mt-3 flex items-center gap-1 text-xs text-faint">
          <Eye size={14} /> 死因与技能结果公开；刀口/查验/用药仍仅主持端可见。
        </p>
      </div>

      <div className="actionbar">
        <div className="actionbar-in">
          <UndoButton />
          <button
            type="button"
            className="btn primary"
            disabled={blocked}
            onClick={() => dispatch({ type: 'DAWN_DONE' })}
          >
            {blocked ? '先处理技能与警徽' : '进入发言'}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={destroyOpen}
        title="撕毁警徽"
        description="撕毁后本局不再有警长，放逐票不再有 1.5 权重。确定吗？"
        confirmLabel="确认撕毁"
        danger
        onConfirm={() => dispatch({ type: 'BADGE_DESTROY' })}
        onOpenChange={setDestroyOpen}
      />
    </>
  );
}
