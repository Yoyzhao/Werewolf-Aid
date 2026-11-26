export interface CapabilityReport {
  readonly wakeLock: boolean;
  readonly webSocket: boolean;
  readonly pwa: boolean;
}

export function detectCapabilities(): CapabilityReport {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { wakeLock: false, webSocket: false, pwa: false };
  }

  const wakeLock = 'wakeLock' in navigator && Boolean(navigator.wakeLock);

  return {
    wakeLock,
    webSocket: 'WebSocket' in window,
    pwa:
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
  };
}

export function capabilityWarning(report: CapabilityReport): string | null {
  if (!report.wakeLock) {
    return '当前浏览器不支持屏幕常亮；游戏中请在系统设置里关闭自动锁屏。';
  }
  if (!report.webSocket) {
    return '当前浏览器不支持实时同步；P1 联机时将降级为轮询。';
  }
  return null;
}
