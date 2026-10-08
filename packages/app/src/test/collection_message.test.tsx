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

function extractMediaBlock(css: string, query: string): { block: string; fullMatch: string } {
  const qIdx = css.indexOf(query);
  if (qIdx === -1) throw new Error(`Query "${query}" not found in css`);
  const open = css.indexOf('{', qIdx);
  if (open === -1) throw new Error(`Opening brace not found after "${query}"`);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) {
        return {
          block: css.slice(open + 1, i),
          fullMatch: css.slice(qIdx, i + 1),
        };
      }
    }
  }
  throw new Error(`Unmatched braces for "${query}"`);
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

    // F-01: Collection action must have dedicated modifier class
    expect(buttons[0]).toHaveClass('app-msg-action-btn', 'app-msg-action-btn--collect');
    expect(buttons[1]).toHaveClass('app-msg-action-btn', 'app-msg-action-btn--collect');

    // Sibling action buttons (e.g. copy) retain standard action button class without --collect
    const copyButtons = screen.getAllByRole('button', { name: /复制消息内容/ });
    expect(copyButtons.length).toBeGreaterThan(0);
    for (const copyBtn of copyButtons) {
      expect(copyBtn).toHaveClass('app-msg-action-btn');
      expect(copyBtn).not.toHaveClass('app-msg-action-btn--collect');
    }

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

  it('ensures only collection button receives app-msg-action-btn--collect across all timeline actions', () => {
    const onEdit = vi.fn();
    const onRegenerate = vi.fn();
    const onBranch = vi.fn();

    const messages: MessageView[] = [
      makeMessage({ id: 1, role: 'user', content: 'User text' }),
      makeMessage({ id: 2, role: 'assistant', content: 'Assistant text' }),
    ];

    render(
      <MessageTimeline
        messages={messages}
        hasOlder={false}
        loadingMore={false}
        onLoadMore={() => {}}
        onEditMessage={onEdit}
        onRegenerateMessage={onRegenerate}
        onBranchMessage={onBranch}
      />,
    );

    const allButtons = screen.getAllByRole('button');
    const collectButtons = allButtons.filter((btn) =>
      btn.classList.contains('app-msg-action-btn--collect'),
    );
    const otherActionButtons = allButtons.filter(
      (btn) =>
        btn.classList.contains('app-msg-action-btn') &&
        !btn.classList.contains('app-msg-action-btn--collect'),
    );

    // Persisted user and assistant message rows each have 1 collection button
    expect(collectButtons).toHaveLength(2);

    // Other action buttons (copy, edit, regenerate, branch) exist and do NOT have --collect class
    expect(otherActionButtons.length).toBeGreaterThan(0);
    for (const btn of otherActionButtons) {
      expect(btn).not.toHaveClass('app-msg-action-btn--collect');
    }
  });

  it('satisfies hover/focus-within reveal and accessibility stylesheet contract (F-01)', () => {
    const css = loadShellCss();

    // Verify media query scoping to pointer-hover desktop devices
    const { block: mediaBlock, fullMatch } = extractMediaBlock(
      css,
      '@media (hover: hover) and (pointer: fine)',
    );

    // Hidden at rest in pointer-hover media
    expect(mediaBlock).toMatch(/\.app-msg-action-btn--collect\s*\{[^}]*opacity:\s*0/);
    expect(mediaBlock).toMatch(/\.app-msg-action-btn--collect\s*\{[^}]*pointer-events:\s*none/);

    // Revealed on message row hover and focus-within
    expect(mediaBlock).toMatch(/\.app-msg:hover\s+\.app-msg-action-btn--collect/);
    expect(mediaBlock).toMatch(/\.app-msg:focus-within\s+\.app-msg-action-btn--collect/);
    expect(mediaBlock).toMatch(/\.app-msg-action-btn--collect:focus/);
    expect(mediaBlock).toMatch(/opacity:\s*1/);
    expect(mediaBlock).toMatch(/pointer-events:\s*auto/);

    // Outside the pointer-hover media block, the action is not hidden (fallback for touch/non-hover devices)
    const cssWithoutMedia = css.replace(fullMatch, '');
    expect(cssWithoutMedia).not.toMatch(/\.app-msg-action-btn--collect\s*\{[^}]*opacity:\s*0/);
  });
});
