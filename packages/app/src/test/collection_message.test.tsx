import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MessageTimeline } from '../features/chat/MessageTimeline';
import type { MessageView } from '../features/chat/types';
import { installFetch, jsonResponse } from './helpers';

function loadShellCss(): string {
  const directPath = resolve(process.cwd(), 'src/styles/shell.css');
  if (existsSync(directPath)) return readFileSync(directPath, 'utf8');
  const monorepoPath = resolve(process.cwd(), 'packages/app/src/styles/shell.css');
  if (existsSync(monorepoPath)) return readFileSync(monorepoPath, 'utf8');
  throw new Error(`Cannot locate shell.css from cwd: ${process.cwd()}`);
}

/** #72 U4: 收藏 opens a menu; 收藏正文 continues into the modal flow. */
function openCollectBody(trigger: HTMLElement = screen.getByRole('button', { name: '收藏此条消息' })) {
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole('menuitem', { name: '收藏正文' }));
}

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

    // #72 U4: the trigger is an ordinary, always-visible action that opens a menu
    for (const button of buttons) {
      expect(button).toHaveClass('app-msg-action-btn');
      expect(button).not.toHaveClass('app-msg-action-btn--collect');
      expect(button).toHaveAttribute('aria-haspopup', 'menu');
    }

    // Frozen UI rule: never render filled-state or active collected class
    expect(buttons[0]).not.toHaveClass('active');
    expect(buttons[1]).not.toHaveClass('active');
  });

  it('suppresses "收藏" for empty, system, optimistic and streaming rows; attachment-only rows without provenance get a disabled-only menu', () => {
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

    // Only the attachment-only row (#4) offers 收藏, and only as a placeholder
    const triggers = screen.getAllByRole('button', { name: '收藏此条消息' });
    expect(triggers).toHaveLength(1);
    fireEvent.click(triggers[0]);
    expect(screen.queryByRole('menuitem', { name: '收藏正文' })).toBeNull();
    const placeholder = screen.getByRole('menuitem', { name: /document\.pdf/ });
    expect(placeholder).toBeDisabled();
    expect(placeholder).toHaveTextContent('旧附件不可收藏');
  });

  it('opens modal, submits canonical content with optional note, and shows created outcome', async () => {
    let capturedBody = null as Record<string, unknown> | null;
    installFetch([
      {
        test: '/api/collection/items/',
        method: 'POST',
        handler: async (_url, init) => {
          capturedBody = JSON.parse(String(init?.body));
          return jsonResponse({
            id: 11,
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

    openCollectBody();

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
            id: 12,
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

    openCollectBody();
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

    openCollectBody();
    const submitBtn = screen.getByRole('button', { name: '确认收藏' });

    // Click submit multiple times in rapid succession
    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn);

    expect(callCount).toBe(1);
    expect(submitBtn).toBeDisabled();
    expect(submitBtn).toHaveTextContent('收藏中…');

    // Resolve request
    resolvePost!(jsonResponse({ id: 13, collect_outcome: 'created' }, 201));

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

    openCollectBody();
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

    openCollectBody();
    expect(handleCollect).toHaveBeenCalledTimes(1);
    expect(handleCollect).toHaveBeenCalledWith(msg);

    // Internal modal is not opened when external callback is supplied
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('lists non-collectible presented items as disabled and closes on Escape', () => {
    const message = makeMessage({
      id: 3,
      role: 'assistant',
      content: 'Here is the picture',
      presentations: [
        {
          key: 'assistant_artifact:9',
          surface: 'image',
          owner: 'agy_generate_image',
          position: 0,
          label: '生成的图片',
          card: null,
          media: {
            key: 'message_attachment:12',
            ref: { type: 'message_attachment', id: 12 },
            kind: 'image',
            source: 'agy_image',
            status: 'ready',
            position: 0,
            displayName: 'image-0.png',
            mimeType: 'image/png',
            fileSize: 2048,
            contentUrl: '/api/agents/conversations/42/message-attachments/12/content/',
            durationMs: null,
            errorCode: null,
          },
        },
      ],
    });
    render(<MessageTimeline messages={[message]} hasOlder={false} loadingMore={false} onLoadMore={() => {}} />);

    const trigger = screen.getByRole('button', { name: '收藏此条消息' });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menuitem', { name: '收藏正文' })).toBeEnabled();
    const artifactItem = screen.getByRole('menuitem', { name: /生成的图片/ });
    expect(artifactItem).toBeDisabled();
    expect(artifactItem).toHaveTextContent('不可收藏');

    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('keeps the collect action visible at rest: no hover-only reveal rule (#72 U3)', () => {
    const css = loadShellCss();
    expect(css).not.toMatch(/app-msg-action-btn--collect/);
  });
});
