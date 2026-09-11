import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProjectDeleteDialog } from '../features/projects/ProjectDeleteDialog';
import { controlQueryKeys } from '../features/chat/control/queries';
import { queryKeys } from '../features/chat/queries';
import {
  projectDeletePreviewQueryKey,
  projectKnowledgeQueryKeys,
} from '../features/projects/queries';
import {
  callsToPath,
  installFetch,
  jsonResponse,
  renderApp,
  unmockFetch,
  type MockRoute,
} from './helpers';

const STANDARD = {
  id: 5,
  name: 'Ecki',
  description: 'fast',
  agent_type: 'standard',
  default_model: null,
  system_prompt: null,
  is_visible: true,
};

const G045 = {
  id: 1,
  name: 'Alessandro',
  description: 'lead',
  agent_type: 'g045',
  default_model: null,
  system_prompt: null,
  is_visible: true,
};

const PROJECT = {
  id: 7,
  name: 'Alpha',
  description: 'project',
  prompt: '',
  work_dir: '',
  created_at: '2026-09-01T00:00:00Z',
};

const OTHER_PROJECT = {
  id: 8,
  name: 'Beta',
  description: null,
  prompt: null,
  work_dir: null,
  created_at: '2026-09-02T00:00:00Z',
};

function initOk() {
  return jsonResponse({
    msg: '会话已建立，权限已锁定。',
    data: { conversation_id: 88, session_id: 88, session_name: '新会话' },
  }, 201);
}

function projectRoutes(init: MockRoute['handler'] = initOk): MockRoute[] {
  return [
    { test: '/api/core/projects/7/', method: 'GET', handler: () => jsonResponse(PROJECT) },
    { test: '/api/core/projects/7/files/', method: 'GET', handler: () => jsonResponse([]) },
    { test: '/api/core/projects/', handler: () => jsonResponse([PROJECT, OTHER_PROJECT]) },
    { test: '/api/memory/knowledge/', handler: () => jsonResponse([]) },
    { test: '/api/agents/presets/', handler: () => jsonResponse([STANDARD, G045]) },
    { test: '/api/agents/conversations/', handler: () => jsonResponse([]) },
    { test: '/api/agents/sessions/init/', method: 'POST', handler: init },
    {
      test: '/api/agents/conversations/88/',
      handler: () => jsonResponse({
        id: 88,
        name: 'created',
        created_at: '2026-09-01T00:00:00Z',
        frozen_project_ids: [],
        project: 7,
        project_name: 'Alpha',
        agent_type: 'standard',
        agent_preset_id: 5,
        last_message_at: null,
        thinking_level: 'auto',
        memory_injection_enabled: null,
      }),
    },
    {
      test: /^\/api\/agents\/chat\/88\/$/,
      handler: () => jsonResponse({ messages: [], total_count: 0, has_more: false }),
    },
  ];
}

function sessionBodies(calls: { url: URL; init?: RequestInit }[]) {
  return callsToPath(calls, '/sessions/init/').map((call) => JSON.parse(String(call.init?.body)));
}

function noContent() {
  return new Response(null, { status: 204 });
}

function preview(files: Array<{ id: number; name: string; size: number }> = []) {
  return jsonResponse({
    conversations_to_archive: 2,
    files,
    files_total_size: files.reduce((total, file) => total + file.size, 0),
  });
}

function deferredResponse() {
  let resolve: (response: Response) => void = () => {};
  const promise = new Promise<Response>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

afterEach(() => unmockFetch());

describe('P2B Stage C fixed-Project canonical creation', () => {
  it('fixes the current Project, leaves Agent selectable, and navigates through canonical init', async () => {
    const { calls } = installFetch(projectRoutes());
    renderApp(['/projects/7']);

    fireEvent.click(await screen.findByRole('button', { name: '开始会话' }));
    const dialog = await screen.findByRole('dialog', { name: '新建会话' });
    expect(within(dialog).getByText('已固定为当前项目')).toBeInTheDocument();
    expect(within(dialog).getByText('Alpha')).toBeInTheDocument();
    expect(within(dialog).queryByText(/Drift/)).toBeNull();
    expect(within(dialog).queryByRole('combobox', { name: /所属项目/ })).toBeNull();
    expect(within(dialog).getByRole('radio', { name: /Ecki/ })).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('radio', { name: /Ecki/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: '创建会话' }));

    await waitFor(() => expect(sessionBodies(calls)).toHaveLength(1));
    expect(sessionBodies(calls)[0]).toEqual({
      preset_id: 5,
      project_id: 7,
      thinking_level: 'auto',
    });
    expect(await screen.findByText('还没有消息')).toBeInTheDocument();
    expect(callsToPath(calls, '/api/agents/conversations/88/').length).toBeGreaterThanOrEqual(1);
  });

  it('preserves g045 extension-Project selection while the primary Project is fixed', async () => {
    const { calls } = installFetch(projectRoutes());
    renderApp(['/projects/7']);

    fireEvent.click(await screen.findByRole('button', { name: '开始会话' }));
    const dialog = await screen.findByRole('dialog', { name: '新建会话' });
    fireEvent.click(within(dialog).getByRole('radio', { name: /Alessandro/ }));

    const extensions = within(dialog).getAllByRole('checkbox');
    expect(extensions).toHaveLength(1);
    expect(within(dialog).queryByRole('checkbox', { name: 'Alpha' })).toBeNull();
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Beta' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '创建会话' }));

    await waitFor(() => expect(sessionBodies(calls)).toHaveLength(1));
    expect(sessionBodies(calls)[0]).toEqual({
      preset_id: 1,
      project_id: 7,
      thinking_level: 'auto',
      frozen_project_ids: [8],
    });
  });

  it('captures Project and Agent at submit and suppresses late navigation after leaving the origin', async () => {
    const gate = deferredResponse();
    const { calls } = installFetch(projectRoutes(() => gate.promise));
    renderApp(['/projects/7']);

    fireEvent.click(await screen.findByRole('button', { name: '开始会话' }));
    const dialog = await screen.findByRole('dialog', { name: '新建会话' });
    fireEvent.click(within(dialog).getByRole('radio', { name: /Ecki/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: '创建会话' }));
    await waitFor(() => expect(sessionBodies(calls)).toHaveLength(1));

    fireEvent.click(screen.getByRole('link', { name: '项目 Hub' }));
    gate.resolve(initOk());

    await waitFor(() => expect(callsToPath(calls, '/api/agents/conversations/').length).toBeGreaterThanOrEqual(2));
    expect(sessionBodies(calls)[0]).toMatchObject({ preset_id: 5, project_id: 7 });
    expect(await screen.findByRole('heading', { name: '项目' })).toBeInTheDocument();
    expect(callsToPath(calls, '/api/agents/conversations/88/')).toHaveLength(0);
  });
});

describe('P2B Stage C preview-gated Project archival deletion', () => {
  function openDelete(routes: MockRoute[]) {
    const { calls } = installFetch(routes);
    renderApp(['/projects/7']);
    return { calls };
  }

  const detailReads: MockRoute[] = [
    { test: '/api/core/projects/7/', method: 'GET', handler: () => jsonResponse(PROJECT) },
    { test: '/api/core/projects/7/files/', method: 'GET', handler: () => jsonResponse([]) },
    { test: '/api/memory/knowledge/', handler: () => jsonResponse([]) },
    { test: '/api/agents/presets/', handler: () => jsonResponse([STANDARD]) },
    { test: '/api/agents/conversations/', handler: () => jsonResponse([]) },
    { test: '/api/core/projects/', handler: () => jsonResponse([PROJECT]) },
  ];

  it('requires a current preview and sends an explicit empty keep_file_ids array', async () => {
    const { calls } = openDelete([
      ...detailReads,
      { test: '/api/core/projects/7/delete-preview/', handler: () => preview() },
      { test: '/api/core/projects/7/', method: 'DELETE', handler: () => noContent() },
    ]);

    fireEvent.click(await screen.findByRole('button', { name: '删除项目' }));
    const dialog = await screen.findByRole('dialog', { name: '归档并删除项目' });
    expect(await within(dialog).findByText(/2 个直接关联会话将归档/)).toBeInTheDocument();
    expect(within(dialog).getByText(/不会被删除/)).toBeInTheDocument();
    expect(within(dialog).getByText(/不覆盖全部 Knowledge/)).toBeInTheDocument();
    expect(within(dialog).getByText(/所有 ProjectFile 数据行都会删除/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: '确认归档并删除' }));
    await waitFor(() => expect(calls.filter((call) => call.init?.method === 'DELETE')).toHaveLength(1));
    const deletion = calls.find((call) => call.init?.method === 'DELETE');
    expect(JSON.parse(String(deletion?.init?.body))).toEqual({ keep_file_ids: [] });
    expect(await screen.findByRole('heading', { name: '项目' })).toBeInTheDocument();
  });

  it('submits only selected numeric files from the current preview in preview order', async () => {
    const { calls } = openDelete([
      ...detailReads,
      {
        test: '/api/core/projects/7/delete-preview/',
        handler: () => preview([
          { id: 11, name: 'first.txt', size: 10 },
          { id: 12, name: 'second.txt', size: 20 },
        ]),
      },
      { test: '/api/core/projects/7/', method: 'DELETE', handler: () => noContent() },
    ]);

    fireEvent.click(await screen.findByRole('button', { name: '删除项目' }));
    const dialog = await screen.findByRole('dialog', { name: '归档并删除项目' });
    fireEvent.click(await within(dialog).findByRole('checkbox', { name: /second\.txt/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: '确认归档并删除' }));

    await waitFor(() => expect(calls.filter((call) => call.init?.method === 'DELETE')).toHaveLength(1));
    const deletion = calls.find((call) => call.init?.method === 'DELETE');
    expect(JSON.parse(String(deletion?.init?.body))).toEqual({ keep_file_ids: [12] });
  });

  it('reopening and replacing the preview both fetch fresh data and reset every recovery choice', async () => {
    let previewCount = 0;
    openDelete([
      ...detailReads,
      {
        test: '/api/core/projects/7/delete-preview/',
        handler: () => {
          previewCount += 1;
          return preview([{ id: previewCount, name: `file-${previewCount}.txt`, size: previewCount }]);
        },
      },
    ]);

    fireEvent.click(await screen.findByRole('button', { name: '删除项目' }));
    let dialog = await screen.findByRole('dialog', { name: '归档并删除项目' });
    const first = await within(dialog).findByRole('checkbox', { name: /file-1/ });
    fireEvent.click(first);
    expect(first).toBeChecked();

    fireEvent.click(within(dialog).getByRole('button', { name: '重新获取预览' }));
    const second = await within(dialog).findByRole('checkbox', { name: /file-2/ });
    expect(second).not.toBeChecked();
    expect(within(dialog).queryByText('file-1.txt')).toBeNull();

    fireEvent.click(within(dialog).getByRole('button', { name: '关闭' }));
    fireEvent.click(screen.getByRole('button', { name: '删除项目' }));
    dialog = await screen.findByRole('dialog', { name: '归档并删除项目' });
    const third = await within(dialog).findByRole('checkbox', { name: /file-3/ });
    expect(third).not.toBeChecked();
    expect(previewCount).toBe(3);
  });

  it('an older late preview cannot overwrite a newly opened confirmation session', async () => {
    const firstPreview = deferredResponse();
    let previewCount = 0;
    openDelete([
      ...detailReads,
      {
        test: '/api/core/projects/7/delete-preview/',
        handler: () => {
          previewCount += 1;
          return previewCount === 1
            ? firstPreview.promise
            : preview([{ id: 22, name: 'current.txt', size: 22 }]);
        },
      },
    ]);

    fireEvent.click(await screen.findByRole('button', { name: '删除项目' }));
    let dialog = await screen.findByRole('dialog', { name: '归档并删除项目' });
    expect(within(dialog).getByText('正在获取删除预览…')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: '关闭' }));

    fireEvent.click(screen.getByRole('button', { name: '删除项目' }));
    dialog = await screen.findByRole('dialog', { name: '归档并删除项目' });
    expect(await within(dialog).findByText('current.txt')).toBeInTheDocument();

    firstPreview.resolve(preview([{ id: 11, name: 'obsolete.txt', size: 11 }]));
    await waitFor(() => expect(within(dialog).queryByText('obsolete.txt')).toBeNull());
    expect(within(dialog).getByText('current.txt')).toBeInTheDocument();
  });

  it('a malformed preview is an explicit failure and can never enable DELETE', async () => {
    const { calls } = openDelete([
      ...detailReads,
      { test: '/api/core/projects/7/delete-preview/', handler: () => jsonResponse({ files: [{ id: 'kf_9' }] }) },
    ]);

    fireEvent.click(await screen.findByRole('button', { name: '删除项目' }));
    const dialog = await screen.findByRole('dialog', { name: '归档并删除项目' });
    expect(await within(dialog).findByText(/删除预览接口返回格式异常/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: '确认归档并删除' })).toBeDisabled();
    expect(calls.filter((call) => call.init?.method === 'DELETE')).toHaveLength(0);
  });

  it('manual failed replacements revoke old preview authority through repeated failure, then a fresh success restores it unselected', async () => {
    let previewCount = 0;
    const { calls } = openDelete([
      ...detailReads,
      {
        test: '/api/core/projects/7/delete-preview/',
        handler: () => {
          previewCount += 1;
          if (previewCount === 1) return preview([{ id: 11, name: 'old.txt', size: 11 }]);
          if (previewCount <= 3) {
            return jsonResponse({ error: `preview failed ${previewCount}`, code: 'preview_unavailable' }, 503);
          }
          return preview([{ id: 22, name: 'fresh.txt', size: 22 }]);
        },
      },
      { test: '/api/core/projects/7/', method: 'DELETE', handler: () => noContent() },
    ]);

    fireEvent.click(await screen.findByRole('button', { name: '删除项目' }));
    const dialog = await screen.findByRole('dialog', { name: '归档并删除项目' });
    fireEvent.click(await within(dialog).findByRole('checkbox', { name: /old\.txt/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: '重新获取预览' }));

    expect(await within(dialog).findByText(/preview failed 2/)).toBeInTheDocument();
    let confirm = within(dialog).getByRole('button', { name: '确认归档并删除' });
    expect(confirm).toBeDisabled();
    fireEvent.click(confirm);
    expect(calls.filter((call) => call.init?.method === 'DELETE')).toHaveLength(0);

    fireEvent.click(within(dialog).getByRole('button', { name: '重试预览' }));
    expect(await within(dialog).findByText(/preview failed 3/)).toBeInTheDocument();
    confirm = within(dialog).getByRole('button', { name: '确认归档并删除' });
    expect(confirm).toBeDisabled();
    expect(calls.filter((call) => call.init?.method === 'DELETE')).toHaveLength(0);

    fireEvent.click(within(dialog).getByRole('button', { name: '重试预览' }));
    const freshChoice = await within(dialog).findByRole('checkbox', { name: /fresh\.txt/ });
    expect(freshChoice).not.toBeChecked();
    expect(within(dialog).queryByText('old.txt')).toBeNull();
    confirm = within(dialog).getByRole('button', { name: '确认归档并删除' });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    await waitFor(() => expect(calls.filter((call) => call.init?.method === 'DELETE')).toHaveLength(1));
    const deletion = calls.find((call) => call.init?.method === 'DELETE');
    expect(JSON.parse(String(deletion?.init?.body))).toEqual({ keep_file_ids: [] });
  });

  it('query-driven malformed replacement cannot use retained data and a later success resets old choices', async () => {
    let previewCount = 0;
    const { calls } = installFetch([
      {
        test: '/api/core/projects/7/delete-preview/',
        handler: () => {
          previewCount += 1;
          if (previewCount === 1) return preview([{ id: 11, name: 'old.txt', size: 11 }]);
          if (previewCount === 2) {
            return jsonResponse({
              conversations_to_archive: 1,
              files: [{ id: 'kf_11', name: 'invalid.txt', size: 1 }],
              files_total_size: 1,
            });
          }
          return preview([{ id: 22, name: 'fresh.txt', size: 22 }]);
        },
      },
    ]);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <ProjectDeleteDialog
          project={{ id: 7, name: 'Alpha' }}
          sessionId={91}
          onClose={() => undefined}
          onDeleted={() => undefined}
        />
      </QueryClientProvider>,
    );

    const dialog = await screen.findByRole('dialog', { name: '归档并删除项目' });
    fireEvent.click(await within(dialog).findByRole('checkbox', { name: /old\.txt/ }));
    await act(async () => {
      await queryClient.refetchQueries({
        queryKey: projectDeletePreviewQueryKey(7, 91),
        exact: true,
      });
    });

    expect(await within(dialog).findByText(/删除预览包含异常文件/)).toBeInTheDocument();
    let confirm = within(dialog).getByRole('button', { name: '确认归档并删除' });
    expect(confirm).toBeDisabled();
    fireEvent.click(confirm);
    expect(calls.filter((call) => call.init?.method === 'DELETE')).toHaveLength(0);

    await act(async () => {
      await queryClient.refetchQueries({
        queryKey: projectDeletePreviewQueryKey(7, 91),
        exact: true,
      });
    });
    const freshChoice = await within(dialog).findByRole('checkbox', { name: /fresh\.txt/ });
    expect(freshChoice).not.toBeChecked();
    confirm = within(dialog).getByRole('button', { name: '确认归档并删除' });
    expect(confirm).toBeEnabled();
  });

  it('blocks duplicate pending deletion; ordinary failure stays on Project and never auto-retries', async () => {
    const gate = deferredResponse();
    const { calls } = openDelete([
      ...detailReads,
      { test: '/api/core/projects/7/delete-preview/', handler: () => preview() },
      { test: '/api/core/projects/7/', method: 'DELETE', handler: () => gate.promise },
    ]);

    fireEvent.click(await screen.findByRole('button', { name: '删除项目' }));
    const dialog = await screen.findByRole('dialog', { name: '归档并删除项目' });
    const submit = await within(dialog).findByRole('button', { name: '确认归档并删除' });
    fireEvent.click(submit);
    await waitFor(() => expect(calls.filter((call) => call.init?.method === 'DELETE')).toHaveLength(1));
    expect(within(dialog).getByRole('button', { name: '正在删除…' })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole('button', { name: '正在删除…' }));
    expect(calls.filter((call) => call.init?.method === 'DELETE')).toHaveLength(1);

    gate.resolve(jsonResponse({ error: 'Archive unavailable', code: 'archive_dependency_missing' }, 503));
    expect(await within(dialog).findByText(/Archive unavailable（archive_dependency_missing）/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Alpha' })).toBeInTheDocument();
    expect(calls.filter((call) => call.init?.method === 'DELETE')).toHaveLength(1);
  });

  it('file_rollback_failed adds the stronger manual filesystem inspection warning', async () => {
    openDelete([
      ...detailReads,
      { test: '/api/core/projects/7/delete-preview/', handler: () => preview() },
      {
        test: '/api/core/projects/7/',
        method: 'DELETE',
        handler: () => jsonResponse({ error: 'restore failed', code: 'file_rollback_failed' }, 409),
      },
    ]);

    fireEvent.click(await screen.findByRole('button', { name: '删除项目' }));
    const dialog = await screen.findByRole('dialog', { name: '归档并删除项目' });
    fireEvent.click(await within(dialog).findByRole('button', { name: '确认归档并删除' }));
    expect(await within(dialog).findByText(/手动检查服务器文件系统/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Alpha' })).toBeInTheDocument();
  });

  it('marks every existing affected canonical cache stale before invoking post-204 navigation', async () => {
    installFetch([
      { test: '/api/core/projects/7/delete-preview/', handler: () => preview() },
      { test: '/api/core/projects/7/', method: 'DELETE', handler: () => noContent() },
    ]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const conversation = {
      id: 31,
      name: 'owned',
      projectId: 7,
      projectName: 'Alpha',
      agentType: 'standard',
      agentPresetId: 5,
      createdAt: 't',
      lastMessageAt: null,
      thinkingLevel: null,
      memoryInjectionEnabled: null,
    };
    const affectedKeys = [
      queryKeys.projects,
      queryKeys.conversations,
      controlQueryKeys.projectDetail(7),
      controlQueryKeys.projectFiles(7),
      projectKnowledgeQueryKeys.projectKnowledge(7),
      controlQueryKeys.projectTreeRoot(7),
      controlQueryKeys.projectTreeLevels(7),
      controlQueryKeys.projectTreeLevel(7, 'src'),
      queryKeys.conversation(31),
      controlQueryKeys.cache(31),
    ] as const;
    client.setQueryData(queryKeys.projects, [PROJECT]);
    client.setQueryData(queryKeys.conversations, [conversation]);
    client.setQueryData(controlQueryKeys.projectDetail(7), PROJECT);
    client.setQueryData(controlQueryKeys.projectFiles(7), []);
    client.setQueryData(projectKnowledgeQueryKeys.projectKnowledge(7), []);
    client.setQueryData(controlQueryKeys.projectTreeRoot(7), { path: '', entries: [] });
    client.setQueryData(controlQueryKeys.projectTreeLevels(7), {});
    client.setQueryData(controlQueryKeys.projectTreeLevel(7, 'src'), { path: 'src', entries: [] });
    client.setQueryData(queryKeys.conversation(31), conversation);
    client.setQueryData(controlQueryKeys.cache(31), { status: 'active' });
    client.setQueryData(controlQueryKeys.projectDetail(8), OTHER_PROJECT);

    const observed = vi.fn(() => affectedKeys.map((key) => client.getQueryState(key)?.isInvalidated));
    render(
      <QueryClientProvider client={client}>
        <ProjectDeleteDialog
          project={{ id: 7, name: 'Alpha' }}
          sessionId={1}
          onClose={() => {}}
          onDeleted={observed}
        />
      </QueryClientProvider>,
    );

    const dialog = await screen.findByRole('dialog', { name: '归档并删除项目' });
    fireEvent.click(await within(dialog).findByRole('button', { name: '确认归档并删除' }));
    await waitFor(() => expect(observed).toHaveBeenCalledTimes(1));
    expect(observed.mock.results[0].value).toEqual(affectedKeys.map(() => true));
    expect(client.getQueryState(controlQueryKeys.projectDetail(8))?.isInvalidated).toBe(false);
  });
});
