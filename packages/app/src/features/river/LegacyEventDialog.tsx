import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDialogA11y } from '../chat/dialogA11y';
import { AppApiError } from '../chat/api';
import { MemoContent } from '../memo/MemoContent';
import {
  deleteLegacyEvent,
  fetchLegacyEvent,
  isEditableLegacyKind,
  updateLegacyEvent,
  type LegacyEvent,
  type LegacyEventPatch,
  type LegacyKind,
} from './legacyApi';
import './river.css';

export interface LegacyEventDialogProps {
  eventId: number;
  onClose: () => void;
  /** Confirmed PATCH only; `moved` is true when event_time changed. */
  onSaved: (moved: boolean) => void;
  /** Confirmed DELETE only (2xx, 204 empty body); the row is gone in the source. */
  onDeleted: () => void;
  /** Called once when the detail read proves the source left the P3 surface. */
  onSourceChanged: () => void;
}

const KIND_LABELS: Record<LegacyKind, string> = {
  milestone: '里程碑（milestone）',
  highlight: '珍藏片段（highlight，V3 所有）',
  moment: '瞬间（moment）',
};
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const SCOPE_MAX_CODEPOINTS = 50;

interface LegacyDraft {
  event_time: string;
  content: string;
  scope: string;
  keywords: string[];
}

function draftFromEvent(event: LegacyEvent): LegacyDraft {
  return {
    event_time: event.event_time,
    content: event.content,
    scope: event.scope ?? '',
    keywords: [...event.keywords],
  };
}

/**
 * PATCH allowlist only. Identity (`id`/`preset`/`message`/`kind`) is never sent.
 * `keywords` stays one array element per editor row: commas and newlines inside
 * an element are preserved verbatim and nothing is split; empty rows are dropped.
 */
function buildPatch(draft: LegacyDraft): LegacyEventPatch {
  return {
    event_time: draft.event_time.trim(),
    content: draft.content,
    scope: draft.scope === '' ? null : draft.scope,
    keywords: draft.keywords.filter((keyword) => keyword !== ''),
  };
}

function validateDraft(draft: LegacyDraft): string | null {
  if (!DATE_ONLY.test(draft.event_time.trim())) return '事件日期必须是 YYYY-MM-DD 格式。';
  if (draft.content.trim() === '') return '内容不能为空。';
  if (Array.from(draft.scope).length > SCOPE_MAX_CODEPOINTS) {
    return `范围（scope）最多 ${SCOPE_MAX_CODEPOINTS} 个字符。`;
  }
  return null;
}

function errorText(cause: unknown, fallback = '请求失败，请稍后重试。'): string {
  return cause instanceof Error && cause.message.trim() !== '' ? cause.message : fallback;
}

function uncertainSuffix(cause: unknown): string {
  return cause instanceof AppApiError && cause.ambiguousWrite
    ? ' 保存结果不确定，请先刷新核对；本次不会自动重试。'
    : '';
}

/**
 * CP4 Legacy detail: milestone/moment only, permanent delete only.
 *
 * - GET detail is the canonical read; every PATCH writes exactly
 *   event_time/content/scope/keywords and keeps the returned row as the new
 *   canonical detail (identity is preserved by omission, never by application).
 * - event_time changes are reported to the page (`onSaved(moved)`) so traversal
 *   restarts instead of patching a stale cursor chain.
 * - `kind=highlight` (or a 404 on the detail) proves the source left the P3
 *   surface: the dialog exposes NO edit/delete, reports `onSourceChanged` once
 *   and lets the page refresh River.
 * - Delete is behind an explicit irreversible confirmation; cancel sends no
 *   request. Only a confirmed 2xx settles; failures keep the row and the error.
 * - An in-flight write locks closing (ref guard + disabled controls +
 *   `closeDisabledWhileLocked`); failed writes retain the inputs.
 */
export function LegacyEventDialog({
  eventId,
  onClose,
  onSaved,
  onDeleted,
  onSourceChanged,
}: LegacyEventDialogProps) {
  const client = useQueryClient();
  const titleId = useId();
  const queryKey = ['river', 'legacy', eventId] as const;
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => fetchLegacyEvent(eventId, signal),
    retry: false,
  });
  const event = query.data;
  const [draft, setDraft] = useState<LegacyDraft | null>(null);
  const [preview, setPreview] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState<'save' | 'delete' | null>(null);
  const [message, setMessage] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);
  const inFlight = useRef(false);
  const notified = useRef(false);

  useEffect(() => {
    if (event !== undefined && draft === null) setDraft(draftFromEvent(event));
  }, [event, draft]);

  const readError = query.isError ? query.error : null;
  const missing = readError instanceof AppApiError && readError.status === 404;
  const editable = readError === null && event !== undefined && isEditableLegacyKind(event.kind);
  const changed = readError === null && event !== undefined && !isEditableLegacyKind(event.kind);
  const sourceGone = missing || changed;

  useEffect(() => {
    if (sourceGone && !notified.current) {
      notified.current = true;
      onSourceChanged();
    }
  }, [sourceGone, onSourceChanged]);

  const busy = pending !== null;
  const close = () => {
    if (!busy) onClose();
  };
  const dialogRef = useDialogA11y(true, close, { locked: busy, closeDisabledWhileLocked: true });

  const updateDraft = (patch: Partial<LegacyDraft>) =>
    setDraft((current) => (current === null ? null : { ...current, ...patch }));
  const setKeyword = (index: number, value: string) =>
    setDraft((current) => (current === null ? null : {
      ...current,
      keywords: current.keywords.map((keyword, itemIndex) => (itemIndex === index ? value : keyword)),
    }));
  const addKeyword = () =>
    setDraft((current) => (current === null ? null : { ...current, keywords: [...current.keywords, ''] }));
  const removeKeyword = (index: number) =>
    setDraft((current) => (current === null ? null : {
      ...current,
      keywords: current.keywords.filter((_, itemIndex) => itemIndex !== index),
    }));

  const save = async () => {
    if (inFlight.current || busy || !editable || event === undefined || draft === null) return;
    const clientError = validateDraft(draft);
    if (clientError !== null) {
      setMessage({ kind: 'error', text: clientError });
      return;
    }
    const patch = buildPatch(draft);
    inFlight.current = true;
    setPending('save');
    setMessage(null);
    try {
      const saved = await updateLegacyEvent(eventId, patch);
      client.setQueryData<LegacyEvent>(queryKey, saved);
      setDraft(draftFromEvent(saved));
      const moved = saved.event_time !== event.event_time;
      setMessage({
        kind: 'info',
        text: moved
          ? '已保存。事件日期已变更，River 将从首页重新开始遍历。'
          : '已保存。River 将按已加载页面刷新。',
      });
      onSaved(moved);
    } catch (cause) {
      setMessage({ kind: 'error', text: `保存失败：${errorText(cause)}${uncertainSuffix(cause)}` });
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  };

  const remove = async () => {
    if (inFlight.current || busy || event === undefined) return;
    inFlight.current = true;
    setPending('delete');
    setMessage(null);
    try {
      await deleteLegacyEvent(eventId);
      client.removeQueries({ queryKey, exact: true });
      onDeleted();
    } catch (cause) {
      const gone = cause instanceof AppApiError && cause.status === 404;
      const uncertain = cause instanceof AppApiError && cause.ambiguousWrite;
      setMessage({
        kind: 'error',
        text: gone
          ? '删除未获确认：该记录已不存在（可能已被其他来源删除）。请关闭并刷新 River 核对；本窗口不会伪移除该条。'
          : uncertain
            ? `删除结果不确定：${errorText(cause)} 请关闭本窗口并刷新 River 核对；本次不会伪移除，也不会自动重试。`
            : `永久删除失败：${errorText(cause)} 记录仍保留在来源中，本次不会伪移除。`,
      });
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  };

  const readErrorText = readError instanceof AppApiError && readError.status === 403
    ? '没有权限读取此纪事详情。'
    : `纪事详情读取失败：${errorText(readError)}`;

  return createPortal(
    <div
      className="app-overlay legacy-overlay"
      onClick={(event_) => {
        if (event_.target === event_.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="app-dialog legacy-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="app-dialog-head">
          <h2 id={titleId} className="app-h2">历史纪事 #{eventId}</h2>
          <button type="button" className="app-icon-btn" aria-label="关闭纪事详情" disabled={busy} onClick={close}>关闭</button>
        </div>
        <div className="app-dialog-body">
          {message && (
            <div
              className={message.kind === 'error' ? 'app-banner app-banner--error' : 'app-banner'}
              role={message.kind === 'error' ? 'alert' : 'status'}
            >
              {message.text}
            </div>
          )}

          {query.isPending && <p role="status">正在读取纪事详情…</p>}
          {readError !== null && !sourceGone && (
            <div className="app-banner app-banner--error" role="alert">
              <p>{readErrorText}</p>
              <button type="button" className="app-btn app-btn-ghost" disabled={busy} onClick={() => { void query.refetch(); }}>
                重试读取详情
              </button>
            </div>
          )}

          {missing && (
            <section className="legacy-source-changed" role="alert">
              <p>该纪事已不存在（可能已被其他来源删除）。已请求刷新 River；本窗口不提供编辑或删除。</p>
              <button type="button" className="app-btn app-btn-ghost" disabled={busy} onClick={() => { void query.refetch(); }}>
                重新读取详情
              </button>
            </section>
          )}
          {changed && event !== undefined && (
            <section className="legacy-source-changed" role="alert">
              <p>
                来源类型已变为 {KIND_LABELS[event.kind]}，不再属于 milestone/moment 详情范围。
                已请求刷新 River；本窗口不提供编辑或删除。
              </p>
            </section>
          )}

          {readError === null && event !== undefined && (
            <dl className="legacy-identity">
              <div><dt>编号 id</dt><dd>{event.id}</dd></div>
              <div><dt>Agent</dt><dd>{event.preset_name}（preset {event.preset}）</dd></div>
              <div><dt>类型 kind</dt><dd>{KIND_LABELS[event.kind]}</dd></div>
              <div><dt>来源消息</dt><dd>{event.message === null ? '无' : `Message #${event.message}`}</dd></div>
              <div><dt>更新时间</dt><dd>{new Date(event.modified_at).toLocaleString()}</dd></div>
            </dl>
          )}

          {editable && event !== undefined && draft !== null && <>
            <p className="legacy-readonly-note">
              id / preset / message / kind 为来源身份，只读且不随编辑提交；PATCH 只写 event_time、content、scope、keywords。
            </p>

            <label className="app-field" htmlFor="legacy-event-time">
              <span className="app-field-label">事件日期 event_time</span>
              <input
                id="legacy-event-time"
                className="app-input"
                type="date"
                value={draft.event_time}
                disabled={busy}
                onChange={(event_) => updateDraft({ event_time: event_.target.value })}
              />
            </label>

            <label className="app-field" htmlFor="legacy-content">
              <span className="app-field-label">内容 content</span>
              <textarea
                id="legacy-content"
                className="app-input legacy-content-input"
                value={draft.content}
                disabled={busy}
                onChange={(event_) => updateDraft({ content: event_.target.value })}
              />
            </label>
            <div className="legacy-preview-row">
              <button type="button" className="app-btn app-btn-ghost" aria-pressed={preview} disabled={busy} onClick={() => setPreview((open) => !open)}>
                {preview ? '隐藏 Markdown 预览' : '显示 Markdown 预览'}
              </button>
            </div>
            {preview && <div className="legacy-preview"><MemoContent content={draft.content} /></div>}

            <label className="app-field" htmlFor="legacy-scope">
              <span className="app-field-label">范围 scope（可空，最多 {SCOPE_MAX_CODEPOINTS} 字）</span>
              <input
                id="legacy-scope"
                className="app-input"
                type="text"
                maxLength={SCOPE_MAX_CODEPOINTS}
                value={draft.scope}
                disabled={busy}
                onChange={(event_) => updateDraft({ scope: event_.target.value })}
              />
            </label>

            <div className="app-field legacy-keywords">
              <span className="app-field-label">关键词 keywords（每个输入框一个元素；原样保留逗号与换行，不按标点拆分）</span>
              <div className="legacy-keyword-rows" role="group" aria-label="关键词列表">
                {draft.keywords.map((keyword, index) => (
                  <div key={index} className="legacy-keyword-row">
                    <textarea
                      className="app-input legacy-keyword-input"
                      aria-label={`关键词 ${index + 1}`}
                      rows={1}
                      value={keyword}
                      disabled={busy}
                      onChange={(event_) => setKeyword(index, event_.target.value)}
                    />
                    <button
                      type="button"
                      className="app-btn app-btn-ghost"
                      aria-label={`删除关键词 ${index + 1}`}
                      disabled={busy}
                      onClick={() => removeKeyword(index)}
                    >删除</button>
                  </div>
                ))}
                <div className="app-dialog-actions legacy-keyword-actions">
                  <button type="button" className="app-btn app-btn-ghost" disabled={busy} onClick={addKeyword}>＋ 添加关键词</button>
                </div>
                {draft.keywords.length === 0 && <p className="legacy-readonly-note">暂无关键词；添加后每个输入框仍对应一个数组元素。</p>}
              </div>
            </div>

            {!confirming ? (
              <div className="app-dialog-actions">
                <button type="button" className="app-btn app-btn-ghost" disabled={busy} onClick={close}>取消</button>
                <button type="button" className="app-btn app-btn--primary" disabled={busy} onClick={() => { void save(); }}>
                  {pending === 'save' ? '保存中…' : '保存修改'}
                </button>
                <button type="button" className="app-btn legacy-danger-button" disabled={busy} onClick={() => { setMessage(null); setConfirming(true); }}>
                  永久删除…
                </button>
              </div>
            ) : (
              <div className="legacy-delete-confirm" role="alert">
                <p><strong>永久删除</strong>历史纪事 #{event.id}？</p>
                <p>
                  删除不可恢复，也不会进入归档、不保留副本；这与 Task 的软归档（archived）语义不同，成功后该条目会从 River 移除。
                  取消不会发出任何请求。
                </p>
                <div className="app-dialog-actions">
                  <button type="button" className="app-btn app-btn-ghost" disabled={busy} onClick={() => setConfirming(false)}>取消删除</button>
                  <button type="button" className="app-btn legacy-danger-button" disabled={busy} onClick={() => { void remove(); }}>
                    {pending === 'delete' ? '永久删除中…' : '确认永久删除'}
                  </button>
                </div>
              </div>
            )}
          </>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
