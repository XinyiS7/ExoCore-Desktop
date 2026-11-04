import { useState } from 'react';
import { toAppApiError } from './api';

/** Inline editor for a persisted assistant body: saves in place, never regenerates (#107). */
export function AssistantMessageEditor({
  initialContent,
  saveDisabled,
  onSave,
  onClose,
}: {
  initialContent: string;
  saveDisabled?: boolean;
  onSave: (content: string) => Promise<unknown>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (draft === initialContent) {
      onClose();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(draft);
      onClose();
    } catch (cause) {
      const apiError = toAppApiError(cause);
      setError(apiError.fieldErrors.error ?? apiError.message);
      setSaving(false);
    }
  };

  return (
    <div className="app-msg-edit">
      <textarea
        className="app-msg-edit-input"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        aria-label="编辑助手消息"
        autoFocus
      />
      {error ? (
        <p className="app-msg-edit-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="app-msg-edit-actions">
        <button
          type="button"
          className="app-msg-action-btn"
          disabled={saving || saveDisabled || !draft.trim()}
          onClick={handleSave}
        >
          保存
        </button>
        <button type="button" className="app-msg-action-btn" disabled={saving} onClick={onClose}>
          取消
        </button>
      </div>
    </div>
  );
}
