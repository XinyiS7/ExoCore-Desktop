import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderV4 } from './helpers';
import { MessageTimeline } from '../features/chat/MessageTimeline';
import { RiverItemCard, formatAuthor } from '../features/river/RiverItemCard';
import { SourceReadingDrawer } from '../features/river/SourceReadingDrawer';
import type { MessageView } from '../features/chat/types';
import type { MemoWrites } from '../features/memo/queries';
import type { MemoReplyDrafts } from '../features/memo/replyDrafts';
import { diaryItem, heartbeatItem } from './river_fixtures';

describe('V4 Agent Identity Display (#5)', () => {
  const dummyWrites = {
    save: vi.fn(),
    pending: {},
    busyIds: [],
    retryTags: vi.fn(),
    editTags: vi.fn(),
  } as unknown as MemoWrites;

  const dummyReplyDrafts = {
    get: () => ({ content: '', saving: false, error: null, parent: null }),
    selectParent: vi.fn(),
    control: vi.fn(),
  } as unknown as MemoReplyDrafts;

  const presetById = new Map<number, string>([
    [1, 'Alaric'],
    [2, 'Alessandro'],
    [6, 'Alaric'],
  ]);

  const makeMsg = (over: Partial<MessageView> = {}): MessageView => ({
    id: 1,
    role: 'assistant',
    content: '',
    reasoningContent: null,
    platform: null,
    modelVersion: null,
    tokenCount: null,
    indexInSession: 0,
    attachmentIds: [],
    attachmentsMeta: [],
    attachments: [],
    createdAt: '2026-09-29T10:00:00Z',
    clientTurnId: null,
    ...over,
  });

  it('renders custom assistantName in MessageTimeline when provided', () => {
    const msg = makeMsg({
      id: 101,
      content: 'Hello, Alicia.',
    });

    renderV4(
      <MessageTimeline
        conversationId={1}
        messages={[msg]}
        hasOlder={false}
        loadingMore={false}
        onLoadMore={vi.fn()}
        optimisticUser={null}
        runtimeAssistant={null}
        isRunActive={false}
        assistantName="Alaric"
      />
    );

    expect(screen.getByText('Alaric')).toBeInTheDocument();
    expect(screen.queryByText('Agent')).not.toBeInTheDocument();
  });

  it('falls back to "Agent" in MessageTimeline when assistantName is omitted', () => {
    const msg = makeMsg({
      id: 102,
      content: 'Default name check.',
    });

    renderV4(
      <MessageTimeline
        conversationId={1}
        messages={[msg]}
        hasOlder={false}
        loadingMore={false}
        onLoadMore={vi.fn()}
        optimisticUser={null}
        runtimeAssistant={null}
        isRunActive={false}
      />
    );

    expect(screen.getByText('Agent')).toBeInTheDocument();
  });

  it('formatAuthor resolves agent:ID to preset name if found, else original author', () => {
    expect(formatAuthor('agent:1', presetById)).toBe('Alaric');
    expect(formatAuthor('agent:2', presetById)).toBe('Alessandro');
    expect(formatAuthor('agent:999', presetById)).toBe('agent:999');
    expect(formatAuthor('user', presetById)).toBe('user');
  });

  it('RiverItemCard displays resolved agent preset name in subtitles', () => {
    renderV4(
      <RiverItemCard
        item={diaryItem}
        onRead={vi.fn()}
        onOpenTask={vi.fn()}
        onOpenLegacy={vi.fn()}
        memoWrites={dummyWrites}
        replyDrafts={dummyReplyDrafts}
        presetById={presetById}
      />
    );

    expect(screen.getByRole('heading', { level: 2, name: /Alaric · Canonical day 2026-10-01/ })).toBeInTheDocument();

    renderV4(
      <RiverItemCard
        item={heartbeatItem}
        onRead={vi.fn()}
        onOpenTask={vi.fn()}
        onOpenLegacy={vi.fn()}
        memoWrites={dummyWrites}
        replyDrafts={dummyReplyDrafts}
        presetById={presetById}
      />
    );

    expect(screen.getByRole('heading', { level: 2, name: /Alaric · 最终巡检总结/ })).toBeInTheDocument();
  });

  it('SourceReadingDrawer resolves agent preset name in header title', () => {
    renderV4(
      <SourceReadingDrawer
        item={diaryItem}
        onClose={vi.fn()}
        presetById={presetById}
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Alaric 的日记 · 2026-10-01/)).toBeInTheDocument();
  });
});
