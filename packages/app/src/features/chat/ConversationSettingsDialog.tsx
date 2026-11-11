import { useRef, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { theaterDocumentErrorMessage, toAppApiError } from './api';
import { useDialogA11y } from './dialogA11y';
import {
  useConversationQuery,
  useTheaterDocumentMutations,
  useTheaterDocumentsQuery,
  useUpdateConversationSettingsMutation,
} from './queries';
import type { ConversationSummary } from './types';
import { LoadingState } from '../../shared/AsyncState';
import { TagInput } from '../tags/TagInput';
import { specialTagConflict, tagErrorMessage } from '../tags/rules';

/**
 * #96 minimal edit entry for an existing conversation: tags + session prompt.
 * Opened from the shared row menu; reads the canonical detail row and replaces
 * both fields as a whole on save (PATCH is idempotent, so a failed save stays
 * open with the entered values).
 *
 * #128 adds the always-visible theater-document section: upload / delete are
 * their own requests (not part of 保存) and the list only ever shows the state
 * the server returned.
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

      <TheaterDocumentsSection conversationId={conversation.id} />

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

const THEATER_ACCEPT = '.md,.txt,text/markdown,text/plain';
/** Fixed grouping so counts read like the backend's `15,000` in any locale. */
const formatCount = (value: number) => value.toLocaleString('en-US');

function TheaterDocumentsSection({ conversationId }: { conversationId: number }) {
  const query = useTheaterDocumentsQuery(conversationId);
  const { upload, remove } = useTheaterDocumentMutations(conversationId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = upload.isPending || remove.isPending;

  const run = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
    } catch (cause) {
      const err = toAppApiError(cause);
      setError(theaterDocumentErrorMessage(err.body) ?? (err.message || '操作失败，请稍后重试。'));
    }
  };

  const onPick = (list: FileList | null) => {
    const files = list ? Array.from(list) : [];
    if (inputRef.current) inputRef.current.value = '';
    if (files.length) void run(() => upload.mutateAsync(files));
  };

  const state = query.data;
  return (
    <section className="app-field" aria-labelledby="conv-theater-docs-title">
      <span id="conv-theater-docs-title" className="app-field-label">
        剧本文档
      </span>
      {state ? (
        <>
          <p className="app-muted">
            {state.injected ? '剧场生效中' : '不被读取（仅非主会话且带 #theater 时注入）'}
            {` · 正文 ${formatCount(state.totalChars)} / ${formatCount(state.limit)} 字符`}
          </p>
          {error ? (
            <div className="app-banner app-banner--error" role="alert">
              {error}
            </div>
          ) : null}
          {state.documents.length ? (
            <ul className="app-theater-docs" aria-label="剧本文档列表">
              {state.documents.map((doc) => (
                <li key={doc.id} className="app-theater-doc">
                  <span className="app-theater-doc-name">{doc.filename}</span>
                  <span className="app-muted">{formatCount(doc.charCount)} 字符</span>
                  <button
                    type="button"
                    className="app-icon-btn"
                    aria-label={`删除 ${doc.filename}`}
                    disabled={busy}
                    onClick={() => void run(() => remove.mutateAsync(doc.id))}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="app-muted">尚未上传剧本文档。</p>
          )}
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={THEATER_ACCEPT}
            hidden
            aria-label="选择剧本文档"
            onChange={(event) => onPick(event.target.files)}
          />
          <div>
            <button
              type="button"
              className="app-btn app-btn-ghost"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              {upload.isPending ? '上传中…' : '上传 .md / .txt'}
            </button>
          </div>
        </>
      ) : query.isError ? (
        <div className="app-banner" role="alert">
          剧本文档加载失败
          <button type="button" className="app-link-btn" onClick={() => void query.refetch()}>
            重试
          </button>
        </div>
      ) : (
        <LoadingState label="加载中…" />
      )}
    </section>
  );
}
