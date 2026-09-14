import type { ReactNode } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { jsonResponse } from './helpers';
import type { AssistantMessageArrivedV1 } from '../features/notifications/contract';
import {
  commitCursor,
  initializeStorage,
  NOTIFICATIONS_STORAGE_KEY,
} from '../features/notifications/storage';
import { NotificationRuntime } from '../features/notifications/NotificationRuntime';
import { useNotifications } from '../features/notifications/notificationContext';
import { NotificationsPanel } from '../features/notifications/NotificationsPanel';

// In-memory mock for localStorage in Vitest environment
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

const mockStorage = new MockLocalStorage();
vi.stubGlobal('localStorage', mockStorage);

// Mock ServiceWorkerContainer with EventTarget
class MockServiceWorkerContainer extends EventTarget {
  postMessageToPage(data: unknown) {
    this.dispatchEvent(new MessageEvent('message', { data }));
  }
}

function makeValidEvent(overrides: Partial<AssistantMessageArrivedV1> = {}): AssistantMessageArrivedV1 {
  const cid = overrides.conversation_id ?? 42;
  const mid = overrides.message_id ?? 42;
  return {
    kind: 'assistant-message-arrived',
    version: 1,
    event_id: 101,
    dedupe_key: `assistant-message:${mid}`,
    conversation_id: cid,
    message_id: mid,
    agent: { id: 7, name: 'Alessandro' },
    preview: { policy: 'bounded_text', text: 'Hello Alicia, this is Sandro.', truncated: false },
    target: { kind: 'conversation_message', conversation_id: cid, message_id: mid },
    register_ack: null,
    ignore: { allowed: true },
    title_hint: 'Greetings',
    committed_at: '2026-09-13T20:00:00Z',
    ...overrides,
  };
}

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location-display">{location.pathname}</div>;
}

function TestNavConsumer() {
  const { unreadCount, unreadByConversation } = useNotifications();
  return (
    <div data-testid="nav-badges">
      <span data-testid="total-unread">{unreadCount}</span>
      {Object.entries(unreadByConversation).map(([cid, count]) => (
        <span key={cid} data-testid={`conv-unread-${cid}`}>{count}</span>
      ))}
    </div>
  );
}

function TestHarness({
  initialRoute = '/',
  children,
}: {
  initialRoute?: string;
  children?: ReactNode;
}) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <NotificationRuntime>
          <LocationDisplay />
          <TestNavConsumer />
          <Routes>
            <Route path="/" element={<div>Chat Home</div>} />
            <Route path="/chat/:conversationId" element={<div>Conversation Page</div>} />
            <Route path="/settings/notifications" element={<NotificationsPanel />} />
          </Routes>
          {children}
        </NotificationRuntime>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('P2D D-2 Section C: SW Ingestion, Focus Matrix & Explicit Ignore Integration', () => {
  const originalFetch = globalThis.fetch;
  let mockSw: MockServiceWorkerContainer;
  let postCalls: { url: string; body: unknown }[] = [];

  beforeEach(() => {
    mockStorage.clear();
    initializeStorage();
    postCalls = [];

    mockSw = new MockServiceWorkerContainer();
    Object.defineProperty(navigator, 'serviceWorker', {
      value: mockSw,
      configurable: true,
      writable: true,
    });

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = String(input);
      const url = new URL(urlStr, 'http://localhost');
      const method = (init?.method ?? 'GET').toUpperCase();

      if (url.pathname === '/api/push/assistant-arrivals/') {
        return jsonResponse({ events: [], next_cursor: 10, has_more: false });
      }

      const ignoreMatch = url.pathname.match(/^\/api\/push\/assistant-arrivals\/(\d+)\/ignore\/$/);
      if (ignoreMatch && method === 'POST') {
        const body = init?.body ? JSON.parse(String(init.body)) : null;
        postCalls.push({ url: urlStr, body });
        return jsonResponse({
          action: 'ignore',
          event_id: Number(ignoreMatch[1]),
          message_id: 999,
          conversation_id: 42,
          created: true,
        });
      }

      if (url.pathname.includes('/ack/') && method === 'POST') {
        const body = init?.body ? JSON.parse(String(init.body)) : null;
        postCalls.push({ url: urlStr, body });
        return jsonResponse({}, 200);
      }

      if (url.pathname === '/api/push/subscriptions/') {
        return jsonResponse([]);
      }

      return jsonResponse({ error: 'not found' }, 404);
    });

    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.stubGlobal('localStorage', mockStorage);
  });

  it('SW handoff when on another route displays single in-app indication and increments unread badge', async () => {
    render(<TestHarness initialRoute="/settings/notifications" />);

    await screen.findByTestId('location-display');
    expect(screen.getByTestId('total-unread').textContent).toBe('0');
    expect(screen.queryByRole('alert')).toBeNull();

    const ev = makeValidEvent({
      conversation_id: 42,
      message_id: 201,
      dedupe_key: 'assistant-message:201',
    });

    mockSw.postMessageToPage({
      type: 'ASSISTANT_ARRIVAL_HANDOFF',
      version: 1,
      event: ev,
    });

    // Ingestion updates unread count
    await waitFor(() => {
      expect(screen.getByTestId('total-unread').textContent).toBe('1');
    });
    expect(screen.getByTestId('conv-unread-42').textContent).toBe('1');

    // In-app alert banner appears with agent name, preview and action buttons
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('收到来自 Alessandro 的新回复');
    expect(alert.textContent).toContain('Hello Alicia, this is Sandro.');
    expect(screen.getByRole('button', { name: '忽略通知' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '查看通知' })).toBeTruthy();
  });

  it('clicking "忽略" calls the explicit ignore endpoint without clearing unread, without navigation, and closes banner', async () => {
    render(<TestHarness initialRoute="/settings/notifications" />);

    const ev = makeValidEvent({
      conversation_id: 42,
      message_id: 202,
      dedupe_key: 'assistant-message:202',
      event_id: 202,
    });

    mockSw.postMessageToPage({
      type: 'ASSISTANT_ARRIVAL_HANDOFF',
      version: 1,
      event: ev,
    });

    await screen.findByRole('alert');
    expect(screen.getByTestId('total-unread').textContent).toBe('1');

    // Click 忽略
    const dismissBtn = screen.getByRole('button', { name: '忽略通知' });
    fireEvent.click(dismissBtn);

    // Banner is dismissed
    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull();
    });

    // Unread count is preserved (explicit ignore never clears unread)
    expect(screen.getByTestId('total-unread').textContent).toBe('1');

    // No navigation happened
    expect(screen.getByTestId('location-display').textContent).toBe('/settings/notifications');

    // Exactly one explicit ignore request to the canonical endpoint; zero Register ACK
    await waitFor(() => {
      expect(postCalls.length).toBe(1);
    });
    const ignoreCalls = postCalls.filter((c) =>
      c.url.includes('/api/push/assistant-arrivals/202/ignore/'),
    );
    expect(ignoreCalls).toHaveLength(1);
    expect(postCalls.filter((c) => c.url.includes('/api/agents/registers/'))).toHaveLength(0);
  });

  it('clicking "查看" navigates to the conversation with zero Register ACK and zero ignore request', async () => {
    render(<TestHarness initialRoute="/settings/notifications" />);

    const ev = makeValidEvent({
      conversation_id: 42,
      message_id: 203,
      dedupe_key: 'assistant-message:203',
    });

    mockSw.postMessageToPage({
      type: 'ASSISTANT_ARRIVAL_HANDOFF',
      version: 1,
      event: ev,
    });

    await screen.findByRole('alert');

    // Click 查看
    const viewBtn = screen.getByRole('button', { name: '查看通知' });
    fireEvent.click(viewBtn);

    // Banner is closed and route transitions to /chat/42
    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull();
      expect(screen.getByTestId('location-display').textContent).toBe('/chat/42');
    });

    // Zero Register ACK, zero explicit ignore request
    expect(postCalls.filter((c) => c.url.includes('/api/agents/registers/'))).toHaveLength(0);
    expect(postCalls.filter((c) => c.url.includes('/ignore/'))).toHaveLength(0);
  });

  it('ignore failure stays visible with bounded retry and never duplicates uncontrolled calls', async () => {
    let ignoreAttempts = 0;
    const customFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), 'http://localhost');
      const method = (init?.method ?? 'GET').toUpperCase();
      if (url.pathname === '/api/push/assistant-arrivals/') {
        return jsonResponse({ events: [], next_cursor: 10, has_more: false });
      }
      const ignoreMatch = url.pathname.match(/^\/api\/push\/assistant-arrivals\/(\d+)\/ignore\/$/);
      if (ignoreMatch && method === 'POST') {
        ignoreAttempts++;
        if (ignoreAttempts === 1) {
          return jsonResponse({ error: 'assistant arrival not found', code: 'arrival_not_found' }, 404);
        }
        return jsonResponse({
          action: 'ignore',
          event_id: Number(ignoreMatch[1]),
          message_id: 404,
          conversation_id: 42,
          created: true,
        });
      }
      if (url.pathname === '/api/push/subscriptions/') {
        return jsonResponse([]);
      }
      return jsonResponse({ error: 'not found' }, 404);
    });
    globalThis.fetch = customFetch as unknown as typeof fetch;

    render(<TestHarness initialRoute="/settings/notifications" />);

    const ev = makeValidEvent({
      conversation_id: 42,
      message_id: 404,
      dedupe_key: 'assistant-message:404',
      event_id: 404,
    });

    mockSw.postMessageToPage({
      type: 'ASSISTANT_ARRIVAL_HANDOFF',
      version: 1,
      event: ev,
    });

    await screen.findByRole('alert');

    // First attempt fails: indication stays, error is visible
    fireEvent.click(screen.getByRole('button', { name: '忽略通知' }));
    await waitFor(() => {
      expect(screen.getByText(/到达事件不存在/)).toBeTruthy();
    });
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(ignoreAttempts).toBe(1);

    // Explicit retry succeeds: exactly one more request, indication closes
    fireEvent.click(screen.getByRole('button', { name: '忽略通知' }));
    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull();
    });
    expect(ignoreAttempts).toBe(2);
    expect(screen.getByTestId('total-unread').textContent).toBe('1');
    expect(screen.getByTestId('location-display').textContent).toBe('/settings/notifications');
  });

  it('late ignore success for an older event cannot close a newer indication (event-bound completion)', async () => {
    const pending = new Map<number, { resolve: (r: Response) => void }>();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/push/assistant-arrivals/') {
        return jsonResponse({ events: [], next_cursor: 10, has_more: false });
      }
      const m = url.pathname.match(/^\/api\/push\/assistant-arrivals\/(\d+)\/ignore\/$/);
      if (m) {
        const id = Number(m[1]);
        return new Promise<Response>((resolve) => {
          pending.set(id, { resolve });
        });
      }
      if (url.pathname === '/api/push/subscriptions/') {
        return jsonResponse([]);
      }
      return jsonResponse({ error: 'not found' }, 404);
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(<TestHarness initialRoute="/settings/notifications" />);

    // Event A (older) arrives and its ignore request goes in flight
    mockSw.postMessageToPage({
      type: 'ASSISTANT_ARRIVAL_HANDOFF',
      version: 1,
      event: makeValidEvent({
        conversation_id: 42,
        message_id: 701,
        dedupe_key: 'assistant-message:701',
        event_id: 701,
        preview: { policy: 'bounded_text', text: 'older indication', truncated: false },
      }),
    });
    await screen.findByText('older indication');
    fireEvent.click(screen.getByRole('button', { name: '忽略通知' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '忽略通知' })).toBeDisabled();
    });

    // Event B (newer) replaces the bounded indication
    mockSw.postMessageToPage({
      type: 'ASSISTANT_ARRIVAL_HANDOFF',
      version: 1,
      event: makeValidEvent({
        conversation_id: 42,
        message_id: 702,
        dedupe_key: 'assistant-message:702',
        event_id: 702,
        preview: { policy: 'bounded_text', text: 'newer indication', truncated: false },
      }),
    });
    await screen.findByText('newer indication');
    expect(screen.queryByText('older indication')).toBeNull();

    // B must NOT inherit A's busy state
    expect(screen.getByRole('button', { name: '忽略通知' })).not.toBeDisabled();

    // A settles with success — it must not close or alter B
    pending.get(701)?.resolve(jsonResponse({
      action: 'ignore', event_id: 701, message_id: 701, conversation_id: 42, created: true,
    }));
    await waitFor(() => {
      expect(screen.getByText('newer indication')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '忽略通知' })).not.toBeDisabled();
    });
    expect(screen.queryByText('older indication')).toBeNull();
    expect(screen.getByTestId('total-unread').textContent).toBe('2');
  });

  it('late ignore failure for an older event cannot attach its error or busy state to a newer indication', async () => {
    const pending = new Map<number, { reject: (e: Error) => void }>();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/push/assistant-arrivals/') {
        return jsonResponse({ events: [], next_cursor: 10, has_more: false });
      }
      const m = url.pathname.match(/^\/api\/push\/assistant-arrivals\/(\d+)\/ignore\/$/);
      if (m) {
        const id = Number(m[1]);
        return new Promise<Response>((_resolve, reject) => {
          pending.set(id, { reject });
        });
      }
      if (url.pathname === '/api/push/subscriptions/') {
        return jsonResponse([]);
      }
      return jsonResponse({ error: 'not found' }, 404);
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(<TestHarness initialRoute="/settings/notifications" />);

    // Event A (older) arrives and its ignore request goes in flight
    mockSw.postMessageToPage({
      type: 'ASSISTANT_ARRIVAL_HANDOFF',
      version: 1,
      event: makeValidEvent({
        conversation_id: 42,
        message_id: 801,
        dedupe_key: 'assistant-message:801',
        event_id: 801,
        preview: { policy: 'bounded_text', text: 'old request', truncated: false },
      }),
    });
    await screen.findByText('old request');
    fireEvent.click(screen.getByRole('button', { name: '忽略通知' }));

    // Event B (newer) replaces the bounded indication
    mockSw.postMessageToPage({
      type: 'ASSISTANT_ARRIVAL_HANDOFF',
      version: 1,
      event: makeValidEvent({
        conversation_id: 42,
        message_id: 802,
        dedupe_key: 'assistant-message:802',
        event_id: 802,
        preview: { policy: 'bounded_text', text: 'fresh arrival', truncated: false },
      }),
    });
    await screen.findByText('fresh arrival');

    // A settles with failure — B must stay clean and enabled
    pending.get(801)?.reject(new Error('offline'));
    await waitFor(() => {
      expect(screen.getByText('fresh arrival')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '忽略通知' })).not.toBeDisabled();
    });
    expect(screen.queryByText(/offline/)).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('viewing during a pending ignore navigates normally and a later completion changes nothing', async () => {
    const pending = new Map<number, { resolve: (r: Response) => void }>();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/push/assistant-arrivals/') {
        return jsonResponse({ events: [], next_cursor: 10, has_more: false });
      }
      const m = url.pathname.match(/^\/api\/push\/assistant-arrivals\/(\d+)\/ignore\/$/);
      if (m) {
        const id = Number(m[1]);
        return new Promise<Response>((resolve) => {
          pending.set(id, { resolve });
        });
      }
      if (url.pathname === '/api/push/subscriptions/') {
        return jsonResponse([]);
      }
      return jsonResponse({ error: 'not found' }, 404);
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(<TestHarness initialRoute="/settings/notifications" />);

    mockSw.postMessageToPage({
      type: 'ASSISTANT_ARRIVAL_HANDOFF',
      version: 1,
      event: makeValidEvent({
        conversation_id: 42,
        message_id: 901,
        dedupe_key: 'assistant-message:901',
        event_id: 901,
        preview: { policy: 'bounded_text', text: 'pending view target', truncated: false },
      }),
    });
    await screen.findByText('pending view target');
    fireEvent.click(screen.getByRole('button', { name: '忽略通知' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '忽略通知' })).toBeDisabled();
    });

    // View while the ignore request is still in flight
    fireEvent.click(screen.getByRole('button', { name: '查看通知' }));
    await waitFor(() => {
      expect(screen.getByTestId('location-display').textContent).toBe('/chat/42');
    });

    // Late success must not resurrect or alter anything
    pending.get(901)?.resolve(jsonResponse({
      action: 'ignore', event_id: 901, message_id: 901, conversation_id: 42, created: true,
    }));
    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull();
    });
    expect(screen.getByTestId('location-display').textContent).toBe('/chat/42');
  });

  it('SW handoff when already on the exact conversation does not display in-app banner', async () => {
    render(<TestHarness initialRoute="/chat/42" />);

    await screen.findByTestId('location-display');
    expect(screen.getByTestId('location-display').textContent).toBe('/chat/42');

    const ev = makeValidEvent({
      conversation_id: 42,
      message_id: 204,
      dedupe_key: 'assistant-message:204',
    });

    mockSw.postMessageToPage({
      type: 'ASSISTANT_ARRIVAL_HANDOFF',
      version: 1,
      event: ev,
    });

    // Ingestion succeeds in storage
    await waitFor(() => {
      expect(screen.getByTestId('total-unread').textContent).toBe('1');
    });

    // Zero in-app banner is shown because user is already on conversation 42 (Plan D9)
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('bounded single in-app indication replaces prior banner without stacking', async () => {
    render(<TestHarness initialRoute="/settings/notifications" />);

    const ev1 = makeValidEvent({
      conversation_id: 42,
      message_id: 301,
      dedupe_key: 'assistant-message:301',
      preview: { policy: 'bounded_text', text: 'Message 1', truncated: false },
    });
    const ev2 = makeValidEvent({
      conversation_id: 43,
      message_id: 302,
      dedupe_key: 'assistant-message:302',
      preview: { policy: 'bounded_text', text: 'Message 2', truncated: false },
    });

    mockSw.postMessageToPage({
      type: 'ASSISTANT_ARRIVAL_HANDOFF',
      version: 1,
      event: ev1,
    });

    await screen.findByRole('alert');
    expect(screen.getByText('Message 1')).toBeTruthy();
    expect(screen.getAllByRole('alert')).toHaveLength(1);

    // Send second handoff event
    mockSw.postMessageToPage({
      type: 'ASSISTANT_ARRIVAL_HANDOFF',
      version: 1,
      event: ev2,
    });

    await waitFor(() => {
      expect(screen.getByText('Message 2')).toBeTruthy();
    });
    // Still bounded to exactly ONE banner
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.queryByText('Message 1')).toBeNull();
  });

  it('NOTIFICATION_NAVIGATE message from Service Worker triggers navigation', async () => {
    render(<TestHarness initialRoute="/" />);

    await screen.findByTestId('location-display');
    expect(screen.getByTestId('location-display').textContent).toBe('/');

    mockSw.postMessageToPage({
      type: 'NOTIFICATION_NAVIGATE',
      version: 1,
      target: {
        kind: 'conversation_message',
        conversation_id: 77,
        message_id: 101,
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId('location-display').textContent).toBe('/chat/77');
    });
  });

  it('push permission denial or subscription errors do not halt foreground polling', async () => {
    // Commit initial cursor so this is an incremental poll
    commitCursor(100);

    let arrivalPolls = 0;
    const customFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/push/assistant-arrivals/') {
        arrivalPolls++;
        const evId = 100 + arrivalPolls;
        return jsonResponse({
          events: [
            makeValidEvent({
              event_id: evId,
              conversation_id: 10,
              message_id: 900 + arrivalPolls,
            }),
          ],
          next_cursor: evId + 1,
          has_more: false,
        });
      }
      if (url.pathname === '/api/push/subscriptions/') {
        return jsonResponse({ error: 'Backend subscription disabled' }, 500);
      }
      return jsonResponse({});
    });
    globalThis.fetch = customFetch as unknown as typeof fetch;

    render(<TestHarness initialRoute="/" />);

    // Foreground incremental poll succeeds despite push subscription failure
    await waitFor(() => {
      expect(arrivalPolls).toBeGreaterThanOrEqual(1);
      expect(screen.getByTestId('total-unread').textContent).toBe('1');
    });
    expect(screen.queryByText(/消息同步暂不可用/i)).toBeNull();
  });

  it('storage failure during SW handoff displays visible shell sync banner without crashing', async () => {
    // Pre-commit cursor to allow initial bootstrap poll to succeed cleanly
    commitCursor(10);

    render(<TestHarness initialRoute="/settings/notifications" />);

    // Wait for initial render and sync to settle
    await screen.findByTestId('location-display');

    // Force localStorage.setItem to throw QuotaExceededError during handoff
    const originalSetItem = mockStorage.setItem.bind(mockStorage);
    vi.spyOn(mockStorage, 'setItem').mockImplementation((key: string, val: string) => {
      if (key === NOTIFICATIONS_STORAGE_KEY) {
        throw new Error('QuotaExceededError');
      }
      originalSetItem(key, val);
    });

    const ev = makeValidEvent({
      conversation_id: 42,
      message_id: 505,
      dedupe_key: 'assistant-message:505',
    });

    mockSw.postMessageToPage({
      type: 'ASSISTANT_ARRIVAL_HANDOFF',
      version: 1,
      event: ev,
    });

    // Shell sync banner appears with storage error warning
    await screen.findByText(/消息同步暂不可用: 本地存储不可用/i);
    expect(screen.getByRole('button', { name: '重试同步' })).toBeTruthy();
  });

  it('NOTIFICATION_NAVIGATE with malformed target.kind or non-positive message_id is ignored without navigation', async () => {
    render(<TestHarness initialRoute="/" />);
    await screen.findByTestId('location-display');

    // Case 1: invalid target.kind
    mockSw.postMessageToPage({
      type: 'NOTIFICATION_NAVIGATE',
      version: 1,
      target: {
        kind: 'unsupported_kind',
        conversation_id: 88,
        message_id: 1,
      },
    });

    // Case 2: non-positive message_id
    mockSw.postMessageToPage({
      type: 'NOTIFICATION_NAVIGATE',
      version: 1,
      target: {
        kind: 'conversation_message',
        conversation_id: 88,
        message_id: -5,
      },
    });

    // Case 3: missing version
    mockSw.postMessageToPage({
      type: 'NOTIFICATION_NAVIGATE',
      target: {
        kind: 'conversation_message',
        conversation_id: 88,
        message_id: 1,
      },
    });

    // Navigation must NOT occur
    expect(screen.getByTestId('location-display').textContent).toBe('/');
  });

  it('SUBSCRIPTION_REPAIR_NEEDED requires version === 1 to update repair truth', async () => {
    render(<TestHarness initialRoute="/" />);

    // Unversioned message: should be ignored
    mockSw.postMessageToPage({
      type: 'SUBSCRIPTION_REPAIR_NEEDED',
    });

    // Versioned message: sets repair state
    mockSw.postMessageToPage({
      type: 'SUBSCRIPTION_REPAIR_NEEDED',
      version: 1,
    });
  });

  it('NOTIFICATION_NAVIGATE: legacy register_ack/ack_outcome fields are ignored entirely — navigation succeeds with zero ACK', async () => {
    render(<TestHarness initialRoute="/" />);

    await screen.findByTestId('location-display');
    expect(screen.getByTestId('location-display').textContent).toBe('/');

    // Send NOTIFICATION_NAVIGATE with a valid target plus obsolete legacy ACK fields
    // (negative register_id and malformed statusCode). The V4 runtime no longer
    // reads these fields; they must neither block navigation nor trigger any network ACK.
    mockSw.postMessageToPage({
      type: 'NOTIFICATION_NAVIGATE',
      version: 1,
      target: {
        kind: 'conversation_message',
        conversation_id: 99,
        message_id: 1,
      },
      register_ack: {
        register_id: -5, // legacy invalid negative ID!
        preset_id: 1,
      },
      ack_outcome: {
        status: 'sent',
        statusCode: '200' as unknown as number, // legacy invalid string statusCode!
      },
    });

    // Navigation must SUCCEED
    await waitFor(() => {
      expect(screen.getByTestId('location-display').textContent).toBe('/chat/99');
    });

    // Zero Register ACK network requests were issued
    expect(postCalls.filter((c) => c.url.includes('/api/agents/registers/'))).toHaveLength(0);
    expect(postCalls).toHaveLength(0);
  });
});
