import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface AppConfig {
  readonly nodeEnv: string;
  readonly host: string;
  readonly port: number;
  readonly publicOrigin: string;
  readonly sessionSecret: string;
  readonly httpsEnabled: boolean;
  readonly tlsKeyPath: string;
  readonly tlsCertPath: string;
  readonly httpRedirectPort: number;
  readonly webDistDir: string;
  readonly trustProxy: boolean;
  readonly bodyLimitBytes: number;
  readonly requestTimeoutMs: number;
  readonly headersTimeoutMs: number;
  readonly connectionTimeoutMs: number;
  readonly keepAliveTimeoutMs: number;
  readonly aiBodyLimitBytes: number;
  readonly aiConnectTimeoutMs: number;
  readonly aiTotalTimeoutMs: number;
  readonly aiMaxResponseBytes: number;
  readonly aiMaxInflightPerSession: number;
  readonly aiMaxInflightGlobal: number;
  readonly aiRateLimitPerMin: number;
  readonly sessionTtlMs: number;
  readonly sqliteFile: string;
  readonly roomTtlMs: number;
  readonly roomJoinTtlMs: number;
  readonly roomCleanupIntervalMs: number;
  readonly roomCreateRateLimitPerHour: number;
  readonly roomJoinRateLimitPerMin: number;
  readonly roomHostRateLimitPerMin: number;
  readonly wsMaxPayloadBytes: number;
  readonly version: string;
}

const DEFAULT_WEB_DIST = fileURLToPath(new URL('../../../apps/web/dist', import.meta.url));

function readInt(env: NodeJS.ProcessEnv, key: string, fallback: number): number {
  const raw = env[key];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : fallback;
}

function readBool(env: NodeJS.ProcessEnv, key: string, fallback: boolean): boolean {
  const raw = env[key];
  if (raw === undefined) return fallback;
  return raw === '1' || raw.toLowerCase() === 'true';
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const nodeEnv = env.NODE_ENV ?? 'development';
  const production = nodeEnv === 'production';
  const sessionSecret = env.SESSION_SECRET?.trim();
  if (!sessionSecret && production) {
    throw new Error('SESSION_SECRET 未配置，生产环境拒绝启动');
  }

  const httpsEnabled = readBool(env, 'HTTPS_ENABLED', false);
  const tlsKeyPath = env.TLS_KEY_PATH?.trim() ?? '';
  const tlsCertPath = env.TLS_CERT_PATH?.trim() ?? '';
  if (httpsEnabled && (!tlsKeyPath || !tlsCertPath)) {
    throw new Error('HTTPS_ENABLED=1 时必须配置 TLS_KEY_PATH 与 TLS_CERT_PATH');
  }

  return {
    nodeEnv,
    host: env.HOST ?? '0.0.0.0',
    port: readInt(env, 'PORT', 3000),
    publicOrigin: env.PUBLIC_ORIGIN?.trim() ?? '',
    sessionSecret: sessionSecret ?? randomBytes(32).toString('hex'),
    httpsEnabled,
    tlsKeyPath,
    tlsCertPath,
    httpRedirectPort: readInt(env, 'HTTP_REDIRECT_PORT', 0),
    webDistDir: resolve(env.WEB_DIST_DIR?.trim() || DEFAULT_WEB_DIST),
    trustProxy: readBool(env, 'TRUST_PROXY', false),
    bodyLimitBytes: readInt(env, 'BODY_LIMIT_BYTES', 262144),
    requestTimeoutMs: readInt(env, 'REQUEST_TIMEOUT_MS', 65000),
    headersTimeoutMs: readInt(env, 'HEADERS_TIMEOUT_MS', 20000),
    connectionTimeoutMs: readInt(env, 'CONNECTION_TIMEOUT_MS', 30000),
    keepAliveTimeoutMs: readInt(env, 'KEEP_ALIVE_TIMEOUT_MS', 65000),
    aiBodyLimitBytes: readInt(env, 'AI_BODY_LIMIT_BYTES', 131072),
    aiConnectTimeoutMs: readInt(env, 'AI_RELAY_CONNECT_TIMEOUT_MS', 30000),
    aiTotalTimeoutMs: readInt(env, 'AI_RELAY_TOTAL_TIMEOUT_MS', 60000),
    aiMaxResponseBytes: readInt(env, 'AI_RELAY_MAX_RESPONSE_BYTES', 1048576),
    aiMaxInflightPerSession: readInt(env, 'AI_MAX_INFLIGHT_PER_SESSION', 1),
    aiMaxInflightGlobal: readInt(env, 'AI_MAX_INFLIGHT_GLOBAL', 20),
    aiRateLimitPerMin: readInt(env, 'RATE_LIMIT_AI_PER_MIN', 10),
    sessionTtlMs: readInt(env, 'SESSION_TTL_MS', 7 * 24 * 60 * 60 * 1000),
    sqliteFile: env.SQLITE_FILE?.trim() ?? (nodeEnv === 'test' ? '' : 'data/lrs.sqlite'),
    roomTtlMs: readInt(env, 'ROOM_TTL_MS', 24 * 60 * 60 * 1000),
    roomJoinTtlMs: readInt(env, 'ROOM_JOIN_TTL_MS', 10 * 60 * 1000),
    roomCleanupIntervalMs: readInt(env, 'ROOM_CLEANUP_INTERVAL_MS', 60 * 1000),
    roomCreateRateLimitPerHour: readInt(env, 'RATE_LIMIT_ROOM_CREATE_PER_HOUR', 10),
    roomJoinRateLimitPerMin: readInt(env, 'RATE_LIMIT_ROOM_JOIN_PER_MIN', 30),
    roomHostRateLimitPerMin: readInt(env, 'RATE_LIMIT_ROOM_HOST_PER_MIN', 120),
    wsMaxPayloadBytes: readInt(env, 'WS_MAX_PAYLOAD_BYTES', 65536),
    version: env.APP_VERSION?.trim() || '0.1.0',
  };
}
