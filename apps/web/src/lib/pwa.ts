export type InstallHint = 'ios' | 'wechat';

export interface InstallPromptEvent extends Event {
  readonly platforms: readonly string[];
  prompt: () => Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export interface RegisterPwaOptions {
  /** 测试或非生产环境可显式关闭。 */
  readonly enabled?: boolean;
  readonly container?: ServiceWorkerContainer | null;
  readonly onUpdateReady?: (registration: ServiceWorkerRegistration) => void;
}

function defaultContainer(): ServiceWorkerContainer | null {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  return navigator.serviceWorker;
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const displayMode =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return displayMode || iosStandalone;
}

/** iOS/微信无法使用安装按钮时给出降级说明。 */
export function detectPlatformHint(
  userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent,
  standalone = isStandalone(),
): InstallHint | null {
  if (standalone) return null;
  if (/MicroMessenger/i.test(userAgent)) return 'wechat';
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'ios';
  return null;
}

/** 监听新版本 worker；首次安装（无旧 controller）不提示更新。 */
export function watchServiceWorkerUpdate(
  registration: ServiceWorkerRegistration,
  hasActiveController: () => boolean,
  onUpdateReady: () => void,
): () => void {
  let notified = false;
  const notify = (): void => {
    if (notified) return;
    notified = true;
    onUpdateReady();
  };

  if (registration.waiting && hasActiveController()) notify();

  const handleUpdateFound = (): void => {
    const worker = registration.installing;
    if (!worker) return;
    const handleStateChange = (): void => {
      if (worker.state === 'installed' && hasActiveController()) notify();
    };
    worker.addEventListener('statechange', handleStateChange);
  };

  registration.addEventListener('updatefound', handleUpdateFound);
  return () => registration.removeEventListener('updatefound', handleUpdateFound);
}

export interface ApplyPwaUpdateOptions {
  readonly container?: ServiceWorkerContainer | null;
  readonly reload?: () => void;
  readonly timeoutMs?: number;
}

/** 通知等待中的新 worker 接管，并在 controllerchange 后刷新；无 waiting 时直接刷新。 */
export function applyPwaUpdate(
  registration: ServiceWorkerRegistration,
  options: ApplyPwaUpdateOptions = {},
): void {
  const container = options.container ?? defaultContainer();
  const reload = options.reload ?? (() => window.location.reload());
  const waiting = registration.waiting;

  if (!waiting || !container) {
    reload();
    return;
  }

  let reloaded = false;
  const reloadOnce = (): void => {
    if (reloaded) return;
    reloaded = true;
    reload();
  };
  const handleControllerChange = (): void => reloadOnce();

  container.addEventListener('controllerchange', handleControllerChange, { once: true });
  waiting.postMessage({ type: 'SKIP_WAITING' });
  setTimeout(() => {
    container.removeEventListener('controllerchange', handleControllerChange);
    reloadOnce();
  }, options.timeoutMs ?? 1500);
}

/** 生产环境注册 Service Worker；返回清理函数。 */
export function registerPwa(options: RegisterPwaOptions = {}): () => void {
  const container = options.container ?? defaultContainer();
  const enabled = options.enabled ?? (import.meta.env.PROD && Boolean(container));
  if (!enabled || !container) return () => undefined;

  let disposed = false;
  let unwatch = (): void => undefined;

  container
    .register('/sw.js')
    .then((registration) => {
      if (disposed) return;
      const notify = (): void => options.onUpdateReady?.(registration);
      unwatch = watchServiceWorkerUpdate(registration, () => Boolean(container.controller), notify);
      void registration.update().catch(() => undefined);
    })
    .catch(() => undefined);

  return () => {
    disposed = true;
    unwatch();
  };
}
