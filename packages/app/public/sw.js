/**
 * ExoCore V4 Service Worker (P1A / P2D)
 *
 * Rules:
 * - Emitted beneath /app/ with V4-specific cache naming.
 * - Precaches the V4 shell only.
 * - NEVER caches /api/ or /media/ responses.
 * - /app/ document navigation is NETWORK FIRST (Issue #123): an expired
 *   Cloudflare Access session must be able to reach the edge login page, so the
 *   precached shell is only a fallback. Only same-origin, `basic`, HTTP 200
 *   documents enter the runtime cache — a cross-origin login page is shown to
 *   the browser but never cached as the app shell.
 * - Push arrival routing:
 *   - Pure, zero-side-effect shared parser for AssistantMessageArrivedV1 events (workerContract.ts).
 *   - Foreground-focused client within /app/ scope (visibilityState === 'visible' && focused === true):
 *     Sends typed ASSISTANT_ARRIVAL_HANDOFF without showing OS notification (showNotification = 0).
 *   - Out-of-scope clients (e.g. /chat/) do NOT suppress OS notification and receive no handoff.
 *   - Otherwise: displays bounded system notification with tag = dedupe_key (top-level tag cannot override).
 *     When ignore.allowed === true, adds { action: 'ignore', title: '忽略' } OS notification action.
 *   - Malformed payload: displays generic ExoCore notification with no sensitive data or deeplinks.
 *   - Empty push: suppresses cleanly without displaying connection notices.
 * - Notification click:
 *   - event.action === 'ignore': close notification; POST ignore endpoint; zero navigation.
 *   - Body / default click: prioritizes focused > visible > any /app/ client, sends NOTIFICATION_NAVIGATE; zero ACK.
 *   - Cold click: opens window with scope-derived route; zero ACK.
 * - Notification close (system X / swipe): completely neutral. Zero network, zero navigation, zero Register.
 * - pushsubscriptionchange: renews browser subscription with VAPID key and sends SUBSCRIPTION_REPAIR_NEEDED to clients.
 */

import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';
import { VAPID_PUBLIC_KEY, urlBase64ToUint8Array, parseArrivalEvent } from '../src/features/notifications/workerContract';

precacheAndRoute(self.__WB_MANIFEST);

// ── App document navigation: network first, safe cache admission ────────────
// Serving the document straight from precache hid the Cloudflare Access login
// page: the document never touched the network, so an expired session could
// never be renewed. Network now wins; the shell is only the offline fallback.
const APP_DOCUMENT_CACHE = 'exocore-app-documents-v1';

function isCacheableAppDocument(response) {
  if (!response || response.status !== 200) return null;
  if (response.type !== 'basic') return null;
  try {
    if (new URL(response.url).origin !== self.origin) return null;
  } catch {
    return null;
  }
  return response;
}

const appDocumentStrategy = new NetworkFirst({
  cacheName: APP_DOCUMENT_CACHE,
  plugins: [
    {
      cacheWillUpdate: async ({ response }) => isCacheableAppDocument(response),
    },
  ],
});

const precachedAppShell = createHandlerBoundToURL('/app/index.html');

async function handleAppDocumentNavigation({ request, event }) {
  try {
    return await appDocumentStrategy.handle({ request, event });
  } catch {
    // Network failed and this download has no runtime document entry yet
    // (fresh install / first visit offline): fall back to the precached shell.
    return precachedAppShell({ request, event });
  }
}

registerRoute(
  new NavigationRoute(
    handleAppDocumentNavigation,
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
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── Web Push Event Handler ──────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) {
    // Empty push payload: suppress cleanly without connection notices
    return;
  }

  let payload = null;
  try {
    payload = event.data.json();
  } catch {
    payload = null;
  }

  const rawEvent = payload && typeof payload === 'object' ? payload.data?.event : null;
  const parseResult = parseArrivalEvent(rawEvent);
  const validatedEvent = parseResult && parseResult.ok ? parseResult.value : null;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Scope filter: only clients within registration scope (/app/) are candidates!
      const v4Clients = clients.filter(
        (c) => typeof c.url === 'string' && c.url.startsWith(self.registration.scope),
      );

      // Focus matrix: client must be visible AND focused
      const focusedClient = v4Clients.find(
        (c) => c.visibilityState === 'visible' && c.focused === true,
      );

      if (validatedEvent) {
        if (focusedClient) {
          // Foreground-focused inside /app/: handoff to runtime, showNotification = 0
          focusedClient.postMessage({
            type: 'ASSISTANT_ARRIVAL_HANDOFF',
            version: 1,
            event: validatedEvent,
          });
          return;
        }

        // Not foreground-focused in /app/: show OS notification
        // Note: top-level tag cannot override canonical dedupe_key!
        const title = validatedEvent.title_hint || validatedEvent.agent?.name || 'ExoCore';
        const body = validatedEvent.preview?.text || '收到新消息';

        const notifOptions = {
          body,
          tag: validatedEvent.dedupe_key,
          renotify: false,
          requireInteraction: true,
          data: {
            event: validatedEvent,
          },
          icon: '/app/icon-192x192.png',
          badge: '/app/favicon.svg',
        };

        // Explicit ignore affordance: only for send_message arrivals
        if (validatedEvent.ignore && validatedEvent.ignore.allowed === true) {
          notifOptions.actions = [{ action: 'ignore', title: '忽略' }];
        }

        return self.registration.showNotification(title, notifOptions);
      }

      // Malformed / non-B6 payload: generic notification with zero sensitive info and no deeplink
      if (payload) {
        return self.registration.showNotification('ExoCore', {
          body: 'ExoCore有新消息',
          tag: 'exocore-generic-arrival',
          renotify: false,
          data: {},
          icon: '/app/icon-192x192.png',
          badge: '/app/favicon.svg',
        });
      }
    }),
  );
});

// ── Notification Click (Ignore / Warm / Cold — Zero Register ACK) ───────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const notifData = event.notification.data;
  const parseResult = parseArrivalEvent(notifData?.event);
  const arrivalEvent = parseResult && parseResult.ok ? parseResult.value : null;

  // EXPLICIT IGNORE BRANCH: event.action === 'ignore' — never navigates.
  // If the event data is missing/malformed, there is no event_id to POST to:
  // the click still only closes the notification (fail-closed, zero navigation).
  if (event.action === 'ignore') {
    if (arrivalEvent) {
      event.waitUntil(
        (async () => {
          try {
            await fetch(`/api/push/assistant-arrivals/${arrivalEvent.event_id}/ignore/`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({}),
            });
          } catch {
            // Best-effort: stateless SW has no durable retry. Shell retries if client exists.
          }
        })(),
      );
    }
    return;
  }

  // BODY / DEFAULT CLICK BRANCH: navigate to conversation
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const appClients = clients.filter(
        (c) => typeof c.url === 'string' && c.url.startsWith(self.registration.scope),
      );

      // Client prioritization: focused > visible > any
      const chosenClient =
        appClients.find((c) => c.focused) ||
        appClients.find((c) => c.visibilityState === 'visible') ||
        appClients[0];

      if (chosenClient && chosenClient.focus) {
        // WARM CLICK: focus existing client, send typed navigate message (zero ACK)
        await chosenClient.focus();
        if (arrivalEvent?.target) {
          chosenClient.postMessage({
            type: 'NOTIFICATION_NAVIGATE',
            version: 1,
            target: arrivalEvent.target,
          });
        }
        return;
      }

      // COLD CLICK: open new window with scope-derived route (zero ACK)
      let targetPath = '';
      if (arrivalEvent?.target?.conversation_id) {
        targetPath = `chat/${arrivalEvent.target.conversation_id}`;
      }
      const scopeUrl = self.registration.scope.endsWith('/')
        ? self.registration.scope
        : self.registration.scope + '/';
      const targetUrl = new URL(targetPath, scopeUrl).href;

      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })(),
  );
});

// ── Notification Close (Neutral — Zero Network, Zero Register) ──────────────
// System X / swipe close is purely neutral. It must never be inferred as ignoring.
// Zero network requests, zero navigation, zero Register creation.
self.addEventListener('notificationclose', () => {
  // Intentionally empty: closing a notification is not an action.
});

// ── Push Subscription Change (Renewal + Repair Notification) ────────────────
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
      .catch(() => {})
      .then(() =>
        self.clients.matchAll({ type: 'window' }).then((clients) => {
          for (const client of clients) {
            client.postMessage({
              type: 'SUBSCRIPTION_REPAIR_NEEDED',
              version: 1,
            });
          }
        }),
      ),
  );
});
