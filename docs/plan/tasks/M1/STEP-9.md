# STEP-9 部署与上线准备

## 任务索引

- **里程碑**：M1（v1.3.1 P0）
- **阶段**：9
- **本轮基线**：PRD v1.3.2（含 CHG-20261125-02）；tech-arch v1.3；ADR-005
- **进度入口**：[project-progress.md](../../project-progress.md)
- **项目拓扑**：前后端分离

## 阶段任务清单

| 任务 ID | 业务切片 | 一句话范围 | 影响位置 | 详情 |
| --- | --- | --- | --- | --- |
| T-024 | 部署 | Node 单进程生产部署、TLS、静态/API/AI、健康检查与回滚 | 服务器、`docs/deploy/` | [T-024](#t-024) |

<a id="t-024"></a>
## T-024 部署与上线准备

### 目标与边界

**目标**：把 P0 部署到单服务器，Node 直接提供静态 + API + AI 中转；不使用 Nginx/Docker。

**范围内**：构建产物、Fastify 静态/API、TLS（DNS-01/webroot 或云 LB）、443 权限、`TRUST_PROXY`、请求限制、HSTS/安全头、健康检查、日志、备份、ICP、回滚。

**范围外**：P1 WebSocket/SQLite 生产启用（M2）；Docker/Nginx。

### 技术方案

- Node HTTPS 直连：证书 DNS-01/webroot（避免 standalone 占 80）；443 用 systemd `CAP_NET_BIND_SERVICE` 或云 LB 回源 3000。
- HTTP/1.1，保持 Socket.IO 兼容；`/api` 与 `/socket.io` 优先于静态 fallback。
- 环境变量按 [dev-info.md](../../../tech/dev-info.md)；密钥不入库/不入日志。

### 实施步骤

1. 产出构建物；配置环境变量与进程守护（systemd/PM2）。
2. 配置 TLS、80→443、健康检查、安全头、请求限制。
3. 预发布冒烟：静态 SPA、`GET /session`、`GET /health`、`POST /ai/relay`、移动端访问。
4. 备份/恢复与证书续期演练；记录部署文档。

> T-019 已先做 HTTP 内部静态/健康检查冒烟；本任务补 TLS/443/域名/续期。

### 验证与验收

- HTTPS/HSTS/安全头有效；SPA fallback 不吞 API；AI 中转可用。
- 证书续期、进程重启、静态/后端回滚有记录。
- 产出：`docs/deploy/项目部署文档.md`、冒烟报告；证据：部署记录。

### 风险与恢复

- 证书/443 权限：DNS-01 或云 LB；systemd capability；失败回退 HTTP 内网+云 LB。
- P1 WS/SQLite 未启用：明确 M2 再开，P0 验收不覆盖。

### 完成结果（2026-11-26）

- **实际产出**：[项目部署文档](../../../deploy/项目部署文档.md)、[systemd 单元](../../../deploy/werewolf-aid.service)、[环境变量模板](../../../deploy/env.production.example)、[冒烟脚本](../../../../scripts/deploy/smoke.mjs)。
- **代码变更**：`config.ts` 增加 TLS 路径与 `HTTP_REDIRECT_PORT`、缺证书保护；`app.ts` 支持 `node:https` 服务器；`server.ts` 支持 HTTPS 监听、80→443 301 与 SIGTERM 优雅关闭。
- **演练**：自签证书 + 生产构建在本机 HTTPS 3443/HTTP 3080 完成 22/22 冒烟（HSTS/CSP/Secure Cookie/静态缓存/SPA/API/跳转）；重启、发布 A→B→回滚 A、后端产物恢复、缺证书启动保护、配置/证书备份恢复均通过。
- **测试**：245 单测、24 e2e、lint/format/typecheck/build/verify:dist 全部通过；首屏 JS 136.45 kB gzip。
- **阻塞（需线上环境）**：真实服务器与 443、域名与证书签发/续期、ICP 备案、云 LB 模式、真机矩阵、真实 AI 供应商。
- **证据**：[T-024 部署报告](../../../test/evidence/M1/T-024/verification.md)。

## 阶段完成结果

- **实际产出**：Node 单进程 HTTPS 部署能力、部署文档与资产、22 项部署冒烟脚本、本地发布/回滚/备份演练记录。
- **方案偏差**：无 Nginx/Docker；Node 直连 TLS 为默认路径，云 LB 作为备选（文档给出两种环境变量组合）。
- **遗留项**：真实服务器/域名/证书/ICP/云 LB 需拿到环境后执行；真机与真实 AI 沿用 T-023 阻塞项。
- **验收状态**：本地部署演练通过；已验收（2026-11-26，用户“验收 T-024，继续下一个任务”）；真实线上部署待环境。
