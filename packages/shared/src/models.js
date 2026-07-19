// Re-export static fallback. Prefer configApi.listModels() for the live registry.
export { MODEL_REGISTRY, AVAILABLE_MODELS } from './api';

/** Map model ID to display info. Falls back to raw ID if unknown. */
export function getModelInfo(modelId) {
  const found = MODEL_REGISTRY.find(m => m.id === modelId);
  return found || { provider: 'unknown', id: modelId, label: modelId, roles: [] };
}

/** Get the list of main role configurations from the model catalog roles. */
export function getMainRoles(catalog) {
  if (!catalog || !Array.isArray(catalog.roles)) return [];
  return catalog.roles.filter(r => r.role === 'main');
}

/** Get configured and enabled compatible endpoints for a given model. */
export function getCompatibleEndpoints(catalog, modelName) {
  if (!catalog || !modelName) return [];
  const model = catalog.models?.find(m => m.name === modelName);
  if (!model || !Array.isArray(model.compatible_endpoint_ids)) return [];
  if (!Array.isArray(catalog.endpoints)) return [];
  return catalog.endpoints.filter(ep => 
    ep.configured && 
    ep.enabled && 
    model.compatible_endpoint_ids.includes(ep.id)
  );
}

/** Resolve the initial target (model and endpoint) for a chat session. */
export function resolveInitialSessionTarget(catalog, preset) {
  const model = preset?.default_model || '';
  
  if (!model) {
    // Fallback to the first registered main role model
    const firstMain = catalog?.roles?.find(r => r.role === 'main');
    return { model: firstMain?.model || '', endpoint: firstMain?.endpoint || null };
  }
  
  // Find the registered main configuration for this model
  const mainEntry = catalog?.roles?.find(r => r.role === 'main' && r.model === model);
  
  if (mainEntry) {
    return { model, endpoint: mainEntry.endpoint };
  }
  
  const compatible = getCompatibleEndpoints(catalog, model);
  
  // If only one compatible, configured, and enabled endpoint exists, auto-switch
  if (compatible.length === 1) {
    return { model, endpoint: compatible[0].id };
  }
  
  // Otherwise, prompt user to select endpoint
  return { model, endpoint: null };
}

/** Transition session target when user selects a different model. */
export function changeTargetModel(catalog, currentTarget, nextModel) {
  const compatible = getCompatibleEndpoints(catalog, nextModel);
  
  // 1. If current endpoint is still compatible with next model, keep it
  if (currentTarget?.endpoint && compatible.some(ep => ep.id === currentTarget.endpoint)) {
    return { model: nextModel, endpoint: currentTarget.endpoint, status: 'retained' };
  }
  
  // 2. If not compatible, but only one candidate exists, auto-switch
  if (compatible.length === 1) {
    return { model: nextModel, endpoint: compatible[0].id, status: 'switched', changedTo: compatible[0] };
  }
  
  // 3. If multiple candidates exist, require select
  if (compatible.length > 1) {
    return { model: nextModel, endpoint: null, status: 'requires_select' };
  }
  
  // 4. No compatible endpoints available
  return { model: nextModel, endpoint: null, status: 'no_endpoints' };
}
