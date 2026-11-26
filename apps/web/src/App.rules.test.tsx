import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import App from './App';
import { clearGameRecord } from './lib/storage';
import { useGameStore } from './stores/game-store';

async function resetApp(): Promise<void> {
  window.localStorage.clear();
  window.sessionStorage.clear();
  await clearGameRecord();
  useGameStore.setState(useGameStore.getInitialState(), true);
}

async function openRules(): Promise<void> {
  render(<App />);
  await screen.findByRole('heading', { name: '狼人杀助手' });
  await userEvent.click(screen.getByRole('button', { name: /先翻规则书/ }));
  await screen.findByRole('heading', { name: '月蚀规则书' });
}

beforeEach(async () => {
  await resetApp();
  window.localStorage.setItem('lrs.guide.v1', '1');
});

describe('规则页', () => {
  it('展示两套板子、8 个角色、流程与页脚', async () => {
    await openRules();

    expect(screen.getAllByText(/预女猎守/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/预女猎白/).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: '预言家' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('一夜的流程')).toBeInTheDocument();
    expect(screen.getByText('一天的流程')).toBeInTheDocument();
    expect(screen.getByText('怎么算赢')).toBeInTheDocument();
    expect(screen.getByText('依据规则资料整理，以开局约定为准')).toBeInTheDocument();
  });

  it('选择角色显示技能、限制、打法与易错点', async () => {
    await openRules();

    await userEvent.click(screen.getByRole('button', { name: '白狼王' }));

    expect(screen.getByText('随狼人共同行动；白天自爆时可带走一名玩家。')).toBeInTheDocument();
    expect(screen.getByText('自爆公开')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '常见打法' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '易错点' })).toBeInTheDocument();
  });

  it('底部 Tab 进入规则页并可返回大厅', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: '狼人杀助手' });

    await userEvent.click(screen.getByRole('button', { name: '规则' }));
    expect(await screen.findByRole('heading', { name: '月蚀规则书' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '规则' })).toHaveAttribute('aria-current', 'page');

    await userEvent.click(screen.getByRole('button', { name: /返回大厅/ }));
    expect(await screen.findByRole('heading', { name: '狼人杀助手' })).toBeInTheDocument();
  });
});
