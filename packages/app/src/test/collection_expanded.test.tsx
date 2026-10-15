import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { detailItem, imageDetail, listItem } from './collection_fixtures';
import { installFetch, jsonResponse, renderApp, unmockFetch, type MockRoute } from './helpers';

afterEach(unmockFetch);

const TAGS = { items: [{ name: 'Night', normalized_name: 'night', item_count: 2 }] };

function rep(kind: string, state: string, overrides: Record<string, unknown> = {}) {
  return {
    kind, state, canonical_text: '', content_url: state === 'succeeded' ? `/api/collection/items/5/representations/${kind}/content/` : null,
    artifact_mime_type: '', producer_type: 'p', producer_version: 'v', model_identity: '', attempt_count: 1,
    retryable: false, retry_url: null, error_code: '', updated_at: '2026-10-14T10:00:00+00:00',
    ...overrides,
  };
}

function routes(detail: () => Response, extra: MockRoute[] = []): MockRoute[] {
  return [
    ...extra,
    { test: '/api/collection/items/', method: 'GET', handler: () => jsonResponse({ items: [listItem(5), listItem(6)], next_cursor: null }) },
    { test: '/api/collection/items/5/', method: 'GET', handler: detail },
    { test: '/api/collection/tags/', handler: () => jsonResponse(TAGS) },
  ];
}

const dialog = () => screen.findByRole('dialog', { name: /^藏品 / });

describe('Library expanded detail (UI-C1)', () => {
  it('opens from the wall over the mounted wall and closes back to the same filters', async () => {
    installFetch(routes(() => jsonResponse(detailItem(5, { description: '', collection_context: '想留着', tags: ['Night'] }))));
    renderApp(['/library?kind=text']);
    fireEvent.click(await screen.findByRole('link', { name: '藏品 5' }));
    const view = within(await dialog());
    expect(await view.findByText('想留着')).toBeTruthy();
    expect(view.getByText('暂无描述')).toBeTruthy();
    expect(view.getByText('#Night')).toBeTruthy();
    expect(view.getByText('一段文字')).toBeTruthy();
    expect(view.getByText(/聊天消息 · 助手 · /)).toBeTruthy();
    expect(view.getByRole('link', { name: '打开来源会话' }).getAttribute('href')).toBe('/chat/12');
    // The wall stays mounted underneath.
    expect(screen.getByLabelText('藏品墙')).toBeTruthy();
    fireEvent.click(view.getByRole('button', { name: '关闭' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('tab', { name: '文字' }).getAttribute('aria-selected')).toBe('true');
  });

  it('hides the source link when the source is unavailable', async () => {
    const base = detailItem(5);
    installFetch(routes(() => jsonResponse({ ...base, source: { ...base.source, available: false } })));
    renderApp(['/library/items/5']);
    const view = within(await dialog());
    expect(await view.findByText('（来源已不可用）')).toBeTruthy();
    expect(view.queryByRole('link', { name: '打开来源会话' })).toBeNull();
  });

  it('shows not-found for 404 and a retry for other failures', async () => {
    installFetch(routes(() => jsonResponse({ error: 'gone', code: 'collection_item_not_found' }, 404)));
    const first = renderApp(['/library/items/5']);
    expect(await screen.findByText('藏品不存在或已删除')).toBeTruthy();
    first.unmount();
    unmockFetch();

    let fail = true;
    installFetch(routes(() => (fail ? jsonResponse({ error: 'boom', code: 'internal' }, 500) : jsonResponse(detailItem(5)))));
    renderApp(['/library/items/5']);
    expect(await screen.findByText(/藏品加载失败/)).toBeTruthy();
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    expect(await within(await dialog()).findByText('一段文字')).toBeTruthy();
  });

  it('falls back to the original when the image preview failed and flags it', async () => {
    installFetch(routes(() => jsonResponse(imageDetail(5, {
      representations: [rep('image_preview', 'failed', { error_code: 'decode_error' })],
    }))));
    renderApp(['/library/items/5']);
    const view = within(await dialog());
    const img = await view.findByRole('img', { name: '藏品 5' });
    expect(img.getAttribute('src')).toBe('/api/collection/items/5/original/');
    expect(view.getByText('预览不可用')).toBeTruthy();
    expect(view.getByText('预览：失败')).toBeTruthy();
    expect(view.getByText('（decode_error）')).toBeTruthy();
    expect(view.getByRole('link', { name: '查看原件' })).toBeTruthy();
  });

  it('prefers the playback version for audio and offers 打开原件 for documents', async () => {
    installFetch(routes(() => jsonResponse(imageDetail(5, {
      kind: 'audio',
      representations: [rep('audio_playback', 'succeeded')],
    }))));
    const audio = renderApp(['/library/items/5']);
    await dialog();
    const player = document.querySelector('audio');
    await waitFor(() => expect(document.querySelector('audio')).not.toBeNull());
    expect((player ?? document.querySelector('audio'))!.getAttribute('src'))
      .toBe('/api/collection/items/5/representations/audio_playback/content/');
    audio.unmount();
    unmockFetch();

    installFetch(routes(() => jsonResponse(imageDetail(5, {
      kind: 'document',
      representations: [rep('document_extracted_text', 'pending')],
    }))));
    renderApp(['/library/items/5']);
    const view = within(await dialog());
    expect((await view.findByRole('link', { name: '打开原件' })).getAttribute('href')).toBe('/api/collection/items/5/original/');
    expect(view.getByText('提取文本：处理中')).toBeTruthy();
  });

  it('says 原件不可用 without read_original', async () => {
    installFetch(routes(() => jsonResponse(imageDetail(5, {
      kind: 'document', representations: [], capabilities: ['update', 'delete'], original_content_url: null,
    }))));
    renderApp(['/library/items/5']);
    expect(await within(await dialog()).findByText('原件不可用')).toBeTruthy();
  });

  it('retries a retryable derivation and refreshes on derivation_not_retryable', async () => {
    let detailCalls = 0;
    let retryStatus = 409;
    const failed = rep('image_preview', 'failed', {
      retryable: true, retry_url: '/api/collection/items/5/representations/image_preview/retry/', error_code: 'timeout',
    });
    const { calls } = installFetch(routes(
      () => { detailCalls += 1; return jsonResponse(imageDetail(5, { representations: [failed] })); },
      [{
        test: '/api/collection/items/5/representations/image_preview/retry/', method: 'POST',
        handler: () => (retryStatus === 409
          ? jsonResponse({ error: 'no', code: 'derivation_not_retryable' }, 409)
          : jsonResponse(imageDetail(5, { representations: [rep('image_preview', 'pending')] }))),
      }],
    ));
    renderApp(['/library/items/5']);
    const view = within(await dialog());
    fireEvent.click(await view.findByRole('button', { name: '重试' }));
    expect(await view.findByText('当前状态不能重试，已刷新。')).toBeTruthy();
    await waitFor(() => expect(detailCalls).toBe(2));
    retryStatus = 200;
    fireEvent.click(view.getByRole('button', { name: '重试' }));
    expect(await view.findByText('预览：处理中')).toBeTruthy();
    expect(calls.filter((call) => call.url.pathname.endsWith('/retry/'))).toHaveLength(2);
  });
});

describe('Library edit (UI-C2)', () => {
  it('PATCHes, replaces the detail, patches the wall card and refreshes tags', async () => {
    let tagCalls = 0;
    const { calls } = installFetch([
      {
        test: '/api/collection/items/5/', method: 'PATCH',
        handler: () => jsonResponse(detailItem(5, { title: '新标题', description: '新描述', tags: ['Sea'] })),
      },
      { test: '/api/collection/tags/', handler: () => { tagCalls += 1; return jsonResponse(TAGS); } },
      ...routes(() => jsonResponse(detailItem(5))),
    ]);
    renderApp(['/library']);
    fireEvent.click(await screen.findByRole('link', { name: '藏品 5' }));
    const view = within(await dialog());
    fireEvent.click(await view.findByRole('button', { name: '编辑' }));
    fireEvent.change(view.getByLabelText('标题'), { target: { value: '新标题' } });
    fireEvent.change(view.getByLabelText('描述'), { target: { value: '新描述' } });
    fireEvent.change(view.getByLabelText(/这一件藏品的 Tags/), { target: { value: 'Sea, sea，  ' } });
    const tagsBefore = tagCalls;
    fireEvent.click(view.getByRole('button', { name: '保存' }));
    expect(await view.findByText('新描述')).toBeTruthy();
    const patch = calls.find((call) => call.init?.method === 'PATCH')!;
    expect(JSON.parse(String(patch.init!.body))).toEqual({
      title: '新标题', description: '新描述', collection_context: '', tags: ['Sea'],
    });
    expect(await within(screen.getByLabelText('藏品墙')).findByRole('link', { name: '新标题' })).toBeTruthy();
    await waitFor(() => expect(tagCalls).toBeGreaterThan(tagsBefore));
  });

  it('keeps the form on 400 and blocks an over-long description', async () => {
    installFetch([
      { test: '/api/collection/items/5/', method: 'PATCH', handler: () => jsonResponse({ error: 'bad', code: 'invalid_request' }, 400) },
      ...routes(() => jsonResponse(detailItem(5))),
    ]);
    renderApp(['/library/items/5']);
    const view = within(await dialog());
    fireEvent.click(await view.findByRole('button', { name: '编辑' }));
    fireEvent.change(view.getByLabelText('描述'), { target: { value: 'x'.repeat(501) } });
    expect(view.getByText(/501 \/ 500，超出上限/)).toBeTruthy();
    expect((view.getByRole('button', { name: '保存' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(view.getByLabelText('描述'), { target: { value: '保留我' } });
    fireEvent.click(view.getByRole('button', { name: '保存' }));
    expect(await view.findByText('内容不合法，未保存')).toBeTruthy();
    expect((view.getByLabelText('描述') as HTMLTextAreaElement).value).toBe('保留我');
  });

  it('offers manual calibration only for document extracted text and never submits blank', async () => {
    const doc = imageDetail(5, {
      kind: 'document', representations: [rep('document_extracted_text', 'succeeded', { canonical_text: 'OCR 文本' })],
    });
    const { calls } = installFetch([
      { test: '/api/collection/items/5/', method: 'PATCH', handler: () => jsonResponse(doc) },
      ...routes(() => jsonResponse(doc)),
    ]);
    renderApp(['/library/items/5']);
    const view = within(await dialog());
    fireEvent.click(await view.findByRole('button', { name: '人工校准' }));
    const field = view.getByLabelText('人工校准文本');
    expect((field as HTMLTextAreaElement).value).toBe('OCR 文本');
    fireEvent.change(field, { target: { value: '   ' } });
    expect((view.getByRole('button', { name: '保存校准' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(field, { target: { value: '校准后' } });
    fireEvent.click(view.getByRole('button', { name: '保存校准' }));
    await view.findByRole('button', { name: '人工校准' });
    const patch = calls.find((call) => call.init?.method === 'PATCH')!;
    expect(JSON.parse(String(patch.init!.body))).toEqual({
      manual_representation: { kind: 'document_extracted_text', canonical_text: '校准后' },
    });
  });

  it('has no calibration control for non-document kinds', async () => {
    installFetch(routes(() => jsonResponse(imageDetail(5))));
    renderApp(['/library/items/5']);
    const view = within(await dialog());
    await view.findByRole('button', { name: '编辑' });
    expect(view.queryByRole('button', { name: '人工校准' })).toBeNull();
  });
});
