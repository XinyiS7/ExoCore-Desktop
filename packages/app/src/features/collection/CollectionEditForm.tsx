import { useRef, useState, type FormEvent } from 'react';
import { CollectionApiError } from './api';
import { DESCRIPTION_LIMIT, parseTagsInput } from './presentation';
import { usePatchCollectionItem } from './queries';
import type { CollectionDetail } from './types';

/** 400 keeps the form and says nothing was saved; other failures show their message. */
function invalidMessage(error: Error): string {
  if (error instanceof CollectionApiError && error.status === 400) return '内容不合法，未保存';
  return `保存失败：${error.message}`;
}

interface CollectionEditFormProps {
  detail: CollectionDetail;
  onDone: () => void;
  onSavingChange: (saving: boolean) => void;
}

/** Metadata edit (Plan §5.3): server-confirmed PATCH, Tags replaced as a whole set. */
export function CollectionEditForm({ detail, onDone, onSavingChange }: CollectionEditFormProps) {
  const mutation = usePatchCollectionItem(detail.id);
  const inFlight = useRef(false);
  const [title, setTitle] = useState(detail.title);
  const [description, setDescription] = useState(detail.description);
  const [reason, setReason] = useState(detail.collection_context);
  const [tags, setTags] = useState(detail.tags.join(', '));
  const descriptionLength = description.trim().length;
  const tooLong = descriptionLength > DESCRIPTION_LIMIT;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (tooLong || inFlight.current) return;
    inFlight.current = true;
    onSavingChange(true);
    mutation.mutate(
      { title, description, collection_context: reason, tags: parseTagsInput(tags) },
      {
        onSuccess: onDone,
        onSettled: () => { inFlight.current = false; onSavingChange(false); },
      },
    );
  };

  const error = mutation.error;
  return (
    <form className="library-edit" onSubmit={submit} aria-label="编辑藏品">
      <label className="app-field">
        <span className="app-field-label">标题</span>
        <input className="app-input" value={title} maxLength={255} onChange={(event) => setTitle(event.target.value)} />
      </label>
      <div className="app-field">
        <label className="app-field-label" htmlFor="library-description">描述</label>
        <textarea
          id="library-description"
          className="app-input library-textarea"
          value={description}
          rows={4}
          aria-describedby="library-description-count"
          aria-invalid={tooLong}
          onChange={(event) => setDescription(event.target.value)}
        />
        <span id="library-description-count" className={`library-count${tooLong ? ' is-over' : ''}`}>
          {descriptionLength} / {DESCRIPTION_LIMIT}{tooLong ? '，超出上限' : ''}
        </span>
      </div>
      <label className="app-field">
        <span className="app-field-label">收藏理由</span>
        <textarea className="app-input library-textarea" value={reason} rows={3} onChange={(event) => setReason(event.target.value)} />
      </label>
      <label className="app-field">
        <span className="app-field-label">这一件藏品的 Tags（用逗号分隔）</span>
        <input className="app-input" value={tags} onChange={(event) => setTags(event.target.value)} />
      </label>
      {error && (
        <div role="alert" className="app-banner app-banner--error">
          {invalidMessage(error)}
        </div>
      )}
      <div className="app-dialog-actions">
        <button type="button" className="app-btn app-btn-ghost" disabled={mutation.isPending} onClick={onDone}>取消</button>
        <button type="submit" className="app-btn app-btn--primary" disabled={mutation.isPending || tooLong}>
          {mutation.isPending ? '保存中…' : '保存'}
        </button>
      </div>
    </form>
  );
}

interface ManualCalibrationFormProps {
  detail: CollectionDetail;
  initialText: string;
  onDone: () => void;
}

/** Document extracted text only; blank content cannot be submitted (Plan §5.3). */
export function ManualCalibrationForm({ detail, initialText, onDone }: ManualCalibrationFormProps) {
  const mutation = usePatchCollectionItem(detail.id);
  const inFlight = useRef(false);
  const [text, setText] = useState(initialText);
  const blank = text.trim() === '';
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (blank || inFlight.current) return;
    inFlight.current = true;
    mutation.mutate(
      { manual_representation: { kind: 'document_extracted_text', canonical_text: text } },
      { onSuccess: onDone, onSettled: () => { inFlight.current = false; } },
    );
  };
  return (
    <form className="library-edit" onSubmit={submit} aria-label="人工校准提取文本">
      <label className="app-field">
        <span className="app-field-label">人工校准文本</span>
        <textarea className="app-input library-textarea" rows={8} value={text} onChange={(event) => setText(event.target.value)} />
      </label>
      {mutation.isError && (
        <div role="alert" className="app-banner app-banner--error">
          {invalidMessage(mutation.error)}
        </div>
      )}
      <div className="app-dialog-actions">
        <button type="button" className="app-btn app-btn-ghost" disabled={mutation.isPending} onClick={onDone}>取消</button>
        <button type="submit" className="app-btn app-btn--primary" disabled={mutation.isPending || blank}>
          {mutation.isPending ? '保存中…' : '保存校准'}
        </button>
      </div>
    </form>
  );
}
