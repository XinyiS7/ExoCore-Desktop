import { apiFetch } from '../api';

// ── System Config (§5.1) ──
export function getConfig() {
  return apiFetch('/api/core/config/', { method: 'GET' });
}
export function updateConfig(data) {
  // PATCH: any subset of fields. API key fields with "****" prefix are ignored.
  return apiFetch('/api/core/config/', { method: 'PATCH', body: data });
}

// ── Model Registry (§5.2) — dynamic, prefer over static fallback ──
export function listModels() {
  return apiFetch('/api/core/models/', { method: 'GET' });
}

// ── API Keys (§5.3) ──

/** GET /api/core/apikeys/ — list keys, optional ?platform= filter */
export function listApiKeys(platform) {
  const params = platform ? { platform } : undefined;
  return apiFetch('/api/core/apikeys/', { method: 'GET', params });
}

/** POST /api/core/apikeys/ — create a new key */
export function createApiKey({ alias, platform, key_value }) {
  return apiFetch('/api/core/apikeys/', { method: 'POST', body: { alias, platform, key_value } });
}

/** PATCH /api/core/apikeys/<id>/ — update alias only */
export function updateApiKeyAlias(id, alias) {
  return apiFetch(`/api/core/apikeys/${id}/`, { method: 'PATCH', body: { alias } });
}

/** PUT /api/core/apikeys/<id>/overwrite/ — overwrite key_value */
export function overwriteApiKey(id, key_value) {
  return apiFetch(`/api/core/apikeys/${id}/overwrite/`, { method: 'PUT', body: { key_value } });
}

/** DELETE /api/core/apikeys/<id>/ — cascade delete same-value keys */
export function deleteApiKey(id) {
  return apiFetch(`/api/core/apikeys/${id}/`, { method: 'DELETE' });
}

// ── Key Map (§5.4) ──

/** PUT /api/core/config/key-map/ — assign keys to roles per platform */
export function updateKeyMap(keyMap) {
  return apiFetch('/api/core/config/key-map/', { method: 'PUT', body: keyMap });
}
