# ExoCore API Reference (ReactSheet)

> Generated from live Django URL config + serializer fields. P1-11 commit 1-5 shape.

---

## 第一篇  会话 & 聊天 (Agents)

### 1.1 CRUD `/api/agents/presets/` — Agent 人设卡片

**GET /api/agents/presets/**

```json
[{
  "id": 1, "name": "Alicia", "description": "主助手",
  "agent_type": "superior", "default_model": "deepseek-v4-pro",
  "system_prompt": "You are...", "is_visible": true
}]
```

**POST /api/agents/presets/** — 同 shape（is_visible 创建时忽略，默认 true）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| name | string | yes | 唯一 |
| description | string | no | |
| agent_type | string | yes | standard / user / g045 / superior |
| default_model | string | yes | 必须在 main pool 中 |
| system_prompt | string | yes | |

**PATCH /api/agents/presets/<id>/** / **DELETE**

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

**POST /api/agents/conversations/<pk>/attachments/** — 上传文件/图片

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

```json
[{
  "id": 1, "title": "User preference",
  "content": "Always use dark mode",
  "conversation": 1, "tags": ["preference"],
  "weight": 1.0, "created_at": "..."
}]
```

**POST /api/memory/plasmids/** — title + content (必填)

**PATCH /api/memory/plasmids/<pk>/** / **DELETE**

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
| self_check_preset_ids / deep_org_preset_ids / heartbeat_preset_ids | [int] | |
| active_start / active_end | time | "HH:MM" |
| heartbeat_base_hours / heartbeat_random_hours / night_heartbeat_base_hours | int | |
| deep_org_weekday | int | 0=Mon |
| deep_org_hour | int | 0-23 |
| model_generate_abstract | string | |
| model_roles | object/list | **[已废弃]** 将在 P1-11 commit 7 移除；使用 §3.8 |
| key_map | object | **[已废弃]** 将在 P1-11 commit 7 移除；使用 Endpoint.api_key FK |
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
  "providers": [
    {"id": "gemini", "display_name": "Gemini 官方"},
    {"id": "deepseek", "display_name": "DeepSeek 官方"},
    {"id": "openrouter", "display_name": "OpenRouter"},
    {"id": "glm", "display_name": "GLM 官方"}
  ]
}
```

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
| provider | string | yes | gemini / deepseek / openrouter / glm |
| api_key_alias | string | no | ApiKey alias |
| enabled | bool | no | default true |

以下字段由 ProviderProfile 派生，**只读**：
`base_url` / `payload_format` / `cache_transport` / `attachment_transports` /
`supported_families` / `model_name_prefix` / `processor` 等

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

### 3.8 PUT `/api/core/config/key-map/` — Key Map

**[已废弃]** 将在 P1-11 commit 7 移除。使用 Endpoint.api_key FK (§3.5) 替代。

### 3.9 Projects — 项目管理

**GET /api/core/projects/** — 列表，title/description/work_dir

**POST /api/core/projects/** / **PATCH** / **DELETE** — 删除触发 archive

### 3.10 Project Files — 项目文件

**POST /api/core/projects/<project_pk>/files/** — multipart 上传

**DELETE /api/core/projects/<project_pk>/files/<pk>/** — 删除文件 + KnowledgeFragment

### 3.11 Tweets — 时间线推文

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

### target_resolution_error 子 code

`model_not_found` / `endpoint_not_found` / `model_disabled` / `endpoint_disabled` /
`incompatible_pair` / `ambiguous_endpoint` / `model_not_in_main_pool` /
`main_not_resolvable_here` / `alias_not_found` / `alias_provider_mismatch`

## 附录 B — ProviderProfile 参考值

| id | display_name | base_url | payload | cache | attachments |
|---|---|---|---|---|---|
| gemini | Gemini 官方 | "" | gemini | remote_reference | file_uri, inline_text, inline_image |
| deepseek | DeepSeek 官方 | https://api.deepseek.com/v1 | openai | inline_chunk | file_id, inline_text |
| openrouter | OpenRouter | https://openrouter.ai/api/v1 | openai | inline_chunk | inline_text, inline_image |
| glm | GLM 官方 | https://open.bigmodel.cn/api/paas/v4 | openai | inline_chunk | inline_text |

supported_families:
- gemini: (gemini)  
- deepseek: (deepseek)  
- openrouter: (openrouter, gemini, deepseek)  
- glm: (glm)
