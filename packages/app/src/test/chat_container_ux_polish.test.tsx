import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageContent } from '../features/chat/MessageContent';
import { MessageTimeline } from '../features/chat/MessageTimeline';
import { RuntimeStatusBanner } from '../features/chat/RuntimeStatusBanner';
import { UserAttachmentManager } from '../features/chat/attachments/UserAttachmentManager';
import type { UserAttachmentManagerApi } from '../features/chat/attachments/useUserAttachmentManager';
import type { MessageView } from '../features/chat/types';

describe('V4 Chat Container UX Polish', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Item 1 & 2: Copy buttons in CodeBlock and MessageTimeline', () => {
    it('renders copy button on code blocks and copies code content to clipboard', async () => {
      render(<MessageContent content={'```python\nprint("hello world")\n```'} />);

      const copyBtn = screen.getByRole('button', { name: '复制代码' });
      expect(copyBtn).toBeTruthy();

      await act(async () => {
        fireEvent.click(copyBtn);
      });

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('print("hello world")\n');
      expect(screen.getByRole('button', { name: '已复制代码' })).toBeTruthy();

      // Reset after 1500ms
      act(() => {
        vi.advanceTimersByTime(1600);
      });
      expect(screen.getByRole('button', { name: '复制代码' })).toBeTruthy();
    });

    it('renders copy button on persisted messages and copies message content', async () => {
      const makeMsg = (id: number, role: 'user' | 'assistant', content: string): MessageView => ({
        id,
        role,
        content,
        reasoningContent: null,
        clientTurnId: null,
        platform: null,
        modelVersion: null,
        tokenCount: null,
        indexInSession: 0,
        attachmentIds: [],
        attachmentsMeta: [],
        createdAt: '2026-09-29T10:00:00Z',
      });

      const messages: MessageView[] = [
        makeMsg(101, 'user', 'Hello Alaric'),
        makeMsg(102, 'assistant', 'Hello Alicia, I am always here.'),
      ];

      render(
        <MessageTimeline
          messages={messages}
          conversationId={1}
          hasOlder={false}
          loadingMore={false}
          onLoadMore={vi.fn()}
          optimisticUser={null}
          runtimeAssistant={null}
          isRunActive={false}
        />,
      );

      const copyBtns = screen.getAllByRole('button', { name: '复制消息内容' });
      expect(copyBtns).toHaveLength(2);

      await act(async () => {
        fireEvent.click(copyBtns[1]);
      });

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Hello Alicia, I am always here.');
      expect(screen.getByRole('button', { name: '已复制消息内容' })).toBeTruthy();

      act(() => {
        vi.advanceTimersByTime(1600);
      });
      expect(screen.getAllByRole('button', { name: '复制消息内容' })).toHaveLength(2);
    });
  });

  describe('Item 3: RuntimeStatusBanner active banner deduplication', () => {
    it('renders null when status is streaming but no errors or reconcile pending', () => {
      const { container } = render(
        <RuntimeStatusBanner
          status="streaming"
          statusText="正在思考与生成…"
          error={null}
          protocolWarning={null}
          hasPendingReconcile={false}
          draftCleanupFailed={false}
          onApplyPendingReconcile={vi.fn()}
          onRetrySync={vi.fn()}
          onRetryStop={vi.fn()}
          onRetryReread={vi.fn()}
          onRetryStorage={vi.fn()}
          onResumePolling={vi.fn()}
          onAcknowledgeUncertain={vi.fn()}
          onDismissTransient={vi.fn()}
          onRetryDraftCleanup={vi.fn()}
        />,
      );

      expect(container.firstChild).toBeNull();
    });

    it('renders reconcile button when hasPendingReconcile is true', () => {
      render(
        <RuntimeStatusBanner
          status="idle"
          error={null}
          protocolWarning={null}
          hasPendingReconcile={true}
          draftCleanupFailed={false}
          onApplyPendingReconcile={vi.fn()}
          onRetrySync={vi.fn()}
          onRetryStop={vi.fn()}
          onRetryReread={vi.fn()}
          onRetryStorage={vi.fn()}
          onResumePolling={vi.fn()}
          onAcknowledgeUncertain={vi.fn()}
          onDismissTransient={vi.fn()}
          onRetryDraftCleanup={vi.fn()}
        />,
      );

      expect(screen.getByRole('button', { name: '返回最新位置' })).toBeTruthy();
    });
  });

  describe('Item 4: UserAttachmentManager hideWhenEmpty', () => {
    const baseManager: UserAttachmentManagerApi = {
      rows: [],
      loading: false,
      notice: null,
      frozenInCache: false,
      deletePending: false,
      isDeletePending: () => false,
      refresh: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      dismissNotice: vi.fn(),
    };

    it('hides completely when hideWhenEmpty=true, rows is empty, and closed', () => {
      const { container } = render(
        <UserAttachmentManager manager={baseManager} busy={false} hideWhenEmpty={true} />,
      );
      expect(container.firstChild).toBeNull();
    });

    it('renders when hideWhenEmpty=true if rows is not empty', () => {
      const managerWithRows: UserAttachmentManagerApi = {
        ...baseManager,
        rows: [
          {
            source: 'user',
            id: 1,
            display_name: 'test.png',
            file_size: 1024,
            mime_type: 'image/png',
            storage_path: null,
          },
        ],
      };

      render(
        <UserAttachmentManager manager={managerWithRows} busy={false} hideWhenEmpty={true} />,
      );
      expect(screen.getByText('会话附件（1）')).toBeTruthy();
    });

    it('renders default toggle when hideWhenEmpty is false even if rows is empty (backward compatibility)', () => {
      render(<UserAttachmentManager manager={baseManager} busy={false} />);
      expect(screen.getByText('会话附件（0）')).toBeTruthy();
    });
  });
});
