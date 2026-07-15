import { apiFetch } from '../api';

// ── MemoryPlasmid (§2.2) ──
export function listPlasmids(params = {}) {
  // params: preset_id, scope, source, is_processed
  return apiFetch('/api/memory/plasmids/', { method: 'GET', params });
}
export function createPlasmid(data) {
  // preset_id or message_id (mutually exclusive), content, scope?, tags?
  return apiFetch('/api/memory/plasmids/', { method: 'POST', body: data });
}
export function updatePlasmid(plasmidId, data) {
  // PATCH: content (only preset_id=2), scope, tags
  return apiFetch(`/api/memory/plasmids/${plasmidId}/`, { method: 'PATCH', body: data });
}
export function deletePlasmid(plasmidId) {
  return apiFetch(`/api/memory/plasmids/${plasmidId}/`, { method: 'DELETE' });
}
export function listPlasmidTags(presetId) {
  // GET /api/memory/plasmids/tags/?preset_id=<id> — must match BEFORE /plasmids/<pk>/
  return apiFetch('/api/memory/plasmids/tags/', { method: 'GET', params: { preset_id: presetId } });
}

// ── KnowledgeFragment (§2.1) ──
export function listKnowledge(params = {}) {
  // params: topic, project; paginated page_size=50
  return apiFetch('/api/memory/knowledge/', { method: 'GET', params });
}
export function getKnowledge(knowledgeId) {
  return apiFetch(`/api/memory/knowledge/${knowledgeId}/`, { method: 'GET' });
}
export function updateKnowledge(knowledgeId, data) {
  // PATCH: abstract, keywords
  return apiFetch(`/api/memory/knowledge/${knowledgeId}/`, { method: 'PATCH', body: data });
}

// ── Scope Keywords (§2.3) ──
export function getScopeKeywords() {
  return apiFetch('/api/memory/scope-keywords/', { method: 'GET' });
}
export function updateScopeKeywords(data) {
  // PUT: full replacement { scope: [keywords...], ... }
  return apiFetch('/api/memory/scope-keywords/', { method: 'PUT', body: data });
}
