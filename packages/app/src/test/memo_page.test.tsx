import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RiverPage } from '../features/river/RiverPage';
import { jsonResponse, renderV4, unmockFetch } from './helpers';
import { installMemoServer } from './memo_test_server';

type HttpCall = { url: URL; init?: RequestInit };
const posts = (calls: HttpCall[]) => calls.filter((call) => call.init?.method === 'POST');
const patches = (calls: HttpCall[]) => calls.filter((call) => call.init?.method === 'PATCH');
async function ready() { renderV4(<RiverPage />); await screen.findByText('agent:2 · 2 条直接回复'); }
function draft(content: string) { fireEvent.change(screen.getByLabelText('Memo 正文'), { target: { value: content } }); }
async function openThread() {
  fireEvent.click(screen.getByRole('button', { name: '展开讨论' }));
  const region = await screen.findByRole('region', { name: 'Memo #7 讨论' });
  await within(region).findByLabelText('回复正文');
  return region;
}
afterEach(() => { cleanup(); unmockFetch(); });

describe('CP2 Memo two-step saving', () => {
  it('saves raw content then patches exact extracted tags, refreshes root traversal, never creates a Task', async () => {
    const { calls } = installMemoServer(); await ready();
    draft('  新正文 #task #中文 #task  ');
    expect(within(screen.getByRole('list', { name: '识别到的标签' })).getAllByRole('listitem').map((node) => node.textContent)).toEqual(['#task', '#中文']);
    fireEvent.click(screen.getByRole('button', { name: '记录 Memo' }));
    await waitFor(() => expect(patches(calls)).toHaveLength(1));
    expect(posts(calls)).toHaveLength(1);
    expect(JSON.parse(String(posts(calls)[0].init?.body))).toEqual({ content: '  新正文 #task #中文 #task  ' });
    expect(patches(calls)[0]).toMatchObject({ url: expect.objectContaining({ pathname: '/api/core/memos/100/tags/' }) });
    expect(JSON.parse(String(patches(calls)[0].init?.body))).toEqual({ tags: ['task', '中文'] });
    await waitFor(() => expect(screen.getByLabelText('Memo 正文')).toHaveValue(''));
    expect(calls.filter((call) => call.url.pathname === '/api/core/river/')).toHaveLength(2);
    expect(calls.some((call) => call.url.pathname.startsWith('/api/tasks/'))).toBe(false);
    expect(document.querySelectorAll('[data-river-identity]')).toHaveLength(2);
  });

  it('clears a confirmed POST draft before PATCH completes; blocks duplicate submits; PATCH failure only retries tags', async () => {
    const { server, calls } = installMemoServer();
    let finish!: (response: Response) => void;
    server.patch = () => new Promise((resolve) => { finish = resolve; });
    await ready(); draft('记录 #one');
    const submit = screen.getByRole('button', { name: '记录 Memo' });
    fireEvent.click(submit); fireEvent.click(submit);
    await waitFor(() => expect(patches(calls)).toHaveLength(1));
    expect(screen.getByLabelText('Memo 正文')).toHaveValue('');
    expect(screen.getByLabelText('Memo 正文')).toBeDisabled();
    expect(posts(calls)).toHaveLength(1);
    await act(async () => { finish(jsonResponse({ error: 'tag offline' }, 503)); });
    const retry = await screen.findByRole('button', { name: '仅重试 Memo #100 标签' });
    expect(screen.getByText('记录已保存，标签未保存 · Memo #100')).toBeInTheDocument();
    server.patch = undefined; fireEvent.click(retry);
    await waitFor(() => expect(screen.queryByRole('button', { name: '仅重试 Memo #100 标签' })).not.toBeInTheDocument());
    expect(posts(calls)).toHaveLength(1);
    expect(patches(calls)).toHaveLength(2);
    expect(patches(calls).every((call) => call.url.pathname === '/api/core/memos/100/tags/')).toBe(true);
  });

  it('retains distinct partial contexts across new drafts/memos, retrying the original id only', async () => {
    const { server, calls } = installMemoServer();
    server.patch = () => jsonResponse({ error: 'failed' }, 500);
    await ready(); draft('first #one'); fireEvent.click(screen.getByRole('button', { name: '记录 Memo' }));
    await screen.findByRole('button', { name: '仅重试 Memo #100 标签' });
    draft('second #two'); fireEvent.click(screen.getByRole('button', { name: '记录 Memo' }));
    await screen.findByRole('button', { name: '仅重试 Memo #101 标签' });
    draft('新的未提交草稿');
    server.patch = undefined;
    fireEvent.click(screen.getByRole('button', { name: '仅重试 Memo #100 标签' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: '仅重试 Memo #100 标签' })).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: '仅重试 Memo #101 标签' })).toBeInTheDocument();
    expect(screen.getByLabelText('Memo 正文')).toHaveValue('新的未提交草稿');
    expect(posts(calls)).toHaveLength(2);
    expect(patches(calls).at(-1)!.url.pathname).toBe('/api/core/memos/100/tags/');
    expect(JSON.parse(String(patches(calls).at(-1)!.init?.body))).toEqual({ tags: ['one'] });
  });

  it('manual tag replacement clears same-id stale retry and can clear all tags without changing body', async () => {
    const { server, calls } = installMemoServer(); server.patch = () => jsonResponse({ error: 'failed' }, 500);
    await ready(); draft('正文 #old'); fireEvent.click(screen.getByRole('button', { name: '记录 Memo' }));
    await screen.findByRole('button', { name: '仅重试 Memo #100 标签' });
    server.patch = undefined;
    fireEvent.click(screen.getByRole('button', { name: '管理 Memo #100 标签' }));
    fireEvent.change(screen.getByLabelText('标签名称'), { target: { value: ' fresh \nfresh\nFresh' } });
    fireEvent.click(screen.getByRole('button', { name: '保存标签' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: '仅重试 Memo #100 标签' })).not.toBeInTheDocument();
    expect(server.memos.get(100)).toMatchObject({ content: '正文 #old', tags: ['Fresh', 'fresh'] });
    fireEvent.click(screen.getByRole('button', { name: '管理 Memo #100 标签' }));
    fireEvent.change(screen.getByLabelText('标签名称'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: '保存标签' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(server.memos.get(100)).toMatchObject({ content: '正文 #old', tags: [] });
    expect(posts(calls)).toHaveLength(1);
    expect(JSON.parse(String(patches(calls).at(-1)!.init?.body))).toEqual({ tags: [] });
  });

  it('serializes same-id manual tags/retry, blocks duplicate PATCH and Escape while committed', async () => {
    const { server, calls } = installMemoServer(); server.patch = () => jsonResponse({ error: 'failed' }, 500);
    await ready(); draft('正文 #old'); fireEvent.click(screen.getByRole('button', { name: '记录 Memo' }));
    await screen.findByRole('button', { name: '仅重试 Memo #100 标签' });
    let finish!: () => void;
    server.patch = (id, tags) => new Promise((resolve) => { finish = () => {
      const memo = { ...server.memos.get(id)!, tags };
      server.memos.set(id, memo); resolve(jsonResponse(memo));
    }; });
    fireEvent.click(screen.getByRole('button', { name: '管理 Memo #100 标签' }));
    fireEvent.change(screen.getByLabelText('标签名称'), { target: { value: 'fresh' } });
    const save = screen.getByRole('button', { name: '保存标签' });
    fireEvent.click(save); fireEvent.click(save);
    await waitFor(() => expect(patches(calls)).toHaveLength(2));
    expect(screen.getByRole('button', { name: '仅重试 Memo #100 标签' })).toBeDisabled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await act(async () => { finish(); });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: '仅重试 Memo #100 标签' })).not.toBeInTheDocument();
    expect(server.memos.get(100)!.tags).toEqual(['fresh']);
    expect(patches(calls)).toHaveLength(2); expect(posts(calls)).toHaveLength(1);
  });

  it.each(['network', '503', 'malformed'])('preserves draft and warns to verify uncertain %s POST, no automatic retry or PATCH', async (kind) => {
    const { server, calls } = installMemoServer();
    server.post = () => { if (kind === 'network') throw new TypeError('network'); return kind === '503' ? jsonResponse({ error: 'unknown' }, 503) : jsonResponse({ accepted: true }, 201); };
    await ready(); draft('保留草稿 #Tag'); fireEvent.click(screen.getByRole('button', { name: '记录 Memo' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('保存结果不确定，请先刷新核对');
    expect(screen.getByLabelText('Memo 正文')).toHaveValue('保留草稿 #Tag');
    expect(posts(calls)).toHaveLength(1); expect(patches(calls)).toHaveLength(0);
    expect(screen.getByRole('button', { name: '刷新时间流' })).toBeInTheDocument();
  });

  it('keeps definite failure draft, rejects long tags before POST, permits corrected explicit submit', async () => {
    const { server, calls } = installMemoServer(); server.post = () => jsonResponse({ error: 'content rejected' }, 400);
    await ready(); draft(`正文 #${'𐐀'.repeat(51)}`);
    expect(screen.getByRole('alert')).toHaveTextContent('超过 50');
    expect(screen.getByRole('button', { name: '记录 Memo' })).toBeDisabled(); expect(posts(calls)).toHaveLength(0);
    draft('正文 #valid'); fireEvent.click(screen.getByRole('button', { name: '记录 Memo' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('记录未保存：content rejected');
    expect(screen.getByLabelText('Memo 正文')).toHaveValue('正文 #valid'); expect(posts(calls)).toHaveLength(1);
    server.post = undefined; fireEvent.click(screen.getByRole('button', { name: '记录 Memo' }));
    await waitFor(() => expect(screen.getByLabelText('Memo 正文')).toHaveValue(''));
    expect(posts(calls)).toHaveLength(2);
  });
});

describe('CP2 arbitrary parent threads', () => {
  it('loads only on expansion, keeps full parent relations/order; selected real parent does not rewrite existing draft', async () => {
    const { calls } = installMemoServer(); await ready();
    expect(calls.filter((call) => call.url.pathname === '/api/core/memos/7/')).toHaveLength(0);
    const thread = await openThread();
    expect(Array.from(thread.querySelectorAll('[data-memo-id]')).map((node) => node.getAttribute('data-memo-id'))).toEqual(['8', '9', '11', '10']);
    expect(thread.querySelector('[data-memo-id="11"]')).toHaveAttribute('data-parent-id', '9');
    expect(within(thread).getByText('@agent:2 · Memo #9')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('回复正文'), { target: { value: '不改我的草稿' } });
    fireEvent.click(screen.getByRole('button', { name: '回复 Memo #11' }));
    expect(screen.getByLabelText('回复正文')).toHaveValue('不改我的草稿');
    expect(screen.getByText('回复目标：@agent:2 · Memo #11')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '发送回复' }));
    await waitFor(() => expect(posts(calls)).toHaveLength(1));
    expect(posts(calls)[0]).toMatchObject({ url: expect.objectContaining({ pathname: '/api/core/memos/11/replies/' }) });
    await waitFor(() => expect(thread.querySelector('[data-memo-id="100"]')).toHaveAttribute('data-parent-id', '11'));
    expect(screen.getByText('agent:2 · 2 条直接回复')).toBeInTheDocument();
    expect(document.querySelectorAll('[data-river-identity]')).toHaveLength(1);
    expect(calls.filter((call) => call.url.pathname === '/api/core/river/')).toHaveLength(1);
  });

  it('direct root reply increments direct count; nested partial Tags retries correct reply id without moving root', async () => {
    const { server, calls } = installMemoServer(); await ready(); await openThread();
    const rootCard = document.querySelector('[data-river-identity="memo:7"]');
    const time = rootCard!.querySelector('time')!.getAttribute('datetime');
    fireEvent.change(screen.getByLabelText('回复正文'), { target: { value: '根回复' } });
    fireEvent.click(screen.getByRole('button', { name: '发送回复' }));
    await screen.findByText('agent:2 · 3 条直接回复');
    server.patch = () => jsonResponse({ error: 'reply tags failed' }, 503);
    fireEvent.click(screen.getByRole('button', { name: '回复 Memo #11' }));
    fireEvent.change(screen.getByLabelText('回复正文'), { target: { value: '深层 #nested' } });
    fireEvent.click(screen.getByRole('button', { name: '发送回复' }));
    await screen.findByRole('button', { name: '仅重试 Memo #101 标签' });
    expect(screen.getByText('agent:2 · 3 条直接回复')).toBeInTheDocument();
    server.patch = undefined;
    fireEvent.click(screen.getByRole('button', { name: '仅重试 Memo #101 标签' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: '仅重试 Memo #101 标签' })).not.toBeInTheDocument());
    expect(posts(calls)).toHaveLength(2);
    expect(patches(calls).every((call) => call.url.pathname === '/api/core/memos/101/tags/')).toBe(true);
    expect(document.querySelector('[data-river-identity="memo:7"]')).toBe(rootCard);
    expect(rootCard!.querySelector('time')!.getAttribute('datetime')).toBe(time);
    expect(document.querySelectorAll('[data-river-identity]')).toHaveLength(1);
  });

  it('retains a failed reply draft through collapse/reopen and reports source read failure explicitly', async () => {
    const { server } = installMemoServer(); await ready(); await openThread();
    server.post = () => jsonResponse({ detail: 'parent missing' }, 404);
    fireEvent.change(screen.getByLabelText('回复正文'), { target: { value: '失败仍保留' } });
    fireEvent.click(screen.getByRole('button', { name: '发送回复' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('parent missing');
    fireEvent.click(screen.getByRole('button', { name: '收起讨论' }));
    fireEvent.click(screen.getByRole('button', { name: '展开讨论' }));
    expect(screen.getByLabelText('回复正文')).toHaveValue('失败仍保留');
    cleanup(); server.readError = 403; renderV4(<RiverPage />);
    await screen.findByText('agent:2 · 2 条直接回复');
    fireEvent.click(screen.getByRole('button', { name: '展开讨论' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('讨论读取失败');
  });

  it('tag management failure keeps input, and invalid manual tag/long reply tag cannot submit', async () => {
    const { server, calls } = installMemoServer(); await ready(); await openThread();
    fireEvent.change(screen.getByLabelText('回复正文'), { target: { value: `#${'𐐀'.repeat(51)}` } });
    expect(screen.getByRole('button', { name: '发送回复' })).toBeDisabled(); expect(posts(calls)).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: '管理 Memo #9 标签' }));
    fireEvent.change(screen.getByLabelText('标签名称'), { target: { value: '#invalid' } });
    expect(screen.getByRole('button', { name: '保存标签' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('标签名称'), { target: { value: 'Kept' } });
    server.patch = () => jsonResponse({ error: 'tag denied' }, 403);
    fireEvent.click(screen.getByRole('button', { name: '保存标签' }));
    await waitFor(() => expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent('tag denied'));
    expect(screen.getByLabelText('标签名称')).toHaveValue('Kept');
    expect(patches(calls)).toHaveLength(1);
  });
});
