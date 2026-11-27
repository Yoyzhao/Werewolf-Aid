# T-041 术语表/搜索与私人笔记报告

- 日期：2026-11-26
- 任务：T-041（M2 / 5C）
- 基线：interaction-spec v1.2 §19.2/§19.3；T-032 规则内容；T-018/T-020 助手与 AI
- 结论：**完成并已验收（2026-11-27）**；术语表、跨范围高亮搜索、私人笔记（IndexedDB、500ms 防抖、清空确认、手动引用）均已实现并通过组件与 e2e 验证

## 1. 实现

| 文件 | 内容 |
| --- | --- |
| `packages/rules-content/src/index.ts` | 新增 `TermCategory`/`TermEntry`/`TERMS`/`TERM_CATEGORIES`/`TERM_CATEGORY_LABELS`，14 条术语覆盖同守同救、连守、警徽流、悍跳、自爆、金水、查杀、银水、倒钩、冲锋狼等；加入 `RULES_CONTENT.terms` |
| `apps/web/src/lib/rules-search.ts` | 统一搜索板子/角色/流程/术语（名称、解释、别名）；`splitHighlight` 按关键词切分高亮 |
| `apps/web/src/features/rules/RulesScreen.tsx` | 搜索框；“规则内容/术语表”Tab；术语按板子/角色/流程/判定/口语分类；搜索结果 `<mark>` 高亮；空态“没有找到相关术语，试试更短的关键词” |
| `apps/web/src/lib/notes-storage.ts` | 独立 IndexedDB 键 `lrs.notes.v1`，无 IndexedDB 时内存回退 |
| `apps/web/src/stores/notes-store.ts` | 500ms 防抖保存、保存中/已保存/失败状态、清空、重试 |
| `apps/web/src/features/assistant/NotesPanel.tsx` | 笔记面板、自动保存状态、清空二次确认、“引用到自由描述” |
| `apps/web/src/features/assistant/AssistantScreen.tsx` | 新增“记录/笔记”Tab；AI 配置与上下文仅保留在记录页 |

## 2. AI 上下文隔离

- 笔记写入独立存储与 Zustand store，不写入 `AssistantRecord`。
- `buildAssistantContext` 仍只读取 `record.freeText`；笔记不会自动进入预览或 AI 请求。
- 用户点击“引用到自由描述”后，以 `【笔记引用】` 前缀追加到 `freeText`；超过 2000 字上限时截断并提示。

## 3. 测试

| 用例 | 结果 |
| --- | --- |
| 术语覆盖设计稿 10 个示例，分类/别名/解释完整，ID 与名称唯一 | 通过（rules-content 8/8） |
| 跨术语/角色/板子/流程检索、别名检索、无命中 | 通过（rules-search 7/7） |
| 高亮切分保留原文、全部命中、大小写不敏感 | 通过 |
| 规则页术语 Tab 分类展示 | 通过（App.rules 6/6） |
| 搜索“金水”命中术语与预言家并高亮；清空恢复 Tab；无命中空态 | 通过 |
| 笔记自动保存状态、刷新保留、不自动进入 AI 上下文、引用后进入自由描述、清空确认 | 通过（App.notes 3/3） |
| e2e：术语表、搜索高亮与空态、320/390/430 无横向滚动 | 通过 |
| e2e：笔记保存、刷新保留、引用到自由描述 | 通过 |

| 项 | 结果 |
| --- | --- |
| `npm test`（全量） | **316/316**（29 文件） |
| `npm run e2e`（全量） | **31/31** |
| lint / format:check / typecheck / build / verify:dist | 通过 |
| 首屏 JS | 203.88 kB gzip（低于 250 kB 预算） |

## 4. AC 对应

- **P1-5**：术语表 + 跨板子/角色/流程/术语统一搜索 + 关键词高亮 + 空态，符合 §19.2。
- **P1-6**：笔记仅本机 IndexedDB；500ms 防抖并显示保存状态；不自动进入 AI 上下文；手动引用；清空二次确认；刷新保留，符合 §19.3。

## 5. 已知边界

- 搜索为本地子串匹配，不做拼音、模糊或分词；短关键词结果更宽。
- 笔记不设长度上限（本机存储）；引用到自由描述时受 2000 字上限约束。
- 多标签同时编辑笔记时以最后写入为准（单机场景）。

## 6. 证据

- 代码：[RulesScreen.tsx](../../../../../apps/web/src/features/rules/RulesScreen.tsx)、[rules-search.ts](../../../../../apps/web/src/lib/rules-search.ts)、[NotesPanel.tsx](../../../../../apps/web/src/features/assistant/NotesPanel.tsx)、[notes-store.ts](../../../../../apps/web/src/stores/notes-store.ts)
- 测试：[rules-search.test.ts](../../../../../apps/web/src/lib/rules-search.test.ts)、[App.rules.test.tsx](../../../../../apps/web/src/App.rules.test.tsx)、[App.notes.test.tsx](../../../../../apps/web/src/App.notes.test.tsx)、[p1-rules-notes.spec.ts](../../../../../tests/e2e/p1-rules-notes.spec.ts)
- 截图：[terms-390.png](terms-390.png)、[search-390.png](search-390.png)、[search-320.png](search-320.png)、[search-430.png](search-430.png)、[notes-390.png](notes-390.png)、[notes-430.png](notes-430.png)
- 日志：[gates.log](../gates.log)、[unit-tests.log](../unit-tests.log)、[e2e.log](../e2e.log)
