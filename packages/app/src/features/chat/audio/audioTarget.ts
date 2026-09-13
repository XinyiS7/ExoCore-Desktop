import { resolveInitialSessionTarget, type ModelCatalog } from 'exo-shared/models';
import {
  validateModelCatalog,
  fetchModelCatalog,
  useModelCatalogQuery,
} from '../../../shared/modelCatalog';
import type { AudioTarget } from '../attachments/types';

export { validateModelCatalog, fetchModelCatalog, useModelCatalogQuery };

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