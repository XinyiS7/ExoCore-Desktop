# P3 CP0 — KF-07 Independent Verification

Owner: Solaire (Acceptance). Scope: isolated diagnosis only, not C3.

## Verdict: FAIL — preparation gate remains HOLD

Independent scout verified CalendarWidget.jsx:69–83 → shared transport → real ScheduleEntrySerializer/model/view. The real quick-create UI omits start_date, emits description:null, and catches errors only in console. No note input exists in the rendered quick form, so the null description is deterministic in that path, not merely a user choosing an empty note.

Independent test-runner re-ran Plan/Diagnostics/v4_p3_kf07_serializer_probe.py: exit 0, 21/21 assertions. Reproduction rejected with exactly start_date required and description non-null errors; correcting only either field still fails. Complete modal synthetic payloads for todo/periodic/goal pass validation. DB/network counters empty; positive blocking controls succeed. Dummy settings and blockers precede setup; no production settings, real data, HTTP, save, services or GCal used.

Probe execution PASS means the diagnosis is reproducible, NOT that Task creation works. Evidence covers real serializer validation with synthetic payloads plus independently traced UI source, not browser submission/HTTP201/persistence or the unique cause of the historical user report.

## Repair packet — separately authorized Desktop/V3 bugfix

- KF07-F01 / P1 / new: real quick-create source payload violates existing required/non-null contract. Confirmed root cause; required outcome: send valid start_date and string/omitted description without changing backend validation or the chosen deadline. Suggested mapping: mirror full modal's start_date default (local today), retain selected/deadline date as due_date; clarify semantic choice before implementation. Adjacent cases: selected date differs from today, absent/custom deadline, description compatibility, all three complete-modal payloads.
- KF07-F02 / P1 / new: rejected quick-create has console-only feedback. Required outcome: visible error, retained user input, pending guard preventing repeated submit. Verify rejection and network/uncertain-result behavior; do not promise blind resubmission cannot duplicate.
- KF07-A01 / advisory: ReactSheet old §4.1 schema contradicts current API. Documentation correction must follow authoritative source; not a request to resurrect priority or alter backend API. Keep separate from production repair scope.

Preserve: River plan/behavior spec, complete modal semantics, backend required fields, V3 compatibility, real DB, historical C2/B2 evidence. No HTTP201/DB success claim permitted without authorized isolated verification.

## Release condition

Alicia must authorize the separate V3 bugfix before Builder changes production. After repair, submit concrete UI/payload/error/pending regression evidence, including cases beyond the original two-field reproduction. If isolated HTTP/persistence verification is proposed, establish safe test settings/DB first; no default production settings or real data probes. Solaire rechecks before CP0 closure and CP1 release. No production repair is authorized by this report.

Tracked production changes absent per scout; untracked frozen documents have no committed hash baseline, so mtime alone is not proof of immutable contents. No frozen-artifact mutation allegation raised.

Cycle: R1 | Checkpoint: CP0/KF07 | Baseline: current unchanged source + retained diagnostic probe | Verdict: FAIL
Owners: Construction 0 repairs; Acceptance 1 review; Harness 0 defects; Spec 0 changes; Environment 0 blockers
Findings: KF07-F01, KF07-F02 | Consecutive FAIL Count: 1

Evidence: Plan/V4_Phase_3_KF07_Diagnosis.md; Plan/Diagnostics/v4_p3_kf07_serializer_probe.py; independent scout and test-runner bounded results.

---
## R2 — separately authorized V3 repair recheck

Verdict: PASS for KF07-F01/F02; CP0/KF07 preparation gate CLOSED. This is not C3 PASS or live HTTP/persistence acceptance.

Alicia explicitly authorized the separate V3 bugfix after R1. Independent scout verified production diff scope only CalendarWidget.jsx (+41/-16); valid start_date computed on submit using local getters, chosen deadline retained as due_date, description string, sync ref/pending submission guard, controls locked pending, visible alert with retained inputs, positive integer result-id check and uncertain-write messaging. No load-after-success catch path that could falsely encourage repost was found. Complete modal/shared/backend/River remained unchanged.

Independent execution:
- File-specific Vitest, via native-shell process TZ=Asia/Shanghai: 1 file, 10/10 tests, exit 0. Node offset -480.
- Same file TZ=America/Los_Angeles: 1 file, 10/10 tests, exit 0. Node offset +420. Both TZ settings genuinely reached Node; git-bash prefix alone did not, so runner corrected launch environment without changing tests.
- Full exo-chat-core test:run: 15 files, 102/102 tests, no failed/errors/skipped, exit 0.
- exo-chronicle build: exit 0; nonfatal existing ineffective dynamic-import/PWA deprecation warnings.
- Retained real serializer dummy probe: 21/21 assertions, exit 0; no DB/network calls; blocking controls active. No production settings/HTTP/DB persistence/services/GCal used.

Existing repair tests import the real V3 component with mocked transport. Counterexamples include chosen date distinct from today, submit-time midnight rollover, failures retaining inputs, synchronous click/Enter reentry, known-400 explicit resubmit, network/503/invalid-success response and IME. Running both actual non-UTC TZs closes the prior weakness of timezone-dependent coverage.

Nonblocking/out-of-scope: route unmount/remount can abandon instance-local in-flight protection; this release does not establish a cross-route idempotency mechanism. Existing UTC date dots/full-modal default timezone differences were not repaired. No new cross-refresh queue or backend idempotency requirement is introduced. Additional Escape/string-id examples would be optional coverage, not unmet frozen repair gates.

Integrity limit preserved: untracked frozen artifacts have no pre-change committed/hash baseline; no mutation evidence was found, but timestamps are not asserted as cryptographic proof. Independent runner pre-read confirmed retained probe safety and reran it without changes.

Release: pane7 may start CP1 only, based on the Detailed Plan and frozen behavior input. River production navigation/ownership switch stays for the authorized later integration and C3 gate; no CP2–CP4 advance before CP1 handoff/release. Do not modify acceptance-owned reports/specs or real data; do not commit without authorization.

Cycle: R2 | Checkpoint: CP0/KF07 | Baseline: CalendarWidget-only production repair + Builder tests | Verdict: PASS
Owners: Construction 1 repair; Acceptance 1 recheck; Harness 0 defects; Spec 0 changes; Environment 0 blockers
Findings: KF07-F01 CLOSED, KF07-F02 CLOSED; KF07-A01 remains documentation advisory | Consecutive FAIL Count: 0
Evidence: Plan/V4_Phase_3_KF07_Repair_Execution_Log.md; packages/chat-core/src/components/calendarWidget.kf07.test.jsx; independent scout/test-runner bounded results.
