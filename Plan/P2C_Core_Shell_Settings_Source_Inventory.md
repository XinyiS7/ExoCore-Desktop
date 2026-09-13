# P2C — Core Shell + Account + Settings 源码调查与清单 (Source Inventory)

> **文档类型：** 阶段前置只读调查清单 (Read-only Source Inventory)  
> **所属阶段：** Phase 2 — Workspaces + Core Shell + Notifications / 8.3 P2C  
> **权威依据：** `Plan/V4_Master_Implementation_Roadmap.md` §8.3 与 §16 Capability Ownership Matrix；`AGENTS.md`  
> **状态：** Complete / 供后续 P2C Detailed Plan 起草参考  
> **日期：** 2026-09-13  
> **执行者：** Alaric (阿莱里克)  

---

## 1. 调查方法与检索依据 (Search Methodology & Commands)

本次调查严格遵守只读侦察授权，未执行任何代码修改、测试修改、Git 暂存或提交，未向其他 pane 发送交互消息，完全保留现有工作区所有未提交修改。

### 1.1 检索范围与命令记录

1. **Git 工作区状态基线保护**：
   - 命令：`git status --porcelain`
   - 确认工作区现有在途变更文件（须严格字节级保留）：
     - `DevelopLog/DebugLog.md`
     - `Plan/Update_log.md`
     - `Plan/V4_Master_Implementation_Roadmap.md`
     - `packages/chat-core/src/main.jsx`
     - `Plan/spec/2026-09-12-message-tts-render-contract-handoff.md`
2. **Roadmap 与权威约束检索**：
   - 目标文件：`Plan/V4_Master_Implementation_Roadmap.md`
   - 审查范围：§8.3 P2C (L303-309)、§16 Capability Ownership Matrix (L661-704)、§8.4 P2D 边界 (L310-340)、§4.2–4.3 通用 Gate (L130-153)。
3. **V4 当前源码边界扫描**：
   - 目标目录：`packages/app/src/`
   - 重点审查：
     - Shell 与导航：`src/shell/AppShell.tsx`、`src/shell/PrimaryNavigation.tsx`、`src/shell/navigation.ts`、`src/styles/shell.css`、`src/styles/base.css`。
     - 路由配置：`src/app/router.tsx`、`src/app/AppProviders.tsx`、`src/main.tsx`、`index.html`。
     - 既有 workspace 顶栏与动作：`src/features/chat/ChatHomePage.tsx`、`src/features/chat/ConversationPage.tsx`、`src/features/agents/AgentHubPage.tsx`、`src/features/agents/AgentProfilePage.tsx`、`src/features/projects/ProjectHubPage.tsx`、`src/features/projects/ProjectDetailPage.tsx`。
4. **V3 既有实现与契约扫描**：
   - 目标目录：`packages/chat-core/src/` 与 `packages/shared/src/`
   - 重点审查：
     - V3 路由与外壳：`packages/chat-core/src/App.jsx`、`DesktopSidebar.jsx`、`MobileHeader.jsx`、`MobileBottomBar.jsx`。
     - 用户资料页：`packages/chat-core/src/views/UserProfile.jsx`、`hooks/useUserPreset.js`、`components/modals/AvatarCropModal.jsx`、`components/modals/EditPresetModal.jsx`。
     - 设置中心与面板：`packages/chat-core/src/views/SettingsView.jsx`、`KeyManagePanel.jsx`、`KeyPoolSection.jsx`、`McpManagePanel.jsx`、`ModelAssignPanel.jsx`、`NotificationsPanel.jsx`、`AppearancePanel.jsx`、`RoutinePanel.jsx`、`MemoryConsole.jsx`。
     - 共享 API 与 Hook：`packages/shared/src/profile.js`、`endpoints/config.js`、`endpoints/mcp.js`、`endpoints/push.js`、`endpoints/telemetry.js`、`hooks/useFont.js`、`hooks/useTheme.js`。
5. **后端真实契约与数据模型验证**：
   - 目标文件：`ReactSheet.md` 与只读检查 `../ExoCore/`（`agents/views.py`、`core/views.py`、`telemetry/views.py`、`telemetry/services.py`、`push/views.py`）。

---

## 2. V4 当前外壳、路由与导航缝隙清单 (V4 Shell & Navigation Seams)

### 2.1 路由结构 (`packages/app/src/app/router.tsx`)

- **源码位置**：[`packages/app/src/app/router.tsx:16-40`](file:///D:/Alicia/ExoCore_Project/ExoCore-Desktop/packages/app/src/app/router.tsx#L16-L40)
- **当前定义**：
  ```tsx
  { index: true, element: <ChatHomePage /> },
  { path: 'chat', element: <Navigate to="/" replace /> },
  { path: 'chat/:conversationId', element: <ConversationPage /> },
  { path: 'agents', element: <AgentHubPage /> },
  { path: 'agents/:presetId', element: <AgentProfilePage /> },
  { path: 'projects', element: <ProjectHubPage /> },
  { path: 'projects/:projectId', element: <ProjectDetailPage /> },
  { path: '*', element: <NotFoundPage /> },
  ```
- **关键缝隙**：
  1. 完全缺少 Account / Profile 路由（如 `/account` 或兼容 V3 的 `/user`）。
  2. 完全缺少 Settings 路由树（如 `/settings` 及其子路径 `/settings/keys`、`/settings/mcp` 等）。
  3. 路由基础路径由 `BASENAME = import.meta.env.BASE_URL.replace(/\/$/, '')` 驱动（生产为 `/app`），新路由必须与该前缀天然兼容。

### 2.2 响应式外壳与底栏判定 (`packages/app/src/shell/AppShell.tsx`)

- **源码位置**：[`packages/app/src/shell/AppShell.tsx:4-45`](file:///D:/Alicia/ExoCore_Project/ExoCore-Desktop/packages/app/src/shell/AppShell.tsx#L4-L45)
- **底栏隐藏判定逻辑**：
  ```tsx
  const DETAIL_PATH = /^\/chat\/\d+$|^\/agents\/[1-9]\d*$|^\/projects\/[1-9]\d*$/;
  ```
  - `isDetail = DETAIL_PATH.test(pathname)`：
    - 若为 `true`：`app-main` 不追加 `--bb` 偏移（`app-main` 独占全高），移动端完全隐藏 `app-bottombar`（L35, L39-43）。
    - 若为 `false`：`app-main` 带有 `app-main--bb`（底部预留 `--v4-bb-offset: 65px`），移动端渲染 `app-bottombar`。
- **关键缝隙**：
  - Account 页面与 Settings 页面落位后，移动端是否应判定为 `isDetail`？
    - 若 Settings 采用二级独立导航/全屏管理，留在底栏会被 65px 挤占空间；若视为非 detail，则在移动端受底栏遮挡。需要明确其在 `DETAIL_PATH` 或外壳模式下的布局策略。

### 2.3 一级导航与 More 菜单 (`packages/app/src/shell/navigation.ts` & `PrimaryNavigation.tsx`)

- **主导航配置**：[`packages/app/src/shell/navigation.ts:20-33`](file:///D:/Alicia/ExoCore_Project/ExoCore-Desktop/packages/app/src/shell/navigation.ts#L20-L33)
  - 一级产品区域：`Chat` (enabled), `Groups` (disabled, P2), `River` (disabled, P3), `Library` (disabled, P4/P5)。
  - `isChatActive`（L27-33）：判定 `/`、`/chat/*`、`/agents/*`、`/projects/*` 处于 Chat 激活态。
  - **缝隙**：进入 `/account` 或 `/settings` 时，`isChatActive` 为 `false`，此时没有一级主导航高亮，符合“Settings 属低频系统管理，不占一级产品槽位”的产品定义。
- **More 菜单状态**：[`packages/app/src/shell/PrimaryNavigation.tsx:57-61, 83-120`](file:///D:/Alicia/ExoCore_Project/ExoCore-Desktop/packages/app/src/shell/PrimaryNavigation.tsx#L57-L61)
  - `MORE_ITEMS` 定义：
    ```ts
    const MORE_ITEMS: { label: string; icon: typeof User; phase: string }[] = [
      { label: '账号 / Profile', icon: User, phase: 'P2' },
      { label: '设置中心', icon: Settings, phase: 'P2' },
      { label: '通知', icon: Bell, phase: 'P2' },
    ];
    ```
  - 当前全部条目均带有 `disabled` 和 `app-phase-chip`（L104-111），点击无任何动作。
  - 头像按钮当前仅渲染静态 Lucide `<User size={18} />` 图标（L93），未接入任何用户真实头像。

### 2.4 移动端 More 菜单接入不对称性（重大源码事实）

- 在 Desktop 上，`MoreMenu` 位于侧边栏底部（[`AppShell.tsx:32`](file:///D:/Alicia/ExoCore_Project/ExoCore-Desktop/packages/app/src/shell/AppShell.tsx#L32)），全局常驻。
- 在 Mobile 上，侧边栏被 CSS 隐藏（`display: none`）。`MoreMenu` 作为顶部操作按钮被手动散落在各页面的 topbar：
  - `ChatHomePage.tsx:56`：`<MoreMenu className="app-more--top" />` （存在）
  - `ConversationPage.tsx:530`：`<MoreMenu className="app-more--top" />` （存在）
  - `AgentHubPage.tsx`：**缺失**
  - `AgentProfilePage.tsx`：**缺失**
  - `ProjectHubPage.tsx`：**缺失**
  - `ProjectDetailPage.tsx`：**缺失**
- **不可行后果**：在移动端，当用户浏览 Agent Hub、Agent Profile、Project Hub 或 Project Detail 时，由于顶栏没有 `MoreMenu`，用户无法打开 More 菜单，进而无法访问“账号 / Profile”与“设置中心”。P2C 必须解决该外壳级一致性问题。

### 2.5 跨页面文档标题 (Document Title) 完全空白

- **源码位置**：[`packages/app/index.html:8`](file:///D:/Alicia/ExoCore_Project/ExoCore-Desktop/packages/app/index.html#L8)
  ```html
  <title>ExoCore V4</title>
  ```
- **现状**：整个 `packages/app/src/` 中没有任何一处设置或监听 `document.title`。用户在切换会话、Agent 详情、项目详情或不同板块时，浏览器标签页标题始终为硬编码的 `ExoCore V4`。
- **Roadmap 约束**：§8.3 明确要求“跨页面标题、active navigation、mobile/desktop shell 与 direct-open 由同一业务实现拥有”。P2C 是此能力的正式宿主。

---

## 3. V3 既有 Account / Settings UI 与用户可观察行为全景 (Active V3 Baseline)

### 3.1 V3 路由与导航入口

- **路由注册**：[`packages/chat-core/src/App.jsx:258-268`](file:///D:/Alicia/ExoCore_Project/ExoCore-Desktop/packages/chat-core/src/App.jsx#L258-L268)
  - `/user` -> `UserProfile`
  - `/settings` -> 重定向至 `/settings/keys`，子路由包括：`keys`, `mcp`, `models`, `notifications`, `appearance`, `routine`, `memory`。
- **入口分布**：
  - Desktop 侧边栏（[`DesktopSidebar.jsx:158-213`](file:///D:/Alicia/ExoCore_Project/ExoCore-Desktop/packages/chat-core/src/components/layout/DesktopSidebar.jsx#L158-L213)）：
    - 竖排“设置”文字按钮 -> `navigate('/settings')`
    - 用户方形头像图标 -> `navigate('/user')`（悬停展示 `userNick`）
  - Dashboard 首页（[`Dashboard.jsx:149`](file:///D:/Alicia/ExoCore_Project/ExoCore-Desktop/packages/chat-core/src/views/Dashboard.jsx#L149)）：点击问候语中的昵称高亮跳转 `/user`。
  - Mobile 底栏（[`MobileBottomBar.jsx:53-59`](file:///D:/Alicia/ExoCore_Project/ExoCore-Desktop/packages/chat-core/src/components/layout/MobileBottomBar.jsx#L53-L59)）：底栏第 5 项为“设置”图标，直接跳转 `/settings`；未设独立 `/user` 图标。

### 3.2 V3 UserProfile (`packages/chat-core/src/views/UserProfile.jsx:1-743`)

用户个人资料页由五大可观察区域组成：

1. **用户身份解析 (Identity Resolution)**：
   - 依赖 [`useUserPreset.js:12-42`](file:///D:/Alicia/ExoCore_Project/ExoCore-Desktop/packages/chat-core/src/hooks/useUserPreset.js#L12-L42)：从 `AgentPreset` 列表中查找 `agent_type === 'user'` 的记录作为当前用户。
2. **头像上传与裁剪 (Avatar & Crop)**：
   - 读取：`getUserAvatar()`（来自 `exo-shared/profile`，优先读取 `localStorage['exo_user_avatar']`，回退至 Dicebear 默认头像）。
   - 编辑：点击头像触发隐藏 `<input type="file" accept="image/*">`，选择文件后唤起 `AvatarCropModal.jsx`（基于 Canvas 的拖拽/缩放裁剪模态框）。
   - 保存：生成 Base64 Data URL 并通过 `setUserAvatar(dataUrl)` 写入 `localStorage`，触发跨 Tab `StorageEvent`。
3. **行内基础字段编辑 (In-place Editable Fields)**：
   - `name`（用户名）：点击变为输入框，Enter 或失焦调用 `patchUser({ name: v })`。
   - `description`（个人签名）：点击变为输入框，Enter 或失焦调用 `patchUser({ description: v })`。
   - `default_model`（概念模型标签）：点击变为输入框，Enter 或失焦调用 `patchUser({ default_model: v })`（默认显示 'Human'）。
   - 提交状态：右上角呼吸动效提示 `saving...`，错误时展示红字 `saveError`。
4. **系统人设编辑 (System Prompt Crystal)**：
   - 展示：只读文本预览框（超出 200 字省略）。
   - 编辑：点击铅笔按钮唤起 `EditPresetModal.jsx`（`mode="system_prompt"`），全屏/大弹窗编辑 textarea，保存时向 `PATCH /api/agents/presets/<id>/` 提交 `{ system_prompt }`。
5. **记忆管理跳转按钮 (Manage Memory Action)**：
   - 居中按钮 `Manage Memory`，带 `<Activity size={14} />` 图标。
   - 动作：调用 `setView('agent_memory', { agentId: userId, agentName: user.name })`，跳转至 `/agent/:id/memory`。
6. **用量统计图表 (Usage Statistics)**：
   - 控制栏：
     - 平台切换器：全部 (all) / Gemini / DeepSeek。
     - 周期切换器：本周 (week, 7d) / 本月 (month, 30d)，附带前后翻页箭头 (`<` / `>`)。
   - 数据获取：`telemetryApi.getDailyUsage({ mode, from })` -> `GET /api/telemetry/usage/?mode=...&from=...`。
   - 图表呈现：使用 `recharts` 渲染三张平级折线图：
     - `Input Tokens` (输入 Tokens)
     - `Output Tokens` (输出 Tokens)
     - `Cached Tokens` (缓存命中 Tokens)
   - 汇总指示：图表下方展示各模型在当前周期的总 Tokens、会话数以及平均每会话消耗。

### 3.3 V3 SettingsView 与七大设置面板

外壳位于 [`packages/chat-core/src/views/SettingsView.jsx:1-146`](file:///D:/Alicia/ExoCore_Project/ExoCore-Desktop/packages/chat-core/src/views/SettingsView.jsx#L1-L146)，提供左侧导航列表（移动端为遮罩抽屉），右侧渲染子路由 `<Outlet />`。

| 面板名称 | 路由路径 | 对应组件 | 核心可观察行为 |
|---|---|---|---|
| **Key Manage** | `/settings/keys` | `KeyManagePanel.jsx` (L1-261) + `KeyPoolSection.jsx` (L1-351) | 顶部 Tab 切换“端点通道 (Endpoints)”与“密钥池 (API Keys)”。端点列表支持新增/编辑（唤起 `EndpointEditModal`）和删除；密钥池按平台展示，支持别名修改、脱敏覆写、新建和删除。 |
| **MCP & Drawers** | `/settings/mcp` | `McpManagePanel.jsx` (L1-219) + `McpCredentialPoolTab.jsx` + `McpAgentAccessTab.jsx` | 顶部 Tab 切换“凭证池”与“代理授权”。凭证池支持增删改查各 MCP 服务的认证 Key 与默认绑定；代理授权支持按 Preset 勾选各本地 Drawer 开关及绑定私有 MCP 凭证。 |
| **Model Assign** | `/settings/models` | `ModelAssignPanel.jsx` (L1-498) | 配置模型与端点映射：①主模型角色 (Main Roles) 列表管理（动态增减、模型与端点配对、影子模型配置）；②后台辅助角色（Sub-agent、Vision Helper、Grounding、Image Gen）严格一对一模型端点绑定。提供兼容端点自动推导与脏检查保存。 |
| **Notifications** | `/settings/notifications` | `NotificationsPanel.jsx` (L1-156) | 状态卡片展示系统权限（已授权/已拒绝/待授权）与订阅状态（检查中/已订阅/未订阅）；已订阅展示设备名称，未订阅提供设备名称输入框与“启用通知/关闭通知”切换按钮（此套订阅与权限交互在 V4 迁移中归属于 P2D，P2C 仅落位路由入口与诚实占位）。 |
| **Appearance** | `/settings/appearance` | `AppearancePanel.jsx` (L1-274) | 系统字体、消息字体、代码字体三路单选切换器；全局字体缩放 (80%–150%) 滑块；深色/浅色全局主题双态切换按钮；底部附带系统/消息/代码实时预览卡片。 |
| **Routine** | `/settings/routine` | `RoutinePanel.jsx` (L1-196) | 后台自检与深度整理 (Self Check & Deep Organize) 的参与 g045 Agent 多选列表与保存；下附只读“Schedule Preview”（显示活跃时间区间与深度整理周日时点）；“时间设置”按钮在 V3 为不可用的占位 stub。 |
| **Memory** | `/settings/memory` | `MemoryConsole.jsx` (L1-582) | 会话历史片段 (HistoryChunk) 审查与编辑控制台。按会话展开、查看 topic label/keywords/summary，标记 unresolved。 |

---

## 4. 前后端真实接口与数据契约对照 (API & Backend Contracts)

全部接口对照来自实测代码、`ReactSheet.md` 与只读 Django 视图。

### 4.1 用户与 Agent 预设接口

- **列表与查询**：`GET /api/agents/presets/`
  - 后端实现：[`ExoCore/agents/views.py:454-464`](file:///D:/Alicia/ExoCore_Project/ExoCore/agents/views.py#L454-L464) `AgentPresetViewSet`，已固定过滤 `is_visible=True`。
  - 数据结构：
    ```json
    [{
      "id": 1, "name": "Alicia", "description": "主助手",
      "agent_type": "g045", "default_model": "deepseek-v4-pro",
      "system_prompt": "...", "is_visible": true
    }]
    ```
  - 特殊判定：`agent_type === 'user'` 的单条预设即为当前用户资料事实来源（由 DB 初始化内置）。
- **修改预设**：`PATCH /api/agents/presets/<id>/`
  - 允许写入字段：`name` (string), `description` (string), `default_model` (string), `system_prompt` (string)。
  - 契约约束：`is_visible` 为只读；系统保留预设不允许修改 `agent_type`（[`serializers.py:35-41`](file:///D:/Alicia/ExoCore_Project/ExoCore/agents/serializers.py#L35-L41)）。
  - 禁止方法：`POST /api/agents/presets/` 与 `DELETE /api/agents/presets/<id>/` 返回 `405 Method Not Allowed`。

### 4.2 核心配置与通道端点接口

- **系统配置单例**：`GET /api/core/config/` 与 `PATCH /api/core/config/`
  - 契约参考：`ReactSheet.md` §3.1。
  - 响应字段包含：
    - 调度参数：`self_check_preset_ids` (`[int]`), `deep_org_preset_ids` (`[int]`)
    - 时间区间：`active_start` (`"HH:MM"`), `active_end` (`"HH:MM"`), `deep_org_weekday` (`0-6`), `deep_org_hour` (`0-23`)
    - 脱敏 Key：`gemini_api_key`, `deepseek_api_key`（带有 `****` 前缀）
  - 废弃与停用字段：`heartbeat_preset_ids`, `heartbeat_base_hours` 等已停用，不可再行读写。
- **端点通道 (Endpoints)**：
  - 契约参考：`ReactSheet.md` §3.5。
  - `GET /api/core/endpoints/`：列出所有通道端点。
  - `POST /api/core/endpoints/`：创建端点。仅需 4 字段：`name` (string), `provider` (string), `api_key_alias` (string|null), `enabled` (boolean)。
  - `PATCH /api/core/endpoints/<id>/`：更新端点上述 4 字段。
  - `DELETE /api/core/endpoints/<id>/`：注销删除端点。
- **API 密钥池 (ApiKeys)**：
  - 契约参考：`ReactSheet.md` §3.6。
  - `GET /api/core/apikeys/?platform=<name>`：查询密钥列表（返回值中密钥内容脱敏）。
  - `POST /api/core/apikeys/`：创建密钥，提交 `{ alias, platform, key_value }`。
  - `PATCH /api/core/apikeys/<alias>/`：重命名别名 `{ alias: newAlias }`。
  - `PUT /api/core/apikeys/<alias>/overwrite/`：覆写密钥明文 `{ key_value }`。
  - `DELETE /api/core/apikeys/<alias>/`：删除该别名密钥（级联清理关联配置）。
- **统一模型与端点目录**：`GET /api/core/model-catalog/`
  - 契约参考：`ReactSheet.md` §3.3。
  - 统一聚合返回 `{ models: [...], endpoints: [...], providers: [...], roles: { main: [...], support: {...} } }`。
- **角色配置绑定**：`PUT /api/core/config/roles/`
  - 契约参考：`ReactSheet.md` §3.7。
  - 提交整包角色搭配对象：`{ main: [{ model, default_endpoint, style_shadow, position }], support: { <role_key>: { model, default_endpoint } } }`。

### 4.3 抽屉与 MCP 凭证接口 (Drawers & MCP)

- 契约参考：`ReactSheet.md` 第十篇 (§10.1–10.6)。
- **Drawer**：
  - `GET /api/agents/drawers/`：系统注册的抽屉列表。
  - `GET /api/agents/presets/<id>/drawers/`：某预设的抽屉矩阵。
  - `PUT /api/agents/presets/<id>/drawers/<drawer_name>/`：提交 `{ enabled: boolean }` 启用或禁用。
- **MCP 凭证池**：
  - `GET /api/agents/mcp-credentials/?server_name=<name>`：凭证列表。
  - `POST /api/agents/mcp-credentials/`：新增凭证 `{ alias, server_name, credential_value }`。
  - `PATCH /api/agents/mcp-credentials/<alias>/` / `PUT .../overwrite/` / `DELETE .../`：别名改名、覆写、删除。
- **MCP 服务器与预设绑定**：
  - `GET /api/agents/mcp-servers/`：服务器目录与公共凭证绑定。
  - `PUT /api/agents/mcp-servers/<server_name>/credential/`：绑定公共凭证 `{ credential_alias }`。
  - `GET /api/agents/presets/<id>/mcp-credentials/`：获取预设专属绑定。
  - `PUT /api/agents/presets/<id>/mcp-credentials/<server_name>/`：提交 `{ mode: "inherit"|"custom"|"disabled", credential_alias }`。

### 4.4 用量统计接口 (Telemetry)

- **接口**：`GET /api/telemetry/usage/?mode=<week|month>&from=<YYYY-MM-DD>`
  - 后端实现：[`ExoCore/telemetry/views.py:29-41`](file:///D:/Alicia/ExoCore_Project/ExoCore/telemetry/views.py#L29-L41) 与 [`ExoCore/telemetry/services.py:272-315`](file:///D:/Alicia/ExoCore_Project/ExoCore/telemetry/services.py#L272-L315)。
  - 返回形状：
    ```json
    {
      "daily": [
        {
          "date": "09/13",
          "models": [
            {
              "model": "deepseek-v4-pro",
              "input_tokens": 1250,
              "output_tokens": 430,
              "cached_tokens": 800,
              "conversation_count": 4
            }
          ]
        }
      ],
      "from": "2026-09-07",
      "to": "2026-09-13",
      "is_current": true
    }
    ```
  - 状态：真实持久化运行接口，前端无需 mock。

### 4.5 推送订阅接口 (Web Push Subscription)

- **订阅持久化**：`POST /api/push/subscribe/`
  - 提交：`{ subscription: PushSubscriptionJSON, device_name: string }`。
- **退订**：`POST /api/push/unsubscribe/`
  - 提交：`{ endpoint: string }`。
- **所有权归属说明 (P2D Ownership Note)**：
  - 上述接口为 V3 活跃接口，但在 V4 阶段划分中，根据 Roadmap §8.3 与 §8.4，所有推送订阅持久化、退订、设备名绑定、PushManager 交互及 VAPID 签名相关调用均属于 **P2D** 建设范围；
  - **P2C 严禁调用上述任何 push API，不在前台发起订阅/退订请求，亦不管理服务端订阅生命周期**。

---

## 5. 持久化、错误处理与加载语义分析 (Persistence, Error & Loading Semantics)

### 5.1 服务端状态管理演进

- **V3 模式**：
  - 散落在各个组件的 `useState` + `useEffect`，结合 `appState.refreshKey` 粗粒度刷新或组件内 `fetchXxx()`。
  - 存在多处捕获失败后直接退回本地 `MOCK_CATALOG` / `MOCK_ENDPOINTS` 的做法（例如 `KeyManagePanel.jsx:36-41`、`ModelAssignPanel.jsx:70-73`），导致网络中断或后端未启动时伪造成功保存，掩盖真实契约故障。
- **V4 范式要求**：
  - 由 `@tanstack/react-query` 统一接管服务端状态（QueryKey 家族、`staleTime`、`retry: false` 用于关键写后刷新）。
  - 严格遵守 Roadmap §4.3 Exit Gate：“loading / empty / error / retry / permission-denied 等适用状态可见，禁止静默失败；API shape 与错误语义未被前端猜测、吞掉或改写”。
  - 必须彻底剔除 V3 的 fallback mock 逻辑。

### 5.2 客户端持久化契约 (localStorage)

| 键名 (localStorage Key) | 存储内容 | 监听与同步机制 | 归属与有效性 |
|---|---|---|---|
| `exo_user_avatar` | 用户头像 Base64 裁剪数据或外部 URL | `window.addEventListener('storage')` 跨 Tab 同步 | 活跃有效。`packages/shared/src/profile.js:2-18`。 |
| `exo_user_nick` | 用户备用昵称字符串 | 同步事件 | 辅助备用；用户真实展示名称优先以 `AgentPreset.name` 为准。 |
| `exo_push_device_name`| 推送设备名称 | `usePushSubscription` 挂载读取 | 活跃有效；在 V4 中其读写配置归属于 **P2D**，P2C 阶段不在设置入口提供设备名配置。 |
| `exo_font_system` | 系统字体键 (`sarasa` / `wenkai` / `maple`) | `useFont` hook 同步 | 依赖外观设置策略（见第 7 节分析）。 |
| `exo_font_message`| 消息字体键 | `useFont` hook 同步 | 同上。 |
| `exo_font_code` | 代码字体键 | `useFont` hook 同步 | 同上。 |
| `exo_font_scale` | 字体缩放比例数字 (80–150) | 写入 `document.documentElement.style` | 同上。 |
| `exo_theme` | 主题名称 (`dark` / `light`) | `useTheme` hook 同步 | **Migrate-by-default / 需全仓 Token 审计**：V3 现行有效偏好；虽然 V4 当前缺少浅色 Token，但缺失 Token 绝非退役既有用户偏好的正向证据。必须通过全仓 Token 与对比度回归支持，或取得 Alicia / Roadmap 明确退役批准方可 defer。 |

---

## 6. P2C 与 P2D 的通知职责严格隔离边界 (Notifications P2C vs P2D Boundary)

根据 Roadmap §8.3 与 §8.4 的严格规定，P2C 与 P2D 对通知的处理有着绝对的动静分工：

```text
┌────────────────────────────────────────────────────────────────────────┐
│ P2C Scope: 设置入口与外壳导引 (Setting Entry & Shell Link Only)        │
│                                                                        │
│  1. 路由就绪: /settings/notifications 路由注册在案                     │
│  2. 外壳导引: More 菜单中「通知」项解除 disabled，点击可直达通知设置页 │
│  3. 设置导航: 设置中心侧栏/二级导航呈现「Notifications」选项           │
│  4. 诚实占位: 渲染诚实、有界且明确的占位/禁用展示面 (bounded           │
│     placeholder surface)，明确说明通知设置与推送订阅将于 P2D 上线     │
│                                                                        │
│  ⛔ P2C 严禁行为 (Negative Invariants):                                │
│  - 严禁读取 Notification.permission 或 PushManager 订阅状态            │
│  - 严禁提供设备名称配置输入或写入 localStorage                          │
│  - 严禁调用 subscribe / unsubscribe 或使用任何 push API 接口          │
│  - 严禁承诺、设计或渲染权限/状态控制卡片                               │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ 严格隔离：禁止越界
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ P2D Scope: 订阅、到达、未读与点击运行时 (Subscription & Runtime Only)    │
│                                                                        │
│  1. 订阅管理与权限交互: 读取 Notification.permission、PushManager      │
│     订阅、设备名称配置、调用 POST /api/push/subscribe/ 与 unsubscribe    │
│  2. Service Worker push 监听与后台系统 Web Push 弹出                    │
│  3. 会话活动状态判断 (Exact active Conversation in-place reconcile)   │
│  4. 非当前会话的统一未读计数与 App 内在到达提示 (去除 V3 浮动卡片)       │
│  5. 各种消息生产者 (Sandro send_message / Live SSE) 到达统一管道       │
│  6. 通知点击激活/冷启动并定向导航至 canonical /app/chat/:conversationId│
│  7. 410 过期凭据重签、连接中断恢复、后端持久化健康状态校验              │
└────────────────────────────────────────────────────────────────────────┘
```

- **P2C 绝对不做的行为 (Hard Negative Invariants)**：
  - 不读取浏览器通知权限（`Notification.permission`）；
  - 不查询或注册 `PushManager` 订阅；
  - 不提供推送设备名称输入框或读写 `exo_push_device_name`；
  - 不调用 `POST /api/push/subscribe/` 或 `POST /api/push/unsubscribe/`；
  - 不渲染权限提示卡片、订阅状态卡片或订阅控制按钮；
  - 不挂载消息到达监听器；
  - 不引入浮动通知弹窗（V3 的 `NotificationPanel.jsx` 废弃）；
  - 不管理未读消息红点；
  - 不编写 Service Worker 消息接收处理逻辑；
  - 不处理通知点击跳转的逻辑。

---

## 7. 能力分类矩阵与证据 (Capabilities Classification)

基于源码审计、`ReactSheet.md` 与 Roadmap §8.3/§16 严格分类：

| 能力项 | 现状位置 | 分类 (Disposition) | 证据与判定依据 |
|---|---|---|---|
| **Core Shell MoreMenu 激活** | `packages/app/src/shell/PrimaryNavigation.tsx:57-120` | **Migrate** | Roadmap §8.3：“avatar / More、Account/Profile 与 Settings routes 形成唯一 V4 shell owner”。解除三个条目的 `disabled` 状态。 |
| **移动端 MoreMenu 入口补齐** | `AgentHubPage`, `AgentProfilePage`, `ProjectHubPage`, `ProjectDetailPage` | **Migrate** | 源码事实：当前这 4 个 L1/L2 页面在移动端顶栏遗漏了 `<MoreMenu className="app-more--top" />`，导致移动端用户无法唤起设置。 |
| **跨页面标题同步** | `packages/app/index.html` 静态标题 | **Migrate** | Roadmap §8.3：“跨页面标题、active navigation、mobile/desktop shell 与 direct-open 由同一业务实现拥有”。必须根据当前激活路由与实体动态设置 `document.title`。 |
| **用户资料 (Account/Profile)** | `packages/chat-core/src/views/UserProfile.jsx` | **Migrate** | Roadmap §16：“User/Profile shell entry -> Migrate -> P2C/C2”。后端 `PATCH /api/agents/presets/<id>/` 完全有效；头像裁剪与 `localStorage` 同步成熟。 |
| **用量统计 (Usage Statistics)** | `UserProfile.jsx:648-718` | **Migrate** | 后端 `GET /api/telemetry/usage/` 契约完整有效。展示每日输入/输出/缓存 Tokens。需确认 `recharts` 依赖策略。 |
| **设置中心容器 (Settings Shell)** | `packages/chat-core/src/views/SettingsView.jsx` | **Migrate** | 建立 V4 风格的 `/settings` 布局外壳，承载子面板，适配桌面侧栏与移动端视图。 |
| **端点与密钥 (Key Manage)** | `KeyManagePanel.jsx` + `KeyPoolSection.jsx` | **Migrate** | 对应 `ReactSheet.md` §3.5 与 §3.6，后端接口完全齐备，是日常使用的关键配置。 |
| **MCP 与抽屉 (MCP & Drawers)** | `McpManagePanel.jsx` | **Migrate** | 对应 `ReactSheet.md` 第十篇，后端 `agents/views.py` 与 `agentsApi`/`mcpApi` 完全可用。 |
| **模型角色分配 (Model Assign)** | `ModelAssignPanel.jsx` | **Migrate** | 对应 `ReactSheet.md` §3.3 与 §3.7，后端 `/api/core/config/roles/` 完全支持。 |
| **通知设置入口 (Notifications)** | `NotificationsPanel.jsx` | **Migrate Entry Only (P2D owns Setup & Runtime)** | Roadmap §8.3：“Notifications 设置入口在 P2C 落位，但其订阅、arrival、unread 与 click runtime 由 P2D 接管”。P2C 仅激活 More/nav 路由并渲染诚实有界的占位/禁用展示面（明确说明通知设置与推送订阅将于 P2D 交付）；**严禁**读取浏览器权限、PushManager 订阅、配置设备名或发起 subscribe/unsubscribe。完整的配置、状态卡片与运行时由 P2D 统一接管。 |
| **后台自检任务预设 (Routine)** | `RoutinePanel.jsx` | **Migrate (Partial)** | `self_check_preset_ids` 与 `deep_org_preset_ids` 的多选保存完全有效（`SystemConfig`）。 |
| **Routine 时间调度编辑** | `RoutinePanel.jsx:151, 175` | **Omit-Disabled** | **正面证据**：V3 界面中该按钮为无动作占位符，标注 `(时间设置接口待上线)`。Roadmap §8.3 严令“无有效后端契约的旧占位项继续 disabled/omitted，不借迁移重写 backend”。保持只读展示，不开发时间编辑器。 |
| **外观设置中的主题切换 (Light Theme)** | `AppearancePanel.jsx:183-218` | **Migrate-by-default (Current-valid Capability)** | **契约保留原则**：缺失 V4 浅色 Token 并非退役 V3 活跃深浅色偏好的正向证据（AGENTS.md 规定破坏性改动必须有正向证据）。作为 Settings 契约保留的一部分，主题切换默认为 Migrate。施工需执行 V4 全仓 Token 与硬编码 overlay 审计，并通过 320/390/1280 视口对比度回归；若评估后欲推迟至后续切片，必须取得 Alicia 或 Roadmap 的明确退役/延期授权。字体控制 (`useFont`) 维持 Migrate。 |
| **浮动通知中心卡片** | `chat-core/components/notifications/NotificationPanel.jsx` | **Omit-Disabled** | **正面证据**：该浮动气泡与抽屉在 V4 中被废弃，其功能由 P2D 规范的桌面/移动到达指示接管。 |
| **会话历史审查 (Memory / HistoryChunk)**| `MemoryConsole.jsx` | **Defer to P5** | **正面证据**：Roadmap §16 明确将 `MemoryPlasmid management` 与 `History exact lookup` 分配给 **P5 (Library shell)**，P2C 不应提前接管或复制该能力。 |
| **群聊 (GroupChat)** | `GroupchatList.jsx` 等 | **Defer to P2G** | Roadmap §8.5 规定 GroupChat 延后独立切片，不阻塞 C2。 |
| **Agent / Project 工作区** | `AgentHubPage`, `ProjectDetailPage` 等 | **Already-Owned** | 已在 P2A/P2B 验收完成并由 V4 拥有。 |
| **Canonical Chat 聊天链路** | `ConversationPage`, `MessageTimeline` 等 | **Already-Owned** | 已在统一 C1 验收并通过。 |

---

## 8. 可复用的视觉规范与组件原语 (Reusable Visual Patterns)

迁移不得带入 V3 的 Tailwind / Cinder 色彩类名，必须完全继承 V4 既有的设计语言：

### 8.1 基础设计 Token (`packages/app/src/styles/base.css`)

- **背景与面板**：`--v4-bg` (`#0a0a0c`), `--v4-panel` (`#101014`), `--v4-panel-2` (`#16161c`)
- **边框线**：`--v4-line` (`rgba(255, 255, 255, 0.09)`), `--v4-line-strong` (`rgba(255, 255, 255, 0.16)`)
- **文字层级**：`--v4-text` (`#e9e9ee`), `--v4-text-dim` (`#9a9aa6`), `--v4-text-mute` (`#6d6d78`)
- **品牌强调色**：`--v4-accent` (`#4f8cff`), `--v4-accent-soft` (`rgba(79, 140, 255, 0.14)`)
- **语义色**：`--v4-danger` (`#ff6b6b`), `--v4-warn` (`#e8b64c`)
- **圆角与间距**：`--v4-radius: 8px`, 移动端底栏高度 `--v4-bb-offset: 65px`

### 8.2 现有成熟 UI 模式

- **顶栏结构**：`.app-topbar` 与 `.app-topbar--detail`，左侧返回按钮 `.app-back-btn`，右侧动作组 `.app-topbar-actions`。
- **状态原语**：`packages/app/src/shared/AsyncState.tsx` 中的 `<LoadingState />`, `<ErrorState />`, `<EmptyState />`。
- **模态弹窗原语**：在 `ProjectFormDialog.tsx` 与 `ConversationDeleteConfirmDialog.tsx` 中建立的 `.app-dialog-backdrop` / `.app-dialog-card` / `.app-dialog-header` / `.app-dialog-body` / `.app-dialog-actions` 标准弹窗模式。
- **表单控件**：标准 input / textarea，聚焦边框为 `var(--v4-accent)`。
- **按钮样式**：`.app-btn`, `.app-btn-ghost`, `.app-btn-danger`, `.app-btn-sm`。

---

## 9. 风险点与文件重叠地图 (File-Overlap & Risk Map for Detailed Plan)

### 9.1 文件重叠与受控修改范围

在后续编写 Detailed Plan 与实施时，将触及以下现有核心文件：

1. **路由与外壳**：
   - `packages/app/src/app/router.tsx`：注入 `/account` 与 `/settings` 路由树。
   - `packages/app/src/shell/AppShell.tsx`：调整 `DETAIL_PATH` 正则以匹配 Account 和 Settings 详情视图。
   - `packages/app/src/shell/PrimaryNavigation.tsx`：移除 `MORE_ITEMS` 的 disabled 属性，绑定真实 Link 路由跳转；更新头像渲染（接入真实头像图片或回退图标）。
   - `packages/app/src/shell/navigation.ts`：明确导航项高亮状态逻辑。
2. **顶栏修复**：
   - `AgentHubPage.tsx`, `AgentProfilePage.tsx`, `ProjectHubPage.tsx`, `ProjectDetailPage.tsx`：为移动端顶栏补齐 `<MoreMenu className="app-more--top" />`，恢复外壳功能可达性。
3. **新增特性模块**：
   - `packages/app/src/features/account/`：创建用户资料与用量统计页面。
   - `packages/app/src/features/settings/`：创建设置中心外壳及各配置子面板组件。

### 9.2 关键风险点

1. **`recharts` 依赖风险**：
   - 当前 `packages/app/package.json` 中**没有**安装 `recharts`（仅 `packages/chat-core` 拥有）。
   - 若在 Account 用量统计中复刻 V3 的三路折线图，需在 `packages/app` 中引入 `recharts` 或采用轻量 SVG / 汇总卡片渲染。需在 Detailed Plan 中明确决策。
2. **移动端底栏显示/隐藏一致性**：
   - Settings 页面具有左侧导航（在移动端可能为抽屉或分步视图）。如果 Settings 页面在移动端展示底栏，可用高度将缩减；如果判定为 `DETAIL_PATH` 隐藏底栏，则必须提供清晰的顶栏返回按钮返回上一级或主页。
3. **P2C / P2D 职责越界风险 (Notification Boundary Risk)**：
   - Notifications 容易误引入权限检测、设备名配置、PushManager 订阅或 push API 调用。必须设立硬性隔离红线：P2C 仅激活 More/nav 路由并渲染诚实有界的占位/禁用展示面，严禁读取 `Notification.permission`、严禁调用 `pushApi` 或 `PushManager`，所有订阅设置、状态卡片与运行时均留待 P2D。
4. **主题切换与全仓 Token 审计风险 (Theme Contrast & Overlay Risk)**：
   - V3 存在活跃的深浅主题切换，按契约保留原则属于 Migrate-by-default。但 V4 `base.css` 目前仅硬编码了暗色体系（`--v4-bg: #0a0a0c`），存在大量局部硬编码样式与半透明 overlay。若在 P2C 迁移浅色主题，必须实施严格的 V4 全仓 Token/硬编码 overlay 审计并在 320px/390px/1280px 下进行可读性/对比度回归测试；若因工期或视觉演进需延后，必须取得 Alicia 明确批准，不可擅自按 Omit 处理。

---

## 10. 未决事实与客观约束 (Unresolved Facts Only)

以下仅记录源码和环境层面的真实未决事实，绝不凭空制造产品设计问题：

1. **依赖事实**：`packages/app/package.json` 缺少 `recharts` 依赖。若在 Account 页面完整渲染用量折线图，需要执行 `pnpm --filter exo-app add recharts`；若暂不引入大型图表库，需以等价表格/卡片展示当前周期数据。
2. **路径规范**：V3 历史路由为 `/user`；V4 MoreMenu 中的文本为 `账号 / Profile`。在 V4 中应以 `/account` 还是 `/user` 作为 canonical 路由（可保留另一路径为重定向）。
3. **外观主题全仓 Token 适配事实**：V3 拥有成熟的 `useTheme()`（持久化为 `exo_theme`），属于现行有效偏好。V4 当前 `base.css` 仅硬编码了深色变量，缺乏 `data-theme="light"` 对应的浅色 Token 映射。P2C 若完整承接深浅色切换，必须对当前所有 V4 组件（Chat、Agent、Project、Shell）执行硬编码 overlay 审计及 320/390/1280 对比度回归，否则需向 Alicia 呈报明确延期/退役决策。字体控制 (`useFont`) 亦需打通 V4 Token 映射。

---

## 11. 推荐的最小 P2C 切片方案 (Recommended Minimum P2C Slice)

为保证 P2C 能在不引入冗余复杂度的前提下平稳落地，建议后续 Detailed Plan 将 P2C 划分为高度内聚的最小可行切片：

### 切片 1：Shell 一致性与标题接管 (Shell, Title & Navigation Alignment)
- 建立全局文档标题钩子（`useDocumentTitle`），在各路由（Chat、Agent、Project、Account、Settings）切换时自动同步标签页标题。
- 补齐 Agent 和 Project 页面移动端顶栏缺失的 `MoreMenu`，消除移动端导航死角。
- 激活 More 菜单条目（账号、设置中心、通知），使其分别链接到 `/account`、`/settings`、`/settings/notifications`。
- 接入用户头像组件：读取 `localStorage['exo_user_avatar']`，有头像时渲染真实小头像，无头像时回退 `<User />` 图标。

### 切片 2：用户资料管理 (Account / Profile Slice)
- 建立 `/account` 路由与页面。
- 借助 TanStack Query 获取 `GET /api/agents/presets/`，提取 `agent_type === 'user'`。
- 支持用户名、签名、模型标签的行内编辑，保存至 `PATCH /api/agents/presets/<id>/`。
- 支持头像文件上传与本地裁剪保存（移植 Canvas 裁剪模态框）。
- 接入系统人设全屏/模态弹窗编辑。
- 接入 Telemetry 用量统计展示（调用 `telemetryApi.getDailyUsage`）。

### 切片 3：设置中心与有效管理面板 (Settings Center Slice)
- 建立 `/settings` 路由骨架，默认重定向至 `/settings/keys`。
- 实现设置管理面板：
  1. **Key Manage**：端点增删改查（弹窗） + API 密钥池增删改查。
  2. **MCP & Drawers**：MCP 凭证管理 + 本地 Drawer 授权切换。
  3. **Model Assign**：主模型列表排序/配置 + 辅助角色模型端点配对。
  4. **Routine**：后台自检与深度整理 g045 Agent 多选保存（时间设置保持只读禁用）。
  5. **Notifications (Entry Only)**：仅落位 `/settings/notifications` 路由与设置导航项，渲染诚实、有界的占位/禁用展示面（明确说明通知设置与推送订阅将于 P2D 阶段交付），不读取权限、不配置设备名、不调用任何 push API。
  6. **Appearance**：字体选择（System/Message/Code）与全局字号缩放（Migrate）；主题切换（深/浅色）在未获 Alicia 明确退役授权前属于 Migrate-by-default，需审计 V4 全仓 Token 映射并执行多视口 (320/390/1280) 对比度回归（若获得延期批准方可转为只读提示）。
- 明确将 `Memory` 面板排除出 P2C（递延至 P5 Library 阶段）。

---

*报告生成完毕。未进行任何生产代码修改或 git 变更，当前工作区保持完全纯净。*
