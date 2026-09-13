import { useEffect } from 'react';

export const APP_BASE_TITLE = 'ExoCore V4';

export function formatDocumentTitle(title?: string | null): string {
  const trimmed = title?.trim();
  return trimmed ? `${trimmed} · ${APP_BASE_TITLE}` : APP_BASE_TITLE;
}

/**
 * Shared document title owner (Plan §3 D3).
 * Formats title with uniform " · ExoCore V4" suffix, updates document.title,
 * and restores base title on unmount.
 */
export function useDocumentTitle(title?: string | null): void {
  useEffect(() => {
    document.title = formatDocumentTitle(title);
    return () => {
      document.title = APP_BASE_TITLE;
    };
  }, [title]);
}
