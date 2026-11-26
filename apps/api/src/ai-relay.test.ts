// @vitest-environment node
import { EventEmitter } from 'node:events';
import type { ClientRequest, IncomingMessage } from 'node:http';
import type { RequestOptions } from 'node:https';
import type { LookupFunction } from 'node:net';

import { describe, expect, it, vi } from 'vitest';

import {
  UpstreamError,
  createUpstreamRequester,
  mapUpstreamError,
  mapUpstreamResponse,
  type HttpsRequestFn,
  type UpstreamRequestOptions,
  type UpstreamResponse,
} from './ai-relay.js';
import { ApiError } from './errors.js';

function response(
  status: number,
  body: unknown = {},
  headers: Record<string, string> = {},
): UpstreamResponse {
  return {
    status,
    headers,
    body: Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

describe('mapUpstreamResponse', () => {
  it('解析 choices 与 usage', () => {
    const result = mapUpstreamResponse(
      response(200, {
        choices: [{ message: { content: '信息整理：...' } }],
        usage: { prompt_tokens: 1200, completion_tokens: 300 },
      }),
    );
    expect(result).toEqual({
      ok: true,
      content: '信息整理：...',
      usage: { promptTokens: 1200, completionTokens: 300 },
    });
  });

  it('缺少 usage 时仍返回内容', () => {
    const result = mapUpstreamResponse(
      response(200, { choices: [{ message: { content: 'ok' } }] }),
    );
    expect(result).toEqual({ ok: true, content: 'ok' });
  });

  it('拒绝重定向', async () => {
    await expect(async () => mapUpstreamResponse(response(302))).rejects.toMatchObject({
      code: 'UPSTREAM_4XX',
      status: 502,
    });
  });

  it.each([401, 403])('状态码 %s 映射为 KEY_INVALID', async (status) => {
    await expect(async () => mapUpstreamResponse(response(status))).rejects.toMatchObject({
      code: 'KEY_INVALID',
      status: 400,
    });
  });

  it('402 映射为 QUOTA', async () => {
    await expect(async () => mapUpstreamResponse(response(402))).rejects.toMatchObject({
      code: 'QUOTA',
      status: 402,
    });
  });

  it('429 映射为 RATE_LIMITED 并透传 retry-after', async () => {
    await expect(async () =>
      mapUpstreamResponse(response(429, {}, { 'retry-after': '30' })),
    ).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      status: 429,
      headers: { 'retry-after': '30' },
    });
  });

  it('其他 4xx 映射为 UPSTREAM_4XX', async () => {
    await expect(async () => mapUpstreamResponse(response(400))).rejects.toMatchObject({
      code: 'UPSTREAM_4XX',
      status: 502,
    });
  });

  it.each([500, 503])('状态码 %s 映射为 UPSTREAM_5XX', async (status) => {
    await expect(async () => mapUpstreamResponse(response(status))).rejects.toMatchObject({
      code: 'UPSTREAM_5XX',
      status: 502,
    });
  });

  it('响应非 JSON 映射为 UPSTREAM_5XX', async () => {
    await expect(async () =>
      mapUpstreamResponse(response(200, '<html>oops</html>')),
    ).rejects.toMatchObject({ code: 'UPSTREAM_5XX', status: 502 });
  });

  it('choices 缺失或内容为空映射为 UPSTREAM_5XX', async () => {
    await expect(async () => mapUpstreamResponse(response(200, {}))).rejects.toMatchObject({
      code: 'UPSTREAM_5XX',
    });
    await expect(async () =>
      mapUpstreamResponse(response(200, { choices: [{ message: { content: '   ' } }] })),
    ).rejects.toMatchObject({ code: 'UPSTREAM_5XX' });
  });
});

describe('mapUpstreamError', () => {
  it('超时映射为 TIMEOUT 504', () => {
    const mapped = mapUpstreamError(new UpstreamError('TIMEOUT', 'timeout'));
    expect(mapped).toMatchObject({ code: 'TIMEOUT', status: 504 });
  });

  it('响应过大映射为 UPSTREAM_5XX', () => {
    const mapped = mapUpstreamError(new UpstreamError('TOO_LARGE', 'too large'));
    expect(mapped).toMatchObject({ code: 'UPSTREAM_5XX', status: 502 });
  });

  it('网络错误映射为 NETWORK', () => {
    const mapped = mapUpstreamError(new UpstreamError('NETWORK', 'network'));
    expect(mapped).toMatchObject({ code: 'NETWORK', status: 502 });
  });

  it('ApiError 原样返回', () => {
    const error = new ApiError('URL_NOT_ALLOWED', 400, 'blocked');
    expect(mapUpstreamError(error)).toBe(error);
  });

  it('未知错误映射为 INTERNAL', () => {
    expect(mapUpstreamError(new Error('boom'))).toMatchObject({ code: 'INTERNAL', status: 500 });
  });
});

class FakeRequest extends EventEmitter {
  readonly write = vi.fn();
  readonly end = vi.fn();
  readonly destroy = vi.fn();
}

class FakeResponse extends EventEmitter {
  statusCode = 200;
  readonly headers: Record<string, string> = {};
  readonly destroy = vi.fn();
}

const targetOptions: UpstreamRequestOptions = {
  target: {
    url: new URL('https://api.example.com/v1/chat/completions'),
    address: '93.184.216.34',
    family: 4,
  },
  apiKey: 'sk-relay-test',
  body: { model: 'gpt-test', messages: [{ role: 'user', content: 'hi' }] },
  connectTimeoutMs: 30000,
  totalTimeoutMs: 60000,
  maxResponseBytes: 1024,
};

function fakeHttps(): {
  requestFn: HttpsRequestFn;
  request: FakeRequest;
  options: RequestOptions[];
} {
  const request = new FakeRequest();
  const options: RequestOptions[] = [];
  const requestFn: HttpsRequestFn = (requestOptions) => {
    options.push(requestOptions);
    return request as unknown as ClientRequest;
  };
  return { requestFn, request, options };
}

function emitResponse(request: FakeRequest, response: FakeResponse): void {
  request.emit('response', response as unknown as IncomingMessage);
}

describe('createUpstreamRequester', () => {
  it('固定已验证 IP 并携带鉴权头', async () => {
    const fake = fakeHttps();
    const promise = createUpstreamRequester(fake.requestFn)(targetOptions);

    const requestOptions = fake.options[0];
    expect(requestOptions).toMatchObject({
      protocol: 'https:',
      hostname: 'api.example.com',
      port: 443,
      path: '/v1/chat/completions',
      method: 'POST',
      servername: 'api.example.com',
      headers: {
        authorization: 'Bearer sk-relay-test',
        'content-type': 'application/json',
        accept: 'application/json',
      },
    });
    const headers = requestOptions?.headers as Record<string, string | number> | undefined;
    expect(headers?.['content-length']).toBeGreaterThan(0);

    const lookupCallback = vi.fn();
    const lookup = requestOptions?.lookup as LookupFunction;
    lookup('api.example.com', { all: false }, lookupCallback);
    expect(lookupCallback).toHaveBeenCalledWith(null, '93.184.216.34', 4);

    const response = new FakeResponse();
    emitResponse(fake.request, response);
    response.emit(
      'data',
      Buffer.from(JSON.stringify({ choices: [{ message: { content: 'hi' } }] })),
    );
    response.emit('end');

    await expect(promise).resolves.toMatchObject({ status: 200 });
    expect(fake.request.write).toHaveBeenCalledTimes(1);
    expect(fake.request.end).toHaveBeenCalledTimes(1);
  });

  it('连接超时抛出 TIMEOUT', async () => {
    vi.useFakeTimers();
    try {
      const fake = fakeHttps();
      const promise = createUpstreamRequester(fake.requestFn)(targetOptions);
      const assertion = expect(promise).rejects.toMatchObject({ kind: 'TIMEOUT' });

      fake.request.emit('socket', { connecting: true, once: vi.fn() });
      await vi.advanceTimersByTimeAsync(30000);
      await assertion;
      expect(fake.request.destroy).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('总超时抛出 TIMEOUT', async () => {
    vi.useFakeTimers();
    try {
      const fake = fakeHttps();
      const promise = createUpstreamRequester(fake.requestFn)(targetOptions);
      const assertion = expect(promise).rejects.toMatchObject({ kind: 'TIMEOUT' });

      await vi.advanceTimersByTimeAsync(60000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it('响应超过上限抛出 TOO_LARGE', async () => {
    const fake = fakeHttps();
    const promise = createUpstreamRequester(fake.requestFn)({
      ...targetOptions,
      maxResponseBytes: 16,
    });
    const assertion = expect(promise).rejects.toMatchObject({ kind: 'TOO_LARGE' });

    const response = new FakeResponse();
    emitResponse(fake.request, response);
    response.emit('data', Buffer.alloc(32));
    await assertion;
    expect(response.destroy).toHaveBeenCalled();
  });

  it('请求错误抛出 NETWORK', async () => {
    const fake = fakeHttps();
    const promise = createUpstreamRequester(fake.requestFn)(targetOptions);
    const assertion = expect(promise).rejects.toMatchObject({ kind: 'NETWORK' });

    fake.request.emit('error', new Error('boom'));
    await assertion;
  });
});
