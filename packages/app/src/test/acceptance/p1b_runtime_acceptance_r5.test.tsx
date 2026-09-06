import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConversationPage } from '../../features/chat/ConversationPage';
import { installFetch, jsonResponse, renderApp, unmockFetch } from '../helpers';

const conversation = {
  id: 76,
  name: 'Conversation 76',
  created_at: '2026-09-03T10:00:00Z',
  frozen_project_ids: [],
  project: 0,
  project_name: null,
  agent_type: 'standard',
  agent_preset_id: 3,
  last_message_at: null,
  thinking_level: 'auto',
  memory_injection_enabled: null,
};

const emptyPage = { messages: [], total_count: 0, has_more: false, limit: 50, offset: 0 };
const assistantPage = {
  messages: [
    {
      id: 501,
      role: 'assistant',
      content: 'persisted answer',
      reasoning_content: null,
      platform: 'test',
      model_version: 'test',
      token_count: null,
      index_in_session: 0,
      attachment_ids: [],
      attachments_meta: [],
      created_at: '2026-09-03T10:00:00Z',
    },
  ],
  total_count: 1,
  has_more: false,
  limit: 50,
  offset: 0,
};

function base(messages: unknown = emptyPage) {
  return [
    { test: '/api/agents/conversations/76/', handler: () => jsonResponse(conversation) },
    { test: '/api/agents/chat/76/', method: 'GET', handler: () => jsonResponse(messages) },
    { test: '/api/agents/presets/', handler: () => jsonResponse([]) },
    { test: '/api/agents/conversations/', handler: () => jsonResponse([conversation]) },
  ];
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

describe('C1B R5 independent acceptance — recovery identity closure', () => {
  it('keeps an accepted stop authoritative after the initial active-snapshot retry', async () => {
    let allowActivePersist = false;
    let stopPosts = 0;
    let pollGets = 0;
    const originalSet = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key === 'exo:v4:chat-runtime:76' && value.includes('"asyncToken"') && !allowActivePersist) {
        throw new DOMException('blocked', 'QuotaExceededError');
      }
      return originalSet.call(this, key, value);
    });

    installFetch([
      ...base(),
      {
        test: '/api/agents/chat/76/',
        method: 'POST',
        handler: () => jsonResponse({ message_id: 'accepted-token', status: 'processing' }),
      },
      {
        test: '/api/agents/chat/76/stop/',
        method: 'POST',
        handler: () => {
          stopPosts += 1;
          return jsonResponse({ status: 'stop_requested' });
        },
      },
      {
        test: '/api/agents/chat/76/status/',
        method: 'GET',
        handler: () => {
          pollGets += 1;
          return new Promise<Response>(() => {});
        },
      },
    ]);

    renderApp(['/chat/76']);
    const box = await screen.findByRole('textbox', { name: '消息输入框' });
    fireEvent.change(box, { target: { value: 'stop while storage is blocked' } });
    fireEvent.change(screen.getByRole('combobox', { name: '传输模式选择' }), {
      target: { value: 'async' },
    });
    fireEvent.click(screen.getByRole('button', { name: '发送消息' }));

    const stop = await screen.findByRole('button', { name: '停止生成' });
    expect(pollGets).toBe(0);
    fireEvent.click(stop);
    await waitFor(() => expect(stopPosts).toBe(1));
    await screen.findByText(/停止请求已发送/);

    allowActivePersist = true;
    fireEvent.click(screen.getByRole('button', { name: /重试存储操作/ }));
    await waitFor(() => expect(pollGets).toBe(1));

    const stoppingControl = screen.getByRole('button', { name: '停止生成' });
    expect(stoppingControl).toBeDisabled();
    fireEvent.click(stoppingControl);
    expect(stopPosts).toBe(1);
  });

  it('does not claim a reread pending lease whose stable transport owner differs', async () => {
    let blockRuntimeRead = false;
    let pollGets = 0;
    const originalGet = Storage.prototype.getItem;
    const originalSet = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key) {
      if (key === 'exo:v4:chat-runtime:76' && blockRuntimeRead) {
        throw new DOMException('blocked', 'SecurityError');
      }
      return originalGet.call(this, key);
    });

    installFetch([
      ...base(),
      {
        test: '/api/agents/chat/76/',
        method: 'POST',
        handler: () => {
          blockRuntimeRead = true;
          return jsonResponse({ message_id: 'accepted-token', status: 'processing' });
        },
      },
      {
        test: '/api/agents/chat/76/status/',
        method: 'GET',
        handler: () => {
          pollGets += 1;
          return new Promise<Response>(() => {});
        },
      },
    ]);

    renderApp(['/chat/76']);
    const box = await screen.findByRole('textbox', { name: '消息输入框' });
    fireEvent.change(box, { target: { value: 'respect exact owner' } });
    fireEvent.change(screen.getByRole('combobox', { name: '传输模式选择' }), {
      target: { value: 'async' },
    });
    fireEvent.click(screen.getByRole('button', { name: '发送消息' }));
    await screen.findByRole('button', { name: /重试读取存储/ });

    const key = 'exo:v4:chat-runtime:76';
    const pending = JSON.parse(originalGet.call(window.localStorage, key) as string) as Record<string, unknown>;
    const differingOwner = { ...pending, transport: 'sse' };
    originalSet.call(window.localStorage, key, JSON.stringify(differingOwner));
    blockRuntimeRead = false;

    fireEvent.click(screen.getByRole('button', { name: /重试读取存储/ }));
    await waitFor(() => {
      const observed = JSON.parse(originalGet.call(window.localStorage, key) as string) as Record<string, unknown>;
      expect(observed.transport).toBe('sse');
      expect(observed.disposition).toBe('pending');
    });
    expect(pollGets).toBe(0);
  });

  it('refreshes Recent even when an ambiguous branch cannot persist uncertainty', async () => {
    const originalSet = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key === 'exo:v4:chat-runtime:76' && value.includes('"disposition":"uncertain"')) {
        throw new DOMException('blocked', 'QuotaExceededError');
      }
      return originalSet.call(this, key, value);
    });

    installFetch([
      ...base(assistantPage),
      {
        test: '/api/agents/conversations/76/branch/',
        method: 'POST',
        handler: () => {
          throw new TypeError('network interrupted');
        },
      },
    ]);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/chat/76']}>
          <Routes>
            <Route path="/chat/:conversationId" element={<ConversationPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: '从该回答派生新会话' }));
    fireEvent.click(screen.getByRole('button', { name: '确认创建分支' }));
    expect((await screen.findAllByText(/结果不确定|无法写入不确定性标记/)).length).toBeGreaterThan(0);

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['conversations'] });
    const raw = window.localStorage.getItem('exo:v4:chat-runtime:76');
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toMatchObject({ disposition: 'pending', operation: 'branch' });
    expect(screen.getByRole('button', { name: '确认创建分支' })).toBeDisabled();
  });
});
