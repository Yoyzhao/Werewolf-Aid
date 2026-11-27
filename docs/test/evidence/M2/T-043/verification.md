# T-043 PWA 离线壳报告

- 日期：2026-11-27
- 任务：T-043（M2 / 5C）
- 基线：interaction-spec v1.2 §19.5；PRD P1-8 / AC-15；T-035 设计、T-024 Node 部署
- 结论：**完成**；manifest、Service Worker、静态资源预缓存、更新提示、离线冷启动与 iOS/微信降级提示已实现

## 1. 实现

| 文件 | 内容 |
| --- | --- |
| `apps/web/public/manifest.webmanifest` | 应用名称、`start_url`、standalone、主题色与 192/512/maskable 图标 |
| `apps/web/public/icons/*.png` | 由 favicon 渲染的 192、512 与 maskable 512 图标 |
| `apps/web/public/sw.js` | 安装预缓存、旧缓存清理、`clients.claim`、`SKIP_WAITING`；导航 network-first + 缓存兜底；静态资源 cache-first；跳过 `/api/`、`/ws` 与跨域请求 |
| `apps/web/scripts/generate-precache.mjs` | 构建后扫描 `dist` 生成 `precache.js`（资源清单 + 内容哈希版本），并向 `dist/sw.js` 写入版本注释 |
| `apps/web/package.json` | Web 构建追加预缓存生成步骤 |
| `apps/web/index.html` | manifest、apple-touch-icon 与 iOS Web App 元信息 |
| `apps/web/src/lib/pwa.ts` | 生产环境注册 SW、监听新 worker、`SKIP_WAITING` 后刷新、平台降级识别 |
| `apps/web/src/components/PwaBanners.tsx` | 更新、离线、安装与 iOS/微信提示；安装提示可关闭且不重复骚扰 |
| `apps/web/src/App.tsx` | 主持端与玩家端统一挂载 PWA 提示 |
| `scripts/verify-dist.mjs` | 构建产物增加 manifest / SW / precache 校验 |
| `playwright.config.ts` | 增加 4173 生产预览服务，供 PWA e2e 复用 |

## 2. 缓存与更新策略

- 预缓存：`/`、`/index.html`、manifest、图标、角色头像、构建后的 JS/CSS；不含 sourcemap、`sw.js`、`precache.js`。
- 不缓存：`/api/`（含 AI 中转）、`/ws`、跨域请求；WebSocket 不受 fetch 缓存影响。
- 导航：优先网络并更新 `/index.html` 缓存，断网时回退缓存；静态资源缓存优先。
- 更新：构建内容哈希变化时 `sw.js` 字节变化；新 worker `installed` 且已有 controller 时显示“有新版本，刷新后生效”；确认后 `SKIP_WAITING` + `controllerchange` 刷新，1.5s 超时兜底。
- 安装：Android Chrome 捕获 `beforeinstallprompt` 显示安装按钮；iOS/微信显示降级说明，关闭后写入本机标记。
- 离线：顶部/底部提示“离线模式 · 仅本机记录可用，AI 与联机暂不可用”；助手记录与笔记仍从 IndexedDB 读取。

## 3. 测试

| 用例 | 结果 |
| --- | --- |
| 平台识别：iOS、微信、桌面、已安装 | 通过（pwa 6/6） |
| 等待中 worker、新 worker 安装、首次安装不提示 | 通过 |
| 更新通知与 controllerchange 刷新；无 waiting 直接刷新 | 通过 |
| 生产注册 `/sw.js`、关闭开关不注册 | 通过 |
| 横幅：更新刷新、iOS 降级说明、离线事件、安装 prompt | 通过（PwaBanners 4/4） |
| e2e：SW 激活后离线冷启动，应用壳可开、助手身份与自由描述保留 | 通过 |
| e2e：manifest 可读取且 SW 已注册 | 通过 |
| e2e：修改 SW 产物触发新版本提示，点击刷新后页面恢复 | 通过 |

| 项 | 结果 |
| --- | --- |
| `npm test`（全量） | **338/338**（33 文件） |
| `npm run e2e`（全量） | **35/35** |
| lint / format:check / typecheck / build / verify:dist | 通过 |
| 首屏 JS | 206.36 kB gzip（低于 250 kB 预算） |
| 预缓存资源 | 16 项（版本 `8c2a1246e9db`） |

## 4. AC 对应

- **AC-15 / P1-8**：已访问并完成缓存后，离线冷启动可打开应用壳并读取助手记录；AI 与联机显示不可用提示。
- **P0 包体预算**：首屏 JS 206.36 kB gzip，未超过 250 kB。
- **更新**：在线检测到新 SW 后提示，确认刷新后生效。

## 5. 已知边界

- PWA 安装能力依赖浏览器；iOS 需 Safari 分享菜单，微信内可能不支持，已给出降级说明。
- 离线冷启动的前提是至少在线访问一次并完成 SW 安装；清理站点数据会同时清除缓存与本地记录。
- e2e 仅在 Chromium 验证；iOS/微信真机行为留待 T-046/发布前真机检查。
- 更新检测在页面打开时触发（注册后 `registration.update()`），长时间不刷新时按浏览器策略择机检查。
- 回归中为既有“投票进度刷新后可恢复”e2e 增加 IndexedDB 落盘等待，消除并发负载下的偶发失败；未改动产品代码。

## 6. 证据

- 代码：[sw.js](../../../../../apps/web/public/sw.js)、[generate-precache.mjs](../../../../../apps/web/scripts/generate-precache.mjs)、[pwa.ts](../../../../../apps/web/src/lib/pwa.ts)、[PwaBanners.tsx](../../../../../apps/web/src/components/PwaBanners.tsx)
- 测试：[pwa.test.ts](../../../../../apps/web/src/lib/pwa.test.ts)、[PwaBanners.test.tsx](../../../../../apps/web/src/components/PwaBanners.test.tsx)、[pwa.spec.ts](../../../../../tests/e2e/pwa.spec.ts)
- 截图：[offline-home-390.png](offline-home-390.png)、[offline-assistant-390.png](offline-assistant-390.png)、[update-banner-390.png](update-banner-390.png)
- 日志：[gates.log](../gates.log)、[unit-tests.log](../unit-tests.log)、[e2e.log](../e2e.log)、[build.log](../build.log)、[verify-dist.log](../verify-dist.log)
