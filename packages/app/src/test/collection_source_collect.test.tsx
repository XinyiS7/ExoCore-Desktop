/** #74: collect user attachments and AI artifacts from the message collect menu. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MessageTimeline } from '../features/chat/MessageTimeline';
import { normalizeMessageAttachments } from '../features/chat/attachments/projection';
import { normalizePresentations } from '../features/chat/presentations/projection';
import type { MessageAttachmentView, MessageView, PresentationView } from '../features/chat/types';
import { detailItem, listItem } from './collection_fixtures';
import { installFetch, jsonResponse, renderApp, unmockFetch } from './helpers';

afterEach(() => {
  unmockFetch();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function wireMedia(id: number, kind: 'image' | 'audio', source: string) {
  return {
    ref: { type: 'message_attachment', id },
    kind,
    source,
    status: 'ready',
    position: 0,
    display_name: kind === 'image' ? 'image-0.png' : 'voice-0.wav',
    mime_type: kind === 'image' ? 'image/png' : 'audio/wav',
    file_size: 2048,
    content_url: `/api/agents/conversations/42/message-attachments/${id}/content/`,
    duration_ms: kind === 'audio' ? 1200 : null,
    error_code: null,
  };
}

function wirePresentation(artifactId: number, surface: 'image' | 'voice', collectible: unknown) {
  return {
    key: `assistant_artifact:${artifactId}`,
    surface,
    owner: surface === 'image' ? 'agy_generate_image' : 'send_voice_msg',
    position: 0,
    label: surface === 'image' ? '生成的图片' : '语音消息',
    card: null,
    media: wireMedia(artifactId + 100, surface === 'image' ? 'image' : 'audio', surface === 'image' ? 'agy_image' : 'voice_msg'),
    collectible,
  };
}

function wireSessionAttachment(id: number, provenanceId: string | null) {
  return {
    ref: { type: 'session_attachment', id },
    provenance_id: provenanceId,
    kind: 'image',
    source: 'user',
    status: 'ready',
    position: 0,
    display_name: `photo-${id}.png`,
    mime_type: 'image/png',
    file_size: 1024,
    content_url: `/api/agents/conversations/42/attachments/${id}/content/`,
    duration_ms: null,
    error_code: null,
  };
}

function message(partial: Partial<MessageView> & { id: number; role: MessageView['role'] }): MessageView {
  return {
    content: '',
    reasoningContent: null,
    clientTurnId: null,
    platform: null,
    modelVersion: null,
    tokenCount: null,
    indexInSession: 1,
    attachmentIds: [],
    attachmentsMeta: [],
    createdAt: '2026-10-27T10:00:00Z',
    ...partial,
  };
}

const presentations = (raw: unknown[]): PresentationView[] => normalizePresentations(raw);
const attachments = (raw: unknown[]): MessageAttachmentView[] => normalizeMessageAttachments(raw, null);

function renderTimeline(messages: MessageView[], onCollectMessage?: (m: MessageView) => void) {
  render(
    <MessageTimeline
      messages={messages}
      hasOlder={false}
      loadingMore={false}
      onLoadMore={() => {}}
      onCollectMessage={onCollectMessage}
    />,
  );
}

function capturePost(status: number, body: Record<string, unknown>) {
  const sent: Record<string, unknown>[] = [];
  installFetch([
    {
      test: '/api/collection/items/',
      method: 'POST',
      handler: async (_url, init) => {
        sent.push(JSON.parse(String(init?.body)));
        return jsonResponse(body, status);
      },
    },
  ]);
  return sent;
}

function openMenu() {
  fireEvent.click(screen.getByRole('button', { name: '收藏此条消息' }));
}

describe('#74 wire parsing', () => {
  it('reads collectible only when it is literally true', () => {
    const parsed = presentations([
      wirePresentation(9, 'image', true),
      wirePresentation(10, 'voice', 'true'),
      wirePresentation(11, 'voice', undefined),
    ]);
    expect(parsed.map((item) => [item.key, item.collectible])).toEqual([
      ['assistant_artifact:9', true],
      ['assistant_artifact:10', false],
      ['assistant_artifact:11', false],
    ]);
  });

  it('carries provenance_id on session rows and null for older uploads', () => {
    const parsed = attachments([wireSessionAttachment(1, 'a1b2-uuid'), wireSessionAttachment(2, null)]);
    expect(parsed.map((item) => item.provenanceId)).toEqual(['a1b2-uuid', null]);
  });
});

describe('#74 collect menu (D1 / D2)', () => {
  it('enables collectible artifacts and keeps the body entry first', () => {
    renderTimeline([
      message({
        id: 3,
        role: 'assistant',
        content: '给你画好了',
        presentations: presentations([wirePresentation(9, 'image', true), wirePresentation(10, 'voice', false)]),
      }),
    ]);
    openMenu();
    const items = screen.getAllByRole('menuitem');
    expect(items.map((item) => item.textContent)).toEqual(['收藏正文', '生成的图片', '语音消息不可收藏']);
    expect(items.map((item) => (item as HTMLButtonElement).disabled)).toEqual([false, false, true]);
  });

  it('collects a generated image by its artifact id with the note, in the shared modal', async () => {
    const sent = capturePost(201, { id: 31, collect_outcome: 'created' });
    renderTimeline([
      message({
        id: 3,
        role: 'assistant',
        presentations: presentations([wirePresentation(9, 'image', true)]),
      }),
    ]);
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: '生成的图片' }));

    const dialog = within(screen.getByRole('dialog', { name: '收藏附件' }));
    expect(dialog.getByText('生成的图片')).toBeTruthy();
    fireEvent.change(dialog.getByLabelText('附言（可选）'), { target: { value: '  好看  ' } });
    fireEvent.click(dialog.getByRole('button', { name: '确认收藏' }));

    expect(await dialog.findByText('已加入收藏')).toBeTruthy();
    expect(sent).toEqual([
      { source: { type: 'assistant_artifact', artifact_id: 9 }, collection_context: '好看' },
    ]);
  });

  it('collects a user attachment by provenance and greys out one without it', async () => {
    const sent = capturePost(200, { id: 8, collect_outcome: 'already_collected' });
    renderTimeline([
      message({
        id: 4,
        role: 'user',
        content: '看这张',
        attachments: attachments([wireSessionAttachment(1, 'a1b2-uuid'), wireSessionAttachment(2, null)]),
      }),
    ]);
    openMenu();
    const legacy = screen.getByRole('menuitem', { name: /photo-2\.png/ });
    expect(legacy).toBeDisabled();
    expect(legacy).toHaveTextContent('旧附件不可收藏');
    fireEvent.click(screen.getByRole('menuitem', { name: 'photo-1.png' }));
    const dialog = within(screen.getByRole('dialog', { name: '收藏附件' }));
    fireEvent.click(dialog.getByRole('button', { name: '确认收藏' }));

    expect(await dialog.findByText('该附件已在收藏中，已记录再次收藏')).toBeTruthy();
    expect(sent).toEqual([{ source: { type: 'attachment', provenance_id: 'a1b2-uuid' } }]);
  });

  it('cancel sends nothing; a failure shows the backend error and never success', async () => {
    const sent = capturePost(409, { error: 'Source artifact is unavailable', code: 'source_unavailable' });
    renderTimeline([
      message({ id: 3, role: 'assistant', presentations: presentations([wirePresentation(10, 'voice', true)]) }),
    ]);
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: '语音消息' }));
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(sent).toEqual([]);

    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: '语音消息' }));
    const dialog = within(screen.getByRole('dialog', { name: '收藏附件' }));
    fireEvent.click(dialog.getByRole('button', { name: '确认收藏' }));

    expect((await dialog.findByRole('alert')).textContent).toBe('Source artifact is unavailable');
    expect(dialog.queryByText('已加入收藏')).toBeNull();
    expect(sent).toEqual([{ source: { type: 'assistant_artifact', artifact_id: 10 } }]);
  });

  it('an external body callback does not swallow attachment collection', () => {
    const onCollectMessage = vi.fn();
    renderTimeline(
      [message({ id: 3, role: 'assistant', content: '正文', presentations: presentations([wirePresentation(9, 'image', true)]) })],
      onCollectMessage,
    );
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: '生成的图片' }));
    expect(onCollectMessage).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: '收藏附件' })).toBeTruthy();
  });
});

describe('#74 Library (D3)', () => {
  const artifactSource = (available: boolean) => ({
    type: 'assistant_artifact',
    key: '31',
    available,
    snapshot: {
      artifact_id: 31,
      producer: 'send_voice_msg',
      filename: 'voice-0.wav',
      mime_type: 'audio/wav',
      file_size: 2048,
      conversation_id: 12,
      message: {
        message_id: 88, conversation_id: 12, index_in_session: 3,
        role: 'assistant', created_at: '2026-10-13T08:00:00+00:00',
      },
    },
  });

  function routes(available: boolean) {
    return [
      {
        test: '/api/collection/items/',
        method: 'GET',
        handler: () => jsonResponse({
          items: [listItem(5, { kind: 'audio', preview: '', source: { type: 'assistant_artifact', key: '31' } })],
          next_cursor: null,
        }),
      },
      {
        test: '/api/collection/items/5/',
        method: 'GET',
        handler: () => jsonResponse(detailItem(5, {
          kind: 'audio',
          text_content: '',
          source: artifactSource(available),
          asset: { sha256: 'abc', file_size: 2048, mime_type: 'audio/wav', status: 'ready' },
          capabilities: ['update', 'delete', 'read_original'],
          original_content_url: '/api/collection/items/5/original/',
        })),
      },
      { test: '/api/collection/tags/', handler: () => jsonResponse({ items: [] }) },
    ];
  }

  it('lists and opens an artifact item labelled as a chat attachment with a source link', async () => {
    installFetch(routes(true));
    renderApp(['/library']);
    fireEvent.click(await screen.findByRole('link', { name: '藏品 5' }));
    const view = within(await screen.findByRole('dialog', { name: /^藏品 / }));
    expect(await view.findByText(/聊天附件 · 助手 · /)).toBeTruthy();
    expect(view.getByRole('link', { name: '打开来源会话' }).getAttribute('href')).toBe('/chat/12');
    expect(document.querySelector('audio')?.getAttribute('src')).toBe('/api/collection/items/5/original/');
  });

  it('keeps the item when its artifact is gone and drops the link', async () => {
    installFetch(routes(false));
    renderApp(['/library/items/5']);
    const view = within(await screen.findByRole('dialog', { name: /^藏品 / }));
    expect(await view.findByText('（来源已不可用）')).toBeTruthy();
    expect(view.queryByRole('link', { name: '打开来源会话' })).toBeNull();
  });
});
