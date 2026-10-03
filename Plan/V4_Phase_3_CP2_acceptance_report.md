# V4 P3 CP2 — Independent Acceptance Report

Owner: Solaire. R1 Verdict: FAIL. Scope: CP2 Memo/Tags/thread, not C3.

## CP2-F01 / P1 / new — root creation clears pending reply failure state

Frozen invariant: behavior input B9 requires POST failure to preserve draft and uncertain outcome to remain visible; applies to root and reply composers. Same-page root creation is not a cross-route/reload persistence requirement.

Confirmed trace: memo/queries.ts:55–72 creates root then cancel/reset River pages (:64–65). Query reset with no initialData clears page data. RiverPage.tsx:24,75–78 removes cards, unmounting MemoThread/MemoComposer. Reply draft/error are local Composer state (:9–24); delayed POST rejection calls setError on the unmounted instance. Page-level pending map retains tag failures only, not reply POST draft/uncertain outcome.

Independent runtime reproduction:
1. Open original root memo:7; type reply draft and start a deferred reply POST.
2. Create another root successfully; hold its River refetch to expose the realistic loading window.
3. Reply returns 503 during that window; complete refetch with original memo:7 still present.
4. Reopen original thread: expected prior draft plus uncertain alert; actual reply textarea is empty.

Acceptance-owned probe: packages/app/src/test/acceptance/cp2_b9_reply_draft_reset.acceptance.test.tsx
Test: keeps the reply draft + uncertain alert through a root-create River reset, with exactly one reply POST.
Result: 1 test, FAIL, exit 1; line 87 expected textarea value 'B9 保留回复草稿', received empty. Subsequent alert/call-count assertions are not claimed to have executed after the first failure.

The delayed mock GET represents a real refetch latency window, not special production branches. Immediate non-concurrent mocked responses did not reliably unmount the cards; the independently reproduced defect is specifically the pending-reply/refetch sequence above.

Required outcome: same-page root creation/rebuilding traversal must not silently destroy another reply's draft, real parent target or pending/failed/uncertain state; no duplicate POST and no reply insertion into main axis. Preserve explicit fresh first-page/cursor semantics. Suggested directions: preserve affected component lifecycle while traversing anew, or retain bounded same-page reply state above replaceable cards. Builder chooses implementation; do not add persistent queues, backend idempotency, global state framework or merely delay reset until an arbitrary timeout. Merely waiting for a request to settle is insufficient if subsequent reset discards its failure state.

Verification: rerun the unchanged acceptance probe; add Builder-owned sibling cases beyond it (failed reply then root refresh with delayed GET; in-flight reply success during refresh; real parent target and independent multiple thread drafts). Explain lifetime/ownership of draft and error, not just the specific mocked timing. No requirement for cross-route/session persistence is added.

## Passing evidence / preserve

Independent scout traced two-step POST/PATCH, validated returned id/parent, same-id tag lock, separate pending contexts, manual Tags success clearing stale retry, Unicode tag limits, direct reply_count derivation, true parent tree, capabilities and safe Markdown. Preserve these, CP1 scroll owner and KF07 repair. Route/nav/Task/Calendar/shared/backend remain outside CP2.

Independent runner: exact seven Builder test files 127/127 passed, exit 0; typecheck and lint final exit 0. New file count clarified: two test files + one fixture (24 new tests), not three executing files. No build/final full suite while P1 open. No real HTTP/DB/env/services/GCal/paid operations.

Probe-only TS helper error was corrected before final typecheck; this is not a production finding. Independent probe is now frozen, Acceptance-owned: Builder may execute but must not edit it or this report/spec. Additional repair regressions belong in Builder tests.

Other uncovered capabilities/negative-reply examples are coverage observations, not separate blockers without demonstrated violations. Untracked artifacts have no original hash baseline; no timestamp-only immutability claim.

## Release condition

CP2-F01 repair only under existing CP2 authorization. Deliver root cause/lifetime explanation, changed files and concrete generalized regressions; stop for focused recheck. No CP3 advance or C3 verdict.

Cycle: R1 | Checkpoint: CP2 | Baseline: CP2 uncommitted Memo/River integration | Verdict: FAIL
Owners: Construction 1 defect; Acceptance 1 review; Harness local setup corrected; Spec 0 changes; Environment 0 blockers
Findings: CP2-F01 OPEN | Consecutive FAIL Count: 1
Evidence: Plan/V4_Phase_3_CP2_Execution_Log.md; independent scout trace; acceptance probe and runner results.

---
## R2 — CP2-F01 focused recheck

Verdict: PASS for CP2 checkpoint; CP2-F01 CLOSED. Not C3 or live/visual acceptance.

Independent source inspection confirms reply content/real parent/error/saving and synchronous guard now belong to a RiverPage-scoped hook, rather than replaceable cards. Updates merge from current ref state per rootId; stale closures cannot overwrite another thread's record. In-flight parent/content changes and repeated submit are blocked. Successful POST clears only the corresponding draft; failure writes back to surviving page state. Root composer remains local and unchanged in behavior; root reset/new-cursor semantics remain in place, with no timers, retained stale page chain or persistent queue.

Independent execution:
- original acceptance probe alone: 1/1 PASS, exit 0;
- Builder sibling regression file: 3/3 PASS, exit 0;
- combined nine files: 131/131 PASS, no failures/errors/skips, exit 0;
- typecheck/lint/build: each exit 0.

Independent runner read the full sibling tests and verified decisive assertions: previously failed draft/uncertain alert/real parent survive reset; in-flight reply stays disabled across remount and upon success clears only itself, performs one POST/one tags PATCH and never enters the main axis; two different threads absent from new homepage recover distinct drafts/parents after following the fresh cursor. Original root event time remains unchanged. These cover more than the original deferred-503 reproduction.

Acceptance probe SHA256 immediately before/after independent run: 1c3bd12cc1322d6d368842ea1bd32cf1aeaf7e2f6ad99f3fb876e017e4c130c2. This proves this run did not alter it, not immutable history since freeze; no prior Acceptance-owned hash baseline was recorded. Current assertions match R1's recorded failure and scenario. No mutation allegation or unsupported git/mtime claim.

Known boundaries: Accordion open/closed UI may reset when cards are replaced; reopening restores draft/error/parent. Cross-route/browser-refresh persistence is not promised. No true HTTP/DB/visual evidence claimed, no final full-suite run yet. Theoretical post-confirmed cache-publication exceptions are not demonstrated production defects and do not add a gate.

Release: CP3 Task CRUD/Shelf actions/Calendar only under the Detailed Plan and frozen behavior input. KF07 already CLOSED; retain its fix and passed CP1/CP2 behaviors. Do not activate production navigation or implement CP4 Legacy/Ledger integration early. Deliver concrete source-action/cache/date/Calendar evidence and stop for independent review.

Cycle: R2 | Checkpoint: CP2 | Baseline: page-owned reply lifetime repair + generalized Builder tests | Verdict: PASS
Owners: Construction 1 repair; Acceptance 1 recheck; Harness 0 remaining defects; Spec 0 changes; Environment 0 blockers
Findings: CP2-F01 CLOSED | Consecutive FAIL Count: 0
Evidence: Plan/V4_Phase_3_CP2_F01_Repair_Log.md; independent scout and test-runner results.
