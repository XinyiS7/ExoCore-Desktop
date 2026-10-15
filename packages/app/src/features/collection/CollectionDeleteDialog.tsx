import { useRef } from 'react';
import { useDialogA11y } from '../chat/dialogA11y';
import { useDeleteCollectionItem } from './queries';

interface CollectionDeleteDialogProps {
  itemId: number;
  title: string;
  onCancel: () => void;
  /** Called once the server confirmed the item is gone (204, or 404 already gone). */
  onDeleted: () => void;
}

/** Frozen copy (Plan §6); focus starts on Cancel; one DELETE per confirmation. */
export function CollectionDeleteDialog({ itemId, title, onCancel, onDeleted }: CollectionDeleteDialogProps) {
  const mutation = useDeleteCollectionItem(itemId);
  const pending = mutation.isPending;
  // isPending lags a render behind; the ref stops a second click in the same tick.
  const submitted = useRef(false);
  const confirm = () => {
    if (submitted.current) return;
    submitted.current = true;
    mutation.mutate(undefined, {
      onSuccess: onDeleted,
      onError: () => { submitted.current = false; },
    });
  };
  const dialogRef = useDialogA11y(true, () => { if (!pending) onCancel(); }, {
    locked: pending,
    closeDisabledWhileLocked: true,
  });

  return (
    <div className="library-confirm-backdrop">
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="library-delete-title"
        aria-describedby="library-delete-desc"
        className="app-dialog library-confirm"
      >
        <div className="app-dialog-body">
          <h2 id="library-delete-title" className="app-h2">删除“{title}”？</h2>
          <p id="library-delete-desc">
            永久删除这件藏品，不可恢复。它的收藏理由、评论、浏览统计和本藏品的标签关联会一起删除（标签本身仍保留在其他藏品上）。已经带进聊天的藏品卡不受影响。
          </p>
          {mutation.isError && (
            <div role="alert" className="app-banner app-banner--error">删除失败：{mutation.error.message}</div>
          )}
          <div className="app-dialog-actions">
            <button type="button" className="app-btn app-btn-ghost" disabled={pending} onClick={onCancel}>取消</button>
            <button
              type="button"
              className="app-btn library-btn-danger"
              disabled={pending}
              onClick={confirm}
            >
              {pending ? '删除中…' : '永久删除'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
