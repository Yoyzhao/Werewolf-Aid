# T-024 部署与上线准备报告

- 日期：2026-11-26
- 任务：T-024（阶段 9 部署）
- 基线：阶段 8 验收通过后的工作区；PRD v1.3.2；ADR-005（Node 单进程、无 Nginx/Docker）
- 结论：**本地生产部署演练通过，部署资产齐全**；真实服务器/域名/证书/ICP 未提供，按阻塞记录，不视为已完成线上部署

## 1. 交付物

| 类型 | 路径 | 说明 |
| --- | --- | --- |
| 部署文档 | [项目部署文档.md](../../../../deploy/项目部署文档.md) | 拓扑、目录、首次部署、TLS、systemd、发布/回滚、备份、冒烟、上线检查单 |
| systemd 单元 | [werewolf-aid.service](../../../../deploy/werewolf-aid.service) | Node 单进程守护、443 capability、重启策略与加固 |
| 环境模板 | [env.production.example](../../../../deploy/env.production.example) | 生产变量、TLS/跳转/LB 两种模式说明 |
| 冒烟脚本 | [smoke.mjs](../../../../../scripts/deploy/smoke.mjs) | 22 项 HTTPS/安全头/静态/API/跳转检查，零依赖 |
| 代码 | `apps/api/src/{config,app,server}.ts` | Node HTTPS 直连、80→443 跳转、启动保护 |

## 2. 代码变更

| 文件 | 变更 |
| --- | --- |
| `config.ts` | 新增 `TLS_KEY_PATH`、`TLS_CERT_PATH`、`HTTP_REDIRECT_PORT`；`HTTPS_ENABLED=1` 缺少证书路径时拒绝启动 |
| `app.ts` | 新增 `https` 构建选项，通过 `serverFactory` 以 `node:https` 创建服务；沿用 Helmet HSTS/CSP |
| `server.ts` | HTTPS 监听、可选 80→443 301（保留路径/查询）、SIGTERM/SIGINT 优雅关闭 |
| 测试 | 新增 3 个用例：证书路径缺失保护、未启用 HTTPS 无 HSTS、启用 HTTPS 有 HSTS 与 `upgrade-insecure-requests` |

说明：Node 直连 TLS 时由系统语义 `AmbientCapabilities=CAP_NET_BIND_SERVICE` 授权 443/80；云 LB 终止 TLS 时以 `HTTPS_ENABLED=0`、`TRUST_PROXY=1` 回源 3000。

## 3. 本地部署演练

环境：Windows 11 / Node 24.22.3 / 自签证书（CN=localhost，SAN=DNS:localhost,IP:127.0.0.1）/ 生产构建 / HTTPS 3443 + HTTP 3080（替代 443/80）。

| 演练项 | 结果 | 证据 |
| --- | --- | --- |
| HTTPS 直连与安全头 | **22/22 通过**：HSTS、CSP、nosniff、Secure Cookie、静态长缓存/gzip、SPA fallback、API 404、AI 未授权 401 | [https-smoke.log](https-smoke.log)、[https-smoke-final.log](https-smoke-final.log) |
| HTTP→HTTPS 跳转 | 301，保留 `/board/pre-setup?step=2` | 同上 |
| 进程重启 | 重启后 `/api/v1/health` 200 | [deploy-rehearsal.log](deploy-rehearsal.log) |
| 静态发布/回滚 | release A → B（页面出现 `release-b` 标记）→ 回滚 A（标记消失），健康检查均 200 | 同上 |
| 后端产物恢复 | `apps/api/dist` 从备份恢复后启动，健康检查 200 | 同上 |
| 启动保护 | `HTTPS_ENABLED=1` 缺证书路径 → 退出码 1，错误信息明确 | 同上 |
| 证书续期（自签模拟） | 生成新证书并覆盖 → 重启 → 健康检查 200，证书 serial 变化 | 同上 |
| 备份/恢复 | env 模板与证书打包解压后哈希一致 | 同上 |

## 4. 质量门控

| 项 | 结果 |
| --- | --- |
| lint / format:check / typecheck | 通过 |
| 单元/组件/API | **245/245**（新增 3 个部署相关用例） |
| E2E | 24/24 |
| build / verify:dist | 通过；首屏 JS 136.45 kB gzip |
| 冒烟脚本语法 | `node --check` 通过 |

日志：[gates.log](gates.log)、[unit-tests.log](unit-tests.log)、[e2e.log](e2e.log)、[build.log](build.log)、[verify-dist.log](verify-dist.log)。

## 5. 未执行 / 阻塞

| 项 | 状态 | 说明 |
| --- | --- | --- |
| 真实服务器与 443 绑定 | **阻塞** | 未提供服务器；本地以高端口与自签证书演练 |
| 域名、真实证书、证书续期 | **阻塞** | 无域名/DNS；文档已给出 DNS-01 与续期钩子，需线上验证 |
| ICP 备案 | **阻塞** | 境内上线前置，需用户侧办理 |
| 云 LB 模式 | 未演练 | 无 LB 环境；配置与文档已给出，需线上验证 `TRUST_PROXY`/HSTS |
| 真机矩阵（AC-16/AC-17） | **阻塞** | 沿用 T-023 记录，需借测或预发布抽测 |
| 真实 AI 供应商 | **未执行** | 沿用 T-023；需用户自备端点 |

## 6. 结论与建议

1. 部署资产、Node HTTPS 能力、启动保护、跳转、重启、回滚、备份与冒烟均已在本地验证，可进入线上部署执行。
2. T-024 记为**有条件完成**：真实服务器、域名/证书、ICP、云 LB 与真机项需在拿到环境后完成。
3. 建议阶段 9 验收时确认：
   - 服务器/域名/证书/ICP 的提供时间与负责人；
   - 采用 Node 直连 TLS 还是云 LB（决定 `HTTPS_ENABLED`/`TRUST_PROXY`）；
   - 上线前是否补做真机抽测与真实 AI 端点复跑。
