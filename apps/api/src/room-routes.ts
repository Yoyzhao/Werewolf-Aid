import {
  HOST_TOKEN_HEADER,
  IDEMPOTENCY_HEADER,
  confirmSeatRequestSchema,
  createRoomRequestSchema,
  joinRoomRequestSchema,
  recoverRoomRequestSchema,
  roomCodeSchema,
  seatStatusResponseSchema,
  settleRoomRequestSchema,
  snapshotRequestSchema,
  unbindSeatRequestSchema,
  type CreateRoomResponse,
  type RoomSummary,
} from '@lrs/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodType } from 'zod';

import type { AppConfig } from './config.js';
import { ApiError } from './errors.js';
import { IdempotencyStore } from './idempotency.js';
import type { RoomService } from './rooms.js';
import { readSessionId, requireSessionId, verifyCsrfRequest } from './session.js';

export interface RoomRoutesOptions {
  readonly service: RoomService;
  readonly config: AppConfig;
  readonly idempotency?: IdempotencyStore;
}

function parse<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ApiError(
      'INVALID_REQUEST',
      400,
      '请求参数有误',
      result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    );
  }
  return result.data;
}

function readHostToken(request: FastifyRequest): string {
  const header = request.headers[HOST_TOKEN_HEADER];
  const token = Array.isArray(header) ? header[0] : header;
  if (!token) throw new ApiError('FORBIDDEN', 403, '缺少主持令牌');
  return token;
}

function readIdempotencyKey(request: FastifyRequest): string | undefined {
  const header = request.headers[IDEMPOTENCY_HEADER];
  const value = Array.isArray(header) ? header[0] : header;
  if (!value) return undefined;
  const key = value.trim();
  if (!key || key.length > 128) {
    throw new ApiError('INVALID_REQUEST', 400, '幂等键长度不合法');
  }
  return key;
}

export function registerRoomRoutes(app: FastifyInstance, options: RoomRoutesOptions): void {
  const { service, config } = options;
  const idempotency = options.idempotency ?? new IdempotencyStore();
  const csrfGuard = async (request: FastifyRequest): Promise<void> => {
    verifyCsrfRequest(request, config);
  };
  const sessionKey = (request: FastifyRequest): string =>
    readSessionId(request.cookies, config.sessionSecret) ?? request.ip;
  const hostRateLimit = {
    max: config.roomHostRateLimitPerMin,
    timeWindow: '1 minute',
    keyGenerator: sessionKey,
  };

  app.post(
    '/api/v1/rooms',
    {
      preHandler: csrfGuard,
      config: {
        rateLimit: {
          max: config.roomCreateRateLimitPerHour,
          timeWindow: '1 hour',
          keyGenerator: sessionKey,
        },
      },
    },
    async (request, reply): Promise<CreateRoomResponse> => {
      const sessionId = requireSessionId(request, config);
      const body = parse(createRoomRequestSchema, request.body ?? {});
      const key = readIdempotencyKey(request);
      const cacheKey = key === undefined ? undefined : `create:${sessionId}:${key}`;

      const cached =
        cacheKey === undefined ? undefined : idempotency.get<CreateRoomResponse>(cacheKey);
      if (cached !== undefined) return reply.code(201).send(cached);

      const created = service.createRoom(body.boardId, sessionId);
      if (cacheKey !== undefined) idempotency.set(cacheKey, created);
      return reply.code(201).send(created);
    },
  );

  app.post(
    '/api/v1/rooms/recover',
    { preHandler: csrfGuard, config: { rateLimit: hostRateLimit } },
    async (request): Promise<RoomSummary> => {
      const sessionId = requireSessionId(request, config);
      const body = parse(recoverRoomRequestSchema, request.body);
      return service.recoverRoom(body.code, body.hostToken, sessionId);
    },
  );

  app.post<{ Params: { code: string } }>(
    '/api/v1/rooms/:code/join',
    {
      preHandler: csrfGuard,
      config: {
        rateLimit: {
          max: config.roomJoinRateLimitPerMin,
          timeWindow: '1 minute',
          keyGenerator: sessionKey,
        },
      },
    },
    async (request) => {
      const sessionId = requireSessionId(request, config);
      const code = parse(roomCodeSchema, request.params.code);
      const body = parse(joinRoomRequestSchema, request.body);
      return service.joinRoom(code, body.seatNo, sessionId);
    },
  );

  app.post<{ Params: { code: string } }>(
    '/api/v1/rooms/:code/leave',
    {
      preHandler: csrfGuard,
      config: {
        rateLimit: {
          max: config.roomJoinRateLimitPerMin,
          timeWindow: '1 minute',
          keyGenerator: sessionKey,
        },
      },
    },
    async (request) => {
      const sessionId = requireSessionId(request, config);
      const code = parse(roomCodeSchema, request.params.code);
      return service.cancelApplication(code, sessionId);
    },
  );

  app.post<{ Params: { code: string } }>(
    '/api/v1/rooms/:code/confirm',
    { preHandler: csrfGuard, config: { rateLimit: hostRateLimit } },
    async (request) => {
      requireSessionId(request, config);
      const code = parse(roomCodeSchema, request.params.code);
      const body = parse(confirmSeatRequestSchema, request.body);
      const hostToken = readHostToken(request);
      const key = readIdempotencyKey(request);
      const cacheKey = key === undefined ? undefined : `confirm:${code}:${key}`;

      const cached =
        cacheKey === undefined ? undefined : idempotency.get<{ status: 'bound' }>(cacheKey);
      if (cached !== undefined) return cached;

      service.requireHost(code, hostToken);
      const result = service.confirmSeat(code, body.seatNo, body.applicantId);
      if (cacheKey !== undefined) idempotency.set(cacheKey, result);
      return result;
    },
  );

  app.post<{ Params: { code: string } }>(
    '/api/v1/rooms/:code/unbind',
    { preHandler: csrfGuard, config: { rateLimit: hostRateLimit } },
    async (request) => {
      requireSessionId(request, config);
      const code = parse(roomCodeSchema, request.params.code);
      const body = parse(unbindSeatRequestSchema, request.body);
      service.requireHost(code, readHostToken(request));
      return seatStatusResponseSchema.parse(service.unbindSeat(code, body.seatNo));
    },
  );

  app.get<{ Params: { code: string } }>(
    '/api/v1/rooms/:code',
    async (request): Promise<RoomSummary> => {
      const code = parse(roomCodeSchema, request.params.code);
      return service.getSummary(code, readHostToken(request));
    },
  );

  app.get<{ Params: { code: string } }>(
    '/api/v1/rooms/:code/public',
    {
      config: {
        rateLimit: {
          max: config.roomJoinRateLimitPerMin,
          timeWindow: '1 minute',
          keyGenerator: (request) => request.ip,
        },
      },
    },
    async (request) => {
      const code = parse(roomCodeSchema, request.params.code);
      return service.getPublicInfo(code);
    },
  );

  app.get<{ Params: { code: string } }>('/api/v1/rooms/:code/view', async (request) => {
    const sessionId = requireSessionId(request, config);
    const code = parse(roomCodeSchema, request.params.code);
    return service.getPlayerView(code, sessionId);
  });

  app.put<{ Params: { code: string } }>(
    '/api/v1/rooms/:code/snapshot',
    { preHandler: csrfGuard, config: { rateLimit: hostRateLimit } },
    async (request) => {
      requireSessionId(request, config);
      const code = parse(roomCodeSchema, request.params.code);
      const body = parse(snapshotRequestSchema, request.body);
      return service.writeSnapshot(code, readHostToken(request), body);
    },
  );

  app.post<{ Params: { code: string } }>(
    '/api/v1/rooms/:code/settle',
    { preHandler: csrfGuard, config: { rateLimit: hostRateLimit } },
    async (request) => {
      requireSessionId(request, config);
      const code = parse(roomCodeSchema, request.params.code);
      parse(settleRoomRequestSchema, request.body);
      const key = readIdempotencyKey(request);
      const cacheKey = key === undefined ? undefined : `settle:${code}:${key}`;

      const cached =
        cacheKey === undefined ? undefined : idempotency.get<{ status: 'settled' }>(cacheKey);
      if (cached !== undefined) return cached;

      const result = service.settleRoom(code, readHostToken(request));
      if (cacheKey !== undefined) idempotency.set(cacheKey, result);
      return result;
    },
  );

  app.delete<{ Params: { code: string } }>(
    '/api/v1/rooms/:code',
    { preHandler: csrfGuard, config: { rateLimit: hostRateLimit } },
    async (request, reply) => {
      requireSessionId(request, config);
      const code = parse(roomCodeSchema, request.params.code);
      service.deleteRoom(code, readHostToken(request));
      return reply.code(204).send();
    },
  );
}
