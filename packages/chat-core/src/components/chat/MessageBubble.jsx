import React, { useState, useCallback, useEffect } from 'react';
import { FileText, Copy, Bookmark, Check, X, ZoomIn, Edit2, RotateCw, GitFork } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import { baseUrl, getCsrfToken } from 'exo-shared';
import { formatMessageTime } from '../../utils/time';

function extractText(node) {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (node?.props?.children != null) return extractText(node.props.children);
  return '';
}

function CodeBlock({ children, className }) {
  const [copied, setCopied] = useState(false);
  const lang = (className || '').split(' ').find(c => c.startsWith('language-'))?.replace('language-', '') || 'code';
  const text = extractText(children);

  const handleCopy = () => {
    navigator.clipboard.writeText(String(text)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  return (
    <div className="relative group/code my-4">
      <div className="flex items-center justify-between px-3 py-1.5 bg-exo-pure border border-exo-mist-10 border-b-0 rounded-t-[4px]">
        <span className="text-[10px] text-exo-muted font-mono uppercase tracking-[0.2em]">{lang}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-[2px] text-[10px] text-exo-muted hover:text-exo-accent hover:bg-exo-accent/5 transition-all"
        >
          {copied ? <Check size={10} className="text-green-400" /> : <Copy size={10} />}
          <span className="uppercase tracking-widest">{copied ? 'COPIED' : 'COPY'}</span>
        </button>
      </div>
      <pre className={`${className ?? ''} !mt-0 !rounded-t-none !rounded-b-[4px] !border-exo-mist-10 !bg-exo-bg`}>
        {children}
      </pre>
    </div>
  );
}

const MD_COMPONENTS = {
  pre({ children, ...props }) {
    // When a custom `code` component is defined, react-markdown sets type to the
    // component function rather than the string 'code' — check both cases.
    const codeEl = React.Children.toArray(children).find(
      c => c?.type === 'code' || typeof c?.type === 'function'
    );
    if (codeEl) {
      return <CodeBlock className={codeEl.props?.className}>{codeEl.props?.children}</CodeBlock>;
    }
    return <pre {...props} className="bg-exo-pure border border-exo-mist-10 p-4 rounded-[4px] my-4">{children}</pre>;
  },
  code({ children, className, ...props }) {
    const isInline = !className;
    if (isInline) {
      return <code className="bg-white/10 text-exo-accent px-1 py-0.5 rounded-[2px] font-mono text-[0.9em]" {...props}>{children}</code>;
    }
    return <code className={className} {...props}>{children}</code>;
  }
};

const MessageBubble = React.memo(({ msg, agentName, agentAvatarUrl, userNick, userAvatarUrl, onEdit, onRegenerate, onBranch, isGenerating }) => {
  const isUser = msg.role === 'user';
  const [copied, setCopied] = useState(false);
  const [showBookmark, setShowBookmark] = useState(false);
  const [bookmarkText, setBookmarkText] = useState('');
  const [bookmarkStatus, setBookmarkStatus] = useState(null); // null | 'saving' | 'done' | 'error'
  const [lightboxSrc, setLightboxSrc] = useState(null);

  // Escape 键关闭 lightbox
  useEffect(() => {
    if (!lightboxSrc) return;
    const handler = e => { if (e.key === 'Escape') setLightboxSrc(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightboxSrc]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(msg.content || '').then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }, [msg.content]);

  const openBookmark = useCallback(() => {
    setBookmarkText(msg.content || '');
    setBookmarkStatus(null);
    setShowBookmark(true);
  }, [msg.content]);

  const handleBookmarkSubmit = useCallback(async () => {
    if (!bookmarkText.trim()) return;
    setBookmarkStatus('saving');
    try {
      const res = await fetch(`${baseUrl}/api/memory/portraits/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
        credentials: 'include',
        body: JSON.stringify({ message_id: msg.id, content: bookmarkText.trim() }),
      });
      if (res.ok) {
        setBookmarkStatus('done');
        setTimeout(() => { setShowBookmark(false); setBookmarkStatus(null); }, 1500);
      } else {
        setBookmarkStatus('error');
      }
    } catch {
      setBookmarkStatus('error');
    }
  }, [msg.id, bookmarkText]);

  return (
    <div className={`flex flex-col group w-full ${isUser ? 'items-end' : 'items-start'}`}>
      <div className={`flex items-center gap-3 mb-2 ${isUser ? 'flex-row-reverse' : ''}`}>
        <img
          src={isUser ? userAvatarUrl : agentAvatarUrl}
          className={`w-6 h-6 rounded-[2px] border bg-exo-pure object-cover ${isUser ? 'border-exo-mist-20' : 'border-exo-accent/40 shadow-glow-gold'}`}
          alt={isUser ? (userNick || 'You') : (agentName || 'Core')}
        />
        <span className={`text-[10px] font-mono font-bold tracking-[0.2em] uppercase ${isUser ? 'text-exo-muted' : 'text-exo-accent'}`}>
          {isUser ? (userNick || 'You') : (agentName || 'Core')}
        </span>
        {msg.created_at && (
          <span className="text-[9px] font-mono text-exo-muted/40 tracking-tight">
            {formatMessageTime(msg.created_at)}
          </span>
        )}
      </div>

      <div className={`w-full space-y-3 ${isUser ? 'flex flex-col items-end' : ''}`}>
        {!isUser && msg.error && (
          <div className="text-[11px] font-mono uppercase tracking-tight text-red-500 bg-red-500/5 border border-red-500/20 rounded-[2px] px-3 py-2">
            [ ERROR ] {msg.error}
          </div>
        )}
        {!isUser && msg.reasoning_content && (
          <details className="lcd-screen rounded-[4px] text-xs text-exo-muted cursor-pointer w-full group/think transition-all hover:border-exo-mist-20">
            <summary className="p-2 flex items-center gap-2 label-caps text-exo-accent/60 group-hover/think:text-exo-accent transition-colors">Thinking Process</summary>
            <div className="p-4 border-t border-exo-mist-10 bg-exo-pure/50 whitespace-pre-wrap font-mono leading-relaxed text-[11px]">
              {msg.reasoning_steps && msg.reasoning_steps.map((step, sIdx) => (
                <div key={sIdx} className="inline-block text-[10px] font-mono uppercase tracking-widest text-exo-accent/70 bg-exo-accent/5 px-2 py-0.5 rounded-[2px] border border-exo-accent/10 mb-2 mr-2">{step}</div>
              ))}
              {msg.reasoning_content}
            </div>
          </details>
        )}
        {!isUser && msg.status_text && (
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-exo-accent/80 bg-exo-accent/5 border border-exo-accent/15 rounded-[4px] px-3 py-2 animate-fade-in">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-exo-accent animate-blink-sharp shrink-0" />
            <span>{msg.status_text}</span>
          </div>
        )}
        {isUser && msg.attachments?.length > 0 && (
          <div className="flex flex-wrap gap-2 justify-end">
            {msg.attachments.map((att, i) => (
              att.preview
                ? <button
                    key={i}
                    onClick={() => setLightboxSrc(att.preview)}
                    className="relative group block h-32 max-w-[200px] rounded-[4px] overflow-hidden border border-exo-mist-12 hover:border-exo-accent/40 transition-all cursor-zoom-in"
                    title={att.name}
                  >
                    <img src={att.preview} alt={att.name} className="h-full w-full object-cover grayscale group-hover:grayscale-0 transition-all" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-exo-accent/10 transition-colors flex items-center justify-center">
                      <ZoomIn size={20} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </button>
                : <div key={i} className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-tighter bg-exo-pure border border-exo-mist-12 rounded-[4px] px-2 py-1.5 text-exo-muted">
                    <FileText size={11} className="text-blue-400 shrink-0" />
                    <span className="truncate max-w-[160px]">{att.name}</span>
                  </div>
            ))}
          </div>
        )}

        {/* 图片 Lightbox */}
        {lightboxSrc && (
          <div
            className="fixed inset-0 z-[200] bg-exo-bg/95 backdrop-blur-md flex items-center justify-center"
            onClick={() => setLightboxSrc(null)}
          >
            <button
              className="absolute top-4 right-4 p-2 text-white/60 hover:text-white bg-white/10 rounded-full transition-colors"
              onClick={() => setLightboxSrc(null)}
            >
              <X size={20} />
            </button>
            <img
              src={lightboxSrc}
              className="max-w-[90vw] max-h-[90vh] object-contain rounded-[4px] border border-exo-mist-20 shadow-2xl"
              onClick={e => e.stopPropagation()}
              alt="preview"
            />
          </div>
        )}
        {isUser ? (
          <div className="max-w-[92%] bg-exo-pure border border-exo-mist-12 rounded-[4px] rounded-tr-none p-4 text-sm shadow-brutalist transition-all hover:border-exo-mist-20 prose prose-invert prose-sm prose-pre:!bg-transparent prose-pre:!p-0 text-white/90">
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeHighlight, rehypeKatex]} components={MD_COMPONENTS}>{msg.content}</ReactMarkdown>
          </div>
        ) : (
          <div className="w-full prose prose-invert prose-sm max-w-none prose-pre:!bg-transparent prose-pre:!p-0">
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeHighlight, rehypeKatex]} components={MD_COMPONENTS}>{msg.content}</ReactMarkdown>
          </div>
        )}
      </div>

      {/* Action toolbar */}
      <div className={`flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity ${isUser ? 'flex-row-reverse mr-2' : 'ml-1'}`}>
        <button
          onClick={handleCopy}
          className="p-1.5 text-exo-muted/30 hover:text-exo-accent transition-colors rounded-[2px] border border-transparent hover:border-exo-mist-10 hover:bg-exo-pure"
          title="复制"
        >
          {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
        </button>

        {isUser ? (
          <button
            onClick={() => onEdit && onEdit(msg)}
            disabled={isGenerating}
            className="p-1.5 text-exo-muted/30 hover:text-exo-accent transition-colors rounded-[2px] border border-transparent hover:border-exo-mist-10 hover:bg-exo-pure disabled:opacity-20"
            title="编辑并重发"
          >
            <Edit2 size={12} />
          </button>
        ) : (
          <>
            <button
              onClick={() => onRegenerate && onRegenerate(msg)}
              disabled={isGenerating}
              className="p-1.5 text-exo-muted/30 hover:text-exo-accent transition-colors rounded-[2px] border border-transparent hover:border-exo-mist-10 hover:bg-exo-pure disabled:opacity-20"
              title="重新生成"
            >
              <RotateCw size={12} />
            </button>
            <button
              onClick={() => onBranch && onBranch(msg.id)}
              disabled={isGenerating}
              className="p-1.5 text-exo-muted/30 hover:text-blue-400 transition-colors rounded-[2px] border border-transparent hover:border-exo-mist-10 hover:bg-exo-pure disabled:opacity-20"
              title="从此分叉"
            >
              <GitFork size={12} />
            </button>
            <button
              onClick={openBookmark}
              className={`p-1.5 transition-colors rounded-[2px] border border-transparent hover:border-exo-mist-10 hover:bg-exo-pure ${showBookmark ? 'text-exo-accent' : 'text-exo-muted/30 hover:text-exo-accent'}`}
              title="标记到长期记忆"
            >
              <Bookmark size={12} />
            </button>
          </>
        )}
      </div>

      {/* Bookmark panel */}
      {showBookmark && (
        <div className="w-full mt-3 border border-exo-accent/20 rounded-[4px] bg-exo-pure shadow-brutalist overflow-hidden animate-fade-in">
          <div className="flex items-center justify-between px-3 py-2 border-b border-exo-mist-10 bg-exo-accent/5">
            <span className="label-caps text-exo-accent/70">ARCHIVE_TO_LONGTERM_MEMORY</span>
            <button onClick={() => setShowBookmark(false)} className="text-exo-muted/50 hover:text-white transition-colors rounded p-0.5">
              <X size={12} />
            </button>
          </div>
          <div className="p-4 space-y-3">
            <textarea
              value={bookmarkText}
              onChange={e => setBookmarkText(e.target.value)}
              rows={4}
              className="w-full bg-exo-bg border border-exo-mist-10 rounded-[2px] px-3 py-2 text-xs text-white outline-none focus:border-exo-accent/50 resize-y font-mono leading-relaxed"
              placeholder="选取要标记的内容..."
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowBookmark(false)}
                className="px-3 py-1 text-[10px] font-mono uppercase tracking-widest text-exo-muted hover:text-white transition-colors"
              >
                CANCEL
              </button>
              <button
                onClick={handleBookmarkSubmit}
                disabled={bookmarkStatus === 'saving' || bookmarkStatus === 'done'}
                className="px-4 py-1.5 bg-exo-accent/10 text-exo-accent border border-exo-accent/20 rounded-[2px] text-[10px] font-mono uppercase tracking-widest hover:bg-exo-accent hover:text-black transition-all disabled:opacity-50"
              >
                {bookmarkStatus === 'saving' ? 'UPLOADING...'
                  : bookmarkStatus === 'done' ? '✓ ARCHIVED'
                  : bookmarkStatus === 'error' ? 'RETRY'
                  : 'ARCHIVE_DATA'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default MessageBubble;