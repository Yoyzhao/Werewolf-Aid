import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AI_ERROR_MESSAGES,
  AI_TIMEOUT_MS,
  AiClientError,
  isRetryableAiError,
  requestAiAnalysis,
  resetAiSession,
} from './ai-client';
import type { AiConfig } from './ai-config';

const CONFIG: AiConfig = {
  schemaVersion: 1,
  baseUrl: 'https://api.example.com/v1/chat/completions',
  model: 'gpt-test',
  temperature: 0.7,
  maxTokens: 800,
  rememberKey: false,
};

const CSRF = 'c'.repeat(64);

function fakeResponse(status: number, data: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  } as unknown as Response;
}

function sessionResponse(token = CSRF): Response {
  return fakeResponse(200, { csrfToken: token, expiresAt: Date.now() + 60_000 });
}

function relayResponse(
  content = '信息整理：...\n可疑对象：...\n下一步建议：...\n依据：...',
): Response {
  return fakeResponse(200, {
    ok: true,
    content,
    usage: { promptTokens: 12, completionTokens: 8 },
  });
}

function analysisOptions(fetchImpl: typeof fetch, overrides: Record<string, unknown> = {}) {
  return {
    config: CONFIG,
    apiKey: 'sk-client-test',
    contextText: '【我的身份】\n预言家',
    fetchImpl,
    ...overrides,
  };
}

beforeEach(() => {
  resetAiSession();
  vi.unstubAllGlobals();
});

describe('requestAiAnalysis', () => {
  it('先取会话再用 CSRF 发送中转请求', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      if (String(input) === '/api/v1/session') return sessionResponse();
      return relayResponse();
    });

    const result = await requestAiAnalysis(analysisOptions(fetchImpl as unknown as typeof fetch));

    expect(result.content).toContain('信息整理');
    expect(result.usage).toEqual({ promptTokens: 12, completionTokens: 8 });
    expect(calls).toHaveLength(2);
    expect(calls[0]?.url).toBe('/api/v1/session');
    expect(calls[1]?.url).toBe('/api/v1/ai/relay');
    expect(calls[1]?.init?.credentials).toBe('same-origin');
    expect((calls[1]?.init?.headers as Record<string, string>)['x-csrf-token']).toBe(CSRF);
    expect(String(calls[1]?.init?.body)).not.toContain('Bearer');

    const body = JSON.parse(String(calls[1]?.init?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      baseUrl: CONFIG.baseUrl,
      apiKey: 'sk-client-test',
      model: 'gpt-test',
      temperature: 0.7,
      maxTokens: 800,
    });
    const messages = body.messages as Array<{ role: string; content: string }>;
    expect(messages[0]?.role).toBe('system');
    expect(messages[0]?.content).toContain('狼人杀复盘助手');
    expect(messages[1]).toEqual({ role: 'user', content: '【我的身份】\n预言家' });
  });

  it('复用会话 token，避免每次请求都取会话', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === '/api/v1/session') return sessionResponse();
      return relayResponse();
    });

    await requestAiAnalysis(analysisOptions(fetchImpl as unknown as typeof fetch));
    await requestAiAnalysis(analysisOptions(fetchImpl as unknown as typeof fetch));

    const sessionCalls = fetchImpl.mock.calls.filter(
      ([input]) => String(input) === '/api/v1/session',
    );
    expect(sessionCalls).toHaveLength(1);
  });

  it('401 时刷新会话并重试一次', async () => {
    let sessionCount = 0;
    let relayCount = 0;
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === '/api/v1/session') {
        sessionCount += 1;
        return sessionResponse(sessionCount === 1 ? CSRF : 'd'.repeat(64));
      }
      relayCount += 1;
      return relayCount === 1
        ? fakeResponse(401, { error: { code: 'UNAUTHORIZED', message: 'no session' } })
        : relayResponse();
    });

    const result = await requestAiAnalysis(analysisOptions(fetchImpl as unknown as typeof fetch));

    expect(result.content).toContain('信息整理');
    expect(sessionCount).toBe(2);
    expect(relayCount).toBe(2);
  });

  it('映射后端业务错误码', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === '/api/v1/session') return sessionResponse();
      return fakeResponse(400, { error: { code: 'KEY_INVALID', message: 'bad key' } });
    });

    await expect(
      requestAiAnalysis(analysisOptions(fetchImpl as unknown as typeof fetch)),
    ).rejects.toMatchObject({ code: 'KEY_INVALID' });
  });

  it('未知错误码与非 JSON 错误归为 NETWORK', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === '/api/v1/session') return sessionResponse();
      return {
        ok: false,
        status: 400,
        json: async () => {
          throw new Error('not json');
        },
      } as unknown as Response;
    });

    await expect(
      requestAiAnalysis(analysisOptions(fetchImpl as unknown as typeof fetch)),
    ).rejects.toMatchObject({ code: 'NETWORK' });
  });

  it('内容为空或结构不符归为 UPSTREAM_5XX', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === '/api/v1/session') return sessionResponse();
      return fakeResponse(200, { ok: true, content: '   ' });
    });

    await expect(
      requestAiAnalysis(analysisOptions(fetchImpl as unknown as typeof fetch)),
    ).rejects.toMatchObject({ code: 'UPSTREAM_5XX' });
  });

  it('网络失败归为 NETWORK', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === '/api/v1/session') return sessionResponse();
      throw new TypeError('fetch failed');
    });

    await expect(
      requestAiAnalysis(analysisOptions(fetchImpl as unknown as typeof fetch)),
    ).rejects.toMatchObject({ code: 'NETWORK' });
  });

  it('前端 60s 超时映射为 TIMEOUT', async () => {
    const fetchImpl = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === '/api/v1/session') return Promise.resolve(sessionResponse());
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    });

    await expect(
      requestAiAnalysis(analysisOptions(fetchImpl as unknown as typeof fetch, { timeoutMs: 20 })),
    ).rejects.toMatchObject({ code: 'TIMEOUT' });
    expect(AI_TIMEOUT_MS).toBe(60_000);
  });

  it('外部取消映射为 CANCELLED', async () => {
    let relayStarted: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      relayStarted = resolve;
    });
    const fetchImpl = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === '/api/v1/session') return Promise.resolve(sessionResponse());
      relayStarted?.();
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    });

    const controller = new AbortController();
    const promise = requestAiAnalysis(
      analysisOptions(fetchImpl as unknown as typeof fetch, { signal: controller.signal }),
    );
    await started;
    controller.abort();

    await expect(promise).rejects.toMatchObject({ code: 'CANCELLED' });
  });
});

describe('错误文案与重试策略', () => {
  it('覆盖契约错误码文案', () => {
    expect(AI_ERROR_MESSAGES.KEY_INVALID).toBe('Key 无效，请检查后重试');
    expect(AI_ERROR_MESSAGES.TIMEOUT).toBe('请求超时（60 秒），请稍后重试');
    expect(AI_ERROR_MESSAGES.URL_NOT_ALLOWED).toBe('该地址不被允许，请使用 HTTPS 公网地址');
    expect(new AiClientError('QUOTA').message).toBe('额度不足，请检查账户余额');
  });

  it('配置类错误不可重试，其余可重试', () => {
    expect(isRetryableAiError('URL_NOT_ALLOWED')).toBe(false);
    expect(isRetryableAiError('INVALID_REQUEST')).toBe(false);
    expect(isRetryableAiError('CANCELLED')).toBe(false);
    expect(isRetryableAiError('KEY_INVALID')).toBe(true);
    expect(isRetryableAiError('TIMEOUT')).toBe(true);
    expect(isRetryableAiError('RATE_LIMITED')).toBe(true);
  });
});
