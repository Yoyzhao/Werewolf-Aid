import { integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/** 房间主表：配对码、主持令牌哈希、TTL 与当前快照版本。 */
export const rooms = sqliteTable(
  'rooms',
  {
    id: text('id').primaryKey(),
    code: text('code').notNull(),
    hostTokenHash: text('host_token_hash').notNull(),
    hostSessionId: text('host_session_id').notNull(),
    boardId: text('board_id').notNull(),
    phase: text('phase').notNull(),
    status: text('status').notNull(),
    version: integer('version').notNull().default(0),
    createdAt: integer('created_at').notNull(),
    expiresAt: integer('expires_at').notNull(),
    joinExpiresAt: integer('join_expires_at').notNull(),
  },
  (table) => [uniqueIndex('rooms_code_uq').on(table.code)],
);

/** 座位绑定：pending 申请 / bound 已绑定；一个会话在房间内只能占一个座位。 */
export const roomSeats = sqliteTable(
  'room_seats',
  {
    roomId: text('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    seatNo: integer('seat_no').notNull(),
    sessionId: text('session_id').notNull(),
    applicantId: text('applicant_id').notNull(),
    status: text('status').notNull(),
    appliedAt: integer('applied_at').notNull(),
    boundAt: integer('bound_at'),
  },
  (table) => [
    primaryKey({ columns: [table.roomId, table.seatNo] }),
    uniqueIndex('room_seats_session_uq').on(table.roomId, table.sessionId),
  ],
);

/** 完整对局状态：仅服务端读写，永不下发玩家。 */
export const gameStates = sqliteTable('game_states', {
  roomId: text('room_id')
    .primaryKey()
    .references(() => rooms.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  phase: text('phase').notNull(),
  stateJson: text('state_json').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

/** 过滤视图快照：publicView + 每个座位的 privateView。 */
export const snapshots = sqliteTable(
  'snapshots',
  {
    roomId: text('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    phase: text('phase').notNull(),
    publicView: text('public_view').notNull(),
    privateViews: text('private_views').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.roomId, table.version] })],
);
