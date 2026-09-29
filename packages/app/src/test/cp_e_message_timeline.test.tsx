import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderV4 } from './helpers';
import { MessageTimeline } from '../features/chat/MessageTimeline';
import type { MessageAttachmentView, MessageView } from '../features/chat/types';
import type { RuntimeAssistantRow } from '../features/chat/runtime/types';

describe('CP-E E2 — canonical player and voice-only row', () => {
  const readyVoiceAttachment: MessageAttachmentView = {
    key: 'message_attachment:1',
    ref: { type: 'message_attachment', id: 1 },
    kind: 'audio',
    source: 'voice_msg',
    status: 'ready',
    position: 0,
    displayName: 'voice_0.wav',
    mimeType: 'audio/wav',
    fileSize: 16000,
    contentUrl: '/api/agents/conversations/42/message-attachments/1/content/',
    durationMs: 2500,
    errorCode: null,
  };

  const pendingVoiceAttachment: MessageAttachmentView = {
    ...readyVoiceAttachment,
    status: 'pending',
    contentUrl: null,
  };

  const failedVoiceAttachment: MessageAttachmentView = {
    ...readyVoiceAttachment,
    status: 'failed',
    contentUrl: null,
    errorCode: 'synthesis_failed',
  };

  const imageAttachment: MessageAttachmentView = {
    key: 'session_attachment:5',
    ref: { type: 'session_attachment', id: 5 },
    kind: 'image',
    source: 'user',
    status: 'ready',
    position: 0,
    displayName: 'chart.png',
    mimeType: 'image/png',
    fileSize: 45000,
    contentUrl: null,
    durationMs: null,
    errorCode: null,
    fileUri: 'https://cdn.example/chart.png',
  };

  const makeMsg = (over: Partial<MessageView> = {}): MessageView => ({
    id: 1,
    role: 'assistant',
    content: '',
    reasoningContent: null,
    platform: null,
    modelVersion: null,
    tokenCount: null,
    indexInSession: 0,
    attachmentIds: [],
    attachmentsMeta: [],
    attachments: [],
    createdAt: '2026-09-29T10:00:00Z',
    clientTurnId: null,
    ...over,
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders exactly one audio player for ready voice_msg and no (空消息)', () => {
    const message = makeMsg({
      content: '', // voice-only
      attachments: [readyVoiceAttachment],
    });

    const { container } = renderV4(
      <MessageTimeline
        messages={[message]}
        conversationId={42}
        hasOlder={false}
        loadingMore={false}
        onLoadMore={() => undefined}
      />,
    );

    // Audio player exists
    const audio = container.querySelector('audio');
    expect(audio).toBeTruthy();
    expect(audio?.getAttribute('src')).toBe(
      '/api/agents/conversations/42/message-attachments/1/content/',
    );

    // No empty message placeholder
    expect(screen.queryByText('（空消息）')).toBeNull();
  });

  it('renders text content along with voice audio player when both are present', () => {
    const message = makeMsg({
      content: 'Here is your voice message',
      attachments: [readyVoiceAttachment],
    });

    const { container } = renderV4(
      <MessageTimeline
        messages={[message]}
        conversationId={42}
        hasOlder={false}
        loadingMore={false}
        onLoadMore={() => undefined}
      />,
    );

    expect(screen.getByText('Here is your voice message')).toBeTruthy();
    expect(container.querySelector('audio')).toBeTruthy();
    expect(screen.queryByText('（空消息）')).toBeNull();
  });

  it('fails closed for pending or failed voice attachments without rendering player', () => {
    const pendingMsg = makeMsg({
      id: 2,
      content: '',
      attachments: [pendingVoiceAttachment],
    });

    const { container: pendingContainer } = renderV4(
      <MessageTimeline
        messages={[pendingMsg]}
        conversationId={42}
        hasOlder={false}
        loadingMore={false}
        onLoadMore={() => undefined}
      />,
    );

    expect(pendingContainer.querySelector('audio')).toBeNull();
    // Because no ready attachments and no content and no voice errors, shows empty placeholder
    expect(screen.getByText('（空消息）')).toBeTruthy();

    const failedMsg = makeMsg({
      id: 3,
      content: '',
      attachments: [failedVoiceAttachment],
      voiceToolErrors: [{ position: 0, errorCode: 'synthesis_failed' }],
    });

    const { container: failedContainer } = renderV4(
      <MessageTimeline
        messages={[failedMsg]}
        conversationId={42}
        hasOlder={false}
        loadingMore={false}
        onLoadMore={() => undefined}
      />,
    );

    // No audio player rendered
    expect(failedContainer.querySelector('audio')).toBeNull();
    // Shows voice tool error box, suppresses empty placeholder
    expect(screen.getByText('send_voice_msg 调用失败')).toBeTruthy();
    expect(screen.getByText('synthesis_failed')).toBeTruthy();
    expect(failedContainer.querySelector('.app-muted')).toBeNull();
  });

  it('renders image attachment thumbnail and suppresses (空消息) for attachment-only rows', () => {
    const message = makeMsg({
      content: '',
      attachments: [imageAttachment],
    });

    renderV4(
      <MessageTimeline
        messages={[message]}
        hasOlder={false}
        loadingMore={false}
        onLoadMore={() => undefined}
      />,
    );

    const img = screen.getByRole('button', { name: /查看图片 chart\.png/ });
    expect(img).toBeTruthy();
    expect(screen.queryByText('（空消息）')).toBeNull();
  });

  it('renders (空消息) when assistant row has no content and empty attachments array', () => {
    const message = makeMsg({
      content: '',
      attachments: [],
    });

    renderV4(
      <MessageTimeline
        messages={[message]}
        hasOlder={false}
        loadingMore={false}
        onLoadMore={() => undefined}
      />,
    );

    expect(screen.getByText('（空消息）')).toBeTruthy();
  });

  it('runtime assistant overlay never fabricates attachments or player', () => {
    const runtimeAssistant: RuntimeAssistantRow = {
      kind: 'client_assistant',
      clientKey: 'runtime_1',
      content: 'Generating...',
      thinking: '',
      isStreaming: true,
    };

    const { container } = renderV4(
      <MessageTimeline
        messages={[]}
        runtimeAssistant={runtimeAssistant}
        hasOlder={false}
        loadingMore={false}
        onLoadMore={() => undefined}
      />,
    );

    expect(container.querySelector('audio')).toBeNull();
    expect(container.querySelector('.app-msg-attachments')).toBeNull();
  });
});
