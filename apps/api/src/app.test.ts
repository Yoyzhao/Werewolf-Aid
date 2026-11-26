// @vitest-environment node
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { SESSION_COOKIE_NAME } from '@lrs/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { UpstreamError, type UpstreamRequester, type UpstreamResponse } from './ai-relay.js';
import { buildApp } from './app.js';
import type { AppConfig } from './config.js';
import type { LookupFn } from './ssrf.js';

const publicLookup: LookupFn = async () => [{ address: '93.184.216.34', family: 4 }];

const OK_UPSTREAM: UpstreamResponse = {
  status: 200,
  headers: {},
  body: Buffer.from(
    JSON.stringify({
      choices: [{ message: { content: '信息整理：...' } }],
      usage: { prompt_tokens: 12, completion_tokens: 8 },
    }),
  ),
};

const okRequester: UpstreamRequester = async () => OK_UPSTREAM;

const BASE_CONFIG: Partial<AppConfig> = {
  nodeEnv: 'test',
  sessionSecret: 'test-secret',
  webDistDir: join(tmpdir(), 'lrs-api-missing-web-dist'),
  aiRateLimitPerMin: 100,
};

interface AppOverrides {
  readonly config?: Partial<AppConfig>;
  readonly lookup?: LookupFn;
  readonly requestUpstream?: UpstreamRequester;
}

const apps: FastifyInstance[] = [];

async function makeApp(overrides: AppOverrides = {}): Promise<FastifyInstance> {
  const app = await buildApp({
    config: { ...BASE_CONFIG, ...overrides.config },
    lookup: overrides.lookup ?? publicLookup,
    requestUpstream: overrides.requestUpstream ?? okRequester,
  });
  apps.push(app);
  return app;
}

afterEach(async () => {
  await Promise.all(
    apps.splice(0).map(async (app) => {
      await app.close();
    }),
  );
});

interface Session {
  readonly cookie: string;
  readonly csrfToken: string;
}

async function startSession(app: FastifyInstance): Promise<Session> {
  const response = await app.inject({ method: 'GET', url: '/api/v1/session' });
  expect(response.statusCode).toBe(200);
  const cookie = response.cookies.find((item) => item.name === SESSION_COOKIE_NAME);
  expect(cookie).toBeDefined();
  const body = response.json() as { csrfToken: string };
  return {
    cookie: `${SESSION_COOKIE_NAME}=${cookie?.value ?? ''}`,
    csrfToken: body.csrfToken,
  };
}

function relayBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    baseUrl: 'https://api.example.com/v1/chat/completions',
    apiKey: 'sk-test-key',
    model: 'gpt-test',
    messages: [{ role: 'user', content: '我的身份是预言家' }],
    ...overrides,
  };
}

async function postRelay(
  app: FastifyInstance,
  session: Session,
  body: Record<string, unknown> = relayBody(),
  headers: Record<string, string> = {},
): Promise<Awaited<ReturnType<FastifyInstance['inject']>>> {
  return app.inject({
    method: 'POST',
    url: '/api/v1/ai/relay',
    headers: {
      cookie: session.cookie,
      'x-csrf-token': session.csrfToken,
      ...headers,
    },
    payload: body,
  });
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('GET /api/v1/health', () => {
  it('无鉴权返回健康状态', async () => {
    const app = await makeApp();
    const response = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { ok: unknown; version: unknown };
    expect(body.ok).toBe(true);
    expect(typeof body.version).toBe('string');
    expect(response.cookies).toEqual([]);
  });
});

describe('GET /api/v1/session', () => {
  it('建立匿名会话并返回 CSRF token', async () => {
    const app = await makeApp();
    const response = await app.inject({ method: 'GET', url: '/api/v1/session' });
    expect(response.statusCode).toBe(200);

    const cookie = response.cookies.find((item) => item.name === SESSION_COOKIE_NAME);
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/' });
    expect(cookie?.value).toMatch(/^[a-f0-9]{48}\.[a-f0-9]{64}$/);

    const body = response.json() as { csrfToken: string; expiresAt: number };
    expect(body.csrfToken).toMatch(/^[a-f0-9]{64}$/);
    expect(body.expiresAt).toBeGreaterThan(Date.now());
  });

  it('复用已有会话，不重复下发 Cookie', async () => {
    const app = await makeApp();
    const session = await startSession(app);
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/session',
      headers: { cookie: session.cookie },
    });
    expect(response.statusCode).toBe(200);
    expect(response.cookies).toEqual([]);
    expect((response.json() as { csrfToken: string }).csrfToken).toBe(session.csrfToken);
  });
});

describe('POST /api/v1/ai/relay 会话与 CSRF', () => {
  it('缺少会话返回 401', async () => {
    const app = await makeApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/relay',
      payload: relayBody(),
    });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
  });

  it('缺少 CSRF token 返回 403', async () => {
    const app = await makeApp();
    const session = await startSession(app);
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/relay',
      headers: { cookie: session.cookie },
      payload: relayBody(),
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: { code: 'FORBIDDEN' } });
  });

  it('CSRF token 不匹配返回 403', async () => {
    const app = await makeApp();
    const session = await startSession(app);
    const response = await postRelay(app, session, relayBody(), {
      'x-csrf-token': 'deadbeef',
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: { code: 'FORBIDDEN' } });
  });

  it('配置 publicOrigin 后拒绝跨源请求', async () => {
    const app = await makeApp({ config: { publicOrigin: 'https://app.example.com' } });
    const session = await startSession(app);

    const blocked = await postRelay(app, session, relayBody(), {
      origin: 'https://evil.example.com',
    });
    expect(blocked.statusCode).toBe(403);

    const allowed = await postRelay(app, session, relayBody(), {
      origin: 'https://app.example.com',
    });
    expect(allowed.statusCode).toBe(200);
  });
});

describe('POST /api/v1/ai/relay 转发', () => {
  it('成功转发并按默认值补全参数', async () => {
    const requester = vi.fn<UpstreamRequester>(async () => OK_UPSTREAM);
    const app = await makeApp({ requestUpstream: requester });
    const session = await startSession(app);

    const response = await postRelay(app, session);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      content: '信息整理：...',
      usage: { promptTokens: 12, completionTokens: 8 },
    });

    expect(requester).toHaveBeenCalledTimes(1);
    const options = requester.mock.calls[0]?.[0];
    expect(options?.target.url.href).toBe('https://api.example.com/v1/chat/completions');
    expect(options?.target.address).toBe('93.184.216.34');
    expect(options?.apiKey).toBe('sk-test-key');
    expect(options?.body).toEqual({
      model: 'gpt-test',
      messages: [{ role: 'user', content: '我的身份是预言家' }],
      temperature: 0.7,
      max_tokens: 800,
    });
  });

  it('请求参数非法返回 INVALID_REQUEST 与明细', async () => {
    const app = await makeApp();
    const session = await startSession(app);
    const response = await postRelay(app, session, {
      baseUrl: 'not-a-url',
      apiKey: '',
      model: '',
      messages: [],
    });
    expect(response.statusCode).toBe(400);
    const body = response.json() as { error: { code: string; details: unknown[] } };
    expect(body.error.code).toBe('INVALID_REQUEST');
    expect(Array.isArray(body.error.details)).toBe(true);
  });

  it('拒绝非 https 地址', async () => {
    const requester = vi.fn<UpstreamRequester>(async () => OK_UPSTREAM);
    const app = await makeApp({ requestUpstream: requester });
    const session = await startSession(app);
    const response = await postRelay(
      app,
      session,
      relayBody({ baseUrl: 'http://api.example.com/v1/chat/completions' }),
    );
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: 'URL_NOT_ALLOWED' } });
    expect(requester).not.toHaveBeenCalled();
  });

  it('拒绝私网 IP 字面量', async () => {
    const requester = vi.fn<UpstreamRequester>(async () => OK_UPSTREAM);
    const app = await makeApp({ requestUpstream: requester });
    const session = await startSession(app);
    const response = await postRelay(
      app,
      session,
      relayBody({ baseUrl: 'https://10.0.0.8/v1/chat/completions' }),
    );
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: 'URL_NOT_ALLOWED' } });
    expect(requester).not.toHaveBeenCalled();
  });

  it('拒绝解析到私网的域名', async () => {
    const requester = vi.fn<UpstreamRequester>(async () => OK_UPSTREAM);
    const lookup: LookupFn = async () => [{ address: '169.254.169.254', family: 4 }];
    const app = await makeApp({ requestUpstream: requester, lookup });
    const session = await startSession(app);
    const response = await postRelay(app, session);
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: 'URL_NOT_ALLOWED' } });
    expect(requester).not.toHaveBeenCalled();
  });

  it.each([
    [401, 'KEY_INVALID', 400],
    [402, 'QUOTA', 402],
    [400, 'UPSTREAM_4XX', 502],
    [500, 'UPSTREAM_5XX', 502],
  ])('上游状态 %s 映射为 %s', async (status, code, expectedStatus) => {
    const requester = vi.fn<UpstreamRequester>(async () => ({
      status,
      headers: {},
      body: Buffer.from('{}'),
    }));
    const app = await makeApp({ requestUpstream: requester });
    const session = await startSession(app);
    const response = await postRelay(app, session);
    expect(response.statusCode).toBe(expectedStatus);
    expect(response.json()).toMatchObject({ error: { code } });
  });

  it('上游超时映射为 TIMEOUT 504', async () => {
    const requester = vi.fn<UpstreamRequester>(async () => {
      throw new UpstreamError('TIMEOUT', 'upstream timeout');
    });
    const app = await makeApp({ requestUpstream: requester });
    const session = await startSession(app);
    const response = await postRelay(app, session);
    expect(response.statusCode).toBe(504);
    expect(response.json()).toMatchObject({ error: { code: 'TIMEOUT' } });
  });

  it('上游网络错误映射为 NETWORK 502', async () => {
    const requester = vi.fn<UpstreamRequester>(async () => {
      throw new UpstreamError('NETWORK', 'network down');
    });
    const app = await makeApp({ requestUpstream: requester });
    const session = await startSession(app);
    const response = await postRelay(app, session);
    expect(response.statusCode).toBe(502);
    expect(response.json()).toMatchObject({ error: { code: 'NETWORK' } });
  });

  it('请求体不是合法 JSON 返回 INVALID_REQUEST', async () => {
    const app = await makeApp();
    const session = await startSession(app);
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/relay',
      headers: {
        cookie: session.cookie,
        'x-csrf-token': session.csrfToken,
        'content-type': 'application/json',
      },
      payload: '{"baseUrl":',
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: 'INVALID_REQUEST' } });
  });

  it('超过 128KB 请求体返回 413', async () => {
    const app = await makeApp();
    const session = await startSession(app);
    const response = await postRelay(
      app,
      session,
      relayBody({ messages: [{ role: 'user', content: 'x'.repeat(140_000) }] }),
    );
    expect(response.statusCode).toBe(413);
    expect(response.json()).toMatchObject({ error: { code: 'INVALID_REQUEST' } });
  });
});

describe('POST /api/v1/ai/relay 限频与并发', () => {
  it('超过每分钟限制返回 429 与 Retry-After', async () => {
    const app = await makeApp({ config: { aiRateLimitPerMin: 2 } });
    const session = await startSession(app);

    expect((await postRelay(app, session)).statusCode).toBe(200);
    expect((await postRelay(app, session)).statusCode).toBe(200);
    const limited = await postRelay(app, session);
    expect(limited.statusCode).toBe(429);
    expect(limited.json()).toMatchObject({ error: { code: 'RATE_LIMITED' } });
    expect(limited.headers['retry-after']).toBeDefined();
  });

  it('同一会话仅允许 1 个在途请求', async () => {
    const gate = deferred<UpstreamResponse>();
    const started = deferred<void>();
    const requester = vi.fn<UpstreamRequester>(async () => {
      started.resolve();
      return gate.promise;
    });
    const app = await makeApp({ requestUpstream: requester });
    const session = await startSession(app);

    const firstPromise = postRelay(app, session);
    await started.promise;

    const second = await postRelay(app, session);
    expect(second.statusCode).toBe(429);
    expect(second.json()).toMatchObject({ error: { code: 'RATE_LIMITED' } });

    gate.resolve(OK_UPSTREAM);
    expect((await firstPromise).statusCode).toBe(200);
  });
});

describe('静态资源与 SPA fallback', () => {
  it('未提供构建产物时所有前端路由返回 JSON 404', async () => {
    const app = await makeApp();
    const response = await app.inject({ method: 'GET', url: '/board/pre-setup' });
    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
  });

  it('静态资源、SPA fallback、API 404 互不吞噬', async () => {
    const root = await mkdtemp(join(tmpdir(), 'lrs-web-dist-'));
    try {
      await mkdir(join(root, 'assets'), { recursive: true });
      await writeFile(
        join(root, 'index.html'),
        '<!doctype html><html><body>SPA-ROOT</body></html>',
        'utf8',
      );
      await writeFile(join(root, 'assets', 'app-abc123.js'), 'console.log(1);', 'utf8');

      const app = await makeApp({ config: { webDistDir: root } });

      const index = await app.inject({ method: 'GET', url: '/' });
      expect(index.statusCode).toBe(200);
      expect(index.headers['content-type']).toContain('text/html');
      expect(index.body).toContain('SPA-ROOT');
      expect(index.headers['cache-control']).toBe('no-cache');

      const spa = await app.inject({ method: 'GET', url: '/board/pre-setup?step=2' });
      expect(spa.statusCode).toBe(200);
      expect(spa.body).toContain('SPA-ROOT');

      const asset = await app.inject({ method: 'GET', url: '/assets/app-abc123.js' });
      expect(asset.statusCode).toBe(200);
      expect(asset.headers['cache-control']).toBe('public, max-age=31536000, immutable');

      const api = await app.inject({ method: 'GET', url: '/api/v1/unknown' });
      expect(api.statusCode).toBe(404);
      expect(api.headers['content-type']).toContain('application/json');
      expect(api.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });

      const socketio = await app.inject({ method: 'GET', url: '/socket.io/?EIO=4' });
      expect(socketio.statusCode).toBe(404);
      expect(socketio.headers['content-type']).toContain('application/json');

      const missingAsset = await app.inject({ method: 'GET', url: '/missing.js' });
      expect(missingAsset.statusCode).toBe(404);
      expect(missingAsset.headers['content-type']).toContain('application/json');

      const write = await app.inject({ method: 'POST', url: '/board/pre-setup' });
      expect(write.statusCode).toBe(404);
      expect(write.headers['content-type']).toContain('application/json');

      const relayError = await app.inject({
        method: 'POST',
        url: '/api/v1/ai/relay',
        payload: relayBody(),
      });
      expect(relayError.statusCode).toBe(401);
      expect(relayError.json()).toEqual({
        error: { code: 'UNAUTHORIZED', message: '缺少会话，请刷新页面后重试' },
      });

      const health = await app.inject({ method: 'GET', url: '/api/v1/health' });
      expect(health.statusCode).toBe(200);
      expect(health.json()).toMatchObject({ ok: true });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe('安全头', () => {
  it('未启用 HTTPS 时不发送 HSTS', async () => {
    const app = await makeApp();
    const response = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(response.headers['strict-transport-security']).toBeUndefined();
  });

  it('启用 HTTPS 时发送 HSTS 与 upgrade-insecure-requests', async () => {
    const app = await makeApp({ config: { httpsEnabled: true } });
    const response = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(response.headers['strict-transport-security']).toContain('max-age=');
    expect(response.headers['content-security-policy']).toContain('upgrade-insecure-requests');
  });
});
