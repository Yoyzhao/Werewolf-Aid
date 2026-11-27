# T-044 P1 整合报告

- 日期：2026-11-27
- 任务：T-044（M2 / STEP-6）
- 基线：interaction-spec v1.2；api-contract v1.1；T-037/T-038/T-039/T-040/T-041/T-042/T-043
- 结论：**完成**；联机主持端、玩家端、房间 API、服务端视图与 WS/轮询降级已串成可选链路，P0 单机流程保持独立可用

## 1. 整合范围

| 链路环节 | 实现 | 结果 |
| --- | --- | --- |
| 创建 → 加入 → 确认 | 主持端创建房间生成 6 位配对码；玩家 `/join/:code` 申请座位；主持逐个/批量确认；WS 推送绑定状态 | 通过 |
| 发牌 → 阶段快照 | 主持进入开局设置，板子锁定为房间板子；模式 C 发牌完成后每阶段写入服务端快照 | 通过 |
| 玩家视图推送 | 服务端用 `game-engine` 校验完整 `gameState` 并生成 `PlayerView`；玩家只收到本人身份、本人私有动作与公开事件 | 通过 |
| 断线重连 | 玩家刷新后按本机绑定恢复，版本不回退；WS 3 次重连失败后 5s 轮询，恢复后版本继续递增 | 通过 |
| 主持恢复 | 刷新后从首页恢复最近对局；顶栏联机按钮进入房间；房间内可回到当前对局 | 通过 |
| 结算/解散 | 结算页可直接去结算房间；结算删除房间/座位/快照，玩家收到“房间已结束”，API 返回 404 | 通过 |
| 失败隔离 | 中止 `/api/v1/rooms/**` 后主持端继续推进；恢复后按当前版本补写并推送玩家 | 通过 |
| P0/P1 共存 | P0 单机入口、`setup/deal/night/.../result` 视图不变；联机为可选入口 | 通过 |

## 2. 代码改动

| 文件 | 内容 |
| --- | --- |
| `apps/web/src/stores/game-store.ts` | 新增 `returnToGame()`：按 `game.phase` 恢复主持视图，供房间页返回对局 |
| `apps/web/src/features/host/HostRoomScreen.tsx` | 进入房间立即补写一次快照；新增操作区：回到当前对局 / 查看本局结算 / 继续上一局 / 查看上一局结果 / 进入开局设置 / 进入下一局设置；进入设置前对齐房间板子 |
| `apps/web/src/features/setup/SetupScreen.tsx` | 存在联机房间绑定时自动对齐板子并禁用板子切换，提示“联机房间已锁定板子” |
| `apps/web/src/components/TopBar.tsx` | 联机房间存在时显示“打开联机房间”按钮（`Wifi` 图标），不挤占阶段标识 |
| `apps/web/src/App.tsx` | 顶栏接入房间码与打开房间回调 |
| `apps/web/src/features/result/ResultScreen.tsx` | 结算页新增“联机房间”卡片与“去结算房间”入口 |
| `apps/web/src/stores/host-room-store.ts` | 创建房间时只在当前对局 `active` 时调度快照，避免把上一局已结算状态写入新房间 |
| `apps/web/src/App.host-room.test.tsx` | 新增“房间创建后可进入开局设置，且板子锁定为房间板子” |
| `apps/web/src/stores/host-room-store.test.ts` | 新增“创建房间时不把已结束的上一局写入快照” |
| `tests/e2e/p1-integration.spec.ts` | 新增双浏览器上下文联机主链路 e2e |

## 3. 验证结果

### 3.1 双浏览器主链路（`p1-integration.spec.ts`）

一个 Chromium 进程内建立主持/玩家两个独立 `BrowserContext`（390×844），完整执行：

1. 主持创建房间 → 配对码为 6 位数字；玩家 09 号加入并申请；主持确认后玩家进入等待开局。
2. 主持从房间页“进入开局设置”；板子按钮禁用且提示锁定；完成模式 C 发牌。
3. 玩家收到身份视图：9 号狼人、狼队友 10/11/12；玩家时间线不含预言家/女巫等他人私密信息。
4. 中止 `/api/v1/rooms/**`：主持继续空守、推进预言家步骤，快照写入失败计数 > 0；恢复网络后服务端版本补写并超过失败前版本，玩家版本随之递增。
5. 完成首夜、竞选、死讯、发言、投票放逐；玩家时间线出现“狼队：刀 5 号”“5 号出局”“6 号被放逐”，版本持续递增。
6. 玩家刷新后按绑定恢复、身份保持隐藏、版本不回退；主持刷新后从首页“继续”进入第 2 夜，再通过顶栏打开联机房间，确认版本不回退后“回到当前对局”。
7. 完成第 2 夜/第 2 天，狼人胜利；玩家收到最终视图；主持结算页出现“联机房间”卡片，进入房间结算并返回大厅。
8. 玩家显示“房间已结束”；`GET /api/v1/rooms/{code}` 返回 404（服务端结算删除房间、座位与快照）。

版本断言：发牌后 ≥1；每阶段记录版本单调不减；结算前版本大于发牌后版本。

### 3.2 回归

| 项 | 结果 |
| --- | --- |
| `npm test`（全量） | **340/340**（33 文件） |
| `npm run e2e`（全量） | **36/36** |
| lint / format:check / typecheck | 通过 |
| `npm run build` / `verify:dist` | 通过（dist smoke 含 PWA manifest/SW/precache） |
| 首屏 JS | 207.14 kB gzip（低于 250 kB 预算） |
| PWA 预缓存 | 16 项（版本 `f2a7f7cc9f0e`） |
| 320 宽度 | 主持房间、结算房间均无横向溢出 |

新增测试：单测 +2（`App.host-room` 4 例、`host-room-store` 5 例），e2e +1（M2 联机整合），P0 其余 35 例继续通过。

## 4. AC 对应

- **AC-12**：主持创建房间、玩家配对码加入、主持确认的完整绑定链路可用。
- **AC-13**：玩家仅看到本人身份/私有动作与公开事件；e2e 断言玩家时间线无预言家/女巫信息，原始 `gameState` 不下发。
- **AC-14**：结算后房间、座位、快照删除，玩家收到关闭事件，API 404。
- **P1-5/P1-6**：每阶段快照版本严格递增；断网/WS 不可用时主持不阻塞、玩家降级轮询可继续看到进度。
- **P0 不回退**：单机主持入口、视图与本地存储链路未改变，P0 全量 e2e 继续通过。

## 5. 已知边界

- 整合 e2e 在 Chromium 双上下文完成，真实多设备/弱网矩阵仍在 T-045/T-046 与发布前检查。
- 失败隔离以拦截 `/api/v1/rooms/**` 模拟后端不可达；未覆盖服务端进程崩溃后的重启恢复（T-047 持久化/恢复演练）。
- 房间板子在创建时确定；联机期间更换板子需先解散房间，避免玩家视图与主持板子不一致。
- 主持恢复依赖本机 `localStorage` 中的 hostToken；清除站点数据后无法恢复主持，只能新建房间。

## 6. 证据

- 代码：[HostRoomScreen.tsx](../../../../../apps/web/src/features/host/HostRoomScreen.tsx)、[SetupScreen.tsx](../../../../../apps/web/src/features/setup/SetupScreen.tsx)、[TopBar.tsx](../../../../../apps/web/src/components/TopBar.tsx)、[ResultScreen.tsx](../../../../../apps/web/src/features/result/ResultScreen.tsx)、[host-room-store.ts](../../../../../apps/web/src/stores/host-room-store.ts)、[game-store.ts](../../../../../apps/web/src/stores/game-store.ts)
- 测试：[p1-integration.spec.ts](../../../../../tests/e2e/p1-integration.spec.ts)、[App.host-room.test.tsx](../../../../../apps/web/src/App.host-room.test.tsx)、[host-room-store.test.ts](../../../../../apps/web/src/stores/host-room-store.test.ts)
- 截图：[host-room-bound-390.png](host-room-bound-390.png)、[player-dealt-390.png](player-dealt-390.png)、[player-reconnect-390.png](player-reconnect-390.png)、[host-recovered-390.png](host-recovered-390.png)、[host-result-room-390.png](host-result-room-390.png)、[host-result-room-card-390.png](host-result-room-card-390.png)、[player-closed-390.png](player-closed-390.png)
- 日志：[gates.log](../gates.log)、[unit-tests.log](../unit-tests.log)、[e2e.log](../e2e.log)、[build.log](../build.log)、[verify-dist.log](../verify-dist.log)
