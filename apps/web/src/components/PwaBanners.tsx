import { Download, RefreshCw, WifiOff, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import {
  applyPwaUpdate,
  detectPlatformHint,
  registerPwa,
  type InstallHint,
  type InstallPromptEvent,
} from '../lib/pwa';

const INSTALL_DISMISS_KEY = 'lrs.pwa.install.v1';
const HINT_DISMISS_KEY = 'lrs.pwa.hint.v1';

function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeFlag(key: string): void {
  try {
    window.localStorage.setItem(key, '1');
  } catch {
    // 本地存储不可用时仅在本次会话内隐藏提示。
  }
}

export interface PwaBannersViewProps {
  readonly offline: boolean;
  readonly updateReady: boolean;
  readonly installAvailable: boolean;
  readonly platformHint: InstallHint | null;
  readonly onReload: () => void;
  readonly onInstall: () => void;
  readonly onDismissUpdate: () => void;
  readonly onDismissInstall: () => void;
  readonly onDismissHint: () => void;
}

const BANNER_CLASS =
  'flex items-start gap-2 rounded-xl border border-line-strong bg-surface px-3 py-2.5 text-xs leading-5 shadow-lg';

export function PwaBannersView({
  offline,
  updateReady,
  installAvailable,
  platformHint,
  onReload,
  onInstall,
  onDismissUpdate,
  onDismissInstall,
  onDismissHint,
}: PwaBannersViewProps) {
  if (!offline && !updateReady && !installAvailable && !platformHint) return null;

  return (
    <div
      className="fixed inset-x-3 bottom-20 z-[60] grid gap-2 sm:right-4 sm:left-auto sm:w-96"
      aria-label="应用提示"
    >
      {offline ? (
        <div className={BANNER_CLASS} role="status">
          <WifiOff size={15} className="mt-0.5 shrink-0 text-gold" />
          <span className="min-w-0 flex-1 text-muted">
            <b className="text-parchment">离线模式</b> · 仅本机记录可用，AI 与联机暂不可用。
          </span>
        </div>
      ) : null}

      {updateReady ? (
        <div className={BANNER_CLASS} role="status">
          <RefreshCw size={15} className="mt-0.5 shrink-0 text-gold" />
          <span className="min-w-0 flex-1 text-muted">
            <b className="text-parchment">有新版本</b> · 刷新后生效。
          </span>
          <button type="button" className="btn ghost min-h-8 px-2 text-xs" onClick={onReload}>
            刷新更新
          </button>
          <button
            type="button"
            className="icon-btn min-h-8 min-w-8"
            aria-label="稍后更新"
            onClick={onDismissUpdate}
          >
            <X size={14} />
          </button>
        </div>
      ) : null}

      {installAvailable ? (
        <div className={BANNER_CLASS} role="status">
          <Download size={15} className="mt-0.5 shrink-0 text-gold" />
          <span className="min-w-0 flex-1 text-muted">
            <b className="text-parchment">添加到主屏幕</b> · 安装后离线也能查看本机记录。
          </span>
          <button type="button" className="btn primary min-h-8 px-2 text-xs" onClick={onInstall}>
            安装
          </button>
          <button
            type="button"
            className="icon-btn min-h-8 min-w-8"
            aria-label="不再提示安装"
            onClick={onDismissInstall}
          >
            <X size={14} />
          </button>
        </div>
      ) : null}

      {!installAvailable && platformHint ? (
        <div className={BANNER_CLASS} role="status">
          <span className="min-w-0 flex-1 text-muted">
            {platformHint === 'ios'
              ? 'iOS 需在 Safari 分享菜单选择“添加到主屏幕”。'
              : '微信内可能不支持安装；可在系统浏览器打开后添加到主屏幕。'}
          </span>
          <button type="button" className="btn ghost min-h-8 px-2 text-xs" onClick={onDismissHint}>
            知道了
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** 应用级 PWA 提示：更新、离线、安装与 iOS/微信降级说明。 */
export function PwaBanners() {
  const [offline, setOffline] = useState(
    () => typeof navigator !== 'undefined' && navigator.onLine === false,
  );
  const [updateReady, setUpdateReady] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [installDismissed, setInstallDismissed] = useState(() => readFlag(INSTALL_DISMISS_KEY));
  const [hintDismissed, setHintDismissed] = useState(() => readFlag(HINT_DISMISS_KEY));
  const platformHint = useMemo(() => detectPlatformHint(), []);

  useEffect(
    () =>
      registerPwa({
        onUpdateReady: (next) => {
          setRegistration(next);
          setUpdateReady(true);
        },
      }),
    [],
  );

  useEffect(() => {
    const handleOnline = (): void => setOffline(false);
    const handleOffline = (): void => setOffline(true);
    const handleInstallPrompt = (event: Event): void => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
    };
  }, []);

  const dismissInstall = (): void => {
    setInstallDismissed(true);
    writeFlag(INSTALL_DISMISS_KEY);
  };

  const dismissHint = (): void => {
    setHintDismissed(true);
    writeFlag(HINT_DISMISS_KEY);
  };

  const install = (): void => {
    const prompt = installEvent;
    setInstallEvent(null);
    if (prompt) void prompt.prompt();
  };

  const installAvailable = Boolean(installEvent) && !installDismissed;

  return (
    <PwaBannersView
      offline={offline}
      updateReady={updateReady}
      installAvailable={installAvailable}
      platformHint={installAvailable || hintDismissed ? null : platformHint}
      onReload={() => {
        if (registration) applyPwaUpdate(registration);
      }}
      onInstall={install}
      onDismissUpdate={() => setUpdateReady(false)}
      onDismissInstall={dismissInstall}
      onDismissHint={dismissHint}
    />
  );
}
