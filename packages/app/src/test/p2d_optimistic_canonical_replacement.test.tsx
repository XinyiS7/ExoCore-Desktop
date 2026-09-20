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

const viewMsg = (
  id: number,
  role: 'user' | 'assistant',
  content: string,
  indexInSession: number,
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
});

const optimistic = (content: string, priorUserIndexInSession: number | null): OptimisticUserRow => ({
  kind: 'client_user',
  clientKey: 'user:1',
  content,
  createdAt: '2026-09-14T10:00:01Z',
  pendingAttachmentIds: [],
  priorUserIndexInSession,
});

const streamingAssistant = (content: string): RuntimeAssistantRow => ({
  kind: 'client_assistant',
  clientKey: 'assistant:1',
  content,
  thinking: '',
  isStreaming: true,
});

function renderTimeline(
  messages: MessageView[],
  extras: { optimisticUser?: OptimisticUserRow | null; runtimeAssistant?: RuntimeAssistantRow | null } = {},
) {
  return render(
    <MessageTimeline
      messages={messages}
      hasOlder={false}
      loadingMore={false}
      onLoadMore={() => undefined}
      optimisticUser={extras.optimisticUser ?? null}
      runtimeAssistant={extras.runtimeAssistant ?? null}
    />,
  );
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

const liveMsg = (id: number, role: string, content: string, indexInSession: number) => ({
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

// ── D-01..D-05: pure timeline projection ───────────────────────────────────

describe('P2D closure #2: optimistic → canonical user row replacement (timeline projection)', () => {
  it('D-01 keeps drawing the optimistic row while no canonical replacement exists', () => {
    renderTimeline(
      [viewMsg(800, 'user', '旧的问题', 4), viewMsg(801, 'assistant', '旧的回答', 5)],
      { optimisticUser: optimistic('新的问题', 4) },
    );
    expect(screen.getAllByText('新的问题')).toHaveLength(1);
    expect(screen.getByText('（发送中…）')).toBeTruthy();
  });

  it('D-02 stops drawing the optimistic copy once a strictly later canonical user row exists', () => {
    renderTimeline(
      [
        viewMsg(800, 'user', '旧的问题', 4),
        viewMsg(801, 'assistant', '旧的回答', 5),
        viewMsg(900, 'user', '新的问题', 6),
      ],
      { optimisticUser: optimistic('新的问题', 5) },
    );
    expect(screen.getAllByText('新的问题')).toHaveLength(1);
    expect(screen.queryByText('（发送中…）')).toBeNull();
    expect(document.querySelector('.app-msg--optimistic')).toBeNull();
  });

  it('D-03 keeps the runtime assistant overlay streaming while the optimistic row is replaced', () => {
    renderTimeline(
      [viewMsg(800, 'user', '旧的问题', 4), viewMsg(900, 'user', '新的问题', 6)],
      {
        optimisticUser: optimistic('新的问题', 4),
        runtimeAssistant: streamingAssistant('生成中的回答'),
      },
    );
    expect(screen.getAllByText('新的问题')).toHaveLength(1);
    expect(screen.queryByText('（发送中…）')).toBeNull();
    expect(screen.getByText('生成中的回答')).toBeTruthy();
    expect(screen.getAllByText('生成中…').length).toBeGreaterThan(0);
  });

  it('D-04 does not hide the optimistic row while every canonical user row is at or before the boundary', () => {
    renderTimeline(
      [
        viewMsg(800, 'user', '旧的问题', 4),
        viewMsg(900, 'user', '上一轮问题', 5),
        viewMsg(901, 'assistant', '上一轮回答', 6),
      ],
      { optimisticUser: optimistic('新的问题', 5) },
    );
    expect(screen.getAllByText('新的问题')).toHaveLength(1);
    expect(screen.getByText('（发送中…）')).toBeTruthy();
  });

  it('D-05 handles the empty-conversation first send from no prior user to the first canonical user', () => {
    const first = renderTimeline([], { optimisticUser: optimistic('第一句', null) });
    expect(screen.getByText('（发送中…）')).toBeTruthy();
    expect(screen.getAllByText('第一句')).toHaveLength(1);
    first.unmount();

    renderTimeline([viewMsg(900, 'user', '第一句', 0)], {
      optimisticUser: optimistic('第一句', null),
    });
    expect(screen.queryByText('（发送中…）')).toBeNull();
    expect(screen.getAllByText('第一句')).toHaveLength(1);
  });
});

// ── D-02 / D-03 / D-06: the live runtime seam ──────────────────────────────

describe('P2D closure #2: canonical replacement at the live runtime seam', () => {
  beforeEach(() => {
    ensureTestLocalStorage();
    window.localStorage.clear();
  });

  afterEach(() => {
    unmockFetch();
    window.localStorage.clear();
  });

  it('D-02/D-03/D-06: an in-flight newest-window refresh hands the user bubble to its canonical row exactly once', async () => {
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
                  liveMsg(900, 'user', '你好呀', 6),
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

    // Reader scrolls away from the bottom (jsdom has no layout geometry).
    const scroller = document.querySelector('.app-scroll') as HTMLElement;
    Object.defineProperty(scroller, 'scrollHeight', { configurable: true, get: () => 1000 });
    Object.defineProperty(scroller, 'clientHeight', { configurable: true, get: () => 300 });
    Object.defineProperty(scroller, 'scrollTop', { configurable: true, writable: true, value: 0 });
    fireEvent.scroll(scroller);
    await screen.findByRole('button', { name: /返回最新/ });

    // Ordinary send: the optimistic bubble provides immediate feedback.
    fireEvent.change(textbox, { target: { value: '你好呀' } });
    fireEvent.keyDown(textbox, { key: 'Enter', shiftKey: true });
    await screen.findByText('（发送中…）');
    expect(screen.getAllByText('你好呀')).toHaveLength(1);

    // An arrival for this conversation lands via the incremental poll.
    document.dispatchEvent(new Event('visibilitychange'));
    await screen.findByRole('button', { name: /有新消息/ });

    // Returning to the newest window applies the canonical window mid-generation.
    fireEvent.click(screen.getByRole('button', { name: /有新消息/ }));
    await screen.findByText('稍后完整回答');

    // D-02: exactly one drawn copy of the user message — canonical only.
    await waitFor(() => expect(screen.queryByText('（发送中…）')).toBeNull());
    expect(screen.getAllByText('你好呀')).toHaveLength(1);
    expect(document.querySelector('.app-msg--optimistic')).toBeNull();
    // D-03: the runtime assistant overlay still streams.
    expect(screen.getByText('边说边想')).toBeTruthy();
    expect(screen.getAllByText('生成中…').length).toBeGreaterThan(0);

    // Complete the stream and let the operation release.
    finishStream();
    await waitFor(() => expect(screen.queryByText('边说边想')).toBeNull());

    // D-06: history still contains exactly one persisted user message.
    expect(screen.getAllByText('你好呀')).toHaveLength(1);
    expect(document.querySelector('.app-msg--optimistic')).toBeNull();
    expect(screen.getByText('稍后完整回答')).toBeTruthy();
  });
});
