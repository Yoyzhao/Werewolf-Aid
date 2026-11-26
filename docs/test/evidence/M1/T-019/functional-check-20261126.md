# T-019 API 服务与 AI 中转功能测试

- 日期：2026-11-26
- 任务：T-019（阶段 5D）
- 测试对象：生产构建 `apps/api/dist/server.js` + `apps/web/dist`
- 基线：commit `ecc9679` + 本轮工作区变更（含功能测试发现并修复的错误映射缺陷）
- 方法：启动真实 HTTP 进程，使用 Node 原生 `fetch` 做黑盒验证；覆盖开发、固定 Origin、生产模式三种启动配置
- 范围：`GET /api/v1/health`、`GET /api/v1/session`、`POST /api/v1/ai/relay`、静态资源/SPA、限频、SSRF、请求限制、安全头、日志脱敏
- 不包含：P1 房间/WS/SQLite、TLS/443 部署（T-024）、真实 AI 供应商成功链路（T-020）
- 结论：**通过**；57/57 项功能检查通过，发现并修复 1 个错误处理缺陷

## 测试环境

| 项 | 值 |
| --- | --- |
| 操作系统 | Windows 11 |
| Node.js | v24.22.3 |
| 构建产物 | `apps/web/dist`、`apps/api/dist`（`npm run build`） |
| API 端口 | 3430（开发）、3431（`PUBLIC_ORIGIN`）、3432（生产属性）、3433（启动保护） |
| 配置 | 主实例 `NODE_ENV=development`、默认限频 10 次/分钟、默认 128KB AI 请求上限 |

## 覆盖矩阵与结果

| 分类 | 用例数 | 结果 | 关键验证 |
| --- | --- | --- | --- |
| 健康检查与安全头 | 4 | 通过 | 契约结构、无 Cookie、CSP/nosniff、HTTP 模式无 HSTS |
| 会话与 CSRF | 7 | 通过 | 48 位会话 ID、64 位 CSRF、Cookie 属性、会话复用、401/403、跨会话 token 拒绝 |
| 请求格式与 Schema | 8 | 通过 | 非法/空 JSON、缺字段与明细、空消息、超长内容、temperature/maxTokens/role 越界均 400 |
| SSRF | 12 | 通过 | http/ftp、账号密码、localhost、IPv4/IPv6 私网与环回、云元数据、十进制 IP、私网域名 |
| 大包与方法 | 3 | 通过 | 140KB→413、`application/xml`→4xx、GET 中转→404 |
| 静态与路由隔离 | 9 | 通过 | 入口与深链、缓存头、gzip、缺失资源 404、`/api` 与 `/socket.io` 不被 SPA 吞掉 |
| 限频 | 3 | 通过 | 前 10 次放行、第 11 次 429 + `Retry-After`、新会话不受影响 |
| `PUBLIC_ORIGIN` | 3 | 通过 | 无 Origin 403、错误 Origin 403、匹配 Origin 放行至 SSRF 校验 |
| 生产模式属性 | 3 | 通过 | Secure Cookie、HSTS、`upgrade-insecure-requests`、生产会话可调用中转 |
| 生产启动保护 | 1 | 通过 | 缺 `SESSION_SECRET` 退出码 1，日志含明确原因 |
| 日志脱敏 | 4 | 通过 | 有常规请求日志；无 API Key、无对话内容、无 Cookie 明文 |

完整逐项结果：[functional-output.txt](functional-output.txt)；服务日志：[functional-servers.log](functional-servers.log)。

## 发现与修复

| 编号 | 严重度 | 现象 | 根因 | 修复 | 复测 |
| --- | --- | --- | --- | --- | --- |
| FT-019-01 | P2 | `POST /ai/relay` 发送非法 JSON 返回 `500 INTERNAL`；不支持的 `Content-Type` 同样落入 500 | 统一错误处理器只识别 `ApiError`、`ZodError`、413/429，其余 Fastify 4xx（如 `FST_ERR_CTP_INVALID_JSON_BODY`）落到 500 分支 | 在 413/429 之后增加 4xx 兜底：保留原状态码并返回 `INVALID_REQUEST` | 非法 JSON→400、空 JSON→400、`application/xml`→415，均不再出现 500 |

修复位置：[app.ts](file:///e:/Desktop/Workspace2/Werewolf-Aid/apps/api/src/app.ts) 统一错误处理器；新增回归单测“请求体不是合法 JSON 返回 INVALID_REQUEST”；全量单测 214/214 通过。

## 验证命令

| 命令 | 结果 |
| --- | --- |
| `npm run typecheck` | 通过 |
| `npm test` | 214/214 通过（API 114 个） |
| `npx vitest run --coverage` | 全项目 85.46% statements / 81.10% branches / 89.06% functions / 87.08% lines；`apps/api/src` 91.37% / 87.76% / 91.48% / 92.70% |
| `npm run lint`、`npm run format:check` | 通过 |
| `npm run build`、`npm run verify:dist` | 通过 |
| 黑盒功能脚本 | 57/57 通过 |

## 限制与未覆盖

- 真实 AI 成功转发需要可控的公网 HTTPS 上游；本轮黑盒只验证到 SSRF 拒绝，成功链路与超时/1MB 上限由 `ai-relay.test.ts` 的注入 upstream 覆盖，真实供应商联调在 T-020。
- 60 秒总超时未在功能测试中真实等待，使用 fake transport 验证映射与清理逻辑。
- TLS/443、证书与 `TRUST_PROXY` 的实际代理行为属 T-024。
- 会话、限频、并发计数为单进程内存；多实例共享需外部存储（P1/M2 评估）。
- 匿名会话 Cookie 当前未签名；P0 无服务端敏感数据，不影响本任务。P1 房间身份上线前应增加 Cookie 签名或会话轮换，防止 Cookie 固定导致身份冒用（纳入 M2 安全设计核查）。
- `application/xml` 返回 415 + `INVALID_REQUEST`（契约表仅列 400），属于保留 HTTP 语义的记录项，前端不会触发该路径。
