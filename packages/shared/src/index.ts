import { z } from 'zod';

export const API_VERSION = 'v1' as const;

export const SESSION_COOKIE_NAME = 'lrs_anon' as const;

export const CSRF_HEADER = 'x-csrf-token' as const;

export const HOST_TOKEN_HEADER = 'x-host-token' as const;

export const IDEMPOTENCY_HEADER = 'idempotency-key' as const;

export const ROOM_CODE_LENGTH = 6 as const;

export const roomCodeSchema = z
  .string()
  .regex(new RegExp(`^\\d{${ROOM_CODE_LENGTH}}$`), '配对码必须为 6 位数字');

export const seatNoSchema = z.number().int().min(1).max(12);

export const boardIdSchema = z.enum(['pre-witch-hunter-guard', 'pre-witch-hunter-idiot']);

export type BoardIdValue = z.infer<typeof boardIdSchema>;

export const roomStatusSchema = z.enum(['active', 'settled', 'closed']);

export type RoomStatus = z.infer<typeof roomStatusSchema>;

export const roomClosedReasonSchema = z.enum(['settled', 'deleted', 'expired']);

export type RoomClosedReason = z.infer<typeof roomClosedReasonSchema>;

export const createRoomRequestSchema = z.object({
  boardId: boardIdSchema.default('pre-witch-hunter-guard'),
});

export type CreateRoomRequest = z.infer<typeof createRoomRequestSchema>;

export const createRoomResponseSchema = z.object({
  roomId: z.string().min(1),
  code: roomCodeSchema,
  hostToken: z.string().min(1),
  boardId: boardIdSchema,
  joinExpiresAt: z.number().int().nonnegative(),
  expiresAt: z.number().int().nonnegative(),
});

export type CreateRoomResponse = z.infer<typeof createRoomResponseSchema>;

export const recoverRoomRequestSchema = z.object({
  code: roomCodeSchema,
  hostToken: z.string().min(1).max(256),
});

export const seatBindingSchema = z.object({
  seatNo: seatNoSchema,
  status: z.enum(['pending', 'bound']),
  applicantId: z.string().min(1),
  appliedAt: z.number().int().nonnegative(),
  boundAt: z.number().int().nonnegative().nullable(),
});

export type SeatBinding = z.infer<typeof seatBindingSchema>;

export const roomSummarySchema = z.object({
  roomId: z.string().min(1),
  code: roomCodeSchema,
  boardId: boardIdSchema,
  phase: z.string().min(1),
  status: roomStatusSchema,
  version: z.number().int().nonnegative(),
  expiresAt: z.number().int().nonnegative(),
  joinExpiresAt: z.number().int().nonnegative(),
  seats: z.array(seatBindingSchema),
});

export type RoomSummary = z.infer<typeof roomSummarySchema>;

export const publicRoomSchema = z.object({
  code: roomCodeSchema,
  boardId: boardIdSchema,
  phase: z.string().min(1),
  status: roomStatusSchema,
  joinExpiresAt: z.number().int().nonnegative(),
  expiresAt: z.number().int().nonnegative(),
});

export type PublicRoom = z.infer<typeof publicRoomSchema>;

export const leaveRoomResponseSchema = z.object({
  status: z.literal('cancelled'),
});

export const joinRoomRequestSchema = z.object({
  seatNo: seatNoSchema,
});

export const joinRoomResponseSchema = z.object({
  status: z.enum(['pending', 'bound']),
  applicantId: z.string().min(1),
});

export type JoinRoomResponse = z.infer<typeof joinRoomResponseSchema>;

export const confirmSeatRequestSchema = z.object({
  seatNo: seatNoSchema,
  applicantId: z.string().min(1).max(64),
});

export const unbindSeatRequestSchema = z.object({
  seatNo: seatNoSchema,
});

export const seatStatusResponseSchema = z.object({
  status: z.enum(['bound', 'unbound']),
});

export const snapshotRequestSchema = z.object({
  version: z.number().int().positive(),
  phase: z.string().min(1).max(32),
  gameState: z.unknown(),
});

export type SnapshotRequest = z.infer<typeof snapshotRequestSchema>;

export const snapshotResponseSchema = z.object({
  version: z.number().int().positive(),
});

export const settleRoomRequestSchema = z.object({
  winner: z.enum(['GOOD', 'WOLVES']),
  reason: z.string().max(500).optional(),
});

export const settleRoomResponseSchema = z.object({
  status: z.literal('settled'),
});

export const playerViewEnvelopeSchema = z.object({
  version: z.number().int().nonnegative(),
  phase: z.string().min(1),
  view: z.unknown().nullable(),
});

export type PlayerViewEnvelope = z.infer<typeof playerViewEnvelopeSchema>;

export const roomViewEventSchema = z.object({
  type: z.literal('room.view'),
  version: z.number().int().nonnegative(),
  phase: z.string().min(1),
  view: z.unknown(),
});

export type RoomViewEvent = z.infer<typeof roomViewEventSchema>;

export const roomClosedEventSchema = z.object({
  type: z.literal('room.closed'),
  reason: roomClosedReasonSchema,
});

export type RoomClosedEvent = z.infer<typeof roomClosedEventSchema>;

export const roomErrorEventSchema = z.object({
  type: z.literal('room.error'),
  code: z.string().min(1),
  message: z.string().min(1),
});

export type RoomErrorEvent = z.infer<typeof roomErrorEventSchema>;

export const healthResponseSchema = z.object({
  ok: z.literal(true),
  version: z.string().min(1),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const sessionResponseSchema = z.object({
  csrfToken: z.string().min(1),
  expiresAt: z.number().int().nonnegative(),
});

export type SessionResponse = z.infer<typeof sessionResponseSchema>;

export const aiRoleSchema = z.enum(['system', 'user', 'assistant']);

export const aiMessageSchema = z.object({
  role: aiRoleSchema,
  content: z.string().min(1).max(20000),
});

export const aiRelayRequestSchema = z.object({
  baseUrl: z.string().url(),
  apiKey: z.string().min(1).max(4096),
  model: z.string().min(1).max(200),
  messages: z.array(aiMessageSchema).min(1).max(50),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().int().min(100).max(2000).default(800),
});

export type AiRelayRequest = z.infer<typeof aiRelayRequestSchema>;

export const aiUsageSchema = z.object({
  promptTokens: z.number().int().nonnegative(),
  completionTokens: z.number().int().nonnegative(),
});

export const aiRelayResponseSchema = z.object({
  ok: z.literal(true),
  content: z.string().min(1),
  usage: aiUsageSchema.optional(),
});

export type AiRelayResponse = z.infer<typeof aiRelayResponseSchema>;

export const apiErrorCodeSchema = z.enum([
  'INVALID_REQUEST',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'STALE_VERSION',
  'INVALID_STATE',
  'RATE_LIMITED',
  'TIMEOUT',
  'UPSTREAM_4XX',
  'UPSTREAM_5XX',
  'KEY_INVALID',
  'QUOTA',
  'URL_NOT_ALLOWED',
  'NETWORK',
  'INTERNAL',
]);

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

export const apiErrorSchema = z.object({
  error: z.object({
    code: apiErrorCodeSchema,
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

export type ApiErrorBody = z.infer<typeof apiErrorSchema>;
