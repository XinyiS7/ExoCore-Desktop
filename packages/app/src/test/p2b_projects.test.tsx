import { afterEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import type { ConversationSummary } from '../features/chat/types';
import { queryKeys } from '../features/chat/queries';
import { ProjectDetailPage } from '../features/projects/ProjectDetailPage';
import {
  callsToPath,
  installFetch,
  jsonResponse,
  renderApp,
  unmockFetch,
  type MockRoute,
  type RouteHandler,
} from './helpers';

// ── fixtures ───────────────────────────────────────────────────────────────

const PRESETS = [
  { id: 5, name: 'Ecki', description: 'fast', agent_type: 'standard', default_model: null, system_prompt: null, is_visible: true },
  { id: 6, name: 'Solaire', description: null, agent_type: 'standard', default_model: null, system_prompt: null, is_visible: true },
];

/** Backend order is authoritative: Planet (newer) first, then ExoCore. */
const PROJ_LIST = [
  { id: 2, name: 'Planet', description: null, prompt: null, work_dir: null, created_at: '2026-09-01T00:00:00Z' },
  { id: 1, name: 'ExoCore', description: 'base system', prompt: 'p', work_dir: 'D:\\ws\\exo', created_at: '2026-08-01T00:00:00Z' },
];

const PROJ_7_DETAIL = {
  id: 7, name: 'Alpha', description: 'alpha project', prompt: 'alpha prompt', work_dir: 'D:\\alpha', created_at: '2026-07-01T00:00:00Z',
};
const PROJ_8_DETAIL = {
  id: 8, name: 'Beta', description: null, prompt: null, work_dir: null, created_at: '2026-07-02T00:00:00Z',
};

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

/** Normalized domain row (server-state cache shape) for lens harness tests. */
function lensRow(
  id: number,
  opts: { agentPresetId?: number | null; projectId?: number | null } = {},
): ConversationSummary {
  return {
    id,
    name: `row-${id}`,
    agentPresetId: opts.agentPresetId ?? null,
    projectId: opts.projectId ?? null,
    projectName: opts.projectId === null ? null : `Project ${opts.projectId}`,
    createdAt: '2026-01-01T00:00:00Z',
    lastMessageAt: null,
    agentType: 'standard',
    thinkingLevel: null,
    memoryInjectionEnabled: null,
  };
}

function deferredResponse() {
  let resolve: (response: Response) => void = () => {};
  const promise = new Promise<Response>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function postBodies(calls: { url: URL; init?: RequestInit }[], pathPart: string): Record<string, unknown>[] {
  return callsToPath(calls, pathPart)
    .filter((c) => c.init?.method !== undefined && c.init?.method !== 'GET')
    .map((call) => JSON.parse(String(call.init?.body)));
}

/** apiFetch always sends an explicit GET init; count ONLY read calls. */
function getCalls(calls: { url: URL; init?: RequestInit }[], pathPart: string) {
  return callsToPath(calls, pathPart).filter((c) => (c.init?.method ?? 'GET') === 'GET');
}

/**
 * Exact-path Project-detail GET count (Stage B: the files list now shares the
 * `/api/core/projects/<id>/` path prefix, so prefix counting would silently
 * include files fetches. Detail-refresh semantics must count ONLY the detail
 * endpoint.)
 */
function detailGets(calls: { url: URL; init?: RequestInit }[], projectId: number) {
  return calls.filter(
    (c) => (c.init?.method ?? 'GET') === 'GET' && c.url.pathname === `/api/core/projects/${projectId}/`,
  );
}

function hubRoutes(over: { projects?: unknown; convs?: unknown; presets?: unknown } = {}): MockRoute[] {
  return [
    { test: '/api/agents/presets/', method: 'GET', handler: () => jsonResponse(over.presets ?? PRESETS) },
    { test: '/api/agents/conversations/', method: 'GET', handler: () => jsonResponse(over.convs ?? []) },
    { test: '/api/core/projects/', method: 'GET', handler: () => jsonResponse(over.projects ?? PROJ_LIST) },
  ];
}

afterEach(() => unmockFetch());

// ── Hub: order, counts, states ─────────────────────────────────────────────

describe('P2B Project Hub', () => {
  it('renders cards in backend order with truthful derived conversation counts', async () => {
    const { calls } = installFetch(
      hubRoutes({
        convs: [
          wireConv(11, { project: 1, project_name: 'ExoCore' }),
          wireConv(12, { project: 2, project_name: 'Planet' }),
        ],
      }),
    );
    renderApp(['/projects']);

    const list = await screen.findByRole('list', { name: '项目列表' });
    const cards = within(list).getAllByRole('link');
    expect(cards).toHaveLength(2);
    // Backend order preserved: Planet first.
    expect(cards[0]).toHaveTextContent('Planet');
    expect(cards[1]).toHaveTextContent('ExoCore');
    expect(cards[0]).toHaveTextContent('1 个会话');
    expect(cards[1]).toHaveTextContent('1 个会话');
    // Optional metadata shows the stored work_dir string; blank is absent.
    expect(cards[1]).toHaveTextContent('D:\\ws\\exo');
    expect(cards[0]).not.toHaveTextContent('D:\\ws\\exo');
    // Card links go to the canonical detail route.
    expect(cards[0].getAttribute('href')).toBe('/projects/2');
    expect(cards[1].getAttribute('href')).toBe('/projects/1');
    // Single shared conversations endpoint — never a project-filtered collection.
    expect(calls.filter((c) => c.url.pathname === '/api/agents/conversations/')).toHaveLength(1);
    expect(calls.every((c) => c.url.searchParams.get('project') === null)).toBe(true);
  });

  it('a Conversation-query failure never displays zero counts and never erases cards', async () => {
    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse(PRESETS) },
      { test: '/api/agents/conversations/', handler: () => jsonResponse({ error: 'boom' }, 500) },
      { test: '/api/core/projects/', handler: () => jsonResponse(PROJ_LIST) },
    ]);
    renderApp(['/projects']);

    const cards = await screen.findAllByRole('link', { name: /Planet|ExoCore/ });
    expect(cards).toHaveLength(2);
    expect(screen.getAllByText('会话数暂不可用')).toHaveLength(2);
    expect(screen.queryByText('0 个会话')).toBeNull();
  });

  it('shows loading, then the backend list', async () => {
    const slow = deferredResponse();
    installFetch([
      { test: '/api/agents/presets/', method: 'GET', handler: () => jsonResponse(PRESETS) },
      { test: '/api/agents/conversations/', method: 'GET', handler: () => jsonResponse([]) },
      { test: '/api/core/projects/', method: 'GET', handler: () => slow.promise },
    ]);
    renderApp(['/projects']);
    expect(await screen.findByText('正在加载项目…')).toBeTruthy();
    act(() => {
      slow.resolve(jsonResponse(PROJ_LIST));
    });
    expect(await screen.findByRole('list', { name: '项目列表' })).toBeTruthy();
  });

  it('malformed top-level success is an explicit contract error, not empty', async () => {
    installFetch(hubRoutes({ projects: { not: 'an array' } }));
    renderApp(['/projects']);
    expect(await screen.findByText('项目列表加载失败')).toBeTruthy();
    expect(screen.queryByText('还没有项目')).toBeNull();
  });

  it('a row without usable identity is an explicit contract error (malformed success)', async () => {
    installFetch(hubRoutes({ projects: [{ name: 'missing-id' }] }));
    renderApp(['/projects']);
    expect(await screen.findByText('项目列表加载失败')).toBeTruthy();
    expect(screen.queryByRole('link', { name: /missing-id/ })).toBeNull();
  });

  it('network failure is distinguishable and retry recovers', async () => {
    let fail = true;
    installFetch([
      { test: '/api/agents/presets/', method: 'GET', handler: () => jsonResponse(PRESETS) },
      { test: '/api/agents/conversations/', method: 'GET', handler: () => jsonResponse([]) },
      {
        test: '/api/core/projects/',
        method: 'GET',
        handler: () => (fail ? jsonResponse({ error: 'down' }, 500) : jsonResponse(PROJ_LIST)),
      },
    ]);
    renderApp(['/projects']);
    expect(await screen.findByText('项目列表加载失败')).toBeTruthy();
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    expect(await screen.findByRole('list', { name: '项目列表' })).toBeTruthy();
  });

  it('shows a distinct empty state with a create action', async () => {
    installFetch(hubRoutes({ projects: [] }));
    renderApp(['/projects']);
    expect(await screen.findByText('还没有项目')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /新建项目/ }).length).toBeGreaterThanOrEqual(1);
  });
});

// ── Create ─────────────────────────────────────────────────────────────────

describe('P2B Project create', () => {
  function createRoutes(initHandler: RouteHandler): MockRoute[] {
    return [
      ...hubRoutes(),
      { test: '/api/core/projects/', method: 'POST', handler: initHandler },
      { test: '/api/core/projects/9/', handler: () => jsonResponse({ id: 9, name: 'NewOne', description: '', prompt: '', work_dir: '', created_at: 't' }) },
    ];
  }

  async function openCreateDialog() {
    fireEvent.click(await screen.findByRole('button', { name: /新建项目/ }));
    return screen.findByRole('dialog', { name: '新建项目' });
  }

  it('creates with only supported fields, navigates once by the confirmed returned id', async () => {
    const { calls } = installFetch(
      createRoutes(() => jsonResponse({ id: 9, name: 'NewOne', description: 'd', prompt: 'sys', work_dir: 'D:\\new', created_at: 't' }, 201)),
    );
    renderApp(['/projects']);

    const dialog = await openCreateDialog();
    fireEvent.change(within(dialog).getByLabelText(/项目名称/), { target: { value: 'NewOne' } });
    fireEvent.change(within(dialog).getByLabelText(/描述/), { target: { value: 'd' } });
    fireEvent.change(within(dialog).getByLabelText(/System Prompt/), { target: { value: 'sys' } });
    fireEvent.change(within(dialog).getByLabelText(/工作目录/), { target: { value: 'D:\\new' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '创建项目' }));

    await waitFor(() => expect(callsToPath(calls, '/api/core/projects/').filter((c) => c.init?.method === 'POST')).toHaveLength(1));
    expect(postBodies(calls, '/api/core/projects/')[0]).toEqual({
      name: 'NewOne',
      description: 'd',
      prompt: 'sys',
      work_dir: 'D:\\new',
    });
    // Landing on the canonical detail route (exactly the returned id).
    expect(await screen.findByRole('heading', { level: 2, name: 'NewOne' })).toBeTruthy();
  });

  it('blocks submit with an empty name client-side and issues no POST', async () => {
    const { calls } = installFetch(createRoutes(() => jsonResponse({ id: 9 }, 201)));
    renderApp(['/projects']);
    const dialog = await openCreateDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: '创建项目' }));
    expect(await screen.findByText('项目名称不能为空')).toBeTruthy();
    expect(callsToPath(calls, '/api/core/projects/').filter((c) => c.init?.method === 'POST')).toHaveLength(0);
    expect(dialog).toBeInTheDocument();
  });

  it('duplicate-name 400 keeps values visible as a field error inside the dialog', async () => {
    const { calls } = installFetch(
      createRoutes(() => jsonResponse({ name: ['该项目代号已存在。'] }, 400)),
    );
    renderApp(['/projects']);
    const dialog = await openCreateDialog();
    const nameInput = within(dialog).getByLabelText(/项目名称/);
    fireEvent.change(nameInput, { target: { value: 'DupName' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '创建项目' }));
    expect(await screen.findByText('该项目代号已存在。')).toBeTruthy();
    expect(callsToPath(calls, '/api/core/projects/').filter((c) => c.init?.method === 'POST')).toHaveLength(1);
    // entered values retained; navigation did not happen (still on the Hub)
    expect(nameInput).toHaveValue('DupName');
    expect(screen.getByRole('heading', { level: 1, name: '项目' })).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 1, name: '项目详情' })).toBeNull();
  });

  it('malformed 2xx locks resubmission, never navigates, and still invalidates the list', async () => {
    const { calls } = installFetch(
      createRoutes(() => jsonResponse({ ok: true }, 201)),
    );
    renderApp(['/projects']);
    const dialog = await openCreateDialog();
    fireEvent.change(within(dialog).getByLabelText(/项目名称/), { target: { value: 'X' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '创建项目' }));

    expect(await screen.findByText('创建已锁定')).toBeTruthy();
    // still on the Hub; no navigation to a fabricated or absent id
    expect(screen.getByRole('heading', { level: 1, name: '项目' })).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 1, name: '项目详情' })).toBeNull();
    expect(within(dialog).getByRole('button', { name: '创建已锁定' })).toBeDisabled();
    // list invalidation ran after the ambiguous write (re-fetch)
    await waitFor(() => expect(getCalls(calls, '/api/core/projects/').length).toBeGreaterThanOrEqual(2));
  });

  it('late completion after close does not navigate, but confirmed write still invalidates', async () => {
    const slow = deferredResponse();
    const { calls } = installFetch(createRoutes(() => slow.promise));
    renderApp(['/projects']);
    const dialog = await openCreateDialog();
    fireEvent.change(within(dialog).getByLabelText(/项目名称/), { target: { value: 'Late' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '创建项目' }));

    // close while pending
    fireEvent.click(within(dialog).getByRole('button', { name: '取消' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    // resolve late: write confirmed → list invalidated, but no navigation
    act(() => {
      slow.resolve(jsonResponse({ id: 9, name: 'Late', description: '', prompt: '', work_dir: '', created_at: 't' }, 201));
    });
    await waitFor(() => expect(getCalls(calls, '/api/core/projects/').length).toBeGreaterThanOrEqual(2));
    expect(screen.queryByRole('heading', { level: 2, name: 'Late' })).toBeNull();
    // still on the Hub (list title visible)
    expect(screen.getByRole('heading', { level: 1, name: '项目' })).toBeTruthy();
  });

  it('duplicate submit is blocked while pending', async () => {
    const slow = deferredResponse();
    const { calls } = installFetch(createRoutes(() => slow.promise));
    renderApp(['/projects']);
    const dialog = await openCreateDialog();
    fireEvent.change(within(dialog).getByLabelText(/项目名称/), { target: { value: 'Once' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '创建项目' }));
    expect(await within(dialog).findByRole('button', { name: /保存中/ })).toBeDisabled();
    act(() => {
      slow.resolve(jsonResponse({ id: 9, name: 'Once', description: '', prompt: '', work_dir: '', created_at: 't' }, 201));
    });
    await waitFor(() => expect(callsToPath(calls, '/api/core/projects/').filter((c) => c.init?.method === 'POST')).toHaveLength(1));
  });

  it('F02: create surfaces an overlong work_dir server reason, retains input; retry sends again', async () => {
    let postCount = 0;
    installFetch(
      createRoutes(() => {
        postCount += 1;
        return jsonResponse({ work_dir: ['工作目录最多 500 个字符。'] }, 400);
      }),
    );
    renderApp(['/projects']);
    const dialog = await openCreateDialog();
    fireEvent.change(within(dialog).getByLabelText(/项目名称/), { target: { value: 'Long' } });
    const longValue = 'D:\\' + 'y'.repeat(600);
    fireEvent.change(within(dialog).getByLabelText(/工作目录/), { target: { value: longValue } });
    fireEvent.click(within(dialog).getByRole('button', { name: '创建项目' }));

    expect(await screen.findByText('工作目录最多 500 个字符。')).toBeTruthy();
    expect(within(dialog).getByLabelText(/工作目录/)).toHaveValue(longValue);
    expect(within(dialog).getByRole('button', { name: /创建项目/ })).not.toBeDisabled();
    fireEvent.click(within(dialog).getByRole('button', { name: '创建项目' }));
    await waitFor(() => expect(postCount).toBe(2));
  });
});

// ── Detail states ──────────────────────────────────────────────────────────

describe('P2B Project Detail states', () => {
  function detailRoutes(over: { detail?: RouteHandler; convs?: unknown } = {}): MockRoute[] {
    return [
      { test: '/api/agents/presets/', handler: () => jsonResponse(PRESETS) },
      { test: '/api/agents/conversations/', handler: () => jsonResponse(over.convs ?? []) },
      { test: '/api/core/projects/7/', handler: over.detail ?? (() => jsonResponse(PROJ_7_DETAIL)) },
    ];
  }

  it('invalid route id renders a distinct state and issues zero project requests', async () => {
    const { calls } = installFetch(detailRoutes());
    renderApp(['/projects/abc']);
    expect(await screen.findByText('无效的项目地址')).toBeTruthy();
    expect(callsToPath(calls, '/api/core/projects/')).toHaveLength(0);
    expect(callsToPath(calls, '/conversations/')).toHaveLength(0);
  });

  it('404 is distinct from request failure and never mounts child sections', async () => {
    const { calls } = installFetch(
      detailRoutes({ detail: () => jsonResponse({ detail: 'Not found.' }, 404) }),
    );
    renderApp(['/projects/7']);
    expect(await screen.findByText('项目不存在或已被删除')).toBeTruthy();
    expect(callsToPath(calls, '/conversations/')).toHaveLength(0);
    // back/recovery links
    expect(screen.getAllByRole('link', { name: '项目 Hub' }).length).toBeGreaterThanOrEqual(1);
  });

  it('network failure is distinct and retry recovers', async () => {
    let fail = true;
    installFetch(
      detailRoutes({
        detail: () => (fail ? jsonResponse({ error: 'down' }, 500) : jsonResponse(PROJ_7_DETAIL)),
      }),
    );
    renderApp(['/projects/7']);
    expect(await screen.findByText('项目详情加载失败')).toBeTruthy();
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Alpha' })).toBeTruthy();
  });

  it('malformed detail success is an explicit contract error, not an empty success', async () => {
    installFetch(detailRoutes({ detail: () => jsonResponse({ name: 'no-id' }) }));
    renderApp(['/projects/7']);
    expect(await screen.findByText('项目详情加载失败')).toBeTruthy();
  });

  it('blank optional fields are labelled honestly on the overview', async () => {
    installFetch(
      detailRoutes({
        detail: () =>
          jsonResponse({ id: 7, name: 'Alpha', description: null, prompt: null, work_dir: null, created_at: 't' }),
      }),
    );
    renderApp(['/projects/7']);
    await screen.findByRole('heading', { level: 2, name: 'Alpha' });
    expect(screen.getByText('暂无描述')).toBeTruthy();
    expect(screen.getByText('未设置 System Prompt')).toBeTruthy();
    expect(screen.getByText('未绑定工作目录')).toBeTruthy();
  });

  it.each([0, -4, 1.5])('F03: detail response identity %s is a contract error, never an editable owner', async (badId) => {
    installFetch(
      detailRoutes({
        detail: () =>
          jsonResponse({ id: badId, name: 'Alpha', description: null, prompt: null, work_dir: null, created_at: 't' }),
      }),
    );
    renderApp(['/projects/7']);
    expect(await screen.findByText('项目详情加载失败')).toBeTruthy();
    // no editable overview, no child lens, no overview facts
    expect(screen.queryByRole('button', { name: /编辑/ })).toBeNull();
    expect(screen.queryByRole('heading', { level: 2, name: 'Alpha' })).toBeNull();
    expect(screen.queryByRole('radiogroup', { name: '会话筛选' })).toBeNull();
  });

  it('F04: backend empty-string configuration is labelled as absent, never blank; editor round-trips blanks', async () => {
    installFetch(
      detailRoutes({
        detail: () =>
          jsonResponse({ id: 7, name: 'Alpha', description: '', prompt: '', work_dir: '', created_at: 't' }),
      }),
    );
    renderApp(['/projects/7']);
    await screen.findByRole('heading', { level: 2, name: 'Alpha' });
    expect(screen.getByText('暂无描述')).toBeTruthy();
    expect(screen.getByText('未设置 System Prompt')).toBeTruthy();
    expect(screen.getByText('未绑定工作目录')).toBeTruthy();
    // the editor still round-trips blanks as '', never as placeholder text
    fireEvent.click(screen.getByRole('button', { name: /编辑/ }));
    const dialog = await screen.findByRole('dialog', { name: '编辑项目' });
    expect(within(dialog).getByLabelText(/描述/)).toHaveValue('');
    expect(within(dialog).getByLabelText(/System Prompt/)).toHaveValue('');
    expect(within(dialog).getByLabelText(/工作目录/)).toHaveValue('');
  });
});

// ── Lens ───────────────────────────────────────────────────────────────────

describe('P2B Project Conversation lens (single shared cache)', () => {
  const projectRows = [
    wireConv(1, { project: 7, project_name: 'Alpha', agent_preset_id: 5 }),
    wireConv(2, { project: 8, project_name: 'Beta', agent_preset_id: 5 }),
    wireConv(3, { project: 7, project_name: 'Alpha', agent_preset_id: 6 }),
    wireConv(4, { project: 0, agent_preset_id: 5 }), // Drift
    wireConv(5, { project: 7, project_name: 'Alpha', agent_preset_id: null }), // invalid identity
    wireConv(6, { project: 7, project_name: 'Alpha', agent_preset_id: 42 }), // name-less preset
  ];

  it('only exact current-Project rows appear; backend order preserved under All and Agent filters', async () => {
    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse(PRESETS) },
      { test: '/api/agents/conversations/', handler: () => jsonResponse(projectRows) },
      { test: '/api/core/projects/7/', handler: () => jsonResponse(PROJ_7_DETAIL) },
    ]);
    renderApp(['/projects/7']);

    const list = await screen.findByRole('list', { name: '该项目下的会话' });
    const links = within(list).getAllByRole('link');
    // rows 1,3,5,6 belong to project 7, in backend order; 2 (Beta) and 4 (Drift) never leak in
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['/chat/1', '/chat/3', '/chat/5', '/chat/6']);

    const filters = screen.getByRole('radiogroup', { name: '会话筛选' });
    expect(within(filters).getByRole('radio', { name: '全部' })).toBeChecked();
    // Agent options: Ecki(5), Solaire(6), Agent #42 — deduped, truthful fallback; null is not an option
    expect(within(filters).getByRole('radio', { name: 'Ecki' })).toBeTruthy();
    expect(within(filters).getByRole('radio', { name: 'Solaire' })).toBeTruthy();
    expect(within(filters).getByRole('radio', { name: 'Agent #42' })).toBeTruthy();
    expect(within(filters).queryByRole('radio', { name: '未知 Agent' })).toBeNull();

    // narrow by Ecki: only his rows, backend order preserved
    fireEvent.click(within(filters).getByRole('radio', { name: 'Ecki' }));
    expect(within(list).getAllByRole('link').map((l) => l.getAttribute('href'))).toEqual(['/chat/1']);
    // row 5 has no identity → truthful unavailable label under All
    fireEvent.click(within(filters).getByRole('radio', { name: '全部' }));
    expect(screen.getByRole('link', { name: /conv 5/ })).toHaveTextContent('未知 Agent');
  });

  it('conversation failure is an independent surface that never erases identity or counts-to-zero', async () => {
    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse(PRESETS) },
      { test: '/api/agents/conversations/', handler: () => jsonResponse({ error: 'boom' }, 500) },
      { test: '/api/core/projects/7/', handler: () => jsonResponse(PROJ_7_DETAIL) },
    ]);
    renderApp(['/projects/7']);
    // identity still intact
    await screen.findByRole('heading', { level: 2, name: 'Alpha' });
    expect(await screen.findByText('会话加载失败')).toBeTruthy();
    expect(screen.queryByText('该项目还没有会话')).toBeNull();
  });
});

// ── Shell projection ───────────────────────────────────────────────────────

describe('P2B shell projection (D8)', () => {
  it('Project Hub keeps the mobile bottom bar and Chat stays active', async () => {
    installFetch(hubRoutes());
    renderApp(['/projects']);
    await screen.findByRole('list', { name: '项目列表' });
    expect(screen.getByRole('navigation', { name: '主导航' })).toBeTruthy();
    // D8: Project routes remain in the Chat product area's active state.
    const chatLinks = screen.getAllByRole('link', { name: 'Chat' });
    expect(chatLinks.length).toBeGreaterThanOrEqual(1);
    for (const link of chatLinks) expect(link).toHaveAttribute('aria-current', 'page');
  });

  it('Project Detail hides the mobile bottom bar (focused L2)', async () => {
    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse(PRESETS) },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([]) },
      { test: '/api/core/projects/7/', handler: () => jsonResponse(PROJ_7_DETAIL) },
    ]);
    renderApp(['/projects/7']);
    await screen.findByRole('heading', { level: 2, name: 'Alpha' });
    expect(screen.queryByRole('navigation', { name: '主导航' })).toBeNull();
  });

  it('invalid Project IDs keep the mobile bottom bar and mount no requests', async () => {
    const { calls } = installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse(PRESETS) },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([]) },
    ]);
    renderApp(['/projects/abc']);
    await screen.findByText('无效的项目地址');
    expect(screen.getByRole('navigation', { name: '主导航' })).toBeTruthy();
    expect(callsToPath(calls, '/api/core/projects/')).toHaveLength(0);
  });
});

// ── Lens harness: selection persistence + origin isolation ────────────────

/** Mounts the real Detail page on its own Route tree with a seeded cache. */
function mountDetail(projectId: number, opts: { presetFail?: boolean } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  installFetch([
    { test: `/api/core/projects/${projectId}/`, handler: () => jsonResponse(PROJ_7_DETAIL) },
    {
      test: '/api/agents/presets/',
      handler: () => (opts.presetFail ? jsonResponse({ error: 'down' }, 500) : jsonResponse(PRESETS)),
    },
  ]);
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/projects/${projectId}`]}>
        <Routes>
          <Route path="projects/:projectId" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}

function NavProbe({ to }: { to: string }) {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(to)}>
      go {to}
    </button>
  );
}

function mountDetailWithNav(
  initial: string,
  targets: string[] = ['/projects/8'],
  opts: { staleTime?: number } = {},
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: opts.staleTime ?? 0 } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initial]}>
        {targets.map((to) => (
          <NavProbe key={to} to={to} />
        ))}
        <Routes>
          <Route path="projects/:projectId" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}

describe('P2B lens — selection persistence and origin isolation', () => {
  it('selected Agent falls back permanently to All after a dataset replacement, never resurrects', async () => {
    const client = mountDetail(7);
    const seed = [lensRow(301, { projectId: 7, agentPresetId: 5 }), lensRow(302, { projectId: 7, agentPresetId: null })];
    act(() => client.setQueryData(queryKeys.conversations, seed));

    const filters = await screen.findByRole('radiogroup', { name: '会话筛选' });
    const ecki = await within(filters).findByRole('radio', { name: 'Ecki' });
    fireEvent.click(ecki);
    expect(within(filters).getByRole('radio', { name: 'Ecki' })).toBeChecked();

    // confirmed replacement removes the selected Agent's final row
    act(() => client.setQueryData(queryKeys.conversations, [lensRow(302, { projectId: 7, agentPresetId: null })]));
    await waitFor(() => expect(within(filters).getByRole('radio', { name: '全部' })).toBeChecked());
    expect(within(filters).queryByRole('radio', { name: 'Ecki' })).toBeNull();

    // the Agent returns later — selection must NOT silently resurrect
    act(() => client.setQueryData(queryKeys.conversations, seed));
    await within(filters).findByRole('radio', { name: 'Ecki' });
    expect(within(filters).getByRole('radio', { name: '全部' })).toBeChecked();
    expect(screen.getByRole('link', { name: /row-301/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /row-302/ })).toBeInTheDocument();
  });

  it('preset-name failure degrades to Agent #<id> labels with a visible banner, not a blocker', async () => {
    const client = mountDetail(7, { presetFail: true });
    act(() => client.setQueryData(queryKeys.conversations, [lensRow(311, { projectId: 7, agentPresetId: 5 })]));
    expect(await screen.findByText('Agent 名称加载失败，将显示 Agent 编号。')).toBeTruthy();
    expect(await screen.findByRole('radio', { name: 'Agent #5' })).toBeTruthy();
  });

  it('a failed refetch round trip never erases the current selection', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    let failConversations = false;
    installFetch([
      { test: '/api/core/projects/7/', handler: () => jsonResponse(PROJ_7_DETAIL) },
      { test: '/api/agents/presets/', handler: () => jsonResponse(PRESETS) },
      {
        test: '/api/agents/conversations/',
        handler: () =>
          failConversations
            ? jsonResponse({ error: 'boom' }, 500)
            : jsonResponse([wireConv(321, { project: 7, project_name: 'Alpha', agent_preset_id: 5 })]),
      },
    ]);
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/projects/7']}>
          <Routes>
            <Route path="projects/:projectId" element={<ProjectDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const filters = await screen.findByRole('radiogroup', { name: '会话筛选' });
    fireEvent.click(within(filters).getByRole('radio', { name: 'Ecki' }));
    expect(within(filters).getByRole('radio', { name: 'Ecki' })).toBeChecked();

    failConversations = true;
    await act(async () => {
      await client.invalidateQueries({ queryKey: queryKeys.conversations });
    });
    await screen.findByText('会话加载失败');
    expect(screen.queryByRole('radiogroup', { name: '会话筛选' })).toBeNull();

    failConversations = false;
    await act(async () => {
      await client.invalidateQueries({ queryKey: queryKeys.conversations });
    });
    const restored = await screen.findByRole('radiogroup', { name: '会话筛选' });
    expect(within(restored).getByRole('radio', { name: 'Ecki' })).toBeChecked();
  });

  it('route switch A→B resets the local filter', async () => {
    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse(PRESETS) },
      {
        test: '/api/agents/conversations/',
        handler: () =>
          jsonResponse([
            wireConv(11, { project: 7, project_name: 'Alpha', agent_preset_id: 5 }),
            wireConv(12, { project: 8, project_name: 'Beta', agent_preset_id: 6 }),
          ]),
      },
      { test: '/api/core/projects/7/', handler: () => jsonResponse(PROJ_7_DETAIL) },
      { test: '/api/core/projects/8/', handler: () => jsonResponse(PROJ_8_DETAIL) },
    ]);
    mountDetailWithNav('/projects/7');

    await screen.findByRole('heading', { level: 2, name: 'Alpha' });
    const filtersA = await screen.findByRole('radiogroup', { name: '会话筛选' });
    const eckiA = await within(filtersA).findByRole('radio', { name: 'Ecki' });
    fireEvent.click(eckiA);

    fireEvent.click(screen.getByRole('button', { name: 'go /projects/8' }));
    await screen.findByRole('heading', { level: 2, name: 'Beta' });
    expect(screen.queryByRole('heading', { level: 2, name: 'Alpha' })).toBeNull();
    const filtersB = await screen.findByRole('radiogroup', { name: '会话筛选' });
    // local filter reset to All on route change
    expect(within(filtersB).getByRole('radio', { name: '全部' })).toBeChecked();
  });

  it('late Project-A detail completion never renders under Project B', async () => {
    const slow = deferredResponse();
    const { calls } = installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse(PRESETS) },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([]) },
      { test: '/api/core/projects/7/', handler: () => slow.promise },
      { test: '/api/core/projects/8/', handler: () => jsonResponse(PROJ_8_DETAIL) },
    ]);
    void calls;
    mountDetailWithNav('/projects/7');

    expect(await screen.findByText('正在加载项目…')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'go /projects/8' }));
    await screen.findByRole('heading', { level: 2, name: 'Beta' });

    // late resolve of the A request lands in route-keyed cache, invisible here
    act(() => {
      slow.resolve(jsonResponse(PROJ_7_DETAIL));
    });
    expect(screen.queryByRole('heading', { level: 2, name: 'Alpha' })).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: 'Beta' })).toBeTruthy();
  });
});

// ── Edit ───────────────────────────────────────────────────────────────────

describe('P2B Project edit', () => {
  function editRoutes(onPatch: RouteHandler): MockRoute[] {
    return [
      { test: '/api/agents/presets/', handler: () => jsonResponse(PRESETS) },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([]) },
      { test: '/api/core/projects/7/', method: 'PATCH', handler: onPatch },
      { test: '/api/core/projects/7/', handler: () => jsonResponse(PROJ_7_DETAIL) },
    ];
  }

  async function openEditDialog() {
    fireEvent.click(await screen.findByRole('button', { name: /编辑/ }));
    return screen.findByRole('dialog', { name: '编辑项目' });
  }

  it('prefills from server truth and saves only supported fields incl. work_dir, then refetches', async () => {
    const { calls } = installFetch(
      editRoutes(() => jsonResponse(PROJ_7_DETAIL, 200)),
    );
    renderApp(['/projects/7']);

    const dialog = await openEditDialog();
    expect(within(dialog).getByLabelText(/项目名称/)).toHaveValue('Alpha');
    expect(within(dialog).getByLabelText(/描述/)).toHaveValue('alpha project');
    expect(within(dialog).getByLabelText(/System Prompt/)).toHaveValue('alpha prompt');
    expect(within(dialog).getByLabelText(/工作目录/)).toHaveValue('D:\\alpha');

    fireEvent.change(within(dialog).getByLabelText(/描述/), { target: { value: 'updated desc' } });
    fireEvent.change(within(dialog).getByLabelText(/工作目录/), { target: { value: 'D:\\new-dir' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '保存' }));

    await waitFor(() => expect(callsToPath(calls, '/api/core/projects/7/').filter((c) => c.init?.method === 'PATCH')).toHaveLength(1));
    expect(postBodies(calls, '/api/core/projects/7/')[0]).toEqual({
      name: 'Alpha',
      description: 'updated desc',
      prompt: 'alpha prompt',
      work_dir: 'D:\\new-dir',
    });
    // success closes the dialog; server truth is re-read (detail refetch)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(detailGets(calls, 7).length).toBeGreaterThanOrEqual(2));
    // edit performs no directory probe at all
    expect(callsToPath(calls, '/tree/')).toHaveLength(0);
  });

  it('clearing work_dir sends an explicit empty string (blank allowed)', async () => {
    const { calls } = installFetch(
      editRoutes(() => jsonResponse({ ...PROJ_7_DETAIL, work_dir: '' }, 200)),
    );
    renderApp(['/projects/7']);
    const dialog = await openEditDialog();
    fireEvent.change(within(dialog).getByLabelText(/工作目录/), { target: { value: '' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '保存' }));
    await waitFor(() => expect(callsToPath(calls, '/api/core/projects/7/').filter((c) => c.init?.method === 'PATCH')).toHaveLength(1));
    expect(postBodies(calls, '/api/core/projects/7/')[0]).toMatchObject({ work_dir: '' });
    expect(screen.queryByText('保存失败，请稍后重试。')).toBeNull();
  });

  it('failure retains entered values and surfaces the server field error', async () => {
    const { calls } = installFetch(
      editRoutes(() => jsonResponse({ name: ['该项目代号已存在。'] }, 400)),
    );
    renderApp(['/projects/7']);
    const dialog = await openEditDialog();
    const nameInput = within(dialog).getByLabelText(/项目名称/);
    fireEvent.change(nameInput, { target: { value: 'Renamed' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '保存' }));
    expect(await screen.findByText('该项目代号已存在。')).toBeTruthy();
    expect(nameInput).toHaveValue('Renamed');
    expect(dialog).toBeInTheDocument();
    expect(callsToPath(calls, '/api/core/projects/7/').filter((c) => c.init?.method === 'PATCH')).toHaveLength(1);
  });

  it('ambiguous 2xx edit keeps the dialog open with an honest message and re-reads truth', async () => {
    const { calls } = installFetch(
      editRoutes(() => jsonResponse({ unrecognized: true }, 200)),
    );
    renderApp(['/projects/7']);
    const dialog = await openEditDialog();
    fireEvent.change(within(dialog).getByLabelText(/描述/), { target: { value: 'x' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '保存' }));
    expect(await screen.findByText(/项目已保存，但返回内容无法确认/)).toBeTruthy();
    // not terminal-locked (edit retries are idempotent); dialog stays open
    expect(within(dialog).getByRole('button', { name: '保存' })).not.toBeDisabled();
    // canonical data re-read
    await waitFor(() => expect(detailGets(calls, 7).length).toBeGreaterThanOrEqual(2));
  });

  // ── F01: submit-origin identity survives route switches ───────────────────

  it.each([
    ['confirmed success settles to saved truth', () => jsonResponse({ id: 7, name: 'Saved-A', description: '', prompt: '', work_dir: '', created_at: 't' }, 200), 'Saved-A', true],
    ['ambiguous malformed 2xx re-reads truth', () => jsonResponse({ unrecognized: true }, 200), 'Saved-A', true],
    ['definite 400 keeps prior truth, no wrong invalidation', () => jsonResponse({ name: ['拒绝。'] }, 400), 'Alpha', false],
  ])('A PATCH settling after a route switch to cached B: %s', async (_label, settleResponse, expectedHeading, expectRefetchA) => {
    const patchSlow = deferredResponse();
    let serverA = { ...PROJ_7_DETAIL };
    const { calls } = installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse(PRESETS) },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([]) },
      { test: '/api/core/projects/7/', method: 'PATCH', handler: () => patchSlow.promise },
      { test: '/api/core/projects/7/', handler: () => jsonResponse(serverA) },
      { test: '/api/core/projects/8/', handler: () => jsonResponse(PROJ_8_DETAIL) },
    ]);
    // staleTime: Infinity — only write-driven invalidation can refresh A when
    // we return; a remount refetch must NOT mask a wrong invalidation target.
    mountDetailWithNav('/projects/7', ['/projects/8', '/projects/7'], { staleTime: Infinity });

    // A confirmed and cached, B cached
    await screen.findByRole('heading', { level: 2, name: 'Alpha' });
    fireEvent.click(screen.getByRole('button', { name: 'go /projects/8' }));
    await screen.findByRole('heading', { level: 2, name: 'Beta' });
    fireEvent.click(screen.getByRole('button', { name: 'go /projects/7' }));
    await screen.findByRole('heading', { level: 2, name: 'Alpha' });

    // start the A PATCH, then switch away while it is pending
    const dialog = await openEditDialog();
    fireEvent.change(within(dialog).getByLabelText(/项目名称/), { target: { value: 'Saved-A' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '保存' }));
    await within(dialog).findByRole('button', { name: /保存中/ });

    fireEvent.click(screen.getByRole('button', { name: 'go /projects/8' }));
    await screen.findByRole('heading', { level: 2, name: 'Beta' });

    // the A write settles while we are on B…
    act(() => {
      serverA = { ...PROJ_7_DETAIL, name: 'Saved-A' };
      patchSlow.resolve(settleResponse());
    });
    // B is not disturbed by A's completion (no stray refetch of B)
    await waitFor(() => expect(detailGets(calls, 8).length).toBe(1));

    // …returning to A consumes refreshed/stale-marked server truth
    fireEvent.click(screen.getByRole('button', { name: 'go /projects/7' }));
    await screen.findByRole('heading', { level: 2, name: expectedHeading });
    if (expectRefetchA) {
      expect(screen.queryByRole('heading', { level: 2, name: 'Alpha' })).toBeNull();
    }
    // the PATCH body was bound to A's identity
    expect(postBodies(calls, '/api/core/projects/')[0]).toMatchObject({ name: 'Saved-A' });
    // only confirmed/ambiguous writes mark A stale for re-read; rejected writes don't
    if (expectRefetchA) {
      expect(detailGets(calls, 7).length).toBeGreaterThanOrEqual(2);
    } else {
      expect(detailGets(calls, 7).length).toBe(1);
    }
  });

  it('an obsolete A completion never closes a newer B edit dialog', async () => {
    const patchSlow = deferredResponse();
    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse(PRESETS) },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([]) },
      { test: '/api/core/projects/7/', method: 'PATCH', handler: () => patchSlow.promise },
      { test: '/api/core/projects/7/', handler: () => jsonResponse(PROJ_7_DETAIL) },
      { test: '/api/core/projects/8/', handler: () => jsonResponse(PROJ_8_DETAIL) },
    ]);
    mountDetailWithNav('/projects/7', ['/projects/8', '/projects/7']);

    await screen.findByRole('heading', { level: 2, name: 'Alpha' });
    const dialogA = await openEditDialog();
    fireEvent.change(within(dialogA).getByLabelText(/项目名称/), { target: { value: 'A-saved' } });
    fireEvent.click(within(dialogA).getByRole('button', { name: '保存' }));
    await within(dialogA).findByRole('button', { name: /保存中/ });

    // switch to B while A's PATCH is pending; open B's own edit dialog
    fireEvent.click(screen.getByRole('button', { name: 'go /projects/8' }));
    await screen.findByRole('heading', { level: 2, name: 'Beta' });
    fireEvent.click(screen.getByRole('button', { name: /编辑/ }));
    const dialogB = await screen.findByRole('dialog', { name: '编辑项目' });

    // A's obsolete completion settles: B's dialog stays open and untouched
    act(() => {
      patchSlow.resolve(jsonResponse({ ...PROJ_7_DETAIL, name: 'A-saved' }, 200));
    });
    expect(screen.getByRole('dialog', { name: '编辑项目' })).toBe(dialogB);
    expect(within(dialogB).getByLabelText(/项目名称/)).toHaveValue('Beta');
    expect(screen.getByRole('heading', { level: 2, name: 'Beta' })).toBeTruthy();
  });

  it('F02: supported non-name server reasons are visible per-control; inputs retained; retry allowed', async () => {
    let patchCount = 0;
    const { calls } = installFetch(
      editRoutes(() => {
        patchCount += 1;
        return patchCount === 1
          ? jsonResponse({ work_dir: ['工作目录最多 500 个字符。'], prompt: ['Prompt 不合法。'] }, 400)
          : jsonResponse({ ...PROJ_7_DETAIL, name: 'Retried' }, 200);
      }),
    );
    renderApp(['/projects/7']);
    const dialog = await openEditDialog();
    const workdirInput = within(dialog).getByLabelText(/工作目录/);
    const promptInput = within(dialog).getByLabelText(/System Prompt/);
    fireEvent.change(workdirInput, { target: { value: 'D:\\' + 'x'.repeat(600) } });
    fireEvent.change(promptInput, { target: { value: 'bad prompt' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '保存' }));

    // backend reasons visible next to their controls — not only a generic 400
    expect(await screen.findByText('工作目录最多 500 个字符。')).toBeTruthy();
    expect(screen.getByText('Prompt 不合法。')).toBeTruthy();
    // inputs retained
    expect(workdirInput).toHaveValue('D:\\' + 'x'.repeat(600));
    expect(promptInput).toHaveValue('bad prompt');
    // the banner points at the marked fields instead of the transport generic
    expect(screen.getByText('请修正表单中标记的错误后重试。')).toBeTruthy();
    // definite failure still allows retry — second submit succeeds and closes
    fireEvent.click(within(dialog).getByRole('button', { name: '保存' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(patchCount).toBe(2);
    expect(detailGets(calls, 7).length).toBeGreaterThanOrEqual(2);
  });
});

// ── Chat Home entry ────────────────────────────────────────────────────────

describe('P2B Chat Home entry', () => {
  it('offers the secondary Project Hub entry and navigates into the canonical Hub', async () => {
    installFetch(hubRoutes());
    renderApp(['/']);
    fireEvent.click(await screen.findByRole('link', { name: /项目 Hub/ }));
    expect(await screen.findByRole('heading', { level: 1, name: '项目' })).toBeTruthy();
    expect(await screen.findByRole('list', { name: '项目列表' })).toBeTruthy();
  });
});