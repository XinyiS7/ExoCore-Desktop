const FALLBACK_TIMEZONE = 'Europe/Berlin';

export function getUserTimezone() {
  const stored = localStorage.getItem('exo_user_timezone');
  if (stored) return stored;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || FALLBACK_TIMEZONE;
  } catch {
    return FALLBACK_TIMEZONE;
  }
}

export function formatMessageTime(isoString, timezone) {
  if (!isoString) return '';
  const tz = timezone || getUserTimezone();
  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: tz,
    }).format(new Date(isoString));
  } catch {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: FALLBACK_TIMEZONE,
    }).format(new Date(isoString));
  }
}

export function formatDateSeparator(isoString, timezone) {
  if (!isoString) return '';
  const tz = timezone || getUserTimezone();
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      timeZone: tz,
    }).format(new Date(isoString));
  } catch {
    return new Intl.DateTimeFormat('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      timeZone: FALLBACK_TIMEZONE,
    }).format(new Date(isoString));
  }
}

export function isDifferentDay(isoA, isoB, timezone) {
  if (!isoA || !isoB) return false;
  const tz = timezone || getUserTimezone();
  try {
    const opts = { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric' };
    const fmt = new Intl.DateTimeFormat('en-US', opts);
    return fmt.format(new Date(isoA)) !== fmt.format(new Date(isoB));
  } catch {
    const opts = { timeZone: FALLBACK_TIMEZONE, year: 'numeric', month: 'numeric', day: 'numeric' };
    const fmt = new Intl.DateTimeFormat('en-US', opts);
    return fmt.format(new Date(isoA)) !== fmt.format(new Date(isoB));
  }
}
