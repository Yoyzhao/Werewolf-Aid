import { Flame, MessageCircle } from 'lucide-react';
import { useState } from 'react';

import { DaySubFlow } from '../../components/DaySubFlow';
import { FlowBar } from '../../components/FlowBar';
import { UndoButton } from '../../components/UndoButton';
import { useGameStore } from '../../stores/game-store';

import { SelfExplodeDialog, SelfExplodePanel } from '../shared/SelfExplode';

export function SpeechScreen() {
  const game = useGameStore((state) => state.game);
  const dispatch = useGameStore((state) => state.dispatch);

  const [startNo, setStartNo] = useState<number | null>(null);
  const [spoken, setSpoken] = useState<number[]>([]);
  const [explodeOpen, setExplodeOpen] = useState(false);

  if (!game || (game.phase !== 'SPEECH' && game.phase !== 'SELF_EXPLODE')) {
    return (
      <div className="screen-body">
        <div className="placeholder-card">
          <h2>当前不在发言阶段</h2>
        </div>
      </div>
    );
  }

  if (game.phase === 'SELF_EXPLODE') {
    return <SelfExplodePanel />;
  }

  const firstDay = game.round === 1 && game.options.sheriffElection;
  const aliveSeats = game.seats
    .filter((seat) => seat.alive)
    .sort((left, right) => left.no - right.no);
  const anchor = startNo ?? game.lastNightDeaths[0] ?? 0;
  const order = [
    ...aliveSeats.filter((seat) => seat.no > anchor),
    ...aliveSeats.filter((seat) => seat.no <= anchor),
  ];

  const toggleSpoken = (seatNo: number): void => {
    setSpoken((current) =>
      current.includes(seatNo) ? current.filter((item) => item !== seatNo) : [...current, seatNo],
    );
  };

  return (
    <>
      <div className="screen-body">
        <p className="eyebrow">第 {game.round} 天 · 发言</p>
        <h1>依次发言</h1>
        <p className="lead">
          默认从首名死者下一位开始；警长可指定起始座位。打卡仅作主持辅助，不阻塞进入投票。
        </p>

        <FlowBar view="speech" />
        <DaySubFlow view="speech" firstDay={firstDay} />

        <section className="card">
          <div className="card-head">
            <h3>发言起点</h3>
            <span className="hint">死左 / 警长指定</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-faint">从</span>
            <select
              className="min-h-11 rounded-lg border border-line-strong bg-surface-2 px-3 text-sm text-parchment"
              value={startNo ?? ''}
              onChange={(event) =>
                setStartNo(event.target.value === '' ? null : Number(event.target.value))
              }
              aria-label="指定发言起始座位"
            >
              <option value="">默认（首名死者下一位）</option>
              {aliveSeats.map((seat) => (
                <option key={seat.no} value={seat.no}>
                  {seat.no} 号
                </option>
              ))}
            </select>
            <span className="text-xs text-faint">开始顺时针发言</span>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h3>发言顺序</h3>
            <span className="hint">
              {spoken.length} / {aliveSeats.length}
            </span>
          </div>
          {order.map((seat, index) => {
            const hasSpoken = spoken.includes(seat.no);
            return (
              <div key={seat.no} className="list-row">
                <span className="ballot-voter">{index + 1}.</span>
                <div className="grow">
                  <b>
                    {seat.no} 号
                    {seat.no === game.sheriffNo ? (
                      <span className="badge-mini ml-2">警长</span>
                    ) : null}
                  </b>
                  <div className="text-xs text-faint">{hasSpoken ? '已发言' : '待发言'}</div>
                </div>
                <button
                  type="button"
                  className="pick-btn"
                  aria-pressed={hasSpoken}
                  onClick={() => toggleSpoken(seat.no)}
                >
                  {hasSpoken ? '已发言' : '标记发言'}
                </button>
              </div>
            );
          })}
        </section>

        <button type="button" className="danger-link mt-3" onClick={() => setExplodeOpen(true)}>
          <Flame size={15} className="mr-1 inline" />
          狼人自爆
        </button>
      </div>

      <div className="actionbar">
        <div className="actionbar-in">
          <UndoButton />
          <button
            type="button"
            className="btn primary"
            onClick={() => dispatch({ type: 'SPEECH_DONE' })}
          >
            <MessageCircle size={17} />
            进入投票
          </button>
        </div>
      </div>

      <SelfExplodeDialog open={explodeOpen} onOpenChange={setExplodeOpen} />
    </>
  );
}
