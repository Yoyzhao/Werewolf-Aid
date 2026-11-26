# STEP-5C 前端实现

## 任务索引

- **里程碑**：M1（v1.3.1 P0）
- **阶段**：5C
- **本轮基线**：PRD v1.3.2（含 CHG-20261125-02）；tech-arch v1.3；api-contract v1.1
- **进度入口**：[project-progress.md](../../project-progress.md)
- **项目拓扑**：前后端分离

## 阶段任务清单

| 任务 ID | 业务切片 | 一句话范围 | 影响位置 | 详情 |
| --- | --- | --- | --- | --- |
| T-015 | 基础 | npm workspaces、TS、Lint/CI、测试与共享包脚手架 | 根目录、`packages/*` | [T-015](#t-015) |
| T-026 | 规则 | 板子/角色配置与校验 | `packages/game-engine` | [T-026](#t-026) |
| T-027 | 规则 | 状态机、座位与夜间/白天动作 | `packages/game-engine` | [T-027](#t-027) |
| T-028 | 规则 | 冲突、技能、胜负判定（不含 P1 视图生成） | `packages/game-engine` | [T-028](#t-028) |
| T-029 | 主持 | 开局设置、三种发牌模式与首次使用引导 | `apps/web` | [T-029](#t-029) |
| T-030 | 主持 | 夜间、竞选、死讯、发言 | `apps/web` | [T-030](#t-030) |
| T-031 | 主持 | 投票、结算、本地存储、Wake Lock、回退 | `apps/web` | [T-031](#t-031) |
| T-018 | 助手 | 个人助手 UI 与 AI 上下文预览 | `apps/web` | [T-018](#t-018) |
| T-032 | 内容 | 两板子规则/角色/流程内容编写与评审 | `packages/rules-content` | [T-032](#t-032) |
| T-021 | 移动端 | 性能、DPR、浏览器兼容终检 | `apps/web` | [T-021](#t-021) |
| T-034 | 规则 | 规则页 UI（板子/角色图鉴/流程/页脚） | `apps/web` | [T-034](#t-034) |

> 状态、负责人、优先级、依赖与验收以 progress 为准。所有实现任务都包含最小单测/组件测试；T-023 只做全量回归。

<a id="t-015"></a>
## T-015 工程脚手架与共享包

- **目标**：建立可构建、可测试、可 CI 的 monorepo 基线。
- **范围内**：npm workspaces；`apps/web`/`apps/api` 空壳；`packages/game-engine`/`shared`/`rules-content`；TS strict；ESLint/Prettier；Vitest；Playwright；`lint/typecheck/test/build` 脚本。
- **范围外**：业务功能、P1 房间/WS。
- **输入**：STEP-5B 冻结的页面/契约；`dev-info.md`。
- **输出**：根 `package.json`、`tsconfig`、workspace 配置、CI 脚本、共享包入口。
- **验证**：`npm install`、`npm run lint`、`npm run typecheck`、`npm test`、`npm run build` 通过；无业务实现。
- **证据**：`docs/test/evidence/M1/T-015/`。
- **依赖**：T-014。
- **风险**：Node 24/Fastify 5 兼容性首日验证。
- **完成结果（2026-11-26）**：已建立 npm workspaces（`@lrs/web`/`api`/`game-engine`/`shared`/`rules-content`）；TS strict、ESLint 10 flat config、Prettier、Vitest 5、Playwright 1.65、GitHub Actions；web 空壳通过 Vite 构建，api 提供 `/api/v1/health` 并通过 Node 24 启动验证；`npm run lint/format:check/typecheck/test/build` 全部通过，Playwright e2e 冒烟 1 用例通过。实际版本：React 19.3.1、Vite 8.3.8、TypeScript 5.9.3、Fastify 5.12.8、Vitest 5.1.2。偏差：TypeScript 采用 5.9.3（未采用 7.x）；Tailwind/Radix 延后到 T-029/T-030。证据：[verification.md](../../../test/evidence/M1/T-015/verification.md)。

<a id="t-026"></a>
## T-026 板子/角色配置

- **目标**：把两套 12 人板子的角色构成、阵营、夜间顺序、胜负口径变成可校验数据。
- **范围内**：预女猎守、预女猎白；角色技能/限制元数据；`Board` 配置；配置校验（人数=12、角色数量、狼人构成）。
- **范围外**：状态机、判定、视图生成。
- **输入**：PRD 附录 A/B。
- **输出**：`packages/game-engine` 板子/角色配置与单测。
- **验证**：两板子配置断言；AC-4 配置部分。
- **证据**：`docs/test/evidence/M1/T-026/`。
- **依赖**：T-015。
- **完成结果（2026-11-26）**：`packages/game-engine` 已提供 8 角色元数据（阵营/类别/夜间动作/技能/限制）、两套板子（预女猎守：4 神+4 民+4 狼；预女猎白：4 神+4 民+3 狼+1 白狼王）、夜序、板子选项与 `validateBoard` 配置校验（人数/角色总数/狼人构成/夜序一致性）。新增 16 个单测，覆盖 AC-4 配置部分；全量 lint/format/typecheck/test/build 通过。证据：[verification.md](../../../test/evidence/M1/T-026/verification.md)。

<a id="t-027"></a>
## T-027 状态机与动作

- **目标**：实现 P0 对局状态与动作流转。
- **范围内**：SETUP/DEAL/NIGHT/SHERIFF/DAWN/SPEECH/VOTE/SETTLE/RESULT；座位/存活/警长；夜间动作；投票/弃票；自爆中断；回退快照接口。
- **范围外**：冲突/胜负（T-028）、UI、P1 视图。
- **输入**：T-026 配置；PRD 附录 E。
- **输出**：`packages/game-engine` 状态机与动作函数、单测。
- **验证**：状态迁移用例；非法动作拒绝；AC-1/AC-2/AC-4 流程部分。
- **证据**：`docs/test/evidence/M1/T-027/`。
- **依赖**：T-026。
- **完成结果（2026-11-26）**：`packages/game-engine/src/state-machine.ts` 已实现 SETUP/DEAL/NIGHT/SHERIFF/DAWN/SPEECH/SELF_EXPLODE/VOTE/SETTLE/CHECK_WIN/RESULT 阶段与动作；覆盖发牌校验、夜序动作、竞选（报名/发言/退水/投票/PK/无警长）、逐票 `Ballot`（警长 1.5）、弃票、PK、自爆中断、`resumeTo` 与 `RESOLVE_WIN`、深拷贝快照。新增 21 个单测；全量 lint/format/typecheck/test/build 通过。死亡结算/技能/胜负由 T-028 接入。证据：[verification.md](../../../test/evidence/M1/T-027/verification.md)。

<a id="t-028"></a>
## T-028 冲突、技能与胜负

- **目标**：实现附录 A 的冲突、技能与胜负判定。
- **范围内**：同守同救、连守、女巫两瓶、平票 PK、1.5 票、警徽流转、自爆胜负、猎人/白痴/白狼王、DAWN/SETTLE 胜负检查。
- **范围外**：P1 `buildViews`/服务端视图生成（M2 T-033）。
- **输入**：T-027 状态机；PRD 附录 A。
- **输出**：规则/胜负函数与单测。
- **验证**：AC-3/AC-4 全用例；自爆/DAWN/SETTLE 检查点。
- **证据**：`docs/test/evidence/M1/T-028/`。
- **依赖**：T-027。
- **完成结果（2026-11-26）**：`packages/game-engine/src/rules.ts` 已实现夜间结算（守护/狼刀/解药/毒药/同守同救）、连守与药剂拦截、屠边胜负；状态机接入死亡结算、`CHECK_WIN` 自动判定、放逐结算、猎人开枪、白痴翻牌、警徽移交/撕毁、白狼王带人与最后一狼约束。新增 19 个单测；game-engine 共 57 个用例，全量 59 个用例。lint/format/typecheck/test/build 全部通过。证据：[verification.md](../../../test/evidence/M1/T-028/verification.md)。

<a id="t-029"></a>
## T-029 开局设置与三种发牌模式

- **目标**：主持人可完成开局与发牌。
- **范围内**：板子/编号/模式/设置；1–12 校验；接力查看；模式 B 默认遮罩+二次揭示；模式 C 实体牌录入（逐号手动选择身份、角色余量校验、撤销上一位、防窥核对、构成一致才可入夜）；发牌落库；首次使用 3 步引导、赛前加载提示、浏览器能力检测与降级提示（Wake Lock/WebSocket/PWA，PRD 3.7.9）；P0 性能预算（首屏/交互）。
- **范围外**：夜间/白天、P1 配对。
- **输入**：T-015/T-027；STEP-5A/5B。
- **输出**：`apps/web` 开局/发牌页面与状态；组件测试。
- **验证**：AC-2/AC-6；模式 C 未选满/构成不一致拦截；刷新恢复；320/430 布局；性能预算初检。
- **证据**：`docs/test/evidence/M1/T-029/`。
- **依赖**：T-015、T-027。
- **完成结果（2026-11-26）**：`apps/web` 已实现首页大厅、开局设置、三种发牌模式与天黑占位页；接入 Tailwind 4、Radix Dialog/Switch、Zustand、idb-keyval、Sonner、lucide-react。支持模式 A 接力查看、B 二次揭示、C 逐号录入/余量禁用/撤销/防窥核对/构成校验；发牌进度落 IndexedDB，刷新可恢复；首次 3 步引导、Wake Lock/WebSocket 能力提示、版本不兼容提示。新增 8 个组件测试，e2e 4/4（模式 C 全流程、刷新恢复、320/430 无横向滚动、首页加载）；首屏 JS 107.23 kB gzip。证据：[verification.md](../../../test/evidence/M1/T-029/verification.md)。

<a id="t-030"></a>
## T-030 夜间、竞选、死讯与发言

- **目标**：完成夜间与白天非投票流程。
- **范围内**：夜间角色卡/口播/动作；狼人互认；竞选/死讯/遗言/发言；警徽流转；步骤卡与遮罩；性能预算持续检查。
- **范围外**：投票/结算（T-031）、P1。
- **输入**：T-029/T-028；PRD 7.2/3.7。
- **输出**：`apps/web` 夜间/白天页面与状态；组件测试。
- **验证**：AC-3/AC-4；AC-16 布局；无横向滚动。
- **证据**：`docs/test/evidence/M1/T-030/`。
- **依赖**：T-029、T-028。
- **完成结果（2026-11-26）**：`apps/web` 已实现夜间（夜序队列、角色口播、空守/空刀/不用药、狼队名单、查验私密结果、女巫刀口/解药/毒药、天亮结算）、竞选（报名/发言/退水/警下投票/PK/当选或无警长）、死讯（平安夜/死因/首夜遗言/猎人开枪/警徽移交或撕毁）、发言（默认死者下一位、指定起点、打卡、进入投票）与自爆结算；store 增加 `dispatch`、`CHECK_WIN` 自动结算与阶段→视图映射。投票/结算为占位页，T-031 接入。新增 10 个组件测试，全量 76 个用例；e2e 6/6（新增首夜→竞选→死讯→发言→投票占位、320/430 无横向滚动）；首屏 JS 107.90 kB gzip。证据：[verification.md](../../../test/evidence/M1/T-030/verification.md)。

<a id="t-031"></a>
## T-031 投票、结算与本地能力

- **目标**：完成投票/结算闭环与本地持久化。
- **范围内**：逐票录入/归票/弃票/白痴无票/警长 1.5；平票 PK；放逐后技能；结算揭晓；IndexedDB 每步落库；Wake Lock；回退/二次确认；性能预算检查。
- **范围外**：P1 联机结算。
- **输入**：T-030/T-028；PRD 3.7.4/3.7.7。
- **输出**：`apps/web` 投票/结算页面、本地存储、Wake Lock；测试。
- **验证**：AC-1/AC-3/AC-5/AC-11/AC-16/AC-18；刷新恢复；断网继续。
- **证据**：`docs/test/evidence/M1/T-031/`。
- **依赖**：T-030、T-028。
- **完成结果（2026-11-26）**：`apps/web` 已实现逐票录入/快速归票/弃票、警长 1.5 票、平票 PK、白痴无票与翻牌、猎人被放逐开枪、警徽移交/撕毁、放逐后胜负检查；结算页展示胜负原因、12 人身份、逐夜私密记录与关键事件，并提供再来一局/返回首页/清除本局。新增 30 条快照历史与“回退一步”二次确认（夜间/竞选/死讯/发言/投票/自爆），快照随对局落库；投票页纳入 Wake Lock；已完成对局可从首页查看只读结果。新增 9 个组件测试，全量 85 个用例；e2e 11/11（投票→放逐→下一夜、刷新恢复、断网继续、320/430 无横向滚动、只读结算与再来一局）；首屏 JS 108.28 kB gzip。证据：[verification.md](../../../test/evidence/M1/T-031/verification.md)。

<a id="t-018"></a>
## T-018 个人助手 UI

- **目标**：玩家可独立记录并使用 AI 上下文预览。
- **范围内**：身份/标签/信息/发言要点/攻略；局势录入；AI 上下文预览；清空/新建。
- **范围外**：AI 请求（T-020）、规则内容编写（T-032）。
- **输入**：T-015/T-032；PRD 3.7.6。
- **输出**：`apps/web` 助手页面/状态；组件测试。
- **验证**：AC-7/AC-8/AC-11；刷新保留；移动布局。
- **证据**：`docs/test/evidence/M1/T-018/`。
- **依赖**：T-015、T-032。
- **完成结果（2026-11-26）**：`apps/web` 已实现个人助手的身份自选与身份攻略（来源 `rules-content`）、局势录入、12 人标签/信息记录/按轮次发言要点、AI 上下文预览、清空二次确认与 IndexedDB 持久化；新增首页与底部 Tab 入口。新增 4 个组件测试与 2 个 e2e（含 320/430 无横向滚动）；全量 96 用例、lint/format/typecheck/build/verify:dist、e2e 13/13 通过，生产预览懒加载正常，首屏 JS 108.50 kB gzip。证据：[verification.md](../../../test/evidence/M1/T-018/verification.md)。

<a id="t-032"></a>
## T-032 规则内容编写与评审

- **目标**：提供 P0 两板子规则/角色/流程内容。
- **范围内**：板子列表、角色技能/限制/常见打法/易错点、流程规则、页脚来源；不含 P1 术语搜索。
- **范围外**：术语表/搜索（M2）、UI。
- **输入**：规则源 + PRD 附录 A/B；T-015 内容 schema。
- **输出**：`packages/rules-content` 内容 JSON/TS 与评审记录。
- **验证**：AC-4 内容核对；两板子角色全覆盖；页脚声明。
- **证据**：`docs/test/evidence/M1/T-032/`。
- **依赖**：T-015。
- **完成结果（2026-11-26）**：`packages/rules-content` 已提供两套板子（人数/构成/夜序/胜负）、8 个角色（阵营/技能/限制/常见打法/易错点）、夜间/白天/胜负流程与页脚声明；新增 7 个单测锁定与 `game-engine` 的构成、夜序、技能、限制一致；全量 92 用例、lint/format/typecheck/build/verify:dist 通过，构建产物实测 2 板子/8 角色/3 流程/页脚正确。证据：[verification.md](../../../test/evidence/M1/T-032/verification.md)。

<a id="t-021"></a>
## T-021 移动端性能与兼容终检

- **目标**：对 5C 产物做性能/兼容终检。
- **范围内**：360/390/393/412/430/440 + 320 抽查；DPR 2–3；首屏 JS ≤250KB；Lighthouse；UC/QQ/微信内置浏览器；60fps；1440×900 PC 响应式抽查（CHG-20261125-01）；对比度 ≥4.5:1 与系统字体放大不截断走查。
- **范围外**：功能修复（回退对应任务）。
- **输入**：T-031/T-018。
- **输出**：性能/兼容报告与修复清单。
- **验证**：AC-16/AC-17；无 P0 兼容阻塞。
- **证据**：`docs/test/evidence/M1/T-021/`。
- **依赖**：T-031、T-018。
- **执行结果（实验室，2026-11-26）**：8 个视口（320–440、1440×900）首页/设置/助手与 360/390/412 全流程（发牌→夜间→竞选→死讯→发言→投票）无横向滚动、无 console error；触控 <44px、对比度 <4.5、引导进度 ARIA 问题已修复并复测为 0；Lighthouse 4G/5G 均为 100/100/100（FCP 0.8/0.1s、LCP 1.5/0.2s、TBT 10/0ms、CLS 0）；首屏 JS 108.51 kB gzip、首屏请求 3、总传输 115 KiB。iOS/Android/UC/QQ/微信真机矩阵缺设备，AC-16/17 真机部分阻塞。证据：[verification.md](../../../test/evidence/M1/T-021/verification.md)。
- **验收结论（2026-11-26）**：用户接受实验室证据，真机复测延后至发布前（纳入 T-023，T-024 前完成）；T-021 有条件完成，风险接受登记于进度。

<a id="t-034"></a>
## T-034 规则页 UI

- **目标**：提供 P0-1 规则页，临场速查两套板子、8 个角色与流程。
- **范围内**：板子列表；角色图鉴与详情（技能/限制/常见打法/易错点）；夜间/白天/胜负流程；页脚声明；首页与底部 Tab 入口；移动端/PC 响应式。
- **范围外**：术语表/搜索（M2）；规则内容编写（T-032 已完成）。
- **输入**：T-032 内容；STEP-5A/5B 规则页设计。
- **输出**：`apps/web` 规则页与导航；组件与 e2e 测试。
- **验证**：AC-4 内容展示；320/390/430 无横向滚动；触控与对比度。
- **证据**：`docs/test/evidence/M1/T-034/`。
- **依赖**：T-032、T-015。
- **编号说明**：T-033 预留 M2 服务端视图生成。
- **完成结果（2026-11-26）**：已实现 `apps/web/src/features/rules/RulesScreen.tsx`：两板子折叠、8 角色图鉴与详情、三流程折叠、页脚声明；首页“先翻规则书”与底部 Tab 可进入，顶部状态“规则 · 只读”。新增 3 个组件测试与 1 个 e2e；全量 100 用例、e2e 14/14、lint/format/typecheck/build/verify:dist 通过；8 视口审计无横向滚动、触控/对比度问题为 0；首屏 JS 108.57 kB gzip。证据：[verification.md](../../../test/evidence/M1/T-034/verification.md)。

## 阶段完成结果

- **实际产出**：工程脚手架（T-015）；game-engine 板子/状态机/规则（T-026～T-028）；web 开局与发牌 A/B/C（T-029）、夜间/竞选/死讯/发言（T-030）、投票/结算/本地快照（T-031）、个人助手（T-018）、规则内容（T-032）、规则页 UI（T-034）；移动端实验室终检（T-021）。100 个单测、14 个 e2e，Lighthouse 4G/5G 100/100/100。
- **方案偏差**：TypeScript 采用 5.9.3（非 7.x）；Tailwind/Radix 延后到 T-029；T-021 真机复测延后至发布前（用户风险接受 2026-11-26）。
- **遗留项**：P1 视图生成/联机不在本阶段；真机矩阵在 T-023 补测。
- **验收摘要**：5C 功能检查通过（100 单测、e2e 14/14、覆盖率 84.31%），待用户阶段验收；详见[5C 功能检查报告](../../../test/evidence/M1/stage-5c-functional-check-20261126.md)。
