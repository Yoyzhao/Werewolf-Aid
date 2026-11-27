import { Wifi } from 'lucide-react';

import type { View } from '../lib/types';

const PHASE_LABELS: Record<View, string> = {
  home: '大厅',
  assistant: '助手 · 独立模式',
  rules: '规则 · 只读',
  'host-room': '联机 · 主持',
  setup: 'SETUP · 设置',
  deal: 'DEAL · 发牌',
  night: 'NIGHT · 夜晚',
  sheriff: 'DAY · 竞选',
  dawn: 'DAY · 死讯',
  speech: 'DAY · 发言',
  vote: 'DAY · 投票',
  result: 'RESULT · 结算',
};

export interface TopBarProps {
  readonly view: View;
  readonly hostRoomCode?: string | null;
  readonly onOpenHostRoom?: () => void;
}

export function TopBar({ view, hostRoomCode, onOpenHostRoom }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="shell topbar-in">
        <span className="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M16 3a10 10 0 1 0 10 10c0-1.6-.4-3.1-1.1-4.5A8 8 0 0 1 16 17a8 8 0 0 1-8-8c0-1 .2-2 .6-2.9" />
            <circle cx="12" cy="12" r="1" fill="currentColor" />
            <circle cx="20" cy="12" r="1" fill="currentColor" />
          </svg>
        </span>
        <div className="min-w-0">
          <div className="brand-name">狼人杀助手</div>
          <div className="brand-sub">Eclipse Club</div>
        </div>
        {hostRoomCode && onOpenHostRoom ? (
          <button
            type="button"
            className="icon-btn ml-auto"
            aria-label={`打开联机房间 ${hostRoomCode}`}
            title="联机房间"
            onClick={onOpenHostRoom}
          >
            <Wifi size={17} />
          </button>
        ) : null}
        <span className={`phase-chip ${hostRoomCode ? 'ml-1.5' : 'ml-auto'}`}>
          <span className="dot" aria-hidden="true" />
          <b>{PHASE_LABELS[view]}</b>
        </span>
      </div>
    </header>
  );
}
