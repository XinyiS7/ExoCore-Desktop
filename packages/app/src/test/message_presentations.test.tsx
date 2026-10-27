import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, within } from '@testing-library/react';
import { installFetch, jsonResponse, renderV4 } from './helpers';
import { MessageTimeline } from '../features/chat/MessageTimeline';
import { normalizeMessageRow } from '../features/chat/api';
import { normalizePresentations } from '../features/chat/presentations/projection';
import type { MessageRow, MessageView } from '../features/chat/types';

const rawMedia = (id: number, kind: string, source: string, extra: Record<string, unknown> = {}) => ({
  ref: { type: 'message_attachment', id },
  kind,
  source,
  status: 'ready',
  position: 0,
  display_name: `${source}-${id}`,
  mime_type: kind === 'audio' ? 'audio/wav' : kind === 'image' ? 'image/png' : 'application/pdf',
  file_size: 2048,
  content_url: `/api/agents/conversations/42/message-attachments/${id}/content/`,
  duration_ms: kind === 'audio' ? 1200 : null,
  error_code: null,
  ...extra,
});

const rawImage = (id: number, mediaId: number, position = 0) => ({
  key: `assistant_artifact:${id}`,
  surface: 'image',
  owner: 'agy_generate_image',
  position,
  label: '生成的图片',
  card: null,
  media: rawMedia(mediaId, 'image', 'agy_image'),
});

const rawVoice = (id: number, mediaId: number, position = 0) => ({
  key: `assistant_artifact:${id}`,
  surface: 'voice',
  owner: 'send_voice_msg',
  position,
  label: '语音消息',
  card: null,
  media: rawMedia(mediaId, 'audio', 'voice_msg'),
});

const TITLES: Record<string, string> = { text: '文本', image: '图片', audio: '音频', document: '文档' };

const rawCard = (
  key: string,
  itemId: number,
  itemKind: string,
  media: Record<string, unknown> | null,
  extra: { detail?: string | null; text?: string | null; owner?: string } = {},
) => ({
  key,
  surface: 'collection_card',
  owner: extra.owner ?? (key.startsWith('user_') ? 'user_collection_show' : 'collection_bring_back'),
  position: 0,
  label: `从藏品馆带回 · ${TITLES[itemKind]} #${itemId}`,
  card: {
    item_id: itemId,
    item_kind: itemKind,
    title: `从藏品馆带回 · ${TITLES[itemKind]} #${itemId}`,
    detail: extra.detail ?? null,
    text: extra.text ?? null,
  },
  media,
});

const row = (overrides: Partial<MessageRow> & Record<string, unknown>): MessageRow => ({
  id: 1,
  role: 'assistant',
  content: '',
  reasoning_content: null,
  platform: null,
  model_version: null,
  token_count: null,
  index_in_session: 1,
  attachment_ids: [],
  attachments: [],
  attachments_meta: null,
  client_turn_id: null,
  created_at: '2026-10-24T10:00:00Z',
  ...overrides,
}) as MessageRow;

const message = (overrides: Partial<MessageRow> & Record<string, unknown>): MessageView =>
  normalizeMessageRow(row(overrides));

function renderTimeline(messages: MessageView[]) {
  return renderV4(
    <MessageTimeline
      messages={messages}
      conversationId={42}
      hasOlder={false}
      loadingMore={false}
      onLoadMore={() => undefined}
    />,
  );
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('presentations[] projection (#84 C3.1 / C3.7)', () => {
  it('keeps backend order and maps each surface with card always present', () => {
    const items = normalizePresentations([
      rawVoice(2, 11),
      rawImage(3, 12, 1),
      rawCard('assistant_artifact:4', 9, 'text', null, { text: '全文' }),
    ]);
    expect(items.map((item) => [item.key, item.surface, item.card?.title ?? null])).toEqual([
      ['assistant_artifact:2', 'voice', null],
      ['assistant_artifact:3', 'image', null],
      ['assistant_artifact:4', 'collection_card', '从藏品馆带回 · 文本 #9'],
    ]);
    expect(items[1].media).toMatchObject({
      key: 'message_attachment:12',
      kind: 'image',
      contentUrl: '/api/agents/conversations/42/message-attachments/12/content/',
    });
    expect(items[2].card).toEqual({
      key: 'assistant_artifact:4',
      itemId: 9,
      itemKind: 'text',
      title: '从藏品馆带回 · 文本 #9',
      detail: null,
      text: '全文',
    });
  });

  it('drops unknown surfaces and malformed items without touching valid siblings', () => {
    const valid = rawImage(3, 12);
    const items = normalizePresentations([
      { ...rawImage(5, 13), surface: 'html' },
      { ...rawImage(6, 14), card: { item_id: 1 } },
      { ...rawImage(7, 15), media: null },
      { ...rawImage(8, 16), media: rawMedia(16, 'audio', 'voice_msg') },
      { ...rawVoice(9, 17), media: rawMedia(17, 'audio', 'voice_msg', { status: 'pending' }) },
      { ...rawImage(10, 18), media: { ...rawMedia(18, 'image', 'agy_image'), ref: { type: 'session_attachment', id: 18 } } },
      { ...rawCard('user_collection_show:11', 4, 'image', null), card: null },
      { ...rawCard('user_collection_show:12', 4, 'video', null) },
      { ...rawCard('user_collection_show:13', 4, 'image', null), card: { ...rawCard('x', 4, 'image', null).card, text: 'no' } },
      { ...valid, key: 'message_attachment:12' },
      'not-an-object',
      valid,
      valid,
    ]);
    expect(items.map((item) => item.key)).toEqual(['assistant_artifact:3']);
    expect(normalizePresentations(undefined)).toEqual([]);
    expect(normalizePresentations({ items: [valid] })).toEqual([]);
  });

  it('a collection card without media keeps the card with media=null', () => {
    const [item] = normalizePresentations([rawCard('user_collection_show:2', 5, 'image', null)]);
    expect(item.media).toBeNull();
    expect(item.card?.itemId).toBe(5);
  });

  it('the API adapter emits presentations and no longer reads the removed fields', () => {
    const view = message({
      presentations: [rawImage(3, 12)],
      assistant_artifacts: [{ ref: { type: 'assistant_artifact', id: 3 } }],
      collection_shows: [{ key: 'user_collection_show:1' }],
    });
    expect(view.presentations?.map((item) => item.key)).toEqual(['assistant_artifact:3']);
    expect(Object.keys(view)).not.toContain('assistantArtifacts');
    expect(Object.keys(view)).not.toContain('collectionShows');
    expect(message({ presentations: 'nope' }).presentations).toEqual([]);
  });
});

describe('surfaces in the timeline (#84 C3.4 / C3.5)', () => {
  it('a generated image shows only the image: no description box, no card, never polls', () => {
    vi.useFakeTimers();
    const { fn } = installFetch([]);
    const { container } = renderTimeline([message({ content: '画好了', presentations: [rawImage(3, 12)] })]);

    expect(container.querySelectorAll('.app-msg-body img')).toHaveLength(1);
    expect(screen.queryByTestId('assistant-artifact-card')).toBeNull();
    expect(screen.queryByText('生成了图片')).toBeNull();
    expect(screen.queryByText('画面描述暂不可用')).toBeNull();
    const callsBefore = fn.mock.calls.length;
    act(() => {
      vi.advanceTimersByTime(120_000);
    });
    expect(fn.mock.calls.length).toBe(callsBefore);
  });

  it('voice renders one player and fetches its transcript only after natural end', async () => {
    const { fn } = installFetch([
      { test: /\/transcript\//, handler: () => jsonResponse({ transcript: '说出口的话' }) },
    ]);
    const { container } = renderTimeline([message({ presentations: [rawVoice(2, 11)] })]);

    const players = container.querySelectorAll('audio');
    expect(players).toHaveLength(1);
    expect(screen.queryByText('（空消息）')).toBeNull();
    expect(fn.mock.calls.some(([url]) => String(url).includes('/transcript/'))).toBe(false);
    act(() => {
      fireEvent.ended(players[0]);
    });
    expect(await screen.findByText('说出口的话')).toBeTruthy();
    expect(
      fn.mock.calls.filter(([url]) => String(url).includes('/message-attachments/11/transcript/')),
    ).toHaveLength(1);
  });

  it('collection audio plays once and never enters the voice transcript path', () => {
    const { fn } = installFetch([]);
    const { container } = renderTimeline([
      message({
        presentations: [
          rawCard('assistant_artifact:23', 23, 'audio', rawMedia(32, 'audio', 'collection_item')),
        ],
      }),
    ]);
    const players = container.querySelectorAll('audio');
    expect(players).toHaveLength(1);
    act(() => {
      fireEvent.ended(players[0]);
    });
    expect(fn.mock.calls.some(([url]) => String(url).includes('/transcript/'))).toBe(false);
    expect(screen.queryByTestId('audio-transcript')).toBeNull();
    const card = screen.getByTestId('assistant-artifact-card');
    expect(card.className).toContain('app-artifact-card--collection');
    expect(card.querySelector('audio, img, a')).toBeNull();
  });

  it('a heartbeat card-only message: shared card, full reason, no empty bubble, no collect', () => {
    const longDetail = '收藏理由：' + '藏品文字'.repeat(800);
    renderTimeline([
      message({
        platform: 'PushService',
        presentations: [
          rawCard('assistant_artifact:21', 21, 'text', null, {
            owner: 'collection_heartbeat_bring_back',
            detail: longDetail,
            text: '全文',
          }),
        ],
      }),
    ]);
    const node = screen.getByTestId('assistant-artifact-card');
    expect(node.getAttribute('data-producer')).toBe('collection_heartbeat_bring_back');
    expect(node.querySelector('.app-collection-show-detail')?.textContent).toBe(longDetail);
    expect(node.querySelector('.app-collection-show-text')?.textContent).toBe('全文');
    expect(screen.queryByText('（空消息）')).toBeNull();
    expect(screen.queryByRole('button', { name: '收藏此条消息' })).toBeNull();
  });

  it('a fallback collection file is a same-origin download, rendered once beside its card', () => {
    const { container } = renderTimeline([
      message({
        presentations: [
          rawCard('assistant_artifact:24', 24, 'image', rawMedia(33, 'file', 'collection_item', {
            display_name: 'photo.heic',
            mime_type: 'image/heic',
          })),
        ],
      }),
    ]);
    const links = container.querySelectorAll('a.app-att-filecard');
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toBe('/api/agents/conversations/42/message-attachments/33/content/');
    expect(links[0].getAttribute('download')).toBe('photo.heic');
    expect(container.querySelectorAll('.app-msg-body img')).toHaveLength(0);
    expect(within(screen.getByTestId('assistant-artifact-card')).getByText('从藏品馆带回 · 图片 #24')).toBeTruthy();
  });

  it('a presentation-only message lists gate items, disabled without collectible (#74 fail-closed)', () => {
    renderTimeline([
      message({
        presentations: [
          rawVoice(2, 11),
          rawImage(3, 12, 1),
          rawCard('assistant_artifact:4', 9, 'image', rawMedia(13, 'image', 'collection_item')),
        ],
      }),
    ]);
    expect(screen.queryByText('（空消息）')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '收藏此条消息' }));
    expect(screen.queryByRole('menuitem', { name: '收藏正文' })).toBeNull();
    const items = screen.getAllByRole('menuitem');
    expect(items.map((item) => item.textContent?.replace('不可收藏', ''))).toEqual([
      '语音消息 · 0:01',
      '生成的图片',
    ]);
    for (const item of items) expect(item).toBeDisabled();
  });

  it('a message with nothing presented still says it is empty', () => {
    renderTimeline([message({ presentations: [] })]);
    expect(screen.getByText('（空消息）')).toBeTruthy();
  });
});
