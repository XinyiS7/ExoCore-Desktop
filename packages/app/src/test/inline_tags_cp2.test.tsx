import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { parseInlineTags, type InlineTag } from '../features/chat/inlineTags/parse';
import { normalizeMessageRow, normalizePins } from '../features/chat/api';
import { MessageContent } from '../features/chat/MessageContent';
import type { MessageRow } from '../features/chat/types';
import cases from './fixtures/inline_tag_parser_cases.json';
import { installRuntimeFetch, jsonResponse, renderApp, renderV4, unmockFetch } from './helpers';

/**
 * #130 CP2 — shared parser table, `inline_rolls` chip mapping and the
 * conversation sticky-note board (D-F).
 */

type BackendTag = { kind: string; index: number; start: number; raw: string } & Record<string, unknown>;

/** The backend's snake-case params for one frontend tag. */
function asBackend(tag: InlineTag): Record<string, unknown> {
  if (tag.kind === 'timer_fired') return { kind: tag.kind, title: tag.title, fire_at: tag.fireAt };
  return { ...tag };
}

describe('shared parser case table (backend inline_tags/tests/parser_cases.json)', () => {
  it.each((cases as { name: string; input: string; tags: BackendTag[] }[]).map((c) => [c.name, c] as const))(
    '%s',
    (_name, c) => {
      const got = parseInlineTags(c.input).flatMap((s) =>
        s.type === 'tag' ? [{ index: s.index, start: s.start, raw: s.raw, ...asBackend(s.tag) }] : [],
      );
      expect(got).toEqual(c.tags);
    },
  );

  it('numeric attributes are digits only, as on the backend', () => {
    const kinds = (text: string) => parseInlineTags(text).flatMap((s) => (s.type === 'tag' ? [s.tag.kind] : []));
    expect(kinds('<unpin id=0x10> <unpin id=1e2> <unpin id=+3>')).toEqual([]);
    expect(kinds('<roll_result expr="1d4" by="user" dice="1.0" total="1">')).toEqual([]);
    expect(kinds('<roll_result expr="1d4" by="user" dice="2" total=" 2">')).toEqual([]);
    expect(kinds('<roll_result expr="1d4-5" by="user" dice="2" total="-3">')).toEqual(['roll_result']);
  });
});

const row = (over: Partial<MessageRow>): MessageRow => ({
  id: 1,
  role: 'assistant',
  content: '',
  reasoning_content: null,
  platform: 'test',
  model_version: null,
  token_count: null,
  index_in_session: 0,
  attachment_ids: [],
  attachments_meta: null,
  created_at: '2026-11-13T15:00:00Z',
  ...over,
});

describe('inline_rolls', () => {
  it('normalizes fail-closed and only for assistant rows', () => {
    const rolls = [
      { tag_index: 1, expression: '2d6', dice: [3, 5], total: 8 },
      { tag_index: 'x', expression: '1d4', dice: [1], total: 1 },
      { tag_index: 2, expression: '1d4', dice: [1.5], total: 1 },
    ];
    expect(normalizeMessageRow(row({ inline_rolls: rolls })).inlineRolls).toEqual([
      { tagIndex: 1, expression: '2d6', dice: [3, 5], total: 8 },
    ]);
    expect(normalizeMessageRow(row({ role: 'user', inline_rolls: rolls })).inlineRolls).toEqual([]);
    expect(normalizeMessageRow(row({})).inlineRolls).toEqual([]);
  });

  it('matches each <roll> chip to its result by tag index', () => {
    const { container } = renderV4(
      <MessageContent
        content="<pin>x</pin>先<roll=2d6>再<roll=1d20+2>最后<roll=1d4>"
        inlineTags="assistant"
        inlineRolls={[
          { tagIndex: 1, expression: '2d6', dice: [3, 5], total: 8 },
          { tagIndex: 2, expression: '1d20+2', dice: [17], total: 19 },
        ]}
      />,
    );
    const chips = [...container.querySelectorAll('.app-itag-chip')].map((c) => c.textContent);
    expect(chips).toEqual(['2d6 → 3, 5 = 8', '1d20+2 → 17 = 19', '1d4']);
  });

  it('a user roll shows one chip: the backend-written result', () => {
    // A bare roll (no adjacent result, e.g. never sent) still shows its own chip.
    const bare = renderV4(<MessageContent content={'<roll=1d6> <roll_result expr="1d6" by="user" dice="2" total="2">'} inlineTags="user" />);
    expect(bare.container.querySelectorAll('.app-itag-chip')).toHaveLength(2);
    const { container } = renderV4(
      <MessageContent
        content={'我来 <roll=1d20><roll_result expr="1d20" by="user" dice="7" total="7"> 看看\n\n<roll_result expr="2d6" by="assistant" dice="3,5" total="8">'}
        inlineTags="user"
      />,
    );
    const chips = [...container.querySelectorAll('.app-itag-chip')].map((c) => c.textContent);
    expect(chips).toEqual(['1d20 → 7 = 7', '2d6 → 3, 5 = 8']);
    expect(container.textContent).toContain('我来 ');
  });
});

describe('normalizePins', () => {
  it('reads inline_state.pins and drops malformed items', () => {
    expect(
      normalizePins({
        pins: [
          { id: 3, content: '带伞', author: 'user', created_at: '2026-11-13T15:00:00Z' },
          { id: 4, content: '坏的', author: 'system', created_at: '2026-11-13T15:00:00Z' },
        ],
      }),
    ).toEqual([{ id: 3, content: '带伞', author: 'user', createdAt: '2026-11-13T15:00:00Z' }]);
    expect(normalizePins(undefined)).toEqual([]);
  });
});

const PRESET = {
  id: 5,
  name: 'Ecki',
  description: null,
  agent_type: 'standard',
  default_model: 'deepseek-v4-flash',
  system_prompt: null,
  is_visible: true,
};

const conversation = (pins: unknown[]) => ({
  id: 60,
  name: 'conv 60',
  created_at: '2026-09-01T10:00:00Z',
  frozen_project_ids: [],
  project: 0,
  project_name: null,
  agent_type: 'standard',
  agent_preset_id: 5,
  last_message_at: '2026-09-01T10:00:00Z',
  thinking_level: 'auto',
  memory_injection_enabled: null,
  is_prime: false,
  inline_state: { pins },
});

const pin = (id: number, content: string, author = 'user') => ({
  id,
  content,
  author,
  created_at: '2026-11-13T15:00:00Z',
});

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  unmockFetch();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('sticky-note board', () => {
  it('renders active pins as paper notes outside the message stream; × deletes and re-reads', async () => {
    let pins = [pin(7, '周五交稿', 'assistant'), pin(8, '带伞')];
    const { calls } = installRuntimeFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET]) },
      {
        test: '/api/agents/conversations/60/pins/7/',
        method: 'DELETE',
        handler: () => {
          pins = pins.filter((p) => p.id !== 7);
          return jsonResponse(null, 204);
        },
      },
      { test: '/api/agents/conversations/60/', handler: () => jsonResponse(conversation(pins)) },
      {
        test: '/api/agents/chat/60/',
        handler: () =>
          jsonResponse({
            messages: [{ ...row({ id: 900, content: '好的<pin>周五交稿</pin>' }), index_in_session: 0 }],
            total_count: 1,
            has_more: false,
          }),
      },
    ]);
    renderApp(['/chat/60']);

    const board = await screen.findByRole('complementary', { name: '会话便签' });
    const notes = board.querySelectorAll('.app-itag-note');
    expect([...notes].map((n) => n.querySelector('.app-itag-note-body')?.textContent)).toEqual(['周五交稿', '带伞']);
    expect(within(notes[0] as HTMLElement).getByText('Ecki')).toBeInTheDocument();
    expect(within(notes[1] as HTMLElement).getByText('我')).toBeInTheDocument();
    // Outside the timeline scroll owner and not a message card.
    expect(board.closest('.app-scroll')).toBeNull();
    expect(board.closest('article')).toBeNull();
    await screen.findByText('好的');
    expect(document.querySelector('.app-scroll')?.textContent).not.toContain('周五交稿');

    fireEvent.click(within(board).getByRole('button', { name: '取消便签：周五交稿' }));
    await waitFor(() =>
      expect(calls.some((c) => c.init?.method === 'DELETE' && c.url.pathname.endsWith('/pins/7/'))).toBe(true),
    );
    await waitFor(() => expect(within(board).queryByText('周五交稿')).toBeNull());
    expect(within(board).getByText('带伞')).toBeInTheDocument();
  });

  it('no pins, no board', async () => {
    installRuntimeFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET]) },
      { test: '/api/agents/conversations/60/', handler: () => jsonResponse(conversation([])) },
      { test: '/api/agents/chat/60/', handler: () => jsonResponse({ messages: [], total_count: 0, has_more: false }) },
    ]);
    renderApp(['/chat/60']);
    await screen.findByText('还没有消息');
    expect(screen.queryByRole('complementary', { name: '会话便签' })).toBeNull();
  });

  it('re-reads the conversation detail when a turn settles, so a new pin appears', async () => {
    let pins: unknown[] = [];
    let finishTurn: () => void = () => undefined;
    const enc = new TextEncoder();
    installRuntimeFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET]) },
      { test: '/api/agents/conversations/60/', handler: () => jsonResponse(conversation(pins)) },
      {
        test: '/api/agents/chat/60/',
        method: 'POST',
        handler: () =>
          new Response(
            new ReadableStream({
              start(controller) {
                controller.enqueue(enc.encode('event: content\ndata: 记下了\n\n'));
                finishTurn = () => {
                  controller.enqueue(enc.encode('event: done\ndata: [DONE]\n\n'));
                  controller.close();
                };
              },
            }),
            { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
          ),
      },
      { test: '/api/agents/chat/60/', handler: () => jsonResponse({ messages: [], total_count: 0, has_more: false }) },
    ]);
    renderApp(['/chat/60']);
    const textbox = await screen.findByRole('textbox', { name: /消息输入框/ });
    fireEvent.change(textbox, { target: { value: '<pin>带伞</pin>' } });
    fireEvent.keyDown(textbox, { key: 'Enter', shiftKey: true });
    await screen.findByText('记下了');

    pins = [pin(9, '带伞')];
    finishTurn();
    const board = await screen.findByRole('complementary', { name: '会话便签' });
    expect(within(board).getByText('带伞')).toBeInTheDocument();
  });
});

const arrivalFrame = (messageId: number) => ({
  kind: 'assistant-message-arrived',
  version: 1,
  event_id: 11,
  dedupe_key: `assistant-message:${messageId}`,
  conversation_id: 60,
  message_id: messageId,
  agent: { id: 5, name: 'Ecki' },
  preview: { policy: 'bounded_text', text: '好的', truncated: false },
  target: { kind: 'conversation_message', conversation_id: 60, message_id: messageId },
  register_ack: null,
  ignore: { allowed: false },
  title_hint: null,
  committed_at: '2026-11-13T15:00:00Z',
});

describe('sticky-note board — out-of-band arrival reconciliation (CP2-F01)', () => {
  it('the arrival fresh window also re-reads detail: mixed and pure-pin replies reach the board', async () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    let arrived = false;
    let detailReads = 0;
    let windowReads = 0;
    const msg = (id: number, role: string, content: string, index: number) => ({
      ...row({ id, role: role as MessageRow['role'], content }),
      index_in_session: index,
    });
    installRuntimeFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET]) },
      {
        test: '/api/agents/conversations/60/',
        handler: () => {
          detailReads += 1;
          return jsonResponse(conversation(arrived ? [pin(21, '周五交稿', 'assistant'), pin(22, '带伞', 'assistant')] : []));
        },
      },
      {
        test: '/api/agents/chat/60/',
        handler: () => {
          windowReads += 1;
          const base = [msg(800, 'user', '旧的问题', 0), msg(801, 'assistant', '旧的回答', 1)];
          return jsonResponse({
            messages: arrived
              ? [
                  ...base,
                  // Pure pin: no row of its own (CP1), only the board shows it.
                  msg(802, 'assistant', '<pin>周五交稿</pin>', 2),
                  msg(803, 'assistant', '好的<pin>带伞</pin>', 3),
                ]
              : base,
            total_count: arrived ? 4 : 2,
            has_more: false,
          });
        },
      },
      {
        test: '/api/push/assistant-arrivals/',
        handler: (url) =>
          url.searchParams.get('after') === null
            ? jsonResponse({ events: [], next_cursor: 10, has_more: false })
            : jsonResponse(
                arrived ? { events: [arrivalFrame(803)], next_cursor: 11, has_more: false } : { events: [], next_cursor: 10, has_more: false },
              ),
      },
    ]);

    renderApp(['/chat/60']);
    await screen.findByText('旧的回答');
    expect(screen.queryByRole('complementary', { name: '会话便签' })).toBeNull();
    const detailBefore = detailReads;
    const windowBefore = windowReads;

    arrived = true;
    document.dispatchEvent(new Event('visibilitychange'));

    const board = await screen.findByRole('complementary', { name: '会话便签' });
    expect([...board.querySelectorAll('.app-itag-note-body')].map((n) => n.textContent)).toEqual(['周五交稿', '带伞']);
    expect(windowReads).toBeGreaterThan(windowBefore);
    expect(detailReads).toBeGreaterThan(detailBefore);
    await screen.findByText('好的');
    expect(document.querySelector('[data-message-id="802"]')).toBeNull();
    expect(document.querySelector('.app-scroll')?.textContent).not.toContain('周五交稿');
  });
});
