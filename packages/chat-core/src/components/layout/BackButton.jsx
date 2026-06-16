import React from 'react';

/**
 * BackToUpper — unified back navigation button.
 *
 * Every page uses this to go back to its parent level.
 * Style: ‹ + label, Cinder palette, no background/border.
 *
 * Props:
 * - label: where it goes BACK TO (e.g. "Home", "Project Hall", project name)
 * - onClick: navigation handler
 * - className: optional additional classes
 */
export default function BackToUpper({ label, onClick, className = '' }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 font-[inherit] font-light cursor-pointer transition-colors duration-200 whitespace-nowrap ${className}`}
      style={{
        fontSize: '12px',
        letterSpacing: '0.08em',
        color: 'var(--cinder-text-faint)',
        background: 'none',
        border: 'none',
        padding: '6px 12px 6px 0',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.color = 'var(--cinder-flame)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.color = 'var(--cinder-text-faint)';
      }}
    >
      <span style={{ fontSize: '14px', transition: 'transform 0.3s' }}>‹</span>
      <span>{label}</span>
    </button>
  );
}