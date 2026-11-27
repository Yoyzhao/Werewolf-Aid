import { fireEvent, render, screen, waitFor, type RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import App from './App';
import { clearAiConfig } from './lib/ai-config';
import { clearAssistantRecord } from './lib/assistant-storage';
import { clearGameRecord } from './lib/storage';
import { useAiStore } from './stores/ai-store';
import { useAssistantStore } from './stores/assistant-store';
import { useGameStore } from './stores/game-store';

async function resetApp(): Promise<void> {
  await clearAiConfig();
  await useAssistantStore.getState().flushSave();
  await clearAssistantRecord();
  await clearGameRecord();
  window.localStorage.clear();
  window.sessionStorage.clear();
  useAiStore.setState(useAiStore.getInitialState(), true);
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

async function configureAi(): Promise<void> {
  await userEvent.type(
    screen.getByLabelText('接口地址'),
    'https://api.example.com/v1/chat/completions',
  );
  await userEvent.type(screen.getByLabelText('模型名'), 'gpt-test');
  await userEvent.type(screen.getByLabelText('API Key'), 'sk-filter-test');
  await userEvent.click(screen.getByRole('button', { name: '保存配置' }));
  await waitFor(() => expect(screen.getByText('已配置')).toBeInTheDocument());
}

beforeEach(async () => {
  await resetApp();
  window.localStorage.setItem('lrs.guide.v1', '1');
});

describe('AI 输入基础过滤', () => {
  it('过滤零宽/控制字符并合并空行，不影响其他助手功能', async () => {
    await renderAssistant();
    const textarea = screen.getByLabelText('自由描述');

    fireEvent.change(textarea, {
      target: { value: '你好\u200B\u0000\n\n\n\n世界\t重点' },
    });

    const cleaned = '你好\n\n世界  重点';
    expect(textarea).toHaveValue(cleaned);
    expect(screen.getByText(`${cleaned.length} / 500`)).toBeInTheDocument();
    expect(
      screen.getByText(
        '自由描述仅在你点击“让军师整理”后随上下文发送；请勿填写真实姓名、手机号、身份证号或银行卡号。',
      ),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '狼人' }));
    expect(screen.getByRole('button', { name: '狼人' })).toHaveAttribute('aria-pressed', 'true');

    const preview = screen.getByRole('region', { name: 'AI 上下文预览内容' });
    expect(preview.textContent).toContain('你好');
    expect(preview.textContent).not.toContain('\u200B');
    expect(preview.textContent).not.toContain('\u0000');
  });

  it('检测到手机号/身份证时提示且不阻断编辑', async () => {
    await renderAssistant();
    const textarea = screen.getByLabelText('自由描述');

    fireEvent.change(textarea, {
      target: { value: '电话 13800138000，身份证 11010519491231002X' },
    });

    expect(
      screen.getByText('检测到疑似手机号、身份证号，请勿填写真实个人信息。'),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '守卫' }));
    expect(screen.getByRole('button', { name: '守卫' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('自由描述')).toHaveValue(
      '电话 13800138000，身份证 11010519491231002X',
    );
  });

  it('超过 500 字提示并禁止 AI 提交，回落到 500 字后恢复', async () => {
    await renderAssistant();
    await configureAi();
    const textarea = screen.getByLabelText('自由描述');

    fireEvent.change(textarea, { target: { value: '甲'.repeat(501) } });

    expect(screen.getByText('501 / 500')).toBeInTheDocument();
    expect(
      screen.getByText('自由描述最多 500 字，当前 501 字；请精简后再让 AI 整理。'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '让军师整理' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: '预言家' }));
    expect(screen.getByRole('button', { name: '预言家' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.change(textarea, { target: { value: '甲'.repeat(500) } });

    expect(screen.getByText('500 / 500')).toBeInTheDocument();
    expect(
      screen.queryByText('自由描述最多 500 字，当前 501 字；请精简后再让 AI 整理。'),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '让军师整理' })).toBeEnabled();
  });
});
