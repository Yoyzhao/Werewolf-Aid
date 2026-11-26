# M2 STEP-5D P1 后端实现

## 任务索引

- **里程碑**：M2（v1.4 P1）
- **阶段**：5D
- **本轮基线**：tech-arch v1.3 第 5.3/7.2/9 节；api-contract v1.1 第 3/4 节
- **进度入口**：[project-progress.md](../../../project-progress.md)

## 阶段任务清单

| 任务 ID | 业务切片 | 一句话范围 | 影响位置 | 详情 |
| --- | --- | --- | --- | --- |
| T-033 | 规则/视图 | 服务端状态校验与 `buildViews` | `packages/game-engine` | [T-033](#t-033) |
| T-036 | 房间/数据 | SQLite/Drizzle、房间/绑定/快照 API、签名 Cookie | `apps/api`、`packages/shared` | [T-036](#t-036) |
| T-037 | 实时 | Socket.IO 推送、重连与轮询降级契约 | `apps/api` | [T-037](#t-037) |

<a id="t-033"></a>
## T-033 服务端状态校验与视图生成

**目标**：服务端能校验主持端写入的完整 `gameState`，并生成公开视图与按座位私有视图。

**范围内**：`buildPublicView`、`buildPrivateView(state, seat)`、状态结构/阶段/板子校验；角色可见性（预言家查验、狼队互认、女巫药剂、警长、白痴、猎人等）；未绑定座位处理。

**范围外**：房间存储/API（T-036）、WS（T-037）、前端。

**验收**：
- 纯函数、无网络/存储依赖；非法状态返回可映射的错误。
- 单测覆盖 AC-13：玩家视图不含他人身份/夜间私密信息；原始 `gameState` 不经 API 下发。
- 产出：game-engine 视图函数与测试；证据：`docs/test/evidence/M2/T-033/verification.md`。

**完成结果（2026-11-26）**：
- `views.ts` 提供 `validateGameState`、`buildPublicView`、`buildPrivateView`、`buildViews`、`isNightActionAllowed`。
- 12 个新单测覆盖校验、角色可见性、两板子与未发牌座位；全量 257 单测通过。
- 结算前不下发 `revealedRoles`；狼队友/查验/药剂/守护仅本人可见。
- 证据：[T-033 报告](../../../test/evidence/M2/T-033/verification.md)。

<a id="t-036"></a>
## T-036 P1 数据层与房间 API

**目标**：实现房间生命周期、绑定、快照版本、视图读取与删除，使用 SQLite 持久化。

**范围内**：
- 依赖：`better-sqlite3` + Drizzle（Node 24 首日验证；失败评估 `node:sqlite`）。
- 四表 `rooms/room_seats/game_states/snapshots`、唯一约束、WAL、`expires_at` TTL 清理。
- `POST /rooms`、`/rooms/recover`、`/rooms/{code}/join`、`/confirm`、`/unbind`、`GET /rooms/{code}`、`GET /view`、`PUT /snapshot`、`POST /settle`、`DELETE /rooms/{code}`。
- hostToken 只返回一次、服务端存 SHA-256；幂等键；会话/IP 限频；`version` 严格递增（409 `STALE_VERSION`）；非法状态 422。
- **会话 Cookie 签名或轮换**，缓解 P1 房间身份固定风险。
- 结算/解散删除四表（AC-14）。

**范围外**：WS 推送（T-037）、前端。

**验收**：
- Fastify inject 覆盖房间全生命周期、权限、旧版本、删除、限频、幂等。
- 数据库文件不含明文 hostToken；日志无 token/Cookie。
- 产出：API、迁移、测试；证据：`docs/test/evidence/M2/T-036/verification.md`。

**完成结果（2026-11-26）**：
- 依赖：`better-sqlite3` 13.2.0、`drizzle-orm` 0.45.4；Node 24.22.3 加载/建表/读写/WAL 验证通过。
- 数据层：`apps/api/src/db/schema.ts` 四表与唯一约束；`db/index.ts` 幂等迁移、WAL、外键、busy_timeout。
- 服务：`rooms.ts` 创建/恢复/加入/确认/解绑/快照/视图/结算/解散/TTL；hostToken 存 SHA-256；原始 `gameState` 仅存 `game_states`，`snapshots` 存过滤视图。
- API：`room-routes.ts` 10 个端点，CSRF/Origin/会话守卫、`X-Host-Token`、幂等键、按会话限频；非法状态 422、旧版本 409、结算/解散删除四表。
- 会话安全：`lrs_anon=<id>.<hmac>`，未签名/篡改 Cookie 视为无会话。
- 测试：16 个 Fastify inject 用例覆盖生命周期、权限、AC-13、AC-14、AC-19、TTL、限频、幂等、hostToken 哈希；含多座位确认隔离与会话改选隔离回归用例。
- 证据：[T-036 报告](../../../test/evidence/M2/T-036/verification.md)。

<a id="t-037"></a>
## T-037 Socket.IO 推送与轮询降级

**目标**：向绑定玩家推送其视图；断线可重连，失败时客户端可降级 5s 轮询。

**范围内**：Socket.IO 4 单实例；路径 `/ws/rooms`；握手校验 Cookie/Origin/绑定；事件 `room.view`、`room.closed`、`room.error`；64KB 消息上限；版本递增；连接/错误日志（无敏感数据）。

**范围外**：前端重连策略（T-039 实现，本任务提供契约）。

**验收**：
- 未绑定/越权连接被拒；只推送过滤视图；房间关闭通知；旧版本不覆盖新视图。
- WS 集成测试（socket.io-client）覆盖连接、推送、关闭、越权。
- 产出：WS 服务与测试；证据：`docs/test/evidence/M2/T-037/verification.md`。

**完成结果（2026-11-26）**：
- `realtime.ts` 挂载 Socket.IO 单实例，路径 `/ws/rooms`；`maxHttpBufferSize=64KB`；Origin 白名单（配置 `PUBLIC_ORIGIN` 时）。
- 握手校验签名 Cookie/配对码/房间状态/座位绑定；拒绝码 `UNAUTHORIZED`/`INVALID_REQUEST`/`NOT_FOUND`/`FORBIDDEN`。
- 连接即推送当前 `PlayerView`；未发牌时保持连接、不推送也不断开，发牌后首推；快照写入按座位推送 `room.view`（版本只增不减）；结算/解散/过期推送 `room.closed`；解绑推送 `room.error` 并断开。
- 日志仅记录房间码/座位/原因/错误码，不记录 Cookie/令牌。
- 测试：6 个 socket.io-client 集成用例覆盖连接首推、未发牌等待、版本递增、关闭通知、未绑定/无会话/无效码、解绑、Origin 校验。
- 证据：[T-037 报告](../../../test/evidence/M2/T-037/verification.md)。

## 阶段验证

- `npm test`、lint/format/typecheck/build/verify:dist 通过；P0 用例无回归。
- API/WS 契约与 api-contract v1.1 一致；新增字段向后兼容。
