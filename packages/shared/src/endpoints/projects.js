import { apiFetch } from '../api';

// ── Project CRUD (§3.2) ──
export function listProjects() {
  return apiFetch('/api/core/projects/', { method: 'GET' });
}
export function getProject(projectId) {
  return apiFetch(`/api/core/projects/${projectId}/`, { method: 'GET' });
}
export function createProject(data) {
  return apiFetch('/api/core/projects/', { method: 'POST', body: data });
}
export function updateProject(projectId, data) {
  // PATCH allowed: name, description, prompt, work_dir
  return apiFetch(`/api/core/projects/${projectId}/`, { method: 'PATCH', body: data });
}
export function deleteProject(projectId) {
  return apiFetch(`/api/core/projects/${projectId}/`, { method: 'DELETE' });
}

// ── Project Files (§3.1) ──
export function listProjectFiles(projectId) {
  return apiFetch(`/api/core/projects/${projectId}/files/`, { method: 'GET' });
}
export function uploadProjectFile(projectId, formData) {
  return apiFetch(`/api/core/projects/${projectId}/files/`, { method: 'POST', body: formData });
}
export function deleteProjectFile(projectId, fileId) {
  return apiFetch(`/api/core/projects/${projectId}/files/${fileId}/`, { method: 'DELETE' });
}

// ── Directory Browsing (§3.3) ──
// path: relative subdirectory path (empty = root)
// The backend handles recursive scanning, exclude rules, and sorting.
// Frontend receives a static nested tree and searches it locally.
export function listDirectory(projectId, path = '') {
  const params = {};
  if (path) params.path = path;
  return apiFetch(`/api/core/projects/${projectId}/tree/`, { method: 'GET', params });
}
