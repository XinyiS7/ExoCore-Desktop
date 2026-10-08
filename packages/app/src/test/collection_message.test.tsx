import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MessageTimeline } from '../features/chat/MessageTimeline';
import type { MessageView } from '../features/chat/types';
import { installFetch, jsonResponse } from './helpers';

function makeMessage(partial: Partial<MessageView> & { id: number; role: MessageView['role'] }): MessageView {
  return {
    content: 'Default content',
    reasoningContent: null,
    clientTurnId: null,
    platform: null,
    modelVersion: null,
    tokenCount: null,
    indexInSession: 1,
    attachmentIds: [],
    attachmentsMeta: [],
    createdAt: '2026-10-08T18:00:00Z',
    ...partial,
  };
}

describe('V4 Message Collect UI & Modal (Issue #32 Step 1B)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders "收藏" button for persisted user and assistant messages with non-empty content', () => {
    const messages: MessageView[] = [
      makeMessage({ id: 1, role: 'user', content: 'User message text' }),
      makeMessage({ id: 2, role: 'assistant', content: 'Assistant message text' }),
    ];

    render(
      <MessageTimeline
        messages={messages}
        hasOlder={false}
        loadingMore={false}
        onLoadMore={() => {}}
      />,
    );

    const buttons = screen.getAllByRole('button', { name: '收藏此条消息' });
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toHaveTextContent('收藏');
    expect(buttons[1]).toHaveTextContent('收藏');

    // Frozen UI rule: never render filled-state or active collected class
    expect(buttons[0]).not.toHaveClass('active');
    expect(buttons[1]).not.toHaveClass('active');
  });

  it('suppresses "收藏" button for empty content, pure artifact, optimistic, and streaming messages', () => {
    const messages: MessageView[] = [
      // Empty string
      makeMessage({ id: 1, role: 'user', content: '' }),
      // Whitespace only
      makeMessage({ id: 2, role: 'assistant', content: '   ' }),
      // System message
      makeMessage({ id: 3, role: 'system', content: 'System prompt' }),
      // Pure attachment message with empty content
      makeMessage({
        id: 4,
        role: 'user',
        content: '',
        attachments: [
          {
            key: 'msg_att:1',
            ref: { type: 'message_attachment', id: 1 },
            kind: 'file',
            source: 'user',
            status: 'ready',
            position: 0,
            displayName: 'document.pdf',
            mimeType: 'application/pdf',
            fileSize: 1024,
            contentUrl: '/api/file/1',
            durationMs: null,
            errorCode: null,
          },
        ],
      }),
    ];

    render(
      <MessageTimeline
        messages={messages}
        hasOlder={false}
        loadingMore={false}
        onLoadMore={() => {}}
        optimisticUser={{
          kind: 'client_user',
          clientKey: 'opt-user-1',
          clientTurnId: '00000000-0000-0000-0000-000000000001',
          content: 'Optimistic text in flight',
          createdAt: '2026-10-08T18:01:00Z',
          pendingAttachmentIds: [],
        }}
        runtimeAssistant={{
          kind: 'client_assistant',
          clientKey: 'rt-assistant-1',
          content: 'Streaming content in flight',
          thinking: '',
          isStreaming: true,
          statusText: '生成中…',
          telemetry: undefined,
          voiceToolErrors: [],
          error: undefined,
        }}
      />,
    );

    // None of the empty, system, optimistic, or streaming items may have the collect button
    expect(screen.queryByRole('button', { name: '收藏此条消息' })).not.toBeInTheDocument();
  });

  it('opens modal, submits canonical content with optional note, and shows created outcome', async () => {
    let capturedBody: any = null;
    installFetch([
      {
        test: '/api/collection/items/',
        method: 'POST',
        handler: async (_url, init) => {
          capturedBody = JSON.parse(String(init?.body));
          return jsonResponse({
            id: 'uuid-created-1',
            collect_outcome: 'created',
          }, 201);
        },
      },
    ]);

    const messages = [
      makeMessage({ id: 42, role: 'user', content: '  Keep this canonical text!  ' }),
    ];

    render(
      <MessageTimeline
        messages={messages}
        hasOlder={false}
        loadingMore={false}
        onLoadMore={() => {}}
      />,
    );

    const collectBtn = screen.getByRole('button', { name: '收藏此条消息' });
    fireEvent.click(collectBtn);

    // Modal dialog is displayed
    const dialog = screen.getByRole('dialog', { name: '收藏消息正文' });
    expect(dialog).toBeInTheDocument();

    // Verbatim quotation is rendered inside blockquote
    expect(dialog).toHaveTextContent('Keep this canonical text!');

    // Type optional note
    const noteInput = screen.getByLabelText('附言（可选）');
    fireEvent.change(noteInput, { target: { value: 'Important user remark' } });

    // Submit
    const submitBtn = screen.getByRole('button', { name: '确认收藏' });
    fireEvent.click(submitBtn);

    // Verifies success feedback for "created"
    expect(await screen.findByText('已加入收藏')).toBeInTheDocument();

    // Verifies request payload sent
    expect(capturedBody).toEqual({
      source: {
        type: 'message',
        message_id: 42,
        text: '  Keep this canonical text!  ', // UNTRIMMED CANONICAL TEXT!
      },
      collection_context: 'Important user remark',
    });

    // Close modal via "完成" button
    const doneBtn = screen.getByRole('button', { name: '完成' });
    fireEvent.click(doneBtn);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('shows differentiated outcome for already_collected on repeat collect', async () => {
    installFetch([
      {
        test: '/api/collection/items/',
        method: 'POST',
        handler: async () => {
          return jsonResponse({
            id: 'uuid-already-collected',
            collect_outcome: 'already_collected',
          }, 200);
        },
      },
    ]);

    const messages = [
      makeMessage({ id: 77, role: 'assistant', content: 'Repeated assistant message' }),
    ];

    render(
      <MessageTimeline
        messages={messages}
        hasOlder={false}
        loadingMore={false}
        onLoadMore={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '收藏此条消息' }));
    fireEvent.click(screen.getByRole('button', { name: '确认收藏' }));

    // Verifies outcome differentiation
    expect(await screen.findByText('该消息已在收藏中，已记录再次收藏')).toBeInTheDocument();
    expect(screen.queryByText('已加入收藏')).not.toBeInTheDocument();
  });

  it('prevents duplicate submissions while request is pending', async () => {
    let callCount = 0;
    let resolvePost: (res: Response) => void;
    const pendingPromise = new Promise<Response>((resolve) => {
      resolvePost = resolve;
    });

    installFetch([
      {
        test: '/api/collection/items/',
        method: 'POST',
        handler: async () => {
          callCount++;
          return pendingPromise;
        },
      },
    ]);

    const messages = [
      makeMessage({ id: 88, role: 'user', content: 'Slow network test' }),
    ];

    render(
      <MessageTimeline
        messages={messages}
        hasOlder={false}
        loadingMore={false}
        onLoadMore={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '收藏此条消息' }));
    const submitBtn = screen.getByRole('button', { name: '确认收藏' });

    // Click submit multiple times in rapid succession
    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn);

    expect(callCount).toBe(1);
    expect(submitBtn).toBeDisabled();
    expect(submitBtn).toHaveTextContent('收藏中…');

    // Resolve request
    resolvePost!(jsonResponse({ id: 'done', collect_outcome: 'created' }, 201));

    expect(await screen.findByText('已加入收藏')).toBeInTheDocument();
    expect(callCount).toBe(1);
  });

  it('displays backend error message on failure', async () => {
    installFetch([
      {
        test: '/api/collection/items/',
        method: 'POST',
        handler: async () => {
          return jsonResponse({ error: '原消息已被物理删除', code: 'message_deleted' }, 404);
        },
      },
    ]);

    const messages = [
      makeMessage({ id: 99, role: 'user', content: 'Error scenario message' }),
    ];

    render(
      <MessageTimeline
        messages={messages}
        hasOlder={false}
        loadingMore={false}
        onLoadMore={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '收藏此条消息' }));
    fireEvent.click(screen.getByRole('button', { name: '确认收藏' }));

    const errorBanner = await screen.findByRole('alert');
    expect(errorBanner).toHaveTextContent('原消息已被物理删除');
  });

  it('supports custom onCollectMessage callback when provided', () => {
    const handleCollect = vi.fn();
    const msg = makeMessage({ id: 55, role: 'user', content: 'Callback target message' });

    render(
      <MessageTimeline
        messages={[msg]}
        hasOlder={false}
        loadingMore={false}
        onLoadMore={() => {}}
        onCollectMessage={handleCollect}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '收藏此条消息' }));
    expect(handleCollect).toHaveBeenCalledTimes(1);
    expect(handleCollect).toHaveBeenCalledWith(msg);

    // Internal modal is not opened when external callback is supplied
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
