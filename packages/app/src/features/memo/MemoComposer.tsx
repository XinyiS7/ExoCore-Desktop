import { useRef, useState } from 'react';
import { memoWriteError, type MemoComposerControl } from './replyDrafts';
import { extractMemoTags } from './tags';
import type { MemoWrites } from './queries';

export function MemoComposer({ writes, parentId, rootId, replyControl, className }: {
  writes: MemoWrites; parentId?: number; rootId?: number; replyControl?: MemoComposerControl; className?: string;
}) {
  const [localContent, setLocalContent] = useState('');
  const [localSaving, setLocalSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const content = replyControl?.content ?? localContent;
  const saving = replyControl?.saving ?? localSaving;
  const error = replyControl ? replyControl.error : localError;
  const setContent = replyControl?.changeContent ?? setLocalContent;
  const inFlight = useRef(false);
  const extracted = extractMemoTags(content);
  const submit = async () => {
    if (replyControl) { await replyControl.submit(); return; }
    if (inFlight.current || !content.trim() || extracted.error) return;
    inFlight.current = true; setLocalSaving(true); setLocalError(null);
    const snapshot = { content, tags: extracted.tags, parentId, rootId };
    try {
      await writes.save({ ...snapshot, onCreated: () => setContent('') });
    } catch (cause) {
      setLocalError(memoWriteError(cause));
    } finally { inFlight.current = false; setLocalSaving(false); }
  };
  const label = parentId === undefined ? 'Memo 正文' : '回复正文';
  return <div className={`memo-composer${className ? ` ${className}` : ''}`}>
    <textarea className="memo-textarea" aria-label={label} placeholder={parentId === undefined ? '随手记下脑海里的碎片…（支持 #标签）' : '写下回复…'} value={content} disabled={saving}
      onChange={(event) => setContent(event.target.value)} onKeyDown={(event) => {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.nativeEvent.isComposing) { event.preventDefault(); void submit(); }
      }} />
    <div className="memo-composer-footer">
      <div className="memo-tags-preview">
        {extracted.tags.length > 0
          ? <ul className="river-tags" aria-label="识别到的标签">{extracted.tags.map((tag) => <li key={tag}>#{tag}</li>)}</ul>
          : <span className="composer-hint">支持 #标签</span>}
      </div>
      <div className="memo-composer-actions">
        <span className="composer-hint">{parentId === undefined ? 'Enter 换行 · Ctrl+Enter 提交' : 'Ctrl+Enter 发送'}</span>
        <button type="button" className="memo-submit-btn" disabled={saving || !content.trim() || Boolean(extracted.error)} onClick={() => { void submit(); }}>{saving ? '记录中…' : parentId === undefined ? '记录 Memo' : '发送回复'}</button>
      </div>
    </div>
    {extracted.error && <p role="alert">{extracted.error}</p>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
