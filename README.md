# 狼人杀助手（Werewolf-Aid）

移动端优先的狼人杀线下主持辅助 Web 应用：主持人完成开局、发牌、夜间引导、白天流程与结算，玩家可独立使用助手记录信息。

- 当前版本：PRD v1.3.2（M1 P0）
- 技术栈：React 19 + Vite + TypeScript + Tailwind/Radix + Zustand；Node 24 + Fastify 5（P1 Socket.IO + SQLite）
- 仓库形态：npm workspaces monorepo

## 快速开始

```bash
npm install
npm run dev:web    # Vite，http://localhost:5173（/api 代理到 3000）
npm run dev:api    # Fastify，http://localhost:3000
```

质量门控与构建：

```bash
npm run lint
npm run format:check
npm run typecheck
npm test           # Vitest 单元/组件测试
npm run e2e        # Playwright（首次需 npx playwright install chromium）
npm run build
npm run verify:dist
```

生产运行：`npm start -w @lrs/api`（Node 单进程提供静态 SPA + API）。端口与环境变量键名见 [dev-info](docs/tech/dev-info.md)。

## 目录

```text
apps/
  web/            React SPA（主持端页面）
  api/            Fastify API 与静态资源服务（P1 联机）
packages/
  game-engine/    规则、状态机、技能与胜负判定
  shared/         API 契约与 DTO
  rules-content/  板子/角色/流程内容
tests/e2e/        Playwright 端到端用例
docs/             需求、技术、计划、原型与测试证据
.artifacts/       测试产物（忽略）
```

## 文档入口

- 项目进度：[docs/plan/project-progress.md](docs/plan/project-progress.md)（任务状态与验收唯一来源）
- 产品需求：[docs/prd/prd.md](docs/prd/prd.md)（规则口径见附录 A）
- 技术架构：[docs/tech/tech-arch.md](docs/tech/tech-arch.md)、[API 契约](docs/tech/api-contract.md)
- 开发环境：[docs/tech/dev-info.md](docs/tech/dev-info.md)
- 交互契约：[docs/tech/interaction-spec.md](docs/tech/interaction-spec.md)
- 5A 原型：[docs/prototype/M1/index.html](docs/prototype/M1/index.html)（直接打开）
- 项目规则：[docs/rules/project-rules.md](docs/rules/project-rules.md)
- 测试证据：[docs/test/evidence/M1/](docs/test/evidence/M1/)

## 开发流程

本项目按 `fullstack-general` 流程维护：需求 → 架构 → 任务拆解 → 5A/5B 设计 → 5C/5D 实现 → 整合联调 → 测试 → 部署。版本记录见 PRD 第 1 章与 [docs/prd/archive/](docs/prd/archive/)，进度与验收以 [project-progress.md](docs/plan/project-progress.md) 为准。
