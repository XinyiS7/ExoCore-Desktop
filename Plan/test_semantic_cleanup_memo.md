# Test semantic cleanup memo — H1 heartbeat_api R1-F01 nested queue block

**Status:** Closed — Desktop H1 test-only refactor; independent QC PASS (see closure section); no push.
**Repo:** ExoCore-Desktop (`packages/app`).

## Scope

- Single file: `packages/app/src/test/heartbeat_api.test.ts`, only the
  `R1-F01: nested queue validation & no coercion` describe inside
  `normalizeHeartbeatQueueSummary` (was lines ~118–400).
- Consolidate repeated full `validBaseQueue` / `next_auto` / note / wakeup
  literals into small local fixture factories (`queue`, `nextAuto`, `note`,
  `wakeup`) returning fresh objects per call.
- Convert the 10 assertion-group `it` blocks into grouped `it.each` tables with
  readable per-row labels.
- Out of scope (must remain unchanged): top-level malformed-response tests,
  event-list / event-detail R1-F01 blocks (nonnullable details), all API
  endpoint and write-operation blocks, production code, shared test helpers,
  other test files.

## Goal

- Preserve each of the 21 preexisting contract assertion inputs 1:1, with the
  same `AppApiError` rejection expectation and no weakened assertions:
  next_auto `[]`; task_id `0`, `'101'`, `10.5`; resume_check `1`, `'false'`;
  target_utc `''`; next_auto status `unknown_status`; cadence_mode `'fast'`,
  `''`, `null`; explicit wakeup status `active`; pending_notes `[[]]`, id `0`,
  message `12345`, `[valid, bad-id]`; explicit_wakeups `[[]]`, task_id `0`,
  resume_check `'false'`; unshown_explicit_count `-1`, `2.5`.
- One table row = one independent test (no branching mega-test); fixture calls
  yield fresh per-case values so no row can leak mutation into another.
- Net reduction of duplicated fixture lines while keeping readable labels.

## Validation

1. Baseline (recorded before edit):
   `pnpm --filter exo-app test:run src/test/heartbeat_api.test.ts` → 46 passed.
2. After edit: same command → expect 57 passed
   (46 − 10 old groups + 21 table rows); each row maps 1:1 to the Goal list.
3. Focused `heartbeat_page.test.tsx` run after edit (page code byte-identical;
   cheap imported-helper guard).
4. `pnpm --filter exo-app exec eslint src/test/heartbeat_api.test.ts` and
   `pnpm --filter exo-app typecheck`.
5. `git diff --check`; `git diff --stat` for net LOC savings; verify the diff
   touches only this test file plus this memo.

## Independent QC result (closure)

- **57/57 PASS** — `pnpm --filter exo-app test:run src/test/heartbeat_api.test.ts`
  (46 baseline − 10 old groups + 21 table rows); `git diff --check` PASS.
- **21/21 malformed inputs preserved** — 8 next_auto + 3 cadence_mode +
  4 pending_notes + 4 explicit_wakeups + 2 unshown_explicit_count; each still
  rejected with `AppApiError`.
- **Valid defaults / label integrity** — every row overrides only the field
  under test while all sibling fields stay valid, so each row label names the
  actual failure reason instead of a side-effect of another malformed field.
- **"1:1" clarification** — in the Goal above, "1:1" refers to the invalid
  input/observable contract being preserved (same malformed input → same
  `AppApiError` rejection), not to all previously inline valid fixture literal
  bytes being kept verbatim; the factory consolidation intentionally replaces
  those duplicated literal bytes with fresh-object defaults.
