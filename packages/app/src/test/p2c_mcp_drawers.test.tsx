import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import {
  ensureTestLocalStorage,
  jsonResponse,
  MockRoute,
  renderApp,
  unmockFetch,
} from './helpers';
import {
  createMcpCredential,
  deleteMcpCredential,
  overwriteMcpCredential,
  putPresetDrawerEnabled,
  putPresetMcpBinding,
  renameMcpCredential,
  validateDrawerCatalog,
  validateMcpCredentials,
  validateMcpServers,
  validatePresetDrawers,
  validatePresetMcpServers,
} from '../features/settings/api';
import { settingsQueryKeys } from '../features/settings/queries';
import { AppApiError } from '../features/chat/api';

describe('Phase 2C CP C-4 — Tool Drawers & MCP Credentials', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let activeRoutes: MockRoute[] = [];

  const mockPresets = [
    {
      id: 1,
      name: 'Alaric',
      agent_type: 'standard',
      default_model: 'deepseek-v4-pro',
      is_visible: true,
    },
    {
      id: 2,
      name: 'Alaric',
      agent_type: 'standard',
      default_model: 'deepseek-v4-pro',
      is_visible: true,
    },
    {
      id: 8,
      name: 'User Alicia',
      agent_type: 'user',
      default_model: 'deepseek-v4-pro',
      is_visible: true,
    },
  ];

  const mockDrawerCatalog = {
    drawers: [
      {
        name: 'galatea_garden',
        display_name: 'Galatea Garden',
        description: 'Galatea 花园工具抽屉',
        server_name: 'galatea_garden',
        available: true,
        credential_strategy: 'per_preset',
        credential_required: true,
      },
      {
        name: 'moonlight_tools',
        display_name: 'Moonlight Tools',
        description: 'Moonlight 核心工具箱',
        server_name: 'moonlight_core',
        available: false,
        credential_strategy: 'per_preset',
        credential_required: true,
      },
    ],
  };

  const mockPreset1Drawers = {
    preset_id: 1,
    drawers: [
      {
        name: 'galatea_garden',
        display_name: 'Galatea Garden',
        server_name: 'galatea_garden',
        available: true,
        enabled: true,
        credential_strategy: 'per_preset',
        credential_required: true,
        credential_mode: 'dedicated',
        credential_alias: 'galatea-alias-1',
        credential_ready: true,
      },
      {
        name: 'moonlight_tools',
        display_name: 'Moonlight Tools',
        server_name: 'moonlight_core',
        available: false,
        enabled: false,
        credential_strategy: 'per_preset',
        credential_required: true,
        credential_mode: 'dedicated',
        credential_alias: null,
        credential_ready: false,
      },
    ],
  };

  const mockMcpServers = {
    servers: [
      {
        name: 'galatea_garden',
        display_name: 'Galatea Garden Server',
        credential_strategy: 'per_preset',
        credential_required: true,
        available: true,
        public_credential_configured: false,
      },
      {
        name: 'moonlight_core',
        display_name: 'Moonlight Core Server',
        credential_strategy: 'per_preset',
        credential_required: true,
        available: false,
        public_credential_configured: false,
      },
    ],
  };

  const mockPreset1McpServers = {
    preset_id: 1,
    servers: [
      {
        server_name: 'galatea_garden',
        credential_strategy: 'per_preset',
        credential_required: true,
        mode: 'dedicated',
        credential_alias: 'galatea-alias-1',
        resolved_source: 'preset',
        resolved_alias: 'galatea-alias-1',
        credential_ready: true,
      },
      {
        server_name: 'moonlight_core',
        credential_strategy: 'per_preset',
        credential_required: true,
        mode: 'dedicated',
        credential_alias: null,
        resolved_source: 'none',
        resolved_alias: null,
        credential_ready: false,
      },
    ],
  };

  const mockCredentials = {
    credentials: [
      {
        alias: 'galatea-alias-1',
        server_name: 'galatea_garden',
        last_four: '9999',
        created_at: '2026-09-01T00:00:00Z',
        updated_at: '2026-09-01T00:00:00Z',
      },
      {
        alias: 'galatea-alias-2',
        server_name: 'galatea_garden',
        last_four: '1234',
        created_at: '2026-09-02T00:00:00Z',
        updated_at: '2026-09-02T00:00:00Z',
      },
    ],
  };

  beforeEach(() => {
    ensureTestLocalStorage();
    activeRoutes = [
      { test: '/api/agents/presets/', method: 'GET', handler: () => jsonResponse(mockPresets) },
      { test: '/api/agents/drawers/', method: 'GET', handler: () => jsonResponse(mockDrawerCatalog) },
      { test: '/api/agents/presets/1/drawers/', method: 'GET', handler: () => jsonResponse(mockPreset1Drawers) },
      { test: '/api/agents/mcp-servers/', method: 'GET', handler: () => jsonResponse(mockMcpServers) },
      { test: '/api/agents/presets/1/mcp-credentials/', method: 'GET', handler: () => jsonResponse(mockPreset1McpServers) },
      { test: '/api/agents/mcp-credentials/', method: 'GET', handler: () => jsonResponse(mockCredentials) },
    ];

    fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), 'http://localhost');
      const method = init?.method ?? 'GET';
      for (const route of activeRoutes) {
        const matchesMethod = !route.method || route.method === method;
        const matchesPath =
          typeof route.test === 'string'
            ? url.pathname === route.test
            : route.test.test(url.pathname);
        if (matchesMethod && matchesPath) {
          return route.handler(url, init);
        }
      }
      return new Response(JSON.stringify({ detail: `Unhandled route: ${method} ${url.pathname}` }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    cleanup();
    unmockFetch();
    vi.restoreAllMocks();
  });

  // ── 1. API & Validator Contracts ──────────────────────────────────────────

  describe('API and Validator Contracts', () => {
    it('validateDrawerCatalog fails closed on missing or non-array drawers', () => {
      expect(() => validateDrawerCatalog(null)).toThrow(AppApiError);
      expect(() => validateDrawerCatalog({})).toThrow(AppApiError);
      expect(() => validateDrawerCatalog({ drawers: 'not-an-array' })).toThrow(AppApiError);
      expect(() =>
        validateDrawerCatalog({
          drawers: [{ name: 'test' }],
        }),
      ).toThrow(AppApiError);

      const valid = validateDrawerCatalog(mockDrawerCatalog);
      expect(valid).toHaveLength(2);
      expect(valid[0].name).toBe('galatea_garden');
    });

    it('validatePresetDrawers validates preset_id and drawer items', () => {
      expect(() => validatePresetDrawers(null, 1)).toThrow(AppApiError);
      expect(() => validatePresetDrawers({ preset_id: '1', drawers: [] }, 1)).toThrow(AppApiError);
      expect(() =>
        validatePresetDrawers(
          {
            preset_id: 1,
            drawers: [{ name: 'test' }],
          },
          1,
        ),
      ).toThrow(AppApiError);

      const valid = validatePresetDrawers(mockPreset1Drawers, 1);
      expect(valid).toHaveLength(2);
      expect(valid[0].name).toBe('galatea_garden');
    });

    it('validateMcpCredentials fails closed if raw secret is returned', () => {
      const valid = validateMcpCredentials(mockCredentials);
      expect(valid).toHaveLength(2);
      expect(valid[0].last_four).toBe('9999');

      expect(() =>
        validateMcpCredentials({
          credentials: [
            {
              alias: 'leaked-cred',
              server_name: 'galatea_garden',
              last_four: '1234',
              raw_secret: 'shh-secret',
            },
          ],
        }),
      ).toThrow(AppApiError);

      expect(() =>
        validateMcpCredentials({
          credentials: [
            {
              alias: 'leaked-cred',
              server_name: 'galatea_garden',
              last_four: '1234',
              secret: 'shh-secret',
            },
          ],
        }),
      ).toThrow(AppApiError);
    });

    it('validateMcpServers and validatePresetMcpServers enforce envelopes', () => {
      expect(() => validateMcpServers({})).toThrow(AppApiError);
      expect(() => validatePresetMcpServers({ servers: [] }, 1)).toThrow(AppApiError);

      const validServers = validateMcpServers(mockMcpServers);
      expect(validServers).toHaveLength(2);

      const validPresetServers = validatePresetMcpServers(mockPreset1McpServers, 1);
      expect(validPresetServers).toHaveLength(2);
    });

    it('createMcpCredential forbids slash in alias and submits secret verbatim without trim', async () => {
      let postedBody: unknown = null;
      activeRoutes.push({
        test: '/api/agents/mcp-credentials/',
        method: 'POST',
        handler: async (_, init) => {
          postedBody = JSON.parse(String(init?.body));
          return jsonResponse({
            alias: 'test-alias',
            server_name: 'galatea_garden',
            last_four: 'ret ',
            created_at: '2026-09-13T00:00:00Z',
            updated_at: '2026-09-13T00:00:00Z',
          });
        },
      });

      await expect(
        createMcpCredential({
          alias: 'path/invalid',
          server_name: 'galatea_garden',
          credential_value: '   secret_with_spaces   ',
        }),
      ).rejects.toThrow(/斜杠/);

      const res = await createMcpCredential({
        alias: 'test-alias',
        server_name: 'galatea_garden',
        credential_value: '   secret_with_spaces   ',
      });

      expect(postedBody).toEqual({
        alias: 'test-alias',
        server_name: 'galatea_garden',
        credential_value: '   secret_with_spaces   ',
      });
      expect(res.last_four).toBe('ret ');
    });

    it('overwriteMcpCredential preserves secret verbatim', async () => {
      let putBody: unknown = null;
      activeRoutes.push({
        test: '/api/agents/mcp-credentials/test-alias/overwrite/',
        method: 'PUT',
        handler: async (_, init) => {
          putBody = JSON.parse(String(init?.body));
          return jsonResponse({
            alias: 'test-alias',
            server_name: 'galatea_garden',
            last_four: 'new ',
            created_at: '2026-09-13T00:00:00Z',
            updated_at: '2026-09-13T00:00:00Z',
          });
        },
      });

      await overwriteMcpCredential('test-alias', '  new_secret  ');
      expect(putBody).toEqual({ credential_value: '  new_secret  ' });
    });

    it('renameMcpCredential sends PATCH with trimmed alias', async () => {
      let patchBody: unknown = null;
      activeRoutes.push({
        test: '/api/agents/mcp-credentials/old-alias/',
        method: 'PATCH',
        handler: async (_, init) => {
          patchBody = JSON.parse(String(init?.body));
          return jsonResponse({
            alias: 'new-alias',
            server_name: 'galatea_garden',
            last_four: '1234',
            created_at: '2026-09-13T00:00:00Z',
            updated_at: '2026-09-13T00:00:00Z',
          });
        },
      });

      const res = await renameMcpCredential('old-alias', '  new-alias  ');
      expect(patchBody).toEqual({ alias: 'new-alias' });
      expect(res.alias).toBe('new-alias');
    });

    it('deleteMcpCredential propagates 409 conflict when credential is in use', async () => {
      activeRoutes.push({
        test: '/api/agents/mcp-credentials/in-use-alias/',
        method: 'DELETE',
        handler: async () =>
          jsonResponse(
            { error: { code: 'credential_in_use', message: 'Credential is used by presets' } },
            409,
          ),
      });

      await expect(deleteMcpCredential('in-use-alias')).rejects.toThrow(AppApiError);
    });

    it('putPresetDrawerEnabled sends boolean enabled', async () => {
      let putBody: unknown = null;
      activeRoutes.push({
        test: '/api/agents/presets/1/drawers/galatea_garden/',
        method: 'PUT',
        handler: async (_, init) => {
          putBody = JSON.parse(String(init?.body));
          return jsonResponse({
            name: 'galatea_garden',
            display_name: 'Galatea Garden',
            server_name: 'galatea_garden',
            available: true,
            enabled: false,
            credential_strategy: 'per_preset',
            credential_required: true,
            credential_mode: 'dedicated',
            credential_alias: 'galatea-alias-1',
            credential_ready: true,
          });
        },
      });

      const updated = await putPresetDrawerEnabled(1, 'galatea_garden', false);
      expect(putBody).toEqual({ enabled: false });
      expect(updated.enabled).toBe(false);
    });

    it('putPresetMcpBinding sends dedicated mode and credential_alias', async () => {
      let putBody: unknown = null;
      activeRoutes.push({
        test: '/api/agents/presets/1/mcp-credentials/galatea_garden/',
        method: 'PUT',
        handler: async (_, init) => {
          putBody = JSON.parse(String(init?.body));
          return jsonResponse({
            server_name: 'galatea_garden',
            display_name: 'Galatea Garden Server',
            credential_strategy: 'per_preset',
            credential_required: true,
            credential_mode: 'dedicated',
            credential_alias: 'galatea-alias-2',
            resolved_source: 'preset',
            resolved_alias: 'galatea-alias-2',
            available: true,
            ready: true,
            credential_ready: true,
          });
        },
      });

      const updated = await putPresetMcpBinding(1, 'galatea_garden', {
        mode: 'dedicated',
        credential_alias: 'galatea-alias-2',
      });
      expect(putBody).toEqual({ mode: 'dedicated', credential_alias: 'galatea-alias-2' });
      expect(updated.credential_alias).toBe('galatea-alias-2');
    });
  });

  // ── 2. UI & Settings Integration ──────────────────────────────────────────

  describe('UI & Settings Integration', () => {
    it('direct navigation to /settings/mcp renders McpPanel and sets title', async () => {
      renderApp(['/settings/mcp']);

      await waitFor(() => {
        expect(screen.getByText('MCP 与工具抽屉 (Drawers & MCP)')).toBeInTheDocument();
      });

      expect(document.title).toContain('MCP与工具抽屉');
    });

    it('filters out user preset and disambiguates duplicate preset names with (#id)', async () => {
      renderApp(['/settings/mcp']);

      await waitFor(() => {
        expect(screen.getByLabelText(/选择配置目标 Agent 预设/)).toBeInTheDocument();
      });

      const select = screen.getByLabelText(/选择配置目标 Agent 预设/) as HTMLSelectElement;
      const optionTexts = Array.from(select.options).map((o) => o.text);

      expect(optionTexts).toContain('Alaric (#1)');
      expect(optionTexts).toContain('Alaric (#2)');
      expect(optionTexts.some((t) => t.includes('User Alicia'))).toBe(false);
    });

    it('displays independent status chips for available, enabled, and credential_ready', async () => {
      renderApp(['/settings/mcp']);

      await waitFor(() => {
        expect(screen.getByText('Galatea Garden')).toBeInTheDocument();
      });

      expect(screen.getAllByText('服务可用').length).toBeGreaterThan(0);
      expect(screen.getAllByText('已授权').length).toBeGreaterThan(0);
      expect(screen.getAllByText('凭证就绪').length).toBeGreaterThan(0);

      expect(screen.getByText('Moonlight Tools')).toBeInTheDocument();
      expect(screen.getAllByText('服务不可用').length).toBeGreaterThan(0);
      expect(screen.getAllByText('未授权').length).toBeGreaterThan(0);
      expect(screen.getAllByText('凭证未配置').length).toBeGreaterThan(0);
    });

    it('toggles drawer enabled status and executes target-row lock', async () => {
      let putCalled = false;
      activeRoutes.push({
        test: '/api/agents/presets/1/drawers/galatea_garden/',
        method: 'PUT',
        handler: async () => {
          putCalled = true;
          return jsonResponse({
            name: 'galatea_garden',
            display_name: 'Galatea Garden',
            server_name: 'galatea_garden',
            available: true,
            enabled: false,
            credential_strategy: 'per_preset',
            credential_required: true,
            credential_mode: 'dedicated',
            credential_alias: 'galatea-alias-1',
            credential_ready: true,
          });
        },
      });

      renderApp(['/settings/mcp']);

      await waitFor(() => {
        expect(screen.getByText('Galatea Garden')).toBeInTheDocument();
      });

      const toggleBtn = screen.getByRole('button', { name: '禁用抽屉 Galatea Garden' });
      fireEvent.click(toggleBtn);

      await waitFor(() => {
        expect(putCalled).toBe(true);
      });
    });

    it('renders dedicated MCP server bindings with per_preset read-only public status', async () => {
      renderApp(['/settings/mcp']);

      await waitFor(() => {
        expect(screen.getAllByText('不适用 (per_preset)').length).toBeGreaterThan(0);
      });

      const selectBinding = screen.getByLabelText(/为服务 galatea_garden 选择专属凭证/);
      expect(selectBinding).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '保存服务 galatea_garden 凭证绑定' })).toBeInTheDocument();
    });

    it('switches to Credentials tab and filters credentials by server', async () => {
      renderApp(['/settings/mcp']);

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /MCP 凭证池/ })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('tab', { name: /MCP 凭证池/ }));

      await waitFor(() => {
        expect(screen.getByText('MCP 凭证池 (Credentials Pool)')).toBeInTheDocument();
      });

      expect(screen.getByText('galatea-alias-1')).toBeInTheDocument();
      expect(screen.getByText('galatea-alias-2')).toBeInTheDocument();
      expect(screen.getAllByText('•••• 9999').length).toBeGreaterThan(0);
      expect(screen.getAllByText('•••• 1234').length).toBeGreaterThan(0);
    });

    it('handles credential delete with 409 conflict gracefully', async () => {
      activeRoutes.push({
        test: '/api/agents/mcp-credentials/galatea-alias-1/',
        method: 'DELETE',
        handler: async () =>
          jsonResponse(
            { error: { code: 'credential_in_use', message: '凭证正被 Agent 预设专属绑定引用，禁止删除' } },
            409,
          ),
      });

      renderApp(['/settings/mcp']);

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /MCP 凭证池/ })).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('tab', { name: /MCP 凭证池/ }));

      await waitFor(() => {
        expect(screen.getByText('galatea-alias-1')).toBeInTheDocument();
      });

      const deleteBtn = screen.getByRole('button', { name: '删除凭证 galatea-alias-1' });
      fireEvent.click(deleteBtn);

      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: '删除 MCP 凭证确认' })).toBeInTheDocument();
      });

      const confirmBtn = screen.getByRole('button', { name: '确认删除' });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(
          screen.getByText(/凭证正被 Agent 预设专属绑定引用，禁止删除|credential_in_use/),
        ).toBeInTheDocument();
      });
    });

    it('builder-regression: strictly fails closed on malformed strategy/mode/source enums', () => {
      const badDrawer = structuredClone(mockPreset1Drawers);
      (badDrawer.drawers[0] as Record<string, unknown>).credential_strategy = 'invalid_strategy';
      expect(() => validatePresetDrawers(badDrawer, 1)).toThrow(AppApiError);

      const badServer = structuredClone(mockMcpServers);
      (badServer.servers[0] as Record<string, unknown>).credential_strategy = 'invalid_strategy';
      expect(() => validateMcpServers(badServer)).toThrow(AppApiError);

      const badPresetServer = structuredClone(mockPreset1McpServers);
      (badPresetServer.servers[0] as Record<string, unknown>).mode = 'invalid_mode';
      expect(() => validatePresetMcpServers(badPresetServer, 1)).toThrow(AppApiError);

      const badSourcePresetServer = structuredClone(mockPreset1McpServers);
      (badSourcePresetServer.servers[0] as Record<string, unknown>).resolved_source = 'invalid_source';
      expect(() => validatePresetMcpServers(badSourcePresetServer, 1)).toThrow(AppApiError);
    });

    it('builder-regression: write response guards reject raw_secret with CONTRACT error and ambiguousWrite: true', async () => {
      activeRoutes.push(
        {
          test: '/api/agents/mcp-credentials/',
          method: 'POST',
          handler: () =>
            jsonResponse({
              alias: 'test-alias',
              server_name: 'galatea_garden',
              last_four: '1234',
              raw_secret: 'leaked_raw_secret',
            }),
        },
        {
          test: '/api/agents/mcp-credentials/galatea-alias-1/',
          method: 'PATCH',
          handler: () =>
            jsonResponse({
              alias: 'renamed-alias',
              server_name: 'galatea_garden',
              last_four: '1234',
              raw_secret: 'leaked_raw_secret',
            }),
        },
        {
          test: '/api/agents/mcp-credentials/galatea-alias-1/overwrite/',
          method: 'PUT',
          handler: () =>
            jsonResponse({
              alias: 'galatea-alias-1',
              server_name: 'galatea_garden',
              last_four: '5678',
              raw_secret: 'leaked_raw_secret',
            }),
        },
      );

      const expectAmbiguous = (err: unknown) => {
        expect(err).toBeInstanceOf(AppApiError);
        expect((err as AppApiError).code).toBe('CONTRACT');
        expect((err as AppApiError).ambiguousWrite).toBe(true);
      };

      await createMcpCredential({
        alias: 'test-alias',
        server_name: 'galatea_garden',
        credential_value: 'secret-val',
      }).then(() => expect.unreachable('Must reject raw_secret leak'), expectAmbiguous);

      await renameMcpCredential('galatea-alias-1', 'renamed-alias').then(
        () => expect.unreachable('Must reject raw_secret leak'),
        expectAmbiguous,
      );

      await overwriteMcpCredential('galatea-alias-1', 'new-secret').then(
        () => expect.unreachable('Must reject raw_secret leak'),
        expectAmbiguous,
      );
    });

    it('builder-regression: keeps all credentials under single all-list query identity', () => {
      expect(settingsQueryKeys.mcpCredentials('server_a')).toEqual(settingsQueryKeys.mcpCredentials());
      expect(settingsQueryKeys.mcpCredentials('server_b')).toEqual(settingsQueryKeys.mcpCredentials());
      expect(settingsQueryKeys.mcpCredentials()).toEqual(['mcp-credentials']);
    });

    it('builder-regression: does not leak unsaved binding draft across preset switch', async () => {
      activeRoutes.push(
        {
          test: '/api/agents/presets/2/drawers/',
          method: 'GET',
          handler: () => jsonResponse({ ...mockPreset1Drawers, preset_id: 2 }),
        },
        {
          test: '/api/agents/presets/2/mcp-credentials/',
          method: 'GET',
          handler: () => jsonResponse({ ...mockPreset1McpServers, preset_id: 2 }),
        },
      );

      renderApp(['/settings/mcp']);

      await waitFor(() => {
        expect(screen.getAllByText('不适用 (per_preset)').length).toBeGreaterThan(0);
      });

      const select = screen.getByLabelText(
        '为服务 galatea_garden 选择专属凭证',
      ) as HTMLSelectElement;
      expect(select.value).toBe('galatea-alias-1');

      fireEvent.change(select, { target: { value: 'galatea-alias-2' } });
      expect(select.value).toBe('galatea-alias-2');

      const presetSelect = screen.getByLabelText(/选择配置目标 Agent 预设/);
      fireEvent.change(presetSelect, { target: { value: '2' } });

      await waitFor(() => {
        expect(
          (screen.getByLabelText('为服务 galatea_garden 选择专属凭证') as HTMLSelectElement).value,
        ).toBe('galatea-alias-1');
      });

      fireEvent.change(presetSelect, { target: { value: '1' } });

      await waitFor(() => {
        expect(
          (screen.getByLabelText('为服务 galatea_garden 选择专属凭证') as HTMLSelectElement).value,
        ).toBe('galatea-alias-1');
      });
    });
  });
});
