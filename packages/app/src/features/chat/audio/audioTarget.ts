import { resolveInitialSessionTarget, type ModelCatalog } from 'exo-shared/models';
import { apiFetch } from 'exo-shared/api';
import { useQuery } from '@tanstack/react-query';
import { AppApiError } from '../api';
import type { AudioTarget } from '../attachments/types';

/**
 * P1C Automatic Audio Target Gate (Task 3, §5.4).
 *
 * Resolves the CURRENT Conversation preset's `default_model` through the
 * live model catalog and validates that the resolved endpoint supports audio
 * (`audio` ability + `file_uri` attachment transport). It deliberately adds
 * NO selection UI — the target is automatic until P1D.
 *
 * Target statuses are explicit and retryable; a failure only disables
 * recording/audio upload, never text or ordinary file attachment flows.
 */

export type AudioTargetGate =
  | { state: 'loading' }
  | { state: 'supported'; target: AudioTarget }
  | { state: 'unsupported'; reason: AudioTargetUnsupportedReason }
  | { state: 'unavailable'; reason: AudioTargetUnavailableReason };

export type AudioTargetUnsupportedReason =
  | 'catalog_unavailable'
  | 'preset_unavailable'
  | 'target_unresolved'
  | 'model_without_audio'
  | 'endpoint_without_file_uri';

export type AudioTargetUnavailableReason = 'not_ready' | 'catalog_fetch_failed';

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0;
}

/** Strict selector-facing validation; malformed catalog truth is never sendable. */
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
  const modelsValid = catalog.models.every(
    (model) =>
      typeof model?.name === 'string' &&
      model.name.trim().length > 0 &&
      Array.isArray(model.abilities) &&
      model.abilities.every((ability) => typeof ability === 'string') &&
      Array.isArray(model.compatible_endpoint_ids) &&
      model.compatible_endpoint_ids.every(isPositiveInteger),
  );
  const endpointsValid = catalog.endpoints.every(
    (endpoint) =>
      isPositiveInteger(endpoint?.id) &&
      typeof endpoint.name === 'string' &&
      typeof endpoint.configured === 'boolean' &&
      typeof endpoint.enabled === 'boolean' &&
      Array.isArray(endpoint.attachment_transports) &&
      endpoint.attachment_transports.every((transport) => typeof transport === 'string'),
  );
  const rolesValid = catalog.roles.main.every(
    (role) =>
      typeof role?.model === 'string' &&
      role.model.length > 0 &&
      isPositiveInteger(role.default_endpoint),
  );
  if (!modelsValid || !endpointsValid || !rolesValid) {
    throw new AppApiError('模型目录包含无效的模型、端点或主角色条目', { body: raw, code: 'CONTRACT' });
  }
  return catalog as ModelCatalog;
}

/** Fetch the live model catalog through the same-origin API. */
export async function fetchModelCatalog(): Promise<ModelCatalog> {
  const raw: unknown = await apiFetch('/api/core/model-catalog/', { method: 'GET' });
  return validateModelCatalog(raw);
}

/**
 * Pure target resolution + validation. `preset` is the Conversation's
 * AgentPreset row (default_model); catalog must be live (fetched) — never the
 * static MODEL_REGISTRY fallback (it has no endpoint transports).
 */
export function resolveAudioTarget(
  catalog: ModelCatalog | null,
  preset: { default_model?: string | null } | null,
): { gate: AudioTargetGate; target: AudioTarget | null; reason: AudioTargetUnsupportedReason | null } {
  if (!catalog || !Array.isArray(catalog.models) || !Array.isArray(catalog.endpoints)) {
    return { gate: { state: 'unsupported', reason: 'catalog_unavailable' }, target: null, reason: 'catalog_unavailable' };
  }
  if (!preset?.default_model) {
    return { gate: { state: 'unsupported', reason: 'preset_unavailable' }, target: null, reason: 'preset_unavailable' };
  }

  const resolved = resolveInitialSessionTarget(catalog, { default_model: preset.default_model });
  if (!resolved.model || resolved.endpoint == null) {
    return { gate: { state: 'unsupported', reason: 'target_unresolved' }, target: null, reason: 'target_unresolved' };
  }

  const model = catalog.models.find((m) => m.name === resolved.model);
  const endpoint = catalog.endpoints.find((e) => e.id === resolved.endpoint);
  if (!model) {
    return { gate: { state: 'unsupported', reason: 'target_unresolved' }, target: null, reason: 'target_unresolved' };
  }
  if (!(model.abilities ?? []).includes('audio')) {
    return { gate: { state: 'unsupported', reason: 'model_without_audio' }, target: null, reason: 'model_without_audio' };
  }
  if (!endpoint || !(endpoint.attachment_transports ?? []).includes('file_uri')) {
    return { gate: { state: 'unsupported', reason: 'endpoint_without_file_uri' }, target: null, reason: 'endpoint_without_file_uri' };
  }

  const target: AudioTarget = { model: resolved.model, endpoint: resolved.endpoint };
  return { gate: { state: 'supported', target }, target, reason: null };
}

/** Human-safe, retryable reason copy for the recorder UI. */
export function audioTargetUnsupportedText(reason: AudioTargetUnsupportedReason): string {
  switch (reason) {
    case 'catalog_unavailable':
      return '模型目录暂不可用，无法确认语音能力';
    case 'preset_unavailable':
      return '当前会话缺少模型配置，无法录音';
    case 'target_unresolved':
      return '无法解析当前模型/端点';
    case 'model_without_audio':
      return '当前模型不支持语音附件';
    case 'endpoint_without_file_uri':
      return '当前端点不支持语音上传';
    default:
      return '当前目标不支持录音';
  }
}

/**
 * Live-catalog query for the audio target gate. One catalog fetch per mount
 * family; `retry` re-fetches after a transient failure without P1D controls.
 */
export function useModelCatalogQuery() {
  return useQuery({
    queryKey: ['model-catalog'],
    queryFn: fetchModelCatalog,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

/**
 * Automatic target gate for the CURRENT Conversation preset (Task 3.2).
 * Returns a stable `AudioTargetGate`; failures explicitly disable recording
 * only — text/file flows stay usable.
 */
export function resolveSelectedAudioTarget(
  catalog: ModelCatalog | null | undefined,
  target: { model: string; endpoint: number | null } | null | undefined,
): AudioTargetGate {
  if (!catalog) return { state: 'unsupported', reason: 'catalog_unavailable' };
  if (!target?.model || !Number.isInteger(target.endpoint) || (target.endpoint as number) <= 0) {
    return { state: 'unsupported', reason: 'target_unresolved' };
  }
  const model = catalog.models.find((candidate) => candidate.name === target.model);
  const endpoint = catalog.endpoints.find((candidate) => candidate.id === target.endpoint);
  if (!model || !endpoint || !endpoint.configured || !endpoint.enabled) {
    return { state: 'unsupported', reason: 'target_unresolved' };
  }
  if (!model.compatible_endpoint_ids.includes(endpoint.id)) {
    return { state: 'unsupported', reason: 'target_unresolved' };
  }
  if (!(model.abilities ?? []).includes('audio')) {
    return { state: 'unsupported', reason: 'model_without_audio' };
  }
  if (!(endpoint.attachment_transports ?? []).includes('file_uri')) {
    return { state: 'unsupported', reason: 'endpoint_without_file_uri' };
  }
  return { state: 'supported', target: { model: target.model, endpoint: endpoint.id } };
}

/** P1D audio gate follows the selected conversation-local target. */
export function useAudioTargetGate(
  catalog: ModelCatalog | null | undefined,
  target: { model: string; endpoint: number | null } | null | undefined,
): AudioTargetGate {
  return resolveSelectedAudioTarget(catalog, target);
}