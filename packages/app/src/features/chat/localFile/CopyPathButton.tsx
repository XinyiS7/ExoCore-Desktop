import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';

export function CopyPathButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(path);
      setCopied(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable: the path stays visible/selectable in the title.
    }
  };

  return (
    <button
      type="button"
      className="app-code-copy-btn app-localfile-copy"
      onClick={handleCopy}
      title={copied ? '已复制路径' : '复制路径'}
      aria-label={copied ? '已复制路径' : '复制路径'}
    >
      {copied ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
    </button>
  );
}
