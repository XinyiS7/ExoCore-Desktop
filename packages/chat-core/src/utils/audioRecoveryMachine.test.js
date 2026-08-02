import { describe, it, expect } from 'vitest';
import {
  audioRecoveryInitial,
  audioRecoveryUploadSuccess,
  audioRecoveryMarkDone,
  audioRecoveryMarkError,
  audioRecoveryOnStreamEnd,
  audioRecoverySessionSwitch,
  resolveAudioForSend,
} from './audioRecoveryMachine.js';

const INIT = audioRecoveryInitial();

describe('audioRecoveryMachine (P0-R6 state machine)', () => {
  it('SSE done success clears recoverable (13.4.1)', () => {
    const withItem = audioRecoveryUploadSuccess(INIT, 7, [11]);
    const ended = audioRecoveryOnStreamEnd(audioRecoveryMarkDone(withItem));
    expect(ended.item).toBeNull();
  });

  it('SSE event:error keeps recoverable (13.4.2)', () => {
    const withItem = audioRecoveryUploadSuccess(INIT, 7, [11]);
    const ended = audioRecoveryOnStreamEnd(audioRecoveryMarkError(withItem));
    expect(ended.item).toEqual({ conversationId: 7, attachmentIds: [11] });
  });

  it('EOF without done keeps recoverable (13.4.3, truncated/empty stream)', () => {
    const withItem = audioRecoveryUploadSuccess(INIT, 7, [11]);
    const ended = audioRecoveryOnStreamEnd(withItem); // no done marker
    expect(ended.item).toEqual({ conversationId: 7, attachmentIds: [11] });
  });

  it('retry resolves reuse of the same IDs (no re-upload) (13.4.4)', () => {
    const recoverableAudio = { conversationId: 7, attachmentIds: [11, 12] };
    const plan = resolveAudioForSend({
      status: 'idle',
      canRecord: true,
      recoverableAudio,
      conversationId: 7,
    });
    expect(plan.gate).toBe('ok');
    expect(plan.kind).toBe('reuse');
    expect(plan.attachmentIds).toEqual([11, 12]);
  });

  it('retry after unsupported target switch blocks network and keeps item (13.4.5)', () => {
    const recoverableAudio = { conversationId: 7, attachmentIds: [11] };
    const plan = resolveAudioForSend({
      status: 'idle',
      canRecord: false,
      recoverableAudio,
      conversationId: 7,
    });
    expect(plan.gate).toBe('unsupported');
    expect(plan.keepRecoverable).toBe(true);
  });

  it('unsupported target also blocks a fresh recorded clip (gate parity)', () => {
    const plan = resolveAudioForSend({
      status: 'recorded',
      canRecord: false,
      recoverableAudio: null,
      conversationId: 7,
    });
    expect(plan.gate).toBe('unsupported');
    expect(plan.keepRecoverable).toBe(false);
  });

  it('session switch clears recoverable (13.4.6)', () => {
    const withItem = audioRecoveryUploadSuccess(INIT, 7, [11]);
    expect(audioRecoverySessionSwitch(withItem).item).toBeNull();
  });

  it('recoverable from another conversation is not reused', () => {
    const plan = resolveAudioForSend({
      status: 'idle',
      canRecord: true,
      recoverableAudio: { conversationId: 7, attachmentIds: [11] },
      conversationId: 8,
    });
    expect(plan.kind).toBe('none');
  });
});
