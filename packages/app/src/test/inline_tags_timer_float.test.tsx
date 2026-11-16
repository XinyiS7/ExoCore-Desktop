import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { normalizeTimers } from '../features/chat/api';
import type { MessageRow } from '../features/chat/types';
import { installRuntimeFetch, jsonResponse, renderApp, unmockFetch } from './helpers';

/**
 * #130 floating timer hourglass above the composer.
 */

const PRESET = {
  id: 5,
  name: 'Ecki',
  description: null,
  agent_type: 'standard',
  default_model: 'deepseek-v4-flash',
  system_prompt: null,
  is_visible: true,
};

const row = (over: Partial<MessageRow>): MessageRow => ({
  id: 1,
  role: 'assistant',
  content: '',
  reasoning_content: null,
  platform: 'test',
  model_version: null,
  token_count: null,
  index_in_session: 0,
  attachment_ids: [],
  attachments_meta: null,
  created_at: '2026-11-15T15:00:00Z',
  ...over,
});

const conversation = (timers: unknown[]) => ({
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
  inline_state: { pins: [], block: null, staged: [], timers },
});

describe('normalizeTimers', () => {
  it('reads inline_state.timers and drops malformed items', () => {
    expect(
      normalizeTimers({
        timers: [
          {
            id: 3,
            title: '泡茶',
            fire_at: '2026-11-15T15:05:00Z',
            created_at: '2026-11-15T15:00:00Z',
          },
          {
            id: 'bad',
            title: '坏的',
            fire_at: '2026-11-15T15:05:00Z',
            created_at: '2026-11-15T15:00:00Z',
          },
          {
            id: 4,
            title: 123,
            fire_at: '2026-11-15T15:05:00Z',
            created_at: '2026-11-15T15:00:00Z',
          },
        ],
      }),
    ).toEqual([
      {
        id: 3,
        title: '泡茶',
        fireAt: '2026-11-15T15:05:00Z',
        createdAt: '2026-11-15T15:00:00Z',
      },
    ]);
    expect(normalizeTimers(undefined)).toEqual([]);
    expect(normalizeTimers({})).toEqual([]);
  });
});

describe('FloatingTimerBoard', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    unmockFetch();
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('renders nothing when inline_state.timers is empty', async () => {
    installRuntimeFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET]) },
      { test: '/api/agents/conversations/60/', handler: () => jsonResponse(conversation([])) },
      { test: '/api/agents/chat/60/', handler: () => jsonResponse({ messages: [], total_count: 0, has_more: false }) },
    ]);
    renderApp(['/chat/60']);
    await screen.findByText('还没有消息');
    expect(screen.queryByRole('complementary', { name: '计时器浮窗' })).toBeNull();
  });

  it('shows hourglass + short countdown above composer, reveals title on click, and keeps inline message timer', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-11-15T15:00:00Z'));

    installRuntimeFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET]) },
      {
        test: '/api/agents/conversations/60/',
        handler: () =>
          jsonResponse(
            conversation([
              {
                id: 11,
                title: '记得关火去泡茶',
                fire_at: '2026-11-15T15:01:30Z',
                created_at: '2026-11-15T15:00:00Z',
              },
            ]),
          ),
      },
      {
        test: '/api/agents/chat/60/',
        handler: () =>
          jsonResponse({
            messages: [
              {
                ...row({
                  id: 900,
                  content: '好，我提醒你 <timer=90s title="记得关火去泡茶">',
                }),
                index_in_session: 0,
              },
            ],
            total_count: 1,
            has_more: false,
          }),
      },
    ]);

    renderApp(['/chat/60']);

    const floatBoard = await screen.findByRole('complementary', { name: '计时器浮窗' });
    const pill = within(floatBoard).getByRole('button', { name: /倒计时 01:30/ });
    expect(floatBoard.closest('.app-scroll')).toBeNull();
    expect(floatBoard.closest('.app-scroll-stage')).not.toBeNull();

    // Title is hidden in the floating widget until clicked, while message-inline chip remains visible.
    expect(within(floatBoard).queryByText('记得关火去泡茶')).toBeNull();
    expect(document.querySelector('.app-scroll .app-itag-timer')?.textContent).toContain('记得关火去泡茶');

    fireEvent.click(pill);
    const popover = within(floatBoard).getByRole('region', { name: '计时器详情' });
    expect(within(popover).getByText('记得关火去泡茶')).toBeInTheDocument();

    // Pressing Escape closes the popover.
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(within(floatBoard).queryByRole('region', { name: '计时器详情' })).toBeNull();

    // Re-open and close by clicking pill again.
    fireEvent.click(pill);
    expect(within(floatBoard).getByRole('region', { name: '计时器详情' })).toBeInTheDocument();
    fireEvent.click(pill);
    expect(within(floatBoard).queryByRole('region', { name: '计时器详情' })).toBeNull();
  });

  it('shows +N badge for multiple active timers and lists all titles when expanded', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-11-15T15:00:00Z'));

    installRuntimeFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET]) },
      {
        test: '/api/agents/conversations/60/',
        handler: () =>
          jsonResponse(
            conversation([
              {
                id: 11,
                title: '泡茶',
                fire_at: '2026-11-15T15:00:45Z',
                created_at: '2026-11-15T15:00:00Z',
              },
              {
                id: 12,
                title: '开会提醒',
                fire_at: '2026-11-15T15:05:00Z',
                created_at: '2026-11-15T15:00:00Z',
              },
            ]),
          ),
      },
      { test: '/api/agents/chat/60/', handler: () => jsonResponse({ messages: [], total_count: 0, has_more: false }) },
    ]);

    renderApp(['/chat/60']);

    const floatBoard = await screen.findByRole('complementary', { name: '计时器浮窗' });
    const pill = within(floatBoard).getByRole('button', { name: /进行中的计时器共 2 个/ });
    expect(pill.textContent).toContain('00:45');
    expect(pill.textContent).toContain('+1');

    fireEvent.click(pill);
    const popover = within(floatBoard).getByRole('region', { name: '计时器详情' });
    expect(within(popover).getByText('泡茶')).toBeInTheDocument();
    expect(within(popover).getByText('开会提醒')).toBeInTheDocument();
    expect(within(popover).getByText('05:00')).toBeInTheDocument();
  });

  it('invalidates conversation detail when countdown reaches zero and disappears once settled', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-11-15T15:00:00Z'));

    let timers = [
      {
        id: 21,
        title: '短计时',
        fire_at: '2026-11-15T15:00:03Z',
        created_at: '2026-11-15T15:00:00Z',
      },
    ];
    let detailReads = 0;

    installRuntimeFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET]) },
      {
        test: '/api/agents/conversations/60/',
        handler: () => {
          detailReads += 1;
          return jsonResponse(conversation(timers));
        },
      },
      { test: '/api/agents/chat/60/', handler: () => jsonResponse({ messages: [], total_count: 0, has_more: false }) },
    ]);

    renderApp(['/chat/60']);
    const floatBoard = await screen.findByRole('complementary', { name: '计时器浮窗' });
    expect(floatBoard.textContent).toContain('00:03');

    const readsBeforeExpiry = detailReads;
    timers = [];
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });

    await waitFor(() => expect(detailReads).toBeGreaterThan(readsBeforeExpiry));
    await waitFor(() =>
      expect(screen.queryByRole('complementary', { name: '计时器浮窗' })).toBeNull(),
    );
  });
});
