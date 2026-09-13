import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createApiKey,
  createEndpoint,
  createMcpCredential,
  deleteApiKey,
  deleteEndpoint,
  deleteMcpCredential,
  fetchApiKeys,
  fetchDrawerCatalog,
  fetchEndpoints,
  fetchMcpCredentials,
  fetchMcpServers,
  fetchPresetDrawers,
  fetchPresetMcpServers,
  fetchSystemConfig,
  overwriteApiKey,
  overwriteMcpCredential,
  patchEndpoint,
  patchSystemConfig,
  putPresetDrawerEnabled,
  putPresetMcpBinding,
  putRoleConfig,
  renameApiKey,
  renameMcpCredential,
} from './api';
import type {
  ApiKeyCreatePayload,
  ApiKeyOverwritePayload,
  ApiKeyRenamePayload,
  EndpointPayload,
  McpCredentialCreatePayload,
  PresetMcpBindingPayload,
  RoleConfigPayload,
  SystemConfigPatch,
} from './types';
import { MODEL_CATALOG_QUERY_KEY } from '../../shared/modelCatalog';

export const settingsQueryKeys = {
  all: ['settings'] as const,
  config: () => [...settingsQueryKeys.all, 'config'] as const,
  endpoints: () => ['endpoints'] as const,
  apiKeys: () => ['apikeys'] as const,
  drawerCatalog: () => ['drawer-catalog'] as const,
  mcpServers: () => ['mcp-servers'] as const,
  mcpCredentials: (_serverName?: string) => ['mcp-credentials'] as const,
  presetDrawers: (presetId: number) => ['preset-drawers', presetId] as const,
  presetMcpServers: (presetId: number) => ['preset-mcp-servers', presetId] as const,
};

export function useSystemConfigQuery() {
  return useQuery({
    queryKey: settingsQueryKeys.config(),
    queryFn: fetchSystemConfig,
    staleTime: 60_000,
  });
}

export function useUpdateSystemConfigMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (patch: SystemConfigPatch) => patchSystemConfig(patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsQueryKeys.config() });
    },
  });
}

// ── Endpoints Queries & Mutations ────────────────────────────────────────────

export function useEndpointsQuery() {
  return useQuery({
    queryKey: settingsQueryKeys.endpoints(),
    queryFn: fetchEndpoints,
    staleTime: 30_000,
  });
}

export function useCreateEndpointMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: EndpointPayload) => createEndpoint(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsQueryKeys.endpoints() });
      queryClient.invalidateQueries({ queryKey: MODEL_CATALOG_QUERY_KEY });
    },
  });
}

export function useUpdateEndpointMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<EndpointPayload> }) =>
      patchEndpoint(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsQueryKeys.endpoints() });
      queryClient.invalidateQueries({ queryKey: MODEL_CATALOG_QUERY_KEY });
    },
  });
}

export function useDeleteEndpointMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deleteEndpoint(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsQueryKeys.endpoints() });
      queryClient.invalidateQueries({ queryKey: MODEL_CATALOG_QUERY_KEY });
    },
  });
}

// ── ApiKeys Queries & Mutations ──────────────────────────────────────────────

export function useApiKeysQuery() {
  return useQuery({
    queryKey: settingsQueryKeys.apiKeys(),
    queryFn: fetchApiKeys,
    staleTime: 30_000,
  });
}

export function useCreateApiKeyMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ApiKeyCreatePayload) => createApiKey(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsQueryKeys.apiKeys() });
      queryClient.invalidateQueries({ queryKey: settingsQueryKeys.endpoints() });
      queryClient.invalidateQueries({ queryKey: MODEL_CATALOG_QUERY_KEY });
    },
  });
}

export function useRenameApiKeyMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ oldAlias, payload }: { oldAlias: string; payload: ApiKeyRenamePayload }) =>
      renameApiKey(oldAlias, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsQueryKeys.apiKeys() });
      queryClient.invalidateQueries({ queryKey: settingsQueryKeys.endpoints() });
      queryClient.invalidateQueries({ queryKey: MODEL_CATALOG_QUERY_KEY });
    },
  });
}

export function useOverwriteApiKeyMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ alias, payload }: { alias: string; payload: ApiKeyOverwritePayload }) =>
      overwriteApiKey(alias, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsQueryKeys.apiKeys() });
      queryClient.invalidateQueries({ queryKey: settingsQueryKeys.endpoints() });
      queryClient.invalidateQueries({ queryKey: MODEL_CATALOG_QUERY_KEY });
    },
  });
}

export function useDeleteApiKeyMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (alias: string) => deleteApiKey(alias),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsQueryKeys.apiKeys() });
      queryClient.invalidateQueries({ queryKey: settingsQueryKeys.endpoints() });
      queryClient.invalidateQueries({ queryKey: MODEL_CATALOG_QUERY_KEY });
    },
  });
}

// ── Model Roles Mutation ─────────────────────────────────────────────────────

export function useUpdateRoleConfigMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: RoleConfigPayload) => putRoleConfig(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MODEL_CATALOG_QUERY_KEY });
    },
  });
}

// ── Drawers & MCP Queries & Mutations ────────────────────────────────────────

export function useDrawerCatalogQuery() {
  return useQuery({
    queryKey: settingsQueryKeys.drawerCatalog(),
    queryFn: fetchDrawerCatalog,
    staleTime: 60_000,
  });
}

export function usePresetDrawersQuery(presetId: number | null) {
  return useQuery({
    queryKey: settingsQueryKeys.presetDrawers(presetId ?? 0),
    queryFn: () => (presetId ? fetchPresetDrawers(presetId) : Promise.resolve([])),
    enabled: typeof presetId === 'number' && presetId > 0,
    staleTime: 30_000,
  });
}

export function useUpdatePresetDrawerEnabledMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      presetId,
      drawerName,
      enabled,
    }: {
      presetId: number;
      drawerName: string;
      enabled: boolean;
    }) => putPresetDrawerEnabled(presetId, drawerName, enabled),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({
        queryKey: settingsQueryKeys.presetDrawers(vars.presetId),
      });
    },
  });
}

export function useMcpServersQuery() {
  return useQuery({
    queryKey: settingsQueryKeys.mcpServers(),
    queryFn: fetchMcpServers,
    staleTime: 60_000,
  });
}

export function usePresetMcpServersQuery(presetId: number | null) {
  return useQuery({
    queryKey: settingsQueryKeys.presetMcpServers(presetId ?? 0),
    queryFn: () => (presetId ? fetchPresetMcpServers(presetId) : Promise.resolve([])),
    enabled: typeof presetId === 'number' && presetId > 0,
    staleTime: 30_000,
  });
}

export function useUpdatePresetMcpBindingMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      presetId,
      serverName,
      payload,
    }: {
      presetId: number;
      serverName: string;
      payload: PresetMcpBindingPayload;
    }) => putPresetMcpBinding(presetId, serverName, payload),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({
        queryKey: settingsQueryKeys.presetMcpServers(vars.presetId),
      });
      queryClient.invalidateQueries({
        queryKey: settingsQueryKeys.presetDrawers(vars.presetId),
      });
    },
  });
}

export function useMcpCredentialsQuery(_serverName?: string) {
  return useQuery({
    queryKey: settingsQueryKeys.mcpCredentials(_serverName),
    queryFn: () => fetchMcpCredentials(),
    staleTime: 30_000,
  });
}

export function useCreateMcpCredentialMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: McpCredentialCreatePayload) => createMcpCredential(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mcp-credentials'] });
      queryClient.invalidateQueries({ queryKey: ['preset-mcp-servers'] });
      queryClient.invalidateQueries({ queryKey: ['preset-drawers'] });
    },
  });
}

export function useRenameMcpCredentialMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ oldAlias, newAlias }: { oldAlias: string; newAlias: string }) =>
      renameMcpCredential(oldAlias, newAlias),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mcp-credentials'] });
      queryClient.invalidateQueries({ queryKey: ['preset-mcp-servers'] });
      queryClient.invalidateQueries({ queryKey: ['preset-drawers'] });
    },
  });
}

export function useOverwriteMcpCredentialMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ alias, credentialValue }: { alias: string; credentialValue: string }) =>
      overwriteMcpCredential(alias, credentialValue),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mcp-credentials'] });
    },
  });
}

export function useDeleteMcpCredentialMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (alias: string) => deleteMcpCredential(alias),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mcp-credentials'] });
      queryClient.invalidateQueries({ queryKey: ['preset-mcp-servers'] });
      queryClient.invalidateQueries({ queryKey: ['preset-drawers'] });
    },
  });
}

