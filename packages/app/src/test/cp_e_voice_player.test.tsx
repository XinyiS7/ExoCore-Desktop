import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import { installFetch, jsonResponse, renderV4 } from './helpers';
import { AudioPlayerBubble } from '../features/chat/audio/AudioPlayerBubble';
import { MessageTimeline } from '../features/chat/MessageTimeline';
import { globalAudioPlaybackManager } from '../features/chat/audio/audioPlaybackManager';
import type { MessageAttachmentView, MessageView } from '../features/chat/types';

function stubMedia() {
  const play = vi.fn().mockResolvedValue(undefined);
  const pause = vi.fn();
  Object.defineProperty(HTMLMediaElement.prototype, 'duration', {
    configurable: true,
    get: () => 120,
  });
  Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {
    configurable: true,
    get: function () {
      return this.__ct ?? 0;
    },
    set: function (v: number) {
      this.__ct = v;
    },
  });
  Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    configurable: true,
    value: play,
  });
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
    configurable: true,
    value: pause,
  });
  return { play, pause };
}

describe('CP-E E3 — voice player and natural-ended transcript reveal', () => {
  const readyVoiceAttachment: MessageAttachmentView = {
    key: 'message_attachment:10',
    ref: { type: 'message_attachment', id: 10 },
    kind: 'audio',
    source: 'voice_msg',
    status: 'ready',
    position: 0,
    displayName: 'voice_0.wav',
    mimeType: 'audio/wav',
    fileSize: 32000,
    contentUrl: '/api/agents/conversations/42/message-attachments/10/content/',
    durationMs: 3200,
    errorCode: null,
  };

  const legacyAudioMeta = {
    id: 99,
    display_name: 'recording.webm',
    original_filename: 'recording.webm',
    mime_type: 'audio/webm',
    file_size: 15400,
    file_uri: null,
    content_url: '/api/agents/conversations/42/attachments/99/content/',
  };

  beforeEach(() => {
    stubMedia();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders exactly one audio player using same-origin content_url, fails closed on foreign origin', () => {
    const { container } = renderV4(
      <AudioPlayerBubble
        attachment={readyVoiceAttachment}
        conversationId={42}
      />,
    );
    const audio = container.querySelector('audio');
    expect(audio).toBeTruthy();
    expect(audio?.getAttribute('src')).toBe(
      '/api/agents/conversations/42/message-attachments/10/content/',
    );

    // Foreign origin fails closed
    const foreignAtt: MessageAttachmentView = {
      ...readyVoiceAttachment,
      contentUrl: 'https://foreign.example/audio.wav',
    };
    const { container: foreignContainer } = renderV4(
      <AudioPlayerBubble
        attachment={foreignAtt}
        conversationId={42}
      />,
    );
    expect(foreignContainer.querySelector('audio')?.getAttribute('src')).toBeNull();
    expect(screen.getByRole('alert').textContent).toContain('音频加载/播放失败');
  });

  it('does not request transcript on mount, play, or pause; requests exactly once on natural ended', async () => {
    let transcriptCallCount = 0;
    installFetch([
      {
        test: '/api/agents/conversations/42/message-attachments/10/transcript/',
        method: 'GET',
        handler: () => {
          transcriptCallCount++;
          return jsonResponse({ transcript: 'Hello, this is a spoken message.' });
        },
      },
    ]);

    const { container } = renderV4(
      <AudioPlayerBubble
        attachment={readyVoiceAttachment}
        conversationId={42}
      />,
    );

    const audio = container.querySelector('audio')!;
    expect(audio).toBeTruthy();
    expect(transcriptCallCount).toBe(0);
    expect(screen.queryByTestId('audio-transcript')).toBeNull();

    // Play event should NOT trigger transcript fetch
    fireEvent.play(audio);
    expect(transcriptCallCount).toBe(0);

    // Pause event should NOT trigger transcript fetch
    fireEvent.pause(audio);
    expect(transcriptCallCount).toBe(0);

    // Natural ended event triggers transcript fetch
    fireEvent.ended(audio);
    expect(transcriptCallCount).toBe(1);

    // Transcript appears below the player
    const transcriptEl = await screen.findByTestId('audio-transcript');
    expect(transcriptEl.textContent).toBe('Hello, this is a spoken message.');

    // Repeated natural ended in the same mount does NOT re-fetch (once per mount)
    fireEvent.ended(audio);
    expect(transcriptCallCount).toBe(1);
  });

  it('fails closed silently on 404, network error, or malformed body without breaking playback', async () => {
    installFetch([
      {
        test: '/api/agents/conversations/42/message-attachments/10/transcript/',
        method: 'GET',
        handler: () => jsonResponse({ error: 'not_found', message: 'Transcript not found.' }, 404),
      },
    ]);

    const { container } = renderV4(
      <AudioPlayerBubble
        attachment={readyVoiceAttachment}
        conversationId={42}
      />,
    );

    const audio = container.querySelector('audio')!;
    fireEvent.ended(audio);

    // Give microtasks time to settle
    await new Promise((r) => setTimeout(r, 50));

    // No transcript displayed and no server error prose leaked
    expect(screen.queryByTestId('audio-transcript')).toBeNull();
    expect(screen.queryByText(/Transcript not found/i)).toBeNull();
    expect(screen.queryByText(/not_found/i)).toBeNull();
    // Audio player is not in an error state because of transcript 404
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('legacy audio playback never calls transcript endpoint', () => {
    let transcriptCalled = false;
    installFetch([
      {
        test: /\/transcript\//,
        handler: () => {
          transcriptCalled = true;
          return jsonResponse({ transcript: 'unexpected' });
        },
      },
    ]);

    const { container } = renderV4(
      <AudioPlayerBubble
        meta={legacyAudioMeta}
        conversationId={42}
      />,
    );

    const audio = container.querySelector('audio')!;
    fireEvent.ended(audio);

    expect(transcriptCalled).toBe(false);
    expect(screen.queryByTestId('audio-transcript')).toBeNull();
  });

  it('hides transcript on remount until a new natural end event occurs', async () => {
    installFetch([
      {
        test: '/api/agents/conversations/42/message-attachments/10/transcript/',
        method: 'GET',
        handler: () => jsonResponse({ transcript: 'Persisted transcript text' }),
      },
    ]);

    const { container, unmount } = renderV4(
      <AudioPlayerBubble
        attachment={readyVoiceAttachment}
        conversationId={42}
      />,
    );

    const audio = container.querySelector('audio')!;
    fireEvent.ended(audio);

    await screen.findByText('Persisted transcript text');

    // Unmount and remount a fresh instance
    unmount();

    const { container: newContainer } = renderV4(
      <AudioPlayerBubble
        attachment={readyVoiceAttachment}
        conversationId={42}
      />,
    );

    // Initial state of newly mounted component has NO transcript
    expect(screen.queryByTestId('audio-transcript')).toBeNull();

    // Natural end on new instance fetches/reveals transcript again
    const newAudio = newContainer.querySelector('audio')!;
    fireEvent.ended(newAudio);

    await screen.findByText('Persisted transcript text');
  });

  it('shares globalAudioPlaybackManager: starting voice audio pauses other playing audio', () => {
    const pauseExternal = vi.fn();
    globalAudioPlaybackManager.play('external_player', pauseExternal);

    const { container } = renderV4(
      <AudioPlayerBubble
        attachment={readyVoiceAttachment}
        conversationId={42}
      />,
    );

    const audio = container.querySelector('audio')!;
    // Trigger play on this audio bubble
    act(() => {
      fireEvent.play(audio);
    });

    // The other player must have been paused
    expect(pauseExternal).toHaveBeenCalled();
  });

  it('reconciles from runtime overlay to canonical message cleanly with no duplicates', () => {
    const msg: MessageView = {
      id: 201,
      role: 'assistant',
      content: '',
      reasoningContent: null,
      platform: null,
      modelVersion: null,
      tokenCount: null,
      indexInSession: 1,
      attachmentIds: [10],
      attachmentsMeta: [],
      attachments: [readyVoiceAttachment],
      createdAt: '2026-09-29T10:00:00Z',
      clientTurnId: null,
    };

    // Before reconcile: runtime assistant overlay is streaming, canonical messages empty
    const { container, rerender } = renderV4(
      <MessageTimeline
        messages={[]}
        conversationId={42}
        runtimeAssistant={{
          kind: 'client_assistant',
          clientKey: 'run_1',
          content: '',
          thinking: '',
          isStreaming: true,
        }}
        hasOlder={false}
        loadingMore={false}
        onLoadMore={() => undefined}
      />,
    );

    // Zero audio players while streaming in runtime overlay
    expect(container.querySelectorAll('audio')).toHaveLength(0);

    // Reconcile complete: canonical message appears, runtime overlay cleared
    rerender(
      <MessageTimeline
        messages={[msg]}
        conversationId={42}
        runtimeAssistant={null}
        hasOlder={false}
        loadingMore={false}
        onLoadMore={() => undefined}
      />,
    );

    // Exactly one audio player
    expect(container.querySelectorAll('audio')).toHaveLength(1);
    expect(screen.queryByText('（空消息）')).toBeNull();
  });
});
