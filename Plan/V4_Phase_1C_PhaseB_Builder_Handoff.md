# V4 P1C — Phase B Builder Handoff / Evidence

> **Builder:** Solaire (pane 5)
> **Date:** 2026-09-07
> **Authorized slice:** Task 3 audio recovery snapshot/machine + recovery UI; Task 4 C1B runtime integration; remaining Task 2 delete cross-owner seam.
> **Frozen authority:** `V4_Phase_1C_Detailed_Plan.md` + `V4_Phase_1C_Attachment_Audio_acceptance_report.md` (read-only, unchanged).
> **STOP honored:** Task 5 historical attachment rendering and playback manager were not implemented.

## 1. Preserved baseline and boundaries

- Read Phase A handoff and inspected the shared-worktree diff before editing.
- Preserved all Phase A files and sibling `.agents` / Plan work.
- No backend, outer repository, V3 production, deployment, dependency, lockfile, or frozen Plan/acceptance edits.
- No commit, live browser probe, provider call, or generation spend.
- The unrelated missing backend `ExoCore/.agents/skills/sia-telemetry/SKILL.md` was not touched.
- Closing real DB check: `OK: AgentPreset baseline 8 rows [1, 2, 3, 4, 5, 6, 7, 8]`.

## 2. Phase B implementation

### Audio recovery snapshot/machine

- Added `audio/audioRecoveryMachine.ts`:
  - snapshots before C1B dispatch after the single successful audio upload;
  - retains Conversation ID, attempt key, original text, complete ordered attachment IDs, audio subset, terminal state, and persistence classification;
  - upload uses the exact resolved model/endpoint and strict single-result ownership;
  - retry replays the immutable text/full ID set and performs zero audio upload;
  - exact-persisted retry uses the exact user Message ID; proven-absent retry is ordinary send;
  - unknown/ambiguous binding and later user turns disable one-click retry with explicit-edit guidance;
  - clean `done` alone clears automatically; other outcomes retain recovery;
  - route change clears local recovery;
  - attachment deletion retires the whole snapshot without retaining a partial sendable ID set;
  - ref-backed guards close same-tick upload/retry/delete races.
- Added `runtime/attemptPersistence.ts`:
  - exact ordered attachment-ID identity is the only Message binding mechanism;
  - no text, timestamp, latest-row, or positional binding;
  - absence is proven only from a complete canonical history window; a partial window is `unknown`.
- Added `audio/AudioRecoveryBar.tsx` and V4-only responsive CSS for retry/abandon/error presentation.

### C1B runtime integration

- Changed ordinary runtime send to typed `ChatTurnInput { content, pendingAttachments?, attemptKey? }`.
- SSE and async both pass the validated complete ID list into the existing client adapter.
- Empty text is accepted only with at least one validated pending ID.
- C1B `OperationState`, durable lease, storage-first write safety, stop, polling, reconciliation, and route locks remain the only runtime authority.
- Added only a narrow attempt-keyed outcome callback; no second runtime/terminal controller.
- Canonical reconciliation reports `exact_persisted | proven_absent | unknown` to recovery.
- Edit/regenerate remain compose-attachment-free. Recovery replacement is the explicit narrow path that reuses the already-bound snapshot with exact `edit_message_id`.
- Optimistic user rows show only an honest local attachment count; no persisted Message or attachment binding is fabricated.
- Audio snapshot ownership clears the local Blob/compose source after snapshot creation, including safe predispatch rejection, preventing a second audio upload while preserving the complete retry turn.

### Delete cross-owner convergence

- `useUserAttachmentManager` now accepts a narrow synchronous `onDeleted(id)` callback.
- On 204, before any history/list refresh:
  1. manager tombstones/purges its row;
  2. compose purges/tombstones the ID;
  3. recovery retires any snapshot requiring the ID.
- Tombstones prevent stale refresh data from resurrecting a deleted ID.
- Ref-backed `isDeletePending()` blocks same-tick ordinary Send/retry while DELETE is unresolved.
- Pending audio upload blocks delete; C1B busy/uncertain state still disables delete through the existing UI lock.
- 409 and other delete failures do not invoke the callback and therefore mutate no compose/recovery state.

## 3. Phase B file manifest

### Added

- `packages/app/src/features/chat/runtime/attemptPersistence.ts`
- `packages/app/src/features/chat/audio/audioRecoveryMachine.ts`
- `packages/app/src/features/chat/audio/AudioRecoveryBar.tsx`
- `packages/app/src/test/p1c_audio_recovery.test.tsx`
- `packages/app/src/test/p1c_runtime_attachment_integration.test.tsx`
- `Plan/V4_Phase_1C_PhaseB_Builder_Handoff.md`

### Extended (preserving Phase A/C1B work)

- `packages/app/src/features/chat/runtime/types.ts`
- `packages/app/src/features/chat/runtime/useChatRuntime.ts`
- `packages/app/src/features/chat/attachments/useComposeAttachments.ts`
- `packages/app/src/features/chat/attachments/useUserAttachmentManager.ts`
- `packages/app/src/features/chat/ChatComposer.tsx`
- `packages/app/src/features/chat/ConversationPage.tsx`
- `packages/app/src/features/chat/MessageTimeline.tsx` — optimistic pending-turn summary only; historical Task 5 rendering untouched.
- `packages/app/src/styles/shell.css`
- `packages/app/src/test/p1c_compose_attachments.test.tsx`
- `packages/app/src/test/p1c_attachment_manager.test.tsx`

## 4. Deterministic evidence

| Check | Result |
|---|---|
| `pnpm --filter exo-app typecheck` | PASS |
| `pnpm --filter exo-app lint` | PASS |
| `NODE_OPTIONS=--no-experimental-webstorage pnpm --filter exo-app test:run` | PASS — 220 tests / 26 files |
| `pnpm --filter exo-app build` | PASS |
| `pnpm --filter exo-chat-core test:run` | PASS — 85 tests / 12 files |
| Focused Phase B suite (`p1c_audio_recovery`, `p1c_runtime_attachment_integration`, `p1c_attachment_manager`, `p1c_compose_attachments`) | PASS — 21 tests / 4 files |
| Final targeted recovery recheck | PASS — 4 tests / 1 file |
| `git diff --check` | PASS (line-ending warnings only) |
| Provider/live calls | None |
| Commit | None |

### Proven focused cases

- exact ordered canonical binding; complete-window proven absence; partial/duplicate ambiguity remains unknown;
- exact retry blocked by a later canonical user turn;
- complete original text + ordinary/audio IDs retained;
- retry emits zero additional attachment upload;
- SSE carries the complete `pending_attachments` set and returns exact canonical persistence;
- attachment-only ordinary send is legal;
- edit emits no newly composed `pending_attachments`;
- delete purge is visible to same-tick compose/recovery reads and cannot dispatch a stale deleted ID.

## 5. Explicit omissions / handoff

- Task 5 historical `attachments_meta` image/audio/file rendering, accessible lightbox, and global playback manager remain untouched and return to pane 4 only after this handoff.
- No independent acceptance was performed by this Builder.
- Phase B is ready for external review/acceptance or the authorized Task 5 continuation.
