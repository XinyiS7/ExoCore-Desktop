# Update Log

---

## 2026-06-04 — 共享 Profile + 字体设置：三模块统一身份 & 字体系统

**署名：** Claude / Alicia — 2026-06-04

### 完成项

#### exo-shared 共享层（`packages/shared/src/`）
- **`profile.js`** — localStorage 读写工具函数：`getUserAvatar` / `setUserAvatar` / `getUserNick` / `setUserNick` / `getAgentAvatar` / `setAgentAvatar` / `getAllAgentAvatars`，支持 DiceBear 在线头像作为 fallback，dispatch StorageEvent 跨标签同步
- **`hooks/useProfile.js`** — 统一用户画像 React hook：`{ userAvatar, userNick, agentAvatars, updateAvatar, updateNick, updateAgentAvatar, refresh }`，监听 `storage` 事件实现跨标签实时同步
- **`hooks/useFont.js`** — 字体偏好 hook：`{ fontPreference, setFont, availableFonts }`，注入 `--font-body` / `--font-nav` / `--font-code` 三个 CSS 自定义属性到 `:root`
- **`utils/avatar.js`** — 图片缩放工具 `resizeAndStoreAvatar(file, key, callback)`：Canvas 缩放至 200×200 → JPEG dataURL → localStorage
- **`styles/fonts.css`** — @font-face 声明三种字体：Sarasa Gothic Mono（自托管 WOFF2，~8MB/weight）、LXGW WenKai 霞鹜文楷（fontsource CDN）、Maple Mono（fontsource CDN，已有依赖）

#### 字体方案
| 角色 | 字体 | 用途 |
|------|------|------|
| `--font-body` | Sarasa Gothic Mono（默认）/ 霞鹜文楷 / Maple Mono · 三选一 | 正文、卡片、聊天消息 |
| `--font-nav` | 霞鹜文楷 LXGW WenKai（固定）| 导航栏、按钮、标签、设置面板 |
| `--font-code` | Maple Mono（固定）| Markdown 代码块、终端输出 |

- 字体偏好存储于 `localStorage: exo_font_preference`，默认 `"sarasa"`
- `useFont()` 在组件挂载时和切换时注入 CSS 变量，跨标签同步
- 三个模块各自 `tailwind.config.js` 的 `fontFamily.sans` 改为 `var(--font-body)`，`fontFamily.mono` 改为 `var(--font-code)`

#### chat-core Settings → Appearance（`/settings/appearance`）
- **`AppearancePanel.jsx`** — 三选一字体选择器（Radio 风格按钮 + 预览卡片），调用 `useFont()` hook
- **`SettingsView.jsx`** — 新增 Appearance 导航项（Palette 图标），路由到 `/settings/appearance`
- 字体预览卡片实时展示三种字体栈的渲染效果（正文/导航/代码）

#### UserProfile / AgentProfile 重构
- **`UserProfile.jsx`** — 改用 `useProfile()` hook 管理头像和昵称状态，移除直接的 `localStorage` 读写和自定义事件派发；头像裁剪回调调用 `setUserAvatar()` + `refresh()`
- **`AgentProfile.jsx`** — 改用 `useProfile()` hook 读取 `agentAvatars`，头像裁剪回调调用 `setAgentAvatar()` + `refresh()`；移除旧的 `getAgentAvatarUrl` 依赖
- **`chat-core/src/utils/avatar.js`** — 重导出到 `exo-shared`，保持向后兼容的 import 路径

#### chronicle
- **`App.jsx`** — 新增桌面端顶部栏（`hidden md:flex`）：左侧 Chronicle 标识，右侧用户昵称 + 头像；调用 `useProfile()` + `useFont()`
- **`index.css`** — 导入 `exo-shared/styles/fonts.css`，body 字体改为 `var(--font-body)`
- **`tailwind.config.js`** — `fontFamily` 改为 CSS 变量驱动

#### council
- **`App.jsx`** — 右上角固定显示用户昵称 + 头像（`opacity-60` 低调展示）；调用 `useProfile()` + `useFont()`
- **`index.css`** — 导入 fonts.css + body 使用 `var(--font-body)`
- **`tailwind.config.js`** — 新增 `fontFamily` CSS 变量配置

### 关键设计决策
- **编辑分散，数据统一** — 用户头像/昵称在 UserProfile 页面编辑，Agent 头像在 AgentProfile 编辑，字体在 Settings → Appearance 编辑；所有数据通过 `exo-shared` 的 `useProfile()` / `useFont()` hook 统一读写，三个模块共用一个 localStorage 数据源
- **字体分层固定，仅 body 可选** — 导航字体（霞鹜文楷）和代码字体（Maple Mono）由系统固定，用户仅在 Settings 中选择正文字体；这避免了过度配置，同时保证导航和代码块的一致可读性
- **Sarasa Gothic Mono 自托管** — 无 fontsource 包，从 `@fontpkg/sarasa-mono-sc` npm 下载 TTF → fonttools 转换为 WOFF2（regular 8.3MB + bold 8.6MB），放在 `packages/shared/src/assets/fonts/`，Vite 生产构建时自动优化
- **localStorage only，暂无后端** — 本阶段不引入 Django 模型，profile 和 font 数据纯前端存储；后续可通过 `exo-shared` hook 封装层透明切换到后端 API

### 文件清单
| 文件 | 操作 | 说明 |
|------|------|------|
| `packages/shared/src/profile.js` | 新建 | localStorage 读写工具 |
| `packages/shared/src/hooks/useProfile.js` | 新建 | 统一身份 hook |
| `packages/shared/src/hooks/useFont.js` | 新建 | 字体偏好 hook + CSS 变量 |
| `packages/shared/src/utils/avatar.js` | 新建 | 图片缩放工具 |
| `packages/shared/src/styles/fonts.css` | 新建 | @font-face 声明 |
| `packages/shared/src/assets/fonts/` | 新建 | Sarasa WOFF2 字体文件 |
| `packages/shared/src/index.js` | 编辑 | 导出新模块 |
| `packages/shared/package.json` | 编辑 | exports 映射 |
| `packages/chat-core/src/components/settings/AppearancePanel.jsx` | 新建 | 字体选择器 UI |
| `packages/chat-core/src/views/SettingsView.jsx` | 编辑 | 新增 Appearance 导航 |
| `packages/chat-core/src/views/UserProfile.jsx` | 编辑 | 改用 useProfile |
| `packages/chat-core/src/views/AgentProfile.jsx` | 编辑 | 改用 useProfile |
| `packages/chat-core/src/utils/avatar.js` | 编辑 | 重导出到 shared |
| `packages/chat-core/src/App.jsx` | 编辑 | 接入 useFont |
| `packages/chat-core/src/index.css` | 编辑 | CSS 字体变量 |
| `packages/chat-core/tailwind.config.js` | 编辑 | fontFamily 改 CSS 变量 |
| `packages/chronicle/src/App.jsx` | 编辑 | 顶部栏 + useProfile + useFont |
| `packages/chronicle/src/index.css` | 编辑 | CSS 字体变量 |
| `packages/chronicle/tailwind.config.js` | 编辑 | fontFamily 改 CSS 变量 |
| `packages/council/src/App.jsx` | 编辑 | 角落身份 + useFont |
| `packages/council/src/index.css` | 编辑 | CSS 字体变量 |
| `packages/council/tailwind.config.js` | 编辑 | 新增 fontFamily |
| `package.json` | 编辑 | 新增 `@fontsource/lxgw-wenkai` 依赖 |

### 待办
- [ ] 后端 Django UserProfile 模型 + API（头像/昵称持久化、跨设备同步）
- [ ] Appearance 面板扩展（主题色/暗黑模式切换等）
- [ ] 自定义字体上传（用户自己的 WOFF2）

---

## 2026-06-03 — Web Push 通知：Service Worker + 前端订阅 + 后端 API

**署名：** Claude (Frontend) / Claude (Backend) / Alicia — 2026-06-03

### 完成项

#### Service Worker 层（三个包 `public/push-notification.js`）
- **push 事件监听** — 接收 JSON payload，解析 title/body/icon/actions/vibrate 等字段，调用 `self.registration.showNotification()` 弹出系统通知
- **notificationclick 事件** — 点击通知 → 聚焦已有窗口或打开新标签页，支持 `data.url` 自定义跳转
- **pushsubscriptionchange 事件** — 订阅过期/刷新时自动重订阅并上报后端
- **降级处理** — JSON 解析失败时 fallback 为纯文本通知

#### Vite 配置（三个包 `vite.config.js`）
- Workbox `importScripts: ['/push-notification.js']` — 生成的 SW 自动加载 push 处理脚本

#### 前端订阅工具（`packages/shared/src/endpoints/push.js`）
- `isPushSupported()` — 浏览器能力检测（serviceWorker + PushManager + Notification）
- `getCurrentSubscription()` / `getNotificationPermission()` — 状态查询
- `requestNotificationPermission()` — 请求用户授权
- `subscribeToPush()` — 完整订阅流程：请求权限 → 等待 SW ready → `pushManager.subscribe()` → POST 凭证到后端
- `unsubscribeFromPush()` — 取消订阅 + 通知后端清理
- `usePushSubscription()` — React hook：`{ isSubscribed, isLoading, permission, subscribe, unsubscribe }`

#### Shared 包导出
- `packages/shared/src/index.js` 新增 `pushApi` 命名空间导出

#### 后端 API（Django — 隔壁 Claude 实现）
- `POST /api/push/subscribe/` — 接收 `{ subscription: { endpoint, keys: { p256dh, auth } } }` → upsert 存储 → 201
- `POST /api/push/unsubscribe/` — 接收 `{ endpoint }` → 停用/删除订阅 → 204（幂等）
- `send_physical_notification(title, body)` — G045 工具，通过 VAPID 私钥 + pywebpush 签发 push 消息 → FCM/Mozilla → 浏览器弹窗

### 关键设计决策
- **VAPID 密钥对** — 公钥硬编码在前端和 SW 中用于订阅，私钥仅在后端控制台使用，前端永远不接触私钥
- **订阅凭证存储** — 按 endpoint 去重（upsert），同一浏览器重复订阅不报错
- **SW 脚本独立于 Workbox** — `push-notification.js` 通过 `importScripts` 注入，与 Workbox 预缓存逻辑解耦
- **每个包独立 SW** — 三个端口各自维护自己的 service worker 和 push subscription，互不干扰
- **后端工具放在 Django 侧** — 不在 core app 内，由后端 Claude 独立设计 model 位置

### 待办
- [x] Settings 页通知开关 UI（调用 `usePushSubscription` hook）— 2026-06-03 完成

### 缺陷修复（2026-06-03）

#### `push.js` — `body` 预序列化导致 Content-Type 缺失
- **问题：** `subscribeToPush()` 和 `unsubscribeFromPush()` 将 body 提前 `JSON.stringify()` 为字符串传入 `apiFetch`。`apiFetch` 只在 `typeof body === 'object'` 时自动设置 `Content-Type: application/json`，传入字符串时跳过 → POST 携带 `text/plain` → Django DRF 无法解析 → 400/415
- **症状：** 浏览器端 `pushManager.subscribe()` 成功，UI 显示「已订阅」；但 POST 到 `/api/push/subscribe/` 时报错被 catch 吞掉，数据库无记录（count=0）
- **修复：** 将 `body: JSON.stringify({...})` 改为 `body: {...}`，由 `apiFetch` 负责序列化和设置 Content-Type
- **CSRF 验证：** 确认 `CSRF_TRUSTED_ORIGINS` 已包含 `localhost:5173` / `127.0.0.1:5173` / `192.168.178.25:5173`，无 CSRF 阻断
- **后端端点验证：** `curl -X POST http://127.0.0.1:8000/api/push/subscribe/` 返回 201，端点正常
- **✅ 端到端验证通过：** 手机订阅 → 数据库入库 → `send_physical_notification` → FCM → 手机弹窗成功
- **每设备独立订阅：** 手机和 PC 各需点一次「启用通知」，各自生成独立 FCM endpoint，后端遍历全部 active 订阅推送到所有设备

---

## 2026-06-03 — Key Management：设置页 API Key 管理 + ChatArea 会话 Key 选择器

**署名：** Claude / Alicia — 2026-06-03

### 完成项

#### Settings → Key Manage（`/settings/keys`）
- **A 布局左导航** — `SettingsView.jsx` 重写：左侧垂直导航（Key Manage 激活 / Routine Manage 灰色占位），右侧 `<Outlet />` 嵌套路由
- **B 布局平台 Tab** — `KeyManagePanel.jsx`：从 model registry 动态获取平台（Gemini / DeepSeek），顶部切换 Tab
- **RoleSlot 组件** — 每个平台下 4 个独立角色槽位：System Default（必填）/ Session Default / Sub-agent Default / Background Default（选填，回退到 system）
- **独立保存** — 每个槽位独立保存按钮，保存前前端预检（alias + key 双非空才放行）
- **Key 输入即打码** — 粘贴明文 key 后立即显示为 `...last4`，前端不持久化 key 真实值
- **CRUD 完整闭环** — 新建（POST apikeys → PUT key-map → 双 200 成功）/ 改 alias（PATCH）/ 覆盖 key（PUT overwrite）/ 级联删除（DELETE）

#### Shared API 层（`exo-shared`）
- 6 个新端点封装：`listApiKeys` / `createApiKey` / `updateApiKeyAlias` / `overwriteApiKey` / `deleteApiKey` / `updateKeyMap`
- 新增 hook：`useApiKeys(platform)` — 按平台获取 key 列表

#### ChatArea 控制面板扩展
- **ControlsDrawer** — 替代原来狭窄的 `controlsExpanded` 行，展开为三行抽屉面板
- **Key Alias 选择器** — 根据当前模型自动匹配平台，下拉框列出该平台所有 alias，默认选中 key_map 的 session/system 默认值
- **localStorage 持久化** — `exo_session_key_${sessionId}` 存 alias，刷新/关闭不丢失
- **发送时附带** — 每次 POST 消息自动带 `api_key_alias` 字段
- **颜色方案行** — 灰色禁用占位，后续实现

#### API 端点（后端）
- `§5.3` CRUD `/api/core/apikeys/` — 9 个端点各司其职（列表/新建/改别名/覆盖key/级联删除/角色分配）
- `§5.4` PUT `/api/core/config/key-map/` — 按平台+角色分配 key（值可以是 id 或 alias）

#### 清理
- 删除旧 `SettingsPanel.jsx`（无引用）
- 旧 `SettingsView.jsx` 的 Profile/Avatar 内容已移除（User 页面独立管理）

### 关键设计决策
- **前端不存 key 真实值** — 每次 GET 只拿到 `{id, alias, platform, last_four}`，PUT 时才传全文，传完即弃
- **Settings 用嵌套路由** — `/settings` 作为 layout route（左导航），`/settings/keys` 和 `/settings/routine` 作为子路由
- **ChatArea key 选择器读 key_map** — 不硬编码平台，跟随当前 model 动态切换

---

## 2026-06-01 — V3 前端重构第一轮：Chronicle 三Tab、Chat 无侧边栏、统一 Settings

**署名：** Claude / Alicia — 2026-06-01

### 完成项

#### Chronicle（packages/chronicle）
- 三Tab 底部导航：Feed / Tasks / Calendar
- **Feed** — 推文发布框 + 时间线浏览 + 回复功能，调用 `tweetsApi`
- **Tasks** — 任务 CRUD（创建/编辑/完成/挂起/恢复/删除）+ MiniCalendar 侧边栏 + 日期筛选
- **Calendar** — 月历组件 + 选中日期任务列表
- `tailwind.config.js` 添加 `exo-*` 兼容色板（映射到 chron 暖纸色主题）

#### Chat-Core（packages/chat-core）
- **移除侧边栏** — 改为顶部导航栏：Home | Agents | Projects | Settings | [头像] [X]
- Dashboard 首页保留：搜索会话 + 最近会话 + Agent Hub/Project 快捷入口 + 日历组件
- **关闭按钮** — 点 X 不退出，发送隐藏事件（Tauri 环境中）
- **Chat 占位** — 会话界面留空，标注"复杂组件需要独立 session"
- **移动端** — 汉堡菜单右侧滑出导航
- `tailwind.config.js` 保留 `exo-*` 别名（V2 组件兼容）

#### Settings（packages/chat-core/src/views/SettingsView.jsx）
- 头像上传 — 本地文件 → base64 → localStorage
- 昵称修改 — 输入框 + 保存
- 5 个占位板块：Notifications / Appearance / API Keys / Storage / Integrations（标注 Coming soon）

#### Logger（packages/chat-core/public/logger.html）
- 独立日志查看页面，毫秒时间戳 + 级别着色
- 支持 ALL / ERROR / WARN / INFO 过滤
- 暂停/继续 + 清空
- Tauri 命令：`push_log(level, message)` / `get_recent_logs` / `register_error_prefixes`

#### Tauri 壳（tauri/）— 部分可用，存在 Windows 下 libuv 崩溃问题
- 托盘菜单：Chat / Chronicle / Council / Settings / Logger / Exit
- 关闭窗口 → 隐藏（不退出）
- Council 惰性启动（点托盘菜单项时才 spawn Vite）
- 托盘 badge 命令接口已预留
- `dev-servers.js` — 后台静默启动 Vite，无终端窗口
- **已知问题：** Windows 上 `detached` 子进程 + Node event loop 清理导致 libuv assertion crash

### 架构决策变更

**原方向：** Tauri 桌面壳统一管理三个 SPA 窗口 + 系统托盘
**新方向：** 放弃 Tauri 包装，三个前端各自 `dev`/`build` 独立运行，Nginx 反代到 Django :8000，最终 Docker 化

三个模块不变：
| 包 | 端口 | 用途 |
|---|---|---|
| chat-core | 5173 | Agent 会话、项目管理、设置、用户 |
| chronicle | 5174 | Feed/推文 + Tasks + Calendar |
| council | 5175 | 多 Agent 协作（V3.1 推迟） |

### 待办

- [ ] Chat 会话核心组件（ChatArea、流式响应、上下文缓存等）— 独立 session
- [ ] Nginx 配置（三前端 + Django 后端统一入口）
- [ ] Docker Compose（chat + chronicle + council + nginx + django）
- [ ] Django 后端对接（异常日志前缀注册、通知推送）
- [ ] Council 功能实现（V3.1）
- [ ] 日历同步增强（7:00/14:00/21:00 + 天气天象 + brief 改版 — 见 calendar_sync.py 需求）
