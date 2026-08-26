# ExoCore API Reference (ReactSheet)

> Generated from live Django URL config + serializer fields. P1-11 commit 1-5 shape.

---

## 第一篇  会话 & 聊天 (Agents)

### 1.1 Read/Update `/api/agents/presets/` — 固定 Agent 人设卡片

**GET /api/agents/presets/**

```json
[{
  "id": 1, "name": "Alicia", "description": "主助手",
  "agent_type": "superior", "default_model": "deepseek-v4-pro",
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
  "agent_preset_id": 1, "agent_type": "superior",
  "temperature": 1.0, "thinking_level": "medium",
  "frozen_project_ids": [1], "created_at": "2026-01-01T00:00:00Z"
}]
```

**POST /api/agents/conversations/** — name + project (必填) / agent_preset (可选)

**PATCH /api/agents/conversations/<pk>/** — name / project / archive

**DELETE /api/agents/conversations/<pk>/**

### 1.3 Chat SSE — 实时对话

**POST /api/agents/chat/<session_id>/** — SSE 流式响应

`galatea_mcp` 已废弃：后端即使收到该旧字段也不得把 Galatea MCP declarations 拼入主会话。领域工具只能由当前 preset 获准的 Drawer 在 Heartbeat 中加载；前端应停止发送该字段。

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

### 1.4 Superior Session — Agent 自主调度

**POST /api/agents/sessions/init/** — 创建 Superior 后台 session

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
- `audio_model_unsupported` — target 缺 `audio` ability 或 `file_uri` transport
- `audio_mime_unsupported` — MIME 不在 allowlist（`audio/webm;codecs=opus` / `audio/webm`）
- `audio_too_large` — 超过 10 MiB

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

**GET /api/core/projects/** — 列表，title/description/work_dir

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

### 8.1 Subscription

**POST /api/push/subscribe/** — 注册设备 token

### 8.2 Notifications

**GET /api/push/notifications/** — 待处理通知列表

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
- 配置变化只影响后续 HeartbeatActor，运行中的 Actor 保留 run-scoped 快照；
- 后端按 `合法 catalog ∩ 当前 preset enabled visitor` 组装唯一授权 Registry；
  同一 Registry 同时约束 `go_to.domain` 与 Heartbeat `tool_activate`。

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
