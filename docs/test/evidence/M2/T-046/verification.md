# T-046 P1 测试与全量回归报告

- 日期：2026-11-27
- 任务：T-046（M2 / STEP-8）
- 基线：P0 测试基线（T-023）+ P1 验收（T-045）；PRD v1.3.2、api-contract v1.1、interaction-spec v1.2
- 用例依据：[P0 + P1 测试计划与用例](../../../test-cases.md)
- 方式：Vitest 全量单测/组件/API/WS + Playwright 全量 e2e + 构建门控 + P1 安全黑盒 + 10 房间压测 + 移动端实验室审计
- 结论：**有条件完成**；自动化全量回归、P1 安全与实验室压测通过，无 P0/P1 阻断缺陷；真机、真实 AI、真人 12 人局与线上环境按阻塞记录

## 1. 环境

| 项 | 值 |
| --- | --- |
| 操作系统 | Windows 11 |
| Node.js / npm | v24.22.3 / 11.19.1 |
| 浏览器 | Playwright Chromium 1.65（桌面内核） |
| Web/API | Vite 8.3.8 dev 5173 + Fastify 5 dev 3000；生产预览 4173 |
| P1 后端 | SQLite WAL（`apps/api/data/lrs.sqlite`）+ Socket.IO `/ws/rooms` |
| 移动端实验室 | 320/360/390/393/412/430/440/1440；DPR 2/3；125% 字体 |
| 覆盖率 | V8（`vitest run --coverage`） |

## 2. 全量门控

| 项目 | 命令 | 结果 | 日志 |
| --- | --- | --- | --- |
| Lint | `npm run lint` | 通过（0 error / 0 warning） | [gates.log](../gates.log) |
| 格式 | `npm run format:check` | 通过 | [gates.log](../gates.log) |
| 类型 | `npm run typecheck` | 5 个 workspace 通过 | [gates.log](../gates.log) |
| 单测/组件/API/WS | `npm test` | **340/340**（33 文件） | [unit-tests.log](../unit-tests.log) |
| E2E | `npm run e2e` | **41/41**（6 workers，33.6s） | [e2e.log](../e2e.log) |
| 构建 | `npm run build` | 通过；首屏 JS **207.14 kB gzip**、CSS 8.53 kB gzip | [build.log](../build.log) |
| 产物校验 | `npm run verify:dist` | 通过（含 PWA manifest/SW/precache） | [verify-dist.log](../verify-dist.log) |
| 覆盖率 | `npx vitest run --coverage` | 全项目 82.39% stmts / 84.76% lines；`apps/api/src` 88.07% / 90.24%；`apps/web/src` 87.32% / 84.9% | [coverage.log](coverage.log) |
| P1 安全黑盒 | `npm run test:p1-security` | 通过（15/15 检查） | [security-check.json](security-check.json) |
| P1 压测 | `npm run test:p1-load` | 通过（10 房间 / 130 会话 / 120 WS） | [load-check.json](load-check.json) |
| 移动端审计 | `node scripts/test-script/audit-mobile.mjs http://localhost:4173` | 8 视口 + 3 全流程 + 125% 字体 + DPR 2/3：问题 0 | [mobile-audit.json](mobile-audit.json)、[mobile-audit.log](mobile-audit.log) |

## 3. P1 功能与 AC 覆盖

### 3.1 AC 结论

| AC | 结论 | 依据 |
| --- | --- | --- |
| AC-1～AC-11（P0） | 自动化回归通过；真人 12 人局未执行 | 41 条 e2e 全部通过；T-023 基线 |
| AC-12 | 通过 | 加入确认 1539ms；5s 轮询降级；重连版本补齐；[T-045](T-045/verification.md) |
| AC-13 | 通过 | 玩家视图仅本人信息；越权读写 403；抢座 409；[T-045](T-045/verification.md) |
| AC-14 | 通过 | 结算/解散后 SQLite 四表归零、API 404；[T-045](T-045/verification.md) |
| AC-15 | Chrome 通过；iOS/微信阻塞 | `pwa.spec.ts` 3 例（离线冷启动、manifest/SW、更新提示）；真机见 §6 |
| AC-16/AC-17 | 实验室通过；真机阻塞 | 8 视口审计问题 0；首屏 207.14 kB gzip；真机见 §6 |
| AC-18 | 通过 | 回退/二次确认 e2e 与组件测试 |
| AC-19 | 通过 | 旧版本 409；版本递增；重连读取最新；[T-045](T-045/verification.md) |
| P1-1～P1-8 | 通过 | 见 [test-cases.md](../../../test-cases.md) 的 P1 矩阵；房间 API 18 例、WS 6 例、视图 13 例、时间线/术语/笔记/过滤/PWA e2e |

### 3.2 分层结果

- 单测/组件/API/WS：340 例，覆盖游戏引擎、房间生命周期、视图过滤、WS 握手/推送/Origin、快照版本、结算删除、主持/玩家 UI、时间线、术语/搜索、笔记、AI 过滤、PWA。
- E2E：41 例，含 P0 主持闭环、断网、模式 A/B/C、助手、规则、时间线、笔记、P1 房间主链路、AC-12/13/14/19、PWA 离线与更新。
- 本轮未修改产品代码；新增 P1 安全与压测脚本。

## 4. 性能与压测

[load-check.json](load-check.json)：

| 指标 | 结果 | 门限 | 结论 |
| --- | --- | --- | --- |
| 房间 / 会话 | 10 房间；10 主持 + 120 玩家 = 130 会话 | 10 / 130 | 通过 |
| WS 连接 | 120/120 成功 | 120 | 通过 |
| 建局准备 | 321ms | — | 记录 |
| WS 端到端 | P50 13ms / P95 24ms / max 24ms | P95 ≤2s | 通过 |
| 5s 轮询可见 | P50 2379ms / P95 4773ms / max 4976ms | P95 ≤5s | 通过 |
| 错误 | 连接/推送/轮询错误 0 | 0 | 通过 |

说明：压测为本地单实例、临时 SQLite（3112 端口），10 个房间同时写快照；轮询客户端按 5s 周期、相位分散模拟真实轮询。线上网络与 130 连接真实设备压测列入 T-047。

## 5. 安全

[security-check.json](security-check.json)：

| 检查 | 结果 |
| --- | --- |
| Cookie 格式与属性 | `lrs_anon=<48hex>.<64hex>`；HttpOnly、SameSite=Lax、Path=/ |
| Cookie 篡改 | 写入返回 401 |
| CSRF 缺失/错误 | 403 / 403 |
| 跨源 API | 403「请求来源不被允许」 |
| WS Origin | 允许 Origin 连接成功；错误/缺失 Origin 拒绝 |
| hostToken | 服务端仅存 SHA-256，与明文不同；创建响应只返回一次 |
| 日志脱敏 | 4.4KB 服务日志中无 hostToken、无 Cookie 值 |

## 6. 未执行 / 阻塞

| 项 | 状态 | 说明 | 解除条件 |
| --- | --- | --- | --- |
| AC-16/AC-17 真机矩阵（iOS Safari、Android Chrome、微信、UC、QQ） | **阻塞** | 当前无设备/系统 | T-047 发布前借测或预发布抽测 |
| AC-15 PWA 的 iOS/微信真机行为 | **阻塞** | 仅 Chromium 验证 | 同上 |
| AC-9 真实 AI 供应商 | **未执行** | 成功链路为 mock；失败链路已用真实 API 验证 | 用户自备端点/Key 在预发布复跑 |
| AC-1 真人 12 人新手主持 | **未执行** | 需真实玩家组织 | 用户组织一局预女猎守 |
| T-047 线上服务器/域名/证书/ICP | **阻塞** | 未提供 | 用户侧提供并完成备案 |
| 线上/真实网络 130 连接压测 | **未执行** | T-046 为本地单实例实验室数据 | T-047 预发布环境复测 |

> 以上均不得标记为通过；真机项沿用 2026-11-26 风险接受（用户批准），须在 T-047 发布前把关。

## 7. 缺陷

- 本轮未发现新增 P0/P1 阻断缺陷。
- 覆盖率提示（非阻断）：`host-room-store`/`player-room-store` 行覆盖约 68%～76%，`HostRoomScreen` 约 71% 行覆盖；主要分支已由组件/状态/e2e 覆盖，剩余为视觉与降级细节。
- T-045 全量并行回归中轮询可见时间曾为 5581ms（5s 周期 + 负载抖动），单独验收 4571ms；T-046 压测 P95 4773ms、max 4976ms，未发现产品缺陷。

## 8. 结论与建议

1. P0 + P1 全量自动化、构建门控、安全黑盒、实验室压测与移动端审计全部通过，**无 P0/P1 阻断缺陷**，满足进入 T-047 的条件。
2. T-046 记为**有条件完成**：真机矩阵、真实 AI 供应商、真人 12 人局与线上服务器为未执行阻塞项，需在 T-047 发布前完成或再次风险接受。
3. 建议 T-047 重点：SQLite 备份/恢复、真实网络 WS 压测、域名/证书/ICP 与预发布环境真机抽测。

## 9. 证据

- 用例：[P0 + P1 测试计划与用例](../../../test-cases.md)
- 脚本：[p1-security-check.mjs](../../../../../scripts/test-script/p1-security-check.mjs)、[p1-load.mjs](../../../../../scripts/test-script/p1-load.mjs)
- 原始结果：[security-check.json](security-check.json)、[load-check.json](load-check.json)、[coverage.log](coverage.log)、[mobile-audit.json](mobile-audit.json)
- 截图：[home-390.png](home-390.png)、[assistant-390.png](assistant-390.png)、[rules-390.png](rules-390.png)
- 日志：[gates.log](../gates.log)、[unit-tests.log](../unit-tests.log)、[e2e.log](../e2e.log)、[build.log](../build.log)、[verify-dist.log](../verify-dist.log)、[security-server.log](security-server.log)
- 关联报告：[T-043 PWA](T-043/verification.md)、[T-044 整合](T-044/verification.md)、[T-045 AC 验收](T-045/verification.md)
