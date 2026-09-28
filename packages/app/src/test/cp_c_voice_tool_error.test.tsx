/**
 * CP-C minimal Desktop consumer — `send_voice_msg` failure surface.
 *
 * Frozen contract: backend Plan REVISE-7 §5.3/§8. This suite covers the live
 * SSE / polling wire guard, runtime-turn accumulation with (turn, position)
 * dedupe, the durable `Message.voice_tool_errors[]` read projection, the
 * assistant-row rendering, and two real `useChatRuntime` transport paths.
 */
import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { fetchMessagePage } from '../features/chat/api';
import { MessageTimeline } from '../features/chat/MessageTimeline';
import { queryKeys } from '../features/chat/queries';
import { applyNormalizedEvent } from '../features/chat/runtime/events';
import { normalizePollingEvent, normalizeSSEEvent } from '../features/chat/runtime/sse';
import type { RuntimeAssistantRow } from '../features/chat/runtime/types';
import { useChatRuntime } from '../features/chat/runtime/useChatRuntime';
import type { MessagePage, MessageView } from '../features/chat/types';
import { normalizeVoiceToolErrorList } from '../features/chat/voice/contract';
import { ensureTestLocalStorage, installFetch, jsonResponse, unmockFetch } from './helpers';

ensureTestLocalStorage();

afterEach(() => {
  cleanup();
  unmockFetch();
  localStorage.clear();
});

const baseRow: RuntimeAssistantRow = {
  kind: 'client_assistant',
  clientKey: 'assistant:1',
  content: 'answer',
  thinking: '',
  isStreaming: true,
};

function applyWire(prev: RuntimeAssistantRow | null, wire: object) {
  return applyNormalizedEvent(
    prev,
    normalizeSSEEvent('voice_tool_error', JSON.stringify(wire)),
    'assistant:1',
  );
}

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children?: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

const assistantMessage = (over: Partial<MessageView> = {}): MessageView => ({
  id: 71,
  role: 'assistant',
  content: '',
  reasoningContent: null,
  clientTurnId: null,
  platform: null,
  modelVersion: null,
  tokenCount: null,
  indexInSession: 0,
  attachmentIds: [],
  attachmentsMeta: [],
  createdAt: '2026-09-28T10:00:00Z',
  ...over,
});

function wireMessageRow(over: Record<string, unknown> = {}) {
  return {
    id: 7,
    role: 'assistant',
    content: '',
    reasoning_content: null,
    platform: null,
    model_version: null,
    token_count: null,
    index_in_session: 1,
    attachment_ids: [],
    attachments_meta: null,
    created_at: '2026-09-28T00:00:00Z',
    ...over,
  };
}

function respondWithRow(row: Record<string, unknown>) {
  installFetch([
    {
      test: '/api/agents/chat/5/',
      handler: () => jsonResponse({ messages: [row], total_count: 1, has_more: false }),
    },
  ]);
}

describe('CP-C voice_tool_error wire guard', () => {
  it('normalizes SSE and polling into the same bounded DTO', () => {
    const wire = { position: 0, error_code: 'generation_timeout' };
    const sse = normalizeSSEEvent('voice_tool_error', JSON.stringify(wire));
    const polling = normalizePollingEvent({ event_type: 'voice_tool_error', delta: wire });
    expect(sse).toEqual(polling);
    expect(sse).toMatchObject({
      event: 'voice_tool_error',
      parsedData: { position: 0, errorCode: 'generation_timeout' },
    });
  });

  it('drops injected content/style/provider prose and keeps only the bounded code', () => {
    const normalized = normalizeSSEEvent(
      'voice_tool_error',
      JSON.stringify({
        position: 2,
        error_code: 'tts_protocol_error',
        content: 'SECRET LINE',
        style: 'whisper',
        provider: 'gemini',
      }),
    );
    expect(normalized.event).toBe('voice_tool_error');
    expect(normalized.parsedData).toEqual({ position: 2, errorCode: 'tts_protocol_error' });
    expect(JSON.stringify(normalized.parsedData)).not.toContain('SECRET');
  });

  it.each([
    { label: 'null', value: null },
    { label: 'array', value: [] },
    { label: 'bare string', value: 'generation_timeout' },
    { label: 'empty object', value: {} },
    { label: 'missing code', value: { position: 0 } },
    { label: 'negative position', value: { position: -1, error_code: 'synthesis_failed' } },
    { label: 'fractional position', value: { position: 1.5, error_code: 'synthesis_failed' } },
    { label: 'string position', value: { position: '0', error_code: 'synthesis_failed' } },
    { label: 'empty code', value: { position: 0, error_code: '' } },
    { label: 'prose code', value: { position: 0, error_code: 'two words' } },
    { label: 'uppercase code', value: { position: 0, error_code: 'Generation_Timeout' } },
    { label: 'overlong code', value: { position: 0, error_code: 'x'.repeat(65) } },
    { label: 'markup code', value: { position: 0, error_code: '<script>alert(1)</script>' } },
  ])('isolates a malformed payload ($label) as a nonfatal warning', ({ value }) => {
    const normalized = normalizeSSEEvent('voice_tool_error', JSON.stringify(value));
    expect(normalized.event).toBe('malformed');
    expect(normalized.warning).toContain('voice_tool_error');
    expect(normalizePollingEvent({ event_type: 'voice_tool_error', delta: value }).event).toBe('malformed');

    const applied = applyNormalizedEvent(baseRow, normalized, baseRow.clientKey);
    expect(applied.next).toBe(baseRow);
    expect(applied.next?.content).toBe('answer');
    expect(applied.next?.voiceToolErrors).toBeUndefined();
  });
});

describe('CP-C runtime turn accumulation', () => {
  it('orders positions and dedupes repeated (turn, position) outcomes', () => {
    let row: RuntimeAssistantRow | null = null;
    row = applyWire(row, { position: 2, error_code: 'synthesis_failed' }).next;
    row = applyWire(row, { position: 0, error_code: 'generation_timeout' }).next;
    row = applyWire(row, { position: 2, error_code: 'synthesis_failed' }).next;
    row = applyWire(row, { position: 0, error_code: 'different_code' }).next;

    expect(row?.voiceToolErrors).toEqual([
      { position: 0, errorCode: 'generation_timeout' },
      { position: 2, errorCode: 'synthesis_failed' },
    ]);
    expect(row?.content).toBe('');
    expect(row?.isStreaming).toBe(true);
  });

  it('creates the assistant turn row for an error that precedes any content', () => {
    const applied = applyWire(null, { position: 0, error_code: 'generation_timeout' });
    expect(applied.next).toMatchObject({
      kind: 'client_assistant',
      content: '',
      voiceToolErrors: [{ position: 0, errorCode: 'generation_timeout' }],
    });
  });
});

describe('CP-C durable Message.voice_tool_errors[] projection', () => {
  it('projects, orders, dedupes and drops injected tool fields', async () => {
    respondWithRow(
      wireMessageRow({
        voice_tool_errors: [
          { position: 1, error_code: 'tts_protocol_error', content: 'SECRET', style: 'whisper' },
          { position: 0, error_code: 'generation_timeout' },
          { position: 1, error_code: 'tts_protocol_error' },
          { position: 3, error_code: 'UPPER' },
          { position: -1, error_code: 'synthesis_failed' },
        ],
      }),
    );
    const page = await fetchMessagePage(5, 0);
    expect(page.messages[0].voiceToolErrors).toEqual([
      { position: 0, errorCode: 'generation_timeout' },
      { position: 1, errorCode: 'tts_protocol_error' },
    ]);
  });

  it('is empty for absent, malformed and non-assistant rows', async () => {
    expect(normalizeVoiceToolErrorList(undefined)).toEqual([]);
    expect(normalizeVoiceToolErrorList('generation_timeout')).toEqual([]);
    expect(normalizeVoiceToolErrorList([{ position: 0, error_code: 'synthesis_failed', content: 'x' }])).toEqual([
      { position: 0, errorCode: 'synthesis_failed' },
    ]);

    respondWithRow(
      wireMessageRow({
        role: 'user',
        voice_tool_errors: [{ position: 0, error_code: 'generation_timeout' }],
      }),
    );
    const page = await fetchMessagePage(5, 0);
    expect(page.messages[0].voiceToolErrors).toEqual([]);
  });
});

describe('CP-C assistant row failure surface', () => {
  it('renders one safe notice per durable position, without a player or empty-message copy', () => {
    const { container } = render(
      <MessageTimeline
        messages={[
          assistantMessage({
            voiceToolErrors: [
              { position: 0, errorCode: 'generation_timeout' },
              { position: 1, errorCode: 'tts_protocol_error' },
            ],
          }),
        ]}
        hasOlder={false}
        loadingMore={false}
        onLoadMore={() => {}}
      />,
    );
    expect(screen.getAllByTestId('voice-tool-error')).toHaveLength(2);
    expect(screen.getAllByText('send_voice_msg 调用失败')).toHaveLength(2);
    expect(screen.getByText('generation_timeout')).toBeInTheDocument();
    expect(screen.getByText('tts_protocol_error')).toBeInTheDocument();
    expect(container.querySelector('audio')).toBeNull();
    expect(screen.queryByText('（空消息）')).toBeNull();
  });

  it('shows the live turn failure instead of the waiting spinner', () => {
    render(
      <MessageTimeline
        messages={[]}
        hasOlder={false}
        loadingMore={false}
        onLoadMore={() => {}}
        runtimeAssistant={{
          kind: 'client_assistant',
          clientKey: 'assistant:1',
          content: '',
          thinking: '',
          isStreaming: true,
          voiceToolErrors: [{ position: 0, errorCode: 'synthesis_failed' }],
        }}
      />,
    );
    expect(screen.getByText('send_voice_msg 调用失败')).toBeInTheDocument();
    expect(screen.getByText('synthesis_failed')).toBeInTheDocument();
    expect(screen.queryByLabelText('等待回答')).toBeNull();
  });
});

describe('CP-C live transports through the existing runtime controller', () => {
  it('routes SSE voice_tool_error into the one runtime assistant turn with dedupe', async () => {
    const encoder = new TextEncoder();
    installFetch([
      {
        test: '/api/agents/chat/60/',
        method: 'POST',
        handler: () =>
          new Response(
            new ReadableStream({
              start(controller) {
                controller.enqueue(
                  encoder.encode(
                    'event: voice_tool_error\ndata: {"position":0,"error_code":"generation_timeout"}\n\n' +
                      'event: voice_tool_error\ndata: {"position":0,"error_code":"generation_timeout"}\n\n' +
                      'event: voice_tool_error\ndata: {"position":1,"error_code":"synthesis_failed"}\n\n' +
                      'event: voice_tool_error\ndata: {"position":0,"error_code":"different_code"}\n\n' +
                      'event: voice_tool_error\ndata: {"position":2,"error_code":"secret prose"}\n\n' +
                      'event: content\ndata: hello\n\n',
                  ),
                );
              },
            }),
            { headers: { 'Content-Type': 'text/event-stream' } },
          ),
      },
    ]);
    const { result, unmount } = renderHook(() => useChatRuntime({ conversationId: 60 }), {
      wrapper: wrapper(),
    });
    act(() => {
      void result.current.sendMessage({ content: 'hello' });
    });
    await waitFor(() => expect(result.current.runtimeAssistant?.content).toBe('hello'));
    expect(result.current.runtimeAssistant?.voiceToolErrors).toEqual([
      { position: 0, errorCode: 'generation_timeout' },
      { position: 1, errorCode: 'synthesis_failed' },
    ]);
    expect(result.current.protocolWarning).toContain('voice_tool_error');

    const row = result.current.runtimeAssistant as RuntimeAssistantRow;
    render(
      <MessageTimeline
        messages={[]}
        hasOlder={false}
        loadingMore={false}
        onLoadMore={() => {}}
        runtimeAssistant={row}
      />,
    );
    expect(screen.getAllByTestId('voice-tool-error')).toHaveLength(2);
    expect(screen.queryByText('different_code')).toBeNull();
    expect(screen.queryByText('secret prose')).toBeNull();
    unmount();
  });

  it('replaces a live failure with its canonical durable row exactly once', async () => {
    const encoder = new TextEncoder();
    let releaseReconcile!: () => void;
    const reconcileGate = new Promise<void>((resolve) => {
      releaseReconcile = resolve;
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    installFetch([
      {
        test: '/api/agents/chat/63/',
        method: 'POST',
        handler: () =>
          new Response(
            new ReadableStream({
              start(controller) {
                controller.enqueue(
                  encoder.encode(
                    'event: voice_tool_error\ndata: {"position":0,"error_code":"generation_timeout"}\n\n' +
                      'event: done\ndata: [DONE]\n\n',
                  ),
                );
                controller.close();
              },
            }),
            { headers: { 'Content-Type': 'text/event-stream' } },
          ),
      },
      {
        test: '/api/agents/chat/63/',
        method: 'GET',
        handler: async () => {
          await reconcileGate;
          return jsonResponse({
            messages: [wireMessageRow({
              id: 630,
              voice_tool_errors: [{ position: 0, error_code: 'generation_timeout' }],
            })],
            total_count: 1,
            has_more: false,
          });
        },
      },
    ]);
    const { result, unmount } = renderHook(() => useChatRuntime({ conversationId: 63 }), {
      wrapper: ({ children }: { children?: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    act(() => {
      void result.current.sendMessage({ content: 'hello' });
    });
    await waitFor(() =>
      expect(result.current.runtimeAssistant?.voiceToolErrors).toEqual([
        { position: 0, errorCode: 'generation_timeout' },
      ]),
    );

    act(() => releaseReconcile());
    await waitFor(() => expect(result.current.runtimeAssistant).toBeNull());
    const cached = client.getQueryData<{ pages: MessagePage[] }>(queryKeys.messages(63));
    const canonicalMessages = cached?.pages[0]?.messages ?? [];
    render(
      <MessageTimeline
        messages={canonicalMessages}
        hasOlder={false}
        loadingMore={false}
        onLoadMore={() => {}}
        runtimeAssistant={result.current.runtimeAssistant}
      />,
    );
    expect(screen.getAllByTestId('voice-tool-error')).toHaveLength(1);
    expect(screen.getAllByText('generation_timeout')).toHaveLength(1);
    unmount();
  });

  it('routes polling voice_tool_error through the same overlay vocabulary', async () => {
    installFetch([
      {
        test: '/api/agents/chat/61/',
        method: 'POST',
        handler: () => jsonResponse({ message_id: 'token61', status: 'processing' }),
      },
      {
        test: '/api/agents/chat/61/status/',
        method: 'GET',
        handler: () =>
          jsonResponse({
            status: 'processing',
            events: [
              { event_type: 'voice_tool_error', delta: { position: 1, error_code: 'synthesis_failed' } },
              { event_type: 'voice_tool_error', delta: { position: 0, error_code: 'generation_timeout' } },
              { event_type: 'voice_tool_error', delta: { position: 1, error_code: 'synthesis_failed' } },
            ],
            cursor: 3,
            error_message: null,
          }),
      },
    ]);
    const { result, unmount } = renderHook(() => useChatRuntime({ conversationId: 61 }), {
      wrapper: wrapper(),
    });
    act(() => result.current.setTransport('async'));
    act(() => {
      void result.current.sendMessage({ content: 'hello' });
    });
    await waitFor(() =>
      expect(result.current.runtimeAssistant?.voiceToolErrors).toEqual([
        { position: 0, errorCode: 'generation_timeout' },
        { position: 1, errorCode: 'synthesis_failed' },
      ]),
    );
    unmount();
  });

  it('carries live failures onto the retained stopped trace-only row', async () => {
    const encoder = new TextEncoder();
    const trace = {
      version: 1,
      run_id: 'run-62',
      sequence: 0,
      item_id: 'tool-1',
      kind: 'tool',
      call_id: 'call-1',
      lifecycle: 'started',
      tool_name: 'send_voice_msg',
    };
    installFetch([
      {
        test: '/api/agents/chat/62/',
        method: 'POST',
        handler: () =>
          new Response(
            new ReadableStream({
              start(controller) {
                controller.enqueue(
                  encoder.encode(
                    `event: assistant_trace\ndata: ${JSON.stringify(trace)}\n\n` +
                      'event: voice_tool_error\ndata: {"position":0,"error_code":"generation_timeout"}\n\n' +
                      'event: stopped\ndata: [STOPPED]\n\n',
                  ),
                );
                controller.close();
              },
            }),
            { headers: { 'Content-Type': 'text/event-stream' } },
          ),
      },
      {
        test: '/api/agents/chat/62/',
        method: 'GET',
        handler: () => jsonResponse({ messages: [], total_count: 0, has_more: false }),
      },
    ]);
    const { result, unmount } = renderHook(() => useChatRuntime({ conversationId: 62 }), {
      wrapper: wrapper(),
    });
    act(() => {
      void result.current.sendMessage({ content: 'stop me' });
    });
    await waitFor(() => expect(result.current.busy).toBe(false));
    const row = result.current.runtimeAssistant;
    expect(row?.terminalKind).toBe('stopped');
    expect(row?.voiceToolErrors).toEqual([{ position: 0, errorCode: 'generation_timeout' }]);

    render(
      <MessageTimeline
        messages={[]}
        hasOlder={false}
        loadingMore={false}
        onLoadMore={() => {}}
        runtimeAssistant={row}
      />,
    );
    expect(screen.getByText('send_voice_msg 调用失败')).toBeInTheDocument();
    expect(screen.getByText('generation_timeout')).toBeInTheDocument();
    unmount();
  });
});
