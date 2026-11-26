# T-027 状态机与动作验证证据

- 日期：2026-11-26
- 环境：Windows 11 / Node v24.22.3 / npm 11.19.1
- 任务：[STEP-5C T-027](../../../plan/tasks/M1/STEP-5C.md#t-027)
- 依据：PRD v1.3.2 附录 E；interaction-spec v1.1 第 5/6/8.3 节

## 产出

- `packages/game-engine/src/state-machine.ts`
  - 阶段：SETUP/DEAL/NIGHT/SHERIFF/DAWN/SPEECH/SELF_EXPLODE/VOTE/SETTLE/CHECK_WIN/RESULT。
  - 动作：开局、发牌完成、夜间动作、夜间推进、竞选报名/发言/退水/投票/结束、自爆与自爆结算、死讯完成、发言完成、逐票录入、投票结算、结算完成、胜负确认。
  - 状态：12 座位与存活/身份/白痴翻牌、警长、夜间动作、逐票 `Ballot { voter, target, weight }`、PK 候选与轮次、自爆中断、公开事件、胜负结果。
  - 快照：`createSnapshot`/`restoreSnapshot` 深拷贝，供前端回退栈使用。
- `packages/game-engine/src/state-machine.test.ts`：21 个用例。
- `packages/game-engine/src/index.ts`：导出状态机 API 与类型。

## 命令结果

| 命令 | 结果 | 说明 |
| --- | --- | --- |
| `npm run typecheck -w @lrs/game-engine` | 通过 | TS strict 无错误 |
| `npx vitest run packages/game-engine/src` | 通过 | 3 个文件、38 个用例 |
| `npm run lint` | 通过 | 无警告 |
| `npm run format:check` | 通过 | Prettier 全部匹配 |
| `npm test` | 通过 | 5 个文件、40 个用例 |
| `npm run build` | 通过 | 全部 workspace 构建成功 |

## 用例覆盖

- 初始 SETUP 12 座；START_DEAL 记录板子/模式/选项；DEAL_DONE 校验 12 座与板子构成后进入 NIGHT。
- 夜间按板子夜序记录动作；空守/空刀/不用药显式记录；预言家必须选目标；女巫药剂与目标匹配；最后一步 NIGHT_DONE 进入 CHECK_WIN 并记录 `resumeTo`。
- 竞选：无人上警、报警下投票选警长、警上无票、平票 PK、再平无警长；`SHERIFF_DONE` 进入 DAWN。
- 白天闭环：DAWN_DONE → CHECK_WIN(SPEECH) → SPEECH → VOTE → SETTLE → CHECK_WIN(NIGHT)，下一夜轮次 +1。
- 放逐投票：逐票录入与覆盖、弃票、警长 1.5 票、平票 PK 与再平无人出局、白痴翻牌无票。
- 自爆：发言/竞选阶段允许，非狼人拒绝；中止流程、竞选吞警徽、`EXPLODE_RESOLVED` 后进入 CHECK_WIN。
- 胜负确认：`RESOLVE_WIN` 进入 RESULT 并标记 finished，或无胜者时回到 `resumeTo`（T-028 起由引擎自动判定胜者）。
- 非法动作：错误阶段、错误夜间角色、缺步骤推进、错误目标、无投票权、PK 轮非法目标等均返回错误码。
- 快照：深拷贝、可还原，回退后状态与快照一致。

## 说明

- 本任务只实现流程与状态迁移；夜间死亡结算、同守同救、连守、女巫两瓶、猎人/白痴/白狼王技能、警徽流转、屠边胜负判定由 T-028 实现并在对应检查点接入。
- `SETTLE` 阶段记录 `exiledSeat`，放逐致死与技能结算由 T-028 处理。
- 功能测试复验（2026-11-26）：基于构建产物跑通 3 夜完整对局（含竞选、投票、猎人与放逐），见[功能测试报告](../functional-test-20261126.md)。
