import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import type { ModelCatalog } from 'exo-shared/models';
import { useConversationControls } from '../features/chat/controls/useConversationControls';
import type { AgentPresetRow, ConversationSummary } from '../features/chat/types';
import { installFetch, jsonResponse, unmockFetch } from './helpers';

const catalog = {
  models: [
    { name: 'first', family: 'gemini', abilities: [], compatible_endpoint_ids: [1] },
    { name: 'desired', family: 'gemini', abilities: [], compatible_endpoint_ids: [2] },
  ],
  endpoints: [1, 2].map((id) => ({
    id,
    name: `ep${id}`,
    provider: 'gemini',
    execution_type: 'cloud',
    execution_adapter: 'http',
    payload_format: 'chat',
    cache_transport: 'context_cache',
    configured: true,
    enabled: true,
    attachment_transports: [],
  })),
  roles: {
    main: [{ model: 'first', default_endpoint: 1 }, { model: 'desired', default_endpoint: 2 }],
    support: {},
  },
  providers: [],
} as ModelCatalog;
const preset = {
  id: 3,
  name: 'Archive',
  default_model: 'desired',
  agent_type: 'g045',
  is_visible: true,
} as AgentPresetRow;
const row = (id: number): ConversationSummary => ({
  id,
  name: `Conversation ${id}`,
  createdAt: '2026-09-01T00:00:00Z',
  thinkingLevel: 'auto',
  agentType: 'g045',
  agentPresetId: 3,
  projectId: null,
  projectName: null,
  lastMessageAt: null,
  memoryInjectionEnabled: null,
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children?: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

afterEach(() => unmockFetch());

describe('P1D Conversation control invocation ownership', () => {
  it('keeps a delayed rejection attached to its departed Conversation', async () => {
    const pending = deferred<Response>();
    installFetch([{ test: '/api/agents/conversations/42/', method: 'PATCH', handler: () => pending.promise }]);
    const { client, wrapper } = makeWrapper();
    const { result, rerender } = renderHook(
      ({ id }) => useConversationControls({ conversationId: id, conversation: row(id), catalog, preset }),
      { wrapper, initialProps: { id: 42 } },
    );
    await waitFor(() => expect(result.current.targetReady).toBe(true));
    act(() => result.current.saveThinkingLevel('high'));
    rerender({ id: 43 });
    await waitFor(() => expect(result.current.thinkingSaveState.kind).toBe('idle'));
    await act(async () => {
      pending.resolve(jsonResponse({ error: 'refused' }, 409));
      await pending.promise;
    });
    await waitFor(() => expect(result.current.thinkingSaveState.kind).toBe('idle'));
    expect(client.getQueryData(['conversation', 43])).toBeUndefined();
  });

  it('allows B to save while A is pending and writes each confirmed exact row', async () => {
    const pendingA = deferred<Response>();
    const pendingB = deferred<Response>();
    installFetch([
      { test: '/api/agents/conversations/42/', method: 'PATCH', handler: () => pendingA.promise },
      { test: '/api/agents/conversations/43/', method: 'PATCH', handler: () => pendingB.promise },
    ]);
    const { client, wrapper } = makeWrapper();
    client.setQueryData(['conversation', 42], row(42));
    client.setQueryData(['conversation', 43], row(43));
    const { result, rerender } = renderHook(
      ({ id }) => useConversationControls({ conversationId: id, conversation: row(id), catalog, preset }),
      { wrapper, initialProps: { id: 42 } },
    );
    await waitFor(() => expect(result.current.targetReady).toBe(true));
    act(() => result.current.saveThinkingLevel('high'));
    rerender({ id: 43 });
    await waitFor(() => expect(result.current.thinkingSaveState.kind).toBe('idle'));
    act(() => result.current.saveThinkingLevel('low'));
    await act(async () => {
      pendingB.resolve(jsonResponse({ id: 43, thinking_level: 'low' }));
      await pendingB.promise;
    });
    await act(async () => {
      pendingA.resolve(jsonResponse({ id: 42, thinking_level: 'high' }));
      await pendingA.promise;
    });
    await waitFor(() => expect(result.current.thinkingSaveState.kind).toBe('idle'));
    expect((client.getQueryData(['conversation', 42]) as ConversationSummary).thinkingLevel).toBe('high');
    expect((client.getQueryData(['conversation', 43]) as ConversationSummary).thinkingLevel).toBe('low');
  });
});
