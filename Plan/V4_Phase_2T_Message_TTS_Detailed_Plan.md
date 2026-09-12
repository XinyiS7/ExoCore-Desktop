# ExoCore V4 — Phase 2T Message TTS Detailed Plan

> **Document type:** P2T executable implementation plan; limited to the message-level TTS slice (checkpoints 2T-1…2T-3).
> **Status:** **APPROVED FOR SEQUENTIAL CHECKPOINTS — only CP 2T-1 released to pane 4; CP 2T-2/3 require Acceptance PASS and explicit release.**
> **Repository:** `ExoCore-Desktop` production changes only. Django, nginx and sibling repositories are read-only.
> **Product authority:** Alicia。
> **Plan / architecture / QC:** `[gpt-5.6-sol / Solaire]`。
> **Source scouts / ablation review:** P2T-A/B/C read-only scouts `[model not supplied / scout]`；over-engineering review `[opencode-go/deepseek-v4-flash / reviewer]`；产品表现裁定 `[Alicia / product authority]`。
> **Upstream gates:** P2B accepted；B5 backend accepted R4 PASS（`../ExoCore/Plan/B5_voice_acceptance_report.md`）并已提交 `4e67ca07`。
> **Planning baselines:**
> - Desktop HEAD `cabb77f0c17224d107873fd8ff66adf398b430e1`（Force Cache 补丁已提交）。
> - Backend HEAD `4e67ca074a897f603e7aaa4a73ed49b91187359f`（B5 committed）。
> - 双端 `ReactSheet.md` 第十二篇已验证逐字节一致（偏移差 −27）。
> **Planning-time dirty worktree（必须原样保留，禁止夹带）：** `DevelopLog/DebugLog.md`、`Plan/Update_log.md`、`Plan/V4_Master_Implementation_Roadmap.md`、`ReactSheet.md`、`packages/chat-core/src/main.jsx`、untracked `Plan/spec/2026-09-12-message-tts-render-contract-handoff.md`。

---

## 1. 期望效果与施工理由

P2T 在已验收的 V4 canonical Chat 上补齐 **message-level TTS** 的用户路径：

```text
打开普通 Conversation
  -> 看到一条 eligible assistant Message 上的稳定 voice 入口
  -> 首次点击：显示真实的生成中状态（不伪造百分比）
  -> 生成完成：同一个控件变为可播放，用户点击即播放 / 暂停 / 拖动进度
  -> 再次播放命中后端缓存，不重复生成
  -> 若 `directed=true`，只让同一个 voice 按钮以高亮色“亮起”，不增加文案或标志节点
  -> 生成失败或音频失效：只在该消息的 voice 控件上显示可重试，文本与 Chat runtime 不受影响
```

本质问题是**真相归属**：TTS 是 canonical Message 的 presentation derivative。generation 生命周期、缓存有效性、授权与错误语义全部属于后端；前端只以 message identity 请求并如实展示状态。前端不得自己判断缓存有效性、伪造生成进度、把音频冒充用户附件、或把 TTS 失败升级为聊天错误。

### 2T 验收意图（Alicia 视角）

1. `voice.available=true` 的 assistant 消息有稳定入口；不可用消息不出现可操作控件；
2. 首次点击触发 lazy generation，控件显示后端真实状态；缓存命中时立即播放，无第二次生成；
3. 生成完成后同一控件提供播放/暂停/拖动进度与可达的键盘操作；
4. `directed=true` 只改变 voice 按钮的视觉颜色；不新增文案、DOM 节点、ARIA 名称，也不泄露 emotion、目标句、scope 或段数；
5. 生成失败（含后端 `runtime_offline`）只影响该消息控件，文本、Thinking/Trace、滚动位置、其它消息完全不受影响；
6. 音频失效（artifact 丢失/损坏）时控件变为可重试状态，而不是静默复用或永久报错；
7. 路由切换、会话内 reconciliation、与附件音频同时存在时不发生状态穿透或双重播放；
8. 全部已接受的 C1 / P1C / P1D / P2A / P2B 行为保持回归绿色。

---

## 2. Gate 状态与前置条件

- **P2T 是当前唯一授权 slice**：P2B accepted + B5 PASS（R4）已同时满足 Roadmap §8.6 的 entry gate。
- B5 保留限制：真实 VoxCPM2 daemon 属独立 pending（`../ExoCore/Plan/voxcpm2_tts_daemon_infrastructure_pending.md`）。因此**本地真实渲染当前应表现为 `runtime_offline`（503）**；前端必须如实展示该失败，验收不得以“合成成功”作为 P2T 通过条件，也不得以 mock 静音充当成功（B5-F1 曾因此 FAIL）。
- P2T 通过后进入 P2C；P2D 仍需 B6 PASS + P2C PASS。B6 后端计划由 ExoCore 仓库独立推进，不属本计划范围。
- 本计划**不**授权任何后端、nginx、launcher、PWA identity 或 V3 改动。

---

## 3. 以源码为准的冻结事实

以下事实在 planning HEAD 上逐条核对过；施工开始时 Builder 必须重新 `read/rg` 校验，出现漂移立即停手报告。

### 3.1 后端已有契约（B5 实现，只读）

- 读模型：`memory/serializers.py::MessageSerializer.get_voice` 对 `role="assistant"` **恒返回对象** `{"available": bool, "directed": bool, "cached": bool}`，非 assistant 行返回 `null`。`get_voice` 内部读取 `conversation.agent_preset.active_voice_profile`、`extract_spoken_text(content)` 与 `is_artifact_valid(render, …)`，因此 **`cached` 是读时刻的咨询性快照**，不是会话内实时真值。
- 该投影随 `MessageSerializer` 出现在 V4 实际消费的 `GET /api/agents/chat/<id>/`（`AgentChatView.get`）里；`ReactSheet.md` §12.1 里写的 `GET /api/agents/conversations/<cid>/messages/` 是文档笔误（见 D14）。
- `POST /api/agents/conversations/<pk>/messages/<message_pk>/tts/`（`MessageTTSView.post`）：body 为空 `{}`。可能返回：
  - `200 {"status":"playable","content_url":…,"duration_ms":…}`（cache hit）
  - `202 {"status":"generating","retry_after_ms":1500}`（miss / in-flight / stale-reset）
  - `404 {"error":"not_found",…}`；`422 {"error":"ineligible_message"|"no_active_profile",…}`
  - 失败分支（`runtime_offline` 503 / `generation_timeout` 504 / `generation_failed` 500）在实现中存在，但正常路径下 POST 立即派发异步任务，失败主要通过 GET 观察到。
- `GET …/tts/`（只读观察，不触发新任务）：`200 idle`（无记录、或 artifact 失效被降级）/ `200 playable` / `202 generating` / `404` / `422` / `503/504/500 {"status":"failed_retryable","code":…,"message":…}`。
- `GET …/tts/content/`：`200 FileResponse audio/wav`，`Cache-Control: private, no-cache, max-age=0`，**无 Range/206**；其余一律 `404 {"error":"not_found","code":"audio_artifact_missing",…}`。
- 错误字段不统一：404/422 使用 `error` 键；`failed_retryable` 使用 `code` 键；content 404 同时携带两者。前端必须按 **HTTP 状态优先 + `code` 作次级判别** 映射，禁止复用 `machineCodeOf`（它故意忽略字符串 `error`）。
- 传输行为：`exo-shared` 的 `apiFetch` 对非 2xx 抛错（`err.status` + `err.body`）；**202 属于 2xx，正常 resolve**。
- 无 `DEFAULT_PERMISSION_CLASSES`；边界是会话隔离 → 404。前端不得发明“权限不足”状态。
- `voice_emotion` 目前**没有生产 producer**（仅 serializer 判定 + 测试）。`directed` 只能以 fixture 验证，UI 不得依赖其存在。

### 3.2 前端现状（greenfield）

- `packages/app/src/features/chat` 内 `voice|tts` 相关命中数为 0。
- `MessageRow`（`types.ts:92`）无 `voice`；`normalizeMessageRow`（`api.ts:217-236`）会**静默丢弃未知字段**，因此必须显式投影。
- fail-closed 投影先例：`normalizeAssistantRunTrace`（`api.ts:143-215`）——畸形附加字段返回 `null`，绝不阻断或改写正文。
- 播放单例：`audio/audioPlaybackManager.ts` 的 `globalAudioPlaybackManager`（`play(id,pauseFn)`/`stop(id)`/`subscribe`），是唯一允许的播放所有权。附件播放器 `audio/AudioPlayerBubble.tsx` 使用 `audio_${useId()}_${meta.id}` 且无障碍名称为 `播放语音 … / 暂停语音 … / 语音进度 …`。
- `MessageTimeline.tsx`：`MessageRowItem`（42–135）在 header `.app-msg-actions`（76–112）里渲染 assistant 的“分支”按钮；runtime overlay（218–255）无持久 id，天然不可挂载 voice 控件；`messages.map`（186–196）以 `key={message.id}` 保持行身份。
- `queries.ts`：`applyFreshWindow`（144–152）是唯一允许改写 `queryKeys.messages` 的 owner；`destructive=true` 会先 `removeQueries`，导致该会话整个 timeline 短暂卸载重建。
- `ConversationPage.tsx`：`MessageTimeline` 挂载在 ~587–600；页面已有路由切换重置 effect（~170–186）与操作锁（`controlLockRef`、`isExternalOperationPending`）。
- 测试基建：`installFetch`/`renderV4`/`renderApp`（`test/helpers.tsx`）；播放/互斥先例 `test/p1c_historical_rendering.test.tsx`（本地 `stubMedia()`，非导出）；`vite.config.ts` vitest 同时收集 `src/test/**` 与 `src/acceptance/**`；脚本为 `typecheck` / `lint` / `test:run` / `build`。Node 25 需 `NODE_OPTIONS=--no-experimental-webstorage`（Force Cache 补丁沉淀）。

---

## 4. 冻结的规划决策（D1–D14）

### D1 — 状态所有权：控件本地状态 + 路由纪元，不新增 Query 家族

**决定：** 每条消息的 voice 生命周期状态存在于该行 `MessageVoiceControl` 内部（`useState` + in-flight ref + `AbortController` + 挂载纪元守卫）。**禁止**写入 `queryKeys.messages` 家族，也**不新建** TanStack Query key。`[gpt-5.6-sol / Solaire]`

理由：消息行以 `key={message.id}` 保持身份，非破坏性 reconciliation（`applyFreshWindow(destructive=false)`）不会卸载行组件，播放态与轮询自然延续；`destructive` reconciliation（编辑/重生成后）本来就应让相关 voice 状态失效，重建后控件回到 `idle`，再次点击是一次 cache-hit POST（`cached=true` 秒回），行为真实且廉价。新增独立缓存家族则为同一个易失状态引入第二套生命周期，属过度设计。

**冻结的已知边界（写入 evidence）：** 破坏性历史重建会重置该会话的 voice 控件为 `idle`；这是可接受的真相降级，不是缺陷；不为此引入持久化。

### D2 — 单一请求路径：用户动作只走 POST；GET 只做观察；禁止伪造资源身份

**决定：** 控件点击（`idle` 或 `failed_retryable`）→ `POST /tts/`。`202` → 按 `retry_after_ms` 轮询 GET 直至终态。前端**绝不**自行拼接 `content_url`，只在响应中拿到 `content_url` 后才交给播放器；`cached` 只用于初始展示提示，不用于跳过 POST。`[gpt-5.6-sol / Solaire]`

### D3 — 状态机（前端五态）与错误映射

前端冻结五态：`unavailable | idle | generating | playable | failed_retryable`。

- `voice === null` 或 `voice.available === false` → 不渲染控件（`unavailable`）。
- 映射规则（HTTP 状态优先）：
  - `404` → `unavailable`（目标不存在/不可访问，控件隐藏；不猜 latest）。
  - `422`（`ineligible_message` / `no_active_profile`）→ `unavailable`。
  - `503 runtime_offline` / `504 generation_timeout` / `500 generation_failed` → `failed_retryable`（保留控件 + 重试入口 + 白名单文案）。
  - 网络失败 → `failed_retryable`（可重试）；畸形 2xx 响应 → `failed_retryable`（code `contract`），不静默当成功。
  - GET 返回 `200 idle` → 一律回到 `idle`；这是后端对 artifact 缺失、损坏或过期的稳定可重试真相，用户再次点按即重新 POST。前端不再发明 `invalid_artifact` 特判。`[opencode-go/deepseek-v4-flash / reviewer; gpt-5.6-sol / Solaire]`
- 客户端观察上限：自 POST 起 90 秒仍未终态 → 停止轮询，`failed_retryable`（`generation_timeout` 文案）。正常由后端 60 秒超时（504）先行到达。
- 轮询期间遵守 `retry_after_ms`；路由切换/卸载 `abort()` 并停止写入（纪元守卫）。不增加 `visibilitychange` 监听，由浏览器负责后台计时器节流。**没有取消接口，不渲染取消按钮。**
- 点击 → 生成成功（playable）后**自动播放一次**（这是用户点击意图的延续）；任何未经点击到达的消息**绝不播放**（不 autoplay）。

### D4 — 复用唯一播放所有权：`globalAudioPlaybackManager`，本 slice 不重构 `AudioPlayerBubble`

**决定：** `MessageVoiceControl` 的可播放形态自持一个 `<audio>` 元素与紧凑播放 UI，但播放所有权**必须**通过 `globalAudioPlaybackManager.play(id, pauseFn)` / `stop(id)` 参与互斥；播放 id 固定为 `tts_${conversationId}_${messageId}`，与附件 `audio_${useId()}_${meta.id}` 不可能冲突。**不在 P2T 内重构 `AudioPlayerBubble`**（不动已验收的 P1C 回归面），两个表面共享 manager 而不是共享 DOM。`[gpt-5.6-sol / Solaire]`

Razor 记录：scout 建议“抽取通用播放器核心以复用 slider”，本计划**拒绝**——收益是少量展示代码去重，代价是触碰 P1C 已验收的高风险播放器文件；改为在 evidence 中登记为后续可选优化（adjacent improvement），不进入本 slice 活跃范围。

### D5 — 控件挂载位置：现有 `.app-msg-actions` 集群内

**决定：** 控件作为 `.app-msg-actions` 内的一个子元素渲染，**不新增** `margin-left:auto` 同级元素（header 已有两个 auto 边距兄弟，第三个会重排行头）。`playable` 后仍用同一元素展开为紧凑播放器（播放/暂停 + 细进度滑条 + 时间），宽度预算靠 `flex` + `min-width: 0` 收敛；响应式由浏览器探针在 320/390/1280 验证。若探针证明 320px 不可行，Builder**停手报告**并按指导调整，不得静默改为第二行或浮动层。`[Alicia / product authority; opencode-go/deepseek-v4-flash / reviewer; gpt-5.6-sol / Solaire]`

### D6 — 冻结无障碍名称（避免与附件播放器冲突）

- 入口（idle）：`朗读此条消息`
- 生成中：`语音生成中`（disabled + `aria-busy`）
- 可播放：`播放朗读` / 播放中：`暂停朗读`
- 失败：`重试生成语音`
- 进度滑条：`朗读进度`
- `directed` 不获得独立无障碍名称：它只改变既有 voice 按钮的视觉颜色，不改变按钮语义。

不得复用 `播放语音/暂停语音/语音进度`（P1C 已用，会造成 `getAllByRole` 歧义并使既有断言不稳）。`[gpt-5.6-sol / Solaire]`

### D7 — 与 Chat runtime 的隔离

**决定：** voice 控件**不**受 `isRunActive` 禁用，**不**加入 `controlLockRef` / `isExternalOperationPending` / 任何操作锁；TTS 的 POST/GET/播放与聊天 SSE/async 互不阻塞。TTS 失败**禁止**生成 assistant 错误消息、禁止改动 Message/Trace、禁止触发消息列表 refetch、禁止影响滚动锚定。`[gpt-5.6-sol / Solaire]`

### D8 — 进度语义

进度与时间轴只来自 `<audio>` 元素的 `currentTime`/`duration`；`duration_ms`（可能为 0）只允许作为 metadata 加载前的初始总时长展示，一旦元素 metadata 就绪即以元素为准。**禁止**把任何后端生成状态渲染成百分比进度。无 Range 支持，不承诺“边下边播”；seek 语义与已接受的附件播放器一致（指针 + ArrowLeft/Right ±5s + Home/End）。`[gpt-5.6-sol / Solaire]`

### D9 — `directed` 的无文案视觉态

`directed === true` 时只给**同一个 voice 按钮**增加视觉 modifier class（建议 `.app-voice-control--directed`）并换成高亮色/轻微发光；不新增文案、`title`、ARIA 名称、独立 DOM 节点或可交互元素。普通态与 directed 态的按钮可访问名称完全相同；modifier class、`data-*` 与其它属性均不得编码 emotion、目标句、scope、段数或 authoring 细节。视觉态在生成前即可亮起，表达 authoring choice 而非 cache 状态。`[Alicia / product authority; opencode-go/deepseek-v4-flash / reviewer; gpt-5.6-sol / Solaire]`

### D10 — 请求与资源卫生

请求体恒为 `{}`；前端不得向任何 endpoint 传 message 文本、emotion、profile、seed 或 cache key；播放 URL 必须经 `validatedAudioContentUrl`（同源校验）后才交给 `<audio>`。`[gpt-5.6-sol / Solaire]`

### D11 — 初始态只认读模型，不抢先请求

加载历史时不自动 POST（无 eager generation）；`voice.available=true` 展示 `idle` 入口（无论 `cached` 真假，入口都稳定存在）。刷新后 `available && !cached` 可以是 idle 或 in-flight，只有 POST 能获知——因此不自动 POST。`[gpt-5.6-sol / Solaire]`

### D12 — 消息行签名的最小扩展

`MessageTimelineProps` 增加 **可选** `conversationId?: number`；`MessageRowItem` 在 `conversationId != null && message.voice?.available` 时才渲染控件。可选而非必需，保证既有 `p1c_historical_rendering` 等直接实例化 `MessageTimeline` 的测试**零修改**通过（其 fixtures 无 `voice`，控件天然不渲染）。`[gpt-5.6-sol / Solaire]`

### D13 — 附件音频与 TTS 的共存规则

两类播放通过 manager 互斥（一个在播，另一个自动暂停）。TTS artifact **绝不**进入 `attachment_ids` / `attachments_meta`；`MessageAttachments` 不感知 TTS。反向：删除附件、音频恢复机（`audioRecoveryMachine`）与 TTS 状态完全解耦。`[gpt-5.6-sol / Solaire]`

### D14 — 文档勘误（最小）

`ReactSheet.md` §12.1 中 `GET /api/agents/conversations/<cid>/messages/` 与实际消费端点不符。本 slice 只允许修正**前端仓库** `ReactSheet.md` 第十二篇的这一句话（改为 canonical `GET /api/agents/chat/<id>/`）；后端仓库副本的同步由 ExoCore owner 跟进，前端仓库**不得**改 sibling 仓库文件。注意 `ReactSheet.md` 当前有 B5 同步的未提交改动：修正必须是叠加式最小 edit，绝不能覆盖或回退该改动。`[gpt-5.6-sol / Solaire]`

---

## 5. Scope 边界

### 5.1 包含

- `MessageRow.voice?: unknown` / `MessageView.voice?: VoiceProjection | null` 的传输层与规范化投影（fail-closed）。
- 新增 `features/chat/tts/`：类型、POST/GET 适配器（状态优先错误映射）、控件组件、状态机 hook、`tts.css`。
- `MessageTimeline` 最小接线（可选 `conversationId` 透传 + 条件渲染）。
- `ConversationPage` 向 `MessageTimeline` 传入 `conversationId`。
- 控件五态 UI、`directed` 按钮高亮态、紧凑播放器、互斥、无障碍、响应式。
- 聚焦构造测试 + 全量既有无关键回归。
- Evidence 文档 `Plan/V4_Phase_2T_Construction_Evidence.md`。
- D14 的前端 ReactSheet 单句勘误。

### 5.2 明确排除

- 任何后端/迁移/接口改动；任何新依赖。
- `public/sw.js`、PWA 身份、通知权限（P2D 范围）。
- Chat runtime（`runtime/*`）、附件管线（`attachments/*`）、`AudioPlayerBubble` 的重构。
- live voice、STT、自动朗读、Push 到达即播、主动电话。
- 声线库 CRUD、emotion 编辑、authoring 细节展示、生成百分比、取消/暂停生成。
- V3 包（`chat-core` 等）任何改动。
- 缓存 HUD（TacticalHud / ContextCacheControl）与 TTS 的联动改造。
- P2C 的 Settings/Account/Shell 工作。

---

## 6. 施工前必读（Builder 强制范围）

1. `packages/app/src/features/chat/types.ts`、`api.ts`、`queries.ts`、`MessageTimeline.tsx`、`ConversationPage.tsx`；
2. `packages/app/src/features/chat/audio/audioPlaybackManager.ts`、`attachments/mediaUrls.ts`、`test/p1c_historical_rendering.test.tsx`（回归面）；
3. `packages/app/src/features/chat/control/api.ts`（typed adapter 风格先例）、`runtime/client.ts`（`machineCodeOf` 的既有取舍）；
4. `packages/app/src/test/helpers.tsx`、`vite.config.ts`；
5. `ReactSheet.md` 第十二篇（1101–1198）与 `Plan/spec/2026-09-12-message-tts-render-contract-handoff.md` §2/§6；
6. 后端只读：`../ExoCore/memory/serializers.py::MessageSerializer.get_voice`、`../ExoCore/agents/views.py` 中 `MessageTTSView` / `MessageTTSContentView`。

出现以下漂移必须停手报告：读模型字段名或 nullability 变化、POST/GET 状态集变化、错误键变化、content 响应头/鉴权变化、文档契约与实现再次分叉。

---

## 7. 施工顺序与 Checkpoint

> 行号为 planning-time 锚点；Builder 必须按符号重定位，不套行号。**施工中禁止改写验收专属文件**（`src/acceptance/**` 由独立验收窗口拥有；若不存在，Builder 不得自行创建验收探针）。

### CP 2T-1 — 契约适配（投影 + 客户端）

1. `types.ts`：`MessageRow` 增加 `voice?: unknown`；`MessageView` 增加 `voice?: VoiceProjection | null`；新增 `export interface VoiceProjection { available: boolean; directed: boolean; cached: boolean }`（放 `types.ts` 或 `tts/types.ts` 并在 `types.ts` 复用，方向任选但只允许一个定义）。
2. `api.ts`：新增 `normalizeVoiceProjection(value: unknown): VoiceProjection | null`，规则与 `normalizeAssistantRunTrace` 同构：非对象/缺布尔字段 → `null`；`role !== 'assistant'` → `null`；未知附加键忽略；**畸形 voice 绝不改变或阻断 canonical 文本**。在 `normalizeMessageRow` 中 `voice: row.role === 'assistant' ? normalizeVoiceProjection(row.voice) : null`。
3. 新 `tts/types.ts`：`TtsPhase`（`unavailable | idle | generating | playable | failed_retryable`）、`TtsPlayable { contentUrl: string; durationMs: number | null }`、`TtsOutcome`（判别联合，覆盖五态）、稳定 `TtsErrorCode` 集合（`not_found | ineligible_message | no_active_profile | runtime_offline | generation_timeout | generation_failed | audio_artifact_missing | contract | network`）。
4. 新 `tts/api.ts`：`startMessageVoiceRender(conversationId, messageId, signal?)` 与 `readMessageVoiceRender(conversationId, messageId, signal?)`，实现 D2/D3 的映射；请求体恒为 `{}`；复用 `AppApiError`/`toAppApiError`；**不得**复用 `machineCodeOf`。
5. 构造测试（`src/test/p2t_voice_projection.test.ts` + `p2t_voice_client.test.ts`）：覆盖畸形投影 fail-closed、非 assistant → null、正文不受损；状态映射全矩阵（200 playable / 202 generating / 200 idle / 404 / 422 error 键 / 503 / 504 / 500 / 网络 / 畸形 2xx）；请求体精确为 `{}`；404 不猜状态。

**Rollback：** 纯新增模块 + 两处投影，删除即回退，无数据影响。

### CP 2T-2 — 控件、播放与 `directed` 视觉态

1. 新 `tts/MessageVoiceControl.tsx`：props `{ conversationId: number; messageId: number; voice: VoiceProjection }`；内部状态机按 D1/D3/D8 实现；渲染按 D5/D6；播放参与 `globalAudioPlaybackManager`（D4）；`contentUrl` 经 `validatedAudioContentUrl` 校验，失败视同 `failed_retryable`。
2. 新 `tts/useMessageVoice.ts`（或同文件内的 hook）：POST→轮询→终态循环、`AbortController`、挂载纪元守卫、90 秒观察上限、重复点击互斥（in-flight ref）。参数与返回值签名必须冻结为纯函数式接口，便于单测直接驱动。
3. `MessageTimeline.tsx`：props 增加可选 `conversationId?: number`（D12）；在 `.app-msg-actions` 内、分支按钮之前渲染 `MessageVoiceControl`（条件见 D12）；`directed` 只按 D9 改变该按钮的视觉 class。
4. 新 `tts/tts.css`（由组件 import，先例 `trace/trace.css`）：仅新增 `.app-voice-*` 规则；不改写既有 `.app-msg-actions` / `.app-audio-bubble` 规则。
5. 构造测试（`src/test/p2t_voice_control.test.tsx`）：五态渲染与名称；`available=false`/`voice=null`/user 行/runtime overlay 不渲染；无 autoplay（挂载后零 `play()` 调用）；点击后生成中禁用、终态自动播放一次；`directed` 只改变既有按钮的视觉 modifier class，无新增文案、DOM、title 或 ARIA；键盘与滑块 ARIA；失败重试路径；互斥（TTS 播放暂停附件音频、反向亦然）——`stubMedia()` 若需复用，**必须**复制到本测试文件或新建独立 stub 文件，禁止修改 P1C 测试文件。

**Rollback：** 控件与 timeline 接线均为新增/最小扩展，移除接线即回到 CP 2T-1 状态。

### CP 2T-3 — 集成、回归与 Evidence

1. `ConversationPage.tsx`：向 `MessageTimeline` 传 `conversationId={id}`。
2. 集成测试（`src/test/p2t_integration.test.tsx`，用 `renderApp`/`installFetch` 风格）：
   - 路由 A→B 后，A 的迟到 GET 响应/终态不得写入 B 或 B 的任何消息；
   - 会话内非破坏性 reconciliation（运行结束后 canonical 窗口替换）期间 playable 控件保持；
   - `cached=true` 消息：一次 POST → 立即 playable，无第二次 POST；
   - 播放中 content 404（模拟元素 error）→ 控件回到可重试，重新点击 POST 恢复；
   - 控件状态更新不触发消息列表 refetch（断言 messages query 请求数不增长）、不改变滚动位置；
   - TTS 失败不产生新的 assistant 消息、不改变 runtime 状态。
3. 全量回归：`NODE_OPTIONS=--no-experimental-webstorage pnpm --filter exo-app test:run`、`pnpm --filter exo-app typecheck`、`pnpm --filter exo-app lint`、`pnpm --filter exo-app build`，并确认 P1C/P1D/P2 既有套件（含 `src/acceptance/**`）零失败。
4. ReactSheet 单句勘误（D14）。
5. `Plan/V4_Phase_2T_Construction_Evidence.md`：记录 HEAD、dirty 快照、改动文件+哈希、逐项验证目标的证据（测试文件 :: 用例名 :: 决定性断言）、已知边界（daemon pending → runtime_offline 真相、破坏性 reconciliation 重置、无 Range/取消）。
6. 浏览器响应式证据：320/390/1280 宽下控件与行头不溢出（`scrollWidth <= clientWidth`）、可点击命中；由构造方运行并记录截图/输出，验收方独立复检。

**Rollback：** 前端 exposure 回退 = 移除 timeline 挂载点；已生成 voice artifact 与 Message 数据不删除。

---

## 8. 关键文件清单

### Create

- `packages/app/src/features/chat/tts/types.ts`
- `packages/app/src/features/chat/tts/api.ts`
- `packages/app/src/features/chat/tts/useMessageVoice.ts`
- `packages/app/src/features/chat/tts/MessageVoiceControl.tsx`
- `packages/app/src/features/chat/tts/tts.css`
- `packages/app/src/test/p2t_voice_projection.test.ts`
- `packages/app/src/test/p2t_voice_client.test.ts`
- `packages/app/src/test/p2t_voice_control.test.tsx`
- `packages/app/src/test/p2t_integration.test.tsx`
- `Plan/V4_Phase_2T_Construction_Evidence.md`

### Modify

- `packages/app/src/features/chat/types.ts`（`MessageRow` / `MessageView` / `VoiceProjection`）
- `packages/app/src/features/chat/api.ts`（`normalizeVoiceProjection` + `normalizeMessageRow` 接线）
- `packages/app/src/features/chat/MessageTimeline.tsx`（可选 `conversationId`、条件挂载、`directed` 按钮视觉态）
- `packages/app/src/features/chat/ConversationPage.tsx`（透传 `conversationId`）
- `ReactSheet.md`（仅 §12.1 单句勘误）
- `Plan/Update_log.md`（仅完工登记行，若项目惯例要求）

### Delete

- 无。

---

## 9. 不变量（验收基线）

- **INV-1 Canonical isolation**：开启/关闭/失败 TTS 后，`Message.content`、memory、compaction、history 语义不变。
- **INV-2 Identity-only 请求**：POST 只含 message identity；任何 payload 不得出现文本、emotion、profile、cache key。
- **INV-3 No fake progress**：生成过程不出现百分比或伪造时间轴；播放时间轴只来自真实音频元素。
- **INV-4 No autoplay**：未经用户点击的消息绝不播放；点击后成功即播放（同一意图）。
- **INV-5 Privacy**：网络/UI/DOM 不暴露 emotion、target、scope、段数；`directed` 只改变既有按钮的视觉 class，不产生额外文案、节点或无障碍名称。
- **INV-6 Single playback owner**：只有 `globalAudioPlaybackManager` 决定互斥；无第二套播放管理。
- **INV-7 Attachment isolation**：TTS artifact 不进入 `attachment_ids`/`attachments_meta`；附件音频与 TTS 互不污染。
- **INV-8 Failure isolation**：TTS 任何失败不产生 assistant 错误消息、不改 runtime 状态、不触发消息 refetch、不影响滚动。
- **INV-9 Route isolation**：跨会话迟到响应零写入；播放所有权在路由切换后不残留。
- **INV-10 Truthful cache**：缓存有效性判断只在后端；前端不基于 hash/时间/URL 自行判定复用。
- **INV-11 Zero backend/V3/dependency 改动。**

---

## 10. 验证方式（命令与预期）

| # | 验证 | 预期 |
|---|---|---|
| V1 | `NODE_OPTIONS=--no-experimental-webstorage pnpm --filter exo-app exec vitest run src/test/p2t_*` | 全绿，0 fail/error/skip |
| V2 | `pnpm --filter exo-app typecheck` | 0 error |
| V3 | `pnpm --filter exo-app lint` | 0 error |
| V4 | `pnpm --filter exo-app build` | 构建成功 |
| V5 | `NODE_OPTIONS=--no-experimental-webstorage pnpm --filter exo-app test:run` | 全量（含 `src/acceptance/**`）0 fail |
| V6 | 手工/浏览器：`pnpm dev:app` + 真实会话 | 入口稳定；点击→生成中→（daemon 未就绪时如实 503 可重试）；文本与滚动不受影响 |
| V7 | 320/390/1280 响应式探针 | 控件与行头不溢出、命中可达 |
| V8 | `git status` / diff 审查 | 仅 §8 列出的文件变化；sibling dirty 文件保持原状；无 V3/后端改动 |

> 本计划不写 raw test 代码；测试实现细节由施工方在受限范围内冻结，验收方拥有独立的 `src/acceptance/**` 探针。

---

## 11. 施工纪律（共享 worktree）

- 开工前记录 HEAD、dirty 快照与既有文件哈希；**禁止** reset/checkout/覆盖任何 sibling 改动。
- 只改 §8 清单内文件；提交时使用 pathspec（例：`git commit -m "…" -- packages/app Plan/V4_Phase_2T_Construction_Evidence.md ReactSheet.md`），绝不裸 `git add -A`。
- 不修改 `src/acceptance/**`；不修改 P1C 测试与被撤销范围的文件；不引入依赖。
- 三次失败熔断：同一问题三次修复失败即停手整理事实并向 Alicia/验收方求助。

---

## 12. Adversarial razor / Ablation Study

### 保留（直接对应验收）

- 投影 + fail-closed 规范化：读模型是唯一真值入口，畸形数据不得破坏正文。
- 状态优先 + `code` 次级判别的错误映射：实际错误键不一致，复用 `machineCodeOf` 会丢 404/422。
- POST-only 请求路径：防止伪造资源身份与客户端 cache key。
- 单例播放管理复用：互斥唯一所有权是已验收契约。
- 五态 + 90 秒观察上限：真实状态与兜底可重试。
- 控件内本地状态 + 纪元守卫：最小生命周期，不新增第二套缓存。

### 已消融

- 抽取通用播放器核心（触碰 P1C 回归面，收益仅展示去重）→ 记录为后续可选优化。
- 独立 TanStack Query 家族存 voice 状态 → 与“单一 reconciliation owner”冲突且无产品收益。
- “POST 5xx 断言”类测试目标 → 实测 POST 正常路径不产生 5xx，D3 统一映射已覆盖。`[opencode-go/deepseek-v4-flash / reviewer]`
- GET `200 idle` 的 `invalid_artifact` 客户端特判 → 后端已把缺失/损坏/过期 artifact 收敛为稳定 idle；一律回 idle 更薄、更真实。`[opencode-go/deepseek-v4-flash / reviewer; gpt-5.6-sol / Solaire]`
- 独立盲盒文案/标志节点 → `directed` 只改变既有按钮颜色，不增加 DOM、ARIA 或隐私面。`[Alicia / product authority; opencode-go/deepseek-v4-flash / reviewer]`
- `visibilitychange` 监听 → 非验收必要条件，浏览器已有后台计时器节流；保留卸载 abort 与 90 秒上限即可。`[gpt-5.6-sol / Solaire]`
- 生成百分比 / 取消按钮 / Range 分段请求 → 契约没有的能力，不承诺。
- 自动 POST 预热（eager generation）→ Roadmap 明确非目标。
- 声线库、emotion 编辑、TTS 设置面板 → 后端无对应产品面，超范围。

**Razor 结论：** P2T 只消费 B5 已冻结的 message-level 投影与两个（POST/GET）动作，加一个 content 播放资源；其余皆不做。

---

## 13. 非目标

- Live voice / 双工 / interrupt / 主动电话 / 麦克风对话。
- Push 到达自动朗读或自动播放；通知与未读（P2D）。
- GroupChat、Council、River、Library、Settings、Account（P2C/P3/P4/P5）。
- 后端 authoring（`voice_emotion` producer、action-cue 解析、R3 内部机制）。
- V3 表面与 monorepo 其他 package。

---

## 14. 已确认的产品表现（无待决项）

1. 用户点击生成后，成功即**自动播放一次**；这是 Roadmap §8.2“点按生成并播放”的同一用户意图。`Plan/Update_log.md` 原“且不自动播放”已澄清为“未经点击不自动播放”，不禁止点击成功后的播放。`[Alicia / product authority; opencode-go/deepseek-v4-flash / reviewer]`
2. `directed` 无文案、无独立标志，只让 voice 按钮以高亮色亮起。`[Alicia / product authority]`
3. 播放器采用消息头 `.app-msg-actions` 内的紧凑型控件。`[Alicia / product authority]`

批准后如需改变以上语义，另立 scope，不在 P2T 施工中临场扩张。

---

## 15. 审批后的释放条件

Alicia 批准本计划后：释放 **CP 2T-1** 施工；2T-2/2T-3 在各自前置 checkpoint 完成后顺序释放。P2C 在 P2T 整体 PASS 前不得开工；B6 后端（另一仓库）继续独立推进，与本 slice 无耦合。

---

**署名：** gpt-5.6-sol / Solaire — 2026-09-12

## Independent acceptance handoff

Frozen criteria and checkpoint rhythm: `Plan/V4_Phase_2T_Message_TTS_acceptance_spec.md`. Acceptance owner: pane 3 (Solaire); Builder: pane 4. Builder must not edit this Plan or independent artifacts. Only CP 2T-1 is initially released. The acceptance spec's exact-file, separately authorized commit discipline supersedes the broad pathspec example in §11.
