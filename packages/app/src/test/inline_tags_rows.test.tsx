import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { MessageTimeline } from '../features/chat/MessageTimeline';
import { useMessageMinimap } from '../features/chat/minimap/useMessageMinimap';
import type { MessageView } from '../features/chat/types';
import type { RuntimeAssistantRow } from '../features/chat/runtime/types';
import { renderV4 } from './helpers';

/**
 * #130 CP1-F04 — row-level visibility (escalation state matrix). A message
 * whose body projects to nothing (pure valid pin/unpin) and has no independent
 * payload occupies no timeline row and no minimap entry.
 */

function msg(id: number, role: MessageView['role'], content: string, extra: Partial<MessageView> = {}): MessageView {
  return { id, role, content, createdAt: '2026-11-13T15:00:00Z', ...extra } as MessageView;
}

const timelineProps = { hasOlder: false, loadingMore: false, onLoadMore: () => {} };

function rowsOf(messages: MessageView[], extra: Partial<Parameters<typeof MessageTimeline>[0]> = {}) {
  const { container } = renderV4(<MessageTimeline {...timelineProps} conversationId={9} messages={messages} {...extra} />);
  return container;
}

describe('state matrix', () => {
  it.each(['assistant', 'user'] as const)('pure valid pin / unpin leaves no %s row', (role) => {
    const container = rowsOf([
      msg(1, role, '<pin>only</pin>'),
      msg(2, role, '  <unpin id=3>\n'),
      msg(3, role, '<pin>a</pin><unpin id=1>'),
      msg(4, role, '留下的行'),
    ]);
    expect(container.querySelectorAll('article.app-msg')).toHaveLength(1);
    expect(container.querySelector('[data-message-id="4"]')).not.toBeNull();
  });

  it.each(['assistant', 'user'] as const)('mixed %s text keeps the row and only non-pin text', (role) => {
    const container = rowsOf([msg(1, role, 'before <pin>hidden</pin> after')]);
    const row = container.querySelector('[data-message-id="1"]');
    expect(row?.querySelector('.app-md')?.textContent).toBe('before  after');
    expect(row?.textContent).not.toContain('hidden');
  });

  it.each([
    ['unclosed', '<pin>未闭合'],
    ['uppercase', '<PIN>note</PIN>'],
    ['bad argument', '<unpin id=abc>'],
    ['code', '`<pin>x</pin>`'],
  ])('rejected (%s) pin-like text keeps the row verbatim', (_label, content) => {
    for (const role of ['assistant', 'user'] as const) {
      const container = rowsOf([msg(1, role, content)]);
      expect(container.querySelector('[data-message-id="1"] .app-md')?.textContent).toBe(content.replace(/`/g, ''));
    }
  });

  it('pure pin plus an independent payload keeps the row without pin content', () => {
    const container = rowsOf([
      msg(1, 'assistant', '<pin>x</pin>', { reasoningContent: '想了想' }),
      msg(2, 'assistant', '<pin>y</pin>', {
        voiceToolErrors: [{ position: 0, errorCode: 'voice_failed' }],
      } as Partial<MessageView>),
      msg(3, 'user', '<pin>z</pin>', {
        attachmentsMeta: [
          {
            id: 1,
            display_name: 'a.png',
            original_filename: 'a.png',
            mime_type: 'image/png',
            file_size: 1,
            file_uri: null,
            content_url: null,
          },
        ],
      } as Partial<MessageView>),
    ]);
    for (const id of [1, 2, 3]) {
      const row = container.querySelector(`[data-message-id="${id}"]`);
      expect(row).not.toBeNull();
      expect(row?.querySelector('.app-msg-body > .app-md')).toBeNull();
      expect(row?.textContent).not.toMatch(/[xyz]<|<pin>|空消息/);
    }
  });

  it('a genuinely empty row still says 空消息', () => {
    const container = rowsOf([msg(1, 'assistant', '')]);
    expect(container.querySelector('[data-message-id="1"]')?.textContent).toContain('空消息');
  });

  it('a streaming pure pin shows the waiting spinner, not an empty body', () => {
    const runtimeAssistant = {
      clientKey: 'r1',
      content: '<pin>周五交',
      thinking: '',
      isStreaming: true,
      statusText: '',
      voiceToolErrors: [],
      error: null,
    } as unknown as RuntimeAssistantRow;
    const container = rowsOf([], { runtimeAssistant });
    const row = container.querySelector('.app-msg--streaming');
    expect(row?.querySelector('.app-md')).toBeNull();
    expect(row?.querySelector('[aria-label="等待回答"]')).not.toBeNull();
  });

  it('a streaming mixed reply keeps its ordinary text', () => {
    const runtimeAssistant = {
      clientKey: 'r1',
      content: '好的<pin>周五交',
      thinking: '',
      isStreaming: true,
      statusText: '',
      voiceToolErrors: [],
      error: null,
    } as unknown as RuntimeAssistantRow;
    const container = rowsOf([], { runtimeAssistant });
    expect(container.querySelector('.app-msg--streaming .app-md')?.textContent).toBe('好的');
  });
});

describe('minimap consumes the same visibility', () => {
  it('lists only user rows the timeline draws with visible text', () => {
    const messages = [
      msg(1, 'user', '<pin>only</pin>'),
      msg(2, 'user', '<timer_fired title="泡茶" fire_at="2026-11-13T16:21:44+01:00">'),
      msg(3, 'user', 'before <pin>hidden</pin> after'),
      msg(4, 'user', '<PIN>note</PIN>'),
      msg(5, 'assistant', '回复'),
    ];
    const { result } = renderHook(() => useMessageMinimap(messages, { current: null }, false));
    expect(result.current.entries.map((e) => e.id)).toEqual([3, 4]);
    expect(result.current.loadedCount).toBe(2);
  });
});
