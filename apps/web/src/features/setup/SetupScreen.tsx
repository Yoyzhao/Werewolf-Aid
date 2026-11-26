import { ArrowLeft, ChevronRight, Users } from 'lucide-react';
import { useState } from 'react';
import { getBoard } from '@lrs/game-engine';
import { CapabilityBanner } from '../../components/CapabilityBanner';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { FlowBar } from '../../components/FlowBar';
import { RoleAvatar } from '../../components/RoleAvatar';
import { SeatGrid } from '../../components/SeatGrid';
import { SwitchField } from '../../components/SwitchField';
import {
  BOARD_IDS,
  DEAL_MODES,
  DEAL_MODE_HINTS,
  DEAL_MODE_LABELS,
  roleName,
} from '../../lib/board';
import { useGameStore } from '../../stores/game-store';

const SEATS = Array.from({ length: 12 }, (_, index) => ({
  no: index + 1,
  label: '在场',
}));

export function SetupScreen() {
  const boardId = useGameStore((state) => state.boardId);
  const dealMode = useGameStore((state) => state.dealMode);
  const options = useGameStore((state) => state.options);
  const capabilityDismissed = useGameStore((state) => state.capabilityDismissed);
  const selectBoard = useGameStore((state) => state.selectBoard);
  const selectDealMode = useGameStore((state) => state.selectDealMode);
  const setSheriffElection = useGameStore((state) => state.setSheriffElection);
  const setWitchSelfSave = useGameStore((state) => state.setWitchSelfSave);
  const startDeal = useGameStore((state) => state.startDeal);
  const goHome = useGameStore((state) => state.goHome);
  const dismissCapability = useGameStore((state) => state.dismissCapability);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const board = getBoard(boardId);

  return (
    <>
      <div className="screen-body">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div className="min-w-0">
            <p className="eyebrow">主持 · 第 1 步 / 共 4 步</p>
            <h1>开局设置</h1>
            <p className="lead">确认板子和 12 位玩家编号。编号固定 1–12，缺号或重号会被拦截。</p>

            <FlowBar view="setup" />

            <div className="capability-slot mb-3">
              <CapabilityBanner dismissed={capabilityDismissed} onDismiss={dismissCapability} />
            </div>

            <section className="card">
              <div className="card-head">
                <h3>选择板子</h3>
                <span className="hint">AC-4</span>
              </div>
              <div className="board-grid" role="group" aria-label="板子">
                {BOARD_IDS.map((id) => {
                  const item = getBoard(id);
                  const selected = id === boardId;
                  return (
                    <button
                      key={id}
                      type="button"
                      className="board-opt"
                      data-board={id}
                      aria-pressed={selected}
                      onClick={() => selectBoard(id)}
                    >
                      <span className="board-badge">
                        {id === 'pre-witch-hunter-guard' ? 'CLASSIC' : 'WHITE WOLF'}
                      </span>
                      <span className="t block">{item.name}</span>
                      <span className="d block">
                        {item.roles
                          .filter((slot) => slot.roleId !== 'VILLAGER')
                          .map((slot) => roleName(slot.roleId))
                          .join(' · ')}
                        <br />4 民 / {item.name === '预女猎白' ? '3 狼 + 白狼王' : '4 普狼'}
                      </span>
                      <span className="board-meta">
                        <span className="chip ok">8 好人</span>
                        <span className="chip priv">4 狼</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="board-comp" aria-label="板子角色构成">
                {board.roles.map((slot) => (
                  <span key={slot.roleId} className="comp-item">
                    <RoleAvatar roleId={slot.roleId} size={18} />
                    <b>{roleName(slot.roleId)}</b>
                    <em>×{slot.count}</em>
                  </span>
                ))}
              </div>
            </section>

            <section className="card">
              <div className="card-head">
                <h3>12 位玩家</h3>
                <span className="hint">编号 1–12</span>
              </div>
              <SeatGrid items={SEATS} ariaLabel="12 位玩家编号" />
              <p className="mt-2.5 text-xs text-faint">
                编号固定 1–12；昵称 P1。点座位置为缺号/重号以查看拦截提示。
              </p>
            </section>

            <section className="card">
              <div className="card-head">
                <h3>发牌模式</h3>
                <span className="hint">AC-2 / AC-6</span>
              </div>
              <div className="mode-grid" role="group" aria-label="发牌模式">
                {DEAL_MODES.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className="mode-opt"
                    data-deal={mode}
                    aria-pressed={mode === dealMode}
                    onClick={() => selectDealMode(mode)}
                  >
                    <span className="mt">{DEAL_MODE_LABELS[mode]}</span>
                    <span className="ms">
                      {mode === 'A'
                        ? '系统随机 · 玩家传递查看'
                        : mode === 'B'
                          ? '系统随机 · 主持人控节奏'
                          : '线下发牌 · 手动选身份'}
                    </span>
                  </button>
                ))}
              </div>
              <p className="mt-2.5 text-xs text-faint">{DEAL_MODE_HINTS[dealMode]}</p>
              <p className="mt-1.5 text-[11.5px] text-faint">
                模式 A/B 由系统随机发牌；模式 C 由主持人按实体牌手动选择身份。
              </p>
            </section>

            <section className="card">
              <div className="card-head">
                <h3>设置项</h3>
                <span className="hint">默认按附录 A</span>
              </div>
              <SwitchField
                label="首夜警长竞选"
                description="关闭后首日直接公布死讯"
                checked={options.sheriffElection}
                onCheckedChange={setSheriffElection}
              />
              <SwitchField
                label="女巫首夜可自救"
                description="默认开启"
                checked={options.witchSelfSaveFirstNight}
                onCheckedChange={setWitchSelfSave}
              />
            </section>
          </div>

          <aside className="rail-card hidden lg:block">
            <div className="card-head">
              <h3>本局概览</h3>
              <span className="hint">12 人</span>
            </div>
            <p className="text-sm font-semibold text-parchment">{board.name}</p>
            <p className="mt-1 text-xs text-faint">
              {DEAL_MODE_LABELS[dealMode]} · {options.sheriffElection ? '首夜竞选' : '无首夜竞选'}
            </p>
            <div className="divider" />
            <p className="mb-2 flex items-center gap-1.5 text-xs text-faint">
              <Users size={14} /> 角色构成
            </p>
            <div className="chips">
              {board.roles.map((slot) => (
                <span key={slot.roleId} className="comp-item">
                  <RoleAvatar roleId={slot.roleId} size={18} />
                  <b>{roleName(slot.roleId)}</b>
                  <em>×{slot.count}</em>
                </span>
              ))}
            </div>
            <p className="mt-4 text-xs leading-6 text-faint">
              {options.witchSelfSaveFirstNight ? '女巫首夜可自救。' : '女巫首夜不可自救。'}
              开始发牌后不可更改板子。
            </p>
          </aside>
        </div>
      </div>

      <div className="actionbar">
        <div className="actionbar-in">
          <button type="button" className="btn ghost" onClick={goHome}>
            <ArrowLeft size={16} />
            返回
          </button>
          <button type="button" className="btn primary" onClick={() => setConfirmOpen(true)}>
            开始发牌
            <ChevronRight size={17} />
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="开始发牌"
        description={
          dealMode === 'C'
            ? '将进入实体牌手动录入：请确认实体牌已按所选板子发放。开局后不可更改板子。'
            : '将按所选板子随机分配身份并进入发牌。开局后不可更改板子。'
        }
        confirmLabel="开始"
        onConfirm={startDeal}
        onOpenChange={setConfirmOpen}
      />
    </>
  );
}
