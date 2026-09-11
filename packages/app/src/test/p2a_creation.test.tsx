import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import {
  callsToPath,
  installFetch,
  jsonResponse,
  renderApp,
  unmockFetch,
  type MockRoute,
  type RouteHandler,
} from './helpers';

const STANDARD = {
  id: 5,
  name: 'Ecki',
  description: '小快灵',
  agent_type: 'standard',
  default_model: 'deepseek-v4-flash',
  system_prompt: 'stay bright',
  is_visible: true,
};

const G045 = {
  id: 1,
  name: 'Alessandro',
  description: 'g045 主将',
  agent_type: 'g045',
  default_model: 'gemini-3.6-flash',
  system_prompt: 'lead',
  is_visible: true,
};

const OTHER = {
  id: 6,
  name: 'Solaire',
  description: 'steady',
  agent_type: 'standard',
  default_model: 'gpt-5.6-sol',
  system_prompt: 'inspect',
  is_visible: true,
};

const PROJECTS = [
  { id: 10, name: 'ProjA', description: null, prompt: null, work_dir: null, created_at: 'x' },
  { id: 20, name: 'ProjB', description: null, prompt: null, work_dir: null, created_at: 'x' },
];

const conv88 = {
  id: 88,
  name: 'created 88',
  created_at: '2026-09-01T10:00:00Z',
  frozen_project_ids: [],
  project: 0,
  project_name: null,
  agent_type: 'standard',
  agent_preset_id: 5,
  last_message_at: null,
  thinking_level: 'auto',
  memory_injection_enabled: null,
};

const initOk = () =>
  jsonResponse({
    msg: '会话已建立，权限已锁定。',
    data: { conversation_id: 88, session_id: 999, session_name: '新会话' },
  }, 201);

function profileRoutes(initHandler: RouteHandler, conversations: RouteHandler = () => jsonResponse([])): MockRoute[] {
  return [
    { test: '/api/agents/presets/5/', handler: () => jsonResponse(STANDARD) },
    { test: '/api/agents/presets/1/', handler: () => jsonResponse(G045) },
    { test: '/api/agents/presets/6/', handler: () => jsonResponse(OTHER) },
    { test: '/api/agents/presets/', handler: () => jsonResponse([G045, STANDARD, OTHER]) },
    { test: '/api/memory/plasmids/', handler: () => jsonResponse([]) },
    { test: '/api/core/projects/', handler: () => jsonResponse(PROJECTS) },
    { test: '/api/agents/conversations/', handler: conversations },
    { test: '/api/agents/sessions/init/', method: 'POST', handler: initHandler },
    { test: '/api/agents/conversations/88/', handler: () => jsonResponse(conv88) },
    {
      test: /^\/api\/agents\/chat\/88\/$/,
      handler: () => jsonResponse({ messages: [], total_count: 0, has_more: false }),
    },
  ];
}

function postBodies(calls: { url: URL; init?: RequestInit }[]): Record<string, unknown>[] {
  return callsToPath(calls, '/sessions/init/').map((call) => JSON.parse(String(call.init?.body)));
}

async function openFixedDialog() {
  fireEvent.click(await screen.findByRole('button', { name: '使用此 Agent 新建会话' }));
  return screen.findByRole('dialog', { name: '新建会话' });
}

function deferredResponse() {
  let resolve: (response: Response) => void = () => {};
  const promise = new Promise<Response>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

afterEach(() => unmockFetch());

describe('P2A Stage B fixed-Agent creation integration', () => {
  it('fixes a standard Profile Agent, submits Drift, and navigates by canonical conversation_id', async () => {
    const { calls } = installFetch(profileRoutes(initOk));
    renderApp(['/agents/5']);

    const dialog = await openFixedDialog();
    expect(within(dialog).getByText('Ecki')).toBeTruthy();
    expect(within(dialog).getByText('已固定为当前 Agent')).toBeTruthy();
    expect(within(dialog).queryAllByRole('radio')).toHaveLength(0);
    expect(calls.filter((call) => call.url.pathname === '/api/agents/presets/')).toHaveLength(0);

    fireEvent.click(within(dialog).getByRole('button', { name: '创建会话' }));
    await waitFor(() => expect(callsToPath(calls, '/sessions/init/')).toHaveLength(1));
    expect(postBodies(calls)[0]).toEqual({ preset_id: 5, project_id: 0, thinking_level: 'auto' });
    expect(await screen.findByText('还没有消息')).toBeTruthy();
    expect(callsToPath(calls, '/api/agents/conversations/88/').length).toBeGreaterThanOrEqual(1);
    expect(callsToPath(calls, '/api/agents/conversations/999/')).toHaveLength(0);
  });

  it('keeps g045 Project and frozen-project payload behavior in fixed mode', async () => {
    const { calls } = installFetch(profileRoutes(initOk));
    renderApp(['/agents/1']);

    const dialog = await openFixedDialog();
    fireEvent.change(await within(dialog).findByRole('combobox', { name: /所属项目/ }), { target: { value: '20' } });
    const checkboxes = within(dialog).getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(1);
    fireEvent.click(checkboxes[0]);
    fireEvent.click(within(dialog).getByRole('button', { name: '创建会话' }));

    await waitFor(() => expect(callsToPath(calls, '/sessions/init/')).toHaveLength(1));
    expect(postBodies(calls)[0]).toEqual({
      preset_id: 1,
      project_id: 20,
      thinking_level: 'auto',
      frozen_project_ids: [10],
    });
  });

  it('blocks duplicate fixed submits while pending', async () => {
    const gate = deferredResponse();
    const { calls } = installFetch(profileRoutes(() => gate.promise));
    renderApp(['/agents/5']);

    const dialog = await openFixedDialog();
    const submit = within(dialog).getByRole('button', { name: '创建会话' });
    fireEvent.click(submit);
    await waitFor(() => expect(callsToPath(calls, '/sessions/init/')).toHaveLength(1));
    expect(submit).toBeDisabled();
    fireEvent.click(submit);
    expect(callsToPath(calls, '/sessions/init/')).toHaveLength(1);

    gate.resolve(initOk());
    expect(await screen.findByText('还没有消息')).toBeTruthy();
    expect(callsToPath(calls, '/sessions/init/')).toHaveLength(1);
  });

  it('keeps malformed fixed success terminally locked while the dialog is live', async () => {
    const { calls } = installFetch(
      profileRoutes(() => jsonResponse({ msg: 'ok', data: { session_id: 88, session_name: 'ghost' } }, 201)),
    );
    renderApp(['/agents/5']);

    const dialog = await openFixedDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: '创建会话' }));
    expect(await within(dialog).findByText(/结果不确定/)).toBeTruthy();
    const locked = within(dialog).getByRole('button', { name: '创建已锁定' });
    expect(locked).toBeDisabled();
    fireEvent.click(locked);
    expect(callsToPath(calls, '/sessions/init/')).toHaveLength(1);
    expect(callsToPath(calls, '/api/agents/conversations/88/')).toHaveLength(0);
  });

  it('suppresses late local navigation after close but retains confirmed-success shared refresh', async () => {
    const gate = deferredResponse();
    const { calls } = installFetch(profileRoutes(() => gate.promise));
    renderApp(['/agents/5']);

    const dialog = await openFixedDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: '创建会话' }));
    await waitFor(() => expect(callsToPath(calls, '/sessions/init/')).toHaveLength(1));
    fireEvent.click(within(dialog).getByRole('button', { name: '关闭' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    gate.resolve(initOk());
    await waitFor(() => expect(callsToPath(calls, '/api/agents/conversations/').length).toBeGreaterThanOrEqual(2));
    expect(await screen.findByRole('heading', { name: /Ecki/ })).toBeTruthy();
    expect(callsToPath(calls, '/api/agents/conversations/88/')).toHaveLength(0);
  });

  it('binds the request to its submit-time Agent and suppresses navigation after Profile switch', async () => {
    const gate = deferredResponse();
    const { calls } = installFetch(profileRoutes(() => gate.promise));
    renderApp(['/agents/5']);

    const dialog = await openFixedDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: '创建会话' }));
    await waitFor(() => expect(callsToPath(calls, '/sessions/init/')).toHaveLength(1));

    fireEvent.click(screen.getByRole('link', { name: 'Agent Hub' }));
    fireEvent.click(await screen.findByRole('link', { name: /Solaire/ }));
    expect(await screen.findByRole('heading', { name: /Solaire/ })).toBeTruthy();

    gate.resolve(initOk());
    await waitFor(() => expect(callsToPath(calls, '/api/agents/conversations/').length).toBeGreaterThanOrEqual(2));
    expect(postBodies(calls)[0]).toMatchObject({ preset_id: 5 });
    expect(await screen.findByRole('heading', { name: /Solaire/ })).toBeTruthy();
    expect(callsToPath(calls, '/api/agents/conversations/88/')).toHaveLength(0);
  });
});
