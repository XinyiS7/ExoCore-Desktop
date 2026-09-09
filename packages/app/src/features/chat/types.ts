/**
 * P1A DTOs — transport rows (C0 allowlist) and feature domain models.
 * No field is invented beyond the verified serializer/snapshot contracts
 * (Plan §6.2–§6.6, Canonical_API_Snapshot.json).
 */

// ── Transport rows (server contract) ──────────────────────────────────────

export interface AgentPresetRow {
  id: number;
  name: string;
  description: string | null;
  agent_type: string;
  default_model: string | null;
  system_prompt: string | null;
  is_visible: boolean;
}

export interface ProjectRow {
  id: number;
  name: string;
  description: string | null;
  prompt: string | null;
  work_dir: string | null;
  created_at: string;
}

/** Conversation row: `project` is the DB-NULL sentinel `0` on the wire. */
export interface ConversationRow {
  id: number;
  name: string;
  created_at: string;
  frozen_project_ids: number[];
  project: number;
  project_name: string | null;
  agent_type: string;
  agent_preset_id: number | null;
  last_message_at: string | null;
  thinking_level: string | null;
  memory_injection_enabled: boolean | null;
}

export type MessageRole = 'user' | 'assistant' | 'system' | 'developer';

export interface AttachmentMeta {
  id: number;
  display_name: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  file_uri: string | null;
  content_url: string | null;
}

export interface AssistantRunTraceThinkingItem {
  itemId: string;
  order: number;
  kind: 'thinking';
  text: string;
}

export type AssistantToolLifecycle = 'started' | 'succeeded' | 'failed' | 'incomplete';

export interface AssistantRunTraceToolItem {
  itemId: string;
  order: number;
  kind: 'tool';
  callId: string;
  lifecycle: AssistantToolLifecycle;
  toolName: string;
  argumentPreview?: string | null;
  resultSummary?: string | null;
  errorSummary?: string | null;
  durationMs?: number | null;
}

export type AssistantRunTraceItem = AssistantRunTraceThinkingItem | AssistantRunTraceToolItem;

export type AssistantRunTraceProjection =
  | {
      version: 1;
      availability: 'available';
      items: AssistantRunTraceItem[];
      truncated?: boolean;
    }
  | {
      version: 1;
      availability: 'legacy_unavailable';
      reason: 'ordering_unavailable';
    };

export interface MessageRow {
  id: number;
  role: MessageRole;
  content: string;
  reasoning_content: string | null;
  /** Additive backend field; normalized fail-closed at the API boundary. */
  assistant_run_trace?: unknown;
  platform: string | null;
  model_version: string | null;
  token_count: number | null;
  index_in_session: number;
  attachment_ids: number[];
  attachments_meta: AttachmentMeta[] | null;
  created_at: string;
}

export interface MessagePageEnvelope {
  messages: MessageRow[];
  total_count: number;
  has_more: boolean;
}

export interface InitEnvelope {
  msg: string;
  data: {
    /** Canonical identity of the created Conversation (P1A-B0, frozen 2026-09-02). */
    conversation_id: number;
    /** Deprecated V3 compatibility alias == conversation_id. V4 must not read it. */
    session_id?: number;
    session_name: string;
  };
}

// ── Feature domain models (normalized at the feature boundary) ────────────

/** Project sentinel `0` normalized to `null` (Drift); row itself untouched. */
export interface ConversationSummary {
  id: number;
  name: string;
  createdAt: string;
  projectId: number | null;
  projectName: string | null;
  agentType: string;
  agentPresetId: number | null;
  lastMessageAt: string | null;
  /** Canonical thinking level ('' or null => 'auto' at request time, §5.1). */
  thinkingLevel: string | null;
  /** Backend row value only; P1D dispatch is owned by the local g045 Conversation preference. */
  memoryInjectionEnabled: boolean | null;
}

export interface MessageView {
  id: number;
  role: MessageRole;
  content: string;
  reasoningContent: string | null;
  /** `null` means absent or malformed external trace data. */
  assistantRunTrace?: AssistantRunTraceProjection | null;
  platform: string | null;
  modelVersion: string | null;
  tokenCount: number | null;
  indexInSession: number;
  attachmentIds: number[];
  attachmentsMeta: AttachmentMeta[] | null;
  createdAt: string;
}

export interface MessagePage {
  messages: MessageView[];
  totalCount: number;
  hasMore: boolean;
  /** Offset this page was requested with (needed for the offset invariant). */
  offset: number;
}

export interface CreateConversationInput {
  name?: string;
  presetId: number;
  projectId: number;
  /** g045 extension list; omitted for non-g045 presets. */
  frozenProjectIds?: number[];
}

export interface CreateConversationResult {
  /** Canonical Conversation identity returned by init (required; no inference). */
  conversationId: number;
  sessionName: string;
}
