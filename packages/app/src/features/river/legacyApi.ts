/**
 * CP4 Legacy (Chronicle) detail adapter.
 *
 * Read-only contract study (no backend edit): the authoritative source is the
 * real `ChronicleEntry` model + `ChronicleEntrySerializer` + `ChronicleEntryViewSet`
 * in the agents app. `ReactSheet.md` has no Chronicle detail contract, so the
 * actual serializer is the field authority and no field is invented here.
 *
 * Endpoint: `/api/agents/chronicle/<id>/` GET / PATCH / DELETE.
 * - PATCH writes exactly `event_time`, `content`, `scope`, `keywords`;
 *   identity (`id`, `preset`, `preset_name`, `kind`, `message`) and
 *   `modified_at` are preserved and never sent back as write input.
 * - DELETE is the model's permanent delete (204, empty body). No soft-archive
 *   semantics exist on this endpoint.
 * - `kind` is returned for every real choice (milestone/highlight/moment) so
 *   the dialog can detect a source that left the P3 milestone/moment surface.
 */

import { apiFetch } from 'exo-shared/api';
import { AppApiError, contractError, toAppApiError } from '../chat/api';

export const LEGACY_KINDS = ['milestone', 'highlight', 'moment'] as const;
export type LegacyKind = (typeof LEGACY_KINDS)[number];

/** Exact `ChronicleEntrySerializer` response shape. */
export interface LegacyEvent {
  id: number;
  preset: number;
  preset_name: string;
  /** DateField -> `YYYY-MM-DD` */
  event_time: string;
  content: string;
  scope: string | null;
  kind: LegacyKind;
  /** Source Message pk or null; identity only. */
  message: number | null;
  keywords: string[];
  modified_at: string;
}

/** PATCH allowlist — identity/read-only fields are absent by type. */
export interface LegacyEventPatch {
  event_time: string;
  content: string;
  scope: string | null;
  keywords: string[];
}

/** P3 owns only milestone/moment; highlight/bookmark stays V3-owned. */
export function isEditableLegacyKind(kind: LegacyKind): kind is 'milestone' | 'moment' {
  return kind === 'milestone' || kind === 'moment';
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function record(value: unknown, message: string): Record<string, unknown> {
  if (!isRecord(value)) throw contractError(message, value);
  return value;
}

function text(value: unknown, message: string): string {
  if (typeof value !== 'string') throw contractError(message, value);
  return value;
}

function nullableText(value: unknown, message: string): string | null {
  return value === null ? null : text(value, message);
}

function integer(value: unknown, minimum: number, message: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) {
    throw contractError(message, value);
  }
  return value;
}

function strings(value: unknown, message: string): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw contractError(message, value);
  }
  return [...value];
}

function dateOnly(value: unknown, message: string): string {
  const result = text(value, message);
  if (!DATE_ONLY.test(result)) throw contractError(message, value);
  return result;
}

function timestamp(value: unknown, message: string): string {
  const result = text(value, message);
  if (Number.isNaN(Date.parse(result))) throw contractError(message, value);
  return result;
}

function kind(value: unknown, message: string): LegacyKind {
  if (!LEGACY_KINDS.includes(value as LegacyKind)) throw contractError(message, value);
  return value as LegacyKind;
}

/** Maps transport/contract failures into the canonical AppApiError, keeping status/body/flags. */
function legacyError(cause: unknown, ambiguousWrite = false): AppApiError {
  const error = toAppApiError(cause);
  const body = isRecord(error.body) ? error.body : null;
  const message =
    typeof body?.detail === 'string' && body.detail !== ''
      ? body.detail
      : typeof body?.error === 'string' && body.error !== ''
        ? body.error
        : Object.values(error.fieldErrors)[0] ?? error.message;
  return new AppApiError(message, {
    status: error.status,
    body: error.body,
    code: typeof body?.code === 'string' ? body.code : error.code,
    fieldErrors: error.fieldErrors,
    ambiguousWrite: ambiguousWrite || error.ambiguousWrite,
  });
}

/** Network/lost response, 5xx or an unverifiable 2xx envelope = unknown write outcome. */
function legacyWriteError(cause: unknown): AppApiError {
  const error = toAppApiError(cause);
  const uncertain = error.status === null || error.status >= 500 || error.code === 'CONTRACT';
  return legacyError(error, uncertain);
}

export function normalizeLegacyEvent(value: unknown): LegacyEvent {
  const row = record(value, '纪事详情格式异常');
  return {
    id: integer(row.id, 1, '纪事编号异常'),
    preset: integer(row.preset, 1, '纪事 Agent 异常'),
    preset_name: text(row.preset_name, '纪事 Agent 名称异常'),
    event_time: dateOnly(row.event_time, '纪事日期异常'),
    content: text(row.content, '纪事内容异常'),
    scope: nullableText(row.scope, '纪事范围异常'),
    kind: kind(row.kind, '纪事类型异常'),
    message: row.message === null ? null : integer(row.message, 1, '纪事来源消息异常'),
    keywords: strings(row.keywords, '纪事关键词格式异常'),
    modified_at: timestamp(row.modified_at, '纪事更新时间异常'),
  };
}

/** GET `/api/agents/chronicle/<id>/`. */
export async function fetchLegacyEvent(id: number, signal?: AbortSignal): Promise<LegacyEvent> {
  try {
    const event = normalizeLegacyEvent(await apiFetch(`/api/agents/chronicle/${id}/`, { method: 'GET', signal }));
    if (event.id !== id) throw contractError('纪事详情定位不一致', event);
    return event;
  } catch (cause) {
    throw legacyError(cause);
  }
}

/** PATCH `/api/agents/chronicle/<id>/` — 200 current serializer row. */
export async function updateLegacyEvent(id: number, patch: LegacyEventPatch): Promise<LegacyEvent> {
  try {
    const event = normalizeLegacyEvent(await apiFetch(`/api/agents/chronicle/${id}/`, { method: 'PATCH', body: patch }));
    if (event.id !== id) throw contractError('纪事更新返回身份不一致', event);
    return event;
  } catch (cause) {
    throw legacyWriteError(cause);
  }
}

/**
 * DELETE `/api/agents/chronicle/<id>/` — permanent delete, 204 with an empty
 * body. `apiFetch` yields `''` for 204; no JSON is assumed or parsed. A non-2xx
 * stays a failure and the caller must not remove the record locally.
 */
export async function deleteLegacyEvent(id: number): Promise<void> {
  try {
    await apiFetch(`/api/agents/chronicle/${id}/`, { method: 'DELETE' });
  } catch (cause) {
    throw legacyWriteError(cause);
  }
}
