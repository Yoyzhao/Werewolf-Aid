import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import App from './App';
import { roleName } from './lib/board';
import { clearGameRecord } from './lib/storage';
import { useGameStore } from './stores/game-store';

async function resetApp(): Promise<void> {
  window.localStorage.clear();
  window.sessionStorage.clear();
  await clearGameRecord();
  useGameStore.setState(useGameStore.getInitialState(), true);
}

beforeEach(async () => {
  await resetApp();
  window.localStorage.setItem('lrs.guide.v1', '1');
});

describe('首页与开局设置', () => {
  it('首页进入开局设置并可切换板子', async () => {
    render(<App />);

    expect(await screen.findByRole('heading', { name: '狼人杀助手' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /开始主持/ }));

    expect(await screen.findByRole('heading', { name: '开局设置' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /预女猎守/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await userEvent.click(screen.getByRole('button', { name: /预女猎白/ }));
    expect(screen.getByRole('button', { name: /预女猎白/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getAllByText('白狼王').length).toBeGreaterThan(0);
  });
});

describe('模式 A / B 发牌', () => {
  async function enterDeal(mode: '接力查看' | '线下逐步确认'): Promise<void> {
    await userEvent.click(screen.getByRole('button', { name: new RegExp(mode) }));
    await userEvent.click(screen.getByRole('button', { name: /开始发牌/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: '开始' }));
  }

  it('模式 A：遮罩不显示身份，查看后推进一位', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: '狼人杀助手' });
    await userEvent.click(screen.getByRole('button', { name: /开始主持/ }));
    await screen.findByRole('heading', { name: '开局设置' });

    await enterDeal('接力查看');
    expect(await screen.findByRole('heading', { name: /发牌 · 接力查看/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /呼叫 1 号查看/ }));
    expect(await screen.findByText('请把手机交给 1 号')).toBeInTheDocument();

    const roleId = useGameStore.getState().draft?.assignments[1];
    if (!roleId) throw new Error('缺少 1 号身份');
    expect(screen.queryByText(roleName(roleId))).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '查看我的身份' }));
    expect(await screen.findByText(roleName(roleId))).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /我已记住/ }));
    expect(screen.getAllByText('1 / 12').length).toBeGreaterThan(0);
  });

  it('模式 B：二次点击才揭示身份，确认后推进', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: '狼人杀助手' });
    await userEvent.click(screen.getByRole('button', { name: /开始主持/ }));
    await screen.findByRole('heading', { name: '开局设置' });

    await enterDeal('线下逐步确认');
    expect(await screen.findByRole('heading', { name: /发牌 · 线下逐步确认/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /为 1 号显示身份/ }));
    expect(await screen.findByText('请 1 号确认身份')).toBeInTheDocument();

    const roleId = useGameStore.getState().draft?.assignments[1];
    if (!roleId) throw new Error('缺少 1 号身份');
    expect(screen.queryByText(roleName(roleId))).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '显示身份' }));
    expect(await screen.findByText(roleName(roleId))).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /1 号已确认/ }));
    expect(screen.getAllByText('1 / 12').length).toBeGreaterThan(0);
  });
});

describe('模式 C 实体牌录入', () => {
  async function enterManualDeal(): Promise<void> {
    render(<App />);
    await screen.findByRole('heading', { name: '狼人杀助手' });
    await userEvent.click(screen.getByRole('button', { name: /开始主持/ }));
    await screen.findByRole('heading', { name: '开局设置' });

    await userEvent.click(screen.getByRole('button', { name: /实体牌录入/ }));
    await userEvent.click(screen.getByRole('button', { name: /开始发牌/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: '开始' }));
    await screen.findByRole('heading', { name: /发牌 · 实体牌录入/ });
  }

  it('逐号选择、余量禁用、撤销与防窥核对', async () => {
    await enterManualDeal();

    expect(screen.getByText('请为 1 号手动选择身份')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /预言家 · 余 1/ }));

    expect(screen.getByText('请为 2 号手动选择身份')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /预言家 · 余 0/ })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: /撤销上一位/ }));
    expect(screen.getByText('请为 1 号手动选择身份')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /预言家 · 余 1/ }));
    await userEvent.click(screen.getByRole('button', { name: /核对已录（防窥）/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: '显示' }));
    expect(screen.getByText('1 号 预言家')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /收起核对/ }));
    expect(screen.queryByText('1 号 预言家')).not.toBeInTheDocument();
  });

  it('12 位未满禁止入夜，选满并校验后进入 NIGHT', async () => {
    await enterManualDeal();
    const finish = screen.getByRole('button', { name: /完成发牌，进入天黑/ });
    expect(finish).toBeDisabled();

    const board = useGameStore.getState().boardId;
    const roleSequence: string[] = [];
    for (const slot of (await import('@lrs/game-engine')).getBoard(board).roles) {
      for (let index = 0; index < slot.count; index += 1) roleSequence.push(slot.roleId);
    }

    act(() => {
      const store = useGameStore.getState();
      for (const roleId of roleSequence) {
        store.assignManualRole(roleId as Parameters<typeof store.assignManualRole>[0]);
      }
    });

    expect(useGameStore.getState().draft?.assignments).toHaveProperty('12');
    expect(finish).toBeEnabled();

    await userEvent.click(finish);
    expect(await screen.findByRole('heading', { name: '天黑请闭眼' })).toBeInTheDocument();

    const state = useGameStore.getState();
    expect(state.view).toBe('night');
    expect(state.game?.phase).toBe('NIGHT');
    expect(state.game?.seats.every((seat) => seat.role !== null)).toBe(true);
  });
});

describe('恢复、引导与能力提示', () => {
  it('发牌进度写入后可恢复', async () => {
    const store = useGameStore.getState();
    store.selectDealMode('A');
    store.startDeal();
    useGameStore.getState().revealNext();
    expect(useGameStore.getState().resumeRecord?.phase).toBe('DEAL');

    useGameStore.setState(useGameStore.getInitialState(), true);
    window.localStorage.setItem('lrs.guide.v1', '1');
    await useGameStore.getState().init();

    expect(useGameStore.getState().resumeRecord).not.toBeNull();
    useGameStore.getState().resumeGame();

    const resumed = useGameStore.getState();
    expect(resumed.view).toBe('deal');
    expect(resumed.draft?.revealed).toBe(1);
    expect(resumed.game?.phase).toBe('DEAL');
  });

  it('首次进入显示 3 步引导，可跳过', async () => {
    window.localStorage.removeItem('lrs.guide.v1');
    render(<App />);

    expect(await screen.findByText('第一次来 · 3 步上手')).toBeInTheDocument();
    expect(screen.getByText('选板子')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '跳过' }));
    await waitFor(() => {
      expect(screen.queryByText('第一次来 · 3 步上手')).not.toBeInTheDocument();
    });
    expect(window.localStorage.getItem('lrs.guide.v1')).toBe('1');
  });

  it('不支持 Wake Lock 时显示降级提示，可关闭', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: '狼人杀助手' });

    expect(screen.getByText(/不支持屏幕常亮/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '知道了' }));

    expect(screen.queryByText(/不支持屏幕常亮/)).not.toBeInTheDocument();
  });
});
