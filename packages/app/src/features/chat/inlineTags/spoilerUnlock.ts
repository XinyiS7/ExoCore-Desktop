import { createContext } from 'react';

/**
 * Spoiler `pwd` unlock scope (#130, REQ §3.4): the timeline provides, per
 * message, a predicate over the user messages AFTER it. Outside a timeline
 * nothing unlocks.
 */
export const SpoilerUnlockContext = createContext<(pwd: string) => boolean>(() => false);
