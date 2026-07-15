import React, { useState, useEffect, useRef } from 'react';

/* ── Geometric SVG icons ── */
const IconPulse = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.7">
    <line x1="4" y1="17" x2="4" y2="12" />
    <line x1="10" y1="17" x2="10" y2="7" />
    <line x1="16" y1="17" x2="16" y2="9" />
    <line x1="20" y1="17" x2="20" y2="14" />
  </svg>
);

const IconPersist = ({ size = 8 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
    <polygon points="12,3 21,8 21,16 12,21 3,16 3,8" strokeLinejoin="round" />
    <circle cx="12" cy="11" r="1.5" />
    <line x1="12" y1="14" x2="12" y2="17" />
  </svg>
);

const MarqueeArea = ({ plasmids = [] }) => {
  const [currentIndex, setCurrentIndex] = useState(() =>
    plasmids.length > 0 ? Math.floor(Math.random() * plasmids.length) : 0,
  );
  const [isFading, setIsFading] = useState(true);
  const prevLength = useRef(plasmids.length);

  useEffect(() => {
    if (plasmids.length <= 1) return;
    if (prevLength.current !== plasmids.length) {
      setCurrentIndex(Math.floor(Math.random() * plasmids.length));
      prevLength.current = plasmids.length;
    }
    const timer = setInterval(() => {
      setIsFading(false);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % plasmids.length);
        setIsFading(true);
      }, 500); // 稍微延长一点淡出时间，让切换更优雅
    }, 8000);
    return () => clearInterval(timer);
  }, [plasmids.length]);

  /* ── Empty state ── */
  if (plasmids.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.4, padding: '8px 4px' }}>
        <span style={{ display: 'flex', alignItems: 'center', animation: 'breathe 2s ease-in-out infinite' }}>
          <IconPulse size={12} />
        </span>
        <span style={{ fontSize: '11px', fontWeight: 300, color: 'var(--tx-neutral-40)', letterSpacing: '0.05em' }}>
          Core Memory Scan: [NULL]
        </span>
      </div>
    );
  }

  const plasmid = plasmids[currentIndex];
  const content = plasmid.content || '';
  const tags = (plasmid.tags || []).slice(0, 3); // 可以多放一个 tag，空间够了
  const weight = plasmid.weight != null ? plasmid.weight : 0;
  const isPersistent = weight >= 0.9;

  // 优化行数估算，中文字符占空间更大
  const estimatedLines = Math.ceil(content.length / 24);
  const needsScroll = estimatedLines > 3;
  // 动态计算滚动速度，保证体验平滑
  const scrollDuration = needsScroll ? Math.max(estimatedLines * 3, 10) : 0;

  return (
    <div
      style={{
        padding: '6px 12px 12px 12px',
        borderRadius: '8px',
        background: 'rgba(120, 120, 120, 0.02)', // 极度微弱的背景色，划分区域
        border: '1px solid transparent',
        borderColor: isPersistent ? 'rgba(255, 100, 50, 0.1)' : 'transparent', // 核心记忆微微发光
        transition: 'all 0.5s ease'
      }}
    >
      <div
        style={{
          opacity: isFading ? 1 : 0,
          transform: isFading ? 'translateY(0)' : 'translateY(6px)',
          transition: 'opacity 0.5s ease, transform 0.5s ease',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}
      >
        {/* ── Top zone: Tags & Weight ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '2px', alignItems: 'center', flexWrap: 'wrap' }}>
            {tags.map((tag, i) => (
              <span
                key={i}
                style={{
                  fontSize: '10px',
                  fontWeight: 400,
                  color: isPersistent ? 'var(--tx-warm-flame)' : 'var(--tx-neutral-30)',
                  background: isPersistent ? 'rgba(255, 100, 50, 0.05)' : 'rgba(150, 150, 150, 0.05)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  letterSpacing: '0.05em',
                  border: `1px solid ${isPersistent ? 'rgba(255, 100, 50, 0.15)' : 'var(--cinder-line, rgba(0,0,0,0.05))'}`
                }}
              >
                #{tag}
              </span>
            ))}
          </div>

          <div
            style={{
              fontSize: '11px',
              fontWeight: 500,
              color: isPersistent ? 'var(--tx-warm-flame)' : 'var(--tx-neutral-40)',
              fontFamily: 'monospace, tabular-nums',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: 'rgba(0,0,0,0.02)',
              padding: '2px 6px',
              borderRadius: '4px'
            }}
          >
            {isPersistent && (
              <span style={{ display: 'flex', alignItems: 'center', animation: 'pulse-glow 2s infinite' }}>
                <IconPersist size={10} />
              </span>
            )}
            {weight.toFixed(2)}
          </div>
        </div>

        {/* ── Content zone (Dynamic Height with Masking) ── */}
        <div
          style={{
            height: needsScroll ? '60px' : 'auto', // 增加高度，给文字呼吸感
            maxHeight: '60px',
            overflow: 'hidden',
            position: 'relative',
            // 关键魔法：上下边缘透明渐变，让滚动不突兀
            WebkitMaskImage: needsScroll ? 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)' : 'none',
            maskImage: needsScroll ? 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)' : 'none',
          }}
        >
          <div
            style={{
              animation: needsScroll ? `plasmid-scroll-up ${scrollDuration}s linear infinite` : 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px' // 给两段滚动文字之间留出间隙
            }}
          >
            <p className="note-content">{content}</p>
            {needsScroll && <p className="note-content" aria-hidden="true">{content}</p>}
          </div>
        </div>
      </div>

      <style>{`
        .note-content {
          margin: 0;
          font-size: 11px;
          font-weight: 300;
          line-height: 1.6;
          color: var(--tx-neutral-30, #666);
          letter-spacing: 0.03em;
          text-align: justify;
        }
        @keyframes plasmid-scroll-up {
          0% { transform: translateY(0); }
          100% { transform: translateY(calc(-50% - 6px)); } /* 6px 补偿 gap 高度 */
        }
        @keyframes pulse-glow {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.95); }
        }
      `}</style>
    </div>
  );
};

export default MarqueeArea;