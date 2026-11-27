import { describe, expect, it, vi } from 'vitest';

import { applyPwaUpdate, detectPlatformHint, registerPwa, watchServiceWorkerUpdate } from './pwa';

function fakeWorker(initial: ServiceWorkerState = 'installing') {
  const listeners = new Set<() => void>();
  const worker = {
    state: initial,
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
    setState: (next: ServiceWorkerState) => {
      worker.state = next;
      listeners.forEach((listener) => listener());
    },
  };
  return worker;
}

function fakeRegistration(worker = fakeWorker()) {
  const updateFound = new Set<() => void>();
  const registration = {
    waiting: null,
    installing: worker,
    active: {},
    update: vi.fn(async () => undefined),
    addEventListener: (type: string, listener: () => void) => {
      if (type === 'updatefound') updateFound.add(listener);
    },
    removeEventListener: (type: string, listener: () => void) => {
      if (type === 'updatefound') updateFound.delete(listener);
    },
  };
  return {
    registration: registration as unknown as ServiceWorkerRegistration,
    worker,
    fireUpdateFound: () => updateFound.forEach((listener) => listener()),
  };
}

describe('detectPlatformHint', () => {
  it('识别 iOS 与微信，并在已安装时不再提示', () => {
    expect(detectPlatformHint('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)', false)).toBe('ios');
    expect(detectPlatformHint('Mozilla/5.0 (Linux; Android 14) MicroMessenger/8.0.50', false)).toBe(
      'wechat',
    );
    expect(detectPlatformHint('Mozilla/5.0 (Windows NT 10.0)', false)).toBeNull();
    expect(detectPlatformHint('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)', true)).toBeNull();
  });
});

describe('watchServiceWorkerUpdate', () => {
  it('已有等待中的 worker 时立即提示', () => {
    const { registration } = fakeRegistration();
    (registration as unknown as { waiting: ServiceWorker }).waiting = {
      postMessage: vi.fn(),
    } as unknown as ServiceWorker;
    const onUpdateReady = vi.fn();

    const cleanup = watchServiceWorkerUpdate(registration, () => true, onUpdateReady);

    expect(onUpdateReady).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it('新 worker 安装完成且已有 controller 时提示；首次安装不提示', () => {
    const first = fakeRegistration(fakeWorker('installing'));
    const firstCallback = vi.fn();
    watchServiceWorkerUpdate(first.registration, () => false, firstCallback);
    first.fireUpdateFound();
    first.worker.setState('installed');
    expect(firstCallback).not.toHaveBeenCalled();

    const next = fakeRegistration(fakeWorker('installing'));
    const nextCallback = vi.fn();
    watchServiceWorkerUpdate(next.registration, () => true, nextCallback);
    next.fireUpdateFound();
    next.worker.setState('installed');
    expect(nextCallback).toHaveBeenCalledTimes(1);
  });
});

describe('applyPwaUpdate', () => {
  it('通知 waiting worker 跳过等待，并在 controllerchange 后刷新', () => {
    vi.useFakeTimers();
    try {
      const postMessage = vi.fn();
      const registration = {
        waiting: { postMessage },
      } as unknown as ServiceWorkerRegistration;
      const listeners = new Set<() => void>();
      const container = {
        addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
        removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
      } as unknown as ServiceWorkerContainer;
      const reload = vi.fn();

      applyPwaUpdate(registration, { container, reload, timeoutMs: 5_000 });
      expect(postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });

      listeners.forEach((listener) => listener());
      expect(reload).toHaveBeenCalledTimes(1);

      vi.runAllTimers();
      expect(reload).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('没有等待中的 worker 时直接刷新', () => {
    const reload = vi.fn();
    applyPwaUpdate({ waiting: null } as unknown as ServiceWorkerRegistration, {
      reload,
      container: {} as ServiceWorkerContainer,
    });
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

describe('registerPwa', () => {
  it('关闭时不注册；启用时注册 /sw.js', async () => {
    const register = vi.fn(async () => fakeRegistration().registration);
    const container = { controller: null, register } as unknown as ServiceWorkerContainer;

    const stop = registerPwa({ enabled: false, container });
    stop();
    expect(register).not.toHaveBeenCalled();

    registerPwa({ enabled: true, container });
    await vi.waitFor(() => expect(register).toHaveBeenCalledWith('/sw.js'));
  });
});
