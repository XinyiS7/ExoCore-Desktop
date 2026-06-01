import React, { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import { baseUrl, getCsrfToken } from 'exo-shared';

const CACHE_TTL = 1500;  // matches ContextCacheManager DEFAULT_TTL_SECONDS (25min)
const POLL_INTERVAL = 30000;
const TICK_INTERVAL = 1000;
const STORAGE_PREFIX = 'exo_cache_';

function loadFromStorage(sessionId) {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${sessionId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Snapshot-only entries have hasSnapshot but no expiresAt
    if (parsed.hasSnapshot) {
      if (localStorage.getItem(`${STORAGE_PREFIX}${sessionId}_released`)) {
        return null;
      }
      return { ...parsed, active: false, remaining_seconds: 0 };
    }
    if (!parsed.expiresAt) return null;
    const remaining = Math.floor((new Date(parsed.expiresAt).getTime() - Date.now()) / 1000);
    if (remaining <= 0) {
      localStorage.removeItem(`${STORAGE_PREFIX}${sessionId}`);
      return null;
    }
    return { ...parsed, active: true, remaining_seconds: remaining };
  } catch {
    return null;
  }
}

function saveToStorage(sessionId, data) {
  const payload = {
    savedAt: Date.now(),
    platform: data.platform,
    hasSnapshot: data.has_snapshot ?? false,
    snapshotCacheEndIdx: data.snapshot_cache_end_idx,
  };
  if (data.active && data.expires_at) {
    payload.expiresAt = data.expires_at;
    payload.renewals = data.renewals ?? 0;
  }
  localStorage.setItem(`${STORAGE_PREFIX}${sessionId}`, JSON.stringify(payload));
}

function clearStorage(sessionId) {
  localStorage.removeItem(`${STORAGE_PREFIX}${sessionId}`);
}

const ContextCacheIndicator = forwardRef(function ContextCacheIndicator({ activeSessionId }, ref) {
  const [cacheState, setCacheState] = useState(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [tooltipPos, setTooltipPos] = useState(null);
  const tickRef = useRef(null);
  const triggerRef = useRef(null);
  const pollRef = useRef(null);
  const sessionRef = useRef(activeSessionId);

  // ── Fetch from server ──────────────────────────────────────────
  const fetchCache = useCallback(async (sid) => {
    const s = sid ?? sessionRef.current;
    if (!s) return;
    try {
      const res = await fetch(`${baseUrl}/api/agents/conversations/${s}/cache/`, {
        credentials: 'include',
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.active) {
        localStorage.removeItem(`${STORAGE_PREFIX}${s}_released`);
        setCacheState(data);
        setRemainingSeconds(data.remaining_seconds);
        saveToStorage(s, data);
      } else if (data.has_snapshot) {
        // Clear stale _released flag — server is the source of truth.
        // Snapshots are auto-rebuilt after release, so the flag must be
        // reset whenever the server confirms a snapshot exists.
        localStorage.removeItem(`${STORAGE_PREFIX}${s}_released`);
        setCacheState({ active: false, has_snapshot: true, platform: data.platform, snapshot_cache_end_idx: data.snapshot_cache_end_idx });
        setRemainingSeconds(0);
        saveToStorage(s, data);
      } else {
        setCacheState({ active: false, has_snapshot: false });
        setRemainingSeconds(0);
        clearStorage(s);
      }
    } catch { /* keep local countdown on network error */ }
  }, []);

  // Expose refresh to parent (called after SSE stream completes)
  useImperativeHandle(ref, () => ({ refresh: () => fetchCache() }), [fetchCache]);

  // ── Session switch ─────────────────────────────────────────────
  useEffect(() => {
    sessionRef.current = activeSessionId;

    // Clear previous session's timers
    if (tickRef.current) clearInterval(tickRef.current);
    if (pollRef.current) clearInterval(pollRef.current);

    if (!activeSessionId) {
      setCacheState(null);
      setRemainingSeconds(0);
      return;
    }

    // Try localStorage first for instant restore
    const stored = loadFromStorage(activeSessionId);
    if (stored && stored.active && stored.remaining_seconds > 0) {
      setCacheState({ active: true, expires_at: stored.expiresAt, renewals: stored.renewals });
      setRemainingSeconds(stored.remaining_seconds);
      fetchCache(activeSessionId);
    } else if (stored && stored.hasSnapshot) {
      setCacheState({ active: false, has_snapshot: true, platform: stored.platform, snapshot_cache_end_idx: stored.snapshotCacheEndIdx });
      setRemainingSeconds(0);
      fetchCache(activeSessionId);
    } else {
      setCacheState(null);
      setRemainingSeconds(0);
      fetchCache(activeSessionId);
    }
  }, [activeSessionId, fetchCache]);

  // ── Countdown tick ─────────────────────────────────────────────
  useEffect(() => {
    if (remainingSeconds <= 0 || !cacheState?.active) return;

    tickRef.current = setInterval(() => {
      setRemainingSeconds(prev => {
        const next = prev - 1;
        if (next <= 0) {
          setCacheState(prev => ({ active: false, has_snapshot: prev?.has_snapshot ?? false, platform: prev?.platform, snapshot_cache_end_idx: prev?.snapshot_cache_end_idx }));
          clearStorage(sessionRef.current);
          return 0;
        }
        // Persist updated remaining to localStorage every 30 ticks
        if (next % 30 === 0 && cacheState?.expires_at) {
          saveToStorage(sessionRef.current, { expires_at: cacheState.expires_at, renewals: cacheState.renewals });
        }
        return next;
      });
    }, TICK_INTERVAL);

    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [remainingSeconds > 0 && cacheState?.active]);

  // ── Periodic server polling ────────────────────────────────────
  useEffect(() => {
    if (!cacheState?.active || !activeSessionId) return;

    pollRef.current = setInterval(() => fetchCache(activeSessionId), POLL_INTERVAL);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [cacheState?.active, activeSessionId, fetchCache]);

  // ── Final cleanup ──────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // ── Actions ────────────────────────────────────────────────────
  const handleRenew = async () => {
    if (!activeSessionId || !cacheState?.active || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`${baseUrl}/api/agents/conversations/${activeSessionId}/cache/renew/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
        credentials: 'include',
      });
      if (res.ok) await fetchCache(activeSessionId);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const handleRelease = async () => {
    if (!activeSessionId || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`${baseUrl}/api/agents/conversations/${activeSessionId}/cache/`, {
        method: 'DELETE',
        headers: { 'X-CSRFToken': getCsrfToken() },
        credentials: 'include',
      });
      if (!res.ok && res.status !== 404) return;
    } catch { /* ignore */ }
    finally {
      setCacheState({ active: false, has_snapshot: false });
      setRemainingSeconds(0);
      clearStorage(activeSessionId);
      localStorage.setItem(`${STORAGE_PREFIX}${activeSessionId}_released`, String(Date.now()));
      setLoading(false);
    }
  };

  const handleMouseEnter = useCallback(() => {
    setHovered(true);
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const gap = 6;
      const estHeight = 28;
      const above = rect.top >= estHeight + gap;
      setTooltipPos({
        left: rect.left + rect.width / 2,
        anchorTop: rect.top,
        anchorBottom: rect.bottom,
        above,
      });
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHovered(false);
    setTooltipPos(null);
  }, []);

  const isActive = cacheState?.active && remainingSeconds > 0;
  const hasSnapshot = !cacheState?.active && cacheState?.has_snapshot;
  const fillPercent = isActive ? Math.min(100, (remainingSeconds / CACHE_TTL) * 100) : hasSnapshot ? 100 : 0;
  const remainingMinutes = Math.ceil(remainingSeconds / 60);
  const isInert = !isActive && !hasSnapshot;

  const tooltipText = cacheState === null
    ? '暂无缓存信息'
    : isActive
      ? `剩余 ${remainingMinutes} 分钟${cacheState?.renewals > 0 ? ` · 已续期 ${cacheState.renewals} 次` : ''}`
      : hasSnapshot
        ? '本地快照'
        : '无缓存或快照';

  const tooltipEl = hovered && tooltipPos
    ? createPortal(
        <div
          className="fixed px-3 py-1.5 bg-exo-panel border border-exo-border rounded-[3px] text-[10px] font-mono text-white whitespace-nowrap shadow-xl pointer-events-none"
          style={{
            left: tooltipPos.left,
            top: tooltipPos.above ? tooltipPos.anchorTop - 6 : tooltipPos.anchorBottom + 6,
            transform: tooltipPos.above ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
            zIndex: 99999,
          }}
        >
          {tooltipText}
        </div>,
        document.body
      )
    : null;

  return (
    <div
      ref={triggerRef}
      className="relative flex items-center"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className={`
        flex items-center h-7 rounded-full border overflow-hidden transition-all select-none
        ${isInert
          ? 'border-exo-mist-10 opacity-30'
          : hasSnapshot
            ? 'border-exo-mist-15 bg-exo-bg hover:border-exo-mist-25'
            : 'border-exo-mist-20 bg-exo-bg hover:border-exo-mist-30'}
      `}>
        {/* Release button */}
        <button
          onClick={handleRelease}
          disabled={isInert || loading}
          className={`h-full aspect-square flex items-center justify-center transition-colors rounded-full
            ${isInert
              ? 'text-exo-muted/30 cursor-not-allowed'
              : 'text-exo-muted/50 hover:text-red-400 hover:bg-red-400/10 active:scale-90'}`}
          title={isInert ? '' : isActive && hasSnapshot ? '释放缓存与快照' : hasSnapshot ? '释放快照' : '释放缓存'}
        >
          <span className="text-[11px] font-bold leading-none font-mono">−</span>
        </button>

        {/* Body: progress bar (active or snapshot) or empty (inert) */}
        {isInert ? (
          <div className="h-full w-14 mx-0.5" />
        ) : (
          <div className="relative h-full w-14 mx-0.5 flex items-center justify-center">
            <div className="absolute inset-y-1.5 left-0 right-0 rounded-full bg-exo-mist-10" />
            <div
              className="absolute inset-y-1.5 left-0 rounded-full transition-all duration-1000 ease-linear"
              style={{
                width: `${fillPercent}%`,
                minWidth: fillPercent > 1 ? '3px' : '0',
                background: 'rgba(200, 205, 215, 0.45)',
              }}
            />
            {isActive && (
              <span className="relative z-10 text-[9px] font-mono text-exo-text/80 leading-none select-none">
                {remainingMinutes}m
              </span>
            )}
          </div>
        )}

        {/* Renew button — only for active cache (Gemini) */}
        <button
          onClick={handleRenew}
          disabled={!isActive || loading}
          className={`h-full aspect-square flex items-center justify-center transition-colors rounded-full
            ${!isActive
              ? 'text-exo-muted/30 cursor-not-allowed'
              : 'text-exo-muted/50 hover:text-exo-accent hover:bg-exo-accent/10 active:scale-90'}`}
          title="续期 30 分钟"
        >
          <span className="text-[11px] font-bold leading-none font-mono">+</span>
        </button>
      </div>

      {tooltipEl}
    </div>
  );
});

export default ContextCacheIndicator;
