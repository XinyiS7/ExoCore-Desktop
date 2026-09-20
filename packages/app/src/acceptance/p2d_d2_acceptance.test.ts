import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ignoreAssistantArrival,
  subscribeToPush,
  unsubscribeFromPush,
} from '../features/notifications/subscription';
import { parseArrivalEvent } from '../features/notifications/workerContract';
import { ensureTestLocalStorage, jsonResponse } from '../test/helpers';

interface WindowClientDouble {
  url: string;
  visibilityState: 'visible' | 'hidden';
  focused: boolean;
  postMessage: ReturnType<typeof vi.fn>;
  focus: ReturnType<typeof vi.fn>;
}

const arrival = (overrides: Record<string, unknown> = {}) => ({
  kind: 'assistant-message-arrived',
  version: 1,
  event_id: 21,
  dedupe_key: 'assistant-message:99',
  conversation_id: 42,
  message_id: 99,
  agent: { id: 1, name: 'Agent' },
  preview: { policy: 'bounded_text', text: 'bounded', truncated: false },
  target: { kind: 'conversation_message', conversation_id: 42, message_id: 99 },
  ignore: { allowed: true },
  register_ack: null,
  title_hint: null,
  committed_at: '2026-09-14T00:00:00Z',
  ...overrides,
});

function loadProductionWorker(clients: WindowClientDouble[] = [], scope = 'https://exocore.example/app/') {
  const listeners: Record<string, (event: Record<string, unknown>) => void> = {};
  const showNotification = vi.fn().mockResolvedValue(undefined);
  const openWindow = vi.fn().mockResolvedValue(undefined);
  const workerSelf = {
    __WB_MANIFEST: [],
    registration: {
      scope,
      showNotification,
      pushManager: { subscribe: vi.fn().mockResolvedValue({}) },
    },
    clients: {
      claim: vi.fn().mockResolvedValue(undefined),
      matchAll: vi.fn().mockResolvedValue(clients),
      openWindow,
    },
    skipWaiting: vi.fn(),
    addEventListener: (kind: string, listener: (event: Record<string, unknown>) => void) => {
      listeners[kind] = listener;
    },
  };
  const source = readFileSync(resolve(process.cwd(), 'public', 'sw.js'), 'utf8')
    .replace(/^import .*;\r?$/gm, '');
  const evaluate = new Function(
    'self', 'precacheAndRoute', 'createHandlerBoundToURL', 'registerRoute',
    'NavigationRoute', 'VAPID_PUBLIC_KEY', 'urlBase64ToUint8Array', 'parseArrivalEvent', source,
  );
  class NavigationRouteDouble { constructor(..._args: unknown[]) {} }
  evaluate(workerSelf, vi.fn(), vi.fn(), vi.fn(), NavigationRouteDouble, 'test-key', vi.fn(), parseArrivalEvent);
  return { listeners, showNotification, openWindow };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('P2D D-2 acceptance amended for explicit-ignore contract', () => {
  it('requires closed ignore permission and required nullable legacy register_ack', () => {
    const valid = arrival();
    expect(parseArrivalEvent(valid)).toMatchObject({ ok: true, value: { ignore: { allowed: true }, register_ack: null } });
    const { ignore: _ignore, ...withoutIgnore } = valid;
    expect(parseArrivalEvent(withoutIgnore).ok).toBe(false);
    const { register_ack: _ack, ...withoutAck } = valid;
    expect(parseArrivalEvent(withoutAck).ok).toBe(false);
    expect(parseArrivalEvent(arrival({ ignore: { allowed: false }, register_ack: { register_id: 5, preset_id: 1 } })))
      .toMatchObject({ ok: true, value: { ignore: { allowed: false } } });
  });

  it('malformed target fails closed and an out-of-scope focused client cannot suppress the generic notice', async () => {
    const foreign: WindowClientDouble = {
      url: 'https://exocore.example/chat/42', visibilityState: 'visible', focused: true,
      postMessage: vi.fn(), focus: vi.fn(),
    };
    const { listeners, showNotification } = loadProductionWorker([foreign]);
    let lifetime: Promise<unknown> | undefined;
    listeners.push({
      data: { json: () => ({ data: { event: arrival({ target: { kind: 'conversation_message', conversation_id: 777, message_id: 99 } }) } }) },
      waitUntil: (promise: Promise<unknown>) => { lifetime = promise; },
    });
    await lifetime;
    expect(foreign.postMessage).not.toHaveBeenCalled();
    expect(showNotification).toHaveBeenCalledWith('ExoCore', expect.objectContaining({
      body: 'ExoCore有新消息', tag: 'exocore-generic-arrival', data: {},
    }));
  });

  it('malformed subscribe 201 cannot establish backend-persisted truth', async () => {
    ensureTestLocalStorage();
    localStorage.clear();
    const browserSubscription = {
      endpoint: 'https://push.example/current-endpoint',
      toJSON: () => ({ keys: { p256dh: 'p256dh', auth: 'auth' } }),
    } as unknown as PushSubscription;
    class NotificationDouble {
      static permission: NotificationPermission = 'granted';
      static requestPermission = vi.fn().mockResolvedValue('granted');
    }
    vi.stubGlobal('Notification', NotificationDouble);
    vi.stubGlobal('PushManager', class PushManagerDouble {});
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { ready: Promise.resolve({ pushManager: { getSubscription: vi.fn().mockResolvedValue(browserSubscription) } }) },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ persisted: true }, 201)));
    expect((await subscribeToPush('device')).ok).toBe(false);
  });

  it('failure to inspect the browser subscription cannot be reported as successful unsubscribe', async () => {
    class NotificationDouble { static permission: NotificationPermission = 'granted'; }
    vi.stubGlobal('Notification', NotificationDouble);
    vi.stubGlobal('PushManager', class PushManagerDouble {});
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { ready: Promise.resolve({ pushManager: { getSubscription: vi.fn().mockRejectedValue(new Error('inspection failed')) } }) },
    });
    expect((await unsubscribeFromPush()).ok).toBe(false);
  });

  it('body click navigates under the actual scope with zero ignore or Register request', async () => {
    const scope = 'https://exocore.example/preview/app/';
    const { listeners, openWindow } = loadProductionWorker([], scope);
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    let lifetime: Promise<unknown> | undefined;
    listeners.notificationclick({
      action: '', notification: { close: vi.fn(), data: { event: arrival() } },
      waitUntil: (promise: Promise<unknown>) => { lifetime = promise; },
    });
    await lifetime;
    expect(openWindow).toHaveBeenCalledWith(`${scope}chat/42`);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('neutral close performs zero network and zero navigation', async () => {
    const client: WindowClientDouble = {
      url: 'https://exocore.example/app/chat/1', visibilityState: 'visible', focused: true,
      postMessage: vi.fn(), focus: vi.fn(),
    };
    const { listeners, openWindow } = loadProductionWorker([client]);
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const waitUntil = vi.fn();
    listeners.notificationclose({ notification: { data: { event: arrival() } }, waitUntil });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(openWindow).not.toHaveBeenCalled();
    expect(client.postMessage).not.toHaveBeenCalled();
    expect(waitUntil).not.toHaveBeenCalled();
  });

  it('explicit OS ignore is exposed only when allowed and posts exactly once without navigation', async () => {
    const { listeners, showNotification, openWindow } = loadProductionWorker();
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse({ action: 'ignore', event_id: 21, message_id: 99, conversation_id: 42, created: true }));
    vi.stubGlobal('fetch', fetchSpy);
    let pushLifetime: Promise<unknown> | undefined;
    listeners.push({
      data: { json: () => ({ data: { event: arrival() } }) },
      waitUntil: (promise: Promise<unknown>) => { pushLifetime = promise; },
    });
    await pushLifetime;
    expect(showNotification).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      actions: [{ action: 'ignore', title: '忽略' }],
    }));
    let clickLifetime: Promise<unknown> | undefined;
    listeners.notificationclick({
      action: 'ignore', notification: { close: vi.fn(), data: { event: arrival() } },
      waitUntil: (promise: Promise<unknown>) => { clickLifetime = promise; },
    });
    await clickLifetime;
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0][0])).toContain('/api/push/assistant-arrivals/21/ignore/');
    expect(openWindow).not.toHaveBeenCalled();
  });


  it('window ignore helper rejects malformed or mismatched 2xx response truth', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ action: 'ignore' })));
    expect((await ignoreAssistantArrival(21)).ok).toBe(false);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      action: 'ignore', event_id: 999, message_id: 99, conversation_id: 42, created: true,
    })));
    expect((await ignoreAssistantArrival(21)).ok).toBe(false);
  });
});
