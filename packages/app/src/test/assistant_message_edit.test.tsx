/** Assistant body editing (#107): PATCH only, raw Markdown, no truncate or regenerate. */
import { cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, type InfiniteData } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { MessageTimeline } from '../features/chat/MessageTimeline';
import { queryKeys, useEditAssistantMessageMutation } from '../features/chat/queries';
import type { MessagePage, MessageView } from '../features/chat/types';
import { callsToPath, ensureTestLocalStorage, installFetch, jsonResponse, unmockFetch } from './helpers';

ensureTestLocalStorage();

afterEach(() => {
  cleanup();
  unmockFetch();
  localStorage.clear();
});

const message = (over: Partial<MessageView> = {}): MessageView => ({
  id: 71,
  role: 'assistant',
  content: '**body** *]',
  reasoningContent: null,
  clientTurnId: null,
  platform: 'agy',
  modelVersion: 'gemini-4-argon',
  tokenCount: 0,
  indexInSession: 1,
  attachmentIds: [],
  attachmentsMeta: [],
  createdAt: '2026-11-04T00:00:00Z',
  ...over,
});

function renderTimeline(
  row: MessageView,
  onSave?: (id: number, content: string) => Promise<unknown>,
  isRunActive = false,
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  installFetch([], () => jsonResponse({}));
  return render(
    <QueryClientProvider client={client}>
      <MessageTimeline
        messages={[row]}
        conversationId={9}
        hasOlder={false}
        loadingMore={false}
        onLoadMore={() => {}}
        isRunActive={isRunActive}
        onSaveAssistantMessage={onSave}
      />
    </QueryClientProvider>,
  );
}

const editButton = () => screen.queryByRole('button', { name: '编辑此条助手消息' });
const editor = () => screen.getByRole('textbox', { name: '编辑助手消息' }) as HTMLTextAreaElement;

describe('assistant message edit control', () => {
  it('appears only on assistant rows with body text', () => {
    const onSave = vi.fn();
    const { unmount } = renderTimeline(message(), onSave);
    expect(editButton()).not.toBeNull();
    unmount();

    const blank = renderTimeline(message({ content: '  ' }), onSave);
    expect(editButton()).toBeNull();
    blank.unmount();

    renderTimeline(message({ role: 'user' }), onSave);
    expect(editButton()).toBeNull();
  });

  it('is disabled while a run is active', () => {
    renderTimeline(message(), vi.fn(), true);
    expect((editButton() as HTMLButtonElement).disabled).toBe(true);
  });

  it('loads raw Markdown and cancel sends nothing', () => {
    const onSave = vi.fn();
    renderTimeline(message(), onSave);

    fireEvent.click(editButton() as HTMLElement);
    expect(editor().value).toBe('**body** *]');
    fireEvent.change(editor(), { target: { value: 'changed' } });
    fireEvent.click(screen.getByRole('button', { name: '取消' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox', { name: '编辑助手消息' })).toBeNull();
    expect(editButton()).not.toBeNull();
  });

  it('saves the draft once and closes', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderTimeline(message(), onSave);

    fireEvent.click(editButton() as HTMLElement);
    fireEvent.change(editor(), { target: { value: '**body**' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => expect(screen.queryByRole('textbox', { name: '编辑助手消息' })).toBeNull());
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(71, '**body**');
  });

  it('keeps the draft and shows the backend message when saving fails', async () => {
    const failure = Object.assign(new Error('API 400: Bad Request'), {
      status: 400,
      body: { code: 'content_required', error: '正文不能为空' },
    });
    renderTimeline(message(), vi.fn().mockRejectedValue(failure));

    fireEvent.click(editButton() as HTMLElement);
    fireEvent.change(editor(), { target: { value: 'draft' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    expect((await screen.findByRole('alert')).textContent).toBe('正文不能为空');
    expect(editor().value).toBe('draft');
  });

  it('blocks saving a blank body without calling the backend', () => {
    const onSave = vi.fn();
    renderTimeline(message(), onSave);

    fireEvent.click(editButton() as HTMLElement);
    fireEvent.change(editor(), { target: { value: ' \n ' } });

    expect((screen.getByRole('button', { name: '保存' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('useEditAssistantMessageMutation', () => {
  it('sends only PATCH and replaces the row across cached pages', async () => {
    const client = new QueryClient();
    const page = (messages: MessageView[], offset: number): MessagePage => ({
      messages,
      offset,
      hasMore: false,
      totalCount: 2,
    } as MessagePage);
    client.setQueryData<InfiniteData<MessagePage, number>>(queryKeys.messages(9), {
      pages: [page([message({ id: 72, content: 'later' })], 0), page([message()], 1)],
      pageParams: [0, 1],
    });
    const mock = installFetch([
      {
        method: 'PATCH',
        test: '/api/agents/conversations/9/messages/71/',
        handler: () =>
          jsonResponse({
            id: 71,
            role: 'assistant',
            content: 'clean',
            reasoning_content: null,
            platform: 'agy',
            model_version: 'gemini-4-argon',
            token_count: 0,
            index_in_session: 1,
            attachment_ids: [],
            attachments_meta: [],
            created_at: '2026-11-04T00:00:00Z',
          }),
      },
    ]);
    const { result } = renderHook(() => useEditAssistantMessageMutation(9), {
      wrapper: ({ children }: { children?: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    await result.current.mutateAsync({ messageId: 71, content: 'clean' });

    const calls = callsToPath(mock.calls, '/api/agents/conversations/9/messages/71/');
    expect(calls).toHaveLength(1);
    expect(calls[0].init?.body).toBe(JSON.stringify({ content: 'clean' }));
    expect(mock.calls).toHaveLength(1);
    const cached = client.getQueryData<InfiniteData<MessagePage, number>>(queryKeys.messages(9));
    expect(cached?.pages[1].messages[0].content).toBe('clean');
    expect(cached?.pages[0].messages[0].content).toBe('later');
  });
});
