import { act, render, screen, waitFor, within, type RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import App from './App';
import { clearAssistantRecord } from './lib/assistant-storage';
import { clearGameRecord } from './lib/storage';
import { useAssistantStore } from './stores/assistant-store';
import { useGameStore } from './stores/game-store';

async function resetApp(): Promise<void> {
  await useAssistantStore.getState().flushSave();
  await clearAssistantRecord();
  await clearGameRecord();
  window.localStorage.clear();
  window.sessionStorage.clear();
  useAssistantStore.setState(useAssistantStore.getInitialState(), true);
  useGameStore.setState(useGameStore.getInitialState(), true);
}

async function renderAssistant(): Promise<RenderResult> {
  const view = render(<App />);
  await screen.findByRole('heading', { name: '狼人杀助手' });
  await userEvent.click(screen.getByRole('button', { name: /我的助手/ }));
  await screen.findByRole('heading', { name: '我的身份档案' });
  return view;
}

beforeEach(async () => {
  await resetApp();
  window.localStorage.setItem('lrs.guide.v1', '1');
});

describe('个人助手', () => {
  it('可自选身份并显示技能与身份攻略', async () => {
    await renderAssistant();

    expect(screen.getByRole('button', { name: '助手' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('尚未选择身份。选择后显示技能与身份攻略。')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '狼人' }));

    expect(screen.getByText('狼人阵营')).toBeInTheDocument();
    expect(screen.getByText('与狼队友共同击杀一名玩家。')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '常见打法' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '易错点' })).toBeInTheDocument();
  });

  it('标签、信息、发言要点与局势组装进 AI 上下文预览', async () => {
    await renderAssistant();

    await userEvent.click(screen.getByRole('button', { name: '预言家' }));
    await userEvent.click(screen.getByRole('button', { name: '下一轮' }));
    await userEvent.click(screen.getByRole('button', { name: '3 号存活' }));
    await userEvent.type(screen.getByLabelText('公开事件'), '3 号跳预言家');
    await userEvent.click(screen.getByRole('button', { name: '3 号 查杀' }));
    await userEvent.type(screen.getByLabelText('3 号信息记录'), '与 7 号互保');
    await userEvent.type(screen.getByLabelText('3 号第 2 轮发言要点'), '悍跳预言家');
    await userEvent.type(screen.getByLabelText('自由描述'), '重点看 7 号');

    expect(screen.getByLabelText('3 号第 2 轮发言要点')).toHaveValue('悍跳预言家');
    await userEvent.click(screen.getByRole('button', { name: '上一轮' }));
    expect(screen.getByLabelText('3 号第 1 轮发言要点')).toHaveValue('');
    await userEvent.click(screen.getByRole('button', { name: '下一轮' }));
    expect(screen.getByLabelText('3 号第 2 轮发言要点')).toHaveValue('悍跳预言家');

    const region = screen.getByRole('region', { name: 'AI 上下文预览内容' });
    expect(region).toHaveTextContent('预言家（好人阵营）');
    expect(region).toHaveTextContent('轮次：第 2 轮');
    expect(region).toHaveTextContent('公开事件：3 号跳预言家');
    expect(region).toHaveTextContent('3 号：查杀');
    expect(region).toHaveTextContent('3 号：与 7 号互保');
    expect(region).toHaveTextContent('3 号（第 2 轮）：悍跳预言家');
    expect(region).toHaveTextContent('重点看 7 号');
  });

  it('支持添加与移除自定义标签', async () => {
    await renderAssistant();

    const input = screen.getByLabelText('3 号自定义标签');
    await userEvent.type(input, '悍跳狼{Enter}');

    const customTag = screen.getByRole('button', { name: '3 号 悍跳狼' });
    expect(customTag).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(customTag);
    expect(screen.queryByRole('button', { name: '3 号 悍跳狼' })).not.toBeInTheDocument();
  });

  it('切换页面后助手记录仍在本机', async () => {
    const first = await renderAssistant();

    await userEvent.click(screen.getByRole('button', { name: '女巫' }));
    await userEvent.type(screen.getByLabelText('5 号信息记录'), '首夜救人');
    await act(async () => {
      await useAssistantStore.getState().flushSave();
    });

    first.unmount();
    useAssistantStore.setState(useAssistantStore.getInitialState(), true);
    useGameStore.setState(useGameStore.getInitialState(), true);
    window.localStorage.setItem('lrs.guide.v1', '1');

    await renderAssistant();

    expect(screen.getByRole('button', { name: '女巫' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('5 号信息记录')).toHaveValue('首夜救人');
  });

  it('清空当前记录需二次确认', async () => {
    await renderAssistant();

    await userEvent.click(screen.getByRole('button', { name: '守卫' }));
    await userEvent.click(screen.getByRole('button', { name: '4 号 金水' }));
    await userEvent.click(screen.getByRole('button', { name: '清空当前记录' }));

    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: '清除' }));

    await waitFor(() => {
      expect(screen.getByText('尚未选择身份。选择后显示技能与身份攻略。')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: '4 号 金水' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('region', { name: 'AI 上下文预览内容' })).toHaveTextContent(
      /【我的身份】\s*未选择身份/,
    );
  });
});
