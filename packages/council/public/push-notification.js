/**
 * ExoCore Push Notification Service Worker Extension
 *
 * Imported by the Workbox-generated service worker via importScripts.
 * Handles incoming Web Push events and displays system notifications.
 *
 * This is the "内应" (inside agent) that listens for push messages
 * from the ExoCore backend even when the browser tab is closed.
 */

// The VAPID public key — used to verify push messages came from our server.
// Messages are encrypted end-to-end by the browser's Push API.
const VAPID_PUBLIC_KEY = 'BKlG4M9uEo7TIOTlDZMN_3ncx8oOM2g7hfy-5M5-xQWOfbporu58kUGrQtLxX99-VShp56Z1ysbcKJ9ySUFtqO8';

self.addEventListener('push', (event) => {
  if (!event.data) {
    // Empty push (used by some services as a keepalive) — show a minimal notification
    event.waitUntil(
      self.registration.showNotification('ExoCore', {
        body: '连接已建立',
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png',
        tag: 'exo-keepalive',
        requireInteraction: false,
        silent: true,
      })
    );
    return;
  }

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

    // 后端未传 tag 时自动生成唯一标识，确保 renotify 合法 + 通知中心独立堆叠
    const effectiveTag = tag || `exo-${Date.now()}`;

    const options = {
      body: notificationBody,
      icon,
      badge,
      image,
      tag: effectiveTag,
      data: {
        url: data.url || '/',
        registerId: data.register_id || null,
        presetId: data.preset_id || null,
        title: backendTitle || '',
        body: body || '',
        senderName: data.sender_name || 'ExoCore',
        senderType: data.sender_type || null,
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
    // Fallback: treat as plain text notification
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
});

self.addEventListener('notificationclick', (event) => {
  const clickAction = event.action;  // 'navigate' | 'dismiss' | ''
  console.log('[ExoPush] notificationclick raw event.action=' + JSON.stringify(clickAction)); (点主体)
  // 点「跳转」按钮 → 导航；点通知主体 → 导航（web 通知点主体必然回到页面）；
  // 点「关闭」按钮 → 仅 dismiss
  let action;
  if (clickAction === 'dismiss') {
    action = 'dismiss';
  } else {
    // 点击「跳转」按钮 或 点击通知主体 → 统一归类为 navigate
    action = 'navigate';
  }
  const notificationData = event.notification.data;
  const urlToOpen = notificationData?.url || '/';

  event.waitUntil(
    (async () => {
      // 获取本设备订阅标识，供后端 ack 时溯源 device_name
      const subscription = await self.registration.pushManager.getSubscription();
      const subscriptionEndpoint = subscription?.endpoint || null;

      const clientList = await clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      // 提取目标路径的第一段作为 base（如 /chat/agent/6 → /chat）
      const targetBase = '/' + (urlToOpen.split('/')[1] || '');

      // 1. 查找 URL 前缀匹配的窗口
      let matchedClient = null;
      for (const client of clientList) {
        if (!client.url.includes(self.location.origin)) continue;
        if (!('focus' in client)) continue;
        if (client.url.includes(targetBase)) {
          matchedClient = client;
          break;
        }
      }

      // ── ACK 回执：SW 直接 fetch ──
      // 有窗口时 React PushNavigateListener 也会发 ack（双保险，RegisterAckView 幂等）；
      // 无窗口时这是唯一的 ack 路径，确保 Agent 感知用户已处理通知。
      const registerId = notificationData?.registerId || null;
      const presetId = notificationData?.presetId || null;
      if (registerId) {
        const ackUrl = `/api/agents/registers/${registerId}/ack/?preset_id=${presetId || ''}`;
        fetch(ackUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action,
            subscription_endpoint: subscriptionEndpoint || null,
          }),
        }).catch(() => { /* silent — SW may be killed before fetch completes */ });
      }

      if (action === 'navigate') {
        if (matchedClient) {
          // 已有对应 SPA 窗口 → postMessage 让 React 层处理导航
          matchedClient.postMessage({
            type: 'PUSH_NAVIGATE',
            url: urlToOpen,
            action,
            registerId,
            presetId,
            subscriptionEndpoint,
          });
          await matchedClient.focus();
        } else if (clients.openWindow) {
          // 没开对应 SPA → 打开新窗口导航到目标页
          await clients.openWindow(urlToOpen);
        }
      }
      // dismiss → ack 已由上方 fetch 发送，不聚焦窗口，直接关通知

      event.notification.close();
    })()
  );
});

// Handle subscription expiration/refresh (browser may change the subscription)
self.addEventListener('pushsubscriptionchange', (event) => {
  console.warn('[ExoPush] Subscription changed, re-subscribing...');
  event.waitUntil(
    self.registration.pushManager
      .subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
      .then((newSubscription) => {
        // Report the new subscription to the backend
        return fetch('/api/push/subscribe/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscription: newSubscription.toJSON(),
          }),
        });
      })
      .then(() => {
        console.log('[ExoPush] Re-subscription reported to backend');
      })
      .catch((err) => {
        console.error('[ExoPush] Failed to re-subscribe:', err);
      })
  );
});

/**
 * Convert a base64 URL-safe string to a Uint8Array.
 * Required by pushManager.subscribe({ applicationServerKey }).
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
