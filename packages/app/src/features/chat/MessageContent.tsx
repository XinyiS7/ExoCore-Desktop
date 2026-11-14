import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, Copy } from 'lucide-react';
import ReactMarkdown, { defaultUrlTransform, type Components, type UrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema, type Options as SanitizeSchema } from 'rehype-sanitize';
import { LocalFileLink, type LocalFilePreviewTarget } from './localFile/LocalFileLink';
import { LOCAL_FILE_PROTOCOL, fromLocalFileMarker, remarkLocalFileLinks } from './localFile/localFileLinks';
import { InlineTagView } from './inlineTags/InlineTagViews';
import { withTagPlaceholders, type InlineTagRole } from './inlineTags/placeholders';
import type { InlineRollView, PresentationView } from './types';
import { AudioPlayerBubble } from './audio/AudioPlayerBubble';

/**
 * Read-only persisted-message renderer (Plan §6.6 / Task 7.5).
 * - Markdown/GFM + code highlight + KaTeX math stay readable;
 * - raw HTML IS rendered so agents can emit inline cards (`<div style="…">`,
 *   `<span style="…">`, `<details>`, `<figure>`, …); every node passes
 *   rehype-sanitize first, so `script`/`style`/`iframe`/`form`/`svg`, every
 *   `on*` handler and `javascript:` URLs never reach React;
 * - Mermaid is lazy-loaded only when a mermaid fence actually appears.
 *
 * Plugin order is load-bearing: raw → sanitize → highlight → katex. The
 * sanitizer therefore only ever inspects untrusted (agent/user) input, and the
 * hljs/katex markup generated afterwards is never stripped. `className` must
 * survive sanitizing because remark-math marks math with
 * `math-inline`/`math-display` classes that rehype-katex looks for.
 *
 * Local file links (#91): `remarkLocalFileLinks` rewrites Markdown links to
 * `file:///` / drive paths into an `exo-local:` marker; sanitize and the custom
 * `urlTransform` let only that marker through, and the `a` component renders it
 * as a preview entry (only when both ids are given) or a copy-only path.
 */

const RAW_HTML_SCHEMA: SanitizeSchema = {
  ...defaultSchema,
  // Allow-list extension only: presentation-oriented elements agents use in
  // cards. Anything unnamed (script/style/iframe/form/svg/video/…) stays
  // stripped by the default schema.
  tagNames: [...(defaultSchema.tagNames ?? []), 'figure', 'figcaption', 'mark'],
  protocols: {
    ...defaultSchema.protocols,
    href: [...(defaultSchema.protocols?.href ?? []), LOCAL_FILE_PROTOCOL],
  },
  attributes: {
    ...defaultSchema.attributes,
    // Inline `style` is the point of the feature; `className` carries both
    // author classes and the math markers above.
    '*': [...(defaultSchema.attributes?.['*'] ?? []), 'style', 'className'],
    // #130: inline action tag placeholders (index into this message's tags).
    div: [...(defaultSchema.attributes?.div ?? []), 'dataItagRef'],
    span: [...(defaultSchema.attributes?.span ?? []), 'dataItagRef'],
  },
};

/** Tag names that reach the raw-HTML stage as markup; everything else stays text (#130 CP1-F01/F03). */
const HTML_TAG_NAMES: ReadonlySet<string> = new Set(RAW_HTML_SCHEMA.tagNames ?? []);

function extractText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (typeof node === 'object' && node !== null && 'props' in node) {
    return extractText((node as { props: { children?: ReactNode } }).props.children ?? '');
  }
  return '';
}

// ── Mermaid (lazy singleton; loaded only when required) ───────────────────

type MermaidApi = typeof import('mermaid').default;
let mermaidPromise: Promise<MermaidApi> | null = null;

function loadMermaid(): Promise<MermaidApi> {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((module) => {
      const api = module.default;
      api.initialize({ startOnLoad: false, securityLevel: 'strict' });
      return api;
    });
  }
  return mermaidPromise;
}

function MermaidDiagram({ code }: { code: string }) {
  const rawId = useId();
  const elementId = useMemo(() => `v4m-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`, [rawId]);
  const [state, setState] = useState<{ kind: 'loading' } | { kind: 'ok'; svg: string } | { kind: 'error'; message: string }>({
    kind: 'loading',
  });

  useEffect(() => {
    let live = true;
    setState({ kind: 'loading' });
    loadMermaid()
      .then(async (api) => {
        const { svg } = await api.render(elementId, code);
        if (live) setState({ kind: 'ok', svg });
      })
      .catch((cause: unknown) => {
        if (live) {
          setState({
            kind: 'error',
            message: cause instanceof Error ? cause.message : '图表渲染失败',
          });
        }
      });
    return () => {
      live = false;
    };
  }, [code, elementId]);

  if (state.kind === 'ok') {
    return <div className="app-mermaid" dangerouslySetInnerHTML={{ __html: state.svg }} />;
  }
  if (state.kind === 'error') {
    return (
      <pre className="app-code-block">
        <code>{code}</code>
      </pre>
    );
  }
  return <p className="app-muted">渲染图表…</p>;
}

// ── Code blocks ────────────────────────────────────────────────────────────

// Note: the optional copy action is intentionally absent in P1A (razor route,
// C1A-R1-05): no clipboard API surface, hence no silent-failure channel.

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const handleCopy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Graceful fallback: silently ignore or let user select text manually
    }
  };

  if (lang === 'mermaid') {
    return (
      <div className="app-code-wrap">
        <div className="app-code-head">
          <span className="app-code-lang">mermaid</span>
          <button
            type="button"
            className="app-code-copy-btn"
            onClick={handleCopy}
            title={copied ? '已复制代码' : '复制代码'}
            aria-label={copied ? '已复制代码' : '复制代码'}
          >
            {copied ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
            <span>{copied ? '已复制' : '复制'}</span>
          </button>
        </div>
        <MermaidDiagram code={code} />
      </div>
    );
  }
  return (
    <div className="app-code-wrap">
      <div className="app-code-head">
        <span className="app-code-lang">{lang || 'code'}</span>
        <button
          type="button"
          className="app-code-copy-btn"
          onClick={handleCopy}
          title={copied ? '已复制代码' : '复制代码'}
          aria-label={copied ? '已复制代码' : '复制代码'}
        >
          {copied ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
          <span>{copied ? '已复制' : '复制'}</span>
        </button>
      </div>
      <pre className="app-code-block">
        <code>{code}</code>
      </pre>
    </div>
  );
}

const MD_COMPONENTS: Components = {
  pre({ children }) {
    // react-markdown renders the (custom) code component as a child element
    // with props on it — lift className/children into our own block wrapper.
    const codeChild = (Array.isArray(children) ? children : [children]).find(
      (child) => typeof child === 'object' && child !== null && 'props' in child,
    ) as { props?: { className?: string; children?: ReactNode } } | undefined;
    if (codeChild?.props) {
      const className = codeChild.props.className ?? '';
      const lang =
        className
          .split(' ')
          .find((token) => token.startsWith('language-'))
          ?.replace('language-', '') ?? '';
      return <CodeBlock lang={lang} code={extractText(codeChild.props.children)} />;
    }
    return <pre className="app-code-block">{children}</pre>;
  },
  code({ children, className }) {
    // rehype-highlight adds `hljs` to every <code>; only block code carries
    // `language-*`, so inline detection stays reliable (V3-proven trick).
    const isInline = !className?.includes('language-');
    if (isInline) {
      return (
        <code className="app-inline-code">
          {children}
        </code>
      );
    }
    return <code className={className}>{children}</code>;
  },
};

const urlTransform: UrlTransform = (url) =>
  fromLocalFileMarker(url) !== null ? url : defaultUrlTransform(url);

export interface MessageContentProps {
  content: string;
  /** Persisted assistant message: both ids enable local file previews. */
  conversationId?: number;
  messageId?: number;
  /** Streaming assistant reply (no id yet): local links say preview comes later. */
  localFilePending?: boolean;
  /**
   * Chat message bodies only (#130): parse inline action tags for this
   * author role. Omitted (reasoning, tool rows, spoiler bodies) = plain Markdown.
   */
  inlineTags?: InlineTagRole;
  /** The body is still streaming: hold back half tags, animate open speak. */
  streaming?: boolean;
  /** #130 CP2: persisted assistant roll results, matched to `<roll>` chips by tag index. */
  inlineRolls?: readonly InlineRollView[];
  /** #130 CP5: persisted `<speak>` voices, matched to speak cards by tag index. */
  inlineVoices?: readonly PresentationView[];
}

export function MessageContent({
  content,
  conversationId,
  messageId,
  localFilePending,
  inlineTags,
  streaming = false,
  inlineRolls,
  inlineVoices,
}: MessageContentProps) {
  const { markdown, tags } = useMemo(
    () => withTagPlaceholders(content, inlineTags, streaming, HTML_TAG_NAMES),
    [content, inlineTags, streaming],
  );

  const components = useMemo<Components>(() => {
    const target: LocalFilePreviewTarget | undefined =
      conversationId !== undefined && messageId !== undefined ? { conversationId, messageId } : undefined;
    const renderBody = (body: string) => (
      <MessageContent
        content={body}
        conversationId={conversationId}
        messageId={messageId}
        localFilePending={localFilePending}
      />
    );
    const tagAt = (ref: unknown) => {
      const placed = typeof ref === 'string' ? tags[Number(ref)] : undefined;
      if (!placed) return null;
      const roll = inlineRolls?.find((r) => r.tagIndex === placed.index);
      const media = inlineVoices?.find((v) => v.inlineTagIndex === placed.index)?.media;
      const voice = media ? (
        <AudioPlayerBubble attachment={media} conversationId={conversationId} transcriptEligible />
      ) : undefined;
      return (
        <InlineTagView tag={placed.tag} streaming={streaming} renderBody={renderBody} roll={roll} voice={voice} />
      );
    };
    return {
      ...MD_COMPONENTS,
      div({ node: _node, children, ...rest }) {
        const ref = (rest as Record<string, unknown>)['data-itag-ref'];
        if (ref !== undefined) return tagAt(ref);
        return <div {...rest}>{children}</div>;
      },
      span({ node: _node, children, ...rest }) {
        const ref = (rest as Record<string, unknown>)['data-itag-ref'];
        if (ref !== undefined) return tagAt(ref);
        return <span {...rest}>{children}</span>;
      },
      a({ node: _node, href, children, ...rest }) {
        const rawHref = fromLocalFileMarker(href);
        if (rawHref !== null) {
          return (
            <LocalFileLink rawHref={rawHref} target={target} pending={localFilePending}>
              {children}
            </LocalFileLink>
          );
        }
        return (
          <a href={href} {...rest}>
            {children}
          </a>
        );
      },
    };
  }, [conversationId, messageId, localFilePending, tags, streaming, inlineRolls, inlineVoices]);

  return (
    <div className="app-md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath, remarkLocalFileLinks]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, RAW_HTML_SCHEMA], rehypeHighlight, rehypeKatex]}
        urlTransform={urlTransform}
        components={components}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
