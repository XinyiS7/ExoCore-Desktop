import { useRef, useState } from 'react';
import { useDialogA11y } from '../chat/dialogA11y';
import { normalizeTags } from './tags';
import type { MemoWrites } from './queries';

export function MemoTagsDialog({ memoId, rootId, tags, writes, onClose }: {
  memoId: number; rootId: number; tags: string[]; writes: MemoWrites; onClose: () => void;
}) {
  const [value, setValue] = useState(tags.join('\n'));
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useDialogA11y(true, onClose, { locked: saving, closeDisabledWhileLocked: true });
  const normalized = normalizeTags(value.split('\n'));
  const validation = normalized.error ?? (normalized.tags.some((tag) => tag.startsWith('#')) ? '标签名称不含前导 #，请移除后保存。' : null);
  const busy = saving || writes.busyIds.includes(memoId);
  const save = async () => {
    if (inFlight.current || busy || validation) return;
    inFlight.current = true;
    setSaving(true); setError(null);
    try { await writes.editTags(memoId, normalized.tags, rootId); onClose(); }
    catch (cause) { setError(`标签未保存：${cause instanceof Error ? cause.message : '请求失败'}`); }
    finally { inFlight.current = false; setSaving(false); }
  };
  return <div className="app-overlay" onClick={(event) => { if (!busy && event.target === event.currentTarget) onClose(); }}>
    <div className="app-dialog memo-tags-dialog" role="dialog" aria-modal="true" aria-labelledby={`memo-tags-${memoId}`} tabIndex={-1} ref={dialogRef}>
      <h2 id={`memo-tags-${memoId}`}>管理 Memo #{memoId} 标签</h2>
      <p>每行一个名称，不含 #；留空可清除全部标签，不修改正文。</p>
      <textarea aria-label="标签名称" value={value} disabled={busy} onChange={(event) => setValue(event.target.value)} />
      {validation && <p role="alert">{validation}</p>}{error && <p role="alert">{error}</p>}
      <button type="button" disabled={busy} onClick={onClose}>取消标签编辑</button>
      <button type="button" disabled={busy || Boolean(validation)} onClick={() => { void save(); }}>{saving ? '保存标签中…' : '保存标签'}</button>
    </div>
  </div>;
}
