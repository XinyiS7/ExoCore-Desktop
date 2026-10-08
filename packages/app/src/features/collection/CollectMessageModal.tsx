import { useEffect, useRef, useState } from 'react';
import { Bookmark, Check, Info, X } from 'lucide-react';
import { useDialogA11y } from '../chat/dialogA11y';
import type { MessageView } from '../chat/types';
import { collectMessage } from './api';
import type { CollectMessageResult, CollectOutcome } from './types';

export interface CollectMessageModalProps {
  isOpen: boolean;
  targetMessage: MessageView | null;
  onClose: () => void;
  onSuccess?: (result: CollectMessageResult) => void;
}

/**
 * Modal dialog for collecting a message's canonical content into Library / Collection.
 *
 * Rules (Issue #32 Step 1B):
 * - Sends canonical MessageView.content verbatim, NEVER trimmed or rewritten.
 * - Note is optional; non-empty note is sent as collection_context.
 * - Duplicate submission is prevented while the request is in flight.
 * - Success feedback differentiates created vs already_collected.
 * - Does not promise reading collect counts or comments; no filled-state.
 */
export function CollectMessageModal({
  isOpen,
  targetMessage,
  onClose,
  onSuccess,
}: CollectMessageModalProps) {
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<CollectOutcome | null>(null);

  const submittingRef = useRef(false);
  const dialogRef = useDialogA11y(isOpen && Boolean(targetMessage), onClose, {
    closeDisabledWhileLocked: true,
    locked: submitting,
  });

  useEffect(() => {
    if (isOpen && targetMessage) {
      setNote('');
      setError(null);
      setOutcome(null);
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [isOpen, targetMessage?.id]);

  if (!isOpen || !targetMessage) {
    return null;
  }

  const handleSubmit = async () => {
    if (submittingRef.current || submitting || outcome !== null) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);

    try {
      const result = await collectMessage({
        messageId: targetMessage.id,
        content: targetMessage.content,
        context: note,
      });
      setOutcome(result.collectOutcome);
      onSuccess?.(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '收藏失败');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <div className="app-overlay" role="presentation">
      <div
        ref={dialogRef}
        className="app-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="collect-modal-title"
      >
        <div className="app-dialog-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bookmark size={18} aria-hidden="true" />
            <h2 id="collect-modal-title" className="app-h2">
              收藏消息正文
            </h2>
          </div>
          <button
            type="button"
            className="app-msg-action-btn"
            onClick={onClose}
            disabled={submitting}
            aria-label="关闭"
            title="关闭"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="app-dialog-body">
          <div className="app-field">
            <span className="app-field-label">消息原文引述</span>
            <blockquote
              className="app-blockquote"
              style={{
                margin: '4px 0',
                fontSize: '13px',
                maxHeight: '120px',
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {targetMessage.content}
            </blockquote>
          </div>

          <div className="app-field">
            <label htmlFor="collect-note-input" className="app-field-label">
              附言（可选）
            </label>
            <textarea
              id="collect-note-input"
              className="app-input"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="添加附言或备注（可选）…"
              disabled={submitting || outcome !== null}
            />
          </div>

          {error ? (
            <div className="app-banner app-banner--error" role="alert" style={{ marginTop: '4px', marginBottom: 0 }}>
              <span>{error}</span>
            </div>
          ) : null}

          {outcome === 'created' ? (
            <div className="app-banner" role="status" style={{ marginTop: '4px', marginBottom: 0 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Check size={16} aria-hidden="true" />
                已加入收藏
              </span>
            </div>
          ) : outcome === 'already_collected' ? (
            <div className="app-banner" role="status" style={{ marginTop: '4px', marginBottom: 0 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Info size={16} aria-hidden="true" />
                该消息已在收藏中，已记录再次收藏
              </span>
            </div>
          ) : null}
        </div>

        <div className="app-dialog-actions">
          {outcome === null ? (
            <>
              <button
                type="button"
                className="app-btn app-btn-ghost"
                onClick={onClose}
                disabled={submitting}
              >
                取消
              </button>
              <button
                type="button"
                className="app-btn app-btn-primary"
                onClick={() => void handleSubmit()}
                disabled={submitting}
              >
                {submitting ? '收藏中…' : '确认收藏'}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="app-btn app-btn-primary"
              onClick={onClose}
            >
              完成
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
