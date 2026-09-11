import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState, type ReactNode } from 'react';
import { ProjectFilesDrawer } from '../features/chat/project/ProjectFilesDrawer';
import { installFetch, jsonResponse, unmockFetch } from './helpers';

const projectDetail = {
  id: 3,
  name: 'ExoCore',
  description: null,
  prompt: null,
  work_dir: 'D:\\ws\\exo',
  created_at: '2026-09-01T00:00:00Z',
};

const rootTree = {
  path: '',
  entries: [
    { name: 'src', type: 'dir', path: 'src', entries: [
      { name: 'main.ts', type: 'file', path: 'src/main.ts', size: 812 },
    ] },
    { name: 'node_modules', type: 'dir', path: 'node_modules' }, // shell — no children
    { name: 'README.md', type: 'file', path: 'README.md', size: 124 },
  ],
};

function wrap(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

function installProjectRoutes() {
  return installFetch([
    { test: '/api/core/projects/3/', handler: () => jsonResponse(projectDetail) },
    {
      test: '/api/core/projects/3/files/',
      handler: () => jsonResponse([
        { id: 11, name: 'guide.pdf', file_type: 'pdf', size: 2048, url: 'http://x/g.pdf', preview_url: null, created_at: 't' },
      ]),
    },
    { test: '/api/core/projects/3/tree/', handler: () => jsonResponse(rootTree) },
  ]);
}

describe('P1D project files drawer (Plan Task 5 / §6.6, §8.5)', () => {
  afterEach(() => unmockFetch());

  it('Drift renders nothing and issues zero project requests', async () => {
    const { calls } = installProjectRoutes();
    const { container } = wrap(
      <ProjectFilesDrawer projectId={null} isOpen onClose={vi.fn()} onInsertPath={vi.fn()} />,
    );
    expect(container.querySelector('.v4-drawer')).toBeNull();
    await new Promise((r) => setTimeout(r, 10));
    expect(calls.filter((c) => c.url.pathname.includes('/core/projects/'))).toHaveLength(0);
  });

  it('shows read-only uploaded references separately from the work-dir tree', async () => {
    installProjectRoutes();
    wrap(
      <ProjectFilesDrawer projectId={3} isOpen onClose={vi.fn()} onInsertPath={vi.fn()} />,
    );
    await waitFor(() => expect(screen.getByText('guide.pdf')).toBeTruthy());
    // Read-only: no edit/delete/upload affordances for uploaded refs.
    expect(screen.queryByText('删除')).toBeNull();
    expect(screen.queryByText('上传')).toBeNull();
    // Tree renders; directories are folded by default and expand in place.
    await waitFor(() => expect(screen.getByText('README.md')).toBeTruthy());
    expect(screen.getByText('src')).toBeTruthy();
    fireEvent.click(screen.getByText('src'));
    await waitFor(() => expect(screen.getByText('main.ts')).toBeTruthy());
  });

  it('renders work-dir missing state without any tree fetch', async () => {
    const { calls } = installFetch([
      {
        test: '/api/core/projects/3/',
        handler: () => jsonResponse({ ...projectDetail, work_dir: null }),
      },
      {
        test: '/api/core/projects/3/files/',
        handler: () => jsonResponse([]),
      },
    ]);
    wrap(
      <ProjectFilesDrawer projectId={3} isOpen onClose={vi.fn()} onInsertPath={vi.fn()} />,
    );
    await waitFor(() =>
      expect(screen.getByText(/项目未绑定工作目录/)).toBeTruthy(),
    );
    expect(calls.filter((c) => c.url.pathname.endsWith('/tree/'))).toHaveLength(0);
  });

  it('surfaces permission/malformed states with a retry action', async () => {
    installFetch([
      { test: '/api/core/projects/3/', handler: () => jsonResponse(projectDetail) },
      { test: '/api/core/projects/3/files/', handler: () => jsonResponse([]) },
      {
        test: '/api/core/projects/3/tree/',
        handler: () => jsonResponse({ error: '没有权限读取该目录。' }, 403),
      },
    ]);
    wrap(
      <ProjectFilesDrawer projectId={3} isOpen onClose={vi.fn()} onInsertPath={vi.fn()} />,
    );
    await waitFor(() => expect(screen.getByText(/没有权限读取该目录/)).toBeTruthy());
    expect(screen.getAllByText('重试').length).toBeGreaterThan(0);
  });

  it('file click inserts the relative path; dir click expands in place', async () => {
    const { calls } = installProjectRoutes();
    const onInsertPath = vi.fn();
    wrap(
      <ProjectFilesDrawer projectId={3} isOpen onClose={vi.fn()} onInsertPath={onInsertPath} />,
    );
    await waitFor(() => expect(screen.getByText('README.md')).toBeTruthy());
    // Directory with recursive children expands without network.
    const before = calls.filter((c) => c.url.pathname.endsWith('/tree/')).length;
    fireEvent.click(screen.getByText('src'));
    await waitFor(() => expect(screen.getByText('main.ts')).toBeTruthy());
    expect(calls.filter((c) => c.url.pathname.endsWith('/tree/')).length).toBe(before);
    fireEvent.click(screen.getByText('main.ts'));
    expect(onInsertPath).toHaveBeenCalledWith('src/main.ts');
  });

  it('directory shell triggers exactly one single-level fetch with the path param', async () => {
    let singleLevelCalls = 0;
    let seenPath: string | null = null;
    installFetch([
      { test: '/api/core/projects/3/', handler: () => jsonResponse(projectDetail) },
      { test: '/api/core/projects/3/files/', handler: () => jsonResponse([]) },
      {
        test: '/api/core/projects/3/tree/',
        handler: (url) => {
          const path = url.searchParams.get('path');
          if (path !== null) {
            singleLevelCalls += 1;
            seenPath = path;
            return jsonResponse({
              path,
              entries: [{ name: 'lodash.js', type: 'file', path: `${path}/lodash.js`, size: 99 }],
            });
          }
          return jsonResponse(rootTree);
        },
      },
    ]);
    wrap(
      <ProjectFilesDrawer projectId={3} isOpen onClose={vi.fn()} onInsertPath={vi.fn()} />,
    );
    await waitFor(() => expect(screen.getByText('node_modules')).toBeTruthy());
    fireEvent.click(screen.getByText('node_modules'));
    // fetch in flight; then the children replace the shell and auto-expand.
    await waitFor(() => expect(screen.getByText('lodash.js')).toBeTruthy());
    expect(singleLevelCalls).toBe(1);
    expect(seenPath).toBe('node_modules');
  });

  it('never inserts an unsafe path from a file click', async () => {
    installProjectRoutes();
    const onInsertPath = vi.fn();
    wrap(
      <ProjectFilesDrawer projectId={3} isOpen onClose={vi.fn()} onInsertPath={onInsertPath} />,
    );
    await waitFor(() => expect(screen.getByText('README.md')).toBeTruthy());
    fireEvent.click(screen.getByText('src'));
    await waitFor(() => expect(screen.getByText('main.ts')).toBeTruthy());
    // Rows are validated upstream, and the boundary only forwards safe paths.
    fireEvent.click(screen.getByText('main.ts'));
    expect(onInsertPath).toHaveBeenCalledWith('src/main.ts');
    expect(onInsertPath.mock.calls.some(([p]: string[]) => !p.startsWith('src/'))).toBe(false);
  });

  it('closes via Escape through the shared dialog a11y', async () => {
    installProjectRoutes();
    const onClose = vi.fn();
    wrap(
      <ProjectFilesDrawer projectId={3} isOpen onClose={onClose} onInsertPath={vi.fn()} />,
    );
    await waitFor(() => expect(screen.getByRole('dialog', { name: '项目文件' })).toBeTruthy());
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('R5 consumer: callback-identity rerenders keep drawer focus contained; Escape closes; trigger restored', async () => {
    installProjectRoutes();
    function DrawerHarness() {
      const [isOpen, setIsOpen] = useState(false);
      const [tick, setTick] = useState(0);
      return (
        <>
          <button type="button" onClick={() => setIsOpen(true)}>
            open drawer
          </button>
          <button type="button" onClick={() => setTick((t) => t + 1)}>
            bump {tick}
          </button>
          {/* INLINE onClose: the ConversationPage consumer shape — each parent
              rerender hands the helper a NEW callback identity. */}
          <ProjectFilesDrawer
            projectId={3}
            isOpen={isOpen}
            onClose={() => setIsOpen(false)}
            onInsertPath={vi.fn()}
          />
        </>
      );
    }
    wrap(<DrawerHarness />);
    const trigger = screen.getByRole('button', { name: 'open drawer' });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: '项目文件' });
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));

    fireEvent.click(screen.getByRole('button', { name: /bump/ }));
    fireEvent.click(screen.getByRole('button', { name: /bump/ }));
    expect(dialog.contains(document.activeElement)).toBe(true);

    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '项目文件' })).toBeNull();
    });
    expect(document.activeElement).toBe(trigger);
  });
});
