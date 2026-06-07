# memory_injection_enabled + Async 断点续传 施工计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 ControlsDrawer 中新增 memory_injection_enabled toggle（localStorage 持久化），并实现 Async 模式退出后重新进入自动恢复轮询。

**Architecture:** 纯前端改动，后端零变更。memory_injection_enabled 遵循 key_alias 的 localStorage 模式；Async 断点续传通过 localStorage 记录活跃 message_id，重进会话时查询 /status/ 端点恢复。

**Tech Stack:** React 18, vanilla fetch, localStorage

**Spec:** `docs/superpowers/specs/2026-06-06-memory-injection-and-async-resume-design.md`

**涉及文件（4个）：**
- `packages/chat-core/src/components/chat/ControlsDrawer.jsx` — 新增 toggle UI
- `packages/chat-core/src/components/chat/ChatArea.jsx` — 发送携带字段 + 加载时检测恢复
- `packages/chat-core/src/hooks/usePollingChat.js` — 写入/清除 localStorage + 新增 resumePolling

---

### Task 1: ControlsDrawer — memory_injection_enabled toggle

**Files:**
- Modify: `packages/chat-core/src/components/chat/ControlsDrawer.jsx`

在 key_alias 选择器行（Row 2）下方新增一行 toggle 开关。

- [ ] **Step 1: 新增 memInjectEnabled state（紧跟 selectedAlias 声明之后）**

在 `const [selectedAlias, setSelectedAlias] = useState('');`（第 26 行）后添加：

```jsx
const [memInjectEnabled, setMemInjectEnabled] = useState(() =>
  localStorage.getItem(`exo_mem_inject_${sessionId}`) !== 'false'
);
```

- [ ] **Step 2: 在 key_alias 行（Row 2）和 Color Scheme 行（Row 3）之间插入 toggle UI**

在第 273 行（`</div>` 关闭 Row 2 的 div）和第 275 行（`{/* Row 3: Color Scheme */}`）之间插入：

```jsx
      {/* Row 2.5: Memory Injection Toggle */}
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-mono uppercase tracking-wider text-exo-muted/40 flex-shrink-0">
          Mem Inject
        </span>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={memInjectEnabled}
            onChange={() => {
              const next = !memInjectEnabled;
              setMemInjectEnabled(next);
              localStorage.setItem(`exo_mem_inject_${sessionId}`, String(next));
            }}
            className="sr-only"
          />
          <span
            className={`w-7 h-4 rounded-full transition-colors flex items-center px-[2px] ${
              memInjectEnabled ? 'bg-exo-accent/60' : 'bg-exo-mist-10'
            }`}
          >
            <span
              className={`w-3 h-3 rounded-full bg-white transition-transform ${
                memInjectEnabled ? 'translate-x-3' : 'translate-x-0'
              }`}
            />
          </span>
          <span className="text-[10px] font-sans text-exo-muted/40">
            {memInjectEnabled ? 'On' : 'Off'}
          </span>
        </label>
      </div>
```

- [ ] **Step 3: 验证 — 视觉检查**

启动 dev server，打开 ControlsDrawer，确认：
- "Mem Inject" toggle 出现在 Key Alias 和 Palette 之间
- 默认显示为 On（绿色轨道 + 滑块右侧）
- 点击切换可切换 On/Off 状态
- 刷新页面后状态保持

Run: `pnpm dev:chat`，在浏览器中打开 `http://localhost:5173`。

---

### Task 2: ChatArea — 发送消息时携带 memory_injection_enabled

**Files:**
- Modify: `packages/chat-core/src/components/chat/ChatArea.jsx`

- [ ] **Step 1: 在 bodyData 中新增 memory_injection_enabled 字段**

找到 `handleSend` 中 `bodyData` 的构建（约第 401-417 行）。在 `api_key_alias` 之后、`pending_attachments` 之前添加：

```js
...(activeSessionId && { memory_injection_enabled: localStorage.getItem(`exo_mem_inject_${activeSessionId}`) !== 'false' }),
```

完整改动位置 — 在 `api_key_alias` 的三元展开（第 406-408 行）之后插入新行，使 bodyData 变为：

```js
const bodyData = {
  content: currentInput,
  model: currentModel,
  thinking_level: thinkingLevel,
  temperature: temperature,
  ...(activeSessionId && localStorage.getItem(`exo_session_key_${activeSessionId}`)
    ? { api_key_alias: localStorage.getItem(`exo_session_key_${activeSessionId}`) }
    : {}),
  ...(activeSessionId && { memory_injection_enabled: localStorage.getItem(`exo_mem_inject_${activeSessionId}`) !== 'false' }),
  ...(currentPending.length > 0 || composeAttachments.some(e => e.attachmentId != null)
    ? { pending_attachments: [
        ...currentPending.map(a => typeof a === 'object' ? a.id : a),
        ...composeAttachments.filter(e => e.attachmentId != null).map(e => e.attachmentId),
      ]}
    : {}),
  ...(editMessageId && { edit_message_id: editMessageId }),
  ...(regenerateMessageId && { regenerate_message_id: regenerateMessageId }),
};
```

> **注意：** 当 `activeSessionId` 为 null 时，`memory_injection_enabled` 不会被包含在 body 中（后端使用默认值 true）。与 api_key_alias 行为一致。

- [ ] **Step 2: 验证 — Network 检查**

1. 打开 ControlsDrawer → 切换 Mem Inject 为 Off
2. 发送一条消息
3. 在 DevTools Network tab 中找到 POST `/api/agents/chat/<id>/`
4. 确认 Request Payload 中包含 `"memory_injection_enabled": false`
5. 切换 Mem Inject 为 On，再发一条消息，确认 Request Payload 中为 `"memory_injection_enabled": true`
6. SSE 和 Async 两种模式分别测试

---

### Task 3: usePollingChat — 写入 localStorage + 新增 resumePolling

**Files:**
- Modify: `packages/chat-core/src/hooks/usePollingChat.js`

- [ ] **Step 1: 在 sendMessageAsync 中，拿到 message_id 后写入 localStorage**

在第 46 行 `messageId = data.message_id;` 之后、第 48 行 `if (!messageId) throw ...` 之前插入：

```js
// 持久化活跃 async 任务，供断点续传使用
localStorage.setItem(`exo_async_${sessionId}`, JSON.stringify({
  message_id: messageId,
  timestamp: Date.now(),
}));
```

- [ ] **Step 2: 在 done/error 分支中清除 localStorage**

找到第 79-88 行的 `if (pollData.status === 'done' || pollData.status === 'error')` 分支。在 `cleanup()` 调用之前的行首插入 `localStorage.removeItem(...)`：

```js
if (pollData.status === 'done' || pollData.status === 'error') {
  localStorage.removeItem(`exo_async_${sessionId}`);
  cleanup();
  if (signal) signal.removeEventListener('abort', onAbort);
  
  if (pollData.status === 'error') {
     reject(new Error(pollData.error_message || 'Server error'));
  } else {
     resolve();
  }
  return;
}
```

- [ ] **Step 3: 在 catch/abort 分支中也清除 localStorage**

在 `sendMessageAsync` 的 `onAbort` 回调（第 19-22 行）中，`cleanup()` 之前添加清除：

```js
const onAbort = () => {
  localStorage.removeItem(`exo_async_${sessionId}`);
  cleanup();
  reject(new DOMException('Aborted', 'AbortError'));
};
```

在 catch 分支（第 94-99 行、第 103-107 行）中，每次 `cleanup()` 之前添加清除。把两处 catch 改为：

```js
// 第 94-99 行（poll 内部 catch）:
} catch (err) {
   if (err.name === 'AbortError') return;
   localStorage.removeItem(`exo_async_${sessionId}`);
   cleanup();
   if (signal) signal.removeEventListener('abort', onAbort);
   reject(err);
}

// 第 103-107 行（最外层 catch）:
} catch (err) {
  localStorage.removeItem(`exo_async_${sessionId}`);
  cleanup();
  if (signal) signal.removeEventListener('abort', onAbort);
  reject(err);
}
```

- [ ] **Step 4: 新增 resumePolling 函数**

在 `sendMessageAsync` 的 `useCallback` 之后、`abortPolling` 之前插入：

```js
const resumePolling = useCallback((messageId, sessionId, signal, onDelta) => {
  return new Promise((resolve, reject) => {
    isPollingRef.current = true;
    let currentCursor = 0;

    const cleanup = () => {
      isPollingRef.current = false;
      if (pollingTimerRef.current) clearTimeout(pollingTimerRef.current);
    };

    const onAbort = () => {
      localStorage.removeItem(`exo_async_${sessionId}`);
      cleanup();
      reject(new DOMException('Aborted', 'AbortError'));
    };
    if (signal) {
      signal.addEventListener('abort', onAbort);
    }

    const poll = async () => {
      if (!isPollingRef.current) return;
      try {
        const pollRes = await fetch(
          `${baseUrl}/api/agents/chat/${sessionId}/status/?message_id=${messageId}&cursor=${currentCursor}`,
          { headers: { 'X-CSRFToken': getCsrfToken() }, credentials: 'include', signal }
        );

        if (!pollRes.ok) throw new Error(`HTTP ${pollRes.status}`);
        const pollData = await pollRes.json();

        const events = pollData.events || (pollData.delta ? [{ delta: pollData.delta, event_type: pollData.event_type || 'content' }] : []);

        if (events.length > 0) {
          events.forEach(ev => {
            const deltaStr = ev.delta || '';
            if (deltaStr) {
              onDelta(deltaStr, ev.event_type || 'content');
            }
          });
          currentCursor = pollData.cursor !== undefined ? pollData.cursor : currentCursor;
        }

        if (pollData.status === 'done' || pollData.status === 'error') {
          localStorage.removeItem(`exo_async_${sessionId}`);
          cleanup();
          if (signal) signal.removeEventListener('abort', onAbort);
          if (pollData.status === 'error') {
            reject(new Error(pollData.error_message || 'Server error'));
          } else {
            resolve();
          }
          return;
        }

        if (isPollingRef.current) {
          pollingTimerRef.current = setTimeout(poll, 500);
        }
      } catch (err) {
        if (err.name === 'AbortError') return;
        localStorage.removeItem(`exo_async_${sessionId}`);
        cleanup();
        if (signal) signal.removeEventListener('abort', onAbort);
        reject(err);
      }
    };

    pollingTimerRef.current = setTimeout(poll, 500);
  });
}, []);
```

- [ ] **Step 5: 更新 hook 的返回值，导出 resumePolling**

修改第 116 行 return 语句：

```js
return { sendMessageAsync, abortPolling, resumePolling };
```

- [ ] **Step 6: 验证 — 单元检查**

1. 重新阅读 `usePollingChat.js` 全文，确认 `sendMessageAsync` 和 `resumePolling` 函数结构一致
2. 确认所有 `localStorage.removeItem(`exo_async_${sessionId}`)` 调用都正确覆盖了所有退出路径（done / error / abort / catch / not_found）
3. 确认 return 导出包含 `resumePolling`

---

### Task 4: ChatArea — 加载会话时检测并恢复 async 轮询

**Files:**
- Modify: `packages/chat-core/src/components/chat/ChatArea.jsx`

- [ ] **Step 1: 从 usePollingChat 解构中引入 resumePolling**

第 49 行，将：

```js
const { sendMessageAsync } = usePollingChat();
```

改为：

```js
const { sendMessageAsync, resumePolling } = usePollingChat();
```

- [ ] **Step 2: 在会话加载 useEffect 中新增 async 恢复逻辑**

在现有的 `activeSessionId` 变化 useEffect（第 264-316 行）中，在状态重置行之后、消息加载之前，添加 async 任务检测。找到第 285 行（`const savedDraft = ...`）之后、第 286 行（`fetch(\`${baseUrl}/api/agents/conversations/\`...)`）之前，插入：

```js
// [Async resume] 检测是否有活跃 async 任务需要恢复
const stored = localStorage.getItem(`exo_async_${activeSessionId}`);
const pendingAsyncRef = { current: null };
if (stored) {
  try {
    pendingAsyncRef.current = JSON.parse(stored);
  } catch (e) {
    localStorage.removeItem(`exo_async_${activeSessionId}`);
  }
}
```

然后在消息加载的 `.then()` 回调末尾（第 308 行 `requestAnimationFrame(...)` 之后、第 309 行 `})` 之前），添加 async 恢复逻辑。将第 299-309 行的消息 fetch 改为：

```js
fetch(`${baseUrl}/api/agents/chat/${activeSessionId}/`, { credentials: 'include' })
  .then(res => res.json())
  .then(data => {
    const enriched = enrichMessages(data);
    allHistoryRef.current = enriched;
    const startIdx = Math.max(0, enriched.length - MSGS_PER_PAGE);
    visibleStartRef.current = startIdx;
    setMessages(enriched.slice(startIdx));
    setHasMore(startIdx > 0);
    requestAnimationFrame(() => scrollToBottom(false));

    // [Async resume] 消息加载完毕，检查是否需要恢复 async 轮询
    if (pendingAsyncRef.current) {
      const { message_id } = pendingAsyncRef.current;
      fetch(`${baseUrl}/api/agents/chat/${activeSessionId}/status/?message_id=${message_id}&cursor=0`, {
        headers: { 'X-CSRFToken': getCsrfToken() },
        credentials: 'include',
      })
        .then(res => res.json())
        .then(statusData => {
          if (statusData.status === 'done' || statusData.status === 'error' || statusData.status === 'not_found') {
            // 任务已结束或过期 — 清除记录，消息已由上方 fetch 完整加载
            localStorage.removeItem(`exo_async_${activeSessionId}`);
            if (statusData.status === 'not_found') {
              // 正常加载的消息已足够，无需额外操作
            }
            if (statusData.status === 'error') {
              // 在后端有 error 但消息列表中最后一个 assistant 消息可能没标出来
              // 给最后一条 assistant 消息打上 error 标记
              setMessages(prev => {
                const newMsgs = [...prev];
                const lastMsg = { ...newMsgs[newMsgs.length - 1] };
                if (lastMsg.role === 'assistant') {
                  lastMsg.error = statusData.error_message || 'Server error';
                  newMsgs[newMsgs.length - 1] = lastMsg;
                }
                return newMsgs;
              });
            }
            return;
          }

          // status === 'streaming' — 恢复轮询
          setIsGenerating(true);
          abortControllerRef.current = new AbortController();

          // 如果消息列表最后一条不是 assistant，推入一个占位 assistant 消息
          setMessages(prev => {
            const needsPlaceholder = prev.length === 0 || prev[prev.length - 1].role !== 'assistant';
            if (needsPlaceholder) {
              const placeholder = {
                id: Date.now(),
                role: 'assistant',
                content: '',
                reasoning_content: '',
                reasoning_steps: [],
                new_anchors: [],
              };
              allHistoryRef.current = [...allHistoryRef.current, placeholder];
              return [...prev, placeholder];
            }
            return prev;
          });

          // 回放已有 events
          const initialEvents = statusData.events || [];
          if (initialEvents.length > 0) {
            setMessages(prev => {
              const newMsgs = [...prev];
              const lastMsg = { ...newMsgs[newMsgs.length - 1] };
              initialEvents.forEach(ev => {
                const text = ev.delta || '';
                const type = ev.event_type || 'content';
                if (type === 'thinking') {
                  lastMsg.reasoning_content = (lastMsg.reasoning_content || '') + text;
                  lastMsg.status_text = null;
                } else if (type === 'reasoning') {
                  const steps = [...(lastMsg.reasoning_steps || [])];
                  if (steps.length === 0 || steps[steps.length - 1] !== text) steps.push(text);
                  lastMsg.reasoning_steps = steps;
                } else if (type === 'status') {
                  lastMsg.status_text = text;
                } else if (type === 'anchor_created') {
                  try {
                    const parsed = typeof text === 'string' ? JSON.parse(text) : text;
                    lastMsg.new_anchors = [...(lastMsg.new_anchors || []), parsed];
                  } catch(e) {}
                } else {
                  lastMsg.content = (lastMsg.content || '') + text;
                  lastMsg.status_text = null;
                }
              });
              newMsgs[newMsgs.length - 1] = lastMsg;
              allHistoryRef.current[allHistoryRef.current.length - 1] = lastMsg;
              return newMsgs;
            });
          }

          // 启动轮询
          resumePolling(
            message_id,
            activeSessionId,
            abortControllerRef.current.signal,
            (text, type) => {
              setMessages(prev => {
                const newMsgs = [...prev];
                const lastMsg = { ...newMsgs[newMsgs.length - 1] };
                if (type === 'thinking') {
                  lastMsg.reasoning_content = (lastMsg.reasoning_content || '') + text;
                  lastMsg.status_text = null;
                } else if (type === 'reasoning') {
                  const steps = [...(lastMsg.reasoning_steps || [])];
                  if (steps.length === 0 || steps[steps.length - 1] !== text) steps.push(text);
                  lastMsg.reasoning_steps = steps;
                } else if (type === 'status') {
                  lastMsg.status_text = text;
                } else if (type === 'anchor_created') {
                  try {
                    const parsed = typeof text === 'string' ? JSON.parse(text) : text;
                    lastMsg.new_anchors = [...(lastMsg.new_anchors || []), parsed];
                  } catch(e) {}
                } else {
                  lastMsg.content = (lastMsg.content || '') + text;
                  lastMsg.status_text = null;
                }
                newMsgs[newMsgs.length - 1] = lastMsg;
                allHistoryRef.current[allHistoryRef.current.length - 1] = lastMsg;
                return newMsgs;
              });
              if (isNearBottom()) scrollToBottom(false);
            }
          ).then(() => {
            // 轮询完成 → 拉取完整消息列表
            setIsGenerating(false);
            abortControllerRef.current = null;
            fetch(`${baseUrl}/api/agents/chat/${activeSessionId}/`, { credentials: 'include' })
              .then(res => res.json())
              .then(fullData => {
                if (!Array.isArray(fullData) || fullData.length === 0) return;
                const enrichedFull = enrichMessages(fullData);
                allHistoryRef.current = enrichedFull;
                const sIdx = Math.max(0, enrichedFull.length - MSGS_PER_PAGE);
                visibleStartRef.current = sIdx;
                setMessages(enrichedFull.slice(sIdx));
                requestAnimationFrame(() => scrollToBottom(false));
              })
              .catch(() => {});
          }).catch(err => {
            if (err.name === 'AbortError') return;
            setIsGenerating(false);
            abortControllerRef.current = null;
            console.error('Async resume failed:', err);
          });
        })
        .catch(() => {
          // 网络错误，降级：清除记录
          localStorage.removeItem(`exo_async_${activeSessionId}`);
        });
    }
  })
  .catch(err => console.error("获取失败:", err));
```

- [ ] **Step 3: 验证 — 功能测试**

启动 dev server 进行以下测试：

**测试 A — 基本恢复（exit & re-enter）：**
1. 切换 chatMode 为 Async
2. 发送一条消息，确认消息开始流式输出
3. 切换到另一个会话
4. 切回原会话 → 确认消息继续流式输出（轮询恢复）
5. 确认消息最终完整显示

**测试 B — 刷新恢复（F5）：**
1. Async 模式发送消息
2. 在流式输出过程中刷新页面（F5）
3. 确认页面加载后自动恢复轮询，已完成的内容回放显示
4. 新内容继续追加

**测试 C — 已完成任务：**
1. Async 模式发送消息，等待完成
2. 切换到另一个会话，再切回来
3. 确认正常显示完整消息，无多余轮询请求

**测试 D — 过期任务（>5min TTL）：**
1. Async 模式发送消息
2. 等待 >5 分钟（让后端 TTL 过期）
3. 刷新页面
4. 确认降级为正常消息加载（不卡在轮询）

---

### Task 5: 最终验证 & 提交

- [ ] **Step 1: 代码清理检查**

```bash
grep -rn "TODO\|FIXME\|console.log" packages/chat-core/src/components/chat/ControlsDrawer.jsx packages/chat-core/src/components/chat/ChatArea.jsx packages/chat-core/src/hooks/usePollingChat.js
```

确认没有遗留调试代码。

- [ ] **Step 2: 完整回归测试**

手动测试以下场景确认无回归：
1. SSE 模式发送消息 — 正常流式输出，不影响
2. Async 模式发送消息 — 正常轮询输出
3. 切换 chatMode（SSE ↔ Async）— 正常切换
4. ControlsDrawer 中 thinking_level / temperature / model 切换 — 正常 PATCH 持久化
5. key_alias 选择器 — 正常工作
6. Palette 颜色选择器 — 正常工作
7. Mem Inject toggle — 切换并持久化正常

- [ ] **Step 3: 提交**

```bash
git add packages/chat-core/src/components/chat/ControlsDrawer.jsx
git add packages/chat-core/src/components/chat/ChatArea.jsx
git add packages/chat-core/src/hooks/usePollingChat.js
git commit -m "feat(chat-core): add memory_injection_enabled toggle + async resume on re-entry

- ControlsDrawer: add Mem Inject toggle with localStorage persistence
- ChatArea: include memory_injection_enabled in send payload (SSE + Async)
- usePollingChat: record active async task to localStorage on send,
  clear on done/error/abort, add resumePolling for re-entry recovery
- ChatArea useEffect: detect active async task on session load,
  replay buffered events and resume polling if still streaming"
```
