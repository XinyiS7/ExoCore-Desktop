/**
 * P2D CP D-1 - independent acceptance probe (Acceptance-owned; Construction must not edit).
 *
 * Frozen authority: Plan CP D-1 hold; D4 (bootstrap must omit `after`; a failed
 * page/write must preserve the previous contiguous cursor); D5.3/D5.4 (exactly one
 * automatic newest-window apply when idle near bottom; focused canonical
 * confirmation consumes the exact unread); D5.3 (visible-but-unfocused exact
 * conversation keeps unread).
 */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ensureTestLocalStorage,
  installFetch,
  jsonResponse,
  renderApp,
  unmockFetch,
} from '../test/helpers';
import {
  commitCursor,
  initializeStorage,
  ingestArrivals,
  loadInstallationStorage,
  NOTIFICATIONS_QUARANTINE_PREFIX,
  NOTIFICATIONS_STORAGE_KEY,
} from '../features/notifications/storage';

const preset = {
  id: 5,
  name: 'Sandro',
  description: null,
  agent_type: 'standard',
  default_model: 'deepseek-v4-flash',
  system_prompt: null,
  is_visible: true,
};

const catalog = {
  models: [
    { name: 'deepseek-v4-flash', family: 'deepseek', abilities: [], compatible_endpoint_ids: [7] },
  ],
  endpoints: [
    {
      id: 7,
      name: 'DeepSeek',
      provider: 'deepseek',
      execution_type: 'direct_api',
      execution_adapter: 'internal_http',
      payload_format: 'openai',
      cache_transport: 'inline_chunk',
      attachment_transports: [],
      configured: true,
      enabled: true,
    },
  ],
  roles: {
    main: [{ model: 'deepseek-v4-flash', default_endpoint: 7 }],
    support: {},
  },
  providers: [
    {
      id: 'deepseek',
      display_name: 'DeepSeek',
      execution_type: 'direct_api',
      execution_adapter: 'internal_http',
      requires_endpoint_api_key: true,
    },
  ],
};

const conversation = (id: number) => ({
  id,
  name: `C${id}`,
  created_at: '2026-09-01T00:00:00Z',
  frozen_project_ids: [],
  project: 0,
  project_name: null,
  agent_type: 'standard',
  agent_preset_id: 5,
  last_message_at: null,
  thinking_level: 'auto',
  memory_injection_enabled: null,
});

const row = (id: number, content = 'persisted answer') => ({
  id,
  role: 'assistant',
  content,
  reasoning_content: null,
  platform: 'deepseek',
  model_version: 'v4-flash',
  token_count: null,
  index_in_session: 0,
  attachment_ids: [],
  attachments_meta: null,
  created_at: '2026-09-12T10:00:00Z',
});

const arrival = (eventId: number, messageId: number) => ({
  kind: 'assistant-message-arrived',
  version: 1,
  event_id: eventId,
  dedupe_key: `assistant-message:${messageId}`,
  conversation_id: 1,
  message_id: messageId,
  agent: { id: 7, name: 'Sandro' },
  preview: { policy: 'bounded_text', text: 'external arrival', truncated: false },
  target: { kind: 'conversation_message', conversation_id: 1, message_id: messageId },
  ignore: { allowed: false },
  register_ack: null,
  title_hint: null,
  committed_at: '2026-09-13T20:00:00Z',
});

function routes(arrivalMessageId: number) {
  return [
    { test: '/api/agents/presets/', handler: () => jsonResponse([preset]) },
    { test: '/api/core/model-catalog/', handler: () => jsonResponse(catalog) },
    { test: '/api/agents/conversations/1/', handler: () => jsonResponse(conversation(1)) },
    {
      test: '/api/agents/conversations/1/cache/',
      handler: () => jsonResponse({ active: false, platform: null, has_snapshot: false }),
    },
    {
      test: '/api/agents/chat/1/',
      handler: () => jsonResponse({ messages: [row(500)], total_count: 1, has_more: false }),
    },
    {
      test: '/api/push/assistant-arrivals/',
      handler: (url: URL) =>
        url.searchParams.get('after') === null
          ? jsonResponse({ events: [], next_cursor: 10, has_more: false })
          : jsonResponse({ events: [arrival(11, arrivalMessageId)], next_cursor: 11, has_more: false }),
    },
  ];
}

/**
 * jsdom Storage is a Proxy whose methods live on `Storage.prototype`, while the
 * environment guard (Node >= 25 WebStorage shadowing) installs a plain object
 * with own methods. Spy on whichever one actually backs `window.localStorage`
 * so these probes stay valid in both environments.
 */
function mockStorageGetItem(impl: (key: string) => string | null): void {
  const storage = window.localStorage;
  const target = (
    Object.prototype.hasOwnProperty.call(storage, 'getItem')
      ? storage
      : Object.getPrototypeOf(storage)
  ) as Storage;
  vi.spyOn(target, 'getItem').mockImplementation(impl);
}

function mockStorageSetItem(impl: (key: string, value: string) => void): void {
  const storage = window.localStorage;
  const target = (
    Object.prototype.hasOwnProperty.call(storage, 'setItem')
      ? storage
      : Object.getPrototypeOf(storage)
  ) as Storage;
  vi.spyOn(target, 'setItem').mockImplementation(impl);
}

const arrivalsCalls = (calls: { url: URL }[]) =>
  calls.filter((c) => c.url.pathname === '/api/push/assistant-arrivals/');
const windowFetches = (calls: { url: URL }[]) =>
  calls.filter((c) => c.url.pathname === '/api/agents/chat/1/');

async function driveIncrementalPoll(calls: { url: URL }[]) {
  await screen.findByRole('textbox', { name: '消息输入框' });
  // Frozen trigger: visibilitychange -> visible performs an immediate reconcile.
  document.dispatchEvent(new Event('visibilitychange'));
  await waitFor(() => expect(arrivalsCalls(calls).length).toBeGreaterThanOrEqual(2));
  await new Promise((resolve) => setTimeout(resolve, 300));
}

afterEach(() => {
  cleanup();
  unmockFetch();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('P2D CP D-1 independent acceptance - arrival reconciliation', () => {
  it('bootstrap omits `after`, then a single newest-window apply happens and an unconfirmable arrival stays pending', async () => {
    ensureTestLocalStorage();
    localStorage.clear();
    const { calls } = installFetch(routes(999));

    renderApp(['/chat/1']);
    await driveIncrementalPoll(calls);

    const arrivals = arrivalsCalls(calls);
    expect(arrivals[0].url.searchParams.get('after'), 'first poll is bootstrap').toBeNull();
    expect(arrivals[1].url.searchParams.get('after'), 'second poll uses the committed cursor').toBe('10');
    // mount fetch + exactly one automatic newest-window apply (D5.4).
    expect(windowFetches(calls).length, 'newest-window fetches').toBe(2);
    // The arrival is not confirmable from the newest window; it must stay pending.
    expect(document.querySelector('.nav-badge')?.textContent, 'unread stays pending').toBe('1');
  });

  it('focused canonical confirmation consumes the exact unread', async () => {
    ensureTestLocalStorage();
    localStorage.clear();
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    const { calls } = installFetch(routes(500));

    renderApp(['/chat/1']);
    await driveIncrementalPoll(calls);

    // Arrival is already present in canonical rows: no extra apply, and the
    // focused exact conversation consumes it.
    expect(windowFetches(calls).length, 'no extra apply').toBe(1);
    await waitFor(() => expect(document.querySelector('.nav-badge')).toBeNull());
  });

  it('an arrival whose message becomes canonical is applied as exactly one bubble and consumed', async () => {
    ensureTestLocalStorage();
    localStorage.clear();
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    let windowCall = 0;
    const { calls } = installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([preset]) },
      { test: '/api/core/model-catalog/', handler: () => jsonResponse(catalog) },
      { test: '/api/agents/conversations/1/', handler: () => jsonResponse(conversation(1)) },
      {
        test: '/api/agents/conversations/1/cache/',
        handler: () => jsonResponse({ active: false, platform: null, has_snapshot: false }),
      },
      {
        test: '/api/agents/chat/1/',
        handler: () => {
          windowCall += 1;
          return jsonResponse({
            messages: windowCall === 1 ? [row(500)] : [row(500), row(999, 'canonical arrival body')],
            total_count: windowCall === 1 ? 1 : 2,
            has_more: false,
          });
        },
      },
      {
        test: '/api/push/assistant-arrivals/',
        handler: (url: URL) =>
          url.searchParams.get('after') === null
            ? jsonResponse({ events: [], next_cursor: 10, has_more: false })
            : jsonResponse({ events: [arrival(11, 999)], next_cursor: 11, has_more: false }),
      },
    ]);

    renderApp(['/chat/1']);
    await driveIncrementalPoll(calls);

    expect(await screen.findByText('canonical arrival body'), 'arrival message visible').toBeInTheDocument();
    expect(screen.getAllByText('canonical arrival body'), 'no duplicate bubble').toHaveLength(1);
    expect(windowFetches(calls).length, 'mount + exactly one apply').toBe(2);
    await waitFor(() => expect(document.querySelector('.nav-badge')).toBeNull());
  });

  it('visible-but-unfocused exact conversation keeps unread until refocus', async () => {
    ensureTestLocalStorage();
    localStorage.clear();
    const { calls } = installFetch(routes(500));

    renderApp(['/chat/1']);
    await driveIncrementalPoll(calls);

    expect(document.querySelector('.nav-badge')?.textContent, 'unfocused keeps unread').toBe('1');

    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    window.dispatchEvent(new Event('focus'));
    await waitFor(() => expect(document.querySelector('.nav-badge')).toBeNull());
  });

  it('a failed storage write preserves the previous contiguous cursor and does not create unread', async () => {
    ensureTestLocalStorage();
    localStorage.clear();
    expect(initializeStorage().status).toBe('ok');
    expect(commitCursor(40).status).toBe('ok');

    mockStorageSetItem(() => {
      throw new Error('quota exceeded');
    });
    const failed = ingestArrivals([arrival(41, 900) as never], 'poll', 41);
    vi.restoreAllMocks();

    expect(failed.status, 'write failure is reported').toBe('unavailable');
    const after = loadInstallationStorage();
    expect(after.status).toBe('ok');
    if (after.status !== 'ok') return;
    expect(after.storage.lastContiguousCursor, 'cursor preserved').toBe(40);
    expect(Object.keys(after.storage.unreadMap), 'no unread written').toHaveLength(0);
    expect(localStorage.getItem(NOTIFICATIONS_STORAGE_KEY)).not.toContain('assistant-message:900');
  });
  it('HTTP 400 surfaces a bounded notice, preserves the cursor, and retry triggers exactly one poll', async () => {
    ensureTestLocalStorage();
    localStorage.clear();
    expect(initializeStorage().status).toBe('ok');
    expect(commitCursor(30).status).toBe('ok');

    const { calls } = installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([preset]) },
      { test: '/api/core/model-catalog/', handler: () => jsonResponse(catalog) },
      { test: '/api/agents/conversations/1/', handler: () => jsonResponse(conversation(1)) },
      {
        test: '/api/agents/conversations/1/cache/',
        handler: () => jsonResponse({ active: false, platform: null, has_snapshot: false }),
      },
      { test: '/api/agents/chat/1/', handler: () => jsonResponse({ messages: [row(500)], total_count: 1, has_more: false }) },
      {
        test: '/api/push/assistant-arrivals/',
        handler: () => jsonResponse({ detail: 'Invalid after parameter: 30' }, 400),
      },
    ]);

    renderApp(['/chat/1']);
    await screen.findByText('消息同步暂不可用: 请求参数无效 (400)');
    expect(screen.queryByText(/Invalid after parameter/), 'no raw payload in DOM').toBeNull();

    const before = arrivalsCalls(calls).length;
    fireEvent.click(screen.getByRole('button', { name: '重试同步' }));
    await waitFor(() => expect(arrivalsCalls(calls).length).toBeGreaterThanOrEqual(before + 1));
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(arrivalsCalls(calls).length, 'retry is 1:1, not a loop').toBe(before + 1);

    const load = loadInstallationStorage();
    expect(load.status).toBe('ok');
    if (load.status !== 'ok') return;
    expect(load.storage.lastContiguousCursor, 'cursor preserved after 400').toBe(30);
  });

  it('network failure surfaces a bounded notice without leaking the transport error', async () => {
    ensureTestLocalStorage();
    localStorage.clear();
    const { calls } = installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([preset]) },
      { test: '/api/core/model-catalog/', handler: () => jsonResponse(catalog) },
      { test: '/api/agents/conversations/1/', handler: () => jsonResponse(conversation(1)) },
      {
        test: '/api/agents/conversations/1/cache/',
        handler: () => jsonResponse({ active: false, platform: null, has_snapshot: false }),
      },
      { test: '/api/agents/chat/1/', handler: () => jsonResponse({ messages: [row(500)], total_count: 1, has_more: false }) },
      {
        test: '/api/push/assistant-arrivals/',
        handler: () => {
          throw new TypeError('Failed to fetch');
        },
      },
    ]);

    renderApp(['/chat/1']);
    await screen.findByText('消息同步暂不可用: 网络连接不可用');
    expect(screen.queryByText(/Failed to fetch/), 'transport error not leaked').toBeNull();
    expect(arrivalsCalls(calls).length).toBeGreaterThanOrEqual(1);
  });

  it('storage unavailable surfaces a bounded notice and a retry stays safe', async () => {
    ensureTestLocalStorage();
    localStorage.clear();
    const originalGetItem = window.localStorage.getItem.bind(window.localStorage);
    mockStorageGetItem((key) => {
      if (key === NOTIFICATIONS_STORAGE_KEY) throw new Error('storage denied');
      return originalGetItem(key);
    });

    const { calls } = installFetch(routes(500));

    renderApp(['/chat/1']);
    await screen.findByText('消息同步暂不可用: 本地存储不可用');
    expect(arrivalsCalls(calls).length, 'no network poll while storage is unavailable').toBe(0);

    fireEvent.click(screen.getByRole('button', { name: '重试同步' }));
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(screen.getByText('消息同步暂不可用: 本地存储不可用'), 'notice persists, no crash').toBeTruthy();
    expect(arrivalsCalls(calls).length).toBe(0);
  });

  it('corrupt storage is quarantined, surfaced, and recovered by one explicit retry', async () => {
    ensureTestLocalStorage();
    localStorage.clear();
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, '{invalid json');
    const { calls } = installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([preset]) },
      { test: '/api/core/model-catalog/', handler: () => jsonResponse(catalog) },
      { test: '/api/agents/conversations/1/', handler: () => jsonResponse(conversation(1)) },
      {
        test: '/api/agents/conversations/1/cache/',
        handler: () => jsonResponse({ active: false, platform: null, has_snapshot: false }),
      },
      { test: '/api/agents/chat/1/', handler: () => jsonResponse({ messages: [row(500)], total_count: 1, has_more: false }) },
      {
        test: '/api/push/assistant-arrivals/',
        handler: () => jsonResponse({ events: [], next_cursor: 5, has_more: false }),
      },
    ]);

    renderApp(['/chat/1']);
    await screen.findByText('消息同步暂不可用: 本地缓存已损坏并隔离');

    let quarantined = false;
    for (let i = 0; i < localStorage.length; i += 1) {
      if (localStorage.key(i)?.startsWith(NOTIFICATIONS_QUARANTINE_PREFIX)) {
        quarantined = true;
        break;
      }
    }
    expect(quarantined, 'raw corrupt payload preserved for forensics').toBe(true);

    fireEvent.click(screen.getByRole('button', { name: '重试同步' }));
    await waitFor(() => expect(screen.queryByText(/消息同步暂不可用/)).toBeNull());
    const load = loadInstallationStorage();
    expect(load.status).toBe('ok');
    if (load.status !== 'ok') return;
    expect(load.storage.lastContiguousCursor, 'recovered via bootstrap without replay').toBe(5);
    const bootstrapCall = arrivalsCalls(calls).find((c) => c.url.searchParams.get('after') === null);
    expect(bootstrapCall, 'recovery uses bootstrap (no after)').toBeTruthy();
  });
});
