import { useEffect, useState } from 'react';
import {
  getAgentAvatar as sharedGetAgentAvatar,
  setAgentAvatar as sharedSetAgentAvatar,
} from 'exo-shared/profile';

export const AGENT_AVATAR_PREFIX = 'exo_agent_avatar_';

/**
 * Returns current avatar string for an agent (data URL or fallback DiceBear URL).
 */
export function getAgentAvatarUrl(presetId: number, agentName?: string): string {
  try {
    return sharedGetAgentAvatar(presetId, agentName);
  } catch {
    return `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(agentName || String(presetId))}`;
  }
}

/**
 * Sets agent avatar data URL in localStorage and dispatches storage event.
 */
export function saveAgentAvatar(presetId: number, dataUrl: string): void {
  sharedSetAgentAvatar(presetId, dataUrl);
}

/**
 * Hook observing agent avatar changes (same tab via StorageEvent dispatch and cross-tab).
 */
export function useAgentAvatar(presetId: number, agentName?: string): string {
  const [avatarUrl, setAvatarUrl] = useState<string>(() => getAgentAvatarUrl(presetId, agentName));

  useEffect(() => {
    setAvatarUrl(getAgentAvatarUrl(presetId, agentName));
  }, [presetId, agentName]);

  useEffect(() => {
    const keyToWatch = `${AGENT_AVATAR_PREFIX}${presetId}`;
    const handleStorage = (e: StorageEvent) => {
      if (e.key === keyToWatch || !e.key) {
        setAvatarUrl(getAgentAvatarUrl(presetId, agentName));
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, [presetId, agentName]);

  return avatarUrl;
}
