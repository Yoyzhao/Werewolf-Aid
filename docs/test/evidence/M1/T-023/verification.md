# T-023 测试执行报告（阶段 8）

- 日期：2026-11-26
- 任务：T-023 测试计划与全量回归
- 基线：P0 验收通过后的工作区（未提交变更）；PRD v1.3.2；api-contract v1.1
- 用例依据：[test-cases.md](../../../test-cases.md)
- 方式：Vitest 全量单测/组件/API + Playwright 全量 e2e + 生产构建门控 + 8 视口移动端实验室审计 + API 黑盒冒烟
- 结论：**自动化全量回归通过，无 P0 阻断缺陷**；真机矩阵与真实 AI 供应商未执行，按阻塞记录（不视为通过）

## 1. 环境

| 项 | 值 |
| --- | --- |
| 操作系统 | Windows 11 |
| Node.js / npm | v24.22.3 / 11.19.1 |
| 浏览器 | Playwright Chromium（桌面内核） |
| Web/API | Vite 8.3.8 dev 5173 + Fastify 5 dev 3000；生产构建预览 4173（预览代理 `/api` → 3000） |
| 移动端 | 320/360/390/393/412/430/440 CSS 宽度（DPR 2–3）；1440×900 PC |
| 覆盖率 | V8（`vitest --coverage`） |

## 2. 门控执行结果

| 项目 | 命令 | 结果 | 日志 |
| --- | --- | --- | --- |
| Lint | `npm run lint` | 通过（0 error / 0 warning） | [gates.log](gates.log) |
| 格式 | `npm run format:check` | 通过 | [gates.log](gates.log) |
| 类型 | `npm run typecheck` | 5 个 workspace 全部通过 | [gates.log](gates.log) |
| 单测/组件/API | `npm test` | **242/242 通过**（19 个文件，9.93s） | [unit-tests.log](unit-tests.log) |
| E2E | `npm run e2e` | **24/24 通过**（6 workers，12.8s） | [e2e.log](e2e.log) |
| 构建 | `npm run build` | 通过；首屏 JS **136.45 kB gzip**、CSS 8.10 kB gzip，无路由 chunk | [build.log](build.log) |
| 产物校验 | `npm run verify:dist` | 通过（shared / game-engine / rules-content / api） | [verify-dist.log](verify-dist.log) |
| 覆盖率 | `npx vitest run --coverage` | 全项目 85.57% stmts / 87.34% lines；`apps/api/src` 91.37% / 92.70%；`apps/web/src` 82.85% / 80.76%（含 0 覆盖的 `main.tsx`、`styles.css`） | [coverage.log](coverage.log) |
| 移动端审计 | `node scripts/test-script/audit-mobile.mjs http://localhost:4173` | 8 视口 + 3 条全流程 + 125% 字体 + DPR 2/3：横向滚动 0、触控 <44px 0、对比度问题 0、console error 0 | [mobile-audit.json](mobile-audit.json)、[mobile-audit.log](mobile-audit.log) |
| API 黑盒冒烟 | PowerShell 对 dev API 实测 | 7/7 通过 | [api-smoke.log](api-smoke.log) |

### API 黑盒冒烟明细

| 检查 | 期望 | 实测 |
| --- | --- | --- |
| `GET /api/v1/health` | 200 + `ok` | 200 `{"ok":true,"version":"0.1.0"}` |
| `GET /api/v1/session` | 200 + CSRF + Cookie | 200，64 字符 token，1 个 Cookie |
| 无会话调用 `POST /api/v1/ai/relay` | 401 | 401 `UNAUTHORIZED` |
| 有会话无 CSRF | 403 | 403 `FORBIDDEN` |
| 私网地址（`https://10.0.0.1`） | 400 拒绝 | 400 `URL_NOT_ALLOWED` |
| 非法 JSON | 400 | 400 `INVALID_REQUEST` |
| `GET /api/v1/nope` | 404 JSON | 404 `NOT_FOUND` |

### 移动端审计摘要

- 首页/开局设置/助手/规则 4 页面 × 8 视口：`overflow=0`、`touch=[]`、`contrast=[]`。
- 360/390/412 全流程（夜间→竞选→死讯→发言→投票）：各阶段 `overflow=0`、`touch=[]`。
- 125% 字体：首页/设置/助手 `overflow=0`；DPR 2/3 无异常；390 首页/助手 rAF 60fps，P95 帧间隔 16.7ms（仿真）。
- 首屏加载：4 请求 / 1 个脚本 / 132 kB 脚本传输 / 142 kB 总传输。
- 执行说明：预览服务器复用 `server.proxy`，审计时需同时启动 API；未启动 API 时 `/api/v1/session` 会返回 502（环境问题，非产品缺陷）。本轮已在 API 可用状态下复跑，错误为 0。

## 3. AC 覆盖结论

| AC | 结论 | 依据 |
| --- | --- | --- |
| AC-1 | 自动化通过；真人 12 人局未执行 | `system.spec.ts` 两板子全流程；真人项需用户组织 |
| AC-2 | 通过 | 模式 A/B/C e2e + 组件/引擎单测 |
| AC-3 | 通过 | 引擎 56 个规则用例（同守同救、药剂、连守、1.5 票、PK、白痴、警徽、自爆、白狼王、猎人） |
| AC-4 | 通过 | `boards.test.ts`、`rules-content` 7 单测、两板子 e2e 结算 |
| AC-5 | 通过（修复后） | 断网首日 e2e、断网投票 e2e；P0 页面静态打包 |
| AC-6 | 通过 | 遮罩/二次揭示 e2e；本地记录无服务端存储 |
| AC-7 | 通过 | 助手刷新保留、未配置 Key 提示 |
| AC-8 | 通过 | 标签/信息/发言要点进入上下文预览 |
| AC-9 | 实验室通过（mock 上游）；真实供应商未执行 | `assistant-ai.spec.ts` 成功链路 |
| AC-10 | 通过 | Key 无效/URL 不允许/超时/取消（组件 + 真实 API 拒绝私网） |
| AC-11 | 通过 | 清空助手记录保留 AI 配置 e2e |
| AC-16 | 实验室通过；真机矩阵阻塞 | 8 视口审计；真机见 §4 |
| AC-17 | 包体与实验室性能通过；真机性能阻塞 | 136.45 kB gzip；T-021 Lighthouse 100/100/100 基线 |
| AC-18 | 通过 | 回退二次确认、投票/放逐确认、快照一致性用例 |

## 4. 未执行 / 阻塞

| 项 | 状态 | 说明 | 解除条件 |
| --- | --- | --- | --- |
| AC-16 真机矩阵（iOS Safari、Android Chrome、微信、UC、QQ） | **阻塞** | 当前无对应设备/系统 | 借测设备或 T-024 预发布环境抽测 |
| AC-17 真机性能（5G/Wi-Fi、4G/弱网、真机帧率、安全区、输入法、Wake Lock） | **阻塞** | 无真机 | 同上 |
| AC-9 真实 AI 供应商 | **未执行** | 成功链路为 mock；失败链路已用真实 API 验证 | 用户自备端点/Key 在预发布复跑 |
| AC-1 真人 12 人新手主持 | **未执行** | 需真实玩家组织 | 用户组织一局预女猎守 |

> 以上均不得标记为通过；真机项须在 T-024 部署前完成，或由用户在阶段 8 验收时再次决定风险接受。

## 5. 缺陷

- 本轮未发现新增缺陷。
- 历史缺陷 T022-01（断网后路由 chunk 加载失败导致空白）已修复并在本轮 e2e 回归通过，首屏 136.45 kB gzip 仍低于 250 kB 预算。
- 已知 P1（非 P0 阻断）：`wake-lock.ts`、`capabilities.ts` 等降级分支单测覆盖较低；不影响主持闭环。

## 6. 结论与建议

1. 自动化测试、构建门控、API 安全冒烟、移动端实验室审计全部通过，**无 P0 阻断**，满足进入 T-024 的条件。
2. T-023 记为**有条件完成**：真机矩阵与真实 AI 供应商为未执行阻塞项，需在部署前把关。
3. 建议阶段 8 验收时由用户确认：
   - 是否接受当前实验室证据进入 T-024，并在预发布环境完成真机抽测；
   - 是否组织一次真人 12 人局完成 AC-1 正式验收。

## 7. 复测记录（2026-11-26 16:24–16:25）

按用户要求对 T-023 执行第二轮完整复测，结果与首轮一致：

| 项目 | 结果 | 复测日志 |
| --- | --- | --- |
| lint / format:check / typecheck | 通过 | [retest-gates.log](retest-gates.log) |
| 单测/组件/API | 242/242 通过（19 文件） | [retest-unit.log](retest-unit.log) |
| E2E | 24/24 通过（12.7s） | [retest-e2e.log](retest-e2e.log) |
| build / verify:dist | 通过；首屏 JS 136.45 kB gzip | [retest-build.log](retest-build.log)、[retest-verify-dist.log](retest-verify-dist.log) |
| 移动端审计 | 8 视口 + 3 全流程 + 125% 字体 + DPR 2/3：问题均为 0，console error 0 | [retest-mobile-audit.json](retest-mobile-audit.json)、[retest-mobile-audit.log](retest-mobile-audit.log) |
| API 黑盒冒烟 | 7/7 通过 | [retest-api-smoke.log](retest-api-smoke.log) |

- Playwright 启动阶段日志出现 1 条 `ECONNREFUSED 127.0.0.1:3000`：Web 5173 先于 API 3000 就绪时的代理探测，测试用例随后全部通过，不影响结论。
- 复测未发现新增缺陷；真机矩阵、真实 AI 供应商、真人 12 人局仍为未执行阻塞项。
