import { useEffect, useRef } from 'react';

/**
 * Shared modal accessibility behavior (C1B-R1-06), mirroring the accepted P1A
 * CreateConversationDialog interaction pattern:
 * - opening moves focus to the first focusable element inside the dialog;
 * - Tab / Shift+Tab stay within the dialog (focus containment);
 * - Escape closes unless a submit is committed (`lockClose` semantics);
 * - closing restores focus to the invoking trigger.
 *
 * R4 repair (narrow, authorized): `locked` / `closeDisabledWhileLocked` are
 * read through a current-value ref, so pending-lock transitions no longer
 * re-run the focus-lifetime effect. Previously a lock flip re-entered the
 * effect: its cleanup restored focus to the (possibly now disabled) trigger
 * and its body re-captured/re-focused, which could strand focus on BODY.
 * The public API and open/close contract are unchanged; lock/unlock only
 * changes the live Escape policy. Callers whose dialog needs a stable focus
 * position while its controls are disabled supply their own pending anchor.
 */
export function useDialogA11y(
  isOpen: boolean,
  onClose: () => void,
  opts?: { closeDisabledWhileLocked?: boolean; locked?: boolean },
) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  // Live option reads: the keydown handler always sees the CURRENT policy
  // without requiring an effect re-run.
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    returnFocusRef.current = document.activeElement as HTMLElement | null;

    const focusables = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ),
      );

    const first = focusables()[0];
    first?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        const current = optsRef.current;
        // A committed/locked submit must not be dismissible into unsafe retry;
        // the close button itself is disabled in that state.
        if (current?.closeDisabledWhileLocked && current.locked) {
          event.preventDefault();
          return;
        }
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const list = focusables();
      if (list.length === 0) {
        event.preventDefault();
        return;
      }
      const firstEl = list[0];
      const lastEl = list[list.length - 1];
      const active = document.activeElement;
      if (event.shiftKey) {
        if (active === firstEl || !dialog.contains(active)) {
          event.preventDefault();
          lastEl.focus();
        }
      } else if (active === lastEl || !dialog.contains(active)) {
        event.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      returnFocusRef.current?.focus?.();
      returnFocusRef.current = null;
    };
  }, [isOpen, onClose]);

  return dialogRef;
}