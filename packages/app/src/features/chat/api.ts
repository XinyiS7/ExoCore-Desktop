import { apiFetch } from 'exo-shared/api';
import type {
  AgentPresetRow,
  ConversationRow,
  ConversationSummary,
  CreateConversationInput,
  CreateConversationResult,
  InitEnvelope,
  MessagePage,
  MessagePageEnvelope,
  MessageRow,
  MessageView,
  ProjectRow,
} from './types';

/**
 * Typed V4 adapters over the generic exo-shared transport (Plan Task 3).
 *
 * - `exo-shared/api` is used unmodified (CSRF, credentials, JSON, non-2xx);
 * - every top-level envelope is guarded here — a malformed response must
 *   surface as an error, never as an empty success;
 * - normalization happens only at this boundary and never mutates rows.
 */

/** UI-safe error carrying status + raw body + optional field map. */
export class AppApiError extends Error {
  readonly status: number | null;
  readonly body: unknown;
  readonly code: string;
  /** First message per field for DRF-style 400 bodies: {field: message}. */
  readonly fieldErrors: Record<string, string>;
  /** True when a 2xx write was accepted but its envelope was malformed —
   *  the write outcome is unknown and retrying could duplicate state. */
  readonly ambiguousWrite: boolean;

  constructor(
    message: string,
    options: {
      status?: number | null;
      body?: unknown;
      code?: string;
      fieldErrors?: Record<string, string>;
      ambiguousWrite?: boolean;
    } = {},
  ) {
    super(message);
    this.name = 'AppApiError';
    this.status = options.status ?? null;
    this.body = options.body;
    this.code = options.code ?? 'ERROR';
    this.fieldErrors = options.fieldErrors ?? {};
    this.ambiguousWrite = options.ambiguousWrite ?? false;
  }
}

function contractError(message: string, body: unknown): AppApiError {
  return new AppApiError(message, { body, code: 'CONTRACT' });
}

/** Map a thrown transport error into AppApiError (network, HTTP, malformed). */
export function toAppApiError(cause: unknown): AppApiError {
  if (cause instanceof AppApiError) return cause;
  const err = cause as { message?: string; status?: unknown; body?: unknown };
  const status = typeof err?.status === 'number' ? err.status : null;
  if (status !== null) {
    const body = err?.body;
    return new AppApiError(err?.message ?? `请求失败 (${status})`, {
      status,
      body,
      fieldErrors: extractFieldErrors(body),
    });
  }
  if (err instanceof TypeError || cause instanceof TypeError) {
    return new AppApiError('网络连接失败，请检查后端服务', { status: null });
  }
  return new AppApiError(err?.message ?? '请求失败', { status: null });
}

/** DRF-style bodies: {"field": ["msg"]} or {"non_field_errors": [...]}. */
export function extractFieldErrors(body: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof body !== 'object' || body === null) return out;
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (Array.isArray(value) && typeof value[0] === 'string') {
      out[key] = value[0];
    } else if (typeof value === 'string') {
      out[key] = value;
    }
  }
  return out;
}

function normalizeConversationRow(row: ConversationRow): ConversationSummary {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    projectId: row.project === 0 ? null : row.project,
    projectName: row.project_name,
    agentType: row.agent_type,
    agentPresetId: row.agent_preset_id,
    lastMessageAt: row.last_message_at,
  };
}

function normalizeMessageRow(row: MessageRow): MessageView {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    reasoningContent: row.reasoning_content,
    platform: row.platform,
    modelVersion: row.model_version,
    tokenCount: row.token_count,
    indexInSession: row.index_in_session,
    attachmentIds: row.attachment_ids,
    attachmentsMeta: row.attachments_meta,
    createdAt: row.created_at,
  };
}

// ── Conversations ─────────────────────────────────────────────────────────

/** GET /api/agents/conversations/ — bare array; order is authoritative. */
export async function listConversations(): Promise<ConversationSummary[]> {
  const raw = await apiFetch('/api/agents/conversations/');
  if (!Array.isArray(raw)) throw contractError('会话列表接口返回格式异常', raw);
  // Normalize into new objects; never mutate the server DTO array.
  return raw.map((row: ConversationRow) => normalizeConversationRow(row));
}

/** GET /api/agents/conversations/<id>/ */
export async function getConversation(id: number): Promise<ConversationSummary> {
  const raw = await apiFetch(`/api/agents/conversations/${id}/`);
  if (typeof raw !== 'object' || raw === null || typeof (raw as ConversationRow).id !== 'number') {
    throw contractError('会话详情接口返回格式异常', raw);
  }
  return normalizeConversationRow(raw as ConversationRow);
}

// ── Conversation create (canonical init only — never POST .../conversations/) ─

/** POST /api/agents/sessions/init/ */
export async function createConversation(input: CreateConversationInput): Promise<CreateConversationResult> {
  const body: Record<string, unknown> = {
    preset_id: input.presetId,
    project_id: input.projectId,
    thinking_level: 'auto',
  };
  if (input.name !== undefined && input.name.trim() !== '') body.name = input.name.trim();
  if (input.frozenProjectIds !== undefined) body.frozen_project_ids = input.frozenProjectIds;
  const raw: InitEnvelope = await apiFetch('/api/agents/sessions/init/', { method: 'POST', body });
  const conversationId = raw?.data?.conversation_id;
  const sessionName = raw?.data?.session_name;
  if (!Number.isInteger(conversationId) || (conversationId as number) <= 0 || typeof sessionName !== 'string') {
    // P1A-B0 (frozen 2026-09-02): init must return a POSITIVE INTEGER
    // canonical conversation_id. A malformed success envelope is a terminal
    // ambiguous-write: the server accepted the write (2xx) but its outcome is
    // unknown — the caller must lock resubmission and never infer the id from
    // a list/name lookup.
    throw new AppApiError('会话已创建，但返回缺少有效的会话编号；结果不确定。请关闭本窗口，从最近会话中打开（避免重复创建）。', {
      body: raw,
      code: 'CONTRACT',
      ambiguousWrite: true,
    });
  }
  return { conversationId: conversationId as number, sessionName };
}

// ── Agent presets & projects ──────────────────────────────────────────────

/** GET /api/agents/presets/ — backend already filters is_visible=True. */
export async function listVisiblePresets(): Promise<AgentPresetRow[]> {
  const raw = await apiFetch('/api/agents/presets/');
  if (!Array.isArray(raw)) throw contractError('预设列表接口返回格式异常', raw);
  return raw as AgentPresetRow[];
}

/** GET /api/core/projects/ */
export async function listProjects(): Promise<ProjectRow[]> {
  const raw = await apiFetch('/api/core/projects/');
  if (!Array.isArray(raw)) throw contractError('项目列表接口返回格式异常', raw);
  return raw as ProjectRow[];
}

// ── Message history (offset counts back from the newest end) ──────────────

/** GET /api/agents/chat/<id>/?limit=<N>&offset=<N> */
export async function fetchMessagePage(
  conversationId: number,
  offset: number,
  limit = 50,
): Promise<MessagePage> {
  const raw: MessagePageEnvelope = await apiFetch(`/api/agents/chat/${conversationId}/`, {
    params: { limit, offset },
  });
  if (
    typeof raw !== 'object' ||
    raw === null ||
    !Array.isArray(raw.messages) ||
    typeof raw.has_more !== 'boolean' ||
    typeof raw.total_count !== 'number'
  ) {
    throw contractError('消息历史接口返回格式异常', raw);
  }
  return {
    messages: raw.messages.map((row: MessageRow) => normalizeMessageRow(row)),
    totalCount: raw.total_count,
    hasMore: raw.has_more,
    offset,
  };
}
