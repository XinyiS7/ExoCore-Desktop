import { apiFetch } from 'exo-shared/api';

export interface AttachmentTranscriptResponse {
  transcript: string;
}

/**
 * Narrow transcript API helper (CP-E §4 E3):
 * GET /api/agents/conversations/<conversation_id>/message-attachments/<attachment_id>/transcript/
 *
 * Rules:
 * - Scoped strictly to conversation_id and attachment_id;
 * - Abortable via AbortSignal;
 * - On 404, malformed response, abort, or network failure: fail-closed silently (returns null);
 * - Never leaks response body or server error prose.
 */
export async function fetchAttachmentTranscript(
  conversationId: number,
  attachmentId: number,
  signal?: AbortSignal,
): Promise<string | null> {
  if (
    !Number.isInteger(conversationId) ||
    conversationId <= 0 ||
    !Number.isInteger(attachmentId) ||
    attachmentId <= 0
  ) {
    return null;
  }

  try {
    const raw: unknown = await apiFetch(
      `/api/agents/conversations/${conversationId}/message-attachments/${attachmentId}/transcript/`,
      { signal },
    );

    if (
      typeof raw === 'object' &&
      raw !== null &&
      'transcript' in raw &&
      typeof (raw as { transcript: unknown }).transcript === 'string'
    ) {
      return (raw as { transcript: string }).transcript;
    }
    return null;
  } catch {
    // A scoped 404, malformed response, abort, or network failure never exposes
    // response prose and never breaks audio playback; no transcript is shown.
    return null;
  }
}
