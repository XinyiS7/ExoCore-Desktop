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

/** Fetch the live model catalog through the same-origin API. */
export async function fetchModelCatalog(): Promise<ModelCatalog> {
  const raw: unknown = await apiFetch('/api/core/model-catalog/', { method: 'GET' });
  if (typeof raw !== 'object' || raw === null || !Array.isArray((raw as ModelCatalog).models)) {
    throw new AppApiError('模型目录接口返回格式异常', { body: raw, code: 'CONTRACT' });
  }
  return raw as ModelCatalog;
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
export function useAudioTargetGate(
  catalog: ModelCatalog | null | undefined,
  preset: { default_model?: string | null } | null | undefined,
): AudioTargetGate {
  // A gate computed from loading/failed catalog is 'unsupported' with a
  // retryable reason; a missing preset is likewise explicit, never silent.
  if (!catalog) {
    return { state: 'unsupported', reason: 'catalog_unavailable' };
  }
  if (!preset?.default_model) {
    return { state: 'unsupported', reason: 'preset_unavailable' };
  }
  const { gate } = resolveAudioTarget(catalog, preset);
  return gate;
}