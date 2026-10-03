# V4 P3 CP3 — Independent Acceptance Report

Owner: Solaire. Scope: Task CRUD/source actions/Shelf/Calendar construction checkpoint.

## R1 Verdict: PASS

Not C3, final full-suite, real HTTP/DB/GCal or visual acceptance.

Independent source checks compared Task types/API/payloads/actions/dialogs with real backend models/serializer/views and calendar writer. Confirmed:
- todo/periodic/goal required and nullable fields, immutable entry_type on edit and explicit write whitelist; tags preserve per-item commas/newlines, no separator corruption;
- local-calendar quick defer for todo; periodic/goal native date editing and impact explanation;
- complete consumes CompletionRecord and rereads source status/counters; not all completed tasks disappear; archive confirmation and soft-delete semantics;
- completions use entry query; GCal confirmed push/unlink and failure copy do not claim two-way sync or PATCH-guaranteed remote success;
- page-lived action owner, busy guard and one modal stage; create/complete reset River traversal, other source reads invalidated;
- calendar and today use their own metadata/window/events; date-only exclusive end and timed local-day half-open intervals; no arbitrary 120-day event truncation;
- full Task list includes goal/suspended/archived separately from limited snapshot; pure GCal events do not gain Task edit actions;
- snapshot reread is not presented as regeneration, 503/outside-window are not presented as empty, GCal completeness limitations are explicitly disclosed;
- no CP4 route/nav/Legacy/Ledger or backend work in CP3. Prior CP1 scroll and CP2 reply lifetime retained.

## Independent execution

- Task API/UI/calendar-date tests: 3 files, 42/42, exit 0.
- Exact cumulative scope (Task 3 + prior Memo/River/shell/HB/probe 9): 12 files, 173/173, zero failures/errors/skips, exit 0.
- Task API/date tests under actual native TZ=Asia/Shanghai (offset -480): 18/18, exit 0; America/Los_Angeles (offset +420): 18/18, exit 0.
- exo-app typecheck/lint/build: exit 0 each. Nonfatal Node localstorage and existing PWA deprecation warnings.
- Frozen CP2 probe before/after SHA256: 1c3bd12cc1322d6d368842ea1bd32cf1aeaf7e2f6ad99f3fb876e017e4c130c2, matching the CP2 R2 recorded value.

No final whole-app suite or true browser visual run represented by these counts. No real DB/HTTP/GCal/paid/service activity, no production or test edits by Acceptance.

## Nonblocking observations / integration targets

1. Task dialog roots are programmatically focusable, but no explicit pending-focus anchor is supplied when all action controls become disabled. Whether focus escapes depends on browser behavior; not a demonstrated P1. Check busy-state focus in final browser validation, preserve in-flight safety rather than enabling unsafe cancellation merely for focus.
2. Calendar coverage metadata is date-only while GCal retrieval boundaries can be instant-based and partial/fallible. Existing copy explicitly limits claims to snapshots and warns of missing GCal data. Do not upgrade it to complete source-of-truth wording; no new backend requirement here.
3. Invalid calendar dates matching a YYYY-MM-DD regex or inverted windows are not fully rejected; current source writer does not emit them. Defensive coverage suggestion, not demonstrated contract failure.
4. Today nonempty, success-then-refetch-error, task detail 404 and calendar-return-after-edit are useful final integration targets. Current source paths and error gating do not establish a defect merely from missing targeted tests.

Untracked CP3 artifacts have no older hash baseline, so historical no-change claims are not cryptographically attested; frozen CP2 probe has the explicit comparable hash above.

## Release

CP4 only: Legacy milestone/moment details/PATCH/permanent DELETE confirmation, Heartbeat Ledger session deep-link, River route and authorized navigation integration, as Detailed Plan. This authorizes the planned V4 entry integration, NOT ownership transfer, C3 PASS or product root redirect. Preserve CP1–CP3 behavior. Deliver exact integration tests and stop for independent review before CP5/final regression/ownership updates. Acceptance artifacts are read-only to Builder; no cross-repo edits or unapproved commit.

Cycle: R1 | Checkpoint: CP3 | Baseline: Task source-action/Calendar implementation + retained CP1/CP2/KF07 | Verdict: PASS
Owners: Construction 0 blockers; Acceptance 1 review; Harness 0 defects; Spec 0 changes; Environment 0 blockers
Findings: none blocking | Consecutive FAIL Count: 0
Evidence: Plan/V4_Phase_3_CP3_Execution_Log.md; independent source scouts and test-runner bounded results.
