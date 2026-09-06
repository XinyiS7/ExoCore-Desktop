import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConversationPage } from '../../features/chat/ConversationPage';
import { installFetch, jsonResponse, unmockFetch } from '../helpers';

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

function LocationProbe() {
  return <output aria-label="current route">{useLocation().pathname}</output>;
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

describe('C1B R4 independent acceptance — caller identity', () => {
  it('does not navigate when the branch modal is explicitly closed while its POST is pending', async () => {
    let resolveBranch: ((response: Response) => void) | null = null;
    installFetch([
      { test: '/api/agents/conversations/76/', handler: () => jsonResponse(conversation) },
      { test: '/api/agents/chat/76/', method: 'GET', handler: () => jsonResponse(assistantPage) },
      { test: '/api/agents/presets/', handler: () => jsonResponse([]) },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([conversation]) },
      {
        test: '/api/agents/conversations/76/branch/',
        method: 'POST',
        handler: () =>
          new Promise<Response>((resolve) => {
            resolveBranch = resolve;
          }),
      },
    ]);

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={['/chat/76']}>
          <LocationProbe />
          <Routes>
            <Route path="/chat/:conversationId" element={<ConversationPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: '从该回答派生新会话' }));
    fireEvent.click(screen.getByRole('button', { name: '确认创建分支' }));
    await waitFor(() => expect(resolveBranch).not.toBeNull());

    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await act(async () => {
      resolveBranch?.(jsonResponse({ conversation_id: 99, name: 'Branch' }, 201));
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(screen.getByRole('status', { name: 'current route' })).toHaveTextContent('/chat/76');
  });

  it('cleans the captured source marker after a stale successful branch without navigating the newer route', async () => {
    let resolveBranch: ((response: Response) => void) | null = null;
    const conversation77 = { ...conversation, id: 77, name: 'Conversation 77' };
    installFetch([
      { test: '/api/agents/conversations/76/', handler: () => jsonResponse(conversation) },
      { test: '/api/agents/conversations/77/', handler: () => jsonResponse(conversation77) },
      { test: '/api/agents/chat/76/', method: 'GET', handler: () => jsonResponse(assistantPage) },
      {
        test: '/api/agents/chat/77/',
        method: 'GET',
        handler: () => jsonResponse({ messages: [], total_count: 0, has_more: false, limit: 50, offset: 0 }),
      },
      { test: '/api/agents/presets/', handler: () => jsonResponse([]) },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([conversation, conversation77]) },
      {
        test: '/api/agents/conversations/76/branch/',
        method: 'POST',
        handler: () =>
          new Promise<Response>((resolve) => {
            resolveBranch = resolve;
          }),
      },
    ]);

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={['/chat/76']}>
          <LocationProbe />
          <Routes>
            <Route
              path="/chat/:conversationId"
              element={
                <div>
                  <Link to="/chat/77">go 77</Link>
                  <ConversationPage />
                </div>
              }
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: '从该回答派生新会话' }));
    fireEvent.click(screen.getByRole('button', { name: '确认创建分支' }));
    await waitFor(() => expect(resolveBranch).not.toBeNull());
    expect(window.localStorage.getItem('exo:v4:chat-runtime:76')).not.toBeNull();

    fireEvent.click(screen.getByRole('link', { name: 'go 77' }));
    await screen.findByRole('heading', { name: 'Conversation 77' });

    await act(async () => {
      resolveBranch?.(jsonResponse({ conversation_id: 99, name: 'Branch' }, 201));
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(screen.getByRole('status', { name: 'current route' })).toHaveTextContent('/chat/77');
    expect(window.localStorage.getItem('exo:v4:chat-runtime:76')).toBeNull();
  });
});
