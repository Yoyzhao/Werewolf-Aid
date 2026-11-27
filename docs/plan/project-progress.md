# 项目进度

- 项目：狼人杀助手 Web 应用
- **开发版本**：Web 应用（移动端优先 H5），**不是微信小程序版本**；唯一基线 PRD v1.3.2（v1.3.1 + CHG-20261125-02）。
- **当前主阶段**：M2 P1 实现（T-033/T-035～T-045 已验收；T-046 已完成，待验收）
- 拓扑：前后端分离 monorepo；React + Vite 前端；Fastify 后端；P1 Socket.IO + SQLite
- **当前里程碑**：M2 v1.4（P1 联机与 PWA；M1 已验收 2026-11-26）
- 最近更新：2026-11-27

## 当前入口

| 交付线 / 版本 | 能试什么、从哪里进入 | 预期结果 | 已知限制 / 待决定事项 | 下一验收节点 | 依据 / 更新时间 |
| --- | --- | --- | --- | --- | --- |
| M1 v1.3.1 P0 | 5A 原型：[docs/prototype/M1/index.html](../prototype/M1/index.html)；`python -m http.server` 或直接双击打开 | 月蚀俱乐部视觉；走完主持闭环（设置→发牌 A/B/C→夜间→竞选→死讯→发言→投票→结算）+ 助手 + 规则；顶部流程条与白天子步骤；角色头像统一；PC ≥1024 双栏 | 原型不落存储、规则为简化模拟；模式 C 为手动选择身份（CHG-20261125-02）；5B 契约见 [interaction-spec](../tech/interaction-spec.md)；T-021 真机复测延后至发布前（风险接受 2026-11-26）；规则页已补齐（T-034） | 已验收（2026-11-26；M1 完成） | PRD v1.3.2 / api-contract v1.1 / 2026-11-26 |

## 项目概览

| 项目名称 | 狼人杀助手 Web 应用 |
| --- | --- |
| 项目拓扑 | 前后端分离（monorepo） |
| 开始日期 | 2026-11-25 |
| 预计结束 | 待排期 |
| 交付基线 | 无（首轮开发） |
| 最后更新 | 2026-11-27 |

## 里程碑概览

- [x] **M1** v1.3.1 P0 单机主持闭环 — 已完成（2026-11-26 验收通过）
- [ ] **M2** v1.4 P1 联机与 PWA — 进行中（T-033/T-035～T-045 已验收；T-046 完成待验收）
- [ ] **M3** P2 扩展能力 — 后续

## 阶段推进概览

| 阶段/切片 | 名称 | 状态 | 验收状态 | 当前修订或依据 |
| --- | --- | --- | --- | --- |
| 1-2 | PRD | 已完成 | 已通过（v1.3.2 增补待走查） | PRD v1.3.1（2026-11-24）+ v1.3.2（CHG-20261125-02） |
| 3 | 技术架构 | 已完成 | 已通过 | tech-arch v1.3 / api-contract v1.1（2026-11-25） |
| 4 | 任务拆解 | 已完成 | 已通过 | [STEP-4](tasks/M1/STEP-4.md)（2026-11-25） |
| 5A | 移动端/PC 响应式原型 | 已完成 | 已通过（2026-11-25） | [STEP-5A](tasks/M1/STEP-5A.md)；CHG-20261125-01/02 |
| 5B | 交互细化/契约 | 已完成 | 已通过（2026-11-26） | [STEP-5B](tasks/M1/STEP-5B.md)；[interaction-spec](../tech/interaction-spec.md) v1.1 |
| 5C | 前端实现 | 已完成 | 已通过（2026-11-26） | [STEP-5C](tasks/M1/STEP-5C.md)；11 项任务全部完成（含 T-034 规则页 UI） |
| 5D | 后端实现 | 已完成 | 已通过（2026-11-26） | [STEP-5D](tasks/M1/STEP-5D.md)；T-019 API 与 AI 中转完成 |
| 6 | 整合 | 已完成 | 已通过（2026-11-26，用户指示进入 T-022） | [STEP-6](tasks/M1/STEP-6.md)；T-020 AI 前端接入完成 |
| 7 | 联调 | 已完成 | 已通过（2026-11-26，用户 P0 验收通过） | [STEP-7](tasks/M1/STEP-7.md)；T-022 自动化联调完成 |
| 8 | 测试 | 已完成 | 已通过（2026-11-26，用户阶段 8 验收通过） | [STEP-8](tasks/M1/STEP-8.md)；[T-023 测试报告](../test/evidence/M1/T-023/verification.md) |
| 9 | 部署 | 已完成 | 已通过（2026-11-26，用户 T-024 验收通过） | [STEP-9](tasks/M1/STEP-9.md)；[T-024 部署报告](../test/evidence/M1/T-024/verification.md) |

## M2 阶段推进概览

| 阶段/切片 | 名称 | 任务 | 状态 | 验收状态 | 依据 |
| --- | --- | --- | --- | --- | --- |
| M2-规划 | P1 规划与任务拆解 | T-010 | 已完成 | 已通过（2026-11-26） | [M2 STEP-4](tasks/M2/STEP-4.md)；[dev-plan](project-dev-plan.md) |
| M2-5A | P1 交互与页面设计 | T-035 | 已完成 | 已通过（2026-11-26） | [M2 STEP-5A](tasks/M2/STEP-5A.md)；[T-035 报告](../test/evidence/M2/T-035/verification.md) |
| M2-5D | P1 数据层/房间 API/视图/WS | T-033/T-036/T-037 | 已完成 | 已通过（2026-11-26） | [M2 STEP-5D](tasks/M2/STEP-5D.md)；[T-033 报告](../test/evidence/M2/T-033/verification.md)、[T-036 报告](../test/evidence/M2/T-036/verification.md)、[T-037 报告](../test/evidence/M2/T-037/verification.md) |
| M2-5C | P1 主持端/玩家端/时间线/术语/笔记/过滤/PWA | T-038～T-043 | 已完成 | 已通过（2026-11-27，T-042/T-043 验收） | [M2 STEP-5C](tasks/M2/STEP-5C.md)；[T-038 报告](../test/evidence/M2/T-038/verification.md)、[T-039 报告](../test/evidence/M2/T-039/verification.md)、[T-040 报告](../test/evidence/M2/T-040/verification.md)、[T-041 报告](../test/evidence/M2/T-041/verification.md)、[T-042 报告](../test/evidence/M2/T-042/verification.md)、[T-043 报告](../test/evidence/M2/T-043/verification.md) |
| M2-6 | P1 整合 | T-044 | 已完成 | 已通过（2026-11-27） | [M2 STEP-6](tasks/M2/STEP-6.md)；[T-044 报告](../test/evidence/M2/T-044/verification.md) |
| M2-7 | P1 系统联调与验收 | T-045 | 已完成 | 已通过（2026-11-27） | [M2 STEP-7](tasks/M2/STEP-7.md)；[T-045 报告](../test/evidence/M2/T-045/verification.md) |
| M2-8 | P1 测试与全量回归 | T-046 | 已完成 | 待用户验收（2026-11-27） | [M2 STEP-8](tasks/M2/STEP-8.md)；[T-046 报告](../test/evidence/M2/T-046/verification.md) |
| M2-9 | P1 部署扩展 | T-047 | 待启动 | 未提交 | [M2 STEP-9](tasks/M2/STEP-9.md) |

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
| 2026-11-26 | 5C 阶段验收 | 基线 | 确认 | 用户“5C 阶段验收通过，启动 T-019” |
| 2026-11-26 | 5D 阶段验收 | 基线 | 确认 | 用户“5D 阶段验收通过，启动 T-020”；T-019 功能测试 57/57 通过 |
| 2026-11-26 | 阶段 6 验收 / 启动 T-022 | 基线 | 确认 | 用户“测试T-022”；阶段 6 T-020 完成后直接进入系统联调 |
| 2026-11-26 | P0 验收通过 / 启动 T-023 | 基线 | 确认 | 用户“P0 验收通过，启动 T-023”；阶段 7 通过，进入阶段 8 测试 |
| 2026-11-26 | 阶段 8 验收通过 / 启动 T-024 | 基线 | 确认 | 用户“阶段 8 验收通过，启动 T-024”；进入阶段 9 部署准备 |
| 2026-11-26 | T-024 / M1 验收通过 / 启动 T-010 | 基线 | 确认 | 用户“验收 T-024，继续下一个任务”；M1 完成，进入 M2 P1 规划 |
| 2026-11-26 | T-010 验收 / 启动 T-033、T-035 | 基线 | 确认 | 用户“验收 T-010，启动 T-033 和 T-035”；设计5A与服务端视图并行 |
| 2026-11-26 | T-033/T-035 验收 / 启动 T-036、T-037 | 基线 | 确认 | 用户“验收通过，启动 T-036 和 T-037”；P1 设计冻结，进入数据层与实时推送 |
| 2026-11-26 | T-036/T-037 验收 / 启动 T-038、T-039 | 基线 | 确认 | 用户“验收通过，启动 T-038 和 T-039”；进入 P1 主持端与玩家端 UI |
| 2026-11-26 | T-038/T-039 验收 / 启动 T-040、T-041 | 基线 | 确认 | 用户“验收通过，启动 T-040 和 T-041”；进入 P1 复盘时间线、术语搜索与私人笔记 |
| 2026-11-27 | T-040/T-041 验收 / 启动 T-042、T-043 | 基线 | 确认 | 用户“验收通过，启动 T-042 和 T-043”；进入 AI 输入过滤与 PWA 离线壳 |
| 2026-11-27 | T-042/T-043 验收 / 启动 T-044 | 基线 | 确认 | 用户“验收通过，启动 T-044”；进入 P1 整合 |
| 2026-11-27 | T-044 验收 / 启动 T-045 | 基线 | 确认 | 用户“验收通过，启动 T-045”；进入 P1 系统联调与 AC 验收 |
| 2026-11-27 | T-045 验收 / 启动 T-046 | 基线 | 确认 | 用户“验收通过，启动 T-046”；进入 P1 测试与全量回归 |

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
| T-010 | P1 下一迭代规划 | M2/规划 | 已完成 | P1 | T-019/T-031 | [M2 STEP-4](tasks/M2/STEP-4.md) | [M2 任务拆解](tasks/M2/STEP-4.md)；本文件 M2 任务池 | 待用户验收 |
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
| T-019 | API 服务与 AI 中转 | M1/5D | 已完成 | P0 | T-015 | [STEP-5D](tasks/M1/STEP-5D.md#t-019) | [apps/api 源码与测试；验证证据](../test/evidence/M1/T-019/verification.md) | 无（5D 已验收 2026-11-26） |
| T-020 | AI 前端接入与整合 | M1/6 | 已完成 | P0 | T-018/T-019 | [STEP-6](tasks/M1/STEP-6.md#t-020) | [AI 模块与联调证据](../test/evidence/M1/T-020/verification.md) | 无（阶段 6 已通过 2026-11-26） |
| T-022 | 系统联调与 P0 验收 | M1/7 | 已完成 | P0 | T-020/T-021/T-031 | [STEP-7](tasks/M1/STEP-7.md#t-022) | [联调报告与 AC 矩阵](../test/evidence/M1/T-022/verification.md) | 待用户 P0 验收；真人 12 人/真机在 T-023/T-024 |
| T-023 | 测试用例与全量回归 | M1/8 | 已完成 | P0 | T-022 | [STEP-8](tasks/M1/STEP-8.md#t-023) | [测试计划](../test/test-cases.md)；[T-023 报告](../test/evidence/M1/T-023/verification.md) | 待阶段 8 验收；真机/真实 AI 阻塞项在 T-024 前把关 |
| T-024 | 部署与上线准备 | M1/9 | 已完成 | P0 | T-023 | [STEP-9](tasks/M1/STEP-9.md#t-024) | [部署文档](../deploy/项目部署文档.md)；[T-024 报告](../test/evidence/M1/T-024/verification.md) | 已验收（2026-11-26） |
| T-033 | 服务端状态校验与视图生成（`buildViews`） | M2/5D | 已完成 | P1 | T-010 | [M2 STEP-5D](tasks/M2/STEP-5D.md#t-033) | [T-033 报告](../test/evidence/M2/T-033/verification.md) | 已验收（2026-11-26） |
| T-035 | P1 交互与页面设计（联机/时间线/术语/笔记/PWA） | M2/5A | 已完成 | P1 | T-010 | [M2 STEP-5A](tasks/M2/STEP-5A.md#t-035) | [interaction-spec v1.2](../tech/interaction-spec.md)；[M2 原型](../prototype/M2/index.html)；[T-035 报告](../test/evidence/M2/T-035/verification.md) | 已验收（2026-11-26） |
| T-036 | P1 数据层与房间 API（SQLite/Drizzle/绑定/快照/TTL） | M2/5D | 已完成 | P1 | T-033/T-035 | [M2 STEP-5D](tasks/M2/STEP-5D.md#t-036) | [T-036 报告](../test/evidence/M2/T-036/verification.md)；16 个房间 API 测试 | 已验收（2026-11-26） |
| T-037 | Socket.IO 推送与轮询降级 | M2/5D | 已完成 | P1 | T-036 | [M2 STEP-5D](tasks/M2/STEP-5D.md#t-037) | [T-037 报告](../test/evidence/M2/T-037/verification.md)；6 个 WS 集成测试 | 已验收（2026-11-26） |
| T-038 | 联机主持端 UI（配对码/确认/解绑/恢复/快照写入） | M2/5C | 已完成 | P1 | T-035/T-036 | [M2 STEP-5C](tasks/M2/STEP-5C.md#t-038) | [T-038 报告](../test/evidence/M2/T-038/verification.md)；主持组件 3 例 + 状态 4 例 | 已验收（2026-11-26） |
| T-039 | 联机玩家端 UI（加入/身份/公开进度/重连） | M2/5C | 已完成 | P1 | T-035/T-037 | [M2 STEP-5C](tasks/M2/STEP-5C.md#t-039) | [T-039 报告](../test/evidence/M2/T-039/verification.md)；玩家组件 3 例 + 状态 5 例 + e2e 2 例 | 已验收（2026-11-26） |
| T-040 | 复盘时间线 | M2/5C | 已完成 | P1 | T-035/T-031 | [M2 STEP-5C](tasks/M2/STEP-5C.md#t-040) | [T-040 报告](../test/evidence/M2/T-040/verification.md)；timeline 3 例 + views 13 例 + e2e 3 例 | 已验收（2026-11-27） |
| T-041 | 术语表/搜索与私人笔记 | M2/5C | 已完成 | P1 | T-035/T-032/T-018 | [M2 STEP-5C](tasks/M2/STEP-5C.md#t-041) | [T-041 报告](../test/evidence/M2/T-041/verification.md)；rules-content 8 例 + 搜索 7 例 + 规则页 6 例 + 笔记 3 例 + e2e 2 例 | 已验收（2026-11-27） |
| T-042 | AI 输入基础过滤与内容提示 | M2/5C | 已完成 | P1 | T-035/T-020 | [M2 STEP-5C](tasks/M2/STEP-5C.md#t-042) | [T-042 报告](../test/evidence/M2/T-042/verification.md)；input-filter 9 例 + App.ai-filter 3 例 + e2e 1 例 | 已验收（2026-11-27） |
| T-043 | PWA 离线壳 | M2/5C | 已完成 | P1 | T-035/T-015 | [M2 STEP-5C](tasks/M2/STEP-5C.md#t-043) | [T-043 报告](../test/evidence/M2/T-043/verification.md)；pwa 6 例 + 横幅 4 例 + e2e 3 例 | 已验收（2026-11-27） |
| T-044 | P1 整合（主持端/玩家端/后端/视图/WS/降级） | M2/6 | 已完成 | P1 | T-038/T-039/T-037 | [M2 STEP-6](tasks/M2/STEP-6.md#t-044) | [T-044 报告](../test/evidence/M2/T-044/verification.md)；双浏览器整合 e2e 1 例 + 单测 2 例 | 已验收（2026-11-27） |
| T-045 | P1 系统联调与 AC-12～15/19 验收 | M2/7 | 已完成 | P1 | T-044/T-040/T-041/T-042/T-043 | [M2 STEP-7](tasks/M2/STEP-7.md#t-045) | [T-045 报告](../test/evidence/M2/T-045/verification.md)；5 条 AC 验收 e2e + 原始 JSON/截图 | 已验收（2026-11-27） |
| T-046 | P1 测试与全量回归 | M2/8 | 已完成 | P1 | T-045 | [M2 STEP-8](tasks/M2/STEP-8.md#t-046) | [T-046 报告](../test/evidence/M2/T-046/verification.md)；安全黑盒 + 10 房间压测 + 340 单测/41 e2e | 待用户验收；下一步 T-047 |
| T-047 | P1 部署扩展（SQLite 持久化/备份/WS 压测） | M2/9 | 待开始 | P1 | T-046 | [M2 STEP-9](tasks/M2/STEP-9.md#t-047) | 未产生 | 待 M2 启动 |

> M1 实现任务共 19 项（T-013、T-025、T-014、T-015、T-026～T-032、T-018、T-021、T-034、T-019、T-020、T-022～T-024），当前完成 19 项（T-013/T-025/T-014/T-015/T-026/T-027/T-028/T-029/T-030/T-031/T-032/T-018/T-021/T-034/T-019/T-020/T-022/T-023/T-024）；前置阶段任务 T-001～T-012 已完成（T-010 属 M2）。
>
> M2 任务共 15 项：T-010 规划 + 14 项实现（T-033、T-035～T-047）；当前 T-010/T-033/T-035～T-045 已验收，T-046 完成待验收，T-047 待启动。T-034 已被 M1 规则页占用，M2 不使用该编号。

## 步骤 4 产出

- [项目开发计划](project-dev-plan.md)：M1/M2/M3 里程碑与功能点。
- [M1 STEP-4 任务拆解](tasks/M1/STEP-4.md)：M1 任务分解、依赖链与阶段文档索引。
- [M2 STEP-4 任务拆解](tasks/M2/STEP-4.md)：P1 任务分解、依赖链与阶段文档索引。
- [M2 STEP-5A](tasks/M2/STEP-5A.md)～[STEP-9](tasks/M2/STEP-9.md)：P1 阶段任务入口。
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
| 2026-11-25 | Node 24/Fastify 5/`better-sqlite3` 兼容性 | T-015/T-019 | 首日安装验证；必要时调整驱动/版本 | 已缓解（T-036 在 Node 24.22.3 验证 better-sqlite3 13.2.0 加载/建表/读写与 WAL） |
| 2026-11-25 | TLS 证书/443 权限/`TRUST_PROXY` | T-024 | DNS-01/webroot 或云 LB；预发布验证 | 部分缓解（T-024 本地 HTTPS/301/启动保护/回滚演练通过；真实证书与 443 待服务器） |
| 2026-11-26 | 域名、ICP 备案与线上服务器未提供 | T-024 | 上线前置条件；部署文档已给出检查单 | 阻塞（待用户提供并办理） |
| 2026-11-25 | 移动端真机矩阵不足 | T-021/T-022 | 按 AC-16 设备清单借测；缺设备记阻塞 | 风险接受（2026-11-26，用户批准）：实验室证据验收；T-023/T-024 仍无设备，记录为阻塞；上线前借测或再次风险接受 |
| 2026-11-25 | P1 联机未实现 | M1 | 不进入 M1 验收；M2 单独拆解 | 已确认 |
| 2026-11-26 | 匿名会话 Cookie 未签名，P1 房间身份存在 Cookie 固定风险 | M2 | P1 上线前增加 Cookie 签名或会话轮换，M2 安全设计核查 | 已解决（T-036：`lrs_anon=<id>.<hmac>`，未签名/篡改 Cookie 视为无会话） |
| 2026-11-26 | 幂等键仅存于单实例内存，进程重启后失效 | T-036 | 单实例部署；重复创建只产生新房间，不破坏既有数据；如需跨重启幂等再评估持久化 | 接受（P1 单实例） |
| 2026-11-26 | SQLite 文件备份/磁盘权限尚未纳入部署流程 | T-047 | T-047 补充备份、WAL 检查点、目录权限与恢复演练 | 待处理（T-047） |
| 2026-11-26 | P1 客户端引入 socket.io-client/qrcode，首屏包体上升 | T-039/T-043 | 当前 206.36 kB gzip，仍低于 250 kB；PWA 阶段继续监控，必要时按路由拆分 | 监控中 |
| 2026-11-26 | P0-1 规则页 UI 未纳入 5C 任务池（T-032 仅内容） | T-021/阶段验收 | 新增 T-034 规则页 UI 并补齐 | 已解决（2026-11-26） |
| 2026-11-26 | AC-5 断网后路由懒加载 chunk 不可用，页面空白 | T-022/AC-5 | P0 页面改为静态打包 | 已修复（2026-11-26，首屏 136.45 kB gzip） |

## 进度快照

### 2026-11-27 进度快照

**当前进度**：M2 T-045 已验收；T-046 P1 测试与全量回归已完成并提交报告，待用户验收。

**本轮完成（T-046）**：
- 测试计划升级为 P0 + P1，补齐 P1-1～P1-8、AC-12～AC-15/19、安全与压测矩阵。
- 全量门控：340 单测（33 文件）、41 e2e；lint/format/typecheck/build/verify:dist 通过；首屏 JS 207.14 kB gzip；PWA 预缓存 16 项。
- AC-15 PWA：离线冷启动、manifest/SW、在线更新 3 条 e2e 随全量回归通过。
- 安全黑盒 15/15：Cookie 签名与篡改 401、CSRF 403、跨源 API/WS 拒绝、hostToken 仅存 SHA-256、日志无 Token/Cookie。
- 压测：10 房间 / 130 会话 / 120 WS；WS P95 24ms、max 24ms；5s 轮询 P95 4773ms、max 4976ms；错误 0。
- 移动端：8 视口 + 3 全流程 + 125% 字体 + DPR 2/3，横向滚动/触控/对比度/console 问题均为 0。
- 覆盖率：全项目 82.39% stmts / 84.76% lines；api 88.07% / 90.24%；web 87.32% / 84.9%。
- 阻塞：真机矩阵、iOS/微信 PWA、真实 AI、真人 12 人局、线上服务器/ICP、真实网络压测（T-047）。
- 证据：[T-046 报告](../test/evidence/M2/T-046/verification.md)；[STEP-8](tasks/M2/STEP-8.md)。

**上一步（T-045）**：
- AC-12/13/14/19 系统验收 5 条 e2e；加入确认 1539ms、轮询 4571ms、越权 403、四表归零；[T-045 报告](../test/evidence/M2/T-045/verification.md)。

**下一步**：
- 用户验收 T-046 后启动 T-047（部署扩展：SQLite 持久化/备份、真实网络 WS 压测、发布前真机与线上检查）。

### 2026-11-26 进度快照

**当前进度**：M1 已全部验收（2026-11-26，含 T-024）；M2 T-010/T-033/T-035/T-036/T-037/T-038/T-039/T-040/T-041 已验收；T-042/T-043 已完成并提交报告，待验收；T-044 整合待启动。

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
- T-019 API 服务与 AI 中转：Fastify 5 启动/配置、匿名会话与 HMAC CSRF、AI 中转（仅 https、SSRF/DNS 固定、30s/60s 超时、1MB 响应上限、不跟随重定向）、按会话限频与在途并发、Helmet CSP、静态资源与 SPA fallback、统一错误包络与日志脱敏；114 个 API 单测，HTTP 内部冒烟 17/17、独立黑盒功能检查 57/57；5D 已验收（2026-11-26）；[验证证据](../test/evidence/M1/T-019/verification.md)、[功能测试报告](../test/evidence/M1/T-019/functional-check-20261126.md)。
- T-020 AI 前端接入与整合：AI 配置（URL/模型/Key/温度/最大输出）与 AI 军师面板、IndexedDB 配置持久化、Key 默认内存/可选 sessionStorage、会话/CSRF（401 刷新重试）、60s 超时与取消、错误码文案、纯文本安全渲染、边界提示；新增 28 个单测、4 个 e2e，全量 242 单测/18 e2e；生产构建同源联调 9/9；[验证证据](../test/evidence/M1/T-020/verification.md)。
- T-022 系统联调与 P0 验收：新增 6 个系统用例覆盖模式 A/B 遮罩与回退、两板子 12 人全流程到结算、断网首日、清空助手保留 AI 配置；8 视口审计无横向滚动/触控/console 问题；发现并修复 AC-5 路由懒加载断网空白，P0 页面改为静态打包；全量 242 单测、24 e2e 通过；[联调报告](../test/evidence/M1/T-022/verification.md)。
- T-023 测试计划与全量回归：建立 [P0 测试计划/用例](../test/test-cases.md)；242 单测、24 e2e、lint/format/typecheck/build/verify:dist 全部通过；8 视口 + 3 条全流程审计问题为 0；API 黑盒冒烟 7/7；覆盖率 85.57% stmts / 87.34% lines；无新增缺陷；真机/真实 AI/真人 12 人局记录为未执行阻塞；[测试报告](../test/evidence/M1/T-023/verification.md)。2026-11-26 第二轮复测结果一致（242 单测/24 e2e/审计/API 冒烟全通过）。
- T-024 部署与上线准备：新增 Node HTTPS 直连（TLS 路径校验、80→443 301、SIGTERM 优雅关闭）与 3 个部署单测；产出 [部署文档](../deploy/项目部署文档.md)、[systemd 单元](../deploy/werewolf-aid.service)、[环境模板](../deploy/env.production.example)、[22 项冒烟脚本](../../scripts/deploy/smoke.mjs)；本地自签证书 HTTPS 演练 22/22，重启/发布回滚/后端恢复/启动保护/备份恢复均通过；245 单测、24 e2e 通过；真实服务器/域名/证书/ICP 为阻塞项；[部署报告](../test/evidence/M1/T-024/verification.md)。已验收（2026-11-26）。
- T-010 M2 P1 规划：产出 [M2 STEP-4](tasks/M2/STEP-4.md) 与 STEP-5A/5C/5D/6/7/8/9 阶段入口；拆解 14 项实现任务（T-033、T-035～T-047），覆盖 P1-1～P1-8、AC-12～AC-15/19、SQLite/WS/PWA、依赖链与风险；待用户验收。
- T-033 服务端视图：`game-engine/views.ts` 提供状态校验、公开/私有视图与板子角色校验；12 个新单测覆盖 AC-13 可见性、两板子与非法状态；全量 257 单测通过；[T-033 报告](../test/evidence/M2/T-033/verification.md)。
- T-035 P1 设计：[interaction-spec v1.2](../tech/interaction-spec.md) 新增 P1 路由/主持端/玩家端/连接降级/状态矩阵/时间线/术语/笔记/AI 过滤/PWA；[M2 原型](../prototype/M2/index.html) 390/320/1440 走查无溢出与 console 错误；[T-035 报告](../test/evidence/M2/T-035/verification.md)。
- T-036 房间数据/API：`better-sqlite3` 13.2.0 + Drizzle 0.45.4；四表（rooms/room_seats/game_states/snapshots）、WAL/外键/TTL；创建/恢复/加入/确认/解绑/摘要/视图/快照/结算/解散 10 个端点；hostToken 仅返回一次并存 SHA-256；会话 Cookie HMAC 签名；快照 `version` 严格递增（409 `STALE_VERSION`）、非法状态 422；16 个 API 测试覆盖生命周期/权限/AC-13/AC-14/AC-19/限频/幂等，含“确认单个座位不影响其他申请”“同一会话改选只移动自己的申请”两个回归用例；[T-036 报告](../test/evidence/M2/T-036/verification.md)。
- T-037 Socket.IO：`/ws/rooms` 握手校验会话/Origin/绑定；`room.view`/`room.closed`/`room.error`；64KB 上限；版本只增不减；未发牌保持连接、发牌后首推；解绑/结算/过期即时通知；6 个 WS 集成测试（连接/未发牌/推送/关闭/越权/Origin）；[T-037 报告](../test/evidence/M2/T-037/verification.md)。
- T-038 联机主持端：[HostRoomScreen.tsx](../../apps/web/src/features/host/HostRoomScreen.tsx) 提供配对码/二维码/链接、座位绑定（逐个/批量确认/解绑）、房间状态、快照同步状态、结算/解散；[host-room-store.ts](../../apps/web/src/stores/host-room-store.ts) 管理 hostToken 本机恢复、3s 摘要刷新、300ms 合并快照、失败退避与 409 补写；后端补充摘要 `seats` 与 `GET /public`、`POST /leave`；主持组件 3 例 + 状态 4 例；[T-038 报告](../test/evidence/M2/T-038/verification.md)。
- T-039 联机玩家端：`/join`、`/join/:code` 路由；[PlayerRoot.tsx](../../apps/web/src/features/player/PlayerRoot.tsx) 加入/等待/绑定/结束状态、身份遮罩、公开进度与本人私有信息；[player-room-store.ts](../../apps/web/src/stores/player-room-store.ts) 1.5s 确认轮询、WS、3 次重连失败后 5s 轮询、版本单调；玩家组件 3 例 + 状态 5 例 + 双上下文 e2e 2 例（真实 WS 推送、320/430 无横向滚动、结算关闭）；[T-039 报告](../test/evidence/M2/T-039/verification.md)。
- T-040 复盘时间线：`game-engine` 新增 `PlayerView.privateActions`（仅本人夜间动作，狼队共享刀人，预言家带结果）；[timeline.ts](../../apps/web/src/lib/timeline.ts) 统一按夜/白天分组，[Timeline.tsx](../../apps/web/src/features/result/Timeline.tsx) 折叠/公开私密标记/空态；结算页与玩家端接入；timeline 3 例 + views 13 例 + e2e 3 例（主持端完整事件与默认展开、空态、玩家 9 号狼人仅见狼队刀人，320/390/430 无横向滚动）；[T-040 报告](../test/evidence/M2/T-040/verification.md)。
- T-041 术语/搜索与笔记：`rules-content` 新增 14 条术语与 5 类分类；[rules-search.ts](../../apps/web/src/lib/rules-search.ts) 统一搜索板子/角色/流程/术语并高亮；规则页新增“术语表”Tab 与空态；助手新增“笔记”Tab，独立 `lrs.notes.v1` IndexedDB、500ms 防抖、保存状态、清空确认、“引用到自由描述”，不自动进入 AI 上下文；rules-content 8 例 + 搜索 7 例 + 规则页 6 例 + 笔记 3 例 + e2e 2 例；[T-041 报告](../test/evidence/M2/T-041/verification.md)。
- T-042 AI 输入过滤：[input-filter.ts](../../apps/web/src/lib/input-filter.ts) 去除零宽/控制字符、统一换行、合并空行，识别手机号/身份证/银行卡（不返回原值），提交前按 500 字判定；助手页新增 `n / 500` 计数、超限与敏感提示、固定内容安全文案，超限禁用 AI；`buildAssistantContext` 组装前再次过滤；input-filter 9 例 + App.ai-filter 3 例 + e2e 1 例；[T-042 报告](../test/evidence/M2/T-042/verification.md)。
- T-043 PWA 离线壳：manifest 与 192/512/maskable 图标；`sw.js` 预缓存应用壳/JS/CSS/头像并跳过 `/api`、`/ws`、跨域；构建脚本生成 `precache.js` 与 SW 版本；`pwa.ts`/`PwaBanners` 支持更新提示与刷新、离线提示、安装入口与 iOS/微信降级；e2e 验证离线冷启动读取助手记录、manifest/SW 注册、修改 SW 后更新提示并刷新生效；pwa 6 例 + 横幅 4 例 + e2e 3 例；[T-043 报告](../test/evidence/M2/T-043/verification.md)。
- 回归：338 单测（33 文件）、35 e2e；首屏 JS 206.36 kB gzip（仍低于 250 kB）；预缓存 16 项。

**进行中**：
- T-042/T-043 已完成并提交报告，待用户验收；T-044 整合未启动。

**下一步**：
- 用户验收后启动 T-044（P1 整合），随后 T-045 系统联调。

**风险与阻塞**：
- M2：`better-sqlite3` Node 24 兼容、匿名 Cookie 签名、WS 单实例、PWA 在 iOS/微信的限制、AC-13 越权测试。
- 线上：服务器/域名/证书/443/ICP、真机矩阵、真实 AI 供应商。

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
- T-019：`npm run lint`、`format:check`、`typecheck`、`npm test`（214 用例）、`npm run build`、`verify:dist` 全部通过；API 114 个单测，`apps/api/src` 覆盖率 91.37% statements / 92.70% lines；HTTP 内部冒烟 17/17（health、session/CSRF、静态/SPA、API 404 隔离、SSRF、413、安全头、日志脱敏）；详见 [verification.md](../test/evidence/M1/T-019/verification.md)。
- 2026-11-26 T-019 功能测试：对生产构建执行黑盒检查 57/57 通过（契约、CSRF、Schema、SSRF、限频、413、静态/API 隔离、`PUBLIC_ORIGIN`、生产 Cookie/HSTS、启动保护、日志脱敏）；发现并修复非法 JSON/不支持 Content-Type 误返回 500 的缺陷，复测 400/415 `INVALID_REQUEST`；详见[功能测试报告](../test/evidence/M1/T-019/functional-check-20261126.md)。
- T-020：`npm run lint`、`format:check`、`typecheck`、`npm test`（242 用例）、`npm run build`、`verify:dist`、`npm run e2e`（18/18）全部通过；新增 AI 配置/客户端/UI 28 个单测；`apps/web/src` 覆盖率 90.76% statements / 90% lines；生产构建同源联调 9/9（真实 session/CSRF、`URL_NOT_ALLOWED` 文案、日志无 Key/上下文/Cookie）；首屏 JS 110.45 kB gzip；详见 [verification.md](../test/evidence/M1/T-020/verification.md)。
- T-022：`npm test`（242 用例）、`npm run e2e`（24/24）、lint/format/typecheck/build/verify:dist 全部通过；两板子 12 人流程到结算、模式 A/B/C、断网首日、清空助手保留 AI 配置均通过；8 视口审计横向滚动/触控/console 问题均为 0；修复 AC-5 后首屏 JS 136.45 kB gzip（≤250 kB）；详见 [verification.md](../test/evidence/M1/T-022/verification.md)。
- T-010：M2 任务拆解与阶段入口已建立，任务粒度、依赖无环、P1 范围与 AC 对应；详见 [M2 STEP-4](tasks/M2/STEP-4.md)。
