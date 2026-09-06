import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearConversationDraft,
  clearRuntimeLease,
  loadConversationDraft,
  loadTransportPreference,
  persistRuntimeLease,
  readRuntimeLease,
  saveConversationDraft,
  saveTransportPreference,
} from '../features/chat/runtime/storage';
import type { V4RuntimeLease } from '../features/chat/runtime/types';

const KEY = (id: number) => `exo:v4:chat-runtime:${id}`;

const lease = (id: number, over: Partial<V4RuntimeLease> = {}): V4RuntimeLease => ({
  version: 1,
  operation: 'send',
  conversationId: id,
  transport: 'async',
  startedAt: 0,
  updatedAt: 0,
  disposition: 'pending',
  ...over,
});

describe('P1B V4 Storage & Lease Isolation (§6.5, §9.5)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('conditional persist against verified absence succeeds and round-trips', () => {
    const rec = lease(42, { asyncToken: 'tok12345', cursor: 3, startedAt: 1000, updatedAt: 2000, disposition: 'active' });

    expect(persistRuntimeLease(null, rec)).toEqual({ state: 'persisted', snapshot: rec });

    const outcome = readRuntimeLease(42);
    expect(outcome.state).toBe('valid');
    expect(outcome.state === 'valid' && outcome.lease).toEqual(rec);

    // Requesting a different conversation ID does not see this lease.
    expect(readRuntimeLease(99).state).toBe('absent');
  });

  it('conditional clear succeeds only against the exact expected prior', () => {
    const rec = lease(43, { startedAt: 1000, updatedAt: 1000, disposition: 'pending' });
    persistRuntimeLease(null, rec);

    // Wrong prior (different updatedAt) → conflict, observed untouched.
    const wrongPrior: V4RuntimeLease = { ...rec, updatedAt: 999 };
    const conflict = clearRuntimeLease(wrongPrior);
    expect(conflict.state).toBe('conflict');
    // The differing observed snapshot remains byte-for-byte owned.
    expect(window.localStorage.getItem(KEY(43))).toBe(JSON.stringify(rec));

    // Exact prior → cleared.
    expect(clearRuntimeLease(rec).state).toBe('cleared');
    expect(readRuntimeLease(43).state).toBe('absent');
    // Clearing again (prior absent) is a conflict, never a silent success.
    expect(clearRuntimeLease(rec).state).toBe('conflict');
  });

  it('conditional replacement requires the exact prior; conflict preserves the newer lease', () => {
    const pending = lease(44, { startedAt: 1000, updatedAt: 1000, disposition: 'pending' });
    persistRuntimeLease(null, pending);

    const newer: V4RuntimeLease = { ...pending, updatedAt: 2000, disposition: 'active', asyncToken: 'tok44', cursor: 0 };
    const ok = persistRuntimeLease(pending, newer);
    expect(ok.state).toBe('persisted');
    expect(readRuntimeLease(44).state === 'valid' && (readRuntimeLease(44) as { lease: V4RuntimeLease }).lease).toEqual(newer);

    // A STALE callback carrying the old expected prior must get conflict and
    // must NOT overwrite the newer lease (§11.2 stale persist row).
    const stale = persistRuntimeLease(pending, { ...pending, disposition: 'uncertain', updatedAt: 3000 });
    expect(stale.state).toBe('conflict');
    expect(window.localStorage.getItem(KEY(44))).toBe(JSON.stringify(newer));
  });

  it('pending creation conflicts when a lease already owns the conversation (zero overwrite)', () => {
    const existing = lease(45, { startedAt: 1, updatedAt: 1, disposition: 'uncertain' });
    persistRuntimeLease(null, existing);
    const attempt = persistRuntimeLease(null, lease(45, { startedAt: 2, updatedAt: 2, disposition: 'pending' }));
    expect(attempt.state).toBe('conflict');
    expect(attempt.state === 'conflict' && attempt.observed).toEqual(existing);
    expect(window.localStorage.getItem(KEY(45))).toBe(JSON.stringify(existing));
  });

  it('mutation_unavailable reports a verified prior after the precondition matched', () => {
    const pending = lease(46, { startedAt: 1, updatedAt: 1, disposition: 'pending' });
    persistRuntimeLease(null, pending);

    // Break setItem AFTER the precondition read succeeded (Storage prototype spy
    // — jsdom instance-property shadowing of localStorage is unreliable here).
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    try {
      const out = persistRuntimeLease(pending, { ...pending, disposition: 'active', updatedAt: 2 });
      expect(out.state).toBe('mutation_unavailable');
      expect(out.state === 'mutation_unavailable' && out.verifiedExpectedPrior).toEqual(pending);
      // The verified expected prior remains on disk.
      expect(window.localStorage.getItem(KEY(46))).toBe(JSON.stringify(pending));
    } finally {
      setItemSpy.mockRestore();
    }
  });

  it('never touches or overwrites V3 storage keys (exo_async_*)', () => {
    const v3Key = 'exo_async_42';
    window.localStorage.setItem(v3Key, JSON.stringify({ oldToken: 'legacy' }));

    const rec = lease(42, { asyncToken: 'v4token', cursor: 0, startedAt: 100, updatedAt: 200, disposition: 'active' });
    persistRuntimeLease(null, rec);

    // V3 key remains completely untouched.
    expect(window.localStorage.getItem(v3Key)).toBe(JSON.stringify({ oldToken: 'legacy' }));

    clearRuntimeLease(rec);
    // V3 key still untouched after clear.
    expect(window.localStorage.getItem(v3Key)).toBe(JSON.stringify({ oldToken: 'legacy' }));
  });

  it('persists and clears draft text per conversation', () => {
    saveConversationDraft(10, 'Draft turn content');
    expect(loadConversationDraft(10)).toBe('Draft turn content');
    expect(loadConversationDraft(20)).toBe('');

    // Empty/blank string clears the storage entry.
    saveConversationDraft(10, '   ');
    expect(loadConversationDraft(10)).toBe('');

    saveConversationDraft(10, 'Another draft');
    clearConversationDraft(10);
    expect(loadConversationDraft(10)).toBe('');
  });

  it('persists transport preference with safe default', () => {
    expect(loadTransportPreference()).toBe('sse');
    saveTransportPreference('async');
    expect(loadTransportPreference()).toBe('async');
    saveTransportPreference('sse');
    expect(loadTransportPreference()).toBe('sse');
  });
});

describe('C1B-R2-01 read-outcome vocabulary (kept across R4)', () => {
  it('distinguishes absent / valid / quarantined / unavailable states', () => {
    expect(readRuntimeLease(500).state).toBe('absent');

    const good: V4RuntimeLease = {
      version: 1,
      operation: 'send',
      conversationId: 500,
      transport: 'async',
      asyncToken: 'tok500',
      cursor: 1,
      startedAt: 1000,
      updatedAt: 2000,
      disposition: 'active',
    };
    persistRuntimeLease(null, good);
    expect(readRuntimeLease(500)).toEqual({ state: 'valid', lease: good });
    clearRuntimeLease(good);
    expect(readRuntimeLease(500).state).toBe('absent');
  });

  it('invalid JSON is REMOVED and reported as quarantined — never silently null', () => {
    window.localStorage.setItem(KEY(501), '{broken json');
    const outcome = readRuntimeLease(501);
    expect(outcome.state).toBe('quarantined');
    expect(outcome.state === 'quarantined' && outcome.reason).toBe('invalid_json');
    // Quarantine physically removed the corrupt record.
    expect(window.localStorage.getItem(KEY(501))).toBeNull();
  });

  it('unknown operation / foreign conversation / invalid async-active records are quarantined, never executable', () => {
    const base = {
      version: 1,
      conversationId: 502,
      transport: 'async',
      startedAt: 1000,
      updatedAt: 1000,
      disposition: 'active',
    } as V4RuntimeLease;

    // Unknown operation string (would previously have been executed as send).
    window.localStorage.setItem(
      KEY(502),
      JSON.stringify({ ...base, operation: 'delete-history', asyncToken: 'x1234567', cursor: 0 }),
    );
    const opOutcome = readRuntimeLease(502);
    expect(opOutcome.state).toBe('quarantined');
    expect(opOutcome.state === 'quarantined' && opOutcome.reason).toContain('unknown_operation');

    // Foreign conversation binding.
    window.localStorage.setItem(
      KEY(503),
      JSON.stringify({ ...base, operation: 'send', conversationId: 999, asyncToken: 'x1234567', cursor: 0 }),
    );
    const bindOutcome = readRuntimeLease(503);
    expect(bindOutcome.state === 'quarantined' && bindOutcome.reason).toBe('conversation_binding_mismatch');

    // Active async without token cannot be executed.
    window.localStorage.setItem(KEY(504), JSON.stringify({ ...base, operation: 'send', conversationId: 504 }));
    const tokenOutcome = readRuntimeLease(504);
    expect(tokenOutcome.state === 'quarantined' && tokenOutcome.reason).toBe('async_missing_token');
  });

  it('pending/uncertain async markers without token are valid non-executable protection records', () => {
    // A crash between dispatch and ack leaves a pending marker without token;
    // it must survive reload as duplicate-write protection.
    const pending = {
      version: 1,
      operation: 'send',
      conversationId: 505,
      transport: 'async',
      startedAt: 1000,
      updatedAt: 1000,
      disposition: 'pending',
    } as V4RuntimeLease;
    persistRuntimeLease(null, pending);
    const outcome = readRuntimeLease(505);
    expect(outcome.state).toBe('valid');
    expect(outcome.state === 'valid' && outcome.lease.disposition).toBe('pending');

    const uncertain = { ...pending, disposition: 'uncertain' } as V4RuntimeLease;
    persistRuntimeLease(pending, uncertain);
    const outcome2 = readRuntimeLease(505);
    expect(outcome2.state).toBe('valid');
    expect(outcome2.state === 'valid' && outcome2.lease.disposition).toBe('uncertain');
    clearRuntimeLease(uncertain);
  });

  it('conflict with an unparseable observed value never executes and never guesses', () => {
    window.localStorage.setItem(KEY(506), '{broken');
    const out = persistRuntimeLease(null, lease(506, { startedAt: 1, updatedAt: 1, disposition: 'pending' }));
    expect(out.state).toBe('conflict');
    // The unparseable observation is NOT overwritten by the caller — a reread
    // (which quarantines) is the sanctioned adoption path.
    expect(window.localStorage.getItem(KEY(506))).toBe('{broken');
  });
});