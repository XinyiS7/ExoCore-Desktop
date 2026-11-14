import { describe, expect, it } from 'vitest';
import { renderV4 } from './helpers';
import { MessageTimeline } from '../features/chat/MessageTimeline';
import { normalizeMessageRow } from '../features/chat/api';
import { normalizePresentations } from '../features/chat/presentations/projection';
import type { MessageRow, MessageView } from '../features/chat/types';

/**
 * #130 CP5 — `<speak>` voice: the persisted voice whose `inline_tag_index`
 * names a speak card the body shows replaces that card's placeholder and
 * leaves the bottom media row; every other voice stays in the row.
 */

const rawVoice = (id: number, mediaId: number, inlineTagIndex?: unknown) => ({
  key: `assistant_artifact:${id}`,
  surface: 'voice',
  owner: 'send_voice_msg',
  position: id,
  label: '语音消息',
  card: null,
  media: {
    ref: { type: 'message_attachment', id: mediaId },
    kind: 'audio',
    source: 'voice_msg',
    status: 'ready',
    position: 0,
    display_name: `voice-${mediaId}`,
    mime_type: 'audio/wav',
    file_size: 2048,
    content_url: `/api/agents/conversations/42/message-attachments/${mediaId}/content/`,
    duration_ms: 1200,
    error_code: null,
  },
  ...(inlineTagIndex === undefined ? {} : { inline_tag_index: inlineTagIndex }),
});

const message = (content: string, presentations: unknown[]): MessageView =>
  normalizeMessageRow({
    id: 1,
    role: 'assistant',
    content,
    reasoning_content: null,
    platform: null,
    model_version: null,
    token_count: null,
    index_in_session: 1,
    attachment_ids: [],
    attachments: [],
    attachments_meta: null,
    client_turn_id: null,
    created_at: '2026-11-14T10:00:00Z',
    presentations,
  } as unknown as MessageRow);

function renderTimeline(messages: MessageView[]) {
  return renderV4(
    <MessageTimeline messages={messages} conversationId={42} hasOlder={false} loadingMore={false} onLoadMore={() => undefined} />,
  );
}

const srcs = (root: Element | null) =>
  Array.from(root?.querySelectorAll('audio') ?? []).map((a) => a.getAttribute('src'));

describe('presentations[] inline_tag_index', () => {
  it('a voice keeps a non-negative integer index; anything else is no index', () => {
    const items = normalizePresentations([
      rawVoice(1, 11, 2),
      rawVoice(2, 12),
      rawVoice(3, 13, null),
      rawVoice(4, 14, -1),
      rawVoice(5, 15, '1'),
      rawVoice(6, 16, 1.5),
    ]);
    expect(items.map((item) => item.inlineTagIndex)).toEqual([2, null, null, null, null, null]);
  });

  it('only a voice may name a speak tag', () => {
    const [image] = normalizePresentations([
      {
        ...rawVoice(1, 11, 0),
        surface: 'image',
        owner: 'agy_generate_image',
        media: { ...rawVoice(1, 11).media, kind: 'image', mime_type: 'image/png' },
      },
    ]);
    expect(image.inlineTagIndex).toBeNull();
  });
});

describe('speak card ← persisted voice', () => {
  it('the speak voice plays in its card; send_voice_msg stays in the bottom row', () => {
    const { container } = renderTimeline([
      message('先听<speak emotion="warm">你好</speak>然后', [rawVoice(1, 11), rawVoice(2, 12, 0)]),
    ]);
    const card = container.querySelector('[data-itag="speak"]');
    expect(srcs(card)).toEqual(['/api/agents/conversations/42/message-attachments/12/content/']);
    expect(card?.textContent).not.toContain('语音未完成');
    expect(card?.querySelector('.app-itag-speak-label')).toBeNull();
    expect(srcs(container.querySelector('[data-testid="message-presentation-media"]'))).toEqual([
      '/api/agents/conversations/42/message-attachments/11/content/',
    ]);
    expect(container.querySelectorAll('audio')).toHaveLength(2);
  });

  it('several speaks each get their own voice by tag index', () => {
    const { container } = renderTimeline([
      message('<speak>一</speak><roll=1d6><speak>二</speak>', [rawVoice(1, 11, 2), rawVoice(2, 12, 0)]),
    ]);
    const cards = container.querySelectorAll('[data-itag="speak"]');
    expect(Array.from(cards).map((card) => srcs(card))).toEqual([
      ['/api/agents/conversations/42/message-attachments/12/content/'],
      ['/api/agents/conversations/42/message-attachments/11/content/'],
    ]);
    expect(container.querySelector('[data-testid="message-presentation-media"]')).toBeNull();
  });

  it('a speak without a persisted voice keeps its placeholder', () => {
    const { container } = renderTimeline([message('<speak>你好</speak>', [])]);
    const card = container.querySelector('[data-itag="speak"]');
    expect(card?.querySelector('.app-itag-speak-label')?.textContent).toBe('语音');
    expect(container.querySelectorAll('audio')).toHaveLength(0);
  });

  it.each([
    ['edited away', '已经改掉了语音'],
    ['index now names another tag', '<timer=5s><speak>你好</speak>'],
    ['unclosed speak', '<speak>没说完'],
  ])('a voice whose speak card is not shown (%s) stays in the bottom row', (_label, content) => {
    const { container } = renderTimeline([message(content, [rawVoice(2, 12, 0)])]);
    expect(srcs(container.querySelector('[data-testid="message-presentation-media"]'))).toEqual([
      '/api/agents/conversations/42/message-attachments/12/content/',
    ]);
    expect(container.querySelectorAll('audio')).toHaveLength(1);
  });
});
