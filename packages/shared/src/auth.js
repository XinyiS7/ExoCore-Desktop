import { apiFetch } from './api';

/** Get current Django user info. Returns null if not authenticated. */
export async function fetchCurrentUser() {
  try {
    return await apiFetch('/api/auth/user/');
  } catch {
    return null;
  }
}

/** Check if the user is authenticated. */
export async function isAuthenticated() {
  const user = await fetchCurrentUser();
  return !!user;
}
