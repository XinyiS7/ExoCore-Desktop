// Re-export static fallback. Prefer configApi.listModels() for the live registry.
export { MODEL_REGISTRY, AVAILABLE_MODELS } from './api';

/** Map model ID to display info. Falls back to raw ID if unknown. */
export function getModelInfo(modelId) {
  const found = MODEL_REGISTRY.find(m => m.id === modelId);
  return found || { provider: 'unknown', id: modelId, label: modelId, roles: [] };
}
