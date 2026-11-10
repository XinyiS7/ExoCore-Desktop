/**
 * Issue #123 — Cloudflare Access expiry must be actionable from the shell.
 *
 * Background: `exocore.g045.dev` sits behind Cloudflare Access. An expired
 * session answers every request with a 302 to the edge login page. A top-level
 * navigation follows that redirect (user re-auths), but a JS `fetch` is blocked
 * by CORS and surfaces as a normalized network failure. Because the old Service
 * Worker answered every `/app/` document navigation from precache, the login
 * page could never appear — the app stayed dead until site data was cleared.
 *
 * These probes freeze the shell contract only: the wording split, the
 * structured re-auth capability, and that re-auth is a browser-level document
 * navigation to `/reauth` (outside the Service Worker scope). The Service
 * Worker half lives in `p2d_d2_sw_routing.test.tsx`.
 */
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureTestLocalStorage, installFetch, jsonResponse, renderApp, unmockFetch } from './helpers';

const preset = {
  id: 5,
  name: 'Sandro',
  description: null,
  agent_type: 'standard',
  default_model: 'deepseek-v4-flash',
  system_prompt: null,
  is_visible: true,
};

const catalog = {
  models: [
    { name: 'deepseek-v4-flash', family: 'deepseek', abilities: [], compatible_endpoint_ids: [7] },
  ],
  endpoints: [
    {
      id: 7,
      name: 'DeepSeek',
      provider: 'deepseek',
      execution_type: 'direct_api',
      execution_adapter: 'internal_http',
      payload_format: 'openai',
      cache_transport: 'inline_chunk',
      attachment_transports: [],
      configured: true,
      enabled: true,
    },
  ],
  roles: {
    main: [{ model: 'deepseek-v4-flash', default_endpoint: 7 }],
    support: {},
  },
  providers: [
    {
      id: 'deepseek',
      display_name: 'DeepSeek',
      execution_type: 'direct_api',
      execution_adapter: 'internal_http',
      requires_endpoint_api_key: true,
    },
  ],
};

const conversation = {
  id: 1,
  name: 'C1',
  created_at: '2026-09-01T00:00:00Z',
  frozen_project_ids: [],
  project: 0,
  project_name: null,
  agent_type: 'standard',
  agent_preset_id: 5,
  last_message_at: null,
  thinking_level: 'auto',
  memory_injection_enabled: null,
  is_prime: false,
};

const row = {
  id: 500,
  role: 'assistant',
  content: 'persisted answer',
  reasoning_content: null,
  platform: 'deepseek',
  model_version: 'v4-flash',
  token_count: null,
  index_in_session: 0,
  attachment_ids: [],
  attachments_meta: null,
  created_at: '2026-09-12T10:00:00Z',
};

function routes(arrivals: () => Response) {
  return [
    { test: '/api/agents/presets/', handler: () => jsonResponse([preset]) },
    { test: '/api/core/model-catalog/', handler: () => jsonResponse(catalog) },
    { test: '/api/agents/conversations/1/', handler: () => jsonResponse(conversation) },
    {
      test: '/api/agents/conversations/1/cache/',
      handler: () => jsonResponse({ active: false, platform: null, has_snapshot: false }),
    },
    {
      test: '/api/agents/chat/1/',
      handler: () => jsonResponse({ messages: [row], total_count: 1, has_more: false }),
    },
    { test: '/api/push/assistant-arrivals/', handler: arrivals },
  ];
}

/** A cross-origin Access redirect is invisible to JS; only the TypeError survives. */
const accessExpiredArrivals = () => {
  throw new TypeError('Failed to fetch');
};

const stubOnline = (value: boolean) =>
  vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(value);

let realLocation: Location;
let assignSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  ensureTestLocalStorage();
  localStorage.clear();
  realLocation = window.location;
  assignSpy = vi.fn();
  // jsdom's `location` is unforgeable and its `assign` is non-configurable, so
  // the stub proxies an EMPTY target (no proxy invariants) and forwards every
  // other read to the real Location — the transport layer still needs `origin`.
  const locationStub = new Proxy({} as Record<PropertyKey, unknown>, {
    get(_target, prop) {
      if (prop === 'assign') return assignSpy;
      const value = Reflect.get(realLocation, prop);
      return typeof value === 'function' ? value.bind(realLocation) : value;
    },
  });
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: locationStub,
  });
});

afterEach(() => {
  Object.defineProperty(window, 'location', { configurable: true, writable: true, value: realLocation });
  cleanup();
  unmockFetch();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('Issue #123: Cloudflare Access expiry is actionable from the shell banner', () => {
  it('online network failure offers re-auth and never leaks the transport error', async () => {
    stubOnline(true);
    installFetch(routes(accessExpiredArrivals));

    renderApp(['/chat/1']);
    await screen.findByText('消息同步暂不可用: 连接被中断（可能是登录已过期）');

    expect(screen.queryByText(/Failed to fetch/), 'transport error not leaked').toBeNull();
    expect(screen.getByRole('button', { name: '重试同步' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '重新认证' }));

    // Browser-level document navigation to the SW-scope-external entry point.
    expect(assignSpy).toHaveBeenCalledTimes(1);
    expect(assignSpy).toHaveBeenCalledWith('/reauth');
  });

  it('a definitely offline browser reports offline and offers no re-auth', async () => {
    stubOnline(false);
    installFetch(routes(accessExpiredArrivals));

    renderApp(['/chat/1']);
    await screen.findByText('消息同步暂不可用: 设备已离线');

    expect(screen.queryByRole('button', { name: '重新认证' })).toBeNull();
    expect(screen.getByRole('button', { name: '重试同步' })).toBeTruthy();
  });

  it('server-side failures keep their wording and never offer re-auth', async () => {
    stubOnline(true);
    installFetch(routes(() => jsonResponse({ detail: 'sync exploded' }, 500)));

    renderApp(['/chat/1']);
    await screen.findByText('消息同步暂不可用: 服务端同步异常');

    expect(screen.queryByRole('button', { name: '重新认证' })).toBeNull();
    expect(assignSpy).not.toHaveBeenCalled();
  });
});
