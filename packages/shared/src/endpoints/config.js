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

/** PATCH /api/core/apikeys/<alias>/ — rename alias to a new value */
export function updateApiKeyAlias(alias, newAlias) {
  return apiFetch(`/api/core/apikeys/${encodeURIComponent(alias)}/`, { method: 'PATCH', body: { alias: newAlias } });
}

/** PUT /api/core/apikeys/<alias>/overwrite/ — overwrite key_value */
export function overwriteApiKey(alias, key_value) {
  return apiFetch(`/api/core/apikeys/${encodeURIComponent(alias)}/overwrite/`, { method: 'PUT', body: { key_value } });
}

/** DELETE /api/core/apikeys/<alias>/ — cascade delete same-value keys */
export function deleteApiKey(alias) {
  return apiFetch(`/api/core/apikeys/${encodeURIComponent(alias)}/`, { method: 'DELETE' });
}

// ── Key Map (§5.4) ──

/** PUT /api/core/config/key-map/ — assign keys to roles per platform */
export function updateKeyMap(keyMap) {
  return apiFetch('/api/core/config/key-map/', { method: 'PUT', body: keyMap });
}
