import { apiFetch } from 'exo-shared/api';
import { AppApiError, contractError, toAppApiError } from '../chat/api';
import type {
  ApiKeyCreatePayload,
  ApiKeyOverwritePayload,
  ApiKeyRenamePayload,
  ApiKeyRow,
  DrawerCatalogItem,
  EndpointPayload,
  EndpointRow,
  McpCredentialCreatePayload,
  McpCredentialItem,
  McpServerItem,
  PresetDrawerItem,
  PresetMcpBindingPayload,
  PresetMcpServerItem,
  RoleConfigPayload,
  SystemConfigPatch,
  SystemConfigRow,
} from './types';

function isPositiveInteger(val: unknown): val is number {
  return typeof val === 'number' && Number.isInteger(val) && val > 0;
}

/**
 * GET /api/core/config/ (ReactSheet §3.1, Plan §3 D9).
 * Validates system configuration envelope.
 */
export async function fetchSystemConfig(): Promise<SystemConfigRow> {
  try {
    const raw = await apiFetch('/api/core/config/', { method: 'GET' });
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      throw contractError('系统配置接口返回格式异常', raw);
    }
    const data = raw as Record<string, unknown>;

    // Validate arrays if present
    if (data.self_check_preset_ids !== undefined) {
      if (!Array.isArray(data.self_check_preset_ids)) {
        throw contractError('自检预设 ID 列表格式异常', raw);
      }
      for (const item of data.self_check_preset_ids) {
        if (!isPositiveInteger(item)) {
          throw contractError('自检预设 ID 列表包含非法 ID', raw);
        }
      }
    }

    if (data.deep_org_preset_ids !== undefined) {
      if (!Array.isArray(data.deep_org_preset_ids)) {
        throw contractError('深度整理预设 ID 列表格式异常', raw);
      }
      for (const item of data.deep_org_preset_ids) {
        if (!isPositiveInteger(item)) {
          throw contractError('深度整理预设 ID 列表包含非法 ID', raw);
        }
      }
    }

    return data as SystemConfigRow;
  } catch (err) {
    throw toAppApiError(err);
  }
}

/**
 * PATCH /api/core/config/ (ReactSheet §3.1, Plan §3 D9).
 * Submits identical, deduplicated arrays of positive integers for both
 * self_check_preset_ids and deep_org_preset_ids. Never sends time fields.
 */
export async function patchSystemConfig(
  patch: SystemConfigPatch,
): Promise<SystemConfigRow> {
  if (!Array.isArray(patch.self_check_preset_ids) || !Array.isArray(patch.deep_org_preset_ids)) {
    throw contractError('配置更新参数必须包含有效的 ID 数组', patch);
  }

  for (const id of patch.self_check_preset_ids) {
    if (!isPositiveInteger(id)) {
      throw contractError('自检预设包含非法 ID', { id });
    }
  }

  for (const id of patch.deep_org_preset_ids) {
    if (!isPositiveInteger(id)) {
      throw contractError('深度整理预设包含非法 ID', { id });
    }
  }

  const payload = {
    self_check_preset_ids: patch.self_check_preset_ids,
    deep_org_preset_ids: patch.deep_org_preset_ids,
  };

  try {
    const raw = await apiFetch('/api/core/config/', {
      method: 'PATCH',
      body: payload,
    });

    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      throw new AppApiError('更新系统配置接口返回数据异常', {
        body: raw,
        code: 'CONTRACT',
        status: 200,
        ambiguousWrite: true,
      });
    }

    return raw as SystemConfigRow;
  } catch (err) {
    if (err instanceof AppApiError) {
      throw err;
    }
    throw toAppApiError(err);
  }
}

// ── Endpoints API ────────────────────────────────────────────────────────────

export function validateEndpointRow(raw: unknown, isWrite = false): EndpointRow {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    if (isWrite) {
      throw new AppApiError('端点写操作接口返回格式异常', {
        body: raw,
        code: 'CONTRACT',
        status: 200,
        ambiguousWrite: true,
      });
    }
    throw contractError('端点数据接口返回格式异常', raw);
  }
  const ep = raw as Record<string, unknown>;
  if (
    !isPositiveInteger(ep.id) ||
    typeof ep.name !== 'string' ||
    typeof ep.provider !== 'string' ||
    (ep.api_key_alias !== null && typeof ep.api_key_alias !== 'string') ||
    typeof ep.enabled !== 'boolean' ||
    typeof ep.configured !== 'boolean' ||
    typeof ep.execution_type !== 'string' ||
    typeof ep.execution_adapter !== 'string'
  ) {
    if (isWrite) {
      throw new AppApiError('端点写操作数据字段缺失或格式异常', {
        body: raw,
        code: 'CONTRACT',
        status: 200,
        ambiguousWrite: true,
      });
    }
    throw contractError('端点数据字段缺失或格式异常', raw);
  }
  return raw as EndpointRow;
}

/**
 * GET /api/core/endpoints/ (ReactSheet §3.5).
 */
export async function fetchEndpoints(): Promise<EndpointRow[]> {
  try {
    const raw = await apiFetch('/api/core/endpoints/', { method: 'GET' });
    if (!Array.isArray(raw)) {
      throw contractError('端点列表必须为数组格式', raw);
    }
    return raw.map((item) => validateEndpointRow(item, false));
  } catch (err) {
    throw toAppApiError(err);
  }
}

/**
 * POST /api/core/endpoints/ (ReactSheet §3.5).
 * Allowlisted fields: name, provider, api_key_alias, enabled.
 */
export async function createEndpoint(payload: EndpointPayload): Promise<EndpointRow> {
  const name = payload.name.trim();
  const provider = payload.provider.trim();
  if (!name || !provider) {
    throw contractError('端点名称和供应商不能为空', payload);
  }

  const body = {
    name,
    provider,
    api_key_alias: payload.api_key_alias?.trim() || null,
    enabled: Boolean(payload.enabled),
  };

  try {
    const raw = await apiFetch('/api/core/endpoints/', {
      method: 'POST',
      body,
    });
    return validateEndpointRow(raw, true);
  } catch (err) {
    throw toAppApiError(err);
  }
}

/**
 * PATCH /api/core/endpoints/<id>/ (ReactSheet §3.5).
 * Allowlisted fields: name, provider, api_key_alias, enabled.
 */
export async function patchEndpoint(
  id: number,
  payload: Partial<EndpointPayload>,
): Promise<EndpointRow> {
  if (!isPositiveInteger(id)) {
    throw contractError('非法端点 ID', { id });
  }

  const body: Partial<EndpointPayload> = {};
  if (payload.name !== undefined) body.name = payload.name.trim();
  if (payload.provider !== undefined) body.provider = payload.provider.trim();
  if (payload.api_key_alias !== undefined) {
    body.api_key_alias = payload.api_key_alias ? payload.api_key_alias.trim() : null;
  }
  if (payload.enabled !== undefined) body.enabled = Boolean(payload.enabled);

  try {
    const raw = await apiFetch(`/api/core/endpoints/${id}/`, {
      method: 'PATCH',
      body,
    });
    return validateEndpointRow(raw, true);
  } catch (err) {
    throw toAppApiError(err);
  }
}

/**
 * DELETE /api/core/endpoints/<id>/ (ReactSheet §3.5).
 * 409 conflict preserves the row with actionable error.
 */
export async function deleteEndpoint(id: number): Promise<void> {
  if (!isPositiveInteger(id)) {
    throw contractError('非法端点 ID', { id });
  }

  try {
    await apiFetch(`/api/core/endpoints/${id}/`, {
      method: 'DELETE',
    });
  } catch (err) {
    throw toAppApiError(err);
  }
}

// ── ApiKeys API ──────────────────────────────────────────────────────────────

export function validateApiKeyRow(raw: unknown, isWrite = false): ApiKeyRow {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    if (isWrite) {
      throw new AppApiError('API Key 写操作接口返回格式异常', {
        body: raw,
        code: 'CONTRACT',
        status: 200,
        ambiguousWrite: true,
      });
    }
    throw contractError('API Key 接口返回格式异常', raw);
  }
  const key = raw as Record<string, unknown>;
  if (
    typeof key.alias !== 'string' ||
    !key.alias.trim() ||
    typeof key.platform !== 'string' ||
    typeof key.last_four !== 'string'
  ) {
    if (isWrite) {
      throw new AppApiError('API Key 写操作字段缺失或格式异常', {
        body: raw,
        code: 'CONTRACT',
        status: 200,
        ambiguousWrite: true,
      });
    }
    throw contractError('API Key 字段缺失或格式异常', raw);
  }
  return {
    alias: key.alias,
    platform: key.platform,
    last_four: key.last_four,
    created_at: typeof key.created_at === 'string' ? key.created_at : '',
    updated_at: typeof key.updated_at === 'string' ? key.updated_at : '',
  };
}

/**
 * GET /api/core/apikeys/ (ReactSheet §3.6).
 * Returns single all-list query; grouping is derived on frontend.
 */
export async function fetchApiKeys(): Promise<ApiKeyRow[]> {
  try {
    const raw = await apiFetch('/api/core/apikeys/', { method: 'GET' });
    if (!Array.isArray(raw)) {
      throw contractError('API Key 列表必须为数组格式', raw);
    }
    return raw.map((item) => validateApiKeyRow(item, false));
  } catch (err) {
    throw toAppApiError(err);
  }
}

/**
 * POST /api/core/apikeys/ (ReactSheet §3.6).
 * Requires platform, alias, key_value. key_value is write-only.
 */
export async function createApiKey(payload: ApiKeyCreatePayload): Promise<ApiKeyRow> {
  const alias = payload.alias.trim();
  const platform = payload.platform.trim();
  const keyValue = payload.key_value.trim();

  if (!alias || !platform || !keyValue) {
    throw contractError('别名、平台和密钥内容均为必填项', { alias, platform });
  }

  try {
    const raw = await apiFetch('/api/core/apikeys/', {
      method: 'POST',
      body: { alias, platform, key_value: keyValue },
    });
    return validateApiKeyRow(raw, true);
  } catch (err) {
    throw toAppApiError(err);
  }
}

/**
 * PATCH /api/core/apikeys/<encoded_alias>/ (ReactSheet §3.6).
 * Only alias is writable.
 */
export async function renameApiKey(
  oldAlias: string,
  payload: ApiKeyRenamePayload,
): Promise<ApiKeyRow> {
  const newAlias = payload.alias.trim();
  if (!newAlias) {
    throw contractError('新别名不能为空', payload);
  }

  try {
    const raw = await apiFetch(`/api/core/apikeys/${encodeURIComponent(oldAlias)}/`, {
      method: 'PATCH',
      body: { alias: newAlias },
    });
    return validateApiKeyRow(raw, true);
  } catch (err) {
    throw toAppApiError(err);
  }
}

/**
 * PUT /api/core/apikeys/<encoded_alias>/overwrite/ (ReactSheet §3.6).
 * Overwrite key_value.
 */
export async function overwriteApiKey(
  alias: string,
  payload: ApiKeyOverwritePayload,
): Promise<ApiKeyRow> {
  const keyValue = payload.key_value.trim();
  if (!keyValue) {
    throw contractError('密钥内容不能为空', { alias });
  }

  try {
    const raw = await apiFetch(
      `/api/core/apikeys/${encodeURIComponent(alias)}/overwrite/`,
      {
        method: 'PUT',
        body: { key_value: keyValue },
      },
    );
    return validateApiKeyRow(raw, true);
  } catch (err) {
    throw toAppApiError(err);
  }
}

/**
 * DELETE /api/core/apikeys/<encoded_alias>/ (ReactSheet §3.6).
 */
export async function deleteApiKey(alias: string): Promise<void> {
  try {
    await apiFetch(`/api/core/apikeys/${encodeURIComponent(alias)}/`, {
      method: 'DELETE',
    });
  } catch (err) {
    throw toAppApiError(err);
  }
}

// ── Model Roles API ──────────────────────────────────────────────────────────

/**
 * PUT /api/core/config/roles/ (ReactSheet §3.7).
 * Whole-packet PUT replacing role configurations.
 */
export async function putRoleConfig(
  payload: RoleConfigPayload,
): Promise<RoleConfigPayload> {
  if (!Array.isArray(payload.main) || payload.main.length < 1) {
    throw contractError('至少需要配置一个主模型角色 (main role)', payload);
  }
  if (!payload.support || typeof payload.support !== 'object') {
    throw contractError('缺少辅助模型角色 (support roles) 配置', payload);
  }

  const cleanBody: RoleConfigPayload = {
    main: payload.main.map((m, idx) => ({
      model: m.model.trim(),
      default_endpoint: m.default_endpoint,
      style_shadow: m.style_shadow?.trim() || null,
      position: typeof m.position === 'number' ? m.position : idx,
    })),
    support: {
      general_sub_agent: {
        model: payload.support.general_sub_agent.model.trim(),
        default_endpoint: payload.support.general_sub_agent.default_endpoint,
      },
      vision_helper: {
        model: payload.support.vision_helper.model.trim(),
        default_endpoint: payload.support.vision_helper.default_endpoint,
      },
      grounding: {
        model: payload.support.grounding.model.trim(),
        default_endpoint: payload.support.grounding.default_endpoint,
      },
      image_gen: {
        model: payload.support.image_gen.model.trim(),
        default_endpoint: payload.support.image_gen.default_endpoint,
      },
    },
  };

  try {
    const raw = await apiFetch('/api/core/config/roles/', {
      method: 'PUT',
      body: cleanBody,
    });
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      throw new AppApiError('更新角色配置接口返回数据异常', {
        body: raw,
        code: 'CONTRACT',
        status: 200,
        ambiguousWrite: true,
      });
    }

    const data = raw as Record<string, unknown>;
    const isSupportBinding = (b: unknown): boolean =>
      typeof b === 'object' &&
      b !== null &&
      typeof (b as { model?: unknown }).model === 'string' &&
      Boolean((b as { model: string }).model.trim()) &&
      isPositiveInteger((b as { default_endpoint?: unknown }).default_endpoint);

    const isMainRoleValid =
      Array.isArray(data.main) &&
      data.main.length > 0 &&
      data.main.every(
        (m: unknown) =>
          typeof m === 'object' &&
          m !== null &&
          typeof (m as { model?: unknown }).model === 'string' &&
          Boolean((m as { model: string }).model.trim()) &&
          isPositiveInteger((m as { default_endpoint?: unknown }).default_endpoint),
      );

    const support = data.support as Record<string, unknown> | undefined;
    const isSupportRoleValid =
      typeof support === 'object' &&
      support !== null &&
      isSupportBinding(support.general_sub_agent) &&
      isSupportBinding(support.vision_helper) &&
      isSupportBinding(support.grounding) &&
      isSupportBinding(support.image_gen);

    if (!isMainRoleValid || !isSupportRoleValid) {
      throw new AppApiError('更新角色配置接口返回字段缺失或格式异常', {
        body: raw,
        code: 'CONTRACT',
        status: 200,
        ambiguousWrite: true,
      });
    }

    return raw as RoleConfigPayload;
  } catch (err) {
    throw toAppApiError(err);
  }
}

/**
 * Extracts the most human-readable message from DRF or transport errors.
 */
export function getErrorMessage(err: unknown): string {
  const appErr = toAppApiError(err);
  if (appErr.fieldErrors.detail) return appErr.fieldErrors.detail;
  if (appErr.fieldErrors.non_field_errors) return appErr.fieldErrors.non_field_errors;
  const firstField = Object.values(appErr.fieldErrors)[0];
  if (firstField) return firstField;
  const body = appErr.body as Record<string, unknown> | null;
  if (body && typeof body === 'object' && body.error && typeof body.error === 'object') {
    const subError = body.error as Record<string, unknown>;
    if (typeof subError.message === 'string') return subError.message;
    if (typeof subError.code === 'string') return subError.code;
  }
  return appErr.message;
}

// ── Drawers & MCP Credentials API ────────────────────────────────────────────

const VALID_STRATEGIES = ['none', 'shared', 'per_preset', 'shared_or_per_preset'] as const;
const VALID_RESOLVED_SOURCES = ['public', 'preset', 'none'] as const;

export function validateDrawerCatalog(raw: unknown): DrawerCatalogItem[] {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw contractError('抽屉目录接口返回格式异常', raw);
  }
  const data = raw as Record<string, unknown>;
  if (!Array.isArray(data.drawers)) {
    throw contractError('抽屉目录缺少 drawers 数组', raw);
  }
  const drawers = data.drawers.map((d: unknown) => {
    if (typeof d !== 'object' || d === null || Array.isArray(d)) {
      throw contractError('抽屉目录包含非法抽屉项', raw);
    }
    const item = d as Record<string, unknown>;
    if (
      typeof item.name !== 'string' ||
      !item.name.trim() ||
      typeof item.display_name !== 'string' ||
      typeof item.server_name !== 'string' ||
      typeof item.available !== 'boolean' ||
      typeof item.credential_required !== 'boolean' ||
      typeof item.credential_strategy !== 'string' ||
      !VALID_STRATEGIES.includes(item.credential_strategy as (typeof VALID_STRATEGIES)[number])
    ) {
      throw contractError('抽屉目录项字段格式异常', raw);
    }
    return {
      name: item.name,
      display_name: item.display_name,
      description: typeof item.description === 'string' ? item.description : '',
      server_name: item.server_name,
      available: item.available,
      credential_strategy: item.credential_strategy as DrawerCatalogItem['credential_strategy'],
      credential_required: item.credential_required,
    };
  });
  return drawers;
}

export function validatePresetDrawers(raw: unknown, presetId: number): PresetDrawerItem[] {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw contractError('预设抽屉矩阵接口返回格式异常', raw);
  }
  const data = raw as Record<string, unknown>;
  if (data.preset_id !== presetId || !Array.isArray(data.drawers)) {
    throw contractError('预设抽屉矩阵 preset_id 不匹配或缺少 drawers 数组', raw);
  }
  return data.drawers.map((d: unknown) => {
    if (typeof d !== 'object' || d === null || Array.isArray(d)) {
      throw contractError('预设抽屉矩阵包含非法抽屉项', raw);
    }
    const item = d as Record<string, unknown>;
    if (
      typeof item.name !== 'string' ||
      !item.name.trim() ||
      typeof item.available !== 'boolean' ||
      typeof item.enabled !== 'boolean' ||
      typeof item.credential_ready !== 'boolean' ||
      typeof item.credential_required !== 'boolean' ||
      typeof item.credential_strategy !== 'string' ||
      !VALID_STRATEGIES.includes(item.credential_strategy as (typeof VALID_STRATEGIES)[number]) ||
      (item.credential_mode !== null &&
        item.credential_mode !== undefined &&
        item.credential_mode !== 'dedicated' &&
        item.credential_mode !== 'inherit_public') ||
      (item.credential_alias !== null &&
        item.credential_alias !== undefined &&
        typeof item.credential_alias !== 'string')
    ) {
      throw contractError('预设抽屉矩阵项字段格式异常', raw);
    }
    return {
      name: item.name,
      display_name: typeof item.display_name === 'string' ? item.display_name : item.name,
      server_name: typeof item.server_name === 'string' ? item.server_name : item.name,
      available: item.available,
      enabled: item.enabled,
      credential_strategy: item.credential_strategy as DrawerCatalogItem['credential_strategy'],
      credential_required: item.credential_required,
      credential_mode: item.credential_mode ?? null,
      credential_alias: item.credential_alias ?? null,
      credential_ready: item.credential_ready,
    };
  });
}

export function validateMcpCredentials(raw: unknown): McpCredentialItem[] {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw contractError('MCP 凭证列表接口返回格式异常', raw);
  }
  const data = raw as Record<string, unknown>;
  if (!Array.isArray(data.credentials)) {
    throw contractError('MCP 凭证列表缺少 credentials 数组', raw);
  }
  return data.credentials.map((c: unknown) => {
    if (typeof c !== 'object' || c === null || Array.isArray(c)) {
      throw contractError('MCP 凭证列表包含非法凭证项', raw);
    }
    const item = c as Record<string, unknown>;
    // Fail-closed invariant: secret must NEVER appear in response
    if ('credential_value' in item || 'secret' in item || 'raw_secret' in item) {
      throw new AppApiError('MCP 凭证响应包含意外的机密字段', { code: 'CONTRACT' });
    }
    if (
      typeof item.alias !== 'string' ||
      !item.alias.trim() ||
      typeof item.server_name !== 'string' ||
      typeof item.last_four !== 'string'
    ) {
      throw contractError('MCP 凭证项字段格式异常', raw);
    }
    return {
      alias: item.alias,
      server_name: item.server_name,
      last_four: item.last_four,
      created_at: typeof item.created_at === 'string' ? item.created_at : '',
      updated_at: typeof item.updated_at === 'string' ? item.updated_at : '',
    };
  });
}

export function validateMcpServers(raw: unknown): McpServerItem[] {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw contractError('MCP 服务器列表接口返回格式异常', raw);
  }
  const data = raw as Record<string, unknown>;
  if (!Array.isArray(data.servers)) {
    throw contractError('MCP 服务器列表缺少 servers 数组', raw);
  }
  return data.servers.map((s: unknown) => {
    if (typeof s !== 'object' || s === null || Array.isArray(s)) {
      throw contractError('MCP 服务器列表包含非法服务器项', raw);
    }
    const item = s as Record<string, unknown>;
    if (
      typeof item.name !== 'string' ||
      !item.name.trim() ||
      typeof item.display_name !== 'string' ||
      typeof item.available !== 'boolean' ||
      typeof item.credential_required !== 'boolean' ||
      typeof item.credential_strategy !== 'string' ||
      !VALID_STRATEGIES.includes(item.credential_strategy as (typeof VALID_STRATEGIES)[number]) ||
      typeof item.public_credential_configured !== 'boolean' ||
      (item.public_credential_alias !== null &&
        item.public_credential_alias !== undefined &&
        typeof item.public_credential_alias !== 'string')
    ) {
      throw contractError('MCP 服务器项字段格式异常', raw);
    }
    return {
      name: item.name,
      display_name: item.display_name,
      available: item.available,
      credential_strategy: item.credential_strategy as DrawerCatalogItem['credential_strategy'],
      credential_required: item.credential_required,
      public_credential_alias: item.public_credential_alias ?? null,
      public_credential_configured: item.public_credential_configured,
    };
  });
}

export function validatePresetMcpServers(raw: unknown, presetId: number): PresetMcpServerItem[] {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw contractError('预设 MCP 凭证状态接口返回格式异常', raw);
  }
  const data = raw as Record<string, unknown>;
  if (data.preset_id !== presetId || !Array.isArray(data.servers)) {
    throw contractError('预设 MCP 状态 preset_id 不匹配或缺少 servers 数组', raw);
  }
  return data.servers.map((s: unknown) => {
    if (typeof s !== 'object' || s === null || Array.isArray(s)) {
      throw contractError('预设 MCP 状态包含非法项', raw);
    }
    const item = s as Record<string, unknown>;
    if (
      typeof item.server_name !== 'string' ||
      !item.server_name.trim() ||
      typeof item.credential_ready !== 'boolean' ||
      typeof item.credential_required !== 'boolean' ||
      typeof item.credential_strategy !== 'string' ||
      !VALID_STRATEGIES.includes(item.credential_strategy as (typeof VALID_STRATEGIES)[number]) ||
      (item.mode !== null &&
        item.mode !== undefined &&
        item.mode !== 'dedicated' &&
        item.mode !== 'inherit_public') ||
      typeof item.resolved_source !== 'string' ||
      !VALID_RESOLVED_SOURCES.includes(item.resolved_source as (typeof VALID_RESOLVED_SOURCES)[number]) ||
      (item.credential_alias !== null &&
        item.credential_alias !== undefined &&
        typeof item.credential_alias !== 'string') ||
      (item.resolved_alias !== null &&
        item.resolved_alias !== undefined &&
        typeof item.resolved_alias !== 'string')
    ) {
      throw contractError('预设 MCP 状态项字段格式异常', raw);
    }
    return {
      server_name: item.server_name,
      credential_strategy: item.credential_strategy as DrawerCatalogItem['credential_strategy'],
      credential_required: item.credential_required,
      mode: item.mode ?? null,
      credential_alias: item.credential_alias ?? null,
      resolved_source: item.resolved_source as PresetMcpServerItem['resolved_source'],
      resolved_alias: item.resolved_alias ?? null,
      credential_ready: item.credential_ready,
    };
  });
}

/**
 * GET /api/agents/drawers/ (ReactSheet §10.1).
 */
export async function fetchDrawerCatalog(): Promise<DrawerCatalogItem[]> {
  try {
    const raw = await apiFetch('/api/agents/drawers/', { method: 'GET' });
    return validateDrawerCatalog(raw);
  } catch (err) {
    throw toAppApiError(err);
  }
}

/**
 * GET /api/agents/presets/<id>/drawers/ (ReactSheet §10.2).
 */
export async function fetchPresetDrawers(presetId: number): Promise<PresetDrawerItem[]> {
  if (!isPositiveInteger(presetId)) {
    throw contractError('非法预设 ID', { presetId });
  }
  try {
    const raw = await apiFetch(`/api/agents/presets/${presetId}/drawers/`, { method: 'GET' });
    return validatePresetDrawers(raw, presetId);
  } catch (err) {
    throw toAppApiError(err);
  }
}

/**
 * PUT /api/agents/presets/<id>/drawers/<drawer_name>/ (ReactSheet §10.2).
 */
export async function putPresetDrawerEnabled(
  presetId: number,
  drawerName: string,
  enabled: boolean,
): Promise<PresetDrawerItem> {
  if (!isPositiveInteger(presetId)) {
    throw contractError('非法预设 ID', { presetId });
  }
  const cleanName = drawerName.trim();
  if (!cleanName) {
    throw contractError('缺少抽屉名称', { drawerName });
  }

  try {
    const raw = await apiFetch(`/api/agents/presets/${presetId}/drawers/${encodeURIComponent(cleanName)}/`, {
      method: 'PUT',
      body: { enabled: Boolean(enabled) },
    });
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      throw new AppApiError('更新预设抽屉授权接口返回数据异常', {
        body: raw,
        code: 'CONTRACT',
        status: 200,
        ambiguousWrite: true,
      });
    }
    const item = raw as Record<string, unknown>;
    if (typeof item.enabled !== 'boolean') {
      throw new AppApiError('更新预设抽屉授权接口未返回有效 enabled 状态', {
        body: raw,
        code: 'CONTRACT',
        status: 200,
        ambiguousWrite: true,
      });
    }
    return {
      name: typeof item.name === 'string' ? item.name : cleanName,
      display_name: typeof item.display_name === 'string' ? item.display_name : cleanName,
      server_name: typeof item.server_name === 'string' ? item.server_name : cleanName,
      available: typeof item.available === 'boolean' ? item.available : true,
      enabled: item.enabled,
      credential_strategy: (item.credential_strategy as DrawerCatalogItem['credential_strategy']) || 'none',
      credential_required: Boolean(item.credential_required),
      credential_mode: item.credential_mode === 'dedicated' || item.credential_mode === 'inherit_public' ? item.credential_mode : null,
      credential_alias: typeof item.credential_alias === 'string' ? item.credential_alias : null,
      credential_ready: Boolean(item.credential_ready),
    };
  } catch (err) {
    throw toAppApiError(err);
  }
}

/**
 * GET /api/agents/mcp-credentials/ (ReactSheet §10.3).
 */
export async function fetchMcpCredentials(serverName?: string): Promise<McpCredentialItem[]> {
  const url = serverName && serverName.trim()
    ? `/api/agents/mcp-credentials/?server_name=${encodeURIComponent(serverName.trim())}`
    : '/api/agents/mcp-credentials/';
  try {
    const raw = await apiFetch(url, { method: 'GET' });
    return validateMcpCredentials(raw);
  } catch (err) {
    throw toAppApiError(err);
  }
}

/**
 * POST /api/agents/mcp-credentials/ (ReactSheet §10.3).
 * Submits secret verbatim without trimming.
 */
export async function createMcpCredential(
  payload: McpCredentialCreatePayload,
): Promise<McpCredentialItem> {
  const cleanAlias = payload.alias.trim();
  if (!cleanAlias) {
    throw contractError('缺少凭证别名', payload);
  }
  if (cleanAlias.includes('/')) {
    throw contractError('凭证别名不能包含斜杠 /', payload);
  }
  const cleanServer = payload.server_name.trim();
  if (!cleanServer) {
    throw contractError('缺少 MCP 服务器名称', payload);
  }
  if (!payload.credential_value) {
    throw contractError('缺少凭证机密值', { alias: cleanAlias, server_name: cleanServer });
  }

  try {
    const raw = await apiFetch('/api/agents/mcp-credentials/', {
      method: 'POST',
      body: {
        alias: cleanAlias,
        server_name: cleanServer,
        credential_value: payload.credential_value, // Verbatim, never trimmed
      },
    });
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      throw new AppApiError('创建 MCP 凭证接口返回数据异常', {
        body: raw,
        code: 'CONTRACT',
        status: 200,
        ambiguousWrite: true,
      });
    }
    const item = raw as Record<string, unknown>;
    if ('credential_value' in item || 'secret' in item || 'raw_secret' in item) {
      throw new AppApiError('创建 MCP 凭证响应意外包含机密字段', {
        body: raw,
        code: 'CONTRACT',
        status: 200,
        ambiguousWrite: true,
      });
    }
    if (
      typeof item.alias !== 'string' ||
      !item.alias.trim() ||
      typeof item.server_name !== 'string' ||
      typeof item.last_four !== 'string'
    ) {
      throw new AppApiError('创建 MCP 凭证接口未返回完整凭证信息', {
        body: raw,
        code: 'CONTRACT',
        status: 200,
        ambiguousWrite: true,
      });
    }
    return {
      alias: item.alias,
      server_name: item.server_name,
      last_four: item.last_four,
      created_at: typeof item.created_at === 'string' ? item.created_at : '',
      updated_at: typeof item.updated_at === 'string' ? item.updated_at : '',
    };
  } catch (err) {
    throw toAppApiError(err);
  }
}

/**
 * PATCH /api/agents/mcp-credentials/<alias>/ (ReactSheet §10.3).
 * Renames alias only.
 */
export async function renameMcpCredential(
  oldAlias: string,
  newAlias: string,
): Promise<McpCredentialItem> {
  const cleanOld = oldAlias.trim();
  const cleanNew = newAlias.trim();
  if (!cleanOld || !cleanNew) {
    throw contractError('别名不能为空', { oldAlias, newAlias });
  }
  if (cleanNew.includes('/')) {
    throw contractError('凭证别名不能包含斜杠 /', { oldAlias, newAlias });
  }

  try {
    const raw = await apiFetch(`/api/agents/mcp-credentials/${encodeURIComponent(cleanOld)}/`, {
      method: 'PATCH',
      body: { alias: cleanNew },
    });
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      throw new AppApiError('重命名 MCP 凭证接口返回数据异常', {
        body: raw,
        code: 'CONTRACT',
        status: 200,
        ambiguousWrite: true,
      });
    }
    const item = raw as Record<string, unknown>;
    if ('credential_value' in item || 'secret' in item || 'raw_secret' in item) {
      throw new AppApiError('重命名 MCP 凭证响应意外包含机密字段', {
        body: raw,
        code: 'CONTRACT',
        status: 200,
        ambiguousWrite: true,
      });
    }
    if (typeof item.alias !== 'string' || !item.alias.trim()) {
      throw new AppApiError('重命名 MCP 凭证接口未返回有效别名', {
        body: raw,
        code: 'CONTRACT',
        status: 200,
        ambiguousWrite: true,
      });
    }
    return {
      alias: item.alias,
      server_name: typeof item.server_name === 'string' ? item.server_name : '',
      last_four: typeof item.last_four === 'string' ? item.last_four : '',
      created_at: typeof item.created_at === 'string' ? item.created_at : '',
      updated_at: typeof item.updated_at === 'string' ? item.updated_at : '',
    };
  } catch (err) {
    throw toAppApiError(err);
  }
}

/**
 * PUT /api/agents/mcp-credentials/<alias>/overwrite/ (ReactSheet §10.3).
 * Updates secret verbatim without trimming.
 */
export async function overwriteMcpCredential(
  alias: string,
  credentialValue: string,
): Promise<McpCredentialItem> {
  const cleanAlias = alias.trim();
  if (!cleanAlias) {
    throw contractError('缺少凭证别名', { alias });
  }
  if (!credentialValue) {
    throw contractError('缺少凭证机密值', { alias: cleanAlias });
  }

  try {
    const raw = await apiFetch(`/api/agents/mcp-credentials/${encodeURIComponent(cleanAlias)}/overwrite/`, {
      method: 'PUT',
      body: { credential_value: credentialValue }, // Verbatim, never trimmed
    });
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      throw new AppApiError('覆写 MCP 凭证接口返回数据异常', {
        body: raw,
        code: 'CONTRACT',
        status: 200,
        ambiguousWrite: true,
      });
    }
    const item = raw as Record<string, unknown>;
    if ('credential_value' in item || 'secret' in item || 'raw_secret' in item) {
      throw new AppApiError('覆写 MCP 凭证响应意外包含机密字段', {
        body: raw,
        code: 'CONTRACT',
        status: 200,
        ambiguousWrite: true,
      });
    }
    if (typeof item.last_four !== 'string') {
      throw new AppApiError('覆写 MCP 凭证接口未返回有效 last_four 提示', {
        body: raw,
        code: 'CONTRACT',
        status: 200,
        ambiguousWrite: true,
      });
    }
    return {
      alias: typeof item.alias === 'string' ? item.alias : cleanAlias,
      server_name: typeof item.server_name === 'string' ? item.server_name : '',
      last_four: item.last_four,
      created_at: typeof item.created_at === 'string' ? item.created_at : '',
      updated_at: typeof item.updated_at === 'string' ? item.updated_at : '',
    };
  } catch (err) {
    throw toAppApiError(err);
  }
}

/**
 * DELETE /api/agents/mcp-credentials/<alias>/ (ReactSheet §10.3).
 */
export async function deleteMcpCredential(alias: string): Promise<void> {
  const cleanAlias = alias.trim();
  if (!cleanAlias) {
    throw contractError('缺少凭证别名', { alias });
  }
  try {
    await apiFetch(`/api/agents/mcp-credentials/${encodeURIComponent(cleanAlias)}/`, {
      method: 'DELETE',
    });
  } catch (err) {
    throw toAppApiError(err);
  }
}

/**
 * GET /api/agents/mcp-servers/ (ReactSheet §10.4).
 */
export async function fetchMcpServers(): Promise<McpServerItem[]> {
  try {
    const raw = await apiFetch('/api/agents/mcp-servers/', { method: 'GET' });
    return validateMcpServers(raw);
  } catch (err) {
    throw toAppApiError(err);
  }
}

/**
 * GET /api/agents/presets/<id>/mcp-credentials/ (ReactSheet §10.5).
 */
export async function fetchPresetMcpServers(presetId: number): Promise<PresetMcpServerItem[]> {
  if (!isPositiveInteger(presetId)) {
    throw contractError('非法预设 ID', { presetId });
  }
  try {
    const raw = await apiFetch(`/api/agents/presets/${presetId}/mcp-credentials/`, { method: 'GET' });
    return validatePresetMcpServers(raw, presetId);
  } catch (err) {
    throw toAppApiError(err);
  }
}

/**
 * PUT /api/agents/presets/<id>/mcp-credentials/<server_name>/ (ReactSheet §10.5).
 */
export async function putPresetMcpBinding(
  presetId: number,
  serverName: string,
  payload: PresetMcpBindingPayload,
): Promise<PresetMcpServerItem> {
  if (!isPositiveInteger(presetId)) {
    throw contractError('非法预设 ID', { presetId });
  }
  const cleanServer = serverName.trim();
  if (!cleanServer) {
    throw contractError('缺少服务器名称', { serverName });
  }

  const cleanBody = {
    mode: payload.mode,
    credential_alias: payload.credential_alias ? payload.credential_alias.trim() : null,
  };

  try {
    const raw = await apiFetch(
      `/api/agents/presets/${presetId}/mcp-credentials/${encodeURIComponent(cleanServer)}/`,
      {
        method: 'PUT',
        body: cleanBody,
      },
    );
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      throw new AppApiError('更新预设 MCP 凭证绑定接口返回数据异常', {
        body: raw,
        code: 'CONTRACT',
        status: 200,
        ambiguousWrite: true,
      });
    }
    const item = raw as Record<string, unknown>;
    if (
      typeof item.credential_ready !== 'boolean' ||
      typeof item.credential_required !== 'boolean' ||
      typeof item.credential_strategy !== 'string' ||
      !VALID_STRATEGIES.includes(item.credential_strategy as (typeof VALID_STRATEGIES)[number]) ||
      (item.mode !== null && item.mode !== undefined && item.mode !== 'dedicated' && item.mode !== 'inherit_public') ||
      typeof item.resolved_source !== 'string' ||
      !VALID_RESOLVED_SOURCES.includes(item.resolved_source as (typeof VALID_RESOLVED_SOURCES)[number]) ||
      (item.credential_alias !== null && item.credential_alias !== undefined && typeof item.credential_alias !== 'string') ||
      (item.resolved_alias !== null && item.resolved_alias !== undefined && typeof item.resolved_alias !== 'string')
    ) {
      throw new AppApiError('更新预设 MCP 凭证绑定未返回有效字段结构', {
        body: raw,
        code: 'CONTRACT',
        status: 200,
        ambiguousWrite: true,
      });
    }
    return {
      server_name: typeof item.server_name === 'string' ? item.server_name : cleanServer,
      credential_strategy: item.credential_strategy as DrawerCatalogItem['credential_strategy'],
      credential_required: item.credential_required,
      mode: item.mode ?? null,
      credential_alias: item.credential_alias ?? null,
      resolved_source: item.resolved_source as PresetMcpServerItem['resolved_source'],
      resolved_alias: item.resolved_alias ?? null,
      credential_ready: item.credential_ready,
    };
  } catch (err) {
    throw toAppApiError(err);
  }
}

