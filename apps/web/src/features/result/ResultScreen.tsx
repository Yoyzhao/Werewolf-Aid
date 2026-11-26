import { Home, ShieldOff, Skull, Trophy } from 'lucide-react';
import { useState } from 'react';
import {
  getBoard,
  getSeat,
  ROLE_DEFINITIONS,
  type DeathCause,
  type GameState,
  type NightAction,
  type PublicEvent,
} from '@lrs/game-engine';

import { ConfirmDialog } from '../../components/ConfirmDialog';
import { FlowBar } from '../../components/FlowBar';
import { RoleAvatar } from '../../components/RoleAvatar';
import { roleName } from '../../lib/board';
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

function eventLabel(event: PublicEvent): string {
  const seats = event.seatNos.join('、');
  const day = event.phase === 'NIGHT' ? '夜' : '天';
  switch (event.type) {
    case 'NO_DEATH':
      return `第 ${event.round} 夜 · 平安夜`;
    case 'DEATH':
      return `第 ${event.round} ${day} · ${seats} 号出局（${
        event.cause ? CAUSE_LABELS[event.cause] : '出局'
      }）`;
    case 'SELF_EXPLODE':
      return `第 ${event.round} ${day} · ${seats} 号自爆`;
    case 'SHERIFF_ELECTED':
      return `第 ${event.round} 天 · ${seats} 号当选警长`;
    case 'SHERIFF_NONE':
      return `第 ${event.round} 天 · 本局无警长`;
    case 'EXILE':
      return `第 ${event.round} 天 · 放逐投票最高票：${seats} 号`;
    case 'NO_EXILE':
      return `第 ${event.round} 天 · 平票或弃票，本轮无人出局`;
    case 'IDIOT_REVEALED':
      return `第 ${event.round} 天 · ${seats} 号白痴翻牌：免死、失去投票权`;
    case 'HUNTER_SHOOT':
      return `第 ${event.round} ${day} · 猎人开枪：${seats} 号`;
    case 'BADGE_TRANSFER':
      return `第 ${event.round} ${day} · 警徽移交给 ${seats} 号`;
    case 'BADGE_DESTROYED':
      return `第 ${event.round} ${day} · 警徽被撕毁`;
    case 'WOLF_KING_TAKE':
      return `第 ${event.round} ${day} · 白狼王带人：${seats} 号`;
    default:
      return `第 ${event.round} ${day} · ${event.type}`;
  }
}

function nightActionLabel(action: NightAction, game: GameState): string {
  switch (action.roleId) {
    case 'GUARD':
      return `守卫：${action.target === null ? '空守' : `守护 ${action.target} 号`}`;
    case 'SEER': {
      if (action.target === null) return '预言家：未查验';
      const seat = getSeat(game, action.target);
      const camp =
        seat?.role !== null && seat?.role !== undefined
          ? ROLE_DEFINITIONS[seat.role].camp === 'wolf'
            ? '狼人'
            : '好人'
          : '未知';
      return `预言家：查验 ${action.target} 号（${camp}）`;
    }
    case 'WOLF':
      return `狼人：${action.target === null ? '空刀' : `刀 ${action.target} 号`}`;
    case 'WITCH':
      if (action.potion === 'ANTIDOTE') return `女巫：解药救 ${action.target} 号`;
      if (action.potion === 'POISON') return `女巫：毒药 ${action.target} 号`;
      return '女巫：未用药';
    default:
      return roleName(action.roleId);
  }
}

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

  const rounds = [...new Set(game.nightActions.map((action) => action.round))].sort(
    (left, right) => left - right,
  );

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

        <section className="card">
          <div className="card-head">
            <h3>逐夜私密记录</h3>
            <span className="hint">仅主持端</span>
          </div>
          {rounds.length === 0 ? (
            <p className="text-sm text-faint">本局没有夜间动作记录。</p>
          ) : (
            rounds.map((round) => (
              <div key={round} className="result-round">
                <p className="eyebrow">第 {round} 夜</p>
                {game.nightActions
                  .filter((action) => action.round === round)
                  .map((action) => (
                    <p key={`${round}-${action.step}`} className="text-sm text-muted">
                      {nightActionLabel(action, game)}
                    </p>
                  ))}
              </div>
            ))
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h3>关键事件</h3>
            <span className="hint">{game.events.length} 条</span>
          </div>
          {game.events.length === 0 ? (
            <p className="text-sm text-faint">暂无公开事件。</p>
          ) : (
            game.events.map((event) => (
              <p key={event.seq} className="event-line">
                <Skull size={13} className="mr-1 inline" />
                {eventLabel(event)}
              </p>
            ))
          )}
        </section>

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
