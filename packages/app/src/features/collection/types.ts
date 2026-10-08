/**
 * V4 Collection domain types (B1 / Issue #32 Step 1B).
 */

export type CollectOutcome = 'created' | 'already_collected';

export interface CollectMessageSource {
  type: 'message';
  message_id: number;
  text: string;
}

export interface CollectMessagePayload {
  source: CollectMessageSource;
  collection_context?: string;
}

export interface CollectMessageInput {
  messageId: number;
  /**
   * CANONICAL MessageView.content verbatim.
   * MUST NEVER be trimmed or rewritten (backend uses exact equality to determine full message scope).
   */
  content: string;
  context?: string;
}

export interface CollectMessageResult {
  id: string;
  collectOutcome: CollectOutcome;
}
