// @vitest-environment node
import { describe, expect, it } from 'vitest';

import type { AppConfig } from './config.js';
import {
  createSessionId,
  csrfTokenFor,
  parseCookieHeader,
  readSessionId,
  sessionCookieOptions,
  sessionCookieValue,
  verifyCsrf,
} from './session.js';

const baseConfig: AppConfig = {
  nodeEnv: 'test',
  host: '127.0.0.1',
  port: 3000,
  publicOrigin: '',
  sessionSecret: 'test-secret',
  httpsEnabled: false,
  tlsKeyPath: '',
  tlsCertPath: '',
  httpRedirectPort: 0,
  webDistDir: '',
  trustProxy: false,
  bodyLimitBytes: 262144,
  requestTimeoutMs: 65000,
  headersTimeoutMs: 20000,
  connectionTimeoutMs: 30000,
  keepAliveTimeoutMs: 65000,
  aiBodyLimitBytes: 131072,
  aiConnectTimeoutMs: 30000,
  aiTotalTimeoutMs: 60000,
  aiMaxResponseBytes: 1048576,
  aiMaxInflightPerSession: 1,
  aiMaxInflightGlobal: 20,
  aiRateLimitPerMin: 10,
  sessionTtlMs: 7 * 24 * 60 * 60 * 1000,
  sqliteFile: '',
  roomTtlMs: 24 * 60 * 60 * 1000,
  roomJoinTtlMs: 10 * 60 * 1000,
  roomCleanupIntervalMs: 60 * 1000,
  roomCreateRateLimitPerHour: 10,
  roomJoinRateLimitPerMin: 30,
  roomHostRateLimitPerMin: 120,
  wsMaxPayloadBytes: 65536,
  version: '0.1.0',
};

describe('session', () => {
  it('生成 48 位十六进制会话 ID 且不重复', () => {
    const first = createSessionId();
    const second = createSessionId();
    expect(first).toMatch(/^[a-f0-9]{48}$/);
    expect(second).not.toBe(first);
  });

  it('CSRF token 由会话与密钥确定生成', () => {
    const token = csrfTokenFor('secret-a', 'session-1');
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(token).toBe(csrfTokenFor('secret-a', 'session-1'));
    expect(token).not.toBe(csrfTokenFor('secret-b', 'session-1'));
    expect(token).not.toBe(csrfTokenFor('secret-a', 'session-2'));
  });

  it('CSRF 校验使用定长比较', () => {
    const token = csrfTokenFor('secret-a', 'session-1');
    expect(verifyCsrf('secret-a', 'session-1', token)).toBe(true);
    expect(verifyCsrf('secret-a', 'session-1', undefined)).toBe(false);
    expect(verifyCsrf('secret-a', 'session-1', '')).toBe(false);
    expect(verifyCsrf('secret-a', 'session-1', token.slice(0, 32))).toBe(false);
    expect(verifyCsrf('secret-a', 'session-1', `${token}0`)).toBe(false);
    expect(verifyCsrf('secret-a', 'session-2', token)).toBe(false);
  });

  it('开发环境 Cookie 为 httpOnly + SameSite=Lax 且不带 Secure', () => {
    const options = sessionCookieOptions(baseConfig);
    expect(options).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/', secure: false });
    expect(options.maxAge).toBe(7 * 24 * 60 * 60);
  });

  it('生产环境或启用 HTTPS 时 Cookie 带 Secure', () => {
    expect(sessionCookieOptions({ ...baseConfig, nodeEnv: 'production' }).secure).toBe(true);
    expect(sessionCookieOptions({ ...baseConfig, httpsEnabled: true }).secure).toBe(true);
  });

  it('签名 Cookie 可验签读取会话', () => {
    const sessionId = createSessionId();
    const value = sessionCookieValue('test-secret', sessionId);
    expect(readSessionId({ lrs_anon: value }, 'test-secret')).toBe(sessionId);
    expect(readSessionId({}, 'test-secret')).toBeUndefined();
  });

  it('未签名、篡改或换密钥的 Cookie 视为无会话', () => {
    const sessionId = createSessionId();
    const value = sessionCookieValue('test-secret', sessionId);
    expect(readSessionId({ lrs_anon: sessionId }, 'test-secret')).toBeUndefined();
    expect(readSessionId({ lrs_anon: `${value}0` }, 'test-secret')).toBeUndefined();
    expect(
      readSessionId({ lrs_anon: value.replace(sessionId, createSessionId()) }, 'test-secret'),
    ).toBeUndefined();
    expect(readSessionId({ lrs_anon: value }, 'other-secret')).toBeUndefined();
  });

  it('解析 Socket.IO 握手的 Cookie 头', () => {
    expect(parseCookieHeader('lrs_anon=abc; theme=dark')).toEqual({
      lrs_anon: 'abc',
      theme: 'dark',
    });
    expect(parseCookieHeader(undefined)).toEqual({});
  });
});
