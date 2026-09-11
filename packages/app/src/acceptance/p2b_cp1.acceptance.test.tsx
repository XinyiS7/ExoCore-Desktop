// Acceptance-owned: CP1 runtime invariants; Construction must not edit/copy.
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { ProjectDetailPage } from '../features/projects/ProjectDetailPage';
import { ProjectHubPage } from '../features/projects/ProjectHubPage';
import { controlQueryKeys } from '../features/chat/control/queries';
import { queryKeys } from '../features/chat/queries';

const clients: QueryClient[] = [];
afterEach(() => { cleanup(); clients.forEach(c => c.clear()); clients.length = 0; vi.unstubAllGlobals(); });
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const project = (id: number) => ({ id, name: `Project-${id}`, description: '', prompt: '', work_dir: '', created_at: '2026-01-01T00:00:00Z' });
const normalized = (id: number) => ({ id, name: `Project-${id}`, description: '', prompt: '', workDir: '', createdAt: '2026-01-01T00:00:00Z' });
function deferred() { let resolve!: (r: Response) => void; const promise = new Promise<Response>(r => { resolve = r; }); return { promise, resolve }; }
function Navigation() { const go = useNavigate(); return <><button onClick={() => go('/projects/42')}>acceptance-switch</button><button onClick={() => go('/projects/41')}>acceptance-return</button></>; }
function mount(options: { entry?: string; cachedB?: boolean; detail?: unknown; fieldError?: Record<string, string[]>; list?: unknown; conversationsFail?: boolean } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } });
  clients.push(client);
  if (options.cachedB) client.setQueryData(controlQueryKeys.projectDetail(42), normalized(42));
  const writes: ReturnType<typeof deferred>[] = [];
  const requests: { path: string; method: string; body: unknown }[] = [];
  let saved = false;
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input), 'http://localhost').pathname;
    const method = init?.method ?? 'GET';
    requests.push({ path, method, body: init?.body ? JSON.parse(String(init.body)) : null });
    if (method === 'PATCH' || method === 'POST') {
      if (options.fieldError) return json(options.fieldError, 400);
      const pending = deferred(); writes.push(pending); return pending.promise;
    }
    if (path === '/api/core/projects/') return json(options.list ?? [project(42), project(41)]);
    if (path === '/api/agents/conversations/') return options.conversationsFail ? json({ error: 'down' }, 500) : json([]);
    if (path === '/api/agents/presets/') return json([]);
    const match = path.match(/^\/api\/core\/projects\/(\d+)\/$/);
    if (match) return json(options.detail ?? { ...project(Number(match[1])), ...(saved && match[1] === '41' ? { name: 'Saved-A' } : {}) });
    throw new Error(`Unexpected ${method} ${path}`);
  }));
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[options.entry ?? '/projects/41']}><Navigation /><Routes>
    <Route path="/projects" element={<ProjectHubPage />} />
    <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
  </Routes></MemoryRouter></QueryClientProvider>);
  return { client, writes, requests, save: () => { saved = true; } };
}
async function edit() { fireEvent.click(await screen.findByRole('button', { name: '编辑' })); return screen.findByRole('dialog'); }
async function settle(client: QueryClient) { await waitFor(() => expect(client.getMutationCache().getAll().some(m => m.state.status === 'pending')).toBe(false)); }

it.each(['success', 'malformed'] as const)('CP1 submit-origin cache survives cached A->B and late PATCH %s', async outcome => {
  const h = mount({ cachedB: true });
  const dialog = await edit();
  fireEvent.change(within(dialog).getByRole('textbox', { name: /项目名称/ }), { target: { value: 'Saved-A' } });
  fireEvent.click(within(dialog).getByRole('button', { name: '保存' }));
  await waitFor(() => expect(h.writes).toHaveLength(1));
  expect(h.requests.find(r => r.method === 'PATCH')).toMatchObject({ path: '/api/core/projects/41/', body: { name: 'Saved-A', description: '', prompt: '', work_dir: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'acceptance-switch' }));
  await screen.findByRole('heading', { name: 'Project-42' });
  expect(screen.queryByRole('dialog')).toBeNull();
  h.save();
  await act(async () => { h.writes[0].resolve(json(outcome === 'success' ? { ...project(41), name: 'Saved-A' } : { broken: true })); });
  await settle(h.client);
  // Real next consumption is decisive: A must refetch, not display a forever-fresh old owner.
  fireEvent.click(screen.getByRole('button', { name: 'acceptance-return' }));
  expect(await screen.findByRole('heading', { name: 'Saved-A' })).toBeInTheDocument();
});

it.each(['name', 'description', 'prompt', 'work_dir'] as const)('CP1 backend %s reason is visible and editor input survives', async field => {
  const message = `server-reason-${field}`;
  const h = mount({ fieldError: { [field]: [message] } });
  const dialog = await edit();
  fireEvent.change(within(dialog).getByRole('textbox', { name: /工作目录/ }), { target: { value: '/kept/user/input' } });
  fireEvent.click(within(dialog).getByRole('button', { name: '保存' }));
  await settle(h.client);
  await waitFor(() => expect(h.requests.filter(r => r.method === 'PATCH')).toHaveLength(1));
  expect(within(dialog).getByRole('textbox', { name: /工作目录/ })).toHaveValue('/kept/user/input');
  expect(await within(dialog).findByText(message)).toBeInTheDocument();
  expect(within(dialog).getByRole('button', { name: '保存' })).not.toBeDisabled();
});

it('CP1 backend blank strings get explicit empty configuration labels', async () => {
  mount();
  await screen.findByRole('button', { name: '编辑' });
  // Wording is not frozen: blank configuration must have an explicit nonempty display.
  expect(document.querySelector('.project-identity-desc')?.textContent?.trim()).not.toBe('');
  expect(screen.getAllByRole('definition')).toHaveLength(2);
  for (const value of screen.getAllByRole('definition')) expect(value.textContent?.trim()).not.toBe('');
});

it.each([0, -4, 1.5])('CP1 malformed detail identity %s never confirms an editable owner', async id => {
  mount({ detail: { ...project(41), id } });
  expect(await screen.findByText('项目详情加载失败')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '编辑' })).toBeNull();
});

it.each(['0', '-1', '1.5', 'bad'])('CP1 invalid route %s has no requests', async id => {
  const h = mount({ entry: `/projects/${id}` });
  expect(await screen.findByText('无效的项目地址')).toBeInTheDocument();
  expect(h.requests).toHaveLength(0);
});

it('CP1 Hub preserves order and count failure is not false zero', async () => {
  mount({ entry: '/projects', conversationsFail: true });
  const list = await screen.findByRole('list', { name: '项目列表' });
  expect(within(list).getAllByRole('link').map(e => e.getAttribute('href'))).toEqual(['/projects/42', '/projects/41']);
  await waitFor(() => expect(within(list).getAllByText('会话数暂不可用')).toHaveLength(2));
  expect(within(list).queryByText('0 个会话')).toBeNull();
});

it('CP1 malformed Hub success stays an explicit retryable failure', async () => {
  mount({ entry: '/projects', list: [{ name: 'missing identity' }] });
  expect(await screen.findByText('项目列表加载失败')).toBeInTheDocument();
  expect(screen.queryByRole('list', { name: '项目列表' })).toBeNull();
  expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument();
});

it('CP1 close then reopen suppresses old create navigation but refreshes shared truth', async () => {
  const h = mount({ entry: '/projects' });
  await screen.findByRole('list', { name: '项目列表' });
  fireEvent.click(screen.getByRole('button', { name: '新建项目' }));
  const dialog = await screen.findByRole('dialog');
  fireEvent.change(within(dialog).getByRole('textbox', { name: /项目名称/ }), { target: { value: 'new' } });
  fireEvent.click(within(dialog).getByRole('button', { name: '创建项目' }));
  await waitFor(() => expect(h.writes).toHaveLength(1));
  fireEvent.click(within(dialog).getByRole('button', { name: '关闭' }));
  fireEvent.click(screen.getByRole('button', { name: '新建项目' }));
  const newer = await screen.findByRole('dialog');
  fireEvent.change(within(newer).getByRole('textbox', { name: /项目名称/ }), { target: { value: 'newer input' } });
  await act(async () => { h.writes[0].resolve(json(project(99), 201)); });
  await settle(h.client);
  expect(screen.getByRole('heading', { name: '项目' })).toBeInTheDocument();
  expect(within(newer).getByRole('textbox', { name: /项目名称/ })).toHaveValue('newer input');
  expect(h.requests.filter(r => r.path === '/api/core/projects/' && r.method === 'GET').length).toBeGreaterThan(1);
  expect(h.client.getQueryData(queryKeys.projects)).toBeDefined();
});
it('CP1 harness control: same-origin PATCH rereads confirmed server data', async () => {
  const h = mount();
  const dialog = await edit();
  fireEvent.click(within(dialog).getByRole('button', { name: '保存' }));
  await waitFor(() => expect(h.writes).toHaveLength(1));
  h.save();
  await act(async () => { h.writes[0].resolve(json({ ...project(41), name: 'Saved-A' })); });
  await settle(h.client);
  expect(await screen.findByRole('heading', { name: 'Saved-A' })).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('CP1 harness control: absent name is an explicit malformed-detail error', async () => {
  mount({ detail: { id: 41 } });
  expect(await screen.findByText('项目详情加载失败')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '编辑' })).toBeNull();
});

it('CP1 create sibling also exposes backend work_dir reason', async () => {
  const h = mount({ entry: '/projects', fieldError: { work_dir: ['create-directory-reason'] } });
  await screen.findByRole('list', { name: '项目列表' });
  fireEvent.click(screen.getByRole('button', { name: '新建项目' }));
  const dialog = await screen.findByRole('dialog');
  fireEvent.change(within(dialog).getByRole('textbox', { name: /项目名称/ }), { target: { value: 'new' } });
  fireEvent.click(within(dialog).getByRole('button', { name: '创建项目' }));
  await waitFor(() => expect(h.requests.some(r => r.method === 'POST')).toBe(true));
  expect(await within(dialog).findByText('create-directory-reason')).toBeInTheDocument();
});