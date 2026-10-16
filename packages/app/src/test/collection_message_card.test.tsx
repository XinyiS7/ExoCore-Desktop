import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { installFetch, jsonResponse, renderV4, unmockFetch } from './helpers';
import { Route, Routes } from 'react-router-dom';
import { MessageTimeline } from '../features/chat/MessageTimeline';
import { normalizeMessageRow } from '../features/chat/api';
import {
  collectionShowCardFromArtifact,
  normalizeCollectionShows,
} from '../features/chat/artifacts/collectionShowCard';
import { normalizeAssistantArtifacts } from '../features/chat/artifacts/projection';
import type { MessageRow, MessageView } from '../features/chat/types';
import { detailItem } from './collection_fixtures';

const FULL_TEXT = '你不用急着把它想清楚，\n先放在这里，\n我替你记着。'.repeat(20);

const userShow = (itemId: number, kind: string, position: number, extra: Record<string, unknown> = {}) => ({
  key: `user_collection_show:${itemId}`,
  item_id: itemId,
  item_kind: kind,
  position,
  title: `从藏品馆带回 · ${{ text: '文本', image: '图片', audio: '音频', document: '文档' }[kind]} #${itemId}`,
  ...extra,
});

const agentArtifact = (id: number, kind: string, human: Record<string, unknown>) => ({
  ref: { type: 'assistant_artifact', id },
  producer: 'collection_bring_back',
  kind,
  position: 0,
  human,
  collectible: false,
  presentation_attachment: null,
});

const row = (overrides: Partial<MessageRow> & Record<string, unknown>): MessageRow => ({
  id: 1,
  role: 'user',
  content: '',
  reasoning_content: null,
  platform: null,
  model_version: null,
  token_count: null,
  index_in_session: 0,
  attachment_ids: [],
  attachments_meta: null,
  created_at: '2026-10-16T10:00:00Z',
  ...overrides,
}) as MessageRow;

function renderTimeline(messages: MessageView[]) {
  return renderV4(
    <Routes>
      <Route
        path="/chat/42"
        element={
          <MessageTimeline
            messages={messages}
            conversationId={42}
            hasOlder={false}
            loadingMore={false}
            onLoadMore={() => undefined}
          />
        }
      />
      <Route path="/library/items/:itemId" element={<p>Library item page</p>} />
    </Routes>,
    ['/chat/42'],
  );
}

afterEach(() => unmockFetch());

describe('one CollectionShowCard for both speakers (#61 D10)', () => {
  it('collection_shows[] and a collection artifact normalize to the same card shape', () => {
    const [human] = normalizeCollectionShows([
      userShow(12, 'text', 0, { detail: '收藏理由：想一直留着。', text: FULL_TEXT }),
    ]);
    const [artifact] = normalizeAssistantArtifacts([
      agentArtifact(7, 'text', {
        title: '从藏品馆带回 · 文本 #12',
        detail: '收藏理由：想一直留着。',
        text: FULL_TEXT,
      }),
    ]);
    const agent = collectionShowCardFromArtifact(artifact);
    const { key: humanKey, ...humanRest } = human;
    const { key: agentKey, ...agentRest } = agent;
    expect(humanKey).toBe('user_collection_show:12');
    expect(agentKey).toBe('assistant_artifact:7');
    expect(agentRest).toEqual(humanRest);
    expect(humanRest).toEqual({
      itemId: 12,
      itemKind: 'text',
      title: '从藏品馆带回 · 文本 #12',
      detail: '收藏理由：想一直留着。',
      text: FULL_TEXT,
    });
  });

  it('drops malformed shows individually, orders by position and keeps text only for text cards', () => {
    const cards = normalizeCollectionShows([
      userShow(3, 'image', 2),
      userShow(1, 'text', 0, { text: '正文' }),
      { ...userShow(9, 'video', 1) },
      { ...userShow(8, 'image', 1), text: 'not allowed' },
      { ...userShow(4, 'audio', 1), item_id: 0 },
      userShow(2, 'document', 1, { detail: '' }),
      userShow(1, 'text', 5),
    ]);
    expect(cards.map((c) => [c.itemId, c.itemKind, c.text, c.detail])).toEqual([
      [1, 'text', '正文', null],
      [2, 'document', null, null],
      [3, 'image', null, null],
    ]);
    expect(normalizeCollectionShows('nope')).toEqual([]);
  });

  it('an artifact title outside the fixed form keeps a readable card without a link', () => {
    const [artifact] = normalizeAssistantArtifacts([
      agentArtifact(7, 'image', { title: '某张图', detail: null }),
    ]);
    expect(collectionShowCardFromArtifact(artifact)).toMatchObject({ itemId: null, itemKind: null });
  });

  it('the API adapter emits collectionShows on user rows only', () => {
    const shows = [userShow(5, 'text', 0, { text: 't' })];
    expect(normalizeMessageRow(row({ collection_shows: shows })).collectionShows).toHaveLength(1);
    expect(
      normalizeMessageRow(row({ role: 'assistant', collection_shows: shows })).collectionShows,
    ).toEqual([]);
  });
});

describe('message-side cards (#61 CP5)', () => {
  it('a card-only user message: no empty bubble, full text inside the card, never in the body text', () => {
    const msg = normalizeMessageRow(
      row({ collection_shows: [userShow(12, 'text', 0, { detail: '收藏理由：想一直留着。', text: FULL_TEXT })] }),
    );
    const { container } = renderTimeline([msg]);
    expect(screen.queryByText('（空消息）')).toBeNull();
    expect(container.querySelector('.app-msg-body--cards-only')).toBeTruthy();
    expect(container.querySelector('.app-md')).toBeNull();
    const card = screen.getByTestId('collection-show-card');
    expect(card.querySelector('.app-collection-show-text')?.textContent).toBe(FULL_TEXT);
    expect(within(card).getByText('收藏理由：想一直留着。')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '收藏此条消息' })).toBeNull();
  });

  it('the Agent text card shows the same full text through the same view', () => {
    const msg = normalizeMessageRow(
      row({
        role: 'assistant',
        content: '我也翻出一件。',
        assistant_artifacts: [
          agentArtifact(7, 'text', { title: '从藏品馆带回 · 文本 #19', detail: null, text: FULL_TEXT }),
        ],
      }),
    );
    renderTimeline([msg]);
    const card = screen.getByTestId('collection-show-card');
    expect(card.querySelector('.app-collection-show-text')?.textContent).toBe(FULL_TEXT);
    expect(card.querySelector('.app-collection-show-detail')).toBeNull();
  });

  it('a user media card renders its collection_item file once as a same-origin download', () => {
    const msg = normalizeMessageRow(
      row({
        content: '这件一起看看？',
        attachments: [{
          ref: { type: 'message_attachment', id: 77 },
          kind: 'file',
          source: 'collection_item',
          status: 'ready',
          position: 0,
          display_name: '记忆压缩.pdf',
          mime_type: 'application/pdf',
          file_size: 2048,
          content_url: '/api/agents/conversations/42/message-attachments/77/content/',
          duration_ms: null,
          error_code: null,
        }],
        collection_shows: [userShow(31, 'document', 0, { detail: '收藏理由：那篇。' })],
      }),
    );
    const { container } = renderTimeline([msg]);
    const links = container.querySelectorAll('a[download]');
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toBe('/api/agents/conversations/42/message-attachments/77/content/');
    const card = screen.getByTestId('collection-show-card');
    expect(card.querySelector('a, img, audio')).toBeNull();
    expect(card.querySelector('.app-collection-show-text')).toBeNull();
    expect(container.querySelector('.app-msg-body--cards-only')).toBeNull();
  });

  it('clicking a card opens /library/items/N after a read-only check', async () => {
    const { calls } = installFetch([
      { test: '/api/collection/items/12/', method: 'GET', handler: () => jsonResponse(detailItem(12)) },
    ]);
    renderTimeline([normalizeMessageRow(row({ collection_shows: [userShow(12, 'image', 0)] }))]);
    fireEvent.click(screen.getByRole('button', { name: '从藏品馆带回 · 图片 #12' }));
    expect(await screen.findByText('Library item page')).toBeTruthy();
    expect(calls.every((c) => (c.init?.method ?? 'GET') === 'GET')).toBe(true);
  });

  it('a deleted item keeps the card as sent and says so', async () => {
    installFetch([
      {
        test: '/api/collection/items/12/',
        method: 'GET',
        handler: () => jsonResponse({ error: 'gone', code: 'collection_item_not_found' }, 404),
      },
    ]);
    renderTimeline([
      normalizeMessageRow(row({ collection_shows: [userShow(12, 'text', 0, { text: '正文' })] })),
    ]);
    fireEvent.click(screen.getByRole('button', { name: '从藏品馆带回 · 文本 #12' }));
    expect(await screen.findByText('藏品已不存在（聊天里的卡片保持原样）')).toBeTruthy();
    expect(screen.queryByText('Library item page')).toBeNull();
    expect(screen.getByTestId('collection-show-card').textContent).toContain('正文');
  });
});
