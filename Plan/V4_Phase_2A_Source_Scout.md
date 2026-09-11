# ExoCore V4 — Phase 2A Source Scout & Capability Fact Reference (V3 / P2A)

> **Document Type:** Source Scout & Technical Fact Reference for P2A Planning & Review  
> **Target Audience:** Sol (Author of `Plan/V4_Phase_2A_Agent_Hub_Profile_Detailed_Plan.md`), Reviewers, Alicia  
> **Scout Author / Guard:** Alaric (圣武士与守誓者)  
> **Status:** **COMPLETE — FACT INDEX & EVIDENCE REFERENCE FOR P2A REVIEW**  
> **Date:** 2026-09-09  
> **Baseline Checkpoints:**  
> - Desktop HEAD / Baseline: `b1178fb1a974cd848fdeaa11a7d279df920b1a0c` / accepted Unified C1 (`23dea37`)  
> - Real Database / Backend State: `AgentPreset` baseline is exactly IDs 1–8; Django backend read-only; PostgreSQL trigger `exocore_protect_agentpreset_rows` active  
> - Authoritative Contract & Spec Sources:  
>   - `Plan/V4_Master_Implementation_Roadmap.md` §8 (Phase 2), §2 (R2)  
>   - `Plan/V4_Phase_0_Baseline/V3_Capability_Ownership.md` rows 20 (`agent_project_filters`), 36 (`agent_hub_profile`), 45 (`heartbeat_summary`), 51 (`plasmid_management`)  
>   - `Plan/ExoCore_V4_Single_SPA_Architecture_Spec.md` §5.3 (Agent Workspace), §5.5 (Canonical Chat)  
>   - `Plan/V4_Page_Skeleton.md` 板块一 (Chat / Agent Hub / Agent Profile)  
>   - `Plan/V4_Phase_1_Unified_C1_acceptance_report.md` (Unified C1 Acceptance)  

---

## 1. 目标与法定边界 (Scope & Boundaries)

### 1.1 P2A 核心定位
Phase 2A 是 ExoCore V4 单 SPA 重构中 Phase 2（Groups + Chat Workspaces + Remaining Core Shell）的第一个可独立计划、独立施工、独立验收的垂直切片。其核心使命是：**以已验收的 V4 App Shell 与 Canonical Chat（Unified C1 PASS）为底座，建立面向 Agent 的专属浏览与索引基础壳（Agent Hub / Agent Profile），打通「从 Agent 找到历史对话」与「以指定 Agent 发起新对话并落地 canonical `/chat/:conversationId`」的核心路径，不依赖任何隐藏的 V3 页面。**

依据 `Plan/V4_Phase_0_Baseline/V3_Capability_Ownership.md`，P2A 切片直接关联以下两项 Capability 的阶段性建设：
1. **`agent_hub_profile` (Row 36, Disposition: Replace)**：Agent 浏览、Profile 呈现、Prompt 预览/配置、会话入口与 Memory 摘要/深链入口。
2. **`agent_project_filters` (Row 20, Disposition: Replace UI, preserve entities)**：Agent 与 Project 作为同一 Conversation 集合的正交筛选入口；在 Agent 视角下突出 Project / Drift 维度。

### 1.2 严格边界守护 (Boundary Guard / Scope Razor)

为确保二审及后续实施不发生范围蔓延（Scope Creep），必须坚守以下法定边界：

| 范畴 | 归属阶段 | P2A 处置策略 | 规范依据 |
|---|---|---|---|
| **Agent Hub 列表 / Agent Profile 基础壳** | **P2A** | 完整构建（只读或受控编辑）并接入 V4 AppShell 路由 | Roadmap §8 P2, Spec §5.3 |
| **以当前 Agent 发起会话** | **P2A** | 直接复用 P1A `createConversation` 契约，落地 canonical `/chat/:conversationId` | Spec §5.5 |
| **Agent 名下会话索引与 Project / Drift 筛选** | **P2A** | 内存纯前端过滤 `agentPresetId === preset.id`，二级按 Project / Drift 缩小范围 | Roadmap §2 R2, Spec §4.1 |
| **Memory 摘要与深链入口** | **P2A** | **仅允许轻量只读摘要 + 语义深链**；严禁引入完整管理台 | Roadmap §8, Spec §5.3, §6.1 |
| **`AgentMemory.jsx` 心跳事件 ECG 示波器** | **P3 (River)** | **严禁引入 P2A**；该能力归属 `heartbeat_summary` (Row 45) | Capability Matrix Row 45 |
| **`MemoryPlasmid` 完整 CRUD / Tags / Trigger 管理** | **P5 (Library)** | **严禁引入 P2A**；该能力归属 `plasmid_management` (Row 51) | Capability Matrix Row 51 |
| **Project Hub / Project Detail / Files** | **P2B+** | **严禁提前施工**；P2A 仅消费会话上的 Project 属性与标签 | Roadmap §8 |
| **GroupChat 列表与房间** | **P2 (独立)** | **严禁引入 P2A** | Roadmap §8 |
| **Settings / MCP / 账号 / 通知中心** | **P2 (独立)** | **严禁引入 P2A** | Roadmap §8 |
| **Preset 行生命周期 (新建 / 删除)** | **永久关闭** | **严禁实现**；后端已物理锁死 (HTTP 405) | Migration `agents.0040` |

---

## 2. 核心事实证据矩阵 (Evidence Matrix)

| # | FACT | source (file:symbol/line or API) | P2A relevance | confidence |
|---|---|---|---|:---:|
| **F01** | **Preset 行增删操作在后端已被物理锁死。** `POST /api/agents/presets/` 与 `DELETE /api/agents/presets/<id>/` 返回 HTTP 405；PostgreSQL 触发器 `exocore_protect_agentpreset_rows` 拒绝一切测试库外的增删（SQLSTATE 55000）；库中固定唯独 ID 1–8。V3 AgentHub 的「新建」按钮与 AgentProfile 的「抹除 Entity」按钮均为无法走通的死代码。 | [agents/views.py:386-396](file:///D:/Alicia/ExoCore_Project/ExoCore/agents/views.py#L386-L396)<br>[0040_protect_agentpreset_rows.py:17-41](file:///D:/Alicia/ExoCore_Project/ExoCore/agents/migrations/0040_protect_agentpreset_rows.py#L17-L41)<br>[test_agentpreset_write_lock.py:36-54](file:///D:/Alicia/ExoCore_Project/ExoCore/agents/tests/test_agentpreset_write_lock.py#L36-L54) | P2A 必须剔除新建与删除 Agent Preset 交互，仅保留只读展示与允许的字段 PATCH（name, description, default_model, system_prompt）。 | 100% |
| **F02** | **Preset 1–4 为系统保留预设，`agent_type` 被序列化器硬编码锁定禁止修改；5–8 允许修改。** | [agents/serializers.py:23-41](file:///D:/Alicia/ExoCore_Project/ExoCore/agents/serializers.py#L23-L41) | P2A 若包含 Agent 配置展示，不可对预设 1–4 暴露可编辑的 Tier 切换。 | 100% |
| **F03** | **Agent 名下会话过滤在真实 V3 中纯为前端全量内存过滤。** 后端 `GET /api/agents/conversations/` 返回全量平铺列表，前端按 `c.agent_preset_id === preset.id` 内存过滤并排序；无服务端筛选与分页契约。 | [AgentProfile.jsx:125-134](file:///D:/Alicia/ExoCore_Project/ExoCore-Desktop/packages/chat-core/src/views/AgentProfile.jsx#L125-L134)<br>[V4_Master_Implementation_Roadmap.md §2 R2](file:///D:/Alicia/ExoCore_Project/ExoCore-Desktop/Plan/V4_Master_Implementation_Roadmap.md#L75) | P2A 必须直接复用 V4 已有的 `useConversationsQuery()` 进行客户端过滤，**严禁猜测性引入服务端 query params（如 `?agent_preset_id=`）或分页**。 | 100% |
| **F04** | **V3 AgentProfile 会话加载出错时静默设为空列表，伪装为“无会话”。** | [AgentProfile.jsx:135-140](file:///D:/Alicia/ExoCore_Project/ExoCore-Desktop/packages/chat-core/src/views/AgentProfile.jsx#L135-L140) | 严重违反 Universal Exit Gate §4.3 #4；P2A 必须接入 V4 `ErrorState` 并支持重试，禁止静默吞噬。 | 100% |
| **F05** | **会话列表的 `message_count` 为幽灵字段。** V3 试图渲染 `s.message_count != null`，但后端 `ConversationSerializer` 根本没有该字段。 | [AgentProfile.jsx:566](file:///D:/Alicia/ExoCore_Project/ExoCore-Desktop/packages/chat-core/src/views/AgentProfile.jsx#L566)<br>[agents/serializers.py:58-66](file:///D:/Alicia/ExoCore_Project/ExoCore/agents/serializers.py#L58-L66) | P2A 会话卡片不得假定或依赖消息数。 | 100% |
| **F06** | **V3 AgentProfile 的 Memory 按钮实为“心跳事件示波器”（归 P3 River），而非 Memory 管理；质粒 CRUD 归 P5 Library。** V3 Profile 中的「Heartbeat Ledger」指向 `AgentMemory.jsx`（962 行心跳事件 ECG 示波器）；而 AgentHub 跑马灯消费的是 `GET /api/memory/plasmids/?preset_id=`。 | [AgentProfile.jsx:454-458](file:///D:/Alicia/ExoCore_Project/ExoCore-Desktop/packages/chat-core/src/views/AgentProfile.jsx#L454-L458)<br>[AgentMemory.jsx:85-103](file:///D:/Alicia/ExoCore_Project/ExoCore-Desktop/packages/chat-core/src/views/AgentMemory.jsx#L85-L103)<br>[MarqueeArea.jsx:21-70](file:///D:/Alicia/ExoCore_Project/ExoCore-Desktop/packages/chat-core/src/components/agent/MarqueeArea.jsx#L21-L70)<br>[V3_Capability_Ownership.md:45,51](file:///D:/Alicia/ExoCore_Project/ExoCore-Desktop/Plan/V4_Phase_0_Baseline/V3_Capability_Ownership.md#L45-L51) | **最危险 Scope Creep 点**：P2A 严禁搬运 962 行的心跳示波器，也严禁实现质粒 CRUD/标签编辑。P2A 严格限定于“只读 Memory 摘要 + 深链入口”。 | 100% |
| **F07** | **从 Agent 创建会话完全可直接复用 P1A 已验收的 `createConversation` 契约，落地唯一 canonical `/chat/:conversationId`。** | [features/chat/api.ts:255-280](file:///D:/Alicia/ExoCore_Project/ExoCore-Desktop/packages/app/src/features/chat/api.ts#L255-L280)<br>[features/chat/queries.ts:173-195](file:///D:/Alicia/ExoCore_Project/ExoCore-Desktop/packages/app/src/features/chat/queries.ts#L173-L195)<br>[ExoCore_V4_Single_SPA_Architecture_Spec.md §5.5](file:///D:/Alicia/ExoCore_Project/ExoCore-Desktop/Plan/ExoCore_V4_Single_SPA_Architecture_Spec.md#L175-L183) | 创建会话直接调用 `POST /api/agents/sessions/init/`（默认绑定当前 `preset_id`），跳转至唯一 canonical 聊天路由，**绝不可另造 Agent 专属聊天页**。 | 100% |
| **F08** | **Project 与 Drift 在 V4 会话模型中已有明确定义与展示设施。** `projectId === null`（后端 0）表达 Drift；非空则显示项目名称。 | [features/chat/api.ts:100-101](file:///D:/Alicia/ExoCore_Project/ExoCore-Desktop/packages/app/src/features/chat/api.ts#L100-L101)<br>[RecentConversationList.tsx:85-87](file:///D:/Alicia/ExoCore_Project/ExoCore-Desktop/packages/app/src/features/chat/RecentConversationList.tsx#L85-L87) | P2A 的会话索引必须以 Project / Drift 作为二级筛选标签（全部 / Drift / 各 Project），直接复用现有 chip 规范。 | 100% |
| **F09** | **V4 `packages/app` 已具备完备的基础设施供 P2A 直接消费。** | [features/chat/queries.ts:22-28,69-97](file:///D:/Alicia/ExoCore_Project/ExoCore-Desktop/packages/app/src/features/chat/queries.ts#L22-L28)<br>[shared/AsyncState.tsx](file:///D:/Alicia/ExoCore_Project/ExoCore-Desktop/packages/app/src/shared/AsyncState.tsx)<br>[shell/AppShell.tsx](file:///D:/Alicia/ExoCore_Project/ExoCore-Desktop/packages/app/src/shell/AppShell.tsx) | `useConversationsQuery`、`useVisiblePresetsQuery`、`useProjectsQuery`、`useCreateConversationMutation`、`LoadingState`、`ErrorState`、`EmptyState` 均直接复用。 | 100% |
| **F10** | **Agent 头像在 V3 中无后端上传/保存接口，纯前端存于 `localStorage`（base64 data URL），回退走 Dicebear。** | [AgentProfile.jsx:221-225](file:///D:/Alicia/ExoCore_Project/ExoCore-Desktop/packages/chat-core/src/views/AgentProfile.jsx#L221-L225)<br>[packages/shared/src/profile.js](file:///D:/Alicia/ExoCore_Project/ExoCore-Desktop/packages/shared/src/profile.js) | 后端 `AgentPreset` 无 avatar 字段。P2A 需明确是否继续沿用前端本地持久化，抑或暂不支持上传并依赖默认/Dicebear 生成。 | 100% |
| **F11** | **V3 AgentHub 的卡片排序依赖 `localStorage.getItem('agentHubOrder')`，且移动端把手被 `hidden sm:block` 物理隐藏。** | [AgentHub.jsx:135-145, 308](file:///D:/Alicia/ExoCore_Project/ExoCore-Desktop/packages/chat-core/src/views/AgentHub.jsx#L135-L145) | 桌面/移动行为不一致，且本地存储拖拽排序不可跨设备同步；P2A 应评估是否在基础壳首期采用确定性稳定排序（G045 置顶，其余按 ID/名称排列）。 | 95% |
| **F12** | **P1/C1 Handoff 中无任何阻塞 P2A 的遗留项。** 统一 C1 报告与路线图清晰界定：Chat 能力转移至 V4-primary，Groups / Agent & Project Workspaces / Settings / Notifications 显式划归 P2。 | [V4_Phase_1_Unified_C1_acceptance_report.md:54, 62](file:///D:/Alicia/ExoCore_Project/ExoCore-Desktop/Plan/V4_Phase_1_Unified_C1_acceptance_report.md#L54-L62)<br>[V4_Master_Implementation_Roadmap.md:§8](file:///D:/Alicia/ExoCore_Project/ExoCore-Desktop/Plan/V4_Master_Implementation_Roadmap.md#L263-L300) | P2A 可以安全以 `23dea37` 为基准起跑。 | 100% |

---

## 3. V3 源码机械调查：逐项能力画像 (Capability Anatomy)

### 3.1 V3 AgentHub (`AgentHub.jsx`)
- **文件与定位**: `packages/chat-core/src/views/AgentHub.jsx` (464 lines)
- **路由入口**: `/agent-hub`，由 `DesktopSidebar`（桌面）或 `MobileHeader` / `Dashboard`（移动）导航进入。
- **数据来源**:
  - `presets` 来自顶层桥接的 `usePresets()` hook（调用 `GET /api/agents/presets/`）。
  - `plasmidMap`: 仅对 `isG045Type` 的 Agent 发起 `memoryApi.listPlasmids({ preset_id })`，用于下方 `MarqueeArea` 跑马灯轮播。
- **界面结构与分组**:
  1. Header：标题 `Agent Hub`，说明字样，右侧「新建」按钮（绑定 `openCreatePreset`，实际调用后端 `POST /api/agents/presets/`，**必返 405**）。
  2. `THE PRIME` 区块：展示 G045 类型 Agent（Alessandro、Ric 等），卡片内含头像、名称、G045 徽标、Immutable 锁图标、描述文案、分割线以及 `MarqueeArea` 质粒跑马灯。
  3. `STANDARD` 区块：展示 Standard 类型 Agent，微型胶囊卡片（头像 + 名称 + std 标）。
  4. 空态提示：`No agents configured / Run init_g045 to create the prime agent`。
- **交互与排序**:
  - 卡片支持 HTML5 拖拽排序，顺序存入 `localStorage.getItem('agentHubOrder')`。但拖拽手柄在移动端被 `hidden sm:block` 隐去。
  - 点击任意卡片触发 `setView('agent_profile', { agentId: preset.id, agentName: preset.name })` 跳转至 `/agent/:presetId`。

### 3.2 V3 AgentProfile (`AgentProfile.jsx`)
- **文件与定位**: `packages/chat-core/src/views/AgentProfile.jsx` (668 lines)
- **路由入口**: `/agent/:presetId`
- **呈现字段与局部编辑**:
  1. 顶部 Banner：根据 `preset.default_model` 字符串动态给微弱背景色（claude -> 紫色，gpt/openai -> 蓝色，默认 -> 橙色）。
  2. 头像（72px 圆形）：点击触发文件选择，弹出 `AvatarCropModal`，裁剪后存为 base64 data URL 写入 `localStorage`（无后端 API 支持）。
  3. 身份区：
     - 名称：点击可切换为内联输入框，失焦或回车触发 `PATCH /api/agents/presets/:id/` `{ name }`。
     - 描述：点击可内联编辑，失焦或回车触发 `PATCH /api/agents/presets/:id/` `{ description }`。
     - 模型下拉框：由 `configApi.getModelCatalog()` 填充，失焦或切换触发 `PATCH /api/agents/presets/:id/` `{ default_model }`。
     - 锁标记：若为 G045 则不可变。
  4. 行动按钮组：
     - 「New Session」按钮：触发 `openNewSession({ presetId: preset.id })`。
     - 「Heartbeat Ledger」按钮（仅 G045 呈现）：紫框按钮，使用 `IconMemory` 图标，但点击后跳转至 `/agent/:presetId/memory`（即心跳示波器 `AgentMemory.jsx`）。
  5. `[ SYSTEM PROMPT ]` 展示区：
     - 最多显示 200 字截断；点击铅笔图标弹出 `EditPresetModal`（`mode="system_prompt"`），提交触发 `PATCH { system_prompt }`。
  6. `THREADS` 会话列表：
     - 通过原生 `fetch('/api/agents/conversations/')` 读取全量列表，前端客户端过滤 `c.agent_preset_id === preset.id`。
     - 排序：按 `last_message_at || created_at` 降序排列。
     - 错误处理：`catch` 分支仅将 `sessions` 设为空数组，**完全吞噬网络/解析错误**。
     - 会话行操作：点击会话行调用 `setView('chat', { sessionId: s.id })`；右侧提供 `SessionActionsMenu`（重命名、删除）。
  7. Danger Zone（仅非 G045 呈现）：
     - `Tier Configuration` 下拉选择器（试图修改 `agent_type`，对 1–4 号会因 Django ValidationError 失败）。
     - `[ ERASE ENTITY // 抹除 ]` 按钮：触发 `openDestructor`，发送 `DELETE /api/agents/presets/:id/`（**必返 405**）。

### 3.3 V3 AgentMemory (`AgentMemory.jsx`) — 必须剥离的非目标
- **文件与定位**: `packages/chat-core/src/views/AgentMemory.jsx` (962 lines)
- **业务真相**: 表面挂在 `/agent/:presetId/memory`，实际上是**心跳事件（Heartbeat Event）ECG 动态示波器与诊断抽屉**。
- **调用端点**:
  - `GET /api/push/heartbeat-events/?preset_id=<id>&limit=20&offset=0` (`heartbeatApi.listEvents`)
  - `GET /api/push/heartbeat-events/<uuid>/` (`heartbeatApi.getEventDetail`)
- **能力归属**: 属于 Capability Matrix Row 45 `heartbeat_summary`，Roadmap 明确归属于 **Phase 3 (River)**，**绝不可在 P2A 中移植或复用**。

---

## 4. 后端契约事实与真实数据模型 (Backend Contract Truth)

### 4.1 AgentPreset 领域模型与视图集
- **Django ViewSet**: `ExoCore/agents/views.py` `AgentPresetViewSet`
  ```python
  class AgentPresetViewSet(
      mixins.ListModelMixin,
      mixins.RetrieveModelMixin,
      mixins.UpdateModelMixin,
      viewsets.GenericViewSet,
  ):
      """Agent 预设只读列表/详情与更新接口；创建和删除永久关闭。"""
      queryset = AgentPreset.objects.filter(is_visible=True)
      serializer_class = AgentPresetSerializer
  ```
- **写入锁与触发器**:
  - 迁移 `0040_protect_agentpreset_rows.py` 安装了 PostgreSQL 行级触发器 `exocore_protect_agentpreset_rows`，对所有非 `test_` 数据库的 `INSERT`、`DELETE` 或修改 `id` 的操作直接 `RAISE EXCEPTION (SQLSTATE 55000)`。
  - 现存有效行固定且仅为 8 行（ID 1–8）。
- **字段契约**:
  - `GET /api/agents/presets/` 输出：
    `id` (int), `name` (str), `description` (str), `agent_type` (str), `default_model` (str), `system_prompt` (str), `is_visible` (bool, readonly).
  - 校验规则：`_IMMUTABLE_PRESET_IDS = {1, 2, 3, 4}` 不允许修改 `agent_type`。

### 4.2 Conversation 领域模型与序列化
- **Django ViewSet / Serializer**: `ConversationSerializer` (`ExoCore/agents/serializers.py:43-70`)
  ```python
  fields = [
      'id', 'name', 'created_at',
      'frozen_project_ids',
      'project', 'project_name',
      'agent_type', 'agent_preset_id',
      'last_message_at',
      'thinking_level',
      'memory_injection_enabled',
  ]
  ```
- **Project 与 Drift 规则**:
  - 后端字段 `project`：若 DB 中 `project_id` 为空，返回整数 `0`；非空返回对应的整数 Project ID。
  - V4 标准化层（`features/chat/api.ts:100`）：已将 `0` 映射为 `projectId: null`，在 UI 上权威表达为 `Drift`。
  - `agent_preset_id`：外键 ID（int），关联当前 Agent。
  - 幽灵字段：**不存在 `message_count` 字段**。

### 4.3 MemoryPlasmid 领域事实
- **端点**: `GET /api/memory/plasmids/?preset_id=<id>` (`ExoCore/memory/views.py:185-224`)
- **过滤规则**: 后端强制为 `qs = MemoryPlasmid.objects.filter(preset_id__in=[preset_id, 2])`（自动混入 2 号全局预设）。
- **返回结果**: 长期记忆质粒平铺列表（包含 `id`, `content`, `tags`, `weight`, `trigger_keywords` 等）。
- **P2A 消费原则**: 仅用作展示该 Agent 已绑定记忆数量/标签的微型只读摘要，不在此处承接修改或全文检索。

---

## 5. V4 已有资产复用清单 (Reusable Primitives vs DO NOT COPY)

### 5.1 可直接无缝复用的基础设施 (Must Reuse)
1. **Server State Queries & Mutation Hooks**:
   - `useVisiblePresetsQuery()` (`features/chat/queries.ts:85`)：直接提供可见 AgentPreset 列表缓存。
   - `useConversationsQuery()` (`features/chat/queries.ts:69`)：直接提供全量会话列表缓存。
   - `useProjectsQuery()` (`features/chat/queries.ts:92`)：提供 Project 元数据（用于筛选与创建）。
   - `useCreateConversationMutation()` (`features/chat/queries.ts:173`)：已验收的会话初始化突变与 Recent 自动失活联动。
2. **API 适配器与错误模型**:
   - `listVisiblePresets`, `listConversations`, `createConversation` (`features/chat/api.ts`)。
   - `AppApiError`, `toAppApiError` (`features/chat/api.ts:28, 63`)：统一错误处理机制。
3. **展示与异步状态组件**:
   - `LoadingState`, `ErrorState`, `EmptyState` (`shared/AsyncState.tsx`)。
   - `RouteErrorFallback`, `ErrorBoundary` (`shared/ErrorBoundary.tsx`)。
   - `formatDateTime` (`features/chat/time.ts`)：统一时间格式化。
4. **视觉与布局 Tokens**:
   - `app-page`, `app-topbar`, `app-btn`, `app-chip`, `app-chip--drift`, `app-scroll`, `app-banner`, `app-link-btn` (`packages/app/src/styles/`)。

### 5.2 严禁复制代码与历史包袱 (DO NOT COPY)
1. **严禁拷贝 V3 的内联样式与定制 SVG 图标库**：V3 充斥数以百计的 `style={{ ... }}` 以及私有的 `IconPrime`, `IconStandard`, `IconDrag` 等；V4 必须使用 Lucide 图标与标准 CSS 样式。
2. **严禁拷贝 V3 的未受控拖拽排序**：V3 使用基于 `localStorage` 的 HTML5 拖拽，移动端直接被 CSS 隐藏，造成双端行为严重不一致。
3. **严禁拷贝 V3 的原生直接 `fetch()`**：V3 AgentProfile 内绕过 `exo-shared` 直接写裸 `fetch`，缺少统一 CSRF、信号终止与类型保护。
4. **严禁拷贝 V3 的静默异常处理**：如会话读取失败直接设为空数组并返回“无会话”。
5. **严禁拷贝 `CreatePresetModal` 与 `DestructorModal` 针对 Preset 的操作**：后端接口永久 405。
6. **严禁分叉会话详情页与运行时**：严禁创建 `/agent/:id/chat` 等任何私有聊天页面。

---

## 6. 关键差异与边界事实 (Edge Cases & Boundaries)

### 6.1 桌面端与移动端表现
- **V3 现状**: 桌面端具有常驻 `DesktopSidebar` 与页面顶部的 `BackToUpper` 返回条；移动端具有 `MobileHeader` 返回箭标与 `MobileBottomBar` 底栏。在移动端，AgentHub 的拖拽把手被隐藏。
- **V4 规范**: 统一运行于 `AppShell` 之下。桌面呈现左侧导航，移动端呈现底部主导航；在 Agent Profile 详情页（三级页面），按规范移动端隐藏常驻底栏，顶部提供返回上一级（Agent Hub）的标准导航。

### 6.2 异常与缺失边界
- **非法 / 隐藏 Preset ID**:
  - 用户若直接在 URL 中输入不存在或 `is_visible=False` 的 `presetId`（例如 `/agent/999`），系统必须呈现规范的 `NotFoundPage` 或带返回按钮的 `ErrorState`，严禁空白挂起。
- **会话读取失败**:
  - 当 `useConversationsQuery` 处于 `isError` 状态时，必须展示带有「重试」动作的 `ErrorState`，不可显示为“还没有会话”。
- **Avatar 持久化现状**:
  - 当前后端无 Agent 头像存储字段。V3 的客户端 `localStorage` 裁剪方案属于技术债务；在 P2A 中，若无后端支持，建议首期展示确定性 Dicebear / 首字母兜底，待资产规范统一后再引入上传。

---

## 7. 开放问题与裁决建议 (Open Questions & Sol Must Reverify)

在 Plan 二审与施工指令下达前，以下 3 项高风险事实必须由 Solaire (Sol) 显式裁决：

### 7.1 [High-Risk] Agent Profile 中的 Memory 深链落脚点
- **现状**: Library 整体在 V4 当前导航中属于 `enabled: false, phase: 'P4/P5'`。
- **冲突点**: Spec §5.3 要求 Agent Profile 提供“Memory 摘要与管理此 Agent 记忆入口”。若点击该入口，目标路由应去向何方？
- **裁决建议**: 
  - **采用受控语义标签/提示**：在 Memory 摘要旁放置「管理记忆」按钮，但附带清晰的 `P5 开放` 状态标签（类似导航栏的 phase chip），点击弹出非阻塞 Toast 提示能力就绪阶段；
  - **严禁提前创建空壳 `/library/memory` 路由**，避免破坏 Phase 隔离与 capability transfer 纪律。

### 7.2 [High-Risk] P2A 基础壳的“管理读写边界”
- **现状**: 后端支持 `PATCH /api/agents/presets/<id>/` 修改 `name`, `description`, `default_model`, `system_prompt`。
- **冲突点**: P2A 作为基础壳，若直接引入完整的表单内联编辑、Prompt 修改弹窗、模型列表拉取，会导致任务复杂度与测试面剧增。
- **裁决建议**:
  - P2A 基础壳聚焦于：**身份展示 + 名下会话索引与筛选 + 发起会话**；
  - 将 Agent Preset 字段编辑（System Prompt / Model 配置）显式划归为 P2 的次级切片（如 P2A.2 或 P2 Settings/Admin 范畴），或在 P2A 仅做只读展示。

### 7.3 [Medium-Risk] Agent Hub 排序规则收敛
- **现状**: V3 依赖不稳定、易丢失且移动端隐匿的 `localStorage` 拖拽顺序。
- **裁决建议**:
  - 彻底抛弃客户端拖拽排序，收敛为服务端确定性排序：**G045 Prime 永远置顶，标准 Agent 依 ID 递增或名称字母序排列**，保证桌面与移动端绝对一致。

---

## 8. 建议的 P2A 验收清单 (Acceptance Inventory)

二审与施工验收建议以以下用户旅程为二元判定标准：

- [ ] **U-P2A-01: Agent Hub 索引呈现与状态完备**
  - 从主导航 Chat 区域平滑进入 Agent Hub（路由 `/agent-hub` 或 `/agents`）；
  - 确定性呈现全部 8 个 AgentPreset，明确区隔 G045 Prime 与 Standard Agent；
  - 具备真实的 Loading、Error（带重试）、Empty 状态。
- [ ] **U-P2A-02: Agent Profile 基础身份与非法路由兜底**
  - 点击卡片进入 `/agent/:presetId`；
  - 稳定呈现 Agent 身份信息（头像、名称、类型 Badge、描述、当前默认模型、系统提示词预览）；
  - 访问不存在的 `presetId` 时，呈现明确的 `NotFound` / `ErrorState`，并可安全返回，无空白崩溃。
- [ ] **U-P2A-03: 名下会话索引与 Project / Drift 正交筛选**
  - Profile 内部正确展示属于当前 Agent 的所有历史会话；
  - 提供「全部 / Drift / 各 Project」的正交筛选控件；
  - 会话行正确呈现 Project 名称 Chip 或 Drift 样式 Chip，并展示格式化活跃时间；
  - 会话加载异常时显示局部重试卡片，禁止静默掩盖为“无会话”。
- [ ] **U-P2A-04: 从 Agent 发起会话并收敛至 Canonical Chat**
  - 点击 Profile 内部的「新建会话」按钮，唤起会话创建流程；
  - 当前 Agent 被自动作为默认预设绑定；
  - 创建成功后单向跳转至 canonical `/chat/:conversationId`，且在 Recent 列表与该 Agent 名下会话列表均立即可见。
- [ ] **U-P2A-05: 既有会话连通性**
  - 点击列表中的历史会话，正确跳转至 canonical `/chat/:conversationId`，返回时能保持来源上下文。
- [ ] **U-P2A-06: Memory 摘要受控呈现**
  - Profile 区域展示该 Agent 关联质粒的轻量只读摘要，不拉入 ECG 心跳示波器或编辑控制台；
  - 深链入口符合阶段性语义规范。
