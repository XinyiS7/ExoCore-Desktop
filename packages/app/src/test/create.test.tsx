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

const PRESETS = [
  { id: 1, name: 'Alessandro', description: 'g045 主将', agent_type: 'g045', default_model: 'gemini-3.6-flash', system_prompt: null, is_visible: true },
  { id: 2, name: 'Alicia', description: 'user', agent_type: 'user', default_model: null, system_prompt: null, is_visible: true },
  { id: 5, name: 'Ecki', description: '小快灵', agent_type: 'standard', default_model: 'deepseek-v4-flash', system_prompt: null, is_visible: true },
];

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

function baseRoutes(initHandler: RouteHandler): MockRoute[] {
  return [
    { test: '/api/agents/presets/', handler: () => jsonResponse(PRESETS) },
    { test: '/api/core/projects/', handler: () => jsonResponse(PROJECTS) },
    { test: '/api/agents/conversations/', handler: () => jsonResponse([]) },
    { test: '/api/agents/sessions/init/', method: 'POST', handler: initHandler },
    // Post-success navigation target (/chat/88) for success-path tests.
    { test: '/api/agents/conversations/88/', handler: () => jsonResponse(conv88) },
    {
      test: /^\/api\/agents\/chat\/88\/$/,
      handler: () => jsonResponse({ messages: [], total_count: 0, has_more: false }),
    },
  ];
}

const initOk = () =>
  jsonResponse({ msg: '会话已建立，权限已锁定。', data: { conversation_id: 88, session_id: 88, session_name: '新会话' } }, 201);

function postBodies(calls: { url: URL; init?: RequestInit }[]): Record<string, unknown>[] {
  return callsToPath(calls, '/sessions/init/').map((c) => JSON.parse(String(c.init?.body)));
}

function openDialog() {
  return screen.findByRole('dialog');
}

async function chooseAgent(label: RegExp) {
  const dialog = await openDialog();
  fireEvent.click(within(dialog).getByLabelText(label));
  return dialog;
}

afterEach(() => unmockFetch());

describe('Conversation creation dialog', () => {
  it('opens with focus entry, lists only non-user Agents, closes on Escape with focus return', async () => {
    installFetch(baseRoutes(initOk));
    renderApp(['/']);
    const trigger = (await screen.findByRole('button', { name: /新建会话/ })) as HTMLButtonElement;
    trigger.focus(); // real browsers focus buttons on mousedown; jsdom does not
    fireEvent.click(trigger);

    const dialog = await openDialog();
    expect(dialog).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText(/会话名称/));
    const radios = within(dialog).getAllByRole('radio');
    expect(radios).toHaveLength(2); // Alessandro + Ecki; Alicia (user) excluded
    expect(within(dialog).getByText('g045')).toBeTruthy();
    expect(within(dialog).queryByText('Alicia')).toBeNull();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it('creates a Drift conversation with a standard agent: canonical body, no permission UI', async () => {
    const { calls } = installFetch(baseRoutes(initOk));
    renderApp(['/']);
    fireEvent.click((await screen.findAllByRole('button', { name: /新建会话/ }))[0]);
    await chooseAgent(/Ecki/);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryAllByRole('checkbox')).toHaveLength(0);

    fireEvent.click(within(dialog).getByRole('button', { name: '创建会话' }));
    await waitFor(() => expect(callsToPath(calls, '/sessions/init/')).toHaveLength(1));
    expect(postBodies(calls)[0]).toEqual({ preset_id: 5, project_id: 0, thinking_level: 'auto' });
    // Navigates to the returned session → honest empty read state.
    expect(await screen.findByText('还没有消息')).toBeTruthy();
  });

  it('g045 permission payload branch: Drift primary + two extension projects', async () => {
    const { calls } = installFetch(baseRoutes(initOk));
    renderApp(['/']);
    fireEvent.click((await screen.findAllByRole('button', { name: /新建会话/ }))[0]);
    const dialog = await chooseAgent(/Alessandro/);

    const checkboxes = within(dialog).getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(2); // ProjA + ProjB (Drift primary excludes none)
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);

    fireEvent.click(within(dialog).getByRole('button', { name: '创建会话' }));
    await waitFor(() => expect(callsToPath(calls, '/sessions/init/')).toHaveLength(1));
    expect(postBodies(calls)[0]).toEqual({
      preset_id: 1,
      project_id: 0,
      thinking_level: 'auto',
      frozen_project_ids: [10, 20],
    });
  });

  it('g045 extension list excludes the primary project', async () => {
    const { calls } = installFetch(baseRoutes(initOk));
    renderApp(['/']);
    fireEvent.click((await screen.findAllByRole('button', { name: /新建会话/ }))[0]);
    const dialog = await chooseAgent(/Alessandro/);

    fireEvent.change(within(dialog).getByLabelText(/所属项目/), { target: { value: '20' } });
    const checkboxes = within(dialog).getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(1); // ProjB is primary → excluded
    fireEvent.click(checkboxes[0]); // selects ProjA

    fireEvent.click(within(dialog).getByRole('button', { name: '创建会话' }));
    await waitFor(() => expect(callsToPath(calls, '/sessions/init/')).toHaveLength(1));
    expect(postBodies(calls)[0]).toEqual({
      preset_id: 1,
      project_id: 20,
      thinking_level: 'auto',
      frozen_project_ids: [10],
    });
  });

  it('surfaces a 400 field error inside the dialog and keeps it open', async () => {
    const { calls } = installFetch(
      baseRoutes(() => jsonResponse({ preset_id: ['指定的预设ID不存在。'] }, 400)),
    );
    renderApp(['/']);
    fireEvent.click((await screen.findAllByRole('button', { name: /新建会话/ }))[0]);
    await chooseAgent(/Ecki/);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '创建会话' }));

    await waitFor(() => expect(callsToPath(calls, '/sessions/init/')).toHaveLength(1));
    expect(await screen.findByText('指定的预设ID不存在。')).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('shows a visible error banner on network failure', async () => {
    installFetch(
      baseRoutes(() => {
        throw new TypeError('Failed to fetch');
      }),
    );
    renderApp(['/']);
    fireEvent.click((await screen.findAllByRole('button', { name: /新建会话/ }))[0]);
    await chooseAgent(/Ecki/);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '创建会话' }));

    expect(await screen.findByText(/网络连接失败/)).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('blocks duplicate submits while the mutation is pending', async () => {
    let resolveInit: (r: Response) => void = () => {};
    const gate = new Promise<Response>((resolve) => {
      resolveInit = resolve;
    });
    const { calls } = installFetch(baseRoutes(() => gate));
    renderApp(['/']);
    fireEvent.click((await screen.findAllByRole('button', { name: /新建会话/ }))[0]);
    await chooseAgent(/Ecki/);

    const submit = within(screen.getByRole('dialog')).getByRole('button', { name: '创建会话' });
    fireEvent.click(submit);
    await waitFor(() => expect(callsToPath(calls, '/sessions/init/')).toHaveLength(1));
    expect(submit).toBeDisabled();
    fireEvent.click(submit);
    expect(callsToPath(calls, '/sessions/init/')).toHaveLength(1);

    resolveInit(initOk());
    expect(await screen.findByText('还没有消息')).toBeTruthy();
    expect(callsToPath(calls, '/sessions/init/')).toHaveLength(1);
  });

  it('missing Agent shows a visible required error and fires no request', async () => {
    const { calls } = installFetch(baseRoutes(initOk));
    renderApp(['/']);
    fireEvent.click((await screen.findAllByRole('button', { name: /新建会话/ }))[0]);
    const dialog = await openDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: '创建会话' }));

    expect(await screen.findByText('请选择一个 Agent')).toBeTruthy();
    expect(callsToPath(calls, '/sessions/init/')).toHaveLength(0);
  });

  it('malformed post-write envelope → terminal ambiguous-write lock: no second POST, Recent invalidated, dialog closable', async () => {
    // C1A-R2-01: 2xx write without a valid canonical id must never retry.
    const malformed = () =>
      jsonResponse({ msg: 'ok', data: { session_name: 'ghost' } }, 201);
    const { calls } = installFetch(baseRoutes(malformed));
    renderApp(['/']);
    fireEvent.click((await screen.findAllByRole('button', { name: /新建会话/ }))[0]);
    await chooseAgent(/Ecki/);
    const dialog = screen.getByRole('dialog');

    fireEvent.click(within(dialog).getByRole('button', { name: '创建会话' }));
    await waitFor(() => expect(callsToPath(calls, '/sessions/init/')).toHaveLength(1));

    // Explicit ambiguous message + permanently locked submit for this instance.
    expect(await screen.findByText(/结果不确定/)).toBeTruthy();
    const locked = within(dialog).getByRole('button', { name: '创建已锁定' });
    expect(locked).toBeDisabled();

    // Second click attempt cannot fire a second write.
    fireEvent.click(locked);
    fireEvent.click(within(dialog).getByRole('button', { name: '取消' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(callsToPath(calls, '/sessions/init/')).toHaveLength(1);

    // Recent was invalidated (refetch happened) but never used for identity.
    await waitFor(() =>
      expect(callsToPath(calls, '/conversations/').length).toBeGreaterThanOrEqual(2),
    );
    // No navigation to any detail route happened.
    expect(callsToPath(calls, '/conversations/88/')).toHaveLength(0);
  });
});
