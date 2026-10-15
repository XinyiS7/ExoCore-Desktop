import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { detailItem, listItem } from './collection_fixtures';
import { installFetch, jsonResponse, renderApp, unmockFetch } from './helpers';

afterEach(unmockFetch);

function setup(deleteResponse: () => Response | Promise<Response>) {
  let tagCalls = 0;
  const fetchMock = installFetch([
    { test: '/api/collection/items/5/', method: 'DELETE', handler: deleteResponse },
    { test: '/api/collection/items/', method: 'GET', handler: () => jsonResponse({ items: [listItem(5), listItem(6)], next_cursor: null }) },
    { test: '/api/collection/items/5/', method: 'GET', handler: () => jsonResponse(detailItem(5)) },
    { test: '/api/collection/tags/', handler: () => { tagCalls += 1; return jsonResponse({ items: [] }); } },
  ]);
  return { ...fetchMock, tagCalls: () => tagCalls };
}

async function openConfirm() {
  renderApp(['/library?kind=text']);
  fireEvent.click(await screen.findByRole('link', { name: '藏品 5' }));
  const view = within(await screen.findByRole('dialog', { name: '藏品 藏品 5' }));
  fireEvent.click(await view.findByRole('button', { name: '删除' }));
  return screen.findByRole('alertdialog', { name: '删除“藏品 5”？' });
}

const deletes = (calls: { init?: RequestInit }[]) => calls.filter((call) => call.init?.method === 'DELETE');

describe('Library permanent deletion (UI-C3)', () => {
  it('states permanence, focuses cancel, and cancel/Escape keep the item', async () => {
    const { calls } = setup(() => jsonResponse(null, 204));
    const confirm = await openConfirm();
    expect(within(confirm).getByText(/永久删除这件藏品，不可恢复。它的收藏理由、评论、浏览统计和本藏品的标签关联会一起删除/)).toBeTruthy();
    expect(document.activeElement).toBe(within(confirm).getByRole('button', { name: '取消' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    // Escape closed only the confirmation, not the detail.
    expect(screen.getByRole('dialog', { name: '藏品 藏品 5' })).toBeTruthy();
    expect(deletes(calls)).toHaveLength(0);
  });

  it('sends one DELETE, then closes and removes the card on 204', async () => {
    let release: () => void = () => undefined;
    const { calls, tagCalls } = setup(() => new Promise<Response>((resolve) => {
      release = () => resolve(new Response(null, { status: 204 }));
    }));
    const confirm = await openConfirm();
    const tagsBefore = tagCalls();
    const button = within(confirm).getByRole('button', { name: '永久删除' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(await within(confirm).findByRole('button', { name: '删除中…' })).toBeTruthy();
    expect((within(confirm).getByRole('button', { name: '取消' }) as HTMLButtonElement).disabled).toBe(true);
    release();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(deletes(calls)).toHaveLength(1);
    const wall = screen.getByLabelText('藏品墙');
    expect(within(wall).queryByRole('link', { name: '藏品 5' })).toBeNull();
    expect(within(wall).getByRole('link', { name: '藏品 6' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: '文字' }).getAttribute('aria-selected')).toBe('true');
    await waitFor(() => expect(tagCalls()).toBeGreaterThan(tagsBefore));
  });

  it('treats an already-missing item (404) as deleted', async () => {
    setup(() => jsonResponse({ error: 'gone', code: 'collection_item_not_found' }, 404));
    const confirm = await openConfirm();
    fireEvent.click(within(confirm).getByRole('button', { name: '永久删除' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(within(screen.getByLabelText('藏品墙')).queryByRole('link', { name: '藏品 5' })).toBeNull();
  });

  it('keeps everything and reports a server failure', async () => {
    setup(() => jsonResponse({ error: 'boom', code: 'internal' }, 500));
    const confirm = await openConfirm();
    fireEvent.click(within(confirm).getByRole('button', { name: '永久删除' }));
    expect(await within(confirm).findByText(/删除失败/)).toBeTruthy();
    expect(screen.getByRole('dialog', { name: '藏品 藏品 5' })).toBeTruthy();
    expect(within(screen.getByLabelText('藏品墙')).getByRole('link', { name: '藏品 5' })).toBeTruthy();
  });
});
