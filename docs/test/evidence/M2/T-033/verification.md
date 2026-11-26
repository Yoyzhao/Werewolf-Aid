# T-033 服务端状态校验与视图生成报告

- 日期：2026-11-26
- 任务：T-033（M2 / 5D）
- 基线：M1 已验收；PRD v1.3.2 P1-3；tech-arch v1.3 §5.3；api-contract v1.1 §3.6
- 结论：**完成**；`game-engine` 已提供服务端状态校验与公开/私有视图生成，12 个新单测通过，可被 T-036/T-037 直接引用

## 1. 实现

| 文件 | 内容 |
| --- | --- |
| `packages/game-engine/src/views.ts` | `validateGameState`、`buildPublicView`、`buildPrivateView`、`buildViews`、`isNightActionAllowed` |
| `packages/game-engine/src/index.ts` | 导出视图与校验 API 及类型 |
| `packages/game-engine/src/views.test.ts` | 12 个单测（校验 + 可见性 + 两板子） |

### 1.1 校验范围

- 板子存在；座位 12 个、编号 1–12 不重复。
- 发牌后角色全部非空且构成与板子一致；SETUP/DEAL 允许未发牌。
- 存活/出局与死因、死亡轮次一致；警长、放逐、自爆、待开枪、PK、投票座位合法。
- 夜间动作轮次/步骤/角色/目标/药剂合法；非女巫不得带药剂。
- 事件序号唯一、类型合法、座位合法。
- `status`/`phase`/`result` 一致；RESULT 必须有结果，未结束不得带结果。
- 返回 `{ valid, issues[] }`，API 可映射为 `422 INVALID_STATE`。

### 1.2 视图可见性

| 字段 | 公开 | 预言家 | 女巫 | 守卫 | 狼人/白狼王 | 其他人 |
| --- | --- | --- | --- | --- | --- | --- |
| `phase/round/alive/sheriffNo/events/result` | 是 | 是 | 是 | 是 | 是 | 是 |
| `revealedRoles` | 仅结算后 | 仅结算后 | 仅结算后 | 仅结算后 | 仅结算后 | 仅结算后 |
| `role`（本人） | — | 是 | 是 | 是 | 是 | 是 |
| `checks` | — | 是 | — | — | — | — |
| `potions` | — | — | 是 | — | — | — |
| `guarded` | — | — | — | 是 | — | — |
| `teammates` | — | — | — | — | 是 | — |

- 原始 `GameState` 不出现在任何视图类型中；API 层只下发 `PlayerView`/`PublicView`。
- 结算前不生成 `revealedRoles`；结算后公开全部身份。

## 2. 验证

| 项 | 结果 |
| --- | --- |
| `npm run typecheck -w @lrs/game-engine` | 通过 |
| `npx vitest run packages/game-engine/src` | **69/69**（新增 `views.test.ts` 12 个） |
| `npm test`（全量） | **257/257** |
| `npm run e2e` | 24/24 |
| lint / format:check / build / verify:dist | 通过 |

覆盖的 AC-13 用例：

- 预言家只看到自己的查验；`JSON` 中不出现他人角色。
- 狼人只看到狼队队友（含白狼王），看不到查验/药剂。
- 女巫药剂剩余状态随使用更新；守卫只看到自己的守护记录。
- 平民无任何私有字段；未发牌座位返回 `null`。
- 结算前无 `revealedRoles`；结算后才公开全部身份。
- 非法座位、角色构成、夜间目标、事件座位被校验拒绝。

## 3. 已知边界

- 本任务只做**结构与板子一致性**校验，不替代 API 层逐动作合法性校验；T-036 写快照时应结合状态机规则。
- 视图字段以 `PlayerView` 为准；T-036 需按绑定座位生成并存储 `private_views`。
- 性能：12 座位视图生成在单测中为微秒级，未单独压测。

## 4. 证据

- 代码：[views.ts](../../../../../packages/game-engine/src/views.ts)、[views.test.ts](../../../../../packages/game-engine/src/views.test.ts)
- 日志：[gates.log](../gates.log)、[unit-tests.log](../unit-tests.log)、[e2e.log](../e2e.log)
