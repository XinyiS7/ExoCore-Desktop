# LR-01 — Builder execution log

**Owner:** gpt-6.1-sol / Solaire, pane7, 2026-10-02（local construction/test date）.
**Authority:** Alicia via pane5 LR-01; baseline Desktop `3b02e50`.
**State:** Implementation/self-check complete; independent acceptance and actual Android smoke pending. No C2/P3 release claimed.
**Trace commit before code:** `6f16010` tracks construction memo, supplied diagnosis, and frozen Acceptance-owned spec unchanged.

## Cause / narrow implementation

`useChatRuntime` retains async lease/token/cursor on status failure in `blocked/poll_failed`, but originally has no foreground listeners; only the Continue Polling button invokes exact resume. ConversationPage is still busy, so P2D's canonical arrival补窗 cannot replace this reader. Notifications were not the failure being repaired.

Production scope is one file: `packages/app/src/features/chat/runtime/useChatRuntime.ts` (+38/-1). Visible visibilitychange/focus/pageshow/online invoke existing exact `resumePolling`, with route binding/listener cleanup/current operation identity. The synchronous authoritative transition prevents bursts from acquiring a second polling chain. Requests capture a foreground-event generation: if the old suspended GET rejects after a new visible event, consume that event once via the same command. A replacement GET captures the consumed generation, so a second failure without a new event remains honestly blocked/manual-recoverable. Token/cursor, preserveStop, terminal canonical fetch/apply/marker clear/release, notification policy and send POST protocol are unchanged. No automatic mount retry, live watchdog or keepalive added.

## Diagnostic and repair trajectory (not acceptance verdicts)

1. New real-ConversationPage test `visible visibilitychange resumes retained cursor and reconciles once without a second POST` ran against unchanged production: RED, full reply `第一段第二段` absent after the event. This reproduces the missing recovery, not a fabricated backend failure. One selected test failed; other11 were not selected by this diagnostic `-t` run. Log `/tmp/red_chat_foreground_resume_20261002_112832.log`.
2. First construction focused run:9 failed/3 passed. Concrete source defect: listener captured mount epoch, but `executeTurn` increments the operation epoch on every send. Corrected to route-bound attached flag + current conversation; resume/request retain current-operation identity gates. Concrete fixture defect: live accepted-stop path does not emit the blocked-stop toast; replaced that assertion with actual disabled Stop semantics, keeping exact one Stop POST and terminal/lease checks. No assertion removal/skip.
3. Targeted recheck:12/12, then adjacent101/101. Full relevant suite and frontend checks subsequently executed once; results below. No redundant post-pass self-review loop, no independent review subagent spawned.

## Decisive construction evidence

File: `packages/app/src/test/chat_foreground_resume.test.tsx` (12 cases; real runtime/client/storage/query/ConversationPage, only HTTP simulated).

| Test | Decisive assertions |
|---|---|
| `visible %s resumes retained cursor and reconciles once without a second POST` × visibilitychange/focus/pageshow/online | Exactly requests `[cursor0/token tok63abc, cursor1/same token, cursor1/same token]`; one send POST; maxActive GET=1; canonicalReads=1; exactly one complete assistant text; lease absent; Continue/error/Stop removed; later idle burst requests remain3. |
| `hidden bursts do nothing; visible bursts create only one in-flight resumed GET` | Hidden burst requests remain2; visible burst starts third pending GET only; repeated live burst remains3, active=1; completion common exact assertions. |
| `foreground before suspended GET rejection consumes that event once, then completes` | Visible event while GET pending creates no parallel request (still2); delayed old rejection then recovers to common exact completion assertions without another event. |
| `a second failure without another event stays blocked; manual Continue remains functional` | Replacement failure remains3 requests even after650ms; retained lease remains valid; manual Continue completes from cursor1 with exactly `[0,1,1,1]` and maxActive=1. |
| `route change aborts resumed GET; late completion and later events cannot affect the new chat` | Old signal aborted; late completion absent in chat64; chat64 lease absent; chat63 cursor remains1; no old canonical read; events/unmount do not start old work. |
| `unmount removes foreground listeners while an eligible paused lease remains durable` | All four listeners removed; later visible burst requests remain2, old lease remains durable. |
| `foreground does not bypass uncertain async acceptance` | Malformed ACK remains send-locked; zero status GET/one POST after events. |
| `foreground does not bypass a cursor-persist storage failure` | Storage retry still required; one status GET/one POST after events; recovery button remains. |
| `accepted stop survives foreground recovery without another stop POST` | Accepted Stop button disabled; delayed poll failure + visible recovery follows existing stopped terminal/reconcile; one send/one stop, maxActive1, lease cleared. |

Generality beyond the reported lock→unlock example: all four independent triggers, hidden bursts, delayed rejection *after* foreground, continued outage/manual recovery, active Stop and route/unmount abandonment are tested. SSE/idle/terminal/unrecoverable states are not resume-eligible in source; existing SSE/lease/reconcile/storage/stop regression is retained unmodified. Physical browser suspension is not simulated as a real device and cannot be asserted as observed.

## Commands / exact results

Node `v25.7.0`, pnpm `11.5.1`; existing documented WebStorage compatibility alignment: `NODE_OPTIONS=--no-experimental-webstorage`. This disables experimental Node WebStorage, not tests or browser production behavior.

- `pnpm --filter exo-app test:run src/test/chat_foreground_resume.test.tsx`:1 file/12 tests PASS, failed0/skipped0. External `/tmp/lr01_recheck/01_chat_foreground_resume.log`.
- Adjacent test command: `pnpm --filter exo-app test:run src/test/runtime_lifecycle.test.tsx src/test/runtime_r4_invariants.test.tsx src/test/runtime_r5_invariants.test.tsx src/test/runtime_r6_invariants.test.tsx src/test/p2d_d1_arrival_reconciliation.test.tsx src/test/p2d_optimistic_canonical_replacement.test.tsx src/acceptance/p2d_d1_arrival_acceptance.test.tsx src/acceptance/p2d_closure_issues_1_2_acceptance.test.tsx`:8 files/101 PASS, failed0/skipped0. Existing acceptance tests executed only, unmodified. External `/tmp/lr01_recheck/02_adjacent_suite.log` (runner additionally supplied verbose confirmation; not requested or used as another construction cycle).
- `pnpm --filter exo-app typecheck`:exit0/no diagnostics.
- `pnpm --filter exo-app lint`:exit0/no diagnostics.
- `pnpm --filter exo-app build`:exit0; Vite4419 modules, PWA precache91. Existing large-chunk (>500kB) and inlineDynamicImports-deprecation warnings; ignored dist has0 tracked files, pre/post git status identical.
- `pnpm --filter exo-app test:run`:whole exo-app default suite, **103 files/1345 tests PASS**, no failures/skips/exclusions. Exit0,37.73s. jsdom HTMLMediaElement.pause not-implemented notices, not failures. Complete logs `/tmp/lr01-mech-verify/01-typecheck.log`, `02-lint.log`, `03-build.log`, `04-test-run.log` and exit files (all0).
- `git diff --check`:exit0; own source/tests/docs only. Frozen spec content SHA256 `26fd8936d8510e8a40a72baa8c32f00b1f464d862cbcbfd54b5e419b2a3ba1e5` unchanged vs trace commit. No Acceptance report/spec edits.

## Builder personal self-check / boundary

Read the real dispatch/poll/resume/stop/terminal/reconcile/route-effect paths and current diff; verified test assertions and batch results against memo/frozen behavior. Late GET handlers check epoch+conversation before applying results; removed route callbacks have attached=false and cannot initiate recovery. Existing terminal handler gates reconciling and canonical replacement remains sole read owner. No async POST, token replacement, notification component, backend or shared contract edits in this fix.

**Construction deviation/optimization:** No external behavior/scope deviation. Added bounded event-generation handling instead of only naive listeners, because a foreground event may precede old GET rejection. Route lifetime cannot use mount-time operation epoch; each send changes that epoch. These are internal corrections, not broadened recovery states.

**Residual/release:** An existing live GET that never settles is not restarted; this narrow fix applies to retained poll_failed recovery only. Actual Android send→lock→completed arrival→unlock needs Alicia's observation to confirm automatic canonical reply/no duplicate/no stale busy/banner. No device smoke, real sends/preset writes, paid probes, backend/runtime restarts or hidden services run here. Effective C2 and P3 remain held pending Acceptance/device disposition. Diagnosis/memo updated; no successful release update log or archive performed.
