import { apiFetch } from '../api';

// ── GroupChat CRUD (§8.1) ──
export function listGroupchats(params = {}) {
  return apiFetch('/api/groupchat/', { method: 'GET', params });
}
export function createGroupchat(data) {
  return apiFetch('/api/groupchat/', { method: 'POST', body: data });
}
export function getGroupchat(id) {
  return apiFetch(`/api/groupchat/${id}/`, { method: 'GET' });
}
export function updateGroupchat(id, data) {
  return apiFetch(`/api/groupchat/${id}/`, { method: 'PATCH', body: data });
}
export function deleteGroupchat(id) {
  return apiFetch(`/api/groupchat/${id}/`, { method: 'DELETE' });
}

// ── Messages (§8.3) ──
export function getMessages(id) {
  return apiFetch(`/api/groupchat/${id}/messages/`, { method: 'GET' });
}
export function sendMessage(id, data) {
  return apiFetch(`/api/groupchat/${id}/messages/`, { method: 'POST', body: data });
}
