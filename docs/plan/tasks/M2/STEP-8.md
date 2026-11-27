# M2 STEP-8 P1 测试与全量回归

## 任务索引

- **里程碑**：M2（v1.4 P1）
- **阶段**：8
- **本轮基线**：T-045 完成；P0 测试基线（T-023）
- **进度入口**：[project-progress.md](../../../project-progress.md)

## 阶段任务清单

| 任务 ID | 业务切片 | 一句话范围 | 影响位置 | 详情 |
| --- | --- | --- | --- | --- |
| T-046 | 测试 | P1 用例、全量回归、安全/性能/PWA/真机 | `docs/test/` | [T-046](#t-046) |

<a id="t-046"></a>
## T-046 P1 测试与全量回归

### 目标与边界

**目标**：在 P0 测试基线之上补齐 P1 用例，执行全量回归并归档证据。

**范围内**：
- 更新 `docs/test/test-cases.md`：P1-1～P1-8、AC-12～AC-15/19 用例矩阵。
- 单测/组件/API/WS 集成/E2E；AC-13 越权、AC-14 删除、AC-19 版本。
- AC-15 PWA 离线冷启动（Playwright + Service Worker）。
- 性能：WS 端到端 ≤2s、轮询 P95 ≤5s；10 房间 / 130 连接压测（单实例）。
- 安全：Cookie 签名、CSRF、Origin、hostToken 哈希、日志脱敏。
- 真机矩阵复测（若设备可用）；缺设备记阻塞。

**范围外**：新功能开发。

### 验证与验收

- P0 + P1 全量门控通过；无 P0/P1 阻断缺陷。
- 未能执行的项（真机/真实 AI/真实服务器）如实记阻塞。
- 产出：P1 测试报告；证据：`docs/test/evidence/M2/T-046/verification.md`。

### 风险与恢复

- 压测环境不足：记录实验室数据，真机/线上复测列入 T-047。
- PWA 浏览器差异：Chrome 通过后，iOS/微信记阻塞或降级。

### 完成结果（2026-11-27）

- 用例计划升级为 P0 + P1：[test-cases.md](../../../test-cases.md)，新增 P1-1～P1-8、AC-12～AC-15/19、P1 安全与压测矩阵。
- 全量门控：340 单测（33 文件）、41 e2e；lint/format/typecheck/build/verify:dist 通过；首屏 JS 207.14 kB gzip。
- AC-15：PWA 离线冷启动、manifest/SW、在线更新 3 条 e2e 随全量回归通过。
- 安全：[p1-security-check.mjs](../../../scripts/test-script/p1-security-check.mjs) 15/15：Cookie 签名/篡改 401、CSRF 403、跨源 API/WS 拒绝、hostToken 仅存 SHA-256、日志无 Token/Cookie。
- 性能：[p1-load.mjs](../../../scripts/test-script/p1-load.mjs) 10 房间 / 130 会话 / 120 WS；WS P95 24ms、max 24ms（≤2s）；5s 轮询 P95 4773ms、max 4976ms（≤5s）；错误 0。
- 移动端：8 视口 + 3 全流程 + 125% 字体 + DPR 2/3，横向滚动/触控/对比度/console 问题均为 0。
- 覆盖率：全项目 82.39% stmts / 84.76% lines；api 88.07% / 90.24%；web 87.32% / 84.9%。
- 阻塞：真机矩阵、iOS/微信 PWA、真实 AI 供应商、真人 12 人局、线上服务器/ICP 与真实网络压测（T-047）。
- 证据：[T-046 报告](../../../test/evidence/M2/T-046/verification.md)。
- 状态：有条件完成，待用户验收；无 P0/P1 阻断缺陷；下一步 T-047 部署扩展。
