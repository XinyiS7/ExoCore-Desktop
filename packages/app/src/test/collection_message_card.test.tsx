import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { installFetch, jsonResponse, renderV4, unmockFetch } from './helpers';
import { Route, Routes } from 'react-router-dom';
import { MessageTimeline } from '../features/chat/MessageTimeline';
import { normalizeMessageRow } from '../features/chat/api';
import { normalizePresentations } from '../features/chat/presentations/projection';
import type { MessageRow, MessageView } from '../features/chat/types';
import { detailItem } from './collection_fixtures';

const FULL_TEXT = '你不用急着把它想清楚，\n先放在这里，\n我替你记着。'.repeat(20);

const LABELS: Record<string, string> = { text: '文本', image: '图片', audio: '音频', document: '文档' };

const showCard = (
  key: string,
  itemId: number,
  kind: string,
  position: number,
  extra: { detail?: string | null; text?: string | null; media?: Record<string, unknown> | null } = {},
) => {
  const title = `从藏品馆带回 · ${LABELS[kind]} #${itemId}`;
  return {
    key,
    surface: 'collection_card',
    owner: key.startsWith('user_') ? 'user_collection_show' : 'collection_bring_back',
    position,
    label: title,
    card: { item_id: itemId, item_kind: kind, title, detail: extra.detail ?? null, text: extra.text ?? null },
    media: extra.media ?? null,
  };
};

const userShow = (itemId: number, kind: string, position: number, extra = {}) =>
  showCard(`user_collection_show:${itemId}`, itemId, kind, position, extra);

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

describe('one CollectionShowCard for both speakers (#61 D10 / #84)', () => {
  it('user and agent collection_card items normalize to the same card shape', () => {
    const [human, agent] = normalizePresentations([
      userShow(12, 'text', 0, { detail: '收藏理由：想一直留着。', text: FULL_TEXT }),
      showCard('assistant_artifact:7', 12, 'text', 0, { detail: '收藏理由：想一直留着。', text: FULL_TEXT }),
    ]);
    const { key: humanKey, ...humanRest } = human.card!;
    const { key: agentKey, ...agentRest } = agent.card!;
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

  it('drops malformed cards individually, keeps backend order and text only for text cards', () => {
    const items = normalizePresentations([
      userShow(1, 'text', 0, { text: '正文' }),
      userShow(9, 'video', 1),
      { ...userShow(8, 'image', 1), card: { ...userShow(8, 'image', 1).card, text: 'not allowed' } },
      { ...userShow(4, 'audio', 1), card: { ...userShow(4, 'audio', 1).card, item_id: 0 } },
      userShow(2, 'document', 1, { detail: '' }),
      userShow(3, 'image', 2),
    ]);
    expect(items.map((i) => [i.card?.itemId, i.card?.itemKind, i.card?.text, i.card?.detail])).toEqual([
      [1, 'text', '正文', null],
      [2, 'document', null, null],
      [3, 'image', null, null],
    ]);
    expect(normalizePresentations('nope')).toEqual([]);
  });
});

describe('message-side cards (#61 CP5)', () => {
  it('a card-only user message: no empty bubble, full text inside the card, never in the body text', () => {
    const msg = normalizeMessageRow(
      row({ presentations: [userShow(12, 'text', 0, { detail: '收藏理由：想一直留着。', text: FULL_TEXT })] }),
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
        presentations: [showCard('assistant_artifact:7', 19, 'text', 0, { text: FULL_TEXT })],
      }),
    );
    const { container } = renderTimeline([msg]);
    const card = screen.getByTestId('collection-show-card');
    expect(card.querySelector('.app-collection-show-text')?.textContent).toBe(FULL_TEXT);
    expect(card.querySelector('.app-collection-show-detail')).toBeNull();
    expect(container.querySelector('.app-msg-body--with-cards')).toBeNull();
  });

  it('a user media card renders its collection_item file once as a same-origin download', () => {
    const msg = normalizeMessageRow(
      row({
        content: '这件一起看看？',
        presentations: [userShow(31, 'document', 0, {
          detail: '收藏理由：那篇。',
          media: {
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
          },
        })],
      }),
    );
    const { container } = renderTimeline([msg]);
    const links = container.querySelectorAll('a[download]');
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toBe('/api/agents/conversations/42/message-attachments/77/content/');
    const body = container.querySelector('.app-msg-attachments')?.parentElement;
    expect(body?.classList.contains('app-msg-body--with-cards')).toBe(true);
    const card = screen.getByTestId('collection-show-card');
    expect(card.querySelector('a, img, audio')).toBeNull();
    expect(card.querySelector('.app-collection-show-text')).toBeNull();
    expect(container.querySelector('.app-msg-body--cards-only')).toBeNull();
  });

  it('clicking a card opens /library/items/N after a read-only check', async () => {
    const { calls } = installFetch([
      { test: '/api/collection/items/12/', method: 'GET', handler: () => jsonResponse(detailItem(12)) },
    ]);
    renderTimeline([normalizeMessageRow(row({ presentations: [userShow(12, 'image', 0)] }))]);
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
      normalizeMessageRow(row({ presentations: [userShow(12, 'text', 0, { text: '正文' })] })),
    ]);
    fireEvent.click(screen.getByRole('button', { name: '从藏品馆带回 · 文本 #12' }));
    expect(await screen.findByText('藏品已不存在（聊天里的卡片保持原样）')).toBeTruthy();
    expect(screen.queryByText('Library item page')).toBeNull();
    expect(screen.getByTestId('collection-show-card').textContent).toContain('正文');
  });
});
