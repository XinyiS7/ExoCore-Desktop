/**
 * Conversation "strict parent" back target (#72 U2).
 *
 * A conversation can be entered from Chat Home, an Agent Profile or a Project
 * Detail page. Each entry passes its own path + label through router state so
 * the conversation's back link returns to that page by name. Router history
 * (`navigate(-1)`) is not used: branches, refreshes and deep links leave a
 * history stack that does not reflect the structural parent.
 */

export interface ConversationBackTarget {
  path: string;
  label: string;
}

export const CHAT_HOME_BACK_TARGET: ConversationBackTarget = { path: '/', label: 'Chat Home' };

/** Router state an entry page attaches when linking into a conversation. */
export function conversationEntryState(path: string, label: string): { backTarget: ConversationBackTarget } {
  return { backTarget: { path, label } };
}

/**
 * Reads the entry's back target. Entries without one (deep link, branch,
 * notification, Library bring-back) fall back to Chat Home.
 */
export function readBackTarget(state: unknown): ConversationBackTarget {
  const target = (state as { backTarget?: ConversationBackTarget } | null)?.backTarget;
  return target ?? CHAT_HOME_BACK_TARGET;
}
