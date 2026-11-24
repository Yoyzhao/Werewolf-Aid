# STEP-5D 后端实现

## 任务索引

- **里程碑**：M1（v1.3.1 P0）
- **阶段**：5D
- **本轮基线**：PRD v1.3.1；tech-arch v1.2；api-contract v1.1
- **进度入口**：[project-progress.md](../../project-progress.md)
- **项目拓扑**：前后端分离

## 阶段任务清单

| 任务 ID | 业务切片 | 一句话范围 | 影响位置 | 详情 |
| --- | --- | --- | --- | --- |
| T-019 | AI/服务 | Fastify API、匿名会话/CSRF、AI 中转、静态服务与健康检查 | `apps/api` | [T-019](#t-019) |

<a id="t-019"></a>
## T-019 API 服务与 AI 中转

### 目标与边界

**目标**：为 P0 提供同源静态服务、匿名会话、AI 中转与健康检查；为 P1 预留路由/数据层但不实现房间业务。

**范围内**：Fastify 启动、`@fastify/static`（SPA fallback）、`@fastify/cookie`、CSRF、`@fastify/helmet`、`@fastify/compress`、`@fastify/rate-limit`、`POST /api/v1/ai/relay`、`GET /api/v1/session`、`GET /api/v1/health`、SSRF/超时/响应上限/日志脱敏；请求限制与 `TRUST_PROXY`。

**范围外**：P1 房间/WS/SQLite 业务（M2）。

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
- 产出：`apps/api` 源码与测试；证据：测试报告。

### 风险与恢复

- 证书/443/`TRUST_PROXY` 属部署阶段；本任务只保证 HTTP 内部端口与同源行为。
- Node 24 + Fastify 5 兼容性首日验证；`better-sqlite3` 不在 P0 启用。
