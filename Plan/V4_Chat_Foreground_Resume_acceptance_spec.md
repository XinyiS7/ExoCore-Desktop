# V4 Chat Foreground Resume — Frozen Acceptance Specification

**Authority:** Alicia authorized fixing Chat lockscreen recovery. Construction separate from Acceptance; no P3/B2/Collection scope.
**Baseline:** Desktop `3b02e50`; diagnosis `Plan/V4_Chat_Lockscreen_Resume_diagnosis.md`.
**Owner:** Solaire Acceptance / pane5. Builder must not edit this specification or Acceptance reports.

## Required behavior

1. After accepted async user send, background suspension/status-fetch failure may pause polling. Returning visible must automatically resume an eligible retained run token/cursor without manual button use.
2. Completed canonical reply reconciles into the correct conversation exactly once; stale analysis overlay, interrupted banner and spinning/busy state clear through existing terminal processing. Retain cursor semantics and canonical message deduplication.
3. Recovery is status GET/reconcile only: no re-POST, second user message, new model run, token replacement or restarting a completed run.
4. Visibility/focus/pageshow/online bursts cannot create parallel polling chains or duplicate terminal reconciles. Hidden pages must not acquire a new polling chain through these automatic triggers.
5. Recovery applies only to the existing recoverable async polling-failure state and retained token; cancelled/terminal/idle/unrecoverable/stream states are not blindly restarted. Manual recovery remains available after another failure.
6. Switching/unmounting conversations invalidates stale callbacks/requests; a late response cannot update another conversation or resurrect an abandoned run. Event listeners must clean up.
7. A continued failure remains honestly blocked; no infinite event-independent retry loop or fake completed response. Successful manual/auto recovery follows the same known terminal reconciliation path.
8. Existing stop/cancel, lease recovery, P2D arrival/notification attribution and optimistic-canonical replacement behavior remain compatible. No global notification policy or backend/network keepalive changes.

## Evidence and release

Construction creates its own brief Plan before code. Existing tests reused; independent tests only for uncovered failures. Required focused lifecycle/route/reconcile and P2D adjacent regression, typecheck/lint/build and relevant full frontend suite with no unapproved skips or failure exclusions. Explicitly distinguish deterministic browser event tests from physical Android confirmation.

Alicia's physical reproduction is send→lock→completed notification→unlock→stuck until Continue Polling. After fix, real device smoke must confirm automatic full reply and no duplicates; do not fabricate this evidence while Alicia is absent. Automated fix PASS may be recorded separately, but effective C2/P3 release remains held until the requisite physical recovery observation and final acceptance disposition.

No real preset changes, new conversations, paid probes or hidden service restart authorized for this repair. Builder owns production edits/tests, Acceptance owns verdict/report. Frozen gates cannot be weakened by Construction.