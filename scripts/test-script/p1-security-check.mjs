import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import Database from 'better-sqlite3';
import { io } from 'socket.io-client';

const PORT = 3111;
const BASE = `http://127.0.0.1:${PORT}`;
const ORIGIN = 'http://localhost:5173';
const EVIL_ORIGIN = 'http://evil.example';
const OUT = '.artifacts/p1/T-046';
const DB_DIR = resolve(OUT, 'db-security');
const DB_FILE = join(DB_DIR, 'security.sqlite');

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

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
  const setCookie = response.headers.getSetCookie();
  const rawCookie = setCookie.find((item) => item.startsWith('lrs_anon='));
  if (!rawCookie) throw new Error('未收到 lrs_anon Cookie');
  const cookie = rawCookie.split(';')[0];
  const body = await response.json();
  return { cookie, csrf: body.csrfToken, rawCookie };
}

async function createRoom(session) {
  const response = await fetch(`${BASE}/api/v1/rooms`, {
    method: 'POST',
    headers: {
      cookie: session.cookie,
      origin: ORIGIN,
      'x-csrf-token': session.csrf,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ boardId: 'pre-witch-hunter-guard' }),
  });
  if (response.status !== 201) throw new Error(`创建房间失败：${response.status}`);
  return response.json();
}

function connectClient(code, cookie, origin) {
  const headers = { cookie };
  if (origin !== undefined) headers.origin = origin;
  return io(BASE, {
    path: '/ws/rooms',
    query: { code },
    transports: ['websocket'],
    reconnection: false,
    forceNew: true,
    timeout: 5000,
    extraHeaders: headers,
  });
}

function waitForConnect(socket) {
  return new Promise((resolvePromise, rejectPromise) => {
    const timer = setTimeout(() => rejectPromise(new Error('WS 连接超时')), 6000);
    socket.once('connect', () => {
      clearTimeout(timer);
      resolvePromise('connected');
    });
    socket.once('connect_error', (error) => {
      clearTimeout(timer);
      rejectPromise(error);
    });
  });
}

await mkdir(DB_DIR, { recursive: true });
await rm(DB_FILE, { force: true });
await rm(`${DB_FILE}-wal`, { force: true });
await rm(`${DB_FILE}-shm`, { force: true });

const child = spawn(process.execPath, ['apps/api/dist/server.js'], {
  env: {
    ...process.env,
    NODE_ENV: 'development',
    HOST: '127.0.0.1',
    PORT: String(PORT),
    SQLITE_FILE: DB_FILE,
    SESSION_SECRET: 't046-security-secret',
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
  environment: { base: BASE, origin: ORIGIN, database: DB_FILE },
  cookie: {},
  csrf: {},
  origin: {},
  hostToken: {},
  logRedaction: {},
  pass: false,
  errors: [],
};

try {
  await waitForHealth();

  const host = await createSession();
  result.cookie.formatValid = /^lrs_anon=[a-f0-9]{48}\.[a-f0-9]{64}$/.test(host.cookie);
  result.cookie.httpOnly = /HttpOnly/i.test(host.rawCookie);
  result.cookie.sameSiteLax = /SameSite=Lax/i.test(host.rawCookie);
  result.cookie.pathRoot = /Path=\//i.test(host.rawCookie);
  result.cookie.value = host.cookie.replace(/^lrs_anon=/, '').slice(0, 20) + '…';

  const tamperedValue = `${host.cookie.slice(0, -1)}${host.cookie.endsWith('0') ? '1' : '0'}`;
  const tampered = await fetch(`${BASE}/api/v1/rooms`, {
    method: 'POST',
    headers: {
      cookie: tamperedValue,
      origin: ORIGIN,
      'x-csrf-token': host.csrf,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ boardId: 'pre-witch-hunter-guard' }),
  });
  result.cookie.tamperedStatus = tampered.status;
  result.cookie.tamperedRejected = tampered.status === 401;

  const missingCsrf = await fetch(`${BASE}/api/v1/rooms`, {
    method: 'POST',
    headers: {
      cookie: host.cookie,
      origin: ORIGIN,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ boardId: 'pre-witch-hunter-guard' }),
  });
  result.csrf.missingStatus = missingCsrf.status;
  result.csrf.missingRejected = missingCsrf.status === 403;

  const wrongCsrf = await fetch(`${BASE}/api/v1/rooms`, {
    method: 'POST',
    headers: {
      cookie: host.cookie,
      origin: ORIGIN,
      'x-csrf-token': 'deadbeef',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ boardId: 'pre-witch-hunter-guard' }),
  });
  result.csrf.wrongStatus = wrongCsrf.status;
  result.csrf.wrongRejected = wrongCsrf.status === 403;

  const evilApi = await fetch(`${BASE}/api/v1/rooms`, {
    method: 'POST',
    headers: {
      cookie: host.cookie,
      origin: EVIL_ORIGIN,
      'x-csrf-token': host.csrf,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ boardId: 'pre-witch-hunter-guard' }),
  });
  const evilApiBody = await evilApi.json();
  result.origin.apiStatus = evilApi.status;
  result.origin.apiMessage = evilApiBody?.error?.message ?? '';
  result.origin.apiRejected = evilApi.status === 403;

  const room = await createRoom(host);

  const sqlite = new Database(DB_FILE);
  try {
    const row = sqlite
      .prepare('SELECT host_token_hash AS hash FROM rooms WHERE code = ?')
      .get(room.code);
    const expected = createHash('sha256').update(room.hostToken).digest('hex');
    result.hostToken.hashEqualsSha256 = row?.hash === expected;
    result.hostToken.plainNotStored = row?.hash !== room.hostToken;
    result.hostToken.hashPrefix = `${String(row?.hash ?? '').slice(0, 12)}…`;
  } finally {
    sqlite.close();
  }

  const player = await createSession();
  const join = await fetch(`${BASE}/api/v1/rooms/${room.code}/join`, {
    method: 'POST',
    headers: {
      cookie: player.cookie,
      origin: ORIGIN,
      'x-csrf-token': player.csrf,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ seatNo: 5 }),
  });
  const applicant = await join.json();
  const confirm = await fetch(`${BASE}/api/v1/rooms/${room.code}/confirm`, {
    method: 'POST',
    headers: {
      cookie: host.cookie,
      origin: ORIGIN,
      'x-csrf-token': host.csrf,
      'x-host-token': room.hostToken,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ seatNo: 5, applicantId: applicant.applicantId }),
  });
  result.origin.joinStatus = join.status;
  result.origin.confirmStatus = confirm.status;

  const allowed = connectClient(room.code, player.cookie, ORIGIN);
  await waitForConnect(allowed);
  result.origin.wsAllowed = allowed.connected;
  allowed.close();

  const evil = connectClient(room.code, player.cookie, EVIL_ORIGIN);
  const evilError = await waitForConnect(evil).then(
    () => null,
    (error) => error,
  );
  result.origin.wsEvilRejected = evilError !== null && evil.connected === false;
  result.origin.wsEvilMessage = String(evilError?.message ?? '').slice(0, 120);
  evil.close();

  const noOrigin = connectClient(room.code, player.cookie, undefined);
  const noOriginError = await waitForConnect(noOrigin).then(
    () => null,
    (error) => error,
  );
  result.origin.wsMissingOriginRejected = noOriginError !== null && noOrigin.connected === false;
  noOrigin.close();

  await sleep(300);
  const cookieValue = host.cookie.replace(/^lrs_anon=/, '');
  result.logRedaction.containsHostToken = logs.includes(room.hostToken);
  result.logRedaction.containsCookie = logs.includes(cookieValue);
  result.logRedaction.logBytes = logs.length;

  const checks = [
    result.cookie.formatValid,
    result.cookie.httpOnly,
    result.cookie.sameSiteLax,
    result.cookie.pathRoot,
    result.cookie.tamperedRejected,
    result.csrf.missingRejected,
    result.csrf.wrongRejected,
    result.origin.apiRejected,
    result.origin.wsAllowed,
    result.origin.wsEvilRejected,
    result.origin.wsMissingOriginRejected,
    result.hostToken.hashEqualsSha256,
    result.hostToken.plainNotStored,
    result.logRedaction.containsHostToken === false,
    result.logRedaction.containsCookie === false,
  ];
  result.pass = checks.every(Boolean);

  const cleanup = await fetch(`${BASE}/api/v1/rooms/${room.code}`, {
    method: 'DELETE',
    headers: {
      cookie: host.cookie,
      origin: ORIGIN,
      'x-csrf-token': host.csrf,
      'x-host-token': room.hostToken,
    },
  });
  result.cleanupStatus = cleanup.status;
} catch (error) {
  result.errors.push(String(error).slice(0, 500));
} finally {
  await mkdir(OUT, { recursive: true });
  await writeFile(join(OUT, 'security-check.json'), `${JSON.stringify(result, null, 2)}\n`);
  await writeFile(join(OUT, 'security-server.log'), logs);
  child.kill('SIGTERM');
  await sleep(300);
  await rm(DB_DIR, { recursive: true, force: true });
}

console.log(JSON.stringify(result, null, 2));
if (!result.pass) process.exit(1);
