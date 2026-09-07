function parseBrowserUrl(value: string): URL | null {
  const trimmed = value.trim();
  if (!trimmed || typeof window === 'undefined') return null;
  try {
    return new URL(trimmed, window.location.origin);
  } catch {
    return null;
  }
}

/**
 * Historical audio is intentionally restricted to the backend's same-origin
 * content endpoint. Remote provider file_uri values are expiring and must
 * never become browser playback sources.
 */
export function validatedAudioContentUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = parseBrowserUrl(value);
  if (!parsed || !['http:', 'https:'].includes(parsed.protocol)) return null;
  if (parsed.origin !== window.location.origin) return null;
  return value.trim();
}

/**
 * Canonical image file_uri may be same-origin or an HTTPS provider URL, but
 * local-file, script, data and other unsupported schemes render a safe
 * filename fallback instead of being copied into <img src>.
 */
export function validatedImageFileUri(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = parseBrowserUrl(value);
  if (!parsed || !['http:', 'https:'].includes(parsed.protocol)) return null;
  return value.trim();
}
