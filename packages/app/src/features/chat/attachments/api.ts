import { AppApiError } from '../api';
import { getCsrfToken } from 'exo-shared/api';
import type {
  AttachmentListRow,
  AttachmentSource,
  AttachmentUploadOutcome,
  AudioTarget,
  DeleteAttachmentBody,
  DeleteAttachmentOutcome,
  FrozenCacheDeleteBody,
} from './types';

/**
 * P1C Attachment wire adapters (Task 1).
 *
 * - multipart upload with CSRF/credentials; 201 AND 422 bodies are preserved
 *   whole and returned as `AttachmentUploadOutcome` — `results` remains the
 *   sole ownership source (Plan §2.3, Gate B).
 * - list returns the bare mixed-source array, normalized to typed rows.
 * - delete preserves the 409 frozen-cache body fields and maps 204 distinctly.
 * - any other status is an `AppApiError` (never a manufactured success).
 */

const UPLOAD_PATH = (conversationId: number) =>
  `/api/agents/conversations/${conversationId}/attachments/`;
const DELETE_PATH = (conversationId: number) =>
  `/api/agents/conversations/${conversationId}/attachments/delete/`;

/**
 * POST .../attachments/ — one multipart request.
 * `target` is required only when the batch contains audio (frozen contract).
 */
export async function uploadAttachments(
  conversationId: number,
  files: File[],
  target: AudioTarget | null,
  signal?: AbortSignal,
): Promise<AttachmentUploadOutcome> {
  if (!Number.isInteger(conversationId) || conversationId <= 0) {
    throw new AppApiError('无效的会话编号', { code: 'VALIDATION' });
  }
  if (!files.length) {
    throw new AppApiError('至少需要一个文件', { code: 'VALIDATION' });
  }

  const form = new FormData();
  for (const file of files) form.append('files', file);
  if (target) {
    form.append('model', target.model);
    form.append('endpoint', String(target.endpoint));
  }

  let res: Response;
  try {
    res = await fetch(UPLOAD_PATH(conversationId), {
      method: 'POST',
      headers: { 'X-CSRFToken': getCsrfToken() },
      credentials: 'include',
      body: form,
      signal,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') {
      throw new AppApiError('上传已取消', { code: 'ABORTED' });
    }
    throw new AppApiError('网络连接失败，上传未完成', { status: null });
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (res.status === 201 || res.status === 422) {
    // Keep BOTH bodies whole: 201 may be partial success, 422 all-failed but
    // still carries the authoritative ordered `results` (Plan §2.3, Gate B).
    const payload = (data ?? {}) as AttachmentUploadOutcome['payload'];
    return { status: res.status as 201 | 422, payload };
  }

  throw new AppApiError(
    (data as { error?: string })?.error ?? `上传失败 (${res.status})`,
    { status: res.status, body: data, code: 'UPLOAD_ERROR' },
  );
}

/** GET .../attachments/ — bare mixed-source array (frozen; no envelope). */
export async function listConversationAttachments(
  conversationId: number,
  signal?: AbortSignal,
): Promise<AttachmentListRow[]> {
  const res = await fetch(UPLOAD_PATH(conversationId), {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'include',
    signal,
  });
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      /* ignore */
    }
    throw new AppApiError(
      (body as { error?: string })?.error ?? `附件列表加载失败 (${res.status})`,
      { status: res.status, body, code: 'LIST_ERROR' },
    );
  }
  const data: unknown = await res.json();
  if (!Array.isArray(data)) {
    throw new AppApiError('附件列表接口返回格式异常', { body: data, code: 'CONTRACT' });
  }
  return data as AttachmentListRow[];
}

/**
 * DELETE .../attachments/delete/ — single unlink with exactly one {source,id}.
 * 204 → ok; 409 frozen-cache body preserved for guidance; other failures keep
 * the error visible and mutate nothing (Gate H).
 */
export async function deleteConversationAttachment(
  conversationId: number,
  body: DeleteAttachmentBody,
  signal?: AbortSignal,
): Promise<DeleteAttachmentOutcome> {
  if (body.source !== 'user' && body.source !== 'tool_collection') {
    throw new AppApiError('无效的附件来源', { code: 'VALIDATION' });
  }
  if (body.id === undefined || body.id === null || body.id === '') {
    throw new AppApiError('无效的附件编号', { code: 'VALIDATION' });
  }

  let res: Response;
  try {
    res = await fetch(DELETE_PATH(conversationId), {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken(),
      },
      credentials: 'include',
      body: JSON.stringify(body),
      signal,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') {
      throw new AppApiError('删除请求已取消', { code: 'ABORTED' });
    }
    throw new AppApiError('网络连接失败，删除未完成', { status: null });
  }

  if (res.status === 204) return { ok: true, status: 204 };

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* ignore */
  }

  if (res.status === 409) {
    const frozen = data as Partial<FrozenCacheDeleteBody>;
    const message = frozen?.detail || frozen?.error || '此附件已冻结在远端缓存中，无法删除。';
    return {
      ok: false,
      status: 409,
      frozen: true,
      message,
      body: {
        error: frozen?.error || message,
        detail: frozen?.detail || '',
        frozen_in_cache: true,
        cache_name: frozen?.cache_name,
      },
    };
  }

  return {
    ok: false,
    status: res.status,
    frozen: false,
    message: (data as { error?: string })?.error ?? `删除失败 (${res.status})`,
  };
}

/** Stable user-facing audio upload error text (mirrors frozen backend codes). */
export function audioUploadErrorMessage(
  err: { status?: number | null; body?: unknown; message?: string; code?: string },
): string {
  const body = err?.body as {
    failures?: Array<{ code?: string }>;
    error?: string;
    results?: Array<{ diagnostics?: Array<{ code?: string }> }>;
  } | null;
  const code =
    body?.failures?.[0]?.code ??
    body?.results?.find((r) => r.diagnostics?.length)?.['diagnostics']?.[0]?.code ??
    null;
  switch (code) {
    case 'audio_too_large':
      return '语音超过 10 MiB 上限';
    case 'audio_mime_unsupported':
      return '语音格式不被支持';
    case 'audio_model_unsupported':
      return '当前模型不支持语音';
    case 'audio_target_required':
      return '语音上传缺少目标配置';
    case 'attachment_upload_failed':
      return '语音上传失败';
    default:
      return err?.message ?? `语音上传失败（${err?.status ?? '网络错误'}）`;
  }
}

export type { AttachmentSource };