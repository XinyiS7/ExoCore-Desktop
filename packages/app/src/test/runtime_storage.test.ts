import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearConversationDraft,
  clearRuntimeMarker,
  loadConversationDraft,
  loadTransportPreference,
  readRuntimeMarker,
  saveConversationDraft,
  saveTransportPreference,
  writeRuntimeMarker,
} from '../features/chat/runtime/storage';
import type { RuntimeMarker } from '../features/chat/runtime/types';

const KEY = (id: number) => `exo:v4:chat-runtime:${id}`;

const marker = (id: number, over: Partial<RuntimeMarker> = {}): RuntimeMarker => ({
  conversationId: id,
  operation: 'send',
  transport: 'async',
  startedAt: 1000,
  ...over,
});

describe('V4 chat storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('runtime marker', () => {
    it('round-trips a marker with its async token', () => {
      writeRuntimeMarker(marker(42, { asyncToken: 'tok-1' }));
      expect(readRuntimeMarker(42)).toEqual(marker(42, { asyncToken: 'tok-1' }));
    });

    it('returns null when nothing is stored', () => {
      expect(readRuntimeMarker(42)).toBeNull();
    });

    it('discards an unreadable record', () => {
      window.localStorage.setItem(KEY(42), '{not json');
      expect(readRuntimeMarker(42)).toBeNull();
      expect(window.localStorage.getItem(KEY(42))).toBeNull();
    });

    it('discards a record bound to another conversation', () => {
      window.localStorage.setItem(KEY(42), JSON.stringify(marker(7)));
      expect(readRuntimeMarker(42)).toBeNull();
      expect(window.localStorage.getItem(KEY(42))).toBeNull();
    });

    it('reads records written by the previous lease format', () => {
      window.localStorage.setItem(
        KEY(42),
        JSON.stringify({
          version: 1,
          operation: 'send',
          conversationId: 42,
          transport: 'async',
          asyncToken: 'tok-old',
          cursor: 3,
          startedAt: 1000,
          updatedAt: 2000,
          disposition: 'active',
        }),
      );
      expect(readRuntimeMarker(42)).toEqual(marker(42, { asyncToken: 'tok-old' }));
    });

    it('clears only the marker of the matching operation', () => {
      writeRuntimeMarker(marker(42, { startedAt: 2000 }));
      clearRuntimeMarker(42, 1000);
      expect(readRuntimeMarker(42)?.startedAt).toBe(2000);
      clearRuntimeMarker(42, 2000);
      expect(readRuntimeMarker(42)).toBeNull();
    });

    it('never touches V3 keys', () => {
      window.localStorage.setItem('exo_async_42', 'v3');
      writeRuntimeMarker(marker(42));
      clearRuntimeMarker(42, 1000);
      expect(window.localStorage.getItem('exo_async_42')).toBe('v3');
    });
  });

  describe('transport preference', () => {
    it('defaults to sse and round-trips async', () => {
      expect(loadTransportPreference()).toBe('sse');
      saveTransportPreference('async');
      expect(loadTransportPreference()).toBe('async');
    });
  });

  describe('drafts', () => {
    it('saves, loads and clears per conversation', () => {
      saveConversationDraft(1, 'hello');
      saveConversationDraft(2, 'other');
      expect(loadConversationDraft(1)).toBe('hello');
      clearConversationDraft(1);
      expect(loadConversationDraft(1)).toBe('');
      expect(loadConversationDraft(2)).toBe('other');
    });

    it('removes the key when the draft is blank', () => {
      saveConversationDraft(1, 'hello');
      saveConversationDraft(1, '   ');
      expect(window.localStorage.getItem('exo:v4:chat-draft:1')).toBeNull();
    });
  });

  describe('storage unavailable', () => {
    it('degrades without throwing', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('blocked');
      });
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('blocked');
      });
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('blocked');
      });
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      expect(() => writeRuntimeMarker(marker(42))).not.toThrow();
      expect(readRuntimeMarker(42)).toBeNull();
      expect(() => clearRuntimeMarker(42, 1000)).not.toThrow();
      expect(() => saveConversationDraft(1, 'x')).not.toThrow();
      expect(loadConversationDraft(1)).toBe('');
      expect(() => clearConversationDraft(1)).not.toThrow();
      expect(() => saveTransportPreference('async')).not.toThrow();
      expect(loadTransportPreference()).toBe('sse');
    });
  });
});
