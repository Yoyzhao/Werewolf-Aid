# T-031 投票、结算与本地能力验证证据

- 日期：2026-11-26
- 环境：Windows 11 / Node v24.22.3 / npm 11.19.1 / 本机 Chrome（e2e 与截图）
- 任务：[STEP-5C T-031](../../../plan/tasks/M1/STEP-5C.md#t-031)
- 依据：interaction-spec v1.1 第 5.4/5.5/6/8/9 节；PRD v1.3.2 3.7.4/3.7.7/3.7.8 与 AC-1/AC-3/AC-5/AC-11/AC-16/AC-18

## 产出

- `apps/web/src/features/vote/VoteScreen.tsx`：逐票录入与快速归票、弃票、警长 1.5 票、平票 PK 复投、票数汇总、放逐二次确认；放逐后白痴翻牌、猎人开枪、警徽移交/撕毁。
- `apps/web/src/features/result/ResultScreen.tsx`：胜负与原因、12 人身份揭晓、逐夜私密记录（守护/查验/狼刀/用药）、关键事件时间线；再来一局、返回首页、清除本局。
- `apps/web/src/components/UndoButton.tsx`：通用“回退一步”二次确认按钮，接入夜间/竞选/死讯/发言/投票/自爆与结算前的操作页。
- `apps/web/src/stores/game-store.ts`：30 条快照历史、`undoStep`、`playAgain`、`clearGame`；投票提交后自动结算放逐；快照随对局落库。
- `apps/web/src/lib/types.ts`：`StoredGameRecord.history` 持久化字段（兼容旧记录，缺省为空）。
- `apps/web/src/App.tsx`：接入投票/结算页，投票页纳入 Wake Lock 活跃视图；删除 T-030 占位页。
- `apps/web/src/components/ResumeBanner.tsx`：已完成对局可直接“查看上一局结果”。
- `apps/web/src/features/deal/DealScreen.tsx`：发牌“回退一步”增加二次确认。
- `apps/web/src/styles.css`：投票行、票数汇总、结算身份网格、事件行与禁用按钮样式。
- `apps/web/src/App.vote.test.tsx`：T-031 组件测试 9 例。
- `tests/e2e/helpers.ts`、`tests/e2e/vote-result.spec.ts`：投票/结算 e2e 5 例；T-030 e2e 复用共享 helper。

## 验证结果

| 验证项 | 结果 |
| --- | --- |
| `npm run lint` | 通过 |
| `npm run format:check` | 通过 |
| `npm run typecheck` | 通过（全部 workspace） |
| `npm test` | 通过：8 个文件、85 个用例（新增 T-031 9 例） |
| `npm run build` | 通过 |
| `npm run verify:dist` | 通过 |
| `npx playwright test` | 通过：11 个用例（新增 5 例） |

## AC 覆盖

- **AC-1 / AC-3（投票与技能）**：逐票录入、快速归票、弃票；警长票 1.5；平票 PK 复投、再平本轮无人出局；白痴翻牌后无票且不再是目标；白痴被放逐免死并失去投票权；猎人被放逐在放逐结算中开枪；警长死亡移交/撕毁警徽；放逐后技能处理完成再检查胜负。
- **AC-5（断网继续）**：页面加载后断网，投票与票数汇总仍可完成，IndexedDB 正常写入，无网络错误阻塞。
- **AC-11（本地数据管理）**：结算页“清除本局”二次确认后删除本地对局并返回首页；助手记录清空属 T-018。
- **AC-16（布局）**：投票、放逐结果、结算页在 320/430 宽度无横向滚动；主按钮位于底部操作坞；触控按钮 ≥44px。
- **AC-18（回退/二次确认）**：夜间推进后“回退一步”经确认恢复到上一步，快照同步落库；发牌回退、放逐提交、清除本局均二次确认；结算页不可回退。

## 数据与恢复

- 每步 `dispatch` 成功即写入 IndexedDB；投票提交会生成快照，回退可恢复到投票前并重写存储。
- 刷新后首页出现“继续上一局”，恢复到投票页并保留已录选票与 PK 轮次（e2e 已验证）。
- `status=finished` 的只读结果保留在本机，刷新后可从首页“查看上一局结果”进入，不重新结算。
- 快照栈上限 30；纯 UI 状态（录票弹层、发言打卡、焦点）不进入快照。
- Wake Lock：发牌至投票阶段保持请求，结算/清除/返回首页释放；投票页已纳入活跃视图。

## 布局与性能

- 走查截图（`docs/test/evidence/M1/T-031/`）：`vote-390.png`、`vote-320.png`、`settle-390.png`、`settle-430.png`、`result-390.png`。
- 320/430 宽度在投票、放逐结果、结算页均无横向滚动（e2e 断言通过）。
- 构建：首屏 JS `108.28 kB gzip`（≤250 KB 预算）；CSS `7.26 kB gzip`；投票/结算页按路由懒加载（VoteScreen 4.03 kB、ResultScreen 3.04 kB gzip）。

## 说明与限制

- Playwright 默认 Chromium v1255 已安装，e2e 使用默认浏览器通过 11/11；`playwright.config.ts` 未保留 `channel` 覆盖；CI 使用 `npx playwright install chromium`。
- AC-11 中“助手记录清空”属 T-018 范围；本任务只完成对局记录清除。
- 回退为单步栈式恢复，不做分支重放；结算后不可回退（符合契约）。
- P1 联机结算、服务端快照删除不在本任务范围。
