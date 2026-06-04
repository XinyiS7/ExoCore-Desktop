import React from 'react';
import { useProfile, useFont } from 'exo-shared';

export default function App() {
  const { userAvatar, userNick } = useProfile();
  useFont(); // Inject CSS font variables

  return (
    <div className="w-full h-screen bg-cncl-bg text-cncl-text font-sans flex items-center justify-center">
      {/* User identity hint in corner */}
      <div className="fixed top-3 right-4 flex items-center gap-2 opacity-60">
        <span className="text-xs text-cncl-muted">{userNick}</span>
        <img
          src={userAvatar}
          alt={userNick}
          className="w-6 h-6 rounded object-cover border border-cncl-border"
        />
      </div>

      <div className="text-center">
        <h1 className="text-cncl-accent text-2xl mb-4">ExoCore // Council</h1>
        <p className="text-cncl-muted">Multi-Agent Workspace — Coming in V3.1</p>
      </div>
    </div>
  );
}
