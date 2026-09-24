import { act, cleanup, render, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { MessageTimeline } from '../features/chat/MessageTimeline';
import { queryKeys } from '../features/chat/queries';
import { readRuntimeLease } from '../features/chat/runtime/storage';
import type { RuntimeAssistantRow } from '../features/chat/runtime/types';
import { useChatRuntime } from '../features/chat/runtime/useChatRuntime';
import { installFetch, jsonResponse, unmockFetch } from './helpers';

const trace = {
  version: 1,
  run_id: 'run-1',
  sequence: 0,
  item_id: 'thinking-1',
  kind: 'thinking',
  lifecycle: 'delta',
  text_delta: 'structured',
};

function wrapper(client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return ({ children }: { children?: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

afterEach(() => {
  cleanup();
  unmockFetch();
  localStorage.clear();
});

describe('P1D trace through the existing runtime controller', () => {
  it('routes SSE trace into the one runtime assistant overlay', async () => {
    const encoder = new TextEncoder();
    installFetch([{
      test: '/api/agents/chat/42/',
      method: 'POST',
      handler: () => new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`event: thinking\ndata: structured\n\nevent: assistant_trace\ndata: ${JSON.stringify(trace)}\n\n`));
        },
      }), { headers: { 'Content-Type': 'text/event-stream' } }),
    }]);
    const { result, unmount } = renderHook(() => useChatRuntime({ conversationId: 42 }), { wrapper: wrapper() });
    act(() => { void result.current.sendMessage({ content: 'hello' }); });
    await waitFor(() => expect(result.current.runtimeAssistant?.assistantTrace?.items).toEqual([
      { itemId: 'thinking-1', order: 0, kind: 'thinking', text: 'structured' },
    ]));
    expect(result.current.runtimeAssistant?.thinking).toBe('');
    unmount();
  });

  it('routes polling trace through the same overlay without duplicating legacy thinking', async () => {
    installFetch([
      {
        test: '/api/agents/chat/43/', method: 'POST',
        handler: () => jsonResponse({ message_id: 'token123', status: 'processing' }),
      },
      {
        test: '/api/agents/chat/43/status/', method: 'GET',
        handler: () => jsonResponse({
          status: 'processing',
          events: [
            { event_type: 'assistant_trace', delta: trace },
            { event_type: 'thinking', delta: 'structured' },
            {
              event_type: 'telemetry',
              delta: { model_name: 'm', input_chars: 10, output_chars: 4, tool_calls: 1 },
            },
          ],
          cursor: 3,
          error_message: null,
        }),
      },
    ]);
    const { result, unmount } = renderHook(() => useChatRuntime({ conversationId: 43 }), { wrapper: wrapper() });
    act(() => result.current.setTransport('async'));
    act(() => { void result.current.sendMessage({ content: 'hello' }); });
    await waitFor(() => expect(result.current.runtimeAssistant?.assistantTrace?.items).toEqual([
      { itemId: 'thinking-1', order: 0, kind: 'thinking', text: 'structured' },
    ]));
    expect(result.current.runtimeAssistant?.thinking).toBe('');
    expect(result.current.telemetryProjection).toEqual({
      lastTurn: { modelName: 'm', inputChars: 10, outputChars: 4, toolCalls: 1 },
      totals: { acceptedRuns: 1, inputChars: 10, outputChars: 4, toolCalls: 1, cachedInputChars: 0 },
    });
    unmount();
  });

  it('counts one accepted SSE run once, replaces duplicate observation, and resets on route change', async () => {
    const encoder = new TextEncoder();
    installFetch([{
      test: '/api/agents/chat/44/',
      method: 'POST',
      handler: () => new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(
            'event: telemetry\ndata: {"model_name":"m","input_chars":10,"tool_calls":1}\n\n' +
            'event: telemetry\ndata: {"model_name":"m","input_chars":12,"tool_calls":2}\n\n',
          ));
        },
      }), { headers: { 'Content-Type': 'text/event-stream' } }),
    }]);
    const { result, rerender, unmount } = renderHook(
      ({ id }) => useChatRuntime({ conversationId: id }),
      { wrapper: wrapper(), initialProps: { id: 44 } },
    );
    act(() => { void result.current.sendMessage({ content: 'hello' }); });
    await waitFor(() => expect(result.current.telemetryProjection.totals).toEqual({
      acceptedRuns: 1, inputChars: 12, outputChars: 0, toolCalls: 2, cachedInputChars: 0,
    }));
    expect(result.current.telemetryProjection.lastTurn).toEqual({
      modelName: 'm', inputChars: 12, toolCalls: 2,
    });

    rerender({ id: 45 });
    await waitFor(() => expect(result.current.telemetryProjection).toEqual({
      lastTurn: null,
      totals: { acceptedRuns: 0, inputChars: 0, outputChars: 0, toolCalls: 0, cachedInputChars: 0 },
    }));
    unmount();
  });

  it('adds exactly one telemetry contribution for each sequential accepted run', async () => {
    const encoder = new TextEncoder();
    let posts = 0;
    installFetch([
      {
        test: '/api/agents/chat/45/', method: 'POST',
        handler: () => {
          posts += 1;
          const input = posts * 10;
          return new Response(new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode(
                `event: telemetry\ndata: {"input_chars":${input}}\n\nevent: done\ndata: [DONE]\n\n`,
              ));
              controller.close();
            },
          }), { headers: { 'Content-Type': 'text/event-stream' } });
        },
      },
      {
        test: '/api/agents/chat/45/', method: 'GET',
        handler: () => jsonResponse({ messages: [], total_count: 0, has_more: false }),
      },
    ]);
    const { result, unmount } = renderHook(() => useChatRuntime({ conversationId: 45 }), { wrapper: wrapper() });
    await act(async () => { await result.current.sendMessage({ content: 'one' }); });
    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(result.current.telemetryProjection.totals).toMatchObject({ acceptedRuns: 1, inputChars: 10 });

    await act(async () => { await result.current.sendMessage({ content: 'two' }); });
    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(result.current.telemetryProjection).toMatchObject({
      lastTurn: { inputChars: 20 },
      totals: { acceptedRuns: 2, inputChars: 30 },
    });
    unmount();
  });

  it('keeps malformed trace nonterminal, then replaces the overlay only after canonical trace is applied', async () => {
    const encoder = new TextEncoder();
    let streamController!: ReadableStreamDefaultController<Uint8Array>;
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const canonicalTrace = {
      version: 1,
      availability: 'available',
      items: [{ item_id: 'thinking-1', order: 0, kind: 'thinking', text: 'structured' }],
    };
    installFetch([
      {
        test: '/api/agents/chat/46/', method: 'POST',
        handler: () => new Response(new ReadableStream({
          start(controller) {
            streamController = controller;
            controller.enqueue(encoder.encode(
              `event: assistant_trace\ndata: ${JSON.stringify(trace)}\n\n` +
              'event: assistant_trace\ndata: {"version":2,"kind":"thinking"}\n\n' +
              'event: content\ndata: answer\n\n',
            ));
          },
        }), { headers: { 'Content-Type': 'text/event-stream' } }),
      },
      {
        test: '/api/agents/chat/46/', method: 'GET',
        handler: () => jsonResponse({
          messages: [{
            id: 9, role: 'assistant', content: 'answer', reasoning_content: 'structured',
            assistant_run_trace: canonicalTrace, platform: 'test', model_version: 'm', token_count: 1,
            index_in_session: 0, attachment_ids: [], attachments_meta: [], created_at: '2026-09-01T00:00:00Z',
          }],
          total_count: 1, has_more: false,
        }),
      },
    ]);
    const { result, unmount } = renderHook(() => useChatRuntime({ conversationId: 46 }), {
      wrapper: wrapper(client),
    });
    act(() => { void result.current.sendMessage({ content: 'hello' }); });
    await waitFor(() => expect(result.current.runtimeAssistant).toMatchObject({
      content: 'answer',
      assistantTrace: { runId: 'run-1', items: [{ text: 'structured' }] },
    }));
    expect(result.current.runtimeAssistant?.terminalKind).toBeUndefined();
    expect(result.current.protocolWarning).toContain('assistant_trace');

    act(() => {
      streamController.enqueue(encoder.encode('event: done\ndata: [DONE]\n\n'));
      streamController.close();
    });
    await waitFor(() => expect(result.current.runtimeAssistant).toBeNull());
    const cached = client.getQueryData(queryKeys.messages(46)) as {
      pages: Array<{ messages: Array<{ content: string; assistantRunTrace: unknown }> }>;
    };
    expect(cached.pages[0].messages[0]).toMatchObject({
      content: 'answer',
      assistantRunTrace: {
        availability: 'available',
        items: [{ itemId: 'thinking-1', order: 0, kind: 'thinking', text: 'structured' }],
      },
    });
    unmount();
  });
});

describe('D-C1 stopped trace-only retention & lifecycle', () => {
  it('D1/D2: runtimeTraceProjection maps non-streaming started tools to incomplete while preserving finished states', () => {
    const row: RuntimeAssistantRow = {
      kind: 'client_assistant',
      clientKey: 'assistant:1',
      content: '',
      thinking: '',
      isStreaming: false,
      terminalKind: 'stopped',
      statusText: '已停止生成',
      assistantTrace: {
        runId: 'run-1',
        lastSequence: 3,
        items: [
          { itemId: 't-1', order: 0, kind: 'thinking', text: 'thinking text' },
          {
            itemId: 'c-1', order: 1, kind: 'tool', callId: 'call-1',
            lifecycle: 'started', toolName: 'search_web',
            argumentPreview: null, resultSummary: null, errorSummary: null, durationMs: null,
          },
          {
            itemId: 'c-2', order: 2, kind: 'tool', callId: 'call-2',
            lifecycle: 'succeeded', toolName: 'memory_search',
            argumentPreview: null, resultSummary: null, errorSummary: null, durationMs: 42,
          },
          {
            itemId: 'c-3', order: 3, kind: 'tool', callId: 'call-3',
            lifecycle: 'failed', toolName: 'private_log',
            argumentPreview: null, resultSummary: null, errorSummary: null, durationMs: 15,
          },
        ],
      },
    };

    const { container, rerender } = render(
      <MessageTimeline
        messages={[]}
        conversationId={1}
        hasOlder={false}
        loadingMore={false}
        onLoadMore={() => {}}
        runtimeAssistant={row}
      />,
    );

    // Non-streaming (stopped): started tool maps to incomplete ('中断')
    const toolBadges = container.querySelectorAll('.v4-trace-tool-badge');
    expect(toolBadges).toHaveLength(3);
    expect(toolBadges[0].textContent).toBe('中断');
    expect(toolBadges[0].className).toContain('v4-trace-tool-badge--incomplete');
    expect(toolBadges[1].textContent).toBe('完成');
    expect(toolBadges[1].className).toContain('v4-trace-tool-badge--succeeded');
    expect(toolBadges[2].textContent).toBe('失败');
    expect(toolBadges[2].className).toContain('v4-trace-tool-badge--failed');

    // Streaming: started tool maps to started ('调用中')
    rerender(
      <MessageTimeline
        messages={[]}
        conversationId={1}
        hasOlder={false}
        loadingMore={false}
        onLoadMore={() => {}}
        runtimeAssistant={{ ...row, isStreaming: true }}
      />,
    );
    const streamingBadges = container.querySelectorAll('.v4-trace-tool-badge');
    expect(streamingBadges[0].textContent).toBe('调用中');
    expect(streamingBadges[0].className).toContain('v4-trace-tool-badge--started');
  });

  it('D3: retains only trace + stopped status after stopped SSE turn; clears partial content, thinking, and optimistic user; releases lock/lease', async () => {
    const encoder = new TextEncoder();
    const thinking50 = {
      version: 1, run_id: 'run-50', sequence: 0, item_id: 'thinking-1',
      kind: 'thinking', lifecycle: 'delta', text_delta: 'structured',
    };
    const toolStarted = {
      version: 1, run_id: 'run-50', sequence: 1, item_id: 'tool-1',
      kind: 'tool', call_id: 'call-1', lifecycle: 'started', tool_name: 'memory_search',
    };
    const toolSucceeded = {
      version: 1, run_id: 'run-50', sequence: 2, item_id: 'tool-1',
      kind: 'tool', call_id: 'call-1', lifecycle: 'succeeded', tool_name: 'memory_search',
      duration_ms: 50,
    };
    const toolInterrupted = {
      version: 1, run_id: 'run-50', sequence: 3, item_id: 'tool-2',
      kind: 'tool', call_id: 'call-2', lifecycle: 'started', tool_name: 'search_web',
    };

    installFetch([
      {
        test: '/api/agents/chat/50/', method: 'POST',
        handler: () => new Response(new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(
              `event: thinking\ndata: legacy think\n\n` +
              `event: assistant_trace\ndata: ${JSON.stringify(thinking50)}\n\n` +
              `event: assistant_trace\ndata: ${JSON.stringify(toolStarted)}\n\n` +
              `event: assistant_trace\ndata: ${JSON.stringify(toolSucceeded)}\n\n` +
              `event: assistant_trace\ndata: ${JSON.stringify(toolInterrupted)}\n\n` +
              `event: content\ndata: partial text\n\n` +
              `event: stopped\ndata: [STOPPED]\n\n`,
            ));
            controller.close();
          },
        }), { headers: { 'Content-Type': 'text/event-stream' } }),
      },
      {
        test: '/api/agents/chat/50/', method: 'GET',
        handler: () => jsonResponse({ messages: [], total_count: 0, has_more: false }),
      },
    ]);

    const { result, unmount } = renderHook(() => useChatRuntime({ conversationId: 50 }), { wrapper: wrapper() });

    act(() => { void result.current.sendMessage({ content: 'test stopped' }); });

    // Wait for terminal reconciliation to complete and operation lock to release
    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(result.current.status).toBe('idle');
    expect(result.current.isOperationPending()).toBe(false);

    // Invariant: lease is cleared from localStorage
    expect(readRuntimeLease(50).state).toBe('absent');

    // Invariant: no optimistic user survives
    expect(result.current.optimisticUser).toBeNull();

    // Invariant: retained runtime assistant has only trace + stopped status
    const row = result.current.runtimeAssistant;
    expect(row).not.toBeNull();
    expect(row?.terminalKind).toBe('stopped');
    expect(row?.statusText).toBe('已停止生成');
    expect(row?.isStreaming).toBe(false);
    expect(row?.content).toBe(''); // partial content cleared
    expect(row?.thinking).toBe(''); // partial thinking cleared
    expect(row?.telemetry).toBeUndefined();
    expect(row?.assistantTrace?.items).toHaveLength(3); // thinking, tool-1 (succeeded), tool-2 (started)

    // Render in timeline: tool-2 projects to incomplete ('中断')
    const { container } = render(
      <MessageTimeline
        messages={[]}
        conversationId={50}
        hasOlder={false}
        loadingMore={false}
        onLoadMore={() => {}}
        runtimeAssistant={row}
      />,
    );
    const badges = container.querySelectorAll('.v4-trace-tool-badge');
    expect(badges).toHaveLength(2);
    expect(badges[0].textContent).toBe('完成');
    expect(badges[1].textContent).toBe('中断');
    expect(container.textContent).not.toContain('partial text');

    unmount();
  });

  it('D3: retains only trace + stopped status after stopped polling turn', async () => {
    const toolActive = {
      version: 1, run_id: 'run-51', sequence: 0, item_id: 'tool-1',
      kind: 'tool', call_id: 'call-1', lifecycle: 'started', tool_name: 'memory_search',
    };

    installFetch([
      {
        test: '/api/agents/chat/51/', method: 'POST',
        handler: () => jsonResponse({ message_id: 'token51', status: 'processing' }),
      },
      {
        test: '/api/agents/chat/51/status/', method: 'GET',
        handler: () => jsonResponse({
          status: 'stopped',
          events: [
            { event_type: 'assistant_trace', delta: toolActive },
            { event_type: 'content', delta: 'partial polling answer' },
          ],
          cursor: 2,
          error_message: null,
        }),
      },
      {
        test: '/api/agents/chat/51/', method: 'GET',
        handler: () => jsonResponse({ messages: [], total_count: 0, has_more: false }),
      },
    ]);

    const { result, unmount } = renderHook(() => useChatRuntime({ conversationId: 51 }), { wrapper: wrapper() });
    act(() => result.current.setTransport('async'));
    act(() => { void result.current.sendMessage({ content: 'poll stopped' }); });

    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(result.current.status).toBe('idle');
    expect(readRuntimeLease(51).state).toBe('absent');
    expect(result.current.optimisticUser).toBeNull();

    const row = result.current.runtimeAssistant;
    expect(row).not.toBeNull();
    expect(row?.terminalKind).toBe('stopped');
    expect(row?.isStreaming).toBe(false);
    expect(row?.content).toBe('');
    expect(row?.thinking).toBe('');
    expect(row?.assistantTrace?.items).toHaveLength(1);
    expect(row?.assistantTrace?.items[0]).toMatchObject({
      kind: 'tool',
      lifecycle: 'started',
      toolName: 'memory_search',
    });

    unmount();
  });

  it('D3: stopped turn without trace retains no empty assistant row', async () => {
    const encoder = new TextEncoder();
    installFetch([
      {
        test: '/api/agents/chat/52/', method: 'POST',
        handler: () => new Response(new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(
              `event: content\ndata: partial text only\n\n` +
              `event: stopped\ndata: [STOPPED]\n\n`,
            ));
            controller.close();
          },
        }), { headers: { 'Content-Type': 'text/event-stream' } }),
      },
      {
        test: '/api/agents/chat/52/', method: 'GET',
        handler: () => jsonResponse({ messages: [], total_count: 0, has_more: false }),
      },
    ]);

    const { result, unmount } = renderHook(() => useChatRuntime({ conversationId: 52 }), { wrapper: wrapper() });
    act(() => { void result.current.sendMessage({ content: 'no trace stop' }); });

    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(result.current.status).toBe('idle');
    expect(readRuntimeLease(52).state).toBe('absent');
    expect(result.current.optimisticUser).toBeNull();
    // Invariant: no trace -> retain no empty assistant row
    expect(result.current.runtimeAssistant).toBeNull();

    unmount();
  });

  it('D4: refresh or route change clears the non-durable retained row without persisting', async () => {
    const encoder = new TextEncoder();
    installFetch([
      {
        test: '/api/agents/chat/53/', method: 'POST',
        handler: () => new Response(new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(
              `event: assistant_trace\ndata: ${JSON.stringify(trace)}\n\n` +
              `event: stopped\ndata: [STOPPED]\n\n`,
            ));
            controller.close();
          },
        }), { headers: { 'Content-Type': 'text/event-stream' } }),
      },
      {
        test: '/api/agents/chat/53/', method: 'GET',
        handler: () => jsonResponse({ messages: [], total_count: 0, has_more: false }),
      },
      {
        test: '/api/agents/chat/54/', method: 'GET',
        handler: () => jsonResponse({ messages: [], total_count: 0, has_more: false }),
      },
    ]);

    const { result, rerender, unmount } = renderHook(
      ({ id }) => useChatRuntime({ conversationId: id }),
      { wrapper: wrapper(), initialProps: { id: 53 } },
    );

    act(() => { void result.current.sendMessage({ content: 'test route loss' }); });
    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(result.current.runtimeAssistant).not.toBeNull();

    // Invariant: never in localStorage
    expect(readRuntimeLease(53).state).toBe('absent');

    // Route switch clears noncanonical projection immediately
    rerender({ id: 54 });
    expect(result.current.runtimeAssistant).toBeNull();

    // Navigating back does not restore it
    rerender({ id: 53 });
    expect(result.current.runtimeAssistant).toBeNull();

    unmount();
  });

  it('D5: next predispatch replaces the retained stopped row; rejected predispatch follows existing cleanup without restore', async () => {
    const encoder = new TextEncoder();
    let postCount = 0;
    installFetch([
      {
        test: '/api/agents/chat/55/', method: 'POST',
        handler: () => {
          postCount += 1;
          return new Response(new ReadableStream({
            start(controller) {
              if (postCount === 1) {
                controller.enqueue(encoder.encode(
                  `event: assistant_trace\ndata: ${JSON.stringify(trace)}\n\n` +
                  `event: stopped\ndata: [STOPPED]\n\n`,
                ));
              } else {
                controller.enqueue(encoder.encode(`event: content\ndata: new turn\n\n`));
              }
              controller.close();
            },
          }), { headers: { 'Content-Type': 'text/event-stream' } });
        },
      },
      {
        test: '/api/agents/chat/55/', method: 'GET',
        handler: () => jsonResponse({ messages: [], total_count: 0, has_more: false }),
      },
    ]);

    const { result, unmount } = renderHook(() => useChatRuntime({ conversationId: 55 }), { wrapper: wrapper() });

    act(() => { void result.current.sendMessage({ content: 'first turn' }); });
    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(result.current.runtimeAssistant?.assistantTrace?.items).toHaveLength(1);

    // Next turn predispatch naturally replaces the stopped row
    act(() => { void result.current.sendMessage({ content: 'second turn' }); });
    // In predispatch / live:
    expect(result.current.runtimeAssistant?.isStreaming).toBe(true);
    expect(result.current.runtimeAssistant?.assistantTrace).toBeUndefined();

    await waitFor(() => expect(result.current.busy).toBe(false));
    unmount();
  });

  it('D5: rejected predispatch cleans up cleanly and does not restore old stopped row', async () => {
    const encoder = new TextEncoder();
    installFetch([
      {
        test: '/api/agents/chat/56/', method: 'POST',
        handler: () => new Response(new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(
              `event: assistant_trace\ndata: ${JSON.stringify(trace)}\n\n` +
              `event: stopped\ndata: [STOPPED]\n\n`,
            ));
            controller.close();
          },
        }), { headers: { 'Content-Type': 'text/event-stream' } }),
      },
      {
        test: '/api/agents/chat/56/', method: 'GET',
        handler: () => jsonResponse({ messages: [], total_count: 0, has_more: false }),
      },
    ]);

    const { result, unmount } = renderHook(() => useChatRuntime({ conversationId: 56 }), { wrapper: wrapper() });

    act(() => { void result.current.sendMessage({ content: 'first turn' }); });
    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(result.current.runtimeAssistant?.assistantTrace?.items).toHaveLength(1);

    // Mock storage mutation failure on next send predispatch
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    try {
      let sendOutcome: string | undefined;
      await act(async () => {
        sendOutcome = await result.current.sendMessage({ content: 'second turn with storage error' });
      });

      expect(sendOutcome).toBe('rejected');
      expect(result.current.runtimeError?.code).toBe('TURN_STORAGE_BLOCKED');
      // Invariant: does not restore old stopped row, does not leave empty row
      expect(result.current.runtimeAssistant).toBeNull();
      expect(result.current.optimisticUser).toBeNull();
    } finally {
      setItemSpy.mockRestore();
    }

    unmount();
  });

  it('D6: completed turn with trace is handed off to canonical history; no duplicate row in timeline', async () => {
    const encoder = new TextEncoder();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const canonicalTrace = {
      version: 1,
      availability: 'available',
      items: [
        { item_id: 'thinking-1', order: 0, kind: 'thinking', text: 'structured' },
        {
          item_id: 'tool-1', order: 1, kind: 'tool', call_id: 'call-1',
          lifecycle: 'succeeded', tool_name: 'memory_search',
          argument_preview: null, result_summary: null, error_summary: null, duration_ms: 10,
        },
      ],
    };

    installFetch([
      {
        test: '/api/agents/chat/57/', method: 'POST',
        handler: () => new Response(new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(
              `event: assistant_trace\ndata: ${JSON.stringify(trace)}\n\n` +
              `event: content\ndata: complete answer\n\n` +
              `event: done\ndata: [DONE]\n\n`,
            ));
            controller.close();
          },
        }), { headers: { 'Content-Type': 'text/event-stream' } }),
      },
      {
        test: '/api/agents/chat/57/', method: 'GET',
        handler: () => jsonResponse({
          messages: [{
            id: 10, role: 'assistant', content: 'complete answer', reasoning_content: 'structured',
            assistant_run_trace: canonicalTrace, platform: 'test', model_version: 'm', token_count: 1,
            index_in_session: 0, attachment_ids: [], attachments_meta: [], created_at: '2026-09-01T00:00:00Z',
          }],
          total_count: 1, has_more: false,
        }),
      },
    ]);

    const { result, unmount } = renderHook(() => useChatRuntime({ conversationId: 57 }), {
      wrapper: wrapper(client),
    });

    act(() => { void result.current.sendMessage({ content: 'completed turn' }); });
    await waitFor(() => expect(result.current.busy).toBe(false));

    // Invariant: runtime overlay cleared for completed turn
    expect(result.current.runtimeAssistant).toBeNull();
    expect(result.current.optimisticUser).toBeNull();

    // Canonical cache has the trace
    const cached = client.getQueryData(queryKeys.messages(57)) as {
      pages: Array<{ messages: Array<{ content: string; assistantRunTrace: unknown }> }>;
    };
    expect(cached.pages[0].messages).toHaveLength(1);
    expect(cached.pages[0].messages[0].assistantRunTrace).toMatchObject({
      availability: 'available',
      items: [
        { itemId: 'thinking-1', kind: 'thinking' },
        { itemId: 'tool-1', kind: 'tool', lifecycle: 'succeeded' },
      ],
    });

    unmount();
  });

  it('D-F01: stopped turn with trace preserves trace-only row across recoverable clear-retry', async () => {
    const encoder = new TextEncoder();
    installFetch([
      {
        test: '/api/agents/chat/60/', method: 'POST',
        handler: () => new Response(new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(
              `event: assistant_trace\ndata: ${JSON.stringify(trace)}\n\n` +
              `event: content\ndata: partial text before stop\n\n` +
              `event: stopped\ndata: [STOPPED]\n\n`,
            ));
            controller.close();
          },
        }), { headers: { 'Content-Type': 'text/event-stream' } }),
      },
      {
        test: '/api/agents/chat/60/', method: 'GET',
        handler: () => jsonResponse({ messages: [], total_count: 0, has_more: false }),
      },
    ]);

    const originalRemoveItem = Storage.prototype.removeItem;
    let clearAttempts = 0;
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (this: Storage, key: string) {
      if (key === 'exo:v4:chat-runtime:60') {
        clearAttempts += 1;
        if (clearAttempts === 1) {
          throw new DOMException('QuotaExceededError', 'QuotaExceededError');
        }
      }
      return originalRemoveItem.call(this, key);
    });

    try {
      const { result, unmount } = renderHook(() => useChatRuntime({ conversationId: 60 }), { wrapper: wrapper() });

      act(() => { void result.current.sendMessage({ content: 'stopped turn with clear error' }); });

      // 1) First clear throws QuotaExceededError -> blocked state (status: interrupted, busy: true)
      await waitFor(() => expect(result.current.status).toBe('interrupted'));
      expect(result.current.busy).toBe(true);
      expect(readRuntimeLease(60).state).toBe('valid');
      // Blocked interim: no stale overlay rows visible
      expect(result.current.runtimeAssistant).toBeNull();
      expect(result.current.optimisticUser).toBeNull();

      // 2) Retry storage clears the lease and restores trace-only stopped projection
      act(() => { result.current.retryStorage(); });

      await waitFor(() => expect(result.current.status).toBe('idle'));
      expect(result.current.busy).toBe(false);
      expect(readRuntimeLease(60).state).toBe('absent');
      expect(result.current.optimisticUser).toBeNull();

      // Exact trace-only row restored
      expect(result.current.runtimeAssistant).not.toBeNull();
      expect(result.current.runtimeAssistant?.assistantTrace?.items).toHaveLength(1);
      expect(result.current.runtimeAssistant?.content).toBe('');
      expect(result.current.runtimeAssistant?.thinking).toBe('');
      expect(result.current.runtimeAssistant?.statusText).toBe('已停止生成');
      expect(result.current.runtimeAssistant?.terminalKind).toBe('stopped');
      expect(result.current.runtimeAssistant?.isStreaming).toBe(false);

      unmount();
    } finally {
      removeItemSpy.mockRestore();
    }
  });

  it('D-F01: stopped turn without trace releases to null after clear-retry success', async () => {
    const encoder = new TextEncoder();
    installFetch([
      {
        test: '/api/agents/chat/61/', method: 'POST',
        handler: () => new Response(new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(
              `event: content\ndata: partial text only\n\n` +
              `event: stopped\ndata: [STOPPED]\n\n`,
            ));
            controller.close();
          },
        }), { headers: { 'Content-Type': 'text/event-stream' } }),
      },
      {
        test: '/api/agents/chat/61/', method: 'GET',
        handler: () => jsonResponse({ messages: [], total_count: 0, has_more: false }),
      },
    ]);

    const originalRemoveItem = Storage.prototype.removeItem;
    let clearAttempts = 0;
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (this: Storage, key: string) {
      if (key === 'exo:v4:chat-runtime:61') {
        clearAttempts += 1;
        if (clearAttempts === 1) {
          throw new DOMException('QuotaExceededError', 'QuotaExceededError');
        }
      }
      return originalRemoveItem.call(this, key);
    });

    try {
      const { result, unmount } = renderHook(() => useChatRuntime({ conversationId: 61 }), { wrapper: wrapper() });

      act(() => { void result.current.sendMessage({ content: 'no trace stopped with clear error' }); });

      await waitFor(() => expect(result.current.status).toBe('interrupted'));
      expect(result.current.busy).toBe(true);
      expect(result.current.runtimeAssistant).toBeNull();

      act(() => { result.current.retryStorage(); });

      await waitFor(() => expect(result.current.status).toBe('idle'));
      expect(result.current.busy).toBe(false);
      expect(readRuntimeLease(61).state).toBe('absent');
      // Invariant: no trace -> releases to null
      expect(result.current.runtimeAssistant).toBeNull();

      unmount();
    } finally {
      removeItemSpy.mockRestore();
    }
  });

  it('D-F01: completed turn with trace releases to null after clear-retry success', async () => {
    const encoder = new TextEncoder();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    installFetch([
      {
        test: '/api/agents/chat/62/', method: 'POST',
        handler: () => new Response(new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(
              `event: assistant_trace\ndata: ${JSON.stringify(trace)}\n\n` +
              `event: content\ndata: answer\n\n` +
              `event: done\ndata: [DONE]\n\n`,
            ));
            controller.close();
          },
        }), { headers: { 'Content-Type': 'text/event-stream' } }),
      },
      {
        test: '/api/agents/chat/62/', method: 'GET',
        handler: () => jsonResponse({
          messages: [{
            id: 20, role: 'assistant', content: 'answer', reasoning_content: 'structured',
            assistant_run_trace: null, platform: 'test', model_version: 'm', token_count: 1,
            index_in_session: 0, attachment_ids: [], attachments_meta: [], created_at: '2026-09-01T00:00:00Z',
          }],
          total_count: 1, has_more: false,
        }),
      },
    ]);

    const originalRemoveItem = Storage.prototype.removeItem;
    let clearAttempts = 0;
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (this: Storage, key: string) {
      if (key === 'exo:v4:chat-runtime:62') {
        clearAttempts += 1;
        if (clearAttempts === 1) {
          throw new DOMException('QuotaExceededError', 'QuotaExceededError');
        }
      }
      return originalRemoveItem.call(this, key);
    });

    try {
      const { result, unmount } = renderHook(() => useChatRuntime({ conversationId: 62 }), {
        wrapper: wrapper(client),
      });

      act(() => { void result.current.sendMessage({ content: 'done turn with clear error' }); });

      await waitFor(() => expect(result.current.status).toBe('interrupted'));
      expect(result.current.busy).toBe(true);
      expect(result.current.runtimeAssistant).toBeNull();

      act(() => { result.current.retryStorage(); });

      await waitFor(() => expect(result.current.status).toBe('idle'));
      expect(result.current.busy).toBe(false);
      expect(readRuntimeLease(62).state).toBe('absent');
      // Invariant: completed turn clears overlay to null
      expect(result.current.runtimeAssistant).toBeNull();

      unmount();
    } finally {
      removeItemSpy.mockRestore();
    }
  });

  it('D-F01: failed clear-retry preserves blocked interim safety without restoring overlay', async () => {
    const encoder = new TextEncoder();
    installFetch([
      {
        test: '/api/agents/chat/63/', method: 'POST',
        handler: () => new Response(new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(
              `event: assistant_trace\ndata: ${JSON.stringify(trace)}\n\n` +
              `event: content\ndata: partial text\n\n` +
              `event: stopped\ndata: [STOPPED]\n\n`,
            ));
            controller.close();
          },
        }), { headers: { 'Content-Type': 'text/event-stream' } }),
      },
      {
        test: '/api/agents/chat/63/', method: 'GET',
        handler: () => jsonResponse({ messages: [], total_count: 0, has_more: false }),
      },
    ]);

    const originalRemoveItem = Storage.prototype.removeItem;
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (this: Storage, key: string) {
      if (key === 'exo:v4:chat-runtime:63') {
        throw new DOMException('QuotaExceededError', 'QuotaExceededError');
      }
      return originalRemoveItem.call(this, key);
    });

    try {
      const { result, unmount } = renderHook(() => useChatRuntime({ conversationId: 63 }), { wrapper: wrapper() });

      act(() => { void result.current.sendMessage({ content: 'failing retry turn' }); });

      await waitFor(() => expect(result.current.status).toBe('interrupted'));
      expect(result.current.busy).toBe(true);
      expect(readRuntimeLease(63).state).toBe('valid');
      expect(result.current.runtimeAssistant).toBeNull();

      // Retry fails again
      act(() => { result.current.retryStorage(); });

      // Remains blocked, busy, lease owned, no overlay
      expect(result.current.status).toBe('interrupted');
      expect(result.current.busy).toBe(true);
      expect(readRuntimeLease(63).state).toBe('valid');
      expect(result.current.runtimeAssistant).toBeNull();

      unmount();
    } finally {
      removeItemSpy.mockRestore();
    }
  });
});
