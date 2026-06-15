import React from 'react';
import BackToUpper from '../components/layout/BackButton';

/* ── Geometric SVG icon ── */
const IconDatabase = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.5">
    <ellipse cx="12" cy="5" rx="8" ry="2.5" />
    <path d="M4 5v7c0 1.5 3.6 2.5 8 2.5s8-1 8-2.5V5" />
    <path d="M4 12v7c0 1.5 3.6 2.5 8 2.5s8-1 8-2.5v-7" />
  </svg>
);

export default function AgentMemory({ appState, setView, goBack, viewParams }) {
  const { presets } = appState;
  const preset = presets.find(p => p.id === viewParams.agentId);
  const backLabel = viewParams.agentName || preset?.name || 'Agent Hub';

  return (
    <div className="flex-1 h-full flex flex-col overflow-hidden" style={{ background: 'var(--cinder-base)' }}>

      {/* Header */}
      <div
        className="flex-shrink-0 flex items-center gap-4 px-4 md:px-12 py-4"
        style={{ borderBottom: '1px solid var(--cinder-line)' }}
      >
        <BackToUpper label={backLabel} onClick={() => goBack()} className="hidden md:inline-flex" />
        <div>
          <p className="font-light" style={{ fontSize: '14px', color: 'var(--cinder-text)' }}>
            {backLabel}
          </p>
          <p
            className="font-light"
            style={{ fontSize: '10px', letterSpacing: '0.15em', color: 'var(--cinder-text-dim)' }}
          >
            Memory Management
          </p>
        </div>
      </div>

      {/* Placeholder — awaiting new implementation */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md px-6">
          <div
            className="inline-block"
            style={{
              padding: '16px',
              borderRadius: '50%',
              background: 'rgba(255,74,8,0.06)',
            }}
          >
            <span style={{ color: 'var(--cinder-flame)', opacity: 0.5 }}>
              <IconDatabase size={32} />
            </span>
          </div>
          <h2 className="font-light" style={{ fontSize: '20px', color: 'var(--cinder-text)' }}>
            Agent Memory
          </h2>
          <p className="font-light" style={{ fontSize: '13px', color: 'var(--cinder-text-dim)', lineHeight: 1.6 }}>
            Per-agent memory portraits and knowledge fragments will be available here.
          </p>
          <p
            className="font-light"
            style={{
              fontSize: '10px',
              letterSpacing: '0.15em',
              color: 'var(--cinder-text-faint)',
              opacity: 0.4,
            }}
          >
            Coming Soon
          </p>
        </div>
      </div>

    </div>
  );
}
