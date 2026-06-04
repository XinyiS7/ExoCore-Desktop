import { useState, useEffect, useCallback } from 'react';
import {
  getUserAvatar, setUserAvatar,
  getUserNick, setUserNick,
  getAgentAvatar, setAgentAvatar,
  getAllAgentAvatars,
} from '../profile';
import { resizeAndStoreAvatar } from '../utils/avatar';

export function useProfile() {
  const [userAvatar, setUserAvatarState] = useState(getUserAvatar);
  const [userNick, setUserNickState] = useState(getUserNick);
  const [agentAvatars, setAgentAvatars] = useState(getAllAgentAvatars);

  // Listen for cross-tab storage changes
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'exo_user_avatar') {
        setUserAvatarState(getUserAvatar());
      } else if (e.key === 'exo_user_nick') {
        setUserNickState(getUserNick());
      } else if (e.key && e.key.startsWith('exo_agent_avatar_')) {
        setAgentAvatars(getAllAgentAvatars());
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  // Update user avatar from a File object — resize to 200x200, store as dataURL
  const updateAvatar = useCallback((file) => {
    resizeAndStoreAvatar(file, 'exo_user_avatar', (dataUrl) => {
      setUserAvatar(dataUrl);
      setUserAvatarState(dataUrl);
    });
  }, []);

  // Update nickname
  const updateNick = useCallback((nick) => {
    setUserNick(nick);
    setUserNickState(nick);
  }, []);

  // Update agent avatar
  const updateAgentAvatar = useCallback((presetId, file) => {
    const key = `exo_agent_avatar_${presetId}`;
    resizeAndStoreAvatar(file, key, (dataUrl) => {
      setAgentAvatar(presetId, dataUrl);
      setAgentAvatars(prev => ({ ...prev, [presetId]: dataUrl }));
    });
  }, []);

  // Refresh all state from localStorage (for external mutations)
  const refresh = useCallback(() => {
    setUserAvatarState(getUserAvatar());
    setUserNickState(getUserNick());
    setAgentAvatars(getAllAgentAvatars());
  }, []);

  return {
    userAvatar,
    userNick,
    agentAvatars,
    updateAvatar,
    updateNick,
    updateAgentAvatar,
    refresh,
  };
}
