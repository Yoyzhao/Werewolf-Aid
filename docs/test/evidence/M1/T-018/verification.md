# T-018 个人助手 UI 验证

- 日期：2026-11-26
- 任务：T-018 个人助手 UI（阶段 5C）
- 基线：commit `51f9cd7` + 本轮工作区变更（`apps/web` 助手页面、测试与导航）
- 范围：身份自选与身份攻略、局势录入、12 人标签/信息记录/按轮次发言要点、AI 上下文预览、清空二次确认、本机持久化
- 不包含：AI 配置与 AI 请求（T-020）、规则页 UI、P1 联机
- 结论：通过；4 个组件测试与 2 个 e2e 用例通过，未发现阻断缺陷

## 实现内容

| 能力 | 实现 |
| --- | --- |
| 身份与攻略 | 8 角色自选；显示阵营、技能，以及来自 `rules-content` 的常见打法与易错点 |
| 局势 | 轮次加减、12 座存活切换、公开事件文本 |
| 玩家记录 | 1–12 号；预设标签（金水/查杀/悍跳嫌疑/划水/疑似狼）+ 自定义标签；信息记录；按轮次发言要点 |
| AI 上下文预览 | 身份、局势、标签、信息、各轮发言要点、自由描述分段组装；显示字数；超过 20000 字提示截断；自由描述上限 2000 字 |
| 清空 | “清空当前记录”二次确认；仅清助手记录，规则内容不受影响 |
| 持久化 | IndexedDB 键 `lrs.assistant.current.v1`；文本输入去抖 300ms，标签/身份/轮次/存活立即写入；离开页面时冲刷待写入内容 |
| 导航 | 首页“我的助手”入口与底部 Tab 进入；底栏返回大厅 |

主要文件：

- `apps/web/src/features/assistant/AssistantScreen.tsx`
- `apps/web/src/features/assistant/AssistantPlayerRow.tsx`
- `apps/web/src/stores/assistant-store.ts`
- `apps/web/src/lib/assistant.ts`、`assistant-context.ts`、`assistant-storage.ts`
- `apps/web/src/App.assistant.test.tsx`
- `tests/e2e/assistant.spec.ts`

## 验收对照

| 验收项 | 验证方式 | 结果 |
| --- | --- | --- |
| AC-7 独立模式、本机保留 | 组件测试“切换页面后助手记录仍在本机”；存储读写于 IndexedDB（jsdom 使用内存等价实现） | 通过（AI 可用性属 T-020） |
| AC-8 标签/信息/要点进入上下文 | 组件测试“标签、信息、发言要点与局势组装进 AI 上下文预览”；e2e 同场景 | 通过 |
| AC-11 清空需确认且规则不受影响 | 组件测试“清空当前记录需二次确认”；规则内容为 `rules-content` 静态数据 | 通过（AI 配置尚未实现） |
| 移动布局 | e2e 320/430 无横向滚动；390/430 截图走查 | 通过 |

## 验证命令与结果

| 命令 | 结果 |
| --- | --- |
| `npm run lint`、`npm run format:check` | 通过 |
| `npm run typecheck` | 通过：5 个 workspace |
| `npm test` | 通过：96/96（新增 4 个助手测试） |
| `npm run build` | 通过；助手懒加载 chunk 7.64 kB gzip；首屏 JS 108.50 kB gzip |
| `npm run verify:dist` | 通过 |
| `npm run e2e` | 通过：13/13（新增 2 个助手用例，含 320/430 无横向滚动） |
| 生产预览冒烟 | 通过：HTTP 200、助手页与上下文预览可见、无 console/page error、无横向滚动 |

归档截图：

- `docs/test/evidence/M1/T-018/assistant-390.png`
- `docs/test/evidence/M1/T-018/assistant-430.png`

## 限制与未覆盖

- AI 配置表单、请求、结果面板与错误态属 T-020（步骤 6），本轮仅提供上下文预览。
- 规则页 UI 仍未纳入 5C 任务池（T-032 仅内容），需在阶段验收前确认承接任务。
- 真机 URI/字体缩放、iOS Safari 未验证，归 T-021。
- 助手记录未提供跨设备同步；P1 联机不在本轮。
