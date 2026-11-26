# T-029 开局设置与三种发牌模式验证证据

- 日期：2026-11-26
- 环境：Windows 11 / Node v24.22.3 / npm 11.19.1 / 本机 Chrome（e2e 与截图）
- 任务：[STEP-5C T-029](../../../plan/tasks/M1/STEP-5C.md#t-029)
- 依据：interaction-spec v1.1 第 5.1/5.2/8.2/8.3/8.5/9 节；PRD v1.3.2 3.7.9 与 AC-2/AC-6

## 产出

- `apps/web/src/features/home/HomeScreen.tsx`：首页大厅、继续上一局入口、首次引导与能力提示。
- `apps/web/src/features/setup/SetupScreen.tsx`：板子/编号/模式/设置，开始发牌二次确认。
- `apps/web/src/features/deal/DealScreen.tsx`：A/B 遮罩发牌、进度、回退、完成入夜。
- `apps/web/src/features/deal/DealCover.tsx`：A 接力查看、B 默认遮罩 + 二次揭示。
- `apps/web/src/features/deal/ManualDeal.tsx`：C 逐号选择、余量禁用、撤销、防窥核对。
- `apps/web/src/stores/game-store.ts`：开局/发牌状态、持久化、恢复与退出。
- `apps/web/src/lib/`：板子与角色辅助、IndexedDB 存储、Wake Lock、能力检测。
- `apps/web/src/features/night/NightScreen.tsx`：发牌完成后的天黑占位页（夜间流程 T-030 接入）。
- 接入 Tailwind CSS 4 + Radix Dialog/Switch + Zustand + idb-keyval + Sonner + lucide-react。

## 验证结果

| 验证项 | 结果 |
| --- | --- |
| `npm run lint` | 通过 |
| `npm run format:check` | 通过 |
| `npm run typecheck` | 通过（全部 workspace） |
| `npm test` | 通过：6 个文件、66 个用例 |
| `npm run build` | 通过 |
| `npm run verify:dist` | 通过 |
| `npx playwright test` | 通过：4 个用例（模式 C 全流程、刷新恢复、320/430 无横向滚动、首页加载） |

## AC-2 / AC-6 覆盖

- 模式 A：全屏遮罩 → 玩家点击查看身份 → 回遮罩推进；遮罩期间不渲染身份。
- 模式 B：默认遮罩；主持人二次点击“显示身份”才揭示；确认后推进。
- 模式 C：按 1→12 逐号选择身份；余量 0 禁用；撤销上一位；防窥核对需二次确认；12 人未满禁止入夜；完成发牌时由引擎校验角色构成。
- 发牌进度写入 IndexedDB（`lrs.game.current.v1`，schemaVersion 1）；刷新后首页出现“继续上一局”，可恢复到当前发牌进度（e2e 已用真实 IndexedDB 验证）。
- 首次进入 3 步引导（选板子 → 发牌 → 按卡片主持），可跳过并记录已读。
- 能力检测：Wake Lock 不支持时提示关闭自动锁屏；WebSocket 缺失时提示 P1 轮询降级；提示可关闭并记住。
- 版本不兼容：提示需要重新开局，不静默加载。

## 布局与性能

- 走查截图：`docs/test/evidence/M1/T-029/`（home-390、setup-320/390/430、deal-mode-c-390）。
- 320/430 宽度无页面横向滚动；e2e 断言通过。
- 构建：首屏 JS `107.23 kB gzip`（≤250 KB 预算）；CSS `6.47 kB gzip`；Setup/Deal/Night 已按路由懒加载拆包。

## 说明与限制

- 夜间/竞选/死讯/发言/投票/结算页面由 T-030/T-031 接入；当前发牌完成后显示天黑占位页，状态机已处于 `NIGHT` 并落库。
- 助手与规则 Tab 仅保留入口提示，分别由 T-018/T-032 接入。
- 本机 Playwright Chromium 下载未完成，e2e 临时使用系统 Chrome（`channel: 'chrome'`，配置已还原）；CI 使用 `npx playwright install chromium`。
- PWA 离线冷启动为 P1，不在本任务实现。
