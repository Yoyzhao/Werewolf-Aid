import { BookOpen, ChevronRight, Moon, Sparkles, UserRound, Users } from 'lucide-react';
import { CapabilityBanner } from '../../components/CapabilityBanner';
import { ResumeBanner } from '../../components/ResumeBanner';
import { BottomTabs } from '../../components/BottomTabs';
import { RoleAvatar } from '../../components/RoleAvatar';
import { getBoard } from '@lrs/game-engine';

import { roleName } from '../../lib/board';
import { useGameStore } from '../../stores/game-store';

export function HomeScreen() {
  const boardId = useGameStore((state) => state.boardId);
  const resumeRecord = useGameStore((state) => state.resumeRecord);
  const resumeIncompatible = useGameStore((state) => state.resumeIncompatible);
  const capabilityDismissed = useGameStore((state) => state.capabilityDismissed);
  const goSetup = useGameStore((state) => state.goSetup);
  const setView = useGameStore((state) => state.setView);
  const resumeGame = useGameStore((state) => state.resumeGame);
  const discardResume = useGameStore((state) => state.discardResume);
  const dismissCapability = useGameStore((state) => state.dismissCapability);

  const board = getBoard(boardId);

  return (
    <div className="screen-body pb-32">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <section className="min-w-0">
          <p className="eyebrow">月蚀俱乐部 · 本机主持</p>
          <h1 className="text-[30px] leading-tight sm:text-4xl">狼人杀助手</h1>
          <p className="lead">
            一台手机，带 12 个人走完一整局。系统负责规则、判定与结算，你只需要照着卡片主持。
          </p>

          <div className="mt-5 flex flex-wrap gap-2.5">
            <button type="button" className="btn primary" onClick={goSetup}>
              <Sparkles size={17} />
              开始主持
            </button>
            <button type="button" className="btn ghost" onClick={() => setView('rules')}>
              <BookOpen size={16} />
              先翻规则书
            </button>
            <button type="button" className="btn ghost" onClick={() => setView('assistant')}>
              <UserRound size={16} />
              我的助手
            </button>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <span className="chip ok">12 人局</span>
            <span className="chip">本机主持 · 无需登录</span>
            <span className="chip">断网可继续</span>
          </div>

          <div className="mt-5 flex flex-col gap-3">
            <div className="warn-strip">
              <Moon size={16} className="mt-0.5 shrink-0" />
              <span>赛前先打开页面并保持不关闭；游戏中不要清理浏览器数据。</span>
            </div>
            <ResumeBanner
              record={resumeRecord}
              incompatible={resumeIncompatible}
              onResume={resumeGame}
              onDiscard={discardResume}
            />
            <CapabilityBanner dismissed={capabilityDismissed} onDismiss={dismissCapability} />
          </div>
        </section>

        <aside className="rail-card">
          <div className="card-head">
            <h3>今晚牌桌</h3>
            <span className="hint">12 人</span>
          </div>
          <p className="text-sm font-semibold text-parchment">{board.name}</p>
          <p className="mt-1 text-xs text-faint">设置 → 发牌 → 夜晚 → 白天 → 结算</p>

          <div className="mt-4 grid grid-cols-4 gap-2" aria-hidden="true">
            {Array.from({ length: 12 }, (_, index) => (
              <span
                key={index}
                className="flex aspect-square items-center justify-center rounded-full border border-line bg-surface-2 font-mono text-sm text-faint"
              >
                {index + 1}
              </span>
            ))}
          </div>

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
          <p className="mt-4 flex items-center justify-end gap-1 text-xs text-gold">
            开局后按卡片主持 <ChevronRight size={14} />
          </p>
        </aside>
      </div>

      <BottomTabs active="home" />
    </div>
  );
}
