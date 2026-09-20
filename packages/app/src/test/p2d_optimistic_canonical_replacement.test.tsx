import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
} from './helpers';

// ── timeline-level fixtures ────────────────────────────────────────────────

const TURN_ID = '123e4567-e89b-42d3-a456-4266141740aa';
const OTHER_TURN_ID = '123e4567-e89b-42d3-a456-4266141740bb';

const viewMsg = (
  id: number,
  role: 'user' | 'assistant',
  content: string,
  indexInSession: number,
  clientTurnId: string | null = null,
): MessageView => ({
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
  createdAt: '2026-09-14T10:00:00Z',
  clientTurnId,
});

/** Legacy/unbound row exactly as normalization emits it: no correlation. */
const legacyUserRow = (id: number, content: string, indexInSession: number): MessageView => ({
  id,
  role: 'user',
  content,
  reasoningContent: null,
  platform: null,
  modelVersion: null,
  tokenCount: null,
  indexInSession,
  attachmentIds: [],
  attachmentsMeta: null,
  createdAt: '2026-09-14T10:00:00Z',
  clientTurnId: null,
});

const optimistic = (content: string, clientTurnId: string = TURN_ID): OptimisticUserRow => ({
  kind: 'client_user',
  clientKey: 'user:1',
  content,
  createdAt: '2026-09-14T10:00:01Z',
  pendingAttachmentIds: [],
  clientTurnId,
});

const streamingAssistant = (content: string): RuntimeAssistantRow => ({
  kind: 'client_assistant',
  clientKey: 'assistant:1',
  content,
  thinking: '',
  isStreaming: true,
});

function timelineElement(
  messages: MessageView[],
  extras: { optimisticUser?: OptimisticUserRow | null; runtimeAssistant?: RuntimeAssistantRow | null } = {},
) {
  return (
    <MessageTimeline
      messages={messages}
      hasOlder={false}
      loadingMore={false}
      onLoadMore={() => undefined}
      optimisticUser={extras.optimisticUser ?? null}
      runtimeAssistant={extras.runtimeAssistant ?? null}
    />
  );
}

function renderTimeline(
  messages: MessageView[],
  extras: { optimisticUser?: OptimisticUserRow | null; runtimeAssistant?: RuntimeAssistantRow | null } = {},
) {
  return render(timelineElement(messages, extras));
}

// ── live-seam fixtures ─────────────────────────────────────────────────────

const conversationRow = (id: number) => ({
  id,
  name: `Conversation #${id}`,
  created_at: '2026-09-01T10:00:00Z',
  frozen_project_ids: [],
  project: 0,
  project_name: null,
  agent_type: 'standard',
  agent_preset_id: 5,
  last_message_at: '2026-09-01T10:00:00Z',
  thinking_level: 'auto',
  memory_injection_enabled: null,
});

const liveMsg = (
  id: number,
  role: string,
  content: string,
  indexInSession: number,
  clientTurnId: string | null = null,
) => ({
  id,
  role,
  content,
  reasoning_content: null,
  platform: 'deepseek',
  model_version: 'v4-flash',
  token_count: null,
  index_in_session: indexInSession,
  attachment_ids: [],
  attachments_meta: null,
  created_at: '2026-09-01T10:00:00Z',
  client_turn_id: clientTurnId,
});

const arrivalFrame = (messageId: number) => ({
  kind: 'assistant-message-arrived',
  version: 1,
  event_id: 11,
  dedupe_key: `assistant-message:${messageId}`,
  conversation_id: 42,
  message_id: messageId,
  agent: { id: 7, name: 'Ecki' },
  preview: { policy: 'bounded_text', text: '稍后完整回答', truncated: false },
  target: { kind: 'conversation_message', conversation_id: 42, message_id: messageId },
  register_ack: null,
  ignore: { allowed: true },
  title_hint: null,
  committed_at: '2026-09-14T20:00:00Z',
});

// ── D-02/D-03/D-04/D-05: pure timeline projection ──────────────────────────

describe('P2D closure #2: optimistic → canonical user row replacement (exact correlation)', () => {
  it('D-04 keeps drawing the optimistic row for old rows, inserted assistants, same content, or a different correlation', () => {
    renderTimeline(
      [
        viewMsg(800, 'user', '旧的问题', 4),
        viewMsg(801, 'assistant', '旧的回答', 5),
        // Same content as the optimistic copy but no correlation: not identity.
        viewMsg(802, 'user', '新的问题', 6),
        // A neighbouring send's correlation: exact match required, never fuzzy.
        viewMsg(803, 'user', '另一轮的问题', 7, OTHER_TURN_ID),
      ],
      { optimisticUser: optimistic('新的问题') },
    );
    expect(screen.getByText('（发送中…）')).toBeTruthy();
    expect(document.querySelector('.app-msg--optimistic')).not.toBeNull();
    // Canonical same-content row + the optimistic copy both remain visible.
    expect(screen.getAllByText('新的问题')).toHaveLength(2);
  });

  it('D-02 stops drawing the optimistic copy once the canonical row carries the exact non-null correlation', () => {
    const rows = [
      viewMsg(800, 'user', '旧的问题', 4),
      viewMsg(801, 'assistant', '旧的回答', 5),
    ];
    const view = renderTimeline(rows, { optimisticUser: optimistic('新的问题') });
    expect(screen.getByText('（发送中…）')).toBeTruthy();

    view.rerender(
      timelineElement([...rows, viewMsg(900, 'user', '新的问题', 6, TURN_ID)], {
        optimisticUser: optimistic('新的问题'),
      }),
    );
    expect(screen.queryByText('（发送中…）')).toBeNull();
    expect(document.querySelector('.app-msg--optimistic')).toBeNull();
    expect(screen.getAllByText('新的问题')).toHaveLength(1);
  });

  it('D-04 never hands over to a missing or different correlation', () => {
    const view = renderTimeline(
      [viewMsg(800, 'user', '旧的问题', 4)],
      { optimisticUser: optimistic('新的问题') },
    );

    view.rerender(
      timelineElement([
        viewMsg(800, 'user', '旧的问题', 4),
        legacyUserRow(901, '新的问题', 5),
        viewMsg(902, 'user', '新的问题', 6, OTHER_TURN_ID),
      ], { optimisticUser: optimistic('新的问题') }),
    );
    expect(screen.getByText('（发送中…）')).toBeTruthy();
    expect(screen.getAllByText('新的问题')).toHaveLength(3);
  });

  it('D-04 does not treat a same-id assistant row as the user handover target', () => {
    renderTimeline(
      [viewMsg(800, 'user', '旧的问题', 4), viewMsg(950, 'assistant', '回答', 5, TURN_ID)],
      { optimisticUser: optimistic('新的问题') },
    );
    expect(screen.getByText('（发送中…）')).toBeTruthy();
    expect(screen.getAllByText('新的问题')).toHaveLength(1);
  });

  it('D-03 keeps the runtime assistant overlay streaming while the optimistic row is replaced', () => {
    renderTimeline(
      [viewMsg(800, 'user', '旧的问题', 4), viewMsg(900, 'user', '新的问题', 6, TURN_ID)],
      {
        optimisticUser: optimistic('新的问题'),
        runtimeAssistant: streamingAssistant('生成中的回答'),
      },
    );
    expect(screen.queryByText('（发送中…）')).toBeNull();
    expect(screen.getAllByText('新的问题')).toHaveLength(1);
    expect(screen.getByText('生成中的回答')).toBeTruthy();
    expect(screen.getAllByText('生成中…').length).toBeGreaterThan(0);
  });

  it('D-05 hands the empty-conversation first send over to its exact canonical row', () => {
    const first = renderTimeline([], { optimisticUser: optimistic('第一句') });
    expect(screen.getByText('（发送中…）')).toBeTruthy();
    expect(screen.getAllByText('第一句')).toHaveLength(1);
    first.unmount();

    renderTimeline([viewMsg(900, 'user', '第一句', 0, TURN_ID)], {
      optimisticUser: optimistic('第一句'),
    });
    expect(screen.queryByText('（发送中…）')).toBeNull();
    expect(screen.getAllByText('第一句')).toHaveLength(1);
  });
});

// ── D-01/D-02/D-05/D-06: the live runtime seam ─────────────────────────────

describe('P2D closure #2: exact canonical handover at the live runtime seam', () => {
  beforeEach(() => {
    ensureTestLocalStorage();
    window.localStorage.clear();
  });

  afterEach(() => {
    unmockFetch();
    window.localStorage.clear();
  });

  it('D-01/D-02/D-05/D-06: a send during unresolved history dispatches one UUID and hands over exactly once on its canonical row', async () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);

    let resolveInitialWindow: (response: Response) => void = () => {
      throw new Error('initial window resolver not ready');
    };
    const initialWindowGate = new Promise<Response>((resolve) => {
      resolveInitialWindow = resolve;
    });
    let windowCalls = 0;
    let streamController: ReadableStreamDefaultController<Uint8Array> | null = null;
    const encoder = new TextEncoder();
    let postClientTurnId: string | null = null;

    const finishStream = () => {
      if (!streamController) throw new Error('SSE stream controller is not ready');
      streamController.enqueue(encoder.encode('event: done\ndata: [DONE]\n\n'));
      streamController.close();
    };

    installRuntimeFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([runtimeTestPreset(5)]) },
      { test: '/api/agents/conversations/42/', handler: () => jsonResponse(conversationRow(42)) },
      {
        test: '/api/agents/conversations/42/cache/',
        handler: () => jsonResponse({ active: false, platform: null, has_snapshot: false }),
      },
      {
        test: '/api/agents/chat/42/',
        handler: (_url, init) => {
          if (init?.method === 'POST') {
            const body = JSON.parse(String(init.body)) as { client_turn_id?: string };
            postClientTurnId = body.client_turn_id ?? null;
            const stream = new ReadableStream<Uint8Array>({
              start(controller) {
                streamController = controller;
                controller.enqueue(encoder.encode('event: content\ndata: 边说边想\n\n'));
              },
            });
            return new Response(stream, {
              status: 200,
              headers: { 'Content-Type': 'text/event-stream' },
            });
          }
          windowCalls += 1;
          if (windowCalls === 1) return initialWindowGate; // pre-send window resolves late
          return jsonResponse({
            messages: [
              liveMsg(800, 'user', '旧的问题', 4),
              liveMsg(801, 'assistant', '旧的回答', 5),
              liveMsg(900, 'user', '你好呀', 6, postClientTurnId),
              liveMsg(999, 'assistant', '稍后完整回答', 7),
            ],
            total_count: 4,
            has_more: false,
          });
        },
      },
      {
        test: '/api/push/assistant-arrivals/',
        handler: (url) =>
          url.searchParams.get('after') === null
            ? jsonResponse({ events: [], next_cursor: 10, has_more: false })
            : jsonResponse({ events: [arrivalFrame(999)], next_cursor: 11, has_more: false }),
      },
    ]);

    renderApp(['/chat/42']);

    // The composer is available while the message history is still unresolved.
    const textbox = await screen.findByRole('textbox', { name: /消息输入框/ });
    await screen.findByText('正在加载消息…');

    const scroller = document.querySelector('.app-scroll') as HTMLElement;
    Object.defineProperty(scroller, 'scrollHeight', { configurable: true, get: () => 1000 });
    Object.defineProperty(scroller, 'clientHeight', { configurable: true, get: () => 300 });
    Object.defineProperty(scroller, 'scrollTop', { configurable: true, writable: true, value: 0 });
    fireEvent.scroll(scroller);
    await screen.findByRole('button', { name: /返回最新/ });

    // D-01: the pending history no longer blocks the send; the POST carries a
    // freshly minted canonical UUID shared with the optimistic row.
    fireEvent.change(textbox, { target: { value: '你好呀' } });
    fireEvent.keyDown(textbox, { key: 'Enter', shiftKey: true });
    await screen.findByText('（发送中…）');
    expect(screen.getAllByText('你好呀')).toHaveLength(1);
    expect(screen.queryByText(/消息历史尚未加载完成/)).toBeNull();
    expect(postClientTurnId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    // The stale pre-send window arrives late: no correlation present, so the
    // optimistic copy must stay (never hide on position or order).
    resolveInitialWindow(jsonResponse({
      messages: [liveMsg(800, 'user', '旧的问题', 4), liveMsg(801, 'assistant', '旧的回答', 5)],
      total_count: 2,
      has_more: false,
    }));
    await screen.findByText('旧的问题');
    expect(screen.getByText('（发送中…）')).toBeTruthy();
    expect(screen.getAllByText('你好呀')).toHaveLength(1);

    // Arrival + return to latest: the canonical window carries this attempt's
    // exact UUID and takes over the bubble exactly once, mid-generation.
    document.dispatchEvent(new Event('visibilitychange'));
    await screen.findByRole('button', { name: /有新消息/ });
    fireEvent.click(screen.getByRole('button', { name: /有新消息/ }));
    await screen.findByText('稍后完整回答');

    await waitFor(() => expect(screen.queryByText('（发送中…）')).toBeNull());
    expect(screen.getAllByText('你好呀')).toHaveLength(1);
    expect(document.querySelector('.app-msg--optimistic')).toBeNull();
    expect(screen.getByText('边说边想')).toBeTruthy();
    expect(screen.getAllByText('生成中…').length).toBeGreaterThan(0);

    // Complete the stream and let the operation release.
    finishStream();
    await waitFor(() => expect(screen.queryByText('边说边想')).toBeNull());

    // D-06: history still contains exactly one persisted user message and the
    // optimistic overlay is gone for good.
    expect(screen.getAllByText('你好呀')).toHaveLength(1);
    expect(document.querySelector('.app-msg--optimistic')).toBeNull();
    expect(screen.getByText('稍后完整回答')).toBeTruthy();
  });

  it('D-04: a window with only uncorrelated rows arriving mid-generation never hands the bubble over', async () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);

    let streamController: ReadableStreamDefaultController<Uint8Array> | null = null;
    const encoder = new TextEncoder();
    let postAccepted = false;

    const finishStream = () => {
      if (!streamController) throw new Error('SSE stream controller is not ready');
      streamController.enqueue(encoder.encode('event: done\ndata: [DONE]\n\n'));
      streamController.close();
    };

    installRuntimeFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([runtimeTestPreset(5)]) },
      { test: '/api/agents/conversations/42/', handler: () => jsonResponse(conversationRow(42)) },
      {
        test: '/api/agents/conversations/42/cache/',
        handler: () => jsonResponse({ active: false, platform: null, has_snapshot: false }),
      },
      {
        test: '/api/agents/chat/42/',
        handler: (_url, init) => {
          if (init?.method === 'POST') {
            postAccepted = true;
            const stream = new ReadableStream<Uint8Array>({
              start(controller) {
                streamController = controller;
                controller.enqueue(encoder.encode('event: content\ndata: 边说边想\n\n'));
              },
            });
            return new Response(stream, {
              status: 200,
              headers: { 'Content-Type': 'text/event-stream' },
            });
          }
          return jsonResponse({
            messages: postAccepted
              ? [
                  liveMsg(800, 'user', '旧的问题', 4),
                  liveMsg(801, 'assistant', '旧的回答', 5),
                  // A neighbouring writer's row: same conversation, no (or a
                  // different) correlation — never our handover target.
                  liveMsg(890, 'user', '别人同步进来的问题', 6, OTHER_TURN_ID),
                  liveMsg(999, 'assistant', '稍后完整回答', 7),
                ]
              : [liveMsg(800, 'user', '旧的问题', 4), liveMsg(801, 'assistant', '旧的回答', 5)],
            total_count: postAccepted ? 4 : 2,
            has_more: false,
          });
        },
      },
      {
        test: '/api/push/assistant-arrivals/',
        handler: (url) =>
          url.searchParams.get('after') === null
            ? jsonResponse({ events: [], next_cursor: 10, has_more: false })
            : jsonResponse({ events: [arrivalFrame(999)], next_cursor: 11, has_more: false }),
      },
    ]);

    renderApp(['/chat/42']);

    const textbox = await screen.findByRole('textbox', { name: /消息输入框/ });
    await screen.findByText('旧的问题');

    const scroller = document.querySelector('.app-scroll') as HTMLElement;
    Object.defineProperty(scroller, 'scrollHeight', { configurable: true, get: () => 1000 });
    Object.defineProperty(scroller, 'clientHeight', { configurable: true, get: () => 300 });
    Object.defineProperty(scroller, 'scrollTop', { configurable: true, writable: true, value: 0 });
    fireEvent.scroll(scroller);
    await screen.findByRole('button', { name: /返回最新/ });

    fireEvent.change(textbox, { target: { value: '你好呀' } });
    fireEvent.keyDown(textbox, { key: 'Enter', shiftKey: true });
    await screen.findByText('（发送中…）');
    expect(screen.getAllByText('你好呀')).toHaveLength(1);

    document.dispatchEvent(new Event('visibilitychange'));
    await screen.findByRole('button', { name: /有新消息/ });
    fireEvent.click(screen.getByRole('button', { name: /有新消息/ }));
    await screen.findByText('别人同步进来的问题');

    // The tentative window has no exact correlation: the optimistic bubble must
    // survive until its own canonical row (or terminal release) arrives.
    expect(screen.getByText('（发送中…）')).toBeTruthy();
    expect(screen.getAllByText('你好呀')).toHaveLength(1);

    finishStream();
    await waitFor(() => expect(screen.queryByText('边说边想')).toBeNull());
    // Terminal release clears the optimistic overlay itself; it never guesses
    // the correlation, so no duplicate ever flashes after cleanup.
    expect(screen.queryByText('（发送中…）')).toBeNull();
    expect(document.querySelector('.app-msg--optimistic')).toBeNull();
  });

  it('D-05: an accepted send stays visible while the history is in error, and the error surface is preserved', async () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);

    let streamController: ReadableStreamDefaultController<Uint8Array> | null = null;
    const encoder = new TextEncoder();
    let postAccepted = false;
    let postClientTurnId: string | null = null;

    const finishStream = () => {
      if (!streamController) throw new Error('SSE stream controller is not ready');
      streamController.enqueue(encoder.encode('event: done\ndata: [DONE]\n\n'));
      streamController.close();
    };

    installRuntimeFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([runtimeTestPreset(5)]) },
      { test: '/api/agents/conversations/42/', handler: () => jsonResponse(conversationRow(42)) },
      {
        test: '/api/agents/conversations/42/cache/',
        handler: () => jsonResponse({ active: false, platform: null, has_snapshot: false }),
      },
      {
        test: '/api/agents/chat/42/',
        handler: (_url, init) => {
          if (init?.method === 'POST') {
            postAccepted = true;
            const body = JSON.parse(String(init.body)) as { client_turn_id?: string };
            postClientTurnId = body.client_turn_id ?? null;
            const stream = new ReadableStream<Uint8Array>({
              start(controller) {
                streamController = controller;
                controller.enqueue(encoder.encode('event: content\ndata: 边说边想\n\n'));
              },
            });
            return new Response(stream, {
              status: 200,
              headers: { 'Content-Type': 'text/event-stream' },
            });
          }
          if (!postAccepted) return jsonResponse({ error: 'history unavailable' }, 500);
          return jsonResponse({
            messages: [
              liveMsg(800, 'user', '旧的问题', 4),
              liveMsg(801, 'assistant', '旧的回答', 5),
              liveMsg(900, 'user', '错误态下的发送', 6, postClientTurnId),
              liveMsg(999, 'assistant', '稍后完整回答', 7),
            ],
            total_count: 4,
            has_more: false,
          });
        },
      },
    ]);

    renderApp(['/chat/42']);
    const textbox = await screen.findByRole('textbox', { name: /消息输入框/ });
    // The failed history surface stays exactly as before.
    await screen.findByText(/消息加载失败/);

    fireEvent.change(textbox, { target: { value: '错误态下的发送' } });
    fireEvent.keyDown(textbox, { key: 'Enter', shiftKey: true });

    // D-05: pending and error both keep the accepted send visible instead of
    // swallowing the optimistic overlay behind the failure surface. The
    // failed-history surface itself is untouched.
    await screen.findByText('（发送中…）');
    expect(screen.getAllByText('错误态下的发送')).toHaveLength(1);
    expect(screen.getByText(/消息加载失败/)).toBeTruthy();

    // Terminal reconcile succeeds once the history recovers: the exact
    // correlation hands the bubble over and the overlay is released.
    finishStream();
    await waitFor(() => expect(screen.queryByText('（发送中…）')).toBeNull());
    expect(screen.getAllByText('错误态下的发送')).toHaveLength(1);
  });

  it('rejects an ordinary send without a canonical UUID source: no POST, no lease, draft kept', async () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    const realCrypto = window.crypto;
    // Capability removal under test: the canonical random source is absent.
    vi.stubGlobal('crypto', {
      getRandomValues: realCrypto.getRandomValues.bind(realCrypto),
      subtle: realCrypto.subtle,
    });

    const { calls } = installRuntimeFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([runtimeTestPreset(5)]) },
      { test: '/api/agents/conversations/42/', handler: () => jsonResponse(conversationRow(42)) },
      {
        test: '/api/agents/conversations/42/cache/',
        handler: () => jsonResponse({ active: false, platform: null, has_snapshot: false }),
      },
      {
        test: '/api/agents/chat/42/',
        handler: (_url, init) =>
          init?.method === 'POST'
            ? jsonResponse({ error: 'POST must not occur without a UUID source' }, 500)
            : jsonResponse({ messages: [], total_count: 0, has_more: false }),
      },
    ]);

    renderApp(['/chat/42']);
    const textbox = await screen.findByRole('textbox', { name: /消息输入框/ });
    await screen.findByText('还没有消息');

    fireEvent.change(textbox, { target: { value: '保留这句话' } });
    fireEvent.keyDown(textbox, { key: 'Enter', shiftKey: true });

    await screen.findByText(/缺少安全随机数能力/);
    expect((textbox as HTMLTextAreaElement).value).toBe('保留这句话');
    expect(
      calls.filter(
        (call) => call.url.pathname === '/api/agents/chat/42/' && call.init?.method === 'POST',
      ),
    ).toHaveLength(0);
    expect(window.localStorage.getItem('exo:v4:chat-runtime:42')).toBeNull();
    expect(screen.queryByText('（发送中…）')).toBeNull();
  });
});
