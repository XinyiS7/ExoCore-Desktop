import { apiFetch } from 'exo-shared/api';
import type {
  AgentPresetRow,
  AssistantRunTraceItem,
  AssistantRunTraceProjection,
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
  VoiceProjection,
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

/** Shared guarded-envelope error factory for feature adapters (chat + agents). */
export function contractError(message: string, body: unknown): AppApiError {
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
    thinkingLevel: typeof row.thinking_level === 'string' ? row.thinking_level : null,
    memoryInjectionEnabled:
      typeof row.memory_injection_enabled === 'boolean' ? row.memory_injection_enabled : null,
  };
}

const TRACE_ID_MAX = 128;
const TRACE_ARGUMENT_MAX = 500;
const TRACE_RESULT_MAX = 1000;
const TRACE_ERROR_MAX = 500;
const TRACE_TOOL_LIFECYCLES = new Set(['started', 'succeeded', 'failed', 'incomplete']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validTraceIdentity(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && Array.from(value).length <= TRACE_ID_MAX;
}

function optionalBoundedText(
  row: Record<string, unknown>,
  key: string,
  limit: number,
): { valid: boolean; value?: string | null } {
  if (!(key in row)) return { valid: true };
  const value = row[key];
  if (value === null) return { valid: true, value: null };
  return typeof value === 'string' && Array.from(value).length <= limit
    ? { valid: true, value }
    : { valid: false };
}

/**
 * Fail-closed history trace normalization. A malformed additive field cannot
 * block or alter canonical message content; callers receive `null` instead.
 */
export function normalizeAssistantRunTrace(value: unknown): AssistantRunTraceProjection | null {
  if (!isRecord(value) || value.version !== 1) return null;
  if (value.availability === 'legacy_unavailable') {
    return value.reason === 'ordering_unavailable'
      ? { version: 1, availability: 'legacy_unavailable', reason: 'ordering_unavailable' }
      : null;
  }
  if (value.availability !== 'available' || !Array.isArray(value.items)) return null;
  if (
    value.items.length > 200 ||
    new TextEncoder().encode(JSON.stringify(value)).byteLength > 64 * 1024 ||
    ('truncated' in value && typeof value.truncated !== 'boolean')
  ) return null;

  const items: AssistantRunTraceItem[] = [];
  const itemIds = new Set<string>();
  const callIds = new Set<string>();
  let priorOrder = -1;
  for (const candidate of value.items) {
    if (!isRecord(candidate)) return null;
    const { item_id: itemId, order, kind } = candidate;
    if (
      !validTraceIdentity(itemId) ||
      itemIds.has(itemId) ||
      !Number.isInteger(order) ||
      (order as number) < 0 ||
      (order as number) <= priorOrder
    ) return null;
    itemIds.add(itemId);
    priorOrder = order as number;

    if (kind === 'thinking') {
      if (typeof candidate.text !== 'string' || candidate.text.length === 0) return null;
      items.push({ itemId, order: order as number, kind: 'thinking', text: candidate.text });
      continue;
    }
    if (kind !== 'tool') return null;
    const callId = candidate.call_id;
    const toolName = candidate.tool_name;
    const lifecycle = candidate.lifecycle;
    const argument = optionalBoundedText(candidate, 'argument_preview', TRACE_ARGUMENT_MAX);
    const result = optionalBoundedText(candidate, 'result_summary', TRACE_RESULT_MAX);
    const error = optionalBoundedText(candidate, 'error_summary', TRACE_ERROR_MAX);
    const duration = candidate.duration_ms;
    if (
      !validTraceIdentity(callId) || callIds.has(callId) ||
      !validTraceIdentity(toolName) ||
      typeof lifecycle !== 'string' || !TRACE_TOOL_LIFECYCLES.has(lifecycle) ||
      !argument.valid || !result.valid || !error.valid ||
      ('duration_ms' in candidate && duration !== null &&
        (typeof duration !== 'number' || !Number.isFinite(duration) || duration < 0))
    ) return null;
    callIds.add(callId);
    items.push({
      itemId,
      order: order as number,
      kind: 'tool',
      callId,
      lifecycle: lifecycle as 'started' | 'succeeded' | 'failed' | 'incomplete',
      toolName,
      ...('argument_preview' in candidate ? { argumentPreview: argument.value } : {}),
      ...('result_summary' in candidate ? { resultSummary: result.value } : {}),
      ...('error_summary' in candidate ? { errorSummary: error.value } : {}),
      ...('duration_ms' in candidate ? { durationMs: duration as number | null } : {}),
    });
  }
  return {
    version: 1,
    availability: 'available',
    items,
    ...('truncated' in value ? { truncated: value.truncated as boolean } : {}),
  };
}

/**
 * Fail-closed message voice projection (B5 read model). Only three strict
 * booleans survive; unknown extra keys are ignored and malformed additive
 * data returns `null` without ever touching canonical content.
 */
export function normalizeVoiceProjection(value: unknown): VoiceProjection | null {
  if (!isRecord(value)) return null;
  const { available, directed, cached } = value;
  if (
    typeof available !== 'boolean' ||
    typeof directed !== 'boolean' ||
    typeof cached !== 'boolean'
  ) {
    return null;
  }
  return { available, directed, cached };
}

function normalizeMessageRow(row: MessageRow): MessageView {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    reasoningContent: row.reasoning_content,
    assistantRunTrace:
      row.role === 'assistant' ? normalizeAssistantRunTrace(row.assistant_run_trace) : null,
    voice: row.role === 'assistant' ? normalizeVoiceProjection(row.voice) : null,
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

/**
 * GET /api/core/projects/ — the single canonical Projects-list owner (P2B §5.2).
 * Bare array; backend order is authoritative. Row guard: a row without a
 * positive integer id + string name cannot produce a valid card link and must
 * surface as an explicit contract error, never as broken UI (P2B §5.3 — "malformed
 * success" is distinguishable from empty/error). This is the minimum identity
 * guard, not a general project validation framework.
 */
export async function listProjects(): Promise<ProjectRow[]> {
  const raw = await apiFetch('/api/core/projects/');
  if (!Array.isArray(raw)) throw contractError('项目列表接口返回格式异常', raw);
  for (const item of raw) {
    const row = item as Record<string, unknown> | null;
    if (
      typeof row !== 'object' ||
      row === null ||
      typeof row.id !== 'number' ||
      !Number.isInteger(row.id) ||
      (row.id as number) <= 0 ||
      typeof row.name !== 'string'
    ) {
      throw contractError('项目列表接口包含异常行', raw);
    }
  }
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
