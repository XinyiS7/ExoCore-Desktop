import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queries';
import { formatTimeOfDay } from '../time';
import { formatBlockRemaining } from './blockTime';
import type { ConversationBlockView, StagedMessageView } from '../types';
import './inlineTags.css';

/**
 * #130 CP4 staging area above the composer: the block countdown and the sends
 * held back by a block or a backend turn (`inline_state.block` / `.staged`).
 * Staged text is not in the timeline — the model has not seen it yet; once the
 * backend flushes it, the arrival refresh replaces these bubbles with the real
 * user message.
 */

export interface StagingAreaProps {
  conversationId: number;
  block: ConversationBlockView | null;
  staged: readonly StagedMessageView[];
}

function BlockCountdown({ conversationId, unblockAt }: { conversationId: number; unblockAt: string }) {
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => Date.now());
  const remaining = formatBlockRemaining(unblockAt, now);

  useEffect(() => {
    if (remaining === null) {
      // The block is over: re-read the detail so the composer unlocks.
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversation(conversationId) });
      return;
    }
    const timer = window.setTimeout(() => setNow(Date.now()), 1000);
    return () => window.clearTimeout(timer);
  }, [remaining, now, queryClient, conversationId]);

  if (remaining === null) return null;
  return (
    <p className="app-itag-block" role="status">
      禁言中 · 剩余 <span className="app-itag-block-time">{remaining}</span> · 消息会先暂存，到时一起发出
    </p>
  );
}

export function StagingArea({ conversationId, block, staged }: StagingAreaProps) {
  if (block === null && staged.length === 0) return null;
  return (
    <section className="app-itag-staging" aria-label="暂存区">
      {block !== null ? (
        <BlockCountdown key={block.unblockAt} conversationId={conversationId} unblockAt={block.unblockAt} />
      ) : null}
      {staged.map((row) => (
        <div key={row.id} className="app-itag-staged" data-itag="staged">
          <span className="app-itag-staged-meta">暂存 · {formatTimeOfDay(row.clickedAt)}</span>
          <p className="app-itag-staged-body">{row.content}</p>
        </div>
      ))}
    </section>
  );
}
