import { useEffect, useMemo, useState } from 'react';
import { getBoard, ROLE_DEFINITIONS, type BoardId, type PlayerView } from '@lrs/game-engine';
import {
  Check,
  DoorOpen,
  Eye,
  EyeOff,
  Lock,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Wifi,
} from 'lucide-react';

import { RoleAvatar } from '../../components/RoleAvatar';
import { SeatGrid } from '../../components/SeatGrid';
import { Timeline } from '../result/Timeline';
import {
  CLOSED_REASON_LABELS,
  CONNECTION_LABELS,
  ROOM_PHASE_LABELS,
  describePublicEvent,
} from '../../lib/room-labels';
import { buildPlayerTimeline } from '../../lib/timeline';
import { usePlayerRoomStore } from '../../stores/player-room-store';

const INPUT_CLASS =
  'min-h-11 w-full rounded-xl border border-line-strong bg-surface-2 px-3 text-sm text-parchment placeholder:text-faint focus:border-gold focus:outline-none';

export interface PlayerRootProps {
  readonly code: string | null;
  readonly invalidCode?: string | null;
  readonly onNavigate: (code: string) => void;
  readonly onExit: () => void;
}

function remainingText(expiresAt: number, now: number): string {
  const left = expiresAt - now;
  if (left <= 0) return '已过期';
  const minutes = Math.floor(left / 60_000);
  if (minutes >= 1) return `剩余 ${minutes} 分钟`;
  return `剩余 ${Math.max(1, Math.floor(left / 1000))} 秒`;
}

function ConnectionChip({ connection }: { readonly connection: string }) {
  const label = CONNECTION_LABELS[connection as keyof typeof CONNECTION_LABELS] ?? connection;
  const tone =
    connection === 'online'
      ? 'chip ok'
      : connection === 'offline' || connection === 'closed'
        ? 'chip priv'
        : 'chip ac';
  return <span className={tone}>{label}</span>;
}

function PlayerHeader({
  code,
  connection,
  onExit,
}: {
  readonly code: string | null;
  readonly connection?: string;
  readonly onExit: () => void;
}) {
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
          <div className="brand-name">{code ? `房间 ${code}` : '加入房间'}</div>
          <div className="brand-sub">Player View</div>
        </div>
        {connection ? (
          <span className="ml-auto">
            <ConnectionChip connection={connection} />
          </span>
        ) : null}
        <button type="button" className="icon-btn ml-auto" aria-label="离开房间" onClick={onExit}>
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}

function IdentityCard({
  view,
  seatNo,
  revealed,
  onReveal,
  onMask,
}: {
  readonly view: PlayerView;
  readonly seatNo: number | null;
  readonly revealed: boolean;
  readonly onReveal: () => void;
  readonly onMask: () => void;
}) {
  const definition = ROLE_DEFINITIONS[view.role];
  return (
    <section className="card">
      <div className="card-head">
        <h3>我的身份</h3>
        <span className="hint">{seatNo ?? view.mySeat} 号</span>
      </div>
      {revealed ? (
        <div className="flex items-start gap-3">
          <RoleAvatar roleId={view.role} size={54} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-parchment">
              {definition.name}
              <span className={`chip ml-2 ${definition.camp === 'wolf' ? 'priv' : 'ok'}`}>
                {definition.camp === 'wolf' ? '狼人阵营' : '好人阵营'}
              </span>
            </p>
            <p className="mt-1 text-xs leading-5 text-muted">{definition.skill}</p>
          </div>
          <button type="button" className="btn ghost min-h-9 px-2 text-xs" onClick={onMask}>
            <EyeOff size={14} />
            隐藏
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface-2 p-4">
          <Lock size={20} className="text-gold" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-parchment">身份已隐藏</p>
            <p className="text-xs text-faint">确认周围无人观看后再查看；切到后台会自动重新遮罩。</p>
          </div>
          <button type="button" className="btn primary min-h-10" onClick={onReveal}>
            <Eye size={15} />
            查看我的身份
          </button>
        </div>
      )}
    </section>
  );
}

function PrivateInfoCard({ view }: { readonly view: PlayerView }) {
  const hasTeammates = view.teammates !== undefined && view.teammates.length > 0;
  const hasChecks = view.checks !== undefined && view.checks.length > 0;
  const hasGuarded = view.guarded !== undefined && view.guarded.length > 0;
  if (!hasTeammates && !hasChecks && !view.potions && !hasGuarded) return null;

  return (
    <section className="card">
      <div className="card-head">
        <h3>仅你可见</h3>
        <span className="hint">私有信息</span>
      </div>
      <div className="grid gap-3">
        {hasTeammates ? (
          <div>
            <p className="text-xs text-faint">狼队友</p>
            <div className="chips mt-1">
              {view.teammates?.map((seat) => (
                <span key={seat} className="chip priv">
                  {seat} 号
                </span>
              ))}
            </div>
          </div>
        ) : null}
        {hasChecks ? (
          <div>
            <p className="text-xs text-faint">查验记录</p>
            <ul className="mt-1 space-y-1 text-sm">
              {view.checks?.map((check, index) => (
                <li
                  key={`${check.target}-${check.result}-${index}`}
                  className="flex items-center gap-2"
                >
                  <ShieldCheck size={14} className="text-gold" />
                  <span>
                    {check.target} 号是
                    <b className={check.result === 'WOLF' ? 'text-danger' : 'text-good'}>
                      {check.result === 'WOLF' ? '狼人' : '好人'}
                    </b>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {view.potions ? (
          <div>
            <p className="text-xs text-faint">药剂</p>
            <div className="chips mt-1">
              <span className={`chip ${view.potions.antidote ? 'ok' : ''}`}>
                解药{view.potions.antidote ? '可用' : '已用'}
              </span>
              <span className={`chip ${view.potions.poison ? 'ok' : ''}`}>
                毒药{view.potions.poison ? '可用' : '已用'}
              </span>
            </div>
          </div>
        ) : null}
        {hasGuarded ? (
          <div>
            <p className="text-xs text-faint">守护记录</p>
            <ul className="mt-1 space-y-1 text-sm">
              {view.guarded?.map((record) => (
                <li key={record.round}>
                  第 {record.round} 夜 ·{' '}
                  {record.target === null ? '空守' : `守护 ${record.target} 号`}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function PublicProgressCard({
  view,
  version,
}: {
  readonly view: PlayerView;
  readonly version: number;
}) {
  const events = [...view.events].slice(-8).reverse();
  return (
    <section className="card">
      <div className="card-head">
        <h3>公开进度</h3>
        <span className="hint">v{version}</span>
      </div>
      <div className="chips">
        <span className="chip ac">{ROOM_PHASE_LABELS[view.phase] ?? view.phase}</span>
        <span className="chip">第 {view.round} 轮</span>
        <span className="chip">存活 {view.alive.length}/12</span>
        <span className="chip">
          {view.sheriffNo === null ? '无警长' : `警长 ${view.sheriffNo} 号`}
        </span>
      </div>

      <div className="divider" />
      {events.length === 0 ? (
        <p className="text-sm text-faint">暂无公开事件</p>
      ) : (
        <ul className="space-y-1.5 text-sm" aria-label="公开事件">
          {events.map((event) => (
            <li key={event.seq} className="flex gap-2">
              <span className="shrink-0 font-mono text-[11px] text-faint">R{event.round}</span>
              <span className="min-w-0 break-words">{describePublicEvent(event)}</span>
            </li>
          ))}
        </ul>
      )}

      {view.result ? (
        <>
          <div className="divider" />
          <p className="text-sm font-semibold text-gold">
            {view.result.winner === 'wolf' ? '狼人阵营胜利' : '好人阵营胜利'} · 第{' '}
            {view.result.round} 轮
          </p>
          {view.revealedRoles ? (
            <div className="mt-3 grid grid-cols-2 gap-1.5 text-xs sm:grid-cols-3">
              {view.revealedRoles.map((revealed) => (
                <span key={revealed.seatNo} className="chip">
                  {revealed.seatNo} 号 · {ROLE_DEFINITIONS[revealed.role].name}
                </span>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function JoinEntry({ onNavigate, onExit }: Pick<PlayerRootProps, 'onNavigate' | 'onExit'>) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <PlayerHeader code={null} onExit={onExit} />
      <main className="shell screen-body">
        <p className="eyebrow">玩家加入 · 只读视图</p>
        <h1 className="text-2xl sm:text-3xl">输入配对码</h1>
        <p className="lead">向主持人获取 6 位配对码；加入后只显示你的身份与公开进度。</p>

        <form
          className="card mt-4 max-w-xl"
          onSubmit={(event) => {
            event.preventDefault();
            const code = value.trim();
            if (!/^\d{6}$/.test(code)) {
              setError('配对码为 6 位数字');
              return;
            }
            setError(null);
            onNavigate(code);
          }}
        >
          <label className="block text-[11.5px] text-faint" htmlFor="join-code">
            配对码
            <input
              id="join-code"
              className={`${INPUT_CLASS} room-code mt-1 text-center text-xl`}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={value}
              onChange={(event) => {
                setValue(event.target.value.replace(/\D/g, '').slice(0, 6));
                setError(null);
              }}
              placeholder="000000"
            />
          </label>
          {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
          <div className="mt-4 flex gap-2">
            <button type="submit" className="btn primary flex-1">
              <DoorOpen size={16} />
              进入房间
            </button>
            <button type="button" className="btn ghost" onClick={onExit}>
              返回首页
            </button>
          </div>
        </form>
      </main>
    </>
  );
}

export function PlayerRoot({ code, invalidCode, onNavigate, onExit }: PlayerRootProps) {
  const stage = usePlayerRoomStore((state) => state.stage);
  const room = usePlayerRoomStore((state) => state.room);
  const error = usePlayerRoomStore((state) => state.error);
  const seatNo = usePlayerRoomStore((state) => state.seatNo);
  const applying = usePlayerRoomStore((state) => state.applying);
  const view = usePlayerRoomStore((state) => state.view);
  const version = usePlayerRoomStore((state) => state.version);
  const connection = usePlayerRoomStore((state) => state.connection);
  const reconnectAttempt = usePlayerRoomStore((state) => state.reconnectAttempt);
  const identityRevealed = usePlayerRoomStore((state) => state.identityRevealed);
  const lastUpdatedAt = usePlayerRoomStore((state) => state.lastUpdatedAt);
  const closedReason = usePlayerRoomStore((state) => state.closedReason);
  const init = usePlayerRoomStore((state) => state.init);
  const applySeat = usePlayerRoomStore((state) => state.applySeat);
  const cancelApplication = usePlayerRoomStore((state) => state.cancelApplication);
  const leave = usePlayerRoomStore((state) => state.leave);
  const revealIdentity = usePlayerRoomStore((state) => state.revealIdentity);
  const maskIdentity = usePlayerRoomStore((state) => state.maskIdentity);
  const retry = usePlayerRoomStore((state) => state.retry);
  const handleOffline = usePlayerRoomStore((state) => state.handleOffline);
  const handleOnline = usePlayerRoomStore((state) => state.handleOnline);
  const dispose = usePlayerRoomStore((state) => state.dispose);

  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (invalidCode) return;
    void init(code);
  }, [code, init, invalidCode]);

  useEffect(() => () => dispose(), [dispose]);

  useEffect(() => {
    if (!code) return;
    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') maskIdentity();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [code, maskIdentity]);

  useEffect(() => {
    const onOffline = (): void => handleOffline();
    const onOnline = (): void => handleOnline();
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, [handleOffline, handleOnline]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);

  const boardName = useMemo(() => {
    if (!room) return '';
    try {
      return getBoard(room.boardId as BoardId).name;
    } catch {
      return room.boardId;
    }
  }, [room]);

  const leaveRoom = (): void => {
    leave();
    onExit();
  };

  if (invalidCode) {
    return (
      <>
        <PlayerHeader code={null} onExit={onExit} />
        <main className="shell screen-body">
          <div className="card">
            <h1 className="text-xl">配对码无效</h1>
            <p className="mt-2 text-sm text-muted">“{invalidCode}” 不是 6 位数字配对码。</p>
            <div className="mt-4 flex gap-2">
              <button type="button" className="btn primary" onClick={onExit}>
                重新输入
              </button>
            </div>
          </div>
        </main>
      </>
    );
  }

  if (code === null) {
    return <JoinEntry onNavigate={onNavigate} onExit={onExit} />;
  }

  return (
    <>
      <PlayerHeader
        code={code}
        connection={stage === 'bound' ? connection : undefined}
        onExit={leaveRoom}
      />
      <main className="shell screen-body pb-24">
        {stage === 'loading' ? (
          <div className="placeholder-card">
            <p className="text-sm text-muted">正在连接房间…</p>
          </div>
        ) : null}

        {stage === 'error' ? (
          <div className="card">
            <h1 className="text-xl">无法加入</h1>
            <p className="mt-2 text-sm text-muted">{error ?? '配对码不存在或已过期'}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="btn primary" onClick={() => void retry()}>
                <RefreshCw size={15} />
                重试
              </button>
              <button type="button" className="btn ghost" onClick={onExit}>
                返回首页
              </button>
            </div>
          </div>
        ) : null}

        {stage === 'join' && room ? (
          <div className="card">
            <div className="card-head">
              <h3>加入房间 {room.code}</h3>
              <span className="hint">{boardName}</span>
            </div>
            <div className="chips">
              <span className="chip ok">可加入</span>
              <span className="chip">{remainingText(room.joinExpiresAt, now)}</span>
            </div>
            {error ? (
              <div className="warn-strip strong mt-3" role="alert">
                <span className="flex-1">{error}</span>
              </div>
            ) : null}
            <p className="mt-4 text-xs text-faint">选择你的编号（主持人按实体座位确认）</p>
            <SeatGrid
              className="mt-2"
              ariaLabel="选择座位编号"
              items={Array.from({ length: 12 }, (_, index) => ({
                no: index + 1,
                current: selectedSeat === index + 1,
              }))}
              onSelect={(value) => setSelectedSeat(value)}
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn primary flex-1"
                disabled={selectedSeat === null || applying || room.joinExpiresAt <= now}
                onClick={() => selectedSeat !== null && void applySeat(selectedSeat)}
              >
                <Check size={16} />
                {applying
                  ? '提交中…'
                  : selectedSeat === null
                    ? '先选择编号'
                    : `申请绑定 ${selectedSeat} 号`}
              </button>
              <button type="button" className="btn ghost" onClick={onExit}>
                返回首页
              </button>
            </div>
            <p className="mt-3 text-[11px] text-faint">
              同一编号只允许一个会话；确认后刷新或换设备需重新申请。
            </p>
          </div>
        ) : null}

        {stage === 'pending' ? (
          <div className="card">
            <div className="card-head">
              <h3>等待主持人确认</h3>
              <span className="hint">{seatNo ?? '-'} 号</span>
            </div>
            <p className="text-sm text-muted">
              已提交申请，主持人确认后会自动进入玩家视图。请保持页面打开。
            </p>
            {error ? (
              <div className="warn-strip strong mt-3" role="alert">
                <span className="flex-1">{error}</span>
              </div>
            ) : null}
            <div className="chips mt-3">
              <span className="chip ac">待确认</span>
              <span className="chip">每 1.5 秒检查一次</span>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="btn ghost flex-1"
                onClick={() => void cancelApplication()}
              >
                取消申请
              </button>
            </div>
          </div>
        ) : null}

        {stage === 'bound' ? (
          <div className="grid gap-3">
            {connection === 'reconnecting' ? (
              <div className="warn-strip" role="status">
                <Wifi size={16} className="mt-0.5 shrink-0" />
                <span>连接中断，正在重连（{reconnectAttempt}/3）；请不要刷新页面。</span>
              </div>
            ) : null}
            {connection === 'polling' ? (
              <div className="warn-strip" role="status">
                <RefreshCw size={16} className="mt-0.5 shrink-0" />
                <span>实时连接不可用，已切换 5 秒刷新；最近更新稍后可见。</span>
              </div>
            ) : null}
            {connection === 'offline' ? (
              <div className="warn-strip strong" role="alert">
                <Wifi size={16} className="mt-0.5 shrink-0" />
                <span>网络不可用，联机暂停；本机页面仍可查看。</span>
              </div>
            ) : null}

            {view ? (
              <>
                <IdentityCard
                  view={view}
                  seatNo={seatNo}
                  revealed={identityRevealed}
                  onReveal={revealIdentity}
                  onMask={maskIdentity}
                />
                <PrivateInfoCard view={view} />
                <PublicProgressCard view={view} version={version} />
                <Timeline groups={buildPlayerTimeline(view)} hint="公开事件 + 仅你可见" />
              </>
            ) : (
              <div className="placeholder-card">
                <p className="text-sm text-muted">已加入房间，等待主持人开局与发牌…</p>
                {lastUpdatedAt ? (
                  <p className="mt-1 text-xs text-faint">
                    最近检查：{new Date(lastUpdatedAt).toLocaleTimeString()}
                  </p>
                ) : null}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn ghost" onClick={leaveRoom}>
                <LogOut size={15} />
                离开房间
              </button>
              <span className="text-[11px] leading-6 text-faint">
                离开仅清除本机绑定；主持人仍可在房间面板解绑。
              </span>
            </div>
          </div>
        ) : null}

        {stage === 'closed' ? (
          <div className="grid gap-3">
            <div className="card">
              <h1 className="text-xl">房间已结束</h1>
              <p className="mt-2 text-sm text-muted">
                {CLOSED_REASON_LABELS[closedReason ?? ''] ?? '房间已结束或配对码已过期。'}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" className="btn primary" onClick={onExit}>
                  返回首页
                </button>
                <button type="button" className="btn ghost" onClick={() => void retry()}>
                  <RefreshCw size={15} />
                  重新检查
                </button>
              </div>
            </div>
            {view ? (
              <Timeline groups={buildPlayerTimeline(view)} hint="公开事件 + 仅你可见" />
            ) : null}
          </div>
        ) : null}
      </main>
    </>
  );
}
