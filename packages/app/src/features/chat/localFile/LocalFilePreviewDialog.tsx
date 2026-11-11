import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import hljs from 'highlight.js/lib/common';
import { previewLocalFile, toAppApiError, type LocalFilePreview } from '../api';
import { useDialogA11y } from '../dialogA11y';
import { CopyPathButton } from './CopyPathButton';
import { parseLineRange } from './localFileLinks';

/** Must match `--lfp-line` in shell.css: rows are `white-space: pre`, so the
 *  gutter, code and range band all share one fixed row height. */
export const PREVIEW_LINE_PX = 20;
/** Above this size highlighting is skipped (hljs is synchronous). */
const HIGHLIGHT_LIMIT = 256 * 1024;

const LANGUAGE_BY_SUFFIX: Record<string, string> = {
  py: 'python', pyi: 'python',
  ts: 'typescript', tsx: 'typescript',
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  json: 'json', jsonl: 'json',
  md: 'markdown', markdown: 'markdown',
  yaml: 'yaml', yml: 'yaml',
  toml: 'ini', ini: 'ini', cfg: 'ini', conf: 'ini',
  html: 'xml', htm: 'xml', xml: 'xml', svg: 'xml', vue: 'xml',
  css: 'css', scss: 'scss', sql: 'sql',
  sh: 'bash', bash: 'bash',
  rs: 'rust', go: 'go', java: 'java',
  c: 'c', h: 'c', cpp: 'cpp', hpp: 'cpp', cs: 'csharp',
};

const ERROR_TEXT: Record<string, string> = {
  file_not_found: '文件不存在或已移动',
  unsupported_type: '不支持预览此类型',
  unsupported_path: '不支持预览此路径形式',
  message_not_found: '链接与消息内容不一致，无法预览',
};

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ok'; preview: LocalFilePreview }
  | { kind: 'error'; message: string };

function highlightHtml(content: string, name: string): string | null {
  const suffix = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : '';
  const language = LANGUAGE_BY_SUFFIX[suffix];
  if (!language || !hljs.getLanguage(language) || content.length > HIGHLIGHT_LIMIT) return null;
  // hljs escapes the source; its output contains only its own span markup.
  return hljs.highlight(content, { language, ignoreIllegals: true }).value;
}

function countLines(content: string): number {
  if (!content) return 1;
  const lines = content.split('\n').length;
  return content.endsWith('\n') ? lines - 1 : lines;
}

function PreviewBody({ preview, rawHref }: { preview: LocalFilePreview; rawHref: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lineCount = useMemo(() => countLines(preview.content), [preview.content]);
  const range = useMemo(() => parseLineRange(rawHref, lineCount), [rawHref, lineCount]);
  const html = useMemo(() => highlightHtml(preview.content, preview.name), [preview.content, preview.name]);

  useLayoutEffect(() => {
    if (range && scrollRef.current) {
      scrollRef.current.scrollTop = Math.max(0, (range.start - 3) * PREVIEW_LINE_PX);
    }
  }, [range]);

  return (
    <div ref={scrollRef} className="app-lfp-scroll" data-testid="local-file-scroll">
      <div className="app-lfp-grid">
        {range ? (
          <div
            className="app-lfp-band"
            data-testid="local-file-band"
            style={{
              top: (range.start - 1) * PREVIEW_LINE_PX,
              height: (range.end - range.start + 1) * PREVIEW_LINE_PX,
            }}
          />
        ) : null}
        <div className="app-lfp-gutter" aria-hidden="true">
          {Array.from({ length: lineCount }, (_, index) => (
            <span key={index}>{index + 1}</span>
          ))}
        </div>
        {html !== null ? (
          <pre className="app-lfp-code">
            <code className="hljs" dangerouslySetInnerHTML={{ __html: html }} />
          </pre>
        ) : (
          <pre className="app-lfp-code">
            <code>{preview.content}</code>
          </pre>
        )}
      </div>
    </div>
  );
}

export interface LocalFilePreviewDialogProps {
  conversationId: number;
  messageId: number;
  rawHref: string;
  displayPath: string;
  onClose: () => void;
}

/** Read-only, never-executing preview of a local text file (#91). */
export function LocalFilePreviewDialog({
  conversationId,
  messageId,
  rawHref,
  displayPath,
  onClose,
}: LocalFilePreviewDialogProps) {
  const dialogRef = useDialogA11y(true, onClose);
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  useEffect(() => {
    let live = true;
    setState({ kind: 'loading' });
    previewLocalFile(conversationId, messageId, rawHref)
      .then((preview) => {
        if (live) setState({ kind: 'ok', preview });
      })
      .catch((cause: unknown) => {
        if (!live) return;
        const error = toAppApiError(cause);
        setState({ kind: 'error', message: ERROR_TEXT[error.code] ?? '读取失败' });
      });
    return () => {
      live = false;
    };
  }, [conversationId, messageId, rawHref]);

  const fileName = displayPath.split(/[\\/]/).pop() || displayPath;

  return createPortal(
    <div
      className="app-lfp-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div ref={dialogRef} className="app-lfp" role="dialog" aria-modal="true" aria-label={`文件预览：${fileName}`}>
        <header className="app-lfp-head">
          <div className="app-lfp-title">
            <strong>{state.kind === 'ok' ? state.preview.name : fileName}</strong>
            <span className="app-lfp-path">{displayPath}</span>
          </div>
          <CopyPathButton path={displayPath} />
          <button type="button" className="app-lfp-close" onClick={onClose} title="关闭预览" aria-label="关闭预览">
            <X size={16} aria-hidden="true" />
          </button>
        </header>
        {state.kind === 'ok' && state.preview.truncated ? (
          <p className="app-lfp-notice">文件较大，仅显示前 1 MiB</p>
        ) : null}
        {state.kind === 'loading' ? <p className="app-muted app-lfp-status">读取中…</p> : null}
        {state.kind === 'error' ? (
          <p className="app-lfp-status app-lfp-error" role="alert">
            {state.message}，可复制路径自行打开
          </p>
        ) : null}
        {state.kind === 'ok' ? <PreviewBody preview={state.preview} rawHref={rawHref} /> : null}
      </div>
    </div>,
    document.body,
  );
}
