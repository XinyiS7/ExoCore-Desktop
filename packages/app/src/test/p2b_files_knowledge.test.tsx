import { afterEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { installFetch, jsonResponse, unmockFetch, type MockRoute } from './helpers';
import { ProjectDetailPage } from '../features/projects/ProjectDetailPage';
import { ProjectFilesSection } from '../features/projects/ProjectFilesSection';
import { ProjectKnowledgeSection } from '../features/projects/ProjectKnowledgeSection';

// ── fixtures ───────────────────────────────────────────────────────────────

const PROJ_7_DETAIL = {
  id: 7,
  name: 'Alpha',
  description: 'alpha project',
  prompt: 'alpha prompt',
  work_dir: 'D:\\alpha',
  created_at: '2026-07-01T00:00:00Z',
};

const UPLOADED_FILE = {
  id: 11,
  name: 'guide.pdf',
  file_type: 'pdf',
  size: 2048,
  url: 'http://x/f.pdf',
  preview_url: null,
  source: 'web_upload',
  created_at: '2026-08-01T00:00:00Z',
};

const SYNCED_FILE = {
  id: 'kf_42',
  name: 'note.md',
  file_type: 'text/markdown',
  size: 0,
  file: null,
  source: 'obsidian_sync',
  created_at: '2026-08-02T00:00:00Z',
};

const KNOWLEDGE_ROW = {
  id: 7,
  uid: 'u7',
  title: 'Alpha 知识',
  topic: 'project',
  status: 'active',
  source_type: 'obsidian_md',
  tags: ['deep', 'note'],
  keywords: ['alpha', 'beta'],
  abstract: '这是摘要内容。',
  project: 7,
  created_at: '2026-08-03T00:00:00Z',
  updated_at: '2026-08-04T00:00:00Z',
};

function detailRoutes(over: {
  files?: MockRoute['handler'];
  knowledge?: MockRoute['handler'];
  detail?: MockRoute['handler'];
} = {}): MockRoute[] {
  return [
    { test: '/api/agents/presets/', handler: () => jsonResponse([]) },
    { test: '/api/agents/conversations/', handler: () => jsonResponse([]) },
    { test: '/api/core/projects/7/', handler: over.detail ?? (() => jsonResponse(PROJ_7_DETAIL)) },
    { test: '/api/core/projects/7/files/', handler: over.files ?? (() => jsonResponse([UPLOADED_FILE, SYNCED_FILE])) },
    { test: '/api/memory/knowledge/', handler: over.knowledge ?? (() => jsonResponse([KNOWLEDGE_ROW])) },
  ];
}

function getCalls(calls: { url: URL; init?: RequestInit }[], pathPart: string) {
  return calls.filter((c) => (c.init?.method ?? 'GET') === 'GET' && c.url.pathname.includes(pathPart));
}

function getKnowledgeGets(calls: { url: URL; init?: RequestInit }[], projectId = 7) {
  return calls.filter(
    (c) =>
      (c.init?.method ?? 'GET') === 'GET' &&
      c.url.pathname === '/api/memory/knowledge/' &&
      c.url.searchParams.get('project') === String(projectId),
  );
}

function renderProject(projectId = 7) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
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

afterEach(() => unmockFetch());

// ── Files: mixed rows, labels, independence ────────────────────────────────

describe('P2B workspace Files (Plan §6.3, D3/D6)', () => {
  it('renders mixed numeric + kf_ rows with source labels and NO open/download affordance', async () => {
    installFetch(detailRoutes());
    renderProject();
    expect(await screen.findByText('项目文件')).toBeTruthy();
    expect(await screen.findByText('guide.pdf')).toBeTruthy();
    expect(screen.getByText('Web 上传')).toBeTruthy();
    expect(screen.getByText('note.md')).toBeTruthy();
    expect(screen.getByText('Obsidian 同步')).toBeTruthy();
    // synced rows state plainly that no physical browser file is available (D6)
    expect(screen.getByText('Obsidian 同步引用，无本地浏览器文件')).toBeTruthy();
    // no open/download/preview controls at all
    expect(screen.queryByRole('button', { name: /打开|下载|预览/ })).toBeNull();
  });

  it('unknown or ID-inconsistent source labels render neutrally without rejecting the row (D3)', async () => {
    installFetch(
      detailRoutes({
        files: () =>
          jsonResponse([
            { ...SYNCED_FILE, source: 'web_upload' }, // ID-inconsistent
            { ...UPLOADED_FILE, source: 'future_label_v9' }, // unknown source
          ]),
      }),
    );
    renderProject();
    expect(await screen.findByText('guide.pdf')).toBeTruthy();
    expect(screen.getByText('note.md')).toBeTruthy();
    // both rows render under the NEUTRAL reference label; nothing crashed
    expect(screen.getAllByText('引用文件').length).toBeGreaterThanOrEqual(2);
  });

  it('malformed top-level files response is a Files-only contract error (independent surfaces, §5.6)', async () => {
    installFetch(
      detailRoutes({
        files: () => jsonResponse({ count: 1 }), // envelope shape = contract error
      }),
    );
    renderProject();
    expect(await screen.findByText('文件加载失败')).toBeTruthy();
    // Knowledge is NOT erased by the Files failure
    expect(screen.getByText('Alpha 知识')).toBeTruthy();
    // no invented pagination pole rendered
    expect(screen.queryByText(/下一页|第 \d+ \/ \d+ 页/)).toBeNull();
  });

  it('a Files network failure keeps Knowledge visible; a Knowledge failure does not claim empty', async () => {
    installFetch(
      detailRoutes({
        files: () => jsonResponse({ error: 'boom' }, 500),
        knowledge: () => jsonResponse([], 200),
      }),
    );
    renderProject();
    expect(await screen.findByText('文件加载失败')).toBeTruthy();
    // a TRUE knowledge empty is an explicit empty, not an error
    expect(screen.getByText('暂无项目知识')).toBeTruthy();
  });

  it('Knowledge failure is an explicit error, never "no knowledge"', async () => {
    installFetch(
      detailRoutes({ knowledge: () => jsonResponse({ error: 'down' }, 500) }),
    );
    renderProject();
    expect(await screen.findByText('项目知识加载失败')).toBeTruthy();
    expect(screen.queryByText('暂无项目知识')).toBeNull();
    expect(screen.getByText('guide.pdf')).toBeTruthy(); // Files unaffected
  });
});

// ── Upload + dual mounted-consumer refresh ─────────────────────────────────

describe('P2B file upload (multipart, Plan §6.3 / §8.5)', () => {
  it('upload POSTs the existing multipart contract and refreshes BOTH mounted Files and Knowledge lists', async () => {
    let filesServer: unknown[] = [UPLOADED_FILE, SYNCED_FILE];
    let knowledgeServer: unknown[] = [KNOWLEDGE_ROW];
    const { calls } = installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([]) },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([]) },
      { test: '/api/core/projects/7/', handler: () => jsonResponse(PROJ_7_DETAIL) },
      {
        test: '/api/core/projects/7/files/',
        method: 'POST',
        handler: () => {
          // ingestion side effect: a new file row AND a knowledge fragment
          filesServer = [
            UPLOADED_FILE,
            SYNCED_FILE,
            { id: 77, name: 'readme.txt', file_type: 'text/plain', size: 5, url: 'http://x/r.txt', preview_url: null, source: 'web_upload', created_at: 't' },
          ];
          knowledgeServer = [
            KNOWLEDGE_ROW,
            { id: 8, uid: 'u8', title: 'readme 知识', topic: 'project', status: 'active', source_type: 'web_upload', tags: [], keywords: [], abstract: '读取自 readme.txt', project: 7, created_at: 't', updated_at: 't' },
          ];
          return jsonResponse({ id: 77, name: 'readme.txt', file_type: 'text/plain', size: 5, url: 'http://x/r.txt', preview_url: null, created_at: 't' }, 201);
        },
      },
      { test: '/api/core/projects/7/files/', handler: () => jsonResponse(filesServer) },
      { test: '/api/memory/knowledge/', handler: () => jsonResponse(knowledgeServer) },
    ]);
    renderProject();
    await screen.findByText('guide.pdf');

    fireEvent.change(screen.getByLabelText('选择要上传的文件'), {
      target: { files: [new File(['x'], 'readme.txt', { type: 'text/plain' })] },
    });

    // both mounted consumers refresh WITHOUT navigation or remount (CP2)
    expect(await screen.findByText('readme.txt')).toBeTruthy();
    expect(await screen.findByText('readme 知识')).toBeTruthy();
    expect(getKnowledgeGets(calls).length).toBe(2);
    expect(getCalls(calls, '/api/core/projects/7/files/').length).toBe(2);
    // the POST carried a multipart FormData with the real file name
    const post = calls.find((c) => c.init?.method === 'POST');
    expect(post?.init?.body).toBeInstanceOf(FormData);
    expect((post?.init?.body as FormData).get('file')).toBeInstanceOf(File);
  });

  it('upload failure shows the backend error, keeps both lists untouched (no refetch)', async () => {
    const { calls } = installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([]) },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([]) },
      { test: '/api/core/projects/7/', handler: () => jsonResponse(PROJ_7_DETAIL) },
      {
        test: '/api/core/projects/7/files/',
        method: 'POST',
        handler: () => jsonResponse({ error: 'A file upload is required.', code: 'file_required' }, 400),
      },
      { test: '/api/core/projects/7/files/', handler: () => jsonResponse([UPLOADED_FILE]) },
      { test: '/api/memory/knowledge/', handler: () => jsonResponse([KNOWLEDGE_ROW]) },
    ]);
    renderProject();
    await screen.findByText('guide.pdf');

    fireEvent.change(screen.getByLabelText('选择要上传的文件'), {
      target: { files: [new File(['x'], 'bad.txt', { type: 'text/plain' })] },
    });

    expect(
      await screen.findByText(/A file upload is required\.（file_required）/),
    ).toBeTruthy();
    // definite 400: neither list refetched
    await waitFor(() => expect(getCalls(calls, '/api/core/projects/7/files/').length).toBe(1));
    expect(getKnowledgeGets(calls).length).toBe(1);
  });

  it('ambiguous 2xx upload still refreshes both lists (write may have landed)', async () => {
    const { calls } = installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([]) },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([]) },
      { test: '/api/core/projects/7/', handler: () => jsonResponse(PROJ_7_DETAIL) },
      {
        test: '/api/core/projects/7/files/',
        method: 'POST',
        handler: () => jsonResponse('ok', 200), // non-object 2xx → ambiguous
      },
      { test: '/api/core/projects/7/files/', handler: () => jsonResponse([UPLOADED_FILE]) },
      { test: '/api/memory/knowledge/', handler: () => jsonResponse([KNOWLEDGE_ROW]) },
    ]);
    renderProject();
    await screen.findByText('guide.pdf');

    fireEvent.change(screen.getByLabelText('选择要上传的文件'), {
      target: { files: [new File(['x'], 'amb.txt', { type: 'text/plain' })] },
    });

    expect(
      await screen.findByText('文件已提交，但返回内容无法确认；请刷新文件列表确认。'),
    ).toBeTruthy();
    // ambiguous write → dual invalidation still ran
    await waitFor(() => expect(getCalls(calls, '/api/core/projects/7/files/').length).toBe(2));
    expect(getKnowledgeGets(calls).length).toBe(2);
  });
});

// ── Delete: both paths, dual refresh, failure retention ───────────────────

describe('P2B file deletion (numeric and kf_ paths, Plan §6.3/§8.5)', () => {
  it('numeric delete confirms name+source, hits files/<id>/ and refreshes both sections', async () => {
    let deleteDone = false;
    const knowledgeServer: unknown[] = [KNOWLEDGE_ROW];
    const { calls } = installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([]) },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([]) },
      { test: '/api/core/projects/7/', handler: () => jsonResponse(PROJ_7_DETAIL) },
      {
        test: '/api/core/projects/7/files/11/',
        method: 'DELETE',
        handler: () => {
          deleteDone = true;
          return new Response(null, { status: 204 });
        },
      },
      {
        test: '/api/core/projects/7/files/',
        handler: () => jsonResponse(deleteDone ? [SYNCED_FILE] : [UPLOADED_FILE, SYNCED_FILE]),
      },
      { test: '/api/memory/knowledge/', handler: () => jsonResponse(knowledgeServer) },
    ]);
    renderProject();
    await screen.findByText('guide.pdf');

    const fileRow = screen.getByText('guide.pdf').closest('li') as HTMLElement;
    fireEvent.click(within(fileRow).getByRole('button', { name: /删除/ }));
    const dialog = await screen.findByRole('dialog', { name: '删除文件' });
    expect(within(dialog).getByText(/「guide.pdf」（Web 上传）/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: '确认删除' }));

    await waitFor(() => expect(screen.queryByText('guide.pdf')).toBeNull());
    expect(screen.getByText('note.md')).toBeTruthy(); // synced row retained
    // backend call is the exact nested numeric endpoint
    expect(calls.some((c) => c.url.pathname === '/api/core/projects/7/files/11/' && c.init?.method === 'DELETE')).toBe(true);
    // BOTH families refetched
    await waitFor(() => expect(getCalls(calls, '/api/core/projects/7/files/').length).toBe(2));
    expect(getKnowledgeGets(calls).length).toBe(2);
  });

  it('kf_ delete passes the string id verbatim to the nested endpoint and refreshes both sections', async () => {
    let deleteDone = false;
    const { calls } = installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([]) },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([]) },
      { test: '/api/core/projects/7/', handler: () => jsonResponse(PROJ_7_DETAIL) },
      {
        test: '/api/core/projects/7/files/kf_42/',
        method: 'DELETE',
        handler: () => {
          deleteDone = true;
          return new Response(null, { status: 204 });
        },
      },
      {
        test: '/api/core/projects/7/files/',
        handler: () => jsonResponse(deleteDone ? [UPLOADED_FILE] : [UPLOADED_FILE, SYNCED_FILE]),
      },
      { test: '/api/memory/knowledge/', handler: () => jsonResponse([KNOWLEDGE_ROW]) },
    ]);
    renderProject();
    await screen.findByText('note.md');

    const row = screen.getByText('note.md').closest('li') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: /删除/ }));
    const dialog = await screen.findByRole('dialog', { name: '删除文件' });
    expect(within(dialog).getByText(/「note.md」（Obsidian 同步）/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: '确认删除' }));

    await waitFor(() => expect(screen.queryByText('note.md')).toBeNull());
    expect(screen.getByText('guide.pdf')).toBeTruthy();
    expect(
      calls.some((c) => c.url.pathname === '/api/core/projects/7/files/kf_42/' && c.init?.method === 'DELETE'),
    ).toBe(true);
    await waitFor(() => expect(getCalls(calls, '/api/core/projects/7/files/').length).toBe(2));
    expect(getKnowledgeGets(calls).length).toBe(2);
  });

  it('delete failure shows the backend outcome, retains the row and does not refetch Knowledge', async () => {
    const { calls } = installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([]) },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([]) },
      { test: '/api/core/projects/7/', handler: () => jsonResponse(PROJ_7_DETAIL) },
      {
        test: '/api/core/projects/7/files/11/',
        method: 'DELETE',
        handler: () =>
          jsonResponse({ error: 'Project file does not exist.', code: 'project_file_not_found' }, 404),
      },
      { test: '/api/core/projects/7/files/', handler: () => jsonResponse([UPLOADED_FILE]) },
      { test: '/api/memory/knowledge/', handler: () => jsonResponse([KNOWLEDGE_ROW]) },
    ]);
    renderProject();
    await screen.findByText('guide.pdf');

    const fileRow = screen.getByText('guide.pdf').closest('li') as HTMLElement;
    fireEvent.click(within(fileRow).getByRole('button', { name: /删除/ }));
    const dialog = await screen.findByRole('dialog', { name: '删除文件' });
    fireEvent.click(within(dialog).getByRole('button', { name: '确认删除' }));

    expect(
      await screen.findByText(/Project file does not exist\.（project_file_not_found）/),
    ).toBeTruthy();
    expect(screen.getByText('guide.pdf')).toBeTruthy(); // row retained
    // failure keeps both displayed truths: no knowledge refetch
    expect(getKnowledgeGets(calls).length).toBe(1);
    expect(getCalls(calls, '/api/core/projects/7/files/').length).toBe(1);
  });
});

// ── Knowledge: list, editing, honest claims ────────────────────────────────

describe('P2B Project Knowledge (D2, Plan §6.4/§8.6)', () => {
  it('renders list rows (title/source/tags/keywords/abstract) separate from Files', async () => {
    installFetch(detailRoutes());
    renderProject();
    expect(await screen.findByText('Alpha 知识')).toBeTruthy();
    expect(screen.getByText('Obsidian')).toBeTruthy();
    expect(screen.getByText('deep')).toBeTruthy();
    expect(screen.getByText('alpha')).toBeTruthy();
    expect(screen.getByText('这是摘要内容。')).toBeTruthy();
  });

  it('abstract+keywords edit: PATCH both fields; success claims only saved + background index STARTED', async () => {
    let patchDone = false;
    const { calls } = installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([]) },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([]) },
      { test: '/api/core/projects/7/', handler: () => jsonResponse(PROJ_7_DETAIL) },
      { test: '/api/core/projects/7/files/', handler: () => jsonResponse([UPLOADED_FILE]) },
      {
        test: '/api/memory/knowledge/7/',
        method: 'PATCH',
        handler: () => {
          patchDone = true;
          return jsonResponse({ msg: '已保存。', updated: ['abstract', 'keywords'] });
        },
      },
      {
        test: '/api/memory/knowledge/',
        handler: () =>
          jsonResponse(
            patchDone
              ? [{ ...KNOWLEDGE_ROW, abstract: '新摘要。', keywords: ['alpha', 'beta', 'gamma'] }]
              : [KNOWLEDGE_ROW],
          ),
      },
    ]);
    renderProject();
    await screen.findByText('Alpha 知识');

    const knowledgeRow = screen.getByText('Alpha 知识').closest('li') as HTMLElement;
    fireEvent.click(within(knowledgeRow).getByRole('button', { name: /编辑/ }));
    const dialog = await screen.findByRole('dialog', { name: '编辑知识摘要' });
    const summary = within(dialog).getByLabelText('摘要');
    expect(summary).toHaveValue('这是摘要内容。');
    // stored entries are ATOMIC chips, verbatim (B02/R4)
    expect(within(dialog).getByText('alpha')).toBeTruthy();
    expect(within(dialog).getByText('beta')).toBeTruthy();
    fireEvent.change(summary, { target: { value: '新摘要。' } });
    // one append = one literal keyword
    fireEvent.change(within(dialog).getByLabelText('新增关键词'), { target: { value: 'gamma' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '追加' }));
    expect(within(dialog).getByText('gamma')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: '保存' }));

    // honest success claim: saved + background refresh started, nothing complete
    expect(
      await within(dialog).findByText('已保存。后台索引刷新已启动，将在后台完成。'),
    ).toBeTruthy();
    expect(within(dialog).queryByText(/重向量化/)).toBeNull();
    const patch = calls.find((c) => c.url.pathname === '/api/memory/knowledge/7/');
    expect(JSON.parse(String(patch?.init?.body))).toEqual({
      abstract: '新摘要。',
      keywords: ['alpha', 'beta', 'gamma'],
    });
    // list refetched server truth
    fireEvent.click(within(dialog).getByRole('button', { name: '完成' }));
    await waitFor(() => expect(screen.getByText('新摘要。')).toBeTruthy());
    expect(getKnowledgeGets(calls).length).toBe(2);
  });

  it('keyword-only change makes NO embedding/indexing claim', async () => {
    const { calls } = installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([]) },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([]) },
      { test: '/api/core/projects/7/', handler: () => jsonResponse(PROJ_7_DETAIL) },
      { test: '/api/core/projects/7/files/', handler: () => jsonResponse([UPLOADED_FILE]) },
      { test: '/api/memory/knowledge/7/', method: 'PATCH', handler: () => jsonResponse({ msg: '已保存。', updated: ['keywords'] }) },
      { test: '/api/memory/knowledge/', handler: () => jsonResponse([KNOWLEDGE_ROW]) },
    ]);
    renderProject();
    await screen.findByText('Alpha 知识');

    const knowledgeRow = screen.getByText('Alpha 知识').closest('li') as HTMLElement;
    fireEvent.click(within(knowledgeRow).getByRole('button', { name: /编辑/ }));
    const dialog = await screen.findByRole('dialog', { name: '编辑知识摘要' });
    fireEvent.change(within(dialog).getByLabelText('新增关键词'), { target: { value: 'gamma' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '追加' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '保存' }));

    expect(await within(dialog).findByText('已保存。')).toBeTruthy();
    expect(within(dialog).queryByText(/后台|索引|重向量化/)).toBeNull();
    const patch = calls.find((c) => c.url.pathname === '/api/memory/knowledge/7/');
    expect(JSON.parse(String(patch?.init?.body))).toEqual({ keywords: ['alpha', 'beta', 'gamma'] });
    expect(getKnowledgeGets(calls).length).toBe(2);
  });

  it('ordinary PATCH failure preserves editor input and prior displayed truth', async () => {
    const { calls } = installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([]) },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([]) },
      { test: '/api/core/projects/7/', handler: () => jsonResponse(PROJ_7_DETAIL) },
      { test: '/api/core/projects/7/files/', handler: () => jsonResponse([UPLOADED_FILE]) },
      {
        test: '/api/memory/knowledge/7/',
        method: 'PATCH',
        handler: () => jsonResponse({ error: 'keywords 必须是数组' }, 400),
      },
      { test: '/api/memory/knowledge/', handler: () => jsonResponse([KNOWLEDGE_ROW]) },
    ]);
    renderProject();
    await screen.findByText('Alpha 知识');

    const knowledgeRow = screen.getByText('Alpha 知识').closest('li') as HTMLElement;
    fireEvent.click(within(knowledgeRow).getByRole('button', { name: /编辑/ }));
    const dialog = await screen.findByRole('dialog', { name: '编辑知识摘要' });
    fireEvent.change(within(dialog).getByLabelText('摘要'), { target: { value: '永失我名' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '保存' }));

    expect(await within(dialog).findByText('keywords 必须是数组')).toBeTruthy();
    expect(within(dialog).getByLabelText('摘要')).toHaveValue('永失我名'); // input retained
    expect(within(dialog).getByRole('button', { name: '保存' })).not.toBeDisabled();
    // prior displayed truth unchanged, no refetch
    expect(screen.getByText('这是摘要内容。')).toBeTruthy();
    expect(getKnowledgeGets(calls).length).toBe(1);
  });

  it('ambiguous 2xx PATCH re-reads knowledge list (write may have landed)', async () => {
    const { calls } = installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([]) },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([]) },
      { test: '/api/core/projects/7/', handler: () => jsonResponse(PROJ_7_DETAIL) },
      { test: '/api/core/projects/7/files/', handler: () => jsonResponse([UPLOADED_FILE]) },
      { test: '/api/memory/knowledge/7/', method: 'PATCH', handler: () => jsonResponse({ unrecognized: true }) },
      { test: '/api/memory/knowledge/', handler: () => jsonResponse([KNOWLEDGE_ROW]) },
    ]);
    renderProject();
    await screen.findByText('Alpha 知识');

    const knowledgeRow = screen.getByText('Alpha 知识').closest('li') as HTMLElement;
    fireEvent.click(within(knowledgeRow).getByRole('button', { name: /编辑/ }));
    const dialog = await screen.findByRole('dialog', { name: '编辑知识摘要' });
    fireEvent.change(within(dialog).getByLabelText('摘要'), { target: { value: 'maybe landed' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '保存' }));

    expect(
      await within(dialog).findByText('摘要已保存，但返回内容无法确认；已重新读取知识列表。'),
    ).toBeTruthy();
    await waitFor(() => expect(getKnowledgeGets(calls).length).toBe(2));
  });

  it('no-change save closes without any PATCH or refetch', async () => {
    const { calls } = installFetch(detailRoutes());
    renderProject();
    await screen.findByText('Alpha 知识');
    const knowledgeRow = screen.getByText('Alpha 知识').closest('li') as HTMLElement;
    fireEvent.click(within(knowledgeRow).getByRole('button', { name: /编辑/ }));
    const dialog = await screen.findByRole('dialog', { name: '编辑知识摘要' });
    fireEvent.click(within(dialog).getByRole('button', { name: '保存' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(getKnowledgeGets(calls).length).toBe(1);
    expect(calls.filter((c) => c.init?.method === 'PATCH')).toHaveLength(0);
  });
});

// ── Stale-origin: knowledge write settling across a route switch (F01 rule) ─

describe('P2B Knowledge write isolation across route switches (Plan §8.6, F01 rule)', () => {
  function deferredResponse() {
    let resolve!: (value: Response) => void;
    const promise = new Promise<Response>((r) => (resolve = r));
    return { promise, resolve };
  }

  it('a Knowledge PATCH settling after switching A→B refreshes Project A only, never B', async () => {
    const patchSlow = deferredResponse();
    const { calls } = installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([]) },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([]) },
      { test: '/api/core/projects/7/', handler: () => jsonResponse(PROJ_7_DETAIL) },
      { test: '/api/core/projects/8/', handler: () => jsonResponse({ ...PROJ_7_DETAIL, id: 8, name: 'Beta' }) },
      { test: '/api/core/projects/7/files/', handler: () => jsonResponse([UPLOADED_FILE]) },
      { test: '/api/core/projects/8/files/', handler: () => jsonResponse([]) },
      { test: '/api/memory/knowledge/7/', method: 'PATCH', handler: () => patchSlow.promise },
      { test: '/api/memory/knowledge/', handler: (url) => {
        const pid = url.searchParams.get('project');
        if (pid === '7') return jsonResponse([KNOWLEDGE_ROW]);
        return jsonResponse([]);
      } },
    ]);
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/projects/7']}>
          <NavProbe to="/projects/8" />
          <NavProbe to="/projects/7" />
          <Routes>
            <Route path="projects/:projectId" element={<ProjectDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await screen.findByText('Alpha 知识');

    // start the knowledge PATCH, then switch to B before it settles
    const knowledgeRow = screen.getByText('Alpha 知识').closest('li') as HTMLElement;
    fireEvent.click(within(knowledgeRow).getByRole('button', { name: /编辑/ }));
    const dialog = await screen.findByRole('dialog', { name: '编辑知识摘要' });
    fireEvent.change(within(dialog).getByLabelText('摘要'), { target: { value: '新摘要。' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '保存' }));
    await within(dialog).findByRole('button', { name: /保存中/ });

    fireEvent.click(screen.getByRole('button', { name: 'go /projects/8' }));
    await screen.findByRole('heading', { level: 2, name: 'Beta' });

    act(() => patchSlow.resolve(jsonResponse({ msg: '已保存。', updated: ['abstract'] })));

    // B's own knowledge list is not refetched by A's completion
    await waitFor(() =>
      expect(getKnowledgeGets(calls, 8).length).toBe(1),
    );
    // returning to A consumes refreshed truth (staleTime Infinity → the
    // variables-bound invalidation is the ONLY refresh driver)
    fireEvent.click(screen.getByRole('button', { name: 'go /projects/7' }));
    await waitFor(() => expect(getKnowledgeGets(calls, 7).length).toBeGreaterThanOrEqual(2));
  });
});
// ── B01: resource sessions die with their origin ───────────────────────────

describe('B01 — resource dialog/session origin isolation (Plan §5.4/§8.6)', () => {
  function deferredResponse() {
    let resolve!: (value: Response) => void;
    const promise = new Promise<Response>((r) => (resolve = r));
    return { promise, resolve };
  }

  function renderWithNav() {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/projects/7']}>
          <NavProbe to="/projects/8" />
          <NavProbe to="/projects/7" />
          <Routes>
            <Route path="projects/:projectId" element={<ProjectDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    return client;
  }

  const KNOWLEDGE_ROW_B = { ...KNOWLEDGE_ROW, id: 9, title: 'Beta 知识' };

  it('a cached A→B switch drops A file confirmation and A knowledge editor; nothing operates as B state', async () => {
    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([]) },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([]) },
      { test: '/api/core/projects/7/', handler: () => jsonResponse(PROJ_7_DETAIL) },
      { test: '/api/core/projects/8/', handler: () => jsonResponse({ ...PROJ_7_DETAIL, id: 8, name: 'Beta' }) },
      { test: '/api/core/projects/7/files/', handler: () => jsonResponse([UPLOADED_FILE, SYNCED_FILE]) },
      { test: '/api/core/projects/8/files/', handler: () => jsonResponse([]) },
      {
        test: '/api/memory/knowledge/',
        handler: (url) =>
          jsonResponse(url.searchParams.get('project') === '7' ? [KNOWLEDGE_ROW] : [KNOWLEDGE_ROW_B]),
      },
    ]);
    renderWithNav();
    await screen.findByRole('heading', { level: 2, name: 'Alpha' });

    // A file confirmation AND A knowledge editor open simultaneously
    const fileRow = await screen.findByText('guide.pdf').then((el) => el.closest('li') as HTMLElement);
    fireEvent.click(within(fileRow).getByRole('button', { name: /删除/ }));
    await screen.findByRole('dialog', { name: '删除文件' });
    const knowledgeRow = (await screen.findByText('Alpha 知识')).closest('li') as HTMLElement;
    fireEvent.click(within(knowledgeRow).getByRole('button', { name: /编辑/ }));
    await screen.findByRole('dialog', { name: '编辑知识摘要' });

    // cached destination → the origin transition retires both sessions
    fireEvent.click(screen.getByRole('button', { name: 'go /projects/8' }));
    await screen.findByRole('heading', { level: 2, name: 'Beta' });
    expect(screen.queryByRole('dialog', { name: '删除文件' })).toBeNull();
    expect(screen.queryByRole('dialog', { name: '编辑知识摘要' })).toBeNull();
    // B renders its own rows (no A file row leaked into B)
    expect(screen.queryByText('guide.pdf')).toBeNull();
    expect(screen.queryByText('Alpha 知识')).toBeNull();
    expect(await screen.findByText('Beta 知识')).toBeTruthy();
  });

  it('a late upload failure settles after A→B never appears on B', async () => {
    const uploadSlow = deferredResponse();
    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([]) },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([]) },
      { test: '/api/core/projects/7/', handler: () => jsonResponse(PROJ_7_DETAIL) },
      { test: '/api/core/projects/8/', handler: () => jsonResponse({ ...PROJ_7_DETAIL, id: 8, name: 'Beta' }) },
      {
        test: '/api/core/projects/7/files/',
        method: 'POST',
        handler: () => uploadSlow.promise,
      },
      { test: '/api/core/projects/7/files/', handler: () => jsonResponse([UPLOADED_FILE]) },
      { test: '/api/core/projects/8/files/', handler: () => jsonResponse([]) },
      { test: '/api/memory/knowledge/', handler: () => jsonResponse([]) },
    ]);
    renderWithNav();
    await screen.findByRole('heading', { level: 2, name: 'Alpha' });

    fireEvent.change(screen.getByLabelText('选择要上传的文件'), {
      target: { files: [new File(['x'], 'late.txt', { type: 'text/plain' })] },
    });
    await screen.findByText(/正在上传 late\.txt/);

    fireEvent.click(screen.getByRole('button', { name: 'go /projects/8' }));
    await screen.findByRole('heading', { level: 2, name: 'Beta' });
    act(() => uploadSlow.resolve(jsonResponse({ error: 'boom' }, 400)));

    // B shows none of A's pending/failed upload feedback
    expect(screen.queryByText(/正在上传|上传失败|已提交|请刷新文件列表/)).toBeNull();
  });

  it('a knowledge failure belongs to its session: close/reopen (same or different row) starts clean', async () => {
    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([]) },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([]) },
      { test: '/api/core/projects/7/', handler: () => jsonResponse(PROJ_7_DETAIL) },
      { test: '/api/core/projects/7/files/', handler: () => jsonResponse([]) },
      {
        test: '/api/memory/knowledge/7/',
        method: 'PATCH',
        handler: () => jsonResponse({ error: 'keywords 必须是数组' }, 400),
      },
      { test: '/api/memory/knowledge/', handler: () => jsonResponse([KNOWLEDGE_ROW, KNOWLEDGE_ROW_B]) },
    ]);
    renderProject();
    await screen.findByText('Alpha 知识');

    // session 1 fails
    let knowledgeRow = screen.getByText('Alpha 知识').closest('li') as HTMLElement;
    fireEvent.click(within(knowledgeRow).getByRole('button', { name: /编辑/ }));
    let dialog = await screen.findByRole('dialog', { name: '编辑知识摘要' });
    fireEvent.change(within(dialog).getByLabelText('摘要'), { target: { value: 'x' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '保存' }));
    expect(await within(dialog).findByText('keywords 必须是数组')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: '取消' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    // reopen the SAME row: no stale error, clean inputs
    knowledgeRow = screen.getByText('Alpha 知识').closest('li') as HTMLElement;
    fireEvent.click(within(knowledgeRow).getByRole('button', { name: /编辑/ }));
    dialog = await screen.findByRole('dialog', { name: '编辑知识摘要' });
    expect(within(dialog).queryByText('keywords 必须是数组')).toBeNull();
    expect(within(dialog).getByLabelText('摘要')).toHaveValue('这是摘要内容。');
    fireEvent.click(within(dialog).getByRole('button', { name: '取消' }));

    // and a DIFFERENT row starts clean too
    const betaRow = screen.getByText('Beta 知识').closest('li') as HTMLElement;
    fireEvent.click(within(betaRow).getByRole('button', { name: /编辑/ }));
    dialog = await screen.findByRole('dialog', { name: '编辑知识摘要' });
    expect(within(dialog).queryByText('keywords 必须是数组')).toBeNull();
    expect(within(dialog).getByText('Beta 知识')).toBeTruthy();
  });

  it('a DIRECT section mount changing projectId retires the old origin confirm dialog and editor (in-section lifetime)', async () => {
    installFetch([
      { test: '/api/core/projects/7/files/', handler: () => jsonResponse([UPLOADED_FILE]) },
      { test: '/api/core/projects/8/files/', handler: () => jsonResponse([]) },
      {
        test: '/api/memory/knowledge/',
        handler: (url) =>
          jsonResponse(url.searchParams.get('project') === '7' ? [KNOWLEDGE_ROW] : []),
      },
    ]);
    function SectionSwitcher() {
      const [pid, setPid] = useState(7);
      return (
        <>
          <button type="button" onClick={() => setPid(8)}>
            switch to 8
          </button>
          <ProjectFilesSection projectId={pid} />
          <ProjectKnowledgeSection projectId={pid} />
        </>
      );
    }
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/" element={<SectionSwitcher />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await screen.findByText('guide.pdf');
    const fileRow = screen.getByText('guide.pdf').closest('li') as HTMLElement;
    fireEvent.click(within(fileRow).getByRole('button', { name: /删除/ }));
    await screen.findByRole('dialog', { name: '删除文件' });
    const knowledgeRow = screen.getByText('Alpha 知识').closest('li') as HTMLElement;
    fireEvent.click(within(knowledgeRow).getByRole('button', { name: /编辑/ }));
    await screen.findByRole('dialog', { name: '编辑知识摘要' });

    // prop change (no remount): both sessions retire immediately
    fireEvent.click(screen.getByRole('button', { name: 'switch to 8' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.queryByText('guide.pdf')).toBeNull();
    expect(screen.queryByText('Alpha 知识')).toBeNull();
    expect(await screen.findByText('暂无项目文件')).toBeTruthy();
    expect(await screen.findByText('暂无项目知识')).toBeTruthy();
    // the origin-captured request identity would still be A if anything were
    // submitted; nothing new was submitted here
    expect(screen.queryByRole('button', { name: /删除/ })).toBeNull();
  });

  it('A→B→A permanently retires the old visit: a late upload failure never reattaches on the new A', async () => {
    const uploadSlow = deferredResponse();
    const { calls } = installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([]) },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([]) },
      { test: '/api/core/projects/7/', handler: () => jsonResponse(PROJ_7_DETAIL) },
      { test: '/api/core/projects/8/', handler: () => jsonResponse({ ...PROJ_7_DETAIL, id: 8, name: 'Beta' }) },
      { test: '/api/core/projects/7/files/', method: 'POST', handler: () => uploadSlow.promise },
      { test: '/api/core/projects/7/files/', handler: () => jsonResponse([UPLOADED_FILE]) },
      { test: '/api/core/projects/8/files/', handler: () => jsonResponse([]) },
      { test: '/api/memory/knowledge/', handler: () => jsonResponse([]) },
    ]);
    renderWithNav();
    await screen.findByRole('heading', { level: 2, name: 'Alpha' });

    fireEvent.change(screen.getByLabelText('选择要上传的文件'), {
      target: { files: [new File(['x'], 'old.txt', { type: 'text/plain' })] },
    });
    await screen.findByText(/正在上传 old\.txt/);

    fireEvent.click(screen.getByRole('button', { name: 'go /projects/8' }));
    await screen.findByRole('heading', { level: 2, name: 'Beta' });
    fireEvent.click(screen.getByRole('button', { name: 'go /projects/7' }));
    await screen.findByRole('heading', { level: 2, name: 'Alpha' });

    // the old request's failure settles AFTER the new A visit began
    act(() => uploadSlow.resolve(jsonResponse({ error: 'boom' }, 400)));

    // equal projectId does NOT revive the retired visit session (R4)
    expect(screen.queryByText(/boom|上传失败|正在上传/)).toBeNull();
    // the request WAS issued for the submitted identity (R) — only its local
    // outcome was retired (failed writes correctly do not invalidate)
    expect(
      calls.filter((c) => c.url.pathname === '/api/core/projects/7/files/' && c.init?.method === 'POST').length,
    ).toBeGreaterThanOrEqual(1);

    // a NEW upload on the CURRENT visit fails visibly (live error stays)
    const secondSlow = deferredResponse();
    installFetch([
      { test: '/api/core/projects/7/files/', method: 'POST', handler: () => secondSlow.promise },
    ]);
    fireEvent.change(screen.getByLabelText('选择要上传的文件'), {
      target: { files: [new File(['y'], 'live.txt', { type: 'text/plain' })] },
    });
    await screen.findByText(/正在上传 live\.txt/);
    act(() => secondSlow.resolve(jsonResponse({ error: 'flaky' }, 500)));
    expect(await screen.findByText(/flaky/)).toBeTruthy();
  });

  it('A→B→A: a late delete failure never reattaches; same-visit delete errors stay visible', async () => {
    const deleteSlow = deferredResponse();
    const { calls } = installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([]) },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([]) },
      { test: '/api/core/projects/7/', handler: () => jsonResponse(PROJ_7_DETAIL) },
      { test: '/api/core/projects/8/', handler: () => jsonResponse({ ...PROJ_7_DETAIL, id: 8, name: 'Beta' }) },
      { test: '/api/core/projects/7/files/11/', method: 'DELETE', handler: () => deleteSlow.promise },
      { test: '/api/core/projects/7/files/', handler: () => jsonResponse([UPLOADED_FILE]) },
      { test: '/api/core/projects/8/files/', handler: () => jsonResponse([]) },
      { test: '/api/memory/knowledge/', handler: () => jsonResponse([]) },
    ]);
    renderWithNav();
    await screen.findByRole('heading', { level: 2, name: 'Alpha' });
    const fileRow = (await screen.findByText('guide.pdf')).closest('li') as HTMLElement;
    fireEvent.click(within(fileRow).getByRole('button', { name: /删除/ }));
    await screen.findByRole('dialog', { name: '删除文件' });
    fireEvent.click(within(screen.getByRole('dialog', { name: '删除文件' })).getByRole('button', { name: '确认删除' }));

    fireEvent.click(screen.getByRole('button', { name: 'go /projects/8' }));
    await screen.findByRole('heading', { level: 2, name: 'Beta' });
    fireEvent.click(screen.getByRole('button', { name: 'go /projects/7' }));
    await screen.findByRole('heading', { level: 2, name: 'Alpha' });
    act(() => deleteSlow.resolve(jsonResponse({ error: 'gone' }, 400)));

    // retired visit outcome does not resurrect on the new A visit
    expect(screen.queryByText(/删除失败|已提交|gone/)).toBeNull();
    // but the shared DELETE is still issued for the captured identity (R)
    expect(calls.filter((c) => c.url.pathname === '/api/core/projects/7/files/11/').length).toBeGreaterThanOrEqual(1);

    // same-visit delete failure (no route change) stays visible
    const secondSlow = deferredResponse();
    installFetch([
      { test: '/api/core/projects/7/files/11/', method: 'DELETE', handler: () => secondSlow.promise },
    ]);
    fireEvent.click(within(screen.getByText('guide.pdf').closest('li') as HTMLElement).getByRole('button', { name: /删除/ }));
    await screen.findByRole('dialog', { name: '删除文件' });
    fireEvent.click(within(screen.getByRole('dialog', { name: '删除文件' })).getByRole('button', { name: '确认删除' }));
    act(() => secondSlow.resolve(jsonResponse({ error: 'still-live' }, 400)));
    expect(await screen.findByText(/still-live/)).toBeTruthy();
  });

  it('A→B→A: the knowledge editor opened on the OLD visit cannot leak into a fresh A editor', async () => {
    const patchSlow = deferredResponse();
    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([]) },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([]) },
      { test: '/api/core/projects/7/', handler: () => jsonResponse(PROJ_7_DETAIL) },
      { test: '/api/core/projects/8/', handler: () => jsonResponse({ ...PROJ_7_DETAIL, id: 8, name: 'Beta' }) },
      { test: '/api/core/projects/7/files/', handler: () => jsonResponse([]) },
      { test: '/api/core/projects/8/files/', handler: () => jsonResponse([]) },
      { test: '/api/memory/knowledge/7/', method: 'PATCH', handler: () => patchSlow.promise },
      { test: '/api/memory/knowledge/', handler: (url) =>
        jsonResponse(url.searchParams.get('project') === '7' ? [KNOWLEDGE_ROW] : []) },
    ]);
    renderWithNav();
    await screen.findByRole('heading', { level: 2, name: 'Alpha' });
    const knowledgeRow = (await screen.findByText('Alpha 知识')).closest('li') as HTMLElement;
    fireEvent.click(within(knowledgeRow).getByRole('button', { name: /编辑/ }));
    let dialog = await screen.findByRole('dialog', { name: '编辑知识摘要' });
    fireEvent.change(within(dialog).getByLabelText('摘要'), { target: { value: 'doomed' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '保存' }));
    await within(dialog).findByRole('button', { name: /保存中/ });

    // retire the visit mid-write, return to A, settle the failure
    fireEvent.click(screen.getByRole('button', { name: 'go /projects/8' }));
    await screen.findByRole('heading', { level: 2, name: 'Beta' });
    fireEvent.click(screen.getByRole('button', { name: 'go /projects/7' }));
    await screen.findByRole('heading', { level: 2, name: 'Alpha' });
    act(() => patchSlow.resolve(jsonResponse({ error: 'stale-session' }, 400)));

    // reopen the SAME row on the fresh visit: clean, no stale failure
    const freshRow = screen.getByText('Alpha 知识').closest('li') as HTMLElement;
    fireEvent.click(within(freshRow).getByRole('button', { name: /编辑/ }));
    dialog = await screen.findByRole('dialog', { name: '编辑知识摘要' });
    expect(within(dialog).queryByText('stale-session')).toBeNull();
    expect(within(dialog).getByLabelText('摘要')).toHaveValue('这是摘要内容。');
  });
});

// ── B02/B03: lossless keywords + authoritative saved/index feedback ────────

describe('B02/B03 — lossless keyword editing and honest saved/index feedback', () => {
  it('phrase/separator-bearing stored keywords render as ATOMIC chips; untouched edit closes without PATCH (B02/R4)', async () => {
    const row = { ...KNOWLEDGE_ROW, keywords: ['project plan', 'alpha;beta', 'one,two'] };
    const { calls, fn } = installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([]) },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([]) },
      { test: '/api/core/projects/7/', handler: () => jsonResponse(PROJ_7_DETAIL) },
      { test: '/api/core/projects/7/files/', handler: () => jsonResponse([]) },
      { test: '/api/memory/knowledge/', handler: () => jsonResponse([row]) },
    ]);
    renderProject();
    await screen.findByText('Alpha 知识');
    const knowledgeRow = screen.getByText('Alpha 知识').closest('li') as HTMLElement;
    fireEvent.click(within(knowledgeRow).getByRole('button', { name: /编辑/ }));
    const dialog = await screen.findByRole('dialog', { name: '编辑知识摘要' });
    // every entry is ONE chip — never joined, never split
    expect(within(dialog).getByText('project plan')).toBeTruthy();
    expect(within(dialog).getByText('alpha;beta')).toBeTruthy();
    expect(within(dialog).getByText('one,two')).toBeTruthy();
    // unedited save: closes, zero PATCH
    fireEvent.click(within(dialog).getByRole('button', { name: '保存' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(calls.filter((c) => c.init?.method === 'PATCH')).toHaveLength(0);
    expect(fn.mock.calls.filter(([, init]) => init?.method === 'PATCH')).toHaveLength(0);
  });

  it('R4 real-entry path: appending next to a comma-bearing entry preserves it verbatim (B02)', async () => {
    const row = { ...KNOWLEDGE_ROW, keywords: ['one,two', 'keep'] };
    const { calls } = installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([]) },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([]) },
      { test: '/api/core/projects/7/', handler: () => jsonResponse(PROJ_7_DETAIL) },
      { test: '/api/core/projects/7/files/', handler: () => jsonResponse([]) },
      { test: '/api/memory/knowledge/7/', method: 'PATCH', handler: () => jsonResponse({ msg: '已保存。', updated: ['keywords'] }) },
      { test: '/api/memory/knowledge/', handler: () => jsonResponse([row]) },
    ]);
    renderProject();
    await screen.findByText('Alpha 知识');
    const knowledgeRow = screen.getByText('Alpha 知识').closest('li') as HTMLElement;
    fireEvent.click(within(knowledgeRow).getByRole('button', { name: /编辑/ }));
    const dialog = await screen.findByRole('dialog', { name: '编辑知识摘要' });
    // the real 追加 control appends ONE literal entry; untouched entries stay
    fireEvent.change(within(dialog).getByLabelText('新增关键词'), { target: { value: 'extra' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '追加' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '保存' }));
    expect(await within(dialog).findByText('已保存。')).toBeTruthy();
    const patch = calls.find((c) => c.url.pathname === '/api/memory/knowledge/7/');
    expect(JSON.parse(String(patch?.init?.body))).toEqual({ keywords: ['one,two', 'keep', 'extra'] });
  });

  it('a comma typed in the append input is ONE literal keyword — no batch parser (R4 calibration)', async () => {
    const { calls } = installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([]) },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([]) },
      { test: '/api/core/projects/7/', handler: () => jsonResponse(PROJ_7_DETAIL) },
      { test: '/api/core/projects/7/files/', handler: () => jsonResponse([]) },
      { test: '/api/memory/knowledge/7/', method: 'PATCH', handler: () => jsonResponse({ msg: '已保存。', updated: ['keywords'] }) },
      { test: '/api/memory/knowledge/', handler: () => jsonResponse([KNOWLEDGE_ROW]) },
    ]);
    renderProject();
    await screen.findByText('Alpha 知识');
    const knowledgeRow = screen.getByText('Alpha 知识').closest('li') as HTMLElement;
    fireEvent.click(within(knowledgeRow).getByRole('button', { name: /编辑/ }));
    const dialog = await screen.findByRole('dialog', { name: '编辑知识摘要' });
    fireEvent.change(within(dialog).getByLabelText('新增关键词'), { target: { value: 'a,b' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '追加' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '保存' }));
    expect(await within(dialog).findByText('已保存。')).toBeTruthy();
    const patch = calls.find((c) => c.url.pathname === '/api/memory/knowledge/7/');
    expect(JSON.parse(String(patch?.init?.body))).toEqual({ keywords: ['alpha', 'beta', 'a,b'] });
  });

  it('removing ONE index among duplicates removes exactly that entry (B02/R4)', async () => {
    const row = { ...KNOWLEDGE_ROW, keywords: ['alpha', 'alpha'] };
    const { calls } = installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([]) },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([]) },
      { test: '/api/core/projects/7/', handler: () => jsonResponse(PROJ_7_DETAIL) },
      { test: '/api/core/projects/7/files/', handler: () => jsonResponse([]) },
      { test: '/api/memory/knowledge/7/', method: 'PATCH', handler: () => jsonResponse({ msg: '已保存。', updated: ['keywords'] }) },
      { test: '/api/memory/knowledge/', handler: () => jsonResponse([row]) },
    ]);
    renderProject();
    await screen.findByText('Alpha 知识');
    const knowledgeRow = screen.getByText('Alpha 知识').closest('li') as HTMLElement;
    fireEvent.click(within(knowledgeRow).getByRole('button', { name: /编辑/ }));
    const dialog = await screen.findByRole('dialog', { name: '编辑知识摘要' });
    expect(within(dialog).getAllByRole('button', { name: '移除关键词 alpha' })).toHaveLength(2);
    // remove the FIRST duplicate only — index-based
    fireEvent.click(within(dialog).getAllByRole('button', { name: '移除关键词 alpha' })[0]);
    fireEvent.click(within(dialog).getByRole('button', { name: '保存' }));
    expect(await within(dialog).findByText('已保存。')).toBeTruthy();
    const patch = calls.find((c) => c.url.pathname === '/api/memory/knowledge/7/');
    expect(JSON.parse(String(patch?.init?.body))).toEqual({ keywords: ['alpha'] });
  });

  it('appending a phrase adds ONE literal keyword next to the stored entry (B02)', async () => {
    const row = { ...KNOWLEDGE_ROW, keywords: ['plain'] };
    const { calls } = installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([]) },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([]) },
      { test: '/api/core/projects/7/', handler: () => jsonResponse(PROJ_7_DETAIL) },
      { test: '/api/core/projects/7/files/', handler: () => jsonResponse([]) },
      { test: '/api/memory/knowledge/7/', method: 'PATCH', handler: () => jsonResponse({ msg: '已保存。', updated: ['keywords'] }) },
      { test: '/api/memory/knowledge/', handler: () => jsonResponse([row]) },
    ]);
    renderProject();
    await screen.findByText('Alpha 知识');
    const knowledgeRow = screen.getByText('Alpha 知识').closest('li') as HTMLElement;
    fireEvent.click(within(knowledgeRow).getByRole('button', { name: /编辑/ }));
    const dialog = await screen.findByRole('dialog', { name: '编辑知识摘要' });
    expect(within(dialog).getByText('plain')).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText('新增关键词'), { target: { value: 'new phrase' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '追加' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '保存' }));
    expect(await within(dialog).findByText('已保存。')).toBeTruthy();
    const patch = calls.find((c) => c.url.pathname === '/api/memory/knowledge/7/');
    expect(JSON.parse(String(patch?.init?.body))).toEqual({ keywords: ['plain', 'new phrase'] });
  });

  it('removing every keyword sends an explicit empty array (user intent, not loss)', async () => {
    const { calls } = installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([]) },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([]) },
      { test: '/api/core/projects/7/', handler: () => jsonResponse(PROJ_7_DETAIL) },
      { test: '/api/core/projects/7/files/', handler: () => jsonResponse([]) },
      { test: '/api/memory/knowledge/7/', method: 'PATCH', handler: () => jsonResponse({ msg: '已保存。', updated: ['keywords'] }) },
      { test: '/api/memory/knowledge/', handler: () => jsonResponse([KNOWLEDGE_ROW]) },
    ]);
    renderProject();
    await screen.findByText('Alpha 知识');
    const knowledgeRow = screen.getByText('Alpha 知识').closest('li') as HTMLElement;
    fireEvent.click(within(knowledgeRow).getByRole('button', { name: /编辑/ }));
    const dialog = await screen.findByRole('dialog', { name: '编辑知识摘要' });
    fireEvent.click(within(dialog).getByRole('button', { name: '移除关键词 alpha' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '移除关键词 beta' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '保存' }));
    await within(dialog).findByText('已保存。');
    const patch = calls.find((c) => c.url.pathname === '/api/memory/knowledge/7/');
    expect(JSON.parse(String(patch?.init?.body))).toEqual({ keywords: [] });
  });

  it('abstract-only edit never touches keywords (no keywords key in the PATCH)', async () => {
    const { calls } = installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([]) },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([]) },
      { test: '/api/core/projects/7/', handler: () => jsonResponse(PROJ_7_DETAIL) },
      { test: '/api/core/projects/7/files/', handler: () => jsonResponse([]) },
      { test: '/api/memory/knowledge/7/', method: 'PATCH', handler: () => jsonResponse({ msg: '已保存。', updated: ['abstract'] }) },
      { test: '/api/memory/knowledge/', handler: () => jsonResponse([KNOWLEDGE_ROW]) },
    ]);
    renderProject();
    await screen.findByText('Alpha 知识');
    const knowledgeRow = screen.getByText('Alpha 知识').closest('li') as HTMLElement;
    fireEvent.click(within(knowledgeRow).getByRole('button', { name: /编辑/ }));
    const dialog = await screen.findByRole('dialog', { name: '编辑知识摘要' });
    fireEvent.change(within(dialog).getByLabelText('摘要'), { target: { value: '新摘要。' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '保存' }));
    await within(dialog).findByText('已保存。后台索引刷新已启动，将在后台完成。');
    const patch = calls.find((c) => c.url.pathname === '/api/memory/knowledge/7/');
    const body = JSON.parse(String(patch?.init?.body)) as Record<string, unknown>;
    expect(Object.keys(body)).toEqual(['abstract']);
    expect(body.abstract).toBe('新摘要。');
  });

  it('whitespace-rounded abstract is sent RAW; backend updated=[] means saved WITHOUT any index claim', async () => {
    const { calls } = installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([]) },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([]) },
      { test: '/api/core/projects/7/', handler: () => jsonResponse(PROJ_7_DETAIL) },
      { test: '/api/core/projects/7/files/', handler: () => jsonResponse([]) },
      { test: '/api/memory/knowledge/7/', method: 'PATCH', handler: () => jsonResponse({ msg: '已保存。', updated: [] }) },
      { test: '/api/memory/knowledge/', handler: () => jsonResponse([KNOWLEDGE_ROW]) },
    ]);
    renderProject();
    await screen.findByText('Alpha 知识');
    const knowledgeRow = screen.getByText('Alpha 知识').closest('li') as HTMLElement;
    fireEvent.click(within(knowledgeRow).getByRole('button', { name: /编辑/ }));
    const dialog = await screen.findByRole('dialog', { name: '编辑知识摘要' });
    fireEvent.change(within(dialog).getByLabelText('摘要'), {
      target: { value: '  这是摘要内容。  ' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: '保存' }));

    // the edit WAS submitted (backend normalizes/strips); the visible
    // feedback follows the AUTHORITATIVE response: no index job started
    expect(await within(dialog).findByText('已保存。')).toBeTruthy();
    expect(within(dialog).queryByText(/后台|索引|重向量化/)).toBeNull();
    const patch = calls.find((c) => c.url.pathname === '/api/memory/knowledge/7/');
    expect(JSON.parse(String(patch?.init?.body))).toEqual({ abstract: '  这是摘要内容。  ' });
    // terminal saved state unlocks dismissal
    fireEvent.click(within(dialog).getByRole('button', { name: '完成' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('keywords plus whitespace-rounded abstract: raw abstract submitted; updated lacking abstract → no index claim', async () => {
    const { calls } = installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([]) },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([]) },
      { test: '/api/core/projects/7/', handler: () => jsonResponse(PROJ_7_DETAIL) },
      { test: '/api/core/projects/7/files/', handler: () => jsonResponse([]) },
      { test: '/api/memory/knowledge/7/', method: 'PATCH', handler: () => jsonResponse({ msg: '已保存。', updated: ['keywords'] }) },
      { test: '/api/memory/knowledge/', handler: () => jsonResponse([KNOWLEDGE_ROW]) },
    ]);
    renderProject();
    await screen.findByText('Alpha 知识');
    const knowledgeRow = screen.getByText('Alpha 知识').closest('li') as HTMLElement;
    fireEvent.click(within(knowledgeRow).getByRole('button', { name: /编辑/ }));
    const dialog = await screen.findByRole('dialog', { name: '编辑知识摘要' });
    fireEvent.change(within(dialog).getByLabelText('摘要'), {
      target: { value: '  这是摘要内容。  ' },
    });
    fireEvent.change(within(dialog).getByLabelText('新增关键词'), { target: { value: 'gamma' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '追加' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '保存' }));

    expect(await within(dialog).findByText('已保存。')).toBeTruthy();
    // the backend accepted no abstract change: the claim carries NO index wording
    expect(within(dialog).queryByText(/后台|索引|重向量化/)).toBeNull();
    const patch = calls.find((c) => c.url.pathname === '/api/memory/knowledge/7/');
    const body = JSON.parse(String(patch?.init?.body)) as Record<string, unknown>;
    expect(body.abstract).toBe('  这是摘要内容。  ');
    expect(body.keywords).toEqual(['alpha', 'beta', 'gamma']);
  });
});

// ── B04: dialog keyboard/focus contract ────────────────────────────────────

describe('B04 — dialog focus, trap, safe Escape and restore (Plan §8.8)', () => {
  function isInside(dialog: HTMLElement | null) {
    return dialog !== null && dialog.contains(document.activeElement);
  }

  it('delete confirmation: focus enters, Tab stays contained, Escape closes, trigger restored', async () => {
    installFetch(detailRoutes());
    renderProject();
    await screen.findByText('guide.pdf');
    const fileRow = screen.getByText('guide.pdf').closest('li') as HTMLElement;
    const trigger = within(fileRow).getByRole('button', { name: /删除/ });
    trigger.focus(); // jsdom: click alone does not move focus; restore asserts need it
    fireEvent.click(trigger);
    const dialog = (await screen.findByRole('dialog', { name: '删除文件' })) as HTMLElement;
    expect(isInside(dialog)).toBe(true);

    // move to the last focusable then Tab — wraps to the first INSIDE the dialog
    const confirm = within(dialog).getByRole('button', { name: '确认删除' });
    confirm.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(isInside(dialog)).toBe(true);
    // Shift+Tab from the first wraps back to the last, still inside
    const closeBtn = within(dialog).getByRole('button', { name: '取消删除' });
    closeBtn.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(isInside(dialog)).toBe(true);

    // safe Escape closes and restores the trigger
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it('knowledge editor: focus lands on the abstract field; safe Escape closes and restores', async () => {
    installFetch(detailRoutes());
    renderProject();
    await screen.findByText('Alpha 知识');
    const knowledgeRow = screen.getByText('Alpha 知识').closest('li') as HTMLElement;
    const trigger = within(knowledgeRow).getByRole('button', { name: /编辑/ });
    trigger.focus(); // jsdom: click alone does not move focus; restore asserts need it
    fireEvent.click(trigger);
    const dialog = (await screen.findByRole('dialog', { name: '编辑知识摘要' })) as HTMLElement;
    expect(document.activeElement).toBe(within(dialog).getByLabelText('摘要'));

    // Tab containment
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(isInside(dialog)).toBe(true);
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(isInside(dialog)).toBe(true);

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it('knowledge editor: pending write locks Escape and close controls; saved state unlocks', async () => {
    function deferredResponse() {
      let resolve!: (value: Response) => void;
      const promise = new Promise<Response>((r) => (resolve = r));
      return { promise, resolve };
    }
    const patchSlow = deferredResponse();
    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([]) },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([]) },
      { test: '/api/core/projects/7/', handler: () => jsonResponse(PROJ_7_DETAIL) },
      { test: '/api/core/projects/7/files/', handler: () => jsonResponse([]) },
      { test: '/api/memory/knowledge/7/', method: 'PATCH', handler: () => patchSlow.promise },
      { test: '/api/memory/knowledge/', handler: () => jsonResponse([KNOWLEDGE_ROW]) },
    ]);
    renderProject();
    await screen.findByText('Alpha 知识');
    const knowledgeRow = screen.getByText('Alpha 知识').closest('li') as HTMLElement;
    fireEvent.click(within(knowledgeRow).getByRole('button', { name: /编辑/ }));
    const dialog = await screen.findByRole('dialog', { name: '编辑知识摘要' });
    fireEvent.change(within(dialog).getByLabelText('摘要'), { target: { value: 'x' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '保存' }));
    await within(dialog).findByRole('button', { name: /保存中/ });

    // pending: Escape is suppressed, close controls are disabled
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('dialog', { name: '编辑知识摘要' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: '关闭' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: '取消' })).toBeDisabled();
    // B04/R4: with every control disabled, the dialog CONTAINER anchor keeps
    // focus ownership inside the modal (never BODY, never the trigger)
    expect(isInside(dialog)).toBe(true);

    // settle → saved terminal state: 完成 is the usable focused control
    act(() => patchSlow.resolve(jsonResponse({ msg: '已保存。', updated: ['abstract'] })));
    await within(dialog).findByRole('button', { name: '完成' });
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: '完成' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('knowledge editor: definite failure re-focuses the editable abstract field', async () => {
    const { calls } = installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([]) },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([]) },
      { test: '/api/core/projects/7/', handler: () => jsonResponse(PROJ_7_DETAIL) },
      { test: '/api/core/projects/7/files/', handler: () => jsonResponse([]) },
      { test: '/api/memory/knowledge/7/', method: 'PATCH', handler: () => jsonResponse({ error: '被迫中断' }, 400) },
      { test: '/api/memory/knowledge/', handler: () => jsonResponse([KNOWLEDGE_ROW]) },
    ]);
    renderProject();
    await screen.findByText('Alpha 知识');
    const knowledgeRow = screen.getByText('Alpha 知识').closest('li') as HTMLElement;
    const trigger = within(knowledgeRow).getByRole('button', { name: /编辑/ });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: '编辑知识摘要' });
    fireEvent.change(within(dialog).getByLabelText('摘要'), { target: { value: 'x' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '保存' }));

    expect(await within(dialog).findByText('被迫中断')).toBeTruthy();
    // controls are usable again and focus is back on the editable field
    expect(within(dialog).getByRole('button', { name: '保存' })).not.toBeDisabled();
    expect(document.activeElement).toBe(within(dialog).getByLabelText('摘要'));
    expect(within(dialog).getByLabelText('摘要')).toHaveValue('x'); // input retained
    // failed write does not refetch the list
    expect(getKnowledgeGets(calls).length).toBe(1);
  });
});
