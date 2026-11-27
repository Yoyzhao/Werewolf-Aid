import { spawn } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { applyAction, createGame, getBoard } from '@lrs/game-engine';
import { io } from 'socket.io-client';

const PORT = 3112;
const BASE = `http://127.0.0.1:${PORT}`;
const ORIGIN = 'http://localhost:5173';
const OUT = '.artifacts/p1/T-046';
const DB_DIR = resolve(OUT, 'db-load');
const DB_FILE = join(DB_DIR, 'load.sqlite');
const ROOM_COUNT = 10;
const SEATS_PER_ROOM = 12;
const POLL_INTERVAL_MS = 5000;
const WS_BUDGET_MS = 2000;
const POLL_BUDGET_MS = 5000;

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

function dealtState(boardId = 'pre-witch-hunter-guard') {
  const board = getBoard(boardId);
  const assignments = board.roles
    .flatMap((slot) => Array.from({ length: slot.count }, () => slot.roleId))
    .map((roleId, index) => ({ seatNo: index + 1, roleId }));
  const started = applyAction(createGame(boardId), { type: 'START_DEAL', boardId, dealMode: 'C' });
  if (!started.ok) throw new Error(started.message);
  const dealt = applyAction(started.state, { type: 'DEAL_DONE', assignments });
  if (!dealt.ok) throw new Error(dealt.message);
  return dealt.state;
}

function percentile(values, ratio) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)] ?? 0;
}

async function waitForHealth() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`${BASE}/api/v1/health`);
      if (response.ok) return;
    } catch {
      // 服务尚未就绪。
    }
    await sleep(100);
  }
  throw new Error('API 未在 10s 内就绪');
}

async function createSession() {
  const response = await fetch(`${BASE}/api/v1/session`, { headers: { origin: ORIGIN } });
  if (!response.ok) throw new Error(`session 失败：${response.status}`);
  const rawCookie = response.headers.getSetCookie().find((item) => item.startsWith('lrs_anon='));
  if (!rawCookie) throw new Error('未收到 lrs_anon Cookie');
  const cookie = rawCookie.split(';')[0];
  const body = await response.json();
  return { cookie, csrf: body.csrfToken };
}

async function createRoom(host) {
  const response = await fetch(`${BASE}/api/v1/rooms`, {
    method: 'POST',
    headers: {
      cookie: host.cookie,
      origin: ORIGIN,
      'x-csrf-token': host.csrf,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ boardId: 'pre-witch-hunter-guard' }),
  });
  if (response.status !== 201) throw new Error(`创建房间失败：${response.status}`);
  return response.json();
}

async function joinSeat(player, code, seatNo) {
  const response = await fetch(`${BASE}/api/v1/rooms/${code}/join`, {
    method: 'POST',
    headers: {
      cookie: player.cookie,
      origin: ORIGIN,
      'x-csrf-token': player.csrf,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ seatNo }),
  });
  if (!response.ok) throw new Error(`加入座位 ${seatNo} 失败：${response.status}`);
  return response.json();
}

async function confirmSeat(host, room, seatNo, applicantId) {
  const response = await fetch(`${BASE}/api/v1/rooms/${room.code}/confirm`, {
    method: 'POST',
    headers: {
      cookie: host.cookie,
      origin: ORIGIN,
      'x-csrf-token': host.csrf,
      'x-host-token': room.hostToken,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ seatNo, applicantId }),
  });
  if (!response.ok) throw new Error(`确认座位 ${seatNo} 失败：${response.status}`);
}

async function putSnapshot(host, room, version, state) {
  const startedAt = Date.now();
  const response = await fetch(`${BASE}/api/v1/rooms/${room.code}/snapshot`, {
    method: 'PUT',
    headers: {
      cookie: host.cookie,
      origin: ORIGIN,
      'x-csrf-token': host.csrf,
      'x-host-token': room.hostToken,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ version, phase: state.phase, gameState: state }),
  });
  if (!response.ok) throw new Error(`写入快照 v${version} 失败：${response.status}`);
  return startedAt;
}

async function deleteRoom(host, room) {
  await fetch(`${BASE}/api/v1/rooms/${room.code}`, {
    method: 'DELETE',
    headers: {
      cookie: host.cookie,
      origin: ORIGIN,
      'x-csrf-token': host.csrf,
      'x-host-token': room.hostToken,
    },
  });
}

async function getView(player, code) {
  const response = await fetch(`${BASE}/api/v1/rooms/${code}/view`, {
    headers: { cookie: player.cookie },
  });
  if (!response.ok) throw new Error(`读取视图失败：${response.status}`);
  return response.json();
}

function connectSocket(player, code) {
  return io(BASE, {
    path: '/ws/rooms',
    query: { code },
    transports: ['websocket'],
    reconnection: false,
    forceNew: true,
    timeout: 10_000,
    extraHeaders: { cookie: player.cookie, origin: ORIGIN },
  });
}

function waitForConnect(socket) {
  return new Promise((resolvePromise, rejectPromise) => {
    const timer = setTimeout(() => rejectPromise(new Error('WS 连接超时')), 12_000);
    socket.once('connect', () => {
      clearTimeout(timer);
      resolvePromise();
    });
    socket.once('connect_error', (error) => {
      clearTimeout(timer);
      rejectPromise(error);
    });
  });
}

function waitForRoomVersion(room, targetVersion) {
  return new Promise((resolvePromise, rejectPromise) => {
    const latencies = [];
    const timer = setTimeout(() => {
      rejectPromise(
        new Error(
          `房间 ${room.code} 仅收到 ${latencies.length}/${SEATS_PER_ROOM} 条 v${targetVersion} 推送`,
        ),
      );
    }, 5000);

    for (const socket of room.sockets) {
      socket.on('room.view', (payload) => {
        if (payload?.version !== targetVersion) return;
        latencies.push(Date.now() - room.writeStartedAt);
        if (latencies.length === SEATS_PER_ROOM) {
          clearTimeout(timer);
          resolvePromise(latencies);
        }
      });
    }
  });
}

async function pollUntilVersion(player, room, targetVersion, timeoutMs) {
  const phase = (player.index * 137) % POLL_INTERVAL_MS;
  await sleep(phase);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const envelope = await getView(player, room.code);
    if (envelope.version >= targetVersion && room.writeStartedAt > 0) {
      return Date.now() - room.writeStartedAt;
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(`轮询超时：房间 ${room.code} 座位 ${player.seatNo}`);
}

await mkdir(DB_DIR, { recursive: true });
for (const suffix of ['', '-wal', '-shm']) {
  await rm(`${DB_FILE}${suffix}`, { force: true });
}

const child = spawn(process.execPath, ['apps/api/dist/server.js'], {
  env: {
    ...process.env,
    NODE_ENV: 'test',
    HOST: '127.0.0.1',
    PORT: String(PORT),
    SQLITE_FILE: DB_FILE,
    SESSION_SECRET: 't046-load-secret',
    PUBLIC_ORIGIN: ORIGIN,
    WEB_DIST_DIR: resolve(OUT, 'no-web'),
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let logs = '';
child.stdout.on('data', (chunk) => {
  logs += chunk.toString();
});
child.stderr.on('data', (chunk) => {
  logs += chunk.toString();
});

const result = {
  environment: {
    base: BASE,
    rooms: ROOM_COUNT,
    seatsPerRoom: SEATS_PER_ROOM,
    sessions: ROOM_COUNT * (1 + SEATS_PER_ROOM),
    wsConnections: ROOM_COUNT * SEATS_PER_ROOM,
    database: DB_FILE,
  },
  setupMs: 0,
  ws: { count: 0, p50: 0, p95: 0, max: 0, pass: false },
  polling: {
    count: 0,
    intervalMs: POLL_INTERVAL_MS,
    p50: 0,
    p95: 0,
    max: 0,
    pass: false,
  },
  errors: [],
  pass: false,
};

const rooms = [];

try {
  await waitForHealth();
  const setupStartedAt = Date.now();
  const state = dealtState();

  for (let roomIndex = 0; roomIndex < ROOM_COUNT; roomIndex += 1) {
    const host = await createSession();
    const created = await createRoom(host);
    const players = await Promise.all(
      Array.from({ length: SEATS_PER_ROOM }, async (_, seatIndex) => {
        const player = await createSession();
        player.seatNo = seatIndex + 1;
        player.index = roomIndex * SEATS_PER_ROOM + seatIndex;
        return player;
      }),
    );

    await Promise.all(
      players.map(async (player) => {
        const joined = await joinSeat(player, created.code, player.seatNo);
        await confirmSeat(host, created, player.seatNo, joined.applicantId);
      }),
    );
    await putSnapshot(host, created, 1, state);
    rooms.push({ host, ...created, players, sockets: [], writeStartedAt: 0 });
  }

  result.setupMs = Date.now() - setupStartedAt;

  const connectErrors = [];
  for (const room of rooms) {
    room.sockets = room.players.map((player) => connectSocket(player, room.code));
    await Promise.all(
      room.sockets.map(async (socket, index) => {
        try {
          await waitForConnect(socket);
        } catch (error) {
          connectErrors.push(`房间 ${room.code} 座位 ${index + 1}: ${error.message}`);
        }
      }),
    );
  }
  result.errors.push(...connectErrors);

  const wsWaits = rooms.map((room) => waitForRoomVersion(room, 2));
  await Promise.all(
    rooms.map(async (room) => {
      room.writeStartedAt = Date.now();
      await putSnapshot(room.host, room, 2, state);
    }),
  );
  const wsLatencies = (await Promise.all(wsWaits)).flat();
  result.ws = {
    count: wsLatencies.length,
    p50: percentile(wsLatencies, 0.5),
    p95: percentile(wsLatencies, 0.95),
    max: wsLatencies.length > 0 ? Math.max(...wsLatencies) : 0,
    pass:
      wsLatencies.length === ROOM_COUNT * SEATS_PER_ROOM &&
      Math.max(...wsLatencies) <= WS_BUDGET_MS,
  };

  for (const room of rooms) {
    room.writeStartedAt = 0;
    room.polling = room.players.map((player) =>
      pollUntilVersion(player, room, 3, 9000).catch((error) => {
        result.errors.push(String(error).slice(0, 200));
        return null;
      }),
    );
  }
  await sleep(300);
  await Promise.all(
    rooms.map(async (room) => {
      room.writeStartedAt = Date.now();
      await putSnapshot(room.host, room, 3, state);
    }),
  );
  const pollTimes = (await Promise.all(rooms.flatMap((room) => room.polling))).filter(
    (value) => value !== null,
  );
  result.polling = {
    count: pollTimes.length,
    intervalMs: POLL_INTERVAL_MS,
    p50: percentile(pollTimes, 0.5),
    p95: percentile(pollTimes, 0.95),
    max: pollTimes.length > 0 ? Math.max(...pollTimes) : 0,
    pass:
      pollTimes.length === ROOM_COUNT * SEATS_PER_ROOM &&
      percentile(pollTimes, 0.95) <= POLL_BUDGET_MS,
  };

  result.pass = result.ws.pass && result.polling.pass && result.errors.length === 0;
} catch (error) {
  result.errors.push(String(error).slice(0, 500));
} finally {
  for (const room of rooms) {
    for (const socket of room.sockets) socket.close();
  }
  for (const room of rooms) {
    try {
      await deleteRoom(room.host, room);
    } catch {
      // 清理失败不改变压测结论。
    }
  }
  await mkdir(OUT, { recursive: true });
  await writeFile(join(OUT, 'load-check.json'), `${JSON.stringify(result, null, 2)}\n`);
  await writeFile(join(OUT, 'load-server.log'), logs);
  child.kill('SIGTERM');
  await sleep(500);
  await rm(DB_DIR, { recursive: true, force: true });
}

console.log(JSON.stringify(result, null, 2));
if (!result.pass) process.exit(1);
