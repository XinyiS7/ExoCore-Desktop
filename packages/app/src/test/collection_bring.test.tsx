import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEffect, useState } from 'react';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { installFetch, jsonResponse, renderApp, renderV4, unmockFetch, type MockRoute } from './helpers';
import { ChatComposer, type ChatComposerProps } from '../features/chat/ChatComposer';
import { useComposeCollectionCards } from '../features/chat/attachments/useComposeCollectionCards';
import type { AudioRecorderApi } from '../features/chat/audio/useAudioRecorder';
import type { AudioRecoveryApi } from '../features/chat/audio/audioRecoveryMachine';
import type { ChatTurnInput, TurnAcceptance } from '../features/chat/runtime/types';
import { detailItem, listItem } from './collection_fixtures';
import { loadConversationDraft, saveConversationDraft } from '../features/chat/runtime/storage';

const PRESET_G045 = {
  id: 1,
  name: 'Alessandro',
  description: null,
  agent_type: 'g045',
  default_model: 'deepseek-v4-flash',
  system_prompt: null,
  is_visible: true,
};

const MODEL_CATALOG = {
  models: [{ name: 'deepseek-v4-flash', family: 'deepseek', abilities: ['fc'], compatible_endpoint_ids: [7] }],
  endpoints: [{
    id: 7,
    name: 'DeepSeek',
    provider: 'deepseek',
    execution_type: 'direct_api',
    execution_adapter: 'internal_http',
    payload_format: 'openai',
    cache_transport: 'inline_chunk',
    attachment_transports: ['inline_text'],
    configured: true,
    enabled: true,
  }],
  roles: {
    main: [{ model: 'deepseek-v4-flash', default_endpoint: 7 }],
    support: {
      general_sub_agent: { model: 'deepseek-v4-flash', default_endpoint: 7 },
      vision_helper: { model: 'deepseek-v4-flash', default_endpoint: 7 },
      grounding: { model: 'deepseek-v4-flash', default_endpoint: 7 },
      image_gen: { model: 'deepseek-v4-flash', default_endpoint: 7 },
    },
  },
  providers: [{
    id: 'deepseek',
    display_name: 'DeepSeek',
    execution_type: 'direct_api',
    execution_adapter: 'internal_http',
    requires_endpoint_api_key: true,
  }],
};

const convRow = (id: number, overrides: Record<string, unknown> = {}) => ({
  id,
  name: `会话 ${id}`,
  created_at: '2026-10-01T10:00:00Z',
  frozen_project_ids: [],
  project: 0,
  project_name: null,
  agent_type: 'g045',
  agent_preset_id: 1,
  last_message_at: '2026-10-10T10:00:00Z',
  thinking_level: 'auto',
  memory_injection_enabled: null,
  is_prime: false,
  ...overrides,
});

const userRow = (id: number, content: string, index: number, extra: Record<string, unknown> = {}) => ({
  id,
  role: 'user',
  content,
  reasoning_content: null,
  platform: null,
  model_version: null,
  token_count: null,
  index_in_session: index,
  attachment_ids: [],
  attachments_meta: null,
  created_at: '2026-10-16T10:00:00Z',
  ...extra,
});

const SSE_DONE = () =>
  new Response('event: done\ndata: [DONE]\n\n', { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
const sseError = (payload: Record<string, unknown>) =>
  new Response(`event: error\ndata: ${JSON.stringify(payload)}\n\n`, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });

interface Setup {
  conversations?: unknown[];
  history?: () => unknown[];
  post?: (body: Record<string, unknown>) => Response;
}

function setup({ conversations, history = () => [], post = () => SSE_DONE() }: Setup = {}) {
  const bodies: Record<string, unknown>[] = [];
  const convs = conversations ?? [
    convRow(40, { is_prime: true, last_message_at: '2026-10-12T10:00:00Z' }),
    convRow(41, { last_message_at: '2026-10-15T10:00:00Z', name: '最近的会话' }),
    convRow(50, { agent_type: 'standard', agent_preset_id: 5, name: '标准会话' }),
  ];
  const routes: MockRoute[] = [
    { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_G045]) },
    { test: '/api/core/model-catalog/', handler: () => jsonResponse(MODEL_CATALOG) },
    { test: '/api/agents/conversations/', handler: () => jsonResponse(convs) },
    {
      test: /^\/api\/agents\/conversations\/(\d+)\/$/,
      handler: (url) => {
        const id = Number(/(\d+)\/$/.exec(url.pathname)?.[1]);
        const row = (convs as { id: number }[]).find((c) => c.id === id);
        return row ? jsonResponse(row) : jsonResponse({ error: 'nf' }, 404);
      },
    },
    {
      test: /^\/api\/agents\/chat\/\d+\/$/,
      handler: (_url, init) => {
        if (init?.method === 'POST') {
          const body = JSON.parse(String(init.body)) as Record<string, unknown>;
          bodies.push(body);
          return post(body);
        }
        const messages = history();
        return jsonResponse({ messages, total_count: messages.length, has_more: false });
      },
    },
    { test: '/api/collection/items/', method: 'GET', handler: () => jsonResponse({ items: [1, 2, 3, 4, 5, 6].map((id) => listItem(id)), next_cursor: null }) },
    { test: '/api/collection/tags/', handler: () => jsonResponse([]) },
    {
      test: /^\/api\/collection\/items\/\d+\/$/,
      method: 'GET',
      handler: (url) => jsonResponse(detailItem(Number(/(\d+)\/$/.exec(url.pathname)?.[1]))),
    },
  ];
  const { calls } = installFetch(routes);
  return { bodies, calls };
}

async function chips() {
  const strip = await screen.findByLabelText('待发藏品卡');
  return within(strip).getAllByTestId('compose-collection-card');
}
const chipIds = (nodes: HTMLElement[]) => nodes.map((node) => Number(node.getAttribute('data-item-id')));

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  unmockFetch();
  window.localStorage.clear();
});

describe('Library → chat bring-back (#61 CP5)', () => {
  it('picker lists only G045 Conversations, most recent first, Prime preselected; draft is untouched', async () => {
    saveConversationDraft(40, '我的草稿');
    const { calls } = setup();
    renderApp(['/library/items/3']);

    fireEvent.click(await screen.findByRole('button', { name: '带回聊天' }));
    const dialog = await screen.findByRole('dialog', { name: '带回到哪个会话？' });
    const radios = await within(dialog).findAllByRole('radio');
    expect(radios.map((r) => r.closest('label')?.textContent)).toEqual([
      expect.stringContaining('最近的会话'),
      expect.stringContaining('会话 40'),
    ]);
    expect(within(dialog).queryByText('标准会话')).toBeNull();
    expect((radios[1] as HTMLInputElement).checked).toBe(true);
    expect(within(dialog).getByText('默认')).toBeTruthy();

    // Bringing back writes nothing server-side (the item view record aside).
    const writes = () =>
      calls.filter((c) => (c.init?.method ?? 'GET') !== 'GET' && !c.url.pathname.includes('/view')).length;
    expect(writes()).toBe(0);
    fireEvent.click(within(dialog).getByRole('button', { name: '带回' }));

    const textbox = await screen.findByRole('textbox', { name: /消息输入框/ });
    expect(chipIds(await chips())).toEqual([3]);
    await waitFor(() => expect(within(screen.getByLabelText('待发藏品卡')).getByText('藏品 3')).toBeTruthy());
    expect(within(screen.getByLabelText('待发藏品卡')).getByText('藏品 · 文字')).toBeTruthy();
    expect((textbox as HTMLTextAreaElement).value).toBe('我的草稿');
    expect(loadConversationDraft(40)).toBe('我的草稿');
    expect(writes()).toBe(0);
  });

  it('empty state: no G045 Conversation disables 带回 and links to Chat', async () => {
    setup({ conversations: [convRow(50, { agent_type: 'standard' })] });
    renderApp(['/library/items/3']);
    fireEvent.click(await screen.findByRole('button', { name: '带回聊天' }));
    const dialog = await screen.findByRole('dialog', { name: '带回到哪个会话？' });
    expect(await within(dialog).findByText('还没有可以带回的 G045 会话')).toBeTruthy();
    expect(within(dialog).getByRole('link', { name: '去 Chat 新建会话' })).toBeTruthy();
    expect((within(dialog).getByRole('button', { name: '带回' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('wall multi-select keeps pick order, caps at five and brings the cards in that order', async () => {
    setup();
    renderApp(['/library']);
    fireEvent.click(await screen.findByRole('button', { name: '多选' }));
    for (const id of [4, 2, 6, 1, 3]) fireEvent.click(screen.getByRole('button', { name: `藏品 ${id}` }));
    expect(screen.getByText('已选 5 / 5')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '藏品 5' }));
    expect(screen.getByText('每次最多带回 5 件')).toBeTruthy();
    expect(screen.getByRole('button', { name: '藏品 5' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByLabelText('第 1 件').closest('article')?.textContent).toContain('藏品 4');

    fireEvent.click(screen.getByRole('button', { name: '带回聊天（5）' }));
    const dialog = await screen.findByRole('dialog', { name: '带回到哪个会话？' });
    await within(dialog).findAllByRole('radio');
    fireEvent.click(within(dialog).getByRole('button', { name: '带回' }));
    expect(chipIds(await chips())).toEqual([4, 2, 6, 1, 3]);
    expect(screen.getByText('5 / 5')).toBeTruthy();
  });

  it('router state is consumed once and dedups against cards already waiting', async () => {
    setup();
    renderApp(['/library']);
    fireEvent.click(await screen.findByRole('button', { name: '多选' }));
    fireEvent.click(screen.getByRole('button', { name: '藏品 2' }));
    fireEvent.click(screen.getByRole('button', { name: '藏品 2' }));
    fireEvent.click(screen.getByRole('button', { name: '藏品 1' }));
    fireEvent.click(screen.getByRole('button', { name: '带回聊天（1）' }));
    const dialog = await screen.findByRole('dialog', { name: '带回到哪个会话？' });
    await within(dialog).findAllByRole('radio');
    fireEvent.click(within(dialog).getByRole('button', { name: '带回' }));
    expect(chipIds(await chips())).toEqual([1]);
  });

  it('a card-only send carries collection_items in order with empty content and clears the cards', async () => {
    const { bodies } = setup();
    renderApp(['/library']);
    fireEvent.click(await screen.findByRole('button', { name: '多选' }));
    fireEvent.click(screen.getByRole('button', { name: '藏品 6' }));
    fireEvent.click(screen.getByRole('button', { name: '藏品 2' }));
    fireEvent.click(screen.getByRole('button', { name: '带回聊天（2）' }));
    const dialog = await screen.findByRole('dialog', { name: '带回到哪个会话？' });
    await within(dialog).findAllByRole('radio');
    fireEvent.click(within(dialog).getByRole('button', { name: '带回' }));
    await chips();

    const send = screen.getByRole('button', { name: '发送消息' }) as HTMLButtonElement;
    await waitFor(() => expect(send.disabled).toBe(false));
    fireEvent.click(send);
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ content: '', collection_items: [6, 2] });
    await waitFor(() => expect(screen.queryByLabelText('待发藏品卡')).toBeNull());
  });
});

describe('Composer bring-back rules (#61 CP5)', () => {
  async function openWithCards(ids: number[], s: Setup = {}) {
    const result = setup(s);
    renderApp(['/library']);
    fireEvent.click(await screen.findByRole('button', { name: '多选' }));
    for (const id of ids) fireEvent.click(screen.getByRole('button', { name: `藏品 ${id}` }));
    fireEvent.click(screen.getByRole('button', { name: `带回聊天（${ids.length}）` }));
    const dialog = await screen.findByRole('dialog', { name: '带回到哪个会话？' });
    await within(dialog).findAllByRole('radio');
    fireEvent.click(within(dialog).getByRole('button', { name: '带回' }));
    await chips();
    const textbox = (await screen.findByRole('textbox', { name: /消息输入框/ })) as HTMLTextAreaElement;
    const send = screen.getByRole('button', { name: '发送消息' }) as HTMLButtonElement;
    await waitFor(() => expect(send.disabled).toBe(false));
    return { ...result, textbox, send };
  }

  it('edit mode greys the cards and the edit body carries none', async () => {
    const { bodies } = await openWithCards([1, 2], { history: () => [userRow(901, '旧消息', 0)] });
    fireEvent.click(await screen.findByRole('button', { name: '编辑此条消息' }));
    expect(await screen.findByText('编辑消息时不能带藏品')).toBeTruthy();
    expect(screen.getByLabelText('待发藏品卡').getAttribute('aria-disabled')).toBe('true');
    expect(screen.queryByRole('button', { name: /^移除 / })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '确认修改并发送' }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ edit_message_id: 901 });
    expect(bodies[0]).not.toHaveProperty('collection_items');
  });

  it('regenerate never carries the waiting cards, which stay for the next send', async () => {
    const { bodies } = await openWithCards([2, 1], {
      history: () => [
        userRow(901, '旧消息', 0),
        { ...userRow(902, '旧回答', 1), role: 'assistant', platform: 'deepseek' },
      ],
    });
    fireEvent.click(await screen.findByRole('button', { name: '重新生成回答' }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ edit_message_id: 901 });
    expect(bodies[0]).not.toHaveProperty('collection_items');
    expect(chipIds(await chips())).toEqual([2, 1]);
  });

  it('a per-item 422 marks exactly that card, keeps draft and the others, and blocks send until removed', async () => {
    let reject = true;
    const { bodies, textbox, send } = await openWithCards([1, 2, 3], {
      post: () =>
        reject
          ? jsonResponse({ code: 'collection_bring_original_unavailable', message: '原件不可用', item_id: 2 }, 422)
          : SSE_DONE(),
    });
    fireEvent.change(textbox, { target: { value: '还记得这个吗' } });
    fireEvent.click(send);
    await waitFor(() => expect(bodies).toHaveLength(1));

    const alert = await screen.findByText('发送失败：“藏品 2”的原件不可用，移除后再发送。');
    expect(alert.getAttribute('role')).toBe('alert');
    const nodes = await chips();
    expect(chipIds(nodes)).toEqual([1, 2, 3]);
    expect(nodes.map((n) => n.className.includes('--rejected'))).toEqual([false, true, false]);
    expect(within(nodes[1]).getByText('原件不可用')).toBeTruthy();
    expect(textbox.value).toBe('还记得这个吗');
    expect(send.disabled).toBe(true);

    reject = false;
    fireEvent.click(screen.getByRole('button', { name: '移除 藏品 2' }));
    await waitFor(() => expect(send.disabled).toBe(false));
    fireEvent.click(send);
    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(bodies[1]).toMatchObject({ content: '还记得这个吗', collection_items: [1, 3] });
  });

  it('a whole-request 400 marks no single card', async () => {
    const { bodies, send } = await openWithCards([1, 2], {
      post: () => jsonResponse({ code: 'collection_bring_too_many', error: '每次最多带回 5 件' }, 400),
    });
    fireEvent.click(send);
    await waitFor(() => expect(bodies).toHaveLength(1));
    await waitFor(() => expect(send.disabled).toBe(false));
    const nodes = await chips();
    expect(chipIds(nodes)).toEqual([1, 2]);
    expect(nodes.some((n) => n.className.includes('--rejected'))).toBe(false);
    expect(screen.queryByText(/移除后再发送/)).toBeNull();
  });

  it('an accepted turn that fails unpersisted restores the cards in their original order', async () => {
    const { bodies, textbox } = await openWithCards([3, 1, 2], {
      post: () => sseError({ code: 'service_unavailable', message: '上游暂不可用' }),
    });
    fireEvent.change(textbox, { target: { value: '一起看' } });
    fireEvent.click(screen.getByRole('button', { name: '发送消息' }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ collection_items: [3, 1, 2] });
    await waitFor(() => expect(textbox.value).toBe('一起看'));
    const nodes = await chips();
    expect(chipIds(nodes)).toEqual([3, 1, 2]);
    expect(nodes.some((n) => n.className.includes('--rejected'))).toBe(false);
  });

  it('an accepted turn failing with an item_id SSE error restores the cards and marks that one', async () => {
    const { bodies } = await openWithCards([1, 2], {
      post: () => sseError({ code: 'collection_bring_empty_text', message: '文字为空', item_id: 1 }),
    });
    fireEvent.click(screen.getByRole('button', { name: '发送消息' }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    await waitFor(async () => {
      const nodes = await chips();
      expect(chipIds(nodes)).toEqual([1, 2]);
      expect(nodes.map((n) => n.className.includes('--rejected'))).toEqual([true, false]);
    });
    expect(await screen.findByText('发送失败：“藏品 1”的文字为空，移除后再发送。')).toBeTruthy();
  });
});

describe('recorded voice with waiting cards (#61 CP6 F-01)', () => {
  const BLOCKED = '录音不能和藏品卡一起发送：移除藏品卡后可发语音，取消录音后可发藏品卡。';

  function VoiceAndCards({ reject, onSend, sendRecorded }: {
    reject: boolean;
    onSend: (turn: ChatTurnInput) => Promise<TurnAcceptance>;
    sendRecorded: AudioRecoveryApi['sendRecorded'];
  }) {
    const collection = useComposeCollectionCards(42);
    // Idle at mount like a real clip, so the composer's route-switch cancel runs first.
    const [status, setStatus] = useState<AudioRecorderApi['status']>('idle');
    useEffect(() => {
      collection.addCards([11]);
      if (reject) collection.rejectCard(11, 'collection_bring_item_not_found');
      setStatus('recorded');
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const recorder: AudioRecorderApi = {
      status,
      recordingSeconds: 0,
      blob: status === 'recorded' ? new Blob(['x']) : null,
      blobUrl: null,
      error: null,
      errorMessage: '',
      mimeType: status === 'recorded' ? 'audio/webm' : null,
      start: vi.fn(),
      stop: vi.fn(),
      cancel: () => setStatus('idle'),
      fail: vi.fn(),
    };
    const audioRecovery: AudioRecoveryApi = {
      state: null,
      uploading: false,
      uploadError: null,
      retryDecision: { enabled: false, reason: 'none' },
      onRuntimeOutcome: vi.fn(),
      sendRecorded,
      retry: vi.fn(),
      purgeAttachmentId: vi.fn(),
      abandon: vi.fn(),
      dismissUploadError: vi.fn(),
      isUploading: () => false,
      hasSnapshot: () => false,
    };
    const props: ChatComposerProps = {
      conversationId: 42,
      status: 'idle',
      busy: false,
      dispatchSettings: { model: 'deepseek-v4-flash', endpoint: 7, thinkingLevel: 'medium', cacheEnabled: true, sessionType: 'full' },
      targetNotice: null,
      projectId: null,
      pendingProjectInsert: null,
      onProjectInsertConsumed: vi.fn(),
      onSend,
      onStop: vi.fn(),
      editingTarget: null,
      onCancelEdit: vi.fn(),
      onConfirmEdit: vi.fn(),
      compose: {
        entries: [], anyUploading: false, successfulIds: [], getSuccessfulIds: () => [], uploadingCount: 0,
        addFiles: vi.fn(), removeEntry: vi.fn(), purgeAttachmentId: vi.fn(), clearCompose: vi.fn(), restoreEntries: vi.fn(),
      },
      attachmentManager: {
        rows: [], loading: false, notice: null, frozenInCache: false, deletePending: false,
        isDeletePending: () => false, refresh: vi.fn(), remove: vi.fn(), dismissNotice: vi.fn(),
      },
      recorder,
      audioGate: { state: 'supported', target: { model: 'deepseek-v4-flash', endpoint: 7 } },
      audioRecovery,
      onRetryAudio: vi.fn(),
      collection,
    };
    return <ChatComposer {...props} />;
  }

  function mount(reject: boolean) {
    installFetch([{ test: '/api/collection/items/11/', method: 'GET', handler: () => jsonResponse(detailItem(11)) }]);
    const onSend = vi.fn(async (_turn: ChatTurnInput): Promise<TurnAcceptance> => 'accepted');
    const sendRecorded = vi.fn().mockResolvedValue('accepted' as TurnAcceptance);
    renderV4(<VoiceAndCards reject={reject} onSend={onSend} sendRecorded={sendRecorded} />);
    return { onSend, sendRecorded };
  }

  const voiceSend = () => screen.getByRole('button', { name: '发送语音' }) as HTMLButtonElement;

  it('pending cards: voice send is disabled with an announced reason; cancelling the clip lets the cards send', async () => {
    const { onSend, sendRecorded } = mount(false);
    await waitFor(() => expect(screen.getByLabelText('待发藏品卡')).toBeTruthy());
    expect(voiceSend().disabled).toBe(true);
    expect(voiceSend().getAttribute('aria-describedby')).toBe('app-audio-send-blocked');
    expect(screen.getByText(BLOCKED).getAttribute('role')).toBe('status');
    fireEvent.click(voiceSend());
    expect(sendRecorded).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '取消录音' }));
    expect(screen.queryByRole('button', { name: '发送语音' })).toBeNull();
    expect(screen.queryByText(BLOCKED)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '发送消息' }));
    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));
    expect(onSend.mock.calls[0][0].collectionItems).toEqual([11]);
    expect(sendRecorded).not.toHaveBeenCalled();
  });

  it('rejected card: voice send is disabled with the reason; removing the card lets the clip send', async () => {
    const { onSend, sendRecorded } = mount(true);
    await waitFor(() => expect(screen.getByLabelText('待发藏品卡')).toBeTruthy());
    expect(voiceSend().disabled).toBe(true);
    expect(screen.getByText(BLOCKED)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /^移除/ }));
    await waitFor(() => expect(voiceSend().disabled).toBe(false));
    expect(screen.queryByText(BLOCKED)).toBeNull();
    fireEvent.click(voiceSend());
    await waitFor(() => expect(sendRecorded).toHaveBeenCalledTimes(1));
    expect(onSend).not.toHaveBeenCalled();
  });
});
