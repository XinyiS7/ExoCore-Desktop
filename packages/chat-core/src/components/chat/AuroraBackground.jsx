import React from 'react';
import './AuroraBackground.css';

/**
 * Full-viewport aurora plasma background.
 * Activates a Burning Sunset ribbon-drift effect when `active` is true
 * (typically when the AI is generating/thinking).
 */
const AuroraBackground = ({ active = false }) => (
  <div className={`aurora-stage${active ? ' aurora-active' : ''}`}>
    <div className="aurora-goo">
      {/* Ribbon curtains — horizontal aurora bands */}
      <div className="aurora-ribbon aurora-r1" />
      <div className="aurora-ribbon aurora-r2" />
      <div className="aurora-ribbon aurora-r3" />
      <div className="aurora-ribbon aurora-r4" />
      <div className="aurora-ribbon aurora-r5" />
      <div className="aurora-ribbon aurora-r6" />

      {/* Depth blobs — ambient warmth */}
      <div className="aurora-ribbon aurora-blob-deep" />
      <div className="aurora-ribbon aurora-blob-warm" />
      <div className="aurora-ribbon aurora-blob-gold" />
    </div>
    <div className="aurora-grain" />
    <div className="aurora-vignette" />
  </div>
);

export default AuroraBackground;
