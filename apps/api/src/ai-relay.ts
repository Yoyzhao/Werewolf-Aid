import type { ClientRequest, IncomingMessage } from 'node:http';
import { request as httpsRequest, type RequestOptions } from 'node:https';
import type { LookupFunction } from 'node:net';

import type { AiRelayResponse } from '@lrs/shared';

import { ApiError } from './errors.js';
import type { ResolvedTarget } from './ssrf.js';

export type UpstreamErrorKind = 'TIMEOUT' | 'NETWORK' | 'TOO_LARGE';

export class UpstreamError extends Error {
  readonly kind: UpstreamErrorKind;

  constructor(kind: UpstreamErrorKind, message: string) {
    super(message);
    this.name = 'UpstreamError';
    this.kind = kind;
  }
}

export interface UpstreamRequestOptions {
  readonly target: ResolvedTarget;
  readonly apiKey: string;
  readonly body: unknown;
  readonly connectTimeoutMs: number;
  readonly totalTimeoutMs: number;
  readonly maxResponseBytes: number;
}

export interface UpstreamResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
  readonly body: Buffer;
}

export type UpstreamRequester = (options: UpstreamRequestOptions) => Promise<UpstreamResponse>;

export type HttpsRequestFn = (
  options: RequestOptions,
  callback?: (response: IncomingMessage) => void,
) => ClientRequest;

export function createUpstreamRequester(
  requestFn: HttpsRequestFn = httpsRequest,
): UpstreamRequester {
  return (options) =>
    new Promise((resolve, reject) => {
      const payload = Buffer.from(JSON.stringify(options.body));
      let settled = false;
      let connectTimer: NodeJS.Timeout | undefined;

      const finish = (error: Error | null, response?: UpstreamResponse): void => {
        if (settled) return;
        settled = true;
        if (totalTimer) clearTimeout(totalTimer);
        if (connectTimer) clearTimeout(connectTimer);
        if (error) reject(error);
        else if (response) resolve(response);
      };

      const lookup: LookupFunction = (_hostname, _options, callback) => {
        callback(null, options.target.address, options.target.family);
      };

      const request = requestFn({
        protocol: 'https:',
        hostname: options.target.url.hostname,
        port: options.target.url.port || 443,
        path: `${options.target.url.pathname}${options.target.url.search}`,
        method: 'POST',
        servername: options.target.url.hostname,
        lookup,
        headers: {
          authorization: `Bearer ${options.apiKey}`,
          'content-type': 'application/json',
          accept: 'application/json',
          'content-length': payload.length,
        },
      });

      request.on('socket', (socket) => {
        if (!socket.connecting) return;
        connectTimer = setTimeout(() => {
          const error = new UpstreamError('TIMEOUT', '上游连接超时');
          request.destroy(error);
          finish(error);
        }, options.connectTimeoutMs);
        socket.once('secureConnect', () => {
          if (connectTimer) clearTimeout(connectTimer);
        });
      });

      const totalTimer = setTimeout(() => {
        const error = new UpstreamError('TIMEOUT', '上游请求超时');
        request.destroy(error);
        finish(error);
      }, options.totalTimeoutMs);

      request.on('response', (response) => {
        const chunks: Buffer[] = [];
        let size = 0;

        response.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > options.maxResponseBytes) {
            const error = new UpstreamError('TOO_LARGE', '上游响应超过大小限制');
            response.destroy(error);
            request.destroy();
            finish(error);
            return;
          }
          chunks.push(chunk);
        });

        response.on('end', () => {
          finish(null, {
            status: response.statusCode ?? 0,
            headers: response.headers,
            body: Buffer.concat(chunks),
          });
        });

        response.on('error', (error) => {
          finish(
            error instanceof UpstreamError
              ? error
              : new UpstreamError('NETWORK', '读取上游响应失败'),
          );
        });
      });

      request.on('error', (error) => {
        finish(
          error instanceof UpstreamError ? error : new UpstreamError('NETWORK', '无法连接上游服务'),
        );
      });

      request.write(payload);
      request.end();
    });
}

export const requestUpstream = createUpstreamRequester();

function retryAfterHeader(
  headers: Readonly<Record<string, string | string[] | undefined>>,
): Record<string, string> | undefined {
  const value = headers['retry-after'];
  if (typeof value === 'string' && value.trim()) return { 'retry-after': value };
  if (Array.isArray(value) && value[0]) return { 'retry-after': value[0] };
  return undefined;
}

export function mapUpstreamResponse(response: UpstreamResponse): AiRelayResponse {
  if (response.status >= 300 && response.status < 400) {
    throw new ApiError('UPSTREAM_4XX', 502, '上游返回重定向，已拒绝');
  }
  if (response.status === 401 || response.status === 403) {
    throw new ApiError('KEY_INVALID', 400, 'Key 无效，请检查后重试');
  }
  if (response.status === 402) {
    throw new ApiError('QUOTA', 402, '额度不足，请检查账户余额');
  }
  if (response.status === 429) {
    throw new ApiError(
      'RATE_LIMITED',
      429,
      '上游请求过于频繁，请稍后再试',
      undefined,
      retryAfterHeader(response.headers),
    );
  }
  if (response.status >= 400 && response.status < 500) {
    throw new ApiError('UPSTREAM_4XX', 502, '模型服务拒绝了请求，请检查模型配置');
  }
  if (response.status >= 500) {
    throw new ApiError('UPSTREAM_5XX', 502, '模型服务暂时不可用，请稍后重试');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(response.body.toString('utf8'));
  } catch {
    throw new ApiError('UPSTREAM_5XX', 502, '上游响应格式不正确');
  }

  const content = (parsed as { choices?: Array<{ message?: { content?: unknown } }> }).choices?.[0]
    ?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new ApiError('UPSTREAM_5XX', 502, '上游响应格式不正确');
  }

  const usageRaw = (parsed as { usage?: { prompt_tokens?: unknown; completion_tokens?: unknown } })
    .usage;
  const usage =
    usageRaw &&
    typeof usageRaw.prompt_tokens === 'number' &&
    typeof usageRaw.completion_tokens === 'number'
      ? {
          promptTokens: usageRaw.prompt_tokens,
          completionTokens: usageRaw.completion_tokens,
        }
      : undefined;

  return { ok: true, content, ...(usage ? { usage } : {}) };
}

export function mapUpstreamError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof UpstreamError) {
    if (error.kind === 'TIMEOUT') {
      return new ApiError('TIMEOUT', 504, '请求超时（60 秒），请稍后重试');
    }
    if (error.kind === 'TOO_LARGE') {
      return new ApiError('UPSTREAM_5XX', 502, '上游响应超过大小限制');
    }
    return new ApiError('NETWORK', 502, '网络不可用，请检查网络后重试');
  }
  return new ApiError('INTERNAL', 500, '服务器内部错误');
}
