# ExoCore V4 — Phase 2C Core Shell + Account + Settings Detailed Plan

> **Document type:** P2C executable implementation plan；仅覆盖 Core Shell、Account/Profile 与当前有效 Settings surfaces，不是整个 Core C2。
> **Status:** **REVISED AFTER MINI-FORK REVIEW — 待 Alicia 审批；本文件不构成施工授权。**
> **Repository:** `ExoCore-Desktop`；生产改动限本仓库的 `packages/app` 与必要的 `packages/shared` 类型声明。`../ExoCore/` 只读。
> **Product authority:** `[human / Alicia]`。
> **Plan / architecture / QC:** `[gpt-5.6-sol / Solaire]`。
> **Mini-fork review / ablation:** 基建复用、过度设计与消融复查 `[deepseek/deepseek-v4-flash / reviewer]`；建议由 `[gpt-5.6-sol / Solaire]` 逐项裁定并收口。
> **Source inventory:** `Plan/P2C_Core_Shell_Settings_Source_Inventory.md`，SHA-256 `b901762110f9dae9085a3be76b5471b252e56366f009ec6748052850d6e5c298`，调查者 `[gemini / Alaric]`。
> **Frozen product defaults:** canonical Account 路由、轻量用量展示、分段施工、通知边界与主题保留由 `[human / Alicia]` 确认；技术落位由 `[gpt-5.6-sol / Solaire]` 冻结。
> **Planning baseline:** Desktop HEAD `0cfa84df97d2341d371fd21ad19041ff2bed5de7`（P2T 已提交）；P2T independent acceptance R9 为 PASS。
> **Planning-time unrelated dirty paths:** `DevelopLog/DebugLog.md`、`Plan/Update_log.md`、`Plan/V4_Master_Implementation_Roadmap.md`、`packages/chat-core/src/main.jsx`、untracked Source Inventory 与 TTS handoff；施工必须原样保留，不能夹带。

---

## 1. 期望效果与本质问题

P2C 让 V4 第一次完整拥有低频系统入口及有效管理表面：

```text
任意 V4 页面
  -> avatar / More
       -> /account
            -> 读取并编辑用户资料、头像、System Prompt
            -> 查看可验证的轻量用量统计
       -> /settings
            -> Endpoints / API Keys
            -> MCP Credentials / Drawer & Agent bindings
            -> Model Roles
            -> Appearance
            -> Routine
            -> Notifications（仅入口与诚实占位）
```

本质问题不是把 V3 Settings JSX 原样搬入 V4，而是建立一个**唯一、诚实、可直开的 V4 系统管理 owner**：

- Shell 入口在 desktop/mobile 均稳定可达；
- Account 和每个 Settings 子页只消费现有真实契约；
- 服务端状态进入 TanStack Query，不保留 V3 的本地 mock-success 分支；
- secret 永不被读回、缓存、日志记录或伪装保存；
- 现有深浅主题及字体偏好继续有效，而不是因 V4 尚未接线而静默消失；
- Notifications 在 P2C 只获得路由与说明，权限、设备名、订阅及运行时仍严格属于 P2D。

### 1.1 Alicia 可观察的验收意图

1. 在 Chat、Agent、Project 与 Message 页面，desktop/mobile 都能打开同一个 More 菜单并进入 Account、Settings 或 Notifications 入口；
2. `/account` 是唯一 canonical Account 页面，旧 `/user` 只做 replace redirect；direct-open 与生产 `/app/` basename 正常；
3. Account 能读取 `agent_type='user'` 的现有 preset，编辑用户名、签名、模型标签和 System Prompt，上传/裁剪头像，并明确显示保存失败；
4. Account 用现有 Telemetry 契约展示周/30 日周期的轻量统计卡片与表格，不引入 `recharts`；
5. `/settings` 及每个有效子路由都可直开、刷新和重试；desktop 与 mobile 不出现导航死角或双滚动陷阱；
6. Endpoints、API Keys、Model Roles、MCP/Drawer、Appearance、Routine 的有效操作全部可达，写后显示后端真相；
7. 深色/浅色、系统/消息/代码字体及 80–150% 字号偏好在整个 V4 生效并跨刷新保留；
8. `/settings/notifications` 明确说明能力将在 P2D 交付，但不读取权限、不显示订阅状态、不配置设备名、不调用 Push API；
9. 已验收的 canonical Chat、TTS、Agent 与 Project 工作区不回归。

P2C PASS 不是 Core C2 PASS。P2D、B6 与统一 C2 acceptance 仍有独立 gate。

---

## 2. 权威基线与施工前漂移门

### 2.1 权威顺序

1. `Plan/V4_Master_Implementation_Roadmap.md` §8.3、§8.6、§16、§17；
2. `[human / Alicia]` 在本轮确认的四项产品默认；
3. 本 Detailed Plan；
4. `Plan/P2C_Core_Shell_Settings_Source_Inventory.md`；
5. 当前 `packages/app` / `packages/shared` 源码与 `ReactSheet.md`；
6. 只读 Django serializer/view/service 的真实运行契约。

V3 是行为证据，不是架构模板。若 V3 与后端真实契约冲突，以后端契约和本 Plan 的产品裁定为准，不迁移 mock、stale enum 或错误文案。

### 2.2 已核实的关键事实

- `packages/app` 当前没有 Account/Settings feature，也没有 `recharts`；本计划不新增该依赖。
- `queryKeys.presets` 已是 visible preset 列表的 canonical Query；Account 和 Routine 必须复用它，不建第二份 preset 列表。
- 用户资料事实是列表中唯一 `agent_type === 'user'` 的 row；PATCH 使用 `/api/agents/presets/<id>/`，POST/DELETE 不允许。
- Telemetry `/api/telemetry/usage/` 返回 `{daily, from, to, is_current}`；daily row 按 model 给出 input/output/cached token 与 conversation count。
- SystemConfig 允许写 `self_check_preset_ids` / `deep_org_preset_ids`，时间窗口字段在后端同样可写；但 V3 没有有效时间编辑面，P2C 只读展示，不借迁移扩大写面。
- Endpoint 只允许写 `name/provider/api_key_alias/enabled`；provider 派生字段只读；删除被引用时为 409。
- ApiKey secret 只写；列表只返回 alias/platform/last_four/timestamps；`platform` 是创建必填的真实字段，不同于 Telemetry 的失效筛选字段。
- Model Roles 是整包 PUT，main 至少一项且四个 support role 必须齐全；Endpoint/model compatibility 最终由后端验证。
- V4 已有 model catalog owner：`features/chat/audio/audioTarget.ts` 的 `['model-catalog']` Query、`fetchModelCatalog` 与 `validateModelCatalog`；P2C 必须复用并提升为跨 feature seam，不能新增第二个 key/owner。
- MCP 返回对象 envelopes，不是任意 array fallback；preset binding enum 是 `inherit_public | dedicated`，不是 V3 旧命名。
- MCP credential secret 是 opaque write-only 值；前端不得 trim、回显或记录。
- `useTheme`/`useFont` 已持有 V3 localStorage key，但 V4 未全局挂载、未做首屏 bootstrap，也未完整消费变量。
- V4 CSS 有 115 处 px 字号和 92 处直接颜色/overlay 值；完整外观迁移必须做受控 token/scale 审计，不能只给 Settings 页换色。

### 2.3 Builder 开工前的最小复核

开工前只重读将修改的真实定义，不重复大范围调查：

- `router.tsx`、`AppShell.tsx`、`PrimaryNavigation.tsx`、`navigation.ts`；
- Chat/Agent/Project 六个页面的 topbar 与 Query 使用方式；
- `features/chat/{types,api,queries}.ts` 中 preset owner与唯一 `AppApiError/contractError/toAppApiError`；
- `features/chat/audio/audioTarget.ts` 中现有 model catalog key/fetch/validator/consumer；
- `packages/shared/src/{profile.js,hooks/useTheme.js,hooks/useFont.js,styles/fonts.css}`；
- `ReactSheet.md` §1.1、§3.1、§3.3、§3.5–3.7、§5.1、§10；
- 必要时只读核对 Django 的 `AgentPresetSerializer`、`SystemConfigSerializer`、`EndpointSerializer`、`RoleConfigSerializer` 与 Drawer/MCP views。

以下任一事实漂移必须停手报告：用户 preset 判定、PATCH 字段、Telemetry envelope、Endpoint 可写字段、Role 完整集、MCP envelope/enum、Notifications 所有权或 `exo_*` 持久化 key。

---

## 3. 冻结产品与架构决策

### D1 — Account canonical route

`/account` 是 canonical 路由；`/user` 仅执行 replace redirect 到 `/account`，不渲染第二份页面、状态或标题。`[human / Alicia; gpt-5.6-sol / Solaire]`

Settings canonical routes为：

- `/settings` → replace redirect `/settings/keys`；
- `/settings/keys`；
- `/settings/mcp`；
- `/settings/models`；
- `/settings/appearance`；
- `/settings/routine`；
- `/settings/notifications`。

不注册 `/settings/memory`；Memory/History 管理仍归 P5。

### D2 — More 是唯一系统入口，Account/Settings 是 focused shell pages

More 保持一级产品导航之外的低频系统菜单，不向 bottom bar 增加第五个产品项。三个条目分别导航到 `/account`、`/settings`、`/settings/notifications`，选择后关闭菜单。desktop/sidebar 与 mobile/topbar 使用同一个菜单数据和组件。`[gpt-5.6-sol / Solaire]`

Account 及所有 Settings 路由在 mobile 被视为 focused pages：隐藏底栏、释放全高，并提供明确的“返回 Chat”链接，因此 direct-open 不依赖浏览器历史。Agent Hub/Profile、Project Hub/Detail 补齐 mobile More；既有 Chat Home/Conversation 保持原入口。

进入 Account/Settings 时不高亮 Chat 或任何未来产品区域，这是系统管理而非 Chat 子区。

### D3 — 文档标题只有一个 owner

新增一个共享 `useDocumentTitle` seam；每个路由页面只提交其业务标题，hook 负责统一后缀、更新与卸载/切换纪律。禁止页面散落直接写 `document.title`。`[gpt-5.6-sol / Solaire]`

标题目标：

- Chat Home、Conversation 名称；
- Agent Hub、已加载 Agent 名称；
- Project Hub、已加载 Project 名称；
- Account；
- 当前 Settings section；
- Not Found / route error。

实体未加载或加载失败时使用稳定的通用标题，迟到的旧实体响应不得覆盖新路由标题。

### D4 — Account 复用 preset Query，写入字段严格 allowlist

Account 从 `queryKeys.presets` 找唯一 `agent_type='user'` row。0 条时显示“用户资料未配置”错误且不发 PATCH；多条时显示契约错误且不猜第一条。`[gpt-5.6-sol / Solaire]`

可编辑字段仅：

- `name`：trim 后非空；
- `description`：允许空串；
- `default_model`：作为用户模型标签，允许空串；
- `system_prompt`：允许空串。

每次提交只发送当前编辑面的字段，不发送 `agent_type/is_visible/id`。写成功后失效 `queryKeys.presets`，并失效同 ID 的既有 Agent detail key（若存在）；显示 refetch 后的服务端真相。失败保留草稿并显示 field/general error。未知写结果禁止自动重试。

### D5 — 头像仍是本地用户偏好，但失败必须可见

头像沿用 `exo_user_avatar` 与现有 StorageEvent 跨 tab 契约。More 与 Account 共享一个 app-local avatar observer；合法头像显示 `<img>`，读取/解码失败回退 User icon。`[gemini / Alaric; gpt-5.6-sol / Solaire]`

Account 保留选择图片、裁剪、缩放和确认保存；裁剪输出为受控尺寸的 image Data URL，不上传后端。文件不是可解码图片、Canvas 失败或 localStorage quota/security 失败时显示明确错误，不静默关闭。object URL、Canvas 与事件监听器必须释放。

不新增头像后端接口，不修改 agent avatar key，也不建立全局 profile store。现有 `getUserAvatar()` 的默认值是 Dicebear 外链：P2C 保留该 V3 parity；允许其发起默认头像请求，离线、阻断或解码失败时回退本地图标，不把外链可用性当 Account 成败。

### D6 — 用量统计为轻量卡片/表格，不引入图表依赖

P2C 不引入 `recharts`、自制折线 SVG 或 canvas chart。`[human / Alicia; gpt-5.6-sol / Solaire]`

保留有真实契约支撑的行为：

- 周（7 日）/月（后端定义的 30 日）切换；
- 前后周期切换；
- Input / Output / Cached / Conversations 汇总卡片；
- 按日期与 model 的响应式明细表；
- loading / true empty / malformed / network error / retry 独立状态。

V3 平台筛选读取了静态 registry 中不存在的 `platform` 字段，实际没有可靠筛选事实；Telemetry response 也不携带 provider/family。P2C 因此**不迁移该失效开关**，不额外请求 model catalog、不按 model 名称猜 provider。明细表直接按 model 展示，保留所有可验证数据。若后续 Telemetry 契约增加 provider/family，再单独恢复平台筛选。

### D7 — Settings shell 只负责 section 导航与一个滚动 owner

Settings layout 是一个 feature shell，不复制 AppShell。desktop 使用持久 section rail；mobile 使用可横向滚动/紧凑 section selector，并始终显示当前 section。每个子路由直接渲染自己的 panel；不得在 panel 内再建全屏 page shell或形成双层纵向滚动。`[gpt-5.6-sol / Solaire]`

路由切换关闭旧 section 的 dialog、清理 secret 草稿和局部成功/失败提示；已确认的服务器写仍执行对应 Query invalidation。

### D8 — Appearance 是全 V4 能力，不是 Settings 局部预览

深色/浅色为现有有效能力，必须默认迁移，不得静默砍掉。`[human / Alicia]`

实施要求：

1. App 初始 HTML 在 React 挂载前只读取/校验受支持的 theme/font/scale key并设置 theme、font-key attributes与 scale variable；不复制 FONT_STACKS、不执行 legacy migration，迁移仍由 shared hook独占；
2. React 侧只在 App 边界挂载一次 `useTheme/useFont`，经 `AppearanceContext` 下发同一实例；Settings panel 只消费 Context，禁止再挂第二份 hook state；
3. `base.css` 定义 dark 与 `[data-theme='light']` 的完整语义 token，并分别设置 `color-scheme: dark/light`；
4. V4 `AppearanceProvider` 在每次主题变化后把 `<meta name='theme-color'>` 纠正为当前 V4 `--v4-bg`；不接受 shared hook 的 V3 `#050505` 暗色值成为最终 V4 chrome 色；
5. 将 theme-sensitive hardcoded hover、overlay、shadow、scrollbar、code/highlight、status surface 收敛到 token；固定品牌色或强调按钮上的白色仅在双主题对比度通过时保留；D8 是必须满足的原则，§8.3 的真实命中清单是改动范围上限；
6. 保留 `github-dark.css` 现有 import，但在后加载的 app-owned CSS 中用 `[data-theme='light']` scoped syntax tokens覆盖 `.hljs` 及实际使用的 token classes；不运行时切换第二份 stylesheet；
7. 系统字体作用于 shell/settings/general UI，消息字体作用于 message content/composer，code 字体作用于 code/pre/trace/technical labels；
8. V4 每个真实命中的 px 字号以 `calc(<原 px 数值> * var(--exo-font-scale, 1))` 接线；100% 与施工前逐像素一致，80/150% 只缩放文本，不用整页 `zoom`。

外观写入是本地同步操作，不触发 API。刷新与跨 tab 后选择态和实际 computed style 必须一致。

### D9 — Routine 保留现有有效部分，时间编辑继续 omitted/disabled

Routine 复用 `queryKeys.presets`，仅展示 `agent_type='g045'`。它保留 V3 的“Self Check & Deep Organize 共用 Agent 列表”语义：一次保存向 `self_check_preset_ids` 与 `deep_org_preset_ids` 写入相同、去重的正整数数组。`[gemini / Alaric; gpt-5.6-sol / Solaire]`

时间窗口只读展示 `active_start/active_end/deep_org_weekday/deep_org_hour`；不渲染可操作的“时间设置”按钮，不写任何时间字段。Config 或 Presets 任一失败都不能伪装为空；保存成功后 refetch config，失败保留选择草稿。

### D10 — Endpoints、API Keys 与 Model Roles 共用一组 typed fact owners

新增 Settings typed adapter/query 层，直接使用 `exo-shared/api::apiFetch`，不把无类型的 V3 component state 迁入 V4。所有失败复用 `features/chat/api.ts` 中现有唯一 `AppApiError/contractError/toAppApiError`；P2C 不创建第二个错误 class或 mapper。`[deepseek/deepseek-v4-flash / reviewer; gpt-5.6-sol / Solaire approved]`

- **Model Catalog**：把 `audioTarget.ts` 已有 `['model-catalog']` key/fetch/validator窄幅提取到中立的 app-shared module；原 Chat/audio consumer与 Settings共同复用同一个 key。增强同一 validator以覆盖 Settings实际消费的 providers、support roles和 endpoint execution字段，不另建 Settings catalog adapter。
- **Endpoints**：独立列表 Query；表单只提交四个可写字段，provider 选项来自 catalog providers；只读 derived 字段只展示。
- **API Keys**：独立列表 Query；新增/重命名/overwrite/delete 使用真实 endpoint；创建表单必须选择真实 `platform`，列表可按该字段在前端分组，但只保留一个 all-list Query；明文只存在于当前表单内。
- **Model Roles**：编辑 draft 从 catalog roles 建立；main 支持增删与明确上移/下移，position 按提交顺序生成；四个 support role 必须齐全；候选 endpoint 必须同时满足 `compatible_endpoint_ids`、configured/enabled 及后端要求的 `direct_api + internal_http`，最终错误仍由后端显示。

不迁移 `MOCK_CATALOG`、`MOCK_ENDPOINTS`、fallback success 或静态 provider 列表。写后只失效受影响 facts：key 变更需刷新 keys/endpoints/catalog；endpoint 变更需刷新 endpoints/catalog；role PUT 刷新 catalog。不得 clear 全 QueryClient。

删除/覆写等破坏性或 secret 操作使用 app dialog 原语，不使用 `window.confirm`。409、field errors 与一般网络错误必须分别可见。

### D11 — MCP/Drawer 严格服从 strategy 与稳定错误信封

MCP 使用同一 Settings adapter/query 层的 typed envelopes：Drawer catalog、server catalog、credential list、preset drawer matrix、preset server bindings。`[gpt-5.6-sol / Solaire]`

- credential create/overwrite 的 secret 原样提交（不 trim），成功/关闭/route switch 后从 state 和 DOM 清除；
- alias 可 trim，但不得含 `/`；响应中若意外出现 secret 字段，adapter 视为 contract error，不让它进入 Query cache；
- 当前 backend registry 的 Galatea/Moonlight 均为 `per_preset`，P2C 只读展示 server strategy/public-binding 状态，**不暴露 public-binding PUT 编辑面**；待真实 `shared/shared_or_per_preset` server进入 catalog后再单独释放；
- preset binding 严格使用 `inherit_public/dedicated`；当前 `per_preset` 只允许 dedicated；adapter仍严格识别完整 strategy enum，但不为当前不可达 strategy制造编辑 UI；
- Drawer `available`、visitor `enabled`、credential `ready` 是三个不同事实，UI 不互相推断；
- mutation pending 时只锁定目标 row，不锁死整个 panel；失败不乐观伪造成功，成功用响应或 refetch 恢复服务端真相。

Agent selector复用 visible preset Query，排除 `agent_type='user'`；同名 preset 仍按 ID 区分。V3 的“为所有 preset 并行请求 binding 以推导 assigned agent map”不是核心验收要求，P2C 不引入该 fan-out；删除冲突以真实 409 `credential_in_use` 为准。删除确认文案不得声称已知“被哪些 preset 使用”，因为 P2C 不读取该映射。

### D12 — Notifications 是 entry-only hard boundary

`/settings/notifications` 仅显示一个有界说明面，说明订阅、权限、设备名、到达、未读、点击将在 P2D 交付。More 的“通知”条目直达该页。`[human / Alicia; gpt-5.6-sol / Solaire]`

P2C 源码与测试不得：

- 读取 `Notification.permission`；
- 调用 `navigator.serviceWorker.ready`、`PushManager` 或 `pushManager.getSubscription()`；
- 读写 `exo_push_device_name`；
- import/call `pushApi` 或 `/api/push/*`；
- 渲染权限状态、订阅状态、设备名输入、启用/关闭按钮；
- 增加 arrival listener、unread badge、OS notification 或 click/deeplink runtime。

### D13 — shared 类型只补消费契约，不重写 shared runtime

Planning source 已确认 `exo-shared/profile`、`useFont`、`useTheme` 缺 TypeScript declarations。P2C 新增对应 `.d.ts` 并在 `packages/shared/package.json` export 中声明 types。声明必须与现有 JS runtime 逐项一致；不得借机重写 V3 hooks、改 key、改默认值或引入新 dependency。`[gpt-5.6-sol / Solaire]`

---

## 4. Scope 边界

### 4.1 包含

- `/account` canonical、`/user` redirect；
- `/settings` shell 与 D1 列出的五个有效管理 panel + Notifications placeholder；
- More menu 实际导航、真实 user avatar、mobile topbar 入口补齐；
- Account preset edit、System Prompt dialog、avatar crop、Telemetry cards/table；
- typed Settings API/Query/mutation owners及显式 async/error states；
- Endpoint/API Key、Model Roles、MCP/Drawer、Appearance、Routine 的有效管理能力；
- 全 V4 document title、theme/font/scale 应用与必要 CSS token 审计；
- focused construction tests、全量 regression、browser evidence、Construction Evidence；
- 补齐已确认缺失的 `packages/shared` profile/theme/font 类型声明。

### 4.2 明确排除

- 任何 Django、migration、nginx、PWA service worker 或 sibling repo 修改；
- Push permission、订阅、设备名、arrival、unread、click/deeplink runtime；
- MemoryConsole、HistoryChunk、MemoryPlasmid、Manage Memory dead link；
- Routine 时间编辑、Heartbeat policy 编辑、Calendar credentials；
- ModelEntry CRUD、ProviderProfile CRUD、任意 base URL/processor/adapter 编辑；
- AgentPreset create/delete/type/visibility 管理；
- 新图表库、自制图表框架、通用 Settings schema/form generator；
- GroupChat、River、Library、Council、Capacitor；
- V3 页面重构或删除；
- backend contract 未支持的本地 mock success/offline edit queue。

### 4.3 后继所有权

- P2D 接管 Notifications 设置的真实权限/订阅面与 arrival runtime；
- P5 接管 Memory/History 管理；
- P2G 以后独立接管 GroupChat；
- 统一 C2 acceptance 只在 P2C + P2D 完整 PASS 后执行。

### 4.4 Backend 配合结论

P2C **没有 backend production blocker，也不要求新增/修改 API**。当前 preset、Telemetry、SystemConfig、Endpoint、ApiKey、model catalog/roles与MCP/Drawer contracts足以完成本计划。以下不是 P2C 后端代码依赖：

1. 两仓 `ReactSheet.md` §10 仍写着 “Backend Pending”，但对应 URL/views/tests 已实现；P2C final closeout前由两仓各自owner同步做一次**文档状态勘误**，只删过期pending说明，不改变接口契约。Desktop Builder不得越仓修改 `../ExoCore/ReactSheet.md`。
2. B6 Assistant-message Arrival/Notification 是 **P2D** 的后端前置，不是 P2C 前置；当前 `../ExoCore/Plan/B6_Assistant_Message_Arrival_Notification_Backend_Detailed_Plan.md` 仍为 DRAFT，尚无 B6 PASS证据。P2C可独立施工/验收，但P2D不能在 `P2C PASS + B6 PASS` 前释放。
3. Telemetry provider/family、server-side avatar与shared-strategy MCP server都是未来可选增强；P2C已通过范围裁定避开这些新后端需求，不把它们升级为阻塞项。

---

## 5. 代码结构与状态所有权

预期结构允许 Builder 合并小 leaf，但不得跨层泄漏 API：

```text
packages/app/src/
  shared/
    modelCatalog.ts      extracted existing key/fetch/validator, not a second owner
    useDocumentTitle.ts
    userAvatar.ts
  app/
    AppearanceProvider.tsx
  features/account/
    api.ts / queries.ts / projection.ts
    AccountPage.tsx
    AvatarCropDialog.tsx
    UserPromptDialog.tsx
    UsageSummary.tsx
    account.css
  features/settings/
    types.ts / api.ts / queries.ts
    SettingsLayout.tsx
    KeysPanel.tsx
    ModelRolesPanel.tsx
    McpPanel.tsx
    AppearancePanel.tsx
    RoutinePanel.tsx
    NotificationsPlaceholder.tsx
    settings.css
```

原则：

- page/layout 只协调 Query、局部 draft 与 dialog；API shape normalization 全在 adapter；
- 不按每个按钮创建 hook，不创建 generic CRUD framework；
- secret draft 永不进入 Query、URL、localStorage、evidence 或 console；
- dialog focus/escape/restore 复用 `dialogA11y` 和现有 dialog CSS 原语；
- 0/404/contract/network/empty 不互相伪装。

### 5.1 Query key 家族

复用：

- `queryKeys.presets`；
- `agentQueryKeys.preset(id)`；
- 已有 `queryKeys` 其余家族仅作为 regression，不由 Settings 重建。

复用既有跨 feature 家族：

- `['model-catalog']`：从 `audioTarget.ts` 提取 key/fetch/validator到中立 module，但 key identity保持不变；Chat/audio、HUD、Endpoint与Model Roles共享。

新增单一 Settings 家族：

- system config；
- usage by `{mode, from}`；
- endpoints；
- API keys（单一 all-list Query；创建保留 platform，展示分组只做前端派生）；
- Drawer catalog；
- MCP servers；
- MCP credentials（单一 all-list Query；server filter只在前端派生）；
- preset drawers by preset ID；
- preset MCP bindings by preset ID。

同一事实不得同时由 `useEffect + useState` 和 Query 保存。UI draft 是局部状态；服务端 row 是 Query truth。

### 5.2 Guard 与错误规则

- 每个顶层 object/array envelope 必须严格验证；畸形 2xx 不降级为空。
- 正整数 ID、required string/boolean、enum 与 rendered number 必须验证；不为未消费字段建立通用 schema engine。
- 204 不解析 JSON。
- `features/chat/api.ts` 的现有 `AppApiError/contractError/toAppApiError` 是唯一错误身份；Settings直接复用，MCP `{error,code}` 和 409 code 原样保留给 UI。
- 明确区分 definite failure 与 accepted-but-malformed write；后者锁住自动重试并要求 refetch/人工确认，避免重复创建 secret/key/endpoint。
- Query 可 retry 的 read error 由用户触发；管理 write mutation 不自动 retry。

---

## 6. 分段施工与 Checkpoint holds

P2C 必须串行分段；Alicia 释放 pane，Plan 自身不派发 Builder/Reviewer。每个 checkpoint 只验收本段和直接 predecessor regression；最终才跑全量双主题/多宽矩阵。任何 checkpoint FAIL 只修当前 invariant，不提前施工后段。

### CP C-1 — Shell、routes、title 与 Account

实施：

1. 只注册已释放的 `/account` 与 `/user` redirect；不注册未施工 Settings route，不创建随后删除的临时保护页；
2. More 的 Account 条目先激活，Settings/Notifications继续显示未释放状态；接入 avatar observer、outside click/Escape/focus 行为；
3. Agent/Project Hub/Detail 补齐 mobile More，保持各自原 topbar 动作；
4. Account focused route/bottom-bar policy 与 direct-open 返回路径；
5. shared document-title owner并接入所有现有 route pages；
6. Account identity、四字段 PATCH、Prompt dialog、avatar crop；
7. Telemetry 轻量汇总/表格与周期导航，不接 model catalog、不渲染 platform filter。

**C-1 Hold：** Shell 可达性、canonical redirect、标题、Account 读写隔离、avatar lifecycle、Telemetry 真相和现有 Chat/Agent/Project topbar regression 全部通过后，才进入 Appearance/Settings foundation。

### CP C-2 — Settings shell + Appearance + Routine + Notifications boundary

实施：

1. 建立 Settings desktop/mobile layout及 section配置，但只注册本段已完成的 `/settings/appearance`、`/settings/routine`、`/settings/notifications`；未完成 Keys/Models/MCP不进入导航或路由；
2. 全局单实例 theme/font/scale bootstrap/provider；
3. dark/light token 与全仓 hardcoded overlay/highlight 审计；
4. Appearance control + previews；
5. Routine shared g045 selection + schedule read-only；
6. Notifications entry-only placeholder并激活 More 的 Notifications直达项；Settings总入口仍保持未释放；
7. 固定精简矩阵：100% 在 320/390/1280 覆盖双主题；80/150% 在 390 覆盖双主题；767/768 只做 dark+100% 断点检查。

**C-2 Hold：** 主题/字体不是只在 Settings 生效；刷新无错误主题闪烁；字号极值不遮挡 canonical Chat/Agent/Project/TTS 关键动作；Notifications forbidden scans 为零，方可进入 credential/model writes。

### CP C-3 — Endpoints + API Keys + Model Roles

实施：

1. 提取并增强既有 model-catalog owner，保持 `['model-catalog']` key；实现 endpoints/keys typed adapters与Queries；
2. Endpoint create/edit/delete及 provider/key compatibility presentation；
3. API Key create/rename/overwrite/delete、真实 platform选择/分组与 secret hygiene；
4. Model Roles full-set editor、兼容选择、排序与 whole PUT；
5. 注册 `/settings/keys`、`/settings/models`，此时启用 canonical `/settings` → `/settings/keys` 与 More 的 Settings总入口；
6. 写后精确 invalidation、409/field/network/ambiguous outcome；
7. no-mock/no-secret focused source checks。

**C-3 Hold：** 三组管理面在 partial failure 下互不伪装；每个 request body 只有允许字段；secret 不回显/持久化；catalog 与 chat target consumers 在写后不会继续使用旧事实，方可进入 MCP。

### CP C-4 — MCP/Drawer closure + final regression/evidence

实施：

1. MCP typed envelopes、Drawer/server/credential/preset query owners；
2. credential CRUD、当前 per-preset dedicated binding、Drawer visitor toggle；`/settings/mcp` 只在本段完成后注册；
3. strategy/availability/enabled/readiness 的独立呈现；
4. target-row pending、route/preset switch stale-result isolation、409/error code；
5. 同步修正本仓 `ReactSheet.md` §10 的过期 Backend Pending 状态说明，并核对 backend owner已同步其副本；不改变接口shape；
6. 全量 tests/typecheck/lint/build、dev/prod browser matrix、scope scan与 Construction Evidence。

**C-4 / P2C Final Hold：** §7 全部二元目标有事实证据且独立 acceptance 判定 P2C PASS。该 PASS 不自动授权 P2D、统一 C2、commit 或 push。

### 6.1 停工/升级条件

出现以下任一情况，Builder 停手并交 Alicia：

- 任一有效 Settings surface 需要新 backend endpoint/字段/enum；
- theme/light 需要删除已验收功能或无法在冻结宽度/字号下保持可用；
- MCP runtime 与 ReactSheet 的 envelope/strategy 不一致；
- 用户 profile 事实不再能唯一解析；
- Notifications placeholder 需要读取 permission/subscription 才能“正确展示”；
- 施工必须修改 V3、service worker、backend 或 independent acceptance-owned files；
- shared worktree 中出现同文件并发 owner。

---

## 7. 二元验收目标（只冻结目标/接口，不冻结测试实现）

### 7.1 Baseline、scope 与 owner

- [ ] 开工/收工 HEAD、dirty ownership 与 owned file manifest 有记录；unrelated dirty paths 字节级保留。
- [ ] 无 Django/V3/service-worker/nginx/new dependency 改动；`recharts` 未加入 app。
- [ ] `/account` 只有一个实现；`/user` 只 replace redirect；每个 Settings fact 只有一个 Query owner；model catalog仍只有既有 `['model-catalog']` key。
- [ ] source scan 无 V3 mock catalog/endpoints、mock success、silent catch、新 global store 或 generic CRUD framework。
- [ ] real DB 不新增/删除/改 PK `AgentPreset`；opening/closing baseline 仍为固定 8 行。

### 7.2 Shell、route、More 与 title

- [ ] desktop sidebar 与所有 mobile topbar 能打开同一 More 菜单；三项均可键盘访问并到达正确 canonical route。
- [ ] More outside click、Escape、route selection 后关闭；focus 不丢失到不可见元素。
- [ ] Account/Settings mobile 隐藏 bottom bar且有 direct-open 可用的返回 Chat 路径；Chat/Agent/Project 原 focused policy 不变。
- [ ] Account/Settings 不错误高亮 Chat；现有 Chat/Agent/Project active state不回归。
- [ ] `/app/account`、`/app/user`、每个 `/app/settings/*` production refresh/direct-open 正常。
- [ ] 所有现有及新增 route title 正确；A→B 迟到数据不把 B 的 title 改回 A。
- [ ] Not Found/invalid detail/error route 有诚实标题，不永久残留上一页实体名。

### 7.3 Account/Profile

- [ ] 唯一 user preset 正常显示；0 条、多条、malformed list、network failure 分别可见且不发错误 PATCH。
- [ ] name/description/default_model/system_prompt 只提交当前允许字段；`agent_type/is_visible/id` 永不进入 body。
- [ ] field/general/network/ambiguous write outcome 可区分；失败保留草稿，成功 refetch preset truth。
- [ ] Account 写后 More/Account/任何已存在的相同 preset consumer 同步，不维护第二份 profile cache。
- [ ] avatar 选择、解码、拖动/缩放、确认、取消、StorageEvent 同步可用；失败显式且资源释放。
- [ ] More avatar load error 回退 icon；无头像失败导致 shell 崩溃。
- [ ] Manage Memory dead link、AgentPreset create/delete/type change 不出现。

### 7.4 Usage statistics

- [ ] week/30-day request 使用正确 `mode/from`；周期前后切换不混淆迟到响应。
- [ ] cards 精确汇总当前过滤 rows 的 input/output/cached/conversation values；0 是真实 0，不与 empty/error 混淆。
- [ ] table 保留 date/model 身份与 backend order；长 model 名不造成 document overflow。
- [ ] 不渲染无可靠契约的 provider/platform filter；未知 model 仍按原名完整出现在明细表。
- [ ] malformed envelope、network error、retry、true no-usage 可区分。
- [ ] 无 chart dependency、假趋势图或百分比推断。

### 7.5 Settings layout + Appearance

- [ ] `/settings` redirect keys；六个 section direct-open、当前态和标题正确；`/settings/memory` 不存在。
- [ ] desktop rail/mobile selector 在 320/390/767/768/1280 可达，无双层纵向滚动与 document 横向溢出。
- [ ] theme/font/scale 在 React 前正确 bootstrap；React只挂一个 appearance hook owner，刷新和跨 tab 同步后控制态与 computed style 一致。
- [ ] dark/light 的 `color-scheme` 与最终 meta theme-color分别匹配 V4主题；shared hook的V3暗色 meta值不会残留。
- [ ] dark/light 下 shell、Chat、dialogs、TTS、Agent、Project、Settings 的 text/border/overlay/highlight/status 可读；app-owned scoped override覆盖 light code blocks，不被静态 github-dark import反压。
- [ ] system/message/code font 分别作用于冻结目标区域；缺字体时 fallback 可读；inline bootstrap不复制font stacks或legacy migration。
- [ ] 80/100/150% 真正改变全部用户文本而非整页 zoom；100%与施工前px几何一致，极值下关键动作可滚动到达且不重叠。
- [ ] reduced-motion、safe area、bottom-bar height与既有 focus ring 不回归。

### 7.6 Routine + Notifications negative invariants

- [ ] Routine 只列 g045，checked-first 只改变展示顺序，不改变提交 identity。
- [ ] 保存向两个字段提交相同去重 ID 数组；失败保留 draft，成功 refetch。
- [ ] Config/Presets 任一失败不显示假 empty；schedule 缺字段显示未知而非猜测。
- [ ] 不存在可操作时间设置、时间字段 PATCH 或 Heartbeat policy 编辑。
- [ ] Notifications route/nav/说明面存在且明确指向 P2D。
- [ ] source/runtime probes证明未读取 Notification/PushManager/serviceWorker subscription，未触碰 device-name storage，未请求 `/api/push/*`。
- [ ] 无 permission/subscription/device 状态卡、开关、输入、unread badge或 arrival listener。

### 7.7 Endpoints + API Keys

- [ ] lists 的 loading/empty/contract/network/retry 独立；失败无 fallback rows。
- [ ] Endpoint create/edit body 仅四个 writable 字段；provider来自 catalog，managed provider 不接受 API key alias。
- [ ] derived endpoint fields 只读；enabled/configured 不混为一个状态。
- [ ] Endpoint delete pending防重复；409 `endpoint_in_use` 保留 row并显示可操作错误。
- [ ] API Key list永不包含/显示 `key_value`；create保留后端必填platform选择，list可按真实platform前端分组；create/overwrite secret只存在于当前 dialog并在离开后清除。
- [ ] alias rename 使用原 alias identity且 URL encode；delete copy说明同值级联影响；失败不删本地 row。
- [ ] key/endpoint 写后受影响 catalog、endpoint和key consumers refetch；无全局 cache clear。
- [ ] accepted-but-malformed create 不自动重试，避免重复 key/endpoint。

### 7.8 Model Roles

- [ ] draft 从真实 catalog roles 建立；main position/order稳定，增删/上移/下移可键盘完成。
- [ ] main 至少一项，四个 support role 必须齐全；不提交 legacy flat role array。
- [ ] model/endpoint options只来自 catalog与 compatibility projection；不选择 disabled/unconfigured/incompatible endpoint。
- [ ] style shadow 只用可接受 model或 null；UI 不把 `auto` 字面量提交后端。
- [ ] dirty state、pending lock、field/general error和成功 refetch明确；失败不改 Query truth。
- [ ] Role 保存后 canonical chat target/model consumers下一次读取不使用陈旧 catalog。

### 7.9 MCP credentials / Drawer bindings

- [ ] 五类 GET envelope严格验证；裸 array或畸形 2xx 显式 contract error，不当 empty。
- [ ] MCP secret原样提交、不 trim、不回显、不存储、不进入日志/evidence/Query；意外响应 secret fail closed。
- [ ] alias/server filters与 URL encoding正确；credential delete 409 保留 row和binding truth。
- [ ] 当前 per-preset server只读显示public-binding状态，不出现public-binding编辑/PUT；未来shared strategy不在本期伪实现。
- [ ] preset selector排除 user，按 ID 隔离同名；A→B 迟到响应不写入 B。
- [ ] `inherit_public/dedicated` payload与 strategy匹配；dedicated alias只能来自同 server。
- [ ] Drawer unavailable不等于disabled，enabled不等于credential-ready；三态在 UI 中可区分。
- [ ] row mutation只锁当前 row；失败无 optimistic success，成功 refetch matrix/status。
- [ ] 无全 preset fan-out assigned-map、任意 Drawer name创建或 MCP runtime dispatch改动；credential删除文案不声称知道具体引用preset。

### 7.10 质量流水线

- [ ] 每 checkpoint focused construction tests 0 fail，报告 numeric totals。
- [ ] fresh independent acceptance probes 由独立 owner 另行维护；Builder 不编辑 `src/acceptance/**`。
- [ ] `NODE_OPTIONS=--no-experimental-webstorage pnpm --filter exo-app test:run` 0 fail。
- [ ] `pnpm --filter exo-app typecheck`、`lint`、`build` 全通过。
- [ ] `git diff --check` 与 staged whitespace check 通过。
- [ ] dev + production bundle覆盖核心 320/390/1280；Appearance按C-2固定精简矩阵覆盖双主题/字号极值，767/768只验证断点边界。
- [ ] 无真实 secret 输出、paid provider call、真实用户 preset mutation或真实管理配置破坏性写入作为自动验收手段；write flows使用 mocked HTTP/isolated test data，人工 live write需 Alicia 另行授权。

---

## 8. 关键文件清单（planning-time，施工按符号重定位）

### 8.1 Create（允许按内聚性合并 leaf）

- `packages/app/src/shared/modelCatalog.ts`（从现有 audio owner提取，保持query key）
- `packages/app/src/shared/useDocumentTitle.ts`
- `packages/app/src/shared/userAvatar.ts`
- `packages/app/src/app/AppearanceProvider.tsx`
- `packages/app/src/features/account/*`
- `packages/app/src/features/settings/*`
- `packages/app/src/test/p2c_shell_account*.test.tsx`
- `packages/app/src/test/p2c_appearance_routine*.test.tsx`
- `packages/app/src/test/p2c_keys_models*.test.tsx`
- `packages/app/src/test/p2c_mcp*.test.tsx`
- `Plan/V4_Phase_2C_Construction_Evidence.md`
- `packages/shared/src/profile.d.ts`
- `packages/shared/src/hooks/useFont.d.ts`
- `packages/shared/src/hooks/useTheme.d.ts`

### 8.2 Modify

- `packages/app/index.html`（pre-React appearance bootstrap）
- `packages/app/src/main.tsx`（global appearance/font CSS/provider接线）
- `packages/app/src/app/router.tsx`
- `packages/app/src/features/chat/audio/audioTarget.ts`（改为复用提取后的catalog seam）
- `packages/app/src/shared/ErrorBoundary.tsx`（route-error title）
- `packages/app/src/shell/AppShell.tsx`
- `packages/app/src/shell/PrimaryNavigation.tsx`
- `packages/app/src/shell/navigation.ts`
- `packages/app/src/styles/base.css`
- `packages/app/src/styles/shell.css`
- 当前 Chat/Agent/Project route pages（只补 title / mobile More，不重写业务）
- theme/scale 审计真实命中的 `packages/app/src/features/**/*.css`
- `packages/shared/package.json`（只为上述三个 module declarations 补 types export）
- `ReactSheet.md`（仅§10过期 Backend Pending 状态勘误；与 backend owner同步）
- `Plan/Update_log.md`（仅完工登记；保留 sibling edits）

### 8.3 Delete

- 无。

不得提前把所有可能 CSS 文件列为必改；只有 hardcoded token/scale audit 的真实命中且影响双主题/字号验收时进入 owned diff。

---

## 9. Construction Evidence 与 handoff

Builder 只维护 `Plan/V4_Phase_2C_Construction_Evidence.md`，记录事实而非自授 PASS：

- entry HEAD、dirty ownership、每 checkpoint changed symbols/files；
- Source Inventory hash与施工前 drift复核；
- endpoint/body/envelope/error cases及 numeric test totals；
- secret-safety、Push-negative、mock-negative source scans；
- 每 checkpoint focused evidence与最终 full pipeline；
- dev/prod多宽、双主题、字号极值的截图/DOM几何证据；
- opening/closing real `AgentPreset` 8-row baseline；
- known limitations、未检查项与 adjacent issues；明确记录不做assigned-agent fan-out，因此删除前不知道具体引用preset，冲突只由409揭示。

Screenshots只证明布局，不证明 request body、secret hygiene或 stale-response isolation。独立 acceptance artifact由 Alicia 指定的验收 owner维护；本 Plan 不自动派 reviewer，也不授权 Builder 修改 acceptance probes。

---

## 10. Rollback 与失败语义

- P2C PASS 前，V3 Settings/User 保持真实 rollback owner；移除 V4 route exposure即可退回，不删除任何已保存 backend/localStorage事实。
- 每 checkpoint 可独立回退其 route/component接线；不得 reset整个工作树或覆盖前序 accepted P2T/P2A/P2B。
- Appearance rollback若移除控制面，必须恢复施工前 token/bootstrap一致状态；不能留下“控制消失但 light preference仍把页面变成未测试样式”的半状态。
- 已确认 Endpoint/Key/Role/MCP/Config PATCH/PUT/DELETE不会因前端 rollback自动撤销；不得用真实生产数据做回滚清理。
- definite failure保留现有 server truth和用户 draft；ambiguous write停止重复提交并要求refetch/人工确认。
- 同一问题三次修复失败即熔断，整理最小复现、已证伪假设和剩余选择交 Alicia。

---

## 11. Adversarial razor / Ablation Study

由 `[gpt-5.6-sol / Solaire]` 执行初次 razor；Alicia随后显式提供 `[deepseek/deepseek-v4-flash / reviewer]` mini-fork review。复核建议未扩大scope，已由 `[gpt-5.6-sol / Solaire]` 做第二次消融并并入本版。

### 11.1 保留：缺少即不满足已批准验收

- `/account` canonical + `/user` redirect：消除双路由 owner。
- 全页面 More/title/mobile入口：Roadmap明确要求 shell统一所有权，且现有四个 mobile页面存在可达性缺口。
- Account四字段/avatar/prompt：现有有效用户资料契约。
- Telemetry cards/table：保留用量可观察能力，同时遵守不新增图表依赖。
- 完整 Appearance：Alicia明确禁止静默砍掉深浅主题；字体/字号已有持久化契约。
- Keys/Endpoints/Roles/MCP/Routine：均有现行后端契约且是 Settings transfer condition。
- Notifications hard-negative placeholder：P2C需要入口，P2D需要纯净所有权边界。
- 分四 checkpoint：减少一次迁移全部 Settings造成的验收失控。

### 11.2 消融/拒绝

- `recharts`、自制 SVG chart、趋势预测与失效的Telemetry platform filter；
- 第二个 model-catalog Query/validator/error identity：改为提取并复用既有owner；
- checkpoint间随后删除的“尚未释放”临时页面：路由与导航只在能力完成后逐段开放；
- 当前catalog不可达的MCP public-binding编辑面：只读状态保留，未来出现shared server再释放；
- 全宽×全主题×全字号笛卡尔证据矩阵：缩为代表性组合+断点边界，同时保留全部不变量；
- V3 fallback mocks、offline mock save、404=backend pending猜测；
- MemoryConsole/Manage Memory dead route；
- Routine时间编辑器与不可用按钮；
- ModelEntry/ProviderProfile CRUD；
- generic Settings schema、generic CRUD/form framework、global Zustand/store；
- platform按 model名称猜测；
- MCP全 preset fan-out assigned-agent map；
- optimistic secret/key/endpoint删除或全 QueryClient clear；
- Push permission/订阅预检、device name、unread placeholder逻辑；
- 为字体缩放采用整页 zoom；
- 借主题审计顺手重做视觉设计或重构无关 Chat/Project CSS。

### 11.3 相邻改进（不进入 P2C）

- Telemetry response直接携带 provider/family 后，再恢复可信的平台筛选；
- avatar server-side persistence与跨设备同步；
- Settings 搜索、收藏常用项或操作审计历史；
- ModelEntry/ProviderProfile独立管理面；
- P2D真实 Notifications controls；
- shared/shared_or_per_preset MCP server真正进入catalog后，再增加public-binding编辑面；
- 统一将 V4 px typography逐步迁为设计尺度（P2C只做必要的scale接线，不借机重命名全部token）。

**Razor verdict:** 四段均直接对应冻结的 P2C transfer condition；再减少会留下有效 Settings ownership缺口，再增加则进入 P2D/P5或无契约产品扩张。

---

## 12. 审批与释放规则

Alicia批准本 Plan 后只释放 **CP C-1**。C-2、C-3、C-4必须在前一 checkpoint事实验收通过后顺序释放。任何改变 canonical route、Notifications边界、theme保留、Settings capability清单或 secret处理语义的建议都属于 scope change，必须回到 Alicia批准，不能由 Builder或review建议自动扩张。

**署名：** `[gpt-5.6-sol / Solaire]`
