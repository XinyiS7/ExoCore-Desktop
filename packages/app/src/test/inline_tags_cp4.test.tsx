import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { normalizeBlock, normalizeStaged } from '../features/chat/api';
import { ChatComposer, type ChatComposerProps } from '../features/chat/ChatComposer';
import type { AudioRecorderApi } from '../features/chat/audio/useAudioRecorder';
import type { AudioRecoveryApi } from '../features/chat/audio/audioRecoveryMachine';
import type { TurnAcceptance } from '../features/chat/runtime/types';
import { STAGING_REFRESH_MS } from '../features/chat/queries';
import { formatBlockRemaining } from '../features/chat/inlineTags/blockTime';
import { readRuntimeMarker, saveTransportPreference } from '../features/chat/runtime/storage';
import { installRuntimeFetch, jsonResponse, renderApp, renderV4, unmockFetch } from './helpers';

/**
 * #130 CP4 — `inline_state.block` / `.staged`, the staged chat POST answer and
 * the text-only composer (D-E).
 */

describe('inline_state block / staged normalization', () => {
  it('reads a block and drops malformed staged rows', () => {
    expect(normalizeBlock({ block: { unblock_at: '2026-11-13T16:00:00Z' } })).toEqual({
      unblockAt: '2026-11-13T16:00:00Z',
    });
    expect(normalizeBlock({ block: null })).toBeNull();
    expect(normalizeBlock({ block: { unblock_at: 3 } })).toBeNull();
    expect(normalizeBlock(undefined)).toBeNull();
    expect(
      normalizeStaged({
        staged: [
          { id: 1, content: '在吗', clicked_at: '2026-11-13T15:59:00Z' },
          { id: 3, content: '没发出', clicked_at: '2026-11-13T15:59:00Z', failed: true },
          { id: 'x', content: '坏的', clicked_at: '2026-11-13T15:59:00Z' },
          { id: 2, content: null, clicked_at: '2026-11-13T15:59:00Z' },
        ],
      }),
    ).toEqual([
      { id: 1, content: '在吗', clickedAt: '2026-11-13T15:59:00Z', failed: false },
      { id: 3, content: '没发出', clickedAt: '2026-11-13T15:59:00Z', failed: true },
    ]);
    expect(normalizeStaged({ pins: [] })).toEqual([]);
  });

  it('formats the remaining block time and ends at zero', () => {
    const now = Date.parse('2026-11-13T16:00:00Z');
    expect(formatBlockRemaining('2026-11-13T16:01:05Z', now)).toBe('1:05');
    expect(formatBlockRemaining('2026-11-13T17:02:03Z', now)).toBe('1:02:03');
    expect(formatBlockRemaining('2026-11-13T16:00:00.400Z', now)).toBe('0:01');
    expect(formatBlockRemaining('2026-11-13T16:00:00Z', now)).toBeNull();
    expect(formatBlockRemaining('not a date', now)).toBeNull();
  });
});

const PRESET = {
  id: 5,
  name: 'Ecki',
  description: null,
  agent_type: 'standard',
  default_model: 'deepseek-v4-flash',
  system_prompt: null,
  is_visible: true,
};

const conversation = (inlineState: Record<string, unknown>) => ({
  id: 60,
  name: 'conv 60',
  created_at: '2026-09-01T10:00:00Z',
  frozen_project_ids: [],
  project: 0,
  project_name: null,
  agent_type: 'standard',
  agent_preset_id: 5,
  last_message_at: '2026-09-01T10:00:00Z',
  thinking_level: 'auto',
  memory_injection_enabled: null,
  is_prime: false,
  inline_state: { pins: [], block: null, staged: [], ...inlineState },
});

const inMinutes = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();
const EMPTY_PAGE = { messages: [], total_count: 0, has_more: false };

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  unmockFetch();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('staging area and text-only composer', () => {
  it('a block shows the countdown and staged bubbles outside the timeline; uploads and recording are disabled', async () => {
    installRuntimeFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET]) },
      {
        test: '/api/agents/conversations/60/',
        handler: () =>
          jsonResponse(
            conversation({
              block: { unblock_at: inMinutes(3) },
              staged: [{ id: 1, content: '在吗', clicked_at: '2026-11-13T15:59:00Z' }],
            }),
          ),
      },
      { test: '/api/agents/chat/60/', handler: () => jsonResponse(EMPTY_PAGE) },
    ]);
    renderApp(['/chat/60']);

    const area = await screen.findByRole('region', { name: '暂存区' });
    expect(within(area).getByRole('status').textContent).toMatch(/禁言中 · 剩余 (2:5\d|3:00)/);
    expect(within(area).getByText('在吗')).toBeInTheDocument();
    expect(area.closest('.app-scroll')).toBeNull();
    expect(screen.getByRole('button', { name: '选择图片附件' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '选择文件附件' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '开始录音' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: /消息输入框/ })).toBeEnabled();
  });

  it('without block or staged rows there is no staging area and uploads stay enabled', async () => {
    installRuntimeFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET]) },
      { test: '/api/agents/conversations/60/', handler: () => jsonResponse(conversation({})) },
      { test: '/api/agents/chat/60/', handler: () => jsonResponse(EMPTY_PAGE) },
    ]);
    renderApp(['/chat/60']);
    await screen.findByText('还没有消息');
    expect(screen.queryByRole('region', { name: '暂存区' })).toBeNull();
    expect(screen.getByRole('button', { name: '选择图片附件' })).toBeEnabled();
  });

  it.each(['sse', 'async'] as const)('%s: a staged answer consumes the draft, starts no turn and shows the staged bubble from the re-read detail', async (transport) => {
    saveTransportPreference(transport);
    let staged: unknown[] = [];
    const unblockAt = inMinutes(3);
    const { calls } = installRuntimeFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET]) },
      {
        test: '/api/agents/conversations/60/',
        handler: () => jsonResponse(conversation({ block: { unblock_at: unblockAt }, staged })),
      },
      {
        test: '/api/agents/chat/60/',
        method: 'POST',
        handler: () => {
          staged = [{ id: 4, content: '在吗', clicked_at: new Date().toISOString() }];
          return jsonResponse({ status: 'staged', unblock_at: unblockAt });
        },
      },
      { test: '/api/agents/chat/60/', handler: () => jsonResponse(EMPTY_PAGE) },
    ]);
    renderApp(['/chat/60']);
    const textbox = await screen.findByRole('textbox', { name: /消息输入框/ });
    fireEvent.change(textbox, { target: { value: '在吗' } });
    fireEvent.keyDown(textbox, { key: 'Enter', shiftKey: true });

    const area = await screen.findByRole('region', { name: '暂存区' });
    await waitFor(() => expect(within(area).getByText('在吗')).toBeInTheDocument());
    expect(textbox).toHaveValue('');
    // Not an optimistic timeline bubble and no turn is running.
    expect(document.querySelector('.app-scroll')?.textContent ?? '').not.toContain('在吗');
    expect(screen.queryByRole('button', { name: '停止生成' })).toBeNull();
    const posts = calls.filter((c) => c.init?.method === 'POST' && c.url.pathname === '/api/agents/chat/60/');
    expect(posts.map((c) => c.url.search)).toEqual([transport === 'async' ? '?mode=async' : '']);
    // Settled at once: no stream read, no polling, no error, no in-flight marker left behind.
    expect(calls.some((c) => c.url.pathname.includes('/status/'))).toBe(false);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(readRuntimeMarker(60)).toBeNull();
    expect(textbox).toBeEnabled();
    // No turn settled either: the message window was never re-fetched and no stream error surfaced.
    const pageReads = calls.filter((c) => (c.init?.method ?? 'GET') === 'GET' && c.url.pathname === '/api/agents/chat/60/');
    expect(pageReads).toHaveLength(1);
    expect(screen.queryByText(/无法读取服务器数据流/)).toBeNull();
  });

  it('when the countdown runs out the detail is re-read and the composer unlocks', async () => {
    let block: unknown = { unblock_at: new Date(Date.now() + 1200).toISOString() };
    installRuntimeFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET]) },
      { test: '/api/agents/conversations/60/', handler: () => jsonResponse(conversation({ block })) },
      { test: '/api/agents/chat/60/', handler: () => jsonResponse(EMPTY_PAGE) },
    ]);
    renderApp(['/chat/60']);
    await screen.findByRole('region', { name: '暂存区' });
    expect(screen.getByRole('button', { name: '选择图片附件' })).toBeDisabled();
    block = null;
    await waitFor(() => expect(screen.queryByRole('region', { name: '暂存区' })).toBeNull(), { timeout: 4000 });
    expect(screen.getByRole('button', { name: '选择图片附件' })).toBeEnabled();
  });
});

const detailReads = (calls: { url: URL; init?: RequestInit }[]) =>
  calls.filter((c) => (c.init?.method ?? 'GET') === 'GET' && c.url.pathname === '/api/agents/conversations/60/').length;

describe('staging detail refresh cadence (CP4-F04)', () => {
  it('after the countdown, a reread that still shows staged rows keeps polling until the server settles, then stops', async () => {
    let state: Record<string, unknown> = {
      block: { unblock_at: new Date(Date.now() + 500).toISOString() },
      staged: [{ id: 1, content: '在吗', clicked_at: '2026-11-13T15:59:00Z' }],
    };
    const { calls } = installRuntimeFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET]) },
      { test: '/api/agents/conversations/60/', handler: () => jsonResponse(conversation(state)) },
      { test: '/api/agents/chat/60/', handler: () => jsonResponse(EMPTY_PAGE) },
    ]);
    renderApp(['/chat/60']);
    await screen.findByRole('region', { name: '暂存区' });
    // Block over, flush not committed yet: the reread still has the staged row.
    state = { block: null, staged: state.staged };
    await waitFor(() => expect(screen.queryByText(/禁言中/)).toBeNull(), { timeout: 3000 });
    const afterExpiry = detailReads(calls);
    await waitFor(() => expect(detailReads(calls)).toBeGreaterThan(afterExpiry), { timeout: STAGING_REFRESH_MS * 2 });
    expect(screen.getByRole('button', { name: '选择图片附件' })).toBeDisabled();

    state = { block: null, staged: [] };
    await waitFor(() => expect(screen.queryByRole('region', { name: '暂存区' })).toBeNull(), { timeout: STAGING_REFRESH_MS * 2 });
    expect(screen.getByRole('button', { name: '选择图片附件' })).toBeEnabled();
    const settled = detailReads(calls);
    await act(() => new Promise((resolve) => setTimeout(resolve, STAGING_REFRESH_MS * 1.5)));
    expect(detailReads(calls)).toBe(settled);
  }, 15000);

  it('backend-turn staging (no countdown) follows the same lifecycle', async () => {
    let state: Record<string, unknown> = {
      staged: [{ id: 2, content: '插一句', clicked_at: '2026-11-13T15:59:00Z' }],
    };
    const { calls } = installRuntimeFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET]) },
      { test: '/api/agents/conversations/60/', handler: () => jsonResponse(conversation(state)) },
      { test: '/api/agents/chat/60/', handler: () => jsonResponse(EMPTY_PAGE) },
    ]);
    renderApp(['/chat/60']);
    const area = await screen.findByRole('region', { name: '暂存区' });
    expect(within(area).queryByText(/禁言中/)).toBeNull();
    const first = detailReads(calls);
    await waitFor(() => expect(detailReads(calls)).toBeGreaterThan(first), { timeout: STAGING_REFRESH_MS * 2 });
    state = { staged: [] };
    await waitFor(() => expect(screen.queryByRole('region', { name: '暂存区' })).toBeNull(), { timeout: STAGING_REFRESH_MS * 2 });
    expect(screen.getByRole('button', { name: '选择图片附件' })).toBeEnabled();
  }, 15000);
});

describe('failed staged sends (CP4-F02)', () => {
  it('a failed row is shown as failed, does not lock the composer or poll, and can be discarded', async () => {
    let staged: unknown[] = [{ id: 5, content: '没发出', clicked_at: '2026-11-13T15:59:00Z', failed: true }];
    const { calls } = installRuntimeFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET]) },
      {
        test: '/api/agents/conversations/60/staged/5/',
        method: 'DELETE',
        handler: () => {
          staged = [];
          return jsonResponse(null, 204);
        },
      },
      { test: '/api/agents/conversations/60/', handler: () => jsonResponse(conversation({ staged })) },
      { test: '/api/agents/chat/60/', handler: () => jsonResponse(EMPTY_PAGE) },
    ]);
    renderApp(['/chat/60']);
    const area = await screen.findByRole('region', { name: '暂存区' });
    expect(within(area).getByRole('alert').textContent).toMatch(/发送失败.*不会自动重发/);
    expect(within(area).getByText('没发出')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '选择图片附件' })).toBeEnabled();
    const reads = detailReads(calls);
    await act(() => new Promise((resolve) => setTimeout(resolve, STAGING_REFRESH_MS * 1.5)));
    expect(detailReads(calls)).toBe(reads);

    fireEvent.click(within(area).getByRole('button', { name: '丢弃发送失败的暂存消息：没发出' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: '暂存区' })).toBeNull());
    expect(calls.some((c) => c.init?.method === 'DELETE' && c.url.pathname.endsWith('/staged/5/'))).toBe(true);
  }, 10000);
});

describe('text-only composer with a kept clip / attachment / recovery (CP4-F03)', () => {
  function Harness({
    onSend,
    sendRecorded,
    onRetryAudio,
    withClip,
    withAttachment,
    withRecovery,
    editing,
  }: {
    onSend: ChatComposerProps['onSend'];
    sendRecorded: AudioRecoveryApi['sendRecorded'];
    onRetryAudio: () => void;
    withClip?: boolean;
    withAttachment?: boolean;
    withRecovery?: boolean;
    editing?: boolean;
  }) {
    const [textOnly, setTextOnly] = useState(true);
    const [recorded, setRecorded] = useState(false);
    const cancel = vi.fn(() => setRecorded(false));
    const recorder: AudioRecorderApi = {
      status: recorded ? 'recorded' : 'idle',
      recordingSeconds: 0,
      blob: recorded ? new Blob(['x']) : null,
      blobUrl: null,
      error: null,
      errorMessage: '',
      mimeType: recorded ? 'audio/webm' : null,
      start: vi.fn(),
      stop: vi.fn(),
      cancel,
      fail: vi.fn(),
    };
    const audioRecovery: AudioRecoveryApi = {
      state: withRecovery
        ? {
            kind: 'active',
            snapshot: {
              conversationId: 42,
              attemptKey: 'k',
              originalText: '语音',
              dispatchSettings: { model: 'deepseek-v4-flash', endpoint: 7, thinkingLevel: 'medium', cacheEnabled: true, sessionType: 'full' },
              attachmentIds: [9],
              audioAttachmentIds: [9],
              persistence: { kind: 'unknown', reason: 'x' },
              terminal: 'error',
            },
          } as unknown as AudioRecoveryApi['state']
        : null,
      uploading: false,
      uploadError: null,
      retryDecision: { enabled: true, mode: 'ordinary' },
      onRuntimeOutcome: vi.fn(),
      sendRecorded,
      retry: vi.fn(),
      purgeAttachmentId: vi.fn(),
      abandon: vi.fn(),
      dismissUploadError: vi.fn(),
      isUploading: () => false,
      hasSnapshot: () => false,
    };
    const ids = withAttachment ? [8] : [];
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
      editingTarget: editing ? ({ id: 3, content: '原文' } as ChatComposerProps['editingTarget']) : null,
      onCancelEdit: vi.fn(),
      onConfirmEdit: vi.fn(async () => 'accepted' as TurnAcceptance),
      compose: {
        entries: [], anyUploading: false, successfulIds: ids, getSuccessfulIds: () => ids, uploadingCount: 0,
        addFiles: vi.fn(), removeEntry: vi.fn(), purgeAttachmentId: vi.fn(), clearCompose: vi.fn(), restoreEntries: vi.fn(),
      },
      attachmentManager: {
        rows: [], loading: false, notice: null, frozenInCache: false, deletePending: false,
        isDeletePending: () => false, refresh: vi.fn(), remove: vi.fn(), dismissNotice: vi.fn(),
      },
      recorder,
      audioGate: { state: 'supported', target: { model: 'deepseek-v4-flash', endpoint: 7 } },
      audioRecovery,
      onRetryAudio,
      textOnly,
    };
    return (
      <>
        <button type="button" onClick={() => setRecorded(Boolean(withClip))}>mount-clip</button>
        <button type="button" onClick={() => setTextOnly(false)}>unlock</button>
        <ChatComposer {...props} />
      </>
    );
  }

  function mount(opts: { withClip?: boolean; withAttachment?: boolean; withRecovery?: boolean; editing?: boolean }) {
    const onSend = vi.fn(async (): Promise<TurnAcceptance> => 'accepted');
    const sendRecorded = vi.fn().mockResolvedValue('accepted' as TurnAcceptance);
    const onRetryAudio = vi.fn();
    renderV4(<Harness onSend={onSend} sendRecorded={sendRecorded} onRetryAudio={onRetryAudio} {...opts} />);
    fireEvent.click(screen.getByRole('button', { name: 'mount-clip' }));
    return { onSend, sendRecorded, onRetryAudio };
  }

  const btn = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;

  it('a recorded clip cannot be sent by the voice button, the main button or the shortcut; it is kept and sendable after unlock', async () => {
    const { onSend, sendRecorded } = mount({ withClip: true });
    expect(btn('发送语音').disabled).toBe(true);
    expect(screen.getByText(/暂存期间只能发送文字：录音与附件会保留/)).toBeInTheDocument();
    expect(btn('发送消息').disabled).toBe(true);
    fireEvent.click(btn('发送语音'));
    fireEvent.click(btn('发送消息'));
    const textbox = screen.getByRole('textbox', { name: /消息输入框/ });
    fireEvent.keyDown(textbox, { key: 'Enter', shiftKey: true });
    fireEvent.keyDown(textbox, { key: 'Enter', ctrlKey: true, shiftKey: true });
    await act(() => Promise.resolve());
    expect(sendRecorded).not.toHaveBeenCalled();
    expect(onSend).not.toHaveBeenCalled();
    expect(btn('取消录音')).toBeEnabled();

    fireEvent.click(btn('unlock'));
    expect(btn('发送语音').disabled).toBe(false);
    fireEvent.click(btn('发送语音'));
    await waitFor(() => expect(sendRecorded).toHaveBeenCalledTimes(1));
  });

  it('an uploaded compose attachment blocks the main send and the cache send while text-only', async () => {
    const { onSend } = mount({ withAttachment: true });
    expect(btn('发送消息').disabled).toBe(true);
    expect(btn('生成Cache并发送').disabled).toBe(true);
    fireEvent.keyDown(screen.getByRole('textbox', { name: /消息输入框/ }), { key: 'Enter', shiftKey: true });
    await act(() => Promise.resolve());
    expect(onSend).not.toHaveBeenCalled();
  });

  it('plain text still sends while text-only', async () => {
    const { onSend } = mount({});
    fireEvent.change(screen.getByRole('textbox', { name: /消息输入框/ }), { target: { value: '只是文字' } });
    fireEvent.click(btn('发送消息'));
    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));
  });

  it('audio recovery retry is disabled with the reason, kept, and enabled after unlock', () => {
    const { onRetryAudio } = mount({ withRecovery: true });
    expect(btn('重试语音发送').disabled).toBe(true);
    expect(screen.getByText(/语音会保留，等暂存发出后再重试/)).toBeInTheDocument();
    fireEvent.click(btn('重试语音发送'));
    expect(onRetryAudio).not.toHaveBeenCalled();
    fireEvent.click(btn('unlock'));
    expect(btn('重试语音发送').disabled).toBe(false);
  });

  it('an edit cannot be confirmed while text-only', async () => {
    mount({ editing: true });
    expect(btn('确认修改并发送').disabled).toBe(true);
    expect(btn('确认修改并发送').title).toBe('禁言或暂存期间无法编辑或重新生成消息');
  });
});
