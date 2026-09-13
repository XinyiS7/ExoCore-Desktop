import { useEffect, useState } from 'react';
import { getUserAvatar as sharedGetUserAvatar, setUserAvatar as sharedSetUserAvatar } from 'exo-shared/profile';

export const USER_AVATAR_KEY = 'exo_user_avatar';

/**
 * Returns current avatar string (data URL or fallback DiceBear URL).
 */
export function getUserAvatarUrl(): string {
  try {
    return sharedGetUserAvatar();
  } catch {
    return '';
  }
}

/**
 * Sets avatar data URL in localStorage and dispatches storage event.
 * Surfaces any quota or security exceptions to the caller.
 */
export function saveUserAvatar(dataUrl: string): void {
  sharedSetUserAvatar(dataUrl);
}

/**
 * Hook observing user avatar changes (same tab via StorageEvent dispatch and cross-tab).
 */
export function useUserAvatar(): string {
  const [avatarUrl, setAvatarUrl] = useState<string>(() => getUserAvatarUrl());

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === USER_AVATAR_KEY || !e.key) {
        setAvatarUrl(getUserAvatarUrl());
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  return avatarUrl;
}
