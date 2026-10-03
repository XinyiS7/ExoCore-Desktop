import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RiverPage } from '../features/river/RiverPage';
import type { LegacyEvent } from '../features/river/legacyApi';
import { diaryItem } from './river_fixtures';
import { installFetch, jsonResponse, renderV4, unmockFetch, type MockRoute } from './helpers';

const EVENT_ID = 7;
const DETAIL_PATH = `/api/agents/chronicle/${EVENT_ID}/`;

function legacyEvent(overrides: Partial<LegacyEvent> = {}): LegacyEvent {
  return {
    id: EVENT_ID,
    preset: 6,
    preset_name: 'Alice Agent',
    event_time: '2026-09-15',
    content: '原始内容',
    scope: null,
    kind: 'milestone',
    message: 42,
    keywords: ['a,b', 'c\nd'],
    modified_at: '2026-10-02T12:00:00Z',
    ...overrides,
  };
}

function chronicleRiverItem() {
  return {
    source_id: String(EVENT_ID),
    occurred_at: '2026-10-02T12:00:00Z',
    time_precision: 'day',
    preset_id: 6,
    preview: '历史事件预览',
    capabilities: ['read', 'edit', 'delete'],
    source_type: 'chronicle',
    target: { type: 'chronicle', id: EVENT_ID },
    source_specific: { event_time: '2026-09-15', kind: 'milestone', scope: null, keywords: ['a,b', 'c\nd'] },
  };
}

function installLegacyServer(overrides: {
  river?: MockRoute['handler'];
  get?: MockRoute['handler'];
  patch?: MockRoute['handler'];
  delete?: MockRoute['handler'];
} = {}) {
  const routes: MockRoute[] = [
    { test: '/api/core/river/', handler: overrides.river ?? (() => jsonResponse({ items: [chronicleRiverItem()], next_cursor: null })) },
    { test: '/api/core/river/open-tasks/', handler: () => jsonResponse({ items: [] }) },
    { test: DETAIL_PATH, method: 'GET', handler: overrides.get ?? (() => jsonResponse(legacyEvent())) },
    { test: DETAIL_PATH, method: 'PATCH', handler: overrides.patch ?? (() => jsonResponse(legacyEvent())) },
    { test: DETAIL_PATH, method: 'DELETE', handler: overrides.delete ?? (() => jsonResponse(null, 204)) },
  ];
  return installFetch(routes);
}

type HttpCall = { url: URL; init?: RequestInit };
const legacyCalls = (calls: HttpCall[]) => calls.filter((call) => call.url.pathname === DETAIL_PATH);
const riverCalls = (calls: HttpCall[]) => calls.filter((call) => call.url.pathname === '/api/core/river/');
const methodCalls = (calls: HttpCall[], method: string) => calls.filter((call) => call.init?.method === method);

async function openLegacyDialog() {
  renderV4(<RiverPage presetId={6} />);
  fireEvent.click(await screen.findByRole('button', { name: '查看纪事详情' }));
  return screen.findByRole('dialog', { name: `历史纪事 #${EVENT_ID}` });
}

afterEach(() => { cleanup(); unmockFetch(); });

describe('CP4 Legacy detail via real RiverPage', () => {
  it('GETs the detail then PATCHes only the allowlist while id/preset/kind/message stay source-owned', async () => {
    const patchBodies: Record<string, unknown>[] = [];
    const { calls } = installLegacyServer({
      patch: (_url, init) => {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        patchBodies.push(body);
        return jsonResponse(legacyEvent({ content: String(body.content), modified_at: '2026-10-02T13:00:00Z' }));
      },
    });
    const dialog = await openLegacyDialog();
    expect(await within(dialog).findByText('Alice Agent（preset 6）')).toBeInTheDocument();
    expect(within(dialog).getByText('7')).toBeInTheDocument();
    expect(within(dialog).getByText('里程碑（milestone）')).toBeInTheDocument();
    expect(within(dialog).getByText('Message #42')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('关键词 1')).toHaveValue('a,b');
    expect(within(dialog).getByLabelText('关键词 2')).toHaveValue('c\nd');
    expect(within(dialog).getByLabelText(/范围 scope/)).toHaveValue('');

    fireEvent.change(within(dialog).getByLabelText(/内容 content/), { target: { value: '改写后的内容' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '保存修改' }));
    await within(dialog).findByText('已保存。River 将按已加载页面刷新。');
    await waitFor(() => expect(patchBodies).toHaveLength(1));
    expect(patchBodies[0]).toEqual({ event_time: '2026-09-15', content: '改写后的内容', scope: null, keywords: ['a,b', 'c\nd'] });
    expect(Object.keys(patchBodies[0]).sort()).toEqual(['content', 'event_time', 'keywords', 'scope']);
    for (const identity of ['id', 'preset', 'preset_name', 'kind', 'message', 'modified_at', 'occurred_at']) {
      expect(patchBodies[0]).not.toHaveProperty(identity);
    }
    const get = legacyCalls(calls).find((call) => call.init?.method === 'GET');
    expect(get?.url.pathname).toBe(DETAIL_PATH);
    expect(within(dialog).getByText('Alice Agent（preset 6）')).toBeInTheDocument();
    expect(within(dialog).getByText('Message #42')).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/内容 content/)).toHaveValue('改写后的内容');
    expect(within(dialog).queryByText('瞬间（moment）')).not.toBeInTheDocument();
  });

  it('round-trips each keyword row verbatim, preserving commas/newlines and dropping only empty rows', async () => {
    const patchBodies: Record<string, unknown>[] = [];
    const { calls } = installLegacyServer({
      get: () => jsonResponse(legacyEvent({ kind: 'moment', keywords: ['a,b', '', 'x,y\nz'] })),
      patch: (_url, init) => {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        patchBodies.push(body);
        return jsonResponse(legacyEvent({ kind: 'moment', keywords: body.keywords as string[], modified_at: '2026-10-02T13:00:00Z' }));
      },
    });
    const dialog = await openLegacyDialog();
    expect(await within(dialog).findByText('瞬间（moment）')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('关键词 1')).toHaveValue('a,b');
    expect(within(dialog).getByLabelText('关键词 2')).toHaveValue('');
    expect(within(dialog).getByLabelText('关键词 3')).toHaveValue('x,y\nz');
    fireEvent.change(within(dialog).getByLabelText('关键词 2'), { target: { value: '中,文\n换行' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /添加关键词/ }));
    fireEvent.change(within(dialog).getByLabelText('关键词 4'), { target: { value: '新词' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /添加关键词/ }));
    expect(within(dialog).getByLabelText('关键词 5')).toHaveValue('');
    fireEvent.click(within(dialog).getByRole('button', { name: '保存修改' }));
    await waitFor(() => expect(patchBodies).toHaveLength(1));
    expect(patchBodies[0].keywords).toEqual(['a,b', '中,文\n换行', 'x,y\nz', '新词']);
    expect(methodCalls(legacyCalls(calls), 'PATCH')).toHaveLength(1);
  });

  it('retains the typed draft and sends no PATCH when date or content validation fails', async () => {
    const { calls } = installLegacyServer();
    const dialog = await openLegacyDialog();
    const content = await within(dialog).findByLabelText(/内容 content/);
    const date = within(dialog).getByLabelText(/事件日期/);
    fireEvent.change(content, { target: { value: '   ' } });
    fireEvent.change(date, { target: { value: '' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '保存修改' }));
    expect(await within(dialog).findByText('事件日期必须是 YYYY-MM-DD 格式。')).toBeInTheDocument();
    expect(content).toHaveValue('   ');
    expect(date).toHaveValue('');
    expect(methodCalls(legacyCalls(calls), 'PATCH')).toHaveLength(0);

    fireEvent.change(date, { target: { value: '2026-09-16' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '保存修改' }));
    expect(await within(dialog).findByText('内容不能为空。')).toBeInTheDocument();
    expect(content).toHaveValue('   ');
    expect(date).toHaveValue('2026-09-16');
    expect(methodCalls(legacyCalls(calls), 'PATCH')).toHaveLength(0);
    expect(within(dialog).getByText('Message #42')).toBeInTheDocument();
  });

  it('keeps the typed draft and reports a settled server 400 without refreshing or closing', async () => {
    const { calls } = installLegacyServer({
      patch: () => jsonResponse({ content: ['不能为空。'] }, 400),
    });
    const dialog = await openLegacyDialog();
    const content = await within(dialog).findByLabelText(/内容 content/);
    const date = within(dialog).getByLabelText(/事件日期/);
    fireEvent.change(content, { target: { value: '服务端拒绝的草稿' } });
    fireEvent.change(date, { target: { value: '2026-09-16' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '保存修改' }));
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('保存失败：不能为空。');
    expect(alert).not.toHaveTextContent('保存结果不确定');
    expect(content).toHaveValue('服务端拒绝的草稿');
    expect(date).toHaveValue('2026-09-16');
    expect(methodCalls(legacyCalls(calls), 'PATCH')).toHaveLength(1);
    expect(riverCalls(calls)).toHaveLength(1);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it.each([
    { name: 'HTTP 500', patch: () => jsonResponse({ error: 'server exploded' }, 500), text: '保存失败：server exploded' },
    { name: 'a lost network', patch: () => { throw new TypeError('Failed to fetch'); }, text: '保存失败：网络连接失败，请检查后端服务' },
  ])('keeps the typed draft and flags the PATCH as uncertain on $name', async ({ patch, text }) => {
    const { calls } = installLegacyServer({ patch });
    const dialog = await openLegacyDialog();
    const content = await within(dialog).findByLabelText(/内容 content/);
    fireEvent.change(content, { target: { value: '结果不明的编辑' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '保存修改' }));
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent(text);
    expect(alert).toHaveTextContent('保存结果不确定，请先刷新核对；本次不会自动重试。');
    expect(content).toHaveValue('结果不明的编辑');
    expect(methodCalls(legacyCalls(calls), 'PATCH')).toHaveLength(1);
    expect(riverCalls(calls)).toHaveLength(1);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('locks the editor and de-duplicates the in-flight save until the PATCH settles', async () => {
    let finish!: (response: Response) => void;
    const { calls } = installLegacyServer({
      patch: () => new Promise((resolve) => { finish = resolve; }),
    });
    const dialog = await openLegacyDialog();
    const content = await within(dialog).findByLabelText(/内容 content/);
    fireEvent.change(content, { target: { value: '在途双击' } });
    const save = within(dialog).getByRole('button', { name: '保存修改' });
    fireEvent.click(save);
    fireEvent.click(save);
    await waitFor(() => expect(methodCalls(legacyCalls(calls), 'PATCH')).toHaveLength(1));
    expect(within(dialog).getByRole('button', { name: '保存中…' })).toBeDisabled();
    expect(content).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: '关闭纪事详情' })).toBeDisabled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(document.querySelector('.legacy-overlay')!);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(methodCalls(legacyCalls(calls), 'PATCH')).toHaveLength(1);
    await act(async () => { finish(jsonResponse(legacyEvent({ content: '在途双击', modified_at: '2026-10-02T14:00:00Z' }))); });
    expect(await within(dialog).findByText('已保存。River 将按已加载页面刷新。')).toBeInTheDocument();
    const patch = methodCalls(legacyCalls(calls), 'PATCH')[0];
    expect(JSON.parse(String(patch.init?.body))).toEqual({ event_time: '2026-09-15', content: '在途双击', scope: null, keywords: ['a,b', 'c\nd'] });
    expect(methodCalls(legacyCalls(calls), 'PATCH')).toHaveLength(1);
    expect(save).toBeEnabled();
  });

  it('moves an event_time change to a home restart but keeps the loaded cursor chain for an ordinary edit', async () => {
    const patchBodies: Record<string, unknown>[] = [];
    let eventTime = '2026-09-15';
    let homeRequests = 0;
    const { calls } = installLegacyServer({
      river: (url) => {
        if (url.searchParams.has('cursor')) {
          return jsonResponse({ items: [{ ...diaryItem, source_id: 'older', preview: '更早页预览' }], next_cursor: null });
        }
        homeRequests += 1;
        return jsonResponse({ items: [chronicleRiverItem()], next_cursor: 'cursor-1' });
      },
      get: () => jsonResponse(legacyEvent({ event_time: eventTime })),
      patch: (_url, init) => {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        patchBodies.push(body);
        eventTime = String(body.event_time);
        return jsonResponse(legacyEvent({ event_time: eventTime, content: String(body.content), modified_at: '2026-10-02T13:30:00Z' }));
      },
    });
    const dialog = await openLegacyDialog();
    fireEvent.click(await screen.findByRole('button', { name: '加载更早记录' }));
    await screen.findByText('更早页预览');
    expect(riverCalls(calls).find((call) => call.url.searchParams.has('cursor'))?.url.searchParams.get('cursor')).toBe('cursor-1');

    fireEvent.change(await within(dialog).findByLabelText(/内容 content/), { target: { value: '普通编辑' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '保存修改' }));
    await within(dialog).findByText('已保存。River 将按已加载页面刷新。');
    await waitFor(() => expect(riverCalls(calls).filter((call) => call.url.searchParams.has('cursor'))).toHaveLength(2));
    expect(screen.getByText('更早页预览')).toBeInTheDocument();
    expect(patchBodies[0]).not.toHaveProperty('occurred_at');
    expect(patchBodies[0]).not.toHaveProperty('modified_at');

    fireEvent.change(within(dialog).getByLabelText(/事件日期/), { target: { value: '2026-09-20' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '保存修改' }));
    await within(dialog).findByText('已保存。事件日期已变更，River 将从首页重新开始遍历。');
    await waitFor(() => expect(screen.queryByText('更早页预览')).not.toBeInTheDocument());
    await waitFor(() => expect(homeRequests).toBe(3));
    expect(riverCalls(calls).at(-1)!.url.searchParams.has('cursor')).toBe(false);
    expect(patchBodies[1].event_time).toBe('2026-09-20');
    expect(patchBodies[1]).not.toHaveProperty('occurred_at');
  });

  it.each([
    { name: 'highlight detail', get: () => jsonResponse(legacyEvent({ kind: 'highlight' })), notice: '珍藏片段' },
    { name: '404 detail', get: () => jsonResponse({ detail: '记录不存在' }, 404), notice: '该纪事已不存在' },
  ])('shows no P3 writes and requests exactly one refresh for a $name', async ({ get, notice }) => {
    const { calls } = installLegacyServer({ get });
    const dialog = await openLegacyDialog();
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(notice);
    expect(within(dialog).queryByRole('button', { name: '保存修改' })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /^永久删除/ })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /确认永久删除/ })).not.toBeInTheDocument();
    await waitFor(() => expect(riverCalls(calls)).toHaveLength(2));
    expect(riverCalls(calls)[1].url.searchParams.has('cursor')).toBe(false);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 25)); });
    expect(riverCalls(calls)).toHaveLength(2);
  });

  it('sends zero requests when the permanent-delete confirmation is cancelled', async () => {
    const { calls } = installLegacyServer();
    const dialog = await openLegacyDialog();
    fireEvent.click(await within(dialog).findByRole('button', { name: /^永久删除/ }));
    const confirm = within(dialog).getByRole('alert');
    expect(confirm).toHaveTextContent('永久删除');
    expect(confirm).toHaveTextContent('删除不可恢复');
    expect(confirm).toHaveTextContent('不会进入归档');
    expect(confirm).toHaveTextContent('成功后该条目会从 River 移除');
    expect(confirm).toHaveTextContent('取消不会发出任何请求');
    fireEvent.click(within(dialog).getByRole('button', { name: '取消删除' }));
    expect(within(dialog).queryByRole('button', { name: /确认永久删除/ })).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: '保存修改' })).toBeInTheDocument();
    expect(methodCalls(legacyCalls(calls), 'DELETE')).toHaveLength(0);
  });

  it.each([
    { name: 'HTTP 500', del: () => jsonResponse({ error: 'server exploded' }, 500), notice: /删除结果不确定/ },
    { name: 'a lost network', del: () => { throw new TypeError('Failed to fetch'); }, notice: /删除结果不确定/ },
  ])('keeps the record and error on $name instead of faking removal', async ({ del, notice }) => {
    const { calls } = installLegacyServer({ delete: del });
    const dialog = await openLegacyDialog();
    fireEvent.click(await within(dialog).findByRole('button', { name: /^永久删除/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: '确认永久删除' }));
    expect(await within(dialog).findByText(notice)).toBeInTheDocument();
    expect(within(dialog).getByText('Message #42')).toBeInTheDocument();
    expect(screen.getByText('历史事件预览')).toBeInTheDocument();
    expect(screen.queryByText('这段时间流暂无记录。')).not.toBeInTheDocument();
    expect(methodCalls(legacyCalls(calls), 'DELETE')).toHaveLength(1);
    expect(riverCalls(calls)).toHaveLength(1);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('removes the record and restarts the River stream only after the confirmed 204 delete', async () => {
    let items = [chronicleRiverItem()];
    const { calls } = installLegacyServer({
      river: () => jsonResponse({ items, next_cursor: null }),
      delete: () => { items = []; return jsonResponse(null, 204); },
    });
    const dialog = await openLegacyDialog();
    fireEvent.click(await within(dialog).findByRole('button', { name: /^永久删除/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: '确认永久删除' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(methodCalls(legacyCalls(calls), 'DELETE')).toHaveLength(1);
    await screen.findByText('这段时间流暂无记录。');
    expect(screen.queryByText('历史事件预览')).not.toBeInTheDocument();
    expect(riverCalls(calls)).toHaveLength(2);
    expect(riverCalls(calls)[1].url.searchParams.has('cursor')).toBe(false);
  });

  it('locks dismissing and de-duplicates the in-flight permanent delete', async () => {
    let finish!: (response: Response) => void;
    const { calls } = installLegacyServer({ delete: () => new Promise((resolve) => { finish = resolve; }) });
    const dialog = await openLegacyDialog();
    fireEvent.click(await within(dialog).findByRole('button', { name: /^永久删除/ }));
    const confirm = within(dialog).getByRole('button', { name: '确认永久删除' });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    await waitFor(() => expect(methodCalls(legacyCalls(calls), 'DELETE')).toHaveLength(1));
    expect(within(dialog).getByRole('button', { name: '永久删除中…' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: '关闭纪事详情' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: '取消删除' })).toBeDisabled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(document.querySelector('.legacy-overlay')!);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(methodCalls(legacyCalls(calls), 'DELETE')).toHaveLength(1);
    await act(async () => { finish(jsonResponse(null, 204)); });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
