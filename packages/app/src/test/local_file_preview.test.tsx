import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MessageContent } from '../features/chat/MessageContent';
import { parseLineRange } from '../features/chat/localFile/localFileLinks';
import { installFetch, jsonResponse, unmockFetch } from './helpers';

/**
 * #91 local file links: Markdown links to file:/// or drive paths become a
 * preview entry for persisted assistant messages, a copy-only path elsewhere;
 * the raw link target (backslash escapes, #L fragment) is posted verbatim.
 */

const PREVIEW_URL = '/api/agents/conversations/7/messages/42/local-file/';

function hrefPostedTo(calls: { url: URL; init?: RequestInit }[]): string {
  const call = calls.find((c) => c.url.pathname === PREVIEW_URL);
  return JSON.parse(String(call?.init?.body)).href;
}

function okPreview(content: string, extra: Record<string, unknown> = {}) {
  return () => jsonResponse({ name: 'views.py', content, size: content.length, truncated: false, ...extra });
}

const FORTY_LINES = Array.from({ length: 40 }, (_, i) => `line_${i + 1} = ${i + 1}`).join('\n') + '\n';

/** Highlighted code is split across hljs spans — match on the block's text. */
async function previewCodeText(): Promise<string> {
  let text = '';
  await waitFor(() => {
    const rows = screen.getByRole('dialog').querySelectorAll('.app-lfp-text');
    text = Array.from(rows, (row) => row.textContent ?? '').join('\n');
    expect(text).not.toBe('');
  });
  return text;
}

describe('MessageContent local file links (#91)', () => {
  afterEach(() => unmockFetch());

  it('renders a file:/// link as a preview entry and posts the raw href with #L', async () => {
    const raw = 'file:///D:/Alicia/ExoCore_Project/ExoCore/agents/views.py#L21-L40';
    const { calls } = installFetch([{ method: 'POST', test: PREVIEW_URL, handler: okPreview(FORTY_LINES) }]);
    render(<MessageContent content={`见 [views.py](${raw})`} conversationId={7} messageId={42} />);

    fireEvent.click(screen.getByRole('button', { name: /views\.py/ }));

    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(await previewCodeText()).toContain('line_21 = 21');
    expect(hrefPostedTo(calls)).toBe(raw);
    const hits = Array.from(document.querySelectorAll('.app-lfp-row--hit'), (row) => row.getAttribute('data-line'));
    expect(hits).toEqual(Array.from({ length: 20 }, (_, i) => String(21 + i)));
    // Every row carries its own number: gutter and text cannot drift apart.
    const row21 = document.querySelector('[data-line="21"]');
    expect(row21?.querySelector('.app-lfp-num')?.textContent).toBe('21');
    expect(row21?.querySelector('.app-lfp-text')?.textContent).toBe('line_21 = 21');
    expect(document.querySelectorAll('.app-lfp-row')).toHaveLength(40);
  });

  it('keeps Markdown backslash escapes in drive paths verbatim', async () => {
    const raw = 'D:\\_tmp\\a.py';
    const { calls } = installFetch([{ method: 'POST', test: PREVIEW_URL, handler: okPreview('x = 1\n') }]);
    render(<MessageContent content={`[a.py](${raw})`} conversationId={7} messageId={42} />);

    fireEvent.click(screen.getByRole('button', { name: /a\.py/ }));

    expect(await previewCodeText()).toContain('x = 1');
    expect(hrefPostedTo(calls)).toBe(raw);
  });

  it('shows the decoded path on the entry', () => {
    render(<MessageContent content="[notes](file:///D:/my%20dir/notes.md)" conversationId={7} messageId={42} />);
    expect(document.querySelector('[data-local-file]')?.getAttribute('data-local-file')).toBe('D:/my dir/notes.md');
  });

  it('opens without highlighted rows for reversed or out-of-range #L', async () => {
    installFetch([{ method: 'POST', test: PREVIEW_URL, handler: okPreview(FORTY_LINES) }]);
    render(
      <MessageContent content="[views.py](file:///D:/x/views.py#L40-L21)" conversationId={7} messageId={42} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /views\.py/ }));
    expect(await previewCodeText()).toContain('line_1 = 1');
    expect(document.querySelector('.app-lfp-row--hit')).toBeNull();
  });

  it('parses only valid in-range fragments', () => {
    expect(parseLineRange('D:/a.py#L21', 40)).toEqual({ start: 21, end: 21 });
    expect(parseLineRange('D:/a.py#L21-L40', 40)).toEqual({ start: 21, end: 21 + 19 });
    expect(parseLineRange('D:/a.py#L40-L21', 40)).toBeNull();
    expect(parseLineRange('D:/a.py#L41', 40)).toBeNull();
    expect(parseLineRange('D:/a.py#L0', 40)).toBeNull();
    expect(parseLineRange('D:/a.py#section', 40)).toBeNull();
    expect(parseLineRange('D:/a.py', 40)).toBeNull();
  });

  it.each([
    ['file_not_found', 404, '文件不存在或已移动'],
    ['unsupported_type', 422, '不支持预览此类型'],
    ['read_failed', 500, '读取失败'],
  ])('maps %s to its message and keeps copy path', async (code, status, text) => {
    installFetch([{ method: 'POST', test: PREVIEW_URL, handler: () => jsonResponse({ error_code: code }, status) }]);
    render(<MessageContent content="[a.py](D:/x/a.py)" conversationId={7} messageId={42} />);
    fireEvent.click(screen.getByRole('button', { name: /a\.py/ }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(text);
    const dialog = screen.getByRole('dialog');
    expect(dialog.querySelector('button[aria-label="复制路径"]')).not.toBeNull();
  });

  it('notes truncation and renders HTML files as source text', async () => {
    installFetch([
      {
        method: 'POST',
        test: PREVIEW_URL,
        handler: () =>
          jsonResponse({ name: 'page.html', content: '<script>alert(1)</script>\n', size: 26, truncated: true }),
      },
    ]);
    render(<MessageContent content="[page](D:/x/page.html)" conversationId={7} messageId={42} />);
    fireEvent.click(screen.getByRole('button', { name: /page/ }));

    expect(await screen.findByText('文件较大，仅显示前 1 MiB')).toBeTruthy();
    const dialog = screen.getByRole('dialog');
    await waitFor(() => expect(dialog.querySelector('pre code')?.textContent).toContain('<script>alert(1)</script>'));
    expect(dialog.querySelector('script')).toBeNull();
    expect(dialog.querySelector('iframe')).toBeNull();
  });

  it('is copy-only without ids (trace call sites) and hints while streaming', () => {
    const { rerender } = render(<MessageContent content="[a.py](D:/x/a.py)" />);
    expect(screen.queryByRole('button', { name: /a\.py/ })).toBeNull();
    expect(screen.getByRole('button', { name: '复制路径' })).toBeTruthy();
    expect(screen.queryByText('消息完成后可预览')).toBeNull();

    rerender(<MessageContent content="[a.py](D:/x/a.py)" localFilePending />);
    expect(screen.getByText('消息完成后可预览')).toBeTruthy();
  });

  it('does not turn raw HTML file anchors into preview entries', () => {
    const { container } = render(
      <MessageContent content={'<a href="file:///D:/x/a.py">raw</a>'} conversationId={7} messageId={42} />,
    );
    expect(container.querySelector('[data-local-file]')).toBeNull();
    expect(container.querySelector('a')?.getAttribute('href') ?? null).toBeNull();
  });

  it('copies the decoded path without the #L fragment', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<MessageContent content="[n](file:///D:/my%20dir/notes.md#L3-L5)" />);

    fireEvent.click(screen.getByRole('button', { name: '复制路径' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('D:/my dir/notes.md'));
    expect(await screen.findByRole('button', { name: '已复制路径' })).toBeTruthy();
  });

  it('shows an explicit failure with a selectable path when copy is rejected', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<MessageContent content={'[a.py](D:\\x\\a.py#L2)'} />);

    fireEvent.click(screen.getByRole('button', { name: '复制路径' }));

    const status = await screen.findByRole('status');
    expect(status.textContent).toContain('复制失败，请手动选择路径');
    expect(status.querySelector('.app-localfile-path-text')?.textContent).toBe('D:\\x\\a.py');
  });

  it.each([
    ['deploy.ps1', 'Write-Host "hi"\n'],
    ['run.bat', '@echo off\nset X=1\n'],
  ])('highlights Windows script %s', async (name, content) => {
    installFetch([
      {
        method: 'POST',
        test: PREVIEW_URL,
        handler: () => jsonResponse({ name, content, size: content.length, truncated: false }),
      },
    ]);
    render(<MessageContent content={`[s](D:/x/${name})`} conversationId={7} messageId={42} />);
    fireEvent.click(screen.getByRole('button', { name: /s/ }));

    await previewCodeText();
    const pre = screen.getByRole('dialog').querySelector('pre');
    expect(pre?.classList.contains('hljs')).toBe(true);
    expect(pre?.querySelector('.app-lfp-text [class^="hljs-"]')).not.toBeNull();
  });

  it('scrolls to the measured position of the start row', async () => {
    const offsetTop = vi
      .spyOn(HTMLElement.prototype, 'offsetTop', 'get')
      .mockImplementation(function (this: HTMLElement) {
        return Number(this.dataset.line ?? 0) * 31;
      });
    installFetch([{ method: 'POST', test: PREVIEW_URL, handler: okPreview(FORTY_LINES) }]);
    render(<MessageContent content="[v.py](D:/x/v.py#L30)" conversationId={7} messageId={42} />);
    fireEvent.click(screen.getByRole('button', { name: /v\.py/ }));
    await previewCodeText();
    expect(screen.getByTestId('local-file-scroll').scrollTop).toBe(30 * 31);
    offsetTop.mockRestore();
  });

  it('keeps multi-line highlight spans balanced per row', async () => {
    const content = 'x = """first\nsecond"""\ny = 1\n';
    installFetch([
      {
        method: 'POST',
        test: PREVIEW_URL,
        handler: () => jsonResponse({ name: 'm.py', content, size: content.length, truncated: false }),
      },
    ]);
    render(<MessageContent content="[m.py](D:/x/m.py#L2)" conversationId={7} messageId={42} />);
    fireEvent.click(screen.getByRole('button', { name: /m\.py/ }));
    expect(await previewCodeText()).toBe('x = """first\nsecond"""\ny = 1');
    const row2 = document.querySelector('[data-line="2"] .app-lfp-text');
    expect(row2?.querySelector('.hljs-string')?.textContent).toBe('second"""');
    expect(document.querySelectorAll('.app-lfp-row')).toHaveLength(3);
    expect(document.querySelector('[data-line="2"]')?.classList.contains('app-lfp-row--hit')).toBe(true);
  });

  it('leaves http links and images unchanged', () => {
    const { container } = render(
      <MessageContent
        content={'[site](https://example.com/a) ![pic](https://example.com/p.png)'}
        conversationId={7}
        messageId={42}
      />,
    );
    expect(container.querySelector('a')?.getAttribute('href')).toBe('https://example.com/a');
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://example.com/p.png');
    expect(container.querySelector('[data-local-file]')).toBeNull();
  });
});
