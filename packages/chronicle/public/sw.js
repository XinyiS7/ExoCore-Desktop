/**
 * ExoCore Chronicle Service Worker
 *
 * ⚠️  importScripts MUST be at the top level (not inside any async callback).
 *     Chrome forbids importScripts() after SW installation is complete.
 */

// --- Push notification handler (synchronous — MUST be top-level) ---
importScripts('./push-notification.js');

// --- Workbox ---
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst } from 'workbox-strategies';

precacheAndRoute(self.__WB_MANIFEST);

registerRoute(
  new NavigationRoute(
    createHandlerBoundToURL('/chronicle/index.html'),
    { denylist: [/^\/api\//, /^\/media\//] },
  ),
);

registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'exo-api-cache',
    networkTimeoutSeconds: 10,
  }),
);

registerRoute(
  ({ url }) => url.pathname.startsWith('/media/'),
  new CacheFirst({
    cacheName: 'exo-media-cache',
  }),
);

self.skipWaiting();
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
