// @vitest-environment node
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadConfig } from './config.js';

describe('loadConfig', () => {
  it('生产环境缺少 SESSION_SECRET 拒绝启动', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(/SESSION_SECRET/);
  });

  it('生产环境带 SESSION_SECRET 正常加载', () => {
    const config = loadConfig({ NODE_ENV: 'production', SESSION_SECRET: 'prod-secret' });
    expect(config.sessionSecret).toBe('prod-secret');
    expect(config.nodeEnv).toBe('production');
  });

  it('开发环境自动生成随机密钥', () => {
    const first = loadConfig({ NODE_ENV: 'development' });
    const second = loadConfig({ NODE_ENV: 'development' });
    expect(first.sessionSecret).toMatch(/^[a-f0-9]{64}$/);
    expect(second.sessionSecret).not.toBe(first.sessionSecret);
  });

  it('读取 TRUST_PROXY、端口、请求限制与 AI 边界', () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      SESSION_SECRET: 'test-secret',
      HOST: '127.0.0.1',
      PORT: '8080',
      TRUST_PROXY: 'true',
      BODY_LIMIT_BYTES: '1024',
      REQUEST_TIMEOUT_MS: '7000',
      HEADERS_TIMEOUT_MS: '3000',
      CONNECTION_TIMEOUT_MS: '4000',
      KEEP_ALIVE_TIMEOUT_MS: '5000',
      AI_BODY_LIMIT_BYTES: '2048',
      AI_RELAY_CONNECT_TIMEOUT_MS: '6000',
      AI_RELAY_TOTAL_TIMEOUT_MS: '9000',
      AI_RELAY_MAX_RESPONSE_BYTES: '4096',
      AI_MAX_INFLIGHT_PER_SESSION: '2',
      AI_MAX_INFLIGHT_GLOBAL: '4',
      RATE_LIMIT_AI_PER_MIN: '3',
      SESSION_TTL_MS: '60000',
      WEB_DIST_DIR: 'relative/dist',
      APP_VERSION: '9.9.9',
      HTTPS_ENABLED: '1',
      TLS_KEY_PATH: 'certs/key.pem',
      TLS_CERT_PATH: 'certs/cert.pem',
      HTTP_REDIRECT_PORT: '80',
    });

    expect(config).toMatchObject({
      host: '127.0.0.1',
      port: 8080,
      trustProxy: true,
      bodyLimitBytes: 1024,
      requestTimeoutMs: 7000,
      headersTimeoutMs: 3000,
      connectionTimeoutMs: 4000,
      keepAliveTimeoutMs: 5000,
      aiBodyLimitBytes: 2048,
      aiConnectTimeoutMs: 6000,
      aiTotalTimeoutMs: 9000,
      aiMaxResponseBytes: 4096,
      aiMaxInflightPerSession: 2,
      aiMaxInflightGlobal: 4,
      aiRateLimitPerMin: 3,
      sessionTtlMs: 60000,
      version: '9.9.9',
      httpsEnabled: true,
      tlsKeyPath: 'certs/key.pem',
      tlsCertPath: 'certs/cert.pem',
      httpRedirectPort: 80,
    });
    expect(config.webDistDir).toBe(resolve('relative/dist'));
    expect(config.webDistDir).not.toBe('relative/dist');
  });

  it('HTTPS 开启但缺少证书路径时拒绝启动', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'test',
        SESSION_SECRET: 'test-secret',
        HTTPS_ENABLED: '1',
        TLS_KEY_PATH: 'certs/key.pem',
      }),
    ).toThrow(/TLS_KEY_PATH/);
  });

  it('非法数值回退默认值', () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      SESSION_SECRET: 'test-secret',
      PORT: '0',
      BODY_LIMIT_BYTES: 'abc',
      AI_BODY_LIMIT_BYTES: '-1',
      RATE_LIMIT_AI_PER_MIN: 'NaN',
    });
    expect(config.port).toBe(3000);
    expect(config.bodyLimitBytes).toBe(262144);
    expect(config.aiBodyLimitBytes).toBe(131072);
    expect(config.aiRateLimitPerMin).toBe(10);
  });
});
