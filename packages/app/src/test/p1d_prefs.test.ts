import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  readCacheEnabled,
  readMemoryInjection,
  readSessionType,
  writeCacheEnabled,
  writeMemoryInjection,
  writeSessionType,
} from '../features/chat/control/prefs';

describe('P1D conversation-local preferences (Plan §4.3 / §6.3)', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => window.localStorage.clear());

  it('defaults: cache enabled, memory injection enabled, lite session type', () => {
    expect(readCacheEnabled(1)).toBe(true);
    expect(readMemoryInjection(1)).toBe(true);
    expect(readSessionType(1)).toBe('lite');
  });

  it('persists per-conversation values in the V4 namespace', () => {
    expect(writeCacheEnabled(1, false)).toEqual({ state: 'persisted' });
    expect(writeSessionType(1, 'full')).toEqual({ state: 'persisted' });
    expect(writeMemoryInjection(1, false)).toEqual({ state: 'persisted' });
    expect(readCacheEnabled(1)).toBe(false);
    expect(readSessionType(1)).toBe('full');
    expect(readMemoryInjection(1)).toBe(false);
    // Other conversations keep defaults
    expect(readCacheEnabled(2)).toBe(true);
    expect(readSessionType(2)).toBe('lite');
    expect(readMemoryInjection(2)).toBe(true);
  });

  it('treats corrupt stored values as absent (defaults apply)', () => {
    window.localStorage.setItem('exo:v4:pref:session-type:1', '"bogus"');
    window.localStorage.setItem('exo:v4:pref:cache-enabled:1', '42');
    expect(readSessionType(1)).toBe('lite');
    expect(readCacheEnabled(1)).toBe(true);
  });
});