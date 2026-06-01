import { apiFetch } from '../api';

// ── Timeline/Tweets CRUD (§4.1-4.3) ──

/** Paginated tweet list. Pass { before_id } for infinite scroll. */
export function listTweets(params = {}) {
  return apiFetch('/api/core/tweets/', { method: 'GET', params });
}
export function createTweet(data) {
  // { content: "..." }
  return apiFetch('/api/core/tweets/', { method: 'POST', body: data });
}
export function replyToTweet(tweetId, data) {
  // { content: "..." }
  return apiFetch(`/api/core/tweets/${tweetId}/reply/`, { method: 'POST', body: data });
}
export function deleteTweet(tweetId) {
  return apiFetch(`/api/core/tweets/${tweetId}/`, { method: 'DELETE' });
}
