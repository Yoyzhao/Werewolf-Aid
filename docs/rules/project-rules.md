# 项目规则

## 基本信息

- 项目：狼人杀助手 Web 应用
- **开发版本**：Web 应用（移动端优先 H5），**不是微信小程序版本**；v1.1/v1.2 小程序归档仅历史参考，不作为实现依据。
- 当前 PRD：[docs/prd/prd.md](../prd/prd.md)（v1.3，待用户验收）
- 规则源：[docs/prd/references/狼人杀规则说明.md](../prd/references/狼人杀规则说明.md)（资料汇编，非唯一口径）
- 唯一规则口径：PRD [附录 A](../prd/prd.md#附录-a-规则口径表唯一基线)
- 历史版本：[docs/prd/archive/](../prd/archive/)

## 技术约束

- Web 应用：前端 SPA（React/Vue + TypeScript）+ 后端 API/WebSocket（Node.js）；默认前后端分离，允许全栈；部署在自有/云服务器。
- **移动端优先**：主流 1080p 手机 + 5G/Wi-Fi 为主；CSS 竖屏 360–440px（主设计 360；320 兼容地板；DPR 2.5–3）；桌面/平板仅兼容，不做桌面专属布局。
- 浏览器主测 Chrome/Safari，UC/QQ 抽查，微信内置浏览器单独真机；基线见 PRD 附录 G（2026-11 调研）。
- 触控 ≥44px；主操作在底部拇指区；不依赖 hover；1–12 号用大网格/底部抽屉。
- 视口使用 100dvh + safe-area；输入框 ≥16px 防 iOS 缩放；键盘避让。
- 高清屏：图标 SVG，图片 2x/3x/WebP，DPR 2–3 不模糊。
- 性能预算：首屏 JS（gzip）≤250KB；5G/Wi-Fi 首屏 ≤2s、可交互 ≤3s；4G ≤3s/≤5s；主流 60fps、中端 ≥55fps。
- 主持端 Wake Lock 防熄屏（MDN：iOS Safari 18.4+），不支持时提示手动设置。
- 不使用微信小程序、公众号 H5 套壳、原生 App；不依赖应用商店/小程序审核。
- P0 单机本地优先；P1 联机 WebSocket + 轮询降级；AI 经后端中转。
- 12 人固定；预女猎守、预女猎白两个板子；屠边。
- 无账号体系；匿名会话 + 房间令牌；会话 Cookie 为 httpOnly + Secure + SameSite。
- BYOK：Key 默认不持久化、不落库、不写日志、不导出。
- HTTPS + 域名；境内服务器需 ICP 备案；数据库不对外暴露。

## 文档约定

- PRD：`docs/prd/prd.md`
- 规则源：`docs/prd/references/`
- 历史版本：`docs/prd/archive/`
- 项目进度：`docs/plan/project-progress.md`
- 技术方案：`docs/tech/`（步骤 3 创建）
- 测试：`docs/test/`（步骤 8 创建）
- 文档统一简体中文；版本变更记录在 PRD 第 1 章。

## 安全红线

- 真实 Key、凭证不得入库、入文档、入日志。
- P1 联机必须服务端过滤，前端隐藏不算通过。
- AI 中转仅 https，禁私网/链路本地/元数据地址，超时、限频、不落库。
- 会话使用 httpOnly + Secure + SameSite Cookie；状态变更接口加 CSRF 防护；CORS 白名单。
- AI/玩家输入输出转义或安全渲染，禁止内联 HTML；配置 CSP。
- 玩家个人记录仅本机；服务端房间结算/解散即删；数据库不对外暴露。

## 验收约定

- P0 验收使用 Given/When/Then；P1 验收不阻塞 P0。
- 规则判定以 PRD 附录 A 为准；AC-4 必须两个板子各跑一遍。
