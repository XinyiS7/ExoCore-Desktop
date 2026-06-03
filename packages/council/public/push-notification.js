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
      title,
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

    const options = {
      body,
      icon,
      badge,
      image,
      tag,
      data: { ...data, url: data.url || '/' },
      actions,
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
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Try to focus an existing window from our origin
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // No existing window — open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
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
