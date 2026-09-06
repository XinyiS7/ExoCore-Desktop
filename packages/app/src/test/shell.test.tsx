import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import {
  callsToPath,
  installFetch,
  jsonResponse,
  renderApp,
  unmockFetch,
  type MockRoute,
} from './helpers';

const PRESET_ECKI = {
  id: 5,
  name: 'Ecki',
  description: 'fast',
  agent_type: 'standard',
  default_model: 'deepseek-v4-flash',
  system_prompt: null,
  is_visible: true,
};

const baseConv = (id: number, over: Record<string, unknown> = {}) => ({
  id,
  name: `conv ${id}`,
  created_at: '2026-09-01T10:00:00Z',
  frozen_project_ids: [],
  project: 0,
  project_name: null,
  agent_type: 'standard',
  agent_preset_id: 5,
  last_message_at: null,
  thinking_level: 'auto',
  memory_injection_enabled: null,
  ...over,
});

function homeRoutes(convs: unknown[]): MockRoute[] {
  return [
    { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI]) },
    { test: '/api/agents/conversations/', handler: () => jsonResponse(convs) },
  ];
}

afterEach(() => unmockFetch());

describe('App Shell navigation (D1: M1 bottom bar projection)', () => {
  it('shows Chat as the only enabled product area; future areas are semantic disabled', async () => {
    installFetch(homeRoutes([baseConv(1)]));
    renderApp(['/']);

    // Bottom bar (mobile projection) + sidebar (desktop projection) both render.
    await screen.findAllByRole('link', { name: 'Chat' });
    const nav = await screen.findByRole('navigation', { name: '主导航' });
    const disabledGroups = within(nav).getByRole('button', { name: /Groups/ });
    expect(disabledGroups).toBeDisabled();
    expect(disabledGroups).toHaveAttribute('aria-disabled', 'true');
    expect(within(nav).getByText('P2')).toBeTruthy();
    expect(within(nav).getByRole('button', { name: /River/ })).toBeDisabled();
    expect(within(nav).getByRole('button', { name: /Library/ })).toBeDisabled();
  });

  it('hides the mobile bottom bar inside canonical chat detail (C1)', async () => {
    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI]) },
      {
        test: '/api/agents/conversations/7/',
        handler: () => jsonResponse(baseConv(7, { name: 'detail conv' })),
      },
      {
        test: /^\/api\/agents\/chat\/7\/$/,
        handler: () => jsonResponse({ messages: [], total_count: 0, has_more: false }),
      },
    ]);
    renderApp(['/chat/7']);
    await screen.findByText('detail conv');
    await screen.findByText('还没有消息');
    expect(screen.queryByRole('navigation', { name: '主导航' })).toBeNull();
    // Deterministic return action for direct links.
    expect(screen.getByRole('link', { name: /Chat Home/ })).toBeTruthy();
  });

  it('redirects /chat without an id to Chat Home', async () => {
    installFetch(homeRoutes([baseConv(1)]));
    renderApp(['/chat']);
    await screen.findByText('conv 1');
  });

  it('renders a real not-found state for unknown routes', async () => {
    installFetch(homeRoutes([]));
    renderApp(['/definitely-not-a-page']);
    expect(await screen.findByText('页面不存在')).toBeTruthy();
  });
});

describe('Chat Home / Recent', () => {
  it('renders rows with resolved agent, project/Drift and last activity; backend order kept', async () => {
    installFetch(
      homeRoutes([
        baseConv(1, { name: 'second conv', project: 10, project_name: 'ProjX', last_message_at: '2026-09-02T08:00:00Z' }),
        baseConv(2),
      ]),
    );
    renderApp(['/']);

    const rows = await screen.findAllByRole('link', { name: /second conv|conv 2/ });
    expect(rows).toHaveLength(2);
    // Both conversations use preset #5 → resolved label appears twice.
    expect(screen.getAllByText('Ecki')).toHaveLength(2);
    expect(screen.getByText('ProjX')).toBeTruthy();
    // Only the second conversation is a Drift conversation.
    expect(screen.getAllByText('Drift')).toHaveLength(1);
    // Backend order: second conv appears first in the list.
    const list = screen.getByRole('list', { name: '最近会话' });
    expect(within(list).getAllByRole('link')[0]).toHaveTextContent('second conv');
  });

  it('shows loading, then error with working retry, then data', async () => {
    let fail = true;
    const { calls } = installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI]) },
      {
        test: '/api/agents/conversations/',
        handler: () =>
          fail
            ? jsonResponse({ error: 'boom' }, 500)
            : jsonResponse([baseConv(3, { name: 'after retry' })]),
      },
    ]);
    renderApp(['/']);
    expect(await screen.findByText('会话加载失败')).toBeTruthy();
    expect(callsToPath(calls, '/conversations/')).toHaveLength(1);
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    expect(await screen.findByText('after retry')).toBeTruthy();
  });

  it('shows an empty state with a create action when no conversations exist', async () => {
    installFetch(homeRoutes([]));
    renderApp(['/']);
    expect(await screen.findByText('还没有会话')).toBeTruthy();
    // Header action + empty-state action both offer creation.
    expect(screen.getAllByRole('button', { name: /新建会话/ }).length).toBeGreaterThanOrEqual(1);
  });

  it('renders unresolved agent identity explicitly (no invented name)', async () => {
    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([]) },
      {
        test: '/api/agents/conversations/',
        handler: () => jsonResponse([baseConv(4, { agent_preset_id: 42 })]),
      },
    ]);
    renderApp(['/']);
    expect(await screen.findByText('Agent #42')).toBeTruthy();
  });

  it('navigates from Recent into the canonical detail implementation', async () => {
    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI]) },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([baseConv(11, { name: 'open me' })]) },
      {
        test: '/api/agents/conversations/11/',
        handler: () => jsonResponse(baseConv(11, { name: 'open me' })),
      },
      {
        test: /^\/api\/agents\/chat\/11\/$/,
        handler: () => jsonResponse({ messages: [], total_count: 0, has_more: false }),
      },
    ]);
    renderApp(['/']);
    fireEvent.click(await screen.findByRole('link', { name: /open me/ }));
    await waitFor(() => expect(screen.queryByRole('navigation', { name: '主导航' })).toBeNull());
    expect(await screen.findByRole('heading', { level: 1, name: 'open me' })).toBeTruthy();
  });
});

describe('Conversation detail states', () => {
  it('invalid route id renders a distinct state and issues no conversation request', async () => {
    const { calls } = installFetch(homeRoutes([]));
    renderApp(['/chat/abc']);
    expect(await screen.findByText('无效的会话地址')).toBeTruthy();
    expect(callsToPath(calls, '/api/agents/chat/')).toHaveLength(0);
    expect(callsToPath(calls, '/conversations/abc')).toHaveLength(0);
  });

  it('detail 404 is distinct and recoverable', async () => {
    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI]) },
      {
        test: '/api/agents/conversations/99/',
        handler: () => jsonResponse({ detail: 'Not found.' }, 404),
      },
      {
        test: /^\/api\/agents\/chat\/99\/$/,
        handler: () => jsonResponse({ messages: [], total_count: 0, has_more: false }),
      },
    ]);
    renderApp(['/chat/99']);
    expect(await screen.findByText('会话不存在或已被删除')).toBeTruthy();
    // Back link in the top bar + recovery link in the error state.
    expect(screen.getAllByRole('link', { name: 'Chat Home' }).length).toBeGreaterThanOrEqual(1);
  });

  it('no-message conversation renders the honest empty read state without a composer', async () => {
    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI]) },
      {
        test: '/api/agents/conversations/5/',
        handler: () => jsonResponse(baseConv(5, { name: 'fresh' })),
      },
      {
        test: /^\/api\/agents\/chat\/5\/$/,
        handler: () => jsonResponse({ messages: [], total_count: 0, has_more: false }),
      },
    ]);
    renderApp(['/chat/5']);
    expect(await screen.findByText('还没有消息')).toBeTruthy();
    expect(screen.getByRole('textbox')).toBeTruthy();
    expect(screen.getByRole('button', { name: /发送/ })).toBeTruthy();
  });
});
