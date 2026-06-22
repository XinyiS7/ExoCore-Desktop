import React, { useState, useEffect } from 'react';

/* ── Geometric SVG icons ── */
const IconPulse = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.7">
    <line x1="4" y1="17" x2="4" y2="12" />
    <line x1="10" y1="17" x2="10" y2="7" />
    <line x1="16" y1="17" x2="16" y2="9" />
    <line x1="20" y1="17" x2="20" y2="14" />
  </svg>
);

const IconPersist = ({ size = 10 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.7">
    <polygon points="12,3 21,8 21,16 12,21 3,16 3,8" strokeLinejoin="round" />
    <circle cx="12" cy="11" r="1.2" />
    <line x1="12" y1="13" x2="12" y2="16" />
  </svg>
);

const TriggeredNote = ({ anchors = [] }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFading, setIsFading] = useState(true);

  useEffect(() => {
    if (anchors.length <= 1) return;
    const timer = setInterval(() => {
      setIsFading(false);
      setTimeout(() => {
        setCurrentIndex(prev => (prev + 1) % anchors.length);
        setIsFading(true);
      }, 400);
    }, 8000);
    return () => clearInterval(timer);
  }, [anchors.length]);

  /* ── Empty state ── */
  if (anchors.length === 0) {
    return (
      <div
        className="h-16 flex items-center justify-center tx-decoration-mute"
        style={{
          background: 'var(--cinder-panel)',
          border: '1px dashed var(--cinder-line)',
          borderRadius: '2px',
          opacity: 0.6,
        }}
      >
        <span style={{ marginRight: '8px', display: 'flex', alignItems: 'center', animation: 'breathe 2s ease-in-out infinite' }}>
          <IconPulse size={12} />
        </span>
        Core Memory Scan: [NULL]
      </div>
    );
  }

  const anchor = anchors[currentIndex];
  const keywords = (anchor.keywords || '').split(',').map(k => k.trim()).filter(Boolean).slice(0, 2);
  const needsScroll = anchor.note && anchor.note.length > 80;

  return (
    <div
      style={{
        background: 'var(--cinder-glass-heavy)',
        border: '1px solid var(--cinder-line)',
        borderRadius: '2px',
        padding: '16px',
      }}
    >
      <div
        className="transition-all duration-400"
        style={{
          opacity: isFading ? 1 : 0,
          transform: isFading ? 'translateY(0)' : 'translateY(4px)',
        }}
      >
        {/* Keywords row with fade gradient */}
        <div className="flex items-center gap-0 mb-3">
          <div className="flex-1 min-w-0 overflow-hidden relative h-6">
            <div
              className="flex gap-1.5 overflow-x-auto whitespace-nowrap h-full items-center"
              style={{ scrollbarWidth: 'none', paddingRight: '40px' }}
            >
              {keywords.map((kw, i) => (
                <span
                  key={i}
                  className="tx-decoration-mute tracking-widest whitespace-nowrap flex-shrink-0"
                  style={{
                    fontSize: '9px',
                    padding: '2px 8px',
                    borderRadius: '2px',
                    ...(anchor.is_persistent
                      ? {
                          background: 'rgba(255,74,8,0.12)',
                          color: 'var(--cinder-flame)',
                          border: '1px solid rgba(255,74,8,0.25)',
                        }
                      : {
                          background: 'rgba(255,255,255,0.05)',
                          color: 'var(--cinder-text-dim)',
                          border: '1px solid rgba(255,255,255,0.04)',
                        }),
                  }}
                >
                  {kw}
                </span>
              ))}
            </div>
            {/* Fade gradient */}
            <div
              className="absolute right-0 top-0 bottom-0 w-12 pointer-events-none"
              style={{
                background: 'linear-gradient(to right, transparent, var(--cinder-glass-heavy))',
              }}
            />
          </div>

          {/* Weight badge */}
          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
            {anchor.is_persistent && (
              <span
                className="animate-pulse"
                style={{ color: 'var(--cinder-flame)', display: 'flex', alignItems: 'center' }}
                title="Persistent Weight"
              >
                <IconPersist size={10} />
              </span>
            )}
            <span
              className="tx-decoration-mute text-center"
              style={{
                fontSize: '9px',
                background: 'var(--cinder-glass-heavy)',
                padding: '2px 6px',
                borderRadius: '2px',
                border: '1px solid var(--cinder-line)',
                minWidth: '34px',
              }}
            >
              {anchor.weight != null ? anchor.weight.toFixed(2) : '0.00'}
            </span>
          </div>
        </div>

        {/* Essential note — tx-system-mute for readability */}
        <div className="h-10 overflow-hidden">
          <div className="h-full overflow-hidden">
            <p
              key={currentIndex}
              className="tracking-tight italic whitespace-pre-wrap tx-system-mute"
              style={{
                ...(needsScroll
                  ? { animation: 'ticker-scroll 8s linear infinite' }
                  : {}),
              }}
            >
              "{anchor.note}"
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes ticker-scroll {
          0% { transform: translateY(0); }
          90%, 100% { transform: translateY(calc(-1 * (100% - 2.5rem))); }
        }
      `}</style>
    </div>
  );
};

export default TriggeredNote;
