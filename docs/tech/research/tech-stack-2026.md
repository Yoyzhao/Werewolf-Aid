# 技术栈调研

- 日期：2026-11-25
- 关联：PRD v1.3.1；ADR-001～ADR-005
- 状态：已形成结论，待步骤 3 验收
- 说明：未做外部基准测试；框架/库版本以安装时锁定为准，不凭记忆写死小版本。

## 1. 背景与约束

- 产品形态：Web 应用，移动端优先（CSS 360–440px，320 兼容地板），桌面仅兼容。
- P0：单机主持 + 个人助手 + AI 中转；本地优先，页面加载后断网可继续。
- P1（下一迭代）：配对码联机、WebSocket 快照、服务端视图过滤、PWA。
- 无账号体系；匿名会话 + 房间令牌。
- 部署：单服务器、HTTPS；Node 单进程提供静态/API/WS；不使用 Nginx/Docker；TLS 由 Node HTTPS 或云负载均衡终止；境内需 ICP 备案。
- 团队/项目：无既有代码，TypeScript 全栈更利于共享规则与契约。

## 2. 本地环境扫描（2026-11-25）

| 项 | 结果 |
| --- | --- |
| 操作系统 | Windows 11 |
| 终端 | PowerShell 7 |
| Node.js | v24.22.3 |
| npm | 11.19.1 |
| pnpm | 未安装 |
| Docker | 不使用（本机未安装） |
| Git | 2.56.1 |
| ripgrep | 15.2.0 |
| Python | 3.12.7（本项目不使用） |

## 3. 候选对比

### 3.1 项目拓扑

| 方案 | 优点 | 代价/风险 | 结论 |
| --- | --- | --- | --- |
| 前后端分离 | 前端/后端独立迭代；API 与 WebSocket 边界清晰；P0/P1 可分层 | 两套构建/进程 | **选用** |
| 一体化全栈（Next.js/Nuxt） | 单仓、SSR/路由方便 | 本项目不需要 SSR；WebSocket 常需额外服务；P0 本地优先收益低 | 不选 |

### 3.2 前端

| 方案 | 优点 | 代价/风险 | 结论 |
| --- | --- | --- | --- |
| React + Vite + TS | 生态大；移动端 SPA 简单；与共享 TS 契约契合 | 需自行约束包体 | **选用** |
| Vue 3 + Vite + TS | 上手快；国内生态好 | 与已确认推荐方案不一致，需重新对齐 | 备选 |
| Next.js | SSR/SEO | 无 SSR 需求；与 WebSocket 分离 | 不选 |

UI：**Tailwind CSS + Radix Primitives + lucide-react**。理由：默认深色、高对比、大按钮的定制移动 UI，比 Ant Design Mobile 更可控、包体更小。状态：Zustand + idb-keyval；路由：React Router。

### 3.3 后端

| 方案 | 优点 | 代价/风险 | 结论 |
| --- | --- | --- | --- |
| Node.js + Fastify + TS | 与前端共享类型/规则包；轻量；性能足够；Socket.IO 生态成熟 | 需团队熟悉 TS 服务端 | **选用** |
| Python + FastAPI | 生态好；AI 相关库多 | 双语言；规则/契约需重复定义 | 不选 |
| NestJS | 结构完整 | 对当前规模偏重 | 不选 |

### 3.4 数据库

| 方案 | 优点 | 代价/风险 | 结论 |
| --- | --- | --- | --- |
| SQLite（WAL） | 单服务器零运维；P1 写入量低（每阶段快照）；备份=文件 | 多实例/高并发受限 | **P1 选用** |
| PostgreSQL | 并发/HA/复杂查询强 | 额外运维与成本；当前规模不需要 | 升级路径 |
| 仅浏览器存储 | 零后端 | P1 联机无法共享状态 | 不满足 P1 |

P0 无服务端持久化；P1 使用 SQLite，升级触发条件写入 ADR-002。

### 3.5 实时同步

| 方案 | 优点 | 代价/风险 | 结论 |
| --- | --- | --- | --- |
| Socket.IO | 自动重连、房间、降级语义清晰 | 协议非原生；单实例需粘性 | **P1 选用** |
| 原生 WebSocket | 轻 | 重连/心跳/房间需自写 | 备选 |
| SSE + 轮询 | 简单 | 单向；写操作仍需 HTTP；延迟/连接管理弱 | 不选 |
| 纯轮询 5s | 最简单 | 延迟高；连接多 | 降级方案 |

### 3.6 包管理与部署

| 项 | 结论 | 理由 |
| --- | --- | --- |
| 包管理 | **npm workspaces** | npm 11 已安装；pnpm 未安装，不引入额外前置 |
| 部署 | **Node 单进程** | Fastify `@fastify/static` 提供静态 + API + P1 Socket.IO；同源；不使用 Nginx |
| TLS | Node HTTPS 或云 LB/CDN | 不使用 Nginx/Docker；证书由 certbot/DNS 或云证书提供 |
| 容器 | 不使用 Docker | 用户 2026-11-25 决定；未来需要隔离/多实例再评估 |

## 4. 结论

采用 **前后端分离 + TypeScript 全栈 + 共享规则引擎**：

- `apps/web`：React 19 + Vite + TypeScript + Tailwind + Radix + Zustand + idb-keyval。
- `apps/api`：Node.js 24 + Fastify 5 + TypeScript + Zod；P1 Socket.IO；P1 Drizzle + SQLite。
- `packages/game-engine`：纯 TS 规则/状态机/胜负判定，Web 与 API 共用。
- `packages/shared`：API 契约、DTO、错误码、视图类型。
- `packages/rules-content`：板子/角色/流程/术语内容。
- `npm workspaces` 管理；Node 单进程（静态/API/WS）部署；不使用 Nginx/Docker。

## 5. 风险与待确认

- React/Vite/Fastify 等具体小版本需安装时锁定；Node 24 与 Fastify 5 的兼容性在首次安装时验证。
- SQLite 仅适用单实例；多实例/高并发需 PostgreSQL（ADR-002）。
- Socket.IO 单实例；水平扩展需粘性会话/Redis adapter（ADR-003）。
- Node 单进程同时承担 TLS/静态/API/WS；证书续期、443 权限与静态缓存需在部署阶段验证。
- 不使用 Nginx/Docker；未来需要 TLS 卸载/静态加速/多实例时再评估云 LB/CDN 或容器化。
- AI 供应商行为差异大，超时/错误码需在实现期用真实端点验证（ADR-004）。
