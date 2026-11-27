import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PwaBanners, PwaBannersView } from './PwaBanners';

const baseProps = {
  offline: false,
  updateReady: false,
  installAvailable: false,
  platformHint: null,
  onReload: () => undefined,
  onInstall: () => undefined,
  onDismissUpdate: () => undefined,
  onDismissInstall: () => undefined,
  onDismissHint: () => undefined,
} as const;

beforeEach(() => {
  window.localStorage.clear();
});

describe('PwaBannersView', () => {
  it('展示更新提示并触发刷新', async () => {
    const onReload = vi.fn();
    render(<PwaBannersView {...baseProps} updateReady onReload={onReload} />);

    expect(screen.getByText(/有新版本/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '刷新更新' }));
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it('展示 iOS 安装降级说明并可关闭', async () => {
    const onDismissHint = vi.fn();
    render(<PwaBannersView {...baseProps} platformHint="ios" onDismissHint={onDismissHint} />);

    expect(screen.getByText(/iOS 需在 Safari 分享菜单/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '知道了' }));
    expect(onDismissHint).toHaveBeenCalledTimes(1);
  });
});

describe('PwaBanners', () => {
  it('离线事件显示提示，恢复在线后隐藏', () => {
    render(<PwaBanners />);
    expect(screen.queryByText(/离线模式/)).not.toBeInTheDocument();

    act(() => window.dispatchEvent(new Event('offline')));
    expect(screen.getByText(/离线模式/)).toBeInTheDocument();

    act(() => window.dispatchEvent(new Event('online')));
    expect(screen.queryByText(/离线模式/)).not.toBeInTheDocument();
  });

  it('安装事件显示安装按钮并调用 prompt', async () => {
    render(<PwaBanners />);
    const prompt = vi.fn(async () => undefined);
    const event = new Event('beforeinstallprompt');
    Object.assign(event, { prompt });

    act(() => window.dispatchEvent(event));

    await userEvent.click(screen.getByRole('button', { name: '安装' }));
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: '安装' })).not.toBeInTheDocument();
  });
});
