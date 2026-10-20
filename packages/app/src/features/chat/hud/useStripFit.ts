import { useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

/**
 * Width the strip's pills are short of showing in full. Each pill wants its
 * natural width, capped by its own CSS max-width (that cap ellipsizes long
 * model names by design and is not a reason to collapse).
 */
function stripDeficit(strip: HTMLElement): number {
  let deficit = 0;
  strip.querySelectorAll<HTMLElement>('.v4-strip-item').forEach((item) => {
    const borders = item.offsetWidth - item.clientWidth;
    const cap = parseFloat(getComputedStyle(item).maxWidth);
    const wanted = Math.min(item.scrollWidth + borders, Number.isNaN(cap) ? Infinity : cap);
    deficit += Math.max(0, wanted - item.offsetWidth);
  });
  return deficit;
}

/**
 * Collapses the state strip to its essential pills when the full set cannot
 * sit side by side without ellipsizing (#72). The width the full set needs is
 * remembered at the moment it stops fitting, so the strip expands again as
 * soon as that much room is back. `contentKey` changes re-measure from the
 * full layout before paint.
 */
export function useStripFit(stripRef: RefObject<HTMLElement | null>, contentKey: string): boolean {
  const [compact, setCompact] = useState(false);
  const requiredWidth = useRef(0);

  useLayoutEffect(() => {
    setCompact(false);
  }, [contentKey]);

  useLayoutEffect(() => {
    const strip = stripRef.current;
    // jsdom (tests) has no ResizeObserver; the full strip is the fallback.
    if (!strip || typeof ResizeObserver === 'undefined') return;
    const evaluate = () => {
      if (compact) {
        if (strip.clientWidth >= requiredWidth.current) setCompact(false);
        return;
      }
      const deficit = stripDeficit(strip);
      if (deficit > 0) {
        requiredWidth.current = strip.clientWidth + deficit;
        setCompact(true);
      }
    };
    evaluate();
    const observer = new ResizeObserver(evaluate);
    observer.observe(strip);
    return () => observer.disconnect();
  }, [stripRef, compact, contentKey]);

  return compact;
}
