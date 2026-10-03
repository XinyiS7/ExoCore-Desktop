import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { useDialogA11y } from '../chat/dialogA11y';
import { AppApiError } from '../chat/api';
import { useCanonicalDiaryQuery } from '../diary/queries';
import { useHeartbeatEventDetailQuery } from '../heartbeat/queries';
import type { ReadingItem } from './types';

export function SourceReadingDrawer({ item, onClose }: { item: ReadingItem; onClose: () => void }) {
  const titleId = useId();
  const overlayRef = useRef<HTMLDivElement>(null);
  // Restore background interactivity BEFORE dialogA11y's cleanup restores trigger focus.
  useEffect(() => {
    const background = Array.from(document.body.children).filter((node): node is HTMLElement =>
      node instanceof HTMLElement && node !== overlayRef.current);
    const previous = background.map((node) => ({ node, inert: node.inert, hidden: node.getAttribute('aria-hidden') }));
    previous.forEach(({ node }) => { node.inert = true; node.setAttribute('aria-hidden', 'true'); });
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      previous.forEach(({ node, inert, hidden }) => {
        node.inert = inert;
        if (hidden === null) node.removeAttribute('aria-hidden'); else node.setAttribute('aria-hidden', hidden);
      });
      document.body.style.overflow = overflow;
    };
  }, []);
  const dialogRef = useDialogA11y(true, onClose);
  const diary = useCanonicalDiaryQuery(item.source_type === 'diary' ? item.target.preset_id : null, item.source_type === 'diary' ? item.target.day : null);
  const heartbeat = useHeartbeatEventDetailQuery(item.preset_id ?? 0, item.source_type === 'heartbeat' ? item.target.session_uuid : null, item.source_type === 'heartbeat');
  const query = item.source_type === 'diary' ? diary : heartbeat;
  const content = query.data?.content;
  const status = query.error instanceof AppApiError ? query.error.status : null;
  const title = item.source_type === 'diary'
    ? `Agent ${item.target.preset_id} 的日记 · ${item.target.day}`
    : `Agent ${item.preset_id} 的心跳总结`;

  return createPortal(
    <div ref={overlayRef} className="river-reading-overlay" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} className="river-reading-drawer" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <header className="river-reading-header">
          <div className="river-reading-title-group">
            <h2 id={titleId}>{title}</h2>
            <p>{item.source_type === 'diary'
              ? 'Canonical day · 03:00 是排序锚点，不是真实写作或归档时刻'
              : `最终总结 · Session ${item.target.session_uuid}`}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭阅读">关闭</button>
        </header>
        <div className="river-reading-body">
          {query.isPending && <p role="status" className="river-status-note">正在加载全文…</p>}
          {query.isError && <div role="alert" className="river-alert river-alert--danger">
            <p>{status === 403 ? '没有权限阅读此来源。' : status === 404 ? '此来源全文已不可读或不存在。' : `全文读取失败：${query.error.message}`}</p>
            <button type="button" onClick={() => { void query.refetch(); }}>重试读取全文</button>
          </div>}
          {query.isSuccess && content !== undefined && <>
            <p className="river-reading-count">全文 {Array.from(content).length} 字符</p>
            {content.length > 0
              ? <div className="river-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>{content}</ReactMarkdown></div>
              : <p>此条全文为空。</p>}
          </>}
        </div>
      </div>
    </div>, document.body,
  );
}
