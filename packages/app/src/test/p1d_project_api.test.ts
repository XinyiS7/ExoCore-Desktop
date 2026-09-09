import { afterEach, describe, expect, it } from 'vitest';
import {
  fetchProjectDetail,
  fetchProjectFiles,
  fetchProjectTree,
  validateTreeEntries,
} from '../features/chat/control/api';
import { AppApiError } from '../features/chat/api';
import { installFetch, jsonResponse, unmockFetch } from './helpers';

const rootTree = {
  path: '',
  entries: [
    { name: 'src', type: 'dir', path: 'src', entries: [
      { name: 'main.ts', type: 'file', path: 'src/main.ts', size: 812 },
    ] },
    { name: 'README.md', type: 'file', path: 'README.md', size: 124 },
  ],
};

describe('P1D project adapters (Plan Task 1 / §6.6)', () => {
  afterEach(() => unmockFetch());

  it('validates project detail incl. nullable work_dir', async () => {
    installFetch([
      {
        test: '/api/core/projects/3/',
        handler: () => jsonResponse({
          id: 3, name: 'ExoCore', description: 'd', prompt: null, work_dir: 'D:\\ws\\exo', created_at: '2026-09-01T00:00:00Z',
        }),
      },
    ]);
    await expect(fetchProjectDetail(3)).resolves.toMatchObject({ id: 3, workDir: 'D:\\ws\\exo' });
  });

  it('rejects malformed project detail rows', async () => {
    installFetch([
      { test: '/api/core/projects/3/', handler: () => jsonResponse({ name: 'no-id' }) },
    ]);
    await expect(fetchProjectDetail(3)).rejects.toMatchObject({ code: 'CONTRACT' });
  });

  it('validates uploaded project-file reference rows', async () => {
    installFetch([
      {
        test: '/api/core/projects/3/files/',
        handler: () => jsonResponse([
          { id: 11, name: 'guide.pdf', file_type: 'pdf', size: 2048, url: 'http://x/f.pdf', preview_url: null, created_at: 't' },
        ]),
      },
    ]);
    await expect(fetchProjectFiles(3)).resolves.toMatchObject([
      { id: 11, name: 'guide.pdf', fileType: 'pdf', size: 2048, url: 'http://x/f.pdf' },
    ]);
  });

  it('rejects project-files rows missing identity/name', async () => {
    installFetch([
      {
        test: '/api/core/projects/3/files/',
        handler: () => jsonResponse([{ id: 11 }]),
      },
    ]);
    await expect(fetchProjectFiles(3)).rejects.toMatchObject({ code: 'CONTRACT' });
  });

  it('fetches the recursive root tree', async () => {
    installFetch([
      { test: '/api/core/projects/3/tree/', handler: () => jsonResponse(rootTree) },
    ]);
    await expect(fetchProjectTree(3, { kind: 'root' })).resolves.toMatchObject({
      path: '',
      entries: [
        expect.objectContaining({ path: 'src', type: 'dir', entries: [expect.objectContaining({ path: 'src/main.ts' })] }),
        expect.objectContaining({ path: 'README.md' }),
      ],
    });
  });

  it('fetches one exact single level with the path param', async () => {
    let seenPath: string | null = null;
    installFetch([
      {
        test: '/api/core/projects/3/tree/',
        handler: (url) => {
          seenPath = url.searchParams.get('path');
          return jsonResponse({ path: 'src', entries: [{ name: 'lib', type: 'dir', path: 'src/lib' }] });
        },
      },
    ]);
    await fetchProjectTree(3, { kind: 'level', path: 'src' });
    expect(seenPath).toBe('src');
  });

  it('rejects duplicate paths and malformed entry types', () => {
    expect(() =>
      validateTreeEntries([
        { name: 'a', type: 'file', path: 'x/a.txt' },
        { name: 'a2', type: 'file', path: 'x/a.txt' },
      ]),
    ).toThrow(AppApiError);
    expect(() => validateTreeEntries([{ name: 'a', type: 'link', path: 'x/a' }])).toThrow(AppApiError);
    expect(() => validateTreeEntries([{ name: '', type: 'dir', path: 'x' }])).toThrow(AppApiError);
  });

  it('rejects a tree envelope whose entries are not an array', async () => {
    installFetch([
      { test: '/api/core/projects/3/tree/', handler: () => jsonResponse({ path: '', entries: 'boom' }) },
    ]);
    await expect(fetchProjectTree(3, { kind: 'root' })).rejects.toMatchObject({ code: 'CONTRACT' });
  });
});