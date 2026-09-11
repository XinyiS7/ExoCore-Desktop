import { useCallback, useEffect, useRef, useState } from 'react';
import { Trash2, Upload } from 'lucide-react';
import { useDialogA11y } from '../chat/dialogA11y';
import { useProjectFilesQuery } from '../chat/control/queries';
import { AppApiError, toAppApiError } from '../chat/api';
import { EmptyState, ErrorState, LoadingState } from '../../shared/AsyncState';
import { backendErrorText } from './errors';
import { useDeleteProjectFileMutation, useUploadProjectFileMutation } from './queries';
import { fileAvailabilityNote, fileSourceLabel, formatFileSize } from './projection';
import type { ProjectFileRow } from '../chat/control/types';

/**
 * P2B workspace Files section (Plan §6.3, D3/D6).
 *
 * - list consumes the SAME canonical P1D `controlQueryKeys.projectFiles`
 *   family as the chat-local drawer — one cache, both mounted consumers
 *   refresh together (CP2 visibility rule);
 * - upload uses the existing multipart contract; pending/failure explicit;
 * - delete confirms the row + source label, then sends the verified ID
 *   verbatim (numeric or `kf_<int>`); success refreshes Files AND Knowledge;
 * - B01 origin boundary: a monotonic UI-session TOKEN (S) is bumped on every
 *   origin transition — a delete confirmation session additionally captures
 *   its OWN request identity (R = projectId + row) at open, so the request
 *   never mixes a live route with a stale row; shared invalidation stays
 *   bound to R and survives retirement;
 * - B04: the delete confirmation uses the shared modal interaction contract
 *   (initial focus, Tab trap, safe Escape, focus restore); it closes BEFORE
 *   the DELETE request starts (no artificial pending-dialog state);
 * - D6: no Open/Download/Preview control — synced rows state plainly that no
 *   physical browser file is available;
 * - D3: unknown/ID-inconsistent source labels render neutrally and never
 *   reject an otherwise usable row.
 */
export function ProjectFilesSection({ projectId }: { projectId: number }) {
  const filesQuery = useProjectFilesQuery(projectId);
  const uploadMutation = useUploadProjectFileMutation();
  const deleteMutation = useDeleteProjectFileMutation();
  /**
   * R4/S: UI-origin visit token. S is a CONTINUOUS origin visit, not the
   * bare Project ID nor the component instance: an A→B→A round-trip bumps
   * the token twice, so every pre-B request belongs to a permanently retired
   * visit and its late local outcome can never reattach on return (equal
   * projectId does NOT revive a retired session). A fresh mount starts a
   * fresh token. Shared cache invalidation is NOT gated by this token — it
   * stays bound to the request identity R (variables payload).
   */
  const sessionTokenRef = useRef(0);
  /**
   * B01: a delete session captures BOTH the origin projectId and the row at
   * confirmation open. The request always targets the captured pair, never a
   * live route combined with a stale row.
   */
  const [pendingDelete, setPendingDelete] = useState<{ projectId: number; row: ProjectFileRow } | null>(null);
  /**
   * B01: upload/delete FEEDBACK is session-scoped too — the live mutation
   * state may belong to a retired visit after a route switch, so pending and
   * error messages are captured WITH their token at request time and only
   * display while the section is still serving that visit.
   */
  const [uploadSession, setUploadSession] = useState<{ token: number; fileName: string } | null>(null);
  const [uploadIssue, setUploadIssue] = useState<{ token: number; error: AppApiError } | null>(null);
  const [deleteIssue, setDeleteIssue] = useState<{ token: number; error: AppApiError } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // S: every committed origin transition retires the previous visit
  // irreversibly; returning to the same ID is a NEW lifetime.
  const originRef = useRef(projectId);
  useEffect(() => {
    if (originRef.current === projectId) return;
    originRef.current = projectId;
    sessionTokenRef.current += 1;
    setPendingDelete(null);
    setUploadSession(null);
    setUploadIssue(null);
    setDeleteIssue(null);
  }, [projectId]);

  const closeDelete = useCallback(() => setPendingDelete(null), []);
  // B04: shared modal contract (focus in/trap/Escape/restore). The dialog
  // closes BEFORE the DELETE request starts, so no pending-lock state is
  // ever reached here (no artificial pending confirmation).
  const deleteDialogRef = useDialogA11y(pendingDelete !== null, closeDelete);

  const handlePickFile = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      const token = sessionTokenRef.current;
      setUploadSession({ token, fileName: file.name });
      setUploadIssue(null);
      uploadMutation.mutate(
        { projectId, file },
        {
          // S: results only reattach while THEIR visit is still live.
          onSuccess: () => {
            if (sessionTokenRef.current !== token) return;
            setUploadSession(null);
            setUploadIssue(null);
          },
          onError: (cause) => {
            const error = toAppApiError(cause);
            if (sessionTokenRef.current !== token) return;
            setUploadSession(null);
            setUploadIssue({ token, error });
          },
        },
      );
    },
    [projectId, uploadMutation],
  );

  // B01/R4: late outcomes of a retired visit never render on the current
  // visit — even when it shows the SAME project again (A→B→A). Live outcomes
  // of the CURRENT visit stay visible (token match; closing the delete
  // confirmation does not retire the visit).
  const uploadPendingHere = uploadSession !== null && uploadSession.token === sessionTokenRef.current;
  const uploadErrorHere = uploadIssue !== null && uploadIssue.token === sessionTokenRef.current ? uploadIssue.error : null;
  const deleteErrorHere = deleteIssue !== null && deleteIssue.token === sessionTokenRef.current ? deleteIssue.error : null;
  const rows = filesQuery.data ?? [];
  return (
    <section className="project-section" aria-labelledby="project-files-title">
      <div className="project-section-heading">
        <h2 id="project-files-title" className="app-h2">
          项目文件
        </h2>
        <button
          type="button"
          className="app-btn"
          disabled={uploadMutation.isPending}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={16} aria-hidden="true" />
          {uploadPendingHere ? '上传中…' : '上传文件'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          hidden
          aria-hidden="true"
          tabIndex={-1}
          aria-label="选择要上传的文件"
          onChange={(event) => {
            handlePickFile(event.target.files?.[0]);
            event.target.value = ''; // allow re-selecting the same file
          }}
        />
      </div>

      {uploadPendingHere ? (
        <p className="app-muted" role="status">
          正在上传 {uploadSession?.fileName}…
        </p>
      ) : null}
      {uploadErrorHere ? (
        <div className="app-banner app-banner--error" role="alert">
          {uploadErrorHere.ambiguousWrite ? uploadErrorHere.message : backendErrorText(uploadErrorHere)}
        </div>
      ) : null}

      {filesQuery.isPending ? (
        <LoadingState label="正在加载文件…" />
      ) : filesQuery.isError ? (
        <ErrorState
          title="文件加载失败"
          detail={backendErrorText(toAppApiError(filesQuery.error))}
          onRetry={() => void filesQuery.refetch()}
        />
      ) : rows.length === 0 ? (
        <EmptyState title="暂无项目文件" hint="上传项目参考资料，或由 Obsidian 同步生成。" />
      ) : (
        <ul className="project-file-list" aria-label="项目文件列表">
          {rows.map((file) => {
            const note = fileAvailabilityNote(file.id, file.url);
            return (
              <li key={file.id} className="project-file-row">
                <span className="project-file-name">{file.name}</span>
                <span className="project-file-meta">
                  <span className="app-chip">{fileSourceLabel(file.source, file.id)}</span>
                  {formatFileSize(file.size) ? (
                    <span className="project-file-size">{formatFileSize(file.size)}</span>
                  ) : null}
                </span>
                {note ? <p className="project-file-note">{note}</p> : null}
                <button
                  type="button"
                  className="app-btn app-btn-ghost app-btn-sm project-file-delete"
                  disabled={deleteMutation.isPending}
                  onClick={() => setPendingDelete({ projectId, row: file })}
                >
                  <Trash2 size={14} aria-hidden="true" />
                  删除
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {deleteErrorHere ? (
        <div className="app-banner app-banner--error" role="alert">
          {backendErrorText(deleteErrorHere)}
        </div>
      ) : null}

      {pendingDelete ? (
        <div className="app-overlay" role="presentation">
          <div
            className="app-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="file-delete-title"
            ref={deleteDialogRef}
          >
            <div className="app-dialog-head">
              <h2 id="file-delete-title" className="app-h2">
                删除文件
              </h2>
              <button
                type="button"
                className="app-icon-btn"
                aria-label="取消删除"
                disabled={deleteMutation.isPending}
                onClick={closeDelete}
              >
                ✕
              </button>
            </div>
            <div className="app-dialog-body">
              <p>
                确定删除「{pendingDelete.row.name}」（{fileSourceLabel(pendingDelete.row.source, pendingDelete.row.id)}）吗？
              </p>
              {pendingDelete.row.source === 'obsidian_sync' ? (
                <p className="app-muted">该操作会同时删除其知识片段。</p>
              ) : (
                <p className="app-muted">该操作会同时移除关联的知识片段。</p>
              )}
              <div className="app-dialog-actions">
                <button type="button" className="app-btn app-btn-ghost" disabled={deleteMutation.isPending} onClick={closeDelete}>
                  取消
                </button>
                <button
                  type="button"
                  className="app-btn app-btn--danger"
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    const session = pendingDelete;
                    // R: the captured {projectId, row} pair IS the request
                    // identity — never the current route props. S: the local
                    // outcome only reattaches while THIS visit is still live
                    // (closing the confirmation does NOT retire the visit).
                    const token = sessionTokenRef.current;
                    closeDelete();
                    setDeleteIssue(null);
                    deleteMutation.mutate(
                      { projectId: session.projectId, fileId: session.row.id },
                      {
                        onSuccess: () => {
                          if (sessionTokenRef.current !== token) return;
                          setDeleteIssue(null);
                        },
                        onError: (cause) => {
                          const error = toAppApiError(cause);
                          if (sessionTokenRef.current !== token) return;
                          setDeleteIssue({ token, error });
                        },
                      },
                    );
                  }}
                >
                  {deleteMutation.isPending ? '删除中…' : '确认删除'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}