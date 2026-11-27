# 开发环境信息

- 更新日期：2026-11-26
- 关联：[技术架构](tech-arch.md)、[ADR-001](arch/ADR-001-技术栈与项目拓扑.md)、[ADR-005](arch/ADR-005-部署与运行形态.md)
- 说明：步骤 5C 已完成 T-015 工程骨架、T-026～T-028 规则引擎、T-029～T-031 主持闭环、T-018/T-034 助手与规则页；步骤 5D T-019 已完成后端 API 与 AI 中转；步骤 6 T-020 已完成 AI 前端接入与同源整合；步骤 8 T-023 已完成 P0 测试计划与全量回归；步骤 9 T-024 已完成 Node HTTPS 部署能力、部署资产与本地演练；M1 已验收（2026-11-26）；M2 T-010/T-033/T-035/T-036/T-037 已验收；T-038 联机主持端与 T-039 玩家端已完成、待验收。未探测到的信息标记“待确认”，不猜测。

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
| React / React DOM | 19.3.1 | 已安装并锁定（package-lock） |
| Vite | 8.3.8 | 已安装 |
| TypeScript | 5.9.3 | 已安装；strict |
| Tailwind CSS | 4.3.5 | 已安装（`@tailwindcss/vite`，T-029） |
| Radix Primitives | Dialog 1.3.1 / Switch 1.4.1 | 已安装（T-029） |
| Zustand / idb-keyval | 5.1.0 / 6.3.0 | 已安装（T-029） |
| Sonner / lucide-react | 2.0.8 / 1.80.0 | 已安装（T-029） |
| Fastify | 5.12.8 | 已安装；Node 24 兼容 |
| @fastify/static / cookie / helmet / compress / rate-limit | 10.1.12 / 11.1.5 / 13.2.0 / 9.3.0 / 11.3.0 | 已安装（T-019） |
| Socket.IO | 4.8.4 / socket.io-client 4.8.4 | 服务端 T-037；客户端 T-039（web） |
| qrcode | 1.5.4 | 主持端配对二维码（T-038，`qrcode` + `@types/qrcode`） |
| SQLite / Drizzle | better-sqlite3 13.2.0 / drizzle-orm 0.45.4 | 已安装（T-036）；SQLite 3.54.1；Node 24 预编译/构建可用 |
| Zod | 4.6.7 | 已安装（T-019，`@lrs/shared` 契约与 API 校验） |
| Vitest | 5.1.2 | 已安装 |
| Playwright | 1.65.1 | 已安装；Chromium 由 `npx playwright install chromium` 安装 |
| ESLint | 10.15.0 | 已安装；flat config + typescript-eslint |
| Prettier | 3.10.1 | 已安装 |

## 3. 目录与入口

目录结构（2026-11-26 已按项目结构规范整理）：

```text
apps/
  web/          React SPA；构建产物 dist/ 由 api 静态服务
  api/          Fastify API + 静态资源 + P1 Socket.IO
packages/
  game-engine/  纯 TS 规则/状态机/胜负
  shared/       API 契约/DTO/错误码
  rules-content/板子/角色/流程/术语
tests/
  e2e/          Playwright 端到端用例（仓库级入口 playwright.config.ts）
docs/
  prototype/M1/ 5A 原型（按里程碑归档）
```

测试产物统一写入 `.artifacts/`（Playwright 结果 `.artifacts/test-results/`、e2e 截图 `.artifacts/e2e/`、覆盖率 `.artifacts/coverage/`），已加入忽略规则；`docs/test/evidence/` 只归档任务验收时的定稿证据，不被自动测试覆盖。

工程基线：

- 包名：`@lrs/web`、`@lrs/api`、`@lrs/game-engine`、`@lrs/shared`、`@lrs/rules-content`。
- 根 `package.json` 使用 npm workspaces；`apps/*` 与 `packages/*` 均纳入。
- TypeScript strict，包入口 `src/index.ts`，构建产物 `dist/`。
- 角色头像资源位于 `apps/web/public/assets/avatar/`（2026-11-26 目录整理：移除根目录 `web/assets/avatar/` 的重复副本）。
- 断网继续（AC-5）：P0 页面不做路由级懒加载，统一首屏包；当前首屏 JS 203.88 kB gzip（2026-11-26，T-039 socket.io-client/qrcode + T-040/T-041 时间线/术语/笔记后，仍低于 250 kB 预算）。
- 端到端用例位于 `tests/e2e/`；Playwright 产物按 `.artifacts/` 规则统一存放。
- 测试计划/用例：[docs/test/test-cases.md](../test/test-cases.md)；T-023 回归：242 单测、24 e2e、首屏 136.45 kB gzip；证据见 [T-023 报告](../test/evidence/M1/T-023/verification.md)。
- 部署：[项目部署文档](../deploy/项目部署文档.md)；Node HTTPS 直连/云 LB 两种模式；冒烟 `node scripts/deploy/smoke.mjs https://<域名>`（22 项）；证据见 [T-024 报告](../test/evidence/M1/T-024/verification.md)。
- M2 P1 规划：[M2 STEP-4](../plan/tasks/M2/STEP-4.md)；T-036/T-037 已启用 SQLite 与 Socket.IO；T-040/T-041 已完成时间线、术语与笔记；PWA 仍待 T-043。
- 服务端视图（T-033）：`@lrs/game-engine` 提供 `validateGameState`、`buildPublicView`、`buildPrivateView`、`buildViews`；玩家视图不含他人身份/夜间私密信息。
- 房间 API（T-036）：`POST /api/v1/rooms`、`/rooms/recover`、`/rooms/{code}/join|confirm|unbind`、`PUT /snapshot`、`GET /rooms/{code}`、`GET /view`、`POST /settle`、`DELETE /rooms/{code}`；会话 Cookie `lrs_anon=<id>.<hmac>`；主持令牌通过 `X-Host-Token` 提交，仅创建响应返回一次，服务端存 SHA-256。
- 实时（T-037）：Socket.IO 路径 `/ws/rooms?code=`；事件 `room.view`/`room.closed`/`room.error`；单条消息上限 `WS_MAX_PAYLOAD_BYTES`（默认 64KB）；未绑定会话拒绝。Vite dev/preview 通过 `/ws` 代理（`ws: true`）。
- 联机 UI（T-038/T-039）：首页“联机主持” → `host-room` 面板；玩家路由 `/join`、`/join/:code`；玩家页无底部 Tab；主持端 3s 刷新座位、300ms 合并写快照、失败退避与 409 补写；玩家端 1.5s 等待确认、WS 失败 3 次后 5s 轮询。
- 复盘时间线（T-040）：`lib/timeline.ts` 统一生成分组；主持端含夜间私密动作 + 公开事件，玩家端仅 `PlayerView.privateActions` + `events`；默认展开最近一夜；`Timeline` 组件用于结算页与玩家绑定/结束页。
- 术语与笔记（T-041）：`rules-content.TERMS` 14 条（板子/角色/流程/判定/口语）；规则页统一搜索并 `<mark>` 高亮；助手“笔记”Tab 使用独立 `lrs.notes.v1`（IndexedDB）、500ms 防抖、手动“引用到自由描述”，不进入 `buildAssistantContext` 自动上下文。
- SQLite 默认 `data/lrs.sqlite`（`NODE_ENV=test` 默认关闭，测试显式传 `:memory:` 或临时文件）；WAL、外键、`expires_at` TTL 每分钟清理。
- 移动端审计需同时启动 API：Vite 预览复用 `server.proxy`，仅启动 4173 时 `/api/v1/session` 会 502。

命令：

```bash
npm install
npm run dev:web               # 前端开发（Vite 5173；proxy /api → 3000）
npm run dev:api               # 后端开发（tsx watch，3000）
npm run build                 # 构建 shared/game-engine/rules-content/web/api
npm start -w @lrs/api         # 生产：静态 + API + P1 WS 单进程
npm run lint                  # ESLint
npm run format:check          # Prettier
npm run typecheck             # 所有 workspace
npm test                      # Vitest
npm run e2e                   # Playwright（自动启动 Web 5173 + API 3000；需先安装 Chromium）
```

## 4. 端口与地址

| 服务 | 本地地址 | 端口 | 备注 |
| --- | --- | --- | --- |
| Web dev（Vite） | http://localhost | 5173 | 已实现；proxy /api → 3000 |
| Web preview | http://localhost | 4173 | 已实现 |
| API（Fastify） | http://localhost | 3000 | 已实现（T-019）；开发/内部 |
| 生产 HTTPS | https://<域名> | 443 | Node HTTPS 直接终止，或云负载均衡回源 3000 |
| 生产 HTTP 跳转 | http://<域名> | 80 | Node 301 → HTTPS（或云 LB） |

## 5. 数据库与中间件

| 组件 | 版本 | 连接方式/备注 |
| --- | --- | --- |
| SQLite（P1） | 3.54.1 | 默认 `data/lrs.sqlite`（可用 `SQLITE_FILE` 覆盖）；WAL、`synchronous=NORMAL`、外键、busy_timeout=5s；仅 API 进程访问 |
| better-sqlite3（P1） | 13.2.0 | Drizzle 驱动；Node 24.22.3 已验证加载与写入 |
| 表 | rooms / room_seats / game_states / snapshots | `game_states.state_json` 仅服务端；`snapshots` 存过滤视图；结算/解散/TTL 删除四表 |
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
| `TLS_CERT_PATH` | TLS 证书链路径 | 部署配置 | 否 |
| `HTTP_REDIRECT_PORT` | HTTP→HTTPS 301 监听端口（Node 直连时 80；云 LB 模式 0） | 部署配置 | 否 |
| `WEB_DIST_DIR` | 前端构建产物目录（由 Fastify static 提供） | 部署配置 | 否 |
| `SQLITE_FILE` | SQLite 文件路径（默认 `data/lrs.sqlite`；测试环境默认关闭） | 部署配置 | 否 |
| `ROOM_TTL_MS` | 房间有效期（默认 24 小时） | 部署配置 | 否 |
| `ROOM_JOIN_TTL_MS` | 配对码加入有效期（默认 10 分钟） | 部署配置 | 否 |
| `ROOM_CLEANUP_INTERVAL_MS` | 过期房间清理间隔（默认 60 秒） | 部署配置 | 否 |
| `RATE_LIMIT_ROOM_CREATE_PER_HOUR` | 创建房间限频（默认 10/小时/会话） | 部署配置 | 否 |
| `RATE_LIMIT_ROOM_JOIN_PER_MIN` | 申请绑定限频（默认 30/分钟/会话） | 部署配置 | 否 |
| `RATE_LIMIT_ROOM_HOST_PER_MIN` | 主持写操作限频（默认 120/分钟/会话） | 部署配置 | 否 |
| `TRUST_PROXY` | 云 LB/CDN 场景信任代理头（直连时关闭） | 部署配置 | 否 |
| `BODY_LIMIT_BYTES` | 全局请求体上限（默认 262144） | 部署配置 | 否 |
| `REQUEST_TIMEOUT_MS` | 请求总超时（默认 65000，覆盖 AI 60s 上限） | 部署配置 | 否 |
| `HEADERS_TIMEOUT_MS` | 请求头超时（默认 20000） | 部署配置 | 否 |
| `CONNECTION_TIMEOUT_MS` | 连接超时（默认 30000） | 部署配置 | 否 |
| `KEEP_ALIVE_TIMEOUT_MS` | Keep-Alive 超时（默认 65000） | 部署配置 | 否 |
| `WS_MAX_PAYLOAD_BYTES` | WebSocket 单条消息上限（默认 65536） | 部署配置 | 否 |
| `AI_MAX_INFLIGHT_PER_SESSION` | 每会话 AI 在途上限（默认 1） | 部署配置 | 否 |
| `AI_MAX_INFLIGHT_GLOBAL` | 全局 AI 在途上限（默认 20） | 部署配置 | 否 |
| `AI_BODY_LIMIT_BYTES` | AI 中转请求体上限（默认 131072） | 部署配置 | 否 |
| `AI_RELAY_CONNECT_TIMEOUT_MS` | AI 连接超时 | 部署配置 | 否 |
| `AI_RELAY_TOTAL_TIMEOUT_MS` | AI 总超时 | 部署配置 | 否 |
| `AI_RELAY_MAX_RESPONSE_BYTES` | AI 响应上限 | 部署配置 | 否 |
| `RATE_LIMIT_AI_PER_MIN` | AI 限频 | 部署配置 | 否 |
| `SESSION_TTL_MS` | 匿名会话有效期（默认 7 天） | 部署配置 | 否 |
| `APP_VERSION` | 健康检查返回版本（默认 0.1.0） | 部署配置 | 否 |

> 不记录任何真实 Key/密码/Token；玩家 AI Key 由用户在运行时提供，不写入环境变量或仓库。
>
> Node 直连 TLS 时使用 DNS-01/webroot 证书，避免 certbot standalone 占用 80 与 Node 冲突；443 绑定用 systemd `CAP_NET_BIND_SERVICE` 或云 LB 回源 3000。HTTP/2 先不启用，保持 HTTP/1.1 以兼容 Socket.IO。

## 7. 测试账号与测试数据

- 测试账号：无（无账号体系）。
- 测试数据：12 人预女猎守/预女猎白固定夹具；主持人 + 12 座位；P1 用两个浏览器会话模拟主持/玩家。
- AI 测试：使用假端点/Mock，不提交真实 Key；T-020 e2e 拦截 `/api/v1/session` 与 `/api/v1/ai/relay` 验证成功链路，并以真实 API 验证私网地址拒绝；真实端点验证由用户自备。
- AI 本地存储：配置 `IndexedDB lrs.ai.config.v1`；Key 默认仅内存，勾选“记住本次会话”时 `sessionStorage lrs.ai.key.v1`；不写入 localStorage。

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

- 生产服务器/域名/证书/ICP 备案：未提供，待用户侧确认（T-024 已完成本地 HTTPS 演练与部署资产）。
- TLS 终止方式：Node HTTPS 直接终止（默认，已实现），或云负载均衡/CDN 终止（`HTTPS_ENABLED=0`、`TRUST_PROXY=1`）；不使用 Nginx/Docker（2026-11-25 用户决定）。
- 真实 AI 供应商行为（超时/错误码/额度）：实现期用用户自备端点验证。
