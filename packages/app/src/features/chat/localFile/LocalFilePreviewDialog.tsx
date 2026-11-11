import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import hljs from 'highlight.js/lib/common';
import dos from 'highlight.js/lib/languages/dos';
import powershell from 'highlight.js/lib/languages/powershell';
import { previewLocalFile, toAppApiError, type LocalFilePreview } from '../api';
import { useDialogA11y } from '../dialogA11y';
import { CopyPathButton } from './CopyPathButton';
import { parseLineRange } from './localFileLinks';

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
  sh: 'bash', bash: 'bash', ps1: 'powershell', bat: 'dos', cmd: 'dos',
  rs: 'rust', go: 'go', java: 'java',
  c: 'c', h: 'c', cpp: 'cpp', hpp: 'cpp', cs: 'csharp',
};

// Windows script grammars are outside `lib/common`; the frozen whitelist has them.
if (!hljs.getLanguage('powershell')) hljs.registerLanguage('powershell', powershell);
if (!hljs.getLanguage('dos')) hljs.registerLanguage('dos', dos);

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
  // Whole backend payload (≤ 1 MiB) is highlighted — no extra size cutoff (Alicia, #91).
  if (!language || !hljs.getLanguage(language)) return null;
  // hljs escapes the source; its output contains only its own span markup.
  return hljs.highlight(content, { language, ignoreIllegals: true }).value;
}

/** Source lines (a trailing newline does not add an empty last line). */
function splitLines(text: string): string[] {
  const lines = text.split('\n');
  if (lines.length > 1 && text.endsWith('\n')) lines.pop();
  return lines;
}

/**
 * Split hljs output into per-line HTML. hljs only emits `<span class=…>`,
 * `</span>` and escaped text, so spans open across a newline (multi-line
 * strings / comments) are closed at line end and reopened on the next line.
 */
function splitHighlightedLines(html: string): string[] {
  const lines: string[] = [];
  const open: string[] = [];
  let current = '';
  for (const [token] of html.matchAll(/<span[^>]*>|<\/span>|\n|[^<\n]+/g)) {
    if (token === '\n') {
      lines.push(current + '</span>'.repeat(open.length));
      current = open.join('');
    } else if (token === '</span>') {
      open.pop();
      current += token;
    } else {
      if (token.startsWith('<span')) open.push(token);
      current += token;
    }
  }
  lines.push(current + '</span>'.repeat(open.length));
  if (lines.length > 1 && html.endsWith('\n')) lines.pop();
  return lines;
}

function PreviewBody({ preview, rawHref }: { preview: LocalFilePreview; rawHref: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const html = useMemo(() => highlightHtml(preview.content, preview.name), [preview.content, preview.name]);
  const lines = useMemo(
    () => (html !== null ? splitHighlightedLines(html) : splitLines(preview.content)),
    [html, preview.content],
  );
  const range = useMemo(() => parseLineRange(rawHref, lines.length), [rawHref, lines.length]);

  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (!range || !scroller) return;
    // Rows size themselves (CJK fallback fonts make some rows taller), so
    // position from the real row instead of assuming a fixed line height.
    const row = scroller.querySelector<HTMLElement>(`[data-line="${range.start}"]`);
    if (row) scroller.scrollTop = Math.max(0, row.offsetTop - scroller.clientHeight / 4);
  }, [range]);

  return (
    <div ref={scrollRef} className="app-lfp-scroll" data-testid="local-file-scroll">
      <pre className={html !== null ? 'app-lfp-code hljs' : 'app-lfp-code'}>
        {lines.map((line, index) => {
          const number = index + 1;
          const hit = range !== null && number >= range.start && number <= range.end;
          return (
            <div key={number} className={hit ? 'app-lfp-row app-lfp-row--hit' : 'app-lfp-row'} data-line={number}>
              <span className="app-lfp-num" aria-hidden="true">
                {number}
              </span>
              {html !== null ? (
                <code className="app-lfp-text" dangerouslySetInnerHTML={{ __html: line }} />
              ) : (
                <code className="app-lfp-text">{line}</code>
              )}
            </div>
          );
        })}
      </pre>
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
