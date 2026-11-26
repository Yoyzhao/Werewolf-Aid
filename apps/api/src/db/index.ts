import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

import * as schema from './schema.js';

export type AppDatabase = BetterSQLite3Database<typeof schema>;

export interface OpenedDatabase {
  readonly db: AppDatabase;
  readonly sqlite: Database.Database;
  close(): void;
}

export const SCHEMA_VERSION = 1;

const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  host_token_hash TEXT NOT NULL,
  host_session_id TEXT NOT NULL,
  board_id TEXT NOT NULL,
  phase TEXT NOT NULL,
  status TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  join_expires_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS rooms_code_uq ON rooms(code);

CREATE TABLE IF NOT EXISTS room_seats (
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  seat_no INTEGER NOT NULL,
  session_id TEXT NOT NULL,
  applicant_id TEXT NOT NULL,
  status TEXT NOT NULL,
  applied_at INTEGER NOT NULL,
  bound_at INTEGER,
  PRIMARY KEY (room_id, seat_no)
);
CREATE UNIQUE INDEX IF NOT EXISTS room_seats_session_uq ON room_seats(room_id, session_id);

CREATE TABLE IF NOT EXISTS game_states (
  room_id TEXT PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  phase TEXT NOT NULL,
  state_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS snapshots (
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  phase TEXT NOT NULL,
  public_view TEXT NOT NULL,
  private_views TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (room_id, version)
);
`;

/**
 * 打开 SQLite（WAL）并执行幂等迁移。
 * 传 `:memory:` 时用于测试；其他路径会创建父目录。
 */
export function openDatabase(file: string): OpenedDatabase {
  if (!file) throw new Error('SQLite 文件路径不能为空');

  const memory = file === ':memory:';
  const target = memory ? file : resolve(file);
  if (!memory) mkdirSync(dirname(target), { recursive: true });

  const sqlite = new Database(target);
  const currentVersion = sqlite.pragma('user_version', { simple: true }) as number;
  if (currentVersion > SCHEMA_VERSION) {
    sqlite.close();
    throw new Error(`数据库版本 ${currentVersion} 高于应用支持的 ${SCHEMA_VERSION}`);
  }

  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('synchronous = NORMAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 5000');
  sqlite.exec(MIGRATION_SQL);
  sqlite.pragma(`user_version = ${SCHEMA_VERSION}`);

  const db = drizzle(sqlite, { schema });
  return {
    db,
    sqlite,
    close: () => {
      sqlite.close();
    },
  };
}
