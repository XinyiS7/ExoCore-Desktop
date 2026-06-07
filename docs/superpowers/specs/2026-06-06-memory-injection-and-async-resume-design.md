# Spec: memory_injection_enabled UI + Async 模式断点续传

**Date:** 2026-06-06
**Status:** draft

---

## 概述

两个独立的前端改动，后端零变动：

1. **`memory_injection_enabled` 前端开关** — ControlsDrawer 中新增 toggle，
   localStorage 持久化，随消息发送。
2. **Async 模式断点续传** — 退出会话再进入时，前端自动检测并恢复 async 轮询。

---

## 一、`memory_injection_enabled` 前端开关

### 背景

- 后端 `Conversation` 模型已有 `memory_injection_enabled` 字段（BooleanField, null=True）
- `ConversationSerializer`（agents/serializers.py）已包含此字段
- POST `/api/agents/chat/<session_id>/` 的 request body 已支持 `memory_injection_enabled`
- 前端目前未使用此字段

### 需求

在 ControlsDrawer 中增加一个 toggle 开关，行为与 `key_alias` 完全一致：
- localStorage 持久化，随 session 长期保留
- 页面刷新后恢复
- 用户手动切换
- 每次发送消息时作为请求参数传给后端

### 数据流

```
ControlsDrawer toggle
  ↕ localStorage key: exo_mem_inject_${sessionId}   (值: "true" | "false")
  ↓ 发送消息时
ChatArea.handleSend → bodyData.memory_injection_enabled
```

### 涉及文件

| 文件 | 改动 |
|---|---|
| `packages/chat-core/src/components/chat/ControlsDrawer.jsx` | 新增 toggle UI |
| `packages/chat-core/src/components/chat/ChatArea.jsx` | 发送消息时携带字段 |

### 改动详情

#### ControlsDrawer.jsx

在 key_alias 选择器下方新增一个 toggle（switch 或 checkbox）：

```jsx
{/* Memory Injection Toggle */}
<div className="exo-control-row">
  <label className="exo-control-label">Memory Injection</label>
  <div className="exo-control-toggle" onClick={toggleMemInject}>
    <input type="checkbox" checked={memInjectEnabled} readOnly />
    <span className="exo-toggle-track">
      <span className="exo-toggle-thumb" />
    </span>
  </div>
</div>
```

- 需要新增 prop: `memInjectEnabled`, `onMemInjectChange`
- 或直接在 ControlsDrawer 内部管理状态（读/写 localStorage）

推荐方案：ControlsDrawer 内部管理，类似 chatMode 的做法：
```js
const [memInjectEnabled, setMemInjectEnabled] = useState(() => {
  return localStorage.getItem(`exo_mem_inject_${sessionId}`) !== 'false';
});
```

切换时：
```js
const toggleMemInject = () => {
  const next = !memInjectEnabled;
  setMemInjectEnabled(next);
  localStorage.setItem(`exo_mem_inject_${sessionId}`, String(next));
};
```

#### ChatArea.jsx

在 `handleSend` 函数中，构建 `bodyData` 时新增：

```js
const bodyData = {
  content,
  thinking_level: thinkingLevel,
  temperature,
  model: currentModel !== defaultModel ? currentModel : null,
  api_key_alias: localStorage.getItem(`exo_session_key_${activeSessionId}`) || null,
  memory_injection_enabled: localStorage.getItem(`exo_mem_inject_${activeSessionId}`) !== 'false',
  files: uploadedFiles.length > 0 ? uploadedFiles.map(f => f.id) : [],
  pending_attachments: pendingAttachmentIds.length > 0 ? pendingAttachmentIds : [],
};
```

SSE 和 Async 两路共用同一 `bodyData`，无需分别修改。

---

## 二、Async 模式断点续传

### 背景

- Async 模式：POST `?mode=async` 立即返回 `{message_id, status:"processing"}`
- 后端 `StreamingBufferManager` 纯内存存储，不持久化
- 前端 `usePollingChat.js` 通过 `sendMessageAsync` 发起轮询
- **当前问题：** 用户退出会话再进入，前端不再轮询，进度丢失
- 后端仍在处理，但前端不知道 `message_id`，无法恢复轮询

### 需求

用户开启 Async 模式发消息后，若退出会话（切换到其他会话或关闭页面）再回来，
前端自动恢复轮询，继续展示后端已产生的增量内容。

### 数据流

```
发送 async 消息
  → localStorage: exo_async_${sessionId} = JSON.stringify({ message_id, timestamp })
  → usePollingChat 轮询中...

用户退出会话 → 轮询被 useEffect cleanup 或 AbortController 中止

用户重新进入会话
  → useEffect 检查 localStorage: exo_async_${sessionId}
  → 有记录 → GET /status/?message_id=<id>&cursor=0
      ├── status: "streaming" → 恢复轮询，以当前最新 cursor 继续
      ├── status: "done"      → 拉取完整消息列表，清除 localStorage
      ├── status: "error"     → 显示错误消息，清除 localStorage
      └── status: "not_found" → 任务已过期（>5min TTL），清除 localStorage
```

### 涉及文件

| 文件 | 改动 |
|---|---|
| `packages/chat-core/src/components/chat/ChatArea.jsx` | 写入 localStorage + 加载时检测恢复 |
| `packages/chat-core/src/hooks/usePollingChat.js` | 新增 `resumePolling` 或修改 `sendMessageAsync` 支持恢复模式 |

### 改动详情

#### 1. 写入 localStorage（ChatArea.jsx handleSend）

async 分支，在 `sendMessageAsync` 成功拿到 `message_id` 后：

```js
// 在 onDelta 回调中（或 sendMessageAsync 返回后）:
// 注意：sendMessageAsync 本身不返回 message_id，需要扩展
// 更简单的方案：在调用 sendMessageAsync 之前，我们就知道 message_id 会在 response 中
// 实际上 sendMessageAsync 内部 fetch 拿到 {message_id} 后会开始轮询
// 我们可以在 sendMessageAsync 内部写入 localStorage
```

**更好的实现位置：** 在 `usePollingChat.js` 的 `sendMessageAsync` 函数中，
拿到 `{message_id}` 后立即写入 localStorage：

```js
// usePollingChat.js sendMessageAsync 中，POST 响应后:
const data = await postResponse.json();
const messageId = data.message_id;
// 新增: 持久化活跃 async 任务
localStorage.setItem(`exo_async_${sessionId}`, JSON.stringify({
  message_id: messageId,
  timestamp: Date.now(),
}));
```

#### 2. 检测并恢复（ChatArea.jsx 会话加载 useEffect）

在 `activeSessionId` 变化的 useEffect 中，加载消息之前先检查是否有活跃 async 任务：

```js
useEffect(() => {
  if (!activeSessionId) return;

  // [新增] 检查是否有活跃 async 任务
  const stored = localStorage.getItem(`exo_async_${activeSessionId}`);
  if (stored) {
    try {
      const { message_id, timestamp } = JSON.parse(stored);
      // 调用 status 端点查询当前状态
      fetch(`${baseUrl}/api/agents/chat/${activeSessionId}/status/?message_id=${message_id}&cursor=0`)
        .then(res => res.json())
        .then(data => {
          if (data.status === 'done') {
            // 已完成，正常加载消息
            localStorage.removeItem(`exo_async_${activeSessionId}`);
            loadConversationMessages();
          } else if (data.status === 'error') {
            // 出错，显示错误并清除
            localStorage.removeItem(`exo_async_${activeSessionId}`);
            loadConversationMessages();
            setErrorState(data.error_message);
          } else if (data.status === 'streaming') {
            // 还在处理中，恢复轮询
            resumePolling(message_id, data.cursor, data.events);
          } else {
            // not_found — 过期了
            localStorage.removeItem(`exo_async_${activeSessionId}`);
            loadConversationMessages();
          }
        })
        .catch(() => {
          // 网络错误，降级：清除记录，正常加载
          localStorage.removeItem(`exo_async_${activeSessionId}`);
          loadConversationMessages();
        });
      return; // 先查询，不加载消息
    } catch (e) {
      localStorage.removeItem(`exo_async_${activeSessionId}`);
    }
  }

  // 原有：正常加载消息
  loadConversationMessages();
}, [activeSessionId]);
```

#### 3. 轮询恢复（usePollingChat.js）

新增 `resumePolling` 函数，与 `sendMessageAsync` 类似但不发送 POST：

```js
const resumePolling = useCallback((messageId, initialCursor, initialEvents, onDelta, onDone, onError, signal) => {
  // 1. 先回放 initialEvents（已有的增量事件）
  if (initialEvents && initialEvents.length > 0) {
    initialEvents.forEach(ev => onDelta(ev.delta, ev.event_type));
  }

  // 2. 设置当前 cursor
  let currentCursor = initialCursor || 0;

  // 3. 开始定时轮询（与 sendMessageAsync 中相同的轮询逻辑）
  intervalRef.current = setInterval(async () => {
    if (signal?.aborted) { cleanup(); return; }

    try {
      const pollUrl = `${baseUrl}/api/agents/chat/${sessionId}/status/?message_id=${messageId}&cursor=${currentCursor}`;
      const pollRes = await fetch(pollUrl, { signal, credentials: 'include' });
      const pollData = await pollRes.json();

      // 处理 events（与现有逻辑相同）
      // ...

      if (pollData.status === 'done') {
        cleanup();
        localStorage.removeItem(`exo_async_${sessionId}`);
        onDone();
      } else if (pollData.status === 'error') {
        cleanup();
        localStorage.removeItem(`exo_async_${sessionId}`);
        onError(pollData.error_message);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        cleanup();
        localStorage.removeItem(`exo_async_${sessionId}`);
      }
    }
  }, 500);
}, [sessionId]);
```

#### 4. 清理时机

以下情况清除 `localStorage` 中的 key：
- 轮询 `status === 'done'`
- 轮询 `status === 'error'`
- 用户手动中止（abort）
- 检测到 `status === 'not_found'`（后台 TTL 过期）
- 发生网络错误

### 边界情况

| 场景 | 行为 |
|---|---|
| 后端进程重启（buffer 丢失） | GET /status 返回 not_found → 清除 localStorage，正常加载消息 |
| localStorage 中有过期记录（>5min） | GET /status 返回 not_found → 清除 |
| 用户在新标签页打开同会话 | 新标签页也会检测到 localStorage 记录，恢复轮询（可能有竞态，但无害） |
| 初始 events 回放与已有消息冲突 | 因为 cursor=0 从第一条事件开始拿，需要判断消息列表最后一条是否是未完成的 assistant 消息 |
| abort 后立即重新进入 | localStorage 已被清除，正常加载消息 |

---

## 三、不变部分

- 后端代码零改动
- `key_alias` 的 localStorage 持久化模式不变
- `thinking_level` / `temperature` 的 PATCH Conversation 持久化模式不变
- `chatMode`（SSE/Async）的 localStorage 持久化模式不变
- `usePollingChat.js` 的原有 `sendMessageAsync` 函数签名和行为不变（仅内部增加 localStorage 写入）
- SSE 模式完全不受影响

---

## 四、验证方式

### memory_injection_enabled

1. 打开 ControlsDrawer → 确认 "Memory Injection" toggle 可见
2. 切换 toggle → 刷新页面 → toggle 保持切换后的状态
3. 切换 toggle → 发送消息 → Network tab 确认 request body 中 `memory_injection_enabled` 为正确的 boolean 值
4. 切换到另一个会话 → toggle 恢复到该会话的存储值（或默认 true）

### Async 断点续传

1. 开启 Async 模式 → 发送消息 → 确认消息开始流式输出
2. 切换到另一个会话（不刷新页面）→ 切回来 → 确认轮询恢复，新内容继续追加
3. Async 模式发送消息后 → 刷新页面（F5）→ 确认轮询自动恢复
4. Async 模式发送消息后 → 等待完成后切回 → 确认正常显示完整消息（不再轮询）
5. Async 模式发送消息后 → 等待 >5 分钟 → 切回 → 确认降级为正常加载（not_found 处理）
