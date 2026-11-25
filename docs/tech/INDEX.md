# 技术文档索引

- 版本：v1.0
- 日期：2026-11-25
- 状态：活跃（步骤 3 已验收，2026-11-25）
- 说明：`活跃` 表示仍在维护；阶段验收状态以 [project-progress.md](../plan/project-progress.md) 为准。

| 文档 | 状态 | 内容 |
| --- | --- | --- |
| [tech-arch.md](tech-arch.md) | 活跃 | 技术架构 v1.3：系统架构、模块边界、需求承接、数据模型、安全与非功能 |
| [api-contract.md](api-contract.md) | 活跃 | API 契约 v1.1：完整 gameState + 服务端视图、P0 AI 中转、错误码、幂等与版本 |
| [功能变更.md](功能变更.md) | 活跃 | CHG 索引：PC 端响应式适配（CHG-20261125-01）、发牌模式 C 实体牌录入（CHG-20261125-02） |
| [dev-info.md](dev-info.md) | 活跃 | 技术栈、目录、端口、环境变量、测试与 AI Coding 环境 |
| [research/tech-stack-2026.md](research/tech-stack-2026.md) | 活跃 | 技术栈候选对比与结论 |
| [arch/ADR-001](arch/ADR-001-技术栈与项目拓扑.md) | 已接受（2026-11-25） | 技术栈与项目拓扑 |
| [arch/ADR-002](arch/ADR-002-数据存储与持久化.md) | 已接受（2026-11-25） | 数据存储与持久化 |
| [arch/ADR-003](arch/ADR-003-联机同步与匿名身份.md) | 已接受（2026-11-25） | 联机同步与匿名身份 |
| [arch/ADR-004](arch/ADR-004-AI中转与安全边界.md) | 已接受（2026-11-25） | AI 中转与安全边界 |
| [arch/ADR-005](arch/ADR-005-部署与运行形态.md) | 已接受（2026-11-25） | 部署与运行形态：Node 单进程，无 Nginx/Docker |

## 后续计划

- 步骤 5A/5B：移动端原型与交互细化（任务拆解已完成，见 `docs/plan/tasks/M1/`）。
- 步骤 5C/5D：前端/后端实现。
- 步骤 8：测试用例与执行。
- 步骤 9：部署文档。
