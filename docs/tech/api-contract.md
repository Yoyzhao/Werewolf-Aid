# API 契约

- 版本：v1.1
- 日期：2026-11-25
- PRD 基线：v1.3.1（P0 本轮；P1 下一迭代）
- 关联：[技术架构](tech-arch.md)；[ADR-003](arch/ADR-003-联机同步与匿名身份.md)；[ADR-004](arch/ADR-004-AI中转与安全边界.md)
- 状态：待步骤 3 验收；实现前以本文档为准，变更按兼容策略处理
- 变更：v1.1 快照改为完整 `gameState`，服务端生成视图；补 `INVALID_STATE`、快照/WS 大小上限

## 1. 通用约定

- Base URL：`/api/v1`
- 协议：HTTPS；请求/响应 `application/json; charset=utf-8`
- 时间：UTC epoch 毫秒（INTEGER）；展示层按 Asia/Shanghai 格式化
- 身份：匿名会话 Cookie `lrs_anon`（`httpOnly + Secure + SameSite=Lax`）；无账号体系
- CSRF：`GET /api/v1/session` 返回 `csrfToken`；所有 `POST/PUT/DELETE` 带 `X-CSRF-Token`
- CORS：默认同源；分离部署时仅允许配置的前端 Origin，且带凭证时不得使用 `*`
- 错误格式：

```json
{
  "error": {
    "code": "STALE_VERSION",
    "message": "快照版本过期",
    "details": { "currentVersion": 12 }
  }
}
```

- 幂等：创建/加入/确认/结算支持 `Idempotency-Key` 请求头；重复请求返回同一结果
- 版本兼容：`/api/v1` 内只做向后兼容的新增；破坏性变更升 `/api/v2`
- 限频：返回 `429 RATE_LIMITED`，带 `Retry-After`

## 2. P0 接口（会话/健康/AI 中转）

### 2.1 `GET /api/v1/session`

建立/读取匿名会话并返回 CSRF token。

响应：

```json
{ "csrfToken": "...", "expiresAt": 1764000000000 }
```

### 2.2 `GET /api/v1/health`

无鉴权健康检查，供进程管理器/云负载均衡健康检查使用。

响应：`{ "ok": true, "version": "v1.0" }`

### 2.3 `POST /api/v1/ai/relay`

由后端向玩家配置的 Chat Completions 端点转发。

请求：

```json
{
  "baseUrl": "https://api.example.com/v1/chat/completions",
  "apiKey": "sk-...",
  "model": "gpt-4o-mini",
  "messages": [
    { "role": "system", "content": "你是狼人杀助手..." },
    { "role": "user", "content": "我的身份是预言家..." }
  ],
  "temperature": 0.7,
  "maxTokens": 800
}
```

响应：

```json
{
  "ok": true,
  "content": "信息整理：...\n可疑对象：...\n下一步建议：...",
  "usage": { "promptTokens": 1200, "completionTokens": 300 }
}
```

约束：

| 项 | 值 |
| --- | --- |
| 请求体上限 | 128KB |
| 响应上限 | 1MB |
| 连接超时 | 30s |
| 总超时 | 60s |
| 协议 | 仅 https |
| 目标地址 | 拒绝私网/环回/链路本地/元数据地址；不跟随到私网的重定向 |
| 限频 | 示例 10 次/分钟/会话；具体值步骤 5D 定 |
| 持久化 | 不落库、不写日志、不保存 Key |

业务错误：`KEY_INVALID`、`QUOTA`、`TIMEOUT`、`NETWORK`、`UPSTREAM_4XX`、`UPSTREAM_5XX`、`RATE_LIMITED`、`URL_NOT_ALLOWED`、`INVALID_REQUEST`。

## 3. 联机房间（P1，下一迭代）

### 3.1 身份与权限

- 主持人：创建房间时获得 `hostToken`（只返回一次）；服务端只存 SHA-256 哈希。
- 玩家：匿名会话 + 配对码 + 编号申请；主持人确认后绑定。
- 玩家只能读自己的视图；主持人可写快照、确认/解绑、结算/解散。

### 3.2 端点总览

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| POST | `/rooms` | 主持人会话 | 创建房间，返回配对码 + hostToken |
| POST | `/rooms/recover` | hostToken/恢复码 | 恢复主持权限 |
| POST | `/rooms/{code}/join` | 玩家会话 | 申请绑定编号 |
| POST | `/rooms/{code}/confirm` | 主持人 | 确认绑定 |
| POST | `/rooms/{code}/unbind` | 主持人 | 解绑/重置编号 |
| PUT | `/rooms/{code}/snapshot` | 主持人 | 写入阶段快照（带 version） |
| GET | `/rooms/{code}/view` | 绑定玩家 | 读取自己的视图（轮询降级） |
| POST | `/rooms/{code}/settle` | 主持人 | 结算并标记房间 |
| DELETE | `/rooms/{code}` | 主持人 | 解散并删除房间/快照 |
| GET | `/rooms/{code}` | 主持人 | 读取房间摘要/当前 version |

### 3.3 创建房间

`POST /api/v1/rooms`

```json
{ "boardId": "pre-witch-hunter-guard" }
```

响应：

```json
{
  "roomId": "r_...",
  "code": "483920",
  "hostToken": "一次返回的随机令牌",
  "joinExpiresAt": 1764000600000,
  "expiresAt": 1764086400000
}
```

- 配对码：6 位数字，全局唯一；冲突时重新生成；加入有效期 10 分钟（`joinExpiresAt`）。
- `hostToken` 客户端保存（本机），服务端只存哈希；只在创建响应返回一次，不写日志；遗失需重建房间。
- 幂等：带 `Idempotency-Key` 的重复创建返回同一房间。

### 3.4 申请/确认/解绑

`POST /rooms/{code}/join`

```json
{ "seatNo": 5 }
```

响应：`{ "status": "pending", "applicantId": "s_..." }`

`POST /rooms/{code}/confirm`

```json
{ "seatNo": 5, "applicantId": "s_..." }
```

响应：`{ "status": "bound" }`

`POST /rooms/{code}/unbind`

```json
{ "seatNo": 5 }
```

响应：`{ "status": "unbound" }`

规则：一个编号只能绑定一个会话；重复申请返回当前状态；按会话/IP 限频。

### 3.5 写入快照

`PUT /rooms/{code}/snapshot`

```json
{
  "version": 12,
  "phase": "NIGHT",
  "gameState": {
    "boardId": "pre-witch-hunter-guard",
    "round": 2,
    "seats": [],
    "nightActions": [],
    "publicEvents": [],
    "result": null
  }
}
```

响应：`{ "version": 12 }`

- `gameState` 是 `game-engine` 定义的完整对局状态（含身份、夜间动作、公开事件）；仅服务端存储，不下发玩家。
- 服务端校验主持人身份、状态流转与 `version`，用 `game-engine` 校验并生成 `publicView`/`privateViews`；主持端不发送现成 `privateViews`。
- 服务端在 `game_states` 存完整状态，在 `snapshots` 存过滤视图；玩家只能通过 `GET /view`/WS 获取自己的视图。
- `version` 必须大于当前版本，否则 `409 STALE_VERSION`；状态非法返回 `422 INVALID_STATE`。
- 快照请求体上限 256KB；主持端写失败可重试；重连后先 `GET /rooms/{code}` 取当前 `version`，再补写。

### 3.6 读取视图

`GET /rooms/{code}`（主持人摘要）

```json
{ "roomId": "r_...", "code": "483920", "phase": "NIGHT", "status": "active", "version": 12, "expiresAt": 1764086400000 }
```

`GET /rooms/{code}/view`（玩家）

响应：

```json
{
  "version": 12,
  "phase": "NIGHT",
  "view": {
    "mySeat": 5,
    "role": "SEER",
    "checks": [{ "target": 3, "result": "WOLF" }],
    "alive": [1,2,3],
    "events": []
  }
}
```

- 仅返回调用者有权看到的信息；越权返回 `403`。
- WebSocket 不可用时每 5s 轮询；`version` 递增。

### 3.7 结算/解散

`POST /rooms/{code}/settle`

```json
{ "winner": "WOLVES", "reason": "神职全部出局" }
```

响应：`{ "status": "settled" }`

`DELETE /rooms/{code}` → `204`

- 结算/解散删除 `rooms`、`room_seats`、`snapshots`；删除后不可恢复。
- 过期房间由服务端 TTL 清理（`expires_at`）。

## 4. WebSocket（P1）

- 连接：`wss://<host>/ws/rooms?code=483920`
- 鉴权：握手携带匿名会话 Cookie；校验 Origin；未绑定会话拒绝。
- 服务端 → 客户端事件：

```json
{ "type": "room.view", "version": 12, "view": { "mySeat": 5, "role": "SEER", "alive": [1,2,3] } }
{ "type": "room.closed", "reason": "settled" }
{ "type": "room.error", "code": "FORBIDDEN", "message": "无权查看" }
```

- 客户端不通过 WebSocket 写状态；主持写操作走 HTTP。
- 断线重连：指数退避；重连后先 `GET /view` 补齐；连续失败 3 次降级 5s 轮询。
- 服务端只推送过滤后的视图，不推送原始状态；WebSocket 单条消息上限 64KB。
- 主持写操作走 HTTP；服务端用 `game-engine` 校验完整状态并生成视图。

## 5. 错误码

| code | HTTP | 说明 |
| --- | --- | --- |
| INVALID_REQUEST | 400 | 参数校验失败 |
| UNAUTHORIZED | 401 | 无会话/会话过期 |
| FORBIDDEN | 403 | 越权（非主持人/非绑定玩家） |
| NOT_FOUND | 404 | 房间/编号不存在 |
| CONFLICT | 409 | 编号已绑定/状态冲突 |
| STALE_VERSION | 409 | 快照版本过期 |
| INVALID_STATE | 422 | 状态流转/规则校验失败 |
| RATE_LIMITED | 429 | 触发限频 |
| TIMEOUT | 504 | AI 上游超时 |
| UPSTREAM_4XX/5XX | 502 | AI 上游错误 |
| KEY_INVALID | 400 | Key 无效 |
| QUOTA | 402/429 | 额度不足 |
| URL_NOT_ALLOWED | 400 | URL 非 https/私网/元数据地址 |
| INTERNAL | 500 | 未预期错误（脱敏） |

## 6. 安全与兼容

- 所有写接口校验会话、CSRF、Origin；主持人接口额外校验 hostToken 哈希。
- AI Key 不落库、不写日志；请求体不作为日志字段。
- 玩家视图由服务端按角色过滤；前端隐藏不作为保密手段。
- 同源部署优先；分离部署 CORS 白名单；CSP 禁止内联脚本。
- `/api/v1` 内新增字段向后兼容；删除/改语义升版本。
- 无账号、无支付、无第三方登录、无公开 API。

## 7. 不适用

- 文件上传、对象存储、消息队列、Webhook、公开 OpenAPI 文档：当前版本不涉及。
