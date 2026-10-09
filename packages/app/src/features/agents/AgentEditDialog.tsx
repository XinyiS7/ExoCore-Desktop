import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { useDialogA11y } from '../chat/dialogA11y';
import { toAppApiError } from '../chat/api';
import type { AgentPresetRow } from '../chat/types';
import { useModelCatalogQuery } from '../../shared/modelCatalog';

const FALLBACK_MODELS = [
  'deepseek-chat',
  'deepseek-reasoner',
  'claude-3-5-sonnet',
  'gpt-4o',
  'gpt-4o-mini',
];

interface AgentEditDialogProps {
  preset: AgentPresetRow;
  isOpen: boolean;
  onSave: (fields: { name: string; description?: string; default_model?: string }) => Promise<void>;
  onClose: () => void;
}

export function AgentEditDialog({
  preset,
  isOpen,
  onSave,
  onClose,
}: AgentEditDialogProps) {
  const [nameDraft, setNameDraft] = useState(preset.name ?? '');
  const [descDraft, setDescDraft] = useState(preset.description ?? '');
  const [modelDraft, setModelDraft] = useState(preset.default_model ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const catalogQuery = useModelCatalogQuery();

  const availableModels = useMemo(() => {
    const set = new Set<string>();
    const catalogModels = catalogQuery.data?.models?.map((m: { name: string }) => m.name) ?? [];
    if (catalogModels.length > 0) {
      catalogModels.forEach((m: string) => set.add(m));
    } else {
      FALLBACK_MODELS.forEach((m) => set.add(m));
    }
    if (preset.default_model) {
      set.add(preset.default_model);
    }
    return Array.from(set);
  }, [catalogQuery.data, preset.default_model]);

  useEffect(() => {
    if (isOpen) {
      setNameDraft(preset.name ?? '');
      setDescDraft(preset.description ?? '');
      setModelDraft(preset.default_model ?? '');
      setError(null);
    }
  }, [isOpen, preset]);

  const dialogRef = useDialogA11y(isOpen, onClose, {
    locked: saving,
    closeDisabledWhileLocked: true,
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedName = nameDraft.trim();
    if (!trimmedName) {
      setError('Agent 名称不能为空');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave({
        name: trimmedName,
        description: descDraft,
        default_model: modelDraft || undefined,
      });
      onClose();
    } catch (err) {
      const apiErr = toAppApiError(err);
      const displayError =
        (apiErr.body && typeof apiErr.body === 'object' && 'error' in apiErr.body && typeof (apiErr.body as { error?: unknown }).error === 'string'
          ? (apiErr.body as { error: string }).error
          : null) ??
        apiErr.fieldErrors.name ??
        apiErr.fieldErrors.description ??
        apiErr.fieldErrors.default_model ??
        apiErr.fieldErrors.detail ??
        apiErr.message;
      setError(displayError);
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
        aria-labelledby="agent-edit-title"
      >
        <header className="app-dialog-header">
          <h2 id="agent-edit-title" className="app-h2">
            编辑 Agent 资料
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
            {error ? (
              <div className="app-field-error" role="alert">
                {error}
              </div>
            ) : null}

            <div className="account-field">
              <label htmlFor="agent-name-input" className="account-label">
                Agent 名称 <span className="account-required">*</span>
              </label>
              <input
                id="agent-name-input"
                type="text"
                className="app-input"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                disabled={saving}
                placeholder="输入 Agent 名称"
                required
              />
            </div>

            <div className="account-field">
              <label htmlFor="agent-desc-input" className="account-label">
                签名 / 简介
              </label>
              <textarea
                id="agent-desc-input"
                className="app-textarea"
                rows={3}
                value={descDraft}
                onChange={(e) => setDescDraft(e.target.value)}
                disabled={saving}
                placeholder="简短的设定或介绍"
              />
            </div>

            <div className="account-field">
              <label htmlFor="agent-model-input" className="account-label">
                默认模型
              </label>
              <select
                id="agent-model-input"
                className="app-input"
                value={modelDraft}
                onChange={(e) => setModelDraft(e.target.value)}
                disabled={saving}
              >
                <option value="">未配置默认模型</option>
                {availableModels.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </div>
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
            <button
              type="submit"
              className="app-btn"
              disabled={saving}
            >
              {saving ? '保存中…' : '保存修改'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
