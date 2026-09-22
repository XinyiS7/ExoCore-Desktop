# ExoCore API Reference (ReactSheet)

> Generated from live Django URL config + serializer fields. P1-11 commit 1-5 shape.

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

### 1.2 Conversation CRUD — 对话管理

**GET /api/agents/conversations/**

```json
[{
  "id": 1, "name": "Chat with Alicia",
  "project": 1, "project_name": "My Project",
  "agent_preset_id": 1, "agent_type": "g045",
  "temperature": 1.0, "thinking_level": "medium",
  "frozen_project_ids": [1], "created_at": "2026-01-01T00:00:00Z"
}]
```

**POST /api/agents/conversations/** — name + project (必填) / agent_preset (可选)

**PATCH /api/agents/conversations/<pk>/** — name / project / archive

**DELETE /api/agents/conversations/<pk>/**

### 1.3 Chat SSE — 实时对话

**POST /api/agents/chat/<session_id>/** — SSE 流式响应

`galatea_mcp` 已废弃：后端即使收到该旧字段也不得把 Galatea MCP declarations 拼入主会话。standard live chat 只暴露恒定 `use_drawer` 代理，并在每次请求的 `<ExoCore>` 中列出当前 preset 已授权且 credential-ready 的 Drawer/短工具名；模型先 `describe` 获取 schema，再 `call`。Heartbeat 继续使用既有 `tool_activate` 抽屉机制；g045 主会话不参与本代理。前端应停止发送旧字段。

event types: `delta` / `tool_call` / `tool_result` / `error` / `done`

error payload (commit 6 shape):

```json
{
  "code": "auth_error",
  "message": "API key invalid or expired.",
  "provider": "gemini", "model": "gemini-2.5-flash",
  "endpoint_id": 1, "retryable": false
}
```

**GET /api/agents/chat/<session_id>/status/** — `{status: "running" | "completed" | "error"}`

**POST /api/agents/chat/<session_id>/stop/** — 中断流

### 1.3.1 assistant_trace — 助手运行轨迹（P1D，additive）

**SSE 事件**：既有事件不变，新增一个事件类型 `assistant_trace`（TS 名 `AssistantTraceEvent`，`version: 1`）：

```ts
type AssistantTraceEvent =
  | {
      version: 1;
      run_id: string;
      sequence: number;
      item_id: string;
      kind: "thinking";
      lifecycle: "delta";
      text_delta: string;
    }
  | {
      version: 1;
      run_id: string;
      sequence: number;
      item_id: string;
      kind: "tool";
      call_id: string;
      lifecycle: "started" | "succeeded" | "failed";
      tool_name: string;
      argument_preview?: string | null;
      result_summary?: string | null;
      error_summary?: string | null;
      duration_ms?: number | null;
    };
```

async 轮询携带同一对象：`{"event_type":"assistant_trace","delta":{...}}`（streaming_buffer 原样透传，两传输顺序严格一致）。

规则：
- `sequence` 从 0 开始、单次 run 内严格递增，是 SSE 与 async 的唯一服务端顺序。`assistant_trace` 对 P1D 排序具备权威性；既有 `thinking` 事件继续保留（V3 兼容）且文本一致。
- 连续 Thinking delta 共享同一 `item_id`；ToolCall 之后恢复的 Thinking 使用新 `item_id`。
- ToolCall：`started` 在 execute 前发出（且仅在经由声明授权后），至多一次 terminal（`succeeded`/`failed`），`call_id`/`item_id` 全程稳定。同一 `call_id` 二次调用 `tool_finished` 幂等（不产生第二个 terminal）。未收到 terminal 的 tool 在历史投影中为 `incomplete`，后端不伪造成功。未授权工具完全不产生 trace 事件。
- 安全（frozen §3，后端不负责任何用户侧 redaction）：
  - `run_id`/`item_id`/`call_id`/`tool_name` ≤ 128 字符；`tool_name` 还会做控制字符剥离/空白折叠，超长以 `…` 限长（identity 靠 `call_id`）；
  - `argument_preview` ≤ 500 字符，且只由**封闭 enum/boolean 词表**字段构造——free-form/路径/指令字段（query、content、target、message、skill_name、drawer/tool_name 等）以及词表外值（即使出现在 enum 位置）一律省略；
  - `result_summary` / `error_summary` 仅在 `CONTENT_SUMMARY_ALLOWLIST` 内产出（后端审计通过的工具；当前为空 → 恒 `null`）。原始 result/error 文本绝不外发；
  - 所有字符串控制字符规范化；超限以显式 marker `…` 截断（或整体省略），不返回 raw args/results，不泄漏被裁内容。

**历史只读字段**：assistant Message 行新增可选只读 `assistant_run_trace`：

```ts
type AssistantRunTraceProjection =
  | {
      version: 1;
      availability: "available";
      items: Array<
        | {
            item_id: string;
            order: number;
            kind: "thinking";
            text: string;
          }
        | {
            item_id: string;
            order: number;
            kind: "tool";
            call_id: string;
            lifecycle: "started" | "succeeded" | "failed" | "incomplete";
            tool_name: string;
            argument_preview?: string | null;
            result_summary?: string | null;
            error_summary?: string | null;
            duration_ms?: number | null;
          }
      >;
    }
  | {
      version: 1;
      availability: "legacy_unavailable";
      reason: "ordering_unavailable";
    };
```

- `items[].order` 唯一非负整数，数组升序；连续 Thinking delta 可合并为单个历史 Thinking item（相对 Tool 位置不变）。
- 非 assistant 行：`assistant_run_trace` 恒为 `null`（统一行为）。
- assistant 行无存储投影（旧行 / wezterm bridge / 非 chat 执行等未记录 trace 的路径）→ `legacy_unavailable`（不根据 `reasoning_content` + `tool_calls` 推断交错）。
- 新 trace-capable run 即使空（无 thinking/工具）也返回 `available` 且 `items: []`。
- 投影上限：200 items；序列化 JSON ≤ 64 KiB（按含 `"truncated": true` 指示位的**最终负载**计量，指示位本身计入预算）；超限截尾并附加安全指示符 `"truncated": true`（frozen §3.5 要求的显式截断指示，为 DTO 的唯一 additive 可选字段；前端需归一化）。
- 读取兼容：合法 Recorder 输出经 MessageSerializer 原样回传（round-trip 不变，不解析/不重写/不重新授权历史工具）；仅做根级 fail-closed 兼容检查——非 dict / `version != 1` / `availability` 不符 / `items` 非 list 的存储值回落 `legacy_unavailable`。
- `reasoning_content` 与 `tool_calls` 字段语义不变。

### 1.3.2 client_turn_id — ordinary send 的乐观行相关性（V4，additive）

**请求字段：** `POST /api/agents/chat/<session_id>/` 可选 body 字段 `client_turn_id`（UUID 字符串）。前端在每次 ordinary send 派发前生成一个（每次 POST attempt 一个值），与本地乐观临时行共享同一值。

- 缺省保持兼容：不带该字段的 POST 行为不变，本次创建的 user 行 `client_turn_id = null`。
- present-but-empty / 非字符串 / 非法 UUID → `400 {"code": "invalid_client_turn_id", "error": "..."}`，发生在会话偏好写入、Message 落盘、runtime 预留、附件 finalization 与 generation 之前。
- 与 `edit_message_id` 同时出现 → `400 {"code": "client_turn_id_not_allowed_for_edit", "error": "..."}`：edit/regenerate 不创建新的 ordinary optimistic user 行，因此不接受该字段。
- 同一 UUID 已绑定过其他消息 → `409 {"code": "client_turn_id_conflict", "error": "..."}`，不重放为幂等成功、不静默改派；数据库层非 NULL 唯一约束是并发下的最终兜底（任何情况下都不会出现第二条绑定行）。

**持久语义：** 合法 ordinary send 把该 UUID 绑定到本次真正创建的 canonical user `Message`：direct/provider 的文本行与附件（audio）锚点行、以及 managed/subscription-runtime 在原子 user-message创建 seam 内的 user 行同规则。assistant/system/developer 行、历史行、edit/regenerate 与其他 Message 生产者（bridge / groupchat / background / push 等）恒为 `null`（由数据库 check 约束强制，不是前端约定）。

**读取字段：** history `GET /api/agents/chat/<session_id>/`（分页与 legacy 全量数组共用 `MessageSerializer`）的消息行新增只读字段：

```ts
client_turn_id: string | null
```

已绑定 user 行返回该 UUID 的 canonical 字符串；未绑定/旧行/非 user 行返回 `null`。前端只在 `role === "user"` 且该值与本轮乐观行精确相等时抑制乐观行；不得用正文/时间戳/附件/`index_in_session` 推断对应关系。

**明确不包含：** 不新增 SSE/poll 事件、响应头或 async ACK；async `message_id` 仍是 opaque token，不是消息身份；不引入幂等重放协议、history gate 或发送前历史就绪门。

### 1.3.3 Managed Runtime regenerate — 用户确认放弃旧执行

V4 重新生成仍使用现有 Chat POST 形状：选择 managed/subscription-runtime endpoint，并传入持久化 user Message 的 `edit_message_id`；纯 redo 的 `content` 可为空，编辑后重试则传新正文。不新增请求字段。

该动作表示用户明确放弃该 user Message 的旧回复或未决执行，只接受当前 canonical 上下文下的新执行。后端保留并复用同一条 canonical user Message，不创建重复 user 行；旧 RuntimeTurn 保留为审计历史。若旧请求可能已抵达 provider（包括 `indeterminate` / `recovery_required`），后端须先验证退役旧 generation，再创建 N+1 generation：replacement bootstrap 严格结束于目标 user Message 之前，目标正文仅作为新 TurnRequest 的 current input 发送一次。退役失败或结果不确定时不得 supersede 旧 turn、不得创建 replacement、不得发送重试。

Runtime regenerate 当前仅支持 text-only 目标；目标 Message 自带附件时在 canonical edit/truncate 之前显式拒绝。Direct/API edit/regenerate 语义不变。

### 1.4 Superior Session — Agent 自主调度

**POST /api/agents/sessions/init/** — 创建 Conversation（Standard / Superior(g045) 通用）

201 成功响应（P1A-B0 frozen contract）：

```json
{
  "msg": "会话已建立，权限已锁定。",
  "data": {
    "conversation_id": 88,
    "session_id": 88,
    "session_name": "新会话"
  }
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| data.conversation_id | int | **canonical**：新建 Conversation 的唯一持久本地容器身份（= Conversation.id）；新消费端必须使用此字段 |
| data.session_id | int | **已废弃兼容别名**（= conversation_id）；仅为既有 V3 消费端保留，无独立持久语义，新代码禁止使用 |
| data.session_name | string | 会话名称 |

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

### 1.5 Conversation Attachments — 会话附件

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
- `audio_model_unsupported` — target 缺 `audio` ability 或可用 audio transport（普通发送需 `inline_audio`；cache_reuse 需 cache-compatible `file_uri`；compose upload 阶段校验具备任意可用 audio transport）
- `audio_mime_unsupported` — MIME 不在 allowlist（支持 WebM/Opus、MP3、WAV、AAC、FLAC、OGG、M4A 等主流音频格式）

*注：已移除旧有的 10 MiB 大小门禁，统一采用临时文件分块落盘；文件大小不作为降级到 Files API 的触发条件。*

**多模态传输策略与 Explicit Cache Promotion**：
- **普通发送（Ordinary Send）**：所有受支持模态附件（文本/代码、PDF 二进制文档、图片、音频等）严格走请求级内联传输（`inline_text`、`inline_document`、`inline_image`、`inline_audio`），任何文件大小均不触发 Provider Files API。
- **显式 🧊 Cache Send（`force_cache_rebuild`）**：仅在用户显式触发 Cache Send 时，附件提升为 Provider File 引用（如 Gemini `file_uri`），并连同历史上下文冻结进 Remote Context Cache。Cache 命中轮次中，已被 Cache 覆盖的附件 Part 在发送时自动从当前轮 Part 5 剔除；已冻结在活跃 Cache 中的附件禁止单体物理删除。

成功/失败响应均不暴露 `storage_path`（HTTP formatter 仅输出前端契约字段，不输出 PC 路径）。

**GET /api/agents/conversations/<pk>/attachments/<id>/content/** — 流式返回本地 audio 原件

- 仅 `audio/*`；attachment 必须属于该 conversation；文件存在时 200（原 MIME + `inline` disposition + `Cache-Control: private`）
- missing / 非 audio / 跨会话 → 稳定 404
- `MessageSerializer.attachments_meta[].content_url`：audio 附件为上述同源 URL，其余附件为 `null`；前端播放使用 `content_url`，不使用 Gemini `file_uri`

**DELETE /api/agents/conversations/<pk>/attachments/delete/** — 批量删除

### 1.6 Conversation Cache — 上下文缓存

**GET /api/agents/conversations/<pk>/cache/** — 查看缓存状态

**POST /api/agents/conversations/<pk>/cache/renew/** — 重建缓存

**POST /api/agents/cache/invalidate/** — 手动失效缓存

### 1.7 Branch — 对话分支

**POST /api/agents/conversations/<pk>/branch/** — 从指定 HistoryChunk 分支

---

## 第二篇  记忆 (Memory)

### 2.1 Knowledge Fragments — 知识片段

**GET /api/memory/knowledge/** — 支持 `?topic=<value>` 与 `?project=<id>` 过滤；反序列化为裸数组（后端视图的 `page_size` 声明未激活，无分页）

```json
[{
  "id": 1, "uid": "note-123", "title": "My Note",
  "topic": "scope", "status": "active", "source_type": "obsidian_md",
  "tags": ["deep", "note"], "keywords": ["k1", "k2"],
  "abstract": "...", "project": 1,
  "created_at": "...", "updated_at": "..."
}]
```

**GET /api/memory/knowledge/<pk>/** — 单个片段

**PATCH /api/memory/knowledge/<pk>/** — 仅 `abstract`(string) 与/或 `keywords`(string[])

- 返回 `{"msg": string, "updated": string[]}`；`updated` 列出实际落库字段
- **abstract 会先 `strip()`**：与存储值 strip 后相同 → 不入库、`updated` 不含 abstract、**不启动后台线程**；仅当 strip 后仍有差异才写入并**异步触发重向量化**（后台线程调用 embedding provider）
- 前端只能呈现「已保存 + 后台索引刷新已启动」当 `updated` 实际含 abstract 时；不得声称重向量化已完成
- keywords 非数组 → 400 `{"error": "keywords 必须是数组"}`；不存在 → 404 `{"error": ...}

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

### 2.3 History Chunks — 对话压缩块

**GET /api/memory/history_chunks/** — 按 conversation 过滤

**GET /api/memory/history_chunks/<pk>/** / **PATCH**

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

**GET /api/core/projects/** — 裸数组，字段 `{id, name, description, prompt, work_dir, created_at}`（name 为唯一必填）；列表不返回 Archived 项目

**POST /api/core/projects/** — body `{name, description?, prompt?, work_dir?}`，仅这四个受支持字段；返回 201 + 完整行

**PATCH /api/core/projects/<pk>/** — 同上四个字段（work_dir 为空字符串 = 未绑定）；返回完整行

**GET /api/core/projects/<pk>/delete-preview/** — 删除确认预览：

```json
{
  "conversations_to_archive": 2,
  "files": [{"id": 11, "name": "notes.txt", "size": 1024}],
  "files_total_size": 1024
}
```

预览只统计直接关联 Conversation 与上传的 `ProjectFile`，不枚举全部 Knowledge 或文件系统状况；`files[].id` 均为正整数上传文件 ID。

**DELETE /api/core/projects/<pk>/** — body 必须显式发送 `{ "keep_file_ids": [11] }`，不恢复文件时发送空数组。成功 204（无 JSON body）：所有 `ProjectFile` 数据行删除，选中的物理文件移入后端 `SavedFiles` 作为脱离项目的恢复文件（名称可能调整），直接 Conversation 归档到 `Archived Project` 并改由 `Archived Chat` 持有，仍存活的 Knowledge 归档到 `Archived Project`。失败返回 `{error, code}`；`file_rollback_failed` 表示文件回滚不完整，不能声称文件系统未改变。

### 3.9 Project Files — 项目文件

**GET /api/core/projects/<project_pk>/files/** — 裸数组，混排两类行：

- Web 上传：`{id: int, name, file_type, size, file, url, preview_url, source: "web_upload", created_at}`
- Obsidian 同步：`{id: "kf_<int>", name: "<title>.md", file_type: "text/markdown", size: 0, file: null, source: "obsidian_sync", created_at}`（无 url/preview_url）

> id 仅两种已验证形态：正整数 或 `kf_<正整数>`；未知/ID 不一致的 `source` 只是展示元数据，不允许因此拒绝整行

**POST /api/core/projects/<project_pk>/files/** — multipart 上传，字段名 `file`；201 返回上传行（`source` 仅在列表接口标记）

**DELETE /api/core/projects/<project_pk>/files/<pk>/** — `<pk>` 原样透传（正整数上传 id 或 `kf_<int>` 同步 id）；成功 204（无 JSON body）；失败 `{error, code}`（如 `file_required` / `project_file_not_found` / `file_operation_failed`）

### 3.10 Tweets — 时间线推文

**GET /api/core/tweets/** — 列表（支持回复嵌套）

**POST /api/core/tweets/** — `{author: "agent:1", content: "..."}`

**POST /api/core/tweets/<pk>/reply/** — 回复推文

---

## 第四篇  日程 (Tasks)

### 4.1 CRUD `/api/tasks/entries/` — 日程条目

**POST /api/tasks/entries/**

| 字段 | 类型 | 说明 |
|---|---|---|
| title | string | yes |
| type | string | task / habit / memo / appointment / one_time / deadline |
| status | string | active / completed / suspended |
| scheduled_date | date | |
| recurrence | string | daily / weekly / monthly / yearly / none |
| priority | int | 0-3 |
| gcal_event_id | string | Google Calendar 同步 ID |

### 4.2 条目状态操作

- **POST /api/tasks/entries/<pk>/complete/** — 标记完成
- **POST /api/tasks/entries/<pk>/suspend/** — 暂停
- **POST /api/tasks/entries/<pk>/resume/** — 恢复
- **POST /api/tasks/entries/<pk>/gcal/** — 同步到 Google Calendar

### 4.3 Calendar — 日历视图

- **GET /api/tasks/calendar/** — 月/周 snapshot
- **GET /api/tasks/calendar/today/** — 今日 snapshot

### 4.4 Completions — 完成记录

**GET /api/tasks/completions/** — 已完成条目历史

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

### 7.1 Group Chat CRUD

**GET /api/groupchat/** — 群聊列表

**POST /api/groupchat/** — 创建群聊：`{title, participants, prompt}`

**GET /api/groupchat/<pk>/** — 群聊详情 + 消息

### 7.2 Messages

**POST /api/groupchat/<pk>/send/** — 推送消息给群聊 Agent

---

## 第八篇  推送通知 (Push)

> **B6 冻结契约（后端已交付）。** 每个 eligible 且已提交的 canonical assistant Message 恰好对应一个 durable `AssistantMessageArrival`，逻辑 dedupe key 恒为 `assistant-message:<message_id>`。前台 reconciliation 与 Web Push 都是该 arrival 的派生传输：两者都不决定 Message 是否存在，Push 失败也不回滚 Message。
>
> **Eligible producer 边界（两条分支）**：分支 A = ordinary Chat 的 direct 完成轮次（live SSE 与 async 视图消费同一个 `process_chat()` generator，因此 async 不是独立 producer）与 live managed-runtime 完成轮次；分支 B = `send_message` 工具，它从 `create_send_message()` 起步，不经过分支 A 的任何步骤。**排除判定按 Conversation ownership，不按客户端或 processor 名称**：`is_bridge=True` 或非空 `external_session_id`（由 WezTerm/agy pane 路径与 external-context injection 写入），以及 Council（phase0 / participant / synthesis）归属的会话不产生 arrival。所以 agy（wezterm processor）轮次被排除，而 opencode-/codex-（mcp-stdio processor，`_run_mcp_stdio`）的会话不带这些 flag，会与普通 direct 轮次一样正常产生 arrival。另外 replay/reconcile 复用底层 finalizer、从不调用 `record()`；failed/stopped 由调用方的完成门禁挡住（`record()` 自身不感知 run status，只校验正文与 ownership）；空正文与 tool-only 轮次则不过 `record()` 的内容门禁——这些同样不产生 arrival，但都不是「按客户端类型」屏蔽。排除生产者只跳过 arrival，不改变其既有 Message/trace/done 行为。

### 8.1 Subscription — **POST /api/push/subscribe/**

```ts
type SubscribeRequest = {
  subscription: {
    endpoint: string;                        // 必填；DB 列上限 500
    keys: { p256dh: string; auth: string };  // 必填；DB 列上限 255
  };
  device_name?: string;      // serializer 校验上限 200；仅显示标签，不作 identity
  installation_id?: string;   // UUID；V4/P2D 必填，旧客户端缺省 null
};
```

**201 Created**（仅在落库完成后返回）：

```json
{
  "id": 15,
  "endpoint": "https://push.example/...",
  "p256dh": "B...",
  "auth": "k...",
  "user_agent": "...",
  "device_name": "iPhone",
  "installation_id": "9f0c1e2a-....",
  "is_active": true,
  "persisted": true,
  "created_at": "2026-09-14T08:00:00Z",
  "updated_at": "2026-09-14T08:00:00Z"
}
```

规则：

- `persisted: true` 是「后端已持久化」的唯一事实。前端必须把「浏览器存在 PushSubscription」与「后端 persisted=true」显示为两个不同状态；校验或 DB 失败绝不返回健康成功。
- `endpoint` 仍全局唯一。**仅当 `installation_id` 是非 null UUID** 时才执行 installation 轮换：同一事务内先停用该 installation 的其它 active endpoint，再按 endpoint upsert 并显式恢复 `is_active=True`，使安装身份收敛、换 endpoint 不产生双推。显式传 `null` 只清空该 endpoint 自身的 `installation_id`，不触发兄弟 endpoint 停用。DB 侧另有条件唯一约束——非 null `installation_id` 同时至多一个 active 行。
- 省略 `installation_id`：保留数据库现值；显式传 `null`：清空。不按 User-Agent / `device_name` 猜测合并设备；legacy `installation_id=null` 的历史多 endpoint 不做批量归并。
- 长度归属：`device_name<=200` 由 serializer 校验（超长得到 400 字段错误）；`endpoint<=500` 与 `p256dh`/`auth<=255` 是 DB 列与客户端约束，不是 serializer 的 400 保证，不要假设任何超长请求都会得到下面的 DRF 400 示例。
- **400**：DRF 字段错误对象，例如 `{"subscription": ["subscription.endpoint is required"]}`。

**POST /api/push/unsubscribe/** — `{"endpoint": "..."}`，按 endpoint 幂等返回 **204**（未命中同样 204）。

### 8.2 前台 reconciliation — **GET /api/push/assistant-arrivals/**

有界 cursor 轮询，不新增 WebSocket / SSE fan-out，也不复用 chat SSE。该端点不依赖 Notification permission 或 PushSubscription：Push 被拒或过期不影响前台最终新鲜度。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `after` | 十进制非负整数 | 否 | arrival cursor；缺省 = bootstrap |
| `limit` | 整数 | 否 | 默认 50；必须落在 `1..100` |

```ts
type AssistantArrivalPage = {
  events: AssistantMessageArrivedV1[];  // 按 event_id ASC
  next_cursor: number;
  has_more: boolean;
};
```

- **bootstrap（缺省 `after`）**：`{"events": [], "next_cursor": <当前可访问 arrival 的 high-water id，无记录时为 0>, "has_more": false}`。不回放历史，前端以该 cursor 起步。
- **增量**：返回 `id > after` 且按 `id ASC` 排序；`has_more=true` 表示应立即再取一页。有结果时 `next_cursor` 等于该页最后一个 `event_id`；空页保持请求 cursor 原值。
- **可见性过滤在数据库完成**：queryset 先限定「assistant 角色 + Conversation 有可见 AgentPreset + 非 bridge-owned（`is_bridge=False` 且 `external_session_id` 为空）+ 非 Council」，再做 ordering 与 `limit + 1` 切片；不会先切片再在 Python 丢弃，因此 cursor 不会永久卡在被过滤 id 之前。Conversation/Message 删除（CASCADE）造成的 id 空洞天然被 `id > after` 跨越。
- 目标不可访问时不猜「最近会话」、不返回替代目标。
- **错误（禁止静默 clamp）**：
  - `after` 为空串 / 非十进制 / 负数 → **400** `{"error": "after must be a non-negative integer", "code": "invalid_after"}`；超出运行时整数转换能力的超长值 → **400** `{"error": "after exceeds the supported integer representation", "code": "invalid_after"}`。
  - `limit` 不是十进制语法（空串 / 负数 / 含非数字字符）→ **400** `{"error": "limit must be an integer", "code": "invalid_limit"}`。
  - `limit` 是十进制数字但数值越界（`0` 或 `>100`，含任意长度的数字）→ **400** `{"error": "limit must be between 1 and 100", "code": "invalid_limit"}`。前导零不改变判定，例如 `000100` 合法、`000` 属越界。

P2D 消费约束（前端侧，不在本仓施工）：visible 时有界轮询（建议 15s），并在 `visibilitychange -> visible`、`online` 与 app mount 时立即 reconcile；hidden 时停止普通轮询，交给 Push。打开精确 Conversation 才消费该 installation 的 unread，停留在其它页面不消费。

### 8.3 `assistant-message-arrived.v1` canonical event

`/api/push/assistant-arrivals/` 的 `events[]` 与 Web Push `data.event` 使用同一 serializer：

```ts
type AssistantMessageArrivedV1 = {
  kind: "assistant-message-arrived";
  version: 1;
  event_id: number;
  dedupe_key: string;
  conversation_id: number;
  message_id: number;
  agent: { id: number; name: string };
  preview: { policy: "bounded_text"; text: string; truncated: boolean };
  target: {
    kind: "conversation_message";
    conversation_id: number;
    message_id: number;
  };
  ignore: { allowed: boolean };
  register_ack: { register_id: number; preset_id: number } | null;
  title_hint: string | null;
  committed_at: string;
};
```

- `dedupe_key` 恒为 `assistant-message:<message_id>`，与 DB OneToOne 一致。前端以 `event_id` 推进 cursor、以 `dedupe_key` 去重（例如同一 arrival 已由 Push 处理）。
- **`preview` 只从 canonical `Message.content` 派生**：内容过滤后折叠空白，最多 **160** 个 Unicode code point；`truncated` 表示过滤后文本超限。不读取 reasoning、`tool_calls`、私有语音指令或附件正文。锁屏沿用该 bounded preview。
- `title_hint`：`send_message` 的 title 过滤后 <=200 字符；为 `null` 时前端以 `agent.name` 作标题。
- `ignore`：typed、封闭的显式忽略许可指示，恒存在。仅 `source=send_message` 的 arrival 为 `{"allowed": true}`；ordinary Chat 恒为 `{"allowed": false}`。前端必须以该字段决定是否提供「忽略」affordance，禁止从 title/agent/`register_ack` 推断。该字段不随是否已忽略而变化（重复忽略幂等）。
- `register_ack` 为 **legacy-only** 字段：仅当该 arrival 仍链接一个可解码的 v1 通知信封 Register（旧 `send_message` 流程遗留）且至少一台设备 `sent` 时给出 `{register_id, preset_id}`。新 `send_message` 不再预建 Register，两种传输均为 `null`；显式忽略产生的固定文案 Register **不是** ACK 目标（同样为 `null`）。
- `committed_at`：arrival 行与 canonical Message 已作为同一次 DB commit 对外可见的 UTC ISO-8601（`Z` 结尾），不是 provider 完成时间。
- 连续多条 assistant Message 各自保留独立事件，不用 latest 覆盖 sibling。

### 8.4 Web Push 载荷与 at-most-once 投递

顶层载荷保留旧 service worker 可解析的 `title` / `body` / `data`：

```ts
type AssistantArrivalPush = {
  title: string;   // title_hint ?? agent.name
  body: string;    // preview.text
  data: {
    url: "/";      // 恒为安全 root，仅作兼容 fallback
    event: AssistantMessageArrivedV1;
    register_id: number | null;
    preset_id: number;
    sender_type: "agent";
    sender_name: string;
  };
  tag: string;             // = dedupe_key
  renotify: false;
  requireInteraction: true;
};
```

- **canonical identity 只在 `data.event`**。前端由 `target` 经 route adapter 映射前台地址；`data.url` 不得写死任何前台路由。
- `tag = dedupe_key` 且 `renotify: false`：同一次投递重放不产生第二个系统弹窗。
- **逐订阅至多一次**：`AssistantArrivalDelivery` 以 DB 唯一 `(arrival, subscription)` 作为 claim。已存在 claim 的订阅不再调用 provider；同一 installation 已有其它 endpoint 的投递时同样跳过（installation 级去重）。
- 状态机 `claimed -> sent | failed | expired`：`410` 记为 `expired` 并软停用该订阅（`is_active=false`）。投递结果只统计真实 provider 结果，Push 成败不混入 Message 持久化事实。
- **claim-before-send 的 at-most-once 取舍**：进程在 claim 之后、provider call 之前崩溃可能漏一条系统 Push（不重试、不双弹），前台 reconciliation 仍保证 Message 可见；provider 已接受但终结更新前崩溃时 delivery 保守保持 `claimed`，不重试也不猜 `sent`。
- 派发只发生在 arrival 事务提交之后。投递事实的边界是 **durable claim**：只有取得 `AssistantArrivalDelivery` claim 之后的 provider 结果才终结为 `sent`/`failed`/`expired`；pre-claim、payload 构建、DB 与其它基础设施错误只被记录日志（ordinary 路径不产生投递事实，`send_message` 路径以工具层 `status=failed` 上抛），绝不伪造成功、不回滚 Message/arrival，也不把已完成的 chat 改成 error。

### 8.5 Register ACK 兼容（legacy）与显式忽略

**POST /api/agents/registers/&lt;pk&gt;/ack/?preset_id=&lt;int&gt;** — 旧通知 Register 的导航/忽略回执（legacy-only）。

```ts
type RegisterAckRequest = {
  action?: "navigate" | "dismiss";  // 默认 "navigate"
  subscription_endpoint?: string;   // 可选，仅用于显示设备名
};
type RegisterAckResponse = { id: number; content: string };  // 200
```

- **200** `{id, content}`；**400** preset_id 缺失或非整数、action 非枚举，或**带 v1 marker 的通知数据自身损坏**；**404** 该 preset 下不存在此 Register。
- 400 的边界：只有 malformed **versioned v1** 信封才是 400。不带 v1 marker 的其它/无法识别的 legacy 文本不会被当成错误：它保持 `content` 不变并仍返回 200（仅刷新 TTL），不猜测改写。
- **幂等**：ACK 后 Register 转为「用户已处理」，并把 `expires_at` 刷新为 **now + 1 小时**（初始 claimed Register 的保留期是 12 小时）；重复 ACK 不覆盖既有已处理状态，稍后的投递摘要更新也不会把用户已点击改回未处理。
- 兼容解析同时接受「投递状态待确认」与「已发送」两种信封。历史上 `send_message` 在派发前写入的 Register 已完整、可解析、可 ACK；显式忽略修订后此流程不再产生新行。
- 与 arrival 的衔接（历史数据）：旧 Register 保持原样、自然过期，不迁移、不删除；投递摘要与已处理状态均只属 legacy 行。
- ordinary Chat 的 arrival `register_ack` 恒为 `null`，绝不伪造 Register。

**POST /api/push/assistant-arrivals/&lt;event_id&gt;/ignore/** — 显式「忽略」动作，唯一会创建 Register 的新路径。

```ts
type AssistantArrivalIgnoreResponse = {
  action: "ignore";
  event_id: number;       // = arrival id
  message_id: number;
  conversation_id: number;
  created: boolean;       // 本次调用是否新建了 Register 行
};  // 200
```

- 仅对 `source=send_message` 的 arrival 有效；请求 body 不参与身份判定，也不接受任何 Register 文本（客户端提交的 content/title/body 一律忽略）。
- 事务 + arrival 行锁：首个有效调用创建并链接**一条** short Register（preset = 发送 preset，固定 server-owned 文本 `Alicia 已忽略你的消息`，`expires_at = now + 1 小时`）；重复/并发（多设备）返回同一逻辑结果，不产生 siblings。已链接行仅两类可处理：canonical 忽略 Register（short）→ 幂等仅刷新 TTL；可解码的 legacy v1 通知信封（short）→ 就地规范化（content/TTL/created_at），不新建第二行。其余链接行（任意同 preset 文本、malformed 信封、非 short 生命周期、异 preset）一律 409 且零变更。
- 忽略不导航、不清除 installation-local unread，不产生服务端 unread/seen 状态。
- **404** `{"error": "assistant arrival not found", "code": "arrival_not_found"}`（不存在/非法 id）；**409** `{"error": "explicit ignore is only available for send_message arrivals", "code": "ignore_not_allowed"}`（ordinary Chat arrival，或 linked register 不是 canonical 忽略 Register / 可解码 legacy 短信封——含异 preset、任意同 preset 文本、malformed 信封、非 short 生命周期，一律零变更）。
- 离线/无 client 的 OS 动作回执仍是 best-effort（stateless SW 无持久重试队列）；前台 shell 忽略失败可见且可重试。

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

## 第十篇  Tool Drawer 与 MCP 凭证管理（Frozen）

> 本篇是前后端施工契约，后端接口已在 ExoCore 交付可用（参见 `agents/tests/test_drawer_mcp_api.py`）。

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

## 第十一篇 心跳、信箱与指定唤醒 (Heartbeat & Mailbox)

### 11.1 队列与全景信箱查询

**GET /api/heartbeat/queue/?preset_id=<int>**

返回目标 Agent 当前的全景待触发状态、待送达小纸条（信箱）及预约唤醒：

```json
{
  "preset_id": 1,
  "auto_enabled": true,
  "cadence_mode": "normal",
  "paused_until_utc": null,
  "paused_until_local": null,
  "next_auto": {
    "task_id": 12,
    "target_utc": "2026-09-09T11:30:00Z",
    "effective_utc": "2026-09-09T11:30:00Z",
    "effective_local": "2026-09-09 13:30:00",
    "message": "",
    "resume_check": false,
    "status": "pending"
  },
  "pending_notes": [
    {
      "id": 5,
      "message": "记得吃药哦",
      "created_at": "2026-09-09T08:15:00Z",
      "created_local": "2026-09-09 10:15:00"
    }
  ],
  "explicit_wakeups": [
    {
      "task_id": 98,
      "target_utc": "2026-09-09T13:00:00Z",
      "effective_utc": "2026-09-09T13:00:00Z",
      "effective_local": "2026-09-09 15:00:00",
      "message": "下午三点记得看论文",
      "resume_check": false,
      "status": "pending"
    }
  ],
  "unshown_explicit_count": 0
}
```

### 11.2 投递小纸条 (User Zettelchen)

**POST /api/heartbeat/notes/**

- 请求体：
  ```json
  {"preset_id": 1, "message": "中午去热早饭，下午我们看文档~"}
  ```
- 响应：`201 Created`
  ```json
  {
    "id": 7,
    "preset_id": 1,
    "message": "中午去热早饭，下午我们看文档~",
    "created_at": "2026-09-09T10:00:00Z",
    "created_local": "2026-09-09 12:00:00",
    "consumed_at": null,
    "consumed_by_event_id": null
  }
  ```

### 11.3 撤回小纸条

**DELETE /api/heartbeat/notes/<int:note_id>/**

- 规则：仅当纸条未被心跳拆封消费（`consumed_at is null`）时允许撤回。
- 成功：`204 No Content`
- 若已被消费：`409 Conflict`，返回 `{"error": "纸条已被拆封消费，无法撤回", "code": "already_consumed"}`
- 若不存在：`404 Not Found`

### 11.4 预约定时唤醒

**POST /api/heartbeat/wakeups/**

- 请求体：
  ```json
  {
    "preset_id": 1,
    "wake_up_at": "+30min", // 支持 "+30min"、"+2h" 或 "2026-09-09 15:00"
    "message": "指定唤醒提醒内容",
    "resume_check": false
  }
  ```
- 响应：`201 Created`
  ```json
  {
    "task_id": 99,
    "preset_id": 1,
    "target_utc": "2026-09-09T11:00:00Z",
    "target_local": "2026-09-09 13:00:00",
    "message": "指定唤醒提醒内容",
    "resume_check": false,
    "source": "user",
    "status": "pending"
  }
  ```

### 11.5 取消定时唤醒

**DELETE /api/heartbeat/wakeups/<int:task_id>/**

- 成功取消返回：`204 No Content`
- 若不存在返回 `404`；若已执行/非 pending 返回 `409`。

---

## 第十二篇  消息语音合成与点播 (Message TTS)

### 12.1 Message 读模型扩展

在 `GET /api/agents/chat/<id>/` 返回的原子消息体中新增 `voice` 字段：

- **非 assistant 消息**（`user` / `system`）：恒为 `null`；
- **assistant 消息**：
  ```json
  {
    "id": 4201,
    "role": "assistant",
    "content": "台词正文...",
    "voice": {
      "available": true,
      "directed": false,
      "cached": false
    }
  }
  ```
  - `available`: 该会话所属 AgentPreset 是否绑定了活跃声线（`active_voice_profile`）且本消息包含非空可朗读台词（剥离单星号动作 `*...*` 后）；
  - `directed`: **听觉盲盒标志**。仅在消息的私有 `tool_calls` 中包含合法的 `voice_emotion` 工具调用时为 `true`。响应绝对不包含任何 emotion 文本、目标句或分段数细节；
  - `cached`: 后端是否已成功生成并持久化音频文件（true 时客户端点击秒播）。

### 12.2 点播触发与状态轮询

**POST /api/agents/conversations/<pk>/messages/<message_pk>/tts/**

客户端以消息身份发起点播请求，请求体为 `{}`（禁止携带文本、情绪或配置，全由后端推导）。

- **Cache Hit**（HTTP 200 OK）：已存在有效音频缓存，直接返回可播放资源：
  ```json
  {
    "status": "playable",
    "content_url": "/api/agents/conversations/1/messages/4201/tts/content/",
    "duration_ms": 3200
  }
  ```
- **Cache Miss / In-Flight**（HTTP 202 Accepted）：后台线程池已排队或正在生成：
  ```json
  {
    "status": "generating",
    "retry_after_ms": 1500
  }
  ```
- **异常 / 失败**（HTTP 503 / 504 / 500）：
  ```json
  {
    "status": "failed_retryable",
    "code": "runtime_offline",
    "message": "Voice runtime is offline."
  }
  ```

**GET /api/agents/conversations/<pk>/messages/<message_pk>/tts/**

只读状态查询接口（客户端按 `retry_after_ms` 间隔轮询，不触发新任务）。

- 未触发点播时：`200 {"status": "idle"}`
- 物理文件缺失/过期/损坏时：`GET /tts/` 状态查询自动检测并稳定幂等返回 `200 {"status": "idle"}`，支持客户端重新发起 `POST` 生成；
- 渲染中：`202 {"status": "generating", "retry_after_ms": 1500}`
- 已就绪：`200 {"status": "playable", "content_url": "...", "duration_ms": 3200}`
- 假死超时（超过 60 秒未完成）：`504 {"status": "failed_retryable", "code": "generation_timeout", "message": "Voice generation timed out. Please retry."}`
- 失败状态：`503/500 {"status": "failed_retryable", "code": "...", "message": "..."}`（消息使用白名单公网安全文案，绝不泄露内部私有指令或异常堆栈）

### 12.3 音频流式分发

**GET /api/agents/conversations/<pk>/messages/<message_pk>/tts/content/**

流式返回本地渲染就绪的音频文件（同源、受会话约束），支持单段字节 Range。

- 无 `Range`、非法写法（非 `bytes` 单位、空 spec、非数字段）与多段 range：整段 `200`（`FileResponse`），响应头含 `Accept-Ranges: bytes`；
- 语法有效且可满足的单段 range（`bytes=start-end` / `bytes=start-` / `bytes=-suffix`）：`206`，精确 `Content-Range: bytes <start>-<end>/<size>` 与 `Content-Length`，仅流式读取该段字节；`end` 超出资源长度按 `size-1` 收敛，`last < first` 视为非法写法按整段 `200` 处理；
- 语法有效但不可满足（`start >= size`、suffix 长度为 0、资源为空）：`416` + `Content-Range: bytes */<size>`，响应体为有界 JSON 错误（`error: range_not_satisfiable`）；该分支不打开分发流、不回传任何音频字节（此前的有效性门禁可能已校验工件元信息，但不进入字节分发）；
- `Accept-Ranges: bytes` 与 `Cache-Control: private, no-cache, max-age=0` 适用于全部媒体响应（`200` / `206` / `416`）；其中 `Cache-Control` 的目的仍是非版本化稳定 URL 杜绝长缓存，确保消息编辑或重新生成后客户端立即获得最新音频；
- `Content-Disposition: inline; filename="msg_<id>.wav"` 仅适用于 `200` 与 `206`（`416` 不带该头）；
- 渲染 MIME 取渲染工件实际类型，缺失时回退 `audio/wav`；
- 鉴权严格按会话隔离：跨会话 / 消息不存在返回 `404`（`error: not_found`）；未渲染就绪、哈希/版本过期或物理文件缺失返回 `404` 并附加 `code: audio_artifact_missing`。

### 12.4 前端 5 态生命周期映射与错误矩阵

前端状态机统一收敛为 5 态：
```text
unavailable       -> 控件不展示或禁用（role!=assistant / 无声线或非激活 / 空台词 / 权限不足）
idle              -> 控件就绪待播放（available=true, cached=false）
generating        -> 渲染生成中（展示局部 loading / pulse 动画）
playable          -> 渲染完成可播放（挂载 content_url，支持播放进度条）
failed_retryable  -> 生成失败可重试（保留播放控件，展示重试按钮）
```

**错误分类与客户端行为矩阵 (Error / Action Matrix)**：

| 错误代码 (`code`) | HTTP 状态码 | 前端映射状态 | 客户端行为与 UX 处置指导 |
|---|---|---|---|
| `ineligible_message` | 422 | `unavailable` | 隐藏或禁用播放控件；不可重试 |
| `no_active_profile` | 422 | `unavailable` | 声线未绑定或非激活状态；隐藏或禁用播放控件；不可重试 |
| `not_found` / `audio_artifact_missing` | 404 | `unavailable` | 会话/消息不存在或音频文件丢失/过期；content 端点返回 404；status 轮询自动降级为 idle |
| `runtime_offline` | 503 | `failed_retryable` | 保留控件，显示重试入口；提示“语音服务未就绪” |
| `generation_timeout` | 504 | `failed_retryable` | 保留控件，显示重试入口；提示“生成超时，点击重试” |
| `generation_failed` | 500 | `failed_retryable` | 保留控件，显示重试入口；提示“生成异常，点击重试” |

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
