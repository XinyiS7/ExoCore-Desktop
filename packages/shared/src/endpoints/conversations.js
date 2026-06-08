import { apiFetch } from '../api';

// ── Conversation CRUD (§1.1-1.2) ──
export function listConversations(params = {}) {
  return apiFetch('/api/agents/conversations/', { method: 'GET', params });
}
export function getConversation(convId) {
  return apiFetch(`/api/agents/conversations/${convId}/`, { method: 'GET' });
}
export function createConversation(data) {
  return apiFetch('/api/agents/conversations/', { method: 'POST', body: data });
}
export function updateConversation(convId, data) {
  return apiFetch(`/api/agents/conversations/${convId}/`, { method: 'PATCH', body: data });
}
export function deleteConversation(convId) {
  return apiFetch(`/api/agents/conversations/${convId}/`, { method: 'DELETE' });
}

// ── Messages (§1.2) ──
export function getConversationMessages(convId, params = {}) {
  return apiFetch(`/api/agents/chat/${convId}/`, { method: 'GET', params });
}

// ── History Chunks (§1.4-1.5) ──
export function listHistoryChunks(convId) {
  return apiFetch(`/api/agents/conversations/${convId}/history_chunks/`, { method: 'GET' });
}
export function getHistoryChunk(chunkId) {
  return apiFetch(`/api/memory/history_chunks/${chunkId}/`, { method: 'GET' });
}
export function updateHistoryChunk(chunkId, data) {
  // PATCH allowed fields: topic_label, keywords, unresolved
  return apiFetch(`/api/memory/history_chunks/${chunkId}/`, { method: 'PATCH', body: data });
}

// ── Context Cache (§1.6) ──
export function getCacheStatus(convId) {
  return apiFetch(`/api/agents/conversations/${convId}/cache/`, { method: 'GET' });
}
export function renewCache(convId) {
  return apiFetch(`/api/agents/conversations/${convId}/cache/renew/`, { method: 'POST' });
}
export function deleteCache(convId) {
  return apiFetch(`/api/agents/conversations/${convId}/cache/`, { method: 'DELETE' });
}

// ── Attachments (§1.7) ──
export function listAttachments(convId) {
  return apiFetch(`/api/agents/conversations/${convId}/attachments/`, { method: 'GET' });
}
export function uploadAttachment(convId, formData) {
  return apiFetch(`/api/agents/conversations/${convId}/attachments/`, { method: 'POST', body: formData });
}
export function deleteAttachment(convId, source, id) {
  return apiFetch(`/api/agents/conversations/${convId}/attachments/delete/`, { method: 'DELETE', body: { source, id } });
}
