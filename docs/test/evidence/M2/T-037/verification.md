# T-037 Socket.IO 推送与轮询降级（服务端）报告

- 日期：2026-11-26
- 任务：T-037（M2 / 5D）
- 基线：api-contract v1.1 §4；tech-arch v1.3 §5.3/§9；T-036 房间服务；interaction-spec v1.2 §17
- 结论：**完成**；Socket.IO 单实例推送、握手鉴权、视图过滤、关闭/解绑通知与版本控制已实现；6 个 WS 集成测试通过

## 1. 实现

| 文件 | 内容 |
| --- | --- |
| `apps/api/src/realtime.ts` | Socket.IO 4 服务；路径 `/ws/rooms`；握手校验；`room.view`/`room.closed`/`room.error`；64KB 上限 |
| `apps/api/src/rooms.ts` | `RoomNotifier` 接口：快照、关闭、解绑通知；由服务层在事务完成后触发 |
| `apps/api/src/app.ts` | 启用 SQLite 时挂载 WS；`preClose` 断开全部连接，避免优雅关闭被长连接阻塞 |
| `packages/shared/src/index.ts` | WS 事件 Zod 类型与关闭原因 |

服务端只推送 `PlayerView`，不推送原始 `gameState`；主持写操作仍走 HTTP。

## 2. 握手鉴权

| 校验 | 失败码 | 说明 |
| --- | --- | --- |
| 签名会话 Cookie | `UNAUTHORIZED` | 解析握手 Cookie，未签名/篡改拒绝 |
| 配对码格式 | `INVALID_REQUEST` | 必须 6 位数字 |
| 房间存在且 active/未过期 | `NOT_FOUND` | 结算/解散/过期后不可连接 |
| 座位已绑定当前会话 | `FORBIDDEN` | 未申请/未确认/被解绑拒绝 |
| Origin（配置 `PUBLIC_ORIGIN` 时） | 连接被拒 | `allowRequest` 校验，允许同源 |

连接建立后立即加入房间通道并推送当前最新视图；未发牌时保持连接、不推送也不断开，等待发牌后的下一次快照。

## 3. 事件契约

| 事件 | 方向 | 载荷 | 触发 |
| --- | --- | --- | --- |
| `room.view` | 服务端 → 玩家 | `{ type, version, phase, view }` | 连接后首推、每次快照写入 |
| `room.closed` | 服务端 → 玩家 | `{ type, reason: settled/deleted/expired }` | 结算、解散、TTL 清理 |
| `room.error` | 服务端 → 玩家 | `{ type, code, message }` | 解绑后通知并断开 |

- 每个 socket 记录 `lastVersion`；仅推送更高的 `version`，旧版本不会覆盖新视图。
- 只向 `privateViews` 中存在本人座位的连接推送；未绑定/已解绑不会收到他人视图。
- 快照写入失败不触发推送；修正后以更高版本补写。
- 单条消息上限 `WS_MAX_PAYLOAD_BYTES`（默认 65536）。
- 日志仅记录房间码、座位号、断开原因、错误码；不记录 Cookie/令牌。

## 4. 测试

| 用例 | 结果 |
| --- | --- |
| 连接后收到当前视图，快照 1→2→3 按版本递增推送 | 通过 |
| 未发牌时连接保持、不推送；发牌后收到首个视图 | 通过 |
| 结算后收到 `room.closed(settled)` 并断开 | 通过 |
| 无会话 / 未绑定 / 房间不存在 / 配对码非法均拒绝 | 通过（`UNAUTHORIZED`/`FORBIDDEN`/`NOT_FOUND`/`INVALID_REQUEST`） |
| 解绑后立即收到 `room.error(FORBIDDEN)` 并断开 | 通过 |
| 配置 `PUBLIC_ORIGIN` 时无 Origin 拒绝、正确 Origin 可连接并收到视图 | 通过 |

| 项 | 结果 |
| --- | --- |
| `npx vitest run apps/api/src/realtime.test.ts` | **6/6** |
| `npm test`（全量） | **281/281**（22 文件） |
| `npm run e2e` | 24/24 |
| lint / format:check / typecheck / build / verify:dist | 通过 |

## 5. AC 对应

- **AC-12（服务端）**：确认后连接即可获得当前视图；`GET /view` 与 WS 使用同一 `version`，供客户端 3 次重连失败后 5s 轮询。
- **AC-13**：WS 只发送本人 `PlayerView`；越权握手拒绝；不发送原始状态。
- **AC-19**：服务端只广播更高版本，客户端按版本丢弃旧视图；重连后先 REST 取当前版本。

客户端重连退避、轮询切换、离线状态机由 T-039 实现；本任务提供服务端契约与行为保证。

## 6. 已知边界

- Socket.IO 单实例内存适配器；多实例需 sticky session + Redis adapter（ADR-003，当前不引入）。
- 未做单房/单 IP 连接数上限；依赖会话绑定、房间人数（12）与限频控制。
- 心跳/重连参数使用 Socket.IO 默认值；压测在 T-047。
- 结算先删数据再通知；若玩家在结算瞬间离线，重连得到 404，需以本机缓存展示“房间已结束”。

## 7. 证据

- 代码：[realtime.ts](../../../../../apps/api/src/realtime.ts)、[rooms.ts](../../../../../apps/api/src/rooms.ts)、[app.ts](../../../../../apps/api/src/app.ts)
- 测试：[realtime.test.ts](../../../../../apps/api/src/realtime.test.ts)
- 日志：[gates.log](../gates.log)、[unit-tests.log](../unit-tests.log)、[e2e.log](../e2e.log)
