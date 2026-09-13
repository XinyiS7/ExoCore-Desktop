import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppApiError } from '../features/chat/api';
import {
  createMcpCredential,
  overwriteMcpCredential,
  renameMcpCredential,
  validateMcpServers,
  validatePresetDrawers,
  validatePresetMcpServers,
} from '../features/settings/api';
import { settingsQueryKeys } from '../features/settings/queries';
import {
  ensureTestLocalStorage,
  installFetch,
  jsonResponse,
  renderApp,
  unmockFetch,
} from '../test/helpers';

const credentials = {
  credentials: [
    { alias: 'cred-a', server_name: 'galatea_garden', last_four: '1111', created_at: '', updated_at: '' },
    { alias: 'cred-b', server_name: 'galatea_garden', last_four: '2222', created_at: '', updated_at: '' },
  ],
};

const servers = {
  servers: [
    {
      name: 'galatea_garden',
      display_name: 'Galatea Garden',
      available: true,
      credential_strategy: 'per_preset',
      credential_required: true,
      public_credential_alias: null,
      public_credential_configured: false,
    },
  ],
};

function presetServers(presetId: number, alias: string) {
  return {
    preset_id: presetId,
    servers: [
      {
        server_name: 'galatea_garden',
        credential_strategy: 'per_preset',
        credential_required: true,
        mode: 'dedicated',
        credential_alias: alias,
        resolved_source: 'preset',
        resolved_alias: alias,
        credential_ready: true,
      },
    ],
  };
}

function presetDrawers(presetId: number) {
  return {
    preset_id: presetId,
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
        credential_alias: 'cred-a',
        credential_ready: true,
      },
    ],
  };
}

function expectAmbiguousContract(error: unknown): void {
  expect(error).toBeInstanceOf(AppApiError);
  expect((error as AppApiError).code).toBe('CONTRACT');
  expect((error as AppApiError).ambiguousWrite).toBe(true);
}

describe('P2C CP C-4 independent acceptance', () => {
  beforeEach(() => {
    ensureTestLocalStorage();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    unmockFetch();
  });

  it('fails closed on malformed MCP strategy/mode enums instead of normalizing them', () => {
    const badDrawer = presetDrawers(1);
    badDrawer.drawers[0].credential_strategy = 'unexpected_strategy';
    expect(() => validatePresetDrawers(badDrawer, 1)).toThrow(AppApiError);

    const badServer = structuredClone(servers);
    badServer.servers[0].credential_strategy = 'unexpected_strategy';
    expect(() => validateMcpServers(badServer)).toThrow(AppApiError);

    const badPresetServer = presetServers(1, 'cred-a');
    badPresetServer.servers[0].mode = 'unexpected_mode';
    expect(() => validatePresetMcpServers(badPresetServer, 1)).toThrow(AppApiError);
  });

  it('rejects raw_secret leakage in successful MCP credential write responses', async () => {
    installFetch([
      {
        test: '/api/agents/mcp-credentials/',
        method: 'POST',
        handler: () => jsonResponse({
          alias: 'created', server_name: 'galatea_garden', last_four: '1234', raw_secret: 'LEAK',
        }),
      },
      {
        test: '/api/agents/mcp-credentials/old/',
        method: 'PATCH',
        handler: () => jsonResponse({
          alias: 'renamed', server_name: 'galatea_garden', last_four: '1234', raw_secret: 'LEAK',
        }),
      },
      {
        test: '/api/agents/mcp-credentials/created/overwrite/',
        method: 'PUT',
        handler: () => jsonResponse({
          alias: 'created', server_name: 'galatea_garden', last_four: '5678', raw_secret: 'LEAK',
        }),
      },
    ]);

    await createMcpCredential({ alias: 'created', server_name: 'galatea_garden', credential_value: 'secret' }).then(
      () => expect.unreachable('secret-bearing create response must reject'),
      expectAmbiguousContract,
    );
    await renameMcpCredential('old', 'renamed').then(
      () => expect.unreachable('secret-bearing rename response must reject'),
      expectAmbiguousContract,
    );
    await overwriteMcpCredential('created', 'secret-2').then(
      () => expect.unreachable('secret-bearing overwrite response must reject'),
      expectAmbiguousContract,
    );
  });

  it('keeps MCP credential facts under one all-list query key', () => {
    expect(settingsQueryKeys.mcpCredentials('galatea_garden')).toEqual(settingsQueryKeys.mcpCredentials());
    expect(settingsQueryKeys.mcpCredentials('moonlight_core')).toEqual(settingsQueryKeys.mcpCredentials());
  });

  it('discards unsaved binding drafts when switching AgentPreset targets', async () => {
    installFetch([
      {
        test: '/api/agents/presets/',
        method: 'GET',
        handler: () => jsonResponse([
          { id: 1, name: 'Agent A', agent_type: 'standard', default_model: 'm', is_visible: true },
          { id: 2, name: 'Agent B', agent_type: 'standard', default_model: 'm', is_visible: true },
        ]),
      },
      { test: '/api/agents/mcp-servers/', method: 'GET', handler: () => jsonResponse(servers) },
      { test: '/api/agents/mcp-credentials/', method: 'GET', handler: () => jsonResponse(credentials) },
      { test: '/api/agents/presets/1/drawers/', method: 'GET', handler: () => jsonResponse(presetDrawers(1)) },
      { test: '/api/agents/presets/2/drawers/', method: 'GET', handler: () => jsonResponse(presetDrawers(2)) },
      { test: '/api/agents/presets/1/mcp-credentials/', method: 'GET', handler: () => jsonResponse(presetServers(1, 'cred-a')) },
      { test: '/api/agents/presets/2/mcp-credentials/', method: 'GET', handler: () => jsonResponse(presetServers(2, 'cred-a')) },
    ]);

    renderApp(['/settings/mcp']);

    const binding = await screen.findByLabelText('为服务 galatea_garden 选择专属凭证') as HTMLSelectElement;
    expect(binding.value).toBe('cred-a');
    fireEvent.change(binding, { target: { value: 'cred-b' } });
    expect(binding.value).toBe('cred-b');

      fireEvent.change(screen.getByLabelText(/选择配置目标 Agent 预设/), { target: { value: '2' } });

      await waitFor(() => {
        expect((screen.getByLabelText('为服务 galatea_garden 选择专属凭证') as HTMLSelectElement).value).toBe('cred-a');
      });

      fireEvent.change(screen.getByLabelText(/选择配置目标 Agent 预设/), { target: { value: '1' } });

      await waitFor(() => {
        expect((screen.getByLabelText('为服务 galatea_garden 选择专属凭证') as HTMLSelectElement).value).toBe('cred-a');
      });
    });
  });
