/**
 * ExoCore V4 Service Worker (P1A)
 *
 * P1A rules (V4 Phase 1A Detailed Plan §5.5):
 * - emitted only beneath /app/ with V4-specific cache naming;
 * - precaches the V4 shell only;
 * - NEVER caches /api/ or /media/ responses (no push behavior in P1A);
 * - navigation fallback targets /app/index.html.
 *
 * importScripts / top-level imports MUST stay at the top level.
 */
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';

precacheAndRoute(self.__WB_MANIFEST);

registerRoute(
  new NavigationRoute(
    createHandlerBoundToURL('/app/index.html'),
    { denylist: [/^\/api\//, /^\/media\//] },
  ),
);

// Auto-update: activate immediately and claim all clients.
self.skipWaiting();
self.addEventListener('activate', (event) => {
  event.waitUntil(
    self.clients.claim().then(() =>
      self.clients.matchAll({ type: 'window' }).then((clientList) => {
        for (const client of clientList) {
          client.postMessage({ type: 'SW_UPDATED' });
        }
      }),
    ),
  );
});
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
