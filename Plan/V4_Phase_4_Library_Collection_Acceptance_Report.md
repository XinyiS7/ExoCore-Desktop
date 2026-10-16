# V4 Library / Collection UI — Acceptance Report

> Issue: XinyiS7/ExoCore#61
> Acceptance owner: Solaire / gpt-5.6-sol
> Frozen spec: `44194c7` (`Plan/V4_Phase_4_Library_Collection_Acceptance_Spec.md`, blob `d3a7c6a9`)
> Cycle: R3
> Construction baseline: `c8608345adb21272c6b3893b3d6074cff8404bb1`
> Repair baselines: `8e2b299c44d9de2c1a5640390ef4f50b8e4a9600`, `5476b28ff38c42959f800eeb143ac3a0102f600f`
> Date: 2026-10-16

## Verdict

**PASS / USER-UI-PENDING**

UI-A through UI-G pass source and automated verification. UI-H and the visual/keyboard walkthrough remain explicitly owned by Alicia and were not substituted with agent-created data or paid probes.

## Gate Summary

| Gate | Result | Evidence |
|---|---|---|
| UI-A navigation/responsive wall | PASS (source/automated) | Routes, wall states, wide/narrow presentation and navigation tests present. |
| UI-B filters/traversal | PASS (source/automated) | Six HTTP filters, cursor reset/retry/refresh and deduplication covered. |
| UI-C detail/edit/delete | PASS (source/automated) | Four-kind detail, representation states, server-confirmed edit and permanent deletion covered. |
| UI-D view/social detail | PASS (source/automated) | StrictMode one-view behavior, failure notice, returned-count merge and read-only projections covered. |
| UI-E compose/recovery | PASS | Main card send/recovery paths pass; F-01 conflict now disables voice send, announces the reason, preserves both states, and restores the valid send path after either side is removed. |
| UI-F unified cards | PASS (source/automated) | Agent/user normalization shares `CollectionShowCardView`; deleted-source behavior covered. |
| UI-G accessibility/regression | PASS / USER-PENDING | F-01 source repair passes; manual keyboard sweep remains Alicia-owned. |
| UI-H real Direct/AGY | USER-PENDING | No acceptance agent created real turns, conversations, items, or browser-side view writes. |

## Mechanical Evidence

- Initial source sweep: 1572/1572 tests PASS; build/typecheck PASS; all 43 #61 TypeScript/TSX files lint clean.
- R2 focused `collection_bring`: 13/13 PASS.
- R2 full app suite: 1574/1574 PASS.
- R2 build/typecheck, scoped lint, and diff check: PASS.
- Full lint retains 8 pre-existing errors in 6 files, none changed by #61; non-blocking baseline debt.
- Frozen spec and mockup evidence hashes remain unchanged; `HEAD == origin/main`; worktree clean at repair handoff.

## Finding F-01

- **Severity / status:** P1 · resolved in `8e2b299`
- **Original evidence:** With a recorded voice draft and pending or rejected Collection cards, the parent submit handler returned while the voice-send control remained enabled and silent.
- **Required outcome:** Keep the prohibition explicit and recoverable, preserve both states, and restore the valid send path after Alicia removes/discards one side.
- **Repair evidence:** Pending and rejected card states both disable voice send; the visible `role=status` explanation is linked through `aria-describedby`; cancelling the recording restores card send; removing the card restores voice send. Neither state is lost.
- **Scope:** `AudioComposeBar`, `ChatComposer`, existing `collection_bring` tests, and presentation-only `shell.css`. No transport or submit-handler change.

## Review Ledger

- Cycle R1 | Baseline `c860834` | Verdict FAIL | Finding F-01 | Construction 1, Acceptance 1.
- Cycle R2 | Baseline `8e2b299` | Verdict PASS / USER-UI-PENDING | F-01 resolved; source FAIL count reset.

F-02/F-03 source repair passes at `5476b28`: user media/cards align on one edge; selection affordances and persistent action dock match the approved mockup. Final PASS still requires Alicia's visual recheck and remaining real Direct/AGY Library behavior under UI-G/UI-H.

`DEPLOY_STEP: none`
## Cycle R3 Recheck

- **Baseline:** `5476b28ff38c42959f800eeb143ac3a0102f600f`
- **Verdict:** PASS / USER-UI-PENDING
- **F-02 resolved:** user messages with Collection cards apply a role-specific body class; their attachment row and cards share the right edge. Agent layout and wire shape are unchanged.
- **F-03 resolved:** the wall exposes “选择”, every selection-mode card has a visible dot, selected order is numbered, the state bar remains sticky, the action dock remains visible and clears for the target dialog, and only unselected cards dim at the five-item cap.
- Focused tests: 23/23 PASS; full app suite: 1575/1575 PASS; build/typecheck, scoped lint, and diff check PASS.
- Frozen spec and approved mockup evidence remain unchanged.
- Browser geometry and final real behavior remain Alicia-owned; no acceptance probe or database data was created.