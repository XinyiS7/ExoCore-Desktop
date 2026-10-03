/**
 * CP4 builder-owned integration tests — Heartbeat Ledger session deep link.
 *
 * Scope under test:
 * - `?session=<uuid>` is the single selection source (refresh-safe);
 * - Ledger row changes update only `session` and keep unrelated search params;
 * - back/forward re-derive selection from the URL;
 * - empty/malformed session fails explicitly with no lookup and no default;
 * - detail 404 keeps the explicit error/retry state;
 * - a canonical detail.presetId mismatch never renders another preset's event;
 * - reads issue GETs only and never acknowledge;
 * - the River heartbeat card's auxiliary Ledger link uses the real item
 *   preset_id + target.session_uuid, while `阅读全文` remains the primary
 *   drawer trigger.
 *
 * All HTTP is installFetch-mocked; no real backend/DB/acknowledge activity.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AgentHeartbeatPage } from '../features/heartbeat/AgentHeartbeatPage';
import {
  callsToPath,
  installFetch,
  jsonResponse,
  renderApp,
  renderV4,
  unmockFetch,
  type MockRoute,
} from './helpers';

const PRESET_G045 = {
  id: 6,
  name: 'Alaric',
  description: 'heartbeat companion',
  agent_type: 'g045',
  default_model: 'gemini-3.5-flash',
  system_prompt: null,
  is_visible: true,
};

const QUEUE = {
  preset_id: 6,
  auto_enabled: true,
  cadence_mode: 'normal',
  paused_until_utc: null,
  paused_until_local: null,
  next_auto: null,
  pending_notes: [],
  explicit_wakeups: [],
  unshown_explicit_count: 0,
};

const UUID_A = '11111111-aaaa-4aaa-8aaa-111111111111';
const UUID_B = '22222222-bbbb-4bbb-9bbb-222222222222';
const UUID_RIVER = '33333333-cccc-4ccc-8ccc-333333333333';

const DETAIL_TEXT: Record<string, string> = {
  [UUID_A]: '详情正文A',
  [UUID_B]: '详情正文B',
  [UUID_RIVER]: '详情正文River',
};

const EVENT_A = {
  session_uuid: UUID_A,
  preset_id: 6,
  preset_name: 'Alaric',
  launch_source: 'auto',
  domain: 'system',
  status: 'succeeded',
  content: '摘要-A',
  started_at: '2026-09-30T08:00:00Z',
  completed_at: '2026-09-30T08:01:00Z',
};

const EVENT_B = {
  ...EVENT_A,
  session_uuid: UUID_B,
  launch_source: 'user',
  status: 'failed',
  content: '摘要-B',
  started_at: '2026-09-29T08:00:00Z',
  completed_at: '2026-09-29T08:01:00Z',
};

function detailPayload(uuid: string, over: Record<string, unknown> = {}) {
  return {
    session_uuid: uuid,
    preset_id: 6,
    preset_name: 'Alaric',
    launch_source: 'auto',
    domain: 'system',
    status: 'succeeded',
    content: DETAIL_TEXT[uuid] ?? `详情正文-${uuid}`,
    started_at: '2026-09-30T08:00:00Z',
    completed_at: '2026-09-30T08:01:00Z',
    seed_message: '',
    tool_history: [],
    error_summary: '',
    finalization_reason: null,
    attempt_number: 1,
    wake_up_task_id: null,
    source_conversation_id: null,
    acknowledged_at: null,
    ...over,
  };
}

/** Preset + queue + ledger list; detail rows are added per test. */
function baseRoutes(): MockRoute[] {
  return [
    { test: '/api/agents/presets/6/', handler: () => jsonResponse(PRESET_G045) },
    { test: '/api/heartbeat/queue/', handler: () => jsonResponse(QUEUE) },
    {
      test: '/api/heartbeat/events/',
      handler: () =>
        jsonResponse({ events: [EVENT_A, EVENT_B], total_count: 2, has_more: false }),
    },
  ];
}

function ledgerRoutes(): MockRoute[] {
  return [
    ...baseRoutes(),
    { test: `/api/heartbeat/events/${UUID_A}/`, handler: () => jsonResponse(detailPayload(UUID_A)) },
    { test: `/api/heartbeat/events/${UUID_B}/`, handler: () => jsonResponse(detailPayload(UUID_B)) },
  ];
}

const RIVER_HEARTBEAT_ITEM = {
  source_type: 'heartbeat',
  source_id: UUID_RIVER,
  occurred_at: '2026-10-02T12:00:00Z',
  time_precision: 'instant',
  preset_id: 6,
  preview: '心跳预览',
  capabilities: ['open_ledger'],
  target: { type: 'heartbeat', session_uuid: UUID_RIVER },
  source_specific: { launch_source: 'auto', domain: '', status: 'succeeded' },
};

/**
 * Minimal harness around the real page so tests can read the current search
 * string and drive memory history back/forward deterministically.
 */
function DeepLinkHarness() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <span data-testid="location-search">{location.search}</span>
      <button type="button" onClick={() => navigate(-1)}>
        测试后退
      </button>
      <button type="button" onClick={() => navigate(1)}>
        测试前进
      </button>
    </>
  );
}

function renderLedger(initialEntries: string[]) {
  return renderV4(
    <Routes>
      <Route
        path="agents/:presetId/heartbeat"
        element={
          <>
            <DeepLinkHarness />
            <AgentHeartbeatPage />
          </>
        }
      />
    </Routes>,
    initialEntries,
  );
}

const detailRegion = () => screen.getByRole('region', { name: '心跳记录详情' });

afterEach(() => {
  unmockFetch();
  vi.restoreAllMocks();
});

describe('Heartbeat Ledger ?session deep link (CP4)', () => {
  it('derives the selected detail from ?session on a fresh load (refresh-safe)', async () => {
    installFetch(ledgerRoutes());
    renderLedger([`/agents/6/heartbeat?session=${UUID_B}`]);

    const region = await screen.findByRole('region', { name: '心跳记录详情' });
    expect(await within(region).findByText('详情正文B')).toBeInTheDocument();
    expect(within(region).queryByText('详情正文A')).not.toBeInTheDocument();

    const rowB = screen.getByRole('button', { name: /摘要-B/ });
    const rowA = screen.getByRole('button', { name: /摘要-A/ });
    expect(rowB).toHaveAttribute('aria-pressed', 'true');
    expect(rowA).toHaveAttribute('aria-pressed', 'false');
  });

  it('Ledger row selection updates only session and preserves unrelated search params', async () => {
    installFetch(ledgerRoutes());
    renderLedger([`/agents/6/heartbeat?focus=keep&session=${UUID_A}`]);

    expect(await within(await screen.findByRole('region', { name: '心跳记录详情' })).findByText('详情正文A')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /摘要-B/ }));
    expect(await within(detailRegion()).findByText('详情正文B')).toBeInTheDocument();

    const search = new URLSearchParams(screen.getByTestId('location-search').textContent ?? '');
    expect(search.get('session')).toBe(UUID_B);
    expect(search.get('focus')).toBe('keep');
  });

  it('back and forward navigation re-derives the selection from search params', async () => {
    installFetch(ledgerRoutes());
    renderLedger([
      `/agents/6/heartbeat?session=${UUID_A}`,
      `/agents/6/heartbeat?session=${UUID_B}`,
    ]);

    expect(await within(await screen.findByRole('region', { name: '心跳记录详情' })).findByText('详情正文B')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '测试后退' }));
    await waitFor(() =>
      expect(within(detailRegion()).getByText('详情正文A')).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: '测试前进' }));
    await waitFor(() =>
      expect(within(detailRegion()).getByText('详情正文B')).toBeInTheDocument(),
    );
  });

  it('empty ?session= fails explicitly without a lookup or default selection', async () => {
    const { calls } = installFetch(ledgerRoutes());
    renderLedger(['/agents/6/heartbeat?session=']);

    expect(await screen.findByText('Session 参数无效')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '心跳记录详情' })).toBeNull();
    expect(screen.queryByRole('region', { name: '无效的心跳会话' })).toBeInTheDocument();
    expect(
      calls.filter((call) => /^\/api\/heartbeat\/events\/.+/.test(call.url.pathname)),
    ).toHaveLength(0);
  });

  it('malformed ?session= fails explicitly without requesting the bad value', async () => {
    const { calls } = installFetch(ledgerRoutes());
    renderLedger(['/agents/6/heartbeat?session=not-a-uuid']);

    expect(await screen.findByText('Session 参数无效')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '心跳记录详情' })).toBeNull();
    expect(calls.some((call) => call.url.pathname.includes('not-a-uuid'))).toBe(false);
  });

  it('404 keeps the explicit detail error state and recovers on retry', async () => {
    let missing = true;
    installFetch([
      ...baseRoutes(),
      {
        test: `/api/heartbeat/events/${UUID_A}/`,
        handler: () =>
          missing
            ? jsonResponse({ error: 'event not found', code: 'event_not_found' }, 404)
            : jsonResponse(detailPayload(UUID_A)),
      },
    ]);
    renderLedger([`/agents/6/heartbeat?session=${UUID_A}`]);

    const region = await screen.findByRole('region', { name: '心跳记录详情' });
    expect(await within(region).findByText('心跳记录不存在')).toBeInTheDocument();
    expect(within(region).queryByText('详情正文A')).not.toBeInTheDocument();

    missing = false;
    fireEvent.click(within(region).getByRole('button', { name: '重试' }));
    expect(await within(detailRegion()).findByText('详情正文A')).toBeInTheDocument();
  });

  it('blocks content when canonical detail.presetId does not match the route preset', async () => {
    installFetch([
      ...baseRoutes(),
      {
        test: `/api/heartbeat/events/${UUID_A}/`,
        handler: () => jsonResponse(detailPayload(UUID_A, { preset_id: 9, preset_name: 'Other' })),
      },
    ]);
    renderLedger([`/agents/6/heartbeat?session=${UUID_A}`]);

    const region = await screen.findByRole('region', { name: '心跳记录详情' });
    expect(await within(region).findByText(/不属于当前 Agent #6/)).toBeInTheDocument();
    expect(within(region).queryByText('详情正文A')).not.toBeInTheDocument();
    expect(within(region).queryByText(/触发消息|工具调用记录|错误摘要/)).not.toBeInTheDocument();
  });

  it('deep-linked reads issue only GETs and never acknowledge or write', async () => {
    const { calls } = installFetch(ledgerRoutes());
    renderLedger([`/agents/6/heartbeat?session=${UUID_A}`]);
    await screen.findByText('详情正文A');

    expect(callsToPath(calls, `/api/heartbeat/events/${UUID_A}/`)).toHaveLength(1);
    const heartbeatCalls = calls.filter((call) => call.url.pathname.startsWith('/api/heartbeat/'));
    expect(heartbeatCalls.length).toBeGreaterThan(0);
    expect(heartbeatCalls.every((call) => call.init?.method === 'GET')).toBe(true);
    expect(calls.some((call) => /ack|consume|wakeup/i.test(call.url.pathname))).toBe(false);
  });

  it('River heartbeat card links with the real preset/session while 阅读全文 stays primary', async () => {
    const { calls } = installFetch([
      {
        test: '/api/core/river/',
        handler: () => jsonResponse({ items: [RIVER_HEARTBEAT_ITEM], next_cursor: null }),
      },
      { test: '/api/core/river/open-tasks/', handler: () => jsonResponse({ items: [] }) },
      ...baseRoutes(),
      {
        test: `/api/heartbeat/events/${UUID_RIVER}/`,
        handler: () => jsonResponse(detailPayload(UUID_RIVER)),
      },
    ]);
    renderApp(['/river']);

    const link = await screen.findByRole('link', { name: '查看心跳账本' });
    expect(link).toHaveAttribute(
      'href',
      `/agents/6/heartbeat?session=${UUID_RIVER}`,
    );
    // The primary heartbeat action remains the full-text drawer trigger.
    expect(screen.getByRole('button', { name: '阅读全文' })).toBeInTheDocument();

    fireEvent.click(link);
    const region = await screen.findByRole('region', { name: '心跳记录详情' });
    expect(await within(region).findByText('详情正文River')).toBeInTheDocument();
    expect(callsToPath(calls, `/api/heartbeat/events/${UUID_RIVER}/`)).toHaveLength(1);
    expect(calls.some((call) => call.url.pathname.startsWith('/agents/1/'))).toBe(false);
  });
});
