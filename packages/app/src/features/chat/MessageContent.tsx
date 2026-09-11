import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

/**
 * Read-only persisted-message renderer (Plan §6.6 / Task 7.5).
 * - Markdown/GFM + code highlight + KaTeX math stay readable;
 * - raw HTML is NOT rendered (no rehype-raw, mirroring V3) — no script surface;
 * - Mermaid is lazy-loaded only when a mermaid fence actually appears.
 */

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
  if (lang === 'mermaid') {
    return (
      <div className="app-code-wrap">
        <div className="app-code-head">
          <span className="app-code-lang">mermaid</span>
        </div>
        <MermaidDiagram code={code} />
      </div>
    );
  }
  return (
    <div className="app-code-wrap">
      <div className="app-code-head">
        <span className="app-code-lang">{lang || 'code'}</span>
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

export function MessageContent({ content }: { content: string }) {
  return (
    <div className="app-md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={MD_COMPONENTS}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
