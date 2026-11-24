# STEP-5C 前端实现

## 任务索引

- **里程碑**：M1（v1.3.1 P0）
- **阶段**：5C
- **本轮基线**：PRD v1.3.1；tech-arch v1.2
- **进度入口**：[project-progress.md](../../project-progress.md)
- **项目拓扑**：前后端分离

## 阶段任务清单

| 任务 ID | 业务切片 | 一句话范围 | 影响位置 | 详情 |
| --- | --- | --- | --- | --- |
| T-015 | 基础 | npm workspaces、TS、Lint、测试与共享包脚手架 | 根目录、`packages/*` | [T-015](#t-015) |
| T-016 | 规则 | `game-engine` 板子/状态机/判定/视图 | `packages/game-engine` | [T-016](#t-016) |
| T-017 | 主持 | 主持端流程、本地存储、Wake Lock、移动布局 | `apps/web` | [T-017](#t-017) |
| T-018 | 助手 | 个人助手、规则内容、AI 上下文预览 | `apps/web`、`packages/rules-content` | [T-018](#t-018) |
| T-021 | 移动端 | 360–440/DPR/60fps/浏览器兼容专项 | `apps/web` | [T-021](#t-021) |

<a id="t-015"></a>
## T-015 工程脚手架与共享包

- **目标**：建立可构建、可测试的 monorepo 基线。
- **范围**：`apps/web`、`apps/api` 空壳；`packages/game-engine`、`shared`、`rules-content`；npm workspaces、TS strict、ESLint/Prettier、Vitest、Playwright。
- **产出**：根 `package.json`、`tsconfig`、构建/测试脚本、共享包入口。
- **验证**：`npm install`、`npm run build`、`npm test` 通过；无业务实现。

<a id="t-016"></a>
## T-016 game-engine 规则与状态机

- **目标**：实现附录 A 的规则、状态流转、胜负与视图生成。
- **范围**：板子/角色；SETUP/DEAL/NIGHT/SHERIFF/DAWN/SPEECH/VOTE/SETTLE/RESULT；同守同救、连守、两瓶、平票、警徽、自爆胜负、猎人/白痴/白狼王；`buildViews`。
- **产出**：`packages/game-engine` 源码与单测。
- **验证**：附录 A 用例全通过；自爆/DAWN/SETTLE 胜负检查；视图不含越权信息。

<a id="t-017"></a>
## T-017 主持端流程与本地存储

- **目标**：P0 主持闭环可在浏览器本地完成。
- **范围**：首页、设置、发牌 A/B、夜间/白天步骤卡、口播、模式 B 遮罩、投票/结算、回退/二次确认、Wake Lock、IndexedDB 每步落库。
- **产出**：`apps/web` 主持端页面/状态/存储。
- **验证**：AC-1/AC-2/AC-3/AC-4/AC-5/AC-6/AC-11/AC-16；刷新恢复；断网后继续。

<a id="t-018"></a>
## T-018 个人助手与规则内容

- **目标**：独立模式记录、标签/发言要点、规则内容与 AI 上下文预览。
- **范围**：身份/标签/信息/发言要点/攻略；局势录入；规则内容 JSON；AI 上下文预览；清空/新建。
- **产出**：`apps/web` 助手页面、`packages/rules-content` 内容。
- **验证**：AC-7/AC-8/AC-11；刷新保留；内容覆盖两板子角色/流程。

<a id="t-021"></a>
## T-021 移动端性能与兼容专项

- **目标**：达到 PRD 移动端预算。
- **范围**：360/390/393/412/430/440 + 320 抽查；DPR 2–3；60fps；首屏 JS ≤250KB；UC/QQ/微信内置浏览器；Lighthouse。
- **产出**：性能报告、兼容问题清单与修复。
- **验证**：AC-16/AC-17；无横向滚动；触控/安全区/键盘符合；无 P0 兼容阻塞。

## 阶段完成结果

- **实际产出**：待实现。
- **方案偏差**：待记录。
- **遗留项**：P1 联机不在本阶段。
- **验收摘要**：待提交。
