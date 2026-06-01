import { apiFetch } from '../api';

// ── UserPortrait (§2.2) ──
export function listPortraits(params = {}) {
  // params: preset_id, scope, source, is_processed
  return apiFetch('/api/memory/portraits/', { method: 'GET', params });
}
export function createPortrait(data) {
  // preset_id or message_id (mutually exclusive), content, scope?, tags?
  return apiFetch('/api/memory/portraits/', { method: 'POST', body: data });
}
export function updatePortrait(portraitId, data) {
  // PATCH: content (only preset_id=2), scope, tags
  return apiFetch(`/api/memory/portraits/${portraitId}/`, { method: 'PATCH', body: data });
}
export function deletePortrait(portraitId) {
  return apiFetch(`/api/memory/portraits/${portraitId}/`, { method: 'DELETE' });
}
export function listPortraitTags(presetId) {
  // GET /api/memory/portraits/tags/?preset_id=<id> — must match BEFORE /portraits/<pk>/
  return apiFetch('/api/memory/portraits/tags/', { method: 'GET', params: { preset_id: presetId } });
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
