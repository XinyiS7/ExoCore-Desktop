import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { NotificationRuntime } from '../features/notifications/NotificationRuntime';
import {
  NOTIFICATIONS_STORAGE_KEY,
  ingestArrivals,
  loadInstallationStorage,
} from '../features/notifications/storage';
import type { AssistantMessageArrivedV1 } from '../features/notifications/contract';
import { MessageTimeline } from '../features/chat/MessageTimeline';
import type { MessageView } from '../features/chat/types';
import type { OptimisticUserRow, RuntimeAssistantRow } from '../features/chat/runtime/types';
import {
  ensureTestLocalStorage,
  installRuntimeFetch,
  jsonResponse,
  renderApp,
  runtimeTestPreset,
  unmockFetch,
} from '../test/helpers';

class AcceptanceStorage implements Storage {
  private values = new Map<string, string>();

  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
}

const storage = new AcceptanceStorage();

function arrival(conversationId: number, messageId: number, eventId = messageId): AssistantMessageArrivedV1 {
  return {
    kind: 'assistant-message-arrived',
    version: 1,
    event_id: eventId,
    dedupe_key: `assistant-message:${messageId}`,
    conversation_id: conversationId,
    message_id: messageId,
    agent: { id: 7, name: 'Acceptance agent' },
    preview: { policy: 'bounded_text', text: `message ${messageId}`, truncated: false },
    target: { kind: 'conversation_message', conversation_id: conversationId, message_id: messageId },
    register_ack: null,
    ignore: { allowed: true },
    title_hint: null,
    committed_at: '2026-09-20T18:00:00Z',
  };
}

function seed(...events: AssistantMessageArrivedV1[]) {
  storage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify({
    version: 1,
    installationId: '123e4567-e89b-42d3-a456-426614174000',
    lastContiguousCursor: 10,
    unreadMap: Object.fromEntries(events.map((event) => [event.dedupe_key, {
      event,
      source: 'push',
      receivedAt: event.event_id,
    }])),
  }));
}

function unreadMessageIds(): number[] {
  const outcome = loadInstallationStorage();
  if (outcome.status !== 'ok') throw new Error(`unexpected storage outcome: ${outcome.status}`);
  return Object.values(outcome.storage.unreadMap).map((record) => record.event.message_id).sort((a, b) => a - b);
}

function renderNotifications(path: string, children: ReactNode = <div>acceptance shell</div>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <NotificationRuntime>{children}</NotificationRuntime>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const ACCEPTANCE_TURN_ID = '123e4567-e89b-42d3-a456-426614174001';

function message(
  id: number,
  role: 'user' | 'assistant',
  content: string,
  indexInSession: number,
  clientTurnId: string | null = null,
): MessageView {
  return {
    id,
    role,
    content,
    reasoningContent: null,
    platform: null,
    modelVersion: null,
    tokenCount: null,
    indexInSession,
    attachmentIds: [],
    attachmentsMeta: null,
    createdAt: '2026-09-20T18:00:00Z',
    clientTurnId,
  } as unknown as MessageView;
}

function optimistic(clientTurnId = ACCEPTANCE_TURN_ID): OptimisticUserRow {
  return {
    kind: 'client_user',
    clientKey: 'acceptance-user',
    content: 'new question',
    createdAt: '2026-09-20T18:00:01Z',
    pendingAttachmentIds: [],
    clientTurnId,
  } as unknown as OptimisticUserRow;
}

const assistantOverlay: RuntimeAssistantRow = {
  kind: 'client_assistant',
  clientKey: 'acceptance-assistant',
  content: 'still streaming',
  thinking: '',
  isStreaming: true,
};

function timeline(rows: MessageView[], optimisticUser: OptimisticUserRow) {
  return (
    <MessageTimeline
      messages={rows}
      hasOlder={false}
      loadingMore={false}
      onLoadMore={() => undefined}
      optimisticUser={optimisticUser}
      runtimeAssistant={assistantOverlay}
    />
  );
}

describe('independent acceptance — issue #1 route-entry unread snapshot', () => {
  beforeEach(() => {
    storage.clear();
    vi.stubGlobal('localStorage', storage);
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('consumes only the entry snapshot once and never sweeps a later arrival on refocus', async () => {
    seed(arrival(41, 101), arrival(52, 201));
    renderNotifications('/chat/41');

    await waitFor(() => expect(unreadMessageIds()).toEqual([201]));

    expect(ingestArrivals([arrival(41, 102, 202)], 'push').status).toBe('ok');
    window.dispatchEvent(new Event('blur'));
    window.dispatchEvent(new Event('focus'));

    await waitFor(() => expect(unreadMessageIds()).toEqual([102, 201]));
  });

  it('fails closed on write failure and succeeds on the next focus attempt', async () => {
    seed(arrival(41, 301));
    const originalSetItem = storage.setItem.bind(storage);
    const write = vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new Error('acceptance write denied');
    });

    renderNotifications('/chat/41');

    await screen.findByText(/未读清理失败/);
    expect(unreadMessageIds()).toEqual([301]);

    write.mockImplementation(originalSetItem);
    window.dispatchEvent(new Event('focus'));
    await waitFor(() => expect(unreadMessageIds()).toEqual([]));
  });
});

describe('independent acceptance — issue #2 exact canonical replacement', () => {
  it('hands off only to the canonical user with the exact client-turn correlation', () => {
    const prior = message(1, 'user', 'same text is not identity', 40, null);
    const insertedAssistant = message(2, 'assistant', 'an inserted message', 41, null);
    const rendered = render(timeline([prior, insertedAssistant], optimistic()));

    expect(screen.getAllByText('new question')).toHaveLength(1);
    expect(screen.getByText('（发送中…）')).toBeTruthy();
    expect(screen.getByText('still streaming')).toBeTruthy();

    rendered.rerender(timeline([
      prior,
      insertedAssistant,
      message(3, 'user', 'new question', 42, ACCEPTANCE_TURN_ID),
    ], optimistic()));

    expect(screen.getAllByText('new question')).toHaveLength(1);
    expect(screen.queryByText('（发送中…）')).toBeNull();
    expect(screen.getByText('still streaming')).toBeTruthy();
  });

  it('does not hand off to null, missing, or different correlations even when content and order look plausible', () => {
    const rendered = render(timeline([
      message(8, 'user', 'new question', 90, null),
      message(9, 'user', 'new question', 91, '123e4567-e89b-42d3-a456-426614174099'),
    ], optimistic()));

    expect(screen.getByText('（发送中…）')).toBeTruthy();
    expect(screen.getAllByText('new question')).toHaveLength(3);

    rendered.rerender(timeline([
      message(10, 'user', 'new question', 2, ACCEPTANCE_TURN_ID),
    ], optimistic()));
    expect(screen.getAllByText('new question')).toHaveLength(1);
    expect(screen.queryByText('（发送中…）')).toBeNull();
  });
});

const conversationRow = {
  id: 42,
  name: 'Acceptance conversation',
  created_at: '2026-09-20T18:00:00Z',
  frozen_project_ids: [],
  project: 0,
  project_name: null,
  agent_type: 'standard',
  agent_preset_id: 5,
  last_message_at: null,
  thinking_level: 'auto',
  memory_injection_enabled: null,
};

describe('independent acceptance — issue #2 history-independent dispatch', () => {
  beforeEach(() => {
    ensureTestLocalStorage();
    window.localStorage.clear();
  });

  afterEach(() => {
    unmockFetch();
    window.localStorage.clear();
  });

  it('sends while history is unresolved and shares one UUID between POST and the optimistic row', async () => {
    const unresolvedHistory = new Promise<Response>(() => undefined);
    const encoder = new TextEncoder();
    const openStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('event: status\ndata: "accepted"\n\n'));
      },
    });
    const { calls } = installRuntimeFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([runtimeTestPreset(5)]) },
      { test: '/api/agents/conversations/42/', handler: () => jsonResponse(conversationRow) },
      {
        test: '/api/agents/conversations/42/cache/',
        handler: () => jsonResponse({ active: false, platform: null, has_snapshot: false }),
      },
      { test: '/api/agents/chat/42/', method: 'GET', handler: () => unresolvedHistory },
      {
        test: '/api/agents/chat/42/',
        method: 'POST',
        handler: () => new Response(openStream, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
      },
    ]);

    renderApp(['/chat/42']);
    const textbox = await screen.findByRole('textbox', { name: /消息输入框/ });
    await screen.findByText('正在加载消息…');

    fireEvent.change(textbox, { target: { value: 'send without history' } });
    fireEvent.keyDown(textbox, { key: 'Enter', shiftKey: true });

    await screen.findByText('（发送中…）');
    expect(screen.getAllByText('send without history')).toHaveLength(1);
    const posts = calls.filter(
      (call) => call.url.pathname === '/api/agents/chat/42/' && call.init?.method === 'POST',
    );
    expect(posts).toHaveLength(1);
    const body = JSON.parse(String(posts[0]?.init?.body)) as Record<string, unknown>;
    expect(body.content).toBe('send without history');
    expect(body.client_turn_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(screen.queryByText(/消息历史尚未加载完成/)).toBeNull();
  });
});
