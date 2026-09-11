import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { toAppApiError } from '../chat/api';
import { useDialogA11y } from '../chat/dialogA11y';
import { LoadingState } from '../../shared/AsyncState';
import { backendErrorText } from './errors';
import { formatFileSize } from './projection';
import { useDeleteProjectMutation, useProjectDeletePreviewQuery } from './queries';

interface ProjectDeleteDialogProps {
  project: { id: number; name: string };
  sessionId: number;
  onClose: () => void;
  onDeleted: () => void;
}

/**
 * One destructive confirmation session. Its unique sessionId gives preview
 * requests an isolated Query key: reopening can never display or select from
 * an older preview. Recovery choices are always reset before a replacement
 * preview and are derived only from the current successful numeric file rows.
 */
export function ProjectDeleteDialog({
  project,
  sessionId,
  onClose,
  onDeleted,
}: ProjectDeleteDialogProps) {
  const previewQuery = useProjectDeletePreviewQuery(project.id, sessionId);
  const deleteMutation = useDeleteProjectMutation();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [deleteError, setDeleteError] = useState<ReturnType<typeof toAppApiError> | null>(null);
  const mountedRef = useRef(true);
  const dialogRef = useDialogA11y(true, onClose, {
    closeDisabledWhileLocked: true,
    locked: deleteMutation.isPending,
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Every successful initial/replacement preview starts with no recovery
  // choices. A failed latest attempt may retain old TanStack data, but it also
  // revokes hidden choices immediately and can never authorize destruction.
  useEffect(() => {
    if (previewQuery.dataUpdatedAt > 0 || previewQuery.isError) setSelectedIds(new Set());
  }, [previewQuery.dataUpdatedAt, previewQuery.isError]);

  // A pending destructive request disables every ordinary control. Keep native
  // focus inside the modal on its container rather than letting it fall to BODY.
  useEffect(() => {
    if (deleteMutation.isPending) dialogRef.current?.focus();
  }, [deleteMutation.isPending, dialogRef]);

  const previewIds = useMemo(
    () => new Set((previewQuery.data?.files ?? []).map((file) => file.id)),
    [previewQuery.data],
  );

  const retryPreview = () => {
    setSelectedIds(new Set());
    setDeleteError(null);
    void previewQuery.refetch();
  };

  const toggleFile = (fileId: number) => {
    if (!previewIds.has(fileId)) return;
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  };

  const hasCurrentPreview = Boolean(previewQuery.data) &&
    !previewQuery.isPending &&
    !previewQuery.isFetching &&
    !previewQuery.isError;

  const confirmDelete = async () => {
    const preview = previewQuery.data;
    // `data` alone is not authority: TanStack deliberately retains the last
    // successful value after a failed refetch. Match the rendered eligibility
    // gate so even direct/repeated invocation cannot use that stale snapshot.
    if (!preview || !hasCurrentPreview || deleteMutation.isPending) return;
    // Preserve preview order and exclude any identity not present in this
    // successful session, even if local state were somehow stale.
    const keepFileIds = preview.files
      .filter((file) => selectedIds.has(file.id))
      .map((file) => file.id);
    setDeleteError(null);
    try {
      await deleteMutation.mutateAsync({ projectId: project.id, keepFileIds });
      if (mountedRef.current) onDeleted();
    } catch (cause) {
      if (mountedRef.current) setDeleteError(toAppApiError(cause));
    }
  };

  const previewBusy = previewQuery.isPending || previewQuery.isFetching;
  const locked = deleteMutation.isPending;
  const rollbackFailed = (
    deleteError?.body as { code?: unknown } | null
  )?.code === 'file_rollback_failed';

  return (
    <div className="app-overlay" role="presentation">
      <div
        className="app-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-delete-title"
        ref={dialogRef}
        tabIndex={-1}
      >
        <div className="app-dialog-head">
          <h2 id="project-delete-title" className="app-h2">归档并删除项目</h2>
          <button
            type="button"
            className="app-icon-btn"
            aria-label="关闭"
            onClick={onClose}
            disabled={locked}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="app-dialog-body">
          <p>即将删除项目“{project.name || `项目 #${project.id}`}”。此操作不能由前端撤销。</p>

          {previewBusy ? (
            <LoadingState label="正在获取删除预览…" />
          ) : previewQuery.isError ? (
            <div className="app-banner app-banner--error" role="alert">
              <p>无法获取当前删除预览：{backendErrorText(toAppApiError(previewQuery.error))}</p>
              <button type="button" className="app-btn" onClick={retryPreview}>重试预览</button>
            </div>
          ) : previewQuery.data ? (
            <>
              <div className="project-delete-copy">
                <p>
                  {previewQuery.data.conversationsToArchive} 个直接关联会话将归档到 Archived Project，
                  并改由 Archived Chat 持有；它们不会被删除。
                </p>
                <p>仍保留的项目知识会移动到 Archived Project。</p>
                <p>
                  此预览只统计直接关联会话和已上传文件，不覆盖全部 Knowledge 或所有文件系统状况。
                </p>
              </div>

              <section aria-labelledby="project-delete-files-title">
                <div className="project-section-heading">
                  <h3 id="project-delete-files-title" className="app-h3">恢复已上传文件（可选）</h3>
                  <button type="button" className="app-link-btn" onClick={retryPreview} disabled={locked}>
                    重新获取预览
                  </button>
                </div>
                <p className="app-muted">
                  未勾选是默认。无论是否恢复，所有 ProjectFile 数据行都会删除；勾选项会成为脱离项目的后端恢复文件，文件名可能调整。
                </p>
                {previewQuery.data.files.length === 0 ? (
                  <p className="app-muted">预览中没有已上传文件。</p>
                ) : (
                  <ul className="project-delete-file-list" aria-label="可恢复的已上传文件">
                    {previewQuery.data.files.map((file) => (
                      <li key={file.id}>
                        <label className="project-delete-file-choice">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(file.id)}
                            onChange={() => toggleFile(file.id)}
                            disabled={locked}
                          />
                          <span>{file.name}</span>
                          <span className="app-muted">{formatFileSize(file.size)}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="app-muted">预览文件总量：{formatFileSize(previewQuery.data.filesTotalSize)}</p>
              </section>
            </>
          ) : null}

          {deleteError ? (
            <div className="app-banner app-banner--error" role="alert">
              <p>{backendErrorText(deleteError)}</p>
              {rollbackFailed ? (
                <p>部分文件可能未能恢复；请手动检查服务器文件系统并查看服务器日志。</p>
              ) : null}
            </div>
          ) : null}

          <div className="app-dialog-actions">
            <button type="button" className="app-btn app-btn-ghost" onClick={onClose} disabled={locked}>
              取消
            </button>
            <button
              type="button"
              className="app-btn app-btn--danger"
              onClick={() => void confirmDelete()}
              disabled={!hasCurrentPreview || locked}
            >
              {locked ? '正在删除…' : '确认归档并删除'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
