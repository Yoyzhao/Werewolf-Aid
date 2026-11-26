import { Eye, Moon, Shield, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  getBoard,
  getCurrentNightRole,
  getSeat,
  ROLE_DEFINITIONS,
  type WitchPotion,
} from '@lrs/game-engine';

import { FlowBar } from '../../components/FlowBar';
import { RoleAvatar } from '../../components/RoleAvatar';
import { SeatGrid, type SeatItem } from '../../components/SeatGrid';
import { UndoButton } from '../../components/UndoButton';
import { roleName } from '../../lib/board';
import { useGameStore } from '../../stores/game-store';

const NIGHT_LINES: Record<string, string> = {
  GUARD: '守卫请睁眼，请选择你要守护的人',
  SEER: '预言家请睁眼，请选择你要查验的人',
  WOLF: '狼人请睁眼，互相确认队友；请选择击杀目标',
  WITCH: '女巫请睁眼，是否使用解药或毒药？',
};

const EMPTY_LABELS: Record<string, string> = {
  GUARD: '空守',
  WOLF: '空刀',
  WITCH: '不用药',
};

type PotionChoice = WitchPotion | 'NONE';

export function NightScreen() {
  const game = useGameStore((state) => state.game);
  const boardId = useGameStore((state) => state.boardId);
  const dispatch = useGameStore((state) => state.dispatch);

  const [selected, setSelected] = useState<number | null | undefined>(undefined);
  const [potion, setPotion] = useState<PotionChoice>('NONE');

  const board = getBoard(boardId);
  const currentRole = game ? getCurrentNightRole(game) : null;
  const recorded = game
    ? game.nightActions.find(
        (action) => action.round === game.round && action.step === game.nightStep,
      )
    : undefined;
  const isLastStep = game ? game.nightStep >= board.nightOrder.length - 1 : false;

  useEffect(() => {
    setSelected(recorded ? recorded.target : undefined);
    setPotion(recorded?.potion ?? 'NONE');
  }, [game?.round, game?.nightStep, recorded?.target, recorded?.potion]);

  if (!game || game.phase !== 'NIGHT' || !currentRole) {
    return (
      <div className="screen-body">
        <div className="placeholder-card">
          <h2>当前不在夜间</h2>
          <p className="mt-2 text-sm text-muted">请从首页继续上一局，或重新开局。</p>
        </div>
      </div>
    );
  }

  const aliveSeats = game.seats.filter((seat) => seat.alive);
  const seats = game.seats.map<SeatItem>((seat) => ({
    no: seat.no,
    label: !seat.alive ? '出局' : selected === seat.no ? '已选' : '在场',
    current: selected === seat.no,
    dead: !seat.alive,
  }));

  const actions = game.nightActions.filter((action) => action.round === game.round);
  const wolfAction = actions.find((action) => action.roleId === 'WOLF');
  const wolfTarget = wolfAction?.target ?? null;
  const previousGuard = game.nightActions.find(
    (action) => action.round === game.round - 1 && action.roleId === 'GUARD',
  );
  const antidoteUsed = game.nightActions.some(
    (action) => action.round < game.round && action.potion === 'ANTIDOTE',
  );
  const poisonUsed = game.nightActions.some(
    (action) => action.round < game.round && action.potion === 'POISON',
  );
  const wolfTeam = aliveSeats.filter((seat) => seat.role === 'WOLF' || seat.role === 'WOLF_KING');

  const record = (target: number | null, chosenPotion?: PotionChoice): void => {
    const potionValue =
      currentRole === 'WITCH' && chosenPotion && chosenPotion !== 'NONE' ? chosenPotion : undefined;
    const result = dispatch({
      type: 'NIGHT_ACTION',
      roleId: currentRole,
      target,
      ...(potionValue ? { potion: potionValue } : {}),
    });
    if (result.ok) {
      setSelected(target);
      setPotion(chosenPotion ?? 'NONE');
    } else {
      setSelected(recorded ? recorded.target : undefined);
      setPotion(recorded?.potion ?? 'NONE');
    }
  };

  const selectSeat = (seatNo: number): void => {
    if (currentRole === 'WITCH') {
      if (potion !== 'POISON') return;
      record(seatNo, 'POISON');
      return;
    }
    record(seatNo);
  };

  const advance = (): void => {
    if (!recorded) return;
    dispatch({ type: isLastStep ? 'NIGHT_DONE' : 'NIGHT_STEP_NEXT' });
  };

  const inspectedSeat =
    recorded?.roleId === 'SEER' && recorded.target !== null
      ? getSeat(game, recorded.target)
      : undefined;
  const inspectedCamp =
    inspectedSeat?.role !== undefined && inspectedSeat.role !== null
      ? ROLE_DEFINITIONS[inspectedSeat.role].camp
      : null;

  return (
    <>
      <div className="screen-body">
        <div className="deal-head">
          <div className="flex h-[74px] w-[74px] shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface-2 text-gold">
            <Moon size={30} />
          </div>
          <div className="min-w-0">
            <p className="eyebrow">
              第 {game.round} 夜 · 第 {game.nightStep + 1} / {board.nightOrder.length} 步
            </p>
            <h1 className="text-[22px]">天黑请闭眼</h1>
            <p className="lead">按顺序唤醒；私密信息仅主持端可见。</p>
          </div>
        </div>

        <FlowBar view="night" />

        <section className="card">
          <div className="card-head">
            <h3 className="flex items-center gap-2">
              <RoleAvatar roleId={currentRole} size={28} />
              {roleName(currentRole)}
            </h3>
            <span className="night-queue" aria-label="夜间顺序">
              {board.nightOrder.map((roleId, index) => (
                <span
                  key={roleId}
                  className="nq"
                  data-state={
                    index === game.nightStep
                      ? 'active'
                      : index < game.nightStep
                        ? 'done'
                        : 'pending'
                  }
                  title={roleName(roleId)}
                >
                  <RoleAvatar roleId={roleId} size={22} />
                </span>
              ))}
            </span>
          </div>

          <p className="role-line">{NIGHT_LINES[currentRole] ?? '请按提示操作'}</p>
          <p className="sub-line">
            {currentRole === 'WOLF'
              ? '多狼由主持人代录；意见不一致按空刀；可自刀。'
              : currentRole === 'WITCH'
                ? '解药只能救当夜被刀者；每夜至多一瓶。'
                : '点编号选择目标；每步需确认目标或空操作。'}
          </p>

          {currentRole === 'GUARD' && previousGuard ? (
            <div className="priv-line">
              <Shield size={15} />
              上一夜守护：{previousGuard.target === null ? '空守' : `${previousGuard.target} 号`}
            </div>
          ) : null}

          {currentRole === 'WOLF' ? (
            <div className="priv-line" aria-label="狼队名单">
              <Users size={15} />
              狼队：
              {wolfTeam.length === 0
                ? '无存活狼人'
                : wolfTeam
                    .map((seat) => `${seat.no} 号 ${seat.role ? roleName(seat.role) : ''}`)
                    .join('、')}
            </div>
          ) : null}

          {currentRole === 'WITCH' ? (
            <>
              <div className="priv-line">
                <Eye size={15} />
                {wolfTarget === null
                  ? '今晚无人被刀（仅女巫可见）。'
                  : `今晚 ${wolfTarget} 号被刀（仅女巫可见）。`}
              </div>
              <div className="pick-row" role="group" aria-label="女巫用药">
                <button
                  type="button"
                  className="pick-btn"
                  aria-pressed={potion === 'NONE'}
                  onClick={() => record(null, 'NONE')}
                >
                  不用药
                </button>
                <button
                  type="button"
                  className="pick-btn"
                  aria-pressed={potion === 'ANTIDOTE'}
                  disabled={wolfTarget === null || antidoteUsed}
                  onClick={() => {
                    if (wolfTarget !== null) record(wolfTarget, 'ANTIDOTE');
                  }}
                >
                  {antidoteUsed
                    ? '解药已用'
                    : wolfTarget === null
                      ? '解药（无人被刀）'
                      : `解药救 ${wolfTarget} 号`}
                </button>
                <button
                  type="button"
                  className="pick-btn"
                  aria-pressed={potion === 'POISON'}
                  disabled={poisonUsed}
                  onClick={() => setPotion('POISON')}
                >
                  {poisonUsed ? '毒药已用' : '毒药'}
                </button>
              </div>
              {potion === 'POISON' && !poisonUsed ? (
                <p className="mt-2 text-xs text-faint">点编号选择毒杀目标。</p>
              ) : null}
            </>
          ) : null}

          {currentRole === 'SEER' && inspectedCamp ? (
            <div className="night-result" role="status">
              {inspectedSeat?.no} 号是{inspectedCamp === 'wolf' ? '狼人' : '好人'}（仅主持端可见）
            </div>
          ) : null}

          {recorded ? (
            <p className="mt-2 text-xs text-good">
              本步已记录：{recorded.target === null ? '空操作' : `${recorded.target} 号`}
              {recorded.potion === 'ANTIDOTE'
                ? ' · 解药'
                : recorded.potion === 'POISON'
                  ? ' · 毒药'
                  : ''}
            </p>
          ) : null}

          <div className="divider" />

          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-faint">选择目标座位</span>
            {currentRole === 'GUARD' || currentRole === 'WOLF' ? (
              <button
                type="button"
                className="pick-btn"
                aria-pressed={selected === null}
                onClick={() => record(null)}
              >
                {EMPTY_LABELS[currentRole]}
              </button>
            ) : null}
          </div>

          <SeatGrid
            items={seats}
            onSelect={currentRole === 'WITCH' && potion !== 'POISON' ? undefined : selectSeat}
            ariaLabel={`${roleName(currentRole)}目标选择`}
          />
        </section>
      </div>

      <div className="actionbar">
        <div className="actionbar-in">
          <UndoButton />
          <button type="button" className="btn primary" disabled={!recorded} onClick={advance}>
            {isLastStep ? '天亮了，结算夜晚' : '确认，下一位'}
          </button>
        </div>
      </div>
    </>
  );
}
