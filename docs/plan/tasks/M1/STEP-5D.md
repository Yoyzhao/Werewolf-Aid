# STEP-5D 后端实现

## 任务索引

- **里程碑**：M1（v1.3.1 P0）
- **阶段**：5D
- **本轮基线**：PRD v1.3.2（含 CHG-20261125-02）；tech-arch v1.3；api-contract v1.1
- **进度入口**：[project-progress.md](../../project-progress.md)
- **项目拓扑**：前后端分离

## 阶段任务清单

| 任务 ID | 业务切片 | 一句话范围 | 影响位置 | 详情 |
| --- | --- | --- | --- | --- |
| T-019 | AI/服务 | Fastify API、匿名会话/CSRF、AI 中转、静态服务与健康检查 | `apps/api` | [T-019](#t-019) |

<a id="t-019"></a>
## T-019 API 服务与 AI 中转

### 目标与边界

**目标**：为 P0 提供同源静态服务、匿名会话、AI 中转与健康检查；不实现 P1 房间业务。

**范围内**：Fastify 启动、`@fastify/static`（SPA fallback）、`@fastify/cookie`、CSRF、`@fastify/helmet`、`@fastify/compress`、`@fastify/rate-limit`、`POST /api/v1/ai/relay`、`GET /api/v1/session`、`GET /api/v1/health`、SSRF/超时/响应上限/日志脱敏；请求限制与 `TRUST_PROXY`；HTTP 内部静态/健康检查冒烟。

**范围外**：P1 房间/WS/SQLite 业务（M2）；不预留 P1 路由/数据层实现（共享类型经 `packages/shared` 引用，不注册任何 P1 路由）。

### 技术方案

- 按 [api-contract.md](../../../tech/api-contract.md) 实现 P0 接口；AI Key 不落库、不写日志。
- SSRF：仅 https、拒绝私网/环回/链路本地/元数据、不跟随私网重定向。
- 静态：`/api`、`/socket.io` 先注册；SPA fallback 只处理非 API GET；哈希缓存。
- 限制：全局 body 256KB、AI 128KB、request 65s、header 20s、connection 30s、WS 64KB（P1）。

### 实施步骤

1. 建 Fastify 启动、配置、日志脱敏与健康检查。
2. 实现会话/CSRF 与 AI 中转、SSRF、超时/限频。
3. 接入静态构建与 SPA fallback。
4. 集成测试：错误码、超时、限频、SSRF、静态路由。

### 验证与验收

- `GET /session`、`GET /health`、`POST /ai/relay` 契约测试通过。
- SSRF/超时/大包/限频/日志脱敏用例通过；静态/API 路由不互相吞。
- 先做 HTTP 内部冒烟（静态 fallback/健康检查），TLS/443 留到 T-024。
- 产出：`apps/api` 源码与测试；证据：`docs/test/evidence/M1/T-019/`。

### 风险与恢复

- 证书/443/`TRUST_PROXY` 属部署阶段；本任务只保证 HTTP 内部端口与同源行为。
- Node 24 + Fastify 5 兼容性首日验证；`better-sqlite3` 不在 P0 启用。

### 完成结果（2026-11-26）

- **实际产出**：`apps/api` 已实现 Fastify 5 配置与启动、匿名会话/CSRF、`POST /api/v1/ai/relay`、`GET /api/v1/session`、`GET /api/v1/health`、SSRF（DNS 校验 + 固定已验证 IP）、超时/响应上限、按会话限频与在途并发、Helmet CSP、静态资源与 SPA fallback、统一错误包络与日志脱敏；`packages/shared` 补齐 Zod 契约与常量。
- **测试**：新增 114 个 API 单测（SSRF 57、AI 中转 22、会话 6、应用集成 24、配置 5）；全量 214 个单测通过；`apps/api/src` 覆盖率 91.37% statements / 87.76% branches / 91.48% functions / 92.70% lines。
- **功能检查（2026-11-26）**：对生产构建做独立黑盒测试 57/57 通过（健康检查、会话/CSRF、Schema、SSRF、413、静态/API 隔离、限频、`PUBLIC_ORIGIN`、生产模式属性、启动保护、日志脱敏）；发现并修复非法 JSON/不支持 Content-Type 落入 500 的错误映射缺陷，复测为 400/415 `INVALID_REQUEST`；详见 [functional-check-20261126.md](../../../test/evidence/M1/T-019/functional-check-20261126.md)。
- **门控**：`npm run lint`、`format:check`、`typecheck`、`build`、`verify:dist` 通过；HTTP 内部冒烟 17/17（静态/API 路由隔离、私网 SSRF 拒绝、CSRF、413、安全头、日志无 Key/上下文/Cookie）。
- **证据**：[verification.md](../../../test/evidence/M1/T-019/verification.md)。

## 阶段完成结果

- **实际产出**：`apps/api` P0 服务与测试；`packages/shared` API 契约；依赖新增 `@fastify/static`、`cookie`、`helmet`、`compress`、`rate-limit` 与 `zod`。
- **方案偏差**：`buildApp` 改为异步，确保 `@fastify/rate-limit` 的 `onRoute` 钩子在路由声明前完成注册；统一错误处理器提前到插件/路由注册前设置，避免静态插件注册路由后错误包络失效。Node 24 + Fastify 5 兼容性正常；`better-sqlite3` 未启用。
- **遗留项**：P1 房间/WS/SQLite 不在本阶段；TLS/443/`TRUST_PROXY` 在 T-024；真实 AI 供应商联调在 T-020/步骤 7。
- **验收状态**：待用户 5D 阶段验收。
