import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { controlQueryKeys } from '../chat/control/queries';
import { queryKeys } from '../chat/queries';
import { AppApiError } from '../chat/api';
import {
  createProject,
  deleteProject,
  deleteProjectFile,
  fetchProjectDeletePreview,
  fetchProjectKnowledge,
  updateProject,
  updateProjectKnowledge,
  uploadProjectFile,
  type ProjectSubmitVariables,
  type ProjectWriteValues,
} from './api';
import type { ConversationSummary } from '../chat/types';
import type { KnowledgePatchValues } from './types';

/**
 * P2B Project mutation hooks (Plan §5.2). Shared invalidation lives here so a
 * confirmed write still refreshes canonical Project facts even after the
 * originating dialog closed or the route switched; dialog-local completion is
 * guarded separately by the dialog's submit-origin token.
 *
 * Query keys are the EXISTING canonical families (`queryKeys.projects`,
 * `controlQueryKeys.projectDetail`) — no duplicate Project mutation owner is
 * introduced (Ablation §3 / §8.1).
 */

/** Mirrors the accepted V4 route-param pattern (`isValidPresetId`). */
export const isValidProjectId = (value: string | undefined): value is string =>
  value !== undefined && /^[1-9]\d*$/.test(value);

export function useCreateProjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createProject,
    onSuccess: async () => {
      // Confirmed write: the canonical Projects list must reflect the new row
      // even if the dialog closed before completion (Plan §5.2).
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
    onError: async (cause) => {
      // 2xx malformed create envelope: the write may have landed but the
      // returned id is unknown — refresh the list, never fabricate an id or
      // navigate (Plan §8.3 ambiguous write).
      if (cause instanceof AppApiError && cause.ambiguousWrite) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      }
    },
  });
}

/**
 * Project Knowledge query family (Plan §5.2). The FILES family stays the
 * canonical P1D owner `controlQueryKeys.projectFiles` — the workspace Files
 * section consumes the SAME key as the chat-local drawer, so invalidation
 * refreshes both mounted consumers from one cache (CP2 visibility rule).
 */
export const projectKnowledgeQueryKeys = {
  projectKnowledge: (projectId: number) => ['project-knowledge', projectId] as const,
};

/** A delete preview belongs to one dialog session, never to canonical Project state. */
export const projectDeletePreviewQueryKey = (projectId: number, sessionId: number) =>
  ['project-delete-preview', projectId, sessionId] as const;

/** Project Knowledge list (bare array; §6.4). Enabled-gated by positive id. */
export function useProjectKnowledgeQuery(projectId: number | null) {
  return useQuery({
    queryKey: projectKnowledgeQueryKeys.projectKnowledge(projectId ?? 0),
    queryFn: () => fetchProjectKnowledge(projectId as number),
    enabled: projectId !== null && projectId > 0,
  });
}

/** Fresh preview per confirmation session; reopening cannot reuse an older preview. */
export function useProjectDeletePreviewQuery(projectId: number, sessionId: number) {
  return useQuery({
    queryKey: projectDeletePreviewQueryKey(projectId, sessionId),
    queryFn: () => fetchProjectDeletePreview(projectId),
    retry: false,
  });
}

/**
 * P2B Stage B mutation hooks (Plan §5.2/§5.4, F01 rule extended): every write
 * carries its SUBMITTED Project identity inside the mutation variables, so
 * completion invalidation always targets the origin Project — even when a
 * route switch replaced the observer's handlers (TanStack v5 passes the
 * ORIGINAL variables to updated handlers, CP1 R2 G13). Upload/delete refresh
 * BOTH the files and knowledge families (CP2 visibility rule); knowledge
 * edits refresh knowledge only.
 */
interface ProjectBoundVariables {
  projectId: number;
}

/** The two resource views must never contradict each other (CP2): a file
 * upload ingestion or either deletion path (numeric / `kf_`) can create or
 * remove KnowledgeFragment rows, so BOTH families are invalidated together. */
function invalidateFileAndKnowledge(queryClient: ReturnType<typeof useQueryClient>, projectId: number) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: controlQueryKeys.projectFiles(projectId) }),
    queryClient.invalidateQueries({ queryKey: projectKnowledgeQueryKeys.projectKnowledge(projectId) }),
  ]);
}

/** POST multipart upload — success (or ambiguous 2xx) refreshes Files + Knowledge. */
export function useUploadProjectFileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: ProjectBoundVariables & { file: File }) =>
      uploadProjectFile(variables.projectId, variables.file),
    onSuccess: (_data, variables) => invalidateFileAndKnowledge(queryClient, variables.projectId),
    onError: (cause, variables) => {
      if (cause instanceof AppApiError && cause.ambiguousWrite) {
        return invalidateFileAndKnowledge(queryClient, variables.projectId);
      }
    },
  });
}

/** DELETE numeric or `kf_` file id — same dual invalidation (Plan §5.2, §6.3). */
export function useDeleteProjectFileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: ProjectBoundVariables & { fileId: number | string }) =>
      deleteProjectFile(variables.projectId, variables.fileId),
    onSuccess: (_data, variables) => invalidateFileAndKnowledge(queryClient, variables.projectId),
    onError: (cause, variables) => {
      if (cause instanceof AppApiError && cause.ambiguousWrite) {
        return invalidateFileAndKnowledge(queryClient, variables.projectId);
      }
    },
  });
}

/** abstract/keywords edit — only the Knowledge family is affected (D2). */
export function useUpdateProjectKnowledgeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: ProjectBoundVariables & { kfId: number; patch: KnowledgePatchValues }) =>
      updateProjectKnowledge(variables.kfId, variables.patch),
    onSuccess: (_data, variables) =>
      queryClient.invalidateQueries({
        queryKey: projectKnowledgeQueryKeys.projectKnowledge(variables.projectId),
      }),
    onError: (cause, variables) => {
      if (cause instanceof AppApiError && cause.ambiguousWrite) {
        return queryClient.invalidateQueries({
          queryKey: projectKnowledgeQueryKeys.projectKnowledge(variables.projectId),
        });
      }
    },
  });
}

/**
 * Project archival deletion. The backend 204 is the durable success boundary.
 * Every already-existing cache that represents the deleted Project or a direct
 * Conversation's changed ownership is marked stale without fetching hidden
 * archive targets. Navigation remains the caller's guarded local effect.
 */
export function useDeleteProjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { projectId: number; keepFileIds: number[] }) =>
      deleteProject(variables.projectId, variables.keepFileIds),
    onSuccess: async (_data, variables) => {
      const affectedConversationIds = new Set<number>();
      const list = queryClient.getQueryData<ConversationSummary[]>(queryKeys.conversations) ?? [];
      for (const conversation of list) {
        if (conversation.projectId === variables.projectId) affectedConversationIds.add(conversation.id);
      }
      for (const [, conversation] of queryClient.getQueriesData<ConversationSummary>({
        queryKey: ['conversation'],
      })) {
        if (conversation?.projectId === variables.projectId) affectedConversationIds.add(conversation.id);
      }

      const noRefetch = { refetchType: 'none' as const };
      const invalidations: Promise<void>[] = [
        queryClient.invalidateQueries({ queryKey: queryKeys.projects, exact: true, ...noRefetch }),
        queryClient.invalidateQueries({ queryKey: queryKeys.conversations, exact: true, ...noRefetch }),
        queryClient.invalidateQueries({
          queryKey: controlQueryKeys.projectDetail(variables.projectId),
          exact: true,
          ...noRefetch,
        }),
        queryClient.invalidateQueries({
          queryKey: controlQueryKeys.projectFiles(variables.projectId),
          exact: true,
          ...noRefetch,
        }),
        queryClient.invalidateQueries({
          queryKey: projectKnowledgeQueryKeys.projectKnowledge(variables.projectId),
          exact: true,
          ...noRefetch,
        }),
        queryClient.invalidateQueries({
          queryKey: ['control', 'project-tree-root', variables.projectId],
          ...noRefetch,
        }),
        queryClient.invalidateQueries({
          queryKey: ['control', 'project-tree-levels', variables.projectId],
          ...noRefetch,
        }),
        queryClient.invalidateQueries({
          queryKey: ['control', 'project-tree-level', variables.projectId],
          ...noRefetch,
        }),
      ];
      for (const conversationId of affectedConversationIds) {
        invalidations.push(
          queryClient.invalidateQueries({
            queryKey: queryKeys.conversation(conversationId),
            exact: true,
            ...noRefetch,
          }),
          queryClient.invalidateQueries({
            queryKey: controlQueryKeys.cache(conversationId),
            exact: true,
            ...noRefetch,
          }),
        );
      }
      await Promise.all(invalidations);
    },
  });
}

/**
 * Edit/update mutation bound to the SUBMITTED identity (F01): the PATCH target
 * id travels inside the mutation variables, so completion invalidation reads
 * `variables.projectId` — never the current render closure. TanStack v5
 * observer.setOptions updates a pending mutation's handlers, so a route switch
 * A→B while A's PATCH is in flight must still invalidate Project A's list +
 * detail facts (and only those) when the write settles. Create shares the same
 * variables type so both directions feed the same dialog contract.
 */
export function useUpdateProjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: ProjectSubmitVariables) => {
      // Edit call sites always set projectId (captured at dialog open); the
      // cast narrows the shared optional-field type for the URL owner.
      const { projectId, ...values } = variables;
      return updateProject(projectId as number, values as ProjectWriteValues);
    },
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.projects }),
        queryClient.invalidateQueries({
          queryKey: controlQueryKeys.projectDetail(variables.projectId as number),
        }),
      ]);
    },
    onError: async (cause, variables) => {
      // Ambiguous 2xx PATCH: the write may have landed; re-read server truth
      // for the SUBMITTED Project, wherever the route currently is.
      if (cause instanceof AppApiError && cause.ambiguousWrite) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.projects }),
          queryClient.invalidateQueries({
            queryKey: controlQueryKeys.projectDetail(variables.projectId as number),
          }),
        ]);
      }
    },
  });
}