import { describe, expect, it } from 'vitest';
import {
  cleanProjectRefsForSend,
  extractCurrentAtQuery,
  extractProjectRefs,
  insertProjectRefToken,
  isInsertablePath,
  isSafeRelativePath,
} from '../features/chat/project/paths';

describe('P1D project reference path rules (Plan Task 5 / §6.6)', () => {
  it('accepts plain workspace-relative paths', () => {
    expect(isSafeRelativePath('src/main.rs')).toBe(true);
    expect(isSafeRelativePath('a/b/c.txt')).toBe(true);
    expect(isSafeRelativePath('file.md')).toBe(true);
    expect(isSafeRelativePath('dir with spaces/f.txt')).toBe(true);
    expect(isSafeRelativePath('a\\b\\c.txt')).toBe(true); // windows separator
  });

  it('rejects absolute, traversing, empty and control-character paths', () => {
    expect(isSafeRelativePath('/etc/passwd')).toBe(false);
    expect(isSafeRelativePath('C:/Users/x')).toBe(false);
    expect(isSafeRelativePath('c:\\windows')).toBe(false);
    expect(isSafeRelativePath('\\\\server\\share')).toBe(false);
    expect(isSafeRelativePath('../secret')).toBe(false);
    expect(isSafeRelativePath('a/../../b')).toBe(false);
    expect(isSafeRelativePath('a/./b')).toBe(false);
    expect(isSafeRelativePath('')).toBe(false);
    expect(isSafeRelativePath('a\u0000b')).toBe(false);
  });

  it('rejects duplicates when already referenced in the draft', () => {
    const existing = new Set(['src/main.rs']);
    expect(isInsertablePath('src/main.rs', existing)).toBe(false);
    expect(isInsertablePath('src/other.rs', existing)).toBe(true);
  });

  it('extracts complete @[path] tokens only', () => {
    expect(extractProjectRefs('see @[src/main.rs] and @[docs/a b.md]')).toEqual([
      'src/main.rs',
      'docs/a b.md',
    ]);
    expect(extractProjectRefs('no refs here')).toEqual([]);
  });

  it('cursor extraction activates only for the current incomplete @ token', () => {
    // caret right at the end of the query segment
    expect(extractCurrentAtQuery('see @src/', 9)).toBe('src/');
    expect(extractCurrentAtQuery('see @src', 8)).toBe('src');
    // a complete token before the caret never re-opens the popup
    expect(extractCurrentAtQuery('see @[src/main.rs] and more', 24)).toBeNull();
    // whitespace inside the query ends it
    expect(extractCurrentAtQuery('@src ', 5)).toBeNull();
    // @ mid-word is not a token start
    expect(extractCurrentAtQuery('foo@bar', 6)).toBeNull();
  });

  it('inserts the exact token with a trailing space at the caret', () => {
    expect(insertProjectRefToken('hello ', 6, 'src/main.rs')).toEqual({
      text: 'hello @[src/main.rs] ',
      caret: 21, // 6 + len('@[src/main.rs] ')=15
    });
    expect(insertProjectRefToken('hi', 2, '/abs/path')).toEqual({ text: 'hi', caret: 2 });
  });

  it('send-time cleanup converts only VALID tokens to @path', () => {
    expect(cleanProjectRefsForSend('use @[src/main.rs] please')).toBe('use @src/main.rs please');
    // malformed bracket content must remain untouched
    expect(cleanProjectRefsForSend('weird @[../escape] and @[C:/x] stay'))
      .toBe('weird @[../escape] and @[C:/x] stay');
    expect(cleanProjectRefsForSend('plain text unchanged')).toBe('plain text unchanged');
  });
});