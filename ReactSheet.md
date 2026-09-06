# ExoCore API Reference (ReactSheet)

> Generated from live Django URL config + serializer fields. P1-11 commit 1-5 shape.
> **Provenance:** reconciled against `Plan/V4_Phase_0_Baseline/Canonical_API_Snapshot.json` (snapshot v1.0, as-of 2026-09-02, frontend 6b0948e / backend 21f2a8f7) — Conversation/messages/runtime, GroupChat, attachments, Tasks, Memory and notifications surfaces below are corrected to that snapshot; mismatch IDs (MM-xx) reference it.

---

## 第一篇  会话 & 聊天 (Agents)

### 1.1 Read/Update `/api/agents/presets/` — 固定 Agent 人设卡片

**GET /api/agents/presets/**

```json
[{
  "id": 1, "name": "Alicia", "description": "主助手",
  "agent_type": "g045", "default_model": "deepseek-v4-pro",
  "system_prompt": "You are...", "is_visible": true
}]
```

**GET /api/agents/presets/<id>/** — 单条详情

**PUT /api/agents/presets/<id>/** / **PATCH /api/agents/presets/<id>/** — 更新现有字段，response shape 同上。

**POST /api/agents/presets/** / **DELETE /api/agents/presets/<id>/** — `405 Method Not Allowed`。生产与开发真实库的 preset 行集合固定；创建/删除只在 Django test DB fixture 中允许。

### 1.2 Conversation — 列表/详情/创建（canonical，见 snapshot MM-01/MM-02）

**GET /api/agents/conversations/** — 普通会话列表（bare 数组，无分页 envelope）

字段 allowlist（`agents.serializers.ConversationSerializer`）：

| 字段 | 类型 | 说明 |
|---|---|---|
| id | int | |
| name | string | |
| created_at | datetime | |
| frozen_project_ids | [int] | 创建时的项目权限快照 |
| project | int | **DB NULL → 0**（Drift sentinel，`obj.project_id or 0`） |
| project_name | string/null | 无项目时为 null |
| agent_type | string | g045 / standard … |
| agent_preset_id | int | |
| last_message_at | datetime | 最后一条 assistant 消息时间；无消息时 = created_at |
| thinking_level | string | |
| memory_injection_enabled | bool/null | null = 继承 preset |

排序：最后活跃 desc（`COALESCE(MAX(message.created_at), updated_at)`）。列表排除 `is_bridge`、council participant/synthesis 会话与归档 preset。无服务端 Agent×Project 组合筛选/分页（R2 量级未触发）。

**创建：POST /api/agents/sessions/init/**（统一 Standard & Superior 创建入口，见 §1.4）——`POST /api/agents/conversations/` 只挂 GET（ListAPIView），**不是创建入口**；shared `createConversation()` wrapper 零调用且目标不可写（consumer mismatch，不在此修）。

**GET /api/agents/conversations/<pk>/** — 单条详情，字段同上。

**PATCH /api/agents/conversations/<pk>/** — 可写：`name` / `thinking_level` / `memory_injection_enabled`。`project` 是 SerializerMethodField，**不可通过本序列化器改**。

**DELETE /api/agents/conversations/<pk>/** — 物理删除（messages/history chunks 级联），并触发孤儿 history 清理子进程（`compact_conversations --prune`）。

### 1.3 Chat 消息历史 / SSE / async 轮询（canonical，见 snapshot MM-03）

**GET /api/agents/chat/<session_id>/** — 消息历史（session_id = conversation id），`index_in_session` 升序

- 无分页参数 → 旧格式兼容：全量 MessageSerializer 数组
- `?limit=N&offset=N` → `{messages: [...], total_count: int, has_more: bool}`；`offset` 从最新端往回数（offset=0 → 最后 limit 条）
- 行字段 allowlist（`memory.serializers.MessageSerializer`）：`id, role (user/assistant/system/developer), content, reasoning_content, platform, model_version, token_count, index_in_session, attachment_ids, attachments_meta, created_at`；`attachments_meta[] = {id, display_name, original_filename, mime_type, file_size, file_uri, content_url}`（`content_url` 仅 audio 附件为同源 content 端点，其余 null）
- 会话不存在 → 404 `{"error": "会话不存在"}`

**POST /api/agents/chat/<session_id>/** — 发送一轮（SSE 默认；`?mode=async` 切换），body 字段：`content` / `pending_attachments` / `thinking_level`(默认 medium) / `model` / `endpoint`(int) / `api_key_alias` / `memory_injection_enabled` / `cache_enabled` / `session_type`(`full`|`lite`) / `force_cache_rebuild` / `edit_message_id` / `files`(multipart)。

`galatea_mcp` 已废弃：后端即使收到该旧字段也不得把 Galatea MCP declarations 拼入主会话。standard live chat 只暴露恒定 `use_drawer` 代理，并在每次请求的 `<ExoCore>` 中列出当前 preset 已授权且 credential-ready 的 Drawer/短工具名；模型先 `describe` 获取 schema，再 `call`。Heartbeat 继续使用既有 `tool_activate` 抽屉机制；g045 主会话不参与本代理。前端应停止发送旧字段。

SSE 事件（`event: <name>\ndata: <json>\n\n`；`agents/services.py` 实际发出的全集）：

| event | data |
|---|---|
| `status` | 字符串（阶段消息；工具进度经 `_format_tool_status()` 渲染为安全预览字符串，如 `{command}`/`{target}` 占位符被截断替换后的纯文本） |
| `thinking` | 字符串 chunk（reasoning 文本） |
| `content` | 字符串 chunk（回答文本） |
| `telemetry` | `{platform, model_name, input_chars, output_chars, tool_calls, cached_input_chars}`（终态前发一次） |
| `done` | `"[DONE]"` |
| `stopped` | `{"partial": true}` |
| `error` | 见附录 A；legacy 为 `{code, message}`；generator 崩溃兜底为裸字符串 `"internal_error"`（视图 guard 另发 `{code: "stream_crashed"}`） |
| `cache_skipped` | `{"reason": "platform_not_supported" \| "remote_cache_unavailable"}` |

**不再存在的事件名**：`delta` / `tool_call` / `tool_result` / `reasoning`（旧文档名；工具进度走 `status`，次数走 `telemetry.tool_calls`）。每次运行恰好一个终态：`done` XOR `stopped` XOR `error`；`stopped`/`error` 前部分内容已落库为 assistant 消息。

**编辑/重生成（统一入口）**：POST body 带 `edit_message_id`（必须是同一会话内 role=user 的消息，可为任意历史位置）——带非空 `content` = 编辑后重发；空 content = 纯 regenerate（不新建 user 消息）。目标之后的全部消息被截断。目标找不到或生成器路径错误 → 经由 `_sse_error_guard` 呈现为流内 SSE error（常见为 `stream_crashed` 或 `internal_error`），不是同步 404。

**async 模式**：`POST .../chat/<sid>/?mode=async` → 200 + JSON `{message_id: <8位token>, status: "processing"}`（`message_id` 是不透明的短期运行 token，不是持久化的 assistant 消息 ID 或 Session ID，后续用 status/ 端点轮询）。

**GET /api/agents/chat/<session_id>/status/?message_id=<token>&cursor=<int>** — async 轮询：`{status, events: [{event_type, delta}], cursor, error_message}`；status ∈ `processing | done | stopped | error | not_found`；`events[].delta` 依据 `event_type` 归一化（文本类为 string，telemetry/cache_skipped 等结构化事件为 JSON object）；后端声明的 `_BUFFER_TTL = 300` 尚未在源码中强制执行（无清理过期逻辑，实际生命周期取决于后端进程生命周期；前端不得臆造 300s 本地超时）；`error_message` 为 typed dict 或字符串。

**POST /api/agents/chat/<session_id>/stop/** — 中断流：async 带 `?message_id=<token>`；SSE 模式不带（按 session 注册表）。成功 `{status: "stop_requested"}`；无活跃生成 → 404。

### 1.4 Superior Session — Agent 自主调度

**POST /api/agents/sessions/init/** — **统一会话初始化（Standard & Superior；canonical Conversation 创建入口，snapshot MM-07）**

请求字段（全部 write-only）：

| 字段 | 类型 | 说明 |
|---|---|---|
| name | string | 可选；默认 `新会话 <日期>` |
| preset_id | int | **必填**；不存在 → 400 |
| project_id | int | 可选，默认 0；**0 = Drift（映射 DB NULL）**；非 0 必须存在 → 否则 400 |
| frozen_project_ids | [int] | 可选；g045 扩展项目列表；缺省 = `[project_id]`（project_id=0 时为 `[]`）；非 g045 强制 `[]` |
| thinking_level | string | 可选，默认 `auto` |

成功 201：`{msg: "会话已建立，权限已锁定。", data: {conversation_id, session_id, session_name}}`。

| 响应字段 | 类型 | 说明 |
|---|---|---|
| conversation_id | int | **canonical**：本次创建的持久化 Conversation 身份；新消费端必须使用 |
| session_id | int | **deprecated compatibility alias**：恒等于 `conversation_id`，仅为既有 V3 创建后导航保留，无独立持久语义 |
| session_name | string | Conversation 名称 |

注意：`temperature` 不是本 serializer 的字段（前端多发的 `temperature: 1.0` 会被静默丢弃）。契约修正在 backend checkpoint `29368bbf` 落地；`/api/agents/sessions/init/` 路径暂时保留。

**GET /api/agents/chronicle/** — Superior Chronicle 日志列表

| 字段 | 类型 | 说明 |
|---|---|---|
| id | int | |
| preset | int | AgentPreset ID |
| preset_name | string | |
| event_time | datetime | |
| content | string | 自然语言摘要 |
| scope | string | public / private |
| kind | string | 日志类型 |
| keywords | [string] | |

**POST /api/agents/registers/<pk>/ack/** — 标记 Register 通知已读

### 1.5 Conversation Attachments — 会话附件（canonical，见 snapshot MM-06）

**GET /api/agents/conversations/<pk>/attachments/** — 附件列表：bare 数组，先 user 行再 tool_collection 行。user 行 `{source: "user", id, display_name, original_filename, storage_path, mime_type, file_size, created_at}`（**audio 行 storage_path 恒为 null；非 audio 行当前会暴露**——已知限制 KF-10，B1 范围）；tool_collection 行 `{source: "tool_collection", id, display_name, char_count, is_summary, is_expired, created_at}`。会话不存在 → 404。

**POST /api/agents/conversations/<pk>/attachments/** — 上传文件/图片（multipart `files`）

部分或全部成功返回 201；全部失败返回 422。两种状态都返回与输入文件同序、等长的
`results`。`attachments` / `failures` 是兼容字段，由 `results` 派生。

```json
{
  "attachments": [{"id": 12, "display_name": "ok.jpg", "mime_type": "image/jpeg"}],
  "failures": [{
    "input_index": 1,
    "display_name": "failed.jpg",
    "mime_type": "image/jpeg",
    "stage": "upload",
    "code": "attachment_upload_failed",
    "message": "图片上传失败",
    "reason": "图片上传失败",
    "diagnostics": [{
      "stage": "upload",
      "code": "attachment_upload_failed",
      "level": "error",
      "message": "图片上传失败",
      "input_variant": "preprocessed"
    }]
  }],
  "results": [
    {
      "input_index": 0,
      "status": "ok",
      "attachment": {"id": 12, "display_name": "ok.jpg", "mime_type": "image/jpeg"},
      "diagnostics": []
    },
    {
      "input_index": 1,
      "status": "failed",
      "attachment": null,
      "diagnostics": [{
        "stage": "upload",
        "code": "attachment_upload_failed",
        "level": "error",
        "message": "图片上传失败",
        "input_variant": "preprocessed"
      }]
    }
  ]
}
```

- `status`: `ok | ok_degraded | failed`
- `diagnostics`: 按处理顺序排列；可同时含 preprocess warning 与 upload error
- `input_variant`: `preprocessed | original`
- `detail` 是服务端诊断字段，HTTP 响应永不输出
- 422 额外包含 `"error": "all attachments failed"`，同时保留完整
  `attachments: []`、`failures` 与 `results`

**音频上传（PWA 录音）**：multipart 含 `audio/*` 时，请求必须携带 `model`（当前 main model name）与 `endpoint`（Endpoint ID），后端经 direct-only `resolve_session_target()` 校验 main target；managed-runtime Endpoint 在该 resolver 内以 `managed_runtime_requires_chat_resolver` 拒绝，公共上传响应归一为 422 `audio_target_required`，因此订阅 Runtime Endpoint 不适用于 audio upload。audio preflight 稳定 diagnostics：

- `audio_target_required` — 缺 model/endpoint 或 target 解析失败
- `audio_model_unsupported` — target 缺 `audio` ability 或 `file_uri` transport
- `audio_mime_unsupported` — MIME 不在 allowlist（`audio/webm;codecs=opus` / `audio/webm`）
- `audio_too_large` — 超过 10 MiB

成功/失败响应均不暴露 `storage_path`（HTTP formatter 仅输出前端契约字段，不输出 PC 路径）。

**GET /api/agents/conversations/<pk>/attachments/<id>/content/** — 流式返回本地 audio 原件

- 仅 `audio/*`；attachment 必须属于该 conversation；文件存在时 200（原 MIME + `inline` disposition + `Cache-Control: private`）
- missing / 非 audio / 跨会话 → 稳定 404
- `MessageSerializer.attachments_meta[].content_url`：audio 附件为上述同源 URL，其余附件为 `null`；前端播放使用 `content_url`，不使用 Gemini `file_uri`

**DELETE /api/agents/conversations/<pk>/attachments/delete/** — **单条**解除关联（非批量）：body `{source: "user"|"tool_collection", id}`；user 源删除成功同时从该会话所有 `Message.attachment_ids` 剥离该 id。成功 204；未知 id → 404；附件冻结在远端缓存中 → 409 `{error, detail, frozen_in_cache: true, cache_name}`；source 非法 → 400。

### 1.6 Conversation Cache — 上下文缓存

**GET /api/agents/conversations/<pk>/cache/** — 查看缓存状态

**POST /api/agents/conversations/<pk>/cache/renew/** — 重建缓存

**POST /api/agents/cache/invalidate/** — 手动失效缓存

### 1.7 Branch — 对话分支

**POST /api/agents/conversations/<pk>/branch/** — 从指定的已持久化 assistant 消息分支

- 请求体：`{"branch_from_message_id": <int>}`（必须为属于该会话的 assistant 消息 ID，非 HistoryChunk）
- 成功 201：`{"conversation_id": int, "session_id": int, "name": "Branch from <原会话名>"}`（`conversation_id` 为 canonical 导航身份；`session_id` 为 legacy 兼容别名，V4 严禁读取）
- 错误：400（ID 为空、找不到消息、无有效消息等）/ 500
- 语义：复制该消息及之前的所有有效历史（最多保留最新 21 条），在新创建的独立会话中重排索引。

---

## 第二篇  记忆 (Memory)

### 2.1 Knowledge Fragments — 知识片段

**GET /api/memory/knowledge/**

```json
[{
  "id": 1, "uid": "note-123", "title": "My Note",
  "content": "...", "project": 1, "source_type": "obsidian_md",
  "source_path": "/vault/note.md", "created_at": "..."
}]
```

**GET /api/memory/knowledge/<pk>/** / **PATCH**

### 2.2 Memory Plasmids — 记忆质粒

**GET /api/memory/plasmids/**

Query: `preset_id`（必填），可选 `scope` / `source` / `is_processed`。`is_processed`
为兼容筛选：`true` 等价于 `processing_status=ready`。

```json
[{
  "id": 1,
  "preset": 6,
  "conversation": 1,
  "message": null,
  "source": "user_manual",
  "content": "Always use dark mode",
  "scope": "global",
  "tags": ["preference"],
  "trigger_keywords": ["dark mode"],
  "weight": 1.0,
  "processing_status": "ready",
  "processing_error": "",
  "processing_attempts": 0,
  "last_processed_at": "...",
  "is_processed": true,
  "created_at": "...",
  "updated_at": "..."
}]
```

`processing_status`: `pending | processing | ready | failed`。只有 `ready` 会进入召回；
`is_processed` 是只读兼容字段。embedding 与正文 hash 不对前端暴露。

**POST /api/memory/plasmids/** — 手动创建：
`{preset_id, content, scope?, tags?, trigger_keywords?, weight?}`。即使提供 scope，创建后也先
进入 pending，embedding 成功后转为 ready。

**PATCH /api/memory/plasmids/<pk>/** —
可修改 `content`（沿用现有全局条目权限）、`scope`、`tags`、`trigger_keywords`、`weight`。
修改正文会触发重新索引；processing 字段只读。

**DELETE /api/memory/plasmids/<pk>/**

**GET /api/memory/plasmids/tags/** — 所有标签列表

### 2.3 History Chunks — 对话压缩块（canonical，见 snapshot MM-09）

**GET /api/memory/history_chunks/?conversation_id=<id>** — 父块列表（`is_subchunk=False`，按 created_at）：

```json
{"conversation_id": 1, "session_name": "...", "history_chunks": [{"id": 1, "start_index": 0, "end_index": 20, "content": "...", "keywords": [], "created_at": "..."}]}
```

`conversation_id` 必填（缺 → 400）；会话不存在 → 404。同源入口：**GET /api/agents/conversations/<pk>/history_chunks/**（同一数据，按 start_index 升序）。

**GET /api/memory/history_chunks/<pk>/** — 单条详情

**PATCH /api/memory/history_chunks/<pk>/** — **仅接受 `keywords`**（数组；其他字段静默忽略）；成功 `{msg: "已保存。", updated: {...}}`。shared `updateHistoryChunk()` 发送的 `topic_label`/`unresolved` 会被后端忽略（consumer mismatch MM-09）。

### 2.4 Memory Compaction

**POST /api/memory/compact/<session_id>/** — 触发对话压缩

### 2.5 Scope Keywords / Stop Words

**GET /api/memory/scope-keywords/** — RAG 范围关键词

**GET /api/memory/stop-words/** — 停用词列表

---

## 第三篇  核心配置 (Core)

### 3.1 GET/PATCH `/api/core/config/` — SystemConfig 单例

**GET 返回：** API key 已 masking ("****&lt;last4&gt;")、调度参数、json 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| gemini_api_key / deepseek_api_key | string | masked or "" |
| self_check_preset_ids / deep_org_preset_ids | [int] | |
| ~~heartbeat_preset_ids~~ | ~~[int]~~ | **已停用**：runtime auto eligibility 只读 `HeartbeatPolicy.enabled`（heartbeat app）；旧字段不再暴露 writable/response，DB 列暂留不读 |
| active_start / active_end | time | "HH:MM" |
| ~~heartbeat_base_hours / heartbeat_random_hours / night_heartbeat_base_hours~~ | ~~int~~ | **已停用**：cadence 区间由 heartbeat policy 决定，旧字段不再暴露 |
| deep_org_weekday | int | 0=Mon |
| deep_org_hour | int | 0-23 |
| model_generate_abstract | string | |
| updated_at | datetime | |

### 3.2 GET `/api/core/models/` — 旧模型列表（兼容）

```json
[{"provider": "gemini", "id": "gemini-2.5-flash", "roles": ["main"]}]
```

**[废弃接口]** — 使用 §3.3 model-catalog。

### 3.3 GET `/api/core/model-catalog/` — 统一模型 & 端点 & Provider 目录

```json
{
  "models": [{
    "name": "gemini-2.5-flash", "family": "gemini",
    "abilities": ["fc", "vision", "grounding", "context_cache"],
    "compatible_endpoint_ids": [1, 2]
  }],
  "endpoints": [{
    "id": 1, "name": "Gemini 官方", "provider": "gemini",
    "execution_type": "direct_api", "execution_adapter": "internal_http",
    "payload_format": "gemini", "cache_transport": "remote_reference",
    "attachment_transports": ["file_uri", "inline_text", "inline_image"],
    "configured": true, "enabled": true
  }],
  "roles": {
    "main": [
      {"model": "deepseek-v4-pro", "default_endpoint": 1,
       "style_shadow": null, "position": 0}
    ],
    "support": {
      "general_sub_agent": {"model": "deepseek-v4-flash", "default_endpoint": 1},
      "vision_helper": {"model": "gemini-2.5-flash-lite", "default_endpoint": 2},
      "grounding":     {"model": "gemini-2.5-flash", "default_endpoint": 2},
      "image_gen":     {"model": "gemini-3-pro-image", "default_endpoint": 2}
    }
  },
  "providers": [{
    "id": "antigravity",
    "display_name": "Antigravity Subscription",
    "execution_type": "managed_runtime",
    "execution_adapter": "subscription_runtime",
    "requires_endpoint_api_key": false,
    "base_url": "",
    "payload_format": "runtime",
    "cache_transport": "runtime_managed",
    "attachment_transports": [],
    "supported_families": [],
    "supported_models": ["gemini-3.1-pro-preview"],
    "model_name_overrides": {
      "gemini-3.1-pro-preview": "gemini-3.1-pro-high"
    }
  }]
}
```

`compatible_endpoint_ids` 是 backend 逐个执行 `Endpoint.configured` 与
`Endpoint.supports_model(model)` 得出的反向 projection；同一 logical model 可同时列出
多个 direct/managed Endpoint。它不是 Model-owned 关系事实，前端提交 pair 后 backend
仍会重新加载并验证。`providers` 是 Endpoint 配置 UI 的唯一 ProviderProfile 事实源，
只含非敏感 metadata，不含 Endpoint API key 正文或 Subscription Runtime token。

### 3.4 CRUD `/api/core/model-entries/` — 模型条目

**POST /api/core/model-entries/**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| name | string | yes | 唯一 |
| family | string | yes | gemini / deepseek / openrouter / glm |
| abilities | [string] | yes | fc / vision / grounding / image_gen / thinking / context_cache |
| enabled | bool | yes | |

**PATCH** / **DELETE** — 被 role binding 引用返回 409 (code: `model_in_use`)

### 3.5 CRUD `/api/core/endpoints/` — 通道端点

**POST /api/core/endpoints/** — 写字段仅 4 个：

| 字段 | 类型 | 必填 |
|---|---|---|
| name | string | yes |
| provider | string | yes | gemini / deepseek / openrouter / glm / antigravity |
| api_key_alias | string/null | no | direct profile 使用匹配的 ApiKey alias；managed profile 必须为 null |
| enabled | bool | no | default true |

以下字段由 ProviderProfile 派生，**只读**：
`base_url` / `payload_format` / `cache_transport` / `attachment_transports` /
`supported_families` / `supported_models` / `excluded_models` /
`model_name_prefix` / `model_name_overrides` / `execution_type` /
`execution_adapter` 等。Endpoint 的旧 `processor` 字段已删除；
`engines.model_registry.ProviderConfig.processor` 仅表示 legacy CLI bridge route，属于另一命名空间。

`configured` 只表示 Endpoint 本地完整性：`direct_api + internal_http` 必须有 Endpoint
ApiKey；`antigravity + managed_runtime + subscription_runtime` 必须完整匹配 backend
ProviderProfile 且不得有 Endpoint ApiKey。`enabled` 是独立开关；disabled Endpoint即使
configured也不会被 resolver调用。

provider change 触发事务校验：所有引用此 Endpoint 的 role binding + shadow model
必须兼容新 profile；任一不兼容 → 400 回滚。

**DELETE** — 被引用返回 409 (code: `endpoint_in_use`)

### 3.6 CRUD `/api/core/apikeys/` — API Key

**POST /api/core/apikeys/**

```json
{"alias": "my-key", "platform": "deepseek",
 "key_value": "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxa1b2"}
```

key_value write-only，响应不返回。last_four 自动提取。

**PATCH /api/core/apikeys/<alias>/** — 仅改 alias

**PUT /api/core/apikeys/<alias>/overwrite/** — 改 key_value

**DELETE /api/core/apikeys/<alias>/** — 级联删除同 key_value 所有行 + 清 SystemConfig 兜底字段

### 3.7 GET/PUT `/api/core/config/roles/` — 角色模型绑定

**GET：**

```json
{
  "main": [
    {"model": "deepseek-v4-pro", "default_endpoint": 1,
     "style_shadow": "deepseek-v4-flash", "position": 0}
  ],
  "support": {
    "general_sub_agent": {"model": "deepseek-v4-flash", "default_endpoint": 1},
    "vision_helper":     {"model": "gemini-2.5-flash-lite", "default_endpoint": 2},
    "grounding":         {"model": "gemini-2.5-flash", "default_endpoint": 2},
    "image_gen":         {"model": "gemini-3-pro-image", "default_endpoint": 2}
  }
}
```

**PUT** — 全量替换，事务内 diff 更新

- main 至少 1 条；4 个 support role 必须齐全
- style_shadow：model name 字符串或 null (auto → general_sub_agent)
- main 的 style_shadow model 必须 enabled + fc ability + family 兼容 endpoint

### 3.8 Projects — 项目管理

**GET /api/core/projects/** — 列表（source: `core/serializers.py` ProjectSerializer）

```json
[{"id": 1, "name": "My Note", "description": null, "prompt": null, "work_dir": null, "created_at": "..."}]
```

- 字段集：`id / name / description / prompt / work_dir / created_at`（无 `title`；V3 文档旧称 `title` 已废止）
- `ProjectViewSet` 排除 `name="Archived Project"` 的归档项目

**POST /api/core/projects/** / **PATCH** / **DELETE** — 删除触发 archive

### 3.9 Project Files — 项目文件

**POST /api/core/projects/<project_pk>/files/** — multipart 上传

**DELETE /api/core/projects/<project_pk>/files/<pk>/** — 删除文件 + KnowledgeFragment

### 3.10 Tweets — 时间线推文

**GET /api/core/tweets/** — 列表（支持回复嵌套）

**POST /api/core/tweets/** — `{author: "agent:1", content: "..."}`

**POST /api/core/tweets/<pk>/reply/** — 回复推文

---

## 第四篇  日程 (Tasks)

### 4.1 CRUD `/api/tasks/entries/` — 日程条目（canonical ScheduleEntry schema，见 snapshot MM-08）

**POST /api/tasks/entries/** — 创建

| 字段 | 类型 | 说明 |
|---|---|---|
| title | string | 必填 |
| description | string | |
| entry_type | string | **todo / periodic / goal**（创建后不可变更，400） |
| status | string | active / suspended / escalated / archived（默认 active） |
| is_pinned | bool | 置顶 |
| start_date | date | 必填 |
| tags | [string] | |
| due_date | date | todo |
| interval_unit / interval_value | string / int | periodic：day / week / month × N |
| end_type / end_count / end_date | string / int / date | periodic：count / date / never |
| goal_count / goal_period | int / string | goal：week / month |
| cycle_start / cycle_due | date | goal 周期边界（系统管理） |

响应为完整 ScheduleEntrySerializer 行（含只读 `occurrences_done` / `gcal_event_id` / `gcal_event_link` / 计算字段 `current_cycle_completions` / `next_periodic_due`）。列表 **GET /api/tasks/entries/**：bare 数组，`?status=` `?entry_type=` `?is_pinned=true` 过滤；排序 `-is_pinned, due_date, cycle_due, start_date`；无分页。

**PATCH /api/tasks/entries/<pk>/** — 同写字段（entry_type 不可变）；gcal 已关联条目自动 best-effort 同步 GCal。**DELETE** — **软删除**：status → `archived` 并解除 GCal 关联（204）；行不物理删除。

> 旧文档的 `type`（task/habit/memo/appointment/one_time/deadline）、`recurrence`、`priority` 字段**不存在**——entry_type 才是源字段。

### 4.2 条目状态操作（canonical）

- **POST /api/tasks/entries/<pk>/complete/** — body 可选 `{note}`；**201** + CompletionRecordSerializer 行。前置：status 必须为 active/escalated，否则 400。副作用按类型：todo → 自动 archived；periodic → `occurrences_done += 1`（end 条件满足则 archived）；goal → 仅记 record（cycle 计数）。CompletionRecord 是所有完成状态的单一来源
- **POST /api/tasks/entries/<pk>/suspend/** / **resume/** — 无条件切换（suspend 同时清 is_pinned）；200 + 完整 serializer 行
- **POST /api/tasks/entries/<pk>/gcal/** — 推送/更新 GCal → 200 `{gcal_synced: true, gcal_event_id, gcal_event_link}`；失败 502
- **DELETE /api/tasks/entries/<pk>/gcal/** — 解除关联：未关联 → 400；成功 204

### 4.3 Calendar — 日历视图

- **GET /api/tasks/calendar/** — 90 天合并 GCal + ExoCore snapshot（后端维护生成的本地 JSON，无固定 schema）；快照文件缺失 → **503** `{detail: "Calendar snapshot not yet available..."}`
- **GET /api/tasks/calendar/today/** — 48h 子集（同上 503 语义）

### 4.4 Completions — 完成记录

**GET /api/tasks/completions/?entry=<pk>** — 已完成条目历史（bare 数组，`-completed_at` 排序；`entry` 可选过滤）

---

## 第五篇  用量统计 (Telemetry)

### 5.1 Usage Stats

- **GET /api/telemetry/daily/** — `{date, total_tokens, total_calls, by_model: {...}}`
- **GET /api/telemetry/usage/** — 累计统计
- **GET /api/telemetry/weekly/** — 按周统计
- **GET /api/telemetry/monthly/** — 按月统计

---

## 第六篇  Council (多人协作)

### 6.1 Sessions

**POST /api/council/sessions/** — 创建 Council session

**GET /api/council/sessions/<pk>/** — 查看状态

### 6.2 Dispatch / Cross-Exam / Synthesize

- **POST /api/council/sessions/<pk>/dispatch/** — 分派议程给 Agent
- **POST /api/council/sessions/<pk>/cross_exam/** — 交叉审查
- **POST /api/council/sessions/<pk>/synthesize/** — 综合结论
- **POST /api/council/sessions/<pk>/finish/** — 结束 session

---

## 第七篇  群聊 (GroupChat)

> 与 snapshot 对齐（MM-04/MM-05）：**不存在 `/send/` 路由**，消息面是 `/messages/`，广播是 `/broadcast/`。GroupChat 是独立实体（participant_ids 为 AgentPreset id 的 JSON 数组，2=user），不是普通 Conversation，不调用普通 Conversation 专属接口。

### 7.1 Group Chat CRUD

**GET /api/groupchat/?participant_id=<int>** — 群聊列表：bare 数组，`-created_at` 排序；participant_id 可选过滤（非整数 → 400）

**POST /api/groupchat/** — 创建：`{name (必填), prompt (可选, 默认 ""), participant_ids (可选, 默认 [])}` → 201，行字段 `{id, name, prompt, participant_ids, created_at}`

**GET /api/groupchat/<pk>/** — 群聊详情（行字段同上；**不含消息**）

**PATCH /api/groupchat/<pk>/** — `{name, prompt, participant_ids}`（participant_ids 整体替换）→ 200 行字段

**DELETE /api/groupchat/<pk>/** — 204；消息级联删除；群不存在 → 404 `{error: "群聊不存在"}`

### 7.2 Messages & Broadcast

**GET /api/groupchat/<pk>/messages/** — 消息列表：bare 数组按 created_at 升序，无分页；行字段 `{id, group, sender_id, content, mention_ids, reasoning_content, created_at}`（`read_by` 不进 API）

**POST /api/groupchat/<pk>/messages/** — 发消息：body `{sender_id (int), content (必填), mention_ids?, reasoning_content?}`；`group` 由 URL 强制覆盖；sender_id 为纯 int，**无成员/存在性校验**（未知 id 也 201）；user 发送者会触发 global-activity on-commit 钩子

**POST /api/groupchat/<pk>/broadcast/** — 广播：让群内所有非 user agent 参与者单轮回复

body：`{message_id: <触发广播的用户消息 id>}`（canonical 字段名；提供且非 0 时校验：不存在 → 400 `message_id 不存在`；不属于本群 → 400）

响应 **202**：`{participants: [preset_ids], message_id, errors: [{preset_id, error}]}`；无参与者也返回 202 + 空 participants（不是错误）

> ⚠️ **已知 consumer mismatch（MM-05 / KF-06）**：当前 GroupchatRoom 发送 `{user_message_id}` 而后端只读 `message_id` → 线上广播退化为无锚点触发（message_id=0），校验不生效。修复归属独立 bugfix 或 P2 群聊迁移，不在 P0 修。

---

## 第八篇  推送通知 (Push)

> 与 snapshot 对齐（MM-10）：**`GET /api/push/notifications/` 不存在且未挂载**——任何代码都不调用它；通知投递是 server → service worker push，不是轮询列表。契约分三个独立表面：

### 8.1 Subscription

**POST /api/push/subscribe/** — 注册/更新设备订阅（按 endpoint upsert，create 与 update 均返回 201）

body：`{subscription: <PushSubscription.toJSON()> (endpoint 必填, keys.p256dh/auth 必填), device_name?: string (≤200; 未提供时重置为 "")}` → 201 `{id, endpoint, p256dh, auth, user_agent, device_name, is_active, created_at, updated_at}`

**POST /api/push/unsubscribe/** — 删除订阅：body `{endpoint}` → **204 幂等**（存在与否都 204）

### 8.2 Service-worker 投递 & 站内通知（无轮询端点）

- 后端推送 payload 经各 SPA `public/sw.js` + `push-notification.js` 处理；notificationclick/close 由 SW 直接 `POST /api/agents/registers/<pk>/ack/`（见 §1.4 上方 Register ack）
- SW postMessage（`PUSH_NAVIGATE`）→ 各 SPA `NotificationContext` → 内存 store（cap 20，无 localStorage）→ 悬浮 NotificationPanel
- 订阅 UI 仅存在于 chat-core `/settings/notifications`；localStorage key `exo_push_device_name`
- 各 SPA 的 NotificationContext/store/SW 为字节一致的复制品（V4 P2 收敛为单一 shell owner 的候选）

### 8.3 Register 确认（ack）

**POST /api/agents/registers/<pk>/ack/?preset_id=<int>** — body `{action: "navigate"|"dismiss" (默认 navigate), subscription_endpoint?: string}` → 200 `{id, content}`（content 前缀改写为用户已查看/忽略）；preset_id 缺失/非整数 → 400；Register 不属于该 preset → 404。ack 会把 expires_at 延长 1h。

---

## 第九篇  Heartbeat (心跳会话)

### 9.1 Event 只读账本 — 列表

**GET /api/heartbeat/events/?preset_id=<int>&limit=<int>&offset=<int>** — 按 preset 分页读取心跳 Event 列表

Query 参数：

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| preset_id | int | 是 | 必须存在；缺失 / 非整数 / 不存在 → 400 |
| limit | int | 否 | 默认 20，最大 50；越界或非整数 → 400 |
| offset | int | 否 | 默认 0，非负；负数或非整数 → 400 |

排序稳定为 `started_at DESC, session_uuid DESC`（session_uuid 决胜，构成全序）；
`total_count` 是过滤后总数，`has_more` 与分页事实一致；只返回该 preset 的 Event，不泄漏其他 preset。

成功响应（含空列表）恒为 200 + 固定 envelope：

```json
{
  "events": [{
    "session_uuid": "8f2a4c1e-9b3d-4a5e-8c7f-1d2e3f4a5b6c",
    "preset_id": 1,
    "preset_name": "Alicia",
    "launch_source": "auto",
    "domain": "",
    "status": "succeeded",
    "content": "…",
    "started_at": "2026-08-13T10:00:00Z",
    "completed_at": "2026-08-13T10:15:00Z"
  }],
  "total_count": 1,
  "has_more": false
}
```

无 Event 的合法 preset 返回 `events=[]`、`total_count=0`、`has_more=false`。

列表项字段（精确 allowlist，不包含 seed_message / tool_history / error_summary 等详情字段）：

| 字段 | 类型 | 说明 |
|---|---|---|
| session_uuid | string (uuid) | Event 唯一 ID |
| preset_id | int | 归属 preset |
| preset_name | string | 归属 preset 名称 |
| launch_source | string | auto / agent / notification |
| domain | string | trusted initial Drawer 域（可为空字符串） |
| status | string | pending / running / succeeded / failed |
| content | string | 最终摘要正文（失败时为空字符串） |
| started_at | datetime | aware UTC ISO-8601；可为 null |
| completed_at | datetime | aware UTC ISO-8601；可为 null |

### 9.2 Event 只读账本 — 详情

**GET /api/heartbeat/events/<session_uuid>/** — 读取单个 Event 详情

详情在列表字段之外额外返回（精确 allowlist）：

| 字段 | 类型 | 说明 |
|---|---|---|
| seed_message | string | 交给 Actor 的种子消息 |
| tool_history | array | 安全 tool 执行记录（不含 raw 参数 / reasoning） |
| error_summary | string | 安全错误摘要（≤500 字符，不含 traceback / raw payload） |
| finalization_reason | string | explicit / max_segments；可为 null |
| attempt_number | int | 实际执行序号（首次 attempt=1，每次 retry 递增；每次 retry 是独立新 Event 与新 UUID） |
| wake_up_task_id | int | 关联 WakeUpTask；可为 null |
| source_conversation_id | int | 可信来源会话；可为 null |
| acknowledged_at | datetime | 用户确认时间；可为 null |

非法 / 格式错误 UUID → 400；不存在 → 404。

### 9.3 契约与责任

- **无写方法**：本阶段没有 Event 的 POST / PATCH / DELETE 接口；其他方法一律 405。
- **时间责任**：后端只返回 timezone-aware 的 UTC ISO-8601 时间；浏览器负责转换为用户本地时区（含 DST）。
- **只读语义**：GET 不会 acknowledge，也不修改任何 Event 字段。
- **历史完整性**：failed、中断收敛的 failed 与后续 succeeded 全部保留为独立 Event；前端不得按 WakeUpTask 去重或只显示最新成功。

### 9.4 错误信封

参数校验与查找失败统一为 `{"error": <message>, "code": <code>}` 信封（HTTP 400 / 404）：

| 场景 | HTTP | code |
|---|---|---|
| preset_id 缺失 | 400 | preset_id_required |
| preset_id 非整数 | 400 | invalid_preset_id |
| preset_id 不存在 | 400 | preset_not_found |
| limit 非法 | 400 | invalid_limit |
| offset 非法 | 400 | invalid_offset |
| session_uuid 非法 | 400 | invalid_event_uuid |
| Event 不存在 | 404 | event_not_found |

### 9.5 `go_to` 前台提醒归属（冻结，后端待施工）

`go_to` Event 的领取归属是 `AgentPreset`，不是发起 Conversation。任意属于同一
preset 的 live main Conversation 都可显示和领取结果。最新 user 请求的
`<ExoCore>` 顶部最多注入 5 个 `acknowledged_at=null` 的 `go_to` Event；更多旧项只显示
剩余数量，并提示通过 `trace_self` 查找。

- pending / running：`go_to(action="get")` 只返回状态，不 acknowledge；
- succeeded / failed：成功读取后写 `acknowledged_at`；
- Heartbeat Event API、`trace_self` 与前端 GET 永不 acknowledge；
- 普通 auto / scheduled wakeup / notification Event 不进入该提醒。

---

## 第十篇  Tool Drawer 与 MCP 凭证管理（Frozen / Backend Pending）

> 本篇是前后端施工契约，当前端点尚未实现。前端可以据此完成界面与 API wrapper，
> 但在后端交付前必须正确展示 unavailable/error，不得伪造保存成功。

### 10.1 Drawer Catalog

**GET /api/agents/drawers/** — 返回本地代码登记的全部合法 Drawer；前端不能创建或提交任意名称。

```json
{
  "drawers": [{
    "name": "galatea_garden",
    "display_name": "Galatea Garden",
    "description": "Galatea 花园工具抽屉",
    "server_name": "galatea_garden",
    "available": true,
    "credential_strategy": "per_preset",
    "credential_required": true
  }]
}
```

`credential_strategy` 枚举：

| 值 | 语义 |
|---|---|
| none | server 不使用凭证；不允许配置 alias |
| shared | 只使用 server 公共 alias |
| per_preset | 每个 visitor preset 必须配置自己的 alias；禁止公共 fallback |
| shared_or_per_preset | preset 可显式继承公共 alias，或选择自己的 alias |

`available=false` 表示后端 adapter/server 尚不可运行；它与 preset visitor 授权是两个事实。

### 10.2 Preset Drawer visitor 授权

**GET /api/agents/presets/<preset_id>/drawers/**

```json
{
  "preset_id": 6,
  "drawers": [{
    "name": "galatea_garden",
    "display_name": "Galatea Garden",
    "server_name": "galatea_garden",
    "available": true,
    "enabled": true,
    "credential_strategy": "per_preset",
    "credential_required": true,
    "credential_mode": "dedicated",
    "credential_alias": "galatea-agent-6",
    "credential_ready": true
  }]
}
```

**PUT /api/agents/presets/<preset_id>/drawers/<drawer_name>/**

```json
{"enabled": true}
```

成功返回更新后的单个 Drawer 配置对象。规则：

- `enabled` 必须是 JSON boolean；
- 未知 Drawer / preset 显式失败；
- visitor 授权不创建、复制或删除凭证；
- 取消 visitor 不删除已存 alias/binding；
- 配置变化只影响后续 standard live-chat 请求与后续 HeartbeatActor；已开始的请求/Actor 保留 run-scoped 快照；
- `合法 catalog ∩ 当前 preset enabled visitor` 是 visitor 授权事实：`go_to.domain` 直接使用该集合；Heartbeat `tool_activate` 与 standard `use_drawer` runtime 再交集 credential-ready scope；
- standard 的真实 `mcp_*` declarations 不进入模型工具面；恒定 `use_drawer` + 当轮 manifest 保持 context-cache tools hash 不随 Drawer 授权变化。

### 10.3 MCP Credential alias CRUD

MCP 凭证与现有 Provider API key 一样按 alias 管理，但使用独立资源；凭证值是 opaque
key/token 字符串，不复用 `ApiKey.platform` 或 Endpoint 绑定。

**GET /api/agents/mcp-credentials/?server_name=<name>**

```json
{
  "credentials": [{
    "alias": "galatea-agent-6",
    "server_name": "galatea_garden",
    "last_four": "a1b2",
    "created_at": "2026-08-13T10:00:00Z",
    "updated_at": "2026-08-13T10:00:00Z"
  }]
}
```

**POST /api/agents/mcp-credentials/**

```json
{
  "alias": "galatea-agent-6",
  "server_name": "galatea_garden",
  "credential_value": "opaque-secret-value"
}
```

**PATCH /api/agents/mcp-credentials/<alias>/** — 仅允许修改 alias。

**PUT /api/agents/mcp-credentials/<alias>/overwrite/**

```json
{"credential_value": "replacement-secret-value"}
```

**DELETE /api/agents/mcp-credentials/<alias>/** — 被公共或 preset binding 引用时返回 409，
不做隐式解绑。

所有成功响应都不得返回 `credential_value`；前端不得缓存、回显、记录或尝试读取明文。
`last_four` 仅是不可恢复的确认提示。alias 全局唯一且不得包含 `/`。

### 10.4 MCP server 公共凭证绑定

**GET /api/agents/mcp-servers/**

```json
{
  "servers": [{
    "name": "galatea_garden",
    "display_name": "Galatea Garden",
    "available": true,
    "credential_strategy": "per_preset",
    "credential_required": true,
    "public_credential_alias": null,
    "public_credential_configured": false
  }]
}
```

**PUT /api/agents/mcp-servers/<server_name>/credential/**

```json
{"credential_alias": "<same-server-alias-or-null>"}
```

`credential_alias=null` 清除公共绑定但不删除 alias。仅 `shared` /
`shared_or_per_preset` server 接受公共绑定；alias 必须属于同一 server。当前 Galatea 是
`per_preset`，因此对它调用本 PUT 必须返回 `credential_strategy_mismatch`；该接口为未来合法
shared server 冻结，不代表 Moonlight 已接入。

### 10.5 Preset MCP 凭证选择

**GET /api/agents/presets/<preset_id>/mcp-credentials/**

```json
{
  "preset_id": 6,
  "servers": [{
    "server_name": "galatea_garden",
    "credential_strategy": "per_preset",
    "credential_required": true,
    "mode": "dedicated",
    "credential_alias": "galatea-agent-6",
    "resolved_source": "preset",
    "resolved_alias": "galatea-agent-6",
    "credential_ready": true
  }]
}
```

**PUT /api/agents/presets/<preset_id>/mcp-credentials/<server_name>/**

继承公共凭证：

```json
{"mode": "inherit_public", "credential_alias": null}
```

使用一对一凭证：

```json
{"mode": "dedicated", "credential_alias": "galatea-agent-6"}
```

规则：

- `mode` 仅为 `inherit_public | dedicated`；
- `dedicated` 必须提交同 server 的 alias；`inherit_public` 必须提交 null；
- `per_preset` server 只接受 `dedicated`；`shared` server 只接受 `inherit_public`；
- `none` server 不接受 binding；
- `resolved_source` 为 `public | preset | none`；
- required server 无有效解析结果时 `credential_ready=false`，Drawer visitor 可以保存，
  但 `go_to`/`tool_activate`/MCP dispatch 必须在网络调用前 fail closed；
- resolver 只使用 server-owned caller preset identity，不接受 tool args 中的 preset、alias、token。

### 10.6 稳定错误信封

本篇端点错误统一为：

```json
{"error": "安全、可操作的说明", "code": "stable_code"}
```

| HTTP | code | 场景 |
|---|---|---|
| 400 | invalid_request | 字段类型、组合或 enum 非法 |
| 400 | credential_strategy_mismatch | mode/公共绑定违反 server strategy |
| 400 | credential_server_mismatch | alias 不属于目标 server |
| 404 | preset_not_found | preset 不存在 |
| 404 | drawer_not_found | Drawer 不在本地合法 catalog |
| 404 | mcp_server_not_found | server 不在本地合法 catalog |
| 404 | credential_alias_not_found | alias 不存在 |
| 409 | credential_in_use | 删除仍被 binding 引用的 alias |
| 503 | drawer_unavailable | Drawer/server adapter 当前不可用 |

---

## 附录 A — Typed Error Shape (§P1-11 commit 6)

SSE 和 async polling 共用的稳定 error payload：

```json
{
  "code": "auth_error",
  "message": "API key invalid or expired.",
  "provider": "gemini", "model": "gemini-2.5-flash",
  "endpoint_id": 1, "retryable": false
}
```

### Error Codes

| code | 触发条件 | retryable |
|---|---|---|
| `auth_error` | HTTP 401/403 | false |
| `rate_limited` | HTTP 429 | true |
| `service_unavailable` | HTTP 5xx | true |
| `target_resolution_error` | resolver 失败 | false |
| `protocol_error` | provider 返回违反 gateway 契约的数据 | false |

### target_resolution_error 子 code

`model_not_found` / `endpoint_not_found` / `model_disabled` / `endpoint_disabled` /
`incompatible_pair` / `ambiguous_endpoint` / `model_not_in_main_pool` /
`main_not_resolvable_here` / `alias_not_found` / `alias_provider_mismatch` /
`managed_runtime_requires_chat_resolver` / `runtime_preset_not_allowed` /
`runtime_rejects_api_key_alias` / `unknown_execution_pair`

## 附录 B — ProviderProfile 参考值

| id | display_name | base_url | payload | cache | attachments | execution_type | execution_adapter | requires_endpoint_api_key | supported_models / mapping |
|---|---|---|---|---|---|---|---|---|---|
| gemini | Gemini 官方 | "" | gemini | remote_reference | file_uri, inline_text, inline_image | direct_api | internal_http | true | preserve |
| deepseek | DeepSeek 官方 | https://api.deepseek.com/v1 | openai | inline_chunk | inline_text, inline_image | direct_api | internal_http | true | preserve |
| openrouter | OpenRouter | https://openrouter.ai/api/v1 | openai | inline_chunk | inline_text, inline_image | direct_api | internal_http | true | preserve |
| glm | GLM 官方 | https://open.bigmodel.cn/api/paas/v4 | openai | inline_chunk | inline_text | direct_api | internal_http | true | preserve |
| antigravity | Antigravity Subscription | "" | runtime | runtime_managed | — | managed_runtime | subscription_runtime | false | gemini-3.1-pro-preview → gemini-3.1-pro-high |

supported_families:
- gemini: (gemini)  
- deepseek: (deepseek)  
- openrouter: (openrouter, gemini, deepseek)  
- glm: (glm)
- antigravity: ()
