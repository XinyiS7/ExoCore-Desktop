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
      className={`flex items-center gap-1.5 cursor-pointer transition-colors duration-200 whitespace-nowrap tx-nav-mute hover:tx-nav-accent ${className}`}
      style={{
        background: 'none',
        border: 'none',
        padding: '6px 12px 6px 0',
      }}
    >
      <span className="text-[1.125rem] transition-transform duration-200">‹</span>
      <span>{label}</span>
    </button>
  );
}