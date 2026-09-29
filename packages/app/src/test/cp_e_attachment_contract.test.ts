import { describe, expect, it } from 'vitest';
import { normalizeMessageAttachments } from '../features/chat/attachments/projection';
import { normalizeMessageRow } from '../features/chat/api';
import type { AttachmentMeta, MessageAttachmentRow, MessageRow } from '../features/chat/types';

describe('CP-E E1 — unified attachments contract', () => {
  const canonicalVoiceMsg: MessageAttachmentRow = {
    ref: { type: 'message_attachment', id: 10 },
    kind: 'audio',
    source: 'voice_msg',
    status: 'ready',
    position: 0,
    display_name: 'voice_0.wav',
    mime_type: 'audio/wav',
    file_size: 32000,
    content_url: '/api/agents/conversations/1/message-attachments/10/content/',
    duration_ms: 3200,
    error_code: null,
  };

  const canonicalImage: MessageAttachmentRow = {
    ref: { type: 'session_attachment', id: 20 },
    kind: 'image',
    source: 'user',
    status: 'ready',
    position: 1,
    display_name: 'photo.png',
    mime_type: 'image/png',
    file_size: 104800,
    content_url: null,
    duration_ms: null,
    error_code: null,
  };

  const legacyMetaImage: AttachmentMeta = {
    id: 20,
    display_name: 'photo.png',
    original_filename: 'camera_capture.png',
    mime_type: 'image/png',
    file_size: 104800,
    file_uri: 'https://cdn.example/photo.png',
    content_url: null,
  };

  it('normalizes canonical ready voice_msg audio row with collision-safe key', () => {
    const result = normalizeMessageAttachments([canonicalVoiceMsg], null);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      key: 'message_attachment:10',
      ref: { type: 'message_attachment', id: 10 },
      kind: 'audio',
      source: 'voice_msg',
      status: 'ready',
      position: 0,
      displayName: 'voice_0.wav',
      mimeType: 'audio/wav',
      fileSize: 32000,
      contentUrl: '/api/agents/conversations/1/message-attachments/10/content/',
      durationMs: 3200,
      errorCode: null,
    });
  });

  it('preserves exact server order and never client-sorts by position', () => {
    const itemA = { ...canonicalVoiceMsg, position: 2, display_name: 'third.wav' };
    const itemB = { ...canonicalVoiceMsg, ref: { type: 'message_attachment' as const, id: 11 }, position: 0, display_name: 'first.wav' };
    const itemC = { ...canonicalVoiceMsg, ref: { type: 'message_attachment' as const, id: 12 }, position: 1, display_name: 'second.wav' };

    const result = normalizeMessageAttachments([itemA, itemB, itemC], null);
    expect(result.map((r) => r.displayName)).toEqual(['third.wav', 'first.wav', 'second.wav']);
  });

  it('drops malformed canonical entries fail-closed without dropping valid siblings', () => {
    const malformedEntries = [
      null,
      {},
      { ...canonicalVoiceMsg, ref: { type: 'invalid_type', id: 1 } },
      { ...canonicalVoiceMsg, ref: { type: 'message_attachment', id: -5 } },
      { ...canonicalVoiceMsg, ref: { type: 'message_attachment', id: 1.5 } },
      { ...canonicalVoiceMsg, kind: 'video' },
      { ...canonicalVoiceMsg, status: 'unknown' },
      { ...canonicalVoiceMsg, position: -1 },
      { ...canonicalVoiceMsg, position: 1.2 },
      { ...canonicalVoiceMsg, display_name: '' },
      { ...canonicalVoiceMsg, display_name: '   ' },
      { ...canonicalVoiceMsg, mime_type: 123 },
      { ...canonicalVoiceMsg, file_size: -10 },
      { ...canonicalVoiceMsg, duration_ms: -5 },
    ];

    const result = normalizeMessageAttachments([...malformedEntries, canonicalVoiceMsg], null);
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('message_attachment:10');
  });

  it('avoids key collisions between different ref types with the same numeric ID', () => {
    const sessionRow: MessageAttachmentRow = {
      ...canonicalVoiceMsg,
      ref: { type: 'session_attachment', id: 42 },
      source: 'user',
    };
    const messageRow: MessageAttachmentRow = {
      ...canonicalVoiceMsg,
      ref: { type: 'message_attachment', id: 42 },
    };

    const result = normalizeMessageAttachments([sessionRow, messageRow], null);
    expect(result).toHaveLength(2);
    expect(result[0].key).toBe('session_attachment:42');
    expect(result[1].key).toBe('message_attachment:42');
    expect(result[0].key).not.toBe(result[1].key);
  });

  it('enriches canonical session row from legacy meta without overriding canonical fields', () => {
    const result = normalizeMessageAttachments([canonicalImage], [legacyMetaImage]);
    expect(result).toHaveLength(1);
    expect(result[0].fileUri).toBe('https://cdn.example/photo.png');
    expect(result[0].originalFilename).toBe('camera_capture.png');
    // Canonical fields remain authoritative
    expect(result[0].status).toBe('ready');
    expect(result[0].source).toBe('user');
    expect(result[0].kind).toBe('image');
    expect(result[0].position).toBe(1);
    expect(result[0].displayName).toBe('photo.png');
    expect(result[0].contentUrl).toBeNull();
  });

  it('canonical attachments[] controls membership when present and valid (empty suppresses legacy)', () => {
    // Canonical is empty array -> membership is empty, even if legacy meta is provided
    const result = normalizeMessageAttachments([], [legacyMetaImage]);
    expect(result).toEqual([]);
  });

  it('falls back to legacy meta when canonical attachments is absent or non-array', () => {
    const fromUndefined = normalizeMessageAttachments(undefined, [legacyMetaImage]);
    expect(fromUndefined).toHaveLength(1);
    expect(fromUndefined[0]).toEqual({
      key: 'session_attachment:20',
      ref: { type: 'session_attachment', id: 20 },
      kind: 'image',
      source: 'user',
      status: 'ready',
      position: 0,
      displayName: 'photo.png',
      mimeType: 'image/png',
      fileSize: 104800,
      contentUrl: null,
      durationMs: null,
      errorCode: null,
      fileUri: 'https://cdn.example/photo.png',
      originalFilename: 'camera_capture.png',
    });

    const fromNull = normalizeMessageAttachments(null, [legacyMetaImage]);
    expect(fromNull).toHaveLength(1);
    expect(fromNull[0].key).toBe('session_attachment:20');

    const fromInvalid = normalizeMessageAttachments('invalid' as unknown, [legacyMetaImage]);
    expect(fromInvalid).toHaveLength(1);
    expect(fromInvalid[0].key).toBe('session_attachment:20');
  });

  it('normalizeMessageRow integrates attachments projection alongside existing message fields', () => {
    const row: MessageRow = {
      id: 101,
      role: 'assistant',
      content: 'Hello Alicia',
      reasoning_content: 'thinking trace',
      attachments: [canonicalVoiceMsg],
      attachments_meta: null,
      platform: 'deepseek',
      model_version: 'v4',
      token_count: 50,
      index_in_session: 1,
      attachment_ids: [10],
      client_turn_id: null,
      created_at: '2026-09-29T10:00:00Z',
    };

    const view = normalizeMessageRow(row);
    expect(view.id).toBe(101);
    expect(view.role).toBe('assistant');
    expect(view.content).toBe('Hello Alicia');
    expect(view.attachments).toHaveLength(1);
    expect(view.attachments?.[0].key).toBe('message_attachment:10');
    expect(view.attachments?.[0].source).toBe('voice_msg');
  });
});
