import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { queryKeys } from '../features/chat/queries';
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
