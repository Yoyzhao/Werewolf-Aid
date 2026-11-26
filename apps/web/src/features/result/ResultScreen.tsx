import { Home, ShieldOff, Trophy } from 'lucide-react';
import { useState } from 'react';
import { getBoard, ROLE_DEFINITIONS } from '@lrs/game-engine';

import { ConfirmDialog } from '../../components/ConfirmDialog';
import { FlowBar } from '../../components/FlowBar';
import { RoleAvatar } from '../../components/RoleAvatar';
import { roleName } from '../../lib/board';
import { buildHostTimeline } from '../../lib/timeline';
import { useGameStore } from '../../stores/game-store';
import { Timeline } from './Timeline';

export function ResultScreen() {
  const game = useGameStore((state) => state.game);
  const playAgain = useGameStore((state) => state.playAgain);
  const clearGame = useGameStore((state) => state.clearGame);
  const goHome = useGameStore((state) => state.goHome);

  const [againOpen, setAgainOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);

  if (!game) {
    return (
      <div className="screen-body">
        <div className="placeholder-card">
          <h2>没有可查看的结算</h2>
          <button type="button" className="btn primary mt-4" onClick={goHome}>
            返回首页
          </button>
        </div>
      </div>
    );
  }

  const board = getBoard(game.boardId);
  const winner = game.result?.winner ?? null;
  const aliveRoles = game.seats.flatMap((seat) =>
    seat.alive && seat.role !== null ? [ROLE_DEFINITIONS[seat.role]] : [],
  );
  const gods = aliveRoles.filter((role) => role.kind === 'god').length;
  const villagers = aliveRoles.filter((role) => role.kind === 'villager').length;
  const reason =
    winner === 'good'
      ? '狼人全部出局'
      : gods === 0
        ? '神职全部出局'
        : villagers === 0
          ? '平民全部出局'
          : '达成屠边条件';

  const timeline = buildHostTimeline(game);

  return (
    <>
      <div className="screen-body">
        <p className="eyebrow">对局结束 · {board.name}</p>
        <h1>结算</h1>
        <p className="lead">胜负已判定；身份、逐夜私密记录与关键事件仅供主持端复盘。</p>

        <FlowBar view="result" />

        <section className="dawn-banner">
          <p className="eyebrow">本局结果 · 第 {game.result?.round ?? game.round} 回合</p>
          <h2 className="flex items-center gap-2">
            <Trophy size={20} />
            {winner === 'good' ? '好人阵营胜利' : winner === 'wolf' ? '狼人阵营胜利' : '对局结束'}
          </h2>
          <p>{winner ? reason : '未记录胜负结果。'}</p>
        </section>

        <section className="card">
          <div className="card-head">
            <h3>身份揭晓</h3>
            <span className="hint">12 人</span>
          </div>
          <div className="result-grid">
            {game.seats.map((seat) => {
              const role = seat.role;
              const definition = role ? ROLE_DEFINITIONS[role] : null;
              return (
                <div key={seat.no} className="result-seat" data-dead={!seat.alive}>
                  <span className="n">{String(seat.no).padStart(2, '0')}</span>
                  {role ? <RoleAvatar roleId={role} size={26} /> : null}
                  <b>{role ? roleName(role) : '未发牌'}</b>
                  <span className={`chip ${definition?.camp === 'wolf' ? 'priv' : 'ok'}`}>
                    {definition ? (definition.camp === 'wolf' ? '狼人' : '好人') : '—'}
                  </span>
                  <span className="text-[11px] text-faint">{seat.alive ? '存活' : '出局'}</span>
                </div>
              );
            })}
          </div>
        </section>

        <Timeline groups={timeline} hint="主持端完整 · 默认展开最近一夜" />

        <p className="mt-3 text-xs text-faint">
          结算后不可回退；再来一局会保留当前板子与设置并清空本局记录。
        </p>
        <button type="button" className="danger-link mt-3" onClick={() => setClearOpen(true)}>
          <ShieldOff size={15} className="mr-1 inline" />
          清除本局
        </button>
      </div>

      <div className="actionbar">
        <div className="actionbar-in">
          <button type="button" className="btn ghost" onClick={goHome}>
            <Home size={15} />
            返回首页
          </button>
          <button type="button" className="btn primary" onClick={() => setAgainOpen(true)}>
            再来一局
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={againOpen}
        title="再来一局"
        description="保留当前板子与设置，清空本局对局记录并回到开局设置。确定吗？"
        confirmLabel="再来一局"
        onConfirm={playAgain}
        onOpenChange={setAgainOpen}
      />

      <ConfirmDialog
        open={clearOpen}
        title="清除本局"
        description="清除本局记录并返回首页；助手记录与 AI 配置不受影响。确定吗？"
        confirmLabel="清除"
        danger
        onConfirm={clearGame}
        onOpenChange={setClearOpen}
      />
    </>
  );
}
