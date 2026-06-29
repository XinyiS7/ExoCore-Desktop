/**
 * In-app notification store — pure JS pub/sub singleton.
 *
 * Bridge between the service worker's postMessage (received in main.jsx
 * PushNavigateListener) and React's NotificationProvider.
 *
 * Each SPA (chat-core / chronicle / council) has its own copy because
 * they are independent Vite builds with no shared runtime.
 */

let _items = [];
let _nextId = 1;
const _listeners = new Set();

/**
 * Push a new inline notification — called by PushNavigateListener
 * when the service worker sends action === 'expand'.
 */
export function pushNotification(data) {
  const item = {
    id: _nextId++,
    title: data.title || '',
    body: data.body || '',
    senderName: data.senderName || 'ExoCore',
    senderType: data.senderType || null,
    url: data.url || '/',
    registerId: data.registerId || null,
    presetId: data.presetId || null,
    subscriptionEndpoint: data.subscriptionEndpoint || null,
    timestamp: Date.now(),
  };
  _items = [item, ..._items];
  // Cap at 20 to prevent unbounded memory growth
  if (_items.length > 20) _items = _items.slice(0, 20);
  _notify();
  return item;
}

/**
 * Remove a notification by id — called after user dismisses or navigates.
 */
export function removeNotification(id) {
  _items = _items.filter((n) => n.id !== id);
  _notify();
}

/**
 * Subscribe to notification list changes.
 * Returns an unsubscribe function.
 */
export function subscribe(fn) {
  _listeners.add(fn);
  fn([..._items]); // immediate hydration
  return () => _listeners.delete(fn);
}

function _notify() {
  const snapshot = [..._items];
  _listeners.forEach((fn) => fn(snapshot));
}
