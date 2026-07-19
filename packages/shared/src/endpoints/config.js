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

// ── Model Catalog & Endpoints & Roles (P1-11) ──

/** GET /api/core/model-catalog/ — 统一获取模型与端点快照 */
export function getModelCatalog() {
  return apiFetch('/api/core/model-catalog/', { method: 'GET' });
}

/** GET /api/core/model-entries/ — 模型列表 */
export function listModelEntries() {
  return apiFetch('/api/core/model-entries/', { method: 'GET' });
}

/** POST /api/core/model-entries/ — 创建模型 */
export function createModelEntry(data) {
  return apiFetch('/api/core/model-entries/', { method: 'POST', body: data });
}

/** PATCH /api/core/model-entries/<id>/ — 修改模型 */
export function updateModelEntry(id, data) {
  return apiFetch(`/api/core/model-entries/${encodeURIComponent(id)}/`, { method: 'PATCH', body: data });
}

/** DELETE /api/core/model-entries/<id>/ — 删除模型 */
export function deleteModelEntry(id) {
  return apiFetch(`/api/core/model-entries/${encodeURIComponent(id)}/`, { method: 'DELETE' });
}

/** GET /api/core/endpoints/ — 获取端点通道列表 */
export function listEndpoints() {
  return apiFetch('/api/core/endpoints/', { method: 'GET' });
}

/** POST /api/core/endpoints/ — 创建通道端点 */
export function createEndpoint(data) {
  return apiFetch('/api/core/endpoints/', { method: 'POST', body: data });
}

/** PATCH /api/core/endpoints/<id>/ — 修改端点通道 */
export function updateEndpoint(id, data) {
  return apiFetch(`/api/core/endpoints/${encodeURIComponent(id)}/`, { method: 'PATCH', body: data });
}

/** DELETE /api/core/endpoints/<id>/ — 注销端点 */
export function deleteEndpoint(id) {
  return apiFetch(`/api/core/endpoints/${encodeURIComponent(id)}/`, { method: 'DELETE' });
}

/** GET /api/core/config/roles/ — 获取角色配置绑定 */
export function getModelRoles() {
  return apiFetch('/api/core/config/roles/', { method: 'GET' });
}

/** PUT /api/core/config/roles/ — 保存角色配置搭配 */
export function updateModelRoles(rows) {
  return apiFetch('/api/core/config/roles/', { method: 'PUT', body: rows });
}
