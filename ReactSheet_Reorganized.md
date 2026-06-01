========================================================
  ExoCore — React 前端接口数据格式速查表（重整版）
  最后更新：2026-05-29（§1.6 cache endpoint 新增 platform 字段；统一路径回退）
========================================================

本文件按 API 领域重新组织，替代原 ReactSheet.txt 的跳跃编号。
原始 ReactSheet.txt 仍保留作为历史参考。


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
第一篇  会话 & 聊天 (Agents / Conversations)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1.1  GET /api/agents/conversations/  — 会话列表
─────────────────────────────────────────────────────────────
返回 Array<Conversation>，已自动排除 Archived 会话。

[
  {
    "id": 12,
    "name": "关于量子纠缠的讨论",
    "created_at": "2026-03-10T14:23:00Z",
    "last_message_at": "2026-03-10T15:01:44Z",   // 最后一条 assistant 消息时间，无则同 created_at

    // 所属项目（无项目为 0）
    "project": 3,                                  // project.id；0 = 无项目归属（API 层 sentinel，DB 存 null）
    "project_name": "Grand-Archives",              // null = 无项目归属

    // agent 快速筛选字段（返回 DB 原始类型，前端自行处理显示）
    "agent_type": "superior",                      // "superior" | "g045"（legacy alias，等同于 superior）| "standard"
    "agent_preset_id": 2,                          // AgentPreset.id

    // 会话偏好（加载会话时用于回显下拉框）
    "session_type": "chat",                        // "chat" | "code" | "cli"
    "thinking_level": "auto",                      // "off" | "auto" | "low" | "medium" | "high"
    "temperature": 1.0,                            // 0.0 ~ 2.0，每次发消息后自动持久化

    // 嵌套的 AgentSession（精简版，preset 信息已由上方扁平字段覆盖）
    "agent_session": {
      "id": 5,
      "frozen_project_ids": [3, 7]                // Superior 权限快照（g045 ≡ superior）；standard 为 []
    }
  },
  ...
]


1.2  GET /api/agents/chat/<session_id>/  — 消息历史
─────────────────────────────────────────────────────────────
返回 Array<Message>，按时间顺序排列。

[
  {
    "id": 101,
    "role": "user",
    "content": "量子纠缠是什么？",
    "reasoning_content": null,
    "platform": "gemini-3.1-pro-preview",
    "created_at": "2026-03-10T14:23:01Z",
    "index_in_session": 0                         // 与 HistoryChunk.start/end_index 对应
  },
  ...
]


1.3  POST /api/agents/chat/<session_id>/  — 发送消息
─────────────────────────────────────────────────────────────

// ── 1.3a. SSE 模式（默认） ──
// POST /api/agents/chat/<session_id>/?mode=sse （默认）
// 事件类型与 data 格式见主文档，无变动。

// ── 1.3b. Async 轮询模式 ──
// POST /api/agents/chat/<session_id>/?mode=async
// 立即返回 token，后台线程继续处理。前端关闭/刷新不中断 LLM 调用。
//
// Request body 与 SSE 模式完全一致：
{
  "content": "你好",
  "thinking_level": "medium",
  "temperature": 1.0,
  "model": null,                    // 可选模型覆盖
  "files": [],                      // 可选上传文件
  "pending_attachments": []         // 可选附件 ID
}

// Response (200) — 立即返回:
{
  "message_id": "a1b2c3d4",        // 轮询 token（UUID 前 8 位）
  "status": "processing"
}

// ── 1.3c. 轮询状态 ──
// GET /api/agents/chat/<session_id>/status/?message_id=<token>&cursor=<int>
// 每 500ms 轮询一次，获取增量事件。
// cursor 是事件索引（非字节偏移）。
//
// Response:
{
  "status": "streaming",           // "streaming" | "done" | "error" | "not_found"
  "events": [                      // cursor 之后的新增事件（类型与 SSE 模式一致）
    {"event_type": "thinking", "delta": "嗯，用户问的是..."},
    {"event_type": "content", "delta": "你好！"}
  ],
  "cursor": 2,                     // 下次轮询带上此值（已完成的事件总数）
  "error_message": null            // 仅 error 时非 null
}

// 前端轮询逻辑:
// 1. POST ?mode=async → 取得 message_id
// 2. setInterval 500ms: GET /status/?message_id=<id>&cursor=<last_cursor>
// 3. events 按 event_type 分别渲染:
//    - thinking → 可折叠的思考面板
//    - content → 打字机动画正文
//    - reasoning → RAG 检索过程提示
//    - status → 状态提示文字
//    - reference → 引用链接
//    - triggered_note_created → TriggeredNote 创建通知
// 4. status="done" → 停止轮询，GET /chat/<sid>/ 拉完整消息列表
// 5. status="error" → 显示错误，停止轮询


1.4  GET /api/agents/conversations/<pk>/history_chunks/  — HistoryChunk 列表
─────────────────────────────────────────────────────────────
返回该会话所有 HistoryChunk（长期记忆片段），按时间顺序排列。
用途：记忆管理页，展示一个会话的全部压实历史。

{
  "conversation_id": 12,
  "session_name": "关于量子纠缠的讨论",
  "session_type": "chat",
  "history_chunks": [
    {
      "id": 7,
      "start_index": 0,                // 对应原始消息的 index_in_session 起始
      "end_index": 9,                  // 对应原始消息的 index_in_session 结束
      "topic": "量子纠缠基本原理",       // LLM 提炼的话题标签
      "summary": "用户询问了量子纠缠的基本原理...", // LLM 生成的陈述性摘要
      "keywords": ["量子纠缠", "EPR"],
      "unresolved": false,             // 是否包含未竟事宜
      "created_at": "2026-03-10T15:00:00Z"
    }
  ]
}


1.5  GET/PATCH /api/memory/history_chunks/<pk>/  — HistoryChunk 详情
─────────────────────────────────────────────────────────────
用途：用户手动维护 HistoryChunk 元数据（话题标签/关键词/未竟状态）。
原始聊天记录通过 start_index/end_index 只读展示，不在此处传输。

// GET 返回：
{
  "id": 7,
  "conversation": 12,
  "session_name": "关于量子纠缠的讨论",
  "session_type": "chat",
  "start_index": 0,       // 对应 Message.index_in_session 起始（用于加载原始消息）
  "end_index": 9,         // 对应 Message.index_in_session 结束

  // 可编辑字段（来源：metadata_json / DB 字段双写）
  "topic_label": "量子纠缠基本原理",   // LLM 提炼的主题标签，用户可修改
  "keywords": ["量子纠缠", "EPR"],     // 检索关键词，用户可修改
  "unresolved": false,                 // 是否有未竟事宜，用户可 toggle

  // 只读上下文（来源：metadata_json，LLM 推断）
  "time_ref": "3月某个下午",           // 时间背景
  "emotion": "好奇/探索",              // 情感基调
  "entities": ["量子纠缠", "EPR悖论"], // 涉及的实体
  "importance": 0.8,                   // 重要度评分 0.0-1.0

  "created_at": "2026-03-10T15:00:00Z"
}

// PATCH 请求体（只允许以下三个字段）：
{
  "topic_label": "新的话题标签",   // 同步写入 metadata_json.topic_label
  "keywords": ["新关键词"],        // 同步写入 keywords 字段 + metadata_json.keywords
  "unresolved": true               // 同步写入 unresolved 字段 + metadata_json.unresolved
}

// PATCH 响应（updated 列表反映实际写入的 DB 字段）：
// 仅改 topic_label → { "msg": "已保存。", "updated": ["metadata_json"] }
// 改 keywords     → { "msg": "已保存。", "updated": ["keywords", "metadata_json"] }
// 改 unresolved   → { "msg": "已保存。", "updated": ["unresolved", "metadata_json"] }


1.6  GET/POST/DELETE /api/agents/conversations/{pk}/cache/  — 会话缓存 & 快照
─────────────────────────────────────────────────────────────
Gemini 管理远端 Context Cache + 本地快照；DeepSeek / 非 Gemini 仅管理本地快照。
platform 字段用于前端区分会话类型，据此决定展示"远端缓存"还是"本地快照"状态栏。

// ── 1.6a. GET  — 查询缓存与快照状态
// 始终返回 200 OK。has_snapshot 对 Gemini 和 DeepSeek 均有效。

// Response (Gemini 有远端缓存 + 快照):
{
  "active": true,
  "platform": "gemini",                        // 提供商名称，用于前端区分展示
  "cache_name": "cachedContents/abc123...",
  "model": "gemini-3.1-pro-preview",
  "created_at": "2026-05-04T10:00:00+00:00",
  "expires_at": "2026-05-04T11:00:00+00:00",
  "remaining_seconds": 2145,                  // 实时计算，已扣除网络延迟
  "renewals": 2,                              // 历史续期次数
  "ttl_seconds": 1500,                        // 缓存初始 TTL 25min（参考值）

  "has_snapshot": true,                       // 本地 cache_chunk 快照是否存在
  "snapshot_cache_end_idx": 405               // 快照对应的 cache_end_index
}

// Response (DeepSeek — 仅快照，无远端缓存):
{
  "active": false,
  "platform": "deepseek",
  "has_snapshot": true,
  "snapshot_cache_end_idx": 405
}

// Response (无缓存无快照):
{ "active": false, "platform": "deepseek", "has_snapshot": false }

// ── 1.6b. POST .../cache/renew/  — 手动续期 30 分钟 (Gemini only)
// Response (200):
{
  "ok": true,
  "expires_at": "2026-05-04T11:30:00+00:00",
  "renewals": 3
}

// Response (409 — 无活跃缓存):
{ "error": "no active cache" }

// ── 1.6c. DELETE .../cache/  — 手动释放缓存/快照
// Gemini: 删除远端缓存 + 本地快照，异步重建快照 → 204
// DeepSeek / 非 Gemini: 仅删除本地快照，下次请求 _build_fresh() → 204
// 无缓存也无快照: 404 { "error": "当前无活跃缓存或快照" }


1.7  POST/GET/DELETE /api/agents/conversations/{id}/attachments/  — 附件管理
─────────────────────────────────────────────────────────────

设计原则：附件是 message 级资源，每个附件绑定在创建它的用户消息上，
通过 user_msg.attachment_ids 关联。当该消息在历史窗口中时，
_build_msg_dict() → get_parts_for_message() 加载附件 Part。

┌─────────────────────┬──────────────────────────────────────────┐
│ 来源                │ 行为                                      │
├─────────────────────┼──────────────────────────────────────────┤
│ chat POST files     │ 落盘 → Part → LLM → confirm_uploaded_files│
│                     │ → SessionAttachment + user_msg.attachment_ids│
├─────────────────────┼──────────────────────────────────────────┤
│ attachments POST    │ multipart: 落盘 → 立即创建 SessionAttachment│
│                     │ 返回 {id, storage_path, ...} 供前端引用    │
│                     │ json: 验证 storage_path → 返回 meta       │
├─────────────────────┼──────────────────────────────────────────┤
│ pending_attachments │ 引用已有 storage_path → Part → LLM        │
│                     │ → confirm_pending 查重复用，不创建重复记录 │
└─────────────────────┴──────────────────────────────────────────┘

// ── 1.7a. POST multipart/form-data（直接上传） ──
// Response (201):
{
  "attachments": [
    {
      "id": 12,
      "storage_path": "/abs/path/to/uploads/attachments/5/image.png",
      "display_name": "image.png",
      "original_filename": "image.png",
      "mime_type": "image/png",
      "file_size": 245760
    }
  ]
}

// ── 1.7b. POST application/json（验证已有路径） ──
// { "storage_path": "/existing/file.md", "display_name": "笔记" }
// → 200 { storage_path, display_name, mime_type, file_size, ... }

// ── 1.7c. GET  — 列表
// 返回该会话所有附件（user 上传 + tool_collection 缓存）。

// ── 1.7d. DELETE .../attachments/delete/
// Body: { "source": "user"|"tool_collection", "id": <int|str> }
// - source "user" → 删除 SessionAttachment DB 记录
// - source "tool_collection" → 从 ToolCollectionCache 注册表移除
// 返回: 204 No Content

// ── 消息级加载机制 ──
// 附件不参与 conversation 级自动注入。
// 加载路径只有一条：_build_msg_dict() 遍历历史消息时，
// 对每条 msg.attachment_ids 调用 get_parts_for_message() 加载 Part。
// 附件随消息在历史窗口中自然升降 —— 消息滚出窗口时附件也随之消失。

// 注入顺序（process_chat Phase B all_attachments 组装）：
//   file_parts          ← 本轮 chat POST 的 files 字段 (multipart)
//   extra_parts         ← Superior ToolCollectionCache (当前轮工具输出)
//   pending_parts       ← 本轮 pending_attachments (JSON 引用已有文件)

// 实现位置：
//   get_parts_for_message()     → engines/attachment_manager.py
//   _build_msg_dict()           → agents/services.py
//   SessionAttachmentView       → agents/views.py
//   confirm_pending 去重        → engines/attachment_manager.py
//   confirm_uploaded_files      → engines/attachment_manager.py


1.8  GET /api/agents/presets/<preset_id>/triggered-notes/snapshot/  — TriggeredNote 快照
─────────────────────────────────────────────────────────────
返回指定 Superior 预设下随机 15 条高分活跃 TriggeredNote 快照。
筛选条件：is_active=True, current_weight >= 0.8

[
  {
    "keywords": "量子纠缠, EPR",
    "note": "量子纠缠是两个粒子之间的一种量子力学现象...",
    "is_persistent": true,
    "weight": 0.95
  },
  ...
]


1.9  CRUD /api/agents/chronicle/  — ChronicleEntry（大事记）
─────────────────────────────────────────────────────────────

// ── 1.9a. GET /api/agents/chronicle/ — 列表
// 支持过滤: ?preset=<id>，按 event_time 降序排列

[
  {
    "id": 3,
    "preset": 1,
    "event_time": "2026-05-16",
    "content": "完成毕设答辩，导师给予了肯定的评价...",
    "scope": "表",
    "keywords": ["毕设", "毕业", "答辩"],
    "modified_at": "2026-05-16T15:30:00Z"
  },
  {
    "id": 2,
    "preset": 1,
    "event_time": "2026-05-10",
    "content": "和姐妹深夜通话聊了很多，感觉关系又近了一步",
    "scope": "里",
    "keywords": ["姐妹", "关系", "深夜"],
    "modified_at": "2026-05-11T08:00:00Z"
  }
]

// ── 1.9b. POST /api/agents/chronicle/ — 创建
// Request:
{
  "preset": 1,
  "event_time": "2026-05-16",
  "content": "完成毕设答辩，导师给予了肯定的评价...",
  "scope": "表",                              // 可选：表/里（可扩展）
  "keywords": ["毕设", "毕业", "答辩"]         // 可选
}
// Response (201): 同上格式，含完整对象

// ── 1.9c. GET    /api/agents/chronicle/<id>/ — 详情
// ── 1.9d. PATCH  /api/agents/chronicle/<id>/ — 部分更新
//         可更新字段: event_time, content, scope, keywords
//         preset 创建后不可修改
// ── 1.9e. DELETE /api/agents/chronicle/<id>/ — 删除

// scope 字段说明:
//   表 — 外部 milestone：事业/学业/成就/公开事件
//   里 — 私人/关系 milestone：人际/情感/内心状态
//   前端展示为 表/里 两个分类，但 scope 为自由文本（CharField），后续可按需扩展


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
第二篇  记忆 & 画像 (Memory / Portraits / Scope)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2.1  GET /api/memory/knowledge/  — KnowledgeFragment 列表
─────────────────────────────────────────────────────────────
支持过滤: ?topic=<value>&project=<id>，分页: page_size=50

{
  "count": 120,
  "next": "http://.../api/memory/knowledge/?topic=work&page=2",
  "previous": null,
  "results": [
    {
      "id": 5,
      "uid": "a1b2c3d4",
      "title": "项目架构设计笔记",
      "topic": "work",
      "status": "active",
      "source_type": "obsidian_md",
      "tags": ["架构", "设计"],
      "keywords": ["Django", "微服务"],
      "abstract": "本文讨论了项目架构的设计原则...",
      "project": 3,
      "created_at": "2026-03-10T14:00:00Z",
      "updated_at": "2026-05-01T09:00:00Z"
    }
  ]
}

// GET  /api/memory/knowledge/<pk>/ — 详情
// PATCH /api/memory/knowledge/<pk>/ — 编辑 abstract/keywords
// 格式见主文档，无变动。


2.2  CRUD /api/memory/portraits/  — UserPortrait
─────────────────────────────────────────────────────────────

// ── 2.2a. GET /api/memory/portraits/?preset_id=<id>
// 可附加过滤: &scope=work &source=highlight &is_processed=false
// 返回 Array<UserPortrait>

[
  {
    "id": 3,
    "preset": 1,
    "conversation": 12,          // null = user_manual（非会话来源）
    "message": 101,              // null = 非划线来源
    "source": "highlight",       // "highlight" | "g045_tool" | "user_manual"
    "content": "量子纠缠是两个粒子…",
    "scope": "work",             // null（Ollama 处理中）| scope_keywords.json 中任意值
                                 // | "global"（兜底，匹配不到特定 scope 时使用）
    "tags": ["量子纠缠", "物理"],
    "is_processed": true,        // false = 分类中（关键词查表 → Ollama → global），scope/tags 暂为空
    "created_at": "2026-04-21T14:23:00Z",
    "updated_at": "2026-04-21T14:25:00Z"
  }
]

// ── 2.2b. GET /api/memory/portraits/tags/?preset_id=<id>
// 返回该 preset 下所有已有 tag（去重、排序），供 autocomplete 使用
// 注意：此路由必须在 /portraits/<pk>/ 之前匹配

["爱好", "物理", "量子纠缠"]

// ── 2.2c. POST /api/memory/portraits/ — 用户手动新增（user_manual）
// Request（preset_id 与 message_id 互斥，只能传其一）：
{ "preset_id": 1, "content": "我喜欢读科幻小说", "scope": "写作", "tags": ["科幻"] }
// scope 可选，值来自 scope_keywords.json + "global" 兜底；传无效值 → 400
// 若省略 scope：后台触发异步分类（关键词查表 → Ollama → global，is_processed: false → true）
// 若提供 scope：直接写入，is_processed=true，跳过异步分类

// ── 2.2d. POST /api/memory/portraits/ — 划线笔记（highlight）
{ "message_id": 101, "content": "量子纠缠是两个粒子…" }
// preset / conversation 自动从 message 所属会话派生
// 始终触发 Ollama 异步分类

// ── 2.2e. PATCH /api/memory/portraits/<pk>/
// 可编辑字段：content / scope / tags（三者可单独或组合）
// - content 仅 preset_id=2（用户全局记忆）可编辑；agent 条目 → 403
// - scope 设有效值（scope_keywords.json 中 + "global" 兜底）→ 写入并置 is_processed=true
// - scope 传 null → 清除 scope，is_processed 保持不变（不重触发分类）
// - tags 修改不影响 is_processed

// Request 示例：
{ "scope": "life" }                       // 增改 scope
{ "scope": null }                         // 清除 scope
{ "content": "修改后的内容", "scope": "work", "tags": ["新标签"] }  // 同时编辑三个字段

// Response：返回完整更新后的 UserPortrait 对象

// ── 2.2f. DELETE /api/memory/portraits/<pk>/  → 204 No Content


2.3  GET/PUT /api/memory/scope-keywords/  — Scope 关键词表
─────────────────────────────────────────────────────────────

// ── 2.3a. GET — 读取当前关键词表

{
  "work": ["毕设", "项目", "任务", "会议", "treffen", "开发", "需求", "文档", "进度",
           "汇报", "上班", "同事", "客户", "方案", "计划", "deadline", "提测", "发布",
           "bug", "review", "部署", "接口", "数据库"],
  "life": ["生活", "健康", "睡眠", "睡觉", "饮食", "吃饭", "运动", "锻炼", "医院",
           "买", "钱", "账单", "房子", "家", "搬", "天气", "出行", "旅行", "假期",
           "休息", "日程", "安排", "事务"],
  "游戏": ["魂", "怪猎", "只狼", "法环", "血源", "饥荒", "博德之门", "博3", "DnD", "仁王"],
  "写作": ["科幻", "葉上书", "无尽焰", "脑洞", "读后感", "甜饼", "同人", "神话", "随笔", "剧情"],
  "emotion": ["爱", "desire", "难过", "开心", "焦虑", "压力", "累", "烦",
              "喜欢", "讨厌", "害怕", "孤独", "姐妹", "朋友", "关系", "妈咪", "亲密",
              "信任", "失落", "迷茫", "困惑", "担心", "期待"]
}

// ── 2.3b. PUT — 全量替换
// Body 格式与 GET 返回值完全一致。
// 校验: key 必须是字符串（max 50 chars），value 必须是字符串列表。
// 副作用:
//   1. 若恰好 1 个旧 scope 被移除且 1 个新 scope 被添加 → 视为重命名，
//      自动级联更新所有 UserPortrait 中旧 scope → 新 scope
//   2. 使 entry_orchestrator 的模块级缓存失效，下次消息立即使用新关键词表
//   3. 使 entry_processor 的 Ollama 分类立即使用新 scope 列表


2.4  Scope 体系总览
─────────────────────────────────────────────────────────────
五个模型中 scope 相关字段的对照表，供前端开发参考。

┌─────────────────────┬──────────┬──────────────────┬──────────────────────────────┬──────────────────────────────┐
│ 模型                │ 字段名   │ 类型             │ 词汇来源                     │ 管理方式                     │
├─────────────────────┼──────────┼──────────────────┼──────────────────────────────┼──────────────────────────────┤
│ UserPortrait         │ scope    │ CharField(50)    │ scope_keywords.json keys     │ 关键词查表 → Ollama 推测     │
│ (memory/portraits/)   │          │                  │ + "global" 兜底              │ → global 兜底；用户可PATCH   │
│                     │          │                  │                              │ portraits/<pk>/ 纠偏           │
├─────────────────────┼──────────┼──────────────────┼──────────────────────────────┼──────────────────────────────┤
│ KnowledgeFragment   │ topic    │ CharField(100)   │ Obsidian frontmatter         │ 前端按 ?topic= 过滤查看      │
│ (memory/knowledge/) │          │                  │ scope 字段                   │ PATCH 可编辑                 │
├─────────────────────┼──────────┼──────────────────┼──────────────────────────────┼──────────────────────────────┤
│ TriggeredNote        │ scope    │ JSONField(list)  │ global / tech / emotional    │ LLM function call 自动设置   │
│ (agents/triggered-   │          │                  │ / project                    │ 前端暂不需要管理             │
│  notes/)             │          │                  │                              │                              │
├─────────────────────┼──────────┼──────────────────┼──────────────────────────────┼──────────────────────────────┤
│ ChronicleEntry      │ scope    │ CharField(50)    │ 表 / 里（可扩展）             │ 前端 CRUD 手动管理           │
│ (agents/chronicle/) │          │                  │                              │ MemoAssist 自动创建          │
├─────────────────────┼──────────┼──────────────────┼──────────────────────────────┼──────────────────────────────┤
│ scope_keywords.json │ —        │ JSON dict        │ 用户手动维护                 │ GET/PUT /api/memory/         │
│ (memory/scope-      │          │ (scope→keywords) │                              │ scope-keywords/              │
│  keywords/)         │          │                  │                              │                              │
└─────────────────────┴──────────┴──────────────────┴──────────────────────────────┴──────────────────────────────┘

关键设计说明:
- UserPortrait 的 scope 既是分类标签也是热更新检索的过滤维度
- scope_keywords.json 的 keys 是"用户定义的 scope 注册表"——Ollama + 关键词两阶段分类时
  只能从此列表选择；"global" 为通用兜底值，用于匹配不到特定 scope 的条目
- 删除 scope_keywords.json 中的 scope 时：关联的 UserPortrait 条目标记 is_processed=false
  并触发异步重分类；重命名 scope 时：直接级联更新条目 scope 字段
- KnowledgeFragment 的 topic 来自 Obsidian 文件元数据，独立于 scope_keywords.json
- TriggeredNote 的 scope（global/tech/emotional/project）是独立体系，用于会话级别匹配
- ChronicleEntry 的 scope（表/里）是最简化的二分法，按需可扩展


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
第三篇  项目 & 文件 (Core / Projects)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3.1  GET /api/core/projects/<project_pk>/files/  — 项目文件列表
─────────────────────────────────────────────────────────────
返回 Array<ProjectFile | ObsidianSyncEntry>，含 web 上传 + Obsidian 同步两类。
格式见主文档，无变动。

// ── 上传路径规则 ──
// Project.work_dir 非空 → {work_dir}/ExoCore_Files/uploads/{filename}
// Project.work_dir 为空 → projects/{project.id}/{filename}（MEDIA_ROOT 下旧路径）


3.2  GET/PATCH /api/core/projects/<id>/  — 项目详情 & 工作目录 & 背景提示词
─────────────────────────────────────────────────────────────

// ── 3.2a. 数据模型 ──
// Project 模型字段：
//   prompt   = TextField(blank=True, default="") — 项目背景提示
//   work_dir = CharField(max_length=500, blank=True, default="") — 项目磁盘根目录
// 空字符串 = 未设置（无项目背景 / 未绑定磁盘目录）。

// ── 3.2b. GET — 详情
{
  "id": 3,
  "name": "Grand-Archives",
  "description": "",
  "prompt": "本项目用于归档所有学术论文的讨论和审阅...",
  "work_dir": "D:\\Alicia\\Projects\\GrandArchives",
  "created_at": "2026-03-01T10:00:00Z"
}

// ── 3.2c. PATCH — 部分更新
{ "prompt": "新的项目背景说明..." }
{ "work_dir": "D:\\Alicia\\Projects\\MyProject" }
// 或同时更新多个字段：
{ "name": "New-Name", "prompt": "新的背景...", "work_dir": "D:\\Alicia\\Projects\\NewProject" }

// ── 3.2d. work_dir 行为说明 ──

// work_dir 非空时：
//   - 项目文件上传路径 → {work_dir}/ExoCore_Files/uploads/{filename}
//   - read_project 工具根目录 → 使用 work_dir（而非全局 PROJECT_DIR）
//   - sync_project 命令扫描根目录 → {work_dir}/ExoCore_Files/
//
// work_dir 为空时：
//   - 项目文件上传路径 → projects/{project.id}/{filename}（MEDIA_ROOT 下）
//   - read_project 工具根目录 → 回退到 settings.PROJECT_DIR
//   - sync_project 命令 → 报错退出

// ── 3.2e. System Prompt 拼接顺序 ──

// 每次 LLM 调用时，按以下顺序动态拼接 system_prompt（不写入 preset DB）：

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ 拼接顺序              │ Standard          │ Superior (G045)              │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ 1. preset.system_prompt│ ✅ 始终           │ ✅ 始终                       │
// │ 2. project.prompt      │ ✅ 项目非空时追加  │ ✅ 项目非空时追加              │
// │ 3. Permanent Directives│ ❌ 无              │ ✅ 始终追加（位置提示）        │
// └─────────────────────────────────────────────────────────────────────────┘

// Standard Agent 最终 system_prompt：
//   [preset.system_prompt]
//   \n\n## 当前项目背景\n[project.prompt]    ← 仅当 conversation.project.prompt 非空

// Superior Agent 最终 system_prompt：
//   [preset.system_prompt]
//   \n\n## 当前项目背景\n[project.prompt]    ← 仅当 conversation.project.prompt 非空
//   \n\n你的永久指令位于上下文顶部 [Permanent Directives] 区块。

// 后端注入点：
//   G045Service._prepare_superior_context()     → agents/services.py :1626-1628
//   StandardAgentService._build_context_generator() → agents/services.py :2403-2407


3.3  CLI — sync_project 管理命令
─────────────────────────────────────────────────────────────
将项目 work_dir 下的文件同步为 KnowledgeFragment 记录。

```
python manage.py sync_project <project_name> [--dry-run]
```

// ── 参数 ──
//   project_name  (必填)  Project.name，项目代号
//   --dry-run     (可选)  仅扫描打印，不写入 DB

// ── 行为 ──
// 1. 查 Project by name → 校验 work_dir 非空且磁盘存在
// 2. 遍历 {work_dir}/ExoCore_Files/ 下所有文件（排除隐藏文件）
// 3. .md 文件 → parse_md_file() → upsert_fragment()
//    - parse_md_file 从 frontmatter 提取 uid/title/abstract/keywords 等
//    - upsert_fragment 以 uid 为 key 做 update_or_create，绑定到该 Project
//    - source_type 自动设为 "obsidian_md"
// 4. 其他文件类型 → 跳过
// 5. 输出汇总：Created / Updated / Skipped / Errors

// ── 前置条件 ──
// 1. Project.work_dir 已通过 PATCH /api/core/projects/<id>/ 设置
// 2. {work_dir}/ExoCore_Files/ 目录已存在（手动创建或通过文件上传自动生成）
// 3. 需要同步的 .md 文件已放入该目录

// ── 示例 ──
// python manage.py sync_project Grand-Archives --dry-run
// python manage.py sync_project Grand-Archives

// ── 相关代码 ──
// core/management/commands/sync_project.py
// memory.utils.parse_md_file() / upsert_fragment()
// core/models.py → Project.work_dir / work_dir_path


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
第四篇  时间线 (Core / Tweets)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4.1  GET /api/core/tweets/  — 分页推文列表
─────────────────────────────────────────────────────────────
根推文 + 嵌套回复，最多 2 层。用途：时间线首屏及无限滚动加载。

// 首次请求：GET /api/core/tweets/
// 翻页请求：GET /api/core/tweets/?before_id=38

// Response (200)：
{
  "tweets": [
    {
      "id": 42,
      "author": "user",                          // "user" | "agent:{id}"
      "content": "今天写代码好累...",
      "parent": null,
      "created_at": "2026-03-21T14:30:00Z",      // 后端已自动转换为本地时间字符串
      "replies": [
        {
          "id": 43,
          "author": "agent:1",
          "content": "要注意休息哦～",
          "parent": 42,
          "created_at": "14:45:00",              // 回复层级可能仅返回时分
          "replies": [...]
        }
      ]
    }
  ],
  "has_more": true,
  "next_before_id": 22
}


4.2  POST /api/core/tweets/  — 发新推文
─────────────────────────────────────────────────────────────
{ "content": "今天天气不错" }


4.3  POST /api/core/tweets/<id>/reply/  — 回复推文
─────────────────────────────────────────────────────────────
{ "content": "我也觉得！" }


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
第五篇  系统配置 (Core / Config & Models)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

5.1  GET/PATCH /api/core/config/  — SystemConfig
─────────────────────────────────────────────────────────────
Singleton operator configuration。DB values override env vars；空 DB 值回退到 env。
API key 字段读取时始终 masking。

// ── 5.1a. GET
// API key 字段：若已设置 → "****<last4>"；若未设置 → ""

{
  "gemini_api_key":                   "****abcd",   // masked; "" if not set
  "deepseek_api_key":                  "",
  "google_calendar_id":               "user@gmail.com",
  "google_calendar_credentials_path": "/path/to/gcal.json",

  "self_check_preset_ids":  [1],      // G045 preset IDs allowed to self-check
  "deep_org_preset_ids":    [1],      // G045 preset IDs allowed deep-organize
  "interact_preset_ids":    [1],      // G045 preset IDs allowed timeline interaction

  "active_start": "09:00",            // TimeField — HH:MM
  "active_end":   "23:00",

  "interaction_base_hours":       2,  // active window min interval hours
  "interaction_random_hours":     2,  // random addon (active + night)
  "night_interaction_base_hours": 6,  // outside active window min interval

  "deep_org_weekday": 0,              // 0=Mon … 6=Sun
  "deep_org_hour":    3,              // 0-23; read once at server startup

  "model_generate_abstract":      "",           // empty = Ollama default
  "model_realtime_recompress":    "deepseek-v4-pro",
  "model_extract_chunk_metadata": "",

  "updated_at": "2026-04-25T10:00:00Z"
}

// ── 5.1b. PATCH
// 部分更新。任何以 "****" 开头的 key 字段视为未修改，忽略。
// 返回更新后的 config（同样 masked）。

// Validation:
//   - active_start / active_end: HH:MM string
//   - deep_org_weekday: 0–6
//   - deep_org_hour: 0–23
//   - model_* fields: 若非空则必须存在于 model_registry（任意 role）
//   - *_preset_ids: 必须是有效的 G045 AgentPreset IDs

// Request example:
{ "gemini_api_key": "sk-newkey", "self_check_preset_ids": [1, 2], "deep_org_hour": 4 }
// → key stored; subsequent GET returns "****wkey"

// To leave a key unchanged, send its masked value:
{ "gemini_api_key": "****abcd" }   // → ignored, DB untouched


5.2  GET /api/core/models/  — Model Registry
─────────────────────────────────────────────────────────────
返回完整 model registry，供 NLP model selector dropdown 使用。

[
  { "provider": "gemini",   "id": "gemini-3.1-pro-preview", "roles": ["main"] },
  { "provider": "gemini",   "id": "gemini-2.5-flash",       "roles": ["sub_agent"] },
  { "provider": "deepseek", "id": "deepseek-v4-pro",        "roles": ["main"] }
  // ... all entries from model_registry.list_models()
]

// 注：AgentPreset 的 feature toggles (can_self_check / can_deep_org / can_interact)
// 不在 AgentPreset 字段上，而是通过 SystemConfig 的 ID 列表管理
// (self_check_preset_ids / deep_org_preset_ids / interact_preset_ids)，通过上述 PATCH 修改。


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
第六篇  日程 & 习惯 (Tasks / Calendar)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

6.1  CRUD /api/tasks/entries/  — ScheduleEntry
─────────────────────────────────────────────────────────────

// ── 6.1a. GET /api/tasks/entries/
// 可附加过滤: ?status=active&entry_type=todo&is_pinned=true
// 返回: Array<ScheduleEntry>

[
  {
    "id": 5,
    "title": "Review PR #42",
    "description": "Check the authentication middleware changes",
    "entry_type": "todo",              // "todo" | "periodic" | "goal"
    "status": "active",                // "active" | "suspended" | "escalated" | "archived"
    "is_pinned": false,
    "start_date": "2026-04-01",
    "tags": ["dev", "review"],

    // [todo 专用]
    "due_date": "2026-05-03",

    // [periodic 专用]
    "interval_unit": null,             // "day" | "week" | "month"
    "interval_value": null,            // 每 N 个单位
    "end_type": null,                  // "count" | "date" | "never"
    "end_count": null,
    "end_date": null,
    "occurrences_done": 0,             // 已完成次数; next_due = start_date + interval × occurrences_done

    // [goal 专用]
    "goal_count": null,                // 每周期目标次数
    "goal_period": null,               // "week" | "month"
    "cycle_start": null,               // 当前周期起始日期
    "cycle_due": null,                 // 当前周期截止日期

    // GCal 同步
    "gcal_event_id": "",               // 空字符串 = 未同步
    "gcal_event_link": "",

    "created_at": "2026-04-09T10:00:00Z",
    "updated_at": "2026-04-20T14:30:00Z"
  }
]

// ── 6.1b. POST /api/tasks/entries/ — 创建
{
  "title": "Review PR",
  "description": "...",
  "entry_type": "todo",                // 必填
  "start_date": "2026-05-01",
  "due_date": "2026-05-03",            // todo 用
  "tags": ["dev"],
  // periodic 可选字段: interval_unit, interval_value, end_type, end_count, end_date
  // goal 可选字段: goal_count, goal_period
}

// ── 6.1c. GET    /api/tasks/entries/<pk>/ — 单条详情
// ── 6.1d. PATCH  /api/tasks/entries/<pk>/ — 部分更新
// ── 6.1e. DELETE /api/tasks/entries/<pk>/ — 软删除 (status → "archived")


6.2  Entry Actions
─────────────────────────────────────────────────────────────

// ── 6.2a. POST /api/tasks/entries/<pk>/complete/  — 打卡完成
// Body (optional): { "note": "did 3 sets" }
// 返回: CompletionRecord 对象

// ── 6.2b. POST /api/tasks/entries/<pk>/suspend/  — 挂起 (status → "suspended")
// ── 6.2c. POST /api/tasks/entries/<pk>/resume/   — 恢复 (status → "active")


6.3  Google Calendar Sync
─────────────────────────────────────────────────────────────

// ── 6.3a. POST /api/tasks/entries/<pk>/gcal/
// 将 ScheduleEntry 推送到 Google Calendar（创建或更新 all-day event）。
// 成功返回:
{
  "gcal_synced": true,
  "gcal_event_id": "abcd1234",
  "gcal_event_link": "https://www.google.com/calendar/event?eid=..."
}
// 失败 (502):
{ "detail": "GCal sync failed: ...", "gcal_synced": false }

// ── 6.3b. DELETE /api/tasks/entries/<pk>/gcal/
// 解除 GCal 关联（删除远端 event，清空本地 gcal_event_id/link）。
// 返回: 204 No Content


6.4  Calendar Snapshots (GCal + ExoCore merged)
─────────────────────────────────────────────────────────────
后台定时任务（启动 + 每 24h）从 Google Calendar 拉取事件，与 ExoCore
内部 ScheduleEntry 合并去重后写入 JSON 快照。Google Tasks 不在此范围内。

// ── 6.4a. GET /api/tasks/calendar/  — 90 天全量快照
// 首次启动后立即可用；若文件尚未生成返回 503。

{
  "fetched_at": "2026-05-02T17:06:34+00:00",
  "window_start": "2026-05-02",
  "window_end": "2026-07-31",
  "count": 4,
  "events": [
    {
      "id": "60ojiob1c5im8b9o..._20260503",   // GCal event ID (含 recurrence suffix)
      "source": "gcal",                        // "gcal" | "exocore"
      "title": "Misu 内驱",
      "start": "2026-05-03",                   // all_day=true 时仅日期
      "end": "2026-05-04",                     // GCal exclusive end
      "all_day": true,
      "description": "",
      "location": "",
      "html_link": "https://www.google.com/calendar/event?eid=...",
      "entry_type": null,                      // null for GCal events
      "status": null,
      "exocore_entry_id": null                 // null for GCal events
    },
    {
      "id": "exo_5",
      "source": "exocore",
      "title": "[ExoCore] Review PR #42",
      "start": "2026-05-03",
      "end": "2026-05-04",
      "all_day": true,
      "description": "Check the authentication middleware changes",
      "location": null,
      "html_link": "https://www.google.com/calendar/event?eid=...",  // if synced
      "entry_type": "todo",
      "status": "active",
      "exocore_entry_id": 5
    },
    {
      "id": "4dlo979grhe8hei2u9ikukv94g",
      "source": "gcal",
      "title": "ZBH treffen",
      "start": "2026-05-05T13:00:00+02:00",    // all_day=false 时带时间
      "end": "2026-05-05T14:30:00+02:00",
      "all_day": false,
      "description": "",
      "location": "Albert-Einstein-Ring, Hamburg",
      "html_link": "https://www.google.com/calendar/event?eid=...",
      "entry_type": null,
      "status": null,
      "exocore_entry_id": null
    }
  ]
}

// 去重规则: ExoCore 条目如已同步到 GCal (gcal_event_id 匹配某 GCal 事件),
// 则仅保留 GCal 版本，不重复出现。

// ── 6.4b. GET /api/tasks/calendar/today/  — 48h 快照
// calendar_schedule.json 的子集，供 timeline / routine 近期提醒。
// 结构与 §6.4a 完全一致，仅 window_start/window_end 为 48h 范围。
// 若文件尚未生成返回 503。


6.5  GET /api/tasks/completions/  — CompletionRecord 列表
─────────────────────────────────────────────────────────────
GET /api/tasks/completions/?entry=<pk>

[
  {
    "id": 12,
    "entry": 5,
    "completed_at": "2026-05-01T09:30:00Z",
    "cycle_start": null,               // goal 类型记录归属周期
    "note": "did 3 sets"
  }
]


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
第七篇  用量统计 (Telemetry)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

7.1  GET /api/telemetry/usage/?mode=&from=  — 每日粒度用量
─────────────────────────────────────────────────────────────
折线图用。mode: "week" (7天) | "month" (30天)。from: 起始日期 YYYY-MM-DD，默认今天。

{
  "daily": [
    {
      "date": "04/21",
      "models": [
        {
          "model": "gemini-3.1-pro-preview",
          "input_tokens": 12345,      // promptTokenCount (char-based estimate for non-Gemini)
          "output_tokens": 6789,      // candidatesTokenCount
          "cached_tokens": 12000,     // cachedContentTokenCount (Gemini) / prompt_cache_hit_tokens (DeepSeek); 0 = miss
          "conversation_count": 5
        },
        {
          "model": "deepseek-v4-pro",
          "input_tokens": 800,
          "output_tokens": 250,
          "cached_tokens": 750,
          "conversation_count": 2
        }
      ]
    }
  ],
  "from": "2026-04-21",
  "to": "2026-04-27",
  "is_current": true
}


7.2  GET /api/telemetry/weekly/  — 周度聚合用量
─────────────────────────────────────────────────────────────
概览用。参数: ?weeks=12&from=YYYY-MM-DD。from: 周一日期，默认本周一。

{
  "weekly": [
    {
      "week": "04/21–04/27",
      "is_current": true,
      "models": [
        {"model": "gemini-3.1-pro-preview", "input_tokens": 12345, "output_tokens": 6789, "cached_tokens": 12000, "conversation_count": 5}
      ]
    }
  ]
}


7.3  GET /api/telemetry/monthly/  — 月度聚合用量
─────────────────────────────────────────────────────────────
概览用。参数: ?months=6&from=YYYY-MM。from: 月份 YYYY-MM，默认当月。

{
  "monthly": [
    {
      "month": "2026-04",
      "is_current": true,
      "models": [
        {"model": "gemini-3.1-pro-preview", "input_tokens": 123450, "output_tokens": 67890, "cached_tokens": 120000, "conversation_count": 50}
      ]
    }
  ]
}


7.4  GET /api/telemetry/daily/  — 原始 daily_summary.json
─────────────────────────────────────────────────────────────
全量快照，keyed by date → platform → model。结构同旧格式，一般只供调试。


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
附录 A  File Transfer — 前端文件上传协调备忘
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Adapter Turn 机制依赖前端区分「文件上传」与「剪贴板粘贴」两类图片。
当前后端通过 file_size 阈值（>100KB）作为近似判断，不够精确。
待前端明确上传入口后协调调整。

// ── 当前行为 ──
//
// 图片附件满足 file_size > 100KB，或文本附件 file_size > 10KB（约 >100行）
// 时触发 Adapter Turn：后端生成虚拟 user/model turn 将 file_uri 冻入 Gemini
// Context Cache，后续轮次不重传文件，节省 token 并避免大 base64 导致 SSE 断流。
//
// 小图片（<100KB，通常为剪贴板粘贴）保持次抛，每轮在 Part 5 新鲜发送。

// ── 待协调 ──
//
// 1. 前端「文件上传」入口（按钮/拖拽）提交的图片应始终触发 adapter
//    → 可考虑在 POST attachments 时传 source="upload" 标记
// 2. 前端「剪贴板粘贴」的图片（clipboard paste）应始终不触发
//    → 可考虑传 source="clipboard" 标记，或由后端根据请求路径区分
// 3. 建议：前端在调用 POST /api/agents/conversations/<pk>/attachments/
//    时增加可选字段 source: "upload" | "clipboard"，后端据此精确判断，
//    替代当前的 file_size 阈值启发式。
// 4. 文本文件的行数阈值（当前 10KB 近似）如需更精确，可考虑前端传
//    line_count 字段。

// ── 相关代码 ──
//
// 后端触发检测: agents/services.py → SuperiorService._detect_adapter_trigger()
// Cache 构建:    engines/cache_chunk.py → CacheChunkBuilder._build_fresh(adapter_info)
// Gemini 缓存:   engines/context_cache.py → _create_gemini_cache (has_adapter 分支)
