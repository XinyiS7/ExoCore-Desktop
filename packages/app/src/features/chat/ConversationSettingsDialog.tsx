import { useState } from 'react';
import { X } from 'lucide-react';
import { toAppApiError } from './api';
import { useDialogA11y } from './dialogA11y';
import { useConversationQuery, useUpdateConversationSettingsMutation } from './queries';
import type { ConversationSummary } from './types';
import { LoadingState } from '../../shared/AsyncState';
import { TagInput } from '../tags/TagInput';
import { specialTagConflict, tagErrorMessage } from '../tags/rules';

/**
 * #96 minimal edit entry for an existing conversation: tags + session prompt.
 * Opened from the shared row menu; reads the canonical detail row and replaces
 * both fields as a whole on save (PATCH is idempotent, so a failed save stays
 * open with the entered values).
 */
export function ConversationSettingsDialog({
  conversationId,
  onClose,
}: {
  conversationId: number;
  onClose: () => void;
}) {
  const dialogRef = useDialogA11y(true, onClose);
  const detail = useConversationQuery(conversationId);

  return (
    <div className="app-overlay" role="presentation">
      <div
        className="app-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="conv-settings-title"
        ref={dialogRef}
      >
        <div className="app-dialog-head">
          <h2 id="conv-settings-title" className="app-h2">
            会话设定
          </h2>
          <button type="button" className="app-icon-btn" aria-label="关闭" onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        {detail.data ? (
          <SettingsForm conversation={detail.data} onClose={onClose} />
        ) : detail.isError ? (
          <div className="app-dialog-body">
            <div className="app-banner" role="alert">
              加载失败
              <button type="button" className="app-link-btn" onClick={() => void detail.refetch()}>
                重试
              </button>
            </div>
          </div>
        ) : (
          <div className="app-dialog-body">
            <LoadingState label="加载中…" />
          </div>
        )}
      </div>
    </div>
  );
}

function SettingsForm({ conversation, onClose }: { conversation: ConversationSummary; onClose: () => void }) {
  const [tags, setTags] = useState<string[]>(conversation.tags);
  const [sessionPrompt, setSessionPrompt] = useState(conversation.sessionPrompt);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const mutation = useUpdateConversationSettingsMutation(conversation.id);
  const pending = mutation.isPending;

  const onSubmit = async () => {
    const conflict = specialTagConflict(tags);
    if (conflict) {
      setBannerError(conflict);
      return;
    }
    setBannerError(null);
    try {
      await mutation.mutateAsync({ tags: [...tags], sessionPrompt });
      onClose();
    } catch (cause) {
      const error = toAppApiError(cause);
      setBannerError(tagErrorMessage(error.body) ?? (error.message || '保存失败，请稍后重试。'));
    }
  };

  return (
    <form
      className="app-dialog-body"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit();
      }}
    >
      {bannerError ? (
        <div className="app-banner app-banner--error" role="alert">
          {bannerError}
        </div>
      ) : null}

      <TagInput id="conv-settings-tags" label="Tag" value={tags} onChange={setTags} disabled={pending} />
      <p className="app-muted">
        {conversation.isPrime
          ? '主会话带 #theater 也不进入剧场（主会话优先）。'
          : '#theater 会话进入剧场：不注入现实背景，部分工具关闭。'}
      </p>

      <label className="app-field" htmlFor="conv-settings-prompt">
        <span className="app-field-label">会话设定</span>
        <textarea
          id="conv-settings-prompt"
          className="app-input"
          rows={4}
          value={sessionPrompt}
          disabled={pending}
          onChange={(event) => setSessionPrompt(event.target.value)}
        />
      </label>

      <div className="app-dialog-actions">
        <button type="button" className="app-btn app-btn-ghost" onClick={onClose}>
          取消
        </button>
        <button type="submit" className="app-btn app-btn--primary" disabled={pending}>
          {pending ? '保存中…' : '保存'}
        </button>
      </div>
    </form>
  );
}
