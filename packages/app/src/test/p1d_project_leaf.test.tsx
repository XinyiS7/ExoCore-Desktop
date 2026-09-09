/**
 * P1D Project leaf — ONE shared combined-tree Query owner (`useProjectTree`):
 * drawer AND autocomplete consume the same derived tree; a shell's exact
 * level load lands in the Query-owned levels record via one immutable
 * setQueryData, and `combine` re-derives the merged presentation with deep
 * merges composed by path. Originating-project binding rejects late
 * completions; visible level error + retry (Plan Task 5 / §6.6; leaf C).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it } from 'vitest';
import { ProjectFilesDrawer } from '../features/chat/project/ProjectFilesDrawer';
import {
  controlQueryKeys,
  mergeLevelChildren,
  useProjectTree,
} from '../features/chat/control/queries';
import type { ProjectTreeEntry } from '../features/chat/control/types';
import { installFetch, jsonResponse, unmockFetch, callsToPath } from './helpers';

const projectDetail = {
  id: 3,
  name: 'ExoCore',
  description: null,
  prompt: null,
  work_dir: 'D:\\ws\\exo',
  created_at: '2026-09-01T00:00:00Z',
};

const projectDetail2 = { ...projectDetail, id: 9, name: 'Other' };

const rootTree = {
  path: '',
  entries: [
    { name: 'src', type: 'dir', path: 'src', entries: [
      { name: 'main.ts', type: 'file', path: 'src/main.ts', size: 812 },
    ] },
    { name: 'shell-a', type: 'dir', path: 'shell-a', entries: null }, // shell
    { name: 'README.md', type: 'file', path: 'README.md', size: 124 },
  ],
};

const rootTree2 = {
  path: '',
  entries: [
    { name: 'other-dir', type: 'dir', path: 'other-dir', entries: [] },
  ],
};

const levelShellA = {
  path: 'shell-a',
  entries: [
    { name: 'deep', type: 'dir', path: 'shell-a/deep', entries: null }, // deeper shell
    { name: 'a.txt', type: 'file', path: 'shell-a/a.txt', size: 10 },
  ],
};

const levelDeep = {
  path: 'shell-a/deep',
  entries: [
    { name: 'b.txt', type: 'file', path: 'shell-a/deep/b.txt', size: 20 },
  ],
};

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

/** Second consumer of the SAME combined owner — mimics the composer
 * autocomplete sharing the drawer's merged tree. */
function RootTreeProbe({ projectId }: { projectId: number }) {
  const tree = useProjectTree(projectId);
  const names = tree.entries.map((e) => e.name).join(',');
  return <div data-testid="root-probe">{names}</div>;
}

function installProjectRoutes(levelHandlers: Record<string, () => Response | Promise<Response>> = {}) {
  return installFetch([
    { test: '/api/core/projects/3/', handler: () => jsonResponse(projectDetail) },
    { test: '/api/core/projects/3/files/', handler: () => jsonResponse([]) },
    {
      test: '/api/core/projects/3/tree/',
      handler: (url: URL) => {
        const path = url.searchParams.get('path');
        if (path === null) return jsonResponse(rootTree);
        const level = levelHandlers[path];
        return level ? level() : jsonResponse({ error: 'no such level' }, 404);
      },
    },
    { test: '/api/core/projects/9/', handler: () => jsonResponse(projectDetail2) },
    { test: '/api/core/projects/9/files/', handler: () => jsonResponse([]) },
    {
      test: '/api/core/projects/9/tree/',
      handler: (url: URL) => {
        const path = url.searchParams.get('path');
        if (path === null) return jsonResponse(rootTree2);
        const level = levelHandlers[path];
        return level ? level() : jsonResponse({ error: 'no such level' }, 404);
      },
    },
  ]);
}

const flatNames = (entries: ProjectTreeEntry[]): string[] => entries.map((e) => e.name);

afterEach(() => {
  unmockFetch();
});

describe('P1D Project files drawer leaf', () => {
  it('shares ONE combined Query owner and expands preloaded children without fetches', async () => {
    const { calls } = installProjectRoutes();
    render(
      <QueryClientProvider client={makeClient()}>
        <ProjectFilesDrawer projectId={3} isOpen onClose={() => {}} onInsertPath={() => {}} />
        <RootTreeProbe projectId={3} />
      </QueryClientProvider>,
    );
    await screen.findByText('shell-a');
    fireEvent.click(screen.getByRole('button', { name: /^src$/ }));
    await screen.findByText('main.ts');
    const treeCalls = callsToPath(calls, '/tree/');
    expect(treeCalls).toHaveLength(1); // single root fetch shared by both consumers
  });

  it('lands a shell load in the Query-owned record; every consumer sees the merge', async () => {
    const client = makeClient();
    installProjectRoutes({ 'shell-a': () => jsonResponse(levelShellA) });
    render(
      <QueryClientProvider client={client}>
        <ProjectFilesDrawer projectId={3} isOpen onClose={() => {}} onInsertPath={() => {}} />
        <RootTreeProbe projectId={3} />
      </QueryClientProvider>,
    );
    await screen.findByText('shell-a');
    fireEvent.click(screen.getByRole('button', { name: /shell-a/ }));
    await screen.findByText('a.txt'); // drawer sees merged children
    // The combined owner's levels record holds the fetched children…
    const levels = client.getQueryData<Record<string, ProjectTreeEntry[]>>(
      controlQueryKeys.projectTreeLevels(3),
    );
    expect(flatNames(levels?.['shell-a'] ?? [])).toEqual(['deep', 'a.txt']);
    // …while the SERVER root row stays pristine (never mutated).
    const serverRoot = client.getQueryData<{ entries: ProjectTreeEntry[] }>(
      controlQueryKeys.projectTreeRoot(3),
    );
    expect((serverRoot?.entries[1] as ProjectTreeEntry).entries).toBeNull();
    // The second consumer (autocomplete-style) observes the derived merge.
    await waitFor(() =>
      expect(screen.getByTestId('root-probe').textContent).toContain('shell-a'),
    );
  });

  it('preserves deeper shell merges (level + sub-level compose by path)', async () => {
    const client = makeClient();
    const { calls } = installProjectRoutes({
      'shell-a': () => jsonResponse(levelShellA),
      'shell-a/deep': () => jsonResponse(levelDeep),
    });
    render(
      <QueryClientProvider client={client}>
        <ProjectFilesDrawer projectId={3} isOpen onClose={() => {}} onInsertPath={() => {}} />
      </QueryClientProvider>,
    );
    await screen.findByText('shell-a');
    fireEvent.click(screen.getByRole('button', { name: /shell-a/ }));
    await screen.findByText('deep');
    fireEvent.click(screen.getByRole('button', { name: /deep/ }));
    await screen.findByText('b.txt');
    const levelCalls = callsToPath(calls, '/tree/').filter((c) => c.url.searchParams.get('path'));
    expect(levelCalls.map((c) => c.url.searchParams.get('path'))).toEqual(['shell-a', 'shell-a/deep']);
    const levels = client.getQueryData<Record<string, ProjectTreeEntry[]>>(
      controlQueryKeys.projectTreeLevels(3),
    );
    expect(flatNames(levels?.['shell-a'] ?? [])).toEqual(['deep', 'a.txt']);
    expect(flatNames(levels?.['shell-a/deep'] ?? [])).toEqual(['b.txt']);
  });

  it('shows a visible level error with retry, then merges on success', async () => {
    let fail = true;
    const { calls } = installProjectRoutes({
      'shell-a': () => (fail ? jsonResponse({ error: 'boom' }, 500) : jsonResponse(levelShellA)),
    });
    render(
      <QueryClientProvider client={makeClient()}>
        <ProjectFilesDrawer projectId={3} isOpen onClose={() => {}} onInsertPath={() => {}} />
      </QueryClientProvider>,
    );
    await screen.findByText('shell-a');
    fireEvent.click(screen.getByRole('button', { name: /shell-a/ }));
    await screen.findByText('加载失败');
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    await screen.findByText('a.txt');
    expect(callsToPath(calls, '/tree/').filter((c) => c.url.searchParams.get('path'))).toHaveLength(2);
  });

  it('binds level completions to their originating project; late results never cross', async () => {
    let release: (r: Response) => void = () => {};
    const gate = new Promise<Response>((resolve) => {
      release = (r) => resolve(r);
    });
    const client = makeClient();
    const { calls } = installProjectRoutes({ 'shell-a': () => gate });
    const { rerender } = render(
      <QueryClientProvider client={client}>
        <ProjectFilesDrawer projectId={3} isOpen onClose={() => {}} onInsertPath={() => {}} />
      </QueryClientProvider>,
    );
    await screen.findByText('shell-a');
    fireEvent.click(screen.getByRole('button', { name: /shell-a/ }));
    rerender(
      <QueryClientProvider client={client}>
        <ProjectFilesDrawer projectId={9} isOpen onClose={() => {}} onInsertPath={() => {}} />
      </QueryClientProvider>,
    );
    await screen.findByText('other-dir');
    release(jsonResponse(levelShellA));
    await waitFor(() => expect(callsToPath(calls, '/tree/').length).toBeGreaterThanOrEqual(2));
    // UI: the new project's tree contains nothing from the old project.
    expect(screen.queryByText('a.txt')).toBeNull();
    expect(screen.queryByText('shell-a')).toBeNull();
    // Data: the stale completion was REJECTED — neither project's levels
    // record received shell-a children.
    const levels3 = client.getQueryData<Record<string, ProjectTreeEntry[]>>(
      controlQueryKeys.projectTreeLevels(3),
    );
    const levels9 = client.getQueryData<Record<string, ProjectTreeEntry[]>>(
      controlQueryKeys.projectTreeLevels(9),
    );
    expect(Object.keys(levels3 ?? {})).toHaveLength(0);
    expect(Object.keys(levels9 ?? {})).toHaveLength(0);
  });

  it('gates level hook inputs across a project switch (no B/Apath request is issued)', async () => {
    let release: (r: Response) => void = () => {};
    const gate = new Promise<Response>((resolve) => {
      release = (r) => resolve(r);
    });
    const { calls } = installProjectRoutes({ 'shell-a': () => gate });
    const client = makeClient();
    const { rerender } = render(
      <QueryClientProvider client={client}>
        <ProjectFilesDrawer projectId={3} isOpen onClose={() => {}} onInsertPath={() => {}} />
      </QueryClientProvider>,
    );
    await screen.findByText('shell-a');
    fireEvent.click(screen.getByRole('button', { name: /shell-a/ }));
    // Project A's level fetch is in flight; switch to project B.
    rerender(
      <QueryClientProvider client={client}>
        <ProjectFilesDrawer projectId={9} isOpen onClose={() => {}} onInsertPath={() => {}} />
      </QueryClientProvider>,
    );
    await screen.findByText('other-dir');
    // While B is mounted, its root may fetch — but ZERO B/Apath level
    // request may be issued (stale levelPath must not leak into the hook).
    const bLevelCalls = callsToPath(calls, '/projects/9/tree/').filter(
      (c) => c.url.searchParams.get('path') !== null,
    );
    expect(bLevelCalls).toHaveLength(0);
    expect(callsToPath(calls, '/projects/3/tree/').filter((c) => c.url.searchParams.get('path'))).not.toHaveLength(0);
    // Late release is still rejected before any cache write.
    release(jsonResponse(levelShellA));
    await waitFor(() => expect(callsToPath(calls, '/tree/').length).toBeGreaterThanOrEqual(2));
    const levels3 = client.getQueryData<Record<string, ProjectTreeEntry[]>>(
      controlQueryKeys.projectTreeLevels(3),
    );
    const levels9 = client.getQueryData<Record<string, ProjectTreeEntry[]>>(
      controlQueryKeys.projectTreeLevels(9),
    );
    expect(Object.keys(levels3 ?? {})).toHaveLength(0);
    expect(Object.keys(levels9 ?? {})).toHaveLength(0);
  });

  it('mergeLevelChildren: refreshed recursive root wins over stale level records', () => {
    const shellRoot: ProjectTreeEntry[] = [
      { name: 'shell-a', type: 'dir', path: 'shell-a', size: null, entries: null },
    ];
    const freshRoot: ProjectTreeEntry[] = [
      {
        name: 'shell-a', type: 'dir', path: 'shell-a', size: null, entries: [
          { name: 'server-new.txt', type: 'file', path: 'shell-a/server-new.txt', size: 2, entries: null },
          { name: 'deep', type: 'dir', path: 'shell-a/deep', size: null, entries: null },
        ],
      },
    ];
    const staleLevel: ProjectTreeEntry[] = [
      { name: 'stale.txt', type: 'file', path: 'shell-a/stale.txt', size: 1, entries: null },
    ];
    // Shell + level record → merged.
    expect(mergeLevelChildren(shellRoot, { 'shell-a': staleLevel })[0].entries?.map((e) => e.name))
      .toEqual(['stale.txt']);
    // Fresh recursive root + STALE level record → backend truth wins.
    const merged = mergeLevelChildren(freshRoot, { 'shell-a': staleLevel })[0];
    expect(merged.entries?.map((e) => e.name)).toEqual(['server-new.txt', 'deep']);
    // Deeper shell inside the refreshed children still accepts its own
    // exact level fill.
    const deepMerged = mergeLevelChildren(freshRoot, {
      'shell-a': staleLevel,
      'shell-a/deep': [
        { name: 'deep-ok.txt', type: 'file', path: 'shell-a/deep/deep-ok.txt', size: 3, entries: null },
      ],
    })[0];
    const deepEntry = deepMerged.entries?.find((e) => e.name === 'deep');
    expect(deepEntry?.entries?.map((e) => e.name)).toEqual(['deep-ok.txt']);
  });

  it('issues zero project requests for Drift (null projectId)', () => {
    const { calls } = installProjectRoutes();
    render(
      <QueryClientProvider client={makeClient()}>
        <ProjectFilesDrawer projectId={null} isOpen onClose={() => {}} onInsertPath={() => {}} />
      </QueryClientProvider>,
    );
    expect(screen.queryByText('项目文件')).toBeNull();
    expect(calls).toHaveLength(0);
  });
});