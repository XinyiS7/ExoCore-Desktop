import type { AppApiError } from '../chat/api';

/**
 * Backend DRF/API error bodies carry `{error}`, `{error, code}` or field maps;
 * surface them instead of the generic transport line. Status-coded fallbacks
 * keep 403/404/409 actionable even when the body is not JSON (Plan §5.3:
 * "Backend field errors and lifecycle {error, code} remain visible").
 */
export function backendErrorText(err: AppApiError | null | undefined): string {
  if (!err) return '';
  const body = err.body as { error?: unknown; code?: unknown } | null;
  if (body && typeof body.error === 'string' && body.error !== '') {
    return body.code && body.code !== '' ? `${body.error}（${String(body.code)}）` : body.error;
  }
  if (err.status === 403) return '没有权限执行该操作。';
  if (err.status === 404) return '目标不存在或已被删除。';
  if (err.status === 409) return '操作冲突，请稍后重试。';
  return err.message;
}