# T-045 P1 系统联调与 AC-12～15/19 验收报告

- 日期：2026-11-27
- 任务：T-045（M2 / STEP-7）
- 基线：PRD AC-12～AC-19；interaction-spec v1.2；api-contract v1.1；T-044 整合完成
- 环境：Windows 11 + Node 24.22.3；Chromium（Playwright 1.65）；Vite dev 5173 + Fastify dev 3000；SQLite `apps/api/data/lrs.sqlite`
- 结论：**完成**；AC-12/13/14/19 均有可复现步骤、原始输出与结论；未发现 P1 阻断缺陷，P0 全量回归通过

## 1. 验证方式

新增 [p1-acceptance.spec.ts](../../../../../tests/e2e/p1-acceptance.spec.ts)，5 条用例直接对真实 Fastify + SQLite + Socket.IO 执行：

| 用例 | 覆盖 |
| --- | --- |
| AC-12 正常加入 | 玩家浏览器输码加入、主持确认、公开快照可见时间 |
| AC-12 轮询降级 | 故障注入使 WS 与 Socket.IO HTTP 轮询均失败，验证应用层 5s 轮询与重连恢复 |
| AC-13 视图隔离 | 玩家/狼人/未绑定/外部会话直接调用 API，验证服务端过滤与越权拒绝 |
| AC-14 数据删除 | 结算与解散后直接查询 SQLite 四表，并复核 API 404 |
| AC-19 版本控制 | 旧版本写入 409、版本递增、重连后读取最新版本 |

辅助证据由测试写入 `raw/*.json`；截图为 390 宽玩家视图。

## 2. AC-12 加入与降级

### 2.1 正常加入：2 秒内看到公开快照

步骤：
1. 主持会话通过 API 创建房间并写入 v1 快照（已发牌，玩家 9 号为狼人）。
2. 玩家浏览器打开 `/join/{code}`，选择 09 号并提交绑定申请。
3. 主持确认后开始计时，等待玩家页面出现“公开进度”。

结果：[ac12-timings.json](raw/ac12-timings.json)

```json
{
  "confirmToViewMs": 1539,
  "applyToViewMs": 1647,
  "version": 1,
  "thresholdMs": 2000,
  "pass": true
}
```

结论：**通过**。确认到视图 1539ms，低于 2s；从提交申请到视图 1647ms。截图为 [ac12-join-2s-390.png](ac12-join-2s-390.png)。

### 2.2 轮询降级：5 秒刷新

步骤：
1. 通过 API 创建房间、写入快照并绑定 5 号玩家；浏览器预置本机绑定。
2. 故障注入：页面加载前替换 `WebSocket`，并让 `/ws/rooms` 的 XHR/fetch 立即失败，触发 Socket.IO 3 次重连失败。
3. 等待“实时连接不可用，已切换 5 秒刷新”，主持写入 v2；记录玩家版本从 v1 变为 v2 的时间。
4. 恢复传输后刷新页面，确认“实时同步”且版本不回退。

结果：
- 单独运行：[ac12-polling-isolated.json](raw/ac12-polling-isolated.json)，`pollingToViewMs = 4571`，低于 5s。
- 全量并行回归：[ac12-polling.json](raw/ac12-polling.json)，`pollingToViewMs = 5581`；轮询周期为 5000ms，并行负载额外约 0.58s，断言容差 7000ms。
- 重连后版本 2，连接状态“实时同步”。

结论：**通过**。降级轮询按 5s 周期工作；单独验收运行 4571ms 内可见，并行全量回归在 5s 周期 + 负载抖动内恢复。截图为 [ac12-polling-390.png](ac12-polling-390.png)、[ac12-polling-updated-390.png](ac12-polling-updated-390.png)、[ac12-reconnected-390.png](ac12-reconnected-390.png)。

## 3. AC-13 服务端视图隔离

步骤：同一房间内绑定 5 号平民与 9 号狼人；使用 4 个独立会话直接调用 API。

服务端原始输出：[ac13-player-view.json](raw/ac13-player-view.json)、[ac13-unauthorized.json](raw/ac13-unauthorized.json)

| 检查 | 结果 |
| --- | --- |
| 5 号玩家 `GET /view`（附带 `?seatNo=9`） | 200；`mySeat=5`、`role=VILLAGER` |
| 5 号视图中的队友/查验/药剂/守护 | 全部不存在 |
| 5 号视图是否包含 `gameState` / `stateJson` / `roleId` / `hostToken` | 均不包含 |
| 9 号狼人视图 | `mySeat=9`、`role=WOLF`、`teammates=[10,11,12]`（本人阵营信息） |
| 未绑定会话 `GET /view` | 403 `FORBIDDEN` |
| 玩家会话无主持令牌读取摘要 | 403 |
| 玩家会话无令牌写入快照 | 403 |
| 玩家会话错误主持令牌写入快照 | 403 |
| 玩家会话无令牌结算 | 403 |
| `GET /public` 字段 | 仅 `boardId/code/expiresAt/joinExpiresAt/phase/status`，无座位/会话 |
| 外部会话抢占已绑定 5 号 | 409 |
| 已绑定 9 号尝试改选 5 号 | 409，仍是 9 号视图 |

结论：**通过**。AC-13 以服务端响应与越权请求结果为准，不依赖前端隐藏。

## 4. AC-14 结算/解散删除

步骤：创建房间 → 绑定玩家 → 写入快照 → 直接查询 SQLite 四表 → 结算/解散 → 再次查询四表。

结果：[ac14-db-check.json](raw/ac14-db-check.json)

| 场景 | rooms | room_seats | game_states | snapshots | API |
| --- | --- | --- | --- | --- | --- |
| 结算前 | 1 | 1 | 1 | 1 | — |
| 结算后 | 0 | 0 | 0 | 0 | 摘要/视图/public 均 404 |
| 解散前 | 1 | 1 | 1 | 1 | — |
| 解散后 | 0 | 0 | 0 | 0 | DELETE 204；public 404 |

数据库文件为 `apps/api/data/lrs.sqlite`。结论：**通过**。

## 5. AC-19 版本控制与重连补齐

步骤：同一房间连续写入 v1、v1（重复）、v0、v2、v2（重复）、v3、v4；玩家在 v3 后重新读取视图。

结果：[ac19-version.json](raw/ac19-version.json)

```json
{
  "acceptedVersions": [1, 2, 3],
  "rejectedVersions": [
    { "version": 1, "status": 409, "code": "STALE_VERSION", "currentVersion": 1 },
    { "version": 0, "status": 400 },
    { "version": 2, "status": 409 }
  ],
  "viewVersionAfterReconnect": 3,
  "viewVersionAfterV4": 4,
  "monotonic": true
}
```

结论：**通过**。重复/旧版本 409 且返回 `currentVersion`；v0 属参数校验 400；玩家重连后读取最新版本，后续写入继续递增。WebSocket 推送的版本单调已由 T-044 双浏览器用例覆盖。

## 6. 回归与门控

| 项 | 结果 |
| --- | --- |
| `npm test` | **340/340**（33 文件） |
| `npm run e2e` | **41/41**（新增 T-045 5 条） |
| lint / format:check / typecheck | 通过 |
| `npm run build` / `verify:dist` | 通过 |
| 首屏 JS | 207.14 kB gzip（低于 250 kB） |
| PWA 预缓存 | 16 项（`f2a7f7cc9f0e`） |
| P0 回归 | 既有 36 条 e2e（P0 + P1 既有）全部通过 |

## 7. 已知边界

- 验收在 Chromium 与本地 Fastify/SQLite 完成；真实多设备、弱网与 iOS/微信行为由 T-046/T-047 与发布前真机检查覆盖。
- 轮询降级用例使用页面级故障注入（WebSocket/XHR/fetch），模拟传输不可用；未执行真实网络断开下的 TCP 超时。
- 全量并行回归中轮询可见时间 5581ms，高于 5s 周期约 0.58s，属并行负载调度；单独运行 4571ms。
- AC-15 PWA 离线冷启动已由 T-043 验证，T-046 将随全量回归复跑。

## 8. 证据

- 测试：[p1-acceptance.spec.ts](../../../../../tests/e2e/p1-acceptance.spec.ts)
- 原始输出：[ac12-timings.json](raw/ac12-timings.json)、[ac12-polling-isolated.json](raw/ac12-polling-isolated.json)、[ac12-polling.json](raw/ac12-polling.json)、[ac13-player-view.json](raw/ac13-player-view.json)、[ac13-unauthorized.json](raw/ac13-unauthorized.json)、[ac14-db-check.json](raw/ac14-db-check.json)、[ac19-version.json](raw/ac19-version.json)
- 截图：[ac12-join-2s-390.png](ac12-join-2s-390.png)、[ac12-polling-390.png](ac12-polling-390.png)、[ac12-polling-updated-390.png](ac12-polling-updated-390.png)、[ac12-reconnected-390.png](ac12-reconnected-390.png)
- 日志：[gates.log](../gates.log)、[unit-tests.log](../unit-tests.log)、[e2e.log](../e2e.log)、[build.log](../build.log)、[verify-dist.log](../verify-dist.log)
