import { useCallback, useEffect, useRef, useState } from 'react';
import { Pencil, Plus, X } from 'lucide-react';
import { useDialogA11y } from '../chat/dialogA11y';
import { AppApiError, toAppApiError } from '../chat/api';
import { EmptyState, ErrorState, LoadingState } from '../../shared/AsyncState';
import { useProjectKnowledgeQuery, useUpdateProjectKnowledgeMutation } from './queries';
import { backendErrorText } from './errors';
import { knowledgeAbstractLabel, knowledgeSourceLabel, keywordsEqual } from './projection';
import { formatDateTime } from '../chat/time';
import type { ProjectKnowledgeRow } from './types';

/**
 * P2B Project Knowledge section (Plan §6.4, D2).
 *
 * Separate from Files: rows are semantic fragments (title/source/tags/
 * keywords/abstract), independently loaded/error/retried (§5.6). Only
 * abstract and keywords are editable; no content editor, no create/delete,
 * no MemoryPlasmid/History vocabulary.
 *
 * B01 origin boundary: each section instance owns ONE continuous UI-origin
 * visit; a projectId transition retires the previous visit irreversibly
 * (editor sessions close, feedback drops). The edit dialog additionally
 * captures its origin at mount, and its outcome can never surface in another
 * project's or row's editor.
 *
 * B03 claim rule: the saved notice is derived from the AUTHORITATIVE backend
 * response (`updated` includes 'abstract' ⇒ background index refresh started).
 * An abstract that is whitespace-equal to the stored value is submitted raw
 * but yields `updated: []` on the backend, so no index claim is made.
 */
export function ProjectKnowledgeSection({ projectId }: { projectId: number }) {
  const knowledgeQuery = useProjectKnowledgeQuery(projectId);
  const updateMutation = useUpdateProjectKnowledgeMutation();
  const [editing, setEditing] = useState<ProjectKnowledgeRow | null>(null);

  const closeEdit = useCallback(() => setEditing(null), []);
  const rows = knowledgeQuery.data ?? [];

  // B01 in-section lifetime: a projectId transition retires the old visit's
  // editor session immediately (covers direct mounts AND cached-route
  // navigation where the section stays mounted).
  const originRef = useRef(projectId);
  useEffect(() => {
    if (originRef.current === projectId) return;
    originRef.current = projectId;
    setEditing(null);
  }, [projectId]);

  return (
    <section className="project-section" aria-labelledby="project-knowledge-title">
      <div className="project-section-heading">
        <h2 id="project-knowledge-title" className="app-h2">
          项目知识
        </h2>
      </div>

      {knowledgeQuery.isPending ? (
        <LoadingState label="正在加载项目知识…" />
      ) : knowledgeQuery.isError ? (
        <ErrorState
          title="项目知识加载失败"
          detail={backendErrorText(toAppApiError(knowledgeQuery.error))}
          onRetry={() => void knowledgeQuery.refetch()}
        />
      ) : rows.length === 0 ? (
        <EmptyState title="暂无项目知识" hint="上传文件或对话沉淀后，语义片段会出现在这里。" />
      ) : (
        <ul className="project-knowledge-list" aria-label="项目知识片段列表">
          {rows.map((row) => (
            <li key={row.id} className="project-knowledge-row">
              <div className="project-knowledge-head">
                <span className="project-knowledge-title">{row.title}</span>
                <span className="app-chip">{knowledgeSourceLabel(row.sourceType)}</span>
                <button
                  type="button"
                  className="app-btn app-btn-ghost app-btn-sm"
                  onClick={() => setEditing(row)}
                  disabled={updateMutation.isPending}
                >
                  <Pencil size={14} aria-hidden="true" />
                  编辑
                </button>
              </div>
              {row.tags.length > 0 ? (
                <p className="project-knowledge-chips">
                  {row.tags.map((tag) => (
                    <span key={tag} className="app-chip project-chip-clamp">
                      {tag}
                    </span>
                  ))}
                </p>
              ) : null}
              {row.keywords.length > 0 ? (
                <p className="project-knowledge-chips">
                  {row.keywords.map((keyword, index) => (
                    <span key={index} className="app-chip project-chip-clamp">
                      {keyword}
                    </span>
                  ))}
                </p>
              ) : null}
              <p className="project-knowledge-abstract">{knowledgeAbstractLabel(row.abstract)}</p>
              <p className="app-muted project-knowledge-time">更新于 {formatDateTime(row.updatedAt)}</p>
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <KnowledgeEditDialog key={editing.id} row={editing} projectId={projectId} mutation={updateMutation} onClose={closeEdit} />
      ) : null}
    </section>
  );
}

/**
 * Abstract/keywords editor — one session per open:
 *
 * - B01 session boundary: `originProjectId`, error and saved state are owned
 *   by THIS session (captured at mount; keyed by row id). A closed session's
 *   outcome can never leak into another row's editor; the mutate call uses
 *   the captured origin identity, never the live route.
 * - B02/R4 lossless keywords: the STORED ARRAY is the single editing source.
 *   No delimiter join/split pipeline exists anywhere: entries are rendered
 *   verbatim as chips (commas/spaces/semicolons/duplicates/empties are
 *   data), removal is per index, and one append action = one literal
 *   keyword (never parsed). Untouched entries are never re-serialized; a
 *   no-op (array structurally unchanged AND abstract unchanged) closes
 *   without any PATCH.
 * - B03 honest claim: index-start notice ONLY when the backend response's
 *   `updated` includes 'abstract'; abstract is submitted raw and the backend
 *   strips/compares it.
 * - B04: shared dialog a11y (initial focus, Tab trap, safe Escape with a
 *   pending-write lock, focus restore) + a pending focus ANCHOR: while the
 *   write is pending every control is disabled, so the dialog container
 *   itself (tabIndex -1) holds focus inside the modal; settled states
 *   re-focus 完成 (success) or the abstract field (error).
 */
export function KnowledgeEditDialog({
  row,
  projectId,
  mutation,
  onClose,
}: {
  row: ProjectKnowledgeRow;
  projectId: number;
  mutation: ReturnType<typeof useUpdateProjectKnowledgeMutation>;
  onClose: () => void;
}) {
  const [abstract, setAbstract] = useState(row.abstract ?? '');
  /** B02/R4: the working array — initialized from the stored truth, mutated
   * directly (append/remove), compared structurally for no-op detection. */
  const [keywords, setKeywords] = useState<string[]>(row.keywords);
  const [newKeyword, setNewKeyword] = useState('');
  /** B01: the origin captured at session mount (route changes never re-bind). */
  const [originProjectId] = useState(projectId);
  /** B01: per-session failure — a closed session cannot leak into the next. */
  const [sessionError, setSessionError] = useState<AppApiError | null>(null);
  /** B03: saved notice keyed on the AUTHORITATIVE response. */
  const [saved, setSaved] = useState<{ indexStarted: boolean } | null>(null);

  const pending = mutation.isPending;

  const closeDialog = useCallback(() => {
    // Pending writes stay pending-safe: Escape and the close control are
    // locked while `pending`, so this path only runs when dismissal is safe.
    onClose();
  }, [onClose]);

  const dialogRef = useDialogA11y(true, closeDialog, {
    closeDisabledWhileLocked: true,
    locked: pending,
  });
  const doneRef = useRef<HTMLButtonElement | null>(null);

  // Initial focus: the real editing field (the shared hook first focuses the
  // close button) — mirrors the accepted Project form dialog pattern.
  useEffect(() => {
    dialogRef.current?.querySelector<HTMLTextAreaElement>('#knowledge-abstract')?.focus();
  }, [dialogRef]);

  // B04/R4 focus lifecycle: pending keeps focus INSIDE via the container
  // anchor (every control is disabled); settled states re-focus a usable
  // control. Lock transitions alone no longer re-enter the shared helper.
  useEffect(() => {
    if (pending) {
      dialogRef.current?.focus();
      return;
    }
    if (saved) {
      doneRef.current?.focus();
      return;
    }
    if (sessionError) {
      dialogRef.current?.querySelector<HTMLTextAreaElement>('#knowledge-abstract')?.focus();
    }
  }, [pending, saved, sessionError, dialogRef]);

  const lockInputs = saved !== null || pending;

  /** One append = ONE literal keyword (R4 calibration): the typed text is
   * stored verbatim — commas/spaces/semicolons inside it are data, never
   * separators. */
  const addKeyword = () => {
    const trimmed = newKeyword.trim();
    if (trimmed === '') return;
    setKeywords((prev) => [...prev, trimmed]);
    setNewKeyword('');
  };

  const submit = () => {
    if (saved || pending) return;
    // B03: an edited abstract is sent RAW — the backend strips and compares
    // (memory/views.py `updated` is authoritative for the claim).
    // B02/R4: keywords are sent as the ARRAY itself — untouched entries were
    // never serialized, so they cannot be destroyed by another edit.
    const abstractChanged = abstract !== (row.abstract ?? '');
    const keywordsEdited = !keywordsEqual(keywords, row.keywords);
    if (!abstractChanged && !keywordsEdited) {
      onClose(); // true untouched no-op: no PATCH, no claim
      return;
    }
    const patch: { abstract?: string; keywords?: string[] } = {};
    if (abstractChanged) patch.abstract = abstract;
    if (keywordsEdited) patch.keywords = keywords;
    setSessionError(null);
    mutation.mutate(
      { projectId: originProjectId, kfId: row.id, patch },
      {
        // B03: only the backend's accepted 'abstract' change starts the thread;
        // `updated` is the authoritative signal for the claim.
        onSuccess: (result) => setSaved({ indexStarted: result.updated.includes('abstract') }),
        onError: (cause) => setSessionError(cause instanceof AppApiError ? cause : toAppApiError(cause)),
      },
    );
  };

  return (
    <div className="app-overlay" role="presentation">
      <div
        className="app-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="knowledge-edit-title"
        // B04: pending focus anchor — focusable while every control is
        // disabled, so the modal keeps focus ownership during a write.
        tabIndex={-1}
        ref={dialogRef}
      >
        <div className="app-dialog-head">
          <h2 id="knowledge-edit-title" className="app-h2">
            编辑知识摘要
          </h2>
          <button
            type="button"
            className="app-icon-btn"
            aria-label="关闭"
            disabled={pending}
            onClick={closeDialog}
          >
            ✕
          </button>
        </div>
        <form
          className="app-dialog-body"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <p className="app-muted">{row.title}</p>

          {sessionError ? (
            <div className="app-banner app-banner--error" role="alert">
              {backendErrorText(sessionError)}
            </div>
          ) : null}
          {saved ? (
            <div className="app-banner app-banner--success" role="status">
              {saved.indexStarted
                ? '已保存。后台索引刷新已启动，将在后台完成。'
                : '已保存。'}
            </div>
          ) : null}

          <label className="app-field" htmlFor="knowledge-abstract">
            <span className="app-field-label">摘要</span>
            <textarea
              id="knowledge-abstract"
              className="app-textarea"
              rows={5}
              value={abstract}
              disabled={lockInputs}
              onChange={(event) => setAbstract(event.target.value)}
            />
          </label>

          <div className="app-field">
            <span className="app-field-label" id="knowledge-keywords-label">关键词</span>
            {keywords.length > 0 ? (
              <ul className="project-keyword-chips" aria-labelledby="knowledge-keywords-label">
                {keywords.map((keyword, index) => (
                  <li key={index} className="app-chip project-keyword-chip">
                    {/* D02: the keyword text is a real flex item so it can
                        wrap (min-width:0 + overflow-wrap) instead of pushing
                        the remove control out of the modal body. The stored
                        string is never split/truncated. */}
                    <span className="project-keyword-text">{keyword}</span>
                    <button
                      type="button"
                      className="project-chip-remove"
                      aria-label={
                        keyword === ''
                          ? `移除第 ${index + 1} 个空关键词`
                          : `移除关键词 ${keyword}`
                      }
                      disabled={lockInputs}
                      onClick={() =>
                        setKeywords((prev) => prev.filter((_, i) => i !== index))
                      }
                    >
                      <X size={12} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="app-muted">暂无关键词。</p>
            )}
            <div className="project-keyword-add">
              <input
                className="app-input"
                type="text"
                aria-label="新增关键词"
                placeholder="一次追加一个关键词，原样保留"
                value={newKeyword}
                disabled={lockInputs}
                onChange={(event) => setNewKeyword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  addKeyword();
                }}
              />
              <button
                type="button"
                className="app-btn app-btn-ghost"
                disabled={lockInputs || newKeyword.trim() === ''}
                onClick={addKeyword}
              >
                <Plus size={14} aria-hidden="true" />
                追加
              </button>
            </div>
          </div>

          <div className="app-dialog-actions">
            <button type="button" className="app-btn app-btn-ghost" disabled={pending} onClick={closeDialog}>
              取消
            </button>
            {saved ? (
              <button ref={doneRef} type="button" className="app-btn" onClick={closeDialog}>
                完成
              </button>
            ) : (
              <button type="submit" className="app-btn app-btn--primary" disabled={pending}>
                {pending ? '保存中…' : '保存'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}