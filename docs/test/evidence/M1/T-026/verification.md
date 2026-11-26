# T-026 板子/角色配置验证证据

- 日期：2026-11-26
- 环境：Windows 11 / Node v24.22.3 / npm 11.19.1
- 任务：[STEP-5C T-026](../../../plan/tasks/M1/STEP-5C.md#t-026)
- 依据：PRD v1.3.2 附录 A / 附录 B

## 产出

- `packages/game-engine/src/roles.ts`：8 个角色的阵营、类别、夜间动作、技能与限制元数据。
- `packages/game-engine/src/boards.ts`：两套 12 人板子配置、板子查询与 `validateBoard` 配置校验。
- `packages/game-engine/src/boards.test.ts`：板子构成、夜序、选项与校验用例。
- `packages/game-engine/src/index.ts`：导出角色/板子 API。

## 命令结果

| 命令 | 结果 | 说明 |
| --- | --- | --- |
| `npm run typecheck -w @lrs/game-engine` | 通过 | TS strict 无错误 |
| `npx vitest run packages/game-engine/src` | 通过 | 2 个文件、17 个用例 |
| `npm run lint` | 通过 | 无警告 |
| `npm run format:check` | 通过 | Prettier 全部匹配 |
| `npm test` | 通过 | 4 个文件、19 个用例 |
| `npm run build` | 通过 | 全部 workspace 构建成功 |

## 用例覆盖（AC-4 配置部分）

- 预女猎守：预言家/女巫/猎人/守卫各 1、平民 4、普通狼 4；夜序 守卫 → 预言家 → 狼人 → 女巫。
- 预女猎白：预言家/女巫/猎人/白痴各 1、平民 4、普通狼 3、白狼王 1；夜序 预言家 → 狼人 → 女巫。
- 两板子均满足 12 人、好人 8 / 狼人 4、屠边胜负口径。
- 角色元数据与附录 A 一致：守卫不可连守/可自守/不防毒；女巫每夜一瓶/首夜可自救；猎人被毒或被白狼王带走不可开枪；白痴翻牌免死无投票；白狼王随狼人行动、非自爆不可发动。
- 校验拒绝：非 12 人、角色总数不符、重复角色、非法数量、狼人总数不为 4、非法狼人构成、夜序缺角色/多角色/重复/含无夜间动作角色、未知角色。

## 说明

- 本任务只提供配置数据与校验，不包含状态机、胜负判定与视图生成（T-027/T-028）。
- `nightOrder` 只列独立夜间步骤；白狼王随狼人行动，不出现在夜序中。
- 功能测试复验（2026-11-26）：基于构建产物调用配置与校验通过，见[功能测试报告](../functional-test-20261126.md)。
