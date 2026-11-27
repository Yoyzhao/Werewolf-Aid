# T-042 AI 输入基础过滤与内容提示报告

- 日期：2026-11-27
- 任务：T-042（M2 / 5C）
- 基线：interaction-spec v1.2 §19.4；PRD P1-7；T-018/T-020 助手与 AI 接入
- 结论：**完成**；自由描述本地过滤、敏感信息提示、500 字提交上限与内容安全提示已实现，AI 中转协议未改动

## 1. 实现

| 文件 | 内容 |
| --- | --- |
| `apps/web/src/lib/input-filter.ts` | `sanitizeFreeText` 去除零宽/控制字符、统一换行、合并连续空行；`detectSensitiveInfo` 识别手机号/身份证/银行卡且不返回原值；`analyzeFreeText` 去首尾空白后按 500 字判定 |
| `apps/web/src/stores/assistant-store.ts` | 写入自由描述前执行过滤，保留既有 2000 字存储上限 |
| `apps/web/src/lib/assistant-context.ts` | 组装上下文前再次过滤自由描述，预览与发送内容一致 |
| `apps/web/src/features/assistant/AssistantScreen.tsx` | 字数计数 `n / 500`；超限告警；敏感信息告警；固定内容安全提示；超限时禁止发起 AI |
| `apps/web/src/features/assistant/AIPanel.tsx` | 新增 `blockReason`，所有“整理/重试”入口在超限时禁用 |

## 2. 规则与边界

- 长度口径：交互规格 §8 的自由描述存储上限 2000 字保持不变；§19.4 的 AI 提交上限 500 字在提交前执行，超限不删除原文，仅禁止 AI 请求并提示精简。
- 过滤顺序：换行归一 → 制表符转空格 → 去零宽/控制字符 → 合并连续空行 → 去首尾空白（提交时）。
- 敏感检测：手机号（`1[3-9]` 11 位）、18/15 位身份证、16～19 位银行卡号；银行卡在手机号/身份证命中范围外再判断，提示不展示命中内容。
- 提示不阻断普通编辑与其他助手功能；内容安全提示固定展示。
- 未修改 `/api/v1/ai/relay` 请求与响应结构。

## 3. 测试

| 用例 | 结果 |
| --- | --- |
| 零宽/控制字符剔除、换行与制表符归一、连续空行合并 | 通过（input-filter 9/9） |
| 手机号/身份证/银行卡识别；普通数字不误判 | 通过 |
| 500 字内可提交、501 字超限、过滤后检测 | 通过 |
| 过滤后计数、上下文预览无零宽/控制字符、其他助手功能可用 | 通过（App.ai-filter 3/3） |
| 敏感信息提示且不阻断编辑 | 通过 |
| 501 字禁用 AI，回落到 500 字恢复 | 通过 |
| e2e：敏感提示、501/500 计数、告警、AI 按钮禁用、320/430 无横向滚动 | 通过 |

| 项 | 结果 |
| --- | --- |
| `npm test`（全量） | **338/338**（33 文件） |
| `npm run e2e`（全量） | **35/35** |
| lint / format:check / typecheck / build / verify:dist | 通过 |
| 首屏 JS | 206.36 kB gzip（低于 250 kB 预算） |

## 4. AC 对应

- **P1-7**：提交前完成过滤与长度限制；敏感格式提示“请勿填写真实个人信息”；内容安全提示固定展示；过滤在本地完成，不改变 AI 中转协议。
- **AC-10 回归**：AI 请求失败/取消/配置缺失路径保持不变。

## 5. 已知边界

- 敏感信息识别为本地格式匹配，不做校验位/Luhn 检查，可能漏检或误报；提示不阻断编辑。
- 只扫描自由描述；玩家信息、发言要点与公开事件不在本任务范围。
- 超过 500 字时 AI 不可提交，但原文仍保存在本机并计入上下文预览。

## 6. 证据

- 代码：[input-filter.ts](../../../../../apps/web/src/lib/input-filter.ts)、[AssistantScreen.tsx](../../../../../apps/web/src/features/assistant/AssistantScreen.tsx)、[AIPanel.tsx](../../../../../apps/web/src/features/assistant/AIPanel.tsx)
- 测试：[input-filter.test.ts](../../../../../apps/web/src/lib/input-filter.test.ts)、[App.ai-filter.test.tsx](../../../../../apps/web/src/App.ai-filter.test.tsx)、[p1-ai-filter.spec.ts](../../../../../tests/e2e/p1-ai-filter.spec.ts)
- 截图：[ai-filter-sensitive-390.png](ai-filter-sensitive-390.png)、[ai-filter-limit-390.png](ai-filter-limit-390.png)
- 日志：[gates.log](../gates.log)、[unit-tests.log](../unit-tests.log)、[e2e.log](../e2e.log)
