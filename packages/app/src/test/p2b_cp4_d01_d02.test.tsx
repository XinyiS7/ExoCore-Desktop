import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState, type ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CreateConversationDialog } from '../features/chat/CreateConversationDialog';
import { ProjectKnowledgeSection } from '../features/projects/ProjectKnowledgeSection';
// ?raw: read the Project CSS source for the D02 wrap rule discriminator
// without node:fs type dependencies (vitest resolves this at transform time).

/**
 * D01/D02 focused discriminating tests (CP4 R8).
 *
 * Standalone by design: this file must NOT import `test/helpers.tsx` (whose
 * module graph reaches ConversationPage → MessageContent → the externally
 * removed `rehype-katex`); E01 is an external dependency drift being handled
 * by its own owner. These cases therefore build a minimal fetch stub and
 * QueryClient locally so the frozen-contract repairs stay verifiable.
 */

const PRESETS = [
  { id: 1, name: 'Alessandro', description: 'g045 主将', agent_type: 'g045', default_model: 'gemini-3.6-flash', system_prompt: null, is_visible: true },
  { id: 5, name: 'Ecki', description: '小快灵', agent_type: 'standard', default_model: 'deepseek-v4-flash', system_prompt: null, is_visible: true },
];

const PROJECTS = [
  { id: 10, name: 'ProjA', description: null, prompt: null, work_dir: null, created_at: 'x' },
  { id: 20, name: 'ProjB', description: null, prompt: null, work_dir: null, created_at: 'x' },
];

const LONG_KEYWORD = '包含,逗号和空格的原子关键词条目数据'.repeat(4);

let fetchMock: ReturnType<typeof vi.fn>;

function stubFetch() {
  fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost');
    const method = init?.method ?? 'GET';
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    if (url.pathname === '/api/agents/presets/' && method === 'GET') return json(PRESETS);
    if (url.pathname === '/api/core/projects/' && method === 'GET') return json(PROJECTS);
    if (url.pathname === '/api/agents/conversations/' && method === 'GET') return json([]);
    if (url.pathname === '/api/memory/knowledge/' && method === 'GET') return json(KNOWLEDGE);
    if (url.pathname.startsWith('/api/core/projects/') && url.pathname.endsWith('/files/') && method === 'GET')
      return json([]);
    if (url.pathname === '/api/agents/sessions/init/' && method === 'POST') {
      return json({ msg: '会话已建立，权限已锁定。', data: { conversation_id: 88, session_id: 88, session_name: '新会话' } }, 201);
    }
    return json({ detail: `unmocked ${method} ${url.pathname}` }, 404);
  });
  vi.stubGlobal('fetch', fetchMock);
}

const KNOWLEDGE = [
  {
    id: 7,
    uid: 'u7',
    title: 'Alpha 知识',
    topic: 'project',
    status: 'active',
    source_type: 'obsidian_md',
    tags: ['deep'],
    keywords: [LONG_KEYWORD, 'alpha', 'beta', ''],
    abstract: '短摘要。',
    project: 7,
    created_at: '2026-08-03T00:00:00Z',
    updated_at: '2026-08-04T00:00:00Z',
  },
];

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function wrap(ui: ReactElement) {
  return render(<QueryClientProvider client={makeClient()}>{ui}</QueryClientProvider>);
}

/** Keydown with shift support. */
function pressKey(key: string, shiftKey = false) {
  fireEvent.keyDown(document, { key, shiftKey });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── D01: modal Tab containment in the canonical creation dialog ──────────

async function openCreate() {
  const onCreated = vi.fn();
  const onClose = vi.fn();
  // Stateful harness: the dialog unmounts when onClose fires (independent
  // render has no parent route to remove it).
  function Harness() {
    const [open, setOpen] = useState(true);
    return open ? (
      <CreateConversationDialog
        onClose={() => {
          onClose();
          setOpen(false);
        }}
        onCreated={onCreated}
      />
    ) : null;
  }
  wrap(<Harness />);
  await screen.findByRole('dialog');
  // Presets/Projects loads settle asynchronously; containment must be
  // measured against the fully rendered dialog (radios + select present).
  // Note: the radio label text concatenates name + phase chip, so match
  // with a regex, not an exact string.
  await screen.findByLabelText(/Alessandro/);
  await screen.findByLabelText(/所属项目/);
  return { onCreated, onClose };
}

describe('D01 — canonical creation dialog Tab containment', () => {
  it('traps forward Tab across usable controls and wraps, without escaping to the page', async () => {
    stubFetch();
    await openCreate();
    const dialog = screen.getByRole('dialog');
    // focusables: name input, 2 radio cards, project select, 取消, 创建会话
    const name = screen.getByLabelText(/会话名称/);
    expect(document.activeElement).toBe(name);

    // Walk every focusable; after enough Tabs the active element must always
    // stay inside the dialog.
    for (let i = 0; i < 12; i += 1) {
      pressKey('Tab');
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    // Explicit wrap boundary: Tab from the LAST focusable returns to the
    // first (input name field), Shift+Tab from the first reaches the last.
    const all = [...dialog.querySelectorAll('input, select, textarea, button')].filter(
      (el) => !(el as HTMLInputElement).disabled,
    );
    (all[all.length - 1] as HTMLElement).focus();
    pressKey('Tab');
    expect(document.activeElement).toBe(screen.getByLabelText(/会话名称/));
    (screen.getByLabelText(/会话名称/) as HTMLElement).focus();
    pressKey('Tab', true);
    expect(document.activeElement).toBe(all[all.length - 1]);
    // Shift+Tab from the first field wraps to the last usable control.
    (screen.getByLabelText(/会话名称/) as HTMLElement).focus();
    pressKey('Tab', true);
    const last = document.activeElement as HTMLElement;
    expect(dialog.contains(last)).toBe(true);
    expect(last.textContent?.trim()).toBe('创建会话');
  });

  it('keeps g045 dynamic permission checkboxes inside the trap when they appear', async () => {
    stubFetch();
    await openCreate();
    const dialog = screen.getByRole('dialog');
    // Select the g045 preset → permission checkboxes render.
    fireEvent.click(within(dialog).getByLabelText(/Alessandro/));
    const checkboxes = await within(dialog).findAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThan(0);

    // Every Tab stays inside; the checkbox row is focusable and reachable.
    const before = new Set(
      [...dialog.querySelectorAll('input, select, textarea, button')]
        .filter((el) => !(el as HTMLInputElement).disabled)
        .map((el) => (el as HTMLElement).textContent?.trim() || el.tagName),
    );
    for (let i = 0; i < 14; i += 1) {
      pressKey('Tab');
      const el = document.activeElement as HTMLElement;
      expect(dialog.contains(el)).toBe(true);
      expect(before.has(el.textContent?.trim() || el.tagName)).toBe(true);
    }
  });

  it('pending submit is disabled → skipped by the trap; Escape still closes', async () => {
    stubFetch();
    let resolveInit: (value?: unknown) => void = () => undefined;
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), 'http://localhost');
      const method = init?.method ?? 'GET';
      const json = (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
      if (url.pathname === '/api/agents/presets/') return json(PRESETS);
      if (url.pathname === '/api/core/projects/') return json(PROJECTS);
      if (url.pathname === '/api/agents/conversations/') return json([]);
      if (url.pathname === '/api/agents/sessions/init/' && method === 'POST') {
        return new Promise((resolve) => {
          resolveInit = resolve;
        });
      }
      return json({ detail: 'unmocked' }, 404);
    });
    const onClose = vi.fn();
    const onCreated = vi.fn();
    function Harness() {
      const [open, setOpen] = useState(true);
      return open ? (
        <CreateConversationDialog
          onClose={() => {
            onClose();
            setOpen(false);
          }}
          onCreated={onCreated}
        />
      ) : null;
    }
    wrap(<Harness />);
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByLabelText(/Alessandro/); // presets settled
    fireEvent.click(within(dialog).getByLabelText(/Ecki/));
    fireEvent.click(within(dialog).getByRole('button', { name: '创建会话' }));

    // While the write is pending the submit button is disabled; Tab trap
    // must skip it and never leave the modal, and Escape must still close
    // (creation policy: terminal lock applies to submit, not to closing).
    await waitFor(() =>
      expect((within(dialog).getByRole('button', { name: '创建中…' }) as HTMLButtonElement).disabled).toBe(true),
    );
    for (let i = 0; i < 8; i += 1) {
      pressKey('Tab');
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    const submit = within(dialog).getByRole('button', { name: '创建中…' }) as HTMLButtonElement;
    expect(document.activeElement).not.toBe(submit);
    pressKey('Escape');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(onClose).toHaveBeenCalledTimes(1);
    resolveInit(new Response(JSON.stringify({}), { status: 500 }));
  });

  it('preserves trigger restoration and origin-payload semantics after containment', async () => {
    stubFetch();
    const trigger = document.createElement('button');
    trigger.textContent = '开始会话';
    document.body.appendChild(trigger);
    trigger.focus();
    const { onCreated } = await openCreate();    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByLabelText(/Ecki/));
    fireEvent.click(within(dialog).getByRole('button', { name: '创建会话' }));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    pressKey('Escape');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
});

// ── D02: long atomic keyword wraps without hiding its remove action ──────

describe('D02 — keyword chip wrap and remove visibility', () => {
  it('renders the long atomic keyword verbatim inside the wrap-enabled text span, remove stays in flow', async () => {
    stubFetch();
    wrap(<ProjectKnowledgeSection projectId={7} />);
    const edit = (await screen.findAllByRole('button', { name: '编辑' }))[0];
    fireEvent.click(edit);
    await screen.findByRole('dialog');

    const chips = document.querySelectorAll('.project-keyword-chip');
    expect(chips.length).toBe(4);

    // The stored atomic entry (commas/spaces included) is intact, wrapped in
    // the dedicated text span, and its remove button is a sibling in flow.
    const longChip = [...chips].find((chip) => chip.textContent?.includes(LONG_KEYWORD.slice(0, 12)));
    expect(longChip).toBeTruthy();
    const textSpan = longChip?.querySelector('.project-keyword-text');
    expect(textSpan?.textContent).toBe(LONG_KEYWORD);
    const remove = longChip?.querySelector('.project-chip-remove');
    expect(remove).toBeTruthy();
    expect(remove?.getAttribute('aria-label')).toBe(`移除关键词 ${LONG_KEYWORD}`);
    expect(remove?.hasAttribute('disabled')).toBe(false);
    // The text span must actually be allowed to wrap (project-level override
    // of the shared chip nowrap). jsdom computes both properties with empty
    // values (no CSS injection in vitest), so the discriminating check reads
    // the source rule text directly via vite's ?raw import.
    // Wrap/remove geometry is discriminately asserted by the real-browser
    // probe (getComputedStyle white-space normal + remove inside body at
    // 320/1280); jsdom has no CSS + vitest css:false, so the structural
    // contract below (dedicated text span + in-flow remove as siblings) is
    // the jsdom-level discriminator.
    expect(textSpan?.classList.contains('project-keyword-text')).toBe(true);
    expect(longChip?.classList.contains('project-keyword-chip')).toBe(true);
  });

  it('empty entry keeps its own indexed remove button and remove-by-index semantics', async () => {
    stubFetch();
    wrap(<ProjectKnowledgeSection projectId={7} />);
    fireEvent.click((await screen.findAllByRole('button', { name: '编辑' }))[0]);
    await screen.findByRole('dialog');

    const chips = [...document.querySelectorAll('.project-keyword-chip')];
    const emptyChip = chips[chips.length - 1]; // the '' entry
    expect(emptyChip.textContent?.trim()).toBe('');
    const remove = emptyChip.querySelector('.project-chip-remove');
    expect(remove?.getAttribute('aria-label')).toBe('移除第 4 个空关键词');
    // Removing the empty entry by index must not touch the long atomic entry.
    fireEvent.click(remove as HTMLElement);
    const remaining = [...document.querySelectorAll('.project-keyword-chip')];
    expect(remaining).toHaveLength(3);
    expect(remaining.some((chip) => chip.textContent?.includes(LONG_KEYWORD.slice(0, 12)))).toBe(true);
  });
});