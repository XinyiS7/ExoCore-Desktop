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
