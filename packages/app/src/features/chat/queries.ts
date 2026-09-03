/**
 * Stable query-key families and server-state orchestration (Plan §5.2).
 * No runtime lifecycle lives here — that is P1B territory.
 */
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  AppApiError,
  createConversation,
  fetchMessagePage,
  getConversation,
  listConversations,
  listProjects,
  listVisiblePresets,
} from './api';
import type { CreateConversationResult, MessagePage, MessageView } from './types';

export const queryKeys = {
  conversations: ['conversations'] as const,
  conversation: (id: number) => ['conversation', id] as const,
  messages: (conversationId: number) => ['messages', conversationId] as const,
  presets: ['presets'] as const,
  projects: ['projects'] as const,
};

export const isG045AgentType = (agentType: string | null | undefined) => agentType === 'g045';

export const isValidConversationId = (value: string | undefined): value is string =>
  value !== undefined && /^[1-9]\d*$/.test(value);

// ── Pure message-page merge (offset invariant, Plan §5.3) ─────────────────

export interface MergedMessages {
  /** Oldest → newest, deduplicated by message id. */
  rows: MessageView[];
  /** Older pages still exist beyond the newest window. */
  hasOlder: boolean;
  totalCount: number;
  pageCount: number;
}

export function mergeMessagePages(pages: MessagePage[]): MergedMessages {
  const rows: MessageView[] = [];
  const seen = new Set<number>();
  // Pages arrive newest-window-first; each page is ascending. Reverse to
  // concatenate oldest → newest, deduplicating overlapping/refetched rows.
  for (let i = pages.length - 1; i >= 0; i -= 1) {
    for (const message of pages[i].messages) {
      if (seen.has(message.id)) continue;
      seen.add(message.id);
      rows.push(message);
    }
  }
  const tail = pages[pages.length - 1];
  return {
    rows,
    hasOlder: tail?.hasMore ?? false,
    totalCount: tail?.totalCount ?? 0,
    pageCount: pages.length,
  };
}

// ── Hooks ─────────────────────────────────────────────────────────────────

export function useConversationsQuery() {
  return useQuery({
    queryKey: queryKeys.conversations,
    queryFn: listConversations,
  });
}

export function useConversationQuery(id: number) {
  return useQuery({
    queryKey: queryKeys.conversation(id),
    queryFn: () => getConversation(id),
    enabled: isValidConversationId(String(id)),
    retry: false,
  });
}

export function useVisiblePresetsQuery() {
  return useQuery({
    queryKey: queryKeys.presets,
    queryFn: listVisiblePresets,
  });
}

export function useProjectsQuery() {
  return useQuery({
    queryKey: queryKeys.projects,
    queryFn: listProjects,
  });
}

export function useMessagePagesQuery(conversationId: number) {
  return useInfiniteQuery({
    queryKey: queryKeys.messages(conversationId),
    queryFn: ({ pageParam }) => fetchMessagePage(conversationId, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.offset + lastPage.messages.length : undefined,
    select: (data) => mergeMessagePages(data.pages),
    enabled: isValidConversationId(String(conversationId)),
    retry: false,
  });
}

export function useCreateConversationMutation(
  onCreated: (result: CreateConversationResult) => void,
  onAmbiguousWrite?: () => void,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createConversation,
    onSuccess: async (result) => {
      // Recent must reflect the new conversation before navigating.
      await queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
      onCreated(result);
    },
    onError: async (cause) => {
      // Terminal ambiguous write: the POST was accepted (2xx) but the envelope
      // was malformed. Refresh Recent so the user can open the row manually;
      // the callback owner locks resubmission for this dialog instance.
      if (cause instanceof AppApiError && cause.ambiguousWrite) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
        onAmbiguousWrite?.();
      }
    },
  });
}
