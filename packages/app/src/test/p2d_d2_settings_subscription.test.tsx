import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { jsonResponse } from './helpers';
import { NotificationsPanel } from '../features/notifications/NotificationsPanel';
import {
  isPushSupported,
  sendRegisterAck,
  unsubscribeFromPush,
  clearAckRegistryForTest,
  reloadAckRegistryForTest,
  recordAckOutcome,
  retryPendingAcks,
  getAckDiagnostics,
  getAckStorageDiagnostics,
  ACK_STORAGE_KEY,
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

  it('sends Register ACK idempotently and handles terminal errors (400, 404) gracefully', async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(async (url: RequestInfo | URL) => {
      callCount++;
      const urlStr = String(url);
      if (urlStr.includes('/ack/')) {
        return jsonResponse({ id: 99, content: 'ACKed' }, 200);
      }
      return jsonResponse({});
    });

    const ack = { register_id: 101, preset_id: 1 };

    // First call: succeeds
    const res1 = await sendRegisterAck(ack, 'navigate');
    expect(res1.ok).toBe(true);
    expect(callCount).toBe(1);

    // Second call for identical event & action: deduplicated in-memory!
    const res2 = await sendRegisterAck(ack, 'navigate');
    expect(res2.ok).toBe(true);
    expect(callCount).toBe(1); // Not called twice!

    // Null register_ack safely no-ops without calling fetch
    const resNull = await sendRegisterAck(null, 'dismiss');
    expect(resNull.ok).toBe(false);
    expect(callCount).toBe(1);
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

  it('concurrent in-flight calls to sendRegisterAck join the same request promise', async () => {
    clearAckRegistryForTest();
    let settle!: (res: Response) => void;
    const responsePromise = new Promise<Response>((resolve) => {
      settle = resolve;
    });

    const fetchSpy = vi.fn().mockReturnValue(responsePromise);
    globalThis.fetch = fetchSpy;

    const ack = { register_id: 202, preset_id: 1 };
    const p1 = sendRegisterAck(ack, 'navigate', 'https://push.example.com/test');
    const p2 = sendRegisterAck(ack, 'navigate', 'https://push.example.com/test');

    settle(jsonResponse({ id: 202, content: 'ACK' }, 200));
    const [res1, res2] = await Promise.all([p1, p2]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(res1.ok).toBe(true);
    expect(res2.ok).toBe(true);
  });

  it('recordAckOutcome: typed runtime validation rejects invalid shapes and records valid inputs', () => {
    clearAckRegistryForTest();

    // Invalid register_id
    recordAckOutcome({ register_id: -1, preset_id: 1 }, 'navigate', { status: 'sent' });
    expect(getAckDiagnostics()).toHaveLength(0);

    // Invalid preset_id
    recordAckOutcome({ register_id: 10, preset_id: 0 }, 'navigate', { status: 'sent' });
    expect(getAckDiagnostics()).toHaveLength(0);

    // Invalid action
    recordAckOutcome({ register_id: 10, preset_id: 1 }, 'invalid_action', { status: 'sent' });
    expect(getAckDiagnostics()).toHaveLength(0);

    // Valid failed_retryable record
    recordAckOutcome({ register_id: 101, preset_id: 2 }, 'navigate', {
      status: 'failed_retryable',
      error: 'Network timeout',
    });
    const diags = getAckDiagnostics();
    expect(diags).toHaveLength(1);
    expect(diags[0].register_id).toBe(101);
    expect(diags[0].preset_id).toBe(2);
    expect(diags[0].status).toBe('failed_retryable');
  });

  it('ACK storage corruption isolation: corrupted JSON isolates corruption without crashing', () => {
    clearAckRegistryForTest();
    localStorage.setItem(ACK_STORAGE_KEY, '{ broken-json-syntax');

    reloadAckRegistryForTest();

    const storageDiag = getAckStorageDiagnostics();
    expect(storageDiag.status).toBe('corrupted');
    expect(storageDiag.error).toContain('ACK 注册表 JSON 损坏并隔离');

    const diags = getAckDiagnostics();
    expect(diags.some((d) => d.status === 'failed_terminal')).toBe(true);
  });

  it('ACK storage quota resilience: localStorage QuotaExceeded sets status unavailable without throw', () => {
    clearAckRegistryForTest();

    const originalSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = () => {
      throw new Error('QuotaExceededError: storage quota exceeded');
    };

    try {
      recordAckOutcome({ register_id: 10, preset_id: 1 }, 'navigate', {
        status: 'failed_retryable',
        error: 'Network error',
      });
      const diag = getAckStorageDiagnostics();
      expect(diag.status).toBe('unavailable');
      expect(diag.error).toContain('配额超限或存储禁用');
    } finally {
      localStorage.setItem = originalSetItem;
    }
  });

  it('sendRegisterAck: independently rejects non-positive IDs (<= 0) without issuing network fetch', async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;

    // Negative register_id
    const resNeg = await sendRegisterAck({ register_id: -7, preset_id: 1 }, 'navigate');
    expect(resNeg.ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();

    // Zero register_id
    const resZero = await sendRegisterAck({ register_id: 0, preset_id: 1 }, 'navigate');
    expect(resZero.ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();

    // Zero preset_id
    const resZeroPreset = await sendRegisterAck({ register_id: 10, preset_id: 0 }, 'navigate');
    expect(resZeroPreset.ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('ACK hydration: isolates corrupted/negative/mismatched/NaN entries and halts all network retries', async () => {
    clearAckRegistryForTest();

    // Store array with negative ID, mismatched key, NaN timestamp, malformed optional field, alongside one valid
    const mixedRecords = [
      {
        key: '1:1:navigate',
        register_id: 1,
        preset_id: 1,
        action: 'navigate',
        status: 'failed_retryable',
        lastAttemptAt: 1000,
      },
      {
        key: '-7:1:navigate',
        register_id: -7, // invalid negative ID!
        preset_id: 1,
        action: 'navigate',
        status: 'failed_retryable',
        lastAttemptAt: 1000,
      },
      {
        key: 'wrong_key', // mismatched key!
        register_id: 2,
        preset_id: 1,
        action: 'navigate',
        status: 'failed_retryable',
        lastAttemptAt: 1000,
      },
      {
        key: '3:1:navigate',
        register_id: 3,
        preset_id: 1,
        action: 'navigate',
        status: 'failed_retryable',
        lastAttemptAt: NaN, // non-finite timestamp!
      },
      {
        key: '4:1:navigate',
        register_id: 4,
        preset_id: 1,
        action: 'navigate',
        status: 'failed_retryable',
        lastAttemptAt: 1000,
        statusCode: 'invalid_string_status', // malformed optional field!
      },
    ];
    localStorage.setItem(ACK_STORAGE_KEY, JSON.stringify(mixedRecords));

    reloadAckRegistryForTest();

    const storageDiag = getAckStorageDiagnostics();
    expect(storageDiag.status).toBe('corrupted');
    expect(storageDiag.error).toContain('包含非法格式条目并已隔离');

    // Network retry attempt must be completely halted (0 network calls)
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;

    await retryPendingAcks();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('ACK hydration: reloads valid retryable records and successfully executes network retry', async () => {
    clearAckRegistryForTest();

    const validRecords = [
      {
        key: '10:1:navigate',
        register_id: 10,
        preset_id: 1,
        action: 'navigate',
        status: 'failed_retryable',
        lastAttemptAt: 1000,
      },
    ];
    localStorage.setItem(ACK_STORAGE_KEY, JSON.stringify(validRecords));

    reloadAckRegistryForTest();

    const storageDiag = getAckStorageDiagnostics();
    expect(storageDiag.status).toBe('ok');

    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse({ id: 10, content: 'ACK' }, 200));
    globalThis.fetch = fetchSpy;

    await retryPendingAcks();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/agents/registers/10/ack/?preset_id=1'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ action: 'navigate' }),
      }),
    );

    const diags = getAckDiagnostics();
    expect(diags).toHaveLength(0); // All retries cleared to 'sent'
  });
});
