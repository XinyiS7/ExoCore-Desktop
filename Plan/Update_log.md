# Update Log

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
