import { apiFetch } from '../api';

// ── ChronicleEntry CRUD (§1.9) ──
export function listChronicleEntries(params = {}) {
  return apiFetch('/api/agents/chronicle/', { method: 'GET', params });
}
export function getChronicleEntry(entryId) {
  return apiFetch(`/api/agents/chronicle/${entryId}/`, { method: 'GET' });
}
export function createChronicleEntry(data) {
  // data: { preset, event_time, content, scope?, keywords? }
  return apiFetch('/api/agents/chronicle/', { method: 'POST', body: data });
}
export function updateChronicleEntry(entryId, data) {
  // PATCH allowed: event_time, content, scope, keywords
  return apiFetch(`/api/agents/chronicle/${entryId}/`, { method: 'PATCH', body: data });
}
export function deleteChronicleEntry(entryId) {
  return apiFetch(`/api/agents/chronicle/${entryId}/`, { method: 'DELETE' });
}
