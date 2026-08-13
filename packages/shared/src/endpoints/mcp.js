import { apiFetch } from '../api';

// ── 1. Drawer Catalog & Preset Drawer Visitor ──

/** GET /api/agents/drawers/ — List all registered local drawers */
export function listDrawers() {
  return apiFetch('/api/agents/drawers/', { method: 'GET' });
}

/** GET /api/agents/presets/<presetId>/drawers/ — List preset drawer visitor configuration */
export function getPresetDrawers(presetId) {
  return apiFetch(`/api/agents/presets/${presetId}/drawers/`, { method: 'GET' });
}

/** PUT /api/agents/presets/<presetId>/drawers/<drawerName>/ — Update preset drawer enable state */
export function updatePresetDrawer(presetId, drawerName, enabled) {
  return apiFetch(`/api/agents/presets/${presetId}/drawers/${encodeURIComponent(drawerName)}/`, {
    method: 'PUT',
    body: { enabled: Boolean(enabled) },
  });
}

// ── 2. MCP Credentials CRUD ──

/** GET /api/agents/mcp-credentials/?server_name=<name> — List credential metadata */
export function listMcpCredentials(serverName) {
  const params = serverName ? { server_name: serverName } : undefined;
  return apiFetch('/api/agents/mcp-credentials/', { method: 'GET', params });
}

/** POST /api/agents/mcp-credentials/ — Create new MCP credential */
export function createMcpCredential({ alias, server_name, credential_value }) {
  return apiFetch('/api/agents/mcp-credentials/', {
    method: 'POST',
    body: { alias, server_name, credential_value },
  });
}

/** PATCH /api/agents/mcp-credentials/<alias>/ — Rename credential alias */
export function updateMcpCredentialAlias(alias, newAlias) {
  return apiFetch(`/api/agents/mcp-credentials/${encodeURIComponent(alias)}/`, {
    method: 'PATCH',
    body: { alias: newAlias },
  });
}

/** PUT /api/agents/mcp-credentials/<alias>/overwrite/ — Overwrite credential value */
export function overwriteMcpCredential(alias, credential_value) {
  return apiFetch(`/api/agents/mcp-credentials/${encodeURIComponent(alias)}/overwrite/`, {
    method: 'PUT',
    body: { credential_value },
  });
}

/** DELETE /api/agents/mcp-credentials/<alias>/ — Delete credential alias */
export function deleteMcpCredential(alias) {
  return apiFetch(`/api/agents/mcp-credentials/${encodeURIComponent(alias)}/`, {
    method: 'DELETE',
  });
}

// ── 3. MCP Servers & Public Credentials ──

/** GET /api/agents/mcp-servers/ — List MCP server catalog and public bindings */
export function listMcpServers() {
  return apiFetch('/api/agents/mcp-servers/', { method: 'GET' });
}

/** PUT /api/agents/mcp-servers/<serverName>/credential/ — Update public credential alias binding */
export function updateMcpServerPublicCredential(serverName, credential_alias) {
  return apiFetch(`/api/agents/mcp-servers/${encodeURIComponent(serverName)}/credential/`, {
    method: 'PUT',
    body: { credential_alias },
  });
}

// ── 4. Preset MCP Credential Bindings ──

/** GET /api/agents/presets/<presetId>/mcp-credentials/ — Get preset MCP server credential bindings */
export function getPresetMcpCredentials(presetId) {
  return apiFetch(`/api/agents/presets/${presetId}/mcp-credentials/`, { method: 'GET' });
}

/** PUT /api/agents/presets/<presetId>/mcp-credentials/<serverName>/ — Update preset MCP credential mode/alias */
export function updatePresetMcpCredential(presetId, serverName, { mode, credential_alias }) {
  return apiFetch(`/api/agents/presets/${presetId}/mcp-credentials/${encodeURIComponent(serverName)}/`, {
    method: 'PUT',
    body: { mode, credential_alias },
  });
}
