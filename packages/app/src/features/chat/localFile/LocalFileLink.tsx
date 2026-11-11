import { useState, type ReactNode } from 'react';
import { FileText } from 'lucide-react';
import { CopyPathButton } from './CopyPathButton';
import { LocalFilePreviewDialog } from './LocalFilePreviewDialog';
import { localFileDisplayPath } from './localFileLinks';

export interface LocalFilePreviewTarget {
  conversationId: number;
  messageId: number;
}

export interface LocalFileLinkProps {
  rawHref: string;
  children: ReactNode;
  /** Persisted assistant message the link belongs to; absent → copy only. */
  target?: LocalFilePreviewTarget;
  /** Streaming message without an id yet: show why preview is unavailable. */
  pending?: boolean;
}

export function LocalFileLink({ rawHref, children, target, pending }: LocalFileLinkProps) {
  const [open, setOpen] = useState(false);
  const displayPath = localFileDisplayPath(rawHref);

  return (
    <span className="app-localfile" data-local-file={displayPath}>
      {target ? (
        <button type="button" className="app-localfile-link" title={`预览 ${displayPath}`} onClick={() => setOpen(true)}>
          <FileText size={13} aria-hidden="true" />
          <span>{children}</span>
        </button>
      ) : (
        <span className="app-localfile-link app-localfile-link--static" title={displayPath}>
          <FileText size={13} aria-hidden="true" />
          <span>{children}</span>
        </span>
      )}
      <CopyPathButton path={displayPath} />
      {!target && pending ? <span className="app-localfile-hint">消息完成后可预览</span> : null}
      {open && target ? (
        <LocalFilePreviewDialog
          conversationId={target.conversationId}
          messageId={target.messageId}
          rawHref={rawHref}
          displayPath={displayPath}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </span>
  );
}
