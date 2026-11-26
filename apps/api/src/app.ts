import { existsSync } from 'node:fs';
import { createServer as createHttpsServer } from 'node:https';
import { join, sep } from 'node:path';

import fastifyCompress from '@fastify/compress';
import fastifyCookie from '@fastify/cookie';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import {
  CSRF_HEADER,
  HOST_TOKEN_HEADER,
  SESSION_COOKIE_NAME,
  aiRelayRequestSchema,
  type AiRelayResponse,
  type HealthResponse,
  type SessionResponse,
} from '@lrs/shared';
import Fastify, {
  type FastifyError,
  type FastifyInstance,
  type FastifyRequest,
  type FastifyServerFactory,
} from 'fastify';
import { ZodError } from 'zod';

import {
  mapUpstreamError,
  mapUpstreamResponse,
  requestUpstream,
  type UpstreamRequester,
} from './ai-relay.js';
import { loadConfig, type AppConfig } from './config.js';
import { openDatabase } from './db/index.js';
import { ApiError } from './errors.js';
import { createRealtime, type RealtimeHandle } from './realtime.js';
import { registerRoomRoutes } from './room-routes.js';
import { RoomService } from './rooms.js';
import {
  csrfTokenFor,
  createSessionId,
  readSessionId,
  sessionCookieOptions,
  sessionCookieValue,
  verifyCsrfRequest,
} from './session.js';
import { defaultLookup, validateTargetUrl, type LookupFn } from './ssrf.js';

export interface BuildAppOptions {
  readonly config?: Partial<AppConfig>;
  readonly lookup?: LookupFn;
  readonly requestUpstream?: UpstreamRequester;
  readonly https?: { readonly key: Buffer | string; readonly cert: Buffer | string };
}

class RelayConcurrency {
  private globalCount = 0;

  private readonly sessions = new Map<string, number>();

  constructor(
    private readonly maxPerSession: number,
    private readonly maxGlobal: number,
  ) {}

  tryAcquire(sessionId: string): boolean {
    if (this.globalCount >= this.maxGlobal) return false;
    const current = this.sessions.get(sessionId) ?? 0;
    if (current >= this.maxPerSession) return false;
    this.sessions.set(sessionId, current + 1);
    this.globalCount += 1;
    return true;
  }

  release(sessionId: string): void {
    const current = this.sessions.get(sessionId) ?? 0;
    if (current <= 1) this.sessions.delete(sessionId);
    else this.sessions.set(sessionId, current - 1);
    this.globalCount = Math.max(0, this.globalCount - 1);
  }
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const config: AppConfig = { ...loadConfig(), ...options.config };
  const lookup = options.lookup ?? defaultLookup;
  const requester = options.requestUpstream ?? requestUpstream;
  const concurrency = new RelayConcurrency(
    config.aiMaxInflightPerSession,
    config.aiMaxInflightGlobal,
  );

  const serverOptions = {
    logger:
      config.nodeEnv === 'test'
        ? false
        : {
            level: 'info',
            redact: [
              'req.headers.cookie',
              `req.headers["${CSRF_HEADER}"]`,
              `req.headers["${HOST_TOKEN_HEADER}"]`,
            ],
          },
    bodyLimit: config.bodyLimitBytes,
    requestTimeout: config.requestTimeoutMs,
    connectionTimeout: config.connectionTimeoutMs,
    keepAliveTimeout: config.keepAliveTimeoutMs,
    trustProxy: config.trustProxy,
  };
  const app = Fastify({
    ...serverOptions,
    ...(options.https
      ? {
          serverFactory: ((handler) =>
            createHttpsServer(options.https!, handler)) as FastifyServerFactory,
        }
      : {}),
  });
  app.server.headersTimeout = config.headersTimeoutMs;

  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error instanceof ApiError) {
      if (error.headers) reply.headers(error.headers);
      return reply.code(error.status).send({
        error: {
          code: error.code,
          message: error.message,
          ...(error.details === undefined ? {} : { details: error.details }),
        },
      });
    }

    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: { code: 'INVALID_REQUEST', message: '请求参数有误' },
      });
    }

    const statusCode = error.statusCode ?? 500;
    if (statusCode === 413) {
      return reply.code(413).send({
        error: { code: 'INVALID_REQUEST', message: '请求体过大' },
      });
    }
    if (statusCode === 429) {
      return reply.code(429).send({
        error: { code: 'RATE_LIMITED', message: '请求过于频繁，请稍后再试' },
      });
    }
    if (statusCode >= 400 && statusCode < 500) {
      return reply.code(statusCode).send({
        error: { code: 'INVALID_REQUEST', message: '请求格式不正确' },
      });
    }

    request.log.error({ err: { name: error.name, code: error.code } }, 'request failed');
    return reply.code(500).send({
      error: { code: 'INTERNAL', message: '服务器内部错误' },
    });
  });

  await app.register(fastifyCookie);
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: config.httpsEnabled ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: config.httpsEnabled ? undefined : false,
  });
  await app.register(fastifyCompress, { global: true, threshold: 1024 });
  await app.register(fastifyRateLimit, { global: false });

  if (config.sqliteFile) {
    const opened = openDatabase(config.sqliteFile);
    const roomService = new RoomService({
      db: opened.db,
      roomTtlMs: config.roomTtlMs,
      joinTtlMs: config.roomJoinTtlMs,
    });
    registerRoomRoutes(app, { service: roomService, config });
    const realtime: RealtimeHandle = createRealtime(app, { service: roomService, config });
    roomService.setNotifier(realtime.notifier);
    app.decorate('roomService', roomService);

    const cleanupTimer = setInterval(() => {
      try {
        roomService.cleanupExpired();
      } catch (error) {
        app.log.error({ err: error }, 'room cleanup failed');
      }
    }, config.roomCleanupIntervalMs);
    cleanupTimer.unref();

    app.addHook('preClose', async () => {
      realtime.disconnect();
    });
    app.addHook('onClose', async () => {
      clearInterval(cleanupTimer);
      opened.close();
    });
  }

  app.get('/api/v1/health', async (): Promise<HealthResponse> => ({
    ok: true,
    version: config.version,
  }));

  app.get('/api/v1/session', async (request, reply): Promise<SessionResponse> => {
    const existing = readSessionId(request.cookies, config.sessionSecret);
    const sessionId = existing ?? createSessionId();
    if (!existing) {
      reply.setCookie(
        SESSION_COOKIE_NAME,
        sessionCookieValue(config.sessionSecret, sessionId),
        sessionCookieOptions(config),
      );
    }
    return {
      csrfToken: csrfTokenFor(config.sessionSecret, sessionId),
      expiresAt: Date.now() + config.sessionTtlMs,
    };
  });

  const requireCsrf = async (request: FastifyRequest): Promise<void> => {
    verifyCsrfRequest(request, config);
  };

  app.post(
    '/api/v1/ai/relay',
    {
      bodyLimit: config.aiBodyLimitBytes,
      config: {
        rateLimit: {
          max: config.aiRateLimitPerMin,
          timeWindow: '1 minute',
          keyGenerator: (request) =>
            readSessionId(request.cookies, config.sessionSecret) ?? request.ip,
        },
      },
      preHandler: requireCsrf,
    },
    async (request, reply): Promise<AiRelayResponse> => {
      const parsed = aiRelayRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ApiError(
          'INVALID_REQUEST',
          400,
          '请求参数有误',
          parsed.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        );
      }

      const sessionId = readSessionId(request.cookies, config.sessionSecret);
      if (!sessionId) {
        throw new ApiError('UNAUTHORIZED', 401, '缺少会话，请刷新页面后重试');
      }

      if (!concurrency.tryAcquire(sessionId)) {
        throw new ApiError('RATE_LIMITED', 429, '已有 AI 请求在处理，请稍后再试', undefined, {
          'retry-after': '1',
        });
      }

      try {
        const target = await validateTargetUrl(parsed.data.baseUrl, lookup);
        try {
          const upstream = await requester({
            target,
            apiKey: parsed.data.apiKey,
            body: {
              model: parsed.data.model,
              messages: parsed.data.messages,
              temperature: parsed.data.temperature,
              max_tokens: parsed.data.maxTokens,
            },
            connectTimeoutMs: config.aiConnectTimeoutMs,
            totalTimeoutMs: config.aiTotalTimeoutMs,
            maxResponseBytes: config.aiMaxResponseBytes,
          });
          const result = mapUpstreamResponse(upstream);
          return reply.send(result);
        } catch (error) {
          throw mapUpstreamError(error);
        }
      } finally {
        concurrency.release(sessionId);
      }
    },
  );

  const indexFile = join(config.webDistDir, 'index.html');
  const staticEnabled = existsSync(indexFile);
  if (staticEnabled) {
    await app.register(fastifyStatic, {
      root: config.webDistDir,
      prefix: '/',
      index: ['index.html'],
      setHeaders: (reply, filePath) => {
        if (filePath.includes(`${sep}assets${sep}`)) {
          reply.header('cache-control', 'public, max-age=31536000, immutable');
        } else {
          reply.header('cache-control', 'no-cache');
        }
      },
    });
  }

  app.setNotFoundHandler((request, reply) => {
    const pathname = request.url.split('?')[0] ?? '';
    const isApi =
      pathname === '/api' ||
      pathname.startsWith('/api/') ||
      pathname.startsWith('/socket.io') ||
      pathname.startsWith('/ws/');
    const hasExtension = /\.[a-z0-9]+$/i.test(pathname);

    if (staticEnabled && request.method === 'GET' && !isApi && !hasExtension) {
      return reply.type('text/html').sendFile('index.html');
    }

    return reply
      .code(404)
      .type('application/json')
      .send({
        error: { code: 'NOT_FOUND', message: '资源不存在' },
      });
  });

  return app;
}

declare module 'fastify' {
  interface FastifyInstance {
    /** 仅在配置 SQLITE_FILE 时存在；P0 单机模式不启用。 */
    roomService?: RoomService;
  }
}
