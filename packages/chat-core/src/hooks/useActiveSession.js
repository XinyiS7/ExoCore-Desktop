import { useState, useEffect } from 'react';

export function useActiveSession() {
  const [activeSessionId, setActiveSessionId] = useState(() => {
    const saved = localStorage.getItem('chat_active_session');
    return saved ? Number(saved) : null;
  });

  useEffect(() => {
    if (activeSessionId) localStorage.setItem('chat_active_session', String(activeSessionId));
    else localStorage.removeItem('chat_active_session');
  }, [activeSessionId]);

  return { activeSessionId, setActiveSessionId };
}
