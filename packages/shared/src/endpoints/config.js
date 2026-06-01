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
