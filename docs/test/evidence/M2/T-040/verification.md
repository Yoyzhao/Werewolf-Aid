# T-040 复盘时间线报告

- 日期：2026-11-26
- 任务：T-040（M2 / 5C）
- 基线：interaction-spec v1.2 §19.1；T-031 结算页；T-033/T-037 服务端视图与推送
- 结论：**完成并已验收（2026-11-27）**；主持端与玩家端时间线、折叠/空态、320/390/430 布局均已实现并通过组件与 e2e 验证

## 1. 实现

| 文件 | 内容 |
| --- | --- |
| `packages/game-engine/src/views.ts` | 新增 `PrivateNightAction`；`PlayerView.privateActions` 仅包含本人参与的夜间动作（狼阵营为共同刀人），预言家动作带 `result`；无动作不添加字段 |
| `packages/game-engine/src/index.ts` | 导出 `PrivateNightAction` |
| `apps/web/src/lib/timeline.ts` | `buildHostTimeline`：夜间动作（私密）+ 公开事件按轮次/阶段分组；`buildPlayerTimeline`：`privateActions` + `events`；默认展开最近一夜；复用结算页既有文案（守护/刀口/解药毒药/查验/死讯/竞选/放逐/自爆/开枪/翻牌/警徽流转） |
| `apps/web/src/features/result/Timeline.tsx` | 折叠分组、公开/私密 chip、夜/昼图标、空态“本局暂无可展示的事件” |
| `apps/web/src/features/result/ResultScreen.tsx` | 结算页改用 `Timeline`，保留身份揭晓、胜负与危险操作 |
| `apps/web/src/features/player/PlayerRoot.tsx` | 绑定态与房间结束态展示玩家时间线（公开事件 + 本人私密） |

## 2. 可见性

- 主持端：完整夜间动作 + 全部公开事件；默认只展开最近一夜，其余折叠。
- 玩家端：仅 `PlayerView.events` 与 `PlayerView.privateActions`；狼人看到“狼队：刀 X 号”，预言家/女巫/守卫只看到本人动作；不渲染他人夜间私密信息。
- 空态：无任何事件与动作时显示固定文案。

## 3. 测试

| 用例 | 结果 |
| --- | --- |
| 私有夜间动作只包含本人角色，狼队共享刀人；平民无 `privateActions` | 通过（views 13/13） |
| 主持端分组、默认展开最近一夜、私密/公开标记 | 通过（timeline 3/3） |
| 玩家端仅包含本人动作与公开事件 | 通过 |
| 空数组返回空时间线 | 通过 |
| e2e：主持端完整事件、默认展开第 2 夜、展开后全部可见 | 通过 |
| e2e：无事件空态 | 通过 |
| e2e：玩家端（9 号狼人）只显示“狼队：刀 5 号”与公开事件，无预言家/女巫/守卫信息 | 通过 |
| e2e：主持端/玩家端 320/390/430 无横向滚动 | 通过 |

| 项 | 结果 |
| --- | --- |
| `npm test`（全量） | **316/316**（29 文件） |
| `npm run e2e`（全量） | **31/31** |
| lint / format:check / typecheck / build / verify:dist | 通过 |
| 首屏 JS | 203.88 kB gzip（低于 250 kB 预算） |

## 4. AC 对应

- **AC-13**：玩家端时间线只消费服务端 `PlayerView`，不含他人身份与夜间私密动作；e2e 断言时间线内无预言家/女巫/守卫文案。
- **P1-4**：逐夜/白天展示完整事件类型；主持端完整、玩家端过滤；折叠与空态符合 §19.1。

## 5. 已知边界

- 玩家端时间线在未绑定/无视图时不可见（等待主持人发牌）。
- 时间线事件文案来自引擎 `events` 与 `nightActions`；历史事件不会重新计算。
- 主持端全部展开时页面较长，移动端可滚动查看。

## 6. 证据

- 代码：[timeline.ts](../../../../../apps/web/src/lib/timeline.ts)、[Timeline.tsx](../../../../../apps/web/src/features/result/Timeline.tsx)、[views.ts](../../../../../packages/game-engine/src/views.ts)
- 测试：[timeline.test.ts](../../../../../apps/web/src/lib/timeline.test.ts)、[views.test.ts](../../../../../packages/game-engine/src/views.test.ts)、[timeline.spec.ts](../../../../../tests/e2e/timeline.spec.ts)
- 截图：[host-timeline-390.png](host-timeline-390.png)、[host-timeline-320.png](host-timeline-320.png)、[host-timeline-430.png](host-timeline-430.png)、[player-timeline-390.png](player-timeline-390.png)
- 日志：[gates.log](../gates.log)、[unit-tests.log](../unit-tests.log)、[e2e.log](../e2e.log)
