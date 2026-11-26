# T-030 夜间、竞选、死讯与发言验证证据

- 日期：2026-11-26
- 环境：Windows 11 / Node v24.22.3 / npm 11.19.1 / 本机 Chrome（e2e 与截图）
- 任务：[STEP-5C T-030](../../../plan/tasks/M1/STEP-5C.md#t-030)
- 依据：interaction-spec v1.1 第 5.3/5.4/5.5 节；PRD v1.3.2 7.2/3.7 与 AC-3/AC-4/AC-16

## 产出

- `apps/web/src/features/night/NightScreen.tsx`：夜序队列、角色口播、目标选择、空守/空刀/不用药、狼队名单、预言家私密结果、女巫用药与刀口提示、步骤推进与天亮结算。
- `apps/web/src/features/sheriff/SheriffScreen.tsx`：上警报名、竞选发言打卡、退水、警下投票、平票 PK、当选/无警长、公布死讯。
- `apps/web/src/features/dawn/DawnScreen.tsx`：平安夜/死讯与死因、首夜遗言打卡、猎人开枪、警徽移交/撕毁。
- `apps/web/src/features/speech/SpeechScreen.tsx`：发言起点（默认首名死者下一位、可指定）、顺时针顺序、发言打卡、自爆入口、进入投票。
- `apps/web/src/features/shared/SelfExplode.tsx`：自爆二次确认、白狼王带人、警徽处理与自爆结算。
- `apps/web/src/features/stage/StagePlaceholder.tsx`：投票/结算占位（T-031 已替换为 `VoteScreen`/`ResultScreen`）。
- `apps/web/src/stores/game-store.ts`：`dispatch` 统一动作入口；`CHECK_WIN` 自动 `RESOLVE_WIN`；`viewForPhase` 覆盖竞选/死讯/发言/自爆中断。
- `apps/web/src/components/DaySubFlow.tsx`：首日竞选 4 步子流程与平日 3 步切换。
- `apps/web/src/App.flow.test.tsx`：T-030 组件测试 10 例。
- `tests/e2e/night-day.spec.ts`：首夜→竞选→死讯→发言→投票占位 e2e，320/430 无横向滚动断言。

## 验证结果

| 验证项 | 结果 |
| --- | --- |
| `npm run lint` | 通过 |
| `npm run format:check` | 通过 |
| `npm run typecheck` | 通过（全部 workspace） |
| `npm test` | 通过：7 个文件、76 个用例（新增 T-030 10 例） |
| `npm run build` | 通过 |
| `npm run verify:dist` | 通过 |
| `npx playwright test` | 通过：6 个用例（新增 2 例） |

## AC-3 / AC-4 覆盖

- 夜序：预女猎守按 守卫 → 预言家 → 狼人 → 女巫；每步必须记录目标或显式空操作才可推进；最后一步“天亮了，结算夜晚”由引擎结算死亡/平安夜并进入 `CHECK_WIN`。
- 守卫：可空守；界面显示上一夜守护对象；连守由引擎拒绝并 toast。
- 预言家：点选目标后立即显示“X 号是狼人/好人（仅主持端可见）”，不进入公开事件。
- 狼人：狼队名单仅主持端显示；单目标录入，可空刀/自刀；意见不一致由主持人执行空刀。
- 女巫：显示“今晚 X 号被刀（仅女巫可见）”；空刀时解药禁用；解药只能救当夜被刀者；毒药需先选药再点座位；每夜一瓶与药瓶耗尽由引擎校验。
- 竞选：报名（首夜死者不可选）→ 发言打卡 → 退水 → 警下投票（警上无票、弃票不计）→ 平票 PK → 再平无警长；无人上警可直接“本局无警长”；当选写入 `sheriffNo`。
- 死讯：平安夜与出局名单二选一，出局显示死因（被狼刀/被毒/同守同救等）；首夜死亡有遗言打卡，第 2 夜及以后显示“本夜无遗言”。
- 技能：猎人被刀在 DAWN 开枪，可选存活目标或跳过；警长死亡可移交（不可移交自己）或二次确认撕毁。
- 发言：默认从首名死者下一位顺时针；无死亡从 1 号；可指定起始座位；发言打卡不阻塞；自爆二次确认后进入 `SELF_EXPLODE`，处理白狼王带人/警徽后 `CHECK_WIN`。
- 视图与落库：`dispatch` 成功即写入 IndexedDB；`CHECK_WIN` 自动结算胜负并映射到竞选/死讯/发言/下一夜/结算页。

## 组件测试（App.flow.test.tsx，10 例）

- 夜间 2 例：完整夜序（空守、查验私密结果、狼队名单、解药）；空刀禁解药、毒药结算进入死讯。
- 竞选 3 例：报名→发言→退水→警下投票→当选；无人上警无警长；平票 PK 再平无警长。
- 死讯 3 例：首夜死讯/遗言/猎人开枪并进入发言（默认从死者下一位）；第 2 夜无遗言与警徽移交；警徽撕毁二次确认。
- 发言 2 例：默认起点与指定起点重排、进入投票；自爆中止发言并进入下一夜。

## 布局与性能

- 走查截图（`docs/test/evidence/M1/T-030/`）：
  - `night-guard-390.png`：夜间守卫步骤卡与 3 列座位网格。
  - `sheriff-signup-390.png` / `sheriff-430.png`：竞选报名与白天 4 步子流程。
  - `dawn-peace-390.png`：平安夜死讯。
  - `speech-390.png` / `speech-320.png`：发言列表与 320px 压缩布局。
  - `vote-entry-390.png`：发言完成后的投票入口（T-031 已接入实际投票页）。
- 320/430 宽度在夜间、竞选、死讯、发言均无页面横向滚动（e2e 断言通过）。
- 构建：首屏 JS `107.90 kB gzip`（≤250 KB 预算）；CSS `7.02 kB gzip`；夜间/竞选/死讯/发言/占位页均按路由懒加载拆包（单页 1.25–2.84 kB gzip）。

## 说明与限制

- 夜间不做“回退一步”，按契约留给 T-031 的快照回退能力。
- 遗言/发言打卡为本地主持辅助状态，不写入对局快照；进入下一步后不保留打卡。
- 投票/结算页在 T-030 时为占位，T-031 已实现完整投票与结算闭环。
- Playwright 默认 Chromium v1255 已安装；后续全量 e2e 以默认 Chromium 复跑通过（11/11）；CI 使用 `npx playwright install chromium`。
