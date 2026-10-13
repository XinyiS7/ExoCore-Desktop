import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, screen, within } from '@testing-library/react';
import { installFetch, renderV4 } from './helpers';
import { MessageTimeline } from '../features/chat/MessageTimeline';
import { normalizeMessageRow } from '../features/chat/api';
import { normalizeAssistantArtifacts } from '../features/chat/artifacts/projection';
import type { MessageAttachmentView, MessageRow, MessageView } from '../features/chat/types';

const imageCardRaw = {
  ref: { type: 'assistant_artifact', id: 8 },
  producer: 'agy_generate_image',
  kind: 'image',
  position: 0,
  human: { title: '生成了图片', detail: '画面描述暂不可用' },
  collectible: false,
  presentation_attachment: { type: 'message_attachment', id: 12 },
};

const voiceAttachment: MessageAttachmentView = {
  key: 'message_attachment:11',
  ref: { type: 'message_attachment', id: 11 },
  kind: 'audio',
  source: 'voice_msg',
  status: 'ready',
  position: 0,
  displayName: 'voice-0.wav',
  mimeType: 'audio/wav',
  fileSize: 16000,
  contentUrl: '/api/agents/conversations/42/message-attachments/11/content/',
  durationMs: 3200,
  errorCode: null,
};

const imageAttachment: MessageAttachmentView = {
  key: 'message_attachment:12',
  ref: { type: 'message_attachment', id: 12 },
  kind: 'image',
  source: 'agy_image',
  status: 'ready',
  position: 1,
  displayName: 'image-0.png',
  mimeType: 'image/png',
  fileSize: 2048,
  contentUrl: '/api/agents/conversations/42/message-attachments/12/content/',
  durationMs: null,
  errorCode: null,
};

const makeMsg = (over: Partial<MessageView> = {}): MessageView => ({
  id: 1,
  role: 'assistant',
  content: '',
  reasoningContent: null,
  platform: null,
  modelVersion: null,
  tokenCount: null,
  indexInSession: 1,
  attachmentIds: [],
  attachmentsMeta: [],
  attachments: [],
  assistantArtifacts: [],
  createdAt: '2026-10-11T10:00:00Z',
  clientTurnId: null,
  ...over,
});

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

describe('AssistantArtifact projection (fail-closed)', () => {
  it('parses valid cards in (position, producer, id) order and drops malformed items', () => {
    const later = { ...imageCardRaw, ref: { type: 'assistant_artifact', id: 9 }, position: 1 };
    const file = {
      ...imageCardRaw,
      ref: { type: 'assistant_artifact', id: 7 },
      producer: 'a_file_producer',
      kind: 'file',
      human: { title: '生成了文件', detail: null },
      presentation_attachment: null,
    };
    const result = normalizeAssistantArtifacts([
      later,
      file,
      imageCardRaw,
      imageCardRaw, // duplicate key collapses
      { ...imageCardRaw, ref: { type: 'message_attachment', id: 99 } },
      { ...imageCardRaw, ref: { type: 'assistant_artifact', id: 100 }, kind: 'video' },
      { ...imageCardRaw, ref: { type: 'assistant_artifact', id: 101 }, human: { title: '', detail: null } },
      { ...imageCardRaw, ref: { type: 'assistant_artifact', id: 102 }, human: { title: 'x', detail: 3 } },
      { ...imageCardRaw, ref: { type: 'assistant_artifact', id: 103 }, collectible: 'no' },
      {
        ...imageCardRaw,
        ref: { type: 'assistant_artifact', id: 104 },
        presentation_attachment: { type: 'session_attachment', id: 1 },
      },
      'not-an-object',
    ]);
    expect(result.map((item) => item.key)).toEqual([
      'assistant_artifact:7',
      'assistant_artifact:8',
      'assistant_artifact:9',
    ]);
    expect(result[1]).toEqual({
      key: 'assistant_artifact:8',
      id: 8,
      producer: 'agy_generate_image',
      kind: 'image',
      position: 0,
      title: '生成了图片',
      detail: '画面描述暂不可用',
      collectible: false,
      presentationAttachmentKey: 'message_attachment:12',
    });
  });

  it('drops audio artifacts: voice has no user card (#51 E5)', () => {
    const legacyVoice = {
      ...imageCardRaw,
      ref: { type: 'assistant_artifact', id: 6 },
      producer: 'send_voice_msg',
      kind: 'audio',
      human: { title: '发送了语音', detail: null },
      presentation_attachment: { type: 'message_attachment', id: 11 },
    };
    expect(normalizeAssistantArtifacts([legacyVoice, imageCardRaw]).map((a) => a.key)).toEqual([
      'assistant_artifact:8',
    ]);
  });

  it('returns [] for absent or non-array data and for non-assistant rows', () => {
    expect(normalizeAssistantArtifacts(undefined)).toEqual([]);
    expect(normalizeAssistantArtifacts({ items: [imageCardRaw] })).toEqual([]);

    const base: MessageRow = {
      id: 5,
      role: 'user',
      content: 'hi',
      reasoning_content: null,
      attachments: [],
      attachments_meta: null,
      assistant_artifacts: [imageCardRaw],
      platform: null,
      model_version: null,
      token_count: null,
      index_in_session: 0,
      attachment_ids: [],
      client_turn_id: null,
      created_at: '2026-10-11T10:00:00Z',
    };
    expect(normalizeMessageRow(base).assistantArtifacts).toEqual([]);
    expect(
      normalizeMessageRow({ ...base, role: 'assistant' }).assistantArtifacts?.map((a) => a.key),
    ).toEqual(['assistant_artifact:8']);
  });
});

describe('AssistantArtifact cards in the timeline', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('voice message renders only its player: no card, no transcript prefetch', () => {
    const { fn } = installFetch([]);
    const { container } = renderTimeline([makeMsg({ attachments: [voiceAttachment] })]);

    expect(container.querySelectorAll('audio')).toHaveLength(1);
    expect(screen.queryByTestId('assistant-artifact-card')).toBeNull();
    expect(screen.queryByText('发送了语音')).toBeNull();
    expect(screen.queryByTestId('audio-transcript')).toBeNull();
    expect(screen.queryByText('（空消息）')).toBeNull();
    expect(fn.mock.calls.some(([url]) => String(url).includes('/transcript/'))).toBe(false);
  });

  it('image card shows unavailable description, renders the image once and never polls', () => {
    vi.useFakeTimers();
    const { fn } = installFetch([]);
    const [imageCard] = normalizeAssistantArtifacts([imageCardRaw]);
    const { container } = renderTimeline([
      makeMsg({ content: '画好了', attachments: [imageAttachment], assistantArtifacts: [imageCard] }),
    ]);

    expect(container.querySelectorAll('img')).toHaveLength(1);
    const card = screen.getByTestId('assistant-artifact-card');
    expect(within(card).getByText('生成了图片')).toBeTruthy();
    expect(within(card).getByText('画面描述暂不可用')).toBeTruthy();

    const callsBefore = fn.mock.calls.length;
    act(() => {
      vi.advanceTimersByTime(120_000);
    });
    expect(fn.mock.calls.length).toBe(callsBefore);
  });

  it('renders several cards in order on an artifact-only message without a collect entry', () => {
    const cards = normalizeAssistantArtifacts([
      { ...imageCardRaw, ref: { type: 'assistant_artifact', id: 9 }, position: 1, presentation_attachment: null },
      { ...imageCardRaw, human: { title: '生成了图片', detail: '海边的灯塔' } },
    ]);
    renderTimeline([
      makeMsg({ attachments: [voiceAttachment, imageAttachment], assistantArtifacts: cards }),
    ]);

    const rendered = screen.getAllByTestId('assistant-artifact-card');
    expect(rendered.map((node) => node.textContent)).toEqual([
      '生成了图片海边的灯塔',
      '生成了图片画面描述暂不可用',
    ]);
    expect(within(rendered[0]).getByText('海边的灯塔')).toBeTruthy();
    expect(screen.queryByText('（空消息）')).toBeNull();
    expect(screen.queryByRole('button', { name: '收藏此条消息' })).toBeNull();
  });
});

describe('Collection bring-back cards (#54)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const longDetail = '全文：\n' + '藏品文字'.repeat(800); // 3204 chars, past the 2000 cap
  const collectionRaw = (id: number, producer: string, kind: string, attachmentId: number | null) => ({
    ref: { type: 'assistant_artifact', id },
    producer,
    kind,
    position: 0,
    human: { title: `从藏品馆带回 · 文本 #${id}`, detail: longDetail },
    collectible: false,
    presentation_attachment:
      attachmentId === null ? null : { type: 'message_attachment', id: attachmentId },
  });

  const collectionAttachment = (
    id: number,
    kind: 'audio' | 'file',
    displayName: string,
    mimeType: string,
  ): MessageAttachmentView => ({
    key: `message_attachment:${id}`,
    ref: { type: 'message_attachment', id },
    kind,
    source: 'collection_item',
    status: 'ready',
    position: 0,
    displayName,
    mimeType,
    fileSize: 4096,
    contentUrl: `/api/agents/conversations/42/message-attachments/${id}/content/`,
    durationMs: kind === 'audio' ? 1000 : null,
    errorCode: null,
  });

  it('accepts four kinds for both collection producers with the full detail', () => {
    const parsed = normalizeAssistantArtifacts([
      collectionRaw(21, 'collection_bring_back', 'text', null),
      collectionRaw(22, 'collection_bring_back', 'image', 31),
      collectionRaw(23, 'collection_heartbeat_bring_back', 'audio', 32),
      collectionRaw(24, 'collection_heartbeat_bring_back', 'file', 33),
      collectionRaw(25, 'collection_bring_back', 'video', null),
    ]);
    expect(parsed.map((item) => [item.id, item.kind])).toEqual([
      [21, 'text'],
      [22, 'image'],
      [23, 'audio'],
      [24, 'file'],
    ]);
    expect(parsed.every((item) => item.detail === longDetail)).toBe(true);
  });

  it('keeps the old rules for every other producer', () => {
    const parsed = normalizeAssistantArtifacts([
      { ...imageCardRaw, ref: { type: 'assistant_artifact', id: 40 }, human: { title: 't', detail: longDetail } },
      { ...collectionRaw(41, 'some_producer', 'text', null) },
      { ...collectionRaw(42, 'send_voice_msg', 'audio', 11), human: { title: '发送了语音', detail: null } },
      { ...imageCardRaw, ref: { type: 'assistant_artifact', id: 43 }, human: { title: 't', detail: 'x'.repeat(2000) } },
    ]);
    expect(parsed.map((item) => item.id)).toEqual([43]);
  });

  it('renders a heartbeat artifact-only message: marked card, full detail, no empty bubble, no collect', () => {
    const [card] = normalizeAssistantArtifacts([
      collectionRaw(21, 'collection_heartbeat_bring_back', 'text', null),
    ]);
    renderTimeline([makeMsg({ platform: 'PushService', assistantArtifacts: [card] })]);

    const node = screen.getByTestId('assistant-artifact-card');
    expect(node.className).toContain('app-artifact-card--collection');
    expect(node.getAttribute('data-kind')).toBe('text');
    expect(within(node).getByText('从藏品馆带回 · 文本 #21')).toBeTruthy();
    expect(node.querySelector('.app-artifact-card-detail')?.textContent).toBe(longDetail);
    expect(screen.queryByText('（空消息）')).toBeNull();
    expect(screen.queryByRole('button', { name: '收藏此条消息' })).toBeNull();
    expect(node.querySelector('button')).toBeNull();
  });

  it('collection audio plays once and never enters the voice transcript path', () => {
    const { fn } = installFetch([]);
    const audio = collectionAttachment(32, 'audio', 'song.mp3', 'audio/mpeg');
    const [card] = normalizeAssistantArtifacts([
      collectionRaw(23, 'collection_bring_back', 'audio', 32),
    ]);
    const { container } = renderTimeline([
      makeMsg({ attachments: [audio], assistantArtifacts: [card] }),
    ]);

    const players = container.querySelectorAll('audio');
    expect(players).toHaveLength(1);
    act(() => {
      players[0].dispatchEvent(new Event('ended'));
    });
    expect(fn.mock.calls.some(([url]) => String(url).includes('/transcript/'))).toBe(false);
    expect(screen.queryByTestId('audio-transcript')).toBeNull();
    expect(screen.getByTestId('assistant-artifact-card').className).toContain(
      'app-artifact-card--collection',
    );
  });

  it('fallback file is a same-origin download link; other file cards stay inert', () => {
    const fallback = collectionAttachment(33, 'file', 'photo.heic', 'image/heic');
    const userFile: MessageAttachmentView = {
      ...collectionAttachment(34, 'file', 'notes.pdf', 'application/pdf'),
      position: 1,
      source: 'agy_image',
    };
    const [card] = normalizeAssistantArtifacts([
      {
        ...collectionRaw(24, 'collection_bring_back', 'file', 33),
        human: { title: '从藏品馆带回 · 图片 #24', detail: null },
      },
    ]);
    const { container } = renderTimeline([
      makeMsg({ attachments: [fallback, userFile], assistantArtifacts: [card] }),
    ]);

    const links = container.querySelectorAll('a.app-att-filecard');
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toBe(fallback.contentUrl);
    expect(links[0].getAttribute('download')).toBe('photo.heic');
    expect(container.querySelectorAll('div.app-att-filecard')).toHaveLength(1);
    expect(container.querySelectorAll('img')).toHaveLength(0);
    expect(within(screen.getByTestId('assistant-artifact-card')).getByText('从藏品馆带回 · 图片 #24')).toBeTruthy();
  });
});
