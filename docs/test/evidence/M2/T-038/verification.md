# T-038 联机主持端 UI 报告

- 日期：2026-11-26
- 任务：T-038（M2 / 5C）
- 基线：interaction-spec v1.2 §14～§18；api-contract v1.1 §3（含 3.8 向后兼容补充）；T-036/T-037 服务端
- 结论：**完成并已验收（2026-11-26）**；创建房间、配对码/二维码、座位确认/解绑、本机恢复、自动快照、结算/解散均已实现；主持组件 3 例 + 状态 4 例通过

## 1. 实现

| 文件 | 内容 |
| --- | --- |
| `apps/web/src/features/host/HostRoomScreen.tsx` | 创建房间、配对码/二维码/复制链接、有效期、12 座位绑定列表、逐个/批量确认、解绑、房间状态、快照同步状态、结算/解散二次确认 |
| `apps/web/src/stores/host-room-store.ts` | 创建/恢复/刷新/确认/解绑/结算/解散；hostToken 本机保存；3s 摘要刷新；快照写入队列 |
| `apps/web/src/lib/room-api.ts` | 房间 REST 客户端；会话/CSRF 自动续期；错误码映射 |
| `apps/web/src/lib/room-storage.ts` | `lrs.room.host.v1` 主机绑定持久化与校验 |
| `apps/web/src/App.tsx` | 首页入口 `host-room`；启动恢复本机房间；订阅对局变化写快照 |
| `apps/web/src/features/home/HomeScreen.tsx` | “联机主持”入口 |
| `apps/web/src/components/TopBar.tsx` / `lib/types.ts` / `FlowBar.tsx` | `host-room` 视图标签与流程条排除 |

后端补充（均为向后兼容新增）：

- `GET /api/v1/rooms/{code}` 摘要新增 `seats`（座位/状态/申请号/时间，不含 `sessionId`）。
- `GET /api/v1/rooms/{code}/public`：玩家加入页读取房间码/板子/有效期。
- `POST /api/v1/rooms/{code}/leave`：玩家取消待确认申请。

## 2. 交互与守卫

- 创建房间进行中禁用按钮；成功后显示 6 位配对码与二维码（内容为 `https://<host>/join/<code>`）。
- 座位列表区分未加入/待确认/已绑定；待确认可单个或批量确认；已绑定/待确认均可解绑。
- 主持令牌只保存本机，刷新后通过 `POST /rooms/recover` 恢复；404/403 时清除本机绑定并提示重建。
- 快照在本地对局状态变化后 300ms 合并写入；失败按 1s→2s→4s→…→15s 退避重试，不阻塞主持流程；409 读取 `currentVersion` 后以新版本补写；404/403 停止同步并提示。
- 结算/解散二次确认；成功后删除房间数据、清除本机绑定并返回大厅。
- 房间摘要每 3s 刷新，显示绑定进度、阶段、版本与同步状态。

## 3. 测试

| 用例 | 结果 |
| --- | --- |
| 创建房间 → 刷新待确认 → 确认 → 解绑 | 通过 |
| 刷新后按本机 hostToken 恢复房间 | 通过 |
| 对局状态变化自动写入快照（版本 1，完整 gameState） | 通过 |
| 快照失败退避重试后成功 | 通过 |
| 409 `STALE_VERSION` 读取 `currentVersion` 以 v8 补写 | 通过 |
| 创建后保存本机绑定并读取摘要 | 通过 |
| 房间不存在时停止同步并提示 | 通过 |
| e2e：主持端 320/430 宽度无横向滚动 | 通过 |

| 项 | 结果 |
| --- | --- |
| `npx vitest run apps/web/src/App.host-room.test.tsx apps/web/src/stores/host-room-store.test.ts` | **7/7** |
| `npm test`（全量） | **298/298**（26 文件） |
| `npm run e2e` | 26/26（含 P1 双上下文流程） |
| lint / format:check / typecheck | 通过 |
| 首屏 JS | 198.98 kB gzip（预算 250 kB） |

## 4. 已知边界

- 快照写入以完整 `gameState` 为单位，对局内步骤频繁时会产生较多版本；单房间 12 人规模可接受，压测在 T-047。
- 房间摘要 3s 轮询而非 WS 推送；主持人数量少，开销可控。
- 外部结算/过期通过摘要 404 或快照 404 感知，存在最长约 3s 延迟。
- 幂等缓存仍为服务端单实例内存；主持端重试依赖 `version` 递增而非幂等键。
- 二维码在浏览器本地生成，不依赖第三方服务；离线时仍可展示已生成的二维码。

## 5. 证据

- 代码：[HostRoomScreen.tsx](../../../../../apps/web/src/features/host/HostRoomScreen.tsx)、[host-room-store.ts](../../../../../apps/web/src/stores/host-room-store.ts)、[room-api.ts](../../../../../apps/web/src/lib/room-api.ts)
- 测试：[App.host-room.test.tsx](../../../../../apps/web/src/App.host-room.test.tsx)、[host-room-store.test.ts](../../../../../apps/web/src/stores/host-room-store.test.ts)、[p1-room.spec.ts](../../../../../tests/e2e/p1-room.spec.ts)
- 截图：[host-room-390.png](host-room-390.png)、[host-room-1440.png](host-room-1440.png)、[host-pending-390.png](host-pending-390.png)
- 日志：[gates.log](../gates.log)、[unit-tests.log](../unit-tests.log)、[e2e.log](../e2e.log)
