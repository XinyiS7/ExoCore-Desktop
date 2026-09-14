import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { jsonResponse } from './helpers';
import {
  ignoreAssistantArrival,
  subscribeToPush,
  syncExistingSubscription,
  unsubscribeFromPush,
} from '../features/notifications/subscription';

// ─────────────────────────────────────────────────────────────────────────────
// D3-R1-04 regression suite.
//
// 1. The HTTP 415 repair: notification POST call sites must hand native object
//    bodies to the real `apiFetch`, which then sets Content-Type: application/json
//    and serializes the object. Reverting the repair (pre-stringified bodies)
//    loses the effective JSON media type and fails these assertions.
//
// 2. The settings layout repair: `.settings-layout` must be column on mobile and
//    row on desktop (>= 768px), with the rail hidden on mobile and flex on
//    desktop. Reverting the repair fails these source-contract assertions.
// ─────────────────────────────────────────────────────────────────────────────

interface CapturedCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
}

class MockLocalStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get length(): number {
    return this.store.size;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
}

function makeSubscription(): PushSubscription {
  return {
    endpoint: 'https://push.example.com/v1/sub-12345',
    toJSON: () => ({
      endpoint: 'https://push.example.com/v1/sub-12345',
      keys: {
        p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9ic0AgtSBIPD18EET3TFmt5VNDNiufBK6USgh5uGURBVCE',
        auth: 'tBHItJI5svbpez7KI4CCXg',
      },
    }),
    unsubscribe: vi.fn().mockResolvedValue(true),
  } as unknown as PushSubscription;
}

function setupPushEnvironment(): void {
  const mockStorage = new MockLocalStorage();
  vi.stubGlobal('localStorage', mockStorage);

  const mockNotificationClass = class {
    static get permission() {
      return 'granted';
    }
    static requestPermission = vi.fn().mockImplementation(async () => 'granted');
  };
  vi.stubGlobal('Notification', mockNotificationClass);
  vi.stubGlobal('PushManager', class {});

  const pushManagerMock = {
    getSubscription: vi.fn().mockImplementation(async () => makeSubscription()),
    subscribe: vi.fn().mockImplementation(async () => makeSubscription()),
  };

  Object.defineProperty(globalThis.navigator, 'serviceWorker', {
    value: {
      ready: Promise.resolve({ pushManager: pushManagerMock }),
    },
    configurable: true,
  });
}

describe('D3-R1-04 regression: effective JSON media type & object serialization on Push API calls', () => {
  const originalFetch = globalThis.fetch;

  let captured: CapturedCall[] = [];

  beforeEach(() => {
    captured = [];
    setupPushEnvironment();

    globalThis.fetch = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      captured.push({
        url,
        method: (init?.method ?? 'GET').toUpperCase(),
        headers: (init?.headers ?? {}) as Record<string, string>,
        body: init?.body ? String(init.body) : null,
      });

      if (url.includes('/api/push/subscribe/')) {
        const parsed = init?.body ? JSON.parse(String(init.body)) : {};
        return jsonResponse(
          {
            id: 42,
            endpoint: parsed?.subscription?.endpoint,
            p256dh: parsed?.subscription?.keys?.p256dh,
            auth: parsed?.subscription?.keys?.auth,
            user_agent: 'Vitest Agent',
            device_name: parsed?.device_name || '',
            installation_id: parsed?.installation_id,
            is_active: true,
            persisted: true,
            created_at: '2026-09-13T22:00:00Z',
            updated_at: '2026-09-13T22:00:00Z',
          },
          201,
        );
      }
      if (url.includes('/api/push/assistant-arrivals/') && url.includes('/ignore/')) {
        return jsonResponse({
          action: 'ignore',
          event_id: 101,
          message_id: 9,
          conversation_id: 42,
          created: true,
        });
      }
      return jsonResponse({});
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function assertJsonObjectCall(urlPattern: string, expectedBody: Record<string, unknown>) {
    const calls = captured.filter((c) => new RegExp(urlPattern).test(c.url));
    expect(calls, `expected a call to ${urlPattern}`).toHaveLength(1);
    const call = calls[0];
    expect(call.method).toBe('POST');
    expect(call.headers['Content-Type'] ?? call.headers['content-type']).toBe('application/json');
    expect(call.body, 'body must be a serialized object, not a pre-stringified string').toBeTypeOf('string');
    const parsed = JSON.parse(call.body as string);
    expect(parsed).toBeTypeOf('object');
    expect(parsed).toEqual(expectedBody);
  }

  it('subscribeToPush passes an object body and the effective request media type is application/json', async () => {
    const result = await subscribeToPush('Alicia Laptop');
    expect(result.ok).toBe(true);

    const call = captured.find((c) => c.url.includes('/api/push/subscribe/'));
    expect(call).toBeTruthy();
    expect(call?.headers['Content-Type'] ?? call?.headers['content-type']).toBe('application/json');
    const body = JSON.parse(call?.body as string);
    expect(body).toBeTypeOf('object');
    expect(body.subscription.endpoint).toBe('https://push.example.com/v1/sub-12345');
    expect(body.device_name).toBe('Alicia Laptop');
    expect(typeof body.installation_id).toBe('string');
  });

  it('syncExistingSubscription (updateDeviceName path) keeps object bodies with JSON media type', async () => {
    const result = await syncExistingSubscription('Alicia Laptop');
    expect(result.ok).toBe(true);

    const calls = captured.filter((c) => /\/api\/push\/subscribe\/$/.test(c.url));
    expect(calls).toHaveLength(1);
    const call = calls[0];
    expect(call.method).toBe('POST');
    expect(call.headers['Content-Type'] ?? call.headers['content-type']).toBe('application/json');
    const parsed = JSON.parse(call.body as string);
    expect(parsed).toBeTypeOf('object');
    expect(parsed).toMatchObject({
      device_name: 'Alicia Laptop',
      subscription: { endpoint: 'https://push.example.com/v1/sub-12345' },
    });
    expect(typeof parsed.installation_id).toBe('string');
  });

  it('unsubscribeFromPush passes { endpoint } as an object with JSON media type', async () => {
    const result = await unsubscribeFromPush();
    expect(result.ok).toBe(true);

    const call = captured.find((c) => c.url.includes('/api/push/unsubscribe/'));
    expect(call).toBeTruthy();
    expect(call?.method).toBe('POST');
    expect(call?.headers['Content-Type'] ?? call?.headers['content-type']).toBe('application/json');
    const body = JSON.parse(call?.body as string);
    expect(body).toEqual({ endpoint: 'https://push.example.com/v1/sub-12345' });
  });

  it('ignoreAssistantArrival passes an object body with JSON media type to the ignore endpoint', async () => {
    const result = await ignoreAssistantArrival(101);
    expect(result.ok).toBe(true);

    assertJsonObjectCall('/api/push/assistant-arrivals/101/ignore/', {});
  });
});

describe('D3-R1-04 regression: settings layout column/row breakpoint at 768px', () => {
  function loadSettingsCss(): string {
    return readFileSync(resolve(process.cwd(), 'src/features/settings/settings.css'), 'utf8');
  }

  /** Extract the inner content of the Nth block (brace-matched) for a given query string. */
  function extractBlocks(css: string, query: string): string[] {
    const blocks: string[] = [];
    let searchFrom = 0;
    for (;;) {
      const qIdx = css.indexOf(query, searchFrom);
      if (qIdx === -1) break;
      const open = css.indexOf('{', qIdx);
      if (open === -1) break;
      let depth = 0;
      let end = -1;
      for (let i = open; i < css.length; i++) {
        if (css[i] === '{') depth++;
        else if (css[i] === '}') {
          depth--;
          if (depth === 0) {
            end = i;
            break;
          }
        }
      }
      if (end === -1) break;
      blocks.push(css.slice(open + 1, end));
      searchFrom = end + 1;
    }
    return blocks;
  }

  /** Assert a `prop: value` declaration exists inside the brace-matched rule for a selector. */
  function ruleDeclares(scope: string, selector: string, prop: string, value: string): boolean {
    let searchFrom = 0;
    for (;;) {
      const selIdx = scope.indexOf(selector, searchFrom);
      if (selIdx === -1) return false;
      const open = scope.indexOf('{', selIdx);
      if (open === -1) return false;
      let depth = 0;
      let end = -1;
      for (let i = open; i < scope.length; i++) {
        if (scope[i] === '{') depth++;
        else if (scope[i] === '}') {
          depth--;
          if (depth === 0) {
            end = i;
            break;
          }
        }
      }
      if (end === -1) return false;
      const ruleBody = scope.slice(open + 1, end);
      if (new RegExp(`${prop}\\s*:\\s*${value}`).test(ruleBody)) return true;
      searchFrom = end + 1;
    }
  }

  it('base rules keep the layout column on mobile and hide the rail', () => {
    const css = loadSettingsCss();
    const mediaBlocks = extractBlocks(css, '@media (min-width: 768px)');
    const baseCss = mediaBlocks.reduce((acc, block) => acc.replace(block, ''), css);

    expect(ruleDeclares(baseCss, '.settings-layout', 'flex-direction', 'column')).toBe(true);
    expect(ruleDeclares(baseCss, '.settings-rail', 'display', 'none')).toBe(true);
  });

  it('desktop >=768px media query restores row layout and flex rail', () => {
    const css = loadSettingsCss();
    const mediaBlocks = extractBlocks(css, '@media (min-width: 768px)');
    expect(mediaBlocks.length).toBeGreaterThanOrEqual(1);

    const anyBlock = mediaBlocks.join('\n');
    expect(ruleDeclares(anyBlock, '.settings-layout', 'flex-direction', 'row')).toBe(true);
    expect(ruleDeclares(anyBlock, '.settings-rail', 'display', 'flex')).toBe(true);
  });

  it('the column default must not be the only rule (media override must exist)', () => {
    const css = loadSettingsCss();
    const mediaBlocks = extractBlocks(css, '@media (min-width: 768px)');
    const baseCss = mediaBlocks.reduce((acc, block) => acc.replace(block, ''), css);

    expect(ruleDeclares(baseCss, '.settings-layout', 'flex-direction', 'column')).toBe(true);
    expect(ruleDeclares(mediaBlocks.join('\n'), '.settings-layout', 'flex-direction', 'row')).toBe(true);
  });
});
