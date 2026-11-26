import { useEffect, useMemo, useState } from 'react';
import { getBoard } from '@lrs/game-engine';
import {
  CheckCheck,
  Copy,
  Link2,
  QrCode as QrCodeIcon,
  RefreshCw,
  ShieldAlert,
  Unlink,
  Wifi,
} from 'lucide-react';
import QRCode from 'qrcode';
import { toast } from 'sonner';

import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ROOM_PHASE_LABELS } from '../../lib/room-labels';
import { useGameStore } from '../../stores/game-store';
import { useHostRoomStore } from '../../stores/host-room-store';

type DangerAction =
  { readonly kind: 'settle'; readonly winner: 'GOOD' | 'WOLVES' } | { readonly kind: 'delete' };

function remainingText(expiresAt: number, now: number): string {
  const left = expiresAt - now;
  if (left <= 0) return '已过期';
  const minutes = Math.floor(left / 60_000);
  const seconds = Math.floor((left % 60_000) / 1000);
  if (minutes >= 1) return `剩余 ${minutes} 分钟`;
  return `剩余 ${seconds} 秒`;
}

function readinessChip(status: string): { text: string; className: string } {
  if (status === 'pending') return { text: '待确认', className: 'chip ac' };
  if (status === 'bound') return { text: '已绑定', className: 'chip ok' };
  return { text: '未加入', className: 'chip' };
}

export function HostRoomScreen() {
  const initialized = useHostRoomStore((state) => state.initialized);
  const binding = useHostRoomStore((state) => state.binding);
  const summary = useHostRoomStore((state) => state.summary);
  const status = useHostRoomStore((state) => state.status);
  const error = useHostRoomStore((state) => state.error);
  const refreshError = useHostRoomStore((state) => state.refreshError);
  const busySeat = useHostRoomStore((state) => state.busySeat);
  const syncStatus = useHostRoomStore((state) => state.syncStatus);
  const syncError = useHostRoomStore((state) => state.syncError);
  const syncVersion = useHostRoomStore((state) => state.syncVersion);
  const lastSyncedAt = useHostRoomStore((state) => state.lastSyncedAt);
  const init = useHostRoomStore((state) => state.init);
  const create = useHostRoomStore((state) => state.create);
  const retryRecover = useHostRoomStore((state) => state.retryRecover);
  const refresh = useHostRoomStore((state) => state.refresh);
  const confirm = useHostRoomStore((state) => state.confirm);
  const confirmAll = useHostRoomStore((state) => state.confirmAll);
  const unbind = useHostRoomStore((state) => state.unbind);
  const settle = useHostRoomStore((state) => state.settle);
  const dissolve = useHostRoomStore((state) => state.dissolve);
  const retrySnapshot = useHostRoomStore((state) => state.retrySnapshot);

  const boardId = useGameStore((state) => state.boardId);
  const game = useGameStore((state) => state.game);
  const setView = useGameStore((state) => state.setView);

  const [now, setNow] = useState(() => Date.now());
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [danger, setDanger] = useState<DangerAction | null>(null);

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    if (!binding) return;
    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, 3000);
    return () => clearInterval(timer);
  }, [binding, refresh]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);

  const joinUrl = binding ? `${window.location.origin}/join/${binding.code}` : '';

  useEffect(() => {
    if (!joinUrl) {
      setQrDataUrl(null);
      return;
    }
    let alive = true;
    void QRCode.toString(joinUrl, { type: 'svg', margin: 1, width: 180 })
      .then((svg) => {
        if (alive) setQrDataUrl(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
      })
      .catch(() => {
        if (alive) setQrDataUrl(null);
      });
    return () => {
      alive = false;
    };
  }, [joinUrl]);

  const boardName = useMemo(() => {
    try {
      return getBoard((binding?.boardId ?? boardId) as Parameters<typeof getBoard>[0]).name;
    } catch {
      return '未知板子';
    }
  }, [binding?.boardId, boardId]);

  const seats = summary?.seats ?? [];
  const seatMap = new Map(seats.map((seat) => [seat.seatNo, seat]));
  const pendingCount = seats.filter((seat) => seat.status === 'pending').length;
  const boundCount = seats.filter((seat) => seat.status === 'bound').length;

  const copyLink = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      toast.success('加入链接已复制');
    } catch {
      toast.info(joinUrl);
    }
  };

  const settleByResult = async (winner: 'GOOD' | 'WOLVES'): Promise<void> => {
    const ok = await settle(winner);
    if (ok) {
      toast.success('房间已结算并删除数据');
      setView('home');
    }
  };

  const dissolveRoom = async (): Promise<void> => {
    const ok = await dissolve();
    if (ok) {
      toast.success('房间已解散');
      setView('home');
    }
  };

  if (!initialized) {
    return (
      <div className="screen-body">
        <div className="placeholder-card">
          <p className="text-sm text-muted">正在读取联机房间…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="screen-body pb-32">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">联机主持 · 可选</p>
          <h1 className="text-2xl sm:text-3xl">房间与座位</h1>
          <p className="lead mt-1">
            主持端是唯一写入者；玩家只读取自己的视图。联机失败不会阻塞本机主持。
          </p>
        </div>
        <button type="button" className="btn ghost" onClick={() => setView('home')}>
          返回大厅
        </button>
      </div>

      {error ? (
        <div className="warn-strip strong mt-3" role="alert">
          <ShieldAlert size={16} className="mt-0.5 shrink-0" />
          <span className="flex-1">{error}</span>
          {binding && status === 'error' ? (
            <button type="button" className="btn ghost" onClick={() => void retryRecover()}>
              重试恢复
            </button>
          ) : null}
        </div>
      ) : null}

      {!binding ? (
        <div className="card mt-4">
          <div className="card-head">
            <h3>创建联机房间</h3>
            <span className="hint">{boardName}</span>
          </div>
          <p className="text-sm text-muted">
            创建后生成 6 位配对码与二维码，玩家扫码或输入配对码申请座位；确认后即可看到本人视图。
          </p>
          <ul className="mt-3 grid gap-1.5 text-xs text-faint">
            <li>· 主持令牌只保存在本机，仅创建时返回一次</li>
            <li>· 配对码有效期 10 分钟，房间有效期 24 小时</li>
            <li>· 结算或解散会删除房间、座位与快照</li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn primary"
              disabled={status === 'creating'}
              onClick={() => void create(boardId)}
            >
              <Wifi size={16} />
              {status === 'creating' ? '正在创建房间…' : '创建房间'}
            </button>
            {status === 'error' ? (
              <button type="button" className="btn ghost" onClick={() => void retryRecover()}>
                尝试恢复本机房间
              </button>
            ) : null}
          </div>
        </div>
      ) : summary ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div className="min-w-0">
            <section className="card">
              <div className="card-head">
                <h3>配对码</h3>
                <span className="hint">{boardName}</span>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <div className="min-w-0">
                  <div className="room-code text-3xl font-bold text-parchment">{binding.code}</div>
                  <p className="mt-1 text-xs text-faint">
                    {remainingText(summary.joinExpiresAt, now)} · 玩家扫码或输入配对码加入
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" className="btn" onClick={() => void copyLink()}>
                      <Copy size={15} />
                      复制加入链接
                    </button>
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => {
                        void refresh();
                      }}
                    >
                      <RefreshCw size={15} />
                      刷新
                    </button>
                  </div>
                  <p className="mt-2 flex items-center gap-1 break-all text-[11px] text-faint">
                    <Link2 size={12} className="shrink-0" />
                    {joinUrl}
                  </p>
                </div>
                <div className="ml-auto flex flex-col items-center gap-1">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt={`加入房间 ${binding.code} 的二维码`}
                      className="h-[150px] w-[150px] rounded-xl border border-line bg-parchment p-2"
                    />
                  ) : (
                    <div className="grid h-[150px] w-[150px] place-items-center rounded-xl border border-dashed border-line text-faint">
                      <QrCodeIcon size={28} />
                    </div>
                  )}
                  <span className="text-[11px] text-faint">扫码加入</span>
                </div>
              </div>
            </section>

            <section className="card">
              <div className="card-head">
                <h3>座位绑定</h3>
                <span className="hint">
                  已绑定 {boundCount}/12 · 待确认 {pendingCount}
                </span>
              </div>
              {pendingCount > 1 ? (
                <button
                  type="button"
                  className="btn mb-3"
                  disabled={busySeat !== null}
                  onClick={() => void confirmAll()}
                >
                  <CheckCheck size={15} />
                  全部确认（{pendingCount}）
                </button>
              ) : null}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {Array.from({ length: 12 }, (_, index) => index + 1).map((seatNo) => {
                  const seat = seatMap.get(seatNo);
                  const chip = readinessChip(seat?.status ?? 'none');
                  return (
                    <div
                      key={seatNo}
                      className="rounded-xl border border-line bg-surface-2 p-2.5"
                      data-status={seat?.status ?? 'none'}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <b className="font-mono text-sm">{seatNo} 号</b>
                        <span className={chip.className}>{chip.text}</span>
                      </div>
                      {seat ? (
                        <div className="mt-2 flex gap-1.5">
                          {seat.status === 'pending' ? (
                            <button
                              type="button"
                              className="btn primary min-h-9 flex-1 px-2 text-xs"
                              disabled={busySeat !== null}
                              onClick={() => void confirm(seatNo, seat.applicantId)}
                            >
                              确认
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="btn ghost min-h-9 flex-1 px-2 text-xs"
                            disabled={busySeat !== null}
                            onClick={() => void unbind(seatNo)}
                          >
                            <Unlink size={13} />
                            {seat.status === 'pending' ? '移除' : '解绑'}
                          </button>
                        </div>
                      ) : (
                        <p className="mt-2 text-[11px] text-faint">等待玩家申请</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          <aside className="card min-w-0">
            <div className="card-head">
              <h3>房间状态</h3>
              <span className="hint">v{syncVersion}</span>
            </div>
            <div className="chips">
              <span className="chip ok">联机中</span>
              <span className="chip">{ROOM_PHASE_LABELS[summary.phase] ?? summary.phase}</span>
              <span className="chip">第 {game?.round ?? 1} 回合</span>
            </div>

            <div className="divider" />
            <p className="text-xs text-faint">快照同步</p>
            <p className="mt-1 text-sm" role="status">
              {syncStatus === 'writing'
                ? '正在写入快照…'
                : syncStatus === 'retry'
                  ? (syncError ?? '联机同步失败，正在重试')
                  : syncStatus === 'error'
                    ? (syncError ?? '联机同步已停止')
                    : syncStatus === 'synced'
                      ? `已同步 v${syncVersion}${
                          lastSyncedAt ? ` · ${new Date(lastSyncedAt).toLocaleTimeString()}` : ''
                        }`
                      : '等待对局状态'}
            </p>
            {refreshError ? <p className="mt-1 text-xs text-gold">{refreshError}</p> : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="btn ghost" disabled={!game} onClick={retrySnapshot}>
                <RefreshCw size={14} />
                立即写入快照
              </button>
            </div>

            <div className="divider" />
            <p className="text-xs text-faint">危险操作</p>
            <div className="mt-2 grid gap-2">
              <button
                type="button"
                className="btn danger"
                onClick={() => setDanger({ kind: 'settle', winner: 'GOOD' })}
              >
                结算房间（好人胜）
              </button>
              <button
                type="button"
                className="btn danger"
                onClick={() => setDanger({ kind: 'settle', winner: 'WOLVES' })}
              >
                结算房间（狼人胜）
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => setDanger({ kind: 'delete' })}
              >
                解散并删除房间
              </button>
            </div>
            <p className="mt-2 text-[11px] text-faint">
              结算/解散会删除房间、座位与全部快照，且不可恢复。
            </p>
          </aside>
        </div>
      ) : (
        <div className="card mt-4">
          <div className="card-head">
            <h3>恢复主持</h3>
            <span className="hint">本机保存</span>
          </div>
          <p className="text-sm text-muted">
            检测到本机保存的主持令牌，但当前无法读取房间状态。可以重试恢复；若房间已结束需重新创建。
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" className="btn primary" onClick={() => void retryRecover()}>
              恢复主持
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => useHostRoomStore.getState().forget()}
            >
              清除本机绑定
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={danger !== null}
        title={danger?.kind === 'delete' ? '解散房间' : '结算房间'}
        description={
          danger?.kind === 'delete'
            ? '解散后房间、座位与快照将删除，且不可恢复。玩家会收到“房间已结束”。'
            : '结算会删除房间与快照；请确认玩家已收到最终视图。此操作不可恢复。'
        }
        confirmLabel={danger?.kind === 'delete' ? '解散并删除' : '确认结算'}
        danger
        onOpenChange={(open) => {
          if (!open) setDanger(null);
        }}
        onConfirm={() => {
          if (!danger) return;
          if (danger.kind === 'delete') void dissolveRoom();
          else void settleByResult(danger.winner);
          setDanger(null);
        }}
      />
    </div>
  );
}
