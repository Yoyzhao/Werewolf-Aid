# T-020 AI 前端接入与前后端整合验证

- 日期：2026-11-26
- 任务：T-020（阶段 6 前后端整合）
- 基线：commit `ecc9679` + 5D/T-019 验收后工作区变更
- 范围：模型配置（URL/模型/Key）、上下文组装、`POST /api/v1/ai/relay` 请求、loading/取消/超时、错误码文案、Key 存储策略、纯文本安全渲染、同源 Cookie/CSRF
- 不包含：P1 房间/WS、流式输出、平台默认模型、真实供应商成功链路（T-022）
- 结论：**通过**；242 单测、18 e2e、生产构建同源联调 9/9 均通过

## 实现内容

| 能力 | 实现 |
| --- | --- |
| 模型配置 | 接口地址（仅 https）、模型名、API Key、温度 0–2、最大输出 100–2000；格式校验在本地完成，保存不发起网络请求 |
| Key 存储 | 默认仅内存；勾选“记住本次会话”写入 `sessionStorage`（`lrs.ai.key.v1`），关闭标签页失效；清除配置同时移除 |
| 配置持久化 | 地址/模型/温度/最大输出写入 IndexedDB（`lrs.ai.config.v1`）；刷新保留，Key 默认不保留 |
| 会话/CSRF | 应用启动预取 `GET /api/v1/session`；中转携带同源 Cookie 与 `x-csrf-token`；401/403 刷新会话并重试一次 |
| 上下文 | `buildAssistantContext` 组装身份/局势/标签/信息/发言/自由描述，≤20000 字截断；请求消息为 system + user |
| 状态机 | `config-missing → idle → loading → success / error / cancelled`；同一时刻 1 个在途请求，取消使用 `AbortController` |
| 超时 | 前端 60 秒超时映射为 `TIMEOUT`，提示“请求超时（60 秒）”；不自动重试 |
| 错误文案 | `KEY_INVALID`、`QUOTA`、`TIMEOUT`、`NETWORK`、`RATE_LIMITED`、`URL_NOT_ALLOWED`、`UPSTREAM_4XX/5XX`、`INVALID_REQUEST` 等按契约映射；配置类错误不提供重试 |
| 输出安全 | 分析结果按纯文本渲染（`whitespace-pre-wrap`），不使用 `dangerouslySetInnerHTML`；HTML 载荷只作为文本显示 |
| 隐私/边界 | 固定提示“上下文将发往你自配的第三方模型；Key 默认仅本次会话使用”“AI 分析仅供参考，可能出错，请自行判断” |

主要文件：

- `apps/web/src/lib/ai-config.ts`：配置校验、IndexedDB/sessionStorage/内存存储
- `apps/web/src/lib/ai-client.ts`：会话缓存、CSRF、超时/取消、错误映射
- `apps/web/src/stores/ai-store.ts`：配置与请求状态机
- `apps/web/src/features/assistant/AIConfigForm.tsx`、`AIPanel.tsx`
- `apps/web/src/features/assistant/AssistantScreen.tsx`、`apps/web/src/App.tsx`
- `tests/e2e/assistant-ai.spec.ts`

## 验证结果

| 验证项 | 方法 | 结果 |
| --- | --- | --- |
| 配置校验 | 单测：缺少地址/模型/Key、非 https、账号密码、温度/最大输出越界 | 通过 |
| 配置存储 | 单测 + e2e：非密钥配置刷新保留；Key 默认刷新丢失；勾选记住后刷新可用；清除后移除 | 通过 |
| 请求契约 | 单测 + e2e：请求体仅 `baseUrl/apiKey/model/messages/temperature/maxTokens`；system + user；Key 不出现在 URL | 通过 |
| 会话/CSRF | 单测：预取会话、复用 token、401 刷新后重试一次；生产同源浏览器联调通过 | 通过 |
| 状态机 | 组件测试：成功三段结果、可重试错误、不可重试错误、加载中取消、重新整理 | 通过 |
| 超时 | 单测：20ms 测试超时映射为 `TIMEOUT`，默认常量 60000ms | 通过 |
| 输出安全 | 组件测试：`<img onerror>` 作为文本显示，无 DOM 注入、无脚本执行 | 通过 |
| 隐私 | 生产联调：日志无 API Key、无上下文、无 Cookie；`document.cookie` 读不到 HttpOnly 会话 | 通过 |
| 无阻塞 | 配置缺失/请求失败仅影响 AI 卡片，主持/助手/规则与本地保存不受影响 | 通过 |
| 响应式 | e2e 320/390/430 无横向滚动；表单、按钮、结果区域可读 | 通过 |

## 测试数据

| 项 | 结果 |
| --- | --- |
| `npm test` | 242/242 通过（新增 AI 相关 28 个：配置 10、客户端 11、UI 7） |
| `npm run e2e` | 18/18 通过（新增 AI 4 个） |
| 覆盖率（`vitest --coverage`） | 全项目 85.75% statements / 80.77% branches / 89.29% functions / 87.49% lines；`apps/web/src` 90.76% / 84.37% / 96.96% / 90% |
| `npm run lint`、`format:check`、`typecheck` | 通过 |
| `npm run build`、`verify:dist` | 通过；首屏 JS 110.45 kB gzip，助手页 chunk 8.25 kB gzip |
| 生产同源联调 | 9/9 通过：API 提供构建产物，浏览器配置后经真实 session/CSRF 调用中转，私网地址按 `URL_NOT_ALLOWED` 文案展示 |

生产同源联调输出：[integration-output.txt](integration-output.txt)；服务日志：[integration-server.log](integration-server.log)。

## 截图

- `docs/test/evidence/M1/T-020/assistant-ai-form-390.png`
- `docs/test/evidence/M1/T-020/assistant-ai-result-390.png`
- `docs/test/evidence/M1/T-020/assistant-ai-error-320.png`
- `docs/test/evidence/M1/T-020/assistant-ai-error-430.png`
- `docs/test/evidence/M1/T-020/assistant-ai-real-api-390.png`

## 限制

- 无用户可控的公网 HTTPS 上游与真实 Key，成功链路使用浏览器/组件 mock 验证；真实供应商联调在 T-022。
- 60 秒超时与 1MB 响应上限由单测和 T-019 后端测试覆盖，未在联调中真实等待。
- 浏览器 e2e 使用开发 API（端口 3000）以支持 Vite 代理；生产同源联调单独使用构建产物 + API 进程完成。
- Key 勾选“记住本次会话”使用 sessionStorage，仍可被同源 XSS 读取；已在界面提示，长期记住仍不提供。
