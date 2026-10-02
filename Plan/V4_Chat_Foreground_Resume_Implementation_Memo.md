# LR-01 — V4 Chat foreground resume construction memo

**Authority:** Alicia via pane5 LR-01; construction date 2026-10-02. Baseline `3b02e50`. Builder Solaire / gpt-6.1-sol. Independent Acceptance owns `Plan/V4_Chat_Foreground_Resume_acceptance_spec.md` (read-only); actual Android observation still required for effective C2/P3 release.

## Goal / causal facts

Accepted async sends must recover their retained status reader on returning foreground, without requiring Continue Polling. `useChatRuntime.ts:1039–1082` catches status errors into `blocked/poll_failed` while preserving the lease/token/cursor; `:1877–1905` exposes exact resume only through the manual button. `:2439–2516` currently has route reset/teardown but no foreground listeners. Terminal handling `:880–916` already delegates canonical fetch/apply/marker clear/UI unlock to `runReconcileStages` (`:722–878`). ConversationPage arrivals are gated while runtime busy (`:398–409`); notification arrival itself therefore cannot repair this paused reader. This source cause matches the physical report; deterministic reproduction will verify it before production edits.

## Intended behavior / scope

- Add route-scoped visibilitychange/focus/pageshow/online listeners to the runtime hook; only visible, current-route callbacks may invoke existing `resumePolling`. That command remains restricted to blocked/poll_failed + resume-poll + retained async token. Its synchronous transition is the single-flight gate; preserveStop and terminal reconcile remain unchanged.
- Handle a suspended GET rejecting *after* the visible event: retain an event generation, capture it at each GET, and after a genuine poll failure allow one resume for a visible foreground event that occurred during that request. The replacement GET captures the consumed generation. No periodic retry, no automatic retry without a new event, no live/stalled reader restart. A second failure without a new event remains honestly blocked/manual-recoverable.
- Clean listeners on route switch/unmount; listeners bind to the active route and an attached flag, while resume/request callbacks validate the current operation epoch/conversation. The epoch also changes on each send, so it must not be captured once at listener mount. Strengthen exact manual resume identity guard so a stale callback cannot start a request after a rejected transition.
- Only production file intended: `packages/app/src/features/chat/runtime/useChatRuntime.ts`. Builder regression: new `packages/app/src/test/chat_foreground_resume.test.tsx`, driven through real ConversationPage. Keep existing runtime/route/lease/stop tests unchanged and execute them. No backend/notification policy/POST protocol/P3 changes, no new dependencies/services/real data or paid calls.

## Order / validation

1. Track this memo, supplied frozen spec (bytes unmodified) and diagnosis before code. Diagnosis retains original observation/authorization history.
2. Add deterministic real-route tests and run the visible-resume case against unchanged production to expose the missing GET/reply recovery.
3. Implement local event bridge + bounded late-failure handling, preserving token/cursor, single authoritative state and canonical dedup.
4. Delegate mechanical focused lifecycle/route/reconcile/stop/P2D tests, complete exo-app suite, typecheck/lint/build; verify environment first (Node24 preferred; if existing Node25 WebStorage issue, documented NODE_OPTIONS=--no-experimental-webstorage is environment alignment, not test exclusions). Personally inspect source/diff/results once; targeted recheck only if a concrete defect appears.
5. Commit only builder scope and deliver hash/test assertions/evidence to pane5, then stop. No success update log/archive or C2/P3 release before independent disposition; deterministic events are not physical Android smoke.

## Construction evidence / status

Deterministic RED against unchanged production confirmed visible-event recovery missing; final focused12/12, adjacent101/101, full103 files/1345 tests, typecheck/lint/build passed (no exclusions). Details and initial construction defects/corrections are in `Plan/V4_Chat_Foreground_Resume_execution_log.md`. Builder self-check complete; submitted for independent acceptance, not a C2/P3 release or actual Android confirmation.

## Verification invariants

Exact retained cursor/token, one send POST, max one active status GET, one terminal canonical assistant row, cleared overlay/banner/lease; hidden bursts start zero new GETs; late rejection after visible event recovers once; continued failure stays blocked until another event/manual action; terminal/uncertain/SSE/storage-retry states excluded; stale route response ignored and removed listeners do not start work; preserve accepted Stop and existing P2D attribution/optimistic canonical replacement.
