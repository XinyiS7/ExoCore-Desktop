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

// Precache all assets (manifest injected at build time)
precacheAndRoute(self.__WB_MANIFEST);

// Navigation fallback — serve index.html for SPA routes
registerRoute(
  new NavigationRoute(
    createHandlerBoundToURL('/chat/index.html'),
    { denylist: [/^\/api\//, /^\/media\//] },
  ),
);

// API: network-first with 10s timeout
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'exo-api-cache',
    networkTimeoutSeconds: 10,
  }),
);

// Media: cache-first
registerRoute(
  ({ url }) => url.pathname.startsWith('/media/'),
  new CacheFirst({
    cacheName: 'exo-media-cache',
  }),
);

// Auto-update: immediately activate new SW
self.skipWaiting();
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
