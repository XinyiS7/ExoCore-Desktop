/**
 * ExoCore V4 Service Worker (P1A / P2D)
 *
 * Rules:
 * - Emitted beneath /app/ with V4-specific cache naming.
 * - Precaches the V4 shell only.
 * - NEVER caches /api/ or /media/ responses.
 * - Navigation fallback targets /app/index.html.
 * - Push arrival routing:
 *   - Pure, zero-side-effect shared parser for AssistantMessageArrivedV1 events (workerContract.ts).
 *   - Foreground-focused client within /app/ scope (visibilityState === 'visible' && focused === true):
 *     Sends typed ASSISTANT_ARRIVAL_HANDOFF without showing OS notification (showNotification = 0).
 *   - Out-of-scope clients (e.g. /chat/) do NOT suppress OS notification and receive no handoff.
 *   - Otherwise: displays bounded system notification with tag = dedupe_key (top-level tag cannot override).
 *   - Malformed payload: displays generic ExoCore notification with no sensitive data or deeplinks.
 *   - Empty push: suppresses cleanly without displaying connection notices.
 * - Warm click: prioritizes focused > visible > any /app/ client, SW sends navigate ACK, sends NOTIFICATION_NAVIGATE and focuses.
 * - Cold click: SW does NOT send navigate ACK (fetch = 0); opens window with scope-derived route; Main canonical confirmation owns ACK.
 * - Register ACK on close: best-effort inside waitUntil; if window clients exist, broadcasts SW_ACK_RESULT.
 * - pushsubscriptionchange: renews browser subscription with VAPID key and sends SUBSCRIPTION_REPAIR_NEEDED to clients.
 */

import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { VAPID_PUBLIC_KEY, urlBase64ToUint8Array, parseArrivalEvent } from '../src/features/notifications/workerContract';

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

        return self.registration.showNotification(title, {
          body,
          tag: validatedEvent.dedupe_key,
          renotify: false,
          requireInteraction: true,
          data: {
            event: validatedEvent,
          },
          icon: '/app/icon-192x192.png',
          badge: '/app/favicon.svg',
        });
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

// ── Notification Click (Warm & Cold Routing + Single ACK Owner) ─────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const notifData = event.notification.data;
  const parseResult = parseArrivalEvent(notifData?.event);
  const arrivalEvent = parseResult && parseResult.ok ? parseResult.value : null;

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
        // WARM CLICK BRANCH: SW owns navigate ACK and hands outcome off to chosen client
        let ackOutcome = null;
        const registerAck = arrivalEvent?.register_ack;
        if (registerAck) {
          try {
            const sub = await self.registration.pushManager.getSubscription().catch(() => null);
            const endpoint = sub ? sub.endpoint : undefined;
            const ackUrl = `/api/agents/registers/${registerAck.register_id}/ack/?preset_id=${registerAck.preset_id}`;
            const body = { action: 'navigate' };
            if (endpoint) body.subscription_endpoint = endpoint;
            const res = await fetch(ackUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            });
            if (res.ok) {
              ackOutcome = { status: 'sent', statusCode: res.status };
            } else {
              ackOutcome = {
                status: res.status === 400 || res.status === 404 ? 'failed_terminal' : 'failed_retryable',
                statusCode: res.status,
                error: `HTTP ${res.status}`,
              };
            }
          } catch (err) {
            ackOutcome = { status: 'failed_retryable', error: String(err) };
          }
        }

        await chosenClient.focus();
        if (arrivalEvent?.target) {
          chosenClient.postMessage({
            type: 'NOTIFICATION_NAVIGATE',
            version: 1,
            target: arrivalEvent.target,
            register_ack: registerAck,
            ack_outcome: ackOutcome,
          });
        }
        return;
      }

      // COLD CLICK BRANCH: SW does NOT send navigate ACK! (fetch = 0)
      // Main window confirms canonical arrival and sends exactly one ACK upon consume.
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

// ── Notification Close (Register ACK Dismiss - Best Effort) ─────────────────
self.addEventListener('notificationclose', (event) => {
  const notifData = event.notification.data;
  const parseResult = parseArrivalEvent(notifData?.event);
  const arrivalEvent = parseResult && parseResult.ok ? parseResult.value : null;
  const registerAck = arrivalEvent?.register_ack;

  if (registerAck) {
    event.waitUntil(
      (async () => {
        let ackOutcome = null;
        try {
          const sub = await self.registration.pushManager.getSubscription().catch(() => null);
          const endpoint = sub ? sub.endpoint : undefined;
          const ackUrl = `/api/agents/registers/${registerAck.register_id}/ack/?preset_id=${registerAck.preset_id}`;
          const body = { action: 'dismiss' };
          if (endpoint) body.subscription_endpoint = endpoint;
          const res = await fetch(ackUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          if (res.ok) {
            ackOutcome = { status: 'sent', statusCode: res.status };
          } else {
            ackOutcome = {
              status: res.status === 400 || res.status === 404 ? 'failed_terminal' : 'failed_retryable',
              statusCode: res.status,
              error: `HTTP ${res.status}`,
            };
          }
        } catch (err) {
          ackOutcome = { status: 'failed_retryable', error: String(err) };
        }

        // Best effort: if active clients exist, broadcast outcome to Main window
        try {
          const clients = await self.clients.matchAll({ type: 'window' });
          const appClients = clients.filter(
            (c) => typeof c.url === 'string' && c.url.startsWith(self.registration.scope),
          );
          for (const client of appClients) {
            client.postMessage({
              type: 'SW_ACK_RESULT',
              version: 1,
              register_ack: registerAck,
              action: 'dismiss',
              outcome: ackOutcome,
            });
          }
        } catch {
          // Gracefully complete without unhandled exception
        }
      })(),
    );
  }
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
