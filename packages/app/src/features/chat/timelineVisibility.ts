import type { MessageRole, MessageView } from './types';
import { isTimerTriggerMessage } from './inlineTags/parse';
import { hasVisibleBody, type InlineTagRole } from './inlineTags/placeholders';

/**
 * Which timeline rows exist (#130 CP1-F04). The timeline and its consumers
 * (minimap) read this one rule, so a hidden row never leaves a jump target
 * behind.
 */

export function inlineTagRole(role: MessageRole): InlineTagRole | undefined {
  return role === 'assistant' ? 'assistant' : role === 'user' ? 'user' : undefined;
}

/** Row payloads that are visible on their own, independent of the body text. */
export function messageArtifacts(message: MessageView) {
  const isAssistant = message.role === 'assistant';
  const isUser = message.role === 'user';
  const attachments = message.attachments;
  const attachmentsMeta = message.attachmentsMeta ?? [];
  const readyAttachments = attachments ? attachments.filter((att) => att.status === 'ready') : [];
  const voiceToolErrors = isAssistant ? message.voiceToolErrors ?? [] : [];
  const presentations = isUser || isAssistant ? message.presentations ?? [] : [];
  const hasAttachments =
    attachments !== undefined ? readyAttachments.length > 0 : attachmentsMeta.length > 0;
  const hasVoiceToolErrors = voiceToolErrors.length > 0;
  const hasPresentations = presentations.length > 0;
  const hasTrace = isAssistant && Boolean(message.assistantRunTrace || message.reasoningContent);
  return {
    attachments,
    attachmentsMeta,
    hasAttachments,
    voiceToolErrors,
    hasVoiceToolErrors,
    presentations,
    hasPresentations,
    hasTrace,
    any: hasAttachments || hasVoiceToolErrors || hasPresentations || hasTrace,
  };
}

/** Body text as the row shows it, after inline-tag projection for the author role. */
export function hasVisibleContent(message: MessageView): boolean {
  return hasVisibleBody(message.content ?? '', inlineTagRole(message.role));
}

/**
 * Hidden rows: a user row that is only a timer trigger (REQ §3.3), and a row
 * whose non-empty body projects to nothing (pure pin/unpin, D-F) with no
 * independent payload. A genuinely empty row is not hidden (it says 空消息).
 */
export function isHiddenTimelineRow(message: MessageView): boolean {
  if (message.role === 'user' && isTimerTriggerMessage(message.content ?? '')) return true;
  if (!message.content?.trim() || hasVisibleContent(message)) return false;
  return !messageArtifacts(message).any;
}
