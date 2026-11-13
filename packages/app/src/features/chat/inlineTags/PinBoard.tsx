import { X } from 'lucide-react';
import type { ConversationPinView } from '../types';
import { useDeletePinMutation } from '../queries';
import { toAppApiError } from '../api';
import './inlineTags.css';

/**
 * Conversation sticky notes (#130 CP2, D-F): `inline_state.pins` rendered as
 * paper notes pinned over the timeline viewport — outside the message stream,
 * visible for as long as the pin is active. × soft-deletes through the API;
 * the board then re-reads the conversation detail.
 */

// Small deterministic tilt per note so a stack reads as separate sheets.
const TILTS = [-2.2, 1.6, -0.8, 2.4, -1.5, 0.9];

export interface PinBoardProps {
  conversationId: number;
  pins: readonly ConversationPinView[];
  assistantName: string;
}

export function PinBoard({ conversationId, pins, assistantName }: PinBoardProps) {
  const remove = useDeletePinMutation(conversationId);
  if (pins.length === 0) return null;
  const failedId = remove.isError && toAppApiError(remove.error).status !== 404 ? remove.variables : null;

  return (
    <aside className="app-itag-pinboard" aria-label="会话便签">
      {pins.map((pin, i) => {
        const closing = remove.isPending && remove.variables === pin.id;
        return (
          <div
            key={pin.id}
            className={`app-itag-note${closing ? ' app-itag-note--closing' : ''}`}
            style={{ ['--itag-note-tilt' as string]: `${TILTS[pin.id % TILTS.length]}deg`, zIndex: pins.length - i }}
            data-itag="pin"
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
