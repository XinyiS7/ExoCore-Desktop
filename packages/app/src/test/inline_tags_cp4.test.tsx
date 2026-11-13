import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { normalizeBlock, normalizeStaged } from '../features/chat/api';
import { formatBlockRemaining } from '../features/chat/inlineTags/blockTime';
import { readRuntimeMarker, saveTransportPreference } from '../features/chat/runtime/storage';
import { installRuntimeFetch, jsonResponse, renderApp, unmockFetch } from './helpers';

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
          { id: 'x', content: '坏的', clicked_at: '2026-11-13T15:59:00Z' },
          { id: 2, content: null, clicked_at: '2026-11-13T15:59:00Z' },
        ],
      }),
    ).toEqual([{ id: 1, content: '在吗', clickedAt: '2026-11-13T15:59:00Z' }]);
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
