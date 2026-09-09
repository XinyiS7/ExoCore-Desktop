# ExoCore V4 — Phase 1D Source Scout & Capability Fact Reference (V3 / P1D)

> **Document Type:** Source Scout & Technical Fact Reference for P1D Planning
> **Target Audience:** Sol (Author of `Plan/V4_Phase_1D_Detailed_Plan.md`) & Engineering Team
> **Scout Author / Guard:** Alaric (圣武士与守誓者)
> **Status:** **COMPLETE — PLANNING INPUT READY**
> **Date:** 2026-09-07
> **Baseline Checkpoints:**
> - Desktop HEAD: `9a81831` (`feat(v4): complete P1C attachment & audio vertical slice checkpoint C1C`)
> - Backend HEAD / Contract: `29368bbf` / `21f2a8f7` (`ExoCore` Django)
> - Canonical Contract Source: `Plan/V4_Phase_0_Baseline/Canonical_API_Snapshot.json` & `ReactSheet.md` §1.2–1.4
> - Capability Ownership Baseline: `Plan/V4_Phase_0_Baseline/V3_Capability_Ownership.md` rows 26, 29, 30, 31, 32, 33, 34, 54

---

## 1. 阶段目标与边界定义 (Scope & Boundaries)

### 1.1 P1D 核心职责
Phase 1D 是 ExoCore V4 单 SPA 重构中 Chat 模块的第四个子阶段（Sub-gate C1D）。其核心使命是：**在已验收的 P1B 核心运行时与 P1C 附件/音频能力之上，补全会话级战术控制中枢（HUD / Controls）、环境氛围（Aura）、项目文件上下文访问（Project Files in Chat），并以通用 `AssistantRunTrace` 正式接管 Thinking 与 Tool 活动。**

根据 `Plan/V4_Master_Implementation_Roadmap.md` §7、§16 及 `Plan/V4_Phase_0_Baseline/V3_Capability_Ownership.md`，P1D 覆盖以下 7 项 Frozen Capabilities：
1. **`cache`** (Row 29)：上下文缓存（Context Cache）状态感知、剩余 TTL 倒计时、周期性轮询校验、本地快照状态、手动释放（`DELETE cache/`）、发送时缓存启用控制（`cache_enabled`）与跳过通知（`cache_skipped` toast）。
2. **`endpoint_model_thinking`** (Row 30)：会话级执行目标控制，包括模型选择（Model）、兼容端点匹配（Endpoint）、思考深度（`thinking_level`: `off|auto|low|medium|high|max`）、温度（`temperature`）及传输模式（`chatMode`: `sse|async`）；支持运行时 Telemetry 统计展示。
3. **`private_memory_toggle`** (Row 31)：会话级私有记忆检索与注入开关（`memory_injection_enabled`，仅对 `g045` Hypervisor Agent 开放）。
4. **`session_history_control`** (Row 32)：会话历史滑窗与上下文装配模式切换（`session_type`: `full` vs `lite`）。
5. **`aura_theme`** (Row 33)：会话现场能量场/氛围主题（Aurora 背景动态光波、OKLCH 色调微调与预设、AI 生成中呼吸律动）。
6. **`project_files_in_chat`** (Row 34)：会话现场的项目关联文件访问（右侧抽屉、工作目录树、文件点击快速插入 composer 的 `@[path]`、`@` 自动补全及发送时语法脱敏）。
7. **`tool_events_thinking` & `memory_search_toolcall`** (Rows 26 & 54)：通用 `AssistantRunTrace` 组件，负责承接与渲染助手消息的 Thinking 思考过程折叠面板与 Tool 调用运行轨迹；主动 `memory_search` 保持普通 ToolCall 语义。

### 1.2 严格边界守护 (Boundary Guard)
为确保 Sol 在编写 Detailed Plan 时不发生越界蔓延（Scope Creep），必须坚守以下法定边界：

| 范畴 | 归属阶段 | P1D 处置策略 | 规范依据 |
|---|---|---|---|
| **HUD 控制抽屉 / Cache / Model / Thinking / Aura / Project Files** | **P1D** | 完整实现并接入 V4 会话页 | Roadmap §7 P1D (Sub-gate C1D) |
| **`AssistantRunTrace` 通用外壳 (Thinking + Tool Events)** | **P1D** | 完整实现，作为 Assistant 运行轨迹标准容器 | Roadmap §7 P1D, River Spec §7.2 |
| **User Message 自动召回回执 (`UserRecallReceipt`)** | **P6** | **严禁包含**（回执专属于用户消息，在 P6 承接） | River Spec §7.1-7.2, B4 Spec §2.1 |
| **Recall Lab / 召回诊断与实验台** | **P6** | **严禁包含** | Roadmap §12 P6 |
| **完整 Agent / Project 工作区页面 (AgentHub / ProjectDetail)** | **P2** | **严禁包含**（P1D 仅消费已有 project_id 读取目录树与文件） | Roadmap §8 P2 (C2) |
| **GroupChat 多人会话** | **P2** | **严禁包含** | Roadmap §8 P2 (C2) |
| **River / BBS 时间线** | **P3** | **严禁包含** | Roadmap §9 P3 (C3) |
| **Library / Collection 藏品浏览器** | **P4** | **严禁包含** | Roadmap §10 P4 (C4) |
| **Memory 管理台 (Plasmid / Chunks / Keywords)** | **P5** | **严禁包含** | Roadmap §11 P5 (C5) |
| **Production Ownership** | **V3-Primary** | C1D 仅为施工 checkpoint，统一 C1 验收通过前 V3 始终持有生产权 | Roadmap §7 Sub-gate checkpoints |

---

## 2. V3 源码机械调查：逐项能力画像 (Capability Anatomy)

### 2.1 Capability 1: `cache` (Context Cache 控制与指示)
- **V3 源码 Owner**: `packages/chat-core/src/components/chat/ContextCacheIndicator.jsx` (335 lines)
  - 挂载位置：`ChatArea.jsx:1352`（Header 右侧指示器区域）。
- **状态来源 (State Source)**:
  - **远端真相 (Backend Truth)**：`GET /api/agents/conversations/<id>/cache/`。返回：
    `{ active: bool, remaining_seconds: int, expires_at: string, renewals: int, ttl_seconds: int, has_snapshot: bool, snapshot_cache_end_idx: int|null, platform: string }`。
  - **本地乐观缓存 (LocalStorage)**：
    - `exo_cache_<sessionId>`: 存储 `{ savedAt, platform, hasSnapshot, snapshotCacheEndIdx, expiresAt, renewals }`，供切会话时秒级恢复 UI，无需等待首屏 fetch。
    - `exo_cache_enabled_<sessionId>`: 会话级开关状态（默认 `'true'`）。
    - `exo_cache_<sessionId>_released`: 手动释放时间戳标记，防止读取过时快照。
  - **运行时计时器**:
    - `tickRef`: 1000ms 倒计时本地递减 `remainingSeconds`；每 30 步向 localStorage 回写一次。
    - `pollRef`: 30000ms 轮询服务端，校准最新缓存态。
    - `useImperativeHandle(ref, () => ({ refresh: () => fetchCache() }))`: 供父组件在 SSE 流终态（`done`）后触发校准。
- **关联 API 端点**:
  - `GET /api/agents/conversations/<id>/cache/`
  - `DELETE /api/agents/conversations/<id>/cache/` (204 成功 / 404 无缓存)
  - `POST /api/agents/conversations/<id>/cache/renew/` (服务端存在 `CacheRenewView:1633`，但 **V3 前端未调用**！)
  - `POST /api/agents/chat/<session_id>/` 请求体字段：`cache_enabled: bool`, `force_cache_rebuild: bool`
  - SSE 事件：`event: cache_skipped` (`{"reason": "platform_not_supported" | "remote_cache_unavailable"}`)
- **分类标签**:
  - 作用域：**Conversation-local**（所有状态均绑定 `sessionId`）。
  - 真相源：**Backend truth dependent**（远端真实持有 TTL 与平台 Cache 实例，前端 LocalStorage 仅为乐观展示层）。

### 2.2 Capability 2: `endpoint_model_thinking` (会话执行目标与思考配置)
- **V3 源码 Owner**:
  - 界面与表单：`packages/chat-core/src/components/chat/ControlsDrawer.jsx` (Lines 126–307)
  - 状态编排：`packages/chat-core/src/components/chat/ChatArea.jsx` (Lines 107–110, 167–177, 1507–1529)
- **状态来源 (State Source)**:
  - **模型目录 (Catalog - Global Truth)**：`GET /api/config/models/`，通过 `configApi.getModelCatalog()` 获取。包含 `models`、`endpoints`、`roles`。
  - **会话目标 (Session Target - In-Memory / Ephemeral)**：`{ model: string, endpoint: number | null }`。
    - 初始化：`resolveInitialSessionTarget(catalog, activePreset)`（`exo-shared` 工具函数）。
    - 切换模型：`changeTargetModel(catalog, sessionTarget, nextModel)`，自动匹配同模型首选已启用端点。
    - 切换端点：`getCompatibleEndpoints(catalog, sessionTarget.model)` 过滤候选端点。
    - **关键事实**：后端 `Conversation` 模型**不持久化**本次选择的 `model` 与 `endpoint`！它们纯粹作为每轮 `POST /api/agents/chat/<sid>/` 的请求体参数动态提交。
  - **思考深度 (Thinking Level - Persisted Truth)**：`Conversation.thinking_level` (`off|auto|low|medium|high|max`，默认 `auto`)。
    - 初始化：进入会话时由 `GET /api/agents/conversations/` 返回。
    - 修改时：通过 `updatePreference` 调用 `PATCH /api/agents/conversations/<id>/` 持久化，并同步至本轮 POST body。
  - **温度 (Temperature - Ephemeral in V3)**：
    - 前端提供 `1.0 | 1.3 | 1.8` 选择。
    - 虽然 `Conversation` 字段有 `temperature`，但后端更新序列化器不接受该字段写入；V3 发送至 POST chat 也会被忽略。
  - **传输模式 (Chat Mode - Global Preference)**：
    - `localStorage.getItem('exo_chat_mode') || 'sse'`。可选 `'sse' | 'async'`。
  - **Telemetry 遥测面板 (Runtime Telemetry)**：
    - 每轮 SSE 终态前通过 `event: telemetry` 收到：`{ platform, model_name, input_chars, output_chars, tool_calls, cached_input_chars }`。
    - 聚合到 `sessionTelemetryRef` 累计 `totalInput`, `totalOutput`, `totalCached`, `totalTools`, `requests`，并在 ControlsDrawer 内提供展开 Popover。
- **关联 API 端点**:
  - `GET /api/config/models/` (Model catalog)
  - `PATCH /api/agents/conversations/<id>/` (`{ thinking_level }`)
  - `POST /api/agents/chat/<id>/` (body: `model`, `endpoint`, `thinking_level`)
- **分类标签**:
  - `catalog`: **Global backend truth**
  - `sessionTarget` (model/endpoint): **Conversation-local in-memory** (per-turn dispatch)
  - `thinking_level`: **Conversation-local + backend truth** (persisted on Conversation)
  - `chatMode`: **Global local preference** (`exo_chat_mode`)
  - `telemetry`: **Conversation-local runtime overlay**

### 2.3 Capability 3: `private_memory_toggle` (私有记忆注入开关)
- **V3 源码 Owner**: `packages/chat-core/src/components/chat/ControlsDrawer.jsx` (Lines 272–307)
- **门禁条件 (Gating Rule)**:
  - 仅当 `isG045Type(activePreset?.agent_type)` 为真时（`isG045Session`）才向用户展示该 Toggle。普通 Standard Agent 会话完全不暴露此开关。
- **状态来源 (State Source)**:
  - 本地缓存：`localStorage.getItem('exo_mem_inject_' + sessionId) !== 'false'`（默认 `true`）。
  - 后端模型：`Conversation.memory_injection_enabled` (`BooleanField(null=True, blank=True, default=None)`，`null` 表示继承 preset 配置)。
- **关联 API 端点**:
  - `POST /api/agents/chat/<id>/` 发送请求体字段：`memory_injection_enabled: bool`。
  - `PATCH /api/agents/conversations/<id>/` 可写 `memory_injection_enabled`。
- **分类标签**:
  - 作用域：**Conversation-local**（绑定 `sessionId`）。
  - 条件：**Agent Preset Type Dependent**（严格限定 `g045`）。
  - 真相源：**Backend truth backed + local optimistic override**。

### 2.4 Capability 4: `session_history_control` (历史滑窗与装配模式)
- **V3 源码 Owner**: `packages/chat-core/src/components/chat/ChatArea.jsx`
  - 视觉控件：`SessionTypeToggle` (Lines 1345–1351 & 1736–1764)
- **状态值**: `'full'` vs `'lite'`（默认 `'lite'`）。
- **业务语义**:
  - `'lite'`：精简滑窗模式。后端上下文装配器利用 Summary 与近期消息截断，节约 Token 消耗。
  - `'full'`：完整历史模式。后端将当前会话的全量上下文载入 Context Window。
- **状态来源 (State Source)**:
  - 初始化：`GET /api/agents/conversations/` 中的 `current.session_type || 'lite'`。
  - 本地缓存：`localStorage.getItem('exo_session_type_' + activeSessionId) || 'lite'`。
  - 切换时：同步写入 `localStorage.setItem('exo_session_type_' + activeSessionId, val)`。
- **关联 API 端点**:
  - `POST /api/agents/chat/<session_id>/` 请求体字段：`session_type: 'full' | 'lite'`。
  - `POST /api/agents/conversations/<pk>/branch/` 请求体字段：`session_type: branchSessionType || 'lite'`。
- **分类标签**:
  - 作用域：**Conversation-local**（绑定 `activeSessionId`）。
  - 真相源：**Backend truth backed + local preference**。

### 2.5 Capability 5: `aura_theme` (会话现场能量场与氛围主题)
- **V3 源码 Owner**:
  - 视觉渲染容器：`packages/chat-core/src/components/chat/AuroraBackground.jsx` (57 lines)
  - 动效与滤镜样式：`packages/chat-core/src/components/chat/AuroraBackground.css` (282 lines)
  - 调色板定义与 OKLCH 计算引擎：`packages/chat-core/src/components/chat/palettes.js` (345 lines)
  - HUD 控制取色板：`packages/chat-core/src/components/chat/ControlsDrawer.jsx` (Lines 309–460)
  - 全局微光容器：`.cinder-aura` (`packages/chat-core/src/App.jsx:77` & `packages/shared/src/styles/base.css:47–68`)
- **机械实现机制**:
  - **OKLCH 色相差值引擎**：通过 3 个控制点（Key Shadow `--obsidian`, Key Mid `--oxblood-500`, Key Highlight `--orange-500`），实时动态生成 8 个均匀光波梯级变量（`STOP_NAMES`: `--obsidian`, `--garnet-600`, `--oxblood-400`, `--oxblood-500`, `--rusty-500`, `--rusty-600`, `--orange-400`, `--orange-500`）。
  - **内置预设**：
    - Dark 预设：`burning-sunset` (余火), `deep-ocean` (深海), `void-amethyst` (虚空紫晶)
    - Light 预设：`morning-mist` (晨光金雾), `spring-dew` (春露), `peach-cloud` (桃云)
  - **自定义主题**：支持用户微调 3 个 Keypoints，并保存最多 3 套自定义主题到 `localStorage.exo_custom_palettes`。
  - **动态能量脉冲**：当 `isGenerating === true` 时，向 `.aurora-stage` 叠加 `.aurora-active` 类名，激活横向等离子缎带飘动动画（Ribbon Drift）。
  - **主题响应**：明暗主题（Light/Dark）切换时，内置预设自动回退到当前主题对应的默认项。
- **关联 API 端点**:
  - **无**（完全为客户端沉浸式渲染系统）。
- **分类标签**:
  - 会话当前选定 Palette：**Conversation-local** (`localStorage.getItem('exo_session_theme_' + activeSessionId)`)。
  - 自定义色板集合：**Global local storage** (`localStorage.getItem('exo_custom_palettes')`)。
  - 生成脉冲态：**Runtime lifecycle dependent**（依赖当前生成状态 `isGenerating` / `busy`）。
  - 真相源：**Client-side Truth**（纯前端持有）。

### 2.6 Capability 6: `project_files_in_chat` (会话现场项目文件访问)
- **V3 源码 Owner**:
  - 外壳协调：`packages/chat-core/src/components/chat/ChatShell.jsx` (Lines 48–180)
  - 顶部入口：`packages/chat-core/src/components/chat/StageHeader.jsx` (`onToggleFilesDrawer`)
  - 右侧抽屉：`packages/chat-core/src/components/project/ProjectFilesDrawer.jsx` (142 lines)
  - 树形结构组件：`packages/chat-core/src/components/project/FileTree.jsx` (167 lines)
  - 输入框交互：`ChatArea.jsx`
    - `@` 触发弹出层：`packages/chat-core/src/components/chat/AutocompletePopup.jsx` (235 lines)
    - 待插入回调：`pendingInsert` → 在光标处插入 `@[path] `
    - 关联文件胶囊栏：解析输入框内所有 `@[path]`，在输入框上方渲染 Chip Bar (Lines 1533–1547)
    - 发送脱敏：`cleanContentForSend(text)` 将 `@[path]` 转换为 `@path` 提交至后端。
- **状态来源 (State Source)**:
  - **项目归属 (Project Resolution)**：由 `conversation.project` ID 调用 `projectsApi.getProject(pid)` 获取。若 `project_id == null` 或为 `0`（Drift 状态），则**不具备**工作区文件抽屉。
  - **工作区目录树 (Directory Tree)**：`projectsApi.listDirectory(projectId, relPath)`。后端一次性递归扫描或分层懒加载。
  - **项目知识库文件 (Project Files)**：`projectsApi.listProjectFiles(projectId)`。
  - **心跳同步**：V3 在抽屉打开期间维持 30s 轮询心跳。
- **关联 API 端点**:
  - `GET /api/agents/conversations/<id>/` (解析 `project` 字段)
  - `GET /api/projects/<id>/` (读取 `work_dir`)
  - `GET /api/projects/<id>/files/` (列出项目参考文件)
  - `GET /api/projects/<id>/directory/?path=<relPath>` (获取目录树)
- **分类标签**:
  - 作用域：**Conversation-bound Project Context**（必须依托当前会话的 `project_id`）。
  - 真相源：**Backend Truth**（文件系统与项目知识库均由服务端持有）。

---

## 3. 核心专项调查：Thinking 与 ToolCall 数据形态全景 (AssistantRunTrace Deep Dive)

为彻底避免 P1D 重构中因协议误解而“再造一套数据结构”，必须彻底厘清：**从后端执行、SSE 传输、数据库持久化，到 REST 历史读取，全链路中 Thinking 与 ToolCall 的真实物理形态**。

### 3.1 后端服务层执行形态 (Django Backend: `ExoCore`)

在 `../ExoCore/agents/services.py` 的执行流中：
1. **Thinking 产生**:
   - 当大模型输出思考过程时，LLMGateway 生成器产出 `thinking` 文本分块。
   - Service 直接通过 SSE 推送：`yield self._format_sse('thinking', chunk)`。
   - 累加至局部变量 `turn_thinking`，最终汇总在 `acc['thinking']`。
2. **ToolCall 产生与执行**:
   - 当模型触发工具调用时，产出 `turn_tool_calls = [{ "name": str, "args": dict }]`。
   - **工具进度状态推送（关键事实）**：
     ```python
     status_msg = _TOOL_STATUS_MESSAGES.get(name)
     if status_msg and name in allowed_tool_names:
         yield self._format_sse('status', _format_tool_status(status_msg, args))
     ```
     后端**没有**向 SSE 推送独立的 `event: tool_call` 或 `event: tool_result`！工具调用的执行中状态，完全被格式化为人类可读的字符串（例如 `"读取文件: src/main.rs"`），通过 `event: status` 发送。
   - **工具执行结果记录**:
     在执行工具后，后端将完整的调用与返回存入：
     ```python
     all_tool_calls_data.append({
         "name": name,
         "args": args,
         "result": tool_result.content
     })
     ```
   - **Telemetry 汇总**:
     在轮次结束前，推送 `event: telemetry`，其中包含工具调用总计数：
     `{ "platform": ..., "model_name": ..., "tool_calls": total_tool_calls_count, ... }`。
3. **主动 `memory_search` ToolCall**:
   - 在 Superior 模式下，`memory_search` 是注册在 ToolsetSnapshot 中的标准工具之一。
   - 其执行、捕获与记录与普通工具（如 `my_workspace_read`）**完全一致**。
   - 按照 V4 冻结规范，主动 `memory_search` 在 `AssistantRunTrace` 中作为普通的 ToolCall 条目展示，**绝不得**与用户消息底部的自动召回回执（P6 Recall Receipt）相混淆。

### 3.2 数据库物理持久化形态 (PostgreSQL / Django Model)

在 `../ExoCore/memory/models.py` 的 `Message` 模型中：
```python
class Message(models.Model):
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    content = models.TextField(verbose_name="正文内容")
    reasoning_content = models.TextField(
        null=True, blank=True, verbose_name="思维链内容", help_text="DeepSeek/OpenAI o1 的思考过程"
    )
    tool_calls = models.JSONField(
        default=list, blank=True, help_text="工具调用记录列表（名称+参数+结果）"
    )
```
- **落地代码 (`agents/services.py:1112–1114`)**:
  ```python
  if tool_calls_data and assistant_msg is not None:
      assistant_msg.tool_calls = _sanitize_for_postgres_json(tool_calls_data)
      assistant_msg.save(update_fields=['tool_calls'])
  ```
- **数据结构形态**:
  - `reasoning_content`: 纯文本字符串（Markdown/LaTeX 格式）。
  - `tool_calls`: JSON 数组，每一项的精确结构为：
    ```json
    [
      {
        "name": "my_workspace_read",
        "args": { "target": "src/main.rs" },
        "result": "fn main() { ... }"
      }
    ]
    ```

### 3.3 传输层与 REST 序列化真相对比 (Wire vs Read Models)

| 阶段 / 载体 | 属性名 | 数据类型 | 载荷范例 | 关键事实 / 注意事项 |
|---|---|---|---|---|
| **实时 SSE: Thinking** | `event: thinking` | `string` (chunk) | `data: "首先我们需要分析..."` | 流式到达，累加拼接 |
| **实时 SSE: Tool Progress** | `event: status` | `string` (preview) | `data: "读取文件: src/main.rs"` | 经 `_format_tool_status` 替换脱敏的纯文本预览 |
| **实时 SSE: Telemetry** | `event: telemetry` | `JSON object` | `{"tool_calls": 3, "input_chars": 1200}` | `tool_calls` **仅为整数计数**，无结构化列表 |
| **历史 GET: `MessageSerializer`** | `reasoning_content` | `string \| null` | `"首先我们需要分析...\n\n结论是..."` | 历史读取**完整暴露** |
| **历史 GET: `MessageSerializer`** | `tool_calls` | **未暴露 (Omitted)** | **缺失** | **CRITICAL FACT**：Django 模型的 `Message.tool_calls` **未包含在** `memory.serializers.MessageSerializer.Meta.fields` 中！ |

### 3.4 架构规范中 `AssistantRunTrace` 的职责定位

根据 `Plan/V4_River_Collection_Memory_Interaction_Spec.md` §7.1–§7.2：
```text
MessageBubble (Assistant)
├── MessageHeader (Role, Timestamp, Platform/Model)
├── AssistantRunTrace (按需显示 / 折叠面板)
│   ├── ReasoningPanel (展示 reasoning_content / 流式 thinking)
│   └── ToolCallList (展示实时 status 流与历史/统计 tool 信息)
├── MessageContent (Markdown 正文)
└── MessageActions (Copy, Edit, Regenerate, Branch)
```
- **生命周期归一**:
  - **流式运行态 (`isStreaming === true`)**：`AssistantRunTrace` 消费实时推送的 `thinking` 文本分块、实时 `statusText`（工具执行脉冲）与 `telemetry`。
  - **历史持久态 (`persisted message`)**：`AssistantRunTrace` 消费持久化消息的 `reasoningContent`。

---

## 4. 重复实现、旧兼容层与已废弃路径梳理 (Refactoring Targets)

在本次深入调查中，已定位出以下必须在 P1D 方案中予以甄别或清理的旧代码与冗余路径：

### 4.1 废弃字段与静默失效参数
1. **`temperature` 参数失效**:
   - V3 `ControlsDrawer` 允许选择温度并调用 `PATCH /api/agents/conversations/<id>/`。
   - 但后端 `ConversationSerializer` **不包含** `temperature` 字段更新，后端直接忽略。
   - 解决方案：在 V4 中应明确其是否作为 per-request 发送参数，不制造“已保存成功”的错觉。
2. **`galatea_mcp` 废弃字段**:
   - V3 早期在 POST body 发送 `galatea_mcp: bool`。
   - 后端已在 `ReactSheet.md §1.3` 明确：标准 live chat 只暴露恒定 `use_drawer` 代理，前端必须停止发送 `galatea_mcp`。
3. **`session_id` 别名**:
   - `conversation_id` 是统一唯一的会话标识；旧版返回中的 `session_id` 仅为过渡别名。V4 已在 P1A/P1B 统一为 `conversationId`。

### 4.2 重复实现与未使用的 Shared Wrappers
1. **Cache API 重复与直连**:
   - `packages/shared/src/endpoints/conversations.js` 中定义了 `getCacheStatus(sessionId)` 和 `deleteCache(sessionId)`。
   - 但 V3 `ContextCacheIndicator.jsx` **完全弃用了 shared wrapper**，直接手写 `fetch('${baseUrl}/api/agents/conversations/${s}/cache/')`。
   - `CacheRenewView` (`POST /api/agents/conversations/<pk>/cache/renew/`) 在 shared 中甚至没有对应 wrapper，V3 也从未调用。
2. **Project Files 轮询与单例重叠**:
   - V3 在 `ChatShell.jsx` 与 `ProjectFilesDrawer.jsx` 之间存在双重数据管理：`ChatShell` 持有 `fileTree` 和 `projectFiles` 并每 30s 轮询，同时把 `onLoadDirectory` 逐层传递到 `FileTree`。
   - V4 应统一利用 TanStack Query 或专用 Hook 进行受控缓存管理。
3. **双轨消息历史同步 (allHistoryRef vs messages)**:
   - V3 `ChatArea.jsx` 维护了庞大且易出现不同步的 `allHistoryRef.current` 与 `messages` 双轨数组。
   - V4 在 P1B 中已通过 TanStack Query `useMessagePagesQuery` + 纯运行时 Overlay 彻底取缔了此双轨设计，P1D 严禁开历史倒车。

---

## 5. 事实、不确定性与决策点 (Facts, Uncertainties & Open Questions)

### 5.1 确凿事实 (Hard Facts)
1. **Thinking 数据源完全闭环**：
   - SSE 实时事件 `event: thinking` 正常产出增量文本分块。
   - 后端数据库 `Message.reasoning_content` 正常持久化。
   - REST 接口 `GET /api/agents/chat/<sid>/` 正常通过 `MessageSerializer` 返回 `reasoning_content`。
   - V4 P1B 已在 `types.ts` 定义 `reasoningContent?: string`，但此前在 `events.ts` 忽略了累加，在 `MessageTimeline.tsx` 挂上了“P1D 开放”占位标识。
2. **ToolCall 实时事件并非独立协议**：
   - SSE 传输中**不存在** `event: tool_call`；工具活动是通过 `event: status` 发送脱敏预览文本。
   - 每轮 Telemetry 仅返回工具调用的总整数计数 `tool_calls: number`。
3. **Cache 启用与跳过机制**：
   - 每轮聊天 POST 请求必须支持 `cache_enabled: bool` 与 `force_cache_rebuild: bool`。
   - 收到 `event: cache_skipped` 时，应当给予用户非侵入式 Toast 提示（如“平台不支持缓存”）。
4. **Project Files 的严格前置条件**：
   - 只有 `conversation.projectId` 存在且非 0 时，才具备工作区文件访问条件；Drift 会话完全无此能力。

### 5.2 核心不确定性与留给 Sol 的规划裁决 (Uncertainties for Sol)

> [!IMPORTANT]
> **以下关键问题需要 Sol 在 Detailed Plan 中进行权威技术决策，本调查报告不做提前拍板：**

1. **`AssistantRunTrace` 历史 ToolCall 的可见性边界决策**:
   - **事实矛盾**：后端数据库 `Message.tool_calls` 完整保存了每轮调用的 `{ name, args, result }`，但 `MessageSerializer` 目前的 `Meta.fields` **并未包含** `tool_calls` 字段。
   - **抉择路径 A（纯前端闭环，不改后端）**：
     - `AssistantRunTrace` 在实时流式态展示 Thinking 内容 + 实时 `statusText` 工具进度 + 轮次结束后的 Tool 计数（来自 Telemetry）。
     - 在历史消息中，仅展示 `ReasoningPanel`（思维链全文），ToolCall 区域在历史回放中不显示或显示 Telemetry 摘要。
   - **抉择路径 B（提写 Backend Spec 扩充 Serializer）**：
     - 判定“历史工具详情复盘”为不可或缺能力。
     - 严格遵守 `AGENTS.md` 跨仓边界：在 `docs/superpowers/specs/` 下起草后端变更规范，由后端维护者在 `memory.serializers.MessageSerializer.Meta.fields` 中加入 `tool_calls`。
     - *请 Sol 明确 P1D 是否在路径 A 即可完成 C1D 验收，还是必须依赖路径 B。*
2. **Tactical HUD / Controls Drawer 的物理容器位置**:
   - 规范原型（`Plan/V4_Page_Skeleton.md:199–228`）将 Tactical HUD 描绘为从顶部或标题栏下拉展开的面板。
   - V3 中将其放置在输入框正上方（`ControlsDrawer.jsx`），由齿轮按钮控制折叠。
   - V4 的 App Shell 具有固定的 `app-topbar` 与底栏 `ChatComposer`。
   - *请 Sol 确定 Tactical HUD 的准确挂载宿主（Top Bar 下拉 vs Composer 上方伸缩面板），以及移动端/桌面端的响应式形态。*
3. **Aura Background 的分层与性能预算**:
   - V3 `AuroraBackground.css` 拥有 9 个高斯模糊 ribbon（`filter: blur(60px)` 等），且在生成时产生高频重绘。
   - V4 App Shell 强调高保真与严谨性能，底色需与 `styles/base.css` 的余火/焦炭风格融合。
   - *请 Sol 评估是否将 `AuroraBackground` 完整平移为 `Canvas` / CSS 独立层，并确认在不同主题模式下的降级策略。*
4. **Cache Renew 端点的启用价值**:
   - 后端已支持 `POST /api/agents/conversations/<pk>/cache/renew/`，但 V3 未提供“续期”按钮，仅有“释放”按钮。
   - *请 Sol 裁决 P1D 是否在 Cache 指示器或 HUD 中新增显式的“续期 30 分钟”交互。*

---

## 6. 文件拓扑与映射表 (Source & Target File Map)

### 6.1 V3 源码参考清单 (Reference Sources)
| 模块 / 功能 | V3 原始路径 | 核心代码量 | 关键职责 |
|---|---|---|---|
| **Cache 指示器** | `packages/chat-core/src/components/chat/ContextCacheIndicator.jsx` | 335 lines | 倒计时状态机、轮询、释放、本地快照恢复 |
| **HUD 控制面板** | `packages/chat-core/src/components/chat/ControlsDrawer.jsx` | 470 lines | 模型/端点/思考度/模式选择器、Telemetry 查看器 |
| **Session 历史开关** | `packages/chat-core/src/components/chat/ChatArea.jsx:1736–1764` | 30 lines | `SessionTypeToggle` (Full vs Lite) |
| **Aura 舞台** | `packages/chat-core/src/components/chat/AuroraBackground.jsx` | 57 lines | 极光流光挂载容器 |
| **Aura 样式** | `packages/chat-core/src/components/chat/AuroraBackground.css` | 282 lines | 缎带动画、滤镜与图层 |
| **Aura 调色板** | `packages/chat-core/src/components/chat/palettes.js` | 345 lines | 3-Keypoint OKLCH 插值算法与预设库 |
| **项目文件抽屉** | `packages/chat-core/src/components/project/ProjectFilesDrawer.jsx` | 142 lines | 侧滑面板、工作区树展示 |
| **项目文件树** | `packages/chat-core/src/components/project/FileTree.jsx` | 167 lines | 递归目录树展开、懒加载 |
| **自动补全弹出框** | `packages/chat-core/src/components/chat/AutocompletePopup.jsx` | 235 lines | `@` 语法文件匹配浮层 |
| **Thinking 历史展示** | `packages/chat-core/src/components/chat/MessageBubble.jsx:316–326` | 15 lines | 折叠面板展示 `reasoning_content` |

### 6.2 V4 目标架构与改造文件 (V4 Target Files)
| 分类 | 目标文件路径 | 计划改动性质 | 预期职责 |
|---|---|---|---|
| **Runtime 状态流** | `packages/app/src/features/chat/runtime/types.ts` | 修改 | 扩展 `RuntimeAssistantRow`（支持 thinking/status/telemetry 状态缓存） |
| **Runtime 事件消费** | `packages/app/src/features/chat/runtime/events.ts` | 修改 | 正式承接 `thinking`、`telemetry` 与 `cache_skipped` 规范化事件 |
| **Runtime 控制器** | `packages/app/src/features/chat/runtime/useChatRuntime.ts` | 修改 | `ChatTurnInput` 支持 `cache_enabled`, `session_type`, `model`, `endpoint` |
| **消息流渲染** | `packages/app/src/features/chat/MessageTimeline.tsx` | 修改 | 将历史消息的 `推理过程 · P1D 开放` 替换为 `AssistantRunTrace` |
| **消息轨迹外壳** | `packages/app/src/features/chat/trace/AssistantRunTrace.tsx` | **新建** | 包含 `ReasoningPanel` 与 `ToolCallList` 的通用助手轨迹组件 |
| **思维链面板** | `packages/app/src/features/chat/trace/ReasoningPanel.tsx` | **新建** | 承接实时思考流与历史 `reasoningContent` 的折叠与代码渲染 |
| **工具轨迹面板** | `packages/app/src/features/chat/trace/ToolCallList.tsx` | **新建** | 承接运行中工具执行状态与遥测统计 |
| **Tactical HUD 面板** | `packages/app/src/features/chat/hud/TacticalHudDrawer.tsx` | **新建** | 整合 Model/Endpoint/Thinking/Cache/History/Memory/Aura 统一控制 |
| **Cache 控件** | `packages/app/src/features/chat/hud/ContextCacheControl.tsx` | **新建** | 规范化 TTL 倒计时、状态同步、刷新与释放交互 |
| **Aura 能量场** | `packages/app/src/features/chat/aura/AuraCanvas.tsx` | **新建** | V4 会话背景动态光波与色盘引擎 |
| **Aura 调色板引擎** | `packages/app/src/features/chat/aura/palettes.ts` | **新建** | 提取移植 OKLCH 插值与主题管理 |
| **项目文件抽屉** | `packages/app/src/features/chat/project/ProjectFilesDrawer.tsx` | **新建** | 整合会话内项目文件浏览、目录树与 `@` 语法联动 |
| **会话主页面** | `packages/app/src/features/chat/ConversationPage.tsx` | 修改 | 编排挂载 Tactical HUD、Aura 背景与 Project Files 触发入口 |

---

> **圣武士誓言守护记录：**
> 本调查文档已严格锁定于“事实呈现”、“形态摸底”与“边界标记”。所有结论均经由逐行校对 V3 生产源码、Django 后端模型及 Canonical API Snapshot 得出，未越权预先敲定任何架构决策。
> 战场已肃清，事实已昭彰。移交 **Sol** 起草《V4 Phase 1D Detailed Plan》。
