/**
 * ExoCore Chat Service Worker
 *
 * ⚠️  importScripts MUST be at the top level (not inside any async callback).
 *     Chrome forbids importScripts() after SW installation is complete.
 *
 * Uses vite-plugin-pwa injectManifest strategy — the build step replaces
 * `self.__WB_MANIFEST` with the actual precache manifest.
 */

// --- Push notification handler (synchronous — MUST be top-level) ---
importScripts('./push-notification.js');

// --- Workbox ---
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

// Precache all assets (manifest injected at build time)
precacheAndRoute(self.__WB_MANIFEST);

// Navigation fallback — serve index.html for SPA routes
registerRoute(
  new NavigationRoute(
    createHandlerBoundToURL('/chat/index.html'),
    { denylist: [/^\/api\//, /^\/media\//] },
  ),
);

// API: network-first with 10s timeout, capped TTL and entry count
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'exo-api-cache',
    networkTimeoutSeconds: 10,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 500,
        maxAgeSeconds: 5 * 60, // 5 min — API data should not be served long from cache
        purgeOnQuotaError: true,
      }),
    ],
  }),
);

// Media: cache-first, long-lived but capped
registerRoute(
  ({ url }) => url.pathname.startsWith('/media/'),
  new CacheFirst({
    cacheName: 'exo-media-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        purgeOnQuotaError: true,
      }),
    ],
  }),
);

// Auto-update: immediately activate new SW and claim all clients
self.skipWaiting();
self.addEventListener('activate', (event) => {
  event.waitUntil(
    self.clients.claim().then(() => {
      // Notify all open tabs that a new version is available
      return self.clients.matchAll({ type: 'window' }).then((clientList) => {
        for (const client of clientList) {
          client.postMessage({ type: 'SW_UPDATED' });
        }
      });
    })
  );
});
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
