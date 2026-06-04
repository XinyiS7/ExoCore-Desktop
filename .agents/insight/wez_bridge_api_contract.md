# Wez Bridge API Contract

> 后端 ↔ Extension 接口格式表。以后端处理逻辑为准，Extension 适配。
> 更新日期：2026-05-30

---

## 请求：POST /api/agents/external_context_inject/

### Request Body

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `extension_secret` | string | **yes** | — | 扩展身份令牌，对 `EXTENSION_SECRET` 环境变量 |
| `agent` | int/string | **yes** | — | Preset ID（int）或 name（string 模糊匹配） |
| `source` | string | **yes** | — | 来源标识，wez_bridge 固定 `"wez_bridge"` |
| `target_storage` | string | **yes** | — | `"external_session"` |
| `mode` | string | **yes** | — | `"wez_bridge"`（用户对话）或 `"wez_bridge_sentinel"`（哨兵自动） |
| `messages` | list[dict] | **yes** | — | 全量消息历史，格式见下方 |
| `external_session_id` | string | recommended | `""` | Extension 的 session 标识，后端回显 |
| `client_type` | string | no | `""` | `"wez_bridge"` |
| `client_display` | string | no | `""` | 显示名称 |
| `thinking_level` | string | no | `"medium"` | `"low"` / `"medium"` / `"high"` |
| `temperature` | float | no | `1.0` | 0.0 - 2.0 |

### messages 格式

```json
[
  {"role": "user", "content": "第一条用户消息"},
  {"role": "assistant", "content": "第一条 AI 回复"},
  {"role": "user", "content": "第二条用户消息"},
  {"role": "assistant", "content": "第二条 AI 回复"},
  {"role": "user", "content": "最新用户消息"}
]
```

**规则：**
- 按时间顺序排列 `[oldest, ..., newest]`
- 最后一条永远是当前用户消息（索引 `n = len(messages) - 1`）
- 角色交替：`user → assistant → user → ...`
- Extension 每次都发全量历史，后端自行判断 cache 覆盖范围
- 哨兵告警也走同样的 messages 结构，不另起字段

---

## 响应

### 共享字段（所有 wez_bridge 模式）

| Field | Type | Always | Description |
|---|---|---|---|
| `success` | bool | yes | |
| `reply` | string | yes | AI 回复正文 |
| `session_type_used` | string | yes | `"wez_bridge"` 或 `"wez_bridge_sentinel"` |
| `external_session_id` | string | if sent | 回显 ext 发来的 session id |
| `compacted_up_to` | int | yes | 被自动压缩的消息条数（0 表示无压缩） |
| `compact_chunks` | list | if compacted | 压缩块列表 |
| `cached_up_to_index` | int | if cached | Cache 覆盖的最后一条消息索引 |
| `error` | string | if failed | 错误描述 |

### compact_chunks 结构

```json
[
  {
    "summary": "NlpEngine 生成的摘要文本",
    "start_index": 0,
    "end_index": 9
  }
]
```

对齐后端 `Proposal` 模型。Extension 收到后重组 session 为 `compact_chunks + messages[compacted_up_to:]`。

### 哨兵专属字段（mode=wez_bridge_sentinel）

| Field | Type | Description |
|---|---|---|
| `sentinel_rounds_completed` | int | 完成轮数（1-3） |
| `sentinel_early_termination` | bool | 是否提前终止（superior 说 "check over"） |
| `cache_rebuilt` | bool | Cache 是否为本次新建（之前过期/不存在） |

---

## 后端处理逻辑（Extension 须知）

### Cache 策略（仅 Gemini）

```
ext 发来 messages[0..n]（n = 最新用户消息索引）

0 cache + n > 0:
  → messages[0:n-1] 打包进 Gemini cache
  → messages[n:] 热发
  → 记录 cached_up_to_index = n-1
  → 返回 cache_rebuilt: true

0 cache + n = 0:
  → 不建 cache（只有一条消息）

cache 存在 + cached_up_to_index == n-1:
  → cache 仍有效，messages[n:] 热发

cache 存在 + cached_up_to_index != n-1:
  → 不匹配，重建 cache

DeepSeek:
  → 全量发送，不走 cache，不返回 cached_up_to_index
```

### 上下文注入

后端在最后一条用户消息前注入：
- Register long + short（未过期）
- 跨窗 3 条 private_log（mature=true, in_place=false）

Extension 无需处理，后端自动完成。但 CLI conv 落库用的是注入前的纯用户消息。

### CLI Conversation 落库

仅当 superior 在此次会话中写了 `write_private_log` 时：
- 用户消息：纯用户原文（注入前），存为 `role="user"`
- AI 消息：superior 的完整回复正文，存为 `role="assistant"`
- 存入 WezTerm Bridge CLI Conversation（非 ext 的 chat conversation）

不影响 ext 的 session 结构。

### 并发门控（哨兵）

哨兵自动会话有全局并发锁（`_sentinel_in_progress`），同一时刻只允许一个哨兵在执行。并发请求会返回 `{"success": false, "error": "sentinel_busy"}`。

---

## Extension 侧存储清单

| 数据 | 来源 | 用途 |
|---|---|---|
| `messages[]` | Ext 自己维护 | 全量消息历史，每次请求全发 |
| `external_session_id` | Ext 生成 | Session 标识，匹配请求/响应 |
| `cached_up_to_index` | 后端响应 | 下次请求时后端据此判断 cache 匹配 |
| `compact_chunks` | 后端响应 | 压缩发生时更新 session 结构 |
| `compacted_up_to` | 后端响应 | 标记已压缩的消息范围 |

---

## 模式对照

| | `wez_bridge` | `wez_bridge_sentinel` |
|---|---|---|
| 触发方 | 用户发送消息 | 哨兵自动告警 |
| 回复处理 | 直接追加到 session | Ext 创建 user+assistant 两条消息 |
| 消息落库 | Ext 的 chat session | 不落 ext session；仅写日志时落 CLI conv |
| 并发门控 | 无 | 有（全局锁） |
| cache_rebuilt | 不返回 | 返回 |
| rounds 信息 | 不返回 | 返回 |
