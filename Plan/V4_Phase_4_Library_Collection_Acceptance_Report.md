# V4 Library / Collection UI — Acceptance Report

> Issue: XinyiS7/ExoCore#61
> Acceptance owner: Solaire / gpt-5.6-sol
> Frozen spec: `44194c7` (`Plan/V4_Phase_4_Library_Collection_Acceptance_Spec.md`, blob `d3a7c6a9`)
> Cycle: R1
> Construction baseline: `c8608345adb21272c6b3893b3d6074cff8404bb1`
> Date: 2026-10-16

## Verdict

**FAIL — one source/UI blocker; Alicia-owned real walkthrough remains pending.**

UI-A through UI-F are source-complete and the scoped automated regression is green. UI-G has one reachable enabled-control/no-op defect. UI-H and the visual/keyboard walkthrough remain explicitly owned by Alicia and were not substituted with agent-created data or paid probes.

## Gate Summary

| Gate | Result | Evidence |
|---|---|---|
| UI-A navigation/responsive wall | PASS (source/automated) | Routes, wall states, wide/narrow presentation and navigation tests present. |
| UI-B filters/traversal | PASS (source/automated) | Six HTTP filters, cursor reset/retry/refresh and deduplication covered. |
| UI-C detail/edit/delete | PASS (source/automated) | Four-kind detail, representation states, server-confirmed edit and permanent deletion covered. |
| UI-D view/social detail | PASS (source/automated) | StrictMode one-view behavior, failure notice, returned-count merge and read-only projections covered. |
| UI-E compose/recovery | FAIL | Main card send/recovery paths pass; recording-plus-card conflict leaves an enabled send control that silently does nothing (F-01). |
| UI-F unified cards | PASS (source/automated) | Agent/user normalization shares `CollectionShowCardView`; deleted-source behavior covered. |
| UI-G accessibility/regression | FAIL / USER-PENDING | F-01 blocks source pass. Manual keyboard sweep remains Alicia-owned. |
| UI-H real Direct/AGY | USER-PENDING | No acceptance agent created real turns, conversations, items, or browser-side view writes. |

## Mechanical Evidence

- `pnpm --filter exo-app test:run`: 1572/1572 PASS.
- `pnpm --filter exo-app build`: PASS (typecheck + Vite build).
- Scoped ESLint over all 43 #61 TypeScript/TSX files: PASS.
- Full lint: 8 pre-existing errors in 6 files, none changed by #61; non-blocking baseline debt.
- Frozen spec and mockup evidence hashes remain unchanged; `HEAD == origin/main`; worktree clean.

## Finding F-01

- **Severity / status:** P1 · new
- **Observed evidence:** With a recorded voice draft and pending or rejected Collection cards, `ChatComposer` marks the combination blocked and `handleSubmit` returns early, but `AudioComposeBar` keeps the “发送语音” control enabled. Keyboard or pointer activation produces no send, no error, and no status announcement.
- **Violated invariant:** UI-G1 requires keyboard-operable controls and suitable dynamic status; an enabled control that silently performs no action is not operable. This is a reachable single-user flow: select Collection cards, record voice, then activate voice send.
- **Root cause:** confirmed — the conflict guard exists in the parent submit handler, while the audio send button only consumes `busy` for its disabled state.
- **Affected sibling paths:** pending cards, rejected cards, and any route that enters recorded-audio state while Collection cards remain in compose state.
- **Required outcome:** The product may continue forbidding voice-plus-card sends, but every reachable conflict state must be explicit and recoverable. The voice send control must not appear enabled while guaranteed to no-op; the UI must state why sending is unavailable and preserve both the recording and cards until Alicia removes/discards one side.
- **Suggested direction:** pass a conflict-disabled state/reason into `AudioComposeBar`, or block entry into the conflicting state with an equivalent visible explanation. Do not broaden into combined audio+card transport unless separately chosen.
- **Verification targets:** pending-card + recorded-audio and rejected-card + recorded-audio states; send control disabled or otherwise actionable; reason visible/announced; removing cards restores voice send; discarding recording restores card send; no draft/card loss.
- **Preserve recommendations:** keep card-only/text-plus-card ordering, item-specific failure recovery, sibling compose owner, unified card projection, dialog behavior, and all passing CP1–CP6 tests unchanged.

## Recheck Boundary

Focused recheck of F-01 and adjacent compose/audio tests first, then the #61 scoped tests, build, scoped lint, and final full app tests. Manual UI-H/keyboard evidence remains pending after source PASS.

`DEPLOY_STEP: none`