import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import {
  callsToPath,
  installFetch,
  jsonResponse,
  renderApp,
} from './helpers';

const PRESET_G045 = {
  id: 1,
  name: 'Alessandro',
  description: 'primary companion',
  agent_type: 'g045',
  default_model: 'gemini-3.5-flash',
  system_prompt: 'Guard and order',
  is_visible: true,
};

const PRESET_STANDARD = {
  id: 5,
  name: 'Ecki',
  description: 'standard assistant',
  agent_type: 'standard',
  default_model: 'deepseek-v4-flash',
  system_prompt: 'Be brief.',
  is_visible: true,
};

const SAMPLE_QUEUE = {
  preset_id: 1,
  auto_enabled: true,
  cadence_mode: 'normal',
  paused_until_utc: '2026-09-30T10:00:00Z',
  paused_until_local: '2026-09-30 12:00',
  next_auto: {
    task_id: 101,
    target_utc: '2026-09-30T09:30:00Z',
    effective_utc: '2026-09-30T09:30:00Z',
    effective_local: '2026-09-30 09:30',
    message: 'routine pulse',
    resume_check: false,
    status: 'pending',
  },
  pending_notes: [
    {
      id: 12,
      message: 'Remember to check the ledger',
      created_at: '2026-09-29T14:00:00Z',
      created_local: '2026-09-29 16:00:00',
    },
  ],
  explicit_wakeups: [
    {
      task_id: 202,
      target_utc: '2026-10-01T08:00:00Z',
      effective_utc: '2026-10-01T08:00:00Z',
      effective_local: '2026-10-01 10:00',
      message: 'Morning check-in',
      resume_check: false,
      status: 'pending',
    },
  ],
  unshown_explicit_count: 2,
};

const SAMPLE_EVENTS = [
  {
    session_uuid: '11111111-1111-1111-1111-111111111111',
    preset_id: 1,
    preset_name: 'Alessandro',
    launch_source: 'user',
    domain: 'system',
    status: 'succeeded',
    content: 'User designated heartbeat completed cleanly.',
    started_at: '2026-09-29T08:00:00Z',
    completed_at: '2026-09-29T08:02:00Z',
  },
  {
    session_uuid: '22222222-2222-2222-2222-222222222222',
    preset_id: 1,
    preset_name: 'Alessandro',
    launch_source: 'auto',
    domain: 'assistant',
    status: 'failed',
    content: '',
    started_at: '2026-09-28T09:00:00Z',
    completed_at: '2026-09-28T09:01:00Z',
  },
];

const SAMPLE_DETAIL_1 = {
  session_uuid: '11111111-1111-1111-1111-111111111111',
  preset_id: 1,
  preset_name: 'Alessandro',
  launch_source: 'user',
  domain: 'system',
  status: 'succeeded',
  content: 'User designated heartbeat completed cleanly.',
  started_at: '2026-09-29T08:00:00Z',
  completed_at: '2026-09-29T08:02:00Z',
  seed_message: 'Triggered by user schedule',
  tool_history: [
    { tool_name: 'fetch_memory', status: 'success' },
    { tool_name: 'analyze', status: 'success' },
  ],
  error_summary: '',
  finalization_reason: 'explicit',
  attempt_number: 1,
  wake_up_task_id: 200,
  source_conversation_id: 10,
  acknowledged_at: null,
};

describe('Heartbeat Page & Profile Entry (CP-A, Plan §2.1 / §2.2)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Unique G045 Profile Entry', () => {
    it('renders Heartbeat Ledger link for G045 preset', async () => {
      installFetch([
        {
          test: '/api/agents/presets/1/',
          handler: () => jsonResponse(PRESET_G045),
        },
        {
          test: '/api/agents/conversations/',
          handler: () => jsonResponse([]),
        },
        {
          test: '/api/memory/plasmids/',
          handler: () => jsonResponse([]),
        },
      ]);

      renderApp(['/agents/1']);

      const link = await screen.findByRole('link', { name: /Heartbeat Ledger/i });
      expect(link).toBeInTheDocument();
      expect(link.getAttribute('href')).toBe('/agents/1/heartbeat');
    });

    it('does NOT render Heartbeat Ledger link for non-G045 preset', async () => {
      installFetch([
        {
          test: '/api/agents/presets/5/',
          handler: () => jsonResponse(PRESET_STANDARD),
        },
        {
          test: '/api/agents/conversations/',
          handler: () => jsonResponse([]),
        },
        {
          test: '/api/memory/plasmids/',
          handler: () => jsonResponse([]),
        },
      ]);

      renderApp(['/agents/5']);

      await screen.findByText('Ecki');
      expect(screen.queryByRole('link', { name: /Heartbeat Ledger/i })).toBeNull();
    });
  });

  describe('Route validation and eligibility', () => {
    it('displays invalid state and issues zero requests for invalid presetId', async () => {
      const { calls } = installFetch([]);
      renderApp(['/agents/invalid-id/heartbeat']);

      await screen.findByText('无效的 Agent 地址');
      expect(callsToPath(calls, '/api/agents/')).toHaveLength(0);
      expect(callsToPath(calls, '/api/heartbeat/')).toHaveLength(0);
    });

    it('displays not-eligible state and issues zero heartbeat requests when preset is not G045', async () => {
      const { calls } = installFetch([
        {
          test: '/api/agents/presets/5/',
          handler: () => jsonResponse(PRESET_STANDARD),
        },
      ]);

      renderApp(['/agents/5/heartbeat']);

      await screen.findByText('该 Agent 不支持心跳');
      expect(callsToPath(calls, '/api/heartbeat/')).toHaveLength(0);
    });

    it('displays missing state when preset returns 404', async () => {
      installFetch([
        {
          test: '/api/agents/presets/999/',
          handler: () => jsonResponse({ error: 'not found' }, 404),
        },
      ]);

      renderApp(['/agents/999/heartbeat']);

      await screen.findByText('Agent 不存在或未公开');
    });
  });

  describe('Section A: One next-auto-heartbeat display', () => {
    it('displays next_auto.effective_local when auto is enabled and next_auto exists', async () => {
      installFetch([
        {
          test: '/api/agents/presets/1/',
          handler: () => jsonResponse(PRESET_G045),
        },
        {
          test: '/api/heartbeat/queue/',
          handler: () => jsonResponse(SAMPLE_QUEUE),
        },
        {
          test: '/api/heartbeat/events/',
          handler: () => jsonResponse({ events: [], total_count: 0, has_more: false }),
        },
      ]);

      renderApp(['/agents/1/heartbeat']);

      await screen.findByText('下次自动心跳');
      expect(screen.getByText('2026-09-30 09:30')).toBeInTheDocument();
      expect(screen.getByText(/暂停至 2026-09-30 12:00/)).toBeInTheDocument();
    });

    it('displays 自动心跳未启用 when auto_enabled is false', async () => {
      installFetch([
        {
          test: '/api/agents/presets/1/',
          handler: () => jsonResponse(PRESET_G045),
        },
        {
          test: '/api/heartbeat/queue/',
          handler: () =>
            jsonResponse({
              ...SAMPLE_QUEUE,
              auto_enabled: false,
              next_auto: null,
              paused_until_local: null,
            }),
        },
        {
          test: '/api/heartbeat/events/',
          handler: () => jsonResponse({ events: [], total_count: 0, has_more: false }),
        },
      ]);

      renderApp(['/agents/1/heartbeat']);

      await screen.findByText('下次自动心跳');
      expect(screen.getByText('自动心跳未启用')).toBeInTheDocument();
    });

    it('displays 尚未排定 when auto_enabled is true but next_auto is null', async () => {
      installFetch([
        {
          test: '/api/agents/presets/1/',
          handler: () => jsonResponse(PRESET_G045),
        },
        {
          test: '/api/heartbeat/queue/',
          handler: () =>
            jsonResponse({
              ...SAMPLE_QUEUE,
              auto_enabled: true,
              next_auto: null,
              paused_until_local: null,
            }),
        },
        {
          test: '/api/heartbeat/events/',
          handler: () => jsonResponse({ events: [], total_count: 0, has_more: false }),
        },
      ]);

      renderApp(['/agents/1/heartbeat']);

      await screen.findByText('下次自动心跳');
      expect(screen.getByText('尚未排定')).toBeInTheDocument();
    });
  });

  describe('Section B: Mailbox & explicit wakeup read', () => {
    it('displays pending notes and explicit wakeups lists', async () => {
      installFetch([
        {
          test: '/api/agents/presets/1/',
          handler: () => jsonResponse(PRESET_G045),
        },
        {
          test: '/api/heartbeat/queue/',
          handler: () => jsonResponse(SAMPLE_QUEUE),
        },
        {
          test: '/api/heartbeat/events/',
          handler: () => jsonResponse({ events: [], total_count: 0, has_more: false }),
        },
      ]);

      renderApp(['/agents/1/heartbeat']);

      await screen.findByText('Remember to check the ledger');
      expect(screen.getByText('2026-09-29 16:00:00')).toBeInTheDocument();
      expect(screen.getByText('Morning check-in')).toBeInTheDocument();
      expect(screen.getByText('2026-10-01 10:00')).toBeInTheDocument();
      expect(screen.getByText(/另有 2 条预约未展开/)).toBeInTheDocument();
    });

    it('displays empty state when notes and wakeups are empty', async () => {
      installFetch([
        {
          test: '/api/agents/presets/1/',
          handler: () => jsonResponse(PRESET_G045),
        },
        {
          test: '/api/heartbeat/queue/',
          handler: () =>
            jsonResponse({
              ...SAMPLE_QUEUE,
              pending_notes: [],
              explicit_wakeups: [],
              unshown_explicit_count: 0,
            }),
        },
        {
          test: '/api/heartbeat/events/',
          handler: () => jsonResponse({ events: [], total_count: 0, has_more: false }),
        },
      ]);

      renderApp(['/agents/1/heartbeat']);

      await screen.findByText('暂无待送达小纸条');
      expect(screen.getByText('暂无预约唤醒')).toBeInTheDocument();
    });
  });

  describe('Section C: Heartbeat Ledger list, detail & pagination', () => {
    it('displays event rows with launch source formatting (user => 用户指定)', async () => {
      installFetch([
        {
          test: '/api/agents/presets/1/',
          handler: () => jsonResponse(PRESET_G045),
        },
        {
          test: '/api/heartbeat/queue/',
          handler: () => jsonResponse(SAMPLE_QUEUE),
        },
        {
          test: '/api/heartbeat/events/',
          handler: () =>
            jsonResponse({
              events: SAMPLE_EVENTS,
              total_count: 2,
              has_more: false,
            }),
        },
      ]);

      renderApp(['/agents/1/heartbeat']);

      await screen.findByText('User designated heartbeat completed cleanly.');
      expect(screen.getByText('用户指定')).toBeInTheDocument();
      expect(screen.getByText('自动心跳')).toBeInTheDocument();
      expect(screen.getByText('共 2 条记录')).toBeInTheDocument();
    });

    it('clicking an event row opens detail panel and allows closing it', async () => {
      installFetch([
        {
          test: '/api/agents/presets/1/',
          handler: () => jsonResponse(PRESET_G045),
        },
        {
          test: '/api/heartbeat/queue/',
          handler: () => jsonResponse(SAMPLE_QUEUE),
        },
        {
          test: '/api/heartbeat/events/',
          handler: () =>
            jsonResponse({
              events: SAMPLE_EVENTS,
              total_count: 2,
              has_more: false,
            }),
        },
        {
          test: `/api/heartbeat/events/${SAMPLE_DETAIL_1.session_uuid}/`,
          handler: () => jsonResponse(SAMPLE_DETAIL_1),
        },
      ]);

      renderApp(['/agents/1/heartbeat']);

      const rowBtn = await screen.findByText('User designated heartbeat completed cleanly.');
      fireEvent.click(rowBtn);

      // Detail panel opens
      const detailRegion = await screen.findByRole('region', { name: '心跳记录详情' });
      await within(detailRegion).findByText('Triggered by user schedule');
      expect(within(detailRegion).getByText('第 1 次尝试')).toBeInTheDocument();
      expect(within(detailRegion).getByText(/工具调用记录 \(2\)/)).toBeInTheDocument();

      // Close detail panel
      const closeBtn = within(detailRegion).getByRole('button', { name: '关闭详情' });
      fireEvent.click(closeBtn);

      await waitFor(() => {
        expect(screen.queryByRole('region', { name: '心跳记录详情' })).toBeNull();
      });
    });

    it('supports pagination next and prev controls', async () => {
      let requestedOffset = 0;
      installFetch([
        {
          test: '/api/agents/presets/1/',
          handler: () => jsonResponse(PRESET_G045),
        },
        {
          test: '/api/heartbeat/queue/',
          handler: () => jsonResponse(SAMPLE_QUEUE),
        },
        {
          test: '/api/heartbeat/events/',
          handler: (url) => {
            requestedOffset = Number(url.searchParams.get('offset') ?? '0');
            return jsonResponse({
              events: SAMPLE_EVENTS,
              total_count: 35,
              has_more: requestedOffset === 0,
            });
          },
        },
      ]);

      renderApp(['/agents/1/heartbeat']);

      await screen.findByText('第 1 页 / 共 2 页');
      const prevBtn = screen.getByRole('button', { name: '上一页' });
      const nextBtn = screen.getByRole('button', { name: '下一页' });

      expect(prevBtn).toBeDisabled();
      expect(nextBtn).toBeEnabled();

      fireEvent.click(nextBtn);

      await waitFor(() => {
        expect(requestedOffset).toBe(20);
      });
      await screen.findByText('第 2 页 / 共 2 页');

      const prevBtnPage2 = screen.getByRole('button', { name: '上一页' });
      const nextBtnPage2 = screen.getByRole('button', { name: '下一页' });
      expect(prevBtnPage2).toBeEnabled();
      expect(nextBtnPage2).toBeDisabled();

      fireEvent.click(prevBtnPage2);
      await waitFor(() => {
        expect(requestedOffset).toBe(0);
      });
      await screen.findByText('第 1 页 / 共 2 页');
    });
  });

  describe('Error and retry states', () => {
    it('displays error and allows retry when events query fails', async () => {
      let attempts = 0;
      installFetch([
        {
          test: '/api/agents/presets/1/',
          handler: () => jsonResponse(PRESET_G045),
        },
        {
          test: '/api/heartbeat/queue/',
          handler: () => jsonResponse(SAMPLE_QUEUE),
        },
        {
          test: '/api/heartbeat/events/',
          handler: () => {
            attempts += 1;
            if (attempts === 1) {
              return jsonResponse({ error: 'Server ledger error' }, 500);
            }
            return jsonResponse({
              events: SAMPLE_EVENTS,
              total_count: 2,
              has_more: false,
            });
          },
        },
      ]);

      renderApp(['/agents/1/heartbeat']);

      await screen.findByText('心跳账本加载失败');
      const retryBtn = screen.getByRole('button', { name: '重试' });
      fireEvent.click(retryBtn);

      await screen.findByText('User designated heartbeat completed cleanly.');
      expect(attempts).toBe(2);
    });
  });

  describe('Mailbox write interactions (CP-B)', () => {
    it('opens leave note dialog, validates empty message, cancels or submits and refreshes queue', async () => {
      let notesInQueue = [...SAMPLE_QUEUE.pending_notes];

      installFetch([
        {
          test: '/api/agents/presets/1/',
          handler: () => jsonResponse(PRESET_G045),
        },
        {
          test: '/api/heartbeat/queue/',
          handler: () =>
            jsonResponse({
              ...SAMPLE_QUEUE,
              pending_notes: notesInQueue,
            }),
        },
        {
          test: '/api/heartbeat/events/',
          handler: () =>
            jsonResponse({
              events: SAMPLE_EVENTS,
              total_count: 2,
              has_more: false,
            }),
        },
        {
          test: '/api/heartbeat/notes/',
          method: 'POST',
          handler: (_url, init) => {
            const body = JSON.parse(init?.body as string);
            const newNote = {
              id: 99,
              message: body.message,
              created_at: '2026-09-29T16:00:00Z',
              created_local: '2026-09-29 18:00:00',
            };
            notesInQueue = [...notesInQueue, newNote];
            return jsonResponse(newNote, 201);
          },
        },
      ]);

      renderApp(['/agents/1/heartbeat']);

      await screen.findByText('Remember to check the ledger');
      const openDialogBtn = screen.getByRole('button', { name: '给下一次心跳留言' });
      openDialogBtn.focus();
      fireEvent.click(openDialogBtn);

      // Dialog opens on canonical overlay
      const dialog = screen.getByRole('dialog', { name: '给下一次心跳留言' });
      expect(dialog).toBeInTheDocument();
      const overlay = dialog.closest('.app-overlay');
      expect(overlay).not.toBeNull();

      // Focus enters dialog
      await waitFor(() => {
        expect(dialog.contains(document.activeElement)).toBe(true);
      });

      // Tab containment
      fireEvent.keyDown(document.activeElement as Element, { key: 'Tab', shiftKey: true });
      expect(dialog.contains(document.activeElement)).toBe(true);

      const submitBtn = within(dialog).getByRole('button', { name: '投递便签' });
      expect(submitBtn).toBeDisabled();

      const textarea = within(dialog).getByLabelText(/便签留言正文/);
      fireEvent.change(textarea, { target: { value: '   ' } });
      expect(submitBtn).toBeDisabled();

      // Test cancel dismiss restores focus to trigger button
      const cancelBtn = within(dialog).getByRole('button', { name: '取消' });
      fireEvent.click(cancelBtn);
      expect(screen.queryByRole('dialog', { name: '给下一次心跳留言' })).not.toBeInTheDocument();
      expect(document.activeElement).toBe(openDialogBtn);

      // Re-open and verify backdrop click dismissal (dialog body click does not dismiss)
      fireEvent.click(openDialogBtn);
      const dialogAgain = screen.getByRole('dialog', { name: '给下一次心跳留言' });
      const overlayAgain = dialogAgain.closest('.app-overlay')!;
      fireEvent.click(dialogAgain);
      expect(screen.getByRole('dialog', { name: '给下一次心跳留言' })).toBeInTheDocument();
      fireEvent.click(overlayAgain);
      expect(screen.queryByRole('dialog', { name: '给下一次心跳留言' })).not.toBeInTheDocument();

      // Re-open and submit
      fireEvent.click(openDialogBtn);
      const dialog2 = screen.getByRole('dialog', { name: '给下一次心跳留言' });
      const textarea2 = within(dialog2).getByLabelText(/便签留言正文/);
      fireEvent.change(textarea2, { target: { value: 'New note for next pulse' } });

      const submitBtn2 = within(dialog2).getByRole('button', { name: '投递便签' });
      expect(submitBtn2).toBeEnabled();
      fireEvent.click(submitBtn2);

      // Dialog closes and new note appears
      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: '给下一次心跳留言' })).not.toBeInTheDocument();
      });
      await screen.findByText('New note for next pulse');
    });

    it('withdraws pending note and refreshes queue on success', async () => {
      let notesInQueue = [...SAMPLE_QUEUE.pending_notes];

      installFetch([
        {
          test: '/api/agents/presets/1/',
          handler: () => jsonResponse(PRESET_G045),
        },
        {
          test: '/api/heartbeat/queue/',
          handler: () =>
            jsonResponse({
              ...SAMPLE_QUEUE,
              pending_notes: notesInQueue,
            }),
        },
        {
          test: '/api/heartbeat/events/',
          handler: () =>
            jsonResponse({
              events: SAMPLE_EVENTS,
              total_count: 2,
              has_more: false,
            }),
        },
        {
          test: '/api/heartbeat/notes/12/',
          method: 'DELETE',
          handler: () => {
            notesInQueue = [];
            return new Response(null, { status: 204 });
          },
        },
      ]);

      renderApp(['/agents/1/heartbeat']);

      await screen.findByText('Remember to check the ledger');
      const withdrawBtn = screen.getByRole('button', { name: '撤回小纸条 #12' });
      fireEvent.click(withdrawBtn);

      await waitFor(() => {
        expect(screen.queryByText('Remember to check the ledger')).not.toBeInTheDocument();
      });
      await screen.findByText('暂无待送达小纸条');
    });

    it('handles 409 already_consumed on note withdrawal with error notice and queue refresh', async () => {
      let notesInQueue = [...SAMPLE_QUEUE.pending_notes];

      installFetch([
        {
          test: '/api/agents/presets/1/',
          handler: () => jsonResponse(PRESET_G045),
        },
        {
          test: '/api/heartbeat/queue/',
          handler: () =>
            jsonResponse({
              ...SAMPLE_QUEUE,
              pending_notes: notesInQueue,
            }),
        },
        {
          test: '/api/heartbeat/events/',
          handler: () =>
            jsonResponse({
              events: SAMPLE_EVENTS,
              total_count: 2,
              has_more: false,
            }),
        },
        {
          test: '/api/heartbeat/notes/12/',
          method: 'DELETE',
          handler: () => {
            notesInQueue = []; // consumed by pulse
            return jsonResponse(
              {
                error: '纸条已被拆封消费，无法撤回',
                code: 'already_consumed',
              },
              409,
            );
          },
        },
      ]);

      renderApp(['/agents/1/heartbeat']);

      await screen.findByText('Remember to check the ledger');
      const withdrawBtn = screen.getByRole('button', { name: '撤回小纸条 #12' });
      fireEvent.click(withdrawBtn);

      // Error notice shown
      await screen.findByText('纸条已被拆封，无法撤回');
      // And queue refresh triggered by 409 removes stale item
      await waitFor(() => {
        expect(screen.queryByText('Remember to check the ledger')).not.toBeInTheDocument();
      });
    });

    it('handles ambiguous 201 on note create by reconciling with queue and closing if present', async () => {
      let notesInQueue = [...SAMPLE_QUEUE.pending_notes];
      let postCount = 0;

      installFetch([
        {
          test: '/api/agents/presets/1/',
          handler: () => jsonResponse(PRESET_G045),
        },
        {
          test: '/api/heartbeat/queue/',
          handler: () =>
            jsonResponse({
              ...SAMPLE_QUEUE,
              pending_notes: notesInQueue,
            }),
        },
        {
          test: '/api/heartbeat/events/',
          handler: () =>
            jsonResponse({
              events: SAMPLE_EVENTS,
              total_count: 2,
              has_more: false,
            }),
        },
        {
          test: '/api/heartbeat/notes/',
          method: 'POST',
          handler: (_url, init) => {
            postCount += 1;
            const body = JSON.parse(init?.body as string);
            notesInQueue = [
              ...notesInQueue,
              {
                id: 100,
                message: body.message,
                created_at: '2026-09-29T16:00:00Z',
                created_local: '2026-09-29 18:00:00',
              },
            ];
            // Returns malformed 201 envelope
            return jsonResponse({ note: 'incomplete' }, 201);
          },
        },
      ]);

      renderApp(['/agents/1/heartbeat']);

      await screen.findByText('Remember to check the ledger');
      const openDialogBtn = screen.getByRole('button', { name: '给下一次心跳留言' });
      fireEvent.click(openDialogBtn);

      const dialog = screen.getByRole('dialog', { name: '给下一次心跳留言' });
      const textarea = within(dialog).getByLabelText(/便签留言正文/);
      fireEvent.change(textarea, { target: { value: 'Ambiguous note to reconcile' } });

      const submitBtn = within(dialog).getByRole('button', { name: '投递便签' });
      fireEvent.click(submitBtn);

      // Reconciles with queue, sees the note in fresh queue, and resolves dialog
      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: '给下一次心跳留言' })).not.toBeInTheDocument();
      });
      expect(postCount).toBe(1);
      await screen.findByText('Ambiguous note to reconcile');
    });

    it('handles ambiguous 201 on note create by locking submission and displaying error if absent in queue', async () => {
      let postCount = 0;

      installFetch([
        {
          test: '/api/agents/presets/1/',
          handler: () => jsonResponse(PRESET_G045),
        },
        {
          test: '/api/heartbeat/queue/',
          handler: () => jsonResponse(SAMPLE_QUEUE),
        },
        {
          test: '/api/heartbeat/events/',
          handler: () =>
            jsonResponse({
              events: SAMPLE_EVENTS,
              total_count: 2,
              has_more: false,
            }),
        },
        {
          test: '/api/heartbeat/notes/',
          method: 'POST',
          handler: () => {
            postCount += 1;
            // Returns malformed 201 envelope, but note was NOT saved on backend
            return jsonResponse({ malformed: true }, 201);
          },
        },
      ]);

      renderApp(['/agents/1/heartbeat']);

      await screen.findByText('Remember to check the ledger');
      const openDialogBtn = screen.getByRole('button', { name: '给下一次心跳留言' });
      fireEvent.click(openDialogBtn);

      const dialog = screen.getByRole('dialog', { name: '给下一次心跳留言' });
      const textarea = within(dialog).getByLabelText(/便签留言正文/);
      fireEvent.change(textarea, { target: { value: 'Phantom note' } });

      const submitBtn = within(dialog).getByRole('button', { name: '投递便签' });
      fireEvent.click(submitBtn);

      // Dialog stays open, presents explicit safe retry error banner
      await within(dialog).findByText('便签已提交，但结果无法确认，重新核对信箱未见该项；请重试。');
      expect(postCount).toBe(1);
      // Submit button is unlocked for safe retry
      expect(submitBtn).toBeEnabled();
    });

    it('handles ambiguous 201 on note create when queue GET fails: locks POST terminally, offers recheck only until GET succeeds, and maintains focus in dialog', async () => {
      let postCount = 0;
      let getQueueCount = 0;

      installFetch([
        {
          test: '/api/agents/presets/1/',
          handler: () => jsonResponse(PRESET_G045),
        },
        {
          test: '/api/heartbeat/queue/',
          handler: () => {
            getQueueCount += 1;
            // First GET is initial load
            if (getQueueCount === 1) {
              return jsonResponse(SAMPLE_QUEUE);
            }
            // Second GET is reconciliation attempt (which fails)
            if (getQueueCount === 2) {
              return jsonResponse({ error: 'Network failure during reconciliation' }, 500);
            }
            // Third GET is user clicking "重新核对信箱" (succeeds, note not in queue)
            return jsonResponse(SAMPLE_QUEUE);
          },
        },
        {
          test: '/api/heartbeat/events/',
          handler: () =>
            jsonResponse({
              events: SAMPLE_EVENTS,
              total_count: 2,
              has_more: false,
            }),
        },
        {
          test: '/api/heartbeat/notes/',
          method: 'POST',
          handler: () => {
            postCount += 1;
            return jsonResponse({ malformed: true }, 201);
          },
        },
      ]);

      renderApp(['/agents/1/heartbeat']);

      await screen.findByText('Remember to check the ledger');
      const openDialogBtn = screen.getByRole('button', { name: '给下一次心跳留言' });
      fireEvent.click(openDialogBtn);

      const dialog = screen.getByRole('dialog', { name: '给下一次心跳留言' });
      const textarea = within(dialog).getByLabelText(/便签留言正文/);
      fireEvent.change(textarea, { target: { value: 'Note with failing reconciliation' } });

      const submitBtn = within(dialog).getByRole('button', { name: '投递便签' });
      fireEvent.click(submitBtn);

      // GET failed: Error banner warns user and blocks repeat POST
      await within(dialog).findByText('便签已提交，但结果无法确认，且重新核对信箱失败；请重试核对信箱，切勿重复提交。');
      expect(postCount).toBe(1);

      // POST is terminally disabled; ordinary submit button is not rendered, "重新核对信箱" is offered
      expect(within(dialog).queryByRole('button', { name: '投递便签' })).not.toBeInTheDocument();
      const recheckBtn = within(dialog).getByRole('button', { name: '重新核对信箱' });
      expect(recheckBtn).toBeEnabled();

      // Focus remains anchored inside dialog
      expect(dialog.contains(document.activeElement)).toBe(true);

      // CPB-R3-F06: Close X, Cancel, Escape, and backdrop are all locked/disabled while unresolved
      const closeBtn = within(dialog).getByRole('button', { name: '关闭对话框' });
      expect(closeBtn).toBeDisabled();
      fireEvent.click(closeBtn);
      expect(dialog).toBeInTheDocument();

      const cancelBtn = within(dialog).getByRole('button', { name: '取消' });
      expect(cancelBtn).toBeDisabled();
      fireEvent.click(cancelBtn);
      expect(dialog).toBeInTheDocument();

      // Escape key does NOT dismiss
      fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });
      expect(dialog).toBeInTheDocument();

      // Backdrop click does NOT dismiss
      const overlay = dialog.closest('.app-overlay')!;
      fireEvent.click(overlay);
      expect(dialog).toBeInTheDocument();

      // User clicks recheck
      fireEvent.click(recheckBtn);

      // Recheck succeeded with no commit evidence: now safe retry banner is shown and submit button re-arms
      await within(dialog).findByText('便签已提交，但结果无法确认，重新核对信箱未见该项；请重试。');
      const retrySubmitBtn = within(dialog).getByRole('button', { name: '投递便签' });
      expect(retrySubmitBtn).toBeEnabled();
      // No duplicate POST was ever issued
      expect(postCount).toBe(1);
    });

    it('handles ambiguous 201 on note create when message is transformed by backend (recognized by newly appearing note ID)', async () => {
      let notesInQueue = [...SAMPLE_QUEUE.pending_notes];
      let postCount = 0;

      installFetch([
        {
          test: '/api/agents/presets/1/',
          handler: () => jsonResponse(PRESET_G045),
        },
        {
          test: '/api/heartbeat/queue/',
          handler: () =>
            jsonResponse({
              ...SAMPLE_QUEUE,
              pending_notes: notesInQueue,
            }),
        },
        {
          test: '/api/heartbeat/events/',
          handler: () =>
            jsonResponse({
              events: SAMPLE_EVENTS,
              total_count: 2,
              has_more: false,
            }),
        },
        {
          test: '/api/heartbeat/notes/',
          method: 'POST',
          handler: () => {
            postCount += 1;
            // Backend stored note with transformed text and new ID
            notesInQueue = [
              ...notesInQueue,
              {
                id: 999,
                message: 'FILTERED: sanitized content',
                created_at: '2026-09-29T16:00:00Z',
                created_local: '2026-09-29 18:00:00',
              },
            ];
            return jsonResponse({ malformed: true }, 201);
          },
        },
      ]);

      renderApp(['/agents/1/heartbeat']);

      await screen.findByText('Remember to check the ledger');
      const openDialogBtn = screen.getByRole('button', { name: '给下一次心跳留言' });
      fireEvent.click(openDialogBtn);

      const dialog = screen.getByRole('dialog', { name: '给下一次心跳留言' });
      const textarea = within(dialog).getByLabelText(/便签留言正文/);
      fireEvent.change(textarea, { target: { value: 'Original unsanitized text' } });

      const submitBtn = within(dialog).getByRole('button', { name: '投递便签' });
      fireEvent.click(submitBtn);

      // Recognizes new note ID 999 (not in baseline [12]), resolves and closes cleanly!
      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: '给下一次心跳留言' })).not.toBeInTheDocument();
      });
      expect(postCount).toBe(1);
      await screen.findByText('FILTERED: sanitized content');
    });

    it('handles 404 note_not_found on note withdrawal with error notice and queue refresh', async () => {
      let notesInQueue = [...SAMPLE_QUEUE.pending_notes];

      installFetch([
        {
          test: '/api/agents/presets/1/',
          handler: () => jsonResponse(PRESET_G045),
        },
        {
          test: '/api/heartbeat/queue/',
          handler: () =>
            jsonResponse({
              ...SAMPLE_QUEUE,
              pending_notes: notesInQueue,
            }),
        },
        {
          test: '/api/heartbeat/events/',
          handler: () =>
            jsonResponse({
              events: SAMPLE_EVENTS,
              total_count: 2,
              has_more: false,
            }),
        },
        {
          test: '/api/heartbeat/notes/12/',
          method: 'DELETE',
          handler: () => {
            notesInQueue = []; // already consumed / removed
            return jsonResponse(
              {
                error: 'Note not found',
                code: 'note_not_found',
              },
              404,
            );
          },
        },
      ]);

      renderApp(['/agents/1/heartbeat']);

      await screen.findByText('Remember to check the ledger');
      const withdrawBtn = screen.getByRole('button', { name: '撤回小纸条 #12' });
      fireEvent.click(withdrawBtn);

      await screen.findByText('小纸条不存在或已被消费');
      await waitFor(() => {
        expect(screen.queryByText('Remember to check the ledger')).not.toBeInTheDocument();
      });
      await screen.findByText('暂无待送达小纸条');
    });

    it('opens schedule wakeup dialog, converts local time to backend format, submits and refreshes', async () => {
      let wakeupsInQueue = [...SAMPLE_QUEUE.explicit_wakeups];

      installFetch([
        {
          test: '/api/agents/presets/1/',
          handler: () => jsonResponse(PRESET_G045),
        },
        {
          test: '/api/heartbeat/queue/',
          handler: () =>
            jsonResponse({
              ...SAMPLE_QUEUE,
              explicit_wakeups: wakeupsInQueue,
            }),
        },
        {
          test: '/api/heartbeat/events/',
          handler: () =>
            jsonResponse({
              events: SAMPLE_EVENTS,
              total_count: 2,
              has_more: false,
            }),
        },
        {
          test: '/api/heartbeat/wakeups/',
          method: 'POST',
          handler: (_url, init) => {
            const body = JSON.parse(init?.body as string);
            expect(body.wake_up_at).toBe('2026-10-05 14:00');
            expect(body.resume_check).toBe(false);
            const newWakeup = {
              task_id: 303,
              target_utc: '2026-10-05T12:00:00Z',
              effective_utc: '2026-10-05T12:00:00Z',
              effective_local: '2026-10-05 14:00',
              message: body.message,
              resume_check: false,
              status: 'pending',
            };
            wakeupsInQueue = [...wakeupsInQueue, newWakeup];
            return jsonResponse(newWakeup, 201);
          },
        },
      ]);

      renderApp(['/agents/1/heartbeat']);

      await screen.findByText('Morning check-in');
      const openDialogBtn = screen.getByRole('button', { name: '预约唤醒' });
      openDialogBtn.focus();
      fireEvent.click(openDialogBtn);

      const dialog = screen.getByRole('dialog', { name: '预约心跳唤醒' });
      expect(dialog).toBeInTheDocument();
      const overlay = dialog.closest('.app-overlay');
      expect(overlay).not.toBeNull();

      // Focus enters dialog
      await waitFor(() => {
        expect(dialog.contains(document.activeElement)).toBe(true);
      });

      // Tab containment
      fireEvent.keyDown(document.activeElement as Element, { key: 'Tab', shiftKey: true });
      expect(dialog.contains(document.activeElement)).toBe(true);

      // Cancel dismiss restores trigger focus
      const cancelBtn = within(dialog).getByRole('button', { name: '取消' });
      fireEvent.click(cancelBtn);
      expect(screen.queryByRole('dialog', { name: '预约心跳唤醒' })).not.toBeInTheDocument();
      expect(document.activeElement).toBe(openDialogBtn);

      // Re-open and verify backdrop click dismissal
      fireEvent.click(openDialogBtn);
      const dialogAgain = screen.getByRole('dialog', { name: '预约心跳唤醒' });
      const overlayAgain = dialogAgain.closest('.app-overlay')!;
      fireEvent.click(dialogAgain);
      expect(screen.getByRole('dialog', { name: '预约心跳唤醒' })).toBeInTheDocument();
      fireEvent.click(overlayAgain);
      expect(screen.queryByRole('dialog', { name: '预约心跳唤醒' })).not.toBeInTheDocument();

      // Re-open and submit
      fireEvent.click(openDialogBtn);
      const dialogToSubmit = screen.getByRole('dialog', { name: '预约心跳唤醒' });

      const timeInput = within(dialogToSubmit).getByLabelText(/唤醒时间/);
      fireEvent.change(timeInput, { target: { value: '2026-10-05T14:00' } });

      const msgInput = within(dialogToSubmit).getByLabelText(/唤醒留言正文/);
      fireEvent.change(msgInput, { target: { value: 'Briefing report' } });

      const submitBtn = within(dialogToSubmit).getByRole('button', { name: '确认预约' });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: '预约心跳唤醒' })).not.toBeInTheDocument();
      });
      await screen.findByText('Briefing report');
    });

    it('handles ambiguous 201 on wakeup schedule by reconciling with queue and closing if present', async () => {
      let wakeupsInQueue = [...SAMPLE_QUEUE.explicit_wakeups];
      let postCount = 0;

      installFetch([
        {
          test: '/api/agents/presets/1/',
          handler: () => jsonResponse(PRESET_G045),
        },
        {
          test: '/api/heartbeat/queue/',
          handler: () =>
            jsonResponse({
              ...SAMPLE_QUEUE,
              explicit_wakeups: wakeupsInQueue,
            }),
        },
        {
          test: '/api/heartbeat/events/',
          handler: () =>
            jsonResponse({
              events: SAMPLE_EVENTS,
              total_count: 2,
              has_more: false,
            }),
        },
        {
          test: '/api/heartbeat/wakeups/',
          method: 'POST',
          handler: (_url, init) => {
            postCount += 1;
            const body = JSON.parse(init?.body as string);
            wakeupsInQueue = [
              ...wakeupsInQueue,
              {
                task_id: 404,
                target_utc: '2026-10-06T10:00:00Z',
                effective_utc: '2026-10-06T10:00:00Z',
                effective_local: '2026-10-06 12:00',
                message: body.message,
                resume_check: false,
                status: 'pending',
              },
            ];
            return jsonResponse({ task: 'broken' }, 201);
          },
        },
      ]);

      renderApp(['/agents/1/heartbeat']);

      await screen.findByText('Morning check-in');
      const openDialogBtn = screen.getByRole('button', { name: '预约唤醒' });
      fireEvent.click(openDialogBtn);

      const dialog = screen.getByRole('dialog', { name: '预约心跳唤醒' });
      const timeInput = within(dialog).getByLabelText(/唤醒时间/);
      fireEvent.change(timeInput, { target: { value: '2026-10-06T12:00' } });

      const msgInput = within(dialog).getByLabelText(/唤醒留言正文/);
      fireEvent.change(msgInput, { target: { value: 'Ambiguous wakeup to reconcile' } });

      const submitBtn = within(dialog).getByRole('button', { name: '确认预约' });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: '预约心跳唤醒' })).not.toBeInTheDocument();
      });
      expect(postCount).toBe(1);
      await screen.findByText('Ambiguous wakeup to reconcile');
    });

    it('handles ambiguous 201 on wakeup schedule by locking submission and displaying error if absent in queue', async () => {
      let postCount = 0;

      installFetch([
        {
          test: '/api/agents/presets/1/',
          handler: () => jsonResponse(PRESET_G045),
        },
        {
          test: '/api/heartbeat/queue/',
          handler: () => jsonResponse(SAMPLE_QUEUE),
        },
        {
          test: '/api/heartbeat/events/',
          handler: () =>
            jsonResponse({
              events: SAMPLE_EVENTS,
              total_count: 2,
              has_more: false,
            }),
        },
        {
          test: '/api/heartbeat/wakeups/',
          method: 'POST',
          handler: () => {
            postCount += 1;
            return jsonResponse({ task: 'broken' }, 201);
          },
        },
      ]);

      renderApp(['/agents/1/heartbeat']);

      await screen.findByText('Morning check-in');
      const openDialogBtn = screen.getByRole('button', { name: '预约唤醒' });
      fireEvent.click(openDialogBtn);

      const dialog = screen.getByRole('dialog', { name: '预约心跳唤醒' });
      const timeInput = within(dialog).getByLabelText(/唤醒时间/);
      fireEvent.change(timeInput, { target: { value: '2026-10-06T12:00' } });

      const msgInput = within(dialog).getByLabelText(/唤醒留言正文/);
      fireEvent.change(msgInput, { target: { value: 'Phantom wakeup' } });

      const submitBtn = within(dialog).getByRole('button', { name: '确认预约' });
      fireEvent.click(submitBtn);

      await within(dialog).findByText('预约已提交，但结果无法确认，重新核对信箱未见该项；请重试。');
      expect(postCount).toBe(1);
      expect(submitBtn).toBeEnabled();
    });

    it('handles ambiguous 201 on wakeup schedule when queue GET fails: locks POST terminally, offers recheck only until GET succeeds, and maintains focus in dialog', async () => {
      let postCount = 0;
      let getQueueCount = 0;

      installFetch([
        {
          test: '/api/agents/presets/1/',
          handler: () => jsonResponse(PRESET_G045),
        },
        {
          test: '/api/heartbeat/queue/',
          handler: () => {
            getQueueCount += 1;
            if (getQueueCount === 1) {
              return jsonResponse(SAMPLE_QUEUE);
            }
            if (getQueueCount === 2) {
              return jsonResponse({ error: 'Network failure during reconciliation' }, 500);
            }
            return jsonResponse(SAMPLE_QUEUE);
          },
        },
        {
          test: '/api/heartbeat/events/',
          handler: () =>
            jsonResponse({
              events: SAMPLE_EVENTS,
              total_count: 2,
              has_more: false,
            }),
        },
        {
          test: '/api/heartbeat/wakeups/',
          method: 'POST',
          handler: () => {
            postCount += 1;
            return jsonResponse({ task: 'broken' }, 201);
          },
        },
      ]);

      renderApp(['/agents/1/heartbeat']);

      await screen.findByText('Morning check-in');
      const openDialogBtn = screen.getByRole('button', { name: '预约唤醒' });
      fireEvent.click(openDialogBtn);

      const dialog = screen.getByRole('dialog', { name: '预约心跳唤醒' });
      const timeInput = within(dialog).getByLabelText(/唤醒时间/);
      fireEvent.change(timeInput, { target: { value: '2026-10-06T12:00' } });

      const msgInput = within(dialog).getByLabelText(/唤醒留言正文/);
      fireEvent.change(msgInput, { target: { value: 'Wakeup with failing reconciliation' } });

      const submitBtn = within(dialog).getByRole('button', { name: '确认预约' });
      fireEvent.click(submitBtn);

      // GET failed: Error banner warns user and blocks repeat POST
      await within(dialog).findByText('预约已提交，但结果无法确认，且重新核对信箱失败；请重试核对信箱，切勿重复提交。');
      expect(postCount).toBe(1);

      // POST is terminally disabled; ordinary submit button is not rendered, "重新核对信箱" is offered
      expect(within(dialog).queryByRole('button', { name: '确认预约' })).not.toBeInTheDocument();
      const recheckBtn = within(dialog).getByRole('button', { name: '重新核对信箱' });
      expect(recheckBtn).toBeEnabled();

      // Focus remains anchored inside dialog
      expect(dialog.contains(document.activeElement)).toBe(true);

      // CPB-R3-F06: Close X, Cancel, Escape, and backdrop are all locked/disabled while unresolved
      const closeBtn = within(dialog).getByRole('button', { name: '关闭对话框' });
      expect(closeBtn).toBeDisabled();
      fireEvent.click(closeBtn);
      expect(dialog).toBeInTheDocument();

      const cancelBtn = within(dialog).getByRole('button', { name: '取消' });
      expect(cancelBtn).toBeDisabled();
      fireEvent.click(cancelBtn);
      expect(dialog).toBeInTheDocument();

      // Escape key does NOT dismiss
      fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });
      expect(dialog).toBeInTheDocument();

      // Backdrop click does NOT dismiss
      const overlay = dialog.closest('.app-overlay')!;
      fireEvent.click(overlay);
      expect(dialog).toBeInTheDocument();

      // User clicks recheck
      fireEvent.click(recheckBtn);

      // Recheck succeeded with no commit evidence: now safe retry banner is shown and submit button re-arms
      await within(dialog).findByText('预约已提交，但结果无法确认，重新核对信箱未见该项；请重试。');
      const retrySubmitBtn = within(dialog).getByRole('button', { name: '确认预约' });
      expect(retrySubmitBtn).toBeEnabled();
      expect(postCount).toBe(1);
    });

    it('handles ambiguous 201 on wakeup schedule outside 20-row projection cap (recognized by unshown_explicit_count increase)', async () => {
      let currentUnshown = SAMPLE_QUEUE.unshown_explicit_count;
      let postCount = 0;

      installFetch([
        {
          test: '/api/agents/presets/1/',
          handler: () => jsonResponse(PRESET_G045),
        },
        {
          test: '/api/heartbeat/queue/',
          handler: () =>
            jsonResponse({
              ...SAMPLE_QUEUE,
              unshown_explicit_count: currentUnshown,
            }),
        },
        {
          test: '/api/heartbeat/events/',
          handler: () =>
            jsonResponse({
              events: SAMPLE_EVENTS,
              total_count: 2,
              has_more: false,
            }),
        },
        {
          test: '/api/heartbeat/wakeups/',
          method: 'POST',
          handler: () => {
            postCount += 1;
            // Outside visible cap, explicit_wakeups unchanged, unshown count increments
            currentUnshown += 1;
            return jsonResponse({ task: 'broken' }, 201);
          },
        },
      ]);

      renderApp(['/agents/1/heartbeat']);

      await screen.findByText('Morning check-in');
      const openDialogBtn = screen.getByRole('button', { name: '预约唤醒' });
      fireEvent.click(openDialogBtn);

      const dialog = screen.getByRole('dialog', { name: '预约心跳唤醒' });
      const timeInput = within(dialog).getByLabelText(/唤醒时间/);
      fireEvent.change(timeInput, { target: { value: '2026-10-06T12:00' } });

      const msgInput = within(dialog).getByLabelText(/唤醒留言正文/);
      fireEvent.change(msgInput, { target: { value: 'Capped overflow wakeup' } });

      const submitBtn = within(dialog).getByRole('button', { name: '确认预约' });
      fireEvent.click(submitBtn);

      // Recognizes unshown_explicit_count increase (3 > 2), resolves and closes cleanly!
      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: '预约心跳唤醒' })).not.toBeInTheDocument();
      });
      expect(postCount).toBe(1);
    });

    it('handles ambiguous 201 on wakeup schedule when message is transformed by backend (recognized by newly appearing task ID)', async () => {
      let wakeupsInQueue = [...SAMPLE_QUEUE.explicit_wakeups];
      let postCount = 0;

      installFetch([
        {
          test: '/api/agents/presets/1/',
          handler: () => jsonResponse(PRESET_G045),
        },
        {
          test: '/api/heartbeat/queue/',
          handler: () =>
            jsonResponse({
              ...SAMPLE_QUEUE,
              explicit_wakeups: wakeupsInQueue,
            }),
        },
        {
          test: '/api/heartbeat/events/',
          handler: () =>
            jsonResponse({
              events: SAMPLE_EVENTS,
              total_count: 2,
              has_more: false,
            }),
        },
        {
          test: '/api/heartbeat/wakeups/',
          method: 'POST',
          handler: () => {
            postCount += 1;
            wakeupsInQueue = [
              ...wakeupsInQueue,
              {
                task_id: 888,
                target_utc: '2026-10-06T10:00:00Z',
                effective_utc: '2026-10-06T10:00:00Z',
                effective_local: '2026-10-06 12:00',
                message: 'FILTERED: sanitized wakeup',
                resume_check: false,
                status: 'pending',
              },
            ];
            return jsonResponse({ task: 'broken' }, 201);
          },
        },
      ]);

      renderApp(['/agents/1/heartbeat']);

      await screen.findByText('Morning check-in');
      const openDialogBtn = screen.getByRole('button', { name: '预约唤醒' });
      fireEvent.click(openDialogBtn);

      const dialog = screen.getByRole('dialog', { name: '预约心跳唤醒' });
      const timeInput = within(dialog).getByLabelText(/唤醒时间/);
      fireEvent.change(timeInput, { target: { value: '2026-10-06T12:00' } });

      const msgInput = within(dialog).getByLabelText(/唤醒留言正文/);
      fireEvent.change(msgInput, { target: { value: 'Original wakeup' } });

      const submitBtn = within(dialog).getByRole('button', { name: '确认预约' });
      fireEvent.click(submitBtn);

      // Recognizes task_id 888 (not in baseline [202]), resolves and closes cleanly!
      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: '预约心跳唤醒' })).not.toBeInTheDocument();
      });
      expect(postCount).toBe(1);
      await screen.findByText('FILTERED: sanitized wakeup');
    });

    it('cancels explicit wakeup task and refreshes queue', async () => {
      let wakeupsInQueue = [...SAMPLE_QUEUE.explicit_wakeups];

      installFetch([
        {
          test: '/api/agents/presets/1/',
          handler: () => jsonResponse(PRESET_G045),
        },
        {
          test: '/api/heartbeat/queue/',
          handler: () =>
            jsonResponse({
              ...SAMPLE_QUEUE,
              explicit_wakeups: wakeupsInQueue,
            }),
        },
        {
          test: '/api/heartbeat/events/',
          handler: () =>
            jsonResponse({
              events: SAMPLE_EVENTS,
              total_count: 2,
              has_more: false,
            }),
        },
        {
          test: '/api/heartbeat/wakeups/202/',
          method: 'DELETE',
          handler: () => {
            wakeupsInQueue = [];
            return new Response(null, { status: 204 });
          },
        },
      ]);

      renderApp(['/agents/1/heartbeat']);

      await screen.findByText('Morning check-in');
      const cancelBtn = screen.getByRole('button', { name: '取消唤醒预约 #202' });
      fireEvent.click(cancelBtn);

      await waitFor(() => {
        expect(screen.queryByText('Morning check-in')).not.toBeInTheDocument();
      });
      await screen.findByText('暂无预约唤醒');
    });

    it('handles 409 cannot_cancel on wakeup cancellation with notice and queue refresh', async () => {
      let wakeupsInQueue = [...SAMPLE_QUEUE.explicit_wakeups];

      installFetch([
        {
          test: '/api/agents/presets/1/',
          handler: () => jsonResponse(PRESET_G045),
        },
        {
          test: '/api/heartbeat/queue/',
          handler: () =>
            jsonResponse({
              ...SAMPLE_QUEUE,
              explicit_wakeups: wakeupsInQueue,
            }),
        },
        {
          test: '/api/heartbeat/events/',
          handler: () =>
            jsonResponse({
              events: SAMPLE_EVENTS,
              total_count: 2,
              has_more: false,
            }),
        },
        {
          test: '/api/heartbeat/wakeups/202/',
          method: 'DELETE',
          handler: () => {
            wakeupsInQueue = [
              {
                ...wakeupsInQueue[0],
                status: 'succeeded',
              },
            ];
            return jsonResponse(
              {
                error: 'task could not be cancelled',
                code: 'cannot_cancel',
              },
              409,
            );
          },
        },
      ]);

      renderApp(['/agents/1/heartbeat']);

      await screen.findByText('Morning check-in');
      const cancelBtn = screen.getByRole('button', { name: '取消唤醒预约 #202' });
      fireEvent.click(cancelBtn);

      await screen.findByText('任务无法取消或已在执行中');
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: '取消唤醒预约 #202' })).not.toBeInTheDocument();
      });
    });

    it('handles 404 on wakeup cancellation with notice and queue refresh', async () => {
      let wakeupsInQueue = [...SAMPLE_QUEUE.explicit_wakeups];

      installFetch([
        {
          test: '/api/agents/presets/1/',
          handler: () => jsonResponse(PRESET_G045),
        },
        {
          test: '/api/heartbeat/queue/',
          handler: () =>
            jsonResponse({
              ...SAMPLE_QUEUE,
              explicit_wakeups: wakeupsInQueue,
            }),
        },
        {
          test: '/api/heartbeat/events/',
          handler: () =>
            jsonResponse({
              events: SAMPLE_EVENTS,
              total_count: 2,
              has_more: false,
            }),
        },
        {
          test: '/api/heartbeat/wakeups/202/',
          method: 'DELETE',
          handler: () => {
            wakeupsInQueue = [];
            return jsonResponse(
              {
                error: 'task not found',
                code: 'task_not_found',
              },
              404,
            );
          },
        },
      ]);

      renderApp(['/agents/1/heartbeat']);

      await screen.findByText('Morning check-in');
      const cancelBtn = screen.getByRole('button', { name: '取消唤醒预约 #202' });
      fireEvent.click(cancelBtn);

      await screen.findByText('task not found');
      await waitFor(() => {
        expect(screen.queryByText('Morning check-in')).not.toBeInTheDocument();
      });
      await screen.findByText('暂无预约唤醒');
    });
  });

  describe('Full Navigation Journey & Discoverability (Chat → Agent Profile → Heartbeat → Mailbox)', () => {
    it('allows navigating from V4 Chat topbar Agent chip to Agent Profile, then to Heartbeat Ledger, and leaving a note', async () => {
      let notesInQueue = [...SAMPLE_QUEUE.pending_notes];

      installFetch([
        {
          test: '/api/agents/conversations/42/',
          handler: () =>
            jsonResponse({
              id: 42,
              name: 'Chat with Alessandro',
              created_at: '2026-09-29T10:00:00Z',
              frozen_project_ids: [],
              project: 0,
              project_name: null,
              agent_type: 'g045',
              agent_preset_id: 1,
              last_message_at: '2026-09-29T10:00:00Z',
              thinking_level: null,
              memory_injection_enabled: null,
            }),
        },
        {
          test: '/api/agents/chat/42/',
          handler: () =>
            jsonResponse({
              messages: [],
              has_more: false,
              total_count: 0,
            }),
        },
        {
          test: '/api/core/projects/',
          handler: () => jsonResponse([]),
        },
        {
          test: '/api/agents/presets/',
          handler: () => jsonResponse([PRESET_G045]),
        },
        {
          test: '/api/agents/presets/1/',
          handler: () => jsonResponse(PRESET_G045),
        },
        {
          test: '/api/agents/conversations/',
          handler: () =>
            jsonResponse([
              {
                id: 42,
                name: 'Chat with Alessandro',
                created_at: '2026-09-29T10:00:00Z',
                frozen_project_ids: [],
                project: 0,
                project_name: null,
                agent_type: 'g045',
                agent_preset_id: 1,
                last_message_at: '2026-09-29T10:00:00Z',
                thinking_level: null,
                memory_injection_enabled: null,
              },
            ]),
        },
        {
          test: '/api/heartbeat/queue/',
          handler: () =>
            jsonResponse({
              ...SAMPLE_QUEUE,
              pending_notes: notesInQueue,
            }),
        },
        {
          test: '/api/heartbeat/events/',
          handler: () =>
            jsonResponse({
              events: SAMPLE_EVENTS,
              total_count: 2,
              has_more: false,
            }),
        },
        {
          test: '/api/heartbeat/notes/',
          method: 'POST',
          handler: (_, init) => {
            const body = JSON.parse(String(init?.body ?? '{}'));
            const newNote = {
              id: 888,
              message: body.message,
              created_at: '2026-09-29T18:00:00Z',
              created_local: '2026-09-29 20:00:00',
            };
            notesInQueue = [newNote, ...notesInQueue];
            return jsonResponse(newNote, 201);
          },
        },
      ]);

      renderApp(['/chat/42']);

      // 1. In V4 Chat, wait for conversation to load
      await screen.findByText('Chat with Alessandro');

      // 2. Chat topbar Agent chip is a clickable Link to /agents/1
      const agentChipLink = screen.getByRole('link', { name: 'Alessandro' });
      expect(agentChipLink).toHaveClass('app-chip--link');
      expect(agentChipLink.getAttribute('href')).toBe('/agents/1');

      // Drift chip is NOT a link
      const driftChip = screen.getByText('Drift');
      expect(driftChip.tagName.toLowerCase()).toBe('span');
      expect(driftChip).toHaveClass('app-chip--drift');

      // 3. Click Agent chip -> navigates to Agent Profile
      fireEvent.click(agentChipLink);
      await screen.findByRole('heading', { name: /Alessandro/ });

      // 4. In Agent Profile, Heartbeat Ledger link is present for G045
      const heartbeatLink = screen.getByRole('link', { name: 'Heartbeat Ledger' });
      expect(heartbeatLink.getAttribute('href')).toBe('/agents/1/heartbeat');

      // 5. Click Heartbeat Ledger -> navigates to Heartbeat Ledger page
      fireEvent.click(heartbeatLink);
      await screen.findByText('心跳信箱与用户指定唤醒');

      // 6. Open dialog, leave a note, submit
      const openDialogBtn = screen.getByRole('button', { name: '给下一次心跳留言' });
      fireEvent.click(openDialogBtn);

      const dialog = screen.getByRole('dialog', { name: '给下一次心跳留言' });
      const textarea = within(dialog).getByLabelText(/便签留言正文/);
      fireEvent.change(textarea, { target: { value: 'Note sent via full journey' } });

      const submitBtn = within(dialog).getByRole('button', { name: '投递便签' });
      fireEvent.click(submitBtn);

      // 7. Dialog closes and note appears in mailbox
      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: '给下一次心跳留言' })).not.toBeInTheDocument();
      });
      await screen.findByText('Note sent via full journey');
    });

    it('renders clickable Project chip in Chat topbar when project is assigned', async () => {
      installFetch([
        {
          test: '/api/agents/conversations/43/',
          handler: () =>
            jsonResponse({
              id: 43,
              name: 'Project Chat',
              created_at: '2026-09-29T10:00:00Z',
              frozen_project_ids: [],
              project: 10,
              project_name: 'Project Alpha',
              agent_type: 'g045',
              agent_preset_id: 1,
              last_message_at: '2026-09-29T10:00:00Z',
              thinking_level: null,
              memory_injection_enabled: null,
            }),
        },
        {
          test: '/api/agents/chat/43/',
          handler: () =>
            jsonResponse({
              messages: [],
              has_more: false,
              total_count: 0,
            }),
        },
        {
          test: '/api/core/projects/',
          handler: () => jsonResponse([]),
        },
        {
          test: '/api/agents/presets/',
          handler: () => jsonResponse([PRESET_G045]),
        },
      ]);

      renderApp(['/chat/43']);

      await screen.findByText('Project Chat');
      const projectChipLink = screen.getByRole('link', { name: 'Project Alpha' });
      expect(projectChipLink).toHaveClass('app-chip--link');
      expect(projectChipLink.getAttribute('href')).toBe('/projects/10');
    });

    it('renders Agent Hub and Project Hub entries as distinct app-btn buttons on Chat Home', async () => {
      installFetch([
        {
          test: '/api/agents/conversations/',
          handler: () =>
            jsonResponse([
              {
                id: 42,
                name: 'Chat with Alessandro',
                created_at: '2026-09-29T10:00:00Z',
                frozen_project_ids: [],
                project: 0,
                project_name: null,
                agent_type: 'g045',
                agent_preset_id: 1,
                last_message_at: '2026-09-29T10:00:00Z',
                thinking_level: null,
                memory_injection_enabled: null,
              },
            ]),
        },
      ]);

      renderApp(['/']);

      await screen.findByText('最近会话 · V4 P1A');
      const agentHubLink = screen.getByRole('link', { name: /Agent Hub/ });
      expect(agentHubLink.getAttribute('href')).toBe('/agents');
      expect(agentHubLink).toHaveClass('app-btn');
      expect(agentHubLink).not.toHaveClass('app-btn-ghost');

      const projectHubLink = screen.getByRole('link', { name: /项目 Hub/ });
      expect(projectHubLink.getAttribute('href')).toBe('/projects');
      expect(projectHubLink).toHaveClass('app-btn');
      expect(projectHubLink).not.toHaveClass('app-btn-ghost');
    });
  });
});

