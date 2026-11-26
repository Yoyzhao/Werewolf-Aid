# T-039 联机玩家端 UI 报告

- 日期：2026-11-26
- 任务：T-039（M2 / 5C）
- 基线：interaction-spec v1.2 §14、§16～§18；api-contract v1.1 §3/§4（含 3.8 补充）；T-033/T-037 服务端
- 结论：**完成**；加入路由、申请/等待/绑定、身份遮罩、公开进度、重连与 5s 轮询降级均已实现；玩家组件 3 例 + 状态 5 例 + e2e 通过

## 1. 实现

| 文件 | 内容 |
| --- | --- |
| `apps/web/src/features/player/PlayerRoot.tsx` | `/join` 输码、加入页、等待确认、玩家视图、结束页；身份遮罩；公开/私有信息；连接提示 |
| `apps/web/src/stores/player-room-store.ts` | 1.5s 确认轮询；Socket.IO；3 次重连失败后 5s 轮询；版本单调；关闭/解绑处理；本机恢复 |
| `apps/web/src/lib/room-api.ts` | `getPublicRoom`、`joinRoom`、`leaveRoom`、`getPlayerView` |
| `apps/web/src/lib/room-labels.ts` | 阶段/连接/关闭原因/公开事件文案 |
| `apps/web/src/App.tsx` | `/join`、`/join/:code` 路由与 history 同步；玩家页不渲染主持 Shell/底部 Tab |
| `apps/web/vite.config.ts` | `/ws` WebSocket 代理（`ws: true`） |

## 2. 状态机与可见性

- 阶段：`loading → join → pending → bound → closed/error`；刷新时按本机绑定与 `GET /view` 恢复。
- 等待确认：每 1.5s 轮询 `GET /view`；200 进入绑定并建立 WS；403 保持等待；404 房间结束。
- 已绑定：WS 首推当前视图；断线后 1s/2s/4s 重连 3 次，仍失败切换 5s 轮询；`online/offline` 暂停与恢复。
- 版本只增不减；低于当前版本的消息丢弃；重连后先 `GET /view` 补齐。
- 身份默认遮罩；点击“查看我的身份”展示；页面隐藏时重新遮罩。
- 仅渲染服务端 `PlayerView`：本人 `role`、按角色的 `teammates/checks/potions/guarded`；`revealedRoles` 仅结算后出现；不请求原始 `gameState`。
- 房间关闭显示原因；被解绑回到申请页并清除本机绑定；离开房间仅清除本机绑定。

## 3. 测试

| 用例 | 结果 |
| --- | --- |
| 输码进入房间；无效码提示 | 通过 |
| 申请 → 等待 → 绑定 → 默认遮罩 → 查看身份 → 仅本人私有信息 | 通过 |
| 房间结束后显示结束原因 | 通过 |
| 申请 → 确认 → 版本更新（1→2，旧版本不回退） | 通过 |
| 连续 3 次重连失败 → 5s 轮询并更新版本 | 通过 |
| 被解绑回到申请页并清除绑定 | 通过 |
| 房间关闭进入结束页 | 通过 |
| 待确认取消申请 | 通过 |
| e2e：主持创建房间 → 玩家申请 → 主持确认 → 真实 WS 快照 → 结算关闭 | 通过 |
| e2e：320/430 无横向滚动 | 通过 |

| 项 | 结果 |
| --- | --- |
| `npx vitest run apps/web/src/App.player.test.tsx apps/web/src/stores/player-room-store.test.ts` | **8/8** |
| `npm test`（全量） | **298/298**（26 文件） |
| `npm run e2e` | 26/26 |
| lint / format:check / typecheck | 通过 |
| 首屏 JS | 198.98 kB gzip（含 socket.io-client/qrcode） |

## 4. AC 对应

- **AC-12**：确认后自动进入玩家视图；WS 实时更新；3 次重连失败降级 5s 轮询；刷新/重连可恢复。
- **AC-13**：玩家页只展示本人 `PlayerView`；组件断言无狼队友/他人身份；e2e 断言无“狼队友”区块。
- **AC-19**：版本单调；低版本消息丢弃；服务端只推送递增版本。

## 5. 已知边界

- 等待确认使用 1.5s 轮询而非推送（未绑定会话无法建立 WS）；12 人规模开销可接受。
- 首次恢复时若已被解绑，`GET /view` 403 会显示“等待确认”，需用户取消/重新申请；后续 WS `room.error` 会明确提示。
- 离线时仅保留当前页面内容；离线冷启动与缓存由 T-043 PWA 承接。
- 玩家端不提供任何写操作；解绑由主持人执行。

## 6. 证据

- 代码：[PlayerRoot.tsx](../../../../../apps/web/src/features/player/PlayerRoot.tsx)、[player-room-store.ts](../../../../../apps/web/src/stores/player-room-store.ts)
- 测试：[App.player.test.tsx](../../../../../apps/web/src/App.player.test.tsx)、[player-room-store.test.ts](../../../../../apps/web/src/stores/player-room-store.test.ts)、[p1-room.spec.ts](../../../../../tests/e2e/p1-room.spec.ts)
- 截图：[player-join-390.png](player-join-390.png)、[player-bound-390.png](player-bound-390.png)、[player-revealed-390.png](player-revealed-390.png)
- 日志：[gates.log](../gates.log)、[unit-tests.log](../unit-tests.log)、[e2e.log](../e2e.log)
