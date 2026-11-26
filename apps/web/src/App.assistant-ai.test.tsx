import { render, screen, waitFor, type RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from './App';
import { clearAiConfig } from './lib/ai-config';
import { resetAiSession } from './lib/ai-client';
import { clearAssistantRecord } from './lib/assistant-storage';
import { clearGameRecord } from './lib/storage';
import { useAiStore } from './stores/ai-store';
import { useAssistantStore } from './stores/assistant-store';
import { useGameStore } from './stores/game-store';

const CSRF = 'c'.repeat(64);
const SUCCESS_CONTENT =
  '信息整理：预言家首夜查验 3 号。\n可疑对象：3 号发言与记录矛盾。\n下一步建议：白天优先听 3 号解释。\n依据：3 号记录与公开发言。';

function fakeResponse(status: number, data: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  } as unknown as Response;
}

function sessionResponse(): Response {
  return fakeResponse(200, { csrfToken: CSRF, expiresAt: Date.now() + 60_000 });
}

function installFetch(
  relay: (body: Record<string, unknown>, init?: RequestInit) => Promise<Response>,
): ReturnType<typeof vi.fn> {
  const mock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === '/api/v1/session') return sessionResponse();
    if (url === '/api/v1/ai/relay') {
      return relay(JSON.parse(String(init?.body)) as Record<string, unknown>, init);
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}

async function resetApp(): Promise<void> {
  await clearAiConfig();
  await useAssistantStore.getState().flushSave();
  await clearAssistantRecord();
  await clearGameRecord();
  window.localStorage.clear();
  window.sessionStorage.clear();
  resetAiSession();
  useAiStore.getState().cancel();
  useAiStore.setState(useAiStore.getInitialState(), true);
  useAssistantStore.setState(useAssistantStore.getInitialState(), true);
  useGameStore.setState(useGameStore.getInitialState(), true);
}

async function renderAssistant(): Promise<RenderResult> {
  const view = render(<App />);
  await screen.findByRole('heading', { name: '狼人杀助手' });
  await userEvent.click(screen.getByRole('button', { name: /我的助手/ }));
  await screen.findByRole('heading', { name: '我的身份档案' });
  await waitFor(() => {
    expect(
      screen.getByText('还没有配置 AI。填写接口地址、模型名和 Key 后即可让军师整理。'),
    ).toBeInTheDocument();
  });
  return view;
}

async function fillAndSaveConfig(
  baseUrl = 'https://api.example.com/v1/chat/completions',
): Promise<void> {
  await userEvent.type(screen.getByLabelText('接口地址'), baseUrl);
  await userEvent.type(screen.getByLabelText('模型名'), 'gpt-test');
  await userEvent.type(screen.getByLabelText('API Key'), 'sk-ui-test');
  await userEvent.click(screen.getByRole('button', { name: '保存配置' }));
  await waitFor(() => {
    expect(screen.getByText('已配置')).toBeInTheDocument();
  });
}

beforeEach(async () => {
  await resetApp();
  window.localStorage.setItem('lrs.guide.v1', '1');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('助手 AI 接入', () => {
  it('保存配置后可请求并展示三段结果', async () => {
    const bodies: Array<Record<string, unknown>> = [];
    const fetchMock = installFetch(async (body) => {
      bodies.push(body);
      return fakeResponse(200, {
        ok: true,
        content: SUCCESS_CONTENT,
        usage: { promptTokens: 20, completionTokens: 10 },
      });
    });

    await renderAssistant();
    await userEvent.click(screen.getByRole('button', { name: '预言家' }));
    await userEvent.click(screen.getByRole('button', { name: '3 号 查杀' }));
    await fillAndSaveConfig();

    expect(screen.getByLabelText('API Key')).toHaveValue('');
    expect(screen.getByText('已配置')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '让军师整理' }));

    const result = await screen.findByRole('region', { name: 'AI 分析结果' });
    expect(result).toHaveTextContent('信息整理：预言家首夜查验 3 号。');
    expect(result).toHaveTextContent('可疑对象：3 号发言与记录矛盾。');
    expect(result).toHaveTextContent('下一步建议：白天优先听 3 号解释。');
    expect(screen.getByText('AI 分析仅供参考，可能出错，请自行判断。')).toBeInTheDocument();

    expect(bodies).toHaveLength(1);
    const body = bodies[0] ?? {};
    expect(Object.keys(body).sort()).toEqual([
      'apiKey',
      'baseUrl',
      'maxTokens',
      'messages',
      'model',
      'temperature',
    ]);
    const messages = body.messages as Array<{ role: string; content: string }>;
    expect(messages[0]?.role).toBe('system');
    expect(messages[1]?.content).toContain('【我的身份】');
    expect(messages[1]?.content).toContain('预言家');
    expect(messages[1]?.content).toContain('3 号：查杀');
    const relayUrls = fetchMock.mock.calls
      .map(([input]) => String(input))
      .filter((url) => url === '/api/v1/ai/relay');
    expect(relayUrls).toHaveLength(1);
    expect(relayUrls.some((url) => url.includes('sk-ui-test'))).toBe(false);
  });

  it('Key 无效显示可重试错误', async () => {
    installFetch(async () =>
      fakeResponse(400, { error: { code: 'KEY_INVALID', message: 'bad key' } }),
    );
    await renderAssistant();
    await fillAndSaveConfig();

    await userEvent.click(screen.getByRole('button', { name: '让军师整理' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Key 无效，请检查后重试');
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument();
    expect(screen.getByText('AI 分析仅供参考，可能出错，请自行判断。')).toBeInTheDocument();
  });

  it('地址不被允许时提示且不提供重试', async () => {
    installFetch(async () =>
      fakeResponse(400, {
        error: { code: 'URL_NOT_ALLOWED', message: '接口地址不允许指向内网或本机' },
      }),
    );
    await renderAssistant();
    await fillAndSaveConfig('https://127.0.0.1/v1');

    await userEvent.click(screen.getByRole('button', { name: '让军师整理' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '该地址不被允许，请使用 HTTPS 公网地址',
    );
    expect(screen.queryByRole('button', { name: '重试' })).not.toBeInTheDocument();
    expect(screen.getByText('请修改配置后重试。')).toBeInTheDocument();
  });

  it('请求中可取消，取消后不产生结果', async () => {
    installFetch(
      (_body, init) =>
        new Promise<Response>((_resolve, reject) => {
          const abort = () => reject(new DOMException('Aborted', 'AbortError'));
          if (init?.signal?.aborted) abort();
          else init?.signal?.addEventListener('abort', abort, { once: true });
        }),
    );
    await renderAssistant();
    await fillAndSaveConfig();

    await userEvent.click(screen.getByRole('button', { name: '让军师整理' }));
    expect(await screen.findByText('军师正在整理，最长等待 60 秒…')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '取消' }));

    expect(await screen.findByText('已取消，未产生结果')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'AI 分析结果' })).not.toBeInTheDocument();
  });

  it('勾选记住后 Key 写入 sessionStorage，清除配置后移除', async () => {
    installFetch(async () => fakeResponse(200, { ok: true, content: SUCCESS_CONTENT }));
    await renderAssistant();

    await userEvent.click(screen.getByLabelText('记住本次会话'));
    await fillAndSaveConfig();
    expect(window.sessionStorage.getItem('lrs.ai.key.v1')).toBe('sk-ui-test');

    await userEvent.click(screen.getByRole('button', { name: '清除配置' }));
    expect(window.sessionStorage.getItem('lrs.ai.key.v1')).toBeNull();
    expect(
      await screen.findByText('还没有配置 AI。填写接口地址、模型名和 Key 后即可让军师整理。'),
    ).toBeInTheDocument();
  });

  it('AI 输出按纯文本渲染，不执行 HTML', async () => {
    const payload = '<img src=x onerror="window.__aiXss=1">可疑内容';
    installFetch(async () => fakeResponse(200, { ok: true, content: payload }));
    await renderAssistant();
    await fillAndSaveConfig();

    await userEvent.click(screen.getByRole('button', { name: '让军师整理' }));

    const result = await screen.findByRole('region', { name: 'AI 分析结果' });
    expect(result).toHaveTextContent('<img src=x onerror="window.__aiXss=1">可疑内容');
    expect(result.querySelector('img')).toBeNull();
    expect((window as unknown as { __aiXss?: number }).__aiXss).toBeUndefined();
  });

  it('空配置保存时提示必填项且不发起中转', async () => {
    const fetchMock = installFetch(async () => fakeResponse(200, { ok: true, content: 'x' }));
    await renderAssistant();

    await userEvent.click(screen.getByRole('button', { name: '保存配置' }));

    expect(await screen.findByText('请填写接口地址')).toBeInTheDocument();
    expect(screen.getByText('请填写模型名')).toBeInTheDocument();
    expect(screen.getByText('请填写 API Key')).toBeInTheDocument();
    const relayCalls = fetchMock.mock.calls.filter(
      ([input]) => String(input) === '/api/v1/ai/relay',
    );
    expect(relayCalls).toHaveLength(0);
  });
});
