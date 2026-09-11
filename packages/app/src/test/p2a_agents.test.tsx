import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { AppShell } from '../shell/AppShell';
import { AgentHubPage } from '../features/agents/AgentHubPage';
import { AgentProfilePage } from '../features/agents/AgentProfilePage';
import { queryKeys } from '../features/chat/queries';
import type { ConversationSummary } from '../features/chat/types';
import {
  callsToPath,
  installFetch,
  jsonResponse,
  renderApp,
  unmockFetch,
  type MockRoute,
} from './helpers';

// ── fixtures ───────────────────────────────────────────────────────────────

const PRESET_G045_1 = {
  id: 1,
  name: 'G045 Prime',
  description: 'primary',
  agent_type: 'g045',
  default_model: 'g-prime',
  system_prompt: 'be rigorous',
  is_visible: true,
};

const PRESET_ECKI_5 = {
  id: 5,
  name: 'Ecki',
  description: 'fast',
  agent_type: 'standard',
  default_model: 'deepseek-v4-flash',
  system_prompt: 'Be brief.',
  is_visible: true,
};

const PRESET_EMPTY_6 = {
  id: 6,
  name: 'Blank Six',
  description: null,
  agent_type: 'standard',
  default_model: null,
  system_prompt: null,
  is_visible: true,
};

const PRESET_SHARED_2 = {
  id: 2,
  name: 'Shared',
  description: null,
  agent_type: 'standard',
  default_model: null,
  system_prompt: null,
  is_visible: true,
};

/** Wire-format conversation row (project: 0 is the DB-null Drift sentinel). */
function wireConv(id: number, over: Record<string, unknown> = {}) {
  return {
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
  };
}

const convsForEcki = [
  wireConv(11, { project: 7, project_name: 'Alpha', last_message_at: '2026-09-02T10:00:00Z' }),
  wireConv(12, { project: 0 }),
  wireConv(13, { project: 7, project_name: 'Alpha' }),
  wireConv(14, { agent_preset_id: 3 }),
  wireConv(15, { project: 9, project_name: 'Beta', agent_preset_id: 6 }),
];

function profileRoutes(over: Partial<{ convs: unknown[]; memory: unknown[] }> = {}): MockRoute[] {
  return [
    { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_G045_1, PRESET_ECKI_5, PRESET_EMPTY_6, PRESET_SHARED_2]) },
    { test: '/api/agents/presets/5/', handler: () => jsonResponse(PRESET_ECKI_5) },
    { test: '/api/agents/presets/6/', handler: () => jsonResponse(PRESET_EMPTY_6) },
    { test: '/api/agents/conversations/', handler: () => jsonResponse(over.convs ?? convsForEcki) },
    {
      test: '/api/memory/plasmids/',
      handler: () =>
        jsonResponse(
          over.memory ?? [
            { id: 1, tags: ['b', 'a '] },
            { id: 2, tags: ['b', ''] },
          ],
        ),
    },
  ];
}

// ── Hub ────────────────────────────────────────────────────────────────────

describe('Agent Hub (P2A Stage A)', () => {
  afterEach(() => unmockFetch());

  it('shows every visible preset once in g045-first then id order, including unknown types', async () => {
    installFetch([
      {
        test: '/api/agents/presets/',
        handler: () =>
          jsonResponse([
            PRESET_SHARED_2,
            PRESET_ECKI_5,
            PRESET_G045_1,
            { id: 9, name: 'Future', description: null, agent_type: 'future-x', default_model: null, system_prompt: null, is_visible: true },
          ]),
      },
    ]);
    renderApp(['/agents']);

    const list = await screen.findByRole('list', { name: 'Agent 预设列表' });
    const cards = within(list).getAllByRole('link');
    expect(cards.map((card) => card.textContent)).toEqual([
      expect.stringContaining('G045 Prime'),
      expect.stringContaining('Shared'),
      expect.stringContaining('Ecki'),
      expect.stringContaining('Future'),
    ]);
    expect(cards.map((card) => card.getAttribute('href'))).toEqual([
      '/agents/1',
      '/agents/2',
      '/agents/5',
      '/agents/9',
    ]);
    expect(within(list).getByText('future-x')).toBeTruthy();
  });

  it('issues only GET preset requests and no Memory fan-out', async () => {
    const { calls } = installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI_5]) },
    ]);
    renderApp(['/agents']);
    await screen.findByText('Ecki');

    const presetCalls = callsToPath(calls, '/api/agents/presets');
    expect(presetCalls.length).toBeGreaterThan(0);
    for (const call of presetCalls) {
      expect(call.init?.method ?? 'GET').toBe('GET');
      expect(call.url.pathname).toBe('/api/agents/presets/');
    }
    expect(callsToPath(calls, '/api/memory/plasmids')).toHaveLength(0);
    expect(callsToPath(calls, '/api/agents/presets/1')).toHaveLength(0);
  });

  it('never touches agentHubOrder storage', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    installFetch([{ test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI_5]) }]);
    renderApp(['/agents']);
    await screen.findByText('Ecki');
    for (const call of [...getItem.mock.calls, ...setItem.mock.calls]) {
      expect(call[0]).not.toBe('agentHubOrder');
    }
    getItem.mockRestore();
    setItem.mockRestore();
  });

  it('shows loading, then the list', async () => {
    installFetch([{ test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI_5]) }]);
    renderApp(['/agents']);
    expect(screen.getByRole('status')).toHaveTextContent('正在加载 Agent');
    await screen.findByText('Ecki');
  });

  it('shows an explicit error state with a working retry', async () => {
    let fail = true;
    const { calls } = installFetch([
      {
        test: '/api/agents/presets/',
        handler: () => (fail ? jsonResponse({ error: 'boom' }, 500) : jsonResponse([PRESET_ECKI_5])),
      },
    ]);
    renderApp(['/agents']);

    const retry = await screen.findByRole('button', { name: '重试' });
    expect(screen.getByText('Agent 列表加载失败')).toBeTruthy();
    expect(screen.queryByText('Ecki')).toBeNull();

    fail = false;
    fireEvent.click(retry);
    await screen.findByText('Ecki');
    expect(callsToPath(calls, '/api/agents/presets').length).toBe(2);
  });

  it('treats a malformed top-level list payload as an error, not emptiness', async () => {
    installFetch([{ test: '/api/agents/presets/', handler: () => jsonResponse({ rows: [] }) }]);
    renderApp(['/agents']);
    await screen.findByText('Agent 列表加载失败');
    expect(screen.queryByText('暂无可见 Agent')).toBeNull();
  });

  it('shows a true empty state only for an empty array', async () => {
    installFetch([{ test: '/api/agents/presets/', handler: () => jsonResponse([]) }]);
    renderApp(['/agents']);
    await screen.findByText('暂无可见 Agent');
  });

  it('keeps mobile bottom navigation visible and Chat active on the Hub', async () => {
    installFetch([{ test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI_5]) }]);
    renderApp(['/agents']);
    await screen.findByText('Ecki');
    expect(screen.getByRole('navigation', { name: '主导航' })).toBeTruthy();
    for (const link of screen.getAllByRole('link', { name: 'Chat' })) {
      expect(link.getAttribute('aria-current')).toBe('page');
    }
  });

  it('card click navigates to the canonical Profile implementation', async () => {
    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI_5]) },
      { test: '/api/agents/presets/5/', handler: () => jsonResponse(PRESET_ECKI_5) },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([]) },
      { test: '/api/memory/plasmids/', handler: () => jsonResponse([]) },
    ]);
    renderApp(['/agents']);
    fireEvent.click(await screen.findByRole('link', { name: /Ecki/ }));
    await screen.findByRole('heading', { name: 'Agent Profile' });
    expect(await screen.findByText('Be brief.')).toBeTruthy();
  });

  it('is reachable from the Chat Home secondary entry', async () => {
    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI_5]) },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([]) },
    ]);
    renderApp(['/']);
    fireEvent.click(await screen.findByRole('link', { name: 'Agent Hub' }));
    await screen.findByText(/可见 Agent 预设/);
  });
});

// ── Profile: route states ──────────────────────────────────────────────────

describe('Agent Profile route states (P2A Stage A)', () => {
  afterEach(() => unmockFetch());

  it('issues no requests at all for a syntactically invalid id', async () => {
    const { calls } = installFetch([]);
    renderApp(['/agents/abc']);
    await screen.findByText('无效的 Agent 地址');
    expect(screen.getByRole('link', { name: 'Agent Hub' }).getAttribute('href')).toBe('/agents');
    expect(calls).toHaveLength(0);
  });

  it('distinguishes 404 (hidden/absent preset) from malformed and network errors', async () => {
    installFetch([
      { test: '/api/agents/presets/5/', handler: () => jsonResponse({ detail: 'nope' }, 404) },
      { test: '/api/agents/presets/6/', handler: () => jsonResponse([PRESET_EMPTY_6]) },
      { test: '/api/agents/presets/7/', handler: () => { throw new TypeError('network down'); } },
    ]);
    const missing = renderApp(['/agents/5']);
    await screen.findByText('Agent 不存在或未公开');
    missing.unmount();

    // malformed top-level (array) — contract error, retryable, NOT the 404 copy
    const malformed = renderApp(['/agents/6']);
    await screen.findByText('Agent 详情加载失败');
    expect(screen.getByRole('button', { name: '重试' })).toBeTruthy();
    malformed.unmount();

    // network failure — retryable error
    renderApp(['/agents/7']);
    await screen.findByText('Agent 详情加载失败');
  });

  it('renders read-only identity/model/prompt and honest fallbacks', async () => {
    installFetch([
      { test: '/api/agents/presets/5/', handler: () => jsonResponse(PRESET_ECKI_5) },
      { test: '/api/agents/presets/6/', handler: () => jsonResponse(PRESET_EMPTY_6) },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([]) },
      { test: '/api/memory/plasmids/', handler: () => jsonResponse([]) },
    ]);
    const full = renderApp(['/agents/5']);
    await screen.findByText('Be brief.');
    expect(screen.getByRole('heading', { name: /Ecki/ })).toBeTruthy();
    expect(screen.getByText('deepseek-v4-flash', { selector: 'dd' })).toBeTruthy();
    expect(screen.getByText('standard', { selector: 'dd' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /编辑|保存/ })).toBeNull();
    full.unmount();

    const blank = renderApp(['/agents/6']);
    await screen.findByText('Blank Six');
    expect(screen.getByText('暂无描述')).toBeTruthy();
    expect(screen.getByText('未配置默认模型')).toBeTruthy();
    expect(screen.getByText('未设置 System Prompt')).toBeTruthy();
    blank.unmount();
  });

  it('emits no preset write from Profile controls (GET only)', async () => {
    const { calls } = installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI_5]) },
      { test: '/api/agents/presets/5/', handler: () => jsonResponse(PRESET_ECKI_5) },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([]) },
      { test: '/api/memory/plasmids/', handler: () => jsonResponse([]) },
    ]);
    renderApp(['/agents/5']);
    await screen.findByText('Be brief.');
    const presetCalls = callsToPath(calls, '/api/agents/presets');
    expect(presetCalls.length).toBeGreaterThan(0);
    for (const call of presetCalls) expect(call.init?.method ?? 'GET').toBe('GET');
  });

  it('hides the mobile bottom bar on a valid Profile route and keeps it on Hub', async () => {
    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI_5]) },
      { test: '/api/agents/presets/5/', handler: () => jsonResponse(PRESET_ECKI_5) },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([]) },
      { test: '/api/memory/plasmids/', handler: () => jsonResponse([]) },
    ]);
    renderApp(['/agents/5']);
    await screen.findByText('Be brief.');
    expect(screen.queryByRole('navigation', { name: '主导航' })).toBeNull();
    // Chat stays active in the desktop sidebar on the focused Profile.
    expect(screen.getByRole('link', { name: 'Chat' }).getAttribute('aria-current')).toBe('page');
    // explicit return link to the Hub
    expect(screen.getByRole('link', { name: /Agent Hub/ }).getAttribute('href')).toBe('/agents');
  });

  it('does not start the Memory request until the preset detail is confirmed', async () => {
    const first = installFetch([
      { test: '/api/agents/presets/5/', handler: () => jsonResponse(PRESET_ECKI_5) },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([]) },
      { test: '/api/memory/plasmids/', handler: () => jsonResponse([]) },
    ]);
    const view = renderApp(['/agents/5']);
    await screen.findByText('Be brief.');
    const memoryCalls = callsToPath(first.calls, '/api/memory/plasmids');
    expect(memoryCalls).toHaveLength(1);
    expect(memoryCalls[0].url.searchParams.get('preset_id')).toBe('5');
    view.unmount();

    // 404 detail ⇒ no Memory request at all for that preset
    const second = installFetch([
      { test: '/api/agents/presets/8/', handler: () => jsonResponse({ detail: 'nope' }, 404) },
    ]);
    renderApp(['/agents/8']);
    await screen.findByText('Agent 不存在或未公开');
    expect(callsToPath(second.calls, '/api/memory/plasmids')).toHaveLength(0);
  });
});

// ── Profile: Conversation lens ─────────────────────────────────────────────

describe('Agent Profile Conversation lens (P2A Stage A)', () => {
  afterEach(() => unmockFetch());

  it('filters by exact agentPresetId and preserves backend order', async () => {
    installFetch(profileRoutes());
    renderApp(['/agents/5']);

    await screen.findByText('Be brief.');
    const list = await screen.findByRole('list', { name: '该 Agent 的会话' });
    const rows = within(list).getAllByRole('link');
    // conv 11, 12, 13 belong to preset 5; 14 (preset 3) and 15 (preset 6) excluded.
    expect(rows.map((row) => row.getAttribute('href'))).toEqual([
      '/chat/11',
      '/chat/12',
      '/chat/13',
    ]);
  });

  it('issues the global Conversation request with no invented query params', async () => {
    const { calls } = installFetch(profileRoutes());
    renderApp(['/agents/5']);
    await screen.findByText('Be brief.');
    const convCalls = callsToPath(calls, '/api/agents/conversations');
    expect(convCalls).toHaveLength(1);
    expect(convCalls[0].url.search).toBe('');
  });

  it('derives All / Drift / Project subsets and never fabricates a Drift project option', async () => {
    installFetch(profileRoutes());
    renderApp(['/agents/5']);
    await screen.findByText('Be brief.');

    const group = await screen.findByRole('radiogroup', { name: '会话筛选' });
    const options = within(group).getAllByRole('radio');
    const labels = options.map((option) => option.closest('label')?.textContent ?? '');
    // 全部 + Drift + Alpha(7): dup id 7 collapses; Drift is never a project
    // option; Beta's rows belong to preset 6 so it is absent from this lens.
    expect(labels).toEqual(['全部', 'Drift', 'Alpha']);

    // All: 11, 12, 13 (backend order)
    let rows = screen.getAllByRole('link').filter((a) => /^\/chat\//.test(a.getAttribute('href') ?? ''));
    expect(rows.map((row) => row.getAttribute('href'))).toEqual(['/chat/11', '/chat/12', '/chat/13']);

    // Drift: only project 0 row
    fireEvent.click(within(group).getByRole('radio', { name: 'Drift' }));
    rows = screen.getAllByRole('link').filter((a) => /^\/chat\//.test(a.getAttribute('href') ?? ''));
    expect(rows.map((row) => row.getAttribute('href'))).toEqual(['/chat/12']);

    // Project Alpha: 11, 13
    fireEvent.click(within(group).getByRole('radio', { name: 'Alpha' }));
    rows = screen.getAllByRole('link').filter((a) => /^\/chat\//.test(a.getAttribute('href') ?? ''));
    expect(rows.map((row) => row.getAttribute('href'))).toEqual(['/chat/11', '/chat/13']);
  });

  it('shows a Project option only when at least one current Agent row carries it', async () => {
    installFetch(profileRoutes());
    renderApp(['/agents/5']);
    await screen.findByText('Be brief.');
    const group = await screen.findByRole('radiogroup', { name: '会话筛选' });
    // Beta's rows belong to preset 6; it must not appear for preset 5's lens.
    expect(within(group).queryByRole('radio', { name: 'Beta' })).toBeNull();
  });

  it('keeps duplicate Project names with different ids distinct', async () => {
    installFetch(
      profileRoutes({
        convs: [
          wireConv(21, { project: 3, project_name: 'Shared' }),
          wireConv(22, { project: 4, project_name: 'Shared' }),
        ],
      }),
    );
    renderApp(['/agents/5']);
    await screen.findByText('Be brief.');
    const group = await screen.findByRole('radiogroup', { name: '会话筛选' });
    const shared = within(group).getAllByRole('radio', { name: 'Shared' });
    expect(shared).toHaveLength(2);
  });

  it('issues no Project-list request from the Profile index', async () => {
    const { calls } = installFetch(profileRoutes());
    renderApp(['/agents/5']);
    await screen.findByText('Be brief.');
    await screen.findByRole('radiogroup', { name: '会话筛选' });
    expect(callsToPath(calls, '/api/core/projects')).toHaveLength(0);
  });

  it('treats Conversation failure as an error state, never empty copy', async () => {
    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI_5]) },
      { test: '/api/agents/presets/5/', handler: () => jsonResponse(PRESET_ECKI_5) },
      { test: '/api/agents/conversations/', handler: () => jsonResponse({ error: 'boom' }, 500) },
      { test: '/api/memory/plasmids/', handler: () => jsonResponse([]) },
    ]);
    renderApp(['/agents/5']);
    await screen.findByText('会话加载失败');
    expect(screen.queryByText('该 Agent 还没有会话')).toBeNull();
    expect(screen.getByRole('button', { name: '重试' })).toBeTruthy();
  });

  it('shows a distinct empty state for a true zero-Agent-Conversation lens', async () => {
    installFetch(profileRoutes({ convs: [wireConv(31, { agent_preset_id: 3 })] }));
    renderApp(['/agents/5']);
    await screen.findByText('Be brief.');
    await screen.findByText('该 Agent 还没有会话');
    expect(screen.queryByRole('radiogroup', { name: '会话筛选' })).toBeNull();
  });
});

// ── Profile: Memory summary ────────────────────────────────────────────────

describe('Agent Profile Memory summary (P2A Stage A)', () => {
  afterEach(() => unmockFetch());

  it('reports the exact endpoint array length with the shared/global label', async () => {
    installFetch(profileRoutes({ memory: [{ id: 1 }, { id: 2 }, { id: 3 }] }));
    renderApp(['/agents/5']);
    await screen.findByText('3 条记忆（含共享/全局）');
  });

  it('shows trimmed, deduplicated, deterministically ordered tags and no Plasmid content', async () => {
    installFetch(
      profileRoutes({
        memory: [
          { id: 1, content: 'SECRET-NOTE', tags: ['b', 'a '] },
          { id: 2, weight: 9, tags: ['b', ''] },
        ],
      }),
    );
    renderApp(['/agents/5']);
    await screen.findByText('2 条记忆（含共享/全局）');
    const tags = screen.getByRole('list', { name: '记忆标签' });
    expect(within(tags).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'a',
      'b',
    ]);
    expect(screen.queryByText('SECRET-NOTE')).toBeNull();
    expect(screen.queryByText('9')).toBeNull();
  });

  it('treats Memory failure as an error state, never zero', async () => {
    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI_5]) },
      { test: '/api/agents/presets/5/', handler: () => jsonResponse(PRESET_ECKI_5) },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([]) },
      { test: '/api/memory/plasmids/', handler: () => jsonResponse({ count: 0 }) },
    ]);
    renderApp(['/agents/5']);
    await screen.findByText('记忆加载失败');
    expect(screen.queryByText(/0 条记忆/)).toBeNull();
  });

  it('shows an honest zero rows state and the static P5 sentence', async () => {
    installFetch(profileRoutes({ memory: [] }));
    renderApp(['/agents/5']);
    await screen.findByText('0 条记忆（含共享/全局）');
    expect(screen.getByText('暂无记忆标签。')).toBeTruthy();
    expect(screen.getByText('记忆管理入口将在 P5 Library 阶段提供。')).toBeTruthy();
    // static text: no Library navigation was enabled anywhere
    expect(screen.getByRole('button', { name: /Library/ }).getAttribute('aria-disabled')).toBe(
      'true',
    );
  });
});

// ── Route switch isolation (same mounted page) ─────────────────────────────

function TestNav({ to }: { to: string }) {
  const navigate = useNavigate();
  return (
    <button type="button" aria-label={`nav-to-${to}`} onClick={() => navigate(to)}>
      nav
    </button>
  );
}

describe('Agent Profile route switch (P2A Stage A)', () => {
  afterEach(() => unmockFetch());

  it('a late-resolving previous detail cannot rewrite the new Agent view', async () => {
    let resolveFive: ((value: Response) => void) | undefined;
    const { calls } = installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI_5, PRESET_EMPTY_6]) },
      {
        test: '/api/agents/presets/5/',
        handler: () =>
          new Promise<Response>((done) => {
            resolveFive = done;
          }),
      },
      { test: '/api/agents/presets/6/', handler: () => jsonResponse(PRESET_EMPTY_6) },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([]) },
      { test: '/api/memory/plasmids/', handler: () => jsonResponse([]) },
    ]);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const first = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/agents/5']}>
          <TestNav to="/agents/6" />
          <Routes>
            <Route element={<AppShell />}>
              <Route path="agents" element={<AgentHubPage />} />
              <Route path="agents/:presetId" element={<AgentProfilePage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    // preset 5 detail is still in flight — navigate away before it resolves
    fireEvent.click(first.getByRole('button', { name: 'nav-to-/agents/6' }));
    await first.findByText('Blank Six');

    // late resolution of preset 5 must not rewrite the current identity
    resolveFive?.(jsonResponse(PRESET_ECKI_5));
    await waitFor(() => {
      expect(callsToPath(calls, '/api/memory/plasmids')).toHaveLength(1);
    });
    expect(callsToPath(calls, '/api/memory/plasmids')[0].url.searchParams.get('preset_id')).toBe('6');
    expect(first.queryByText('Be brief.')).toBeNull();
    expect(first.getByRole('heading', { name: /Blank Six/ })).toBeTruthy();
  });

  it('never shows the prior Agent identity, filter or Memory summary after switching', async () => {
    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI_5, PRESET_EMPTY_6]) },
      { test: '/api/agents/presets/5/', handler: () => jsonResponse(PRESET_ECKI_5) },
      { test: '/api/agents/presets/6/', handler: () => jsonResponse(PRESET_EMPTY_6) },
      { test: '/api/agents/conversations/', handler: () => jsonResponse(convsForEcki) },
      {
        test: '/api/memory/plasmids/',
        handler: (url) =>
          jsonResponse(
            url.searchParams.get('preset_id') === '5'
              ? [{ id: 1, tags: ['five'] }]
              : [{ id: 2, tags: ['six'] }, { id: 3, tags: [] }],
          ),
      },
    ]);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const harness = (entry: string, next: string) => (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[entry]}>
          <TestNav to={next} />
          <Routes>
            <Route element={<AppShell />}>
              <Route path="agents" element={<AgentHubPage />} />
              <Route path="agents/:presetId" element={<AgentProfilePage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    const first = render(harness('/agents/5', '/agents/6'));
    await first.findByText('Be brief.');
    const group = await first.findByRole('radiogroup', { name: '会话筛选' });
    fireEvent.click(within(group).getByRole('radio', { name: 'Alpha' }));
    await first.findByText('1 条记忆（含共享/全局）');
    expect(first.getByText('five')).toBeTruthy();

    fireEvent.click(first.getByRole('button', { name: 'nav-to-/agents/6' }));
    await first.findByText('Blank Six');
    // identity switched
    expect(first.queryByText('Be brief.')).toBeNull();
    // filter reset to 全部 — Alpha rows (11/13) and 5's identity are gone
    const group6 = first.getByRole('radiogroup', { name: '会话筛选' });
    expect(within(group6).getByRole('radio', { name: '全部' })).toBeChecked();
    await first.findByText('2 条记忆（含共享/全局）');
    expect(first.getByText('six')).toBeTruthy();
    expect(first.queryByText('five')).toBeNull();
  });
});

// ── CP1 R1 repair coverage (component state, not only pure helpers) ────────

function lensRow(
  id: number,
  agentPresetId: number,
  projectId: number | null,
  projectName: string | null = projectId === null ? null : `Project ${projectId}`,
): ConversationSummary {
  return {
    id,
    name: `row-${id}`,
    agentPresetId,
    projectId,
    projectName,
    createdAt: '2026-01-01T00:00:00Z',
    lastMessageAt: null,
    agentType: 'standard',
    thinkingLevel: null,
    memoryInjectionEnabled: null,
  };
}

function mountProfile(rows: ConversationSummary[]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  installFetch([
    { test: /^\/api\/agents\/presets\/5\/$/, handler: () => jsonResponse(PRESET_ECKI_5) },
    { test: '/api/memory/plasmids/', handler: () => jsonResponse([]) },
  ]);
  client.setQueryData(queryKeys.conversations, rows);
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/agents/5']}>
        <Routes>
          <Route path="agents/:presetId" element={<AgentProfilePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}

describe('CP1 R1 repair — filter fallback is real component state', () => {
  afterEach(() => unmockFetch());

  it('removed Project selection falls back to All and never resurrects', async () => {
    const client = mountProfile([lensRow(301, 5, 7), lensRow(302, 5, null)]);
    const filters = await screen.findByRole('radiogroup', { name: '会话筛选' });
    fireEvent.click(within(filters).getByRole('radio', { name: 'Project 7' }));
    expect(screen.queryByRole('link', { name: /row-302/ })).toBeNull();

    // confirmed dataset update removes the selected Project's final row
    act(() => {
      client.setQueryData(queryKeys.conversations, [lensRow(302, 5, null)]);
    });
    await waitFor(() => expect(within(filters).getByRole('radio', { name: '全部' })).toBeChecked());
    expect(within(filters).queryByRole('radio', { name: 'Project 7' })).toBeNull();

    // the Project returns later — the selection must NOT silently resurrect
    act(() => {
      client.setQueryData(queryKeys.conversations, [lensRow(301, 5, 7), lensRow(302, 5, null)]);
    });
    await within(filters).findByRole('radio', { name: 'Project 7' });
    expect(within(filters).getByRole('radio', { name: '全部' })).toBeChecked();
    expect(screen.getByRole('link', { name: /row-301/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /row-302/ })).toBeInTheDocument();
  });

  it('temporarily empty Agent lens falls back to All and stays All after refill', async () => {
    const client = mountProfile([lensRow(311, 5, 7)]);
    const filters = await screen.findByRole('radiogroup', { name: '会话筛选' });
    fireEvent.click(within(filters).getByRole('radio', { name: 'Project 7' }));

    act(() => {
      client.setQueryData(queryKeys.conversations, [lensRow(312, 6, 7)]);
    });
    // lens is genuinely empty: honest zero-Agent copy, no filter controls
    await screen.findByText('该 Agent 还没有会话');
    expect(screen.queryByRole('radiogroup', { name: '会话筛选' })).toBeNull();

    act(() => {
      client.setQueryData(queryKeys.conversations, [lensRow(311, 5, 7)]);
    });
    const restored = await screen.findByRole('radiogroup', { name: '会话筛选' });
    await within(restored).findByRole('radio', { name: 'Project 7' });
    // the stale Project selection did not survive the empty-lens fallback
    expect(within(restored).getByRole('radio', { name: '全部' })).toBeChecked();
  });

  it('a failed refetch round trip never erases the current selection', async () => {
    let failConversations = false;
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    installFetch([
      { test: '/api/agents/presets/5/', handler: () => jsonResponse(PRESET_ECKI_5) },
      {
        test: '/api/agents/conversations/',
        handler: () =>
          failConversations
            ? jsonResponse({ error: 'boom' }, 500)
            : jsonResponse([wireConv(321, { project: 7, project_name: 'Project 7' }), wireConv(322)]),
      },
      { test: '/api/memory/plasmids/', handler: () => jsonResponse([]) },
    ]);
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/agents/5']}>
          <Routes>
            <Route path="agents/:presetId" element={<AgentProfilePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const filters = await screen.findByRole('radiogroup', { name: '会话筛选' });
    fireEvent.click(within(filters).getByRole('radio', { name: 'Project 7' }));
    expect(within(filters).getByRole('radio', { name: 'Project 7' })).toBeChecked();

    // failing refetch: last successful dataset is retained; the request failure
    // surfaces as an honest error state (v5 observer notification lands one
    // microtask after invalidateQueries resolves), and the stored selection is
    // never erased by the failed round trip.
    failConversations = true;
    await act(async () => {
      await client.invalidateQueries({ queryKey: queryKeys.conversations });
    });
    await screen.findByText('会话加载失败');
    expect(screen.queryByRole('radiogroup', { name: '会话筛选' })).toBeNull();

    // recovery with the same dataset: the prior Project selection is still there
    failConversations = false;
    await act(async () => {
      await client.invalidateQueries({ queryKey: queryKeys.conversations });
    });
    const restored = await screen.findByRole('radiogroup', { name: '会话筛选' });
    expect(within(restored).getByRole('radio', { name: 'Project 7' })).toBeChecked();
    expect(screen.queryByRole('link', { name: /conv 321/ })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /conv 322/ })).toBeNull();
  });
});

describe('CP1 R1 repair — truthful Project identity on rows', () => {
  afterEach(() => unmockFetch());

  it('positive Project id with a null name renders Project #<id>, never Drift', async () => {
    mountProfile([{ ...lensRow(250, 5, 7), projectName: null }]);
    const link = await screen.findByRole('link', { name: /row-250/ });
    expect(link).toHaveTextContent('Project #7');
    expect(link).not.toHaveTextContent('Drift');
    expect(link.getAttribute('href')).toBe('/chat/250');
  });

  it('blank/whitespace Project names also fall back; valid names and Drift stay unchanged', async () => {
    mountProfile([
      { ...lensRow(251, 5, 8), projectName: '   ' },
      lensRow(252, 5, 9),
      lensRow(253, 5, null),
    ]);
    await screen.findByRole('link', { name: /row-251/ });
    expect(screen.getByRole('link', { name: /row-251/ })).toHaveTextContent('Project #8');
    expect(screen.getByRole('link', { name: /row-252/ })).toHaveTextContent('Project 9');
    expect(screen.getByRole('link', { name: /row-253/ })).toHaveTextContent('Drift');
  });

  it('empty Drift subset keeps the honest empty list and advisory copy, never zero-Agent copy', async () => {
    mountProfile([lensRow(261, 5, 7)]);
    const filters = await screen.findByRole('radiogroup', { name: '会话筛选' });
    fireEvent.click(within(filters).getByRole('radio', { name: 'Drift' }));
    expect(screen.queryByRole('link', { name: /row-261/ })).toBeNull();
    expect(screen.getByText('没有符合条件的会话。')).toBeTruthy();
    expect(screen.getByRole('list', { name: '该 Agent 的会话' }).children).toHaveLength(0);
    expect(screen.queryByText('该 Agent 还没有会话')).toBeNull();
    expect(within(filters).getByRole('radio', { name: 'Drift' })).toBeChecked();
  });
});
