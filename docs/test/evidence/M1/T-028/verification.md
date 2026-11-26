# T-028 冲突、技能与胜负验证证据

- 日期：2026-11-26
- 环境：Windows 11 / Node v24.22.3 / npm 11.19.1
- 任务：[STEP-5C T-028](../../../plan/tasks/M1/STEP-5C.md#t-028)
- 依据：PRD v1.3.2 附录 A；interaction-spec v1.1 第 5/6 节

## 产出

- `packages/game-engine/src/rules.ts`
  - 夜间结算：守护、狼刀、解药、毒药、同守同救；死亡原因与公开事件。
  - 夜间拦截：守卫连守、女巫药剂整局限一次、解药仅救当夜被刀者、首夜自救开关。
  - 胜负：屠边判定（狼全灭 → 好人；神全灭或民全灭 → 狼）。
- `packages/game-engine/src/state-machine.ts`
  - `NIGHT_DONE` 自动结算死亡并进入 `CHECK_WIN`。
  - `RESOLVE_WIN` 改为引擎自动判定，不再由调用方传入胜者。
  - 新增动作：`RESOLVE_EXILE`、`HUNTER_SHOOT`、`BADGE_TRANSFER`、`BADGE_DESTROY`、`WOLF_KING_TAKE`。
  - 新增状态：`deathRound`、`lastNightDeaths`、`exileResolved`、`pendingHunterNo`、`pendingBadge`、`pendingWolfKingTake`。
  - DAWN/SETTLE/自爆结算增加待处理技能守卫。
- `packages/game-engine/src/rules.test.ts`：19 个用例。
- `packages/game-engine/src/index.ts`：导出 `checkWin`、`computeNightDeaths`、`validateNightActionRules`。

## 命令结果

| 命令 | 结果 | 说明 |
| --- | --- | --- |
| `npm run typecheck -w @lrs/game-engine` | 通过 | TS strict 无错误 |
| `npx vitest run packages/game-engine/src` | 通过 | 4 个文件、57 个用例 |
| `npm run lint` | 通过 | 无警告 |
| `npm run format:check` | 通过 | Prettier 全部匹配 |
| `npm test` | 通过 | 6 个文件、59 个用例 |
| `npm run build` | 通过 | 全部 workspace 构建成功 |

## 用例覆盖（AC-3 / AC-4）

- 夜间：狼刀死亡、守护平安夜、解药救人、同守同救死亡、毒药无视守护、空刀平安夜。
- 拦截：守卫不可连守、女巫药剂整局一次、解药只能救当夜被刀者、首夜自救开关。
- 猎人：被刀在 DAWN 开枪、被毒不可开枪、被放逐在 SETTLE 开枪、可跳过；未处理不能结束阶段。
- 白痴：被放逐翻牌免死、失去投票权、不再成为放逐目标；不会进入死亡结算。
- 警徽：夜间死亡后必须移交或撕毁才能继续；警徽不可移交给原警长。
- 白狼王：自爆带人、最后一狼自爆不带人、带走最后一神触发狼胜。
- 胜负：狼全灭好人胜；神全灭或民全灭狼胜；夜间结算、放逐、自爆后均在 `CHECK_WIN` 自动判定。

## 说明

- `SETTLE` 阶段不会自动放逐致死：需先 `RESOLVE_EXILE` 处理白痴翻牌/死亡，再处理猎人/警徽，最后 `SETTLE_DONE`。
- P1 服务端视图生成（`buildViews`）不在本任务范围（M2 T-033）。
- T-027 的 `RESOLVE_WIN` 调用已同步改为无参自动判定，原 21 个状态机用例全部通过。
- 功能测试复验（2026-11-26）：基于构建产物跑通夜间结算、白痴翻牌、猎人开枪/被毒、白狼王自爆与最后狼胜负，见[功能测试报告](../functional-test-20261126.md)。
