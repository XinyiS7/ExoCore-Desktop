import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { AssistantMessageArrivedV1 } from '../features/notifications/contract';
import { VAPID_PUBLIC_KEY, urlBase64ToUint8Array, parseArrivalEvent } from '../features/notifications/workerContract';

interface MockClient {
  url: string;
  visibilityState?: 'visible' | 'hidden';
  focused?: boolean;
  postMessage: ReturnType<typeof vi.fn>;
  focus?: ReturnType<typeof vi.fn>;
}

interface WorkerHarness {
  workerSelf: Record<string, unknown>;
  listeners: Record<string, (event: unknown) => Promise<unknown> | void>;
  showNotification: ReturnType<typeof vi.fn>;
  openWindow: ReturnType<typeof vi.fn>;
}

function loadProductionWorker(options: {
  clients?: MockClient[];
  scope?: string;
  mockSubscription?: { endpoint: string } | null;
} = {}): WorkerHarness {
  const listeners: Record<string, (event: unknown) => Promise<unknown> | void> = {};
  const showNotification = vi.fn().mockResolvedValue(undefined);
  const openWindow = vi.fn().mockImplementation(async () => ({ focus: vi.fn() }));

  const pushSubscription =
    options.mockSubscription !== undefined
      ? options.mockSubscription
      : { endpoint: 'https://push.example.com/v1/sub-active-99' };

  const workerSelf = {
    __WB_MANIFEST: [],
    registration: {
      scope: options.scope || 'https://exocore.example.com/app/',
      showNotification,
      pushManager: {
        getSubscription: vi.fn().mockResolvedValue(pushSubscription),
        subscribe: vi.fn().mockResolvedValue({ endpoint: 'https://push.example.com/v1/new-sub' }),
      },
    },
    clients: {
      claim: vi.fn().mockResolvedValue(undefined),
      matchAll: vi.fn().mockImplementation(async () => options.clients || []),
      openWindow,
    },
    skipWaiting: vi.fn(),
    addEventListener: (kind: string, listener: (event: unknown) => Promise<unknown> | void) => {
      listeners[kind] = listener;
    },
  };

  const source = readFileSync(resolve(process.cwd(), 'public', 'sw.js'), 'utf8')
    .replace(/^import .*;\r?$/gm, '');
  const evaluate = new Function(
    'self',
    'precacheAndRoute',
    'createHandlerBoundToURL',
    'registerRoute',
    'NavigationRoute',
    'VAPID_PUBLIC_KEY',
    'urlBase64ToUint8Array',
    'parseArrivalEvent',
    source,
  );
  class NavigationRouteDouble {
    constructor(..._args: unknown[]) {}
  }
  evaluate(
    workerSelf,
    vi.fn(),
    vi.fn(),
    vi.fn(),
    NavigationRouteDouble,
    VAPID_PUBLIC_KEY,
    urlBase64ToUint8Array,
    parseArrivalEvent,
  );

  return { workerSelf, listeners, showNotification, openWindow };
}

describe('P2D D-2 Section B: Service Worker Push, Focus Matrix & Routing (Actual Worker)', () => {
  const originalFetch = globalThis.fetch;

  const validB6Event: AssistantMessageArrivedV1 = {
    kind: 'assistant-message-arrived',
    version: 1,
    event_id: 101,
    dedupe_key: 'assistant-message:999',
    conversation_id: 42,
    message_id: 999,
    agent: { id: 1, name: 'Alessandro' },
    preview: { policy: 'bounded_text', text: 'Hello Alicia, this is Sandro.', truncated: false },
    target: { kind: 'conversation_message', conversation_id: 42, message_id: 999 },
    ignore: { allowed: true },
    register_ack: { register_id: 55, preset_id: 1 },
    title_hint: 'Sandro Update',
    committed_at: '2026-09-13T22:30:00Z',
  };

  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('VAPID public key constant and base64 helper match frozen contract', () => {
    expect(VAPID_PUBLIC_KEY).toBe(
      'BKlG4M9uEo7TIOTlDZMN_3ncx8oOM2g7hfy-5M5-xQWOfbporu58kUGrQtLxX99-VShp56Z1ysbcKJ9ySUFtqO8',
    );
    const converted = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    expect(converted).toBeInstanceOf(Uint8Array);
    expect(converted.length).toBe(65);
  });

  it('focus matrix: suppresses OS notification and sends typed handoff when exact client is focused within /app/ scope', async () => {
    const focusedClient: MockClient = {
      url: 'https://exocore.example.com/app/chat/42',
      visibilityState: 'visible',
      focused: true,
      postMessage: vi.fn(),
    };
    const { listeners, showNotification } = loadProductionWorker({ clients: [focusedClient] });

    let lifetime: Promise<unknown> | undefined;
    listeners.push({
      data: {
        json: () => ({
          title: 'Sandro Update',
          body: 'Hello Alicia, this is Sandro.',
          data: { event: validB6Event },
        }),
      },
      waitUntil: (p: Promise<unknown>) => {
        lifetime = p;
      },
    });

    await lifetime;

    expect(showNotification).not.toHaveBeenCalled();
    expect(focusedClient.postMessage).toHaveBeenCalledTimes(1);
    expect(focusedClient.postMessage).toHaveBeenCalledWith({
      type: 'ASSISTANT_ARRIVAL_HANDOFF',
      version: 1,
      event: validB6Event,
    });
  });

  it('scope protection: out-of-scope (/chat/) focused client receives no handoff and cannot suppress OS notification', async () => {
    const foreignClient: MockClient = {
      url: 'https://exocore.example.com/chat/42',
      visibilityState: 'visible',
      focused: true,
      postMessage: vi.fn(),
    };
    const { listeners, showNotification } = loadProductionWorker({ clients: [foreignClient] });

    let lifetime: Promise<unknown> | undefined;
    listeners.push({
      data: {
        json: () => ({
          title: 'Sandro Update',
          body: 'Hello Alicia, this is Sandro.',
          data: { event: validB6Event },
        }),
      },
      waitUntil: (p: Promise<unknown>) => {
        lifetime = p;
      },
    });

    await lifetime;

    expect(foreignClient.postMessage).not.toHaveBeenCalled();
    expect(showNotification).toHaveBeenCalledTimes(1);
    expect(showNotification).toHaveBeenCalledWith('Sandro Update', expect.objectContaining({
      body: 'Hello Alicia, this is Sandro.',
      tag: 'assistant-message:999',
    }));
  });

  it('focus matrix: shows OS notification when client is visible but unfocused (not suppressed)', async () => {
    const unfocusedClient: MockClient = {
      url: 'https://exocore.example.com/app/chat/10',
      visibilityState: 'visible',
      focused: false,
      postMessage: vi.fn(),
    };
    const { listeners, showNotification } = loadProductionWorker({ clients: [unfocusedClient] });

    let lifetime: Promise<unknown> | undefined;
    listeners.push({
      data: {
        json: () => ({
          title: 'Sandro Update',
          body: 'Hello Alicia, this is Sandro.',
          data: { event: validB6Event },
        }),
      },
      waitUntil: (p: Promise<unknown>) => {
        lifetime = p;
      },
    });

    await lifetime;

    expect(unfocusedClient.postMessage).not.toHaveBeenCalled();
    expect(showNotification).toHaveBeenCalledTimes(1);
    expect(showNotification).toHaveBeenCalledWith('Sandro Update', expect.objectContaining({
      body: 'Hello Alicia, this is Sandro.',
      tag: 'assistant-message:999',
      requireInteraction: true,
    }));
  });

  it('focus matrix: shows OS notification when client is hidden', async () => {
    const hiddenClient: MockClient = {
      url: 'https://exocore.example.com/app/chat/42',
      visibilityState: 'hidden',
      focused: false,
      postMessage: vi.fn(),
    };
    const { listeners, showNotification } = loadProductionWorker({ clients: [hiddenClient] });

    let lifetime: Promise<unknown> | undefined;
    listeners.push({
      data: {
        json: () => ({
          title: 'Sandro Update',
          body: 'Hello Alicia, this is Sandro.',
          data: { event: validB6Event },
        }),
      },
      waitUntil: (p: Promise<unknown>) => {
        lifetime = p;
      },
    });

    await lifetime;

    expect(hiddenClient.postMessage).not.toHaveBeenCalled();
    expect(showNotification).toHaveBeenCalledTimes(1);
  });

  it('fail-closed validation: malformed event_id, conversation_id, or message_id falls back to generic notice without handoff', async () => {
    const focusedClient: MockClient = {
      url: 'https://exocore.example.com/app/chat/42',
      visibilityState: 'visible',
      focused: true,
      postMessage: vi.fn(),
    };
    const { listeners, showNotification } = loadProductionWorker({ clients: [focusedClient] });

    const malformed = {
      ...validB6Event,
      message_id: -1, // invalid ID
    };

    let lifetime: Promise<unknown> | undefined;
    listeners.push({
      data: {
        json: () => ({
          title: 'Private Alert',
          body: 'Private Secret Body',
          data: { event: malformed },
        }),
      },
      waitUntil: (p: Promise<unknown>) => {
        lifetime = p;
      },
    });

    await lifetime;

    expect(focusedClient.postMessage).not.toHaveBeenCalled();
    expect(showNotification).toHaveBeenCalledTimes(1);
    expect(showNotification).toHaveBeenCalledWith('ExoCore', expect.objectContaining({
      body: 'ExoCore有新消息',
      tag: 'exocore-generic-arrival',
      data: {},
    }));
  });

  it('fail-closed validation: target mismatch or dedupe mismatch falls back to generic notice', async () => {
    const { listeners, showNotification } = loadProductionWorker();

    const malformed = {
      ...validB6Event,
      target: { kind: 'conversation_message', conversation_id: 9999, message_id: 999 }, // mismatch conversation_id
    };

    let lifetime: Promise<unknown> | undefined;
    listeners.push({
      data: {
        json: () => ({
          title: 'Private',
          body: 'Secret',
          data: { event: malformed },
        }),
      },
      waitUntil: (p: Promise<unknown>) => {
        lifetime = p;
      },
    });

    await lifetime;

    expect(showNotification).toHaveBeenCalledTimes(1);
    expect(showNotification).toHaveBeenCalledWith('ExoCore', expect.objectContaining({
      body: 'ExoCore有新消息',
      tag: 'exocore-generic-arrival',
    }));
  });

  it('fail-closed validation: overlong preview (>160 code points) falls back to generic notice', async () => {
    const { listeners, showNotification } = loadProductionWorker();

    const malformed = {
      ...validB6Event,
      preview: { policy: 'bounded_text', text: 'A'.repeat(161), truncated: false },
    };

    let lifetime: Promise<unknown> | undefined;
    listeners.push({
      data: {
        json: () => ({
          title: 'Private',
          body: 'Secret',
          data: { event: malformed },
        }),
      },
      waitUntil: (p: Promise<unknown>) => {
        lifetime = p;
      },
    });

    await lifetime;

    expect(showNotification).toHaveBeenCalledWith('ExoCore', expect.objectContaining({
      body: 'ExoCore有新消息',
    }));
  });

  it('tag security: top-level tag cannot override canonical dedupe_key in OS notification', async () => {
    const { listeners, showNotification } = loadProductionWorker();

    let lifetime: Promise<unknown> | undefined;
    listeners.push({
      data: {
        json: () => ({
          title: 'Sandro Update',
          body: 'Hello Alicia, this is Sandro.',
          tag: 'malicious-override-tag',
          data: { event: validB6Event },
        }),
      },
      waitUntil: (p: Promise<unknown>) => {
        lifetime = p;
      },
    });

    await lifetime;

    expect(showNotification).toHaveBeenCalledWith('Sandro Update', expect.objectContaining({
      tag: 'assistant-message:999', // Canonical dedupe_key preserved!
    }));
  });

  it('notificationclick warm: focuses existing /app/ client and sends typed navigation with zero Register ACK', async () => {
    const mockFocus = vi.fn().mockResolvedValue(undefined);
    const mockPostMessage = vi.fn();
    const existingClient: MockClient = {
      url: 'https://exocore.example.com/app/chat/10',
      visibilityState: 'visible',
      focused: true,
      focus: mockFocus,
      postMessage: mockPostMessage,
    };
    const { listeners, openWindow } = loadProductionWorker({ clients: [existingClient] });

    const notifClose = vi.fn();
    let lifetime: Promise<unknown> | undefined;
    listeners.notificationclick({
      notification: {
        close: notifClose,
        data: { event: validB6Event },
      },
      waitUntil: (p: Promise<unknown>) => {
        lifetime = p;
      },
    });

    await lifetime;

    expect(notifClose).toHaveBeenCalled();
    expect(mockFocus).toHaveBeenCalled();
    expect(mockPostMessage).toHaveBeenCalledWith({
      type: 'NOTIFICATION_NAVIGATE',
      version: 1,
      target: validB6Event.target,
    });
    expect(openWindow).not.toHaveBeenCalled();

    // Zero Register ACK: body click performs no network request at all
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('notificationclick cold: opens new window with scope-correct URL when no client exists', async () => {
    const { listeners, openWindow } = loadProductionWorker({ clients: [] });

    const notifClose = vi.fn();
    let lifetime: Promise<unknown> | undefined;
    listeners.notificationclick({
      notification: {
        close: notifClose,
        data: { event: validB6Event },
      },
      waitUntil: (p: Promise<unknown>) => {
        lifetime = p;
      },
    });

    await lifetime;

    expect(notifClose).toHaveBeenCalled();
    expect(openWindow).toHaveBeenCalledWith('https://exocore.example.com/app/chat/42');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('notificationclick action=ignore: closes, posts explicit ignore exactly once, and never navigates', async () => {
    const mockFocus = vi.fn().mockResolvedValue(undefined);
    const mockPostMessage = vi.fn();
    const existingClient: MockClient = {
      url: 'https://exocore.example.com/app/chat/10',
      visibilityState: 'visible',
      focused: true,
      focus: mockFocus,
      postMessage: mockPostMessage,
    };
    const { listeners, openWindow } = loadProductionWorker({ clients: [existingClient] });

    const notifClose = vi.fn();
    let lifetime: Promise<unknown> | undefined;
    listeners.notificationclick({
      action: 'ignore',
      notification: {
        close: notifClose,
        data: { event: validB6Event },
      },
      waitUntil: (p: Promise<unknown>) => {
        lifetime = p;
      },
    });

    await lifetime;

    // Notification closed
    expect(notifClose).toHaveBeenCalled();

    // Exactly one explicit ignore request, zero Register ACK requests
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/push/assistant-arrivals/101/ignore/',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({}),
      }),
    );

    // Zero navigation: no focus, no handoff, no window open
    expect(mockFocus).not.toHaveBeenCalled();
    expect(mockPostMessage).not.toHaveBeenCalled();
    expect(openWindow).not.toHaveBeenCalled();
  });

  it('notificationclick action=ignore with malformed/missing event data still never navigates and posts nothing (fail-closed)', async () => {
    const mockPostMessage = vi.fn();
    const existingClient: MockClient = {
      url: 'https://exocore.example.com/app/chat/10',
      visibilityState: 'visible',
      focused: true,
      focus: vi.fn(),
      postMessage: mockPostMessage,
    };
    const { listeners, openWindow } = loadProductionWorker({ clients: [existingClient] });

    let lifetime: Promise<unknown> | undefined;
    listeners.notificationclick({
      action: 'ignore',
      notification: {
        close: vi.fn(),
        data: { event: { ...validB6Event, message_id: -1 } }, // malformed event
      },
      waitUntil: (p: Promise<unknown>) => {
        lifetime = p;
      },
    });

    await lifetime;

    // No event_id to post to: zero network, zero navigation
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(mockPostMessage).not.toHaveBeenCalled();
    expect(openWindow).not.toHaveBeenCalled();
  });

  it('push: exposes the 忽略 action only when ignore.allowed === true', async () => {
    const { listeners, showNotification } = loadProductionWorker();

    let lifetime: Promise<unknown> | undefined;
    listeners.push({
      data: {
        json: () => ({
          title: 'Sandro Update',
          body: 'Hello Alicia, this is Sandro.',
          data: { event: validB6Event },
        }),
      },
      waitUntil: (p: Promise<unknown>) => {
        lifetime = p;
      },
    });

    await lifetime;

    expect(showNotification).toHaveBeenCalledWith('Sandro Update', expect.objectContaining({
      actions: [{ action: 'ignore', title: '忽略' }],
    }));
  });

  it('push: omits the ignore action when ignore.allowed === false (ordinary chat)', async () => {
    const { listeners, showNotification } = loadProductionWorker();

    const ordinaryEvent = {
      ...validB6Event,
      ignore: { allowed: false },
      register_ack: null,
      title_hint: 'Ordinary Reply',
    };

    let lifetime: Promise<unknown> | undefined;
    listeners.push({
      data: {
        json: () => ({
          title: 'Ordinary Reply',
          body: 'A normal chat completion.',
          data: { event: ordinaryEvent },
        }),
      },
      waitUntil: (p: Promise<unknown>) => {
        lifetime = p;
      },
    });

    await lifetime;

    expect(showNotification).toHaveBeenCalledTimes(1);
    const [title, options] = (showNotification as ReturnType<typeof vi.fn>).mock.calls[0] as [string, { actions?: unknown }];
    expect(title).toBe('Ordinary Reply');
    expect(options.actions).toBeUndefined();
  });

  it('pushsubscriptionchange: renews subscription with VAPID key and broadcasts SUBSCRIPTION_REPAIR_NEEDED', async () => {
    const mockPostMessage = vi.fn();
    const client: MockClient = {
      url: 'https://exocore.example.com/app/',
      postMessage: mockPostMessage,
    };
    const { workerSelf, listeners } = loadProductionWorker({ clients: [client] });

    let lifetime: Promise<unknown> | undefined;
    listeners.pushsubscriptionchange({
      waitUntil: (p: Promise<unknown>) => {
        lifetime = p;
      },
    });

    await lifetime;

    expect(
      (workerSelf.registration as { pushManager: { subscribe: ReturnType<typeof vi.fn> } }).pushManager.subscribe,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        userVisibleOnly: true,
      }),
    );
    expect(mockPostMessage).toHaveBeenCalledWith({
      type: 'SUBSCRIPTION_REPAIR_NEEDED',
      version: 1,
    });
  });

  it('empty push payload: cleanly suppressed without displaying notification', async () => {
    const { listeners, showNotification } = loadProductionWorker();

    listeners.push({
      data: null, // empty push
      waitUntil: vi.fn(),
    });

    expect(showNotification).not.toHaveBeenCalled();
  });

  it('notificationclick cold: derives route under custom scope without hardcoded /app/ prefix', async () => {
    const customScope = 'https://exocore.example.com/custom-scope/app/';
    const { listeners, openWindow } = loadProductionWorker({
      clients: [],
      scope: customScope,
    });

    let lifetime: Promise<unknown> | undefined;
    listeners.notificationclick({
      notification: {
        close: vi.fn(),
        data: { event: validB6Event },
      },
      waitUntil: (p: Promise<unknown>) => {
        lifetime = p;
      },
    });

    await lifetime;

    expect(openWindow).toHaveBeenCalledWith(`${customScope}chat/42`);
  });

  it('notificationclose: completely neutral — zero network, zero navigation, zero Register even with clients present', async () => {
    const mockPostMessage = vi.fn();
    const windowClient = {
      url: 'https://exocore.example.com/app/chat/1',
      visibilityState: 'visible' as const,
      focused: true,
      postMessage: mockPostMessage,
      focus: vi.fn(),
    };
    const { listeners } = loadProductionWorker({
      clients: [windowClient],
    });

    let lifetime: Promise<unknown> | undefined;
    listeners.notificationclose({
      notification: {
        data: { event: validB6Event },
      },
      waitUntil: (p: Promise<unknown>) => {
        lifetime = p;
      },
    });

    await lifetime;

    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(mockPostMessage).not.toHaveBeenCalled();
  });

  it('push: rejects malformed target ID mismatch and falls back to generic notice', async () => {
    const { listeners, showNotification } = loadProductionWorker();

    const mismatchedEvent = {
      ...validB6Event,
      target: { kind: 'conversation_message', conversation_id: 9999, message_id: 999 },
    };

    let lifetime: Promise<unknown> | undefined;
    listeners.push({
      data: {
        json: () => ({
          data: { event: mismatchedEvent },
        }),
      },
      waitUntil: (p: Promise<unknown>) => {
        lifetime = p;
      },
    });

    await lifetime;

    expect(showNotification).toHaveBeenCalledWith(
      'ExoCore',
      expect.objectContaining({
        body: 'ExoCore有新消息',
        tag: 'exocore-generic-arrival',
      }),
    );
  });

  it('static architecture constraint: sw.js delegates arrival validation solely to workerContract without duplicate validator', () => {
    const content = readFileSync(resolve(process.cwd(), 'public', 'sw.js'), 'utf8');
    expect(content).not.toContain('function validateWorkerArrivalEvent');
    expect(content).not.toContain('isPositiveInt');
    expect(content).toContain('parseArrivalEvent');
  });

  it('arrival contract: enforces required typed ignore.allowed (missing/undefined/non-boolean fail; true/false pass)', () => {
    // 1. Missing property -> fail closed
    const { ignore: _omitted, ...missingIgnore } = validB6Event;
    const resMissing = parseArrivalEvent(missingIgnore);
    expect(resMissing.ok).toBe(false);
    if (!resMissing.ok) {
      expect(resMissing.error).toContain('ignore');
    }

    // 2. Explicit undefined -> fail closed
    const resUndefined = parseArrivalEvent({ ...validB6Event, ignore: undefined });
    expect(resUndefined.ok).toBe(false);

    // 3. Non-boolean allowed -> fail closed
    const resString = parseArrivalEvent({ ...validB6Event, ignore: { allowed: 'true' } });
    expect(resString.ok).toBe(false);
    const resMissingKey = parseArrivalEvent({ ...validB6Event, ignore: {} });
    expect(resMissingKey.ok).toBe(false);

    // 4. allowed=true -> valid
    const resTrue = parseArrivalEvent({ ...validB6Event, ignore: { allowed: true } });
    expect(resTrue.ok).toBe(true);
    if (resTrue.ok) {
      expect(resTrue.value.ignore).toEqual({ allowed: true });
    }

    // 5. allowed=false (ordinary chat) -> valid and must never infer from register_ack
    const resFalse = parseArrivalEvent({
      ...validB6Event,
      ignore: { allowed: false },
      register_ack: { register_id: 88, preset_id: 2 }, // legacy ACK present but ignore stays false!
    });
    expect(resFalse.ok).toBe(true);
    if (resFalse.ok) {
      expect(resFalse.value.ignore).toEqual({ allowed: false });
    }
  });

  it('arrival contract: enforces required nullable register_ack (missing/undefined fail, null/object pass)', () => {
    // 1. Missing property -> fail closed
    const { register_ack: _omitted, ...missingAck } = validB6Event;
    const resMissing = parseArrivalEvent(missingAck);
    expect(resMissing.ok).toBe(false);
    if (!resMissing.ok) {
      expect(resMissing.error).toContain('register_ack');
    }

    // 2. Explicit undefined -> fail closed
    const resUndefined = parseArrivalEvent({ ...validB6Event, register_ack: undefined });
    expect(resUndefined.ok).toBe(false);

    // 3. Explicit null -> valid
    const resNull = parseArrivalEvent({ ...validB6Event, register_ack: null });
    expect(resNull.ok).toBe(true);
    if (resNull.ok) {
      expect(resNull.value.register_ack).toBeNull();
    }

    // 4. Valid positive integer object -> valid
    const resValid = parseArrivalEvent({ ...validB6Event, register_ack: { register_id: 88, preset_id: 2 } });
    expect(resValid.ok).toBe(true);
    if (resValid.ok) {
      expect(resValid.value.register_ack).toEqual({ register_id: 88, preset_id: 2 });
    }

    // 5. Non-positive ID -> fail closed
    const resNegative = parseArrivalEvent({ ...validB6Event, register_ack: { register_id: -1, preset_id: 2 } });
    expect(resNegative.ok).toBe(false);
  });

  it('global purity: workerContract and sw.js avoid global publication or fallback resolution', () => {
    expect((globalThis as Record<string, unknown>).parseArrivalEvent).toBeUndefined();

    const swContent = readFileSync(resolve(process.cwd(), 'public', 'sw.js'), 'utf8');
    expect(swContent).not.toContain('resolveArrivalParser');
    expect(swContent).not.toContain('globalThis.parseArrivalEvent');
    expect(swContent).toContain('parseArrivalEvent(rawEvent)');
    expect(swContent).toContain('parseArrivalEvent(notifData?.event)');
  });
});
