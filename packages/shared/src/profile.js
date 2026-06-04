// ── User avatar ─────────────────────────────────────────────────────────
const USER_AVATAR_KEY = 'exo_user_avatar';
const USER_AVATAR_SEED_KEY = 'exo_user_avatar_seed';
const DEFAULT_SEED = 'Elysia';

export function getUserAvatar() {
  return (
    localStorage.getItem(USER_AVATAR_KEY) ||
    `https://api.dicebear.com/7.x/notionists/svg?seed=${getAvatarSeed()}`
  );
}

export function setUserAvatar(dataUrl) {
  localStorage.setItem(USER_AVATAR_KEY, dataUrl);
  window.dispatchEvent(new StorageEvent('storage', {
    key: USER_AVATAR_KEY, newValue: dataUrl,
  }));
}

export function getAvatarSeed() {
  return localStorage.getItem(USER_AVATAR_SEED_KEY) || DEFAULT_SEED;
}

export function setAvatarSeed(seed) {
  localStorage.setItem(USER_AVATAR_SEED_KEY, seed);
}

// ── User nickname ───────────────────────────────────────────────────────
const USER_NICK_KEY = 'exo_user_nick';
const DEFAULT_NICK = 'Elysia';

export function getUserNick() {
  return localStorage.getItem(USER_NICK_KEY) || DEFAULT_NICK;
}

export function setUserNick(nick) {
  localStorage.setItem(USER_NICK_KEY, nick);
  window.dispatchEvent(new StorageEvent('storage', {
    key: USER_NICK_KEY, newValue: nick,
  }));
}

// ── Agent avatar ────────────────────────────────────────────────────────
const AGENT_AVATAR_PREFIX = 'exo_agent_avatar_';

export function getAgentAvatar(presetId, agentName) {
  const key = `${AGENT_AVATAR_PREFIX}${presetId}`;
  return (
    localStorage.getItem(key) ||
    `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(agentName || presetId)}`
  );
}

export function setAgentAvatar(presetId, dataUrl) {
  const key = `${AGENT_AVATAR_PREFIX}${presetId}`;
  localStorage.setItem(key, dataUrl);
  window.dispatchEvent(new StorageEvent('storage', {
    key, newValue: dataUrl,
  }));
}

// ── Bulk read — for initializing useProfile hook ────────────────────────
export function getAllAgentAvatars() {
  const avatars = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(AGENT_AVATAR_PREFIX)) {
      const presetId = key.slice(AGENT_AVATAR_PREFIX.length);
      avatars[presetId] = localStorage.getItem(key);
    }
  }
  return avatars;
}
