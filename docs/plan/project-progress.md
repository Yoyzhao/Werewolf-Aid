# 项目进度

- 项目：狼人杀助手 Web 应用
- **开发版本**：Web 应用（移动端优先 H5），**不是微信小程序版本**；唯一基线 PRD v1.3.2（v1.3.1 + CHG-20261125-02）。
- **当前主阶段**：步骤 5C 前端实现（已完成，待阶段验收）
- 拓扑：前后端分离 monorepo；React + Vite 前端；Fastify 后端；P1 Socket.IO + SQLite
- **当前里程碑**：M1 v1.3.1（P0；PRD 已增补至 v1.3.2，M1 编号与范围不变）
- 最近更新：2026-11-26

## 当前入口

| 交付线 / 版本 | 能试什么、从哪里进入 | 预期结果 | 已知限制 / 待决定事项 | 下一验收节点 | 依据 / 更新时间 |
| --- | --- | --- | --- | --- | --- |
| M1 v1.3.1 P0 | 5A 原型：[docs/prototype/M1/index.html](../prototype/M1/index.html)；`python -m http.server` 或直接双击打开 | 月蚀俱乐部视觉；走完主持闭环（设置→发牌 A/B/C→夜间→竞选→死讯→发言→投票→结算）+ 助手 + 规则；顶部流程条与白天子步骤；角色头像统一；PC ≥1024 双栏 | 原型不落存储、规则为简化模拟；模式 C 为手动选择身份（CHG-20261125-02）；5B 契约见 [interaction-spec](../tech/interaction-spec.md)；T-021 真机复测延后至发布前（风险接受 2026-11-26）；规则页已补齐（T-034） | 5C 阶段验收 | PRD v1.3.2 / interaction-spec v1.1 / 2026-11-26 |

## 项目概览

| 项目名称 | 狼人杀助手 Web 应用 |
| --- | --- |
| 项目拓扑 | 前后端分离（monorepo） |
| 开始日期 | 2026-11-25 |
| 预计结束 | 待排期 |
| 交付基线 | 无（首轮开发） |
| 最后更新 | 2026-11-26 |

## 里程碑概览

- [ ] **M1** v1.3.1 P0 单机主持闭环 — 进行中（5C 完成，待阶段验收）
- [ ] **M2** v1.4 P1 联机与 PWA — 后续
- [ ] **M3** P2 扩展能力 — 后续

## 阶段推进概览

| 阶段/切片 | 名称 | 状态 | 验收状态 | 当前修订或依据 |
| --- | --- | --- | --- | --- |
| 1-2 | PRD | 已完成 | 已通过（v1.3.2 增补待走查） | PRD v1.3.1（2026-11-24）+ v1.3.2（CHG-20261125-02） |
| 3 | 技术架构 | 已完成 | 已通过 | tech-arch v1.3 / api-contract v1.1（2026-11-25） |
| 4 | 任务拆解 | 已完成 | 已通过 | [STEP-4](tasks/M1/STEP-4.md)（2026-11-25） |
| 5A | 移动端/PC 响应式原型 | 已完成 | 已通过（2026-11-25） | [STEP-5A](tasks/M1/STEP-5A.md)；CHG-20261125-01/02 |
| 5B | 交互细化/契约 | 已完成 | 已通过（2026-11-26） | [STEP-5B](tasks/M1/STEP-5B.md)；[interaction-spec](../tech/interaction-spec.md) v1.1 |
| 5C | 前端实现 | 已完成 | 待验收 | [STEP-5C](tasks/M1/STEP-5C.md)；11 项任务全部完成（含 T-034 规则页 UI） |
| 5D | 后端实现 | 待启动 | 未提交 | [STEP-5D](tasks/M1/STEP-5D.md) |
| 6 | 整合 | 待启动 | 未提交 | [STEP-6](tasks/M1/STEP-6.md) |
| 7 | 联调 | 待启动 | 未提交 | [STEP-7](tasks/M1/STEP-7.md) |
| 8 | 测试 | 待启动 | 未提交 | [STEP-8](tasks/M1/STEP-8.md) |
| 9 | 部署 | 待启动 | 未提交 | [STEP-9](tasks/M1/STEP-9.md) |

## 用户确认记录

| 日期时间 | 事项 | 类型 | 结论 | 依据 |
| --- | --- | --- | --- | --- |
| 2026-11-24 | PRD v1.3.1 验收 | 基线 | 确认 | 用户“验收通过，进入步骤 3” |
| 2026-11-25 | 步骤 3 技术方案验收 | 基线 | 确认 | 用户“验收通过，进入步骤 4” |
| 2026-11-25 | Node-only，不使用 Nginx/Docker | 变更 | 确认 | 用户明确要求 |
| 2026-11-25 | 技术方案评审整改（完整 gameState/服务端视图、Node 加固） | 变更 | 确认 | 用户“按建议修改方案” |
| 2026-11-25 | 步骤 4 任务拆解验收（含评审修订） | 基线 | 确认 | 用户“验收通过，进入 5A 阶段” |
| 2026-11-25 | 5A 原型验收（视觉/流程/角色头像） | 基线 | 确认 | 用户“好的验收通过，进行下一步” |
| 2026-11-26 | 5B 交互契约验收（v1.1 评审修订） | 基线 | 确认 | 用户“验收通过，进入下一步” |
| 2026-11-25 | PC 端响应式适配（不做 PC 专属流程/大屏投屏） | 变更 | 确认 | 用户“也要考虑到 PC 端”；选项确认“响应式适配”“不需要大屏”；CHG-20261125-01 |
| 2026-11-25 | 新增发牌模式 C：实体牌线下发放，主持人手动选择身份，系统主持 | 变更 | 确认 | 用户“需要的，这种模式是常用的”“把身份确认改成手动选择”；CHG-20261125-02 |
| 2026-11-26 | T-021 接受实验室证据，真机复测延后至发布前 | 风险接受 | 确认 | 用户“接受实验室证据，把真机复测延后到发布前并登记风险接受”；批准人：用户；补救：T-023 真机复测、T-024 前把关 |
| 2026-11-26 | 新增 T-034 规则页 UI，补齐 P0-1 | 变更 | 确认 | 用户选择“新增 T-034 并补齐（推荐）” |

## 任务池

> 所有任务来源为 PRD v1.3.2 / tech-arch v1.3 / ADR；拓扑为前后端分离；负责人 `main`（单 Agent）。P1 不进入 M1 统计。

### 任务总表

| 任务 ID | 名称/范围 | 阶段/切片 | 状态 | 优先级 | 依赖 | 阶段文档 | 产出/证据 | 阻塞/下一步 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T-001 | PRD v1.1 评审 | M1/1-2 | 已完成 | P0 | 无 | PRD | 评审结论 | 无 |
| T-002 | PRD v1.2 修订与目录重组 | M1/1-2 | 已完成 | P0 | T-001 | PRD | v1.2 归档 | 无 |
| T-003 | 平台切换 Web + 服务器 | M1/1-2 | 已完成 | P0 | T-002 | PRD | v1.3 归档 | 无 |
| T-004 | 移动端优先专项 | M1/1-2 | 已完成 | P0 | T-003 | PRD | AC-16/17 | 无 |
| T-005 | PRD v1.3.1 修订 | M1/1-2 | 已完成 | P0 | T-004 | PRD | PRD v1.3.1 | 无 |
| T-006 | 用户验收 PRD v1.3.1 | M1/1-2 | 已完成 | P0 | T-005 | PRD | 2026-11-24 | 无 |
| T-007 | 步骤 3 技术架构 | M1/3 | 已完成 | P0 | T-006 | tech-arch | tech-arch v1.2 | 无 |
| T-008 | 用户验收步骤 3 | M1/3 | 已完成 | P0 | T-007 | tech-arch | 2026-11-25 | 无 |
| T-009 | 步骤 4 任务拆解 | M1/4 | 已完成 | P0 | T-008 | [STEP-4](tasks/M1/STEP-4.md) | 本文件/STEP-4 | 无 |
| T-010 | P1 下一迭代规划 | M2/规划 | 待开始 | P1 | T-019/T-031 | [dev-plan](project-dev-plan.md) | 未产生 | M1 核心后启动 |
| T-011 | 部署形态调整 Node-only | M1/3 | 已完成 | P0 | T-008 | tech-arch | ADR-005 | 无 |
| T-012 | 技术方案评审整改 | M1/3 | 已完成 | P0 | T-011 | tech-arch | tech-arch v1.2 / API v1.1 | 无 |
| T-013 | 主持闭环原型（移动 + PC 响应式，含发牌模式 C） | M1/5A | 已完成 | P0 | T-012 | [STEP-5A](tasks/M1/STEP-5A.md#t-013) | `docs/prototype/M1/index.html` | 已验收（2026-11-25） |
| T-025 | 助手与规则原型（移动 + PC 响应式） | M1/5A | 已完成 | P0 | T-012 | [STEP-5A](tasks/M1/STEP-5A.md#t-025) | `docs/prototype/M1/index.html` | 已验收（2026-11-25） |
| T-014 | 交互细化/契约冻结 | M1/5B | 已完成 | P0 | T-013/T-025 | [STEP-5B](tasks/M1/STEP-5B.md#t-014) | [interaction-spec.md](../tech/interaction-spec.md) v1.1；原型 v2 | 已验收（2026-11-26） |
| T-015 | 工程脚手架/CI/共享包 | M1/5C | 已完成 | P0 | T-014 | [STEP-5C](tasks/M1/STEP-5C.md#t-015) | 根工程/共享包；[验证证据](../test/evidence/M1/T-015/verification.md) | 无 |
| T-026 | 板子/角色配置 | M1/5C | 已完成 | P0 | T-015 | [STEP-5C](tasks/M1/STEP-5C.md#t-026) | `game-engine` 配置；[验证证据](../test/evidence/M1/T-026/verification.md) | 无 |
| T-027 | 状态机与动作 | M1/5C | 已完成 | P0 | T-026 | [STEP-5C](tasks/M1/STEP-5C.md#t-027) | 状态机/动作；[验证证据](../test/evidence/M1/T-027/verification.md) | 无 |
| T-028 | 冲突/技能/胜负 | M1/5C | 已完成 | P0 | T-027 | [STEP-5C](tasks/M1/STEP-5C.md#t-028) | 规则/胜负函数；[验证证据](../test/evidence/M1/T-028/verification.md) | 无 |
| T-029 | 开局与三种发牌模式 | M1/5C | 已完成 | P0 | T-015/T-027 | [STEP-5C](tasks/M1/STEP-5C.md#t-029) | 开局/发牌页面（含模式 C）；[验证证据](../test/evidence/M1/T-029/verification.md) | 无 |
| T-030 | 夜间/竞选/死讯/发言 | M1/5C | 已完成 | P0 | T-029/T-028 | [STEP-5C](tasks/M1/STEP-5C.md#t-030) | 夜间/白天页面与组件测试；[验证证据](../test/evidence/M1/T-030/verification.md) | 无 |
| T-031 | 投票/结算/本地/WakeLock | M1/5C | 已完成 | P0 | T-030/T-028 | [STEP-5C](tasks/M1/STEP-5C.md#t-031) | 投票/结算/快照回退；[验证证据](../test/evidence/M1/T-031/verification.md) | 无 |
| T-032 | 规则内容编写与评审 | M1/5C | 已完成 | P0 | T-015 | [STEP-5C](tasks/M1/STEP-5C.md#t-032) | rules-content 内容与 7 单测；[验证证据](../test/evidence/M1/T-032/verification.md) | 无 |
| T-018 | 个人助手 UI | M1/5C | 已完成 | P0 | T-015/T-032 | [STEP-5C](tasks/M1/STEP-5C.md#t-018) | 助手页面/上下文与 6 个测试；[验证证据](../test/evidence/M1/T-018/verification.md) | 无 |
| T-021 | 移动端性能与兼容终检 | M1/5C | 已完成 | P0 | T-031/T-018 | [STEP-5C](tasks/M1/STEP-5C.md#t-021) | [实验室报告与验收结论](../test/evidence/M1/T-021/verification.md) | 有条件完成：真机复测延后至发布前（T-023/T-024），风险接受 2026-11-26 |
| T-034 | 规则页 UI（P0-1） | M1/5C | 已完成 | P0 | T-032/T-015 | [STEP-5C](tasks/M1/STEP-5C.md#t-034) | 规则页与 4 个测试；[验证证据](../test/evidence/M1/T-034/verification.md) | 无 |
| T-019 | API 服务与 AI 中转 | M1/5D | 待开发 | P0 | T-015 | [STEP-5D](tasks/M1/STEP-5D.md#t-019) | `apps/api` | 待 5D 启动 |
| T-020 | AI 前端接入与整合 | M1/6 | 待开发 | P0 | T-018/T-019 | [STEP-6](tasks/M1/STEP-6.md#t-020) | AI 联调记录 | 待 6 启动 |
| T-022 | 系统联调与 P0 验收 | M1/7 | 待开发 | P0 | T-020/T-021/T-031 | [STEP-7](tasks/M1/STEP-7.md#t-022) | 联调/验收报告 | 待 7 启动 |
| T-023 | 测试用例与全量回归 | M1/8 | 待开发 | P0 | T-022 | [STEP-8](tasks/M1/STEP-8.md#t-023) | `docs/test/` | 含 T-021 真机复测，发布前完成 |
| T-024 | 部署与上线准备 | M1/9 | 待开发 | P0 | T-023 | [STEP-9](tasks/M1/STEP-9.md#t-024) | `docs/deploy/` | 待 9 启动 |

> M1 实现任务共 19 项（T-013、T-025、T-014、T-015、T-026～T-032、T-018、T-021、T-034、T-019、T-020、T-022～T-024），当前完成 14 项（T-013/T-025/T-014/T-015/T-026/T-027/T-028/T-029/T-030/T-031/T-032/T-018/T-021/T-034）；前置阶段任务 T-001～T-012 已完成（T-010 属 M2）。

## 步骤 4 产出

- [项目开发计划](project-dev-plan.md)：M1/M2/M3 里程碑与功能点。
- [STEP-4 任务拆解](tasks/M1/STEP-4.md)：任务分解、依赖链与阶段文档索引。
- [STEP-5A](tasks/M1/STEP-5A.md)～[STEP-9](tasks/M1/STEP-9.md)：阶段任务入口。
- 任务池：19 个 M1 实现任务（5A 2、5B 1、5C 11、5D 1、6 1、7 1、8 1、9 1）。
- 本文件：任务池、阶段概览、确认记录与风险。

## 已确认决策

1. 规则口径以 PRD 附录 A 为准；预女猎白 = 3 狼 + 1 白狼王，预女猎守 = 4 普通狼。
2. v1.3.2 只交付 P0；配对码联机/PWA 为下一迭代，不进入本轮验收。
3. 平台 Web 应用（移动端优先 H5），非微信小程序；前后端分离 monorepo。
4. 前端 React 19 + Vite + TypeScript + Tailwind/Radix + Zustand/idb-keyval。
5. 后端 Node 24 + Fastify 5 + TypeScript + Zod；P1 Socket.IO + SQLite/Drizzle。
6. 共享包：`game-engine`（规则/状态机/视图）、`shared`（契约）、`rules-content`（内容）。
7. 无账号体系；匿名会话 Cookie + 房间令牌；P1 主持人令牌哈希。
8. P1 快照带 `version`，服务端拒绝旧版本；WebSocket + 5s 轮询降级。
9. AI BYOK + 后端中转；Key 不落库/不写日志；SSRF/超时/限频。
10. 部署 Node 单进程（Fastify static/API/WS）；不使用 Nginx/Docker；TLS 由 Node HTTPS 或云负载均衡终止；SQLite 持久卷（P1）；境内 ICP 备案。
11. 移动端基线：主流 1080p + 5G/Wi-Fi；CSS 360–440；320 兼容；60fps。
12. 自爆/DAWN/SETTLE 后检查胜负；模式 B 默认遮罩；Wake Lock 可见时重请求。
13. P1 联机：主持端发送完整 `gameState`；服务端用 game-engine 校验并生成玩家视图；原始状态仅服务端存储，不下发玩家（AC-13）。
14. Node 单进程加固：请求体/超时/WS 上限、AI 每会话 1 个在途 + 全局并发、`TRUST_PROXY`、TLS DNS-01/webroot。
15. 发牌模式 C：实体牌线下发放，主持人按 1→12 手动选择身份；系统校验角色构成并主持，选满且一致才可入夜（CHG-20261125-02）。

## 风险与阻塞

| 日期 | 风险/阻塞项 | 影响 | 应对措施 | 状态 |
| --- | --- | --- | --- | --- |
| 2026-11-25 | Node 24/Fastify 5/`better-sqlite3` 兼容性 | T-015/T-019 | 首日安装验证；必要时调整驱动/版本 | 部分缓解（T-015 已验证 Node 24 + Fastify 5；`better-sqlite3` 待 T-019） |
| 2026-11-25 | TLS 证书/443 权限/`TRUST_PROXY` | T-024 | DNS-01/webroot 或云 LB；预发布验证 | 待处理 |
| 2026-11-25 | 移动端真机矩阵不足 | T-021/T-022 | 按 AC-16 设备清单借测；缺设备记阻塞 | 风险接受（2026-11-26，用户批准）：实验室证据验收；真机复测在 T-023 完成、T-024 前把关 |
| 2026-11-25 | P1 联机未实现 | M1 | 不进入 M1 验收；M2 单独拆解 | 已确认 |
| 2026-11-26 | P0-1 规则页 UI 未纳入 5C 任务池（T-032 仅内容） | T-021/阶段验收 | 新增 T-034 规则页 UI 并补齐 | 已解决（2026-11-26） |

## 进度快照

### 2026-11-26 进度快照

**当前进度**：阶段 5B 已验收（2026-11-26）；阶段 5C 已完成（全部 11 项任务，含 T-034 规则页 UI），待阶段验收；T-021 真机复测延后至发布前（风险接受）；M1 实现任务 14/19 完成（T-013/T-025/T-014/T-015/T-026/T-027/T-028/T-029/T-030/T-031/T-032/T-018/T-021/T-034）。

**已完成**：
- PRD v1.3.1 验收、技术方案 v1.2 验收、步骤 4 任务拆解验收。
- PRD v1.3.2 增补：发牌模式 C（实体牌线下发放、主持人手动选择身份、构成校验）；CHG-20261125-02；tech-arch v1.3 承接。
- 5A 原型：`docs/prototype/M1/index.html`（主持闭环 + 助手 + 规则；发牌 A/B/C；移动 360/390/430/320 + PC 1440 双栏；月蚀俱乐部视觉重设计：Hero、今晚牌桌、移动端底部 Tab、游戏化入口、席位圆章、塔罗身份卡、AI 军师面板；流程贴合：一阶流程条 + 白天子步骤、发牌环形焦点、夜间角色头像队列、发言打卡；8 个角色统一内联 SVG 头像并用于图鉴/揭示/结算）。
- 5B 契约：[interaction-spec.md](../tech/interaction-spec.md) v1.1（视图/组件/状态矩阵/交互守卫/投票模型/状态机/AI 配置与上下文/存储/文案/API 对齐）；原型 v2 补 AI 配置与上下文、AI 四态、投票 1.5、遗言、夜间私密结果、技能目标与 Wake Lock 降级。
- T-015 工程脚手架：npm workspaces（`@lrs/web`/`api`/`game-engine`/`shared`/`rules-content`）；TS strict、ESLint 10、Prettier、Vitest 5、Playwright 1.65、GitHub Actions；lint/format/typecheck/test/build 全通过，e2e 冒烟通过，API `/api/v1/health` 实测返回正常；[验证证据](../test/evidence/M1/T-015/verification.md)。
- T-026 板子/角色配置：8 角色元数据、两套板子（预女猎守/预女猎白）、夜序与 `validateBoard` 校验；16 个新单测覆盖 AC-4 配置部分；[验证证据](../test/evidence/M1/T-026/verification.md)。
- T-027 状态机与动作：11 个阶段与对应动作、竞选子流程、逐票 `Ballot` 与 PK、自爆中断、`CHECK_WIN.resumeTo`、深拷贝快照；21 个新单测；[验证证据](../test/evidence/M1/T-027/verification.md)。
- T-028 冲突、技能与胜负：夜间结算（守护/狼刀/解药/毒药/同守同救）、连守与药剂拦截、屠边判定；猎人/白痴/白狼王、警徽移交/撕毁、放逐结算与自动胜负检查；19 个新单测；[验证证据](../test/evidence/M1/T-028/verification.md)。
- T-029 开局设置与三种发牌模式：首页大厅、板子/编号/模式/设置、A 接力查看、B 二次揭示、C 逐号录入/余量/撤销/防窥核对、发牌落库与刷新恢复、首次引导与能力提示；8 个组件测试、e2e 4/4；首屏 JS 107.23 kB gzip；[验证证据](../test/evidence/M1/T-029/verification.md)。
- T-030 夜间、竞选、死讯与发言：夜间步骤卡与私密结果、狼队互认、女巫用药；竞选报名/发言/退水/警下投票/PK/无警长；死讯/遗言/猎人开枪/警徽流转；发言顺序与打卡、自爆；`CHECK_WIN` 自动结算与 view 映射；10 个新组件测试、e2e 6/6；[验证证据](../test/evidence/M1/T-030/verification.md)。
- T-031 投票、结算与本地能力：逐票/快速归票/弃票、警长 1.5、平票 PK、白痴翻牌无票、猎人被放逐开枪、警徽流转；结算揭晓身份、逐夜私密记录与关键事件；再来一局/返回首页/清除本局；30 条快照与“回退一步”二次确认并落库；投票页纳入 Wake Lock；9 个新组件测试、e2e 11/11；[验证证据](../test/evidence/M1/T-031/verification.md)。

**进行中**：
- 5C 待阶段验收；T-021 真机复测延后至发布前（T-023/T-024）。

**下一步**：
- 提交 5C 阶段验收；真机复测在 T-023/T-024 发布前完成。

**风险与阻塞**：
- Node/Fastify/`better-sqlite3` 兼容性、TLS/443、真机矩阵。

**关键决策/变更**：
- Node-only；P1 服务端完整 gameState + 生成视图。
- 模式 C：线下实体牌 + 主持人手动选择身份，系统校验构成后接管流程、判定与结算（CHG-20261125-02）。

**验证与验收状态**：
- 文档链接/表格校验；5A 功能版已用 Chrome 走查：模式 C 12 人选择→撤销→重选→防窥核对→入夜；模式 A/B 回归；390/320/1440 无横向滚动、角色按钮 ≥44px、角色余量 0 禁用；视觉重设计与游戏大厅化（今晚牌桌 + 底部 Tab）按原型技能约束完成静态走查（重复 ID / 脚本引用 / 语法 / CSS 括号），流程条/子步骤经浏览器模拟验证。
- 5B：PRD 7.4 六列均有页面覆盖；评审修订 v1.1 补齐 CHECK_WIN/SELF_EXPLODE、逐票投票模型、遗言、竞选子流程、AI 配置/上下文、技能目标与恢复映射；AI 四态、1.5 票、遗言、目标选择、夜间私密结果已在原型 v2 走查通过；320/390 无横向溢出；已验收（2026-11-26）。
- T-015：`npm install`、`npm run lint`、`npm run format:check`、`npm run typecheck`、`npm test`（3 用例）、`npm run build`、`npx playwright test`（1 用例）全部通过；API health 实测通过；详细证据见 [verification.md](../test/evidence/M1/T-015/verification.md)。
- T-026：`npm run typecheck -w @lrs/game-engine`、`npx vitest run packages/game-engine/src`（17 用例）、`npm run lint`、`npm run format:check`、`npm test`（19 用例）、`npm run build` 全部通过；详细证据见 [verification.md](../test/evidence/M1/T-026/verification.md)。
- T-027：`npm run typecheck -w @lrs/game-engine`、`npx vitest run packages/game-engine/src`（38 用例）、`npm run lint`、`npm run format:check`、`npm test`（40 用例）、`npm run build` 全部通过；详细证据见 [verification.md](../test/evidence/M1/T-027/verification.md)。
- T-028：`npm run typecheck -w @lrs/game-engine`、`npx vitest run packages/game-engine/src`（57 用例）、`npm run lint`、`npm run format:check`、`npm test`（59 用例）、`npm run build` 全部通过；详细证据见 [verification.md](../test/evidence/M1/T-028/verification.md)。
- 2026-11-26 已完成任务功能测试：API health、Web e2e、`verify:dist`、引擎 3 夜完整对局与两板子技能链均通过；发现并修复构建产物 ESM 导入缺陷，详见[功能测试报告](../test/evidence/M1/functional-test-20261126.md)。
- T-029：`npm run lint`、`format:check`、`typecheck`、`npm test`（66 用例）、`npm run build`、`verify:dist` 全部通过；Playwright e2e 4/4（模式 C 全流程、刷新恢复、320/430 无横向滚动、首页加载）；320/390/430 截图与详细证据见 [verification.md](../test/evidence/M1/T-029/verification.md)。
- T-030：`npm run lint`、`format:check`、`typecheck`、`npm test`（76 用例）、`npm run build`、`verify:dist` 全部通过；Playwright e2e 6/6（新增首夜→竞选→死讯→发言→投票占位、夜间/竞选/死讯/发言 320/430 无横向滚动）；首屏 JS 107.90 kB gzip；390/430/320 截图与详细证据见 [verification.md](../test/evidence/M1/T-030/verification.md)。
- T-031：`npm run lint`、`format:check`、`typecheck`、`npm test`（85 用例）、`npm run build`、`verify:dist` 全部通过；Playwright e2e 11/11（投票→放逐→下一夜、刷新恢复、断网继续、投票/结算 320/430 无横向滚动、只读结算与再来一局）；首屏 JS 108.28 kB gzip；390/320/430 截图与详细证据见 [verification.md](../test/evidence/M1/T-031/verification.md)。
- 2026-11-26 已完成任务功能测试（第二轮，基线 `51f9cd7`）：lint/format/typecheck/build/verify:dist、85 单测、e2e 11/11、API health、生产预览 390/320 冒烟均通过；首屏 JS 108.28 kB gzip；详见[第二轮功能测试报告](../test/evidence/M1/functional-test-20261126-02.md)。
- T-032：`npm run typecheck -w @lrs/rules-content`、`npx vitest run packages/rules-content/src`（7 用例）、`npm run lint`、`format:check`、`npm test`（92 用例）、`npm run build`、`verify:dist` 全部通过；内容与 game-engine 的板子构成/夜序/技能/限制逐项一致，构建产物实测 2 板子/8 角色/3 流程/页脚正确；详见 [verification.md](../test/evidence/M1/T-032/verification.md)。
- T-018：`npm run lint`、`format:check`、`typecheck`、`npm test`（96 用例）、`npm run build`、`verify:dist` 全部通过；e2e 13/13（新增助手身份/标签/记录/上下文预览、320/430 无横向滚动）；生产预览懒加载正常，首屏 JS 108.50 kB gzip；详见 [verification.md](../test/evidence/M1/T-018/verification.md)。
- T-021（实验室部分）：320/360/390/393/412/430/440/1440 首页/设置/助手与 360/390/412 全流程无横向滚动、无 console error；触控、对比度、ARIA 问题修复后复测为 0；Lighthouse 4G/5G 均为 100/100/100，首屏 JS 108.51 kB gzip、首屏请求 3；用户接受实验室证据，真机复测延后至发布前（风险接受 2026-11-26），T-021 有条件完成；详见 [verification.md](../test/evidence/M1/T-021/verification.md)。
- T-034：规则页 UI 完成（板子列表/8 角色图鉴与详情/三流程/页脚，首页与底部 Tab 入口）；全量 100 用例、e2e 14/14、lint/format/typecheck/build/verify:dist 通过；8 视口审计无横向滚动、触控与对比度问题为 0；首屏 JS 108.57 kB gzip；详见 [verification.md](../test/evidence/M1/T-034/verification.md)。
- 2026-11-26 5C 阶段功能检查：11 项任务全部核对通过；100 单测、覆盖率 84.31%（行 85.97%）、e2e 14/14、API health、生产构建页间冒烟通过；补充自定义标签、按轮发言、自由描述 3 个助手用例；未发现阻断缺陷；详见[5C 功能检查报告](../test/evidence/M1/stage-5c-functional-check-20261126.md)。
