export interface SystemConfigRow {
  self_check_preset_ids?: number[];
  deep_org_preset_ids?: number[];
  active_start?: string | null;
  active_end?: string | null;
  deep_org_weekday?: number | null;
  deep_org_hour?: number | null;
  [key: string]: unknown;
}

export interface SystemConfigPatch {
  self_check_preset_ids: number[];
  deep_org_preset_ids: number[];
}

export interface SettingsSectionDef {
  id: string;
  label: string;
  path: string;
  description: string;
}

// ── Endpoints ────────────────────────────────────────────────────────────────

export interface EndpointRow {
  id: number;
  name: string;
  provider: string;
  api_key_alias: string | null;
  enabled: boolean;
  configured: boolean;
  execution_type: string;
  execution_adapter: string;
  payload_format?: string;
  cache_transport?: string;
  attachment_transports?: string[];
  base_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface EndpointPayload {
  name: string;
  provider: string;
  api_key_alias: string | null;
  enabled: boolean;
}

// ── ApiKeys ──────────────────────────────────────────────────────────────────

export interface ApiKeyRow {
  alias: string;
  platform: string;
  last_four: string;
  created_at: string;
  updated_at: string;
}

export interface ApiKeyCreatePayload {
  alias: string;
  platform: string;
  key_value: string;
}

export interface ApiKeyRenamePayload {
  alias: string;
}

export interface ApiKeyOverwritePayload {
  key_value: string;
}

// ── Model Roles ──────────────────────────────────────────────────────────────

export interface MainRoleDraft {
  model: string;
  default_endpoint: number;
  style_shadow?: string | null;
  position: number;
}

export interface SupportRoleDraft {
  model: string;
  default_endpoint: number;
}

export interface RoleConfigPayload {
  main: MainRoleDraft[];
  support: {
    general_sub_agent: SupportRoleDraft;
    vision_helper: SupportRoleDraft;
    grounding: SupportRoleDraft;
    image_gen: SupportRoleDraft;
    [role: string]: SupportRoleDraft;
  };
}

// ── Drawers & MCP ────────────────────────────────────────────────────────────

export type CredentialStrategy = 'none' | 'shared' | 'per_preset' | 'shared_or_per_preset';

export interface DrawerCatalogItem {
  name: string;
  display_name: string;
  description: string;
  server_name: string;
  available: boolean;
  credential_strategy: CredentialStrategy;
  credential_required: boolean;
}

export interface PresetDrawerItem {
  name: string;
  display_name: string;
  server_name: string;
  available: boolean;
  enabled: boolean;
  credential_strategy: CredentialStrategy;
  credential_required: boolean;
  credential_mode: 'dedicated' | 'inherit_public' | null;
  credential_alias: string | null;
  credential_ready: boolean;
}

export interface McpCredentialItem {
  alias: string;
  server_name: string;
  last_four: string;
  created_at: string;
  updated_at: string;
}

export interface McpCredentialCreatePayload {
  alias: string;
  server_name: string;
  credential_value: string;
}

export interface McpServerItem {
  name: string;
  display_name: string;
  available: boolean;
  credential_strategy: CredentialStrategy;
  credential_required: boolean;
  public_credential_alias: string | null;
  public_credential_configured: boolean;
}

export interface PresetMcpServerItem {
  server_name: string;
  credential_strategy: CredentialStrategy;
  credential_required: boolean;
  mode: 'dedicated' | 'inherit_public' | null;
  credential_alias: string | null;
  resolved_source: 'public' | 'preset' | 'none';
  resolved_alias: string | null;
  credential_ready: boolean;
}

export interface PresetMcpBindingPayload {
  mode: 'dedicated' | 'inherit_public';
  credential_alias: string | null;
}

