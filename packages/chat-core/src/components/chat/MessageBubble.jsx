import React, { useState, useCallback, useEffect, useRef } from 'react';
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

/**
 * Normalize Unicode lookalikes that break markdown parsing.
 * LLMs (especially Chinese-native models) sometimes emit fullwidth
 * grave accent (U+FF40) instead of ASCII backtick (U+0060), which
 * react-markdown does not recognize as a code delimiter → rendered
 * as literal text.
 */
const RE_UNICODE_BACKTICK = /[｀]/g;
const RE_UNICODE_TILDE = /[～]/g;
const RE_ENTITY_BACKTICK = /&#(?:96|x60);/gi;
function normalizeMarkdown(text) {
 if (!text) return text;
 return text
 .replace(RE_UNICODE_BACKTICK, '`')
 .replace(RE_UNICODE_TILDE, '~')
 .replace(RE_ENTITY_BACKTICK, '`');
}

// ── Mermaid lazy-load ────────────────────────────────────────────────
let mermaidLib = null;
async function ensureMermaid() {
 if (!mermaidLib) {
 const mod = await import('mermaid');
 mermaidLib = mod.default;
 mermaidLib.initialize({ startOnLoad: false, theme: 'base', securityLevel: 'strict' });
 }
 return mermaidLib;
}

// ── SVG sanitizer ────────────────────────────────────────────────────
const SVG_ALLOW_TAGS = new Set([
 'svg', 'g', 'defs', 'symbol', 'use', 'marker', 'pattern',
 'linearGradient', 'radialGradient', 'stop', 'filter',
 'feGaussianBlur', 'feOffset', 'feMerge', 'feMergeNode',
 'feColorMatrix', 'feBlend', 'feFlood', 'feComposite', 'feImage',
 'clipPath', 'mask', 'image',
 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon',
 'text', 'tspan', 'textPath',
 'title', 'desc', 'metadata', 'style',
 'animate', 'animateTransform', 'animateMotion', 'set',
 'foreignObject',
]);

function sanitizeSvg(svgString) {
 try {
 const parser = new DOMParser();
 const doc = parser.parseFromString(svgString, 'image/svg+xml');
 const svgEl = doc.documentElement;
 if (!svgEl || svgEl.tagName?.toLowerCase() !== 'svg') return null;

 function clean(el) {
  if (!SVG_ALLOW_TAGS.has(el.tagName?.toLowerCase())) {
  el.remove();
  return;
  }
  const toRemove = [];
  for (const attr of el.attributes) {
  const name = attr.name.toLowerCase();
  if (name.startsWith('on')) toRemove.push(name);
  if (name === 'href' && typeof attr.value === 'string' && attr.value.trim().toLowerCase().startsWith('javascript:')) toRemove.push(name);
  }
  toRemove.forEach(a => el.removeAttribute(a));
  Array.from(el.children).forEach(clean);
 }

 clean(svgEl);
 svgEl.setAttribute('width', '100%');
 if (!svgEl.hasAttribute('height') || svgEl.getAttribute('height') === '100%') {
  svgEl.setAttribute('height', 'auto');
 }
 return svgEl.outerHTML;
 } catch {
 return null;
 }
}

// ── Visual preview components ────────────────────────────────────────

function SvgPreview({ text }) {
 // Quick pre-check: if it doesn't look like SVG at all, bail early
 if (!/<svg\b/i.test(text)) {
 return (
  <div className="p-6 text-center text-[0.6875rem] tx-message-mute opacity-50 bg-white/[0.02] border border-exo-mist-8 rounded-b-[4px]">
  No SVG content detected — switch to Code tab to view source
  </div>
 );
 }
 const sanitized = sanitizeSvg(text);
 if (!sanitized) {
 return (
  <div className="p-6 text-center text-[0.6875rem] text-red-400/70 bg-red-500/5 border border-red-500/10 rounded-b-[4px]">
  Invalid SVG — cannot render preview
  </div>
 );
 }
 return (
 <div
  className="flex items-center justify-center p-4 bg-white/95 rounded-b-[4px] [&_svg]:max-h-[60vh]"
  dangerouslySetInnerHTML={{ __html: sanitized }}
 />
 );
}

function MermaidPreview({ text }) {
 const [svg, setSvg] = useState(null);
 const [error, setError] = useState(null);
 const idRef = useRef(`m-${Math.random().toString(36).slice(2, 8)}`);

 useEffect(() => {
 let cancelled = false;
 ensureMermaid()
  .then(m => m.render(idRef.current, text))
  .then(result => { if (!cancelled) setSvg(result.svg); })
  .catch(err => { if (!cancelled) setError(err.message || 'Mermaid render failed'); });
 return () => { cancelled = true; };
 }, [text]);

 if (error) {
 return (
  <div className="p-4 text-center text-[0.6875rem] text-amber-400/70 bg-amber-500/5 border border-amber-500/10 rounded-b-[4px]">
  Mermaid: {error}
  </div>
 );
 }
 if (!svg) {
 return (
  <div className="flex items-center justify-center p-8 bg-white/[0.03] rounded-b-[4px]">
  <div className="w-4 h-4 border-2 border-exo-accent/40 border-t-exo-accent rounded-full animate-spin" />
  </div>
 );
 }
 return (
 <div
  className="flex items-center justify-center p-4 bg-white/95 rounded-b-[4px] [&_svg]:max-h-[60vh]"
  dangerouslySetInnerHTML={{ __html: svg }}
 />
 );
}

function CodeBlock({ children, className }) {
 const [copied, setCopied] = useState(false);
 const lang = (className || '').split(' ').find(c => c.startsWith('language-'))?.replace('language-', '') || 'code';
 const [tab, setTab] = useState(lang === 'xml' ? 'code' : 'preview');
 const text = extractText(children);
 const isVisual = lang === 'svg' || lang === 'xml' || lang === 'mermaid';

 const handleCopy = () => {
 navigator.clipboard.writeText(String(text)).then(() => {
  setCopied(true);
  setTimeout(() => setCopied(false), 2000);
 }).catch(() => {});
 };

 const tabBtn = (t, label) => (
 <button
  onClick={() => setTab(t)}
  className={`text-[0.6875rem] px-1.5 transition-colors ${
  tab === t ? 'tx-message-mute opacity-70' : 'tx-message-mute opacity-25 hover:tx-message-mute opacity-50'
  }`}
  style={undefined}
 >
  {label}
 </button>
 );

 return (
 <div className="relative group/code my-4 rounded-[4px] overflow-hidden bg-exo-pure/8">
  <div className="flex items-center justify-between px-4 py-1.5">
  <div className="flex items-center gap-3 min-w-0">
   <span className="text-[0.6875rem] tx-message-mute opacity-35 select-none" style={undefined}>{lang}</span>
   {isVisual && (
   <div className="flex gap-1">
    {tabBtn('preview', 'Preview')}
    {tabBtn('code', 'Code')}
   </div>
   )}
  </div>
  <button
   onClick={handleCopy}
   className="flex items-center gap-1.5 text-[0.6875rem] tx-message-mute opacity-20 hover:tx-message-mute opacity-50 transition-colors"
   style={undefined}
  >
   {copied ? <Check size={11} strokeWidth={1} className="text-green-400" /> : <Copy size={11} strokeWidth={1} />}
   <span>{copied ? 'Copied' : 'Copy'}</span>
  </button>
  </div>
  {isVisual && tab === 'preview' ? (
  lang === 'svg' || lang === 'xml' ? <SvgPreview text={text} /> : <MermaidPreview text={text} />
  ) : (
  <pre className={`${className ?? ''} !mt-0 !rounded-none !border-0 !bg-transparent px-4 py-3`}>
   {children}
  </pre>
  )}
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
 // rehype-highlight adds 'hljs' class to ALL <code> elements (even inline),
 // so we can't use !className. Only block code has 'language-*' class.
 const isInline = !className?.includes('language-');
 if (isInline) {
  return <code className="bg-white/10 tx-message-accent px-1 py-0.5 rounded-[2px] text-[0.9em]" style={{ fontFamily: 'var(--font-code)' }} {...props}>{children}</code>;
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
  <span className={`text-[0.625rem] font-bold tracking-[0.2em] ${isUser ? 'tx-message-mute' : 'tx-message-accent'}`}>
   {isUser ? (userNick || 'You') : (agentName || 'Core')}
  </span>
  {msg.created_at && (
   <span className="text-[0.5625rem] tx-message-mute opacity-40 tracking-tight">
   {formatMessageTime(msg.created_at)}
   </span>
  )}
  </div>

  <div className={`w-full space-y-3 ${isUser ? 'flex flex-col items-end' : ''}`}>
  {!isUser && msg.error && (
   <div className="text-[0.6875rem] tracking-tight text-red-500 bg-red-500/5 border border-red-500/20 rounded-[2px] px-3 py-2">
   [ ERROR ] {msg.error}
   </div>
  )}
  {!isUser && msg.reasoning_content && (
   <details className="lcd-screen rounded-[4px] text-xs tx-message-mute cursor-pointer w-full group/think transition-all hover:border-exo-mist-20 bg-exo-pure/30 backdrop-blur-md">
   <summary className="p-2 flex items-center gap-2 label-caps tx-message-accent opacity-60 group-hover/think:tx-message-accent transition-colors">Thinking Process</summary>
   <div className="p-4 border-t border-exo-mist-10 bg-exo-pure/30 whitespace-pre-wrap leading-relaxed text-[0.6875rem]" style={{ fontFamily: 'var(--font-code)' }}>
    {msg.reasoning_steps && msg.reasoning_steps.map((step, sIdx) => (
    <div key={sIdx} className="inline-block text-[0.625rem] tracking-widest tx-message-accent opacity-70 bg-exo-accent/5 px-2 py-0.5 rounded-[2px] border border-exo-accent/10 mb-2 mr-2" style={{ fontFamily: 'var(--font-code)' }}>{step}</div>
    ))}
    {msg.reasoning_content}
   </div>
   </details>
  )}
  {!isUser && msg.status_text && (
   <div className="flex items-center gap-2 text-[0.6875rem] tracking-widest tx-message-accent opacity-80 bg-exo-accent/5 border border-exo-accent/15 rounded-[4px] px-3 py-2 animate-fade-in">
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
     className="relative group block h-32 max-w-[200px] rounded-[4px] overflow-hidden border border-white/[0.06] hover:border-exo-accent/40 transition-all cursor-zoom-in"
     title={att.name}
     >
     <img src={att.preview} alt={att.name} className="h-full w-full object-cover grayscale group-hover:grayscale-0 transition-all" />
     <div className="absolute inset-0 bg-black/0 group-hover:bg-exo-accent/10 transition-colors flex items-center justify-center">
      <ZoomIn size={18} strokeWidth={1} className="tx-message-normal opacity-0 group-hover:opacity-100 transition-opacity" />
     </div>
     </button>
    : <div key={i} className="flex items-center gap-1.5 text-[0.625rem] tracking-tighter bg-exo-pure/40 backdrop-blur-sm border border-white/[0.06] rounded-[4px] px-2 py-1.5 tx-message-mute">
     <FileText size={11} strokeWidth={1} className="text-blue-400 shrink-0" />
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
    className="absolute top-4 right-4 p-2 tx-message-normal opacity-50 hover:tx-message-normal transition-colors"
    onClick={() => setLightboxSrc(null)}
   >
    <X size={18} strokeWidth={1} />
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
   <div className="max-w-[92%] bg-exo-pure/40 backdrop-blur-md border border-white/[0.06] rounded-[4px] rounded-tr-none p-4 text-sm transition-all hover:border-exo-mist-20 prose prose-invert prose-sm prose-pre:!bg-transparent prose-pre:!p-0 prose-code:before:content-none prose-code:after:content-none tx-message-normal opacity-90" style={{ fontFamily: 'var(--font-message)' }}>
   <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeHighlight, rehypeKatex]} components={MD_COMPONENTS}>{normalizeMarkdown(msg.content)}</ReactMarkdown>
   </div>
  ) : (
   <div className="w-full prose prose-invert prose-sm max-w-none prose-pre:!bg-transparent prose-pre:!p-0 prose-code:before:content-none prose-code:after:content-none" style={{ fontFamily: 'var(--font-message)' }}>
   <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeHighlight, rehypeKatex]} components={MD_COMPONENTS}>{normalizeMarkdown(msg.content)}</ReactMarkdown>
   </div>
  )}
  </div>

  {/* Action toolbar */}
  <div className={`flex items-center gap-0.5 mt-2 ${isUser ? 'flex-row-reverse mr-2' : 'ml-1'}`} style={{ opacity: 0.5 }}>
  <button
   onClick={handleCopy}
   className="p-1 tx-message-normal-dim hover:tx-message-normal transition-colors"
   title="复制"
  >
   {copied ? <Check size={12} strokeWidth={1} className="text-green-400" /> : <Copy size={12} strokeWidth={1} />}
  </button>

  {isUser ? (
   <>
   <button
    onClick={() => onEdit && onEdit(msg)}
    disabled={isGenerating}
    className="p-1 tx-message-normal-dim hover:tx-message-normal transition-colors disabled:opacity-20"
    title="编辑并重发"
   >
    <Edit2 size={12} strokeWidth={1} />
   </button>
   <button
    onClick={() => onRegenerate && onRegenerate(msg)}
    disabled={isGenerating}
    className="p-1 tx-message-normal-dim hover:tx-message-normal transition-colors disabled:opacity-20"
    title="重新生成"
   >
    <RotateCw size={12} strokeWidth={1} />
   </button>
   </>
  ) : (
   <>
   <button
    onClick={() => onBranch && onBranch(msg.id)}
    disabled={isGenerating}
    className="p-1 tx-message-normal-dim hover:text-blue-400 transition-colors disabled:opacity-20"
    title="从此分叉"
   >
    <GitFork size={12} strokeWidth={1} />
   </button>
   <button
    onClick={openBookmark}
    className={`p-1 transition-colors ${showBookmark ? 'tx-message-accent' : 'tx-message-normal-dim hover:tx-message-normal'}`}
    title="标记到长期记忆"
   >
    <Bookmark size={12} strokeWidth={1} />
   </button>
   </>
  )}
  </div>

  {/* Bookmark panel */}
  {showBookmark && (
  <div className="w-full mt-3 border border-white/[0.06] rounded-[4px] bg-exo-pure/40 backdrop-blur-md overflow-hidden animate-fade-in">
   <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.04] bg-white/[0.02]">
   <span className="label-caps tx-message-accent opacity-70">ARCHIVE_TO_LONGTERM_MEMORY</span>
   <button onClick={() => setShowBookmark(false)} className="tx-message-mute opacity-50 hover:tx-message-normal transition-colors p-0.5">
    <X size={12} strokeWidth={1} />
   </button>
   </div>
   <div className="p-4 space-y-3">
   <textarea
    value={bookmarkText}
    onChange={e => setBookmarkText(e.target.value)}
    rows={4}
    className="w-full bg-exo-bg border border-exo-mist-10 rounded-[2px] px-3 py-2 text-xs tx-message-normal outline-none focus:border-exo-accent/50 resize-y leading-relaxed"
    placeholder="选取要标记的内容..."
   />
   <div className="flex justify-end gap-3">
    <button
    onClick={() => setShowBookmark(false)}
    className="px-3 py-1 text-[0.625rem] tracking-widest tx-message-mute hover:tx-message-normal transition-colors"
    >
    CANCEL
    </button>
    <button
    onClick={handleBookmarkSubmit}
    disabled={bookmarkStatus === 'saving' || bookmarkStatus === 'done'}
    className="px-4 py-1.5 bg-exo-accent/10 tx-message-accent border border-exo-accent/20 rounded-[2px] text-[0.625rem] tracking-widest hover:bg-exo-accent hover:text-black transition-colors disabled:opacity-50"
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