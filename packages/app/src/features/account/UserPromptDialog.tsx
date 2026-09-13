import { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { useDialogA11y } from '../chat/dialogA11y';
import { toAppApiError } from '../chat/api';

interface UserPromptDialogProps {
  initialPrompt: string;
  isOpen: boolean;
  onSave: (prompt: string) => Promise<void>;
  onClose: () => void;
}

export function UserPromptDialog({
  initialPrompt,
  isOpen,
  onSave,
  onClose,
}: UserPromptDialogProps) {
  const [draft, setDraft] = useState(initialPrompt);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dialogRef = useDialogA11y(isOpen, onClose, {
    locked: saving,
    closeDisabledWhileLocked: true,
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave(draft);
      onClose();
    } catch (err) {
      setError(toAppApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="app-dialog-overlay"
      role="presentation"
      onClick={(e) => {
        if (!saving && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="app-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-prompt-title"
      >
        <header className="app-dialog-header">
          <h2 id="user-prompt-title" className="app-h2">
            编辑 System Prompt
          </h2>
          <button
            type="button"
            className="app-icon-btn"
            onClick={onClose}
            disabled={saving}
            aria-label="关闭"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="app-dialog-form">
          <div className="app-dialog-body">
            <p className="app-dialog-desc">
              配置作用于您自身身份的全局 System Prompt。留空则不附加特殊设定。
            </p>
            {error ? (
              <div className="app-field-error" role="alert">
                {error}
              </div>
            ) : null}
            <textarea
              className="app-textarea"
              rows={8}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="输入 System Prompt…"
              disabled={saving}
            />
          </div>

          <footer className="app-dialog-footer">
            <button
              type="button"
              className="app-btn app-btn-ghost"
              onClick={onClose}
              disabled={saving}
            >
              取消
            </button>
            <button type="submit" className="app-btn" disabled={saving}>
              {saving ? '保存中…' : '保存'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
