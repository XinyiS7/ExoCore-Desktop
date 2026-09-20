import { getCsrfToken } from 'exo-shared/api';
import { AppApiError, isValidClientTurnId } from '../api';
import type {
  AsyncAckResponse,
  BranchResponse,
  ChatRuntimeError,
  PollingStatusResponse,
  RetrySafetyClass,
  StopResponse,
} from './types';
import { POLLING_STATUSES } from './types';

/**
 * Raw Transport Client for V4 Chat Runtime
 * Strictly implements Plan §5.1–§5.5 and §6.6.
 */

export interface PostChatOptions {
  conversationId: number;
  content: string;
  /** Normalized Conversation thinking level ('' or null => 'auto', §5.1). */
  thinkingLevel?: string | null;
  /** P1D target and per-turn controls. Runtime captures these before POST. */
  model?: string;
  endpoint?: number;
  cacheEnabled?: boolean;
  sessionType?: 'full' | 'lite';
  /** Present only for g045. */
  memoryInjectionEnabled?: boolean;
  editMessageId?: number;
  /**
   * A+ exact correlation for ordinary sends: exactly one freshly generated
   * UUID per POST attempt, shared with that attempt's optimistic user row.
   * Serialized as `client_turn_id`; never set for edit/regenerate.
   */
  clientTurnId?: string;
  /**
   * P1C: validated positive attachment IDs to attach to this turn
   * (serialized as `pending_attachments`, Task 1.5). Omitted for text-only.
   * Ownership: only positive integers that passed attachment adapter
   * validation may ever reach this field.
   */
  pendingAttachments?: number[];
  /**
   * Explicit Force Cache send (V3 capability recovery): serializes
   * `force_cache_rebuild=true` ONLY when explicitly true. Ordinary sends
   * omit the field; backend `cache_skipped` stays the authoritative feedback
   * for platforms without remote cache support.
   */
  forceCacheRebuild?: boolean;
  signal?: AbortSignal;
}

export interface PostBranchOptions {
  conversationId: number;
  branchFromMessageId: number;
  signal?: AbortSignal;
}

function normalizeThinkingLevel(level: string | null | undefined): string {
  // §5.1: preserve non-empty existing Conversation thinking_level; legacy
  // null/empty values map to 'auto' instead of the POST default 'medium'.
  if (typeof level === 'string' && level.trim() !== '') {
    return level.trim();
  }
  return 'auto';
}

function buildChatBody(options: PostChatOptions): Record<string, unknown> {
  const body: Record<string, unknown> = {
    content: options.content,
    thinking_level: normalizeThinkingLevel(options.thinkingLevel),
  };
  const hasTarget = options.model !== undefined || options.endpoint !== undefined;
  if (hasTarget) {
    const model = options.model?.trim() ?? '';
    if (!model || !Number.isInteger(options.endpoint) || (options.endpoint as number) <= 0) {
      throw new AppApiError('当前模型或端点不可用，请重新选择。', { code: 'TARGET_INVALID' });
    }
    body.model = model;
    body.endpoint = options.endpoint;
  }
  if (options.cacheEnabled !== undefined) {
    if (typeof options.cacheEnabled !== 'boolean') {
      throw new AppApiError('缓存开关格式异常', { code: 'VALIDATION' });
    }
    body.cache_enabled = options.cacheEnabled;
  }
  if (options.forceCacheRebuild !== undefined) {
    if (typeof options.forceCacheRebuild !== 'boolean') {
      throw new AppApiError('缓存重建开关格式异常', { code: 'VALIDATION' });
    }
    // Explicit Force Cache send only: false/undefined must never serialize
    // the wire field (普通发送绝不能误带 true).
    if (options.forceCacheRebuild) body.force_cache_rebuild = true;
  }
  if (options.sessionType !== undefined) {
    if (options.sessionType !== 'full' && options.sessionType !== 'lite') {
      throw new AppApiError('历史模式格式异常', { code: 'VALIDATION' });
    }
    body.session_type = options.sessionType;
  }
  if (options.memoryInjectionEnabled !== undefined) {
    if (typeof options.memoryInjectionEnabled !== 'boolean') {
      throw new AppApiError('记忆开关格式异常', { code: 'VALIDATION' });
    }
    body.memory_injection_enabled = options.memoryInjectionEnabled;
  }
  if (options.editMessageId !== undefined) {
    if (!Number.isInteger(options.editMessageId) || options.editMessageId <= 0) {
      throw new AppApiError('无效的消息编号', { code: 'VALIDATION' });
    }
    body.edit_message_id = options.editMessageId;
  }
  if (options.clientTurnId !== undefined) {
    // A+ ordinary-send correlation: one canonical UUID per POST attempt. A
    // malformed value is a contract violation, never silently dropped,
    // coerced, or replaced by a fallback id.
    if (!isValidClientTurnId(options.clientTurnId)) {
      throw new AppApiError('消息相关性标识格式异常', { code: 'VALIDATION' });
    }
    body.client_turn_id = options.clientTurnId;
  }
  if (options.pendingAttachments !== undefined) {
    // Task 1.5: serialize only after integer/positive validation; a malformed
    // list is a contract violation, never silently dropped or coerced.
    if (!Array.isArray(options.pendingAttachments)) {
      throw new AppApiError('附件参数格式异常', { code: 'VALIDATION' });
    }
    for (const id of options.pendingAttachments) {
      if (!Number.isInteger(id) || id <= 0) {
        throw new AppApiError('附件参数包含无效编号', { code: 'VALIDATION' });
      }
    }
    body.pending_attachments = options.pendingAttachments;
  }
  return body;
}

/** Extract a machine-readable backend code from an HTTP error body (Task 2.5). */
function machineCodeOf(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const b = body as { code?: unknown; error?: unknown; detail?: unknown };
  if (typeof b.code === 'string' && b.code) return b.code;
  if (typeof b.error === 'string' && b.error) return undefined; // human message
  if (typeof b.error === 'object' && b.error !== null) {
    const e = b.error as { code?: unknown; message?: unknown };
    if (typeof e.code === 'string' && e.code) return e.code;
  }
  if (typeof b.detail === 'object' && b.detail !== null) {
    const d = b.detail as { code?: unknown };
    if (typeof d.code === 'string' && d.code) return d.code;
  }
  return undefined;
}

/** Extract a human message from an HTTP error body. */
function messageOf(body: unknown, fallback: string): string {
  if (typeof body !== 'object' || body === null) return fallback;
  const b = body as { message?: unknown; error?: unknown; detail?: unknown };
  if (typeof b.message === 'string' && b.message) return b.message;
  if (typeof b.error === 'string' && b.error) return b.error;
  if (typeof b.error === 'object' && b.error !== null) {
    const e = b.error as { message?: unknown };
    if (typeof e.message === 'string' && e.message) return e.message;
  }
  if (typeof b.detail === 'string' && b.detail) return b.detail;
  return fallback;
}

/** Map unknown error to ChatRuntimeError with explicit retry classification (§6.6). */
export function classifyRuntimeError(
  cause: unknown,
  fallbackRetryClass: RetrySafetyClass = 'uncertain',
): ChatRuntimeError {
  if (cause && typeof cause === 'object' && 'retryClass' in cause && 'code' in cause) {
    return cause as ChatRuntimeError;
  }

  const err = cause as {
    message?: string;
    status?: unknown;
    code?: string;
    name?: string;
    body?: unknown;
  };
  const status =
    typeof err?.status === 'number'
      ? err.status
      : cause instanceof AppApiError
        ? cause.status
        : null;

  if (cause instanceof AppApiError && cause.ambiguousWrite) {
    return {
      code: cause.code,
      message: cause.message,
      retryClass: 'uncertain',
      status: cause.status,
      raw: cause.body,
    };
  }

  if (status !== null && status >= 400 && status < 500) {
    return {
      code: (err?.code as string) || (cause instanceof AppApiError ? cause.code : 'CLIENT_ERROR'),
      message: err?.message || '请求参数或状态错误',
      retryClass: 'safe',
      status,
      raw: err?.body ?? cause,
    };
  }

  // Typed backend payloads (e.g. SSE `error` event or poll error_message with
  // {code, message}) must keep their machine-readable code — including
  // `stream_crashed`, which stays a reconciliation-required outcome, never an
  // invented edit-specific error (C1B-R1-04).
  if (cause && typeof cause === 'object' && typeof (cause as { code?: unknown }).code === 'string') {
    const typed = cause as { code?: string; message?: string; status?: unknown };
    return {
      code: typed.code as string,
      message: typed.message || '后台返回错误',
      retryClass: fallbackRetryClass,
      status: typeof typed.status === 'number' ? typed.status : status,
      raw: cause,
    };
  }

  if (err?.name === 'AbortError') {
    return {
      code: 'ABORTED',
      message: '请求已取消',
      retryClass: 'safe',
      status: null,
      raw: cause,
    };
  }

  if (cause instanceof TypeError || err?.name === 'TypeError') {
    return {
      code: 'NETWORK_ERROR',
      message: '网络连接异常或流式传输中断',
      retryClass: fallbackRetryClass,
      status: null,
      raw: cause,
    };
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: err?.message || '未知运行错误',
    retryClass: fallbackRetryClass,
    status: typeof err?.status === 'number' ? err.status : null,
    raw: cause,
  };
}

/**
 * Raw streaming fetch for SSE chat turn.
 * Does NOT use JSON apiFetch to avoid buffering whole response in memory.
 */
export async function fetchChatSSEStream(options: PostChatOptions): Promise<Response> {
  const url = `/api/agents/chat/${options.conversationId}/`;
  const body = JSON.stringify(buildChatBody(options));

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken(),
      },
      credentials: 'include',
      body,
      signal: options.signal,
    });
  } catch (netErr) {
    throw classifyRuntimeError(netErr, 'uncertain');
  }

  if (!res.ok) {
    let errBody: unknown;
    try {
      errBody = await res.json();
    } catch {
      errBody = await res.text().catch(() => null);
    }
    const msg = messageOf(errBody, `请求失败 (${res.status})`);
    throw new AppApiError(msg, {
      status: res.status,
      body: errBody,
      code: machineCodeOf(errBody) ?? 'HTTP_ERROR',
    });
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('text/event-stream')) {
    throw new AppApiError(`服务器返回了非流式响应类型: ${contentType}`, {
      status: res.status,
      code: 'PROTOCOL_ERROR',
      ambiguousWrite: true,
    });
  }

  if (!res.body) {
    throw new AppApiError('服务器未返回响应流主体', {
      status: res.status,
      code: 'PROTOCOL_ERROR',
      ambiguousWrite: true,
    });
  }

  return res;
}

/**
 * POST /api/agents/chat/<conversationId>/?mode=async
 * Acknowledges async generation token.
 */
export async function postChatAsync(options: PostChatOptions): Promise<AsyncAckResponse> {
  const url = `/api/agents/chat/${options.conversationId}/?mode=async`;
  const body = JSON.stringify(buildChatBody(options));

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken(),
      },
      credentials: 'include',
      body,
      signal: options.signal,
    });
  } catch (netErr) {
    throw classifyRuntimeError(netErr, 'uncertain');
  }

  if (!res.ok) {
    let errBody: unknown;
    try {
      errBody = await res.json();
    } catch {
      errBody = null;
    }
    throw new AppApiError(messageOf(errBody, `异步会话启动失败 (${res.status})`), {
      status: res.status,
      body: errBody,
      code: machineCodeOf(errBody) ?? 'HTTP_ERROR',
    });
  }

  let data: AsyncAckResponse;
  try {
    data = (await res.json()) as AsyncAckResponse;
  } catch {
    throw new AppApiError('异步启动响应解析失败', {
      status: res.status,
      code: 'CONTRACT',
      ambiguousWrite: true,
    });
  }

  if (typeof data?.message_id !== 'string' || data.message_id.trim() === '') {
    throw new AppApiError('异步任务启动成功但未返回有效的恢复凭据', {
      status: res.status,
      body: data,
      code: 'CONTRACT',
      ambiguousWrite: true,
    });
  }
  if (data?.status !== 'processing') {
    // §5.3: canonical ack status is 'processing'; anything else is a malformed
    // accepted response whose write outcome is unknown.
    throw new AppApiError(`异步任务启动响应状态异常: ${String(data?.status)}（应为 processing）`, {
      status: res.status,
      body: data,
      code: 'CONTRACT',
      ambiguousWrite: true,
    });
  }

  return data;
}

/**
 * GET /api/agents/chat/<conversationId>/status/?message_id=<token>&cursor=<int>
 * Polls incremental events. Monotonic event-index cursor.
 */
export async function pollChatStatus(
  conversationId: number,
  token: string,
  cursor: number,
  signal?: AbortSignal,
): Promise<PollingStatusResponse> {
  const params = new URLSearchParams({
    message_id: token,
    cursor: String(cursor),
  });
  const url = `/api/agents/chat/${conversationId}/status/?${params.toString()}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'include',
      signal,
    });
  } catch (netErr) {
    // Transient network failure during polling is recoverable without discarding token
    throw classifyRuntimeError(netErr, 'recoverable');
  }

  if (!res.ok) {
    let errBody: unknown;
    try {
      errBody = await res.json();
    } catch {
      errBody = null;
    }
    throw new AppApiError(messageOf(errBody, `轮询状态失败 (${res.status})`), {
      status: res.status,
      body: errBody,
      code: machineCodeOf(errBody) ?? 'POLL_HTTP_ERROR',
    });
  }

  let data: PollingStatusResponse;
  try {
    data = (await res.json()) as PollingStatusResponse;
  } catch {
    throw new AppApiError('轮询响应格式异常', {
      status: res.status,
      code: 'CONTRACT',
    });
  }

  // Strict envelope validation (C1B-R1-04/R2-03): allowed status, finite
  // nonnegative integer cursor, event-count cursor consistency, delta presence,
  // error_message typing. A violation is a protocol error, never a success.
  if (typeof data !== 'object' || data === null) {
    throw new AppApiError('轮询数据字段缺失或类型异常', {
      status: res.status,
      body: data,
      code: 'CONTRACT',
    });
  }
  if (!POLLING_STATUSES.includes(data.status as never)) {
    throw new AppApiError(`未知的轮询状态: ${String((data as { status?: unknown }).status)}`, {
      status: res.status,
      body: data,
      code: 'CONTRACT',
    });
  }
  if (!Number.isInteger(data.cursor) || (data.cursor as number) < 0) {
    throw new AppApiError('轮询 cursor 必须是非负整数', {
      status: res.status,
      body: data,
      code: 'CONTRACT',
    });
  }
  if (!Array.isArray(data.events)) {
    throw new AppApiError('轮询 events 字段缺失或类型异常', {
      status: res.status,
      body: data,
      code: 'CONTRACT',
    });
  }
  for (const item of data.events) {
    if (
      typeof item !== 'object' ||
      item === null ||
      typeof (item as { event_type?: unknown }).event_type !== 'string'
    ) {
      throw new AppApiError('轮询事件项缺少 event_type 字段', {
        status: res.status,
        body: data,
        code: 'CONTRACT',
      });
    }
    if (!('delta' in (item as object))) {
      throw new AppApiError('轮询事件项缺少 delta 字段', {
        status: res.status,
        body: data,
        code: 'CONTRACT',
      });
    }
  }
  if (data.status !== 'not_found') {
    if (
      'error_message' in data &&
      data.error_message !== null &&
      typeof data.error_message !== 'string' &&
      !(typeof data.error_message === 'object' && !Array.isArray(data.error_message))
    ) {
      throw new AppApiError('轮询 error_message 类型异常（应为字符串或对象）', {
        status: res.status,
        body: data,
        code: 'CONTRACT',
      });
    }
    // Backend get_delta(): cursor === requested cursor + returned event count.
    // Nonempty events MUST advance the cursor by their own count; replay or
    // regression envelopes are rejected.
    const expectedCursor = cursor + data.events.length;
    if ((data.cursor as number) !== expectedCursor) {
      throw new AppApiError(
        data.cursor < expectedCursor
          ? `轮询 cursor 出现回退或未按事件数推进（期望 ${expectedCursor}，实得 ${data.cursor}）`
          : `轮询 cursor 超前于事件数（期望 ${expectedCursor}，实得 ${data.cursor}）`,
        {
          status: res.status,
          body: data,
          code: 'CONTRACT',
        },
      );
    }
  }

  return data;
}

/**
 * POST /api/agents/chat/<conversationId>/stop/
 * Stop active generation. Transport-aware:
 * - SSE: bare endpoint
 * - Async: ?message_id=<token>
 */
export async function postChatStop(
  conversationId: number,
  asyncToken?: string,
  signal?: AbortSignal,
): Promise<{ ok: boolean; status: 'stop_requested' | 'not_found' | 'error' }> {
  let url = `/api/agents/chat/${conversationId}/stop/`;
  if (asyncToken) {
    url += `?message_id=${encodeURIComponent(asyncToken)}`;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken(),
      },
      credentials: 'include',
      signal,
    });
  } catch (netErr) {
    throw classifyRuntimeError(netErr, 'uncertain');
  }

  if (res.status === 404) {
    // Terminal race: generation finished or already gone before stop arrived
    return { ok: false, status: 'not_found' };
  }

  if (!res.ok) {
    let errBody: unknown;
    try {
      errBody = await res.json();
    } catch {
      errBody = null;
    }
    throw new AppApiError(messageOf(errBody, `停止请求失败 (${res.status})`), {
      status: res.status,
      body: errBody,
      code: machineCodeOf(errBody) ?? 'STOP_ERROR',
    });
  }

  // R2-03: 200 requires a parseable {status:'stop_requested'} body. Malformed
  // accepted responses are a visible uncertain stop state — never invented as
  // an accepted stop.
  let data: StopResponse;
  try {
    data = (await res.json()) as StopResponse;
  } catch {
    throw new AppApiError('停止请求已受理但响应无法解析（结果不确定）', {
      status: res.status,
      code: 'STOP_CONTRACT',
      ambiguousWrite: true,
    });
  }
  if (typeof data !== 'object' || data === null || data.status !== 'stop_requested') {
    throw new AppApiError('停止请求已受理但响应状态异常（结果不确定）', {
      status: res.status,
      body: data,
      code: 'STOP_CONTRACT',
      ambiguousWrite: true,
    });
  }

  return { ok: true, status: 'stop_requested' };
}

/**
 * POST /api/agents/conversations/<conversationId>/branch/
 * Branch a new Conversation from an assistant Message.
 * Invariant: Must return canonical conversation_id. Never reads session_id.
 */
export async function postConversationBranch(options: PostBranchOptions): Promise<{ conversationId: number; name: string }> {
  if (!Number.isInteger(options.branchFromMessageId) || options.branchFromMessageId <= 0) {
    throw new AppApiError('无效的目标消息编号', { code: 'VALIDATION' });
  }

  const url = `/api/agents/conversations/${options.conversationId}/branch/`;
  const body = JSON.stringify({ branch_from_message_id: options.branchFromMessageId });

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken(),
      },
      credentials: 'include',
      body,
      signal: options.signal,
    });
  } catch (netErr) {
    throw classifyRuntimeError(netErr, 'uncertain');
  }

  if (!res.ok) {
    let errBody: unknown;
    try {
      errBody = await res.json();
    } catch {
      errBody = null;
    }
    throw new AppApiError(messageOf(errBody, `创建分支失败 (${res.status})`), {
      status: res.status,
      body: errBody,
      code: machineCodeOf(errBody) ?? 'HTTP_ERROR',
    });
  }

  let data: BranchResponse;
  try {
    data = (await res.json()) as BranchResponse;
  } catch {
    throw new AppApiError('分支创建成功，但返回的数据无法解析；请在“最近会话”中确认。', {
      status: res.status,
      code: 'CONTRACT',
      ambiguousWrite: true,
    });
  }

  const canonicalId = data?.conversation_id;
  if (!Number.isInteger(canonicalId) || (canonicalId as number) <= 0) {
    throw new AppApiError('分支创建成功，但返回缺少有效的会话编号（conversation_id）；结果不确定。请在“最近会话”中查找。', {
      status: res.status,
      body: data,
      code: 'CONTRACT',
      ambiguousWrite: true,
    });
  }

  return {
    conversationId: canonicalId as number,
    name: data.name || `Branch from ${options.conversationId}`,
  };
}
