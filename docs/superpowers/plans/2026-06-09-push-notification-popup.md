# Push 通知弹窗改造 Implementation Plan（前端 only）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Push 通知增加 From: 发件人 + 跳转/关闭按钮，用户操作回传给后端。

**Architecture:** 纯前端改动。SW 按 payload 新字段排版通知 + 处理 actions；主线程 PushNavigateListener 按 action 调后端 ack 接口。

**Spec:** `ReactSheet_Reorganized.md` §9.3 ~ §9.4

---

## 后端约定（不动，仅供参考）

后端 push payload §9.3：
```json
{
  "title": "编译完成",
  "body": "前端构建已成功完成。",
  "data": {
    "url": "/chat/agent/6",
    "sender_type": "agent",
    "sender_name": "G045",
    "preset_id": 6,
    "register_id": 42
  },
  "actions": [
    {"action": "navigate", "title": "跳转"},
    {"action": "dismiss", "title": "关闭"}
  ],
  "requireInteraction": true
}
```

后端 ack 端点 §9.4：
```
POST /api/agents/registers/<register_id>/ack/?preset_id=<preset_id>
Body: { "action": "navigate" | "dismiss" }
```

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `packages/chat-core/public/push-notification.js` | Modify | 排版 From: + actions + notificationclick 回传 action |
| `packages/chronicle/public/push-notification.js` | Modify | 同上（同步） |
| `packages/council/public/push-notification.js` | Modify | 同上（同步） |
| `packages/chat-core/src/main.jsx` | Modify | PushNavigateListener 按 action 分流 + POST ack |
| `ReactSheet_Reorganized.md` | Modify | §9.3 补全 SW 排版说明，§9.4 更新 |

---

### Task 1: SW `push` 事件 — 排版 + actions

**Files:**
- Modify: `packages/chat-core/public/push-notification.js:31-70`
- Modify: `packages/chronicle/public/push-notification.js:31-70`（同步）
- Modify: `packages/council/public/push-notification.js:31-70`（同步）

- [ ] **Step 1: 替换 push 事件的 showNotification 组装**

三个文件相同改动。`chat-core/public/push-notification.js` L31-70 替换为：

```js
  try {
    const payload = event.data.json();
    const {
      title: backendTitle,
      body,
      icon = '/icon-192x192.png',
      badge = '/icon-192x192.png',
      image,
      tag,
      data = {},
      actions = [],
      vibrate = [200, 100, 200, 100, 200],
      requireInteraction = true,
      silent = false,
      dir = 'auto',
      lang = 'zh-CN',
      renotify = true,
      timestamp = Date.now(),
    } = payload;

    // ── 排版：title = "From: {sender_name}" ──
    const senderName = data.sender_name || 'ExoCore';
    const title = `From: ${senderName}`;

    // ── 正文：后端标题 + 内容 ──
    const lines = [backendTitle];
    if (body) lines.push(body);
    const notificationBody = lines.join('\n');

    const options = {
      body: notificationBody,
      icon,
      badge,
      image,
      tag,
      data: {
        url: data.url || '/',
        registerId: data.register_id || null,
        presetId: data.preset_id || null,
      },
      actions: [
        { action: 'navigate', title: '跳转' },
        { action: 'dismiss', title: '关闭' },
      ],
      vibrate,
      requireInteraction,
      silent,
      dir,
      lang,
      renotify,
      timestamp,
    };

    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  } catch (e) {
    // fallback 不变
    console.warn('[ExoPush] Failed to parse push payload as JSON, treating as text:', e);
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification('ExoCore', {
        body: text,
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png',
        tag: 'exo-fallback',
      })
    );
  }
```

- [ ] **Step 2: 同步到 chronicle + council**

两个文件的 push 事件处理器与 chat-core 完全相同，复制替换。

- [ ] **Step 3: Commit**

```bash
git add ExoCore-Desktop/packages/chat-core/public/push-notification.js
git add ExoCore-Desktop/packages/chronicle/public/push-notification.js
git add ExoCore-Desktop/packages/council/public/push-notification.js
git commit -m "feat(sw): From sender + actions buttons in push notification"
```

---

### Task 2: SW `notificationclick` — action 回传

**Files:**
- Modify: `packages/chat-core/public/push-notification.js:86-119`
- Modify: `packages/chronicle/public/push-notification.js:86-119`（同步）
- Modify: `packages/council/public/push-notification.js:86-119`（同步）

- [ ] **Step 1: 替换 notificationclick 处理器**

将 `chat-core/public/push-notification.js` L86-119 替换为：

```js
self.addEventListener('notificationclick', (event) => {
  const clickAction = event.action;  // 'navigate' | 'dismiss' | '' (点主体)
  const action = clickAction === 'dismiss' ? 'dismiss' : 'navigate';
  const notificationData = event.notification.data;
  const urlToOpen = notificationData?.url || '/';

  event.waitUntil(
    (async () => {
      const clientList = await clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      // 1. Try to find and focus an existing window
      let focused = null;
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({
            type: 'PUSH_NAVIGATE',
            url: action === 'navigate' ? urlToOpen : null,
            action,
            registerId: notificationData?.registerId || null,
            presetId: notificationData?.presetId || null,
          });
          focused = await client.focus();
          break;
        }
      }

      // 2. navigate → no existing window → open new one
      //    dismiss → never open new window
      if (!focused && action === 'navigate' && clients.openWindow) {
        await clients.openWindow(urlToOpen);
      }

      // 3. Close notification
      event.notification.close();
    })()
  );
});
```

- [ ] **Step 2: 同步到 chronicle + council**

两个文件的 notificationclick 处理器与 chat-core 完全相同，复制替换。

- [ ] **Step 3: Commit**

```bash
git add ExoCore-Desktop/packages/chat-core/public/push-notification.js
git add ExoCore-Desktop/packages/chronicle/public/push-notification.js
git add ExoCore-Desktop/packages/council/public/push-notification.js
git commit -m "feat(sw): notificationclick returns action (navigate/dismiss) to main thread"
```

---

### Task 3: 主线程 PushNavigateListener — action 分流 + POST ack

**Files:**
- Modify: `packages/chat-core/src/main.jsx:29-68`

- [ ] **Step 1: 替换 PushNavigateListener**

将 `main.jsx` L29-68 替换为：

```jsx
function PushNavigateListener() {
  const navigate = useNavigate();

  React.useEffect(() => {
    async function handleMessage(event) {
      if (event.data?.type !== 'PUSH_NAVIGATE') return;

      const { url, action, registerId, presetId } = event.data;

      // dismiss → 只回执，不跳转
      if (action === 'dismiss') {
        if (registerId) {
          try {
            await apiFetch(
              `/api/agents/registers/${registerId}/ack/`,
              {
                method: 'POST',
                body: { action: 'dismiss' },
                params: presetId ? { preset_id: presetId } : {},
              },
            );
          } catch (_) {
            // Silent
          }
        }
        return;
      }

      // navigate → 跳转 + 回执
      if (action === 'navigate' && url) {
        const path = url.startsWith(BASENAME)
          ? url.slice(BASENAME.length) || '/'
          : url;
        navigate(path);

        if (registerId) {
          try {
            const match = path.match(/\/agent\/(\d+)/);
            const pid = match ? match[1] : presetId;
            await apiFetch(
              `/api/agents/registers/${registerId}/ack/`,
              {
                method: 'POST',
                body: { action: 'navigate' },
                params: pid ? { preset_id: pid } : {},
              },
            );
          } catch (_) {
            // Silent
          }
        }
      }
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleMessage);
      return () => {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
      };
    }
  }, [navigate]);

  return null;
}
```

- [ ] **Step 2: Commit**

```bash
git add ExoCore-Desktop/packages/chat-core/src/main.jsx
git commit -m "feat(push): navigate/dismiss routing + POST ack to backend"
```

---

### Task 4: 更新 ReactSheet_Reorganized.md

**Files:**
- Modify: `ReactSheet_Reorganized.md:1273-1305`

- [ ] **Step 1: 替换 §9.3 ~ §9.4**

将 L1273-1305 替换为：

```markdown
9.3  Push 消息 Payload（后端 → 浏览器）
─────────────────────────────────────────────────────────────
由 PushService.send_to_all() 生成，经 Web Push 送达 Service Worker。

{
  "title": "编译完成",
  "body": "前端构建已成功完成。",
  "data": {
    "url": "/chat/agent/6",              // 点击「跳转」导航目标
    "sender_type": "agent",              // "agent" | "system"
    "sender_name": "G045",               // AgentPreset.name 或 "ExoCore"
    "preset_id": 6,                      // null 当 sender_type="system"
    "register_id": 42,                   // 可选，关联的短期 Register 条目 ID
  },
  "actions": [
    {"action": "navigate", "title": "跳转"},
    {"action": "dismiss", "title": "关闭"}
  ],
  "requireInteraction": true             // false = low urgency 时自动关闭
}
// 多条推送始终堆叠，不替换。

// Service Worker 收到后调用 showNotification()：
//   title 拼为 "From: {sender_name}"
//   body 拼为 "{title}\n{body}"

// 点击行为：
//   通知主体 / 「跳转」按钮 → action = "navigate"
//   「关闭」按钮 → action = "dismiss"

// notificationclick → postMessage({
//   type: 'PUSH_NAVIGATE',
//   url,            // dismiss 时为 null
//   action,         // "navigate" | "dismiss"
//   registerId,
//   presetId,
// })
// 前端 PushNavigateListener → navigate 时跳转 + POST ack，dismiss 时仅 POST ack


9.4  POST /api/agents/registers/<pk>/ack/  — 通知查看回执
─────────────────────────────────────────────────────────────
用途：用户操作通知后回调，无论跳转还是关闭都通知后端。

// Request:
// POST /api/agents/registers/42/ack/?preset_id=6
{ "action": "navigate" }     // "navigate" | "dismiss"

// action 含义:
//   navigate = 用户点击了「跳转」按钮或通知主体（已跳转查看）
//   dismiss  = 用户点击了「关闭」按钮（明确忽略）

// Response (200):
{ "id": 42, "content": "[推送通知] 编译完成: 前端构建已成功。 → 用户已查看" }

// 404: { "error": "Register id=42 not found for preset 6" }
// 400: { "error": "preset_id query param is required" }
```

- [ ] **Step 2: Commit**

```bash
git add ExoCore-Desktop/ReactSheet_Reorganized.md
git commit -m "docs: update §9.3-§9.4 — actions, ack endpoint"
```

---

## Action 映射总结

| 用户操作 | SW `event.action` | postMessage `action` | 前端行为 |
|---------|-------------------|---------------------|---------|
| 点「跳转」按钮 | `"navigate"` | `"navigate"` | navigate(url) + POST ack `{action:"navigate"}` |
| 点通知主体 | `""` | `"navigate"` | navigate(url) + POST ack `{action:"navigate"}` |
| 点「关闭」按钮 | `"dismiss"` | `"dismiss"` | 仅 POST ack `{action:"dismiss"}` |
