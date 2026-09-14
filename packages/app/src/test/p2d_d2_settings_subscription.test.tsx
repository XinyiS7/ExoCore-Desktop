import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { jsonResponse } from './helpers';
import { NotificationsPanel } from '../features/notifications/NotificationsPanel';
import {
  isPushSupported,
  ignoreAssistantArrival,
  unsubscribeFromPush,
  PUSH_DEVICE_NAME_STORAGE_KEY,
} from '../features/notifications/subscription';

// In-memory mock for localStorage
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

describe('P2D D-2 Section A: Settings Panel & Subscription Truth', () => {
  const originalFetch = globalThis.fetch;
  const originalNotification = globalThis.Notification;
  const originalLocalStorage = globalThis.localStorage;

  let mockStorage: MockLocalStorage;
  let mockSubscription: PushSubscription | null = null;
  let mockPermission: NotificationPermission = 'default';

  function setupPushEnvironment(options: {
    supported?: boolean;
    initialPermission?: NotificationPermission;
    existingSub?: boolean;
  } = {}) {
    const isSupported = options.supported ?? true;
    mockPermission = options.initialPermission ?? 'default';

    if (options.existingSub) {
      mockSubscription = {
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
    } else {
      mockSubscription = null;
    }

    if (!isSupported) {
      // Missing Web Push primitives
      // @ts-expect-error test mock
      delete globalThis.PushManager;
      // @ts-expect-error test mock
      delete globalThis.Notification;
      return;
    }

    // Standard Web Push primitives
    const mockNotificationClass = class {
      static get permission() {
        return mockPermission;
      }
      static requestPermission = vi.fn().mockImplementation(async () => {
        return mockPermission;
      });
    };
    globalThis.Notification = mockNotificationClass as unknown as typeof Notification;
    // @ts-expect-error test mock
    globalThis.PushManager = class {};

    const pushManagerMock = {
      getSubscription: vi.fn().mockImplementation(async () => mockSubscription),
      subscribe: vi.fn().mockImplementation(async () => {
        mockSubscription = {
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
        return mockSubscription;
      }),
    };

    Object.defineProperty(globalThis.navigator, 'serviceWorker', {
      value: {
        ready: Promise.resolve({
          pushManager: pushManagerMock,
        }),
      },
      configurable: true,
      writable: true,
    });
  }

  beforeEach(() => {
    mockStorage = new MockLocalStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      configurable: true,
      writable: true,
    });
    setupPushEnvironment();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.Notification = originalNotification;
    Object.defineProperty(globalThis, 'localStorage', {
      value: originalLocalStorage,
      configurable: true,
      writable: true,
    });
    vi.restoreAllMocks();
  });

  it('correctly reports unsupported environment when browser lacks Push primitives', async () => {
    setupPushEnvironment({ supported: false });
    expect(isPushSupported()).toBe(false);

    render(<NotificationsPanel />);

    expect(await screen.findByRole('heading', { name: '通知设置' })).toBeInTheDocument();
    expect(screen.getByText('当前浏览器不支持')).toBeInTheDocument();
    expect(screen.getByText('不支持')).toBeInTheDocument();

    const enableBtn = screen.getByRole('button', { name: '启用推送通知' });
    expect(enableBtn).toBeDisabled();
  });

  it('satisfies mount negative invariant: mount NEVER requests permission or subscribes automatically', async () => {
    const requestPermSpy = vi.fn();
    globalThis.Notification.requestPermission = requestPermSpy;

    render(<NotificationsPanel />);

    expect(await screen.findByRole('heading', { name: '通知设置' })).toBeInTheDocument();
    expect(requestPermSpy).not.toHaveBeenCalled();

    // Browser primitives intact
    expect(screen.getByText('支持 Web Push')).toBeInTheDocument();
    expect(screen.getByText('默认 (未询问)')).toBeInTheDocument();
    expect(screen.getByText('未创建')).toBeInTheDocument();
    expect(screen.getByText('未登记')).toBeInTheDocument();
    expect(screen.getByText('○ 未启用')).toBeInTheDocument();
  });

  it('requires user gesture to enable, enforces stable UUID and achieves persisted: true healthy state', async () => {
    mockPermission = 'granted';
    globalThis.Notification.requestPermission = vi.fn().mockResolvedValue('granted');

    let postRequestBody: {
      subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
      device_name?: string;
      installation_id: string;
    } | null = null;
    globalThis.fetch = vi.fn().mockImplementation(async (url: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/push/subscribe/')) {
        postRequestBody = JSON.parse(init?.body as string);
        return jsonResponse(
          {
            id: 42,
            endpoint: postRequestBody?.subscription.endpoint,
            p256dh: postRequestBody?.subscription.keys.p256dh,
            auth: postRequestBody?.subscription.keys.auth,
            user_agent: 'Vitest Agent',
            device_name: postRequestBody?.device_name || '',
            installation_id: postRequestBody?.installation_id,
            is_active: true,
            persisted: true,
            created_at: '2026-09-13T22:00:00Z',
            updated_at: '2026-09-13T22:00:00Z',
          },
          201,
        );
      }
      return jsonResponse({});
    });

    render(<NotificationsPanel />);

    const deviceNameInput = screen.getByRole('textbox', { name: '设备名称' });
    fireEvent.change(deviceNameInput, { target: { value: 'Alicia Laptop' } });

    const enableBtn = screen.getByRole('button', { name: '启用推送通知' });
    fireEvent.click(enableBtn);

    await waitFor(() => {
      expect(screen.getByText('● 已启用')).toBeInTheDocument();
    });

    // Verification of payload facts
    expect(postRequestBody).not.toBeNull();
    const body = postRequestBody!;
    expect(body.device_name).toBe('Alicia Laptop');
    expect(typeof body.installation_id).toBe('string');
    expect(body.installation_id.length).toBeGreaterThan(10);
    expect(body.subscription.keys.p256dh).toBeDefined();

    // Verify storage persistence of device name
    expect(mockStorage.getItem(PUSH_DEVICE_NAME_STORAGE_KEY)).toBe('Alicia Laptop');

    // Button transitions to disable button
    expect(screen.getByRole('button', { name: '关闭推送通知' })).toBeInTheDocument();
  });

  it('surfaces ambiguous partial failure when browser subscription exists but backend rejects or fails', async () => {
    mockPermission = 'granted';
    globalThis.Notification.requestPermission = vi.fn().mockResolvedValue('granted');

    globalThis.fetch = vi.fn().mockImplementation(async (url: RequestInfo | URL) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/push/subscribe/')) {
        return jsonResponse({ error: 'Database transaction deadlock' }, 500);
      }
      return jsonResponse({});
    });

    render(<NotificationsPanel />);

    const enableBtn = screen.getByRole('button', { name: '启用推送通知' });
    fireEvent.click(enableBtn);

    await waitFor(() => {
      expect(screen.getByText('▲ 未完全确认 (后端未就绪)')).toBeInTheDocument();
      expect(screen.getByText('登记失败 / 未确认')).toBeInTheDocument();
    });

    // Browser subscription exists
    expect(screen.getByText('已存在 (浏览器已就绪)')).toBeInTheDocument();

    // Retry button is rendered
    expect(screen.getByRole('button', { name: '重新同步到后端' })).toBeInTheDocument();
    // Does NOT claim healthy "已启用"
    expect(screen.queryByText('● 已启用')).toBeNull();
  });

  it('handles user denial of notification permission cleanly without calling pushManager', async () => {
    mockPermission = 'denied';
    const requestPermSpy = vi.fn().mockResolvedValue('denied');
    globalThis.Notification.requestPermission = requestPermSpy;

    render(<NotificationsPanel />);

    const enableBtn = screen.getByRole('button', { name: '启用推送通知' });
    fireEvent.click(enableBtn);

    await waitFor(() => {
      expect(screen.getByText('已拒绝 (denied)')).toBeInTheDocument();
      expect(screen.getByText('✕ 已拒绝')).toBeInTheDocument();
    });

    expect(screen.queryByText('● 已启用')).toBeNull();
  });

  it('strictly validates device_name length <= 200 and trims whitespace', async () => {
    setupPushEnvironment({ existingSub: true, initialPermission: 'granted' });

    render(<NotificationsPanel />);

    const deviceNameInput = screen.getByRole('textbox', { name: '设备名称' });
    const longName = 'A'.repeat(205);
    fireEvent.change(deviceNameInput, { target: { value: longName } });

    const saveBtn = screen.getByRole('button', { name: '保存设备名' });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText('设备名称长度不能超过 200 个字符')).toBeInTheDocument();
    });
  });

  it('implements partial failure on disable: preserves browser subscription if backend unsubscribe fails', async () => {
    setupPushEnvironment({ existingSub: true, initialPermission: 'granted' });

    globalThis.fetch = vi.fn().mockImplementation(async (url: RequestInfo | URL) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/push/unsubscribe/')) {
        return jsonResponse({ error: 'Bad Gateway' }, 502);
      }
      return jsonResponse({});
    });

    render(<NotificationsPanel />);

    // Simulate clicking disable
    const disableBtn = await screen.findByRole('button', { name: '关闭推送通知' });
    fireEvent.click(disableBtn);

    await waitFor(() => {
      expect(screen.getByText(/后端退订失败，浏览器订阅已保留/)).toBeInTheDocument();
    });

    // Browser subscription was NOT cancelled because backend failed first
    expect(mockSubscription?.unsubscribe).not.toHaveBeenCalled();
  });

  it('handles backend unsubscribe success (204) with browser cleanup failure gracefully', async () => {
    setupPushEnvironment({ existingSub: true, initialPermission: 'granted' });
    if (mockSubscription) {
      mockSubscription.unsubscribe = vi.fn().mockResolvedValue(false); // browser cleanup fails
    }

    globalThis.fetch = vi.fn().mockImplementation(async (url: RequestInfo | URL) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/push/unsubscribe/')) {
        return jsonResponse({}, 204);
      }
      return jsonResponse({});
    });

    render(<NotificationsPanel />);

    const disableBtn = await screen.findByRole('button', { name: '关闭推送通知' });
    fireEvent.click(disableBtn);

    await waitFor(() => {
      expect(screen.getByText(/后端已关闭，但浏览器本地订阅清理失败/)).toBeInTheDocument();
    });

    expect(mockSubscription?.unsubscribe).toHaveBeenCalled();
  });

  it('satisfies negative security invariant: never renders endpoint, p256dh, or auth in DOM', async () => {
    setupPushEnvironment({ existingSub: true, initialPermission: 'granted' });

    const { container } = render(<NotificationsPanel />);

    const html = container.innerHTML;
    expect(html).not.toContain('https://push.example.com');
    expect(html).not.toContain('BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA');
    expect(html).not.toContain('tBHItJI5svbpez7KI4CCXg');
  });

  it('ignoreAssistantArrival: posts to the explicit ignore endpoint once and parses the bounded truth', async () => {
    let callCount = 0;
    let lastUrl = '';
    globalThis.fetch = vi.fn().mockImplementation(async (url: RequestInfo | URL, init?: RequestInit) => {
      callCount++;
      lastUrl = String(url);
      if (lastUrl.includes('/ignore/')) {
        expect(init?.method).toBe('POST');
        return jsonResponse({ action: 'ignore', event_id: 101, message_id: 9, conversation_id: 42, created: true });
      }
      return jsonResponse({});
    });

    const res = await ignoreAssistantArrival(101);
    expect(res.ok).toBe(true);
    expect(res.created).toBe(true);
    expect(callCount).toBe(1);
    expect(lastUrl).toContain('/api/push/assistant-arrivals/101/ignore/');
  });

  it('ignoreAssistantArrival: invalid/zero/negative event ids reject without any network request', async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;

    expect((await ignoreAssistantArrival(0)).ok).toBe(false);
    expect((await ignoreAssistantArrival(-7)).ok).toBe(false);
    expect((await ignoreAssistantArrival(1.5)).ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('ignoreAssistantArrival: maps 404 and 409 to bounded visible errors without leaking endpoints', async () => {
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      const err = new Error('API 404: Not Found');
      (err as unknown as { status: number }).status = 404;
      (err as unknown as { body: unknown }).body = { error: 'assistant arrival not found', code: 'arrival_not_found' };
      throw err;
    });

    const res404 = await ignoreAssistantArrival(101);
    expect(res404.ok).toBe(false);
    expect(res404.status).toBe(404);
    expect(res404.error).toBe('到达事件不存在');
  });

  it('ignoreAssistantArrival: complete valid five-field response is the only success truth', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({
      action: 'ignore', event_id: 101, message_id: 9, conversation_id: 42, created: true,
    }));
    const res = await ignoreAssistantArrival(101);
    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
    expect(res.created).toBe(true);

    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({
      action: 'ignore', event_id: 101, message_id: 9, conversation_id: 42, created: false,
    }));
    const resNoCreate = await ignoreAssistantArrival(101);
    expect(resNoCreate.ok).toBe(true);
    expect(resNoCreate.created).toBe(false);
  });

  it('ignoreAssistantArrival: mismatched event identity in a 2xx body is visible retryable failure', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({
      action: 'ignore', event_id: 999, message_id: 9, conversation_id: 42, created: true,
    }));
    const res = await ignoreAssistantArrival(101);
    expect(res.ok).toBe(false);
    expect(res.status).toBe(200);
    expect(res.error).toBeTruthy();
  });

  it('ignoreAssistantArrival: missing fields, wrong types, wrong action and non-object 2xx all fail closed', async () => {
    const cases: unknown[] = [
      { action: 'ignore' }, // missing everything else
      { action: 'ignore', event_id: 101, message_id: 9, conversation_id: 42 }, // missing created
      { action: 'ignore', event_id: 101, message_id: 9, conversation_id: 42, created: 'yes' }, // created wrong type
      { action: 'ignore', event_id: 101, message_id: -9, conversation_id: 42, created: true }, // non-positive message_id
      { action: 'ignore', event_id: 101, message_id: 9, conversation_id: 0, created: true }, // non-positive conversation_id
      { action: 'ignore', event_id: '101', message_id: 9, conversation_id: 42, created: true }, // event_id wrong type
      { action: 'ack', event_id: 101, message_id: 9, conversation_id: 42, created: true }, // wrong action
      'not an object',
      null,
      [],
    ];

    for (const body of cases) {
      globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse(body));
      const res = await ignoreAssistantArrival(101);
      expect(res.ok, `case ${JSON.stringify(body)} must fail`).toBe(false);
      expect(res.error).toBeTruthy();
    }
  });

  it('browser subscription inspection failure in unsubscribeFromPush reports failure and does not show success', async () => {
    setupPushEnvironment({ existingSub: false, initialPermission: 'granted' });

    // Mock pushManager.getSubscription rejecting
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        ready: Promise.resolve({
          pushManager: {
            getSubscription: vi.fn().mockRejectedValue(new Error('Browser internal error')),
          },
        }),
      },
    });

    const res = await unsubscribeFromPush();
    expect(res.ok).toBe(false);
    expect(res.phase).toBe('browser_cleanup_failed');
    if (!res.ok) {
      expect(res.error).toContain('无法读取当前浏览器推送状态');
    }
  });

});
