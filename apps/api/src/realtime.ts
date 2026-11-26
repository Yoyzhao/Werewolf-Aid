import type { PlayerView } from '@lrs/game-engine';
import { Server, type Socket } from 'socket.io';
import type { FastifyInstance } from 'fastify';

import type { AppConfig } from './config.js';
import type { RoomNotifier, RoomService, StoredSnapshot } from './rooms.js';
import { parseCookieHeader, readSessionId } from './session.js';

interface RoomSocketData {
  code: string;
  seatNo: number;
  sessionId: string;
  lastVersion: number;
}

export interface RealtimeHandle {
  readonly io: Server;
  readonly notifier: RoomNotifier;
  /** 在 Fastify close 前断开所有 WS，避免优雅关闭被长连接阻塞。 */
  disconnect(): void;
}

const ROOM_CODE_PATTERN = /^\d{6}$/;

function socketData(socket: Socket): RoomSocketData {
  return socket.data as RoomSocketData;
}

function handshakeError(code: string, message: string): Error {
  const error = new Error(message) as Error & { data?: { code: string; message: string } };
  error.data = { code, message };
  return error;
}

function roomChannel(code: string): string {
  return `room:${code}`;
}

/**
 * Socket.IO 服务：路径 `/ws/rooms`，握手校验会话/Origin/房间/绑定。
 * 只推送服务端生成的 PlayerView；版本只增不减。
 */
export function createRealtime(
  app: FastifyInstance,
  options: { readonly service: RoomService; readonly config: AppConfig },
): RealtimeHandle {
  const { service, config } = options;
  const io = new Server(app.server, {
    path: '/ws/rooms',
    serveClient: false,
    maxHttpBufferSize: config.wsMaxPayloadBytes,
    cors: config.publicOrigin ? { origin: config.publicOrigin, credentials: true } : undefined,
    allowRequest: (request, callback) => {
      const origin = request.headers.origin;
      if (config.publicOrigin && origin !== config.publicOrigin) {
        callback('ORIGIN_NOT_ALLOWED', false);
        return;
      }
      callback(null, true);
    },
  });

  io.use((socket, next) => {
    const reject = (code: string, message: string): void => {
      app.log.warn({ room: socket.handshake.query.code, code }, 'ws handshake rejected');
      next(handshakeError(code, message));
    };

    const cookies = parseCookieHeader(socket.handshake.headers.cookie);
    const sessionId = readSessionId(cookies, config.sessionSecret);
    if (!sessionId) {
      reject('UNAUTHORIZED', '缺少会话，请刷新页面后重试');
      return;
    }

    const rawCode = socket.handshake.query.code;
    const code = Array.isArray(rawCode) ? rawCode[0] : rawCode;
    if (typeof code !== 'string' || !ROOM_CODE_PATTERN.test(code)) {
      reject('INVALID_REQUEST', '配对码无效');
      return;
    }

    const room = service.findRoom(code);
    if (!room || room.status !== 'active' || room.expiresAt <= Date.now()) {
      reject('NOT_FOUND', '房间不存在或已结束');
      return;
    }

    const seat = service.findBoundSeat(room.id, sessionId);
    if (!seat) {
      reject('FORBIDDEN', '无权查看该房间视图');
      return;
    }

    socket.data = {
      code,
      seatNo: seat.seatNo,
      sessionId,
      lastVersion: 0,
    } satisfies RoomSocketData;
    next();
  });

  const sendView = (
    socket: Socket,
    snapshot: Pick<StoredSnapshot, 'version' | 'phase' | 'privateViews'>,
  ): void => {
    const data = socketData(socket);
    if (snapshot.version <= data.lastVersion) return;

    // 已绑定但尚未发牌时没有私有视图，保持连接等待下一次快照。
    const view: PlayerView | undefined = snapshot.privateViews[data.seatNo];
    if (!view) return;

    socket.emit('room.view', {
      type: 'room.view',
      version: snapshot.version,
      phase: snapshot.phase,
      view,
    });
    data.lastVersion = snapshot.version;
  };

  io.on('connection', (socket) => {
    const data = socketData(socket);
    app.log.info({ room: data.code, seatNo: data.seatNo }, 'ws connected');
    socket.on('disconnect', (reason) => {
      app.log.info({ room: data.code, seatNo: data.seatNo, reason }, 'ws disconnected');
    });
    void socket.join(roomChannel(data.code));

    const room = service.findRoom(data.code);
    if (!room) {
      socket.emit('room.error', { type: 'room.error', code: 'NOT_FOUND', message: '房间不存在' });
      socket.disconnect(true);
      return;
    }
    const snapshot = service.latestSnapshot(room.id);
    if (snapshot) sendView(socket, snapshot);
  });

  const notifier: RoomNotifier = {
    onSnapshot(event) {
      for (const socket of io.sockets.sockets.values()) {
        const data = socketData(socket);
        if (data.code !== event.code) continue;
        if (!service.findBoundSeat(event.roomId, data.sessionId)) {
          socket.emit('room.error', {
            type: 'room.error',
            code: 'FORBIDDEN',
            message: '你已被主持人解绑',
          });
          socket.disconnect(true);
          continue;
        }
        sendView(socket, event);
      }
    },
    onRoomClosed({ code, reason }) {
      io.to(roomChannel(code)).emit('room.closed', { type: 'room.closed', reason });
      for (const socket of io.sockets.sockets.values()) {
        if (socketData(socket).code === code) socket.disconnect(true);
      }
    },
    onSeatUnbound({ code, seatNo }) {
      for (const socket of io.sockets.sockets.values()) {
        const data = socketData(socket);
        if (data.code !== code || data.seatNo !== seatNo) continue;
        socket.emit('room.error', {
          type: 'room.error',
          code: 'FORBIDDEN',
          message: '你已被主持人解绑',
        });
        socket.disconnect(true);
      }
    },
  };

  return {
    io,
    notifier,
    disconnect: () => {
      io.disconnectSockets(true);
      io.engine.close();
    },
  };
}
