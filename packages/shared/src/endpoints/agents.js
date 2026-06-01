import { apiFetch } from '../api';

// ── Presets ──
export function listPresets() {
  return apiFetch('/api/agents/presets/', { method: 'GET' });
}
export function getPreset(presetId) {
  return apiFetch(`/api/agents/presets/${presetId}/`, { method: 'GET' });
}
export function createPreset(data) {
  return apiFetch('/api/agents/presets/', { method: 'POST', body: data });
}
export function updatePreset(presetId, data) {
  return apiFetch(`/api/agents/presets/${presetId}/`, { method: 'PATCH', body: data });
}
export function deletePreset(presetId) {
  return apiFetch(`/api/agents/presets/${presetId}/`, { method: 'DELETE' });
}

// ── Chat ──
export function chatWithAgent(sessionId, body, mode = 'sse') {
  return apiFetch(`/api/agents/chat/${sessionId}/?mode=${mode}`, { method: 'POST', body });
}

/** SSE streaming chat — returns raw fetch Response for ReadableStream consumption. */
export async function chatWithAgentStream(sessionId, body) {
  const { baseUrl, getCsrfToken } = await import('../api');
  const res = await fetch(`${baseUrl}/api/agents/chat/${sessionId}/?mode=sse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!res.ok) { const err = new Error(`Chat stream failed: ${res.status}`); err.status = res.status; throw err; }
  return res;
}

/** Poll async chat status — GET /api/agents/chat/<sid>/status/?message_id=<token>&cursor=<n> */
export function pollChatStatus(sessionId, messageId, cursor = 0) {
  return apiFetch(`/api/agents/chat/${sessionId}/status/`, { method: 'GET', params: { message_id: messageId, cursor } });
}

// ── Triggered Notes ──
export function getTriggeredNotesSnapshot(presetId) {
  return apiFetch(`/api/agents/presets/${presetId}/triggered-notes/snapshot/`, { method: 'GET' });
}
