# M1 已完成任务功能测试报告

- 日期：2026-11-26
- 范围：T-015 工程脚手架、T-026 板子/角色配置、T-027 状态机、T-028 冲突/技能/胜负
- 环境：Windows 11 / Node v24.22.3 / npm 11.19.1 / 本机 Chrome（Playwright e2e）
- 结论：功能通过；发现并修复 1 个构建产物加载缺陷（FT-20261126-01），全量门控复验通过

## 测试项与结果

| 编号 | 测试项 | 方法 | 结果 |
| --- | --- | --- | --- |
| FT-01 | 构建产物可被 Node ESM 加载 | `npm run verify:dist` 实际 import 四个 dist 入口 | 通过（修复后） |
| FT-02 | API 健康检查 | 启动 `apps/api/dist/server.js`，请求 `GET /api/v1/health` | 通过：`{"ok":true,"version":"0.1.0"}` |
| FT-03 | Web 脚手架渲染 | `npx playwright test`（本机 Chrome，`smoke.spec.ts`） | 通过：1/1，385ms |
| FT-04 | 板子配置与校验 | 构建产物调用 `validateBoard` / `getBoard` | 通过：两板子合法，夜序一致 |
| FT-05 | 预女猎守完整对局 | 构建产物驱动 3 夜 + 竞选 + 猎人 + 放逐 + 结算 | 通过：好人胜，`result.winner=good` |
| FT-06 | 预女猎白技能链 | 白痴翻牌、猎人被毒、白狼王自爆带人 | 通过 |
| FT-07 | 白狼王自爆 | 自爆 → 带人 → 自爆结算 → 下一夜 | 通过 |
| FT-08 | 最后一狼自爆 | 最后一狼自爆不带人 → 好人胜 | 通过 |
| FT-09 | 非法操作拦截 | 错误阶段、错误构成、连守、空刀解药 | 通过：均返回预期错误码 |
| FT-10 | 快照回退 | 推进后 `restoreSnapshot` | 通过：回到推进前状态且深拷贝 |
| FT-11 | 全量质量门控 | lint / format:check / typecheck / test / build | 通过：6 个测试文件、59 个用例 |

## 缺陷记录

### FT-20261126-01 构建产物相对导入缺少扩展名

- **现象**：`node` 直接 `import` `packages/game-engine/dist/index.js` 报 `ERR_MODULE_NOT_FOUND: .../dist/roles`。
- **根因**：TypeScript 在 `moduleResolution: Bundler` 下允许无扩展名相对导入，构建产物保留 `./roles`，Node ESM 不做扩展名补全。
- **影响**：单元测试走源码不受影响，但后续 `apps/api` 在运行时复用 `game-engine` 会加载失败；原门控只验证构建成功、不加载产物。
- **修复**：`game-engine` 源码相对导入统一改为 `.js` 说明符（`./roles.js` 等），TypeScript、Vitest、Vite 均正常解析；新增 `scripts/verify-dist.mjs` 与 `npm run verify:dist`，CI 在 build 后执行。
- **复验**：`npm run verify:dist` 通过；全量 lint/format/typecheck/test/build 通过；引擎完整对局脚本 7/7 通过。

## 功能测试结论

- T-026：两套板子构成、夜序、角色元数据与配置校验符合 PRD 附录 A/B。
- T-027：完整阶段流转、竞选、逐票投票、PK、自爆中断、快照回退均可运行。
- T-028：夜间结算、技能、警徽、屠边胜负在真实调用链中行为正确。
- T-015：API、Web e2e、构建产物加载均可用。

## 限制与说明

- 本机 Playwright Chromium 下载未完成（后台任务停在约 40%），e2e 使用系统 Chrome（临时 `channel: 'chrome'`，已还原配置）；CI 仍使用 `npx playwright install chromium`。
- 引擎完整对局脚本为临时功能测试脚本，不进入仓库；等价路径已由 `rules.test.ts`、`state-machine.test.ts` 覆盖。
- 业务页面（开局/发牌、夜间、投票、结算、助手）尚未实现，不在本次已完成任务范围内。
