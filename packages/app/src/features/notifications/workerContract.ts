/**
 * Worker-safe and window-safe contract for Web Push VAPID, arrival parsing, and SW messaging.
 *
 * Owned by ExoCore V4 app. Zero window or DOM dependencies.
 */

export interface AssistantMessageArrivedV1 {
  kind: 'assistant-message-arrived';
  version: 1;
  event_id: number;
  dedupe_key: string;
  conversation_id: number;
  message_id: number;
  agent: {
    id: number;
    name: string;
  };
  preview: {
    policy: 'bounded_text';
    text: string;
    truncated: boolean;
  };
  target: {
    kind: 'conversation_message';
    conversation_id: number;
    message_id: number;
  };
  register_ack: {
    register_id: number;
    preset_id: number;
  } | null;
  title_hint: string | null;
  committed_at: string;
}

export interface AckOutcome {
  status: 'sent' | 'failed_terminal' | 'failed_retryable';
  statusCode?: number;
  error?: string;
}

export type SwToClientMessage =
  | {
      type: 'SW_UPDATED';
    }
  | {
      type: 'ASSISTANT_ARRIVAL_HANDOFF';
      version: 1;
      event: AssistantMessageArrivedV1;
    }
  | {
      type: 'NOTIFICATION_NAVIGATE';
      version: 1;
      target: {
        kind: 'conversation_message';
        conversation_id: number;
        message_id: number;
      };
      register_ack: {
        register_id: number;
        preset_id: number;
      } | null;
      ack_outcome: AckOutcome | null;
    }
  | {
      type: 'SW_ACK_RESULT';
      version: 1;
      register_ack: {
        register_id: number;
        preset_id: number;
      };
      action: 'navigate' | 'dismiss';
      outcome: AckOutcome;
    }
  | {
      type: 'SUBSCRIPTION_REPAIR_NEEDED';
      version: 1;
    };

export type ClientToSwMessage = {
  type: 'SKIP_WAITING';
};

export const VAPID_PUBLIC_KEY =
  'BKlG4M9uEo7TIOTlDZMN_3ncx8oOM2g7hfy-5M5-xQWOfbporu58kUGrQtLxX99-VShp56Z1ysbcKJ9ySUFtqO8';

/**
 * Convert base64url-encoded VAPID key to Uint8Array for PushManager subscription.
 * Safe for both window and Worker contexts (atob is globally available in both).
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const PREVIEW_CODE_POINTS_MAX = 160;
const TITLE_HINT_CODE_POINTS_MAX = 200;
const AGENT_NAME_CODE_POINTS_MAX = 100;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

export function isValidRegisterAck(
  value: unknown,
): value is { register_id: number; preset_id: number } {
  return (
    isRecord(value) &&
    isPositiveInteger(value.register_id) &&
    isPositiveInteger(value.preset_id)
  );
}

export function isValidAckOutcome(value: unknown): value is AckOutcome {
  if (!isRecord(value)) return false;
  if (value.status !== 'sent' && value.status !== 'failed_terminal' && value.status !== 'failed_retryable') {
    return false;
  }
  if ('statusCode' in value && value.statusCode !== undefined) {
    if (typeof value.statusCode !== 'number' || !Number.isInteger(value.statusCode) || !Number.isFinite(value.statusCode)) {
      return false;
    }
  }
  if ('error' in value && value.error !== undefined) {
    if (typeof value.error !== 'string') {
      return false;
    }
  }
  return true;
}

export type ParseArrivalResult =
  | { ok: true; value: AssistantMessageArrivedV1 }
  | { ok: false; error: string };

/**
 * Pure, zero-side-effect, worker/window-safe parser for AssistantMessageArrivedV1.
 * Returns explicit success or failure result object without throwing exceptions.
 */
export function parseArrivalEvent(raw: unknown): ParseArrivalResult {
  if (!isRecord(raw)) {
    return { ok: false, error: '到达事件不是有效对象' };
  }

  if (raw.kind !== 'assistant-message-arrived' || raw.version !== 1) {
    return { ok: false, error: '到达事件 kind 或 version 不匹配' };
  }

  const { event_id, conversation_id, message_id, dedupe_key, target, preview, agent } = raw;

  if (!isPositiveInteger(event_id)) {
    return { ok: false, error: '到达事件 event_id 必须为正整数' };
  }
  if (!isPositiveInteger(conversation_id)) {
    return { ok: false, error: '到达事件 conversation_id 必须为正整数' };
  }
  if (!isPositiveInteger(message_id)) {
    return { ok: false, error: '到达事件 message_id 必须为正整数' };
  }

  const expectedDedupeKey = `assistant-message:${message_id}`;
  if (typeof dedupe_key !== 'string' || dedupe_key !== expectedDedupeKey) {
    return { ok: false, error: `到达事件 dedupe_key 必须严格为 ${expectedDedupeKey}` };
  }

  if (!isRecord(target) || target.kind !== 'conversation_message') {
    return { ok: false, error: '到达事件 target 必须为 conversation_message 结构' };
  }
  if (target.conversation_id !== conversation_id || target.message_id !== message_id) {
    return { ok: false, error: '到达事件 target ID 与顶层 ID 不一致' };
  }

  // Preview privacy & bounds validation (Fail closed)
  if (!isRecord(preview) || preview.policy !== 'bounded_text') {
    return { ok: false, error: '到达事件 preview policy 必须为 bounded_text' };
  }
  if (typeof preview.text !== 'string' || typeof preview.truncated !== 'boolean') {
    return { ok: false, error: '到达事件 preview 结构不合法' };
  }
  if (Array.from(preview.text).length > PREVIEW_CODE_POINTS_MAX) {
    return { ok: false, error: `到达事件 preview 文本超出 ${PREVIEW_CODE_POINTS_MAX} 字符上限` };
  }

  // Agent identity validation (Fail closed on ID)
  if (!isRecord(agent) || !isPositiveInteger(agent.id)) {
    return { ok: false, error: '到达事件 agent.id 必须为正整数' };
  }

  // Register ACK structure validation (Required nullable property, D2-R4-02)
  if (!('register_ack' in raw) || raw.register_ack === undefined) {
    return { ok: false, error: '到达事件缺少必需的 register_ack 字段' };
  }
  let normalizedRegisterAck: AssistantMessageArrivedV1['register_ack'] = null;
  if (raw.register_ack !== null) {
    if (!isRecord(raw.register_ack)) {
      return { ok: false, error: '到达事件 register_ack 格式非法' };
    }
    if (!isPositiveInteger(raw.register_ack.register_id) || !isPositiveInteger(raw.register_ack.preset_id)) {
      return { ok: false, error: '到达事件 register_ack 包含非正整数编号' };
    }
    normalizedRegisterAck = {
      register_id: raw.register_ack.register_id,
      preset_id: raw.register_ack.preset_id,
    };
  }

  // Presentation-only safe degradation
  let normalizedAgentName = 'Agent';
  if (typeof agent.name === 'string') {
    const trimmed = agent.name.trim();
    if (trimmed.length > 0 && Array.from(trimmed).length <= AGENT_NAME_CODE_POINTS_MAX) {
      normalizedAgentName = trimmed;
    }
  }

  let normalizedTitleHint: string | null = null;
  if (typeof raw.title_hint === 'string') {
    const trimmed = raw.title_hint.trim();
    if (trimmed.length > 0 && Array.from(trimmed).length <= TITLE_HINT_CODE_POINTS_MAX) {
      normalizedTitleHint = trimmed;
    }
  }

  let normalizedCommittedAt = '';
  if (typeof raw.committed_at === 'string' && !Number.isNaN(Date.parse(raw.committed_at))) {
    normalizedCommittedAt = raw.committed_at;
  }

  return {
    ok: true,
    value: {
      kind: 'assistant-message-arrived',
      version: 1,
      event_id,
      dedupe_key,
      conversation_id,
      message_id,
      agent: {
        id: agent.id,
        name: normalizedAgentName,
      },
      preview: {
        policy: 'bounded_text',
        text: preview.text,
        truncated: preview.truncated,
      },
      target: {
        kind: 'conversation_message',
        conversation_id,
        message_id,
      },
      register_ack: normalizedRegisterAck,
      title_hint: normalizedTitleHint,
      committed_at: normalizedCommittedAt,
    },
  };
}
