import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageTimeline } from '../features/chat/MessageTimeline';
import { parseInlineTags } from '../features/chat/inlineTags/parse';
import { applyPointerSweep, applyTrayImpulse, createPhysicsDie, stepDiceWorld } from '../features/chat/inlineTags/dicePhysics';
import { buildPendingDiceState, formatDiceExpr } from '../features/chat/inlineTags/diceTypes';
import { assemblePinTag, hasUnsafePinClose, normalizePinColor } from '../features/chat/inlineTags/pinColors';
import type { MessageView } from '../features/chat/types';
import { installRuntimeFetch, jsonResponse, renderApp, renderV4, unmockFetch } from './helpers';

const PRESET = {
  id: 5,
  name: 'Ecki',
  description: null,
  agent_type: 'standard',
  default_model: 'deepseek-v4-flash',
  system_prompt: null,
  is_visible: true,
};

const CATALOG = {
  endpoints: [
    {
      id: 1,
      name: 'Direct',
      platform: 'deepseek',
      models: ['deepseek-v4-flash'],
      capabilities: { supports_audio: false, supports_force_cache: true },
    },
  ],
};

function makeConv(overrides: Record<string, unknown> = {}) {
  return {
    id: 60,
    name: 'conv 60',
    created_at: '2026-11-14T10:00:00Z',
    frozen_project_ids: [],
    project: 0,
    project_name: null,
    agent_type: 'standard',
    agent_preset_id: 5,
    last_message_at: '2026-11-14T10:00:00Z',
    thinking_level: 'auto',
    memory_injection_enabled: null,
    is_prime: false,
    inline_state: { pins: [] },
    ...overrides,
  };
}

function makeMsgRow(id: number, role: MessageView['role'], content: string, extra: Partial<MessageView> = {}): MessageView {
  return {
    id,
    role,
    content,
    reasoningContent: null,
    clientTurnId: null,
    platform: 'test',
    modelVersion: null,
    tokenCount: null,
    indexInSession: id,
    attachmentIds: [],
    attachmentsMeta: null,
    createdAt: '2026-11-14T10:00:00Z',
    ...extra,
  } as MessageView;
}

describe('pinColors & diceTypes utilities', () => {
  it('parses <pin color="..."> and falls back unknown colors safely', () => {
    const segs = parseInlineTags('<pin color="crimson">夜巡</pin><pin color="unknown">备用</pin><pin>默认</pin>');
    const pins = segs.flatMap((s) => (s.type === 'tag' && s.tag.kind === 'pin' ? [s.tag] : []));
    expect(pins).toEqual([
      { kind: 'pin', body: '夜巡', closed: true, color: 'crimson' },
      { kind: 'pin', body: '备用', closed: true, color: 'butter' },
      { kind: 'pin', body: '默认', closed: true },
    ]);
    expect(normalizePinColor('lavender')).toBe('lavender');
    expect(normalizePinColor('invalid')).toBe('butter');
    expect(assemblePinTag({ body: ' 取件 ', color: 'butter' })).toBe('<pin>取件</pin>');
    expect(assemblePinTag({ body: ' 警报 ', color: 'crimson' })).toBe('<pin color="crimson">警报</pin>');
    expect(hasUnsafePinClose('hello </pin> world')).toBe(true);
    expect(hasUnsafePinClose('hello </PIN > world')).toBe(true);
  });

  it('orders dice terms canonically and steps 2D physics deterministically', () => {
    const dice = [
      { id: '1', faces: 6 as const },
      { id: '2', faces: 20 as const },
      { id: '3', faces: 6 as const },
    ];
    expect(formatDiceExpr(dice, 3)).toBe('1d20+2d6+3');
    expect(formatDiceExpr([{ faces: 8 as const }], -2)).toBe('1d8-2');
    expect(buildPendingDiceState(dice, 120)?.modifier).toBe(99);

    const bounds = { width: 300, height: 150, padding: 10 };
    const body = createPhysicsDie('d1', 20, bounds, { x: 150, y: 75, vx: 180, vy: -90 });
    const swept = applyPointerSweep([body], 100, 75, 160, 75, 0.016);
    expect(swept[0].settled).toBe(false);
    const shaken = applyTrayImpulse(swept, 50, -40);
    let current = shaken;
    for (let i = 0; i < 120; i += 1) {
      current = stepDiceWorld(current, bounds, 0.03);
    }
    expect(current[0].settled).toBe(true);
    expect(current[0].x).toBeGreaterThanOrEqual(bounds.padding + current[0].radius);
    expect(current[0].x).toBeLessThanOrEqual(bounds.width - bounds.padding - current[0].radius);
  });
});

describe('TimerHourglass SVG & timeline expiration fallback', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders historical expired timers as settled emptied hourglasses with zero active ticks', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-14T12:00:00Z'));

    const { container } = renderV4(
      <MessageTimeline
        conversationId={1}
        hasOlder={false}
        loadingMore={false}
        onLoadMore={() => {}}
        messages={[
          makeMsgRow(1, 'assistant', '<timer=60s title="热牛奶">', {
            createdAt: '2026-11-14T10:00:00Z',
          }),
        ]}
      />,
    );

    const chip = container.querySelector('[data-itag="timer"]');
    expect(chip).not.toBeNull();
    expect(chip?.getAttribute('data-timer-state')).toBe('done');
    expect(chip?.querySelector('svg')).not.toBeNull();
    expect(chip?.textContent).toBe('已结束 · 热牛奶');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('settles an unexpired timer immediately when a later message cancels or fires it', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-14T12:00:00Z'));

    const { container } = renderV4(
      <MessageTimeline
        conversationId={1}
        hasOlder={false}
        loadingMore={false}
        onLoadMore={() => {}}
        messages={[
          makeMsgRow(1, 'assistant', '<timer=120s title="煮茶">', {
            createdAt: '2026-11-14T11:59:30Z',
          }),
          makeMsgRow(2, 'assistant', '<timer cancel="煮茶"> 先不煮了', {
            createdAt: '2026-11-14T11:59:45Z',
          }),
        ]}
      />,
    );

    const chips = container.querySelectorAll('[data-itag="timer"]');
    expect(chips).toHaveLength(1);
    expect(chips[0].getAttribute('data-timer-state')).toBe('cancelled');
    expect(chips[0].textContent).toBe('已取消 · 煮茶');
  });

  it('ticks active timers down every second and settles cleanly at zero', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-14T12:00:00Z'));

    const { container } = renderV4(
      <MessageTimeline
        conversationId={1}
        hasOlder={false}
        loadingMore={false}
        onLoadMore={() => {}}
        messages={[
          makeMsgRow(1, 'assistant', '<timer=3s title="呼吸">', {
            createdAt: '2026-11-14T12:00:00Z',
          }),
        ]}
      />,
    );

    const chip = container.querySelector('[data-itag="timer"]');
    expect(chip?.getAttribute('data-timer-state')).toBe('running');
    expect(chip?.textContent).toBe('倒计时 00:03 · 呼吸');

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(chip?.textContent).toBe('倒计时 00:02 · 呼吸');

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(chip?.getAttribute('data-timer-state')).toBe('done');
    expect(chip?.textContent).toBe('已结束 · 呼吸');
  });
});

describe('Composer Toy Drawer, Draft Pins, Dice Send Gating & Probe Integration', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    unmockFetch();
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('supports WYSIWYG multicolor pins: </pin> guard, outside blur-commit, re-edit, send without text, and no Snowflake', async () => {
    const sentBodies: string[] = [];
    installRuntimeFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET]) },
      { test: '/api/models/catalog/', handler: () => jsonResponse(CATALOG) },
      { test: '/api/agents/conversations/60/', handler: () => jsonResponse(makeConv()) },
      {
        test: '/api/agents/chat/60/',
        method: 'POST',
        handler: async (url, init) => {
          void url;
          const parsed = JSON.parse(String(init?.body ?? '{}'));
          sentBodies.push(parsed.content);
          return jsonResponse({ staged: true }, 202);
        },
      },
      { test: '/api/agents/chat/60/', handler: () => jsonResponse({ messages: [], total_count: 0, has_more: false }) },
    ]);

    renderApp(['/chat/60']);
    const toggle = await screen.findByRole('button', { name: '游乐小抽屉' });
    fireEvent.click(toggle);

    // Switch to sticky-note tab
    fireEvent.click(screen.getByRole('tab', { name: /便利贴/ }));
    const noteInput = screen.getByPlaceholderText(/直接写在便利贴上/);
    fireEvent.click(screen.getByRole('button', { name: '便签颜色：深绯' }));
    fireEvent.change(noteInput, { target: { value: '坏标签 </pin>' } });

    // Clicking outside with literal </pin> is blocked
    fireEvent.pointerDown(document.body);
    expect(screen.getByRole('alert').textContent).toContain('</pin>');

    // Fix text & click outside to commit to PinBoard draft stack
    fireEvent.change(noteInput, { target: { value: '记得带门禁卡' } });
    fireEvent.pointerDown(document.body);

    const board = await screen.findByRole('complementary', { name: '会话便签' });
    const draftNote = board.querySelector('.app-itag-note--draft') as HTMLElement;
    expect(draftNote).not.toBeNull();
    expect(draftNote.getAttribute('data-pin-color')).toBe('crimson');
    expect(within(draftNote).getByText('待发送')).toBeInTheDocument();

    // Send without body text & verify Snowflake does NOT appear for pending toys
    expect(screen.queryByRole('button', { name: '生成Cache并发送' })).toBeNull();
    const sendBtn = screen.getByRole('button', { name: '发送消息' });
    expect(sendBtn).not.toBeDisabled();

    // Re-edit draft note before sending
    fireEvent.click(within(draftNote).getByRole('button', { name: /编辑待发便签/ }));
    const editBox = screen.getByPlaceholderText(/直接写在便利贴上/) as HTMLTextAreaElement;
    expect(editBox.value).toBe('记得带门禁卡');
    fireEvent.change(editBox, { target: { value: '记得带备用钥匙' } });
    fireEvent.pointerDown(document.body);

    expect(within(board).getByText('记得带备用钥匙')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '发送消息' }));

    await waitFor(() => expect(sentBodies).toEqual(['<pin color="crimson">记得带备用钥匙</pin>']));
  });

  it('probes persisted user <roll_result> early during live SSE and settles DiceRollOverlay', async () => {
    const enc = new TextEncoder();
    let capturedClientTurnId: string | null = null;
    let pushSseStatus: (() => void) | null = null;
    let finishSse: (() => void) | null = null;

    installRuntimeFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET]) },
      { test: '/api/models/catalog/', handler: () => jsonResponse(CATALOG) },
      { test: '/api/agents/conversations/60/', handler: () => jsonResponse(makeConv()) },
      {
        test: '/api/agents/chat/60/',
        method: 'POST',
        handler: (_url, init) => {
          const parsed = JSON.parse(String(init?.body ?? '{}'));
          capturedClientTurnId = parsed.client_turn_id;
          return new Response(
            new ReadableStream({
              start(controller) {
                pushSseStatus = () => {
                  controller.enqueue(enc.encode('event: status\ndata: {"status":"thinking"}\n\n'));
                };
                finishSse = () => {
                  controller.enqueue(enc.encode('event: content\ndata: 好运！\n\n'));
                  controller.enqueue(enc.encode('event: done\ndata: [DONE]\n\n'));
                  controller.close();
                };
              },
            }),
            { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
          );
        },
      },
      {
        test: '/api/agents/chat/60/',
        handler: () =>
          jsonResponse({
            messages: capturedClientTurnId
              ? [
                  {
                    id: 901,
                    role: 'user',
                    content: '<roll=1d20+2><roll_result expr="1d20+2" by="user" dice="20" total="22">',
                    reasoning_content: null,
                    client_turn_id: capturedClientTurnId,
                    platform: 'test',
                    model_version: null,
                    token_count: null,
                    index_in_session: 0,
                    attachment_ids: [],
                    attachments_meta: null,
                    created_at: '2026-11-14T12:00:00Z',
                  },
                ]
              : [],
            total_count: capturedClientTurnId ? 1 : 0,
            has_more: false,
          }),
      },
    ]);

    renderApp(['/chat/60']);
    const toggle = await screen.findByRole('button', { name: '游乐小抽屉' });
    fireEvent.click(toggle);

    // Add d20 and +2 modifier
    fireEvent.click(screen.getByRole('button', { name: '添加 d20' }));
    fireEvent.click(screen.getByRole('button', { name: '增大修正值' }));
    fireEvent.click(screen.getByRole('button', { name: '增大修正值' }));

    // Collapse drawer -> verify pending dice badge
    fireEvent.click(screen.getByRole('button', { name: '合上小抽屉' }));
    expect(screen.getByText('已备 1d20+2')).toBeInTheDocument();

    // Send with empty message text
    fireEvent.click(screen.getByRole('button', { name: '发送消息' }));

    // Wait for floating overlay in rolling phase
    const overlay = await screen.findByRole('status', { name: /掷骰 1d20\+2/ });
    expect(overlay.getAttribute('data-roll-phase')).toBe('rolling');

    // Emit first SSE wire event so read-only probe fetches user roll_result before turn completes
    act(() => {
      pushSseStatus?.();
    });

    await waitFor(
      () => {
        expect(screen.getByTestId('dice-roll-result-summary')).toHaveTextContent('= 22');
      },
      { timeout: 3000 },
    );

    act(() => {
      finishSse?.();
    });
  });

  it('restores plain text + armed toys (not raw <roll>/<pin> tags) when turn fails without user persistence', async () => {
    const enc = new TextEncoder();
    installRuntimeFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET]) },
      { test: '/api/models/catalog/', handler: () => jsonResponse(CATALOG) },
      { test: '/api/agents/conversations/60/', handler: () => jsonResponse(makeConv()) },
      {
        test: '/api/agents/chat/60/',
        method: 'POST',
        handler: () =>
          new Response(
            new ReadableStream({
              start(controller) {
                controller.enqueue(enc.encode('event: error\ndata: {"message":"upstream failed"}\n\n'));
                controller.close();
              },
            }),
            { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
          ),
      },
      {
        test: '/api/agents/chat/60/',
        handler: () => jsonResponse({ messages: [], total_count: 0, has_more: false }),
      },
    ]);

    renderApp(['/chat/60']);
    const toggle = await screen.findByRole('button', { name: '游乐小抽屉' });
    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole('button', { name: '添加 d6' }));
    fireEvent.click(screen.getByRole('tab', { name: /便利贴/ }));
    fireEvent.change(screen.getByPlaceholderText(/直接写在便利贴上/), { target: { value: '恢复校验' } });
    fireEvent.click(screen.getByRole('button', { name: '完成贴上' }));
    fireEvent.click(screen.getByRole('button', { name: '合上小抽屉' }));

    const textbox = screen.getByRole('textbox', { name: /消息输入框/ }) as HTMLTextAreaElement;
    fireEvent.change(textbox, { target: { value: '试着掷一次' } });
    fireEvent.click(screen.getByRole('button', { name: '发送消息' }));

    await waitFor(() => expect(textbox.value).toBe('试着掷一次'));
    expect(textbox.value).not.toContain('<roll=');
    expect(textbox.value).not.toContain('<pin');
    expect(screen.getByText('已备 1d6')).toBeInTheDocument();
    expect(screen.getByText('恢复校验')).toBeInTheDocument();
  });

  it('disables drawer and blocks send during textOnly (<block>) while retaining armed toys', async () => {
    installRuntimeFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET]) },
      { test: '/api/models/catalog/', handler: () => jsonResponse(CATALOG) },
      {
        test: '/api/agents/conversations/60/',
        handler: () =>
          jsonResponse(
            makeConv({
              inline_state: {
                pins: [],
                block: { unblock_at: new Date(Date.now() + 60_000).toISOString() },
              },
            }),
          ),
      },
      { test: '/api/agents/chat/60/', handler: () => jsonResponse({ messages: [], total_count: 0, has_more: false }) },
    ]);

    renderApp(['/chat/60']);
    const toggle = await screen.findByRole('button', { name: '游乐小抽屉' });
    expect(toggle).toBeDisabled();
  });

  it('supports touch pool-to-tray drag drop and drag-out removal without frame drops', async () => {
    installRuntimeFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET]) },
      { test: '/api/models/catalog/', handler: () => jsonResponse(CATALOG) },
      { test: '/api/agents/conversations/60/', handler: () => jsonResponse(makeConv()) },
      { test: '/api/agents/chat/60/', handler: () => jsonResponse({ messages: [], total_count: 0, has_more: false }) },
    ]);

    renderApp(['/chat/60']);
    fireEvent.click(await screen.findByRole('button', { name: '游乐小抽屉' }));

    const tray = screen.getByRole('application', { name: /把玩骰盘区/ });
    vi.spyOn(tray, 'getBoundingClientRect').mockReturnValue({
      left: 40,
      top: 200,
      right: 340,
      bottom: 356,
      width: 300,
      height: 156,
      x: 40,
      y: 200,
      toJSON: () => ({}),
    } as DOMRect);

    const poolBtn = screen.getByRole('button', { name: '添加 d20' });
    fireEvent.pointerDown(poolBtn, { button: 0, clientX: 60, clientY: 120 });
    expect(poolBtn.className).toContain('app-toy-pool-btn--pressing');

    fireEvent.pointerMove(window, { clientX: 160, clientY: 260 });
    const ghost = document.querySelector('.app-toy-drag-ghost') as HTMLElement | null;
    expect(ghost).not.toBeNull();
    expect(ghost?.style.opacity).toBe('1');
    expect(ghost?.style.transform).toContain('translate3d(');
    expect(tray.className).toContain('app-toy-tray--magnet');

    fireEvent.pointerUp(window, { clientX: 160, clientY: 260 });
    expect(document.querySelector('.app-toy-drag-ghost')).toBeNull();
    expect(screen.getByText('1/8')).toBeInTheDocument();

    const trayDie = screen.getByRole('button', { name: /d20 试滚预览/ });
    expect(trayDie.style.transform).toContain('translate3d(');

    // Drag die out of tray to remove it cleanly
    fireEvent.pointerDown(trayDie, { button: 0, clientX: 160, clientY: 260 });
    fireEvent.pointerMove(window, { clientX: 160, clientY: 120 });
    fireEvent.pointerUp(window, { clientX: 160, clientY: 120 });
    expect(screen.getByText('0/8')).toBeInTheDocument();
  });

  it('caches tray bounding rect during tray touch-flick gestures without per-move reflows', async () => {
    installRuntimeFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET]) },
      { test: '/api/models/catalog/', handler: () => jsonResponse(CATALOG) },
      { test: '/api/agents/conversations/60/', handler: () => jsonResponse(makeConv()) },
      { test: '/api/agents/chat/60/', handler: () => jsonResponse({ messages: [], total_count: 0, has_more: false }) },
    ]);

    renderApp(['/chat/60']);
    fireEvent.click(await screen.findByRole('button', { name: '游乐小抽屉' }));
    fireEvent.click(screen.getByRole('button', { name: '添加 d6' }));

    const tray = screen.getByRole('application', { name: /把玩骰盘区/ });
    const rectSpy = vi.spyOn(tray, 'getBoundingClientRect').mockReturnValue({
      left: 40,
      top: 200,
      right: 340,
      bottom: 356,
      width: 300,
      height: 156,
      x: 40,
      y: 200,
      toJSON: () => ({}),
    } as DOMRect);

    rectSpy.mockClear();
    fireEvent.pointerDown(tray, { button: 0, clientX: 100, clientY: 240 });
    const downCalls = rectSpy.mock.calls.length;
    expect(downCalls).toBe(1);

    fireEvent.pointerMove(window, { clientX: 101, clientY: 241 });
    fireEvent.pointerMove(window, { clientX: 130, clientY: 255 });
    fireEvent.pointerMove(window, { clientX: 170, clientY: 270 });
    expect(rectSpy.mock.calls.length).toBe(downCalls);
    expect(tray.style.transform).toContain('translate3d(');

    fireEvent.pointerUp(window, { clientX: 170, clientY: 270 });
    expect(tray.style.transform).toBe('');
  });

  it('triggers DiceRollOverlay on assistant <roll=1d20>, keeps revealed overlay until clicked, and replays on chip click', async () => {
    const enc = new TextEncoder();
    let capturedClientTurnId: string | null = null;
    let replied = false;

    installRuntimeFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET]) },
      { test: '/api/models/catalog/', handler: () => jsonResponse(CATALOG) },
      { test: '/api/agents/conversations/60/', handler: () => jsonResponse(makeConv()) },
      {
        test: '/api/agents/chat/60/',
        method: 'POST',
        handler: async (_url, init) => {
          const parsed = JSON.parse(String(init?.body ?? '{}'));
          capturedClientTurnId = parsed.client_turn_id ?? null;
          replied = true;
          return new Response(
            new ReadableStream({
              start(controller) {
                controller.enqueue(enc.encode('event: status\ndata: {"phase":"streaming"}\n\n'));
                controller.enqueue(
                  enc.encode('event: token\ndata: {"content":"我帮你检定一下 <roll=1d20>"}\n\n'),
                );
                controller.enqueue(enc.encode('event: done\ndata: {}\n\n'));
                controller.close();
              },
            }),
            { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
          );
        },
      },
      {
        test: '/api/agents/chat/60/',
        handler: () =>
          jsonResponse({
            messages: replied
              ? [
                  {
                    id: 201,
                    role: 'user',
                    content: '帮我检定',
                    reasoning_content: null,
                    client_turn_id: capturedClientTurnId,
                    platform: 'test',
                    model_version: null,
                    token_count: null,
                    index_in_session: 0,
                    attachment_ids: [],
                    attachments_meta: null,
                    created_at: '2026-11-14T12:00:00Z',
                  },
                  {
                    id: 202,
                    role: 'assistant',
                    content: '我帮你检定一下 <roll=1d20>',
                    reasoning_content: null,
                    client_turn_id: null,
                    platform: 'test',
                    model_version: null,
                    token_count: null,
                    index_in_session: 1,
                    attachment_ids: [],
                    attachments_meta: null,
                    inline_rolls: [{ tag_index: 0, expression: '1d20', dice: [1], total: 1 }],
                    created_at: '2026-11-14T12:00:02Z',
                  },
                ]
              : [],
            total_count: replied ? 2 : 0,
            has_more: false,
          }),
      },
    ]);

    renderApp(['/chat/60']);
    const textbox = await screen.findByRole('textbox', { name: /消息输入框/ });
    fireEvent.change(textbox, { target: { value: '帮我检定' } });
    fireEvent.click(screen.getByRole('button', { name: '发送消息' }));

    // Overlay pops up with agent instance name and eventually reveals fumble = 1
    const overlay = await screen.findByRole('status', { name: /掷骰 1d20/ }, { timeout: 3000 });
    expect(overlay).toHaveTextContent('Ecki · 1d20');

    await waitFor(
      () => {
        expect(overlay.getAttribute('data-roll-phase')).toBe('revealed');
        expect(screen.getByTestId('dice-roll-result-summary')).toHaveTextContent('= 1');
      },
      { timeout: 4000 },
    );
    expect(overlay.className).toContain('app-toy-roll-overlay--fumble');

    // Stays revealed past old 1500ms auto-dismiss window until user clicks card
    await new Promise((r) => setTimeout(r, 1700));
    expect(screen.getByRole('status', { name: /掷骰 1d20/ })).toBeInTheDocument();

    const card = overlay.querySelector('.app-toy-roll-card') as HTMLElement;
    fireEvent.click(card);
    expect(screen.queryByRole('status', { name: /掷骰 1d20/ })).toBeNull();

    // Clicking persisted <roll> chip in message bubble replays DiceRollOverlay with fumble glow
    const chipBtn = await screen.findByRole('button', { name: /重播 Ecki 掷骰 1d20 结果 1/ });
    expect(chipBtn).toHaveAttribute('title', 'Ecki 掷骰 · 点击重播特效');
    fireEvent.click(chipBtn);

    const replayed = await screen.findByRole('status', { name: /掷骰 1d20/ });
    expect(replayed).toHaveTextContent('Ecki · 1d20');
    expect(replayed.getAttribute('data-roll-phase')).toBe('rolling');
    await waitFor(
      () => {
        expect(replayed.getAttribute('data-roll-phase')).toBe('revealed');
      },
      { timeout: 4000 },
    );
    expect(replayed.className).toContain('app-toy-roll-overlay--fumble');
  }, 15000);
});
