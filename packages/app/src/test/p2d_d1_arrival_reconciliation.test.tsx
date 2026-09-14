import type { ReactNode } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import {
  AssistantMessageArrivedV1,
  validateArrivalEvent,
  validateArrivalPage,
  toConversationRoute,
} from '../features/notifications/contract';
import {
  commitCursor,
  consumeArrivalsByMessageIds,
  ingestArrivals,
  initializeStorage,
  loadInstallationStorage,
  MAX_UNREAD_ENTRIES,
  NOTIFICATIONS_QUARANTINE_PREFIX,
  NOTIFICATIONS_STORAGE_KEY,
} from '../features/notifications/storage';
import { NotificationRuntime } from '../features/notifications/NotificationRuntime';


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

function makeValidEvent(overrides: Partial<AssistantMessageArrivedV1> = {}): AssistantMessageArrivedV1 {
  return {
    kind: 'assistant-message-arrived',
    version: 1,
    event_id: 101,
    dedupe_key: 'assistant-message:42',
    conversation_id: 1,
    message_id: 42,
    agent: { id: 7, name: 'Sandro' },
    preview: { policy: 'bounded_text', text: 'Hello Alicia', truncated: false },
    target: { kind: 'conversation_message', conversation_id: 1, message_id: 42 },
    register_ack: null,
    title_hint: 'Greetings',
    committed_at: '2026-09-13T20:00:00Z',
    ...overrides,
  };
}

describe('P2D D-1: Contract Validation (D1-R1-05)', () => {
  it('validates a completely correct AssistantMessageArrivedV1 event', () => {
    const raw = makeValidEvent();
    const event = validateArrivalEvent(raw);
    expect(event.event_id).toBe(101);
    expect(event.conversation_id).toBe(1);
    expect(event.message_id).toBe(42);
    expect(event.dedupe_key).toBe('assistant-message:42');
    expect(event.agent.name).toBe('Sandro');
    expect(toConversationRoute(event.conversation_id)).toBe('/chat/1');
  });

  it('fails closed on non-positive IDs (event_id, conversation_id, message_id, agent.id)', () => {
    expect(() => validateArrivalEvent(makeValidEvent({ event_id: 0 }))).toThrow('event_id 必须为正整数');
    expect(() => validateArrivalEvent(makeValidEvent({ event_id: -5 }))).toThrow('event_id 必须为正整数');
    expect(() => validateArrivalEvent(makeValidEvent({ conversation_id: 0 }))).toThrow('conversation_id 必须为正整数');
    expect(() => validateArrivalEvent(makeValidEvent({ message_id: 0 }))).toThrow('message_id 必须为正整数');
    expect(() => validateArrivalEvent(makeValidEvent({ agent: { id: 0, name: 'A' } }))).toThrow('agent.id 必须为正整数');
  });

  it('fails closed on dedupe_key mismatch', () => {
    const raw = makeValidEvent({ dedupe_key: 'assistant-message:999', message_id: 42 });
    expect(() => validateArrivalEvent(raw)).toThrow('dedupe_key 必须严格为 assistant-message:42');
  });

  it('fails closed on target identity inconsistency', () => {
    const raw = makeValidEvent({
      conversation_id: 1,
      message_id: 42,
      target: { kind: 'conversation_message', conversation_id: 2, message_id: 42 },
    });
    expect(() => validateArrivalEvent(raw)).toThrow('target ID 与顶层 ID 不一致');
  });

  it('fails closed when preview text exceeds 160 Unicode code points', () => {
    const overLengthText = '🔥'.repeat(161);
    const raw = makeValidEvent({
      preview: { policy: 'bounded_text', text: overLengthText, truncated: false },
    });
    expect(() => validateArrivalEvent(raw)).toThrow('preview 文本超出 160 字符上限');
  });

  it('safely degrades presentation fields (agent.name, title_hint, committed_at)', () => {
    const raw = makeValidEvent({
      agent: { id: 7, name: '   ' }, // empty name
      title_hint: 'A'.repeat(205), // over 200 chars
      committed_at: 'invalid-date-string',
    });
    const event = validateArrivalEvent(raw);
    expect(event.agent.name).toBe('Agent');
    expect(event.title_hint).toBeNull();
    expect(event.committed_at).toBe('');
  });

  it('fails closed on invalid register_ack structure', () => {
    const raw = makeValidEvent({
      register_ack: { register_id: 0, preset_id: 1 },
    });
    expect(() => validateArrivalEvent(raw)).toThrow('register_ack 包含非正整数编号');
  });

  it('validates a valid arrival page with strictly ascending events', () => {
    const rawPage = {
      events: [
        makeValidEvent({ event_id: 10, message_id: 1, dedupe_key: 'assistant-message:1', target: { kind: 'conversation_message', conversation_id: 1, message_id: 1 } }),
        makeValidEvent({ event_id: 15, message_id: 2, dedupe_key: 'assistant-message:2', target: { kind: 'conversation_message', conversation_id: 1, message_id: 2 } }),
      ],
      next_cursor: 20,
      has_more: false,
    };
    const page = validateArrivalPage(rawPage);
    expect(page.events).toHaveLength(2);
    expect(page.next_cursor).toBe(20);
    expect(page.has_more).toBe(false);
  });

  it('fails closed when page events are not in strictly ascending order', () => {
    const rawPage = {
      events: [
        makeValidEvent({ event_id: 20, message_id: 1, dedupe_key: 'assistant-message:1', target: { kind: 'conversation_message', conversation_id: 1, message_id: 1 } }),
        makeValidEvent({ event_id: 15, message_id: 2, dedupe_key: 'assistant-message:2', target: { kind: 'conversation_message', conversation_id: 1, message_id: 2 } }),
      ],
      next_cursor: 25,
      has_more: false,
    };
    expect(() => validateArrivalPage(rawPage)).toThrow('未按 event_id 严格升序排列');
  });

  it('fails closed when page contains duplicate events or dedupe_keys', () => {
    const rawPage = {
      events: [
        makeValidEvent({ event_id: 10, message_id: 1, dedupe_key: 'assistant-message:1', target: { kind: 'conversation_message', conversation_id: 1, message_id: 1 } }),
        makeValidEvent({ event_id: 10, message_id: 2, dedupe_key: 'assistant-message:2', target: { kind: 'conversation_message', conversation_id: 1, message_id: 2 } }),
      ],
      next_cursor: 25,
      has_more: false,
    };
    expect(() => validateArrivalPage(rawPage)).toThrow('未按 event_id 严格升序排列');
  });

  it('fails closed when next_cursor regresses behind the latest page event', () => {
    const rawPage = {
      events: [
        makeValidEvent({ event_id: 10, message_id: 1, dedupe_key: 'assistant-message:1', target: { kind: 'conversation_message', conversation_id: 1, message_id: 1 } }),
        makeValidEvent({ event_id: 30, message_id: 2, dedupe_key: 'assistant-message:2', target: { kind: 'conversation_message', conversation_id: 1, message_id: 2 } }),
      ],
      next_cursor: 25, // Less than 30!
      has_more: false,
    };
    expect(() => validateArrivalPage(rawPage)).toThrow('next_cursor (25) 小于当页最新事件 event_id (30)');
  });
});

describe('P2D D-1: Storage Persistence & Invariants (D1-R1-02, D1-R1-03)', () => {
  beforeEach(() => {
    mockStorage.clear();
  });

  it('returns absent when storage is uninitialized', () => {
    const outcome = loadInstallationStorage();
    expect(outcome.status).toBe('absent');
  });

  it('initializes clean storage with valid UUID and null bootstrap cursor', () => {
    const init = initializeStorage();
    expect(init.status).toBe('ok');
    if (init.status !== 'ok') return;

    expect(init.storage.version).toBe(1);
    expect(init.storage.installationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(init.storage.lastContiguousCursor).toBeNull(); // Bootstrap requirement
    expect(Object.keys(init.storage.unreadMap)).toHaveLength(0);
  });

  it('quarantines corrupt JSON data without silent crash', () => {
    mockStorage.setItem(NOTIFICATIONS_STORAGE_KEY, '{"invalid_json": true');
    const outcome = loadInstallationStorage();
    expect(outcome.status).toBe('corrupted');

    // Verify raw content was moved to quarantine key and removed from main key
    expect(mockStorage.getItem(NOTIFICATIONS_STORAGE_KEY)).toBeNull();
    let foundQuarantine = false;
    for (let i = 0; i < mockStorage.length; i++) {
      const k = mockStorage.key(i);
      if (k?.startsWith(NOTIFICATIONS_QUARANTINE_PREFIX)) {
        foundQuarantine = true;
        break;
      }
    }
    expect(foundQuarantine).toBe(true);
  });

  it('quarantines schema mismatch (e.g. invalid UUID, bad cursor)', () => {
    mockStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify({
      version: 1,
      installationId: 'not-a-uuid',
      lastContiguousCursor: -1,
      unreadMap: {},
    }));
    const outcome = loadInstallationStorage();
    expect(outcome.status).toBe('corrupted');
    expect(mockStorage.getItem(NOTIFICATIONS_STORAGE_KEY)).toBeNull();
  });

  it('ingests arrival events and commits cursor atomically', () => {
    const ev1 = makeValidEvent({ event_id: 50, message_id: 10, dedupe_key: 'assistant-message:10', target: { kind: 'conversation_message', conversation_id: 1, message_id: 10 } });
    const ev2 = makeValidEvent({ event_id: 55, message_id: 11, dedupe_key: 'assistant-message:11', target: { kind: 'conversation_message', conversation_id: 2, message_id: 11 } });

    const writeRes = ingestArrivals([ev1, ev2], 'poll', 60);
    expect(writeRes.status).toBe('ok');
    if (writeRes.status !== 'ok') return;

    expect(writeRes.storage.lastContiguousCursor).toBe(60);
    expect(Object.keys(writeRes.storage.unreadMap)).toHaveLength(2);
    expect(writeRes.storage.unreadMap['assistant-message:10'].event.message_id).toBe(10);
    expect(writeRes.storage.unreadMap['assistant-message:10'].source).toBe('poll');
  });

  it('preserves monotonicity of cursor progression across mutations', () => {
    initializeStorage();
    commitCursor(50);
    const load1 = loadInstallationStorage();
    if (load1.status !== 'ok') throw new Error('Failed to load');
    expect(load1.storage.lastContiguousCursor).toBe(50);

    // Attempt to regress cursor to 30
    commitCursor(30);
    const load2 = loadInstallationStorage();
    if (load2.status !== 'ok') throw new Error('Failed to load');
    expect(load2.storage.lastContiguousCursor).toBe(50); // Did not regress!
  });

  it('suppresses duplicate arrival if event_id is <= cursor and not in unreadMap', () => {
    initializeStorage();
    commitCursor(100);

    const oldEvent = makeValidEvent({ event_id: 80, message_id: 5, dedupe_key: 'assistant-message:5', target: { kind: 'conversation_message', conversation_id: 1, message_id: 5 } });
    const res = ingestArrivals([oldEvent], 'poll');
    expect(res.status).toBe('ok');
    if (res.status !== 'ok') return;
    expect(Object.keys(res.storage.unreadMap)).toHaveLength(0); // Ignored as already consumed
  });

  it('bounds unreadMap capacity to MAX_UNREAD_ENTRIES (100) by dropping oldest', () => {
    initializeStorage();
    const events: AssistantMessageArrivedV1[] = [];
    for (let i = 1; i <= 105; i++) {
      events.push(makeValidEvent({
        event_id: i,
        message_id: i,
        dedupe_key: `assistant-message:${i}`,
        target: { kind: 'conversation_message', conversation_id: 1, message_id: i },
      }));
    }

    const res = ingestArrivals(events, 'poll', 105);
    expect(res.status).toBe('ok');
    if (res.status !== 'ok') return;

    const unreadKeys = Object.keys(res.storage.unreadMap);
    expect(unreadKeys.length).toBe(MAX_UNREAD_ENTRIES);
    // Oldest entries (1 to 5) should have been pruned
    expect(res.storage.unreadMap['assistant-message:1']).toBeUndefined();
    expect(res.storage.unreadMap['assistant-message:105']).toBeDefined();
  });

  it('consumes arrivals only for confirmed message IDs in exact conversation', () => {
    const ev1 = makeValidEvent({ event_id: 1, message_id: 101, dedupe_key: 'assistant-message:101', conversation_id: 1, target: { kind: 'conversation_message', conversation_id: 1, message_id: 101 } });
    const ev2 = makeValidEvent({ event_id: 2, message_id: 102, dedupe_key: 'assistant-message:102', conversation_id: 1, target: { kind: 'conversation_message', conversation_id: 1, message_id: 102 } });
    const ev3 = makeValidEvent({ event_id: 3, message_id: 201, dedupe_key: 'assistant-message:201', conversation_id: 2, target: { kind: 'conversation_message', conversation_id: 2, message_id: 201 } });

    ingestArrivals([ev1, ev2, ev3], 'poll', 3);

    // Consume only message 101 of conversation 1
    const consumeRes = consumeArrivalsByMessageIds(1, new Set([101]));
    expect(consumeRes.status).toBe('ok');
    if (consumeRes.status !== 'ok') return;

    expect(consumeRes.storage.unreadMap['assistant-message:101']).toBeUndefined();
    expect(consumeRes.storage.unreadMap['assistant-message:102']).toBeDefined();
    expect(consumeRes.storage.unreadMap['assistant-message:201']).toBeDefined();
  });
});

function makeTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

function renderRuntime(children: ReactNode = <div>App Content</div>) {
  const qc = makeTestQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <NotificationRuntime>{children}</NotificationRuntime>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('P2D D-1: Polling Runtime & Error State Matrix (D1-R2-01, D1-R2-02)', () => {
  beforeEach(() => {
    mockStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.stubGlobal('localStorage', mockStorage);
  });

  it('first poll omits after and commits high-water cursor', async () => {
    mockStorage.clear();
    const requestedUrls: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const urlStr = String(input);
      requestedUrls.push(urlStr);
      return new Response(JSON.stringify({
        events: [],
        next_cursor: 120,
        has_more: false,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderRuntime();

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(requestedUrls.length).toBeGreaterThanOrEqual(1);
    const firstUrl = new URL(requestedUrls[0], 'http://localhost');
    expect(firstUrl.searchParams.has('after')).toBe(false);
    expect(firstUrl.searchParams.get('limit')).toBe('50');

    // Storage cursor must have been committed to high-water mark 120
    const load = loadInstallationStorage();
    expect(load.status).toBe('ok');
    if (load.status === 'ok') {
      expect(load.storage.lastContiguousCursor).toBe(120);
      expect(Object.keys(load.storage.unreadMap)).toHaveLength(0);
    }
  });

  it('failed storage write preserves previous contiguous cursor and sets error state', async () => {
    mockStorage.clear();
    initializeStorage();
    commitCursor(50);

    const newArrival = makeValidEvent({
      event_id: 55,
      message_id: 20,
      dedupe_key: 'assistant-message:20',
      target: { kind: 'conversation_message', conversation_id: 1, message_id: 20 },
    });

    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({
        events: [newArrival],
        next_cursor: 60,
        has_more: false,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const originalSetItem = mockStorage.setItem.bind(mockStorage);
    vi.spyOn(mockStorage, 'setItem').mockImplementation((key: string, val: string) => {
      if (val.includes('assistant-message:20')) {
        throw new Error('QuotaExceededError');
      }
      originalSetItem(key, val);
    });

    renderRuntime();

    await screen.findByText('消息同步暂不可用: 事件保存失败');
    expect(screen.getByRole('button', { name: '重试同步' })).toBeTruthy();

    const load = loadInstallationStorage();
    expect(load.status).toBe('ok');
    if (load.status === 'ok') {
      expect(load.storage.lastContiguousCursor).toBe(50);
      expect(load.storage.unreadMap['assistant-message:20']).toBeUndefined();
    }
  });

  it('renders non-blocking sync error banner and clicking retry triggers one explicit poll', async () => {
    mockStorage.clear();
    initializeStorage();
    commitCursor(10);

    let failRequest = true;
    let pollCalls = 0;
    const fetchMock = vi.fn(async () => {
      pollCalls++;
      if (failRequest) {
        return new Response(JSON.stringify({ error: 'server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({
        events: [],
        next_cursor: 15,
        has_more: false,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderRuntime();

    await screen.findByText('消息同步暂不可用: 服务端同步异常');
    const retryBtn = screen.getByRole('button', { name: '重试同步' });
    expect(pollCalls).toBe(1);

    failRequest = false;
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.queryByText(/消息同步暂不可用/)).toBeNull();
    });
    expect(pollCalls).toBe(2);
  });

  it('HTTP 400 and contract error render bounded error notice without raw payload and preserve cursor', async () => {
    mockStorage.clear();
    initializeStorage();
    commitCursor(30);

    const fetch400 = vi.fn(async () => {
      return new Response(JSON.stringify({ detail: 'Invalid after parameter: 30' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetch400);

    const { unmount } = renderRuntime();

    await screen.findByText('消息同步暂不可用: 请求参数无效 (400)');
    expect(screen.queryByText(/Invalid after parameter/)).toBeNull();
    let load = loadInstallationStorage();
    if (load.status === 'ok') {
      expect(load.storage.lastContiguousCursor).toBe(30);
    }
    unmount();

    const fetchContractError = vi.fn(async () => {
      return new Response(JSON.stringify({
        events: [{ bad_field: 123 }],
        next_cursor: 40,
        has_more: false,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchContractError);

    renderRuntime();
    await screen.findByText('消息同步暂不可用: 到达数据格式异常');
    expect(screen.queryByText(/bad_field/)).toBeNull();
    load = loadInstallationStorage();
    if (load.status === 'ok') {
      expect(load.storage.lastContiguousCursor).toBe(30);
    }
  });

  it('storage unavailable and corrupt quarantine render bounded error notice with retry', async () => {
    mockStorage.clear();
    mockStorage.setItem(NOTIFICATIONS_STORAGE_KEY, '{invalid json');

    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({
        events: [],
        next_cursor: 1,
        has_more: false,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderRuntime();

    await screen.findByText('消息同步暂不可用: 本地缓存已损坏并隔离');
    expect(screen.getByRole('button', { name: '重试同步' })).toBeTruthy();
  });
});

