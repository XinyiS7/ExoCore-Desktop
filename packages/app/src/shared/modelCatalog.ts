import { apiFetch } from 'exo-shared/api';
import type { ModelCatalog, ModelCatalogProvider } from 'exo-shared/models';
import { useQuery } from '@tanstack/react-query';
import { AppApiError } from '../features/chat/api';

export const MODEL_CATALOG_QUERY_KEY = ['model-catalog'] as const;

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}


/**
 * Enhanced selector-facing validation for ModelCatalog.
 * Validates models, endpoints (including execution fields), roles (main >= 1 and 4 support roles),
 * and providers metadata. Malformed catalog responses are never admitted as truth.
 */
export function validateModelCatalog(raw: unknown): ModelCatalog {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new AppApiError('模型目录接口返回格式异常', { body: raw, code: 'CONTRACT' });
  }

  const catalog = raw as Partial<ModelCatalog>;

  if (
    !Array.isArray(catalog.models) ||
    !Array.isArray(catalog.endpoints) ||
    typeof catalog.roles !== 'object' ||
    catalog.roles === null ||
    !Array.isArray(catalog.roles.main)
  ) {
    throw new AppApiError('模型目录接口缺少 models、endpoints 或 main roles', { body: raw, code: 'CONTRACT' });
  }

  // Models validation
  const modelsValid = catalog.models.every(
    (model) =>
      typeof model?.name === 'string' &&
      model.name.trim().length > 0 &&
      Array.isArray(model.abilities) &&
      model.abilities.every((ability) => typeof ability === 'string') &&
      Array.isArray(model.compatible_endpoint_ids) &&
      model.compatible_endpoint_ids.every(isPositiveInteger),
  );

const REQUIRED_SUPPORT_ROLES = [
  'general_sub_agent',
  'vision_helper',
  'grounding',
  'image_gen',
] as const;

  // Endpoints validation (including required execution fields)
  const endpointsValid = catalog.endpoints.every(
    (endpoint) =>
      isPositiveInteger(endpoint?.id) &&
      typeof endpoint.name === 'string' &&
      endpoint.name.trim().length > 0 &&
      typeof endpoint.configured === 'boolean' &&
      typeof endpoint.enabled === 'boolean' &&
      typeof endpoint.execution_type === 'string' &&
      endpoint.execution_type.trim().length > 0 &&
      typeof endpoint.execution_adapter === 'string' &&
      endpoint.execution_adapter.trim().length > 0 &&
      Array.isArray(endpoint.attachment_transports) &&
      endpoint.attachment_transports.every((transport) => typeof transport === 'string'),
  );

  // Main roles validation (at least 1 main role required)
  const mainRolesValid =
    catalog.roles.main.length >= 1 &&
    catalog.roles.main.every(
      (role) =>
        typeof role?.model === 'string' &&
        role.model.trim().length > 0 &&
        isPositiveInteger(role.default_endpoint),
    );

  // Support roles validation (all 4 canonical roles must be present and valid)
  let supportRolesValid = true;
  if (!catalog.roles?.support || typeof catalog.roles.support !== 'object' || Array.isArray(catalog.roles.support)) {
    supportRolesValid = false;
  } else {
    for (const key of REQUIRED_SUPPORT_ROLES) {
      const item = catalog.roles.support[key];
      if (
        !item ||
        typeof item !== 'object' ||
        typeof item.model !== 'string' ||
        item.model.trim().length === 0 ||
        !isPositiveInteger(item.default_endpoint)
      ) {
        supportRolesValid = false;
        break;
      }
    }
  }

  // Providers validation (providers array must be present and non-empty with valid descriptors)
  const providersValid =
    Array.isArray(catalog.providers) &&
    catalog.providers.every(
      (provider: ModelCatalogProvider) =>
        (typeof provider?.id === 'string' || typeof provider?.id === 'number') &&
        typeof provider.display_name === 'string' &&
        provider.display_name.trim().length > 0 &&
        typeof provider.execution_type === 'string' &&
        provider.execution_type.trim().length > 0,
    );

  if (!modelsValid || !endpointsValid || !mainRolesValid || !supportRolesValid || !providersValid) {
    throw new AppApiError('模型目录包含无效或缺失的模型、端点、角色或供应商条目', { body: raw, code: 'CONTRACT' });
  }

  return catalog as ModelCatalog;
}

/**
 * Fetch the live model catalog through same-origin API.
 */
export async function fetchModelCatalog(): Promise<ModelCatalog> {
  const raw: unknown = await apiFetch('/api/core/model-catalog/', { method: 'GET' });
  return validateModelCatalog(raw);
}

/**
 * Shared model catalog query hook.
 * Shared between Chat/audio, HUD, Settings (Keys, Endpoints, Model Roles).
 */
export function useModelCatalogQuery() {
  return useQuery({
    queryKey: MODEL_CATALOG_QUERY_KEY,
    queryFn: fetchModelCatalog,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
