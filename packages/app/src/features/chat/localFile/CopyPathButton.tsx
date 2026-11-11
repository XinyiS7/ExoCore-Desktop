import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';

type CopyState = 'idle' | 'copied' | 'failed';

/**
 * Copies the decoded local path. Clipboard can be unavailable (non-secure
 * context, denied permission): failure is shown explicitly together with the
 * path as selectable text so it can still be copied by hand.
 */
export function CopyPathButton({ path }: { path: string }) {
  const [state, setState] = useState<CopyState>('idle');
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleCopy = async () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    try {
      await navigator.clipboard.writeText(path);
    } catch {
      setState('failed');
      return;
    }
    setState('copied');
    timeoutRef.current = window.setTimeout(() => setState('idle'), 1500);
  };

  const label = state === 'copied' ? '已复制路径' : '复制路径';
  return (
    <>
      <button
        type="button"
        className="app-code-copy-btn app-localfile-copy"
        onClick={handleCopy}
        title={label}
        aria-label={label}
      >
        {state === 'copied' ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
      </button>
      {state === 'failed' ? (
        <span className="app-localfile-copy-failed" role="status">
          复制失败，请手动选择路径：<span className="app-localfile-path-text">{path}</span>
        </span>
      ) : null}
    </>
  );
}
