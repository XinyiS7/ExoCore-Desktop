import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import {
  ensureTestLocalStorage,
  jsonResponse,
  MockRoute,
  renderApp,
  unmockFetch,
} from './helpers';
import type { ModelCatalog } from 'exo-shared/models';
import type { ApiKeyRow, EndpointRow } from '../features/settings/types';
import { validateModelCatalog } from '../shared/modelCatalog';
import {
  createEndpoint,
  createApiKey,
  putRoleConfig,
} from '../features/settings/api';
import { AppApiError } from '../features/chat/api';

describe('Phase 2C CP C-3 — Endpoints, API Keys & Model Roles', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let activeRoutes: MockRoute[] = [];

  const mockCatalog: ModelCatalog = {
    models: [
      {
        name: 'deepseek-v4-pro',
        family: 'deepseek',
        abilities: ['chat', 'reasoning', 'fc'],
        compatible_endpoint_ids: [1, 2],
      },
      {
        name: 'gemini-2.5-flash',
        family: 'gemini',
        abilities: ['chat', 'vision'],
        compatible_endpoint_ids: [2, 3],
      },
      {
        name: 'flux-1-schnell',
        family: 'flux',
        abilities: ['image_gen'],
        compatible_endpoint_ids: [3],
      },
    ],
    endpoints: [
      {
        id: 1,
        name: 'DeepSeek Direct',
        provider: 'deepseek',
        configured: true,
        enabled: true,
        execution_type: 'direct_api',
        execution_adapter: 'internal_http',
        payload_format: 'openai',
        cache_transport: 'inline_chunk',
        attachment_transports: ['base64'],
      },
      {
        id: 2,
        name: 'OpenRouter Gateway',
        provider: 'openrouter',
        configured: true,
        enabled: true,
        execution_type: 'direct_api',
        execution_adapter: 'internal_http',
        payload_format: 'openai',
        cache_transport: 'inline_chunk',
        attachment_transports: ['url'],
      },
      {
        id: 3,
        name: 'Gemini Direct',
        provider: 'gemini',
        configured: true,
        enabled: true,
        execution_type: 'direct_api',
        execution_adapter: 'internal_http',
        payload_format: 'gemini_raw',
        cache_transport: 'inline_chunk',
        attachment_transports: ['base64'],
      },
      {
        id: 4,
        name: 'Disabled Endpoint',
        provider: 'deepseek',
        configured: true,
        enabled: false,
        execution_type: 'direct_api',
        execution_adapter: 'internal_http',
        payload_format: 'openai',
        cache_transport: 'none',
        attachment_transports: [],
      },
      {
        id: 5,
        name: 'Managed Antigravity',
        provider: 'antigravity',
        configured: true,
        enabled: true,
        execution_type: 'managed_runtime',
        execution_adapter: 'internal_runtime',
        payload_format: 'openai',
        cache_transport: 'none',
        attachment_transports: [],
      },
    ],
    roles: {
      main: [
        {
          model: 'deepseek-v4-pro',
          default_endpoint: 1,
          style_shadow: null,
          position: 0,
        },
        {
          model: 'gemini-2.5-flash',
          default_endpoint: 2,
          style_shadow: 'deepseek-v4-pro',
          position: 1,
        },
      ],
      support: {
        general_sub_agent: {
          model: 'deepseek-v4-pro',
          default_endpoint: 1,
        },
        vision_helper: {
          model: 'gemini-2.5-flash',
          default_endpoint: 2,
        },
        grounding: {
          model: 'gemini-2.5-flash',
          default_endpoint: 2,
        },
        image_gen: {
          model: 'flux-1-schnell',
          default_endpoint: 3,
        },
      },
    },
    providers: [
      { id: 'deepseek', display_name: 'DeepSeek', execution_type: 'direct_api' },
      { id: 'openrouter', display_name: 'OpenRouter', execution_type: 'direct_api' },
      { id: 'gemini', display_name: 'Google Gemini', execution_type: 'direct_api' },
      { id: 'antigravity', display_name: 'Antigravity Managed', execution_type: 'managed_runtime' },
    ],
  };

  const mockEndpoints: EndpointRow[] = [
    {
      id: 1,
      name: 'DeepSeek Direct',
      provider: 'deepseek',
      api_key_alias: 'deepseek-main',
      enabled: true,
      configured: true,
      execution_type: 'direct_api',
      execution_adapter: 'internal_http',
    },
    {
      id: 2,
      name: 'OpenRouter Gateway',
      provider: 'openrouter',
      api_key_alias: 'openrouter-dev',
      enabled: true,
      configured: true,
      execution_type: 'direct_api',
      execution_adapter: 'internal_http',
    },
    {
      id: 5,
      name: 'Managed Antigravity',
      provider: 'antigravity',
      api_key_alias: null,
      enabled: true,
      configured: true,
      execution_type: 'managed_runtime',
      execution_adapter: 'internal_runtime',
    },
  ];

  const mockApiKeys: ApiKeyRow[] = [
    {
      alias: 'deepseek-main',
      platform: 'deepseek',
      last_four: 'a1b2',
      created_at: '2026-09-01T10:00:00Z',
      updated_at: '2026-09-01T10:00:00Z',
    },
    {
      alias: 'openrouter-dev',
      platform: 'openrouter',
      last_four: 'c3d4',
      created_at: '2026-09-05T12:00:00Z',
      updated_at: '2026-09-05T12:00:00Z',
    },
    {
      alias: 'gemini-key',
      platform: 'gemini',
      last_four: 'e5f6',
      created_at: '2026-09-08T08:00:00Z',
      updated_at: '2026-09-08T08:00:00Z',
    },
  ];

  beforeEach(() => {
    unmockFetch();
    ensureTestLocalStorage();
    localStorage.clear();

    activeRoutes = [
      { test: '/api/core/conversations/', handler: () => jsonResponse([]) },
      { test: '/api/core/model-catalog/', handler: () => jsonResponse(mockCatalog) },
      { test: '/api/core/endpoints/', handler: () => jsonResponse(mockEndpoints) },
      { test: '/api/core/apikeys/', handler: () => jsonResponse(mockApiKeys) },
    ];

    fetchMock = vi.fn().mockImplementation((req: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = typeof req === 'string' ? req : req instanceof URL ? req.toString() : req.url;
      const method = (init?.method ?? (typeof req === 'object' && 'method' in req ? req.method : 'GET')).toUpperCase();

      // Search routes in reverse order so newer overrides take precedence
      for (let i = activeRoutes.length - 1; i >= 0; i--) {
        const route = activeRoutes[i];
        const matchesUrl = typeof route.test === 'string' ? urlStr.includes(route.test) : route.test.test(urlStr);
        const matchesMethod = !route.method || route.method.toUpperCase() === method;

        if (matchesUrl && matchesMethod) {
          return route.handler(new URL(urlStr, 'http://localhost'), init);
        }
      }

      return jsonResponse({ detail: 'Not Found' }, { status: 404 });
    });

    globalThis.fetch = fetchMock as unknown as typeof fetch;
    document.title = 'ExoCore V4';
  });

  afterEach(() => {
    cleanup();
    unmockFetch();
  });

  // ── 1. Endpoints Management ──────────────────────────────────────────────────
  describe('Endpoints Management', () => {
    it('renders endpoints list with provider, alias, and runtime status', async () => {
      renderApp(['/settings/keys']);

      expect(await screen.findByText('可用通道端点')).toBeInTheDocument();
      expect(await screen.findByText('DeepSeek Direct')).toBeInTheDocument();
      expect(screen.getByText('OpenRouter Gateway')).toBeInTheDocument();
      expect(screen.getByText('Managed Antigravity')).toBeInTheDocument();

      // Check document title
      await waitFor(() => expect(document.title).toBe('密钥与端点 · ExoCore V4'));
    });

    it('creates endpoint submitting only allowlisted fields: name, provider, api_key_alias, enabled', async () => {
      let createBody: unknown = null;
      activeRoutes.push({
        test: '/api/core/endpoints/',
        method: 'POST',
        handler: async (_url, init) => {
          createBody = JSON.parse(String(init?.body));
          return jsonResponse({
            id: 10,
            name: 'New Custom Endpoint',
            provider: 'deepseek',
            api_key_alias: 'deepseek-main',
            enabled: true,
            configured: true,
            execution_type: 'direct_api',
            execution_adapter: 'internal_http',
          });
        },
      });

      renderApp(['/settings/keys']);

      const newBtn = await screen.findByRole('button', { name: '新建端点' });
      fireEvent.click(newBtn);

      expect(await screen.findByRole('heading', { name: '新建通道端点' })).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText('端点名称 *'), {
        target: { value: 'New Custom Endpoint' },
      });
      fireEvent.change(screen.getByLabelText('供应商 Provider *'), {
        target: { value: 'deepseek' },
      });
      fireEvent.change(screen.getByLabelText('绑定 API Key 别名'), {
        target: { value: 'deepseek-main' },
      });

      fireEvent.click(screen.getByRole('button', { name: '创建端点' }));

      await waitFor(() => expect(createBody).not.toBeNull());
      expect(createBody).toEqual({
        name: 'New Custom Endpoint',
        provider: 'deepseek',
        api_key_alias: 'deepseek-main',
        enabled: true,
      });
      // Derived fields never submitted
      expect(createBody).not.toHaveProperty('configured');
      expect(createBody).not.toHaveProperty('execution_type');
    });

    it('handles 409 conflict on endpoint deletion preserving row with actionable error', async () => {
      activeRoutes.push({
        test: '/api/core/endpoints/1/',
        method: 'DELETE',
        handler: () =>
          jsonResponse(
            { detail: '该端点仍被模型角色引用，无法删除 (409 Conflict)' },
            { status: 409 },
          ),
      });

      renderApp(['/settings/keys']);

      const deleteBtn = await screen.findByRole('button', { name: '删除端点 DeepSeek Direct' });
      fireEvent.click(deleteBtn);

      expect(await screen.findByRole('heading', { name: '确认删除端点' })).toBeInTheDocument();

      const confirmBtn = screen.getByRole('button', { name: '确认删除' });
      fireEvent.click(confirmBtn);

      expect(
        await screen.findByText(/该端点仍被模型角色引用，无法删除/),
      ).toBeInTheDocument();
      // Row is still in document
      expect(screen.getByText('DeepSeek Direct')).toBeInTheDocument();
    });

    it('managed runtime provider does not accept api_key_alias', async () => {
      let createBody: unknown = null;
      activeRoutes.push({
        test: '/api/core/endpoints/',
        method: 'POST',
        handler: async (_url, init) => {
          createBody = JSON.parse(String(init?.body));
          return jsonResponse({
            id: 11,
            name: 'Managed Endpoint',
            provider: 'antigravity',
            api_key_alias: null,
            enabled: true,
            configured: true,
            execution_type: 'managed_runtime',
            execution_adapter: 'internal_runtime',
          });
        },
      });

      renderApp(['/settings/keys']);

      fireEvent.click(await screen.findByRole('button', { name: '新建端点' }));
      fireEvent.change(screen.getByLabelText('端点名称 *'), {
        target: { value: 'Managed Endpoint' },
      });
      fireEvent.change(screen.getByLabelText('供应商 Provider *'), {
        target: { value: 'antigravity' },
      });

      // Managed runtime provider displays info notice and does not render key alias selector
      expect(screen.getByText(/该 Provider 为托管运行时/)).toBeInTheDocument();
      expect(screen.queryByLabelText('绑定 API Key 别名')).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: '创建端点' }));

      await waitFor(() => expect(createBody).not.toBeNull());
      expect(createBody).toEqual({
        name: 'Managed Endpoint',
        provider: 'antigravity',
        api_key_alias: null,
        enabled: true,
      });
    });
  });

  // ── 2. API Keys Management ───────────────────────────────────────────────────
  describe('API Keys Management', () => {
    it('switches to API Keys tab, lists keys with platform grouping and secret hygiene', async () => {
      renderApp(['/settings/keys']);

      const keysTabBtn = await screen.findByRole('tab', { name: /密钥池/ });
      fireEvent.click(keysTabBtn);

      expect(await screen.findByText('deepseek-main')).toBeInTheDocument();
      expect(screen.getByText('openrouter-dev')).toBeInTheDocument();
      expect(screen.getByText('gemini-key')).toBeInTheDocument();

      // Masked last_four is displayed, raw secret is never present
      expect(screen.getByText('****a1b2')).toBeInTheDocument();
      expect(screen.queryByText(/sk-[a-zA-Z0-9]{20,}/)).toBeNull();

      // Platform filter chips exist
      expect(screen.getByRole('button', { name: /全部 \(3\)/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /deepseek \(1\)/ })).toBeInTheDocument();
    });

    it('creates API key requiring platform, alias, and write-only key_value', async () => {
      let createBody: unknown = null;
      activeRoutes.push({
        test: '/api/core/apikeys/',
        method: 'POST',
        handler: async (_url, init) => {
          createBody = JSON.parse(String(init?.body));
          return jsonResponse({
            alias: 'new-key-1',
            platform: 'gemini',
            last_four: '9988',
            created_at: '2026-09-13T12:00:00Z',
            updated_at: '2026-09-13T12:00:00Z',
          });
        },
      });

      renderApp(['/settings/keys']);
      fireEvent.click(await screen.findByRole('tab', { name: /密钥池/ }));

      fireEvent.click(await screen.findByRole('button', { name: '新建密钥' }));
      expect(await screen.findByRole('heading', { name: '新建 API 密钥' })).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText('密钥别名 (Alias) *'), {
        target: { value: 'new-key-1' },
      });
      fireEvent.change(screen.getByLabelText('适用平台 (Platform) *'), {
        target: { value: 'gemini' },
      });
      fireEvent.change(screen.getByLabelText('密钥内容 (Key Value) *'), {
        target: { value: 'secret-token-xyz-12345' },
      });

      fireEvent.click(screen.getByRole('button', { name: '创建密钥' }));

      await waitFor(() => expect(createBody).not.toBeNull());
      expect(createBody).toEqual({
        alias: 'new-key-1',
        platform: 'gemini',
        key_value: 'secret-token-xyz-12345',
      });
    });

    it('renames API key sending URL-encoded alias with single writable field', async () => {
      let patchUrl = '';
      let patchBody: unknown = null;
      activeRoutes.push({
        test: /\/api\/core\/apikeys\/.*/,
        method: 'PATCH',
        handler: async (url, init) => {
          patchUrl = String(url);
          patchBody = JSON.parse(String(init?.body));
          return jsonResponse({
            alias: 'deepseek-renamed',
            platform: 'deepseek',
            last_four: 'a1b2',
            created_at: '2026-09-01T10:00:00Z',
            updated_at: '2026-09-13T12:00:00Z',
          });
        },
      });

      renderApp(['/settings/keys']);
      fireEvent.click(await screen.findByRole('tab', { name: /密钥池/ }));

      const renameBtn = await screen.findByRole('button', { name: '重命名密钥 deepseek-main' });
      fireEvent.click(renameBtn);

      expect(await screen.findByRole('heading', { name: '重命名密钥别名' })).toBeInTheDocument();

      const input = screen.getByLabelText('新别名 *');
      fireEvent.change(input, { target: { value: 'deepseek-renamed' } });

      fireEvent.click(screen.getByRole('button', { name: '确认重命名' }));

      await waitFor(() => expect(patchBody).not.toBeNull());
      expect(patchUrl).toContain('/api/core/apikeys/deepseek-main/');
      expect(patchBody).toEqual({ alias: 'deepseek-renamed' });
    });

    it('overwrites API key value with accessible dialog and memory-only secret', async () => {
      let putUrl = '';
      let putBody: unknown = null;
      activeRoutes.push({
        test: /\/api\/core\/apikeys\/.*\/overwrite\//,
        method: 'PUT',
        handler: async (url, init) => {
          putUrl = String(url);
          putBody = JSON.parse(String(init?.body));
          return jsonResponse({
            alias: 'deepseek-main',
            platform: 'deepseek',
            last_four: '7788',
            created_at: '2026-09-01T10:00:00Z',
            updated_at: '2026-09-13T12:00:00Z',
          });
        },
      });

      renderApp(['/settings/keys']);
      fireEvent.click(await screen.findByRole('tab', { name: /密钥池/ }));

      const overwriteBtn = await screen.findByRole('button', { name: '覆写密钥内容 deepseek-main' });
      fireEvent.click(overwriteBtn);

      expect(await screen.findByRole('heading', { name: '覆写密钥内容' })).toBeInTheDocument();

      const input = screen.getByLabelText('新密钥内容 *');
      fireEvent.change(input, { target: { value: 'new-super-secret-key-value' } });

      fireEvent.click(screen.getByRole('button', { name: '确认覆写' }));

      await waitFor(() => expect(putBody).not.toBeNull());
      expect(putUrl).toContain('/api/core/apikeys/deepseek-main/overwrite/');
      expect(putBody).toEqual({ key_value: 'new-super-secret-key-value' });
    });
  });

  // ── 3. Model Roles Management ────────────────────────────────────────────────
  describe('Model Roles Management', () => {
    it('renders model roles draft with main roles and all 4 support roles', async () => {
      renderApp(['/settings/models']);

      expect(await screen.findByText('主模型角色 (Main Roles)')).toBeInTheDocument();
      expect(await screen.findByText('辅助与专职角色 (Support Roles)')).toBeInTheDocument();

      // Check support roles titles
      expect(screen.getByText(/通用子代理 \(General Sub-Agent\)/)).toBeInTheDocument();
      expect(screen.getByText(/视觉解析助手 \(Vision Helper\)/)).toBeInTheDocument();
      expect(screen.getByText(/联网搜索助手 \(Grounding\)/)).toBeInTheDocument();
      expect(screen.getByText(/图像生成助手 \(Image Gen\)/)).toBeInTheDocument();

      await waitFor(() => expect(document.title).toBe('模型角色 · ExoCore V4'));
    });

    it('enforces main role >= 1 and disables delete button when only 1 exists', async () => {
      // Override catalog route with only 1 main role
      activeRoutes.push({
        test: '/api/core/model-catalog/',
        handler: () =>
          jsonResponse({
            ...mockCatalog,
            roles: {
              ...mockCatalog.roles,
              main: [mockCatalog.roles.main[0]],
            },
          }),
      });

      renderApp(['/settings/models']);

      const deleteBtn = await screen.findByRole('button', { name: '删除角色 #1' });
      expect(deleteBtn).toBeDisabled();
    });

    it('supports keyboard-accessible up/down reordering of main roles and generates stable position indices', async () => {
      let putBody: unknown = null;
      activeRoutes.push({
        test: '/api/core/config/roles/',
        method: 'PUT',
        handler: async (_url, init) => {
          putBody = JSON.parse(String(init?.body));
          return jsonResponse(putBody);
        },
      });

      renderApp(['/settings/models']);

      // Initial state: #1 is deepseek-v4-pro, #2 is gemini-2.5-flash
      const downBtn = await screen.findByRole('button', { name: '下移角色 #1' });
      fireEvent.click(downBtn);

      // Now save button is active because draft is dirty
      const saveBtn = screen.getByRole('button', { name: '保存角色配置' });
      expect(saveBtn).not.toBeDisabled();
      fireEvent.click(saveBtn);

      await waitFor(() => expect(putBody).not.toBeNull());
      const body = putBody as { main: { model: string; position: number }[] };
      expect(body.main[0].model).toBe('gemini-2.5-flash');
      expect(body.main[0].position).toBe(0);
      expect(body.main[1].model).toBe('deepseek-v4-pro');
      expect(body.main[1].position).toBe(1);
    });

    it('filters endpoint options by model compatibility and execution adapter (direct_api + internal_http)', async () => {
      renderApp(['/settings/models']);

      await screen.findByText('主模型角色 (Main Roles)');

      // flux-1-schnell image_gen role only has endpoint 3 compatible
      const imageGenSelect = screen.getByLabelText('绑定端点 (Endpoint)', {
        selector: '#support-role-endpoint-image_gen',
      }) as HTMLSelectElement;

      const options = Array.from(imageGenSelect.options).map((opt) => opt.value);
      // Endpoint 3 is compatible with flux-1-schnell
      expect(options).toContain('3');
      // Endpoint 1 is NOT compatible with flux-1-schnell
      expect(options).not.toContain('1');
      // Endpoint 5 (antigravity) is managed_runtime, not direct_api, so NOT eligible
      expect(options).not.toContain('5');
    });

    it('preserves draft on server error without resetting form', async () => {
      activeRoutes.push({
        test: '/api/core/config/roles/',
        method: 'PUT',
        handler: () =>
          jsonResponse(
            { detail: '后端验证失败: 端点未绑定有效密钥' },
            { status: 400 },
          ),
      });

      renderApp(['/settings/models']);

      await screen.findByText('主模型角色 (Main Roles)');
      fireEvent.click(screen.getByRole('button', { name: '添加主角色' }));

      const saveBtn = screen.getByRole('button', { name: '保存角色配置' });
      fireEvent.click(saveBtn);

      expect(
        await screen.findByText(/后端验证失败: 端点未绑定有效密钥/),
      ).toBeInTheDocument();

      // Form still retains the added 3rd role
      expect(screen.getByRole('button', { name: '删除角色 #3' })).toBeInTheDocument();
    });
  });

  // ── 4. Routing & Shell Navigation ────────────────────────────────────────────
  describe('Routing & Shell Navigation', () => {
    it('redirects bare /settings to /settings/keys when redirectSettings is enabled', async () => {
      renderApp(['/settings'], { redirectSettings: true });

      expect(await screen.findByText('通道端点与 API 密钥')).toBeInTheDocument();
      await waitFor(() => expect(document.title).toBe('密钥与端点 · ExoCore V4'));
    });

    it('activates Settings center in MoreMenu pointing to /settings/keys without P2 chip', async () => {
      renderApp(['/']);

      // Open More Menu via avatar button
      const avatarBtns = await screen.findAllByRole('button', { name: '更多菜单' });
      fireEvent.click(avatarBtns[0]);

      const settingsLink = await screen.findByRole('menuitem', { name: '设置中心' });
      expect(settingsLink).toHaveAttribute('href', '/settings/keys');
      expect(settingsLink.querySelector('.app-phase-chip')).toBeNull();
    });

    it('routes unknown settings route to NotFoundPage', async () => {
      renderApp(['/settings/nonexistent']);

      expect(await screen.findByText('页面不存在')).toBeInTheDocument();
    });
  });

  // ── 5. Regression Guard (F1-F6) ──────────────────────────────────────────────
  describe('Regression Guard (F1-F6)', () => {
    it('F1: rejects malformed catalog missing providers or execution metadata', () => {
      expect(() =>
        validateModelCatalog({
          ...mockCatalog,
          providers: [{ id: 'p1', display_name: '', execution_type: 'direct_api' }],
        }),
      ).toThrow(AppApiError);

      expect(() =>
        validateModelCatalog({
          ...mockCatalog,
          endpoints: [
            {
              ...mockCatalog.endpoints[0],
              execution_type: '',
            },
          ],
        }),
      ).toThrow(AppApiError);
    });

    it('F2: flags malformed 2xx writes with ambiguousWrite=true and code=CONTRACT', async () => {
      activeRoutes.push(
        {
          test: '/api/core/endpoints/',
          method: 'POST',
          handler: () => jsonResponse({ unexpected: 'shape' }),
        },
        {
          test: '/api/core/apikeys/',
          method: 'POST',
          handler: () => jsonResponse({ key: 'no-alias' }),
        },
        {
          test: '/api/core/config/roles/',
          method: 'PUT',
          handler: () => jsonResponse({ main: [] }),
        },
      );

      let caughtEndpoint: AppApiError | null = null;
      try {
        await createEndpoint({
          name: 'invalid-resp-ep',
          provider: 'deepseek',
          api_key_alias: null,
          enabled: true,
        });
      } catch (err) {
        caughtEndpoint = err as AppApiError;
      }
      expect(caughtEndpoint).toBeInstanceOf(AppApiError);
      expect(caughtEndpoint?.ambiguousWrite).toBe(true);
      expect(caughtEndpoint?.code).toBe('CONTRACT');

      let caughtKey: AppApiError | null = null;
      try {
        await createApiKey({
          alias: 'invalid-resp-key',
          platform: 'deepseek',
          key_value: 'secret12345',
        });
      } catch (err) {
        caughtKey = err as AppApiError;
      }
      expect(caughtKey).toBeInstanceOf(AppApiError);
      expect(caughtKey?.ambiguousWrite).toBe(true);
      expect(caughtKey?.code).toBe('CONTRACT');

      let caughtRole: AppApiError | null = null;
      try {
        await putRoleConfig({
          main: [{ model: 'deepseek-v4-pro', default_endpoint: 1, style_shadow: null, position: 0 }],
          support: {
            general_sub_agent: { model: 'deepseek-v4-pro', default_endpoint: 1 },
            vision_helper: { model: 'gemini-2.5-flash', default_endpoint: 2 },
            grounding: { model: 'gemini-2.5-flash', default_endpoint: 2 },
            image_gen: { model: 'flux-1-schnell', default_endpoint: 3 },
          },
        });
      } catch (err) {
        caughtRole = err as AppApiError;
      }
      expect(caughtRole).toBeInstanceOf(AppApiError);
      expect(caughtRole?.ambiguousWrite).toBe(true);
      expect(caughtRole?.code).toBe('CONTRACT');
    });

    it('F3: surfaces DRF field validation messages inside open dialog', async () => {
      activeRoutes.push({
        test: '/api/core/apikeys/',
        method: 'POST',
        handler: () =>
          jsonResponse({ alias: ['此 API Key 别名已存在'] }, { status: 400 }),
      });

      renderApp(['/settings/keys']);
      fireEvent.click(await screen.findByRole('tab', { name: /密钥池/ }));
      fireEvent.click(await screen.findByRole('button', { name: '新建密钥' }));

      fireEvent.change(screen.getByLabelText('密钥别名 (Alias) *'), {
        target: { value: 'duplicate-alias' },
      });
      fireEvent.change(screen.getByLabelText('密钥内容 (Key Value) *'), {
        target: { value: 'some-valid-secret-key' },
      });

      fireEvent.click(screen.getByRole('button', { name: '创建密钥' }));

      expect(await screen.findByText('此 API Key 别名已存在')).toBeInTheDocument();
      // Dialog remains open
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByLabelText('密钥别名 (Alias) *')).toHaveValue('duplicate-alias');
    });

    it('F4: keeps provider selector enabled during endpoint edit and offers catalog providers only', async () => {
      renderApp(['/settings/keys']);

      const editBtn = await screen.findByRole('button', { name: '编辑端点 DeepSeek Direct' });
      fireEvent.click(editBtn);

      const providerSelect = screen.getByLabelText('供应商 Provider *') as HTMLSelectElement;
      expect(providerSelect).toBeEnabled();
      const optionValues = Array.from(providerSelect.options).map((o) => o.value);
      expect(optionValues).toEqual(['deepseek', 'openrouter', 'gemini', 'antigravity']);
    });

    it('F5 & F6: warns on ineligible endpoint/shadow and blocks role save', async () => {
      let putCalled = false;
      activeRoutes.push({
        test: '/api/core/config/roles/',
        method: 'PUT',
        handler: () => {
          putCalled = true;
          return jsonResponse({});
        },
      });

      // Provide catalog where main role has endpoint 4 (disabled)
      activeRoutes.push({
        test: '/api/core/model-catalog/',
        handler: () =>
          jsonResponse({
            ...mockCatalog,
            roles: {
              ...mockCatalog.roles,
              main: [
                {
                  model: 'deepseek-v4-pro',
                  default_endpoint: 4, // disabled endpoint
                  style_shadow: null,
                  position: 0,
                },
              ],
            },
          }),
      });

      renderApp(['/settings/models']);

      expect(
        await screen.findByText('当前绑定的通道端点不可用、已禁用或与模型不兼容，请重新选择有效端点。'),
      ).toBeInTheDocument();

      // Endpoint selector must only contain eligible endpoints (1, 2)
      const epSelect = screen.getByLabelText('通道端点 (Endpoint)', {
        selector: '#main-role-endpoint-0',
      }) as HTMLSelectElement;
      const epOptions = Array.from(epSelect.options).map((o) => o.value);
      expect(epOptions).toEqual(['1', '2']);
      expect(epOptions).not.toContain('4');

      // Attempting to save blocks request and shows actionable error
      // Make draft dirty by adding another role without touching role #0
      fireEvent.click(screen.getByRole('button', { name: '添加主角色' }));

      const saveBtn = screen.getByRole('button', { name: '保存角色配置' });
      fireEvent.click(saveBtn);

      expect(
        await screen.findByText(/主模型角色 #1 当前绑定的通道端点不可用，请重新选择有效端点/),
      ).toBeInTheDocument();
      expect(putCalled).toBe(false);
    });
  });
});
