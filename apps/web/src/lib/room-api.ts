import type { GameState, PlayerView } from '@lrs/game-engine';
import {
  CSRF_HEADER,
  HOST_TOKEN_HEADER,
  type CreateRoomResponse,
  type JoinRoomResponse,
  type PublicRoom,
  type RoomSummary,
  type SessionResponse,
} from '@lrs/shared';

const API_BASE = '/api/v1';
const SESSION_PATH = `${API_BASE}/session`;
const ROOMS_PATH = `${API_BASE}/rooms`;

export type RoomFailureCode =
  | 'INVALID_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'STALE_VERSION'
  | 'INVALID_STATE'
  | 'RATE_LIMITED'
  | 'NETWORK'
  | 'INTERNAL';

export const ROOM_ERROR_MESSAGES: Record<RoomFailureCode, string> = {
  INVALID_REQUEST: '请求参数有误，请刷新后重试',
  UNAUTHORIZED: '会话已失效，请刷新页面后重试',
  FORBIDDEN: '没有权限执行该操作',
  NOT_FOUND: '房间不存在或已结束',
  CONFLICT: '操作冲突，请刷新后重试',
  STALE_VERSION: '快照版本过期，正在补齐',
  INVALID_STATE: '当前状态不允许该操作',
  RATE_LIMITED: '请求过于频繁，请稍后再试',
  NETWORK: '网络不可用，请检查网络后重试',
  INTERNAL: '服务器内部错误，请稍后重试',
};

const ROOM_FAILURE_CODES = new Set<RoomFailureCode>([
  'INVALID_REQUEST',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'STALE_VERSION',
  'INVALID_STATE',
  'RATE_LIMITED',
  'NETWORK',
  'INTERNAL',
]);

export class RoomApiError extends Error {
  readonly code: RoomFailureCode;

  readonly status: number;

  readonly details?: unknown;

  constructor(code: RoomFailureCode, status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'RoomApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

let csrfToken: string | null = null;
let sessionPromise: Promise<string> | null = null;

async function readSession(fetchImpl: typeof fetch): Promise<string> {
  const response = await fetchImpl(SESSION_PATH, {
    credentials: 'same-origin',
    headers: { accept: 'application/json' },
  });
  if (!response.ok) throw new RoomApiError('NETWORK', response.status, ROOM_ERROR_MESSAGES.NETWORK);
  const data = (await response.json()) as Partial<SessionResponse>;
  if (typeof data.csrfToken !== 'string' || !data.csrfToken) {
    throw new RoomApiError('NETWORK', response.status, ROOM_ERROR_MESSAGES.NETWORK);
  }
  return data.csrfToken;
}

async function ensureSession(fetchImpl: typeof fetch): Promise<string> {
  if (csrfToken) return csrfToken;
  if (!sessionPromise) {
    sessionPromise = readSession(fetchImpl)
      .then((token) => {
        csrfToken = token;
        return token;
      })
      .finally(() => {
        sessionPromise = null;
      });
  }
  return sessionPromise;
}

export function resetRoomSession(): void {
  csrfToken = null;
  sessionPromise = null;
}

function statusToCode(status: number): RoomFailureCode {
  if (status === 400) return 'INVALID_REQUEST';
  if (status === 401) return 'UNAUTHORIZED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status === 422) return 'INVALID_STATE';
  if (status === 429) return 'RATE_LIMITED';
  if (status >= 500) return 'INTERNAL';
  return 'NETWORK';
}

async function errorFromResponse(response: Response): Promise<RoomApiError> {
  let code: unknown;
  let message: unknown;
  let details: unknown;
  try {
    const data = (await response.json()) as {
      error?: { code?: unknown; message?: unknown; details?: unknown };
    };
    code = data.error?.code;
    message = data.error?.message;
    details = data.error?.details;
  } catch {
    code = undefined;
  }

  const fallback = statusToCode(response.status);
  const finalCode: RoomFailureCode =
    typeof code === 'string' && ROOM_FAILURE_CODES.has(code as RoomFailureCode)
      ? (code as RoomFailureCode)
      : fallback;
  return new RoomApiError(
    finalCode,
    response.status,
    typeof message === 'string' && message ? message : ROOM_ERROR_MESSAGES[finalCode],
    details,
  );
}

interface RequestOptions {
  readonly method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  readonly body?: unknown;
  readonly headers?: Readonly<Record<string, string>>;
  readonly fetchImpl?: typeof fetch;
  readonly signal?: AbortSignal;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const send = async (token: string): Promise<Response> =>
    fetchImpl(path, {
      method: options.method ?? 'GET',
      credentials: 'same-origin',
      headers: {
        accept: 'application/json',
        ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
        [CSRF_HEADER]: token,
        ...options.headers,
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });

  let token = await ensureSession(fetchImpl);
  let response = await send(token);
  if (response.status === 401 || response.status === 403) {
    resetRoomSession();
    token = await ensureSession(fetchImpl);
    response = await send(token);
  }

  if (!response.ok) throw await errorFromResponse(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function createRoom(boardId: string, fetchImpl?: typeof fetch): Promise<CreateRoomResponse> {
  return request(`${ROOMS_PATH}`, {
    method: 'POST',
    body: { boardId },
    fetchImpl,
  });
}

export function recoverRoom(
  code: string,
  hostToken: string,
  fetchImpl?: typeof fetch,
): Promise<RoomSummary> {
  return request(`${ROOMS_PATH}/recover`, {
    method: 'POST',
    body: { code, hostToken },
    fetchImpl,
  });
}

export function getRoomSummary(
  code: string,
  hostToken: string,
  fetchImpl?: typeof fetch,
): Promise<RoomSummary> {
  return request(`${ROOMS_PATH}/${encodeURIComponent(code)}`, {
    headers: { [HOST_TOKEN_HEADER]: hostToken },
    fetchImpl,
  });
}

export function getPublicRoom(code: string, fetchImpl?: typeof fetch): Promise<PublicRoom> {
  return request(`${ROOMS_PATH}/${encodeURIComponent(code)}/public`, { fetchImpl });
}

export function joinRoom(
  code: string,
  seatNo: number,
  fetchImpl?: typeof fetch,
): Promise<JoinRoomResponse> {
  return request(`${ROOMS_PATH}/${encodeURIComponent(code)}/join`, {
    method: 'POST',
    body: { seatNo },
    fetchImpl,
  });
}

export function leaveRoom(
  code: string,
  fetchImpl?: typeof fetch,
): Promise<{ status: 'cancelled' }> {
  return request(`${ROOMS_PATH}/${encodeURIComponent(code)}/leave`, {
    method: 'POST',
    fetchImpl,
  });
}

export function confirmSeat(
  code: string,
  hostToken: string,
  seatNo: number,
  applicantId: string,
  fetchImpl?: typeof fetch,
): Promise<{ status: 'bound' }> {
  return request(`${ROOMS_PATH}/${encodeURIComponent(code)}/confirm`, {
    method: 'POST',
    headers: { [HOST_TOKEN_HEADER]: hostToken },
    body: { seatNo, applicantId },
    fetchImpl,
  });
}

export function unbindSeat(
  code: string,
  hostToken: string,
  seatNo: number,
  fetchImpl?: typeof fetch,
): Promise<{ status: 'unbound' }> {
  return request(`${ROOMS_PATH}/${encodeURIComponent(code)}/unbind`, {
    method: 'POST',
    headers: { [HOST_TOKEN_HEADER]: hostToken },
    body: { seatNo },
    fetchImpl,
  });
}

export function writeRoomSnapshot(
  code: string,
  hostToken: string,
  version: number,
  gameState: GameState,
  fetchImpl?: typeof fetch,
): Promise<{ version: number }> {
  return request(`${ROOMS_PATH}/${encodeURIComponent(code)}/snapshot`, {
    method: 'PUT',
    headers: { [HOST_TOKEN_HEADER]: hostToken },
    body: { version, phase: gameState.phase, gameState },
    fetchImpl,
  });
}

export function settleRoom(
  code: string,
  hostToken: string,
  winner: 'GOOD' | 'WOLVES',
  reason?: string,
  fetchImpl?: typeof fetch,
): Promise<{ status: 'settled' }> {
  return request(`${ROOMS_PATH}/${encodeURIComponent(code)}/settle`, {
    method: 'POST',
    headers: { [HOST_TOKEN_HEADER]: hostToken },
    body: { winner, ...(reason === undefined ? {} : { reason }) },
    fetchImpl,
  });
}

export function deleteRoom(
  code: string,
  hostToken: string,
  fetchImpl?: typeof fetch,
): Promise<void> {
  return request(`${ROOMS_PATH}/${encodeURIComponent(code)}`, {
    method: 'DELETE',
    headers: { [HOST_TOKEN_HEADER]: hostToken },
    fetchImpl,
  });
}

export interface PlayerViewEnvelope {
  readonly version: number;
  readonly phase: string;
  readonly view: PlayerView | null;
}

export function getPlayerView(code: string, fetchImpl?: typeof fetch): Promise<PlayerViewEnvelope> {
  return request(`${ROOMS_PATH}/${encodeURIComponent(code)}/view`, { fetchImpl });
}
