import React, { useState, useEffect } from 'react';
import { Activity, ShieldAlert } from 'lucide-react';

const MemoryAnchorTicker = ({ anchors = [] }) => {
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

  if (anchors.length === 0) {
    return (
      <div className="h-16 flex items-center justify-center border border-dashed border-exo-mist-10 rounded-[2px] bg-black/20 text-[10px] text-exo-muted/40 font-mono uppercase tracking-widest">
        <Activity size={12} className="mr-2 animate-pulse" /> Core Memory Scan: [NULL]
      </div>
    );
  }

  const anchor = anchors[currentIndex];
  const keywords = (anchor.keywords || '').split(',').map(k => k.trim()).filter(Boolean).slice(0, 2);

  const needsScroll = anchor.note && anchor.note.length > 80;

  return (
    <div className="rounded-[2px] bg-black/40 border border-exo-mist-10 p-4 shadow-inner">
      <div className={`transition-all duration-400 ${isFading ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}`}>
        {/* Keywords row with fade-out + weight number */}
        <div className="flex items-center gap-0 mb-3">
          {/* Scrollable keywords area */}
          <div className="flex-1 min-w-0 overflow-hidden relative h-6">
            <div className="flex gap-1.5 overflow-x-auto whitespace-nowrap pr-10 h-full items-center"
              style={{ scrollbarWidth: 'none' }}>
              {keywords.map((kw, i) => (
                <span key={i} className={`text-[9px] px-2 py-0.5 rounded-[2px] font-mono font-bold uppercase tracking-widest whitespace-nowrap flex-shrink-0 ${
                  anchor.is_persistent
                    ? 'bg-exo-accent/15 text-exo-accent border border-exo-accent/30'
                    : 'bg-white/5 text-exo-muted border border-exo-mist-10'
                }`}>
                  {kw}
                </span>
              ))}
            </div>
            {/* Fade gradient — no visible dividing line */}
            <div className="absolute right-0 top-0 bottom-0 w-12 pointer-events-none"
              style={{ background: 'linear-gradient(to right, transparent, rgba(0,0,0,0.4))' }} />
          </div>

          {/* Weight badge — pure number, no "W:" prefix */}
          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
            {anchor.is_persistent && <ShieldAlert size={10} className="text-exo-accent animate-pulse" title="Persistent Weight" />}
            <span className="text-[9px] text-exo-muted font-mono bg-black px-1.5 py-0.5 rounded-[2px] border border-exo-mist-10 font-bold min-w-[34px] text-center">
              {anchor.weight.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Essential note — smooth CSS auto-scroll */}
        <div className="h-10 overflow-hidden">
          <div className="h-full overflow-hidden">
            <p
              key={currentIndex}
              className="text-[11px] text-white/50 leading-relaxed font-mono tracking-tight italic whitespace-pre-wrap"
              style={needsScroll ? {
                animation: 'ticker-scroll 8s linear infinite',
              } : undefined}
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

export default MemoryAnchorTicker;
