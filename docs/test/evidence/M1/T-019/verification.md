# T-019 API 服务与 AI 中转验证

- 日期：2026-11-26
- 任务：T-019 API 服务与 AI 中转（阶段 5D）
- 基线：commit `ecc9679` + 本轮工作区变更
- 范围：Fastify 启动、静态资源与 SPA fallback、匿名会话/CSRF、AI 中转、健康检查、SSRF/超时/响应上限/限频/并发、日志脱敏、请求限制与 `TRUST_PROXY`
- 不包含：P1 房间/WS/SQLite；TLS/443 与生产代理部署（T-024）；真实 AI 供应商联调（T-020）
- 结论：通过（HTTP 内部冒烟 17/17）

## 实现内容

| 能力 | 实现 |
| --- | --- |
| 启动与配置 | `config.ts` 读取端口、超时、体积、限频、会话密钥等；生产环境缺 `SESSION_SECRET` 拒绝启动 |
| 匿名会话 | `GET /api/v1/session` 下发 `lrs_anon`（HttpOnly、SameSite=Lax、生产/HTTPS 加 Secure）；CSRF 为 `HMAC-SHA256(secret, sessionId)`，POST 校验 `x-csrf-token` 且使用定长比较 |
| AI 中转 | `POST /api/v1/ai/relay` 按 [api-contract](../../../../tech/api-contract.md) 校验 Zod 契约；仅 https；请求 128KB、响应 1MB、连接 30s、总 60s；不跟随重定向 |
| 错误映射 | `KEY_INVALID`、`QUOTA`、`UPSTREAM_4XX/5XX`、`TIMEOUT`、`NETWORK`、`URL_NOT_ALLOWED`、`RATE_LIMITED`、`INTERNAL` |
| SSRF | 拒绝非 https/账号密码/localhost；IPv4/IPv6 私网、环回、链路本地、元数据、CGNAT、文档网段、多播；DNS 全部解析结果须为公网，并把已验证 IP 固定到 `https.request` 的 lookup，防 DNS 重绑定 |
| 限频与并发 | `@fastify/rate-limit` 按会话限频（默认 10 次/分钟）；每会话 1 个在途、全局 20 个 |
| 静态服务 | `@fastify/static` 仅在 `apps/web/dist/index.html` 存在时注册；`assets/` 长缓存，入口 no-cache；SPA fallback 只处理非 `/api`、非 `/socket.io`、无扩展名的 GET |
| 安全头 | Helmet CSP（禁止内联脚本）、nosniff；未启用 HTTPS 时不发 HSTS |
| 日志脱敏 | Cookie 与 CSRF 头加入 pino `redact`；异常日志只记录 `name`/`code`，不记录请求体、Key、对话内容 |

主要文件：

- `packages/shared/src/index.ts`：API 版本、Cookie/CSRF 常量与 Zod 契约
- `apps/api/src/config.ts`、`server.ts`：配置与启动
- `apps/api/src/session.ts`：会话与 CSRF
- `apps/api/src/ssrf.ts`：URL/DNS 校验与地址判定
- `apps/api/src/ai-relay.ts`：上游请求、响应解析与错误映射
- `apps/api/src/app.ts`：路由、限频/并发、静态与统一错误处理
- `apps/api/src/app.test.ts`、`ssrf.test.ts`、`session.test.ts`、`ai-relay.test.ts`、`config.test.ts`

## 验证结果

| 验证项 | 方法 | 结果 |
| --- | --- | --- |
| 健康检查 | 契约测试 + HTTP 冒烟：`{ ok: true, version }`，无 Cookie | 通过 |
| 会话契约 | 48 位会话 ID、64 位 CSRF、`expiresAt`；复用会话不重复发 Cookie | 通过 |
| CSRF | 缺少会话 401；缺少/错误 token 403；Origin 不匹配 403，匹配放行 | 通过 |
| 中转成功 | 注入 upstream stub；校验目标 URL、固定 IP、鉴权头、`temperature` 0.7、`max_tokens` 800 默认值 | 通过 |
| 中转错误 | 401/403→`KEY_INVALID`、402→`QUOTA`、429→`RATE_LIMITED`、其他 4xx/5xx、3xx、非 JSON、空内容均有映射 | 通过 |
| 超时/网络 | 连接超时、总超时、响应超限、网络错误（fake HTTPS transport） | 通过 |
| SSRF | http/ftp、账号密码、localhost、14 类私网 IPv4、10 类私网 IPv6、私网 DNS、空 DNS、元数据地址 | 通过 |
| 大包 | 140KB 请求体返回 413 `INVALID_REQUEST` | 通过 |
| 限频 | 每分钟 2 次的测试配置下第 3 次 429，带 `Retry-After` | 通过 |
| 并发 | 同会话首个请求在途时第二个 429 | 通过 |
| 配置边界 | 生产缺 `SESSION_SECRET` 拒绝启动；`TRUST_PROXY`、请求/AI 限制、超时与版本可覆盖；非法数值回退默认；相对 `WEB_DIST_DIR` 归一为绝对路径 | 通过 |
| 静态/API | SPA 深链回 index；`/api/*`、`/socket.io`、缺失静态文件、非 GET 均返回 JSON 404，不互吞 | 通过 |
| 日志脱敏 | HTTP 冒烟后检索服务日志：无 API Key、无对话内容、无 Cookie 明文 | 通过 |

## 命令与结果

| 命令 | 结果 |
| --- | --- |
| `npm run typecheck` | 全部 workspace 通过 |
| `npm test` | 214/214 通过（API 新增 114 个） |
| `npx vitest run --coverage` | 全项目 85.46% statements / 81.10% branches / 89.06% functions / 87.08% lines；`apps/api/src` 91.37% / 87.76% / 91.48% / 92.70% |
| `npm run lint`、`npm run format:check` | 通过 |
| `npm run build`、`npm run verify:dist` | 通过 |
| 独立黑盒功能检查 | 57/57 通过；详见 [functional-check-20261126.md](functional-check-20261126.md) |
| `node .artifacts/t019-smoke/smoke.mjs` | 17/17 通过（脚本为本地临时工具，输出与服务日志已归档） |

HTTP 冒烟覆盖：health、session/Cookie 属性、首页与 SPA 深链、哈希资源缓存、API/静态 404 隔离、私网 SSRF、缺少 CSRF、非 https、非法参数、安全头、日志脱敏。

归档：

- `docs/test/evidence/M1/T-019/smoke-output.txt`
- `docs/test/evidence/M1/T-019/smoke-server.log`

## 限制

- TLS/443、证书、`TRUST_PROXY` 与反向代理行为属部署阶段（T-024），本轮只验证 HTTP 内部端口与同源行为。
- 成功中转使用注入的 upstream stub 验证协议与默认值；真实供应商端点联调在 T-020/步骤 7 完成。
- 会话、限频与并发计数为单进程内存；多实例部署需外部存储，属 P1/M2 评估。
- 匿名会话 Cookie 未签名；P1 房间身份上线前需增加签名或会话轮换（M2 安全核查），P0 无服务端敏感数据。
- 未实现任何 P1 房间/WS/SQLite 路由。
