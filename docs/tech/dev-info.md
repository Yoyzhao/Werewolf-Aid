# 开发环境信息

- 更新日期：2026-11-25
- 关联：[技术架构](tech-arch.md)、[ADR-001](arch/ADR-001-技术栈与项目拓扑.md)、[ADR-005](arch/ADR-005-部署与运行形态.md)
- 说明：项目尚无代码；目录、端口、命令为步骤 3 计划值，实施时以本文件更新为准。未探测到的信息标记“待确认”，不猜测。

## 1. 技术栈说明

- 前端：React 19 + Vite + TypeScript
- UI/样式：Tailwind CSS + Radix Primitives + lucide-react
- 状态/本地存储：Zustand + idb-keyval（IndexedDB）
- 后端：Node.js 24 + Fastify 5 + TypeScript + Zod
- 实时（P1）：Socket.IO 4
- 数据库（P1）：SQLite（WAL）+ Drizzle ORM + better-sqlite3
- 包管理：npm workspaces
- 测试：Vitest + React Testing Library + Playwright
- 部署形态：Node 单进程（Fastify 提供静态 SPA + API + P1 Socket.IO）；不使用 Nginx/Docker；TLS 由 Node HTTPS 或云负载均衡终止
- 时区策略：存储/传输 UTC epoch 毫秒；展示 Asia/Shanghai

## 2. 版本信息

| 组件 | 版本 | 说明 |
| --- | --- | --- |
| 操作系统 | Windows 11 | 已探测 |
| Node.js | v24.22.3 | 已探测（2026-11-25 更新） |
| npm | 11.19.1 | 已探测 |
| pnpm | 未安装 | 不使用；采用 npm workspaces |
| Docker | 不使用 | 2026-11-25 用户决定；本机也未安装 |
| Git | 2.56.1 | 已探测 |
| ripgrep | 15.2.0 | 已探测 |
| Python | 3.12.7 | 已探测；本项目不使用 |
| React / React DOM | 目标 19.x | 安装时锁定 |
| Vite | 目标最新稳定 | 安装时锁定 |
| TypeScript | 目标 5.x | 安装时锁定 |
| Tailwind CSS | 目标 4.x | 安装时锁定 |
| Radix Primitives | 目标最新稳定 | 安装时锁定 |
| Fastify | 目标 5.x | 安装时锁定；验证 Node 24 兼容 |
| Socket.IO | 目标 4.x | P1；安装时锁定 |
| SQLite | 目标 3.x | P1；系统/驱动随安装锁定 |
| Drizzle ORM | 目标最新稳定 | P1；安装时锁定 |
| Zod | 目标最新稳定 | 安装时锁定 |
| Vitest / Playwright | 目标最新稳定 | 安装时锁定 |

## 3. 目录与入口

计划目录（尚未创建）：

```text
apps/
  web/          React SPA；构建产物 dist/ 由 api 静态服务
  api/          Fastify API + 静态资源 + P1 Socket.IO
packages/
  game-engine/  纯 TS 规则/状态机/胜负
  shared/       API 契约/DTO/错误码
  rules-content/板子/角色/流程/术语
docs/
```

计划命令：

```bash
npm install
npm run dev -w apps/web       # 前端开发（Vite proxy /api → 3000）
npm run dev -w apps/api       # 后端开发
npm run build                 # 构建 web/api
npm start -w apps/api         # 生产：静态 + API + P1 WS 单进程
npm test                      # 单测
npm run e2e                   # Playwright
```

> 上述命令在步骤 4/5 创建 `package.json` 后生效；当前未创建，不宣称可运行。

## 4. 端口与地址

| 服务 | 本地地址 | 端口 | 备注 |
| --- | --- | --- | --- |
| Web dev（Vite） | http://localhost | 5173 | 计划；proxy /api → 3000 |
| Web preview | http://localhost | 4173 | 计划 |
| API（Fastify） | http://localhost | 3000 | 计划；开发/内部 |
| 生产 HTTPS | https://<域名> | 443 | Node HTTPS 直接终止，或云负载均衡回源 3000 |
| 生产 HTTP 跳转 | http://<域名> | 80 | Node 301 → HTTPS（或云 LB） |

## 5. 数据库与中间件

| 组件 | 版本 | 连接方式/备注 |
| --- | --- | --- |
| SQLite（P1） | 3.x | 文件 `./data/lrs.sqlite`；WAL；仅 API 进程访问 |
| better-sqlite3（P1） | 安装时锁定 | Drizzle 驱动；需验证 Node 24 预编译/构建工具 |
| 表 | rooms / room_seats / game_states / snapshots | `game_states.state_json` 仅服务端；`snapshots` 存过滤视图 |
| Redis | 不引入 | 单实例不需要；多实例时再评估 |
| 消息队列 | 不引入 | 当前无异步任务需求 |

P0 无服务端数据库；AI 中转不持久化。

## 6. 环境变量清单

| 变量名 | 作用 | 配置来源 | 是否敏感 |
| --- | --- | --- | --- |
| `NODE_ENV` | 运行环境 | 进程/部署配置 | 否 |
| `HOST` | 监听地址（默认 0.0.0.0） | 进程/部署配置 | 否 |
| `PORT` | HTTP/HTTPS 端口（开发 3000；生产 443 或云 LB 回源 3000） | 进程/部署配置 | 否 |
| `PUBLIC_ORIGIN` | 允许的前端 Origin | 部署配置 | 否 |
| `SESSION_SECRET` | 匿名会话签名；轮换会使所有会话/绑定失效 | 密钥管理/本地未跟踪配置 | 是 |
| `HTTPS_ENABLED` | 是否由 Node 直接终止 TLS | 部署配置 | 否 |
| `TLS_KEY_PATH` | TLS 私钥路径 | 部署配置 | 是 |
| `TLS_CERT_PATH` | TLS 证书路径 | 部署配置 | 否 |
| `WEB_DIST_DIR` | 前端构建产物目录（由 Fastify static 提供） | 部署配置 | 否 |
| `SQLITE_FILE` | P1 SQLite 文件路径 | 部署配置 | 否 |
| `TRUST_PROXY` | 云 LB/CDN 场景信任代理头（直连时关闭） | 部署配置 | 否 |
| `BODY_LIMIT_BYTES` | 全局请求体上限（默认 262144） | 部署配置 | 否 |
| `REQUEST_TIMEOUT_MS` | 请求总超时（默认 65000，覆盖 AI 60s 上限） | 部署配置 | 否 |
| `HEADERS_TIMEOUT_MS` | 请求头超时（默认 20000） | 部署配置 | 否 |
| `CONNECTION_TIMEOUT_MS` | 连接超时（默认 30000） | 部署配置 | 否 |
| `KEEP_ALIVE_TIMEOUT_MS` | Keep-Alive 超时（默认 65000） | 部署配置 | 否 |
| `WS_MAX_PAYLOAD_BYTES` | WebSocket 单条消息上限（默认 65536） | 部署配置 | 否 |
| `AI_MAX_INFLIGHT_PER_SESSION` | 每会话 AI 在途上限（默认 1） | 部署配置 | 否 |
| `AI_MAX_INFLIGHT_GLOBAL` | 全局 AI 在途上限（默认 20） | 部署配置 | 否 |
| `AI_RELAY_CONNECT_TIMEOUT_MS` | AI 连接超时 | 部署配置 | 否 |
| `AI_RELAY_TOTAL_TIMEOUT_MS` | AI 总超时 | 部署配置 | 否 |
| `AI_RELAY_MAX_RESPONSE_BYTES` | AI 响应上限 | 部署配置 | 否 |
| `RATE_LIMIT_AI_PER_MIN` | AI 限频 | 部署配置 | 否 |
| `RATE_LIMIT_JOIN_PER_MIN` | P1 加入限频 | 部署配置 | 否 |

> 不记录任何真实 Key/密码/Token；玩家 AI Key 由用户在运行时提供，不写入环境变量或仓库。
>
> Node 直连 TLS 时使用 DNS-01/webroot 证书，避免 certbot standalone 占用 80 与 Node 冲突；443 绑定用 systemd `CAP_NET_BIND_SERVICE` 或云 LB 回源 3000。HTTP/2 先不启用，保持 HTTP/1.1 以兼容 Socket.IO。

## 7. 测试账号与测试数据

- 测试账号：无（无账号体系）。
- 测试数据：12 人预女猎守/预女猎白固定夹具；主持人 + 12 座位；P1 用两个浏览器会话模拟主持/玩家。
- AI 测试：使用假端点/Mock，不提交真实 Key；真实端点验证由用户自备。

## 8. AI Coding 工具链环境

| 维度 | 内容 | 备注 |
| --- | --- | --- |
| 操作系统 | Windows 11 | 已探测 |
| 终端工具 | PowerShell 7 | 默认 |
| 命令行工具 | Node 24.22.3、npm 11.19.1、Git 2.56.1、ripgrep 15.2.0、Python 3.12.7 | Docker 不使用；pnpm 未安装 |
| 可用插件 | browser、chrome、computer-use、deployment、html-report-presentation、office-plugin、ppt-generator、prd-authoring、record-and-replay、trae-capabilities、web-app-development | 按需 |
| 可用 Skill | fullstack-general、TRAE-browseruse、TRAE-code-review、TRAE-security-review、TRAE-debugger、TRAE-computer-use-ptc、webapp-testing、dynamic-ui 等 | 按需 |
| MCP 服务 | Chrome DevTools MCP、Knowledge Graph Memory、Record & Replay、Trae Capabilities、deployment、code_mode | 按需 |
| 其他 Agent 能力 | 浏览器自动化、Chrome 扩展控制、桌面操作 | 按需 |

## 9. 待确认/未探测

- React/Vite/Fastify 等精确版本：安装时锁定。
- 生产服务器/域名/证书/ICP 备案：待部署阶段确认。
- TLS 终止方式：Node HTTPS 直接终止，或云负载均衡/CDN 终止；不使用 Nginx/Docker（2026-11-25 用户决定）。
- 真实 AI 供应商行为（超时/错误码/额度）：实现期用用户自备端点验证。
