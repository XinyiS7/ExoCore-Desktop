import { useState } from 'react';

/**
 * Small inline avatar for a message head (#72 U7). The name lives only in the
 * alt / title; it is not a link. A broken image falls back to the name's
 * first character.
 */
export function MessageAvatar({ src, name }: { src: string; name: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  return (
    <span className="app-msg-avatar" title={name}>
      {src && failedSrc !== src ? (
        <img src={src} alt={name} onError={() => setFailedSrc(src)} />
      ) : (
        <span role="img" aria-label={name}>
          {Array.from(name)[0] ?? '?'}
        </span>
      )}
    </span>
  );
}
