# ExoCore V4 Phase 0 — Independent Acceptance Report

> **Owner:** Solaire (`gpt-5.6-sol`), independent acceptance
> **Checkpoint:** C0 — Contract & Baseline Freeze
> **Frozen plan:** `Plan/V4_Phase_0_Contract_Baseline_Detailed_Plan.md`
> **Status:** **C0 PASS — R2 independent acceptance complete; Alicia approved checkpoint release on 2026-09-02**

## 1. Baseline pin

- Frontend HEAD: `6b0948e06221fe49ebefa1658825c7e400f7f241`
- Builder index tree before acceptance report: `82bcd2f66ca379494b738c4df3c38276997e74a5`
- Builder staged-diff hash before acceptance report: `7eebd7e5dedbb486a184db49726f944b4f4844bc`
- Frozen Detailed Plan blob: `70874c1821c68093a6a2f0a25ab59aca8ce1c820`
- Frozen Master Roadmap blob: `a28e8faedfa3540ea447f5af13bc13da1aa97445`
- Builder delivery: 17 staged files total: 7 pre-existing frozen planning inputs plus 10 P0-attributable files; no unstaged or untracked Builder files.
- Acceptance report is the 18th staged file and is Acceptance-owned.
- Backend evidence was produced at `21f2a8f7aab6d475692af7716924571542040b8f`. During acceptance, backend HEAD advanced cleanly to `c183a2fdc5974f150a136db2f5e10c79f139d783`; the only intervening path is `Plan/ExoCore_update_log.md`. This unrelated post-construction documentation commit does not invalidate the API/source snapshot and is not attributed to P0.

## 2. R1 factual summary (superseded by R2 PASS)

```text
Verdict: FAIL
Phase/checkpoint: V4 Phase 0 / C0
Consecutive FAIL count: 1
Repeated invariant IDs: none
Baseline: frontend HEAD 6b0948e; Builder index tree 82bcd2f; staged diff 7eebd7e
Gates: checked 28 technical gates (A–E), passed 25, failed 3; release gates F deferred
Findings: new 4, residual 0, repair-regression 0, harness-defect 0, acceptance-miss 0
Independent probes: executed 4, passed 3, failed 1, errors 0, skipped 0
Full regression: deferred because three P1 documentation-contract findings already prevent a final candidate
Unreviewed areas: 0 document/source gate areas; final runtime regression remains deliberately deferred
```

Builder's recorded regression evidence (three SPA builds/smokes, 85 frontend tests, 84 backend tests, Django checks, opening/closing real-DB baseline) is internally consistent and was inspected. It is not rerun in R1 because the current candidate cannot PASS; the complete required pipeline will run on the repaired final candidate.

## 3. R1 gate sweep (superseded by R2 PASS)

| Gate family | Result | Independent evidence |
|---|---|---|
| A — safety/scope | PASS | no V4 package/runtime source; P0-attributable paths limited to baseline docs, handoffs, and `ReactSheet.md`; backend construction hashes clean; AgentPreset baseline remains IDs 1–8 |
| B — V3 baseline | PASS on recorded construction evidence; final independent rerun pending | evidence tables contain command, exit, duration/fingerprint, owner and classification; no unclassified lint/test result; Council frozen as buildable deferred stub |
| C — canonical API snapshot | **FAIL** | valid JSON and correct 40/7/10/9 counts, but 16 resources omit schema-required `errors` or `semantics` keys (A-C0-01) |
| D — ownership/coexistence | **FAIL** | Roadmap rows are present and fallbacks exist, but manual compaction has no exact construction owner; deployment config ownership remains `P1A (or P2)` (A-C0-02/03) |
| E — B1–B4 handoffs | PASS | four independent ten-section briefs; authorization, errors, compatibility, acceptance targets and non-goals present; required B1–B4 invariants retained |
| F — approval/release | DEFERRED | Acceptance cannot write C0 PASS and Alicia cannot approve until R1 findings close |

## 4. Blocking findings

### A-C0-01 — P1 · new · **CLOSED R2** — Canonical snapshot violated its required per-resource schema

- **Observed evidence:** independent JSON probe parsed `Canonical_API_Snapshot.json` and found 16 missing required keys:
  - missing `semantics`: `groupchat.detail`, `conversation.cache`, `conversation.cache.renew`, `runtime.cache.invalidate`, `task.entry.detail`, `task.entry.suspend_resume`, `task.entry.gcal`, `task.completions.list`, `memory.plasmid.tags`, `memory.history_chunk.list_detail`, `memory.compact`, `memory.stop_words`, `notification.push.unsubscribe`;
  - missing `errors`: `task.completions.list`, `memory.scope_keywords`, `memory.stop_words`.
- **Violated invariant:** frozen Plan §8.1 requires every `resources[]` entry to contain request/response/**error semantics** and a `semantics` field; C0 §17.C requires every resource to contain request/response/error semantics.
- **Root cause:** confirmed — individual JSON entries omitted keys even though README marked the whole criterion complete.
- **Affected siblings:** all 40 resource entries and README C-checklist claim.
- **Required outcome:** every resource has every required key. Populate omitted `errors`/`semantics` with source-grounded facts or an explicit statement that no endpoint-specific behavior exists beyond the documented transport/DRF default; do not fabricate stable errors.
- **Suggested direction (non-binding):** run one structural completeness check over all 40 entries after editing rather than repairing only the named list.
- **Chained effects:** resource count/domain/mismatch totals must remain 40/7/10/9; `ReactSheet.md` must remain consistent.
- **Verification targets:** JSON built-in parse; required-key scan returns zero missing; duplicate IDs/unknown values/bad mismatch refs remain zero.
- **Preserve recommendation:** preserve all currently verified endpoint facts and mismatch classifications.
- **Escalation trigger:** pause if source inspection cannot establish honest semantics for an entry; do not use `unknown` to force a pass.

### A-C0-02 — P1 · new · **CLOSED R2** — Manual compaction ownership was not frozen to one construction gate

- **Observed evidence:** `V3_Capability_Ownership.md` row `➕ compaction` says disposition `migrate to P5 (or P1B runtime artifact)` and construction gate `P1B–P5 (owner decision at P1B planning)` while transfer is C5.
- **Violated invariant:** frozen Plan §9.1 requires `construction_gate` to be one of P1A/P1B/P1C/P1D/P2…P8; C0 §17.D requires every capability to have a construction gate and transfer gate. P0 is the ownership freeze, so it cannot defer the owner back into P1B planning.
- **Root cause:** confirmed — an omitted Roadmap capability was discovered but left with a phase range instead of assigned ownership.
- **Affected siblings:** completeness note and P1B/P5 scope boundary.
- **Required outcome:** assign one construction phase and make disposition, construction gate, transfer gate, and minimum condition internally consistent.
- **Suggested direction (non-binding):** P5 is the cleaner owner because this is a manual Memory management surface and the row already transfers at C5; P1B need only preserve runtime behavior that actually belongs to core send/recovery.
- **Chained effects:** P1B and P5 future Plans must cite the same owner.
- **Verification targets:** no in-scope migrated capability contains a phase range or `owner decision` placeholder.
- **Preserve recommendation:** preserve all other P1A–P1D mappings and unified C1 ownership rule.
- **Escalation trigger:** discuss with Alicia only if assigning compaction changes product visibility rather than technical ownership.

### A-C0-03 — P1 · new · **CLOSED R2** — Side-by-side config ownership was not exact

- **Observed evidence:** `V4_Side_by_Side_Contract.md` assigns both `../nginx/nginx.conf` and `../hybrid_start.ps1` to `P1A (or P2)`. Its checkpoint table also says `V4 stays V3-primary`, which reverses the intended owner wording.
- **Violated invariant:** frozen Plan §10.3 requires **exact ownership of each future config change by phase**; §10.2 and C0 §17.D require V3 to remain primary through P1A–P1D until unified C1.
- **Root cause:** confirmed — coexistence timing was described as alternatives rather than frozen ownership, plus one owner-label typo.
- **Affected siblings:** P1A/P2 deployment handoff boundary and checkpoint wording.
- **Required outcome:** assign one owning phase to each config surface and state unambiguously that **V3 remains primary** through P1A–P1D.
- **Suggested direction (non-binding):** assign additive `/app/` nginx and `hybrid_start.ps1` mounting to P1A if C1A includes production-like side-by-side exposure; otherwise choose a single later phase and make its entry gate explicit. Do not retain `or` ownership.
- **Chained effects:** P1A Detailed Plan must respect the selected repository/config handoff boundary.
- **Verification targets:** ambiguity scan has no `P1A (or P2)` and checkpoint text identifies V3 as primary/fallback correctly.
- **Preserve recommendation:** preserve `packages/app`, `exo-app`, strict 5176, `/app/`, PWA identity, P7 cutover and P8 deletion boundaries.
- **Escalation trigger:** pause only if the chosen config phase would require unauthorized cross-repository edits; then record a handoff owner rather than silently editing outside the frontend repo.

## 5. Mechanical finding included in this repair

### A-C0-M01 — P2/mechanical · new · **CLOSED R2** — Evidence wording/count drift

- **Observed evidence:** README claims the ownership matrix has “all Roadmap §16 rows + 4 added”; Roadmap has 38 rows and the matrix has 41, with exactly three marked additions. README §3 calls four groups “Known blockers” and immediately states none blocks C0.
- **Owner:** Construction documentation.
- **Recommended outcome:** change `+ 4 added` to `+ 3 added`; rename the heading to `Known debts / deferred risks` (or equivalent non-blocking wording). Correct the `V4 stays V3-primary` typo as part of A-C0-03.
- **Disposition:** include now because these are acceptance-manifest truthfulness fixes; they do not expand scope.
- **Recheck:** row-count comparison and wording scan.

## 6. Preserve recommendations

- Keep all ten P0-attributable construction paths within documentation/evidence scope; do not edit V3 runtime, package/config, lockfile, backend, or real data.
- Preserve the 40-resource API facts, ten mismatch resolutions, nine unavailable/deferred mappings, and scoped `ReactSheet.md` corrections except where A-C0-01 requires adding missing schema fields.
- Preserve B1–B4 scope and all accepted non-goals; no backend implementation is authorized.
- Preserve the seven pre-existing frozen planning inputs byte-for-byte.
- Preserve Council as a separately buildable deferred stub and keep GroupChat MM-05, Task KF-07, lint debt, and attachment KF-10 deferred rather than fixing them in P0.

## 7. Repair order and recheck boundary

1. Complete all missing per-resource schema keys in `Canonical_API_Snapshot.json` and rerun the structural scan.
2. Freeze one owner for manual compaction in `V3_Capability_Ownership.md`.
3. Freeze exact config ownership and correct primary/fallback wording in `V4_Side_by_Side_Contract.md`.
4. Correct README count/heading only; keep C0 verdict/sign-off pending.
5. Stage only those four Builder-owned files and report changed paths plus structural/count results.

**Focused recheck first:** the original JSON schema probe, ownership ambiguity scan, row-count comparison, P0-attributable diff check, frozen-artifact hashes, backend/real-DB safety checks.

**Final regression condition:** only when focused recheck is clean, run the complete C0 pipeline: three isolated builds, root build, chat-core 85-test suite, Django check/migration/focused 84-test suite, final backend hashes, and real AgentPreset baseline. No full regression is required during the repair itself.

## 8. Frozen / do not modify

Construction must not edit:

- `Plan/V4_Phase_0_Contract_Baseline_Detailed_Plan.md`;
- `Plan/V4_Master_Implementation_Roadmap.md` or the other six pre-existing frozen planning inputs;
- `Plan/V4_Phase_0_Contract_Baseline_acceptance_report.md`;
- any V3 runtime/config/package/lockfile/backend file.

Construction should return finding IDs, changed files, structural/count outputs, unexecuted scenarios, and any scope deviation.

## 9. R2 focused recheck and final regression

### R2 factual summary

```text
Verdict: PASS
Phase/checkpoint: V4 Phase 0 / independent C0 acceptance
Consecutive FAIL count: 0
Repeated invariant IDs: none (A-C0-01/02/03 closed on first repair)
Baseline: frontend HEAD 6b0948e; repaired 18-file staged candidate; frozen Plan/Roadmap hashes unchanged
Gates: A–F checked 31, passed 31, failed 0; Alicia approved checkpoint release
Findings: new 0, residual 0, repair-regression 0, harness-defect 2, acceptance-miss 0
Tests: executed 169, passed 169, failed 0, errors 0, skipped 0
Full regression: executed
Unreviewed areas: 0
```

### Focused recheck

- A-C0-01: JSON parses; 40 resources / 7 domains / 10 mismatches / 9 unavailable; all 17 required keys present on every resource; duplicate IDs, bad mismatch references and literal `unknown` values all zero.
- A-C0-02: manual compaction now has one owner, P5, and transfer gate C5; no phase-range/owner-decision placeholder remains.
- A-C0-03: nginx and `hybrid_start.ps1` are each assigned solely to P1A; checkpoint language says V3 remains primary through P1A–P1D.
- A-C0-M01: matrix count is correctly recorded as Roadmap 38 + 3 additions = 41; non-blocking items are labelled debts/deferred risks.
- Frozen Detailed Plan and Master Roadmap blobs remain `70874c18…` and `a28e8fae…`; Acceptance report was not edited by Construction.

### Full regression evidence

- Dependency integrity: `pnpm install --frozen-lockfile` exit 0; no package/lock/source delta.
- Builds: chat-core, chronicle, council and root workspace builds all exit 0; each dist contains `index.html` and `sw.js`; built bases are `/chat/`, `/chronicle/`, `/council/`.
- Dev smokes: ports 5173/5174/5175 each returned HTTP 200 under `--strictPort`; all three listeners were terminated and independently confirmed released.
- Frontend tests: chat-core 12 files / **85 passed**, 0 failed/skipped.
- Lint fingerprints match the frozen known debt exactly: chat-core 168 problems (150 errors / 18 warnings), chronicle/council ESLint 9 flat-config absence, exit 1/2/2.
- Backend at clean `c183a2fd`: Django check 0 issues; migration drift none; focused suite **84 passed**, 0 failed/errors/skipped; tracked and untracked hashes remain empty.
- Real database baseline before and after backend regression: `OK: AgentPreset baseline 8 rows [1, 2, 3, 4, 5, 6, 7, 8]`.
- No `packages/app`, runtime/config/package/lockfile/backend delta, unstaged file, untracked file, or listener on 5173–5175 exists.
- P0-attributable staged patch passes whitespace/patch validation. Pre-existing frozen Markdown inputs retain their already-staged intentional line-break whitespace and were not modified by Construction.

### Acceptance harness corrections

1. The first dev-smoke cleanup attempt used single-slash `taskkill` flags under Git Bash, causing argument conversion and a timeout. Acceptance killed the listener, confirmed port release, corrected the command to `//PID //T //F`, and reran all three smokes successfully. This is a harness defect, not a Builder failure.
2. A first artifact-base grep respected `.gitignore` and therefore did not search `dist/`. Acceptance inspected the built files directly; all three base prefixes were correct. This is a harness defect, not a product finding.

### Accepted limitations / deferred items

- GroupChat MM-05/KF-06 remains a separately owned bugfix/P2 migration risk.
- Task KF-07 remains a P3 entry-gate diagnosis.
- Existing V3 lint debt remains classified and non-blocking; new V4 code receives its own clean gate later.
- Attachment `storage_path` KF-10 remains B1 input.
- Council and Android/Capacitor remain unscheduled and do not enter P1A.
- Backend advanced after Builder evidence only through unrelated `Plan/ExoCore_update_log.md`; no API/runtime source drift occurred.

**Final C0 disposition:** PASS. Alicia explicitly approved C0 and authorized the checkpoint commit on 2026-09-02. Acceptance wrote the final `C0: PASS` line in the baseline README; P1A planning is unlocked after the checkpoint commit.

## 10. Verdict ledger

| Cycle | Checkpoint ID | Baseline | Verdict | Cause owners | Finding IDs | Supersedes/amends | Consecutive FAIL count | Repeated invariants |
|---|---|---|---|---|---|---|---:|---|
| R1 | C0 | Builder tree `82bcd2f`, staged diff `7eebd7e` | **FAIL** | Construction 3; Acceptance 0; Harness 0; Spec 0; Environment 0 | A-C0-01, A-C0-02, A-C0-03, A-C0-M01 | none | 1 | none |
| R2 | C0 | repaired 18-file staged candidate | **PASS** | Construction 0; Acceptance 0; Harness 2 (corrected); Spec 0; Environment 0 | all R1 findings closed | supersedes R1 | 0 | none |
