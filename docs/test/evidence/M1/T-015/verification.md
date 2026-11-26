# T-015 工程脚手架验证证据

- 日期：2026-11-26
- 环境：Windows 11 / Node v24.22.3 / npm 11.19.1
- 任务：[STEP-5C T-015](../../../plan/tasks/M1/STEP-5C.md#t-015)

## 命令结果

| 命令 | 结果 | 说明 |
| --- | --- | --- |
| `npm install` | 通过 | 263 packages；workspaces 链接完成 |
| `npm run lint` | 通过 | ESLint 10 + typescript-eslint，无警告 |
| `npm run format:check` | 通过 | Prettier 全部匹配 |
| `npm run typecheck` | 通过 | api/web/game-engine/rules-content/shared 均通过 |
| `npm test` | 通过 | 3 个测试文件、3 个用例 |
| `npm run build` | 通过 | shared/game-engine/rules-content/web/api 全部构建 |
| `node apps/api/dist/server.js` + `GET /api/v1/health` | 通过 | 返回 `{"ok":true,"version":"0.1.0"}` |
| `npx playwright test` | 通过 | 1 个用例通过（tests/e2e/smoke.spec.ts，344ms）；本地以系统 Chrome（`channel: 'chrome'`）执行，CI 使用 `npx playwright install chromium` 安装的 Chromium |

## 构建产物

- `apps/web/dist/index.html`
- `apps/web/dist/assets/index-*.js`：220.28 kB，gzip 69.12 kB（低于 250 kB 首屏 JS 预算）
- `apps/web/dist/assets/index-*.css`：0.98 kB
- `apps/api/dist/server.js`、`app.js`

## 浏览器检查

- Vite 开发服务器 `http://localhost:5173` 正常渲染脚手架占位页。
- 页面标题与占位文案可见；无横向滚动。

## 备注

- Tailwind/Radix/Zustand 等业务 UI 依赖未在本任务安装，按 T-029/T-030 接入。
- 角色头像已复制到 `apps/web/public/assets/avatar/`（重复的根目录 `web/assets/avatar/` 已在 2026-11-26 目录整理中移除）。

## 功能测试复验（2026-11-26）

- API：启动 `apps/api/dist/server.js`，`GET /api/v1/health` 返回 `{"ok":true,"version":"0.1.0"}`。
- Web：`npx playwright test` 再次通过（1/1，本机 Chrome）。
- 构建产物：新增 `npm run verify:dist`，实际 import 四个 dist 入口通过。
- 发现并修复构建产物 ESM 相对导入缺少扩展名问题（FT-20261126-01），详见[功能测试报告](../functional-test-20261126.md)。
