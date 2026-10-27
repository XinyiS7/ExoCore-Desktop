import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { detailItem, listItem } from './collection_fixtures';
import { installFetch, jsonResponse, renderApp, unmockFetch, type MockRoute } from './helpers';

afterEach(unmockFetch);

const COMMENTS_PATH = '/api/collection/items/5/comments/';
const BASE = detailItem(5);
const [HUMAN, AGENT] = BASE.comments;

function setup(extra: MockRoute[] = [], detail: unknown = BASE) {
  return installFetch([
    ...extra,
    { test: '/api/collection/items/5/view/', method: 'POST', handler: () => new Promise<Response>(() => undefined) },
    { test: '/api/collection/items/', method: 'GET', handler: () => jsonResponse({ items: [listItem(5)], next_cursor: null }) },
    { test: '/api/collection/items/5/', method: 'GET', handler: () => jsonResponse(detail) },
    { test: '/api/collection/tags/', handler: () => jsonResponse({ items: [] }) },
  ]);
}

function deferred() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((done) => { resolve = done; });
  return { promise, resolve };
}

const writes = (calls: { url: URL; init?: RequestInit }[], method: string) =>
  calls.filter((call) => call.init?.method === method && call.url.pathname.startsWith(COMMENTS_PATH));
const open = async () => {
  const view = within(await screen.findByRole('dialog', { name: /^藏品 / }));
  await view.findByRole('textbox', { name: '评论内容' });
  return view;
};
const bodies = (view: ReturnType<typeof within>) =>
  within(view.getByRole('list', { name: '评论' })).getAllByRole('listitem').map((item) => item.querySelector('p')?.textContent);
const rowOf = (view: ReturnType<typeof within>, body: string) => view.getByText(body).closest('li') as HTMLElement;
const newComment = { id: 60, author_type: 'human', author_label: 'Alicia', body: '新的一条', created_at: '2026-10-15T09:00:00+00:00', can_delete: true };

describe('Library comments: order and composer (D1/D2)', () => {
  it('lists newest first, keeps reversed API order on equal times, and puts the composer above', async () => {
    setup([], detailItem(5, {
      comments: [
        { ...HUMAN, id: 50, body: '甲', created_at: '2026-10-14T10:00:00+00:00' },
        { ...AGENT, id: 51, body: '乙', created_at: '2026-10-14T10:00:00+00:00' },
        { ...HUMAN, id: 52, body: '丙', created_at: '2026-10-14T11:00:00+00:00' },
      ],
    }));
    renderApp(['/library/items/5']);
    const view = await open();

    expect(bodies(view)).toEqual(['丙', '乙', '甲']);
    const composer = view.getByRole('textbox', { name: '评论内容' });
    const list = view.getByRole('list', { name: '评论' });
    expect(composer.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('posts the draft, shows the returned detail with the new comment on top, and clears the draft', async () => {
    const { calls } = setup([{
      test: COMMENTS_PATH, method: 'POST',
      handler: () => jsonResponse(detailItem(5, { comments: [HUMAN, AGENT, newComment] }), 201),
    }]);
    renderApp(['/library/items/5']);
    const view = await open();

    fireEvent.change(view.getByRole('textbox', { name: '评论内容' }), { target: { value: '  新的一条 ' } });
    fireEvent.click(view.getByRole('button', { name: '发表' }));

    await waitFor(() => expect(bodies(view)).toEqual(['新的一条', '我也喜欢', '第一次']));
    expect((view.getByRole('textbox', { name: '评论内容' }) as HTMLTextAreaElement).value).toBe('');
    const posts = writes(calls, 'POST');
    expect(posts).toHaveLength(1);
    expect(posts[0].url.pathname).toBe(COMMENTS_PATH);
    expect(JSON.parse(String(posts[0].init?.body))).toEqual({ body: '  新的一条 ' });
  });

  it('counts code points after trim: blank and 2001 emoji are blocked, 2000 emoji can be sent', async () => {
    const { calls } = setup();
    renderApp(['/library/items/5']);
    const view = await open();
    const box = view.getByRole('textbox', { name: '评论内容' });
    const send = () => view.getByRole('button', { name: '发表' }) as HTMLButtonElement;

    expect(send().disabled).toBe(true);
    fireEvent.change(box, { target: { value: '  \n\t ' } });
    expect(send().disabled).toBe(true);
    fireEvent.change(box, { target: { value: ` ${'🌙'.repeat(2000)} ` } });
    expect(send().disabled).toBe(false);
    expect(view.queryByText(/超出上限/)).toBeNull();
    fireEvent.change(box, { target: { value: '🌙'.repeat(2001) } });
    expect(send().disabled).toBe(true);
    expect(view.getByText('2001 / 2000，超出上限')).toBeTruthy();
    fireEvent.click(send());
    expect(writes(calls, 'POST')).toHaveLength(0);
  });

  it('keeps the draft with a visible error on failure, blocks resubmits while pending, and retries', async () => {
    const first = deferred();
    let attempts = 0;
    const { calls } = setup([{
      test: COMMENTS_PATH, method: 'POST',
      handler: () => {
        attempts += 1;
        return attempts === 1 ? first.promise : jsonResponse(detailItem(5, { comments: [HUMAN, AGENT, newComment] }), 201);
      },
    }]);
    renderApp(['/library/items/5']);
    const view = await open();
    fireEvent.change(view.getByRole('textbox', { name: '评论内容' }), { target: { value: '新的一条' } });
    fireEvent.click(view.getByRole('button', { name: '发表' }));

    const pending = await view.findByRole('button', { name: '发表中…' }) as HTMLButtonElement;
    expect(pending.disabled).toBe(true);
    fireEvent.submit(view.getByRole('form', { name: '发表评论' }));
    expect(writes(calls, 'POST')).toHaveLength(1);

    first.resolve(jsonResponse({ error: 'boom', code: 'internal' }, 500));
    expect(await view.findByText('发表失败：boom')).toBeTruthy();
    expect((view.getByRole('textbox', { name: '评论内容' }) as HTMLTextAreaElement).value).toBe('新的一条');
    expect(bodies(view)).toEqual(['我也喜欢', '第一次']);

    fireEvent.click(view.getByRole('button', { name: '发表' }));
    await waitFor(() => expect(bodies(view)[0]).toBe('新的一条'));
    expect(view.queryByText('发表失败：boom')).toBeNull();
    expect(writes(calls, 'POST')).toHaveLength(2);
  });
});

describe('Library comments: delete own (D3)', () => {
  const deletePath = `${COMMENTS_PATH}${HUMAN.id}/`;

  it('deletes only after the inline confirm; cancel sends nothing; only the target disappears', async () => {
    const { calls } = setup([{
      test: deletePath, method: 'DELETE',
      handler: () => jsonResponse(detailItem(5, { comments: [AGENT] })),
    }]);
    renderApp(['/library/items/5']);
    const view = await open();
    const row = within(rowOf(view, '第一次'));
    expect(within(rowOf(view, '我也喜欢')).queryAllByRole('button')).toHaveLength(0);

    fireEvent.click(row.getByRole('button', { name: '删除这条评论' }));
    fireEvent.click(row.getByRole('button', { name: '取消' }));
    expect(row.queryByRole('group', { name: '确认删除评论' })).toBeNull();
    expect(writes(calls, 'DELETE')).toHaveLength(0);

    fireEvent.click(row.getByRole('button', { name: '删除这条评论' }));
    fireEvent.click(within(row.getByRole('group', { name: '确认删除评论' })).getByRole('button', { name: '删除' }));

    await waitFor(() => expect(bodies(view)).toEqual(['我也喜欢']));
    const deletes = writes(calls, 'DELETE');
    expect(deletes.map((call) => call.url.pathname)).toEqual([deletePath]);
  });

  it('keeps the comment with its error on failure, blocks repeats while pending, and can retry', async () => {
    const first = deferred();
    let attempts = 0;
    const { calls } = setup([{
      test: deletePath, method: 'DELETE',
      handler: () => {
        attempts += 1;
        return attempts === 1 ? first.promise : jsonResponse(detailItem(5, { comments: [AGENT] }));
      },
    }]);
    renderApp(['/library/items/5']);
    const view = await open();
    const row = within(rowOf(view, '第一次'));
    fireEvent.click(row.getByRole('button', { name: '删除这条评论' }));
    fireEvent.click(within(row.getByRole('group', { name: '确认删除评论' })).getByRole('button', { name: '删除' }));

    const confirm = within(row.getByRole('group', { name: '确认删除评论' }));
    const busy = await confirm.findByRole('button', { name: '删除中…' }) as HTMLButtonElement;
    expect(busy.disabled).toBe(true);
    expect((confirm.getByRole('button', { name: '取消' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(busy);
    expect(writes(calls, 'DELETE')).toHaveLength(1);

    first.resolve(jsonResponse({ error: 'boom', code: 'internal' }, 500));
    expect(await row.findByText('删除失败：boom')).toBeTruthy();
    expect(bodies(view)).toEqual(['我也喜欢', '第一次']);

    fireEvent.click(within(row.getByRole('group', { name: '确认删除评论' })).getByRole('button', { name: '删除' }));
    await waitFor(() => expect(bodies(view)).toEqual(['我也喜欢']));
    expect(writes(calls, 'DELETE')).toHaveLength(2);
  });
});
