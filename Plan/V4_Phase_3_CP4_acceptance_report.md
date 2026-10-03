# V4 P3 CP4 — Independent Acceptance Report

Owner: Solaire. R1 Verdict: PASS for CP4 implementation checkpoint.
C3 NOT decided; browser/visual integration remains open.

## Source verification

Independent scout traced canonical Legacy GET/type gate, exact PATCH event_time/content/scope/keywords and identity preservation, permanent irreversible DELETE confirmation, 204 handling, failure retaining dialog/row, and highlight/404 disabling writes. event_time changes rebuild River traversal without removing page-owned Memo drafts. No backend compare-and-swap guarantee is invented.

Heartbeat selected session is URL-derived; row select/close preserve unrelated params; empty/malformed UUID is explicit without lookup; back/forward selection derives from URL. Detail data is checked against preset before rendering, cache key includes preset, and River links use real preset/session. Existing read-only/no-ack behavior retained.

River is mounted directly under AppShell at /app/river with the validated scroll owner; navigation enabled as authorized. DETAIL_PATH/Groups/Library/root redirect/V3 compatibility/ownership not changed. Prior CalendarWidget diff is the authorized KF07 repair, not unexplained CP4 scope.

## Mechanical evidence and environment incident

Independent exact 16-file scope: 247/247 passed, exit 0, including 86 cases across Legacy/deeplink/existing HB page/shell. typecheck/lint/build exit 0.

Initial default full-suite run on Node v25.7.0: 26 failed files, 211 failed tests; 90 files/1278 tests passed (116/1489 total). This failure is retained, not silently overwritten.

Isolated root cause: Node 25 exposes an experimental global localStorage object with undefined getItem/setItem when no backing file is configured. It survives into Vitest/jsdom and prevents its expected browser storage behavior. No product regression inferred merely from those failures.
- Node help confirms --no-experimental-webstorage is supported.
- runtime_storage.test.ts default A: 13/13 fail with missing getItem/setItem.
- Same test B, only per-process NODE_OPTIONS adding that flag: 13/13 pass; child localStorage undefined before jsdom initialization.
- Diagnostic full B: 116 files/1489 tests pass.

Acceptance selected this isolated process setting for the formal jsdom gate (not a product/test relaxation). Formal native-spawn command: per-process NODE_OPTIONS=--no-experimental-webstorage, pnpm --filter exo-app test:run. Node v25.7.0 / pnpm 11.5.1; child flag propagation checked. Result: 116 files, 1489 passed, 0 failed/skipped/errors, exit 0. Runner repeated the same formal command once to capture exit; both results identical, not additional coverage. No repository files, system environment, test expectations or product code changed to obtain PASS.

Known reproducibility condition: default Node25 command remains failing until runner configuration/Node compatibility is separately resolved. Use the explicit single-process flag for this environment; do not claim the unqualified default script passed. Browser behavior remains unaffected by this test-process setting.

Frozen CP2 probe SHA256 matches recorded CP2 baseline before/after runs: 1c3bd12cc1322d6d368842ea1bd32cf1aeaf7e2f6ad99f3fb876e017e4c130c2.

No real HTTP/DB/GCal/paid/services or private/env file access. Full-suite PASS is mechanical evidence, not visual/live-service acceptance.

## Remaining final gate

CP5 release limited to Builder evidence consolidation and a safe browser/visual validation proposal. Do not write Acceptance verdicts or change roadmap/ownership/production root. C3 still awaits real rendered desktop/mobile light/dark, scrolling/drawer/focus and cross-feature navigation verification, including Task busy-state focus. Any runtime service or real-data action requires explicit approved setup; a self-contained mock-backed browser check may be proposed without real writes.

Do not re-run unrelated C2/B2 or expand the scope to fix Node25 globally. Report the environment condition as evidence. Existing nonblocking negative-case/async staleness observations do not introduce new MUST gates.

Cycle: R1 | Checkpoint: CP4 | Baseline: Legacy/Heartbeat deeplink/River route integration | Verdict: PASS
Owners: Construction 0 blockers; Acceptance 1 review; Harness 0 assertion defects; Spec 0 changes; Environment 1 diagnosed runner condition
Findings: none blocking implementation | Consecutive FAIL Count: 0
Evidence: Plan/V4_Phase_3_CP4_Execution_Log.md; independent scout/runner outputs and Node25 A/B diagnosis.
