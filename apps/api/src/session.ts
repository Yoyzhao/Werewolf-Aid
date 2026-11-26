import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import type { CookieSerializeOptions } from '@fastify/cookie';
import { CSRF_HEADER, SESSION_COOKIE_NAME } from '@lrs/shared';
import type { FastifyRequest } from 'fastify';

import type { AppConfig } from './config.js';
import { ApiError } from './errors.js';

const COOKIE_SIGNATURE_CONTEXT = 'lrs-anon-cookie-v1';

export function createSessionId(): string {
  return randomBytes(24).toString('hex');
}

export function csrfTokenFor(secret: string, sessionId: string): string {
  return createHmac('sha256', secret).update(sessionId).digest('hex');
}

export function verifyCsrf(secret: string, sessionId: string, token: string | undefined): boolean {
  if (!token) return false;
  const expected = Buffer.from(csrfTokenFor(secret, sessionId));
  const actual = Buffer.from(token);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** 会话 Cookie 值 = 会话 ID + HMAC 签名，防止客户端伪造/固定房间身份。 */
export function signSessionId(secret: string, sessionId: string): string {
  return createHmac('sha256', secret)
    .update(`${COOKIE_SIGNATURE_CONTEXT}:${sessionId}`)
    .digest('hex');
}

export function sessionCookieValue(secret: string, sessionId: string): string {
  return `${sessionId}.${signSessionId(secret, sessionId)}`;
}

export function sessionCookieOptions(config: AppConfig): CookieSerializeOptions {
  return {
    httpOnly: true,
    secure: config.httpsEnabled || config.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(config.sessionTtlMs / 1000),
  };
}

/** 验签并返回会话 ID；签名缺失/错误一律视为无会话。 */
export function readSessionId(
  cookies: Record<string, string | undefined>,
  secret: string,
): string | undefined {
  const raw = cookies[SESSION_COOKIE_NAME];
  if (!raw) return undefined;

  const separator = raw.indexOf('.');
  if (separator <= 0) return undefined;

  const sessionId = raw.slice(0, separator);
  const signature = raw.slice(separator + 1);
  if (!/^[a-f0-9]{48}$/.test(sessionId)) return undefined;

  const expected = Buffer.from(signSessionId(secret, sessionId));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return undefined;
  }
  return sessionId;
}

export function requireSessionId(request: FastifyRequest, config: AppConfig): string {
  const sessionId = readSessionId(request.cookies, config.sessionSecret);
  if (!sessionId) {
    throw new ApiError('UNAUTHORIZED', 401, '缺少会话，请刷新页面后重试');
  }
  return sessionId;
}

/** 写接口统一守卫：会话 + Origin + CSRF。 */
export function verifyCsrfRequest(request: FastifyRequest, config: AppConfig): void {
  const sessionId = requireSessionId(request, config);

  const origin = request.headers.origin;
  if (config.publicOrigin && origin !== config.publicOrigin) {
    throw new ApiError('FORBIDDEN', 403, '请求来源不被允许');
  }

  const header = request.headers[CSRF_HEADER];
  const token = Array.isArray(header) ? header[0] : header;
  if (!verifyCsrf(config.sessionSecret, sessionId, token)) {
    throw new ApiError('FORBIDDEN', 403, 'CSRF 校验失败，请刷新页面后重试');
  }
}

/** Socket.IO 握手没有 Fastify 的 cookie 解析，需要自行解析 Cookie 头。 */
export function parseCookieHeader(header: string | undefined): Record<string, string | undefined> {
  if (!header) return {};
  const cookies: Record<string, string | undefined> = {};
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator <= 0) continue;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (name) cookies[name] = decodeURIComponent(value);
  }
  return cookies;
}
