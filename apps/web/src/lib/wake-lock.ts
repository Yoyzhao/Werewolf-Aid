type WakeLockSentinelLike = {
  release: () => Promise<void>;
  released?: boolean;
};

type WakeLockNavigator = Navigator & {
  wakeLock?: {
    request: (type: 'screen') => Promise<WakeLockSentinelLike>;
  };
};

let sentinel: WakeLockSentinelLike | null = null;

export function isWakeLockSupported(): boolean {
  if (typeof navigator === 'undefined') return false;
  return Boolean((navigator as WakeLockNavigator).wakeLock);
}

export async function requestWakeLock(): Promise<boolean> {
  const wakeLock =
    typeof navigator === 'undefined' ? undefined : (navigator as WakeLockNavigator).wakeLock;
  if (!wakeLock) return false;
  try {
    releaseWakeLock();
    sentinel = await wakeLock.request('screen');
    return true;
  } catch {
    return false;
  }
}

export function releaseWakeLock(): void {
  if (!sentinel) return;
  const current = sentinel;
  sentinel = null;
  void current.release().catch(() => undefined);
}
