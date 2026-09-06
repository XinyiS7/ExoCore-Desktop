import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Link, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConversationPage } from '../../features/chat/ConversationPage';
import { postChatAsync } from '../../features/chat/runtime/client';
import { normalizeSSEEvent } from '../../features/chat/runtime/sse';
import { installFetch, jsonResponse, renderApp, renderV4, unmockFetch } from '../helpers';

const conv = (id: number) => ({
  id,
  name: `Conversation ${id}`,
  created_at: '2026-09-03T10:00:00Z',
  frozen_project_ids: [],
  project: 0,
  project_name: null,
  agent_type: 'standard',
  agent_preset_id: 3,
  last_message_at: null,
  thinking_level: 'auto',
  memory_injection_enabled: null,
});

const emptyMessages = {
  messages: [],
  total_count: 0,
  has_more: false,
  limit: 50,
  offset: 0,
};

function baseRoutes(ids: number[]) {
  return [
    ...ids.map((id) => ({
      test: `/api/agents/conversations/${id}/`,
      handler: () => jsonResponse(conv(id)),
    })),
    {
      test: /\/api\/agents\/chat\/\d+\/$/,
      method: 'GET',
      handler: () => jsonResponse(emptyMessages),
    },
    { test: '/api/agents/presets/', handler: () => jsonResponse([]) },
  ];
}

function doneStream(): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('event: done\ndata: "[DONE]"\n\n'));
        controller.close();
      },
    }),
    { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
  );
}

beforeEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

afterEach(() => {
  unmockFetch();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('C1B R2 independent acceptance — residual runtime invariants', () => {
  it('does not unlock the writer when a reconciled lease cannot be cleared', async () => {
    const originalRemove = Storage.prototype.removeItem;
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (this: Storage, key) {
      if (key === 'exo:v4:chat-runtime:76') throw new DOMException('blocked', 'QuotaExceededError');
      return originalRemove.call(this, key);
    });
    installFetch([
      ...baseRoutes([76]),
      { test: '/api/agents/chat/76/', method: 'POST', handler: doneStream },
    ]);

    renderApp(['/chat/76']);
    const box = await screen.findByRole('textbox', { name: '消息输入框' });
    fireEvent.change(box, { target: { value: 'clear safety' } });
    fireEvent.click(screen.getByRole('button', { name: '发送消息' }));

    await waitFor(() => expect(window.localStorage.getItem('exo:v4:chat-runtime:76')).not.toBeNull());
    fireEvent.change(box, { target: { value: 'must remain locked' } });
    await waitFor(() => expect(screen.getByRole('button', { name: '发送消息' })).toBeDisabled());
    expect(screen.getByRole('alert')).toHaveTextContent(/运行状态|锁|存储/);
  });

  it('quarantines an invalid lease visibly without polling it', async () => {
    window.localStorage.setItem(
      'exo:v4:chat-runtime:76',
      JSON.stringify({
        version: 1,
        operation: 'delete-history',
        conversationId: 76,
        transport: 'async',
        asyncToken: 'badtoken',
        cursor: 0,
        startedAt: 1,
        updatedAt: 1,
        disposition: 'active',
      }),
    );
    const { calls } = installFetch(baseRoutes([76]));

    renderApp(['/chat/76']);
    await screen.findByText('Conversation 76');
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/存储|运行状态|无法恢复/));
    expect(calls.some((call) => call.url.pathname.endsWith('/status/'))).toBe(false);
  });

  it('resets local UI state when switching directly between Conversation routes', async () => {
    const { calls } = installFetch([
      ...baseRoutes([76, 77]),
      {
        test: '/api/agents/chat/76/',
        method: 'POST',
        handler: (_url, init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(new DOMException('aborted', 'AbortError')),
            );
          }),
      },
    ]);

    renderV4(
      <Routes>
        <Route
          path="/chat/:conversationId"
          element={
            <>
              <Link to="/chat/77">Switch Conversation</Link>
              <ConversationPage />
            </>
          }
        />
      </Routes>,
      ['/chat/76'],
    );

    const firstBox = await screen.findByRole('textbox', { name: '消息输入框' });
    fireEvent.change(firstBox, { target: { value: 'in flight' } });
    fireEvent.click(screen.getByRole('button', { name: '发送消息' }));
    await waitFor(() => expect(calls.some((call) => call.init?.method === 'POST')).toBe(true));

    fireEvent.click(screen.getByRole('link', { name: 'Switch Conversation' }));
    await screen.findByText('Conversation 77');
    const secondBox = screen.getByRole('textbox', { name: '消息输入框' });
    fireEvent.change(secondBox, { target: { value: 'new route' } });
    expect(screen.getByRole('button', { name: '发送消息' })).toBeEnabled();
  });

  it('rejects object-shaped status payloads instead of rendering them as canonical status', () => {
    const normalized = normalizeSSEEvent('status', '{"message":"tool","args":{"secret":"x"}}');
    expect(normalized.event).toBe('malformed');
    expect(normalized.warning).toMatch(/status/);
  });

  it('requires the canonical processing status in an async acknowledgement', async () => {
    installFetch([
      {
        test: '/api/agents/chat/76/',
        method: 'POST',
        handler: () => jsonResponse({ message_id: 'abc12345', status: 'done' }),
      },
    ]);

    await expect(
      postChatAsync({ conversationId: 76, content: 'hello', thinkingLevel: 'auto' }),
    ).rejects.toMatchObject({ code: 'CONTRACT', ambiguousWrite: true });
  });

  it('keeps a durable marker until a runtime-unavailable outcome is acknowledged', async () => {
    installFetch([
      ...baseRoutes([76]),
      {
        test: '/api/agents/chat/76/',
        method: 'POST',
        handler: () => jsonResponse({ message_id: 'abc12345', status: 'processing' }),
      },
      {
        test: '/api/agents/chat/76/status/',
        method: 'GET',
        handler: () => jsonResponse({ status: 'not_found', events: [], cursor: 0, error_message: null }),
      },
    ]);

    renderApp(['/chat/76']);
    const box = await screen.findByRole('textbox', { name: '消息输入框' });
    fireEvent.change(box, { target: { value: 'async unknown' } });
    fireEvent.change(screen.getByRole('combobox', { name: '传输模式选择' }), {
      target: { value: 'async' },
    });
    fireEvent.click(screen.getByRole('button', { name: '发送消息' }));

    await screen.findByText(/异步会话凭据已失效/);
    expect(window.localStorage.getItem('exo:v4:chat-runtime:76')).not.toBeNull();
    expect(screen.getByRole('button', { name: '发送消息' })).toBeDisabled();
  });
});
