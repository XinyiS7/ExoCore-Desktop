import { createContext } from 'react';

export interface RollReplayPayload {
  expr: string;
  dice: readonly number[];
  total: number;
  by: 'user' | 'assistant';
}

/**
 * Provides replay trigger from persisted `<roll>` / `<roll_result>` message
 * chips to the conversation's `DiceRollOverlay` without prop-drilling.
 */
export const RollReplayContext = createContext<((payload: RollReplayPayload) => void) | null>(null);
