# T-036 P1 数据层与房间 API 报告

- 日期：2026-11-26
- 任务：T-036（M2 / 5D）
- 基线：api-contract v1.1 §3；tech-arch v1.3 §5.3/§7.2/§9；T-033 视图 API；T-035 交互冻结
- 结论：**完成**；SQLite 四表、房间生命周期、视图读取、快照版本、结算/解散删除、签名 Cookie 均已实现；16 个 API 测试通过

## 1. 实现

| 文件 | 内容 |
| --- | --- |
| `apps/api/src/db/schema.ts` | Drizzle 四表：`rooms`、`room_seats`、`game_states`、`snapshots`；`rooms.code` 唯一；`(room_id, seat_no)` 主键；`(room_id, session_id)` 唯一；`(room_id, version)` 主键 |
| `apps/api/src/db/index.ts` | `openDatabase`：创建目录、幂等迁移、`journal_mode=WAL`、`synchronous=NORMAL`、外键、`busy_timeout=5s`、`user_version` 版本保护 |
| `apps/api/src/rooms.ts` | `RoomService`：创建/恢复/加入/确认/解绑/摘要/玩家视图/快照/结算/解散/TTL；hostToken SHA-256；原始状态与过滤视图分离 |
| `apps/api/src/room-routes.ts` | 10 个房间端点；CSRF/Origin/会话守卫；`X-Host-Token`；`Idempotency-Key`；按会话限频 |
| `apps/api/src/idempotency.ts` | 单实例内存幂等缓存（10 分钟 TTL，上限 1000 条） |
| `apps/api/src/session.ts` | 会话 Cookie 改为 `lrs_anon=<48hex>.<hmac>`；`readSessionId` 验签；Socket.IO Cookie 头解析 |
| `apps/api/src/app.ts` | 启用 SQLite 时注册房间路由与 TTL 清理；日志脱敏新增 `x-host-token`；关闭时清理定时器与数据库 |
| `packages/shared/src/index.ts` | 房间请求/响应 Zod 契约、错误与 WS 事件类型、`X-Host-Token`/幂等头常量 |

依赖：`better-sqlite3` 13.2.0、`drizzle-orm` 0.45.4（Node 24.22.3 已验证加载、建表、读写、WAL）。

## 2. API 与权限

| 方法 | 路径 | 权限 | 关键行为 | 失败码 |
| --- | --- | --- | --- | --- |
| POST | `/api/v1/rooms` | 会话 + CSRF | 6 位配对码、hostToken 仅返回一次、join 10 分钟 / room 24 小时 | 401/403/429 |
| POST | `/api/v1/rooms/recover` | 会话 + CSRF + hostToken | 校验哈希并重绑主持会话 | 403/404 |
| POST | `/rooms/{code}/join` | 会话 + CSRF | 申请编号；同会话重复申请返回同一 `applicantId`；同座位他人 409 | 404/409/429 |
| POST | `/rooms/{code}/confirm` | 会话 + CSRF + hostToken | 主持人确认绑定；幂等 | 403/404/409 |
| POST | `/rooms/{code}/unbind` | 会话 + CSRF + hostToken | 解绑座位；重复解绑幂等 | 403/404 |
| GET | `/rooms/{code}` | hostToken | 返回 `version/phase/status/expiresAt`，不返回令牌或原始状态 | 403/404 |
| GET | `/rooms/{code}/view` | 绑定会话 | 只返回本人 `PlayerView`；未绑定 403；未发牌 `view=null` | 403/404 |
| PUT | `/rooms/{code}/snapshot` | 会话 + CSRF + hostToken | `game-engine` 校验、服务端生成视图、事务写三表 | 409 `STALE_VERSION`/422 `INVALID_STATE` |
| POST | `/rooms/{code}/settle` | 会话 + CSRF + hostToken | 删除四表并通知 WS | 403/404 |
| DELETE | `/rooms/{code}` | 会话 + CSRF + hostToken | 删除四表，204 | 403/404 |

- 快照 `version` 必须大于当前版本；旧版本返回 `409 STALE_VERSION` 且 `details.currentVersion` 为当前值。
- `phase` 必须与 `gameState.phase`、`boardId` 必须与房间一致，否则 422。
- 请求体先做结构守卫，再交给 `game-engine.validateGameState`，避免非法 JSON 触发异常。
- 结算/解散在事务内删除 `snapshots`、`game_states`、`room_seats`、`rooms`（AC-14）。

## 3. 安全

| 项 | 实现 |
| --- | --- |
| 会话 Cookie | HMAC-SHA256 签名；未签名、篡改或换密钥的 Cookie 视为无会话 |
| 主持令牌 | 32 字节随机；仅创建响应返回一次；DB 只存 SHA-256；比较使用定长比较 |
| CSRF / Origin | 所有写接口校验 CSRF；配置 `PUBLIC_ORIGIN` 时校验 Origin |
| 限频 | 创建 10/小时/会话；申请 30/分钟/会话；主持写 120/分钟/会话，超限 `429 RATE_LIMITED` |
| 幂等 | 创建/确认/结算支持 `Idempotency-Key`；重复请求返回同一结果 |
| 日志 | pino 脱敏 `cookie`、`x-csrf-token`、`x-host-token`；不记录原始状态 |
| 数据边界 | `state_json` 仅服务端；`snapshots` 仅存过滤视图；玩家接口不返回原始状态 |

## 4. 测试与 AC

| 项 | 结果 |
| --- | --- |
| `npx vitest run apps/api/src/rooms.test.ts` | **16/16** |
| `npx vitest run apps/api/src/session.test.ts apps/api/src/app.test.ts` | 34/34（含签名 Cookie 新增用例） |
| `npm test`（全量） | **281/281**（22 文件） |
| `npm run e2e` | 24/24 |
| lint / format:check / typecheck / build / verify:dist | 通过 |

| AC | 证据 |
| --- | --- |
| AC-13 | 绑定玩家只拿到本人视图；平民无 `teammates/checks/potions/guarded`；狼人仅见队友；预言家仅见查验；响应不含 `nightActions`/`state_json`/`hostToken`/`revealedRoles`；未绑定玩家 403 |
| AC-14 | 结算与解散后按 `room_id` 统计四表均为 0 |
| AC-19 | 版本 1 重复写入 409 且 `currentVersion=1`；跳写版本 3 成功；非法结构/phase/板子 422 |
| AC-12（服务端） | 提供 `GET /view` 与当前 `version`，供玩家端轮询/重连补齐 |

测试还覆盖：完整生命周期、重复申请/冲突、错误申请号、hostToken 只存哈希、TTL 清理、加入限频、幂等创建/确认、未签名 Cookie 拒绝。

回归用例：

- 确认 1 号不会把其他待确认申请一并置为已绑定（按 `(room_id, seat_no)` 精确更新）。
- 同一会话从 1 号改选 3 号时只移动自己的申请，不影响他人 2 号绑定。

## 5. 已知边界

- 幂等缓存为单实例内存；进程重启后失效（重复创建会得到新房间，不破坏既有数据）。
- 结算即删除数据；玩家需在结算前收到最终快照（T-037 推送 `room.closed`），之后只能查看本机缓存。
- 快照上限沿用全局 256KB；未单独按房间累计大小做配额。
- SQLite 备份、目录权限与恢复演练在 T-047 完成；真实服务器/域名/证书仍为部署阻塞项。

## 6. 证据

- 代码：[schema.ts](../../../../../apps/api/src/db/schema.ts)、[db/index.ts](../../../../../apps/api/src/db/index.ts)、[rooms.ts](../../../../../apps/api/src/rooms.ts)、[room-routes.ts](../../../../../apps/api/src/room-routes.ts)、[session.ts](../../../../../apps/api/src/session.ts)
- 测试：[rooms.test.ts](../../../../../apps/api/src/rooms.test.ts)、[session.test.ts](../../../../../apps/api/src/session.test.ts)
- 日志：[gates.log](../gates.log)、[unit-tests.log](../unit-tests.log)、[e2e.log](../e2e.log)
