# Push 通知点击导航修复

**日期**：2026-06-29
**需求**：桌面端点了跳转 URL 不变 + Android 端 focus() 失败导致 PWA 拉不起

---

## 最终效果

| 场景 | 改前 | 改后 |
|------|------|------|
| 桌面，已有窗口 | focus 拉起，URL 不变 | focus 拉起 + React navigate 到目标页 |
| 桌面，无窗口 | openWindow 开新窗口 | 不变 |
| Android，PWA 后台 | focus 静默失败，无反应 | isMobile → openWindow 拉起 PWA |
| Android，PWA 已杀 | openWindow 拉起 | 不变 |

---

## 施工顺序

### Step 1: SW 层 — 移动端分支 (`push-notification.js` ×3)

**文件**：
- `packages/chat-core/public/push-notification.js`
- `packages/chronicle/public/push-notification.js`
- `packages/council/public/push-notification.js`

**改动**：`notificationclick` 事件处理器（约 L109-177）

**改前**：
```javascript
if (matchedClient) {
    matchedClient.postMessage({...});
    if (action !== 'dismiss') {
        await matchedClient.focus();
    }
} else if (action === 'navigate' && clients.openWindow) {
    await clients.openWindow(urlToOpen);
}
```

**改后**：
```javascript
// 桌面端: postMessage + focus() → React 处理导航，不产生重复标签
// 移动端: focus() 不可靠 → 直接用 openWindow 强制拉起
const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

if (matchedClient && !isMobile) {
    matchedClient.postMessage({
        type: 'PUSH_NAVIGATE',
        url: action === 'navigate' ? urlToOpen : null,
        action,
        registerId: notificationData?.registerId || null,
        presetId: notificationData?.presetId || null,
        subscriptionEndpoint,
        ...(action === 'expand' && {
            title: notificationData?.title || '',
            body: notificationData?.body || '',
            senderName: notificationData?.senderName || 'ExoCore',
            senderType: notificationData?.senderType || null,
        }),
    });
    if (action !== 'dismiss') {
        await matchedClient.focus();
    }
} else if (action === 'navigate' && clients.openWindow) {
    // 移动端或有 matchedClient 但 expand/dismiss：走 openWindow
    await clients.openWindow(urlToOpen);
}
// dismiss + 无匹配窗口 → 什么都不做，直接关通知
```

**注意**：三个文件同步修改，完全一致。

---

### Step 2: React 层 — navigate handler 真正导航 (`main.jsx` ×3)

**文件**：
- `packages/chat-core/src/main.jsx`
- `packages/chronicle/src/main.jsx`
- `packages/council/src/main.jsx`

**改动**：`PushNavigateListener` 组件中 navigate action handler

**改后**（在已修复 `path` → `presetId` 的基础上）：
```javascript
// navigate → ACK + 导航到目标页
if (action === 'navigate') {
    if (registerId) {
        try {
            await apiFetch(
                `/api/agents/registers/${registerId}/ack/`,
                {
                    method: 'POST',
                    body: {
                        action: 'navigate',
                        subscription_endpoint: subscriptionEndpoint || null,
                    },
                    params: presetId ? { preset_id: presetId } : {},
                },
            );
        } catch (_) {
            // Silent
        }
    }
    // 桌面端收到 postMessage 后真正导航到目标 URL
    if (url) {
        navigate(url);
    }
}
```

---

## 关键文件清单

| 文件 | 操作 |
|------|------|
| `packages/chat-core/public/push-notification.js` | Modify |
| `packages/chronicle/public/push-notification.js` | Modify |
| `packages/council/public/push-notification.js` | Modify |
| `packages/chat-core/src/main.jsx` | Modify |
| `packages/chronicle/src/main.jsx` | Modify |
| `packages/council/src/main.jsx` | Modify |

## 不变部分

- dismiss / expand 行为的已有逻辑不变
- push 事件监听、subscription change 处理不变
- SW 其余部分（VAPID、Workbox 集成）不变
- NotificationContext 内联弹窗逻辑不变

## 验证

1. 桌面端：发一条 push → 点跳转 → 窗口聚焦 + URL 导航到目标页
2. Android PWA：发一条 push → 点跳转 → PWA 被拉起并打开目标页
3. 桌面端已有窗口：不会出现重复标签页
4. dismiss / expand 行为不受影响
