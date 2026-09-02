# V3 Baseline — Environment, Build/Start/Lint/Test Evidence, Known Failures

> **Artifact:** `Plan/V4_Phase_0_Baseline/V3_Baseline.md` (P0 Task 1)
> **Frontend HEAD:** `6b0948e06221fe49ebefa1658825c7e400f7f241` (main) — **Backend HEAD:** `21f2a8f7aab6d475692af7716924571542040b8f` (clean)
> **Evidence window:** 2026-09-02 20:18–20:24 (+02:00), executed from `D:/Alicia/ExoCore_Project/ExoCore-Desktop` (frontend) and `D:/Alicia/ExoCore_Project/ExoCore` (backend).
> **Companion artifacts:** `README.md` (index), `Canonical_API_Snapshot.json`, `V3_Capability_Ownership.md`, `V4_Side_by_Side_Contract.md`.

---

## 1. Opening worktree & environment snapshot (Task 0)

### 1.1 Frontend repository (`ExoCore-Desktop`)

| Item | Value |
|---|---|
| Root | `D:/Alicia/ExoCore_Project/ExoCore-Desktop` |
| Branch | `main` |
| HEAD | `6b0948e06221fe49ebefa1658825c7e400f7f241` |
| Node / pnpm | v25.7.0 / 11.5.1 |
| Lockfile | present (`pnpm-lock.yaml`); `pnpm install --frozen-lockfile` → exit 0, no tracked changes |

Pre-existing dirty manifest (staged, sibling planning input — untouched by P0):

```
M  Plan/ExoCore_V4_Single_SPA_Architecture_Spec.md
A  Plan/V4_Frontend_Refactor_Decision_Questionnaire.md
A  Plan/V4_Master_Implementation_Roadmap.md
M  Plan/V4_Page_Skeleton.md
A  Plan/V4_Phase_0_Contract_Baseline_Detailed_Plan.md
M  Plan/V4_River_Collection_Memory_Interaction_Spec.md
A  Plan/V4_Spec_Freeze_Index.md
```

No unstaged changes, no untracked files at open.

### 1.2 Backend repository (`ExoCore`, read-only for P0)

| Item | Value |
|---|---|
| HEAD | `21f2a8f7aab6d475692af7716924571542040b8f` |
| Tracked diff vs HEAD (hash) | `e69de29bb2d1d6434b8b29ae775ad8c2e48c5391` (empty — clean) |
| Untracked files | none |
| Untracked path+content hash | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` (empty) |
| Real DB AgentPreset baseline | `OK: AgentPreset baseline 8 rows [1, 2, 3, 4, 5, 6, 7, 8]` |

### 1.3 WezTerm pane check (Task 0.5)

Panes listed; pane 3 (`pi` in `ExoCore-Desktop`, Solaire · Plan) is idle and explicitly waiting for this Phase 0 result ("C0 PASS 后我们再继续写 P1A Plan"); no overlapping file/scope activity, no shared ports or services in use by other panes. No announce/release messages sent (no concrete conflict).

---

## 2. Dependency integrity

| surface | commit | dirty_context | command | exit | result | fingerprint | owner | reproduction |
|---|---|---|---|---|---|---|---|---|
| workspace | 6b0948e | (7 staged Plan docs) | `pnpm install --frozen-lockfile` | 0 | PASS | — lockfile up to date, 1.1s | workspace/V3 | `pnpm install --frozen-lockfile` |

`git status` byte-identical before/after install.

## 3. Isolated builds & workspace build

| surface | commit | command | duration | exit | result | fingerprint | owner |
|---|---|---|---|---|---|---|---|
| chat-core | 6b0948e | `pnpm --filter exo-chat-core build` | 51s | 0 | PASS | warnings: INEFFECTIVE_DYNAMIC_IMPORT (shared/src), chunk >500 kB (1 744.59 kB index.js) | V3 chat-core |
| chronicle | 6b0948e | `pnpm --filter exo-chronicle build` | ~4s | 0 | PASS | — | V3 chronicle |
| council | 6b0948e | `pnpm --filter exo-council build` | ~4s | 0 | PASS | — | V3 council (deferred) |
| workspace | 6b0948e | `pnpm build` | ~8s | 0 | PASS | all 3 SPAs rebuilt + sw.js each | workspace |

Verification targets met:

- `dist/index.html` present in all three packages; `dist/sw.js` present in all three (injectManifest PWA).
- Production bases verified in built index.html asset URLs: `/chat/assets/…`, `/chronicle/assets/…`, `/council/assets/…`.
- PWA ids/scopes from Vite configs: `exocore-chat`/`/chat/`, `exocore-chronicle`/`/chronicle/`, `exocore-council`/`/council/`.
- Root recursive build works on unchanged V3 workspace.
- `git status` identical before/after builds (dist is gitignored).

## 4. Dev-server startup smoke (fixed ports)

Each started with the plan command, probed over HTTP, force-killed by port owner, port-release verified (curl exit 7 after kill):

| surface | command (with `-- --host 127.0.0.1 --strictPort`) | port | HTTP probe | exit | result | owner |
|---|---|---|---|---|---|---|
| chat-core | `pnpm dev:chat …` | 5173 | `curl -I http://127.0.0.1:5173/` → 200 text/html | 0 | PASS (port freed after kill) | V3 chat-core |
| chronicle | `pnpm dev:chronicle …` | 5174 | → 200 text/html | 0 | PASS (port freed) | V3 chronicle |
| council | `pnpm dev:council …` | 5175 | → 200 text/html | 0 | PASS (port freed) | V3 council |

No fall-through to other ports, no source/config changes, no leftover listeners (checked 5173–5175 after all smokes). Dev servers were stopped before moving on; none left running.

## 5. Lint

| surface | command | exit | result | fingerprint (stable) | owner |
|---|---|---|---|---|---|
| chat-core | `pnpm --filter exo-chat-core lint` | 1 | KNOWN-DIRTY | 168 problems (150 errors / 18 warnings); dominant rule `no-unused-vars: 'React' is defined but never used` (react-jsx runtime already configured → dead `import React` in ~40 files); secondary unused locals (`baseUrl`, `Volume2`, `isLight`, `savingChunkId`, `hookSaving`, `onDelete`, `err`); few `react-hooks/exhaustive-deps` | V3 chat-core cleanup / V4 migration (pre-existing; related pending doc `Plan/Chat_Core_ESLint9_Flat_Config_Pending.md`) |
| chronicle | `pnpm --filter exo-chronicle lint` | 2 | KNOWN-DIRTY | ESLint 9 flat config missing: `ESLint couldn't find an eslint.config.(js|mjs|cjs) file` | V3 chronicle |
| council | `pnpm --filter exo-council lint` | 2 | KNOWN-DIRTY | same flat-config-missing fingerprint | V3 council |

Classification: reproducible, pre-existing, scoped, assigned — non-blocking for C0/P1A.

## 6. Frontend tests (chat-core — the only existing frontend suite)

| surface | command | duration | exit | result | owner |
|---|---|---|---|---|---|
| chat-core | `pnpm --filter exo-chat-core test:run` | 33s | 0 | PASS — 12 test files, 85 tests, 0 failed / 0 skipped | V3 chat-core |

chronicle and council have **no** package test script — recorded as `NO_SUITE` (not a false PASS, not a P0 requirement to add).

## 7. Council status freeze

**State: `deferred-stub-buildable`** — source & execution evidence:

- `packages/council/src/App.jsx` renders centered "ExoCore // Council — Multi-Agent Workspace — Coming in V3.1" stub.
- Notification plumbing present (NotificationProvider + NotificationPanel + push-notification.js SW, byte-identical copies to other packages).
- Only other files: main.jsx, contexts/NotificationContext.jsx, stores/notificationStore.js, components/notifications/*, public/sw.js.
- Buildable and startable on fixed port 5175; PWA `exocore-council` at `/council/`.
- Backend council endpoints exist but that does not imply a completed frontend. Council remains deferred regardless (Roadmap §14 / matrix row "Council").

## 8. Backend support checks (from `ExoCore/`, read-only)

| check | command | exit | result | fingerprint |
|---|---|---|---|---|
| real-DB baseline (pre) | `bash .agent/check_real_db_baseline.sh` | 0 | PASS | `OK: AgentPreset baseline 8 rows [1, 2, 3, 4, 5, 6, 7, 8]` |
| Django check | `python.exe manage.py check` | 0 | PASS | System check identified no issues (0 silenced) |
| migration drift | `python.exe manage.py makemigrations --check --dry-run` | 0 | PASS | No changes detected |
| focused tests | `python.exe manage.py test agents.tests.test_services.SessionAttachmentUploadContractTests agents.tests.test_audio_attachments agents.tests.acceptance.test_audio_attachment_contract groupchat.tests tasks.tests memory.tests.test_plasmid_lifecycle push.tests.test_prime_push -v 2` | 0 | PASS | Ran 84 tests in 1.383s — all ok; 0 failed/0 errors/0 skipped (Django test DB only; no cloud LLM calls; no real DB writes) |
| real-DB baseline (post) | `bash .agent/check_real_db_baseline.sh` | 0 | PASS | same 8-row line |
| backend git status | `git status --short` | 0 | PASS | clean |

All test labels verified to exist in current source before execution (no silent skips). Expected log noise during tests: mock broadcast worker failures, attachment parse skips, post-teardown EntryProcessor retry lines — informational only.

## 9. Known-failure ledger

| ID | Item | Classification | Evidence / reason | Owner | Non-blocking reason |
|---|---|---|---|---|---|
| KF-01 | chat-core lint 168 problems (150E/18W) | KNOWN-DIRTY | reproducible fingerprint above (§5) | V3 chat-core → V4 migration | pre-existing, scoped, ESLint9 flat config pending doc exists |
| KF-02 | chronicle lint: no flat eslint config (exit 2) | KNOWN-DIRTY | `ESLint couldn't find an eslint.config.*` | V3 chronicle | pre-existing, config debt only |
| KF-03 | council lint: no flat eslint config (exit 2) | KNOWN-DIRTY | same fingerprint | V3 council | deferred stub anyway |
| KF-04 | chat-core bundle >500 kB (1.74 MB single chunk) | KNOWN-DIRTY | build warning, reproducible | V3 chat-core | build passes; perf debt |
| KF-05 | `createConversation()` shared wrapper targets unmounted POST | KNOWN-DIRTY (doc + wrapper debt) | zero callers; canonical = `sessions/init/` (snapshot MM-01) | V3 shared → P1A | no runtime path uses it |
| KF-06 | GroupChat broadcast body key mismatch (`user_message_id` vs `message_id`) | KNOWN-DIRTY (live degraded path) | GroupchatRoom.jsx:441 vs groupchat/views.py:149 → broadcast dispatches unanchored (message_id=0), validation never fires (snapshot MM-05) | V3 chat-core + ExoCore (separate bugfix or P2 GC migration) | broadcast still returns 202 and agents reply; anchor degraded |
| KF-07 | Task (ScheduleEntry) create anomaly — reported, undiagnosed | KNOWN-DIRTY (pending item) | no REST-level tests pin entry create (`tasks/tests/test_tasks.py` only unit-tests CalendarToolHandler); current UI/wrapper submit modern `entry_type` schema; no evidence disproves the report | V3 chronicle → P3 entry gate (Roadmap P3 requires independent diagnosis before River migration if baseline FAIL) | create works in current evidence; anomaly claim kept for P3 |
| KF-08 | ReactSheet stale contract sections (pre-P0) | RESOLVED in P0 (was doc-blocking) | MM-01/02/03/04/06/07/08/10 corrected in ReactSheet; MM-05/09 kept as explicit consumer mismatches in snapshot | P0 | corrected within scope; no remaining doc contradiction |
| KF-09 | Council = deferred stub | DEFERRED-STUB | §7 evidence | council (deferred) | explicit Roadmap deferral |
| KF-10 | Attachment GET list exposes `storage_path` for non-audio rows | KNOWN-DIRTY (privacy-relevant fact, not repaired in P0) | views.py:1046-1048 nulls only audio rows; upload/read paths strip it | ExoCore (B1 provenance scope input) | no runtime breakage; B1 problem statement input |
| KF-11 | `updateHistoryChunk` wrapper sends `topic_label`/`unresolved` which backend ignores (only `keywords` accepted) | KNOWN-DIRTY (doc-level) | snapshot MM-09 | V3 shared → P5 | MemoryConsole sends correct `keywords` only |
| KF-12 | PWA disabled in dev (devOptions.enabled=false) | KNOWN-DIRTY (by design) | SW only in built artifacts; dev base `/` has no scope | workspace/V3 | design choice, not a defect |

## 10. Reproduction index

- Full frontend baseline: §2–§6 commands in order (Table 1–6 of `README.md`).
- Full backend baseline: §8 commands.
- Worktree manifest re-check: §16.2 final commands of the Detailed Plan (recorded in `README.md`).

---

**Status:** V3 remains the sole production owner for every capability; this baseline records no P0-attributable change to any V3 source, config, lockfile, deployment file, or backend file. All checks classified; no unclassified failure. (Classification is evidence, not a quality verdict — C0 acceptance belongs to the independent acceptance process.)
