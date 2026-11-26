import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

import {
  buildViews,
  validateGameState,
  type BoardId,
  type GameState,
  type Phase,
  type PlayerView,
  type PublicView,
} from '@lrs/game-engine';
import type {
  CreateRoomResponse,
  JoinRoomResponse,
  PublicRoom,
  RoomClosedReason,
  RoomStatus,
  RoomSummary,
  SeatBinding,
} from '@lrs/shared';
import { and, desc, eq, lte } from 'drizzle-orm';

import type { AppDatabase } from './db/index.js';
import { gameStates, roomSeats, rooms, snapshots } from './db/schema.js';
import { ApiError } from './errors.js';

export interface RoomRecord {
  readonly id: string;
  readonly code: string;
  readonly hostTokenHash: string;
  readonly hostSessionId: string;
  readonly boardId: BoardId;
  readonly phase: Phase;
  readonly status: RoomStatus;
  readonly version: number;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly joinExpiresAt: number;
}

export interface StoredSnapshot {
  readonly version: number;
  readonly phase: Phase;
  readonly publicView: PublicView;
  readonly privateViews: Record<number, PlayerView>;
}

export interface SnapshotNotification extends StoredSnapshot {
  readonly roomId: string;
  readonly code: string;
}

export interface RoomClosedNotification {
  readonly code: string;
  readonly reason: RoomClosedReason;
}

export interface SeatUnboundNotification {
  readonly code: string;
  readonly seatNo: number;
}

export interface RoomNotifier {
  onSnapshot(event: SnapshotNotification): void;
  onRoomClosed(event: RoomClosedNotification): void;
  onSeatUnbound(event: SeatUnboundNotification): void;
}

export interface PlayerViewEnvelope {
  readonly version: number;
  readonly phase: Phase;
  readonly view: PlayerView | null;
}

export interface BoundSeat {
  readonly seatNo: number;
  readonly sessionId: string;
  readonly status: 'pending' | 'bound';
  readonly applicantId: string;
}

export interface RoomServiceOptions {
  readonly db: AppDatabase;
  readonly now?: () => number;
  readonly roomTtlMs?: number;
  readonly joinTtlMs?: number;
  readonly codeGenerator?: () => string;
  readonly tokenGenerator?: () => string;
}

const DEFAULT_ROOM_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_JOIN_TTL_MS = 10 * 60 * 1000;

export function hashHostToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * 先做结构守卫，避免把随意 JSON 传给 validateGameState 导致异常。
 * 规则一致性仍由 game-engine 校验。
 */
export function isGameStateLike(value: unknown): value is GameState {
  if (!isRecord(value)) return false;
  if (
    typeof value.boardId !== 'string' ||
    typeof value.phase !== 'string' ||
    typeof value.status !== 'string' ||
    !Number.isInteger(value.round)
  ) {
    return false;
  }
  if (!Array.isArray(value.seats) || !value.seats.every(isRecord)) return false;
  if (!Array.isArray(value.nightActions) || !value.nightActions.every(isRecord)) return false;
  if (
    !Array.isArray(value.events) ||
    !value.events.every((event) => isRecord(event) && Array.isArray(event.seatNos))
  ) {
    return false;
  }
  if (!Array.isArray(value.ballots) || !value.ballots.every(isRecord)) return false;
  if (!Array.isArray(value.pkCandidates)) return false;
  if (!Array.isArray(value.lastNightDeaths)) return false;
  return true;
}

export class RoomService {
  private readonly db: AppDatabase;

  private readonly now: () => number;

  private readonly roomTtlMs: number;

  private readonly joinTtlMs: number;

  private readonly codeGenerator: () => string;

  private readonly tokenGenerator: () => string;

  private notifier: RoomNotifier | undefined;

  constructor(options: RoomServiceOptions) {
    this.db = options.db;
    this.now = options.now ?? Date.now;
    this.roomTtlMs = options.roomTtlMs ?? DEFAULT_ROOM_TTL_MS;
    this.joinTtlMs = options.joinTtlMs ?? DEFAULT_JOIN_TTL_MS;
    this.codeGenerator =
      options.codeGenerator ?? (() => String(randomInt(0, 1_000_000)).padStart(6, '0'));
    this.tokenGenerator = options.tokenGenerator ?? (() => randomBytes(32).toString('base64url'));
  }

  setNotifier(notifier: RoomNotifier): void {
    this.notifier = notifier;
  }

  createRoom(boardId: BoardId, sessionId: string): CreateRoomResponse {
    const now = this.now();
    const code = this.uniqueCode();
    const hostToken = this.tokenGenerator();
    const roomId = `r_${randomBytes(9).toString('hex')}`;
    const expiresAt = now + this.roomTtlMs;
    const joinExpiresAt = now + this.joinTtlMs;

    this.db
      .insert(rooms)
      .values({
        id: roomId,
        code,
        hostTokenHash: hashHostToken(hostToken),
        hostSessionId: sessionId,
        boardId,
        phase: 'SETUP',
        status: 'active',
        version: 0,
        createdAt: now,
        expiresAt,
        joinExpiresAt,
      })
      .run();

    return { roomId, code, hostToken, boardId, joinExpiresAt, expiresAt };
  }

  recoverRoom(code: string, hostToken: string, sessionId: string): RoomSummary {
    const room = this.requireHost(code, hostToken);
    this.db.update(rooms).set({ hostSessionId: sessionId }).where(eq(rooms.id, room.id)).run();
    return this.summaryOf(room);
  }

  findRoom(code: string): RoomRecord | undefined {
    const row = this.db.select().from(rooms).where(eq(rooms.code, code)).get();
    return row ? this.toRecord(row) : undefined;
  }

  requireHost(code: string, hostToken: string): RoomRecord {
    const room = this.findRoom(code);
    if (room === undefined) throw new ApiError('NOT_FOUND', 404, '房间不存在或已结束');

    const expected = Buffer.from(room.hostTokenHash, 'hex');
    const actual = Buffer.from(hashHostToken(hostToken), 'hex');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      throw new ApiError('FORBIDDEN', 403, '主持令牌无效');
    }
    return room;
  }

  getSummary(code: string, hostToken: string): RoomSummary {
    return this.summaryOf(this.requireHost(code, hostToken));
  }

  /** 玩家加入页使用的公开信息，不包含主持人或座位会话数据。 */
  getPublicInfo(code: string): PublicRoom {
    const room = this.requireActiveRoom(code);
    return {
      code: room.code,
      boardId: room.boardId,
      phase: room.phase,
      status: room.status,
      joinExpiresAt: room.joinExpiresAt,
      expiresAt: room.expiresAt,
    };
  }

  listSeats(roomId: string): SeatBinding[] {
    return this.db
      .select()
      .from(roomSeats)
      .where(eq(roomSeats.roomId, roomId))
      .all()
      .map((seat) => ({
        seatNo: seat.seatNo,
        status: seat.status === 'bound' ? ('bound' as const) : ('pending' as const),
        applicantId: seat.applicantId,
        appliedAt: seat.appliedAt,
        boundAt: seat.boundAt ?? null,
      }))
      .sort((left, right) => left.seatNo - right.seatNo);
  }

  /** 玩家取消尚未确认的申请；已绑定需主持人解绑。 */
  cancelApplication(code: string, sessionId: string): { status: 'cancelled' } {
    const room = this.requireActiveRoom(code);
    const mine = this.db
      .select()
      .from(roomSeats)
      .where(and(eq(roomSeats.roomId, room.id), eq(roomSeats.sessionId, sessionId)))
      .get();
    if (mine === undefined) return { status: 'cancelled' };
    if (mine.status === 'bound') {
      throw new ApiError('CONFLICT', 409, '已绑定座位，请联系主持人解绑');
    }
    this.db
      .delete(roomSeats)
      .where(and(eq(roomSeats.roomId, room.id), eq(roomSeats.sessionId, sessionId)))
      .run();
    return { status: 'cancelled' };
  }

  findSeat(roomId: string, seatNo: number): BoundSeat | undefined {
    const row = this.db
      .select()
      .from(roomSeats)
      .where(and(eq(roomSeats.roomId, roomId), eq(roomSeats.seatNo, seatNo)))
      .get();
    return row
      ? {
          seatNo: row.seatNo,
          sessionId: row.sessionId,
          status: row.status === 'bound' ? 'bound' : 'pending',
          applicantId: row.applicantId,
        }
      : undefined;
  }

  findBoundSeat(roomId: string, sessionId: string): BoundSeat | undefined {
    const row = this.db
      .select()
      .from(roomSeats)
      .where(and(eq(roomSeats.roomId, roomId), eq(roomSeats.sessionId, sessionId)))
      .get();
    if (!row || row.status !== 'bound') return undefined;
    return {
      seatNo: row.seatNo,
      sessionId: row.sessionId,
      status: 'bound',
      applicantId: row.applicantId,
    };
  }

  joinRoom(code: string, seatNo: number, sessionId: string): JoinRoomResponse {
    const room = this.requireActiveRoom(code);
    const now = this.now();
    if (now >= room.joinExpiresAt) {
      throw new ApiError('CONFLICT', 409, '配对码已过期，请联系主持人重新创建房间');
    }

    const seat = this.findSeat(room.id, seatNo);
    if (seat !== undefined) {
      if (seat.sessionId === sessionId) {
        return { status: seat.status, applicantId: seat.applicantId };
      }
      throw new ApiError('CONFLICT', 409, '该编号已被绑定，请刷新后重试');
    }

    const mine = this.db
      .select()
      .from(roomSeats)
      .where(and(eq(roomSeats.roomId, room.id), eq(roomSeats.sessionId, sessionId)))
      .get();

    if (mine !== undefined) {
      if (mine.status === 'bound') {
        return { status: 'bound', applicantId: mine.applicantId };
      }
      this.db
        .update(roomSeats)
        .set({ seatNo, appliedAt: now })
        .where(and(eq(roomSeats.roomId, room.id), eq(roomSeats.sessionId, sessionId)))
        .run();
      return { status: 'pending', applicantId: mine.applicantId };
    }

    const applicantId = `s_${randomBytes(6).toString('hex')}`;
    this.db
      .insert(roomSeats)
      .values({
        roomId: room.id,
        seatNo,
        sessionId,
        applicantId,
        status: 'pending',
        appliedAt: now,
        boundAt: null,
      })
      .run();
    return { status: 'pending', applicantId };
  }

  confirmSeat(code: string, seatNo: number, applicantId: string): { status: 'bound' } {
    const room = this.requireActiveRoom(code);
    const seat = this.findSeat(room.id, seatNo);
    if (seat === undefined) {
      throw new ApiError('NOT_FOUND', 404, '该编号没有待确认的申请');
    }
    if (seat.applicantId !== applicantId) {
      throw new ApiError('CONFLICT', 409, '申请信息不匹配，请刷新后重试');
    }
    if (seat.status === 'bound') return { status: 'bound' };

    this.db
      .update(roomSeats)
      .set({ status: 'bound', boundAt: this.now() })
      .where(and(eq(roomSeats.roomId, room.id), eq(roomSeats.seatNo, seatNo)))
      .run();
    return { status: 'bound' };
  }

  unbindSeat(code: string, seatNo: number): { status: 'unbound' } {
    const room = this.requireActiveRoom(code);
    this.db
      .delete(roomSeats)
      .where(and(eq(roomSeats.roomId, room.id), eq(roomSeats.seatNo, seatNo)))
      .run();
    this.notifier?.onSeatUnbound({ code: room.code, seatNo });
    return { status: 'unbound' };
  }

  getPlayerView(code: string, sessionId: string): PlayerViewEnvelope {
    const room = this.requireActiveRoom(code);
    const seat = this.findBoundSeat(room.id, sessionId);
    if (seat === undefined) {
      throw new ApiError('FORBIDDEN', 403, '无权查看该房间视图，请先完成绑定');
    }

    const snapshot = this.latestSnapshot(room.id);
    if (snapshot === undefined) {
      return { version: 0, phase: room.phase, view: null };
    }
    return {
      version: snapshot.version,
      phase: snapshot.phase,
      view: snapshot.privateViews[seat.seatNo] ?? null,
    };
  }

  writeSnapshot(
    code: string,
    hostToken: string,
    request: { version: number; phase: string; gameState: unknown },
  ): { version: number } {
    const room = this.requireHost(code, hostToken);
    if (room.status !== 'active' || room.expiresAt <= this.now()) {
      throw new ApiError('NOT_FOUND', 404, '房间不存在或已结束');
    }
    if (!isGameStateLike(request.gameState)) {
      throw new ApiError('INVALID_STATE', 422, '对局状态结构不完整');
    }

    const state = request.gameState;
    const validation = validateGameState(state);
    if (!validation.valid) {
      throw new ApiError('INVALID_STATE', 422, '对局状态校验失败', {
        issues: validation.issues,
      });
    }
    if (state.phase !== request.phase) {
      throw new ApiError('INVALID_STATE', 422, 'phase 与 gameState.phase 不一致');
    }
    if (state.boardId !== room.boardId) {
      throw new ApiError('INVALID_STATE', 422, 'boardId 与房间不一致');
    }
    if (request.version <= room.version) {
      throw new ApiError('STALE_VERSION', 409, '快照版本过期', {
        currentVersion: room.version,
      });
    }

    const views = buildViews(state);
    const now = this.now();
    const stateJson = JSON.stringify(state);

    this.db.transaction((tx) => {
      tx.insert(gameStates)
        .values({
          roomId: room.id,
          version: request.version,
          phase: state.phase,
          stateJson,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: gameStates.roomId,
          set: { version: request.version, phase: state.phase, stateJson, updatedAt: now },
        })
        .run();
      tx.insert(snapshots)
        .values({
          roomId: room.id,
          version: request.version,
          phase: state.phase,
          publicView: JSON.stringify(views.publicView),
          privateViews: JSON.stringify(views.privateViews),
          updatedAt: now,
        })
        .run();
      tx.update(rooms)
        .set({ version: request.version, phase: state.phase })
        .where(eq(rooms.id, room.id))
        .run();
    });

    this.notifier?.onSnapshot({
      roomId: room.id,
      code: room.code,
      version: request.version,
      phase: state.phase,
      publicView: views.publicView,
      privateViews: views.privateViews,
    });
    return { version: request.version };
  }

  latestSnapshot(roomId: string): StoredSnapshot | undefined {
    const row = this.db
      .select()
      .from(snapshots)
      .where(eq(snapshots.roomId, roomId))
      .orderBy(desc(snapshots.version))
      .limit(1)
      .get();
    if (!row) return undefined;
    return {
      version: row.version,
      phase: row.phase as Phase,
      publicView: JSON.parse(row.publicView) as PublicView,
      privateViews: JSON.parse(row.privateViews) as Record<number, PlayerView>,
    };
  }

  settleRoom(code: string, hostToken: string): { status: 'settled' } {
    const room = this.requireHost(code, hostToken);
    this.deleteRoomRows(room.id);
    this.notifier?.onRoomClosed({ code: room.code, reason: 'settled' });
    return { status: 'settled' };
  }

  deleteRoom(code: string, hostToken: string): void {
    const room = this.requireHost(code, hostToken);
    this.deleteRoomRows(room.id);
    this.notifier?.onRoomClosed({ code: room.code, reason: 'deleted' });
  }

  cleanupExpired(now: number = this.now()): number {
    const expired = this.db
      .select({ id: rooms.id, code: rooms.code })
      .from(rooms)
      .where(lte(rooms.expiresAt, now))
      .all();

    for (const room of expired) {
      this.deleteRoomRows(room.id);
      this.notifier?.onRoomClosed({ code: room.code, reason: 'expired' });
    }
    return expired.length;
  }

  private requireActiveRoom(code: string): RoomRecord {
    const room = this.findRoom(code);
    if (room === undefined || room.status !== 'active' || room.expiresAt <= this.now()) {
      throw new ApiError('NOT_FOUND', 404, '房间不存在或已结束');
    }
    return room;
  }

  private uniqueCode(): string {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const code = this.codeGenerator();
      const existing = this.db
        .select({ id: rooms.id })
        .from(rooms)
        .where(eq(rooms.code, code))
        .get();
      if (!existing) return code;
    }
    throw new ApiError('INTERNAL', 500, '配对码生成失败，请重试');
  }

  private summaryOf(room: RoomRecord): RoomSummary {
    return {
      roomId: room.id,
      code: room.code,
      boardId: room.boardId,
      phase: room.phase,
      status: room.status,
      version: room.version,
      expiresAt: room.expiresAt,
      joinExpiresAt: room.joinExpiresAt,
      seats: this.listSeats(room.id),
    };
  }

  private deleteRoomRows(roomId: string): void {
    this.db.transaction((tx) => {
      tx.delete(snapshots).where(eq(snapshots.roomId, roomId)).run();
      tx.delete(gameStates).where(eq(gameStates.roomId, roomId)).run();
      tx.delete(roomSeats).where(eq(roomSeats.roomId, roomId)).run();
      tx.delete(rooms).where(eq(rooms.id, roomId)).run();
    });
  }

  private toRecord(row: typeof rooms.$inferSelect): RoomRecord {
    return {
      id: row.id,
      code: row.code,
      hostTokenHash: row.hostTokenHash,
      hostSessionId: row.hostSessionId,
      boardId: row.boardId as BoardId,
      phase: row.phase as Phase,
      status: row.status as RoomStatus,
      version: row.version,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      joinExpiresAt: row.joinExpiresAt,
    };
  }
}
