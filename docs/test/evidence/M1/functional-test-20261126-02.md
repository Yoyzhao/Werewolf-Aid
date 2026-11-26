# M1 已完成任务功能测试报告（第二轮）

- 日期：2026-11-26
- 测试基线：commit `51f9cd7`（工作区干净）
- 类型：开发期功能测试（非步骤 8 完整测试；不替代 test-plan/test-cases/test-report）
- 范围：T-015、T-026、T-027、T-028（回归）；T-029 开局与三种发牌、T-030 夜间/竞选/死讯/发言、T-031 投票/结算/本地能力（本轮新增覆盖）
- 环境：Windows 11 / Node v24.22.3 / npm 11.19.1 / Vitest 5.1.2 / Playwright 1.65.1（headless Chromium）/ Vite 8.3.8
- 结论：已完成任务功能全部通过，未发现新增缺陷

## 测试项与结果

| 编号 | 测试项 | 方法 | 结果 |
| --- | --- | --- | --- |
| FT-12 | 静态门控 | `npm run lint`、`format:check`、`typecheck` | 通过：0 警告、格式全通过、5 个 workspace 类型检查通过 |
| FT-13 | 单元/组件测试 | `npm test` | 通过：8 个文件、85 个用例（engine 57、shared 1、web 组件 27） |
| FT-14 | 全量构建 | `npm run build` | 通过：shared/game-engine/rules-content/web/api 全部构建成功 |
| FT-15 | 构建产物加载 | `npm run verify:dist` | 通过：shared、game-engine、rules-content、api 四个 dist 入口可被 Node ESM 加载 |
| FT-16 | API 健康检查 | 启动 `apps/api/dist/server.js`，请求 `GET /api/v1/health` | 通过：`{"ok":true,"version":"0.1.0"}`，请求后进程正常停止 |
| FT-17 | 生产构建渲染 | `vite preview` :4173，Chromium 390×844 与 320×640 | 通过：HTTP 200、标题“狼人杀助手”、首页内容渲染、无 console/page error、无横向滚动 |
| FT-18 | 开局与三种发牌 | 组件测试 + `setup-deal.spec.ts`（3 例） | 通过：模式 A 遮罩推进、B 二次揭示、C 逐号录入/余量禁用/撤销/构成校验、12 人进夜、刷新恢复、320/430 |
| FT-19 | 夜间/竞选/死讯/发言 | 组件测试 + `night-day.spec.ts`（2 例） | 通过：夜序与私密结果、女巫用药、竞选/PK/无警长、死讯/遗言/猎人开枪/警徽、发言起点与自爆 |
| FT-20 | 投票/结算/本地能力 | 组件测试 + `vote-result.spec.ts`（5 例） | 通过：逐票与警长 1.5 票、平票 PK、白痴翻牌、猎人开枪、结算与再来一局、刷新恢复、断网继续、只读结算 |
| FT-21 | 端到端全量 | `npm run e2e` | 通过：11/11（含 smoke、320/430 无横向滚动断言），9.5s |
| FT-22 | 首屏性能预算 | 构建产物 gzip 体积 | 通过：首屏 JS 108.28 kB gzip（预算 ≤250 kB）；CSS 7.26 kB gzip |

## 任务覆盖对照

| 任务 | 功能点 | 覆盖方式 | 结果 |
| --- | --- | --- | --- |
| T-015 | 工作区、构建、CI、API health | build、verify:dist、health、e2e smoke | 通过 |
| T-026 | 两板子构成、夜序、板子校验 | `boards.test.ts`（16 例） | 通过 |
| T-027 | 阶段流转、竞选、逐票、自爆、快照 | `state-machine.test.ts`（21 例）+ UI 流程 | 通过 |
| T-028 | 夜间结算、技能、警徽、屠边胜负 | `rules.test.ts`（19 例）+ 组件流程 | 通过 |
| T-029 | A/B/C 发牌、刷新恢复、引导与能力提示 | 组件 8 例 + e2e 3 例 | 通过 |
| T-030 | 夜间、竞选、死讯、遗言、发言、自爆 | 组件 10 例 + e2e 2 例 | 通过 |
| T-031 | 投票、结算、快照回退、本地持久化 | 组件 9 例 + e2e 5 例 | 通过 |

## 未覆盖与限制

- Wake Lock 真实防熄屏行为与 iOS Safari 未验证，需真机，归 T-021/T-022。
- 模式 A/B 仅组件级验证；端到端仅覆盖模式 C 全流程（与 e2e 设计一致）。
- UC/QQ/微信内置浏览器、DPR 2–3 真机渲染未验证，归 T-021。
- P1 联机与 AI 助手（T-018/T-032/T-019）未实现，不在本轮范围。
- Fastify 提供 SPA 静态服务属 T-019（5D），未验证。
- 本轮未执行性能曲线与压力测试（属步骤 8 范围）。

## 发现项与建议（非阻断）

- e2e 用例将截图直接写入 `docs/test/evidence/M1/T-030/`、`T-031/` 的固定路径，重复执行会覆盖已归档证据。本轮执行后 `speech-390.png`、`settle-430.png` 发生变化，已还原至提交版本。
- 后续处理（2026-11-26）：已将 e2e 自动截图输出改到 `.artifacts/e2e/`（按任务分子目录），历史证据保持只读；`docs/test/evidence/` 仅在任务验收时归档定稿截图。

## 结论

已完成的 5C 任务功能测试通过：静态门控、85 个单测、e2e 11/11、API 健康检查、生产构建预览冒烟全部通过，首屏 JS 低于预算；未发现新增缺陷，无需新增 Bug 记录。
