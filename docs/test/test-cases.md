# P0 + P1 测试计划与用例（T-023 / T-046）

- 版本：v1.1（2026-11-27）
- 任务：T-023（P0 阶段 8）、T-046（P1 阶段 8）
- 基线：P0 验收（T-023）+ P1 验收（T-045）；PRD v1.3.2、api-contract v1.1、interaction-spec v1.2
- 范围：M1 P0（单机主持闭环、助手、规则、AI 中转与前端接入、移动端/PC 响应式）+ M2 P1（联机、服务端视图、时间线、术语/笔记、AI 输入过滤、PWA）
- 范围外：P2；真机、真实 AI 供应商与线上服务器不可用时按阻塞记录

## 1. 测试策略与分层

| 层级 | 工具 | 资产 | 覆盖目标 |
| --- | --- | --- | --- |
| 规则单测 | Vitest | `packages/game-engine/src/*.test.ts` | 状态机、夜间结算、技能冲突、投票、胜负（AC-3/AC-4） |
| 内容单测 | Vitest | `packages/rules-content/src/*.test.ts` | 板子/角色/流程/术语与引擎口径一致（AC-4、P1-5） |
| 组件/页面测试 | Vitest + RTL + jsdom | `apps/web/src/**/*.test.tsx` | 页面流程、遮罩、助手、AI 四态、存储恢复、房间状态（AC-2/5/6/7/8/10/11/18、P1-1/2/4/6/7） |
| API 单测 | Vitest + Fastify inject | `apps/api/src/*.test.ts` | 契约、CSRF、SSRF、限频、超时、静态资源、日志脱敏；房间生命周期、视图、版本、Origin、结算删除（AC-9/10、AC-12/13/14/19） |
| 端到端 | Playwright Chromium | `tests/e2e/*.spec.ts` | 真实浏览器串联的 P0 主持闭环、断网、离线、响应式；P1 联机主链路与 AC 验收（AC-1～AC-19、P1-1～P1-8） |
| 安全黑盒 | Node 脚本 | `scripts/test-script/p1-security-check.mjs` | Cookie 签名、CSRF、Origin、hostToken 哈希、日志脱敏 |
| 性能压测 | Node 脚本 | `scripts/test-script/p1-load.mjs` | 10 房间 / 130 会话 / 120 WS；WS P95 与轮询 P95 |
| 移动端实验室审计 | Playwright 脚本 + Lighthouse | `scripts/test-script/audit-mobile.mjs`、T-021/T-022 数据 | 8 视口横向滚动/触控/console/对比度、首屏预算（AC-16/17） |
| 真机矩阵 | 人工 | 本文 §7.2 | AC-16 设备×浏览器；缺设备记阻塞 |

## 2. 环境与测试数据

| 项 | 值 |
| --- | --- |
| 操作系统 | Windows 11 |
| Node / npm | v24.22.3 / 11.19.1 |
| 浏览器 | Playwright Chromium（桌面内核）；真机矩阵见 §7.2 |
| Web/API | Vite 5173 + Fastify 3000（`npm run e2e` 自动启动）；生产同源由 API `WEB_DIST_DIR` 提供 |
| P1 后端 | SQLite（WAL）`apps/api/data/lrs.sqlite`；Socket.IO `/ws/rooms` |
| 视口 | 320/360/390/393/412/430/440 CSS 宽，DPR 2–3；PC 1440×900 |
| 数据 | 12 座位固定夹具；两套板子（预女猎守 = 4 狼，预女猎白 = 3 狼 + 白狼王）；模式 A/B/C |
| AI | 假端点/Mock 验证成功链路；真实私网地址验证拒绝链路；真实供应商由用户自备端点 |

## 3. 验收标准用例矩阵

> 执行方式缩写：U=单测/组件测试，E=Playwright e2e，M=移动端实验室审计，R=真机人工。
> 结果以本轮（2026-11-26）执行记录为准，证据见 `docs/test/evidence/M1/T-023/`。

### AC-1 新手主持完整闭环

| 用例 | Given/When/Then | 方式 | 结果 | 证据 |
| --- | --- | --- | --- | --- |
| TC-AC1-01 | Given 预女猎守、12 人；When 仅按界面完成设置→发牌→夜间→竞选→死讯→发言→逐票投票→结算；Then 进入结算且胜负与人工判定一致 | E | 通过（自动化） | `system.spec.ts`「预女猎守 12 人全流程」 |
| TC-AC1-02 | Given 预女猎白；When 同上；Then 结算正确（白狼王板子） | E | 通过（自动化） | `system.spec.ts`「预女猎白 12 人全流程」 |
| TC-AC1-03 | Given 真人测试者从未玩过狼人杀；When 按提示主持一局；Then 能到结算、无卡死、文案可理解 | R | **未执行（需用户组织 12 人局）** | 验收检查单 |

### AC-2 三种发牌模式

| 用例 | Given/When/Then | 方式 | 结果 | 证据 |
| --- | --- | --- | --- | --- |
| TC-AC2-01 | Given 模式 A；When 接力查看；Then 非当前玩家不可见身份、查看后回遮罩、编号→身份映射正确 | E+U | 通过 | `system.spec.ts`「模式 A 遮罩、二次揭示与回退」 |
| TC-AC2-02 | Given 模式 B；When 每人二次点击揭示；Then 默认遮罩、仅本人可揭示 | E+U | 通过 | `system.spec.ts`「模式 B 默认遮罩」 |
| TC-AC2-03 | Given 模式 C；When 按 1→12 逐号选择；Then 未选满或构成不一致不可入夜、余量/撤销/防窥核对生效 | E+U | 通过 | `setup-deal.spec.ts`、`night-day.spec.ts` |
| TC-AC2-04 | Given 三模式发牌完成；When 对比映射；Then 编号→身份一致 | U | 通过 | 引擎/页面单测 |

### AC-3 规则细则（附录 A）

| 用例 | 场景 | 方式 | 结果 | 证据 |
| --- | --- | --- | --- | --- |
| TC-AC3-01 | 同守同救：守护+解药同一目标 → 仍出局 | U | 通过 | `rules.test.ts`（夜间结算） |
| TC-AC3-02 | 女巫同夜两瓶药 → 拦截 | U | 通过 | `rules.test.ts`（夜间结算） |
| TC-AC3-03 | 守卫连守 → 拦截 | U | 通过 | `rules.test.ts`（夜间结算） |
| TC-AC3-04 | 警长 1.5 票计票 | U | 通过 | `state-machine.test.ts`（投票与结算） |
| TC-AC3-05 | 平票 PK → 再平无警长/无人出局 | U | 通过 | `state-machine.test.ts`（竞选/投票） |
| TC-AC3-06 | 弃票与白痴翻牌无票 | U | 通过 | `state-machine.test.ts`、`rules.test.ts` |
| TC-AC3-07 | 警长死亡警徽移交/撕毁 | U | 通过 | `rules.test.ts`（白痴与警徽） |
| TC-AC3-08 | 自爆吞警徽、最后一狼自爆立即判负、白狼王自爆带走目标 | U | 通过 | `rules.test.ts`（白狼王自爆）、`state-machine.test.ts`（自爆中断） |
| TC-AC3-09 | 猎人被毒/被白狼王带走 → 不可开枪 | U | 通过 | `rules.test.ts`（猎人） |
| TC-AC3-10 | 自爆/技能结算后立即检查胜负（CHECK_WIN） | U | 通过 | `state-machine.test.ts`、`rules.test.ts`（胜负判定） |

### AC-4 两套板子一致性

| 用例 | Given/When/Then | 方式 | 结果 | 证据 |
| --- | --- | --- | --- | --- |
| TC-AC4-01 | Given 两板子；When 校验构成/夜序/技能/胜负；Then 与附录 A/B 一致 | U | 通过 | `boards.test.ts`、`rules-content` 7 单测 |
| TC-AC4-02 | Given 两板子；When 跑完整 UI 流程；Then 均可到结算 | E | 通过 | `system.spec.ts` 两例 |

### AC-5 断网继续（已加载页面）

| 用例 | Given/When/Then | 方式 | 结果 | 证据 |
| --- | --- | --- | --- | --- |
| TC-AC5-01 | Given 首页加载完成；When 断网后完成模式 C 设置→发牌→首夜→竞选→死讯→发言→投票；Then 无网络错误阻塞 | E | 通过（修复后） | `system.spec.ts`「AC-5 断网」、`vote-result.spec.ts`「断网后投票仍可继续」 |
| TC-AC5-02 | Given 页面加载完成；When 路由切换；Then 不因懒加载 chunk 失败而空白 | E | 通过 | T-022 修复：P0 页面静态打包；首屏 136.45 kB gzip |

### AC-6 私密信息遮罩

| 用例 | Given/When/Then | 方式 | 结果 | 证据 |
| --- | --- | --- | --- | --- |
| TC-AC6-01 | Given 发牌/夜间；When 旁观者看屏；Then 默认遮罩、需二次操作显示 | E+U | 通过 | 模式 A/B 用例、夜间私密结果组件测试 |
| TC-AC6-02 | Given 玩家本地记录；When 其他设备访问；Then 无法读取（仅本机 IndexedDB） | 设计审查 | 通过 | 无服务端存储；T-018 证据 |

### AC-7 助手本机保留与 AI 可用

| 用例 | Given/When/Then | 方式 | 结果 | 证据 |
| --- | --- | --- | --- | --- |
| TC-AC7-01 | Given 记录身份/标签/要点；When 刷新/重开；Then 保留 | U+E | 通过 | `assistant.spec.ts`、`App.assistant.test.tsx` |
| TC-AC7-02 | Given 未配置 Key；When 打开 AI；Then 提示先配置，助手其他功能可用 | U+E | 通过 | `assistant-ai.spec.ts` |

### AC-8 助手上下文与刷新保留

| 用例 | Given/When/Then | 方式 | 结果 | 证据 |
| --- | --- | --- | --- | --- |
| TC-AC8-01 | Given 1–12 号标签/信息/发言要点；When 切换页面/刷新；Then 保留 | U+E | 通过 | 助手测试 |
| TC-AC8-02 | Given 已录入内容；When 打开上下文预览；Then 被组装进 AI 上下文 | U | 通过 | `App.assistant.test.tsx` |

### AC-9 AI 成功链路

| 用例 | Given/When/Then | 方式 | 结果 | 证据 |
| --- | --- | --- | --- | --- |
| TC-AC9-01 | Given 有效 URL/Key/模型；When 点“AI 整理”；Then 返回三段以上（信息整理/可疑与依据/下一步）并显示边界提示 | E（mock 上游） | 通过（实验室） | `assistant-ai.spec.ts`「配置后请求成功」 |
| TC-AC9-02 | Given 真实供应商端点与 Key；When 发起请求；Then 真实返回可展示且日志无 Key/上下文 | R | **未执行（用户自备端点）** | 验收检查单 |

### AC-10 AI 失败链路

| 用例 | Given/When/Then | 方式 | 结果 | 证据 |
| --- | --- | --- | --- | --- |
| TC-AC10-01 | Given Key 无效/额度不足；When 发起；Then 友好失败文案、60s 内结束 | U+E（mock） | 通过 | `ai-client.test.ts`、`App.assistant-ai.test.tsx` |
| TC-AC10-02 | Given 非 https/私网/不允许地址；When 发起；Then `URL_NOT_ALLOWED` 提示且不改配置 | E（真实 API） | 通过 | `assistant-ai.spec.ts`「真实 API 拒绝私网地址」 |
| TC-AC10-03 | Given 请求超时；When 取消/超时；Then 提示超时、可重试、其他功能不受影响 | U | 通过 | `ai-client.test.ts` |

### AC-11 清空助手记录

| 用例 | Given/When/Then | 方式 | 结果 | 证据 |
| --- | --- | --- | --- | --- |
| TC-AC11-01 | Given 有本地记录；When 清空并二次确认；Then 记录清除、规则与 AI 配置保留 | E+U | 通过 | `system.spec.ts`「AC-11 清空助手记录保留 AI 配置」 |

### AC-16 移动端兼容（实验室 + 真机）

| 用例 | Given/When/Then | 方式 | 结果 | 证据 |
| --- | --- | --- | --- | --- |
| TC-AC16-01 | Given 8 视口（320/360/390/393/412/430/440/1440）；When 首页/设置/助手/规则；Then 无横向滚动、触控 ≥44px、console error 0 | M | 通过 | `mobile-audit.json`（T-023 复跑） |
| TC-AC16-02 | Given 360/390/412；When 完成开局→发牌→一夜→白天→结算；Then 无横向滚动、无遮挡 | M | 通过 | T-021/T-022 全流程审计 |
| TC-AC16-03 | Given 125% 字体、DPR 2/3；When 首页/设置/助手；Then 布局不破、图标不糊 | M | 通过 | T-021 证据 |
| TC-AC16-04 | Given §7.2 真机矩阵；When 走完整闭环；Then 满足 AC-16 全部条件 | R | **阻塞（无设备）** | §7.2 状态表 |

### AC-17 性能

| 用例 | Given/When/Then | 方式 | 结果 | 证据 |
| --- | --- | --- | --- | --- |
| TC-AC17-01 | Given 生产构建；When 检查包体；Then 首屏 JS ≤250 kB gzip | 构建 | 通过（136.45 kB） | `verify:dist`、构建输出 |
| TC-AC17-02 | Given Lighthouse 4G/5G 移动仿真；When 首次加载；Then FCP/LCP/TTI/CLS 达标 | M | 通过（4G FCP 0.8s / 5G 0.1s） | T-021 Lighthouse JSON |
| TC-AC17-03 | Given 实验室 rAF；When 首页/助手滚动切换；Then ≥55fps、反馈 ≤100ms | M | 通过（60fps，仿真） | T-021 证据 |
| TC-AC17-04 | Given 真机 5G/Wi-Fi 与 4G/弱网；When 首屏与连续操作；Then AC-17 真实指标达标 | R | **阻塞（无设备）** | §7.2 状态表 |

### AC-18 回退与二次确认

| 用例 | Given/When/Then | 方式 | 结果 | 证据 |
| --- | --- | --- | --- | --- |
| TC-AC18-01 | Given 发牌/投票/结算/自爆前误触；When 回退；Then 二次确认、可取消、状态与存储一致 | E+U | 通过 | 模式 A 回退用例、`App.vote.test.tsx` |
| TC-AC18-02 | Given 回退一步；When 连续回退/刷新；Then 无重复记录、快照一致 | U | 通过 | T-031 快照用例 |

### AC-12 联机加入、降级与重连

| 用例 | Given/When/Then | 方式 | 结果 | 证据 |
| --- | --- | --- | --- | --- |
| TC-AC12-01 | Given 房间已有 v1 快照；When 玩家输码加入、主持确认；Then 2s 内看到公开快照 | E | 通过（1539ms） | `p1-acceptance.spec.ts`、[ac12-timings.json](evidence/M2/T-045/raw/ac12-timings.json) |
| TC-AC12-02 | Given WS 与 Socket.IO HTTP 传输不可用；When 主持写入新快照；Then 应用层 5s 轮询可见，P95 ≤5s | E | 通过（单独 4571ms；并行全量 5581ms，5s 周期 + 负载抖动） | [ac12-polling-isolated.json](evidence/M2/T-045/raw/ac12-polling-isolated.json)、[ac12-polling.json](evidence/M2/T-045/raw/ac12-polling.json) |
| TC-AC12-03 | Given 玩家断线/刷新；When 恢复连接；Then 版本不回退并补齐最新视图 | E | 通过 | T-045、`p1-integration.spec.ts` |

### AC-13 服务端视图隔离

| 用例 | Given/When/Then | 方式 | 结果 | 证据 |
| --- | --- | --- | --- | --- |
| TC-AC13-01 | Given 5 号平民已绑定；When 直接调 `/view`（含 `?seatNo=9`）；Then 只返回本人视图且无 `gameState/stateJson/roleId/hostToken` | API | 通过 | [ac13-player-view.json](evidence/M2/T-045/raw/ac13-player-view.json) |
| TC-AC13-02 | Given 未绑定/无令牌/错误令牌；When 读摘要、写快照、结算、抢座；Then 403 或 409，座位不变 | API | 通过 | [ac13-unauthorized.json](evidence/M2/T-045/raw/ac13-unauthorized.json) |
| TC-AC13-03 | Given 狼人 9 号；When 读取视图；Then 仅见本人阵营与狼队友 10/11/12 | API | 通过 | 同上 |

### AC-14 结算/解散删除

| 用例 | Given/When/Then | 方式 | 结果 | 证据 |
| --- | --- | --- | --- | --- |
| TC-AC14-01 | Given 房间有座位、状态与快照；When 主持结算；Then SQLite 四表计数归零且 API 404 | E+DB | 通过 | [ac14-db-check.json](evidence/M2/T-045/raw/ac14-db-check.json) |
| TC-AC14-02 | Given 同上；When 主持解散；Then DELETE 204、四表归零、public 404 | E+DB | 通过 | 同上 |

### AC-15 PWA 离线

| 用例 | Given/When/Then | 方式 | 结果 | 证据 |
| --- | --- | --- | --- | --- |
| TC-AC15-01 | Given 已在线访问并安装 SW；When 断网冷启动；Then 应用壳可开、助手记录可读 | E | 通过 | [T-043 报告](evidence/M2/T-043/verification.md)、`pwa.spec.ts` |
| TC-AC15-02 | Given 生产构建；When 读取 manifest/SW；Then manifest 可读、SW 激活、预缓存 16 项 | E | 通过 | T-043、`pwa.spec.ts` |
| TC-AC15-03 | Given iOS/微信；When 安装/离线；Then 降级提示可见 | R | **阻塞（无真机）** | §7.2 |

### AC-19 版本控制

| 用例 | Given/When/Then | 方式 | 结果 | 证据 |
| --- | --- | --- | --- | --- |
| TC-AC19-01 | Given 已写入 v1；When 再写 v1/v0；Then 409 `STALE_VERSION`（v0 为 400 参数校验） | API | 通过 | [ac19-version.json](evidence/M2/T-045/raw/ac19-version.json) |
| TC-AC19-02 | Given 连续 v1→v2→v3；When 玩家重连读取；Then 版本递增且读到最新 | API+E | 通过 | 同上；T-044 双浏览器用例 |
| TC-AC19-03 | Given 10 房间 120 WS；When 主持写入 v2；Then WS P95 24ms、max 24ms（≤2s） | 压测 | 通过 | [load-check.json](evidence/M2/T-046/load-check.json) |

### P1-1～P1-8 功能矩阵

| 用例 | 范围 | 方式 | 结果 | 证据 |
| --- | --- | --- | --- | --- |
| TC-P1-01 | P1-1 创建/加入/确认/解绑/主持恢复 | API+U+E | 通过 | `rooms.test.ts`、T-038/T-039、`p1-integration.spec.ts` |
| TC-P1-02 | P1-2 WS 推送、轮询降级、断线重连、房间关闭 | API+E | 通过 | `realtime.test.ts`、T-044/T-045 |
| TC-P1-03 | P1-3 服务端视图过滤（公开/私有/狼队/预言家/女巫/守卫） | U+API | 通过 | `views.test.ts` 13 例、AC-13 |
| TC-P1-04 | P1-4 复盘时间线（主持完整、玩家仅本人私有动作） | U+E | 通过 | T-040、`timeline.spec.ts` |
| TC-P1-05 | P1-5 术语表 14 条与跨范围搜索高亮 | U+E | 通过 | T-041、`p1-rules-notes.spec.ts` |
| TC-P1-06 | P1-6 私人笔记自动保存、刷新保留、手动引用、不自动进 AI 上下文 | U+E | 通过 | T-041、`App.notes.test.tsx` |
| TC-P1-07 | P1-7 零宽/控制字符过滤、敏感信息提示、500 字 AI 上限 | U+E | 通过 | T-042、`p1-ai-filter.spec.ts` |
| TC-P1-08 | P1-8 manifest/SW/预缓存/更新提示/离线冷启动 | U+E | 通过 | T-043、`pwa.spec.ts` |

## 4. 安全与 API 用例

| 用例 | 场景 | 方式 | 结果 | 证据 |
| --- | --- | --- | --- | --- |
| TC-SEC-01 | 匿名会话下发、HMAC CSRF 校验；缺失/错误 token 返回 403 | U+黑盒 | 通过 | `session.test.ts`、T-019 黑盒 57/57 |
| TC-SEC-02 | SSRF：仅 https、私网/回环/元数据地址拒绝、DNS 固定、不跟随重定向 | U+E | 通过 | `ssrf.test.ts`、黑盒 |
| TC-SEC-03 | 限频与在途并发：每会话 1 个在途、全局上限、429 文案 | U+黑盒 | 通过 | `app.test.ts` |
| TC-SEC-04 | 超时与响应上限：连接/总超时、1MB 响应截断 | U | 通过 | `ai-relay.test.ts` |
| TC-SEC-05 | 请求体上限 413、非法 JSON 400、不支持 Content-Type 415 | U+黑盒 | 通过 | T-019 功能测试（已修复缺陷） |
| TC-SEC-06 | Helmet/CSP、生产 Cookie 属性、HSTS、API 404 与 SPA fallback 隔离 | U+黑盒 | 通过 | T-019 证据 |
| TC-SEC-07 | 日志脱敏：无 Key、Prompt 上下文、Cookie | 黑盒 | 通过 | T-019 功能测试 |
| TC-SEC-08 | P1 Cookie：`lrs_anon=<48hex>.<64hex>` HMAC 签名；篡改 Cookie 写入返回 401 | 黑盒 | 通过 | `p1-security-check.mjs` |
| TC-SEC-09 | P1 Origin/CSRF：缺 CSRF/错误 CSRF/跨源 API 均 403；WS 无 Origin 或错误 Origin 拒绝 | 黑盒 | 通过 | 同上、`realtime.test.ts` |
| TC-SEC-10 | P1 hostToken：服务端仅存 SHA-256，不下发明文；日志无 hostToken/Cookie | 黑盒 | 通过 | 同上、`rooms.test.ts` |
| TC-SEC-11 | P1 房间鉴权：未绑定读视图 403、无令牌写快照/结算 403、抢座 409 | 黑盒 | 通过 | AC-13 |

## 4.1 P1 性能与压测用例

| 用例 | Given/When/Then | 方式 | 结果 | 证据 |
| --- | --- | --- | --- | --- |
| TC-PERF-01 | Given 10 房间、10 主持 + 120 玩家（130 会话）；When 120 个玩家 WS 连接；Then 全部连接成功 | 压测 | 通过（120/120） | [load-check.json](evidence/M2/T-046/load-check.json) |
| TC-PERF-02 | Given 120 WS 已连接；When 10 个房间同时写入 v2；Then WS 端到端 P95 ≤2s | 压测 | 通过（P95 24ms、max 24ms） | 同上 |
| TC-PERF-03 | Given 120 玩家按 5s 周期轮询（相位分散）；When 10 个房间写入 v3；Then 轮询可见 P95 ≤5s | 压测 | 通过（P95 4773ms、max 4976ms） | 同上 |
| TC-PERF-04 | Given 压测完成；When 检查错误；Then 连接/推送/轮询错误为 0 | 压测 | 通过（0） | 同上 |

## 5. 执行方式与门控命令

```bash
npm run lint
npm run format:check
npm run typecheck
npm test
npm run e2e
npm run build
npm run verify:dist
npm run test:p1-security
npm run test:p1-load
node scripts/test-script/audit-mobile.mjs http://localhost:4173
```

- 单测/组件测试随任务交付，本任务执行全量回归；e2e 自动启动 Web 5173 + API 3000。
- P1 安全/压测脚本自行启动临时 Fastify + SQLite（3111/3112），不污染开发数据库。
- 移动端审计产物写入 `.artifacts/audit/`，定稿证据复制到对应任务证据目录。

## 6. 缺陷分级与出口准则

| 等级 | 定义 | 处理 |
| --- | --- | --- |
| P0 阻断 | 主持闭环不可完成、结算错误、数据丢失、安全漏洞 | 必须修复后复测 |
| P1 | 局部功能不可用但有替代路径、明显体验缺陷 | 修复或登记风险后放行 |
| P2 | 文案/样式细节 | 可带入下轮 |

出口准则：
1. P0 AC-1～AC-11、AC-16～AC-18 有明确结论；自动化项全绿。
2. 无未关闭 P0 缺陷；P1 缺陷有处理决定。
3. 真机矩阵与真实 AI 若未执行，必须以阻塞项记录，不得标记通过。
4. 质量门控 lint/format/typecheck/test/build/verify:dist 全通过。

## 7. 兼容与性能矩阵

### 7.1 实验室视口（已执行）

| 视口 | 首页 | 设置 | 助手/规则 | 全流程 |
| --- | --- | --- | --- | --- |
| 320×640 | 通过 | 通过 | 通过 | 通过（T-021/T-022） |
| 360×800 | 通过 | 通过 | 通过 | 通过 |
| 390×844 | 通过 | 通过 | 通过 | 通过 |
| 393×852 | 通过 | 通过 | 通过 | 抽查 |
| 412×915 | 通过 | 通过 | 通过 | 通过 |
| 430×932 | 通过 | 通过 | 通过 | 抽查 |
| 440×956 | 通过 | 通过 | 通过 | 抽查 |
| 1440×900 | 通过 | 通过 | 通过 | PC 双栏抽查 |

### 7.2 真机矩阵（AC-16/AC-17 必需）

| 设备 | 浏览器 | 状态 | 说明 |
| --- | --- | --- | --- |
| iPhone 390/393/430/440 | iOS Safari | **阻塞** | 无设备/系统 |
| Android 360/384/412 | Chrome | **阻塞** | 无设备 |
| 同上 | 微信内置浏览器 | **阻塞** | 无真机环境 |
| 同上 | UC / QQ 浏览器 | **阻塞** | 未安装/无法验证 |

- 真机项须在 T-047 发布前完成；当前沿用 2026-11-26 风险接受（用户批准）。
- 若届时仍无设备，由用户在 T-047 验收时决定：预发布环境抽测或继续风险接受。

## 8. 本轮执行记录

| 项 | 结果 | 备注 |
| --- | --- | --- |
| P0 单元/组件/API 测试 | 见 T-023 报告 | 242 例基线 |
| P0 E2E | 见 T-023 报告 | 24 例基线 |
| P1 单元/组件/API/WS | 见 T-046 报告 | 全量 340 例 |
| P1 E2E | 见 T-046 报告 | 全量 41 例（含 AC-12/13/14/19、PWA） |
| 门控 | 见 T-046 报告 | lint/format/typecheck/test/e2e/build/verify:dist |
| P1 安全黑盒 | 通过 | Cookie/CSRF/Origin/hostToken/日志 |
| P1 压测 | 通过 | 10 房间 / 130 会话 / 120 WS；WS P95 24ms、轮询 P95 4773ms |
| 移动端审计 | 见 T-046 报告 | P0 8 视口 + 全流程抽查；P1 320/390 已由 e2e 覆盖 |
| 真机矩阵 | 阻塞 | §7.2 |
| 真实 AI 供应商 | 未执行 | 用户自备端点 |

## 9. 未覆盖与依赖用户事项

1. **真人 12 人局（AC-1）**：需用户组织一次预女猎守正式验收，确认新手主持可完成。
2. **真机矩阵（AC-16/AC-17）**：需设备或预发布环境；当前记阻塞。
3. **真实 AI 供应商（AC-9）**：需用户提供可用端点/Key；不在仓库保存。
4. **P1 联机（AC-12～AC-15、AC-19）**：已由 T-045/T-046 自动化覆盖；PWA 的 iOS/微信真机行为仍随 §7.2 阻塞。
5. **线上服务器/域名/证书/ICP**：部署前置条件，见 T-024/T-047。

## 10. 参考

- [PRD v1.3.2](../prd/prd.md)（AC 与附录 A）
- [api-contract v1.1](../tech/api-contract.md)
- [interaction-spec v1.2](../tech/interaction-spec.md)
- [T-022 联调报告](evidence/M1/T-022/verification.md)
- [T-021 实验室报告](evidence/M1/T-021/verification.md)
- [T-045 验收报告](evidence/M2/T-045/verification.md)
- [T-046 测试报告](evidence/M2/T-046/verification.md)
