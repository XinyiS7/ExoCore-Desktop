# Abort 请求后端不中断 — 修复方案

**日期**: 2026-07-06
**来源**: CC 骆白萧 (ExoCore 后端侧) → 等待前端侧 Claude 接手

---

## 问题：前端点 Stop 后，后端 LLM 请求没有中断

### 根因（4 个独立问题）

| # | 位置 | 问题 | 严重度 |
|---|------|------|--------|
| 1 | **前端** `ChatArea.jsx:603-608` | `handleStop()` 只调 `abortController.abort()`，不调用 `POST /api/agents/chat/<id>/stop/` | 🔴 核心 |
| 2 | **前端** `usePollingChat.js:139-141` | `abortPolling()` 只停轮询，不调 `/stop/`；后端 async 线程继续跑到 LLM 完成 | 🔴 核心 |
| 3 | **后端** `views.py:170` | SSE 模式 `stop_event=None`，`_is_stopped()` 永远返回 `False` | 🟡 配合 |
| 4 | **后端** SSE 路径 | 依赖 `GeneratorExit`（TCP 断连），延迟一个 chunk 周期才传播到 LLM 连接 | 🟡 配合 |

### 一句话总结

> 后端有完整的协作文 stop 机制（`stop_event` + `_is_stopped()` + `/stop/` 端点），但**前端从不调用它**，SSE 模式也没有接入它。

---

## 修复方案

### 前端改（主修，ExoCore-Desktop）

#### A. `ChatArea.jsx` — `handleStop()` 增加 `/stop/` 调用

当前（line 603-608）：
```js
const handleStop = () => {
  if (abortControllerRef.current) {
    abortControllerRef.current.abort();
    setIsGenerating(false);
  }
};
```

改为：
```js
const handleStop = () => {
  if (abortControllerRef.current) {
    abortControllerRef.current.abort();
    setIsGenerating(false);
  }
  // 通知后端停止 LLM 生成
  const asyncToken = localStorage.getItem(`exo_async_${activeSessionId}`);
  if (asyncToken) {
    try {
      const parsed = JSON.parse(asyncToken);
      fetch(
        `${baseUrl}/api/agents/chat/${activeSessionId}/stop/?message_id=${parsed.message_id}`,
        { method: 'POST', headers: { 'X-CSRFToken': getCsrfToken() }, credentials: 'include' }
      ).catch(() => {});
    } catch {}
  }
};
```

**要点**：
- 对 async 模式：`localStorage` 存了 `exo_async_{sessionId}` → `{message_id, timestamp}`，从那里拿 `message_id`
- 对 SSE 模式：没有 `message_id`。需要后端提供一个**无需 message_id 的 stop 端点**（见后端改 B）

#### B. `usePollingChat.js` — `abortPolling()` 增加 `/stop/` 调用

当前（line 139-141）：
```js
const abortPolling = useCallback(() => {
  isPollingRef.current = false;
  if (pollingTimerRef.current) clearTimeout(pollingTimerRef.current);
}, []);
```

需要改为接受 `messageId` + `sessionId` 参数，在停止轮询前先发 `/stop/`：
```js
const abortPolling = useCallback((messageId, sessionId) => {
  isPollingRef.current = false;
  if (pollingTimerRef.current) clearTimeout(pollingTimerRef.current);
  // 通知后端停止 LLM 生成
  if (messageId && sessionId) {
    fetch(
      `${baseUrl}/api/agents/chat/${sessionId}/stop/?message_id=${messageId}`,
      { method: 'POST', headers: { 'X-CSRFToken': getCsrfToken() }, credentials: 'include' }
    ).catch(() => {});
  }
}, []);
```

调用方 `ChatArea.jsx` 需要传入 `messageId` 和 `sessionId`。

#### C. SSE 模式 — fetch abort 时同步调 `/stop/`

在 SSE 模式的 catch 块（line 815-825）或 `handleStop` 中，需要调用后端 stop。SSE 模式没有 `message_id`，所以需要后端支持**按 session_id 停止**（见后端改 B）。

---

### 后端改（配合，ExoCore/）

#### A. SSE 模式接入 `stop_event`

`views.py:170`：
```python
# 当前
stop_event = threading.Event() if mode == 'async' else None
# 改为
stop_event = threading.Event()  # SSE 和 async 都创建
```

并将 SSE 模式的 `stop_event` 注册到一个 session 级别的 registry，让 `/stop/` 端点能找到它。

#### B. `/stop/` 端点支持按 session_id 停止（不需要 message_id）

当前 `ChatStreamStopView` 强制要求 `message_id`。需要增加 fallback：当没有 `message_id` 时，按 `session_id` 查找并设置对应 SSE 模式的 `stop_event`。

这需要在后端维护一个 `session_id → stop_event` 的映射（类似 `StreamingBufferManager` 的模式，但用于 SSE）。

---

## 协调说明（两个 Claude 实例）

### 前端侧 Claude（ExoCore-Desktop）
- 主要修改：`ChatArea.jsx` + `usePollingChat.js`
- 依赖后端提供的 API：`POST /api/agents/chat/<session_id>/stop/?message_id=<token>`（已存在）
- 新需求：SSE 模式也需要 `/stop/` 端点能按 `session_id` 停止

### 后端侧 Claude（ExoCore/）
- 主要修改：`views.py`（SSE stop_event + session 级注册表）
- 等前端改完后，确保 `/stop/` 端点同时支持：
  - `?message_id=<token>` — async 模式（已有）
  - 无参数（按 `session_id`）— SSE 模式（新增）

### 通讯方式

如果两边需要协调：
```bash
# 后端 → 前端（在 ExoCore/ 下执行）
wezterm cli send-text --pane-id <frontend-pane> "消息内容"

# 前端 → 后端（在 ExoCore-Desktop/ 下执行）
wezterm cli send-text --pane-id <backend-pane> "消息内容"
```

---

## 不变部分
- LLM 流式接口 `LLMGateway.stream_chat()` 不变
- `_is_stopped()` 检查逻辑不变
- `StreamingBufferManager` 不变
- nginx 配置不变
- API 响应格式不变
