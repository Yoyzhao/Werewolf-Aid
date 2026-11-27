import { act, render, screen, waitFor, within, type RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import App from './App';
import { clearAssistantRecord } from './lib/assistant-storage';
import { clearNotes } from './lib/notes-storage';
import { clearGameRecord } from './lib/storage';
import { useAssistantStore } from './stores/assistant-store';
import { useGameStore } from './stores/game-store';
import { resetNotesRuntime, useNotesStore } from './stores/notes-store';

async function resetApp(): Promise<void> {
  await useAssistantStore.getState().flushSave();
  await clearAssistantRecord();
  await clearNotes();
  resetNotesRuntime();
  await clearGameRecord();
  window.localStorage.clear();
  window.sessionStorage.clear();
  useAssistantStore.setState(useAssistantStore.getInitialState(), true);
  useNotesStore.setState(useNotesStore.getInitialState(), true);
  useGameStore.setState(useGameStore.getInitialState(), true);
}

async function renderAssistant(): Promise<RenderResult> {
  const view = render(<App />);
  await screen.findByRole('heading', { name: '狼人杀助手' });
  await userEvent.click(screen.getByRole('button', { name: /我的助手/ }));
  await screen.findByRole('heading', { name: '我的身份档案' });
  return view;
}

async function openNotes(): Promise<void> {
  await userEvent.click(screen.getByRole('tab', { name: '笔记' }));
  await screen.findByLabelText('私人笔记');
}

beforeEach(async () => {
  await resetApp();
  window.localStorage.setItem('lrs.guide.v1', '1');
});

describe('私人笔记', () => {
  it('自动保存并显示状态，刷新后保留', async () => {
    const first = await renderAssistant();
    await openNotes();

    expect(screen.getByRole('tab', { name: '笔记' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('未编辑')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('私人笔记'), '首夜验 3 号查杀；7 号倒钩嫌疑');
    await waitFor(() => expect(screen.getByText('已保存')).toBeInTheDocument(), {
      timeout: 2000,
    });

    first.unmount();
    useNotesStore.setState(useNotesStore.getInitialState(), true);
    useAssistantStore.setState(useAssistantStore.getInitialState(), true);
    useGameStore.setState(useGameStore.getInitialState(), true);
    window.localStorage.setItem('lrs.guide.v1', '1');

    await renderAssistant();
    await openNotes();

    expect(screen.getByLabelText('私人笔记')).toHaveValue('首夜验 3 号查杀；7 号倒钩嫌疑');
  });

  it('笔记不自动进入 AI 上下文，引用后才带入自由描述', async () => {
    await renderAssistant();
    await openNotes();

    const note = '7 号倒钩嫌疑，重点听发言';
    await userEvent.type(screen.getByLabelText('私人笔记'), note);

    await userEvent.click(screen.getByRole('tab', { name: '记录' }));
    expect(screen.getByRole('region', { name: 'AI 上下文预览内容' })).not.toHaveTextContent(note);
    expect(screen.getByLabelText('自由描述')).toHaveValue('');

    await userEvent.click(screen.getByRole('tab', { name: '笔记' }));
    await userEvent.click(screen.getByRole('button', { name: '引用到自由描述' }));

    await userEvent.click(screen.getByRole('tab', { name: '记录' }));
    expect(screen.getByLabelText('自由描述')).toHaveValue(`【笔记引用】${note}`);
    expect(screen.getByRole('region', { name: 'AI 上下文预览内容' })).toHaveTextContent(note);
  });

  it('清空笔记需二次确认且不影响助手记录', async () => {
    await renderAssistant();

    await userEvent.type(screen.getByLabelText('自由描述'), '保留的助手内容');
    await act(async () => {
      await useAssistantStore.getState().flushSave();
    });

    await openNotes();
    await userEvent.type(screen.getByLabelText('私人笔记'), '准备删除的笔记');
    await waitFor(() => expect(screen.getByText('已保存')).toBeInTheDocument(), {
      timeout: 2000,
    });

    await userEvent.click(screen.getByRole('button', { name: '清空笔记' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: '清除' }));

    await waitFor(() => expect(screen.getByLabelText('私人笔记')).toHaveValue(''));
    expect(screen.getByText('未编辑')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: '记录' }));
    expect(screen.getByLabelText('自由描述')).toHaveValue('保留的助手内容');
    expect(screen.getByRole('region', { name: 'AI 上下文预览内容' })).toHaveTextContent(
      '保留的助手内容',
    );
  });
});
