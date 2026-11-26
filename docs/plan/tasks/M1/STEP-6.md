# STEP-6 前后端整合

## 任务索引

- **里程碑**：M1（v1.3.1 P0）
- **阶段**：6
- **本轮基线**：PRD v1.3.2（含 CHG-20261125-02）；tech-arch v1.3；api-contract v1.1
- **进度入口**：[project-progress.md](../../project-progress.md)
- **项目拓扑**：前后端分离

## 阶段任务清单

| 任务 ID | 业务切片 | 一句话范围 | 影响位置 | 详情 |
| --- | --- | --- | --- | --- |
| T-020 | AI | 助手接入 `/ai/relay`，完成加载/取消/超时/错误与同源整合 | `apps/web`、`apps/api` | [T-020](#t-020) |

<a id="t-020"></a>
## T-020 AI 前端接入与前后端整合

### 目标与边界

**目标**：把个人助手的 AI 上下文经同源 `/api/v1/ai/relay` 发到后端，完成 P0 AI 闭环。

**范围内**：模型配置（URL/模型/Key，Key 默认不持久化）、上下文组装、请求、loading/取消、超时、错误码文案、依据/边界提示、安全渲染。

**范围外**：P1 房间/WS、流式输出、平台默认模型。

### 技术方案

- 按 [api-contract.md](../../../tech/api-contract.md) 的 AI 接口；同源 Cookie + CSRF。
- 前端错误映射：KEY_INVALID/QUOTA/TIMEOUT/NETWORK/RATE_LIMITED/URL_NOT_ALLOWED。
- 输出按纯文本/安全 Markdown 渲染；禁止未净化 HTML。

### 实施步骤

1. 接入模型配置与上下文预览。
2. 接入请求、取消、超时与错误文案。
3. 联调有效/无效 Key、额度、超时、限频。
4. 验证输出安全与边界提示。

### 验证与验收

- AC-9/AC-10；有效 Key 返回三段以上内容；失败不阻塞主持/助手。
- 请求体不含未授权字段；日志无 Key/上下文。
- 产出：前端 AI 模块与联调记录；证据：测试报告。

### 风险与恢复

- 供应商错误码差异：以真实端点验证；未知错误归入 NETWORK/UPSTREAM 并提示重试。
- Key 持久化风险：默认内存/会话；可选“记住”需提示 XSS。

### 完成结果（2026-11-26）

- **实际产出**：助手页新增 AI 配置（接口地址/模型/Key/温度/最大输出）与 AI 军师面板；实现配置校验、IndexedDB 配置持久化、Key 默认内存/可选 sessionStorage、应用启动预取会话、CSRF、401/403 刷新重试、60 秒超时、取消、错误码文案、纯文本安全渲染与边界提示。
- **测试**：新增 28 个 AI 相关单测（配置 10、客户端 11、UI 7，含 XSS 纯文本用例）；全量 242 个单测、18 个 e2e 通过；`apps/web/src` 覆盖率 90.76% statements / 84.37% branches / 96.96% functions / 90% lines。
- **联调**：生产构建由 API 同源提供，浏览器经真实 session/CSRF 调用中转，私网地址按 `URL_NOT_ALLOWED` 文案展示；9/9 检查通过，日志无 Key/上下文/Cookie。
- **门控**：lint、format、typecheck、build、verify:dist 通过；首屏 JS 110.45 kB gzip，助手页 chunk 8.25 kB gzip。
- **证据**：[verification.md](../../../test/evidence/M1/T-020/verification.md)。

## 阶段完成结果

- **实际产出**：`apps/web` AI 配置/客户端/状态机/UI 与助手页整合；`npm run e2e` 增加 API 3000 服务，支持真实同源联调。
- **方案偏差**：成功链路因缺少用户可控公网 HTTPS 上游，使用浏览器/组件 mock；真实供应商联调在 T-022。Key 记住策略按 5B 契约使用 sessionStorage，长期记住不提供。
- **遗留项**：真实 AI 供应商错误码/超时行为在 T-022 验证；P1 房间/WS 不在本阶段。
- **验收状态**：待用户阶段验收。
