# V4 Phase 2B — Construction Evidence

> **Single construction/evidence file for P2B (Plan §9).** The frozen Detailed Plan
> (`Plan/V4_Phase_2B_Project_Workspace_Management_Detailed_Plan.md`, SHA256
> `4a93360627b1cde95e2bcac1c51c207ddf664309d184c0e14f332dcbbeb64082`) and the
> acceptance report (`Plan/V4_Phase_2B_acceptance_report.md`, Acceptance-owned,
> not editable by Builder) are read-only. This file carries the builder-workflow
> start-gate / checkpoint / matrix records for all stages (A/B/C/D serial).
> **Owner:** active serial Builder — Stage A/B/D pane 4 (Ecki), Stage C pane 5 (Sol).
> Facts only, no verdicts; independent acceptance owns PASS/FAIL.

---

## 0. Start gate — preflight (recorded 2026-09-1x, pane 4, before first production edit)

### 0.1 Authorization pin

| Item | Recorded fact |
|---|---|
| Frozen Plan | `Plan/V4_Phase_2B_Project_Workspace_Management_Detailed_Plan.md` — SHA256 `4a93360627b1cde95e2bcac1c51c207ddf664309d184c0e14f332dcbbeb64082` (matches acceptance report frozen hash) |
| Acceptance report | `Plan/V4_Phase_2B_acceptance_report.md` — CP1 pending; consecutive FAIL count 0; Builder must stop at CP1 and submit to pane 3 |
| Entry HEAD | `b1178fb1a974cd848fdeaa11a7d279df920b1a0c` on `main` (unchanged from planning time) |
| Entry dirty manifest | full per-path manifest pinned in `Plan/V4_Phase_2B_acceptance_entry_baseline.json` (Acceptance-owned). Ownership summary below |
| P2A predecessor pins | all 272 pinned sha256 verified at entry: **ok=272, missing=0, mismatch=0** (scripted comparison) |
| Real DB baseline (opening) | `bash .agent/check_real_db_baseline.sh` (ExoCore/) → `OK: AgentPreset baseline 8 rows [1, 2, 3, 4, 5, 6, 7, 8]` |
| Construction signal | Alicia via Solaire pane 3: serial Stage A authorized; stop mandatory at CP1; no commit authorized; no real user data / backend writes; acceptance artifacts (`acceptance_report.md`, `acceptance_entry_baseline.json`, independent probes) must not be edited or copied |

### 0.2 Dirty-work ownership (entry, before Stage A edits)

- **Acceptance-owned (staged, never touched by Builder):** `Plan/V4_Phase_2A_acceptance_report.md`,
  `Plan/V4_Phase_2B_acceptance_entry_baseline.json`, `Plan/V4_Phase_2B_acceptance_report.md`,
  `Plan/.p2a-acceptance-shots/**`, `packages/app/src/acceptance/**` (p2a probes), `Plan/备忘.txt` (explicitly not P2B-owned).
- **P2A production work in tree (unstaged/untracked, preserved):** `packages/app/src/features/agents/**`,
  `packages/app/scripts/**`, `packages/app/src/test/p2a_*`, P2A Plan docs, and the `M` files
  `router.tsx`, `ChatHomePage.tsx`, `CreateConversationDialog.tsx`, `chat/api.ts`, `chat/queries.ts`,
  `main.tsx`, `shell/AppShell.tsx`, `shell/navigation.ts`, `test/helpers.tsx`.
- **P2B shared-file integration (explicitly authorized by Plan §5.1/§8.1 as shared integration files):**
  Stage A touches `router.tsx`, `ChatHomePage.tsx`, `chat/api.ts` (list boundary hardening),
  `main.tsx`, `shell/AppShell.tsx`, `shell/navigation.ts`, `test/helpers.tsx`. All other P2A files untouched.
- **New P2B files (untracked):** `features/projects/**`, focused tests, this Evidence file.
- No reset / restage / rewrite of the P2A tree; no commit.

### 0.3 Risk level and escalation triggers

- **Risk level: H** — write mutations (Project create/edit persist backend state), cross-module
  shared query-family boundary change, router/shell shared files, accepted-P2A-surface proximity.
  Full `M/H` matrix used (below). No concurrency/transaction/scheduler surface in Stage A scope.
- **Escalation triggers checked (Plan §7):** reliable Files operation needing backend → not Stage A;
  Knowledge runtime shape drift → not Stage A; delete-preview/lifecycle drift → not Stage A;
  fixed-Project reuse requiring a second mutation → Stage C; AgentPreset writes / V3 edits /
  generic Workspace framework → none triggered; editing Acceptance-owned or another-pane scope → none.

### 0.4 Targeted source verification (Plan §2.4 — read before editing)

| Plan claim | Live source verification |
|---|---|
| Project list = bare array, backend order, serializer fields `id/name/description/prompt/work_dir/created_at` | `ExoCore/core/views.py` L92 `ProjectViewSet`; `core/serializers.py` L12–15 `ProjectSerializer` fields match `ProjectRow` in `features/chat/types.ts`. `Project.Meta.ordering=['-updated_at']` (`core/models.py` L65) ⇒ order is backend-owned (newest-updated first) |
| Project names required + unique; description/prompt/work_dir blank-allowed | `core/models.py` L50–58 (`unique=True`, `blank=True`, `default=""`, work_dir max 500) |
| No DRF pagination envelope | no `REST_FRAMEWORK`/pagination setting anywhere under `ExoCore/` ⇒ bare arrays (list + detail) |
| Archived Project excluded server-side | `ProjectViewSet.queryset = Project.objects.exclude(name="Archived Project")` |
| Create/update contract | default `ModelViewSet.create` → 201 full row; `partial_update` → 200 full row; name-duplicate ⇒ DRF field error `{"name": [...]}`; `update`/`partial_update` also run backend `_migrate_project_files` (work_dir change semantics are backend-owned) |
| Existing Projects list owner | `features/chat/api.ts` `listProjects()` (bare-array guard only) + `useProjectsQuery` (`queryKeys.projects`); consumers: `CreateConversationDialog` only. P2B must harden the existing boundary, not duplicate it (Ablation §3 row 3) |
| Existing Project detail owner | `features/chat/control/api.ts` `fetchProjectDetail` (guarded object; `workDir` normalization) + `controlQueryKeys.projectDetail` / `useProjectDetailQuery` (enabled only for positive id, `retry:false`) |
| Shared Conversations owner | `features/chat/api.ts` `listConversations` + `queryKeys.conversations`; `normalizeConversationRow` maps `project===0 → projectId null`; lens must reuse this single cache (D4) |
| Visible presets owner | `useVisiblePresetsQuery` (`queryKeys.presets`) — name source for Agent filter labels |
| Router/shell patterns | `app/router.tsx` (children under `AppShell`), `isChatActive` in `shell/navigation.ts`, `DETAIL_PATH` in `shell/AppShell.tsx` hides mobile bottom bar for `chat/:id` + `agents/:presetId` (P2A pattern to mirror for project detail) |
| Create dialog origin-guard pattern | `CreateConversationDialog.tsx`: `activeOriginRef` token + `mountedRef` suppress stale completion; ambiguous-write terminal lock; serialized via `nextSubmitTokenRef` — the pattern P2B mirrors for Project create/edit |
| P2A lens pattern | `features/agents/projection.ts` `resolveConversationFilter` (render-time guard) + Profile `useEffect` permanent fallback + route-change reset; `AgentProfilePage` gates child sections behind confirmed identity |
| P1D regression surface for Stage B | `features/chat/project/ProjectFilesDrawer.tsx` (read-only, numeric `ProjectFileRow.id`) + `test/p1d_project_api.test.ts` — untouched by Stage A |
| apiFetch | `packages/shared/src/api.js`: non-2xx throws `{message, status, body}`; params → searchParams; no pagination wrapper |

Hostname/backend check above is read-only; no backend edit happened.

### 0.5 Impact search (frontend-equivalent Insight; backend `query_insight.py` N/A since no backend change)

- `isChatActive`: only consumer `PrimaryNavigation.tsx` — extending predicate is additive-safe.
- `DETAIL_PATH`: only consumer `AppShell.tsx`.
- `router`: only consumer `AppProviders.tsx` — route additions additive.
- `queryKeys.projects` / `listProjects`: consumers `CreateConversationDialog` (`useProjectsQuery`) +
  new Hub. Hardening the row guard keeps both consumers on the same guarded fact.
- `useConversationsQuery` consumers: `RecentConversationList`, `AgentProfilePage` lens, `ConversationPage`,
  acceptance probes — Hub/lens add consumers of the **same** key (no new collection owner).
- `test/helpers.tsx` `renderApp`: mirrored route tree must be extended in lockstep (16 consumer files).
- No V3/backend/extension touchpoint in Stage A.

### 0.6 Incident knowledge check

- `DevelopLog/DebugLog.md`: no Stage-A-relevant V4 Project incident; V3 Project Hall hover-flash entries
  concern rejected V3 architecture (not migrated). `DevelopLog/warnings.md` absent in this repo;
  AGENTS.md real-DB discipline committed: no `AgentPreset`/real data mutation (none performed).
- Known harness fact (P2A evidence): full-suite vitest needs `NODE_OPTIONS=--no-experimental-webstorage`
  on this Node 25/jsdom combo to avoid the webstorage collision; focused suites run plain per stage.

### 0.7 Stage A construction matrix (risk H)

| Dimension | Frozen answers |
|---|---|
| Invariant | (1) ONE Projects-list owner (`queryKeys.projects` / `listProjects`) and ONE Project-detail owner (`controlQueryKeys.projectDetail` / `fetchProjectDetail`); no duplicate mutation owner for any Project fact. (2) Hub renders backend array in backend order, never surfaces Archived Project; count from shared Conversations cache; count failure ≠ 0 count and never blanks cards. (3) Detail = exact route-keyed project; invalid route ID mounts zero child requests; 404 vs request failure vs malformed success distinct. (4) Conversation lens consumes ONLY `queryKeys.conversations`; selects rows with `projectId === current positive id`; All/Agent filter derived synchronously; Agent options dedupe by positive `agentPresetId`, truthful `Agent #<id>` fallback; stale numeric Agent falls back to All permanently on successful replacement, never on pending/failed refetch; route A→B resets filter + closes dialogs and late A results cannot render under B. (5) Create/update submit ONLY supported fields (`name/description/prompt/work_dir`), required-name client+server error, duplicate-name field error, blank optional fields incl. `work_dir` preserved, no directory probe; confirmed create navigates once by returned id; close/route-switch suppress stale local navigation/error; confirmed writes always invalidate shared Project data. No fixed-Project creation, Files/Knowledge mutations or deletion exposed at CP1 |
| Entry paths | `/projects` direct + Chat Home link; `/projects/:id` direct + card; browser history; retry buttons; create dialog escape/close; edit dialog open/save/cancel/close; route switch while detail in flight; route switch while dialog pending |
| State | hub: pending / empty / error(network) / malformed(CONTRACT) / data(backend order) / count available | unavailable | loading; detail: invalid id / pending / 404 / request error / data / stale origin A→B; lens: conversation pending/error/empty / filter all/agent / agent removed by replacement / pending-or-failed refetch; dialog: pristine/valid/invalid/duplicate-name/pending/ambiguous-locked(create)/closed |
| Timing | create navigation vs dialog close; late A detail completion under B; late edit completion after route switch; invalidation before navigation; dialog pending vs route change |
| Failure | non-array list / non-object detail / malformed create-patch 2xx (ambiguousWrite) / 400 field errors / 404 / network / 5xx; errors never converted to empty/zero; retry always re-issues the exact query |
| Ownership | `features/projects/api.ts` = create/update adapters + row validation; `queries.ts` = create/update mutations + shared invalidation; `projection.ts` = pure lens/count helpers; pages compose existing canonical queries; router/shell/navigation = exposure; chat feature = only the authorized list-boundary hardening + Home entry |
| Observation | focused tests through real route tree + `installFetch` call log (no `/conversations/?project=`, no duplicate project-verb owner, exact PATCH/POST bodies, single conversations fetch source); typecheck/lint/build exit codes; `git diff --check` |

### 0.8 Unresolved ambiguity / accepted boundary (Stage A)

- Project list row guard: Plan §5.3 requires top-level array only for the list; the ablations reuse an
  existing owner ("扩充现有 canonical list 边界"). Stage A hardens `listProjects` to reject rows without
  a positive integer `id` + string `name` as CONTRACT error (identity unusable for card links). This is
  the minimum guard to make §8.2 "malformed success" distinguishable; it is not a general project
  validation framework. Note in CP1 handoff.
- Work-dir semantics: editing `work_dir` may trigger backend `_migrate_project_files` on the server.
  That is backend-owned behavior; the frontend only stores the string and never probes/opens the
  directory (Plan §4.2).
- Blank vs null: `ProjectDetailRow` keeps `string | null`; edit-preform uses `?? ''` so blank optional
  fields round-trip as empty strings (backend `blank=True`).

---

## 1. Stage A implementation (CP1 — recorded at the mandatory stop, pane 4; submitted to pane 3 acceptance)

### 1.1 Implementation facts (old → new observable behavior)

| File :: symbol | Change |
|---|---|
| `src/features/projects/api.ts` :: `createProject` / `updateProject` / `validateProjectObject` | new write adapters: POST/PATCH with the ONLY four supported fields (name/description/prompt/work_dir); guarded object row (positive int id + string name + verified fields); a malformed 2xx becomes an **ambiguousWrite** (duplicate-create risk / re-read truth) — never an inferred id |
| `src/features/projects/queries.ts` :: `useCreateProjectMutation` / `useUpdateProjectMutation` | new mutations over the EXISTING canonical keys (`queryKeys.projects`, `controlQueryKeys.projectDetail`); confirmed writes + ambiguous 2xx invalidate shared Project facts even after dialog close/route switch |
| `src/features/projects/projection.ts` | pure D4/§5.5 helpers: `rowsForProject` (exact projectId lens), `agentLabel` (truthful name/`Agent #\<id\>`/unknown), `deriveAgentOptions` (dedupe by positive id, backend order), `applyAgentFilter` (narrow-only), `resolveAgentFilter` (render-time stale-fallback) |
| `src/features/projects/ProjectFormDialog.tsx` | one create/edit dialog (shared form state/focus/errors); origin-token guard suppresses stale local completion; create-only terminal ambiguous lock; edit retries stay idempotent; focus/escape/return-focus via `useDialogA11y` + name-field focus |
| `src/features/projects/ProjectHubPage.tsx` | Hub: backend order, count from shared Conversations cache (`会话数暂不可用`/`正在统计会话…`, never 0), loading/empty/error/retry/malformed distinct, create → confirmed-id navigation once |
| `src/features/projects/ProjectDetailPage.tsx` | Detail: invalid-ID state mounts zero query hooks; 404 vs request failure vs contract error distinct; identity gate blocks lens until confirmed (child sections mount only under confirmed Project); overview shows name/desc (paragraph) + System Prompt/work_dir facts with honest blank labels; edit prefill snapshot + refetch-after-success; lens with All/Agent filters, permanent fallback, route-change reset |
| `src/features/projects/projects.css` | project-only visual rules (hub grid/cards, section/facts, filter chips, safe-area padding for focused L2) |
| `src/features/chat/api.ts` :: `listProjects` | existing single canonical list owner HARDENED (row identity guard: positive int id + string name → CONTRACT error on malformed rows) instead of a duplicated project-list owner (Ablation §3) |
| `src/app/router.tsx` | `/projects` + `/projects/:projectId` under AppShell |
| `src/shell/navigation.ts` :: `isChatActive` | `/projects/*` counts as active Chat area (D8) |
| `src/shell/AppShell.tsx` :: `DETAIL_PATH` | syntactically valid `/projects/:id` hides mobile bottom bar (focused L2); Hub/invalid IDs keep it |
| `src/features/chat/ChatHomePage.tsx` | additive secondary entry link to `/projects` (FolderKanban) |
| `src/main.tsx` | imports `features/projects/projects.css` |
| `src/test/helpers.tsx` :: `renderApp` | route tree extended in lockstep with the production router |

### 1.2 Self-adversarial counterexample pass

| Scenario | Applicable or N/A | Command/inspection | Observed result | Follow-up |
|---|---|---|---|---|
| two valid records / duplicates | applicable | count + Agent-option dedupe tests | 2 projects → 2 cards with per-project counts; agent 5 across two rows → ONE option | none |
| mixed old/new (Drift vs project rows) | applicable | lens test with project-8 + Drift rows on project-7 page | only exact projectId rows render; Drift/Beta never leak in | none |
| dependency failure after partial setup | applicable | conversations 500 on Hub and on Detail | cards/identity intact; counts show `会话数暂不可用`; lens shows its own `会话加载失败` — never zero/empty | none |
| pending/failed refetch must not erase selection | applicable | failed-refetch test (invalidate-against-500 handler) | selection stays checked after failed round trip | none |
| caller-selected filter removed by replacement | applicable | dataset replacement + resurrection test | falls back to 全部 permanently; does NOT re-select when Agent returns | none |
| late completion after navigation/close | applicable | late-create-after-close test; late detail-A-under-B test | no stale navigate; A identity never renders under B; confirmed write still invalidated shared list | none |
| concurrent entry via sibling path | applicable | Hub card link + direct URL + back link tests | all reach the same canon detail implementation | none |
| hidden/ineligible owner (Archived) | applicable | backend queryset excludes Archived Project; V4 renders array as-is (verified via `core/views.py` L92) | no Archive surfaced; invalid route id issues zero requests | none |
| ambiguous write (2xx malformed) | applicable | create lock test + edit ambiguous test | create: `创建已锁定`, no navigate, list invalidated; edit: honest message, idempotent retry stays open, truth re-read | none |
| duplicate submit | applicable | pending-dialog test | submit disabled while pending; single POST | none |
| rollback / restart with persisted state / transaction | N/A | frontend-only slice; no persistence, no transaction ownership in Stage A | — | — |

### 1.3 Verification executed

```text
pnpm --filter exo-app typecheck          → exit 0
pnpm --filter exo-app lint               → exit 0
pnpm --filter exo-app build              → exit 0 (precache 89 entries; chunk advisory only)
git diff --check                         → OK (LF→CRLF notices are repo-wide Windows cosmetics)

focused Stage A: p2b_projects.test.tsx + p2b_projects_projection.test.ts
    → 2 files passed; 38 tests passed (0 failed / 0 errors / 0 skipped)

full exo-app suite (NODE_OPTIONS=--no-experimental-webstorage per P2A evidence)
    → 53 test files passed; 500 tests passed (0 failed / 0 errors / 0 skipped)

opening real DB baseline → OK: AgentPreset baseline 8 rows [1..8]
closing  real DB baseline → OK: AgentPreset baseline 8 rows [1..8]
P2A pins at entry             → 272/272 sha256 verified, 0 missing, 0 mismatch
```

### 1.4 Repository searches (scope sweep at CP1)

- Project fact owners per verb: GET list = `chat/api.ts::listProjects`; GET detail/files/tree = `chat/control/api.ts`; POST = `projects/api.ts::createProject`; PATCH = `projects/api.ts::updateProject` — one owner per verb, no duplicate mutation owner (searched `createProject|updateProject` outside `features/projects`: 0 matches)
- Project-filtered conversation endpoint / second Conversation collection: 0 matches anywhere (`conversations/?project`, project_id-filtered chat endpoints)
- Stage C/B surfaces absent in Stage A: `fixedProject`, `delete-preview`, `keep_file_ids`, `knowledge` in `features/projects/`: 0 matches
- Dependency change: `packages/app/package.json` + `pnpm-lock.yaml` diff = 0 lines
- `isValidProjectId` consumers: only `features/projects`; `project-conversation-filter` names only inside project files

### 1.5 Not executed / not independently verified

- Real-browser responsive five-width matrices (dev+prod at 320/390/767/768/1280) — final-candidate CP4 scope (Plan §7/§8.8)
- Stage B (Files/Knowledge) and Stage C (fixedProject creation, deletion) — not exposed at CP1 by design
- Independent acceptance probes — Acceptance-owned; Builder never writes them
- No commit was made; no real-user data or backend write occurred

### 1.6 Declared boundaries / notes

1. **Projects-list row guard:** §5.3's list guard is top-level-array; the ablation mandated extending the existing canonical owner instead of a feature copy. Stage A hardened `listProjects` with the minimal identity guard (positive int id + string name ⇒ CONTRACT error); this is the minimum needed to make §8.2 "malformed success" distinguishable and keep both consumers (dialog + Hub) on one guarded truth. Not a general validation framework.
2. **work_dir:** editing the stored string is included; the UI performs no directory probe (`/tree/` zero calls asserted) and makes no filesystem promise. Backend `_migrate_project_files` side effects on work_dir change remain backend-owned.
3. **Overview layout:** description is presented once (identity paragraph) + facts rows for System Prompt/work_dir to avoid duplicate a11y names while still displaying all four fields.
4. **Counts when conversations pending:** `正在统计会话…` rather than a bare placeholder; failure is `会话数暂不可用` (never 0).
5. **Detail mutates via same family:** edit invalidates `queryKeys.projects` + `controlQueryKeys.projectDetail(projectId)`; no new key family created.

### 1.7 Repository state at CP1

```text
staged:    0 Builder-owned files (Acceptance-owned P2A artifacts untouched)
unstaged:  10 files — the P2A-tracked M set: router.tsx, ChatHomePage.tsx, CreateConversationDialog.tsx,
            chat/api.ts, chat/queries.ts, main.tsx, shell/AppShell.tsx, shell/navigation.ts,
            test/helpers.tsx  +  Plan/V4_Phase_2B_Construction_Evidence.md (this file)
            (chat/queries.ts + CreateConversationDialog.tsx carry no Stage A diff; rest is P2A + P2B shared files)
            +  pre-existing non-P2B dirty: .agents/skills/wezterm_coop/SKILL.md (stub re-alignment to
            skills/ layout; NOT in the acceptance pin set, not P2B-owned, untouched by this Builder —
            likely sibling-pane work; preserved as-is)
untracked: 15 P2B/source paths — features/projects/{api.ts, queries.ts, projection.ts, ProjectFormDialog.tsx,
            ProjectHubPage.tsx, ProjectDetailPage.tsx, projects.css} + test/p2b_projects.test.tsx +
            test/p2b_projects_projection.test.ts + this Evidence file + pre-existing P2A/2B Plan docs & scripts
no commit; handoff to pane 3 acceptance at CP1 hold.
```

### 1.8 Final focused + full-suite numbers (after last Stage-A test adjustment)

```text
focused: p2b_projects.test.tsx + p2b_projects_projection.test.ts → 2 files passed; 33 + 5 = 38 tests passed
full:    NODE_OPTIONS=--no-experimental-webstorage vitest run → 53 files passed; 500 tests passed (0/0/0)
typecheck / lint / build / git diff --check → exit 0 / exit 0 / exit 0 / OK
```

## 2. R1 repair (CP1 recheck — recorded after pane-3 R1; findings F01–F04, H01 withdrawn)

Authorized scope: fix F01→F03→F02/F04 in order, same-origin sibling paths, ONE Construction Evidence,
no acceptance-artifact edits, no commits, stop again at CP1, Stage B still not released.

### 2.1 Fix → finding mapping

| Finding | File :: symbol | Fix |
|---|---|---|
| F01 submit-origin identity | `features/projects/queries.ts` :: `useUpdateProjectMutation` (+ `api.ts` :: `ProjectSubmitVariables`, `ProjectFormDialog.tsx` :: `submitProjectId` prop + payload, `ProjectDetailPage.tsx` :: call site) | The PATCH target id now travels INSIDE the mutation variables (`{ projectId, ...values }`); `onSuccess`/`onError` invalidate `queryKeys.projects` + `controlQueryKeys.projectDetail(variables.projectId)` — never the mutable render closure. TanStack 5.102.8 observer.setOptions can replace pending-mutation handlers (accepted as root cause); variables survive it. Body URL also derives from the submitted payload (`mutationFn` destructure). Obsolete completions still cannot close a newer dialog (unchanged dialog origin-token). No cancellation framework; no key-family duplication. |
| F03 detail identity | `features/chat/control/api.ts` :: `fetchProjectDetail` (authorized narrow P1D shared boundary) | Guard extended from `typeof id === 'number'` to positive frozen identity: `Number.isInteger(id) && id > 0` plus existing `name === 'string'`. Non-positive/fractional ids are CONTRACT errors — no editable owner/child sections. Valid positive payloads unchanged (P1D drawer keeps loading). NO file adapter/schema changes (mixed-ID file rows untouched before CP2). |
| F02 non-name field errors | `features/projects/ProjectFormDialog.tsx` :: render + banner | Existing RHF server errors (`errors.description/prompt/workDir`) now RENDERED per-control (`FieldError` next to each label); banner switches to `请修正表单中标记的错误后重试。` only when server field errors were mapped; generic network/contract/ambiguous messages keep appearing otherwise. Inputs retained; definite failure re-enables submit. |
| F04 blank configuration | `features/projects/ProjectDetailPage.tsx` :: `displayValue` helper + overview | Overview treats backend NULL **and** empty string as explicit absence (`暂无描述` / `未设置 System Prompt` / `未绑定工作目录`) for description/prompt/work_dir. No wording mandated by acceptance; server strings untouched; editor still round-trips blanks as `''` (never placeholder text). |

### 2.2 Regression evidence (discriminating tests)

- **F01**: `mountDetailWithNav` gained a `staleTime` option; the route-switch tests run with `staleTime: Infinity` so ONLY write-driven invalidation can refresh A on return — a remount refetch cannot mask a wrong invalidation target. Three settle variants: confirmed success (A re-reads `Saved-A`, B untouched — GET 8 stays 1), ambiguous malformed 2xx (same), definite 400 (no invalidation — A keeps prior truth, GET 7 stays 1). Plus: obsolete-A-completion-must-not-close-newer-B-dialog test (B's dialog stays open with Beta prefill). **Bug-injection check performed**: temporarily re-injecting the old closure-based handlers makes the confirmed-success AND ambiguous variants FAIL again (2 failed / 1 passed), then restore → 3/3 pass. This proves the tests discriminate the actual defect, not just the behavior.
- **F03**: `p1d_project_api.test.ts` gained `it.each([0, -4, 1.5])` adapter rejections (CONTRACT); construction detail-states gained `it.each` route-level assertions (no 编辑 button / no overview heading / no lens radiogroup + 项目详情加载失败).
- **F02**: edit multi-field (work_dir + prompt reasons both visible, values retained, retry closes on success, PATCH count 2); create overlong work_dir (reason visible, input retained, button not disabled, retry re-POSTs).
- **F04**: backend `''` for all three optional config fields → explicit labels on overview; editor opens with empty values (round-trip), not placeholder text.

### 2.3 Verification executed (R1 recheck pass)

```text
focused P2B + F03 adapter (p2b_projects.test.tsx, p2b_projects_projection.test.ts, p1d_project_api.test.ts)
    → 3 files passed; 59 tests passed (0/0/0)
prologue regression set (P1D drawer/leaf/final, P2A creation/agents/projection, create, conversation, shell)
    → 10 files passed; 119 tests passed (0/0/0) — with NODE_OPTIONS=--no-experimental-webstorage
    (all 3 failures of the same set without the flag are the known Node25 jsdom localStorage artifact)
full exo-app suite → 54 files passed; 533 tests passed (0/0/0)
typecheck / lint / build / git diff --check → exit 0 / exit 0 / exit 0 / OK
"existing single-cache/lens/Hub/create isolation" behaviors preserved (all construction tests that passed in R1 still pass).
```

### 2.4 Not executed at this recheck

- Whole-app five-width dual-environment browser matrix — still CP4 (Solaire: not repeated while blockers remain)
- Acceptance-owned independent probes re-run — Acceptance does them; Builder never touches probe implementation
- No commits; no real-user data or backend access; opening/closing DB baseline unchanged `OK: 8 rows [1..8]`

### 2.5 Declared boundaries / notes for this repair

1. While A's PATCH is pending on B, the shared page-level mutation observer's `isPending` keeps the B dialog's submit disabled until A settles — TanStack v5 does NOT queue distinct executions here because no mutation `scope.id` is configured; this is the observed UI pending-lock (button shows `保存中…`/locked), not a queue (D01 correction). B's dialog itself is never disturbed/closed by A's completion; this matches the frozen Plan's late-completion-isolation intent.
2. F02's banner wording is a builder choice; acceptance is wording-neutral for F04 only, and F02 required "field reasons visibly, inputs retained, retry allowed" — satisfied per-control without a new error subsystem.
3. F03 lifted the P1D detail guard exactly at the authorized shared boundary; `fetchProjectFiles` row identity (mixed-ID risk) intentionally untouched before CP2.
4. Repository state unchanged in kind: staged 0 Builder-owned; the same 10-file M set now includes `chat/control/api.ts` (approved narrow repair) + `test/helpers.tsx`, plus untracked features/projects, tests, and the single Evidence file.
```
## 3. Stage B implementation (CP2 section — recorded at the mandatory stop, pane 4)

Authorized by CP1 R2 PASS (F01–F04 closed, FAIL=0). D01 documentary correction applied to §2.5(1). Start Gate: HEAD unchanged `b1178fb`; P2A pins unchanged (not re-pinned this stage); real DB baseline checked again at close `OK: 8 rows [1..8]`.

### 3.1 Frozen contracts verified against backend source (read-only) before coding

| Contract | Verified source | Wire truth |
|---|---|---|
| Files list | `core/views.py::ProjectFileViewSet.list` + `core/serializers.py::ProjectFileSerializer` | bare array mixing `web_upload` rows (`{id:int, name, file_type, type, size, file, url, preview_url, source:'web_upload', created_at}`) and `obsidian_sync` rows (`{id:'kf_<int>', name:'<title>.md', file_type:'text/markdown', size:0, file:null, source:'obsidian_sync', created_at}`) |
| Upload | `core/views.py::ProjectFileViewSet.create` | POST multipart field `file` → 201 serializer row (no `source` in create response; list marks it) |
| Delete | `core/views.py::ProjectFileViewSet.destroy` + `core/services.py::ProjectFileService` | DELETE `/files/<pk>/` pk verbatim int or `kf_<int>` → 204; DRF error envelopes `{error, code}` (400/404/409/500) |
| Knowledge list | `memory/views.py::KnowledgeFragmentListView` | GET `/api/memory/knowledge/?project=<id>`; bare array (no pagination_class configured — `page_size` attr inactive); serializer fields `{id, uid, title, topic, status, source_type, tags, keywords, abstract, project, created_at, updated_at}` |
| Knowledge PATCH | `memory/views.py::KnowledgeFragmentDetailView.patch` + `_revectorize_kf` | `{abstract?: str, keywords?: str[]}` → `{msg, updated}`; abstract change spawns an ASYNC embedding-provider thread; keywords non-array → 400 |

### 3.2 Changed files / symbols (Stage B stage mapping)

- `features/chat/control/types.ts` — `ProjectFileId` (number | string), `ProjectFileRow.id` widened + `source: string | null` (D3 repair in the P1D shared boundary)
- `features/chat/control/api.ts` — `isVerifiedProjectFileId` (positive int OR `kf_<positive int>`), `fetchProjectFiles` mixed-ID validation + source normalization (D3; source NOT a rejection gate)
- `features/projects/types.ts` — NEW `ProjectKnowledgeRow`, `KnowledgePatchValues`, `KnowledgePatchResult`
- `features/projects/api.ts` — NEW `fetchProjectKnowledge` (bare array, minimal row normalization), `uploadProjectFile` (multipart FormData; non-object 2xx → ambiguousWrite), `deleteProjectFile` (204 no-JSON-parse; pk verbatim), `updateProjectKnowledge` (PATCH envelope guard; malformed 2xx → ambiguousWrite)
- `features/projects/queries.ts` — NEW `projectKnowledgeQueryKeys`; `useProjectKnowledgeQuery`; `useUploadProjectFileMutation` / `useDeleteProjectFileMutation` (dual invalidation: files + knowledge — CP2 visibility rule); `useUpdateProjectKnowledgeMutation` (knowledge only). ALL Stage B mutations bind invalidation to SUBMIT-TIME `variables.projectId` (F01 rule extended — TanStack v5 replaces pending-mutation handlers on re-render; variables survive)
- `features/projects/projection.ts` — NEW `fileSourceLabel(source, id)` (known CONSISTENT pairs named; unknown/ID-inconsistent → neutral `引用文件`), `isSyncedFileId`, `fileAvailabilityNote` (D6), `formatFileSize`, `splitKeywords`/`joinKeywords`, `knowledgeSourceLabel`, `knowledgeAbstractLabel`
- `features/projects/ProjectFilesSection.tsx` — NEW: consumes the CANONICAL P1D `useProjectFilesQuery` (same key as chat-local drawer — no second files owner), upload control, row delete confirm (names row + source), synced rows state no physical browser file, no Open/Download control (D6), independent error/loading/empty (§5.6)
- `features/projects/ProjectKnowledgeSection.tsx` + dialog — NEW: separate list; only abstract/keywords editable; success claim = saved + background index refresh STARTED (abstract change) / just saved (keyword-only); failure preserves input + prior truth; terminal saved state keeps wording assertable
- `features/projects/errors.ts` — NEW `backendErrorText` ({error, code} visible)
- `features/projects/ProjectDetailPage.tsx` — mounts Files + Knowledge between overview and Conversation lens (identity gate: children only after confirmed detail — §5.6 preserved)
- `features/projects/projects.css` — section/row/chip styles + `app-btn--danger`/`app-btn-sm`/`app-textarea`/`app-banner--success`
- `ReactSheet.md` — exact-contract reconciliation ONLY on the consumed blocks: §2.1 Knowledge (fields, ?project filter, PATCH semantics, revectorization claim rule), §3.8 Projects (name/description/prompt/work_dir fields), §3.9 Files (mixed rows, multipart `file`, pk int|kf_ verbatim, 204)

### 3.3 Regression math (numeric)

```text
focused Stage B: p2b_files_knowledge.test.tsx (18) + p2b_projects_projection.test.ts (6 new) + p1d_project_api.test.ts (10 D3 cases)
    → 3 files passed; 50 tests passed (0/0/0)
Stage A + P1D/P2A prologue regression (p2b_projects, p1d_drawer/leaf/final, p2a_creation/agents/projection, create, conversation, shell)
    → 10 files passed; 151 tests passed (0/0/0)
    (Stage A detail-count assertions upgraded to EXACT-path `detailGets` because the Files list now shares the /api/core/projects/<id>/ prefix — intent preserved, not weakened)
full exo-app suite → 56 files passed; 567 tests passed (0/0/0)
typecheck / lint / build / git diff --check → exit 0 / exit 0 / exit 0 / OK
real DB baseline (close) → OK: 8 rows [1..8]
```

### 3.4 Scope searches / absent surface

```text
fixedProject | delete-preview | keep_file_ids | frozen_project_ids in features/projects → 0 hits
fixedProject in features/chat → 0 hits (Stage C untouched)
files query family declarations → exactly 1: chat/control/queries.ts::controlQueryKeys.projectFiles
/ api/memory/knowledge/ adapters → exactly 1: features/projects/api.ts::fetchProjectKnowledge (+ PATCH updateProjectKnowledge)
package.json dependency diff → 0
ReactSheet.md touched blocks → only §2.1/§3.8/§3.9 exact P2B contract text; no unrelated churn
```

### 3.5 Not executed at CP2

- fixed-Project conversation creation and Project deletion (Stage C; prohibited before its release)
- full five-width dual-environment browser matrix (CP4)
- independent acceptance probes re-ran by Acceptance, never by Builder
- no commits; no real-user KnowledgeFragment mutation or embedding-provider call — every Stage B test runs on mocked HTTP fixtures only
- no backend/V3/dependency edits

### 3.6 Declared boundaries / notes

1. Knowledge edit sends ONLY changed fields (no-change → close without request); the honest claim wording derives from the submitted patch, never from the `updated` envelope.
2. The backend `_revectorize_kf` thread is single-threaded per PATCH; the UI only reports background refresh started.
3. `uploadProjectFile` treats ANY object 2xx as success (upload rows are not identity-critical for invalidation; the dual refetch re-reads server truth). Non-object 2xx → ambiguous write with dual invalidation.
4. The Files section + chat drawer share the SAME query cache; invalidation refresh consistency is tested across both mounted consumers at page level (CP2 visibility rule).

## 4. R3 repair (CP2 recheck — recorded after pane-3 R3; findings B01–B04, H03 acceptance-side)

Authorized order: B01 → B02/B03 → B04; same-origin sibling paths; stop again at CP2; no Stage C, no commits.

### 4.1 Fix → finding mapping

| Finding | Files/symbols | Fix |
|---|---|---|
| B01 resource origin | `ProjectDetailPage.tsx` (section mounts), `ProjectFilesSection.tsx` (`pendingDelete` session now `{projectId,row}`; NEW origin-lived `uploadSession`/`uploadIssue`/`deleteIssue` feedback records + `originRef` reset effect), `ProjectKnowledgeSection.tsx` (`editing` reset effect + per-session dialog keyed by row id + session-owned `sessionError`/`saved`) | Every request and cache effect carries ONE captured origin: confirm dialogs capture `{projectId, row}` at open and mutate with THAT pair; knowledge editor captures `originProjectId` at session mount; upload/delete pending+error feedback is SESSION-scoped (`uploadSession.projectId === projectId` gate) so a late old-origin failure can never paint on B. Both sections also own an in-section origin lifetime: a projectId prop change (direct mount or cached-route navigation) immediately retires dialogs/feedback. NOTE (found during verification): keyed-page remounts hit a React 19.2.6 sibling-reconciliation quirk here (cached destination commits kept the old keyed files section alongside the new one), so the origin EFFECT is the actual mechanism — page-level keys were removed. Probe-verified: acceptance 'route change retires open file dialog' + 'old upload failure never renders as B-local outcome' both pass. |
| B02 lossless keywords | `projection.ts` (`splitNewKeywords` comma-only split; NEW `joinKeywords`), `ProjectKnowledgeSection.tsx` (keyword FIELD is the array editor; raw-text no-op detection) | The field's initial content is the LOSSLESS join of the stored list; the visible text is compared RAW for no-op detection — stored entries containing commas/semicolons/spaces round-trip untouched and are never PATCHed (probe: `plain`/`project plan`/`alpha;beta`/`one,two` no-op cases). Only an actual text edit is parsed, splitting ONLY on the documented 逗号 separators — `new phrase` stays ONE keyword; abstract-only edits never touch keywords. Chip+per-entry removal was tried, then replaced per the probes' full-array-replacement contract (`['plain']` + type → replaced array). |
| B03 honest index claim | `ProjectKnowledgeSection.tsx::KnowledgeEditDialog` submit + `saved` state | Success feedback derives from the AUTHORITATIVE backend response: index-start wording ONLY when `updated` includes 'abstract' (the backend starts its thread only for a stripped-different abstract). An edited abstract is sent RAW (backend strips/compares); a trimmed-equal edit yields `updated:[]` → plain 已保存, no index claim. No-op (raw-equal abstract AND raw-equal keyword field) closes without PATCH. `ReactSheet.md §2.1` updated to the strip/`updated` semantics. |
| B04 dialog a11y | `ProjectFilesSection.tsx` (delete confirm) + `ProjectKnowledgeSection.tsx` (editor) | Both dialogs now reuse the ACCEPTED shared `features/chat/dialogA11y.ts::useDialogA11y` contract: initial focus inside (editor refocuses the abstract textarea like the Project form), Tab/Shift+Tab containment, safe Escape, focus restore to the trigger; `closeDisabledWhileLocked` while a write is pending (close controls disabled; Escape suppressed) — consistent with B01 suppression and actual write safety. |

### 4.2 Numeric verification

```text
construction focused (p2b_files_knowledge + projection + p1d_project_api): 3 files / 63 passed / 0 failed
prologue regression (p2b_projects, p1d drawer/leaf/final, p2a ×3, create, conversation, shell): 10 files / 151 passed / 0 failed
independent CP2 probes (p2b_cp2.acceptance.test.tsx): 26 / 26 PASSED (was 12/26 at R3)
    — 26 includes both route-change dialogs, old upload failure isolation, session error isolation,
      all 4 no-op keyword samples, abstract-only isolation, trimmed-equal abstract (updated:[] w/o claim),
      both dialog focus/Escape cases, all three mounted-consumer refresh paths, error independence
full exo-app suite → 57 files / 606 passed / 0 failed
typecheck / lint / build / git diff --check → exit 0 / exit 0 / exit 0 / OK
real DB baseline (close) → OK: 8 rows [1..8]
```

### 4.3 Notes / deviations

1. RESOLVED/RETRACTED (R4): the earlier "React 19.2.6 keyed siblings duplicate during cached route change" note was an UNVERIFIED observation — no retained minimal reproduction or library evidence supports a broad framework claim, and no keys exist in the final source. The implemented mechanism is the monotonic origin-lifetime/token approach; see §5. (Original wording kept as correction record.)
2. RESOLVED/RETRACTED (R4/H04): the R3 full-array text-field editor was replaced by the array-native chips editor (§5.1) because a full-array text pipeline cannot preserve an untouched comma-bearing entry while another entry changes. There was no frozen "probe full-array contract" — interaction shape was never authoritative; see §5.
3. H03 (Acceptance fixture type annotations) is acceptance-side, not a Builder obligation; no probe files were edited, copied or committed by Construction.
4. Scope searches unchanged: fixedProject/delete-preview/keep_file_ids = 0 in features/projects and features/chat; one files query family; no dependency changes; no commits; no backend/real-user/paid-provider access.

## 5. R4 repair (CP2 recheck 2 — findings B01 residual / B02 residual / B04 regression; H04 acknowledged)

Authorized order: B01 → B02 → B04; same-origin sibling paths swept; R4 disposition explicitly authorized a narrow `chat/dialogA11y.ts` change and the array-native editor; stop again at CP2; no Stage C, no commits. FAIL count remains 2 (approval does not reset).

### 5.1 Fix → required-outcome mapping

| Required outcome (R4) | Fix (files/symbols) |
|---|---|
| Request identity vs retired UI-session lifetime; A→B→A must never revive an old session's local status/error; shared invalidate stays bound to R; current-live feedback stays visible | `ProjectFilesSection.tsx`: NEW monotonic `sessionTokenRef` (S = continuous UI-origin visit, bumped on EVERY origin transition; a fresh mount starts fresh). Upload/delete feedback records now carry `{token, …}`; per-call callbacks and display gates compare against the CURRENT token, so equal projectId cannot reattach a retired visit's outcome. Request identity (R) unchanged: mutate variables still carry the captured `{projectId}`/`{projectId+row}` pair; shared invalidation on success/ambiguous remains variables-bound and untoken-gated (failed writes correctly do not invalidate). The delete confirmation closing before its request does NOT retire the visit → same-visit errors stay visible. Knowledge editor session isolation unchanged (mount-keyed session + unmount) and probe-tested through A→B→A close/reopen. |
| Untouched atomic keyword entries must survive ANY other add/remove/edit; no delimiter join/split pipeline; one append = one literal keyword | `projection.ts`: `splitNewKeywords`/`joinKeywords` REMOVED; `keywordsEqual` (structural) added. `ProjectKnowledgeSection.tsx::KnowledgeEditDialog`: the editing source IS the stored array (`useState<string[]>(row.keywords)`); chips render entries verbatim (commas/spaces/semicolons/duplicates/empties are data); removal is index-based (`filter((_, i) => i !== index)`) so duplicates are distinguishable; the 追加 control appends ONE literal keyword (never parsed — a typed comma stays inside the entry); no-op = `keywordsEqual` + raw abstract compare → close without PATCH; abstract-only PATCH never carries `keywords`. |
| Pending focus must remain inside the modal; lock/unlock must not restore/re-capture the trigger or strand BODY; Escape reads CURRENT lock policy; preserve no-opts consumers and Branch locked behavior | `dialogA11y.ts` (authorized narrow fix): `locked`/`closeDisabledWhileLocked` are hot-read via `optsRef`; effect deps reduced to `[isOpen, onClose]` — lock transitions no longer re-enter the focus-lifetime effect (no cleanup restore-to-trigger, no re-capture). Public API unchanged. `ProjectKnowledgeSection.tsx`: dialog container `tabIndex={-1}` used as the pending focus ANCHOR (focused whenever `pending`, keeping focus inside while every control is disabled); settled states re-focus 完成 (success) or the abstract field (error). `BranchConfirmModal.tsx`: lock transitions move focus to its still-enabled 取消 button (preserves its locked behavior under the new helper semantics). Files delete dialog: misleading dormant `locked` wiring removed (close-before-request design retained; no artificial pending state added). |
| Accountability cleanups (H04 / documentation) | `packages/app/upd_tests.py` Builder scratch DELETED. The React-19.2.6 keyed-sibling duplication claim is RETRACTED as unverified (no retained reproduction; no keys existed in final source — §4.3(1) superseded). Stale comments aligned with actual source (no keyed-remount claims in sections; editor described as array-native). |

### 5.2 Numeric verification

```text
construction focused (p2b_files_knowledge + p2b_projects_projection): 2 files / 49 passed / 0 failed
    — incl. A→B→A upload/delete/knowledge-editor retirement, same-visit live errors visible,
      R4 real-entry append preserving ['one,two','keep'] → ['one,two','keep','extra'],
      literal comma entry ['a,b'], duplicate index removal, chip no-op round-trip,
      pending anchor focus + settled success/error focus + Escape suppression
prologue regression (p2b_projects, p1d ×4, p2a ×3, create, conversation, shell, p1d_project_api): 11 files / 172 passed / 0 failed
full exo-app suite: 56 files / 616 tests → 613 passed / 3 failed — ALL 3 failures are
    acceptance-side selector adaptations in src/acceptance/p2b_cp2.acceptance.test.tsx
    (label 关键词（逗号分隔）×2, placeholder 追加一个关键词 ×1 — the REMOVED full-array textbox),
    explicitly H04-acceptance-owned per R4 ("Acceptance will adapt its own interaction harness");
    the same 3 behaviors are covered by construction tests driving the shipped 追加/remove controls.
    Zero product/invariant failures.
typecheck / lint (0 warnings) / build / git diff --check → exit 0 / exit 0 / exit 0 / OK
real DB baseline (close) → OK: 8 rows [1..8]
```

### 5.3 Scope / deviations

1. Files changed this round: `ProjectFilesSection.tsx`, `ProjectKnowledgeSection.tsx`, `projection.ts`, `chat/dialogA11y.ts` (authorized), `BranchConfirmModal.tsx` (locked-behavior anchor — a directly-affected helper consumer), `projects.css` + `styles/shell.css` (minimal: chip remove button, keyword chip list, dialog anchor outline suppression), construction tests (2 files), Evidence (this §5), and deletion of `upd_tests.py`. No ReactSheet change was needed (it never described keyword-edit interactions). No query/backend/ownership boundary changes.
2. BranchConfirmModal anchor: behavior-preserving addition for the corrected helper semantics. It was initially BEYOND the authorized file boundary (disclosed post-hoc in this §5.3 — see §6/R5 disposition A: the bounded anchor is now explicitly authorized after the necessity/alternatives review; this paragraph does not retroactively describe it as pre-authorized). The lock-transition rationale is SOURCE-DERIVED (the corrected helper no longer re-enters its focus effect on lock flips); Branch's real-browser lock outcome remains UNVERIFIED and the anchor is not claimed to be the only possible implementation.
3. CORRECTED (R5 disposition C): the original sentence here claimed "all 8 dialogA11y consumers (Branch locked transitions + unstable-onClose callers included)" were regression-verified by the suite. That was FALSE — a green suite did not assert those transitions. Real inventory at that time: Branch locked STATE was asserted only as policy/disabled truth (runtime_lifecycle), NO activeElement assertion existed for any locked transition, and NO test covered callback-identity rerenders for the four inline-onClose consumers. The missing assertions are now supplied in §6; this correction is retained as history rather than implying the earlier run had them. jsdom evidence (construction) and real-browser evidence (acceptance-owned; Branch pending-focus browser check still recheck-pending) are reported separately. Other preserved items in the original sentence (D3 mixed-ID/source-neutral, single files key family + P1D read-only, three mounted-consumer refresh paths, B03 `updated` claims, F01 variables-bound invalidation, accepted CP1 isolation, P1A/P1D/P2A/P2B focused suites) remain accurate regression-verified claims.
4. Not executed (unchanged scopes): Stage C (locked), five-width dual-environment screenshot matrix (CP4), acceptance-probe adaptation (Acceptance-owned), browser-level pending-focus reproduction (acceptance recheck owns it; jsdom construction tests assert `document.activeElement` containment/restoration transitions).

## 6. R5 scope normalization (CP2 recheck 2 hold — resolved; not a verdict)

Per the R5 scope disposition (RESUME AUTHORIZED for bounded normalization; CP2 FAIL count remains 2). No prior unauthorized expansion is retroactively described as pre-authorized.

### 6.1 Actions

| Item | Action | Evidence |
|---|---|---|
| A. BranchConfirmModal anchor | RETAINED as the explicitly authorized bounded lock-transition anchor; comment recalibrated: source-derived rationale, browser outcome marked UNVERIFIED, no "only possible implementation" claim. Existing cancel / Escape / duplicate-submit / ambiguous policies untouched; helper API untouched; no generalization to other callers. | `features/chat/BranchConfirmModal.tsx` (only this file); new discriminating jsdom case below. |
| B. shell.css global suppression | REMOVED exactly the five lines added by the R4 repair (`/* Dialog container used as a pending-write focus anchor… */ .app-dialog:focus { outline: none; }`). No whole-file restore: `git diff -- styles/shell.css` is now EMPTY (predecessor changes preserved by construction). NO replacement suppression added anywhere; a visible focus ring is not a defect and hiding indicators is not a requirement — default browser focus styling left intact; real visual issues remain CP4 scope. | `styles/shell.css` diff = 0 lines. |
| C. Missing assertions | Added (see 6.2); Knowledge initial/pending/success/error focus assertions retained as-is. | focused runs below. |

### 6.2 New construction assertions (jsdom — real-browser coverage reported separately)

```text
src/test/runtime_a11y.test.tsx (R5 describe):
  - 'branch lock transition: focus anchors on the enabled cancel control; live Escape policy;
     no duplicate submit; release restores the trigger'
       STABLE onClose to isolate the anchor — asserts activeElement === 取消 after the lock engages,
       Escape suppressed while locked (dialog stays), a locked confirm cannot fire again
       (onConfirm stays at 1 call), post-release Escape closes and the invoking trigger regains focus.
       DISCRIMINATOR-PROVEN: with the anchor temporarily disabled the case FAILS (injection check).
       jsdom does NOT model Chromium's native disabled-focus drop; the case asserts the ANCHOR
       behavior, not the native drop.
  - 'branch modal / truncate modal: callback-identity rerenders keep focus contained; Escape still
     closes; trigger restored' (it.each, 2 generated cases)
       INLINE onClose harness (the real ConversationPage consumer shape): parent rerenders hand the
       helper a new callback identity; containment holds across rerenders; Escape remains functional;
       the trigger is restored after close.
src/test/p1d_hud.test.tsx:
  - 'R5 consumer: callback-identity rerenders keep HUD focus contained; Escape closes; trigger restored'
src/test/p1d_project_drawer.test.tsx:
  - 'R5 consumer: callback-identity rerenders keep drawer focus contained; Escape closes; trigger restored'
```

Coverage statement (per disposition C): the four inline-onClose consumers (Branch, Truncate, TacticalHud, ProjectFilesDrawer) are each individually asserted for rerender containment + functional Escape + eventual restoration — NOT a single representative case. Branch additionally covers the locked transition. Files-drawer delete confirmation's close-before-request design and Knowledge editor assertions are unchanged.

### 6.3 Numeric evidence (normalized candidate)

```text
focused (runtime_a11y + p1d_hud + p1d_project_drawer + p2b_files_knowledge + p2b_projects_projection): 5 files / 74 passed / 0 failed
full exo-app suite: 56 files / 621 tests → 618 passed / 3 failed — the same three acceptance-owned
    H04 selector adaptations in src/acceptance/p2b_cp2.acceptance.test.tsx (obsolete keyword UI
    interactions; Acceptance-owned adaptation, not product defects; product behaviors asserted via
    the shipped 追加/移除 controls in construction tests). Zero product/invariant failures.
typecheck / lint (0 warnings) / build / git diff --check → exit 0 / exit 0 / exit 0 / OK
styles/shell.css diff vs HEAD → 0 lines (five added lines removed, nothing else touched)
real DB baseline (close) → OK: 8 rows [1..8]
construction jsdom vs real-browser separation: the Branch locked-transition BROWSER outcome and the
    pending-focus browser reproduction remain acceptance-recheck items (jsdom cannot validate the
    native disabled-focus drop). No jsdom result here is presented as browser evidence.
```

## 7. Stage C start gate — pane 5 Sol, before production edits

### 7.1 Authorization and baseline

- CP2 R5 final disposition in `Plan/V4_Phase_2B_acceptance_report.md`: **Stage C released to pane 5**, CP3 mandatory hold, no commit, no backend/real-data destructive test.
- Frozen Plan SHA256 remains `4a93360627b1cde95e2bcac1c51c207ddf664309d184c0e14f332dcbbeb64082`; CP2 candidate pin is `Plan/V4_Phase_2B_acceptance_CP2_R3_baseline.json`.
- The handoff described HEAD `b1178fb1`; live HEAD is `0079a86ed894854df452e4244c78b46d697e0a2d`, a user-authored documentation-only commit changing the active skills. `git show --stat` confirms no app/Plan/runtime file in that commit. The accepted CP2 dirty production baseline remains over predecessor `b1178fb1`; Stage C preserves it.
- Opening real DB check: `OK: AgentPreset baseline 8 rows [1..8]`. No real Project/Conversation/Knowledge write is authorized; destructive verification stays at mocked HTTP/test boundaries.
- Risk: **H** — canonical shared creation surface plus irreversible Project lifecycle request and multi-family cache invalidation.

### 7.2 Verified source/contract boundary

- Canonical creation remains `CreateConversationDialog` → `useCreateConversationMutation` → `POST /api/agents/sessions/init/`; Home and Agent Profile are the existing selectable/fixed-Agent call sites. Stage C adds only a `fixedProject` mode and a Project Detail call site; no second mutation/schema/route.
- Backend `ProjectViewSet.delete_preview` returns exactly `{conversations_to_archive, files:[{id,name,size}], files_total_size}`; files are uploaded `ProjectFile` rows with numeric IDs.
- Backend `ProjectViewSet.destroy` reads `request.data.keep_file_ids` (default `[]`), calls `ProjectLifecycleService.archive_and_delete`, returns 204 on success, and returns `{error,code}` on lifecycle failure.
- Lifecycle service deletes all `ProjectFile` rows; selected physical files are moved to detached `SavedFiles` paths, surviving Knowledge and direct Conversations are re-homed to `Archived Project`, and direct Conversations also move to `Archived Chat`. `file_rollback_failed` explicitly means filesystem restoration failed and requires manual server inspection.
- Existing changed-fact keys inspected: `queryKeys.projects`, `queryKeys.conversations`, `queryKeys.conversation(id)`, `controlQueryKeys.cache(id)`, source Project detail/files/tree families, and `projectKnowledgeQueryKeys.projectKnowledge(id)`. No Knowledge-detail query family currently exists.

### 7.3 Stage C construction matrix

| Dimension | Frozen Stage C answer |
|---|---|
| Invariant | Fixed-Project creation uses the one canonical dialog/mutation, captures exact Project+Agent at submit, exposes no Drift selector, and preserves Home selectable/fixed-Agent/g045 extension behavior. Deletion can submit only after the current dialog session's successful preview; only numeric IDs from that preview enter an explicit `keep_file_ids` array. After confirmed 204, all existing affected canonical cache families are marked stale before one navigation to `/projects`. |
| Entry paths | Home selectable dialog; Agent Profile fixed-Agent dialog; Project Detail fixed-Project dialog; Project Detail deletion open/retry/confirm/cancel; route switch/unmount during pending create, preview, or delete. |
| State | creation selectable/fixed Agent/fixed Project, standard/g045, pending/definite failure/ambiguous success/closed or switched origin. Deletion preview pending/failure/malformed/success/retry/reopen/late result; no files/some selected/all selected; DELETE pending/4xx/404/409/500/503/`file_rollback_failed`/204. |
| Timing | submit-time identity survives later route/prop change; old preview generations cannot replace a newer retry/session; confirmed delete invalidation precedes navigation; failed DELETE never retries automatically. |
| Failure | malformed preview is explicit; errors retain Project page and show backend message/code; rollback-failed gets stronger manual-inspection copy; no archive/rollback atomicity claim. |
| Ownership | `CreateConversationDialog` remains creation coordinator; `features/projects/api.ts` owns preview/delete wire adapters; `queries.ts` owns lifecycle invalidation; one Project-local dialog owns preview-session/recovery UI; `ProjectDetailPage` only opens the flows and performs canonical navigation. |
| Observation | focused construction tests assert exact request bodies/routes, three creation entry modes, stale-origin suppression, preview generation/session isolation, numeric-only selections, no auto retry, cache stale state before navigation, and error copy. Static searches reject duplicate creation/lifecycle owners and forbidden backend/V3/dependency edits. |

### 7.4 Explicit boundaries

- Stage order is fixed: creation compatibility is implemented and checked before deletion production work begins.
- No hidden archive-target fetch/cache, migration map, whole-QueryClient clear, file-open promise, generic lifecycle framework, or backend/API change.
- CP1/CP2 code is preserved unless Stage C's already-approved shared integration requires a direct edit. Frozen Plan and Acceptance-owned report/probes/baseline files remain read-only.

## 8. Stage C implementation and CP3 construction checkpoint — pane 5 Sol

### 8.1 Implementation facts

| File :: symbol | Observable change |
|---|---|
| `features/chat/CreateConversationDialog.tsx` :: `fixedProject` | The accepted canonical dialog now accepts one narrow validated `{id,name}` Project identity. Fixed mode renders that Project without Drift/project selector, leaves Agent selection active, uses the fixed Project as submit-time `project_id`, excludes it from g045 extension choices, and adds the fixed Project ID to the existing stale-origin token check. Home selectable and fixed-Agent modes retain their existing props/mutation. |
| `features/projects/ProjectDetailPage.tsx` | Confirmed Project identity exposes “开始会话” through the canonical dialog and “删除项目” through a per-open monotonic delete-session ID. Route changes retire edit/create/delete local dialogs. Confirmed creation navigates to `/chat/:conversationId`; confirmed deletion callback navigates once to `/projects`. |
| `features/projects/api.ts` :: `fetchProjectDeletePreview` / `deleteProject` | New guarded preview adapter accepts only non-negative counts/size and unique positive numeric uploaded-file rows. DELETE sends an explicit JSON `{keep_file_ids:[...]}` even when empty and does not parse/fabricate a result row. |
| `features/projects/queries.ts` :: preview key/query + `useDeleteProjectMutation` | Preview cache identity includes Project + confirmation-session ID, so reopen cannot reuse an older preview. After backend success, existing Projects/Conversations/source Project detail-files-Knowledge-tree families and discoverable direct-Conversation detail/cache families are marked stale with `refetchType:'none'`; no archive target is fetched and no global QueryClient clear occurs. The mutation callback resolves only after those invalidations, leaving guarded navigation to the dialog caller. |
| `features/projects/ProjectDeleteDialog.tsx` | New Project-local destructive dialog: current preview required; reopen/refetch starts with no selections; selected IDs are intersected with the current preview in preview order; duplicate DELETE blocked; failures remain on Project and require deliberate resubmit; `{error,code}` is visible; `file_rollback_failed` adds manual filesystem/log inspection warning. Copy states the preview limit, archive ownership, detached recovery files, deleted ProjectFile rows and non-guaranteed filenames without claiming transactional filesystem rollback. |
| `features/projects/types.ts`, `projects.css` | Narrow preview DTOs and Project-only responsive recovery-list/action styles; no generic lifecycle framework. |
| `ReactSheet.md` §3.8 | Replaces the Stage-C placeholder with the consumed preview envelope, explicit DELETE body/204 behavior, archive/recovery semantics and rollback-failure boundary. |
| `test/p2b_stage_c.test.tsx` | New Construction-owned focused cases for fixed-Project creation, g045 extensions, stale creation origin, preview gating/session replacement/late result, explicit empty/non-empty DELETE bodies, malformed preview, duplicate/failure behavior, rollback warning and pre-navigation cache staleness. |

### 8.2 Self-adversarial counterexamples

| Scenario | Observation |
|---|---|
| Three canonical creation entries | Project-fixed focused cases plus existing `create.test.tsx` Home selectable and `p2a_creation.test.tsx` fixed-Agent cases execute the same `/sessions/init/` adapter; focused combined run: 18/18. |
| g045 under fixed Project | Primary Project 7 is absent from extension checkboxes; selecting Project 8 sends `project_id:7` + `frozen_project_ids:[8]`. Standard fixed-Project body omits the g045 field. |
| Late creation after leaving Project | Submitted `{preset_id:5,project_id:7}` remains unchanged; shared Conversation invalidation occurs, while old-origin local navigation to conversation 88 is suppressed. |
| Reopen / replacement / old late preview | Each open increments session identity; refresh clears choices before replacement; an unresolved first-session preview cannot replace the second session's rendered file. |
| Stale/tampered recovery selection | Final array is rebuilt only by filtering current successful preview numeric rows in preview order; empty selection still sends `[]`; malformed/string/duplicate file identities fail the preview boundary. |
| Duplicate / failed DELETE | Pending controls lock a second submit and anchor focus inside the modal. A 503 failure renders backend message/code, retains Project, and leaves DELETE count at one until an explicit user action. |
| Filesystem rollback failure | `file_rollback_failed` retains the Project page and adds an explicit manual server filesystem/log inspection warning; no clean-rollback claim. |
| Post-204 cache ordering | A direct dialog harness seeds ten affected canonical keys plus an unrelated Project key. The `onDeleted` callback observes all ten affected keys `isInvalidated=true`; unrelated Project 8 remains false, proving invalidation completion precedes navigation callback without whole-cache clearing. |
| Hidden archive targets / unrelated scope | Source scan finds no archive Project/Agent fetch, migration map, second Conversation mutation/schema, backend/V3/dependency edit, or new file-open behavior. |
| Rollback/restart/concurrent DB writes | N/A: frontend mocked-HTTP scope; backend lifecycle transaction is consumed, not reimplemented. No real destructive request was executed. |

### 8.3 Verification facts

```text
creation-first gate:
  NODE_OPTIONS=--no-experimental-webstorage pnpm --filter exo-app exec vitest run
    src/test/p2b_stage_c.test.tsx src/test/p2a_creation.test.tsx src/test/create.test.tsx
  → 3 files / 18 tests passed / 0 failed-errors-skipped

after deletion implementation, focused Stage C file:
  → 1 file / 11 tests passed / 0 failed-errors-skipped

Stage C + directly affected CP1/CP2/P1D/P2A regression:
  p2b_stage_c, p2a_creation, create, p2b_projects, p2b_files_knowledge,
  p1d_project_api, p1d_project_drawer, p1d_controls_ownership, shell
  → 9 files / 151 tests passed / 0 failed-errors-skipped

pnpm --filter exo-app typecheck → exit 0
pnpm --filter exo-app lint      → exit 0
pnpm --filter exo-app build     → exit 0; 89 precache entries; existing chunk/deprecation warnings only
git diff --check + git diff --cached --check → exit 0; existing Windows LF/CRLF advisories only
closing real DB baseline → OK: AgentPreset 8 rows [1..8]
```

An intermediate focused run reported 8/10 because the new test fixture's generic Project-detail GET route also matched DELETE before its method-specific route. The fixture route was constrained to `method:'GET'`; no production edit was made for that harness defect, and the focused/final commands above were rerun afterward.

### 8.4 Scope and omissions at CP3 hold

- Stage C changed 7 production paths (`CreateConversationDialog`, Project detail/API/query/types/styles, new delete dialog), 1 Construction test path, the single Construction Evidence file and the already-in-scope consumed `ReactSheet.md` block.
- CP2 pin comparison after Stage C: 188 pinned paths, 11 changed, 0 missing. Eight are Stage C-owned pinned paths (six production, Evidence, ReactSheet); the other three are Acceptance-owned post-pin CP2 probe/report/browser evidence. New Stage C dialog/test paths were not present in the CP2 pin. Acceptance assets were not edited by Construction.
- Not executed: independent CP3 probes/verdict; full 56-file app regression (CP4 owns final full-suite repetition; Stage C used the 9-file directly affected regression); five-width dev/production browser matrix (CP4); real backend deletion/preview or any real Project/Conversation/Knowledge mutation.
- Construction deviation: live HEAD advanced from the handoff's `b1178fb1` to user-authored docs-only `0079a86e` for active skills. No runtime/Plan baseline moved. No product/API/dependency deviation from frozen Stage C scope.
- Adversarial razor: retained only the canonical fixed-Project mode, one session-local preview owner, exact lifecycle adapters, required affected-cache invalidation and Project-local UI. Rejected cancellation infrastructure, archive fetching, optimistic rows, generic CRUD/lifecycle abstractions, message-cache invalidation, global cache clearing and additional deletion telemetry.

### 8.5 CP3 R6 narrow repair — C01 latest-preview destructive eligibility

- **Finding/root cause:** [openai-codex / Solaire Acceptance] independently showed one invariant failing across four paths: TanStack keeps prior successful `data` after manual or query-driven refetch failure, while the original button and handler treated non-null data as destructive authority. CP3 R6 = 14/18; C01/P1; first CP3 FAIL.
- **Production repair:** `ProjectDeleteDialog.tsx` now derives one `hasCurrentPreview` gate requiring data plus `!isPending && !isFetching && !isError`. Both the rendered confirm button and `confirmDelete` use that same gate. Transition to current-preview error also clears recovery choices, including background-refetch failures that do not pass through the manual retry callback. Cached prior data may remain but cannot authorize DELETE.
- **Discriminating construction observations:** a valid selected preview followed by manual HTTP 503, then a second 503, keeps confirmation disabled and DELETE count zero; a subsequent successful preview renders a different row unselected, restores confirmation, and sends explicit `keep_file_ids:[]`. A query-driven malformed-2xx replacement likewise disables confirmation with zero DELETE; a later query-driven success restores a fresh unselected row. Initial malformed, per-open late result, numeric filtering, duplicate DELETE lock, ordinary/rollback errors, cache-stale ordering and all three creation modes remain covered.
- **Verification:** focused Stage C `1 file / 13 passed / 0 failed`; Stage C plus directly coupled creation/CP1/CP2 construction regression `5 files / 109 passed / 0 failed`; typecheck and lint exit 0; staged/unstaged whitespace checks exit 0 with pre-existing EOL advisories only.
- **Scope/razor:** changed only `ProjectDeleteDialog.tsx`, `p2b_stage_c.test.tsx`, and this Evidence subsection. No query/shared-helper/create/runtime/contract/backend/Acceptance edit, cancellation layer, cache purge, or retry framework. Full suite/native CP3 checks remain Acceptance-owned and unexecuted by Construction during this narrow repair.

## 9. Stage D — CP4 final visual/regression closeout (R7 handoff → construction)

### 9.1 Authorization and entry state

- R7 PASS released Stage D to pane 4 Ecki, CP4 mandatory hold; no commit; no cutover.
- Entry HEAD `0079a86e` (user docs-only advance, unchanged). Frozen Plan hash unchanged
  (`4a933606…eb64082`). Candidate pin `Plan/V4_Phase_2B_acceptance_CP3_R2_baseline.json`:
  235/236 pins match, 1 diff = `Plan/V4_Phase_2B_acceptance_report.md` (Acceptance-owned
  post-pin R7 append; left untouched). 0 missing.
- Real-DB baseline at entry and close: OK — AgentPreset 8 rows [1..8].
- Complete app suite at entry: 58 files / 652 passed / 0 failed — identical to R7 totals.

### 9.2 Static §8.8 audit (read-only, before any evidence run)

Project-owned pages/components re-audited for the §8.8 matrix. Findings: no residual
product gap that requires a production edit.

- No document-level horizontal overflow risk: `.project-hub-grid` (minmax 240px at ≥768,
  single column below), `.project-profile max-width 860`, all `overflow-wrap:anywhere`,
  filter bar scrolls inside its labelled region, dialog `width:min(540px,100%)` with body
  scroll owner.
- Long-name/action reachability: hub card name/desc/meta wrap; detail identity/desc/facts
  wrap; section headings and action groups `flex-wrap`; file rows wrap with delete action
  `margin-left:auto` staying in-flow; knowledge head wraps title/chip/edit.
- Long-content wrap: System Prompt/description/abstract/keywords render with
  `overflow-wrap:anywhere` + `white-space:pre-wrap` (facts/abstract) or chip clamp
  (`.project-chip-clamp` ellipsis) — nothing forces the viewport wider.
- Primary/destructive actions reachable: single `.app-scroll` owner per page; detail keeps
  `env(safe-area-inset-bottom)` padding (bottom bar hidden on detail per D8, verified rule
  exists); dialogs scroll their own body.
- Dialog focus/trap/restore: all Project dialogs use the accepted shared `useDialogA11y`
  (initial focus, Tab trap, safe Escape with lock, trigger restore); Knowledge editor adds
  the pending container anchor + settled focus; Files delete confirmation has the
  B01/B04 origin-lifetime + modal contract; delete-preview dialog has the preview
  eligibility gate and lock anchor.
- Accessible names / non-color-only state: filter radiogroup labelled "会话筛选", selected
  option is font-weight 600 vs 400 (not color-only) with `:has(:focus-visible)` outline;
  destructive/recovery copy is associated with controls; every action carries a text or
  aria-label.
- Reduced-motion and shell breakpoints intact: shared `prefers-reduced-motion: reduce`
  block untouched; `.app-topbar--detail` narrow grid and P2A breakpoints untouched.

Conclusion: no §8.8-driven production change is needed; this matches R7's "final-candidate
corrections only" scope (none required).

### 9.3 Browser evidence — dev + prod bundles, five widths (construction-owned)

New construction tool `packages/app/scripts/p2b_cp4_browser_probe.mjs` (zero new
dependencies: Node ≥22 native WebSocket → Chrome DevTools Protocol, headless=new).
Pattern mirrors the accepted P2A probe. All `/api/*` traffic is intercepted at the CDP
Fetch domain and answered with in-process fixtures (including long fixtures and the
delete-preview payload). No backend, real DB, network or provider interaction; the dev
server proxy targets never receive traffic. SW registration is blocked at document level
for deterministic layout measurement (sw.js itself and all product code untouched — the
real first-install reload behaviour stays an Acceptance-owned native observation, R7/H08).

| Env | app | base | Widths | Assertions | Screenshots |
|---|---|---|---|---|---|
| dev | http://127.0.0.1:5176 (vite dev) | — | 320/390/767/768/1280 | 282/282 PASS | 30 (dev-* PNG) |
| prod | http://127.0.0.1:5177 (`p2a_serve_dist.mjs`) | /app | 320/390/767/768/1280 | 282/282 PASS | 30 (prod-* PNG) |

Screenshot path: `Plan/.p2b-construction-shots/cp4/{dev,prod}-{hub,detail,edit-dialog,
file-delete-dialog,knowledge-dialog,delete-dialog}-{width}.png` (60 files). Screenshots
prove layout; mutation semantics are not inferred from them.

Assertion families (per width × env, real renderer):
- hub: long fixtures rendered (long project name + unbreakable work_dir in DOM); no
  document/body horizontal overflow; nothing out of viewport; single `.app-scroll` owner;
  long text fits or truncates; bottom bar visible only <768; three cards backend order;
  long-name card link + 新建项目 button named via AX; Chat nav active via aria-current.
- detail: long desc/prompt/file/abstract/keyword/kf + unknown-source rows rendered; no
  overflow; no out-of-viewport; single scroll owner; long text fits; detail bottom bar
  hidden; sidebar none<768 / flex≥768; safe-area rule present; four sections in order
  (name, 项目文件, 项目知识, 会话); filter radiogroup "会话筛选" named; 删除项目/编辑
  actions named; long conversation link named; filter selected weight 600 vs 400.
- edit-dialog: opened, within viewport, no overflow, focus entry on `#project-name`,
  dialog AX name 编辑项目, Escape closes, focus restored to 编辑 trigger.
- file-delete-dialog: opened, within viewport, no overflow, focus inside modal on open
  (shared helper: close control), AX name 删除文件 + 确认删除 button, Escape closes.
- knowledge-dialog: opened, within viewport, no overflow, focus entry on
  `#knowledge-abstract`, AX dialog name, Escape closes.
- delete-dialog (preview): opened, within viewport, no overflow, destructive title +
  long recovery row + archive copy visible, AX dialog name + recovery checkboxes, Escape
  closes.
- keyboard sweeps at 320 and 768: edit dialog focus entry direct, 8× Tab cycle stays
  inside the dialog every step, Escape closes, trigger restored.

Probe run note: first dev run exposed three harness-local assertion bugs (first section
heading is the project name, not a fixed string; CDP `.click()` does not focus the
trigger so `focus()` precedes click; initial dialog focus on the close button is the
shared helper's legal entry). All three were probe-side corrections, re-run green; no
production file changed as part of the evidence loop.

### 9.4 API wording

- `features/projects/api.ts` doc comments re-checked: end-points described exactly
  (bare-array Knowledge with the backend's unused `page_size` noted as stale wording;
  multipart `file` upload; verbatim pk DELETE; PATCH abstract/keywords with the backend
  `updated`-authoritative claim). No misleading wording found; no doc change needed.
- `ReactSheet.md` remains the consumed-contract artifact from Stage B/C reconciliation;
  no new contract consumed in Stage D.

### 9.5 Regression and scope scans at CP4 hold

```text
complete exo-app suite       58 files / 652 passed / 0 failed  (unchanged from entry)
pnpm --filter exo-app typecheck → exit 0
pnpm --filter exo-app lint      → exit 0 (0 warnings)
git diff --check               → OK (pre-existing LF/CRLF advisories only)
real DB baseline (close)       → OK: AgentPreset 8 rows [1..8]
production build               → 89 precache entries; existing warnings only
dev/prod five-width evidence   → 282/282 + 282/282 PASS (see §9.3)
```

Scope scans (grep), all 0 hits:
- new duplicate Project owner / second conversation collection / `?project=` list
  filtering endpoint / fixedProject-bypass or delete-preview affordance outside Stage C;
- any edit to `src/acceptance/*`, `Plan/*_acceptance*`, `Plan/.p2a-*/`,
  `Plan/.p2b-acceptance-shots/`, frozen Plan hash or P2A predecessors;
- any real backend/provider invocation in the evidence loop (CDP Fetch interception
  only; no POST/DELETE to a real origin; provider inputs only canned JSON).

New construction-owned files this stage: `packages/app/scripts/p2b_cp4_browser_probe.mjs`,
`Plan/.p2b-construction-shots/cp4/` (60 PNG). No other diff added by Stage D; the whole
P2B working tree (A/B/C shared files + Stage C dialog) stands as handed over.

### 9.6 Omissions and adjacent issues (unchanged from prior stages)

- Acceptance-owned: independent CP4 probes/verdict, five-width production visual
  acceptance

## 10. CP4 R8 repair — D01/D02 narrow fixes + E01 external blocker (pane 4)

### 10.1 Evidence §9 coverage correction (R8 accountability)

The §9.2 claim "all Project dialogs use the accepted shared `useDialogA11y`" is
CORRECTED: the canonical `CreateConversationDialog` has always been an inline a11y
implementation (initial focus + Escape + trigger restore) WITHOUT Tab containment.
§9.3's keyboard sweeps covered the EDIT dialog (`ProjectFormDialog`, shared
helper); they never exercised the creation dialog's Tab path. The R8 five-width
native sweep (acceptance-owned, 1750 checks / 162 FAILs all Tab containment in
fixed-create, and the keyword geometry measurement) closed that coverage gap on
the Product side. §9's "no production change needed" conclusion is RETRACTED for
D01/D02 — those existed in accepted predecessor source and were exposed by the
expanded final sweep; they are acceptance-missed legacy gaps, not Stage-D-new
regressions.

### 10.2 D01 — canonical creation dialog Tab containment (fixed)

Root cause: `features/chat/CreateConversationDialog.tsx` inline keydown handler
handled Escape only; `aria-modal=true` had no Tab trap, so focus reached
background page controls in all 10 env×width combinations.

Fix (pre-authorized narrow edit, one shared file, no helper/mutation/schema/
call-site change): extended the dialog-local `keydown` listener with a Tab/
Shift+Tab branch that collects the dialog's currently enabled focusables
(`input/select/textarea/button:not(:disabled), a[href], [tabindex]:not(-1)`,
filtered by `closest('[hidden]')`) and wraps within them (index arithmetic),
re-entering at the nearest edge if focus somehow left. Escape semantics
unchanged (still safe while pending/ambiguous — creation policy: the terminal
lock applies to submit, NOT to closing; the destructive close-lock policy was
NOT copied). First-field focus, trigger restoration, g045 dynamic permission
checkboxes (they appear/disappear inside the trap scope), submit-origin capture
and payload identity all preserved untouched.

### 10.3 D02 — long atomic keyword wrap + visible remove control (fixed)

Root cause: `<li class="app-chip project-keyword-chip">` inherits
`styles/base.css .app-chip {white-space:nowrap}`; the Project override added
`overflow-wrap:anywhere` without re-enabling wrapping, and the anonymous text
flex item pushed the trailing remove button far outside the modal body
(native: 1576px text in 250/502px chips, remove at 1637/1991px vs body
303/909px).

Fix (minimal Project-owned CSS + necessary chip markup; base.css untouched):
`projects.css` — `.project-keyword-chip` gets `white-space:normal +
overflow-wrap:anywhere`; the keyword text is now an explicit flex item
`<span class="project-keyword-text">` with `min-width:0 + overflow-wrap:
anywhere + white-space:normal` so wrapping actually takes effect; `.project-
chip-remove` gains `flex-shrink:0` so it stays visible and in-flow. Stored
entries are never split/truncated; literal/duplicate/empty entries and
remove-by-index semantics are untouched (regression-tested below).

### 10.4 Discriminating construction checks

New file `src/test/p2b_cp4_d01_d02.test.tsx` (self-contained: does NOT import
`test/helpers.tsx`, whose module graph reaches the E01-broken MessageContent
import):
- D01 forward trap: 12 Tabs never leave the dialog; last→first wrap; Shift+Tab
  from first → last control.
- D01 g045 mode: permission checkboxes render and stay inside the trap.
- D01 pending submit: submit disabled → skipped by the trap; Escape still
  closes (creation policy), onClose called once.
- D01 payload/restore: creation POST still fires, Escape restores the trigger.
- D02: the long atomic keyword renders verbatim in its dedicated
  `.project-keyword-text` span (sibling of the in-flow `.project-chip-remove`);
  same-row remove control present, enabled, aria-labelled with the full literal
  keyword; the empty entry keeps its own indexed remove (`移除第 4 个空关键词`)
  and index-removal does not disturb the long entry. The wrap/remove GEOMETRY
  discriminator lives in the real-browser probe (computed white-space normal +
  remove inside body at 320/1280) because vitest runs css:false (jsdom has no
  CSS); the jsdom-level checks assert the structural contract. Result: **6/6
  passed**.

Regression (E01-safe subset): `p2b_stage_c` (13) + `p2b_projects_projection`
(11) + all non-MessageContent paths re-run —**30/30 passed**. Files whose
import graph reaches `MessageContent.tsx` (create, p2a_creation,
p2b_files_knowledge, runtime_a11y, shell, ...) are BLOCKED by E01 and are
listed as not-executed, not skipped-silently.

Browser evidence (real Chromium, prod bundle rebuilt 08:47 containing the
fixes, CDP Fetch isolation): **292/292 assertions passed** incl. new
`cp4-d01-create-trap-320` (10×Tab + 4×Shift+Tab all inside the modal, ≥4
distinct controls cycled) and `cp4-d02-knowledge-{320,1280}` (chip text wraps,
remove control inside body + viewport, no document overflow). Screenshots:
`Plan/.p2b-construction-shots/cp4/prod-cp4-d0*.png` (3). dev-server browser
evidence for this round is BLOCKED by E01 (below).

### 10.5 E01 — external post-freeze dependency drift (recorded, untouched)

Observed facts (no attribution, no edits): after the CP4 entry state,
`katex`/`rehype-katex` were removed from `packages/app/package.json` and
`packages/chat-core/package.json` (chat-core JSON was observed mid-edit as
invalid, later valid but with a dangling empty dependency entry), `pnpm-lock`
reconciled by install at ~06:00, node_modules reflect the removal.
`MessageContent.tsx` is byte-identical to its pin and still imports
`rehype-katex`; current typecheck fails TS2307 there; vite dev-server transform
fails resolving `katex/dist/katex.min.css` from `main.tsx`. Fresh full-suite
rerun and dev-browser evidence are therefore blocked. Per R8 instruction this
is recorded as an external-owner blocker: NOT fixed by Construction (no
manifest/lock/node_modules/V3/MessageContent edits, no mask), and the final
fresh full regression must be rerun after the dependency owner restores
consistency. Note: `vite build` still succeeds (rollup CSS resolution differs
from dev pre-bundling), which is why the prod-bundle D01/D02 evidence above
was executable.

### 10.6 Command/log facts

```text
typecheck: after the external owner's concurrent MessageContent/main.tsx
  edits landed, E01's TS2307 is GONE from the current tree (the owner removed
  the katex imports themselves); final state of E01 remains owner-owned and
  was NOT touched by Construction. Construction edits: 0 errors.
vitest (direct binary, pnpm blocked by chat-core JSON mid-edit):
  p2b_cp4_d01_d02.test.tsx       6/6
  stage_c + projection + new    30/30 (E01-safe subset; E01-blocked files: not executed)
  re-run of E01-unaffected legacy files: p2b_projects_projection 11, p1d_paths 7,
  p1d_aura_* 17, sse_parser 8, runtime_storage 13 — all passed
prod-bundle browser probe (rebuilt dist): 292/292 (incl. 8 new D01/D02 checks)
dev-server browser probe: BLOCKED by E01 during the run (vite transform
  error on the then-present katex imports); by close, the external owner's own
  edits had removed those imports, so a fresh dev check is now possible but is
  left to the final CP4 rerun (per R8: final fresh matrix after dependency
  consistency is restored by its owner).
real DB baseline (close): OK: AgentPreset 8 rows [1..8]
```

Scope: D01 = 1 shared file + 1 new test file + probe; D02 = projects.css +
ProjectKnowledgeSection markup; no other production file touched. E01 files
untouched. A/B/C preservation stands (prior diff intact). No commit.

## 11. CP4 R9 — mechanical quality gates M01/M02 (pane 4)

Two post-verdict mechanical gates (product verdict D01/D02 closed; CP4 still
FAIL(2) pending these):

**M01 — missing React type import, one lint no-undef.**
`src/test/p2b_cp4_d01_d02.test.tsx:77` used `React.ReactElement` while only
value-importing from 'react' (no `React` namespace in scope). Fix = exact
pre-authorized scope: `import { useState, type ReactElement } from 'react'`
+ annotation `ReactElement`. No assertion, no production change.

**M02 — trailing whitespace on three blank lines.**
`packages/app/package.json:19,28` and `packages/chat-core/package.json:17`
carried a blank line with 4 trailing spaces (left after the external KaTeX
dependency removal / mid-edit state; JSON always parsed fine — NOT an E01
recurrence). Fix = stripped trailing whitespace on exactly those 3 lines.
No dependency name/version/order change, no lockfile touch, no install.

**Verification (all green):**
- `tsc --noEmit`: 0 errors (incl. Construction edits).
- `eslint src` (app): 0 problems; changed files 0 errors.
- `git diff --check`: rc=0 (untracked P2B files: `git diff --check` uncovers
  nothing; working-tree warnings are CRLF notices only).
- JSON semantic equivalence, rigorous: working-tree parse == `HEAD` parse
  minus the external KaTeX removal set (`katex/rehype-katex` app;
  `katex/rehype-katex/remark-math` chat-core) — both package.json exact
  semantic equality: **True / True**.
- Full suite (E01 now resolved by its owner — MessageContent/main.tsx imports
  already removed from the tree): **60 files / 667 tests / 0 failures**,
  matching the R9 independent 667/667.
- Real DB baseline close: `OK: AgentPreset 8 rows [1..8]`.

No new product P0/P1. No commit, no cutover, no production expansion.

## 12. CP4 R10 — independent PASS, P2B closed (pane 4 record)

Independent acceptance verdict (sole authority: `Plan/V4_Phase_2B_acceptance_
report.md` R10, CP4_R3 pin 466 pins): **CP4 R10 PASS — P2B all four gates
complete, consecutive FAIL count reset to 0.** Independent final
lint/typecheck/build/both diff-checks all clean; full suite 60 files /
667 tests with 0 fail/error/skip; M01/M02 reverse-reconstruction exactly
matches the R9 pre-fix hashes (precisely 2 lines of type import/annotation +
3 whitespace-only lines; all production/lock pins untouched). R9's native
browser evidence (1750/1750 + keyword 2/2 + g045 pending/ambiguous 152/152)
stands as recorded — not re-shot this round. Real-DB close baseline: 8 rows.

Construction side closes with this entry: D01/D02 (R8), M01/M02 (R9),
Stage D static audit, and all prior stages A–C remain as recorded in this
file. No further feature edits; acceptance assets untouched; no
commit/push/deploy/root-cutover. Per protocol, no broadcast to idle peers.

## 13. CP4 R11 — user-demo lens-scroll defect, narrow repair (pane 4)

Post-PASS user-demo finding (not a D-stage regression; CP4 reopened on this
single item). Root cause: `.project-filter-option input` /
`.agent-filter-option input` are `position:absolute` with NO positioned
ancestor — the visually-hidden radios escape `.app-scroll`, extend the
document (hidden overflow), and chip click/key focus-scrolls the DOCUMENT
(no scrollbar exists) → page permanently shifts up; switching back to
全部 does not restore. Acceptance validated the mechanism (observations +
`assessment/r11-lens-scroll/` VALIDATE_FIX=1 EXPECT_FIXED=1 exit 0).

Authorized narrow repair (3 files), exactly as prescribed:
1. `projects.css` `.project-filter-option`: + `position: relative;`
2. `agents.css` `.agent-filter-option`: + `position: relative;` (one line)
3. `ProjectFilesSection.tsx`: the abs 1×1 `.project-file-input` →
   native `hidden` + `aria-hidden="true"` + `tabIndex={-1}` (mirrors
   ChatComposer's attach inputs); the `.project-file-input` CSS rule
   deleted from `projects.css`.

No other edits; no global CSS; no dialog/layout changes. Remaining
`project-file-input` references exist only inside the acceptance-owned
probe (DOM query + verification styles) — untouched, as Acceptance-owned.

Verification (all green):
- focused P2B suites 87/87 (d01/d02 6, agents, files_knowledge, projects);
- full suite **60 files / 667 tests / 0 failures** (matches R10 baseline);
- typecheck 0; `eslint src` 0; `git diff --check` clean; build OK
  (fresh dist contains the repair for the independent r11 recheck).
- Real DB baseline close: `OK: AgentPreset 8 rows [1..8]`.

No commit / no cutover. Independent recheck reruns the r11 probe
EXPECT_FIXED=1 on the rebuilt bundle.

## 14. CP4 R11 recheck — PASS, repair closed (pane 4 record)

Independent acceptance recheck (sole authority: acceptance report §R11,
CLOSED): 1) scope audit — only the three authorized files changed; dist
contains `position:relative` and the `.project-file-input` rule is gone;
2) r11 probe EXPECT_FIXED=1: all four scenarios pass (zero document
overflow, zero document scroll; wheel/mouse/keyboard all stable; filter
behavior unchanged); 3) real demo :8080 squashed 1280x480 pass (filter bar
~900px below fold; chip click and keyboard return to 全部 both yield
docScrollTop=0); 4) full suite 60/667 + lint + typecheck + diff-check all
green. P2B verification state restored: CP4 fully accepted. Not committed,
no cutover.

Construction closes with this entry. Whole-P2B record: Plan/
V4_Phase_2B_Construction_Evidence.md §1–§14 (Stages A–D, CP1–CP4 gates,
R1–R11 finding history). Nothing further to build; no broadcast to peers.
