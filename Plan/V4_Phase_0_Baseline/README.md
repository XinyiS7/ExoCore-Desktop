# V4 Phase 0 Baseline — Artifact Index & Evidence Manifest

> **Phase:** ExoCore V4 Phase 0 (Contract & Baseline Freeze) — executable-documentation only.
> **Detailed Plan:** `Plan/V4_Phase_0_Contract_Baseline_Detailed_Plan.md`
> **Status:** **C0 PASS** — construction and independent acceptance complete; approved by Alicia on 2026-09-02. P1A planning is unlocked.

## 1. Artifact index

| Artifact | Content | Status |
|---|---|---|
| `README.md` (this file) | artifact index, evidence manifest, known debts/deferred risks, final C0 checklist draft, sign-off slot | created |
| `V3_Baseline.md` | worktree snapshot; build/start/lint/test evidence per SPA; council classification; known-failure ledger (KF-01…KF-12) | created |
| `Canonical_API_Snapshot.json` | machine-readable canonical API snapshot (40 resources, 7 families, 10 mismatches, 9 unavailable/deferred) — validates with Node's built-in parser | created, validated |
| `V3_Capability_Ownership.md` | frozen ownership matrix (all Roadmap §16 rows + 3 added), P1A–P1D mapping, transfer conditions, fallback owners | created |
| `V4_Side_by_Side_Contract.md` | frozen package identity (`packages/app`, `exo-app`, 5176, `/app/`), coexistence, checkpoint/rollback, config-change ownership by phase | created |
| `docs/superpowers/specs/2026-09-02-v4-b1-collection-storage-attachment-provenance-handoff.md` | B1 backend requirement brief | created |
| `docs/superpowers/specs/2026-09-02-v4-b2-river-aggregation-handoff.md` | B2 backend requirement brief | created |
| `docs/superpowers/specs/2026-09-02-v4-b3-memory-search-filter-handoff.md` | B3 backend requirement brief | created |
| `docs/superpowers/specs/2026-09-02-v4-b4-recall-observability-handoff.md` | B4 backend requirement brief | created |
| `ReactSheet.md` | scoped corrections on Conversation/messages/runtime (第一篇), Tasks (第四篇), GroupChat (第七篇), Push (第八篇) + provenance header | modified (scoped) |

## 2. Evidence manifest

- **Frontend repo:** `D:/Alicia/ExoCore_Project/ExoCore-Desktop` @ `6b0948e06221fe49ebefa1658825c7e400f7f241` (main)
- **Backend repo (read-only):** `D:/Alicia/ExoCore_Project/ExoCore` @ `21f2a8f7aab6d475692af7716924571542040b8f`, clean worktree
- **Evidence window:** 2026-09-02 20:18–20:31 (+02:00)
- **Real DB AgentPreset baseline:** opening `OK: AgentPreset baseline 8 rows [1, 2, 3, 4, 5, 6, 7, 8]`; closing (final command list below) — see §6
- **Key command results** (details in `V3_Baseline.md`):
  - `pnpm install --frozen-lockfile` exit 0, no tracked change
  - builds chat-core/chronicle/council + root `pnpm build` exit 0 (bases `/chat/ /chronicle/ /council/`, `sw.js` per dist)
  - dev smokes 5173/5174/5175 → HTTP 200 → killed → ports freed
  - lints: chat-core exit 1 (168 problems, KF-01), chronicle/council exit 2 (no flat config, KF-02/03) — all classified KNOWN-DIRTY
  - `test:run` chat-core: 12 files / 85 tests, 0 failed
  - backend: `manage.py check` 0 issues; `makemigrations --check --dry-run` no changes; focused tests 84/84 ok; baseline checks 8 rows before & after
- **Pre-existing sibling dirty input (preserved untouched):** 7 staged Plan/Spec files (see `V3_Baseline.md` §1.1)

## 3. Known debts / deferred risks (recorded, non-blocking — P0 scope)

1. **KF-06 / MM-05:** GroupChat broadcast body key mismatch — live path degrades to unanchored dispatch. Owned by a separate bugfix or P2 GC migration. Non-blocking for C0 because the broadcast surface and its failure mode are now frozen facts.
2. **KF-07:** ScheduleEntry create anomaly report remains undiagnosed (no REST-level tests; current UI/wrapper modern). Roadmap P3 entry gate requires independent diagnosis before River migration.
3. **KF-01/02/03:** lint debt across all three SPAs (classified KNOWN-DIRTY).
4. **KF-10:** attachment GET list exposes `storage_path` for non-audio rows — B1 problem-statement input, not repaired here.

None of the above blocks C0: they are recorded, classified debts/risks with owners — not open blockers. The C0 gate requires *recorded* failures with owners — not fixed failures.

## 4. Final C0 checklist (draft — verdict reserved)

### A. Safety and scope
- [x] Opening and closing AgentPreset baseline checks both report exactly IDs 1–8 (see §6 closing run)
- [x] No real database write probe occurred (backend tests ran only against Django test DB)
- [x] Backend closing HEAD/status/diff/untracked hashes match opening evidence (§6)
- [x] `packages/app/` and all other V4 runtime/source files absent
- [x] No package, lockfile, Vite, nginx, deployment, or V3 source file changed

### B. V3 baseline
- [x] chat-core/chronicle/council build and start on fixed ports 5173–5175
- [x] Root recursive workspace build passes
- [x] chat-core `test:run` passes (85/85)
- [x] Django check, migration drift check, focused backend tests pass (84/84)
- [x] All lint failures and known failures classified (PASS/KNOWN-DIRTY/DEFERRED-STUB); no unclassified failure
- [x] Council explicitly frozen as buildable deferred stub
- [x] Pre-existing & final dirty manifests recorded without overwriting sibling work

### C. Canonical API snapshot
- [x] JSON parses with Node built-in parser; 7 API families present (conversation, groupchat, attachment, runtime, task, memory, notification)
- [x] Every resource has backend source, frontend consumer, request/response/error semantics, evidence status
- [x] Conversation create/list/message, GroupChat messages/broadcast, Task fields, notification mismatches resolved or kept as explicit consumer mismatches (MM-05/09)
- [x] No nonexistent endpoint labeled canonical (`/send/`, `GET /api/push/notifications/`, POST conversations create are not canonical)
- [x] No required contract fact remains `unknown`
- [x] Scoped `ReactSheet.md` sections agree with snapshot (provenance header added)

### D. Ownership and coexistence
- [x] Every Master Roadmap capability represented with owner, gate, transfer condition, fallback
- [x] P1A–P1D remain V3-primary until unified C1
- [x] Side-by-side identity frozen consistently: `packages/app`, `exo-app`, 5176, `/app/`
- [x] Root `/chat/` until P7; P8 only legacy-deletion phase

### E. Backend handoffs
- [x] B1–B4 exist as four independent briefs under `docs/superpowers/specs/`
- [x] Each brief has the 10 common sections + domain-specific invariants
- [x] B1 includes `g045` agent-type authorization and excludes current `memory_search` wiring
- [x] B2 forbids frontend heterogeneous pagination merge
- [x] B3 separates Plasmid/History/Project Knowledge and freezes exact lookup semantics
- [x] B4 separates automatic recall from active ToolCall; freezes attempt/feedback identity

### F. Approval and release
- [x] Single final `C0: PASS` / `C0: FAIL` line written by the acceptance owner
- [x] Alicia explicitly approved C0 PASS on 2026-09-02
- [x] `V4_Phase_1A_*_Detailed_Plan.md` drafting is now unlocked

C0: PASS

## 5. Sign-off slot

| Role | Name | Date | Verdict / notes |
|---|---|---|---|
| Builder | Ecki (deepseek v4) | 2026-09-02 | Construction evidence complete; no quality verdict issued (builder-workflow §5) |
| Acceptance | Solaire (`gpt-5.6-sol`) | 2026-09-02 | **PASS — Alicia approved C0; checkpoint commit authorized** |

## 6. Closing evidence commands (Task 9 / §16.2) — executed 2026-09-02 (actual results)

```text
ExoCore-Desktop (D:/Alicia/ExoCore_Project/ExoCore-Desktop):
git diff --check                  -> clean (no whitespace errors)
Canonical_API_Snapshot.json       -> JSON OK (40 resources / 7 domains / 10 mismatches / 9 unavailable) [Node built-in parser]
pnpm --filter exo-chat-core build   -> exit 0 (final rebuild after doc work)
pnpm --filter exo-chronicle build  -> exit 0
pnpm --filter exo-council build    -> exit 0
test -d packages/app              -> absent (correct)
git status --short                -> 7 pre-existing staged Plan docs (untouched)
                                    + M ReactSheet.md (scoped corrections)
                                    + 5 new files under Plan/V4_Phase_0_Baseline/
                                    + 4 new B1-B4 briefs under docs/superpowers/specs/

ExoCore (read-only):
git rev-parse HEAD                -> 21f2a8f7aab6d475692af7716924571542040b8f (unchanged)
git status --short                -> clean (unchanged)
tracked diff hash                 -> e69de29bb2d1d6434b8b29ae775ad8c2e48c5391 (empty, unchanged)
untracked path+content hash       -> e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 (empty, unchanged)
bash .agent/check_real_db_baseline.sh -> OK: AgentPreset baseline 8 rows [1, 2, 3, 4, 5, 6, 7, 8]
```

Final dirty-file allowlist (P0-attributable, nothing else):
- Added: `Plan/V4_Phase_0_Baseline/{README.md, V3_Baseline.md, Canonical_API_Snapshot.json, V3_Capability_Ownership.md, V4_Side_by_Side_Contract.md}`
- Added: `docs/superpowers/specs/2026-09-02-v4-b{1,2,3,4}-*.md`
- Modified (scoped): `ReactSheet.md`
- Accepted for the Alicia-authorized C0 checkpoint commit per Detailed Plan §18.
