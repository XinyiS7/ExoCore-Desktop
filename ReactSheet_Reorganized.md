# ExoCore — React 前端接口数据格式速查表（简明版）

本文件仅记录 Request / Response 的数据结构字段、类型、枚举值及状态码，不包含冗余的背景说明与代码逻辑解释。

---

## 第一篇  会话 & 聊天 (Agents / Conversations)

### 1.1 GET `/api/agents/conversations/` — 会话列表
**Response (200):**
```json
[
  {
    "id": 12,
    "name": "关于量子纠缠的讨论",
    "created_at": "2026-03-10T14:23:00Z",
    "last_message_at": "2026-03-10T15:01:44Z",
    "project": 3, // 0 = 无项目
    "project_name": "Grand-Archives", // null = 无项目
    "agent_type": "superior", // "superior" | "standard"
    "agent_preset_id": 2,
    "session_type": "full", // "full" | "lite"
    "thinking_level": "auto", // "off" | "auto" | "low" | "medium" | "high"
    "temperature": 1.0,
    "memory_injection_enabled": true,
    "agent_session": {
      "id": 5,
      "frozen_project_ids": [3, 7]
    }
  }
]
```

### 1.2 GET `/api/agents/chat/<session_id>/` — 消息历史
**Response (200):**
```json
[
  {
    "id": 101,
    "role": "user", // "user" | "assistant" | "system"
    "content": "量子纠缠是什么？",
    "reasoning_content": null,
    "platform": "gemini-3.1-pro-preview",
    "created_at": "2026-03-10T14:23:01Z",
    "index_in_session": 0
  }
]
```

### 1.3 POST `/api/agents/chat/<session_id>/` — 发送消息

#### 1.3a. SSE 模式 (mode=sse)
**Request Body:**
```json
{
  "content": "你好",
  "thinking_level": "medium",
  "temperature": 1.0,
  "model": "gemini-2.5-flash", // 可选覆盖
  "endpoint": 3, // 可选端点 ID 覆盖
  "memory_injection_enabled": false,
  "cache_enabled": false,
  "force_cache_rebuild": false,
  "session_type": "lite", // "full" | "lite"
  "files": [],
  "pending_attachments": [],
  "edit_message_id": null
}
```

**SSE Events:**
*   `event: thinking` (delta 文本)
*   `event: content` (delta 文本)
*   `event: reasoning` (delta 检索文本)
*   `event: status` (状态文本)
*   `event: reference` (JSON 格式引用数据)
*   `event: cache_skipped` -> `{"reason": "platform_not_supported"}`
*   `event: error`
    ```json
    {
      "code": "attachment_failed" | "invalid_model_endpoint_pair" | "model_disabled" | "endpoint_disabled" | "endpoint_not_configured" | "target_config_error",
      "message": "错误描述文字"
    }
    ```

#### 1.3b. Async 轮询模式 (mode=async)
**Request Body:** 同 SSE 模式。
**Response (200):**
```json
{
  "message_id": "a1b2c3d4",
  "status": "processing"
}
```

**GET `/api/agents/chat/<session_id>/status/?message_id=<token>&cursor=<int>`**
**Response (200):**
```json
{
  "status": "streaming" | "done" | "stopped" | "error" | "not_found",
  "events": [
    { "event_type": "thinking" | "content" | "reasoning" | "status" | "reference", "delta": "..." }
  ],
  "cursor": 2,
  "error_message": null
}
```

**POST `/api/agents/chat/<session_id>/stop/?message_id=<token>`**
**Response (200):**
```json
{ "status": "stop_requested" }
```

### 1.4 GET `/api/agents/conversations/<pk>/history_chunks/` — HistoryChunk 列表
**Response (200):**
```json
{
  "conversation_id": 12,
  "session_name": "关于量子纠缠的讨论",
  "session_type": "full",
  "history_chunks": [
    {
      "id": 7,
      "start_index": 0,
      "end_index": 9,
      "topic": "量子纠缠基本原理",
      "summary": "摘要...",
      "keywords": ["量子纠缠", "EPR"],
      "unresolved": false,
      "created_at": "2026-03-10T15:00:00Z"
    }
  ]
}
```

### 1.5 GET/PATCH `/api/memory/history_chunks/<pk>/` — HistoryChunk 详情
**GET Response (200):**
```json
{
  "id": 7,
  "conversation": 12,
  "session_name": "关于量子纠缠的讨论",
  "session_type": "full",
  "start_index": 0,
  "end_index": 9,
  "topic_label": "量子纠缠基本原理",
  "keywords": ["量子纠缠", "EPR"],
  "unresolved": false,
  "time_ref": "3月某个下午",
  "emotion": "好奇",
  "entities": ["量子纠缠"],
  "importance": 0.8,
  "created_at": "2026-03-10T15:00:00Z"
}
```
**PATCH Request:**
```json
{
  "topic_label": "新的话题标签",
  "keywords": ["新关键词"],
  "unresolved": true
}
```
**PATCH Response (200):**
```json
{ "msg": "已保存。", "updated": ["topic_label"] }
```

### 1.6 GET/POST/DELETE `/api/agents/conversations/{pk}/cache/` — 会话缓存 & 快照
**GET Response (200):**
```json
{
  "active": true,
  "platform": "gemini" | "deepseek",
  "cache_name": "cachedContents/...",
  "model": "gemini-3.1-pro-preview",
  "created_at": "2026-05-04T10:00:00Z",
  "expires_at": "2026-05-04T11:00:00Z",
  "remaining_seconds": 2145,
  "renewals": 2,
  "ttl_seconds": 1500,
  "has_snapshot": true,
  "snapshot_cache_end_idx": 405
}
```
**POST `/api/agents/conversations/{pk}/cache/renew/`**
**Response (200):**
```json
{
  "ok": true,
  "expires_at": "2026-05-04T11:30:00Z",
  "renewals": 3
}
```
**DELETE `/api/agents/conversations/{pk}/cache/`** -> `204 No Content`

### 1.7 POST/GET/DELETE `/api/agents/conversations/{id}/attachments/` — 附件管理

#### 1.7a. POST multipart/form-data (上传)
**Response (201) — 全部成功:**
```json
{
  "attachments": [
    {
      "id": 12,
      "storage_path": "/path/to/uploads/attachments/5/image.png",
      "display_name": "image.png",
      "original_filename": "image.png",
      "mime_type": "image/png",
      "file_size": 245760
    }
  ]
}
```
**Response (201) — 部分失败:**
```json
{
  "attachments": [ { "id": 12, "storage_path": "...", ... } ],
  "failures": [
    {
      "display_name": "huge-photo.jpg",
      "mime_type": "image/jpeg",
      "stage": "resolve", // preprocess | read | persist | decode | resolve | db
      "reason": "Gemini 上传失败: file too large"
    }
  ]
}
```
**Response (422) — 全部失败:**
```json
{
  "error": "all attachments failed",
  "failures": [
    { "display_name": "huge-photo.jpg", "mime_type": "image/jpeg", "stage": "resolve", "reason": "..." }
  ]
}
```

#### 1.7b. POST application/json (验证已有路径)
**Request:**
```json
{ "storage_path": "/existing/file.md", "display_name": "笔记" }
```
**Response (200):** 同 1.7a 成功项。

#### 1.7c. GET `/api/agents/conversations/{id}/attachments/`
**Response (200):** Array<Attachment>

#### 1.7d. DELETE `/api/agents/conversations/{id}/attachments/delete/`
**Request Body:**
```json
{
  "source": "user" | "tool_collection",
  "id": 12 // 当 source="user" 时为 int ID，当 source="tool_collection" 时为 string local_path
}
```
**Response:** `204 No Content`

### 1.8 [已退役] TriggeredNote 快照

### 1.9 CRUD `/api/agents/chronicle/` — ChronicleEntry（大事记）
**GET Response (200):**
```json
[
  {
    "id": 3,
    "preset": 1,
    "event_time": "2026-05-16",
    "content": "内容...",
    "scope": "表", // "表" | "里"
    "keywords": ["毕设"],
    "modified_at": "2026-05-16T15:30:00Z"
  }
]
```
**POST Request:**
```json
{
  "preset": 1,
  "event_time": "2026-05-16",
  "content": "内容...",
  "scope": "表",
  "keywords": ["毕设"]
}
```
**PATCH Request:** (仅支持更新 event_time, content, scope, keywords)

---

## 第二篇  记忆 & 质粒 (Memory / Plasmids)

### 2.1 GET `/api/memory/knowledge/` — KnowledgeFragment 列表
**Response (200):**
```json
{
  "count": 120,
  "next": "http://...",
  "previous": null,
  "results": [
    {
      "id": 5,
      "uid": "a1b2c3d4",
      "title": "项目架构设计",
      "topic": "work",
      "status": "active",
      "source_type": "obsidian_md",
      "tags": ["架构"],
      "keywords": ["Django"],
      "abstract": "概要...",
      "project": 3,
      "created_at": "2026-03-10T14:00:00Z",
      "updated_at": "2026-05-01T09:00:00Z"
    }
  ]
}
```

### 2.2 CRUD `/api/memory/plasmids/` — MemoryPlasmid（记忆质粒）
**GET Response (200) `?preset_id=<id>`:**
```json
[
  {
    "id": 3,
    "preset": 1,
    "content": "记忆内容",
    "scope": "work", // null = 分类中
    "tags": ["量子纠缠"],
    "weight": 0.85,
    "is_processed": true,
    "created_at": "2026-04-21T14:23:00Z",
    "updated_at": "2026-04-21T14:25:00Z"
  }
]
```
**GET `/api/memory/plasmids/tags/?preset_id=<id>` (所有 Tag 列表)**
**Response (200):** `["tag1", "tag2"]`

**POST Request:**
```json
{
  "preset_id": 1,
  "content": "我喜欢读科幻",
  "scope": "写作", // 可选。传值则直接写入跳过自动分类，留空自动分类 (is_processed=false)
  "tags": ["科幻"]
}
```
**PATCH Request:** (支持修改 content, scope, tags。其中 content 仅全局 preset 2 可改)
**DELETE Request:** Header 包含 `X-Preset-ID: <preset_id>`。

### 2.3 GET/PUT `/api/memory/scope-keywords/` — Scope 关键词表
**GET Response / PUT Request (200):**
```json
{
  "work": ["项目", "文档"],
  "life": ["生活", "睡眠"],
  "emotion": ["焦虑", "开心"]
}
```

---

## 第三篇  项目 & 文件 (Core / Projects)

### 3.1 GET `/api/core/projects/<project_pk>/files/` — 项目文件列表
**Response (200):** Array<ProjectFile | ObsidianSyncEntry>

### 3.2 GET/PATCH `/api/core/projects/<id>/` — 项目详情
**GET Response (200):**
```json
{
  "id": 3,
  "name": "Grand-Archives",
  "description": "",
  "prompt": "项目提示词...",
  "work_dir": "D:\\Alicia\\Projects\\GrandArchives",
  "created_at": "2026-03-01T10:00:00Z"
}
```
**PATCH Request:** 可修改 name, prompt, work_dir。

### 3.3 GET `/api/core/projects/<id>/tree/` — 完整目录树
**Response (200):**
```json
{
  "path": "",
  "entries": [
    {
      "name": "src",
      "type": "dir",
      "path": "src",
      "entries": [
        { "name": "main.jsx", "type": "file", "path": "src/main.jsx", "size": 1024 }
      ]
    },
    { "name": "README.md", "type": "file", "path": "README.md", "size": 2048 }
  ]
}
```

---

## 第四篇  时间线 (Core / Tweets)

### 4.1 GET `/api/core/tweets/` — 推文列表
**Response (200) `?before_id=`:**
```json
{
  "tweets": [
    {
      "id": 42,
      "author": "agent:2", // "agent:{preset_id}"。2 = 用户
      "content": "消息...",
      "parent": null,
      "created_at": "2026-03-21T14:30:00Z",
      "replies": [
        {
          "id": 43,
          "author": "agent:1",
          "content": "回复...",
          "parent": 42,
          "created_at": "14:45:00",
          "replies": []
        }
      ]
    }
  ],
  "has_more": true,
  "next_before_id": 22
}
```

### 4.2 POST `/api/core/tweets/` — 发新推文
**Request:** `{ "content": "今天天气不错" }`

### 4.3 POST `/api/core/tweets/<id>/reply/` — 回复推文
**Request:** `{ "content": "回复内容" }`

---

## 第五篇  系统配置与模型通道 (Config, Models & Endpoints)

### 5.1 GET/PATCH `/api/core/config/` — SystemConfig
**GET Response (200) / PATCH Request:**
```json
{
  "gemini_api_key": "****abcd", // masked on GET
  "deepseek_api_key": "",
  "google_calendar_id": "user@gmail.com",
  "google_calendar_credentials_path": "/path/to/gcal.json",
  "google_calendar_extra_ids": ["id"],
  "google_calendar_delegation_user": "",
  "self_check_preset_ids": [1],
  "deep_org_preset_ids": [1],
  "heartbeat_preset_ids": [1],
  "active_start": "09:00",
  "active_end": "23:00",
  "heartbeat_base_hours": 2,
  "heartbeat_random_hours": 2,
  "night_heartbeat_base_hours": 6,
  "deep_org_weekday": 0,
  "deep_org_hour": 3,
  "updated_at": "2026-04-25T10:00:00Z"
}
```

### 5.2 [兼容期接口] GET `/api/core/models/` — 历史模型映射
*前端迁移完新 Catalog 与 Endpoint 后将弃用。*
**Response (200):**
```json
[
  { "provider": "gemini", "id": "gemini-2.5-flash", "roles": ["sub_agent"] }
]
```

### 5.3 [旧版接口] CRUD `/api/core/apikeys/` — 历史密钥管理
*在新 Endpoint 注册后不再推荐使用。*

### 5.4 [旧版接口] PUT `/api/core/config/key-map/` — 历史 Key-Map 关联
*已废弃，由 5.8 角色端点绑定代替。*

### 5.5 GET `/api/core/model-catalog/` — 统一模型与端点目录
**Response (200):**
```json
{
  "models": [
    {
      "name": "gemini-2.5-flash",
      "family": "gemini",
      "abilities": ["fc", "vision", "grounding", "context_cache"],
      "compatible_endpoint_ids": [2, 3]
    }
  ],
  "endpoints": [
    {
      "id": 2,
      "name": "Gemini 官方",
      "provider": "gemini",
      "payload_format": "gemini", // "gemini" | "openai"
      "cache_transport": "remote_reference", // "remote_reference" | "inline_chunk"
      "attachment_transports": ["file_uri", "inline_text", "inline_image"],
      "configured": true,
      "enabled": true
    }
  ],
  "roles": [
    { "role": "main", "model": "deepseek-v4-pro", "endpoint": 1 }
  ]
}
```

### 5.6 CRUD `/api/core/model-entries/` — 模型条目管理
*   **GET `/api/core/model-entries/`**: 获取已注册的模型列表。
*   **POST `/api/core/model-entries/`**: 创建模型。
    ```json
    {
      "name": "deepseek-reasoner",
      "family": "deepseek",
      "abilities": ["fc", "thinking"],
      "enabled": true
    }
    ```
*   **PATCH `/api/core/model-entries/<id>/`**: 部分修改模型定义。
*   **DELETE `/api/core/model-entries/<id>/`**: 注销/删除模型。

### 5.7 CRUD `/api/core/endpoints/` — 通道端点管理 (Endpoint)
*   **GET `/api/core/endpoints/`**: 获取已注册的通道端点列表。
*   **POST `/api/core/endpoints/`**: 创建端点。
    ```json
    {
      "name": "OpenRouter Gemini",
      "provider": "openrouter",
      "base_url": "https://openrouter.ai/api/v1",
      "api_key": 2, // 绑定的 ApiKey 整数 ID
      "payload_format": "openai",
      "cache_transport": "inline_chunk",
      "attachment_transports": ["inline_text", "inline_image"],
      "supported_families": ["gemini"],
      "supported_models": [],
      "excluded_models": [],
      "model_name_prefix": "",
      "model_name_overrides": {},
      "enabled": true
    }
    ```
*   **PATCH `/api/core/endpoints/<id>/`**: 部分修改通道配置。
*   **DELETE `/api/core/endpoints/<id>/`**: 注销端点。

### 5.8 GET/PUT `/api/core/config/roles/` — 角色模型映射配置
*   **GET `/api/core/config/roles/`**: 获取各模型角色的当前绑定。支持注册多个 `role: "main"` 条目作为可供预设选择的主模型列表。
    **Response (200):**
    ```json
    [
      { "role": "main", "model": "deepseek-v4-pro", "endpoint": 1, "style_shadow": "deepseek-v4-flash" },
      { "role": "main", "model": "gemini-2.5-pro", "endpoint": 2, "style_shadow": "gemini-2.5-flash" },
      { "role": "general_sub_agent", "model": "deepseek-v4-flash", "endpoint": 1 },
      { "role": "vision_helper", "model": "gemini-2.5-flash-lite", "endpoint": 2 },
      { "role": "grounding", "model": "gemini-2.5-flash", "endpoint": 2 },
      { "role": "image_gen", "model": "gemini-3-pro-image", "endpoint": 2 }
    ]
    ```
*   **PUT `/api/core/config/roles/`**: 全量保存绑定搭配。
    **Request Body:** 同 GET 返回数组结构。

---

## 第六篇  日程 & 习惯 (Tasks / Calendar)

### 6.1 CRUD `/api/tasks/entries/` — ScheduleEntry 任务条目
**GET Response (200) `?status=active&entry_type=`:**
```json
[
  {
    "id": 5,
    "title": "Review PR",
    "description": "...",
    "entry_type": "todo", // "todo" | "periodic" | "goal"
    "status": "active", // "active" | "suspended" | "escalated" | "archived"
    "is_pinned": false,
    "start_date": "2026-04-01",
    "tags": ["dev"],
    "due_date": "2026-05-03", // todo 专用
    "interval_unit": null, // periodic 专用: "day" | "week" | "month"
    "interval_value": null, // periodic 专用
    "end_type": null, // periodic 专用: "count" | "date" | "never"
    "end_count": null,
    "end_date": null,
    "occurrences_done": 0,
    "goal_count": null, // goal 专用
    "goal_period": null, // goal 专用: "week" | "month"
    "cycle_start": null,
    "cycle_due": null,
    "gcal_event_id": "",
    "gcal_event_link": "",
    "created_at": "2026-04-09T10:00:00Z",
    "updated_at": "2026-04-20T14:30:00Z"
  }
]
```
**POST Request:** 创建任务，Body 根据 `entry_type` 选择性传参。

### 6.2 任务动作

*   **POST `/api/tasks/entries/<pk>/complete/` — 打卡/完成**
    **Request (Optional):** `{ "note": "did 3 sets" }`
    **Response (201):** CompletionRecord 对象
*   **POST `/api/tasks/entries/<pk>/suspend/` — 挂起**
*   **POST `/api/tasks/entries/<pk>/resume/` — 恢复**

### 6.3 Google Calendar 同步

*   **POST `/api/tasks/entries/<pk>/gcal/` — 同步到 GCal**
    **Response (200):**
    ```json
    {
      "gcal_synced": true,
      "gcal_event_id": "abcd1234",
      "gcal_event_link": "https://..."
    }
    ```
*   **DELETE `/api/tasks/entries/<pk>/gcal/` — 解除关联** -> `204 No Content`

### 6.4 GET `/api/tasks/calendar/` — 90 天全区日历快照
**Response (200) `/api/tasks/calendar/` 或 `/calendar/today/` (48h):**
```json
{
  "fetched_at": "2026-05-02T17:06:34Z",
  "window_start": "2026-05-02",
  "window_end": "2026-07-31",
  "count": 2,
  "events": [
    {
      "id": "gcal_event_id",
      "source": "gcal" | "exocore",
      "title": "任务名称",
      "start": "2026-05-03", // all_day=false 时为 ISO 8601 带时间字符串
      "end": "2026-05-04",
      "all_day": true,
      "description": "",
      "location": "",
      "html_link": "https://...",
      "entry_type": null,
      "status": null,
      "exocore_entry_id": null,
      "calendar_name": "xinyi@gmail.com",
      "calendar_id": "xinyi@gmail.com"
    }
  ]
}
```

### 6.5 GET `/api/tasks/completions/` — 历史打卡记录
**Response (200) `?entry=<pk>`:**
```json
[
  {
    "id": 12,
    "entry": 5,
    "completed_at": "2026-05-01T09:30:00Z",
    "cycle_start": null,
    "note": "备注内容"
  }
]
```

---

## 第七篇  用量统计 (Telemetry)

### 7.1 GET `/api/telemetry/usage/` — 每日用量折线
**Response (200) `?mode=week|month&from=YYYY-MM-DD`:**
```json
{
  "daily": [
    {
      "date": "04/21",
      "models": [
        {
          "model": "gemini-3.1-pro-preview",
          "input_tokens": 12345,
          "output_tokens": 6789,
          "cached_tokens": 12000,
          "conversation_count": 5
        }
      ]
    }
  ],
  "from": "2026-04-21",
  "to": "2026-04-27",
  "is_current": true
}
```

### 7.2 GET `/api/telemetry/weekly/` — 周度聚合用量
**Response (200) `?weeks=12&from=YYYY-MM-DD`:** Array 聚合结果。

### 7.3 GET `/api/telemetry/monthly/` — 月度聚合用量
**Response (200) `?months=6&from=YYYY-MM`:** Array 聚合结果。

---

## 第八篇  群聊 (GroupChat)

### 8.1 GET/POST `/api/groupchat/` — 群聊列表与创建
**GET Response (200) `?participant_id=` / POST Response (201):**
```json
[
  {
    "id": 3,
    "name": "讨论群",
    "prompt": "提示词...",
    "participant_ids": [2, 6],
    "created_at": "2026-06-07T19:47:46Z"
  }
]
```

### 8.2 GET/PATCH/DELETE `/api/groupchat/<id>/` — 单群详情/修改/解散
**PATCH Request:** 可传 name, prompt, participant_ids。
**DELETE:** -> `204 No Content`

### 8.3 GET/POST `/api/groupchat/<id>/messages/` — 消息流
**GET Response (200) / POST Response (201):**
```json
[
  {
    "id": 3,
    "group": 3,
    "sender_id": 6, // 2 = 用户，其他 = AgentPreset.id
    "content": "消息正文",
    "mention_ids": [2],
    "created_at": "2026-06-07T19:48:21Z"
  }
]
```

---

## 第九篇  Push 通知 & 订阅 (Push / Register)

### 9.1 POST `/api/push/subscribe/` — 注册浏览器推送
**Request:**
```json
{
  "subscription": {
    "endpoint": "https://fcm.googleapis.com/fcm/send/...",
    "expirationTime": null,
    "keys": { "p256dh": "...", "auth": "..." }
  },
  "device_name": "iPhone"
}
```
**Response (201):** 包含完整订阅项 ID、设备名及 `is_active`。

### 9.2 POST `/api/push/unsubscribe/` — 取消推送
**Request:** `{ "endpoint": "https://..." }` -> `204 No Content`

### 9.3 Service Worker 接收的 Push Payload
```json
{
  "title": "通知标题",
  "body": "通知正文",
  "data": {
    "url": "/chat/agent/6",
    "sender_type": "agent" | "system",
    "sender_name": "G045",
    "preset_id": 6,
    "register_id": 42
  },
  "requireInteraction": true
}
```

### 9.4 POST `/api/agents/registers/<pk>/ack/` — 通知回执状态变更
**Request:**
```json
{
  "action": "navigate" | "dismiss",
  "subscription_endpoint": "https://..."
}
```
**Response (200):**
```json
{ "id": 42, "content": "[用户已在\"PC\"上查看] 编译完成" }
```
