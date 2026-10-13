import '@testing-library/jest-dom/vitest';

// Node >= 25 ships a native global `localStorage` that shadows jsdom's. Without
// `--localstorage-file` it is a plain object with no Storage methods
// (XinyiS7/ExoCore#38). Rebind to the jsdom window's real Storage.
const jsdomStorage = (globalThis as { jsdom?: { window: Window } }).jsdom?.window.localStorage;
if (jsdomStorage && window.localStorage !== jsdomStorage) {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get: () => jsdomStorage,
  });
}
