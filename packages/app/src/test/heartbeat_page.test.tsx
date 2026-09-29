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
});
