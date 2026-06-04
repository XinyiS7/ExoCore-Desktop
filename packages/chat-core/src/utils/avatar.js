// Re-export from shared — legacy import paths keep working
export { resizeAndStoreAvatar } from 'exo-shared/utils/avatar';

// These helpers remain chat-core specific (they consume the shared profile module)
import { getUserAvatar, getAgentAvatar } from 'exo-shared/profile';
export { getUserAvatar, getAgentAvatar };
export const getUserAvatarUrl = getUserAvatar;
export const getAgentAvatarUrl = getAgentAvatar;
