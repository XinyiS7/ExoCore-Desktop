import { X } from 'lucide-react';
import type { ConversationPinView } from '../types';
import { useDeletePinMutation } from '../queries';
import { toAppApiError } from '../api';
import type { CommittingPin, DraftPin } from './pinColors';
import './inlineTags.css';

/**
 * Conversation sticky notes (#130 CP2, D-F + Plan 2026-11-14):
 * Renders draft/committing user pins at the top of the stack, followed by
 * persisted `inline_state.pins` sheets.
 */

// Small deterministic tilt per note so a stack reads as separate sheets.
const TILTS = [-2.2, 1.6, -0.8, 2.4, -1.5, 0.9];

function hashTiltIndex(id: string): number {
  let acc = 0;
  for (let i = 0; i < id.length; i += 1) {
    acc = (acc * 31 + id.charCodeAt(i)) >>> 0;
  }
  return acc % TILTS.length;
}

export interface PinBoardProps {
  conversationId: number;
  pins: readonly ConversationPinView[];
  assistantName: string;
  draftPins?: readonly DraftPin[];
  committingPins?: readonly CommittingPin[];
  onEditDraftPin?: (draftId: string) => void;
  onRemoveDraftPin?: (draftId: string) => void;
}

export function PinBoard({
  conversationId,
  pins,
  assistantName,
  draftPins = [],
  committingPins = [],
  onEditDraftPin,
  onRemoveDraftPin,
}: PinBoardProps) {
  const remove = useDeletePinMutation(conversationId);
  const totalCount = draftPins.length + committingPins.length + pins.length;
  if (totalCount === 0) return null;
  const failedId = remove.isError && toAppApiError(remove.error).status !== 404 ? remove.variables : null;

  return (
    <aside className="app-itag-pinboard" aria-label="会话便签">
      {draftPins.map((draft, i) => (
        <div
          key={`draft-${draft.id}`}
          className="app-itag-note app-itag-note--draft"
          data-itag="pin-draft"
          data-pin-color={draft.color}
          style={{
            ['--itag-note-tilt' as string]: `${TILTS[hashTiltIndex(draft.id)]}deg`,
            zIndex: totalCount - i,
          }}
        >
          <span className="app-itag-note-badge">待发送</span>
          <button
            type="button"
            className="app-itag-note-edit-btn"
            aria-label={`编辑待发便签：${draft.body}`}
            title="点击重新编辑便签"
            onClick={() => onEditDraftPin?.(draft.id)}
          >
            <p className="app-itag-note-body" title={draft.body}>
              {draft.body}
            </p>
          </button>
          <div className="app-itag-note-foot">
            <span>我 · 点击重编</span>
          </div>
          <button
            type="button"
            className="app-itag-note-close"
            aria-label={`移除待发便签：${draft.body}`}
            title="移除待发便签"
            onClick={() => onRemoveDraftPin?.(draft.id)}
          >
            <X size={12} aria-hidden="true" />
          </button>
        </div>
      ))}

      {committingPins.map((pin, i) => (
        <div
          key={`committing-${pin.id}`}
          className="app-itag-note app-itag-note--committing"
          data-itag="pin-committing"
          data-pin-color={pin.color}
          aria-busy="true"
          style={{
            ['--itag-note-tilt' as string]: `${TILTS[hashTiltIndex(pin.id)]}deg`,
            zIndex: totalCount - draftPins.length - i,
          }}
        >
          <span className="app-itag-note-badge">发送中…</span>
          <p className="app-itag-note-body" title={pin.body}>
            {pin.body}
          </p>
          <div className="app-itag-note-foot">
            <span>我</span>
          </div>
        </div>
      ))}

      {pins.map((pin, i) => {
        const closing = remove.isPending && remove.variables === pin.id;
        return (
          <div
            key={pin.id}
            className={`app-itag-note${closing ? ' app-itag-note--closing' : ''}`}
            data-itag="pin"
            data-pin-color={pin.color}
            style={{
              ['--itag-note-tilt' as string]: `${TILTS[pin.id % TILTS.length]}deg`,
              zIndex: pins.length - i,
            }}
          >
            <p className="app-itag-note-body" title={pin.content}>
              {pin.content}
            </p>
            <div className="app-itag-note-foot">
              <span>{pin.author === 'user' ? '我' : assistantName}</span>
              {failedId === pin.id ? <span role="alert">取消失败，请重试</span> : null}
            </div>
            <button
              type="button"
              className="app-itag-note-close"
              aria-label={`取消便签：${pin.content}`}
              title="取消便签"
              disabled={closing}
              onClick={() => remove.mutate(pin.id)}
            >
              <X size={12} aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </aside>
  );
}
