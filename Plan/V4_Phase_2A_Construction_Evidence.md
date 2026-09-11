# V4 Phase 2A — Construction Evidence

> **Independent evidence file.** The approved Detailed Plan (`Plan/V4_Phase_2A_Agent_Hub_Profile_Detailed_Plan.md`) is frozen and read-only; all construction matrices and checkpoint observations live here (Plan §7/§10).
> **Ownership:** Stage A/C — DeepSeek pane 4 (Ecki); Stage B — Sol pane 5.

---

## 0. Start gate — shared preflight (recorded 2026-09-09, pane 4)

| Item | Recorded fact |
|---|---|
| Frozen Plan hash | `3b05d08738ad7aa6d7734f74c3aabad8d811b603c8297e77810ca0b97a1bc07f` (sha256 verified at start, matches Solaire's freeze) |
| Accepted Desktop baseline | `b1178fb1a974cd848fdeaa11a7d279df920b1a0c` — HEAD unchanged at construction start |
| Dirty manifest | clean except 3 pre-existing untracked planning artifacts: `Plan/V4_Phase_2A_Ablation_Execution_Review.md`, `Plan/V4_Phase_2A_Agent_Hub_Profile_Detailed_Plan.md`, `Plan/V4_Phase_2A_Source_Scout.md` (all preserved; not staged/rewritten) |
| Opening real DB baseline | `bash .agent/check_real_db_baseline.sh` → `OK: AgentPreset baseline 8 rows [1, 2, 3, 4, 5, 6, 7, 8]` |
| Stage A risk level | **M** (Plan §7; frontend-only read slice, no persistence/concurrency/API contract change). Escalation triggers: touching create-mutation/dialog ownership (Stage B scope) → stop and report; backend contract drift → stop and report per Plan §5 |
| Pane/file ownership | Stage A: pane 4 owns `features/agents/*`, router/shell/navigation projection, Chat Home Hub entry, app-local Agent styles, focused tests, this Evidence file. Stage B files (`AgentProfilePage`, `CreateConversationDialog` integration) are untouched by Stage A beyond Stage-A-owned surface |

## 0.1 Targeted §5 drift check (all verified against live source before first edit)

| Plan claim | Source verification |
|---|---|
| `GET /api/agents/presets/` visible-only list | `ExoCore/agents/views.py` L386–397: `AgentPresetViewSet` queryset = `AgentPreset.objects.filter(is_visible=True)`; list + retrieve share it (hidden preset detail ⇒ 404) |
| Preset serializer allowlist | `ExoCore/agents/serializers.py` L27–33: fields `id, name, description, agent_type, default_model, system_prompt, is_visible` — matches `AgentPresetRow` in `packages/app/src/features/chat/types.ts` |
| Preset create/delete closed | ViewSet = List/Retrieve/Update mixins only (no Create/Destroy) |
| Conversation list contract | `packages/app/src/features/chat/api.ts` `listConversations()` → `GET /api/agents/conversations/`, bare array, backend order authoritative; `ConversationSummary.agentPresetId` / `projectId: null` (Drift) normalization present |
| Init envelope | `createConversation()` reads only `data.conversation_id`; malformed 2xx ⇒ `ambiguousWrite` terminal lock (unchanged; Stage B surface) |
| Projects list consumers | Only `CreateConversationDialog` (`useProjectsQuery`) — Profile index introduces none |
| Memory list contract | `ExoCore/memory/views.py` `MemoryPlasmidListView.get`: `GET /api/memory/plasmids/?preset_id=<id>`, filters `preset_id__in=[preset_id, 2]` (requested + shared/global preset 2), returns bare `Response(serializer.data)` array; `MemoryPlasmidSerializer` fields include `tags` (JSONField list, `memory/models.py` L585) |
| apiFetch params support | `packages/shared/src/api.js` L45–52: `params` option sets URL searchParams |
| Shell detail projection | `packages/app/src/shell/AppShell.tsx`: `DETAIL_PATH = /^\/chat\/\d+$/` hides mobile bottom bar; `isChatActive` in `shell/navigation.ts` L27–28 covers `/` + `/chat/*` |
| Chat Home | `ChatHomePage.tsx`: topbar actions (新建会话 + MoreMenu); `RecentConversationList` list patterns, `formatDateTime` formatter, `app-chip--drift` reuse points |
| Create dialog (Stage B surface, read-only check) | `CreateConversationDialog.tsx`: props `{onClose, onCreated}`, react-hook-form fields, g045 `frozen_project_ids`, ambiguous-write lock — signatures match Plan §6.4 expectations; no Stage A edit |
| Test conventions | `src/test/helpers.tsx` `renderApp` re-mirrors production route tree (must be extended in lockstep); `installFetch`/`jsonResponse`/`callsToPath`; vitest jsdom, `globals: true` |

## 0.2 Insight / impact search (frontend equivalent)

Backend `query_insight.py` is not applicable (Stage A changes no backend contract). Equivalent frontend impact search executed:

- `isChatActive`: only consumer is `PrimaryNavigation.tsx` (extending the predicate is safe).
- `NAV_ITEMS`: unchanged by Stage A (Agent Hub is a Chat-area secondary entry, not a new product-area nav item).
- `renderApp`: consumed by 16 test files; extended in lockstep with the production router; existing route entries untouched.
- `router`: only consumer is `AppProviders.tsx`; route additions are additive.
- `useVisiblePresetsQuery`: reused unmodified by Hub (shared list query per Plan §6.2); consumers unchanged.

## 0.3 DevelopLog check

`DevelopLog/DebugLog.md` contains no Stage-A-relevant V4 incident. V3 hover-flash entries (AgentProfile.jsx / AgentHub.jsx) concern rejected V3 architecture and are not migrated; `AgentHub.jsx` drag-handle behavior is explicitly retired by D3.

---

## 1. Stage A construction matrix (risk M)

| Dimension | Frozen answers |
|---|---|
| Invariant | (1) Hub = all visible presets once, g045-first then numeric id, source array never mutated, no lifecycle/order/Memory-fan-out controls. (2) Profile read path = exact route-keyed preset detail; malformed/404/network are distinct; no PATCH. (3) Conversation lens = in-memory filter over shared `queryKeys.conversations`, backend order preserved, Project options derived from agent rows only, no Projects Query. (4) Memory = preset_id-keyed count+tags only; failure ≠ zero. (5) Route/shell: `/agents` L1 (bottom bar visible), valid `/agents/:presetId` focused L2 (bottom bar hidden), Chat nav active on both |
| Entry paths | direct URL, Chat Home Hub link, Hub card click, Profile back link, browser history, retry buttons, route switch `5→6` (same mounted component) |
| State | loading / success / empty (0 presets, 0 agent rows, 0 memory rows) / error (404, malformed top-level, network/HTTP) / invalid route syntax / stale filter after refetch removes Project / pending detail (memory gated off) |
| Timing | query-in-flight vs cached shared conversations; presetId switch mid-flight (route-keyed keys prevent bleed); refetch removing selected Project; memory enabled only after confirmed detail |
| Failure | contract error (non-array / non-object / non-numeric id) must surface as retryable error, never empty/zero success; 404 distinct from malformed; no silent catch |
| Ownership | `features/agents/api.ts` = adapters+guards; `features/agents/queries.ts` = route-keyed hooks; `projection.ts` = pure lens helpers; pages compose shared queries; router/shell/navigation = route exposure; chat feature untouched except additive Hub link |
| Observation | focused tests via real route tree + `installFetch` call log (methods, URLs, absence of requests); typecheck/lint/test/build exit codes |

## 2. Checkpoint records

### CP1 (Stage A) — recorded at mandatory stop (pane 4)

#### 2.1 Implementation facts (old → new observable behavior)

| File :: symbol | Change |
|---|---|
| `src/features/agents/api.ts` :: `getAgentPreset` / `listAgentMemory` | new adapters: preset detail guarded as top-level object with numeric id; Memory list guarded as top-level array and reduced to `{count, tags}` — Plasmid content never crosses the boundary |
| `src/features/agents/queries.ts` :: `agentQueryKeys.preset/memory` + hooks | new route-keyed Query family; `isValidPresetId` mirrors `isValidConversationId`; Memory enabled only after confirmed detail |
| `src/features/agents/projection.ts` | new pure helpers: g045-first ordering, Project option derivation, filter application, stale-filter fallback — all non-mutating |
| `src/features/agents/AgentHubPage.tsx` | new: deterministic Hub over the existing visible-preset list Query; loading/error/retry/empty distinct; no lifecycle/order/Memory-fan-out controls |
| `src/features/agents/AgentProfilePage.tsx` | new: focused L2 shell; invalid ID mounts zero query hooks; read-only identity/facts with honest fallbacks; shared-Conversation lens with All/Drift/Project radio filters; Memory count/tag summary + static P5 sentence |
| `src/features/agents/agents.css` | new app-local Agent styles (hub grid, identity facts, filter chips, memory tags); filter region scrolls horizontally only within itself |
| `src/app/router.tsx` | `/agents` + `/agents/:presetId` exposed under the AppShell |
| `src/shell/navigation.ts` :: `isChatActive` | `/agents/*` now counts as active Chat area (D4); no new nav item |
| `src/shell/AppShell.tsx` :: `DETAIL_PATH` | syntactically valid `/agents/:presetId` hides the mobile bottom bar (focused L2); Hub and invalid IDs keep it |
| `src/features/chat/ChatHomePage.tsx` | additive secondary entry link to `/agents` (topbar); create flow untouched |
| `src/features/chat/api.ts` :: `contractError` | one-token `export` so the Agent feature reuses the identical guarded-envelope factory |
| `src/main.tsx` | imports `features/agents/agents.css` |
| `src/test/helpers.tsx` :: `renderApp` | route tree extended in lockstep with the production router |

#### 2.2 Self-adversarial counterexample pass

| Scenario | Result | Evidence |
|---|---|---|
| two valid records / duplicates | covered | dup Project id collapses to one option; dup names with different ids stay distinct (`p2a_agents_projection` + lens test) |
| loading → success, pending detail gates Memory | covered | Hub loading test; Memory request count = 1 only after detail confirmed |
| dependency failure after partial setup (independent sections) | covered | Conversation error while detail fine; Memory error while detail fine — each shows its own ErrorState, never empty/zero |
| late completion after navigation (in-flight bleed) | covered | new test: preset-5 detail deferred, navigate to 6, resolve 5 late ⇒ identity stays 6, Memory `preset_id=6` only |
| concurrent entry through sibling public path (Hub card vs direct URL) | covered | both reach the same Profile implementation |
| hidden/ineligible owner | covered | 404 (visible-only queryset) distinct from malformed and network states |
| restart with persisted state / rollback / transaction | N/A | no persistence, no write path in Stage A |
| caller-suggested keeper | N/A | read-only slice; no keeper state |

#### 2.3 Verification executed

```text
pnpm --filter exo-app typecheck                  → exit 0
pnpm --filter exo-app lint                       → exit 0
pnpm --filter exo-app build                      → exit 0 (chunk-size advisory only)
git diff --check                                 → OK (LF→CRLF notices are repo-wide Windows cosmetics)

vitest full suite, attempt 1 (no NODE_OPTIONS)   → 48 files: 20 failed / 28 passed; 428 tests: 122 failed / 306 passed
    — known Node 25 jsdom webstorage collision reproduced (Plan §8.1); both attempts recorded
vitest full suite, attempt 2 (NODE_OPTIONS=--no-experimental-webstorage)
    → 48 files: 1 failed / 47 passed; 428 tests: 3 failed / 425 passed
    — the 3 failures were test-side defects (exact-match getByText, ambiguous match,
      fixture expectation violating D6 lens derivation), all fixed in Stage A
focused recheck after fix: p2a_agents_projection + p2a_agents
    → 2 files passed; 46 tests passed (before late-resolution test was added)
adjacent regression: shell / create / conversation / api
    → 4 files passed; 51 tests passed
final full suite (NODE_OPTIONS=--no-experimental-webstorage)
    → 48 files passed; 429 tests passed; 0 failed / 0 errors / 0 skipped
closing real DB baseline: bash .agent/check_real_db_baseline.sh → OK: AgentPreset baseline 8 rows [1..8]
```

#### 2.4 Repository searches (scope sweep)

- `agentHubOrder` in `packages/app/src/`: 2 matches, both inside the test asserting non-usage; zero production references
- `CreateConversationDialog` / `useCreateConversation` inside `features/agents/`: 0 matches (Stage B wiring absent)
- `agents/:…chat` route patterns: 0 matches (no Agent-specific chat page)
- `package.json` / `pnpm-lock.yaml` diff: 0 lines (no new dependency)
- V3 component/style imports in the patch: none — all new files import V4 app modules only

#### 2.5 Not executed / not independently verified

- Real-browser responsive checks at CSS widths 320/390/767/768/1280 (§8.7) — deferred to Stage C
- §8.4 creation matrix — Stage B
- Monorepo-wide build and V3 rollback regression — deferred to C2 gate (Plan §8.1)
- No independent acceptance spawned (Plan: Alicia decides; no commit made)
- No live-backend browser run; backend contracts verified by source read (see §0.1)

#### 2.6 Declared boundaries

- ~~The `没有符合条件的会话` filtered-empty branch was removed as dead code~~ — **corrected by CP1-03 (R1)**: D6 guarantees a non-empty subset only for **Project options** (they derive from current rows); the always-present Drift control can legitimately yield an empty subset. The wrong dead-code rationale was removed; the Profile now keeps the honest empty list plus an advisory `没有符合条件的会话。` hint (non-blocking per acceptance, added because the empty subset is real). The page comment now states the narrowed invariant.
- On a 404-preset Profile, the shared global Conversation query may still fetch in the background (no invented params); only detail/Memory requests are gated. No criterion bans this
- `git diff` emits LF→CRLF warnings on this checkout — cosmetic, pre-existing, no content change

#### 2.7 Repository state at CP1

```text
staged:    0 files (Builder-owned); Acceptance staged its own report + probe (never edited by Builder)
unstaged:  7 files — packages/app/src/{app/router.tsx, features/chat/ChatHomePage.tsx, features/chat/api.ts, main.tsx, shell/AppShell.tsx, shell/navigation.ts, test/helpers.tsx}
untracked: 12 files — 4 Plan docs (Ablation_Execution_Review*, Detailed_Plan*, Construction_Evidence*, Source_Scout* — the three pre-existing ones preserved untouched)
                    + 8 sources (features/agents/{api.ts, queries.ts, projection.ts, AgentHubPage.tsx, AgentProfilePage.tsx, agents.css} + test/p2a_agents.test.tsx + test/p2a_agents_projection.test.ts)
diff stat (tracked): +27/−5
new-file lines: 1489 total
```

Independent acceptance requested; Builder verdict: not issued.

---

## 3. R1 repair record (CP1 FAIL → repair; consecutive count 1)

### 3.1 Blocker mapping (Builder response requested by acceptance)

| ID | Repair map | Evidence / root cause confirmed |
|---|---|---|
| CP1-01 FILTER-FALLBACK | Root: `AgentProfilePage.tsx` kept the numeric `filter` state; `resolveConversationFilter` was only a render-time projection, so a returning Project silently re-selected itself. | Confirmed by reading the acceptance probe (`src/acceptance/p2a_cp1.acceptance.test.tsx`, probe 4) and the page source |
| CP1-02 PROJECT-IDENTITY | Root: row chip used `row.projectName ?? 'Drift'`, deciding Drift by display name; options already used the correct D6 rule → contradiction. | Confirmed at `AgentProfilePage.tsx` (row chip) vs `projection.ts` `deriveProjectOptions` |
| CP1-03 P2 doc error | Wrong invariant claim ("every filter option yields ≥1 row") in the page comment + Evidence §2.6; Drift subset can be empty. | Confirmed; also probe 2 documents the empty Drift subset |

### 3.2 Generalization / sibling-path audit (§2.2)

- `?? 'Drift'` search across `packages/app/src/`: **3 matches** — `AgentProfilePage.tsx:192` (repaired), `features/chat/ConversationPage.tsx:491`, `features/chat/RecentConversationList.tsx:86`. The two chat-feature matches are **accepted C1 surfaces outside Stage A ownership**; CP1-02 escalation trigger forbids touching shared Chat behavior for a local presentation rule → recorded, not modified.
- Missing-state combinations now covered: removed-Project-returning (resurrection), temporarily empty Agent lens + refill, failing refetch round trip, null/blank/whitespace Project names, true Drift rows.

### 3.3 Files changed in repair

- `src/features/agents/AgentProfilePage.tsx` — real state reconciliation effect (`projectIds` memo + `useEffect` → `setFilter('all')`); row chip uses `projectLabel`; corrected filter comment; advisory empty-subset hint (ul always rendered).
- `src/features/agents/projection.ts` — new shared `projectLabel` (D6 rule, reused by options and rows); `deriveProjectOptions` refactored onto it; `resolveConversationFilter` doc clarified as the render-time guard (kept — it covers the transient frame before the effect runs).
- `src/test/p2a_agents.test.tsx` — +6 component-level repair tests (fallback persistence, empty-lens refill, failing-refetch selection retention, null/blank/whitespace name rows, Drift rows, empty Drift subset + hint).
- `src/test/p2a_agents_projection.test.ts` — +1 `projectLabel` unit describe (3 cases).
- This Evidence file — CP1-03 corrections + this record.

### 3.4 Invariant restated

- Selection fallback (§6.2): after a **confirmed dataset update** removes the selected Project, the Profile-local state permanently becomes `all`; later refreshes cannot resurrect it. Pending/failing refetches keep the last successful dataset and never erase selection.
- Row identity (D6): Drift = normalized null `projectId`; positive id + unavailable name = `Project #<id>`; options and rows share one label rule.
- Second-order effects checked: no effect loop (`setFilter('all')` only when stale numeric selection detected); route-switch reset and reconciliation converge to `all`; error state during failed refetch is the honest §8.5 behavior and selection state survives it; backend order untouched.

### 3.5 Verification executed (repair)

```text
vitest src/acceptance/p2a_cp1.acceptance.test.tsx (read-only run) → 1 file / 6 passed / 0 failed
test-runner combined run: acceptance probe + p2a_agents + p2a_agents_projection → 3 files / 61 passed / 0 failed
vitest full suite (NODE_OPTIONS=--no-experimental-webstorage) → 49 files / 443 passed / 0 failed / 0 error / 0 skipped
pnpm typecheck → exit 0
pnpm lint → exit 0
pnpm build → exit 0
git diff --check && git diff --cached --check → exit 0 (LF→CRLF notices only)
```

Repair-cycle notes:
- One construction test initially raced react-query v5's observer notification (failed background refetch lands `status=error` with retained data one microtask after `invalidateQueries` resolves). Verified empirically with a temporary probe (deleted afterwards): cache state `error/data=2`, observer first renders the retained list, then the honest `会话加载失败` ErrorState; the stored filter selection survives the failed round trip and stays selected after recovery. Test now uses `findByText` polling; no production change was needed for the timing itself.
- A second test defect was a fixture naming mismatch (`conv N` wire rows queried as `row-N`) — assertion-only fix.

### 3.6 Not executed / deferred

- Real-browser 5 widths — Stage C.
- §8.4 creation matrix — Stage B.
- Monorepo/V3 — C2 gate.
- No commit; Stage B not started; acceptance files and Detailed Plan untouched.

---

## 4. R2 verdict receipt (Builder note, 2026-09-09)

- Solaire (pane 3) reported **CP1 R2 PASS**: consecutive-FAIL counter cleared; 9/9 independent probes pass (6 original + 3 Acceptance-added: empty-lens refill / same-Project cross-Agent switch / blank names / pending+failed refetch selection retention); full independent rerun 49 files / 446 passed / 0 failed/errors/skipped; typecheck/lint/build/diff checks pass; real DB baseline 8 rows OK. CP1-01/02/03 closed; acceptance report carries the R2 append and the preserved R1 ledger.
- Builder status: **stopped**. CP1 PASS does not equal P2A PASS. Stage B releases by Alicia to Sol per the frozen Plan; Stage C ownership returns to pane 4 only after Stage B. No commit made. Builder files remain unstaged/untracked; acceptance-owned report and probes remain Acceptance-exclusive.

---

## 5. Stage B start gate — fixed-Agent creation integration (recorded 2026-09-09, pane 5)

| Item | Recorded fact |
|---|---|
| Authorization / checkpoint | Alicia authorized pane 3 to release Stage B; pane 3 reported CP1 R2 PASS and explicitly released frozen Plan §7 Stage B / §8.4. Stage B stops at CP2; no Stage C, commit, or acceptance-file edit is authorized. |
| Frozen boundary | HEAD remains `b1178fb1a974cd848fdeaa11a7d279df920b1a0c`; Detailed Plan SHA256 rechecked as `3b05d08738ad7aa6d7734f74c3aabad8d811b603c8297e77810ca0b97a1bc07f`. CP1 report and `src/acceptance/` are read-only. |
| Opening real DB baseline | `bash .agent/check_real_db_baseline.sh` from `../ExoCore` → `OK: AgentPreset baseline 8 rows [1, 2, 3, 4, 5, 6, 7, 8]`; no real-DB fixture write is planned. |
| Risk | **H**: asynchronous confirmed write plus close/unmount/route-switch timing and shared cache side effect. Escalation trigger checked: the existing mutation can preserve unconditional shared invalidation while the dialog locally gates callbacks, so no global lock, persistence owner, second adapter/dialog, or framework is required. |
| Pre-existing work preserved | All CP1 production/tests/Evidence, Acceptance-staged report/probe, and the three planning artifacts remain in place. Stage B touches only the existing create owner, Profile integration, narrow query enablement, Stage-B construction tests, and this Evidence section. |
| Source / contract revalidation | Read current `CreateConversationDialog`, `useCreateConversationMutation`, `createConversation`, `ChatHomePage`, `AgentProfilePage`, DTOs, existing `create.test.tsx`, ReactSheet init contract, and all call sites. Current lines before edit: dialog export L58; visible-presets hook L85; create mutation L173; Profile detail L61. `createConversation` sends only canonical init fields and reads only positive `data.conversation_id`; mutation invalidates `queryKeys.conversations` before local success callback and on ambiguous success. |
| Incident / impact search | `DevelopLog/warnings.md` and `DevelopLog/DebugLog.md` contained no relevant fixed-Agent/create-late-navigation incident. Call-site search found four `useVisiblePresetsQuery` consumers, one mutation consumer, and one existing dialog mount; Home compatibility therefore remains observable without changing its call shape. |

### 5.1 Stage B construction matrix (risk H)

| Dimension | Frozen answers |
|---|---|
| Invariant | One canonical dialog/mutation/API path serves Home and Profile. Fixed mode submits the positive Profile preset captured at submit time and offers no Agent switch. Confirmed success always invalidates the shared Conversation family; navigation and dialog-local state occur only for the still-live originating dialog and same fixed-Agent identity. Existing duplicate-pending and malformed-success terminal locks remain. |
| Entry paths | Chat Home selectable-Agent dialog; Agent Profile fixed-Agent action; Drift/Project choice; g045/non-g045 permission branch; close/Escape; Profile route switch; confirmed and malformed 2xx; HTTP/network error. |
| State | selectable vs fixed; standard vs g045; Drift vs positive Project; idle/pending/success/error/ambiguous terminal; open vs closed/unmounted; unchanged vs switched fixed Agent. |
| Timing | Agent and permission data are copied into the mutation input at submit. During the awaited mutation/invalidation, close or Profile switch invalidates only the local origin; shared invalidation remains mutation-owned and outcome-aware. Duplicate clicks while pending remain blocked. |
| Failure | Ordinary failures update fields/banner only while origin is live. Malformed 2xx keeps the existing ambiguous invalidation and terminal lock only for a live dialog; a closed/stale origin receives no local state update or navigation. |
| Ownership | `CreateConversationDialog` owns form/lifecycle gating; `useCreateConversationMutation` retains canonical shared invalidation; `AgentProfilePage` only opens the existing dialog and navigates canonical Chat; API/body contract stays unchanged. |
| Observation | Real route-tree component tests inspect request bodies/call counts, radio absence/presence, disabled locks, canonical destination, stale-origin URL, and QueryClient invalidation/refetch after late success. No paid/external request. |

### 5.2 CP2 implementation facts

| File :: symbol | Old observable behavior → Stage B behavior |
|---|---|
| `src/features/chat/CreateConversationDialog.tsx` :: `fixedPreset` mode | Home-only selectable Agent form → the same dialog also accepts an already-validated Profile preset, displays it as non-editable, skips the unrelated preset-list request, and retains the same Project/Drift and g045 permission controls. Home omits the prop and keeps its existing radio selection behavior. |
| `CreateConversationDialog` :: submit origin | Completion always invoked local callbacks → every submit now snapshots the selected/fixed preset and permission IDs into the canonical mutation input; a dialog-local token plus mounted/fixed-ID check suppresses local success/error/ambiguous updates after close, unmount, or fixed-Agent change. Close revokes the token synchronously. No persisted or cross-unmount lock was added. |
| `src/features/chat/queries.ts` :: `useCreateConversationMutation` | Unchanged canonical owner: confirmed success first invalidates `queryKeys.conversations`, then invokes the guarded callback; malformed 2xx invalidates the same family before the guarded ambiguous callback. `useVisiblePresetsQuery(enabled = true)` gained only optional query enablement; its four existing ordinary consumers retain the default. |
| `src/features/agents/AgentProfilePage.tsx` :: Conversation section | Read-only Conversation lens only → adds one action mounting the canonical dialog with current `preset`; confirmed live success closes it and navigates to `/chat/<conversationId>`. Route Agent change resets/ closes Profile-local dialog state. |
| `src/features/agents/agents.css` :: `.agent-section-heading` | No Conversation-section action layout → small wrapping heading/action row using existing button tokens; Stage C retains final responsive/visual ownership. |
| `src/test/p2a_creation.test.tsx` | No Stage B construction tests → 6 real-route tests for fixed standard Drift/live canonical navigation, fixed g045 Project permissions, duplicate pending lock, malformed-success lock, close-late-success refresh without navigation, and submit-time Agent binding plus route-switch suppression. |

### 5.3 CP2 self-adversarial checkpoint

| Scenario | Applicable / observation | Command or inspection | Follow-up |
|---|---|---|---|
| Home selectable vs Profile fixed entry | Applicable: existing 9 Home creation tests and 6 Profile creation tests execute the same dialog. Fixed mode has 0 Agent radios and sends no list-preset request; Home still exposes eligible Agent radios. | Focused 4-file Vitest run, 70/70 executed | None |
| standard/g045 × Drift/Project | Applicable: Profile standard Drift body is exactly `{preset_id:5, project_id:0, thinking_level:'auto'}` with no frozen IDs; g045 Project 20 body includes only extension Project 10. Existing Home suite rechecks its Drift and g045 branches. | Request-body assertions in `p2a_creation.test.tsx` + `create.test.tsx` | None |
| duplicate pending submit | Applicable: fixed and Home submit buttons disable after the first POST; second click leaves one init request. | Focused Vitest | None |
| malformed 2xx / ambiguous write | Applicable: live fixed dialog displays terminal uncertainty and disabled `创建已锁定`; one POST only. Existing Home test also observes Conversation refetch and closability. | Focused Vitest | None |
| confirmed success, live origin | Applicable: shared invalidation completes before the live callback; canonical `conversation_id=88` is used despite fixture `session_id=999`; resulting Chat detail loads and `/999/` is never requested. | Focused Vitest + source inspection | None |
| close during pending request | Applicable: close synchronously revokes origin; late confirmed result causes a second shared Conversation-list request, while Profile remains and no Conversation-88 detail navigation occurs. | Focused Vitest | None |
| switch Agent during pending request | Applicable: POST body remains preset 5; after navigation through Hub to preset 6, late confirmed result refreshes shared Conversations but leaves preset 6 rendered and never opens Conversation 88. | Focused Vitest | None |
| late ordinary failure / late malformed success after close | Applicable by the same local-origin predicate used by catch and ambiguous callback; source-inspected. A dedicated close-late-confirmed-success runtime case executes the harder retained-side-effect branch; late error variants were not separately executed. | Source inspection | Reported under unexecuted items |
| restart / reload / cross-unmount lock | N/A by frozen boundary: Stage B must not claim or add one. | Source search: no storage/global lock added | None |
| backend transaction / rollback / paid provider | N/A: Desktop-only init consumer, mocked transport, no backend or LLM call. | Scope inspection | None |

### 5.4 CP2 verification executed

1. Initial mechanical focused attempt after construction:
   - `pnpm --filter exo-app typecheck` → exit 0.
   - `pnpm --filter exo-app lint` → exit 0.
   - `NODE_OPTIONS=--no-experimental-webstorage pnpm --filter exo-app test:run src/test/p2a_creation.test.tsx src/test/create.test.tsx` → exit 1; 2 files, 15 tests: 13 passed / 2 failed / 0 errors / 0 skipped. Both were construction-test assertion defects: a substring call counter included the detail endpoint, and the Project select was queried before its async section loaded. No production defect was inferred.
2. Targeted recheck after those assertion fixes → exit 1; 2 files, 15 tests: 14 passed / 1 failed. The remaining assertion incorrectly required exactly one detail fetch; canonical destination and alias rejection are now asserted without treating React Query refetch count as navigation count.
3. Final coherent CP2 construction run:
   - `NODE_OPTIONS=--no-experimental-webstorage pnpm --filter exo-app test:run src/test/p2a_creation.test.tsx src/test/create.test.tsx src/test/p2a_agents.test.tsx src/test/p2a_agents_projection.test.ts` → exit 0; **4 files / 70 passed / 0 failed / 0 errors / 0 skipped**.
   - `pnpm --filter exo-app typecheck` → exit 0.
   - `pnpm --filter exo-app lint` → exit 0.
   - `git diff --check` → exit 0 (LF→CRLF notices only).
   - `git diff --cached --check` → exit 2 because Acceptance-owned staged `Plan/V4_Phase_2A_acceptance_report.md:234` has a blank line at EOF. Builder did not edit or repair that read-only artifact; the Stage B unstaged diff check itself is exit 0.
4. Closing real-data check: `bash .agent/check_real_db_baseline.sh` from `../ExoCore` → `OK: AgentPreset baseline 8 rows [1, 2, 3, 4, 5, 6, 7, 8]`.

### 5.5 CP2 searches and scope facts

- `useVisiblePresetsQuery(` appears in 5 files including its declaration; four ordinary consumers retain default `enabled=true`. Fixed dialog passes `false` only when the validated Profile preset exists.
- `useCreateConversationMutation(` appears only in its declaration and the one canonical dialog consumer.
- `<CreateConversationDialog` appears in exactly 2 production files: Home and Agent Profile.
- canonical init adapter declaration count remains **1** (`createConversation`); Stage B production files contain **0** `session_id` reads and **0** alternate Conversation-create POSTs.
- Tracked Stage B delta: `CreateConversationDialog.tsx` +101/−41 and `queries.ts` +2/−1. Stage B also amended the CP1-untracked `AgentProfilePage.tsx` and `agents.css`, added the 214-line `p2a_creation.test.tsx`, and appended this Evidence; no honest stage-only numstat exists for the already-untracked CP1 files.
- Detailed Plan hash remains `3b05d08738ad7aa6d7734f74c3aabad8d811b603c8297e77810ca0b97a1bc07f`. Acceptance report/probe hashes observed at CP2 close are `d3599ab7…` / `060afdf4…`; neither was edited by pane 5.

### 5.6 CP2 not executed / declared boundaries

- Full exo-app suite and build were not rerun in Stage B; frozen Plan assigns the one final full pipeline to Stage C. Focused Stage A + creation scope ran as §5.4 records.
- Five-width real-browser responsive/accessibility observations remain Stage C.
- Late ordinary HTTP/network failure and late malformed 2xx after close/switch were source-inspected through the shared origin guard but not separately runtime-tested; live malformed locking and close/switch late-confirmed-success were executed.
- No live backend request, backend suite, provider request, monorepo build, V3 rollback regression, Stage C work, commit, or staging action was performed.
- `git diff --cached --check` is currently blocked only by the Acceptance-owned staged report EOF whitespace noted above; Builder ownership forbids changing it.

### 5.7 Repository state and CP2 hold

- Stage B changed **6 exact files**: `src/features/chat/CreateConversationDialog.tsx`, `src/features/chat/queries.ts`, `src/features/agents/AgentProfilePage.tsx`, `src/features/agents/agents.css`, `src/test/p2a_creation.test.tsx`, and this Evidence file.
- Worktree summary at CP2 collection: staged 2 paths (Acceptance-owned report/probe), unstaged 9 tracked paths (combined CP1 + Stage B), and 8 untracked status entries (including the `features/agents/` directory entry and Stage B test). No Builder file was staged.
- Stage B stops here. Independent CP2 acceptance requested; Builder verdict not issued. Stage C and commit remain locked.

---

## 6. Stage C start gate — visual closeout, regression and Evidence (recorded 2026-09-09, pane 4)

| Item | Recorded fact |
|---|---|
| Authorization | Solaire (pane 3) reported CP2 R3 PASS (51 files / 462 passed; typecheck/lint/build/diff 0; CP2-H1 was Acceptance-owned EOF, corrected) and released frozen Plan §7 Stage C to pane 4. Alicia's clarification: approved-Plan phases auto-handoff after PASS; CP3 remains a mandatory stop for pane-3 final acceptance. |
| Frozen boundary | Detailed Plan SHA256 rechecked at Stage C start: `3b05d08738ad7aa6d7734f74c3aabad8d811b603c8297e77810ca0b97a1bc07f` (unchanged). Acceptance-owned report + `src/acceptance/*` read-only. No commit authorized. |
| Opening real DB baseline | `bash .agent/check_real_db_baseline.sh` → `OK: AgentPreset baseline 8 rows [1, 2, 3, 4, 5, 6, 7, 8]` (recorded at Stage C start) |
| Risk level | **M** (Plan §7). Stage C touches only necessary responsive/focus/long-content/safe-area CSS plus the real-browser measurement instrument. Escalation triggers: any edit that changes create/caching/late-callback semantics (Stage B, R3-accepted) or shared C1 Chat behavior → stop and report; browser tooling unavailable → report honestly, never substitute jsdom. |
| Pre-existing work preserved | All Stage A/B production, tests and Evidence; Acceptance-staged report + 2 probes; 3 planning artifacts; this Evidence file is the only unified target. |
| Source revalidation (current post-B state read) | `AgentProfilePage.tsx` (304 lines), `AgentHubPage.tsx` (56), `agents.css` (216), `CreateConversationDialog.tsx` (341), `AppShell.tsx` (43), `ChatHomePage.tsx` (58), `PrimaryNavigation.tsx`, `router.tsx`, `main.tsx`, `styles/base.css` (433), `styles/shell.css` (2280). Stage B semantics confirmed present: `fixedPreset` dialog mode, origin-token gating, shared mutation-owned invalidation; no rewrite of these in Stage C. |
| Incident check | `DevelopLog/` contains no Stage-C-relevant V4 responsive/a11y incident (tail entries concern backend LLM gateway — unrelated). |
| Browser tooling decision | No Playwright/Puppeteer installed and Plan §8.8 forbids new dependencies. Node v25.7.0 provides a stable built-in `WebSocket` → real Chrome (`chrome.exe --headless=new`, v152) driven over CDP with **zero new packages**: `Fetch` interception answers all `/api/*` from in-process fixtures (zero backend/network/real-DB requests — creation scenarios isolated by default), `Emulation.setDeviceMetricsOverride` at 320/390/767/768/1280 with touch emulation <768, `Accessibility.getFullAXTree` for names/roles, `Input.dispatchKeyEvent` for keyboard. Instrument: `packages/app/scripts/p2a_browser_probe.mjs` (694 lines, kept for reproducibility). jsdom is NOT used as browser evidence (§8.7). |
| Stage C invariant | (1) At 320/390/767/768/1280, Hub/Profile/Home-with-Hub-entry + fixed-Agent dialog produce no document overflow; each page has exactly one main scroll owner. (2) Route links, filter controls, retry actions and the fixed dialog keep accessible names + keyboard behavior. (3) Active/selected/error meaning is not color-only. (4) Long Prompt/Conversation/Project/Agent names wrap or truncate without hiding actions. (5) Touch paths need no hover; Profile keeps bottom safe area when the mobile bar is hidden. (6) §8/§9 sweep: no preset writes/PATCH UI/V3 imports/drag order/Heartbeat/Library/Project-workspace/server-filter/second-collection/new-dependency/silent-catch. |

### 6.1 Stage C implementation facts (old → new observable behavior)

| File :: symbol | Change |
|---|---|
| `src/features/agents/agents.css` :: `.agent-profile` padding | Profile bottom padding gained `calc(… + env(safe-area-inset-bottom))` (16px mobile / 20px desktop fallbacks). The Profile hides the mobile bottom bar, so its own content now carries the home-indicator inset (§8.7); desktop env() resolves 0 → no change. |
| `src/features/agents/agents.css` :: `.agent-filter-option:has(input:checked)` | Selected filter chip adds `font-weight: 600` (unchecked 400) — selected meaning is no longer conveyed by color only (border/background remain as secondary cues). |
| `packages/app/scripts/p2a_browser_probe.mjs` (new, untracked) | Zero-dependency CDP real-browser probe: 344 assertions across 6 page scenarios × 5 widths + keyboard/error/creation sessions; exit 0 = all passed. Kept for acceptance reruns. |
| `packages/app/scripts/p2a_serve_dist.mjs` (new, untracked) | Static file server replicating the nginx `/app/` → `dist/` mapping so the production bundle can be browser-tested locally (`vite preview` cannot serve the `/app/` base build — the deployment mapping is nginx's; recorded, not an app defect). |

### 6.2 Browser observations (real Chrome, both runs)

Both runs execute the same 344 assertions against the same React tree/CSS, exit 0:
- **Run A — dev bundle**: `pnpm dev:app` (:5176), `node scripts/p2a_browser_probe.mjs` → 344/344 passed.
- **Run B — production bundle**: `pnpm build` + `node scripts/p2a_serve_dist.mjs 5177` (nginx-equivalent `/app/` mapping) + `MSYS_NO_PATHCONV=1 node scripts/p2a_browser_probe.mjs --app http://localhost:5177 --base /app` → 344/344 passed.

Measured per §8.7 (every item observed in the real renderer at all five widths unless noted):

| §8.7 criterion | Observation |
|---|---|
| No document overflow (header/identity/actions/filters/rows) | `documentElement.scrollWidth > clientWidth` and body equivalent both false on every scenario×width, including long-name/long-Prompt/long-Project/long-tag fixtures and the open dialog; every queried container rect inside viewport |
| One main scroll owner | Scrollable-element scan: exactly `.app-scroll` on every page (dialog scenarios additionally `.app-dialog-body`, the modal's own scroll); no nested/trapped scrollers |
| Accessible names + keyboard (links/filters/retry/dialog) | AX tree: filter `radiogroup` named 会话筛选; radios 全部/Drift/Project 7; dialog named 新建会话 with 关闭/创建会话; create action named; Chat nav `aria-current="page"` on /agents and /agents/5; Conversation links carry row names. Keyboard (real key events): Tab focus traversal works (CDP experiment, Enter required `char` event); radio group ArrowRight moves 全部→Drift→Project 7 and checked state follows; Enter activates the Hub 重试 button (request log proves refetch, 3 cards after recovery); Escape closes the dialog; dialog focus entry lands on the first field; g045 permission checkbox toggles with Space |
| Active/selected/error not color-only | Checked filter chip computes font-weight 600 vs 400 unchecked (measured); focus-visible outline 2px on the focused chip (measured); errors carry `role=alert` + text (AX); loading has perceivable text; nav active exposes `aria-current` |
| Long text wraps/truncates without hiding actions | Long name/description/Prompt/Conversation/Project/tag fixtures at all widths: every long-text element `scrollWidth <= clientWidth+1` or explicitly truncating; create/submit/close buttons remain in-viewport rects; no action hidden |
| Touch without hover + Profile safe area | Touch emulation enabled at 320/390/767 for all interactions; hover rules in `agents.css`/`shell.css` are decorative only (border/color), no functionality behind hover (source audit). Profile bottom-safe-area: CSSOM shows ≥1 `.agent-profile` rule containing `env(safe-area-inset-bottom)`; computed padding-bottom 16px mobile / 20px desktop (env resolves 0 in headless — mechanism + fallback verified; physical notch inset not renderable in headless, see boundaries) |
| Mobile shell behavior | Hub: bottom bar display flex <768, hidden ≥768; sidebar hidden <768, flex ≥768. Profile (valid id): bottom bar hidden/absent at ALL widths; sidebar follows breakpoint. Home (Hub entry): bottom bar follows breakpoint; Hub entry link named in AX |

Additional browser-observed flows (real renderer, fixture-isolated):
- Hub error state → Enter on 重试 → 3 cards render (recovery); Memory-section failure shows 记忆加载失败 while identity/Conversations stay intact; invalid `/agents/0` and 404 `/agents/99` states distinct with Hub recovery link.
- Creation in real browser: fixed-Profile dialog → POST captured `{preset_id:5, project_id:0, thinking_level:'auto'}` (no frozen ids) → exactly one committed navigation to `/chat/901`; g045 variant (preset 2, primary project 8, permission project 7 via Space) → body `{preset_id:2, project_id:8, thinking_level:'auto', frozen_project_ids:[7]}` (primary excluded) → same single canonical navigation. All `/api/*` answered from fixtures — zero external requests.

### 6.3 Stage C verification executed (final gate, §8.1)

```text
pnpm --filter exo-app typecheck                       → exit 0
pnpm --filter exo-app lint                            → exit 0
vitest attempt 1 (no NODE_OPTIONS)                    → 51 files: 19 failed / 32 passed; 462 tests: 119 failed / 343 passed
    — known Node 25/jsdom webstorage collision reproduced (window.localStorage.clear is not a function);
      secondary wrong-state assertions appear only inside storage-broken suites (Plan §8.1: record both attempts)
vitest attempt 2 (NODE_OPTIONS=--no-experimental-webstorage)
                                                      → 51 files / 462 passed / 0 failed / 0 errors / 0 skipped, exit 0
pnpm --filter exo-app build                           → exit 0 (chunk-size advisory + PWA inlineDynamicImports deprecation only)
git diff --check                                      → exit 0 (LF→CRLF notices only)
git diff --cached --check                             → exit 0
closing bash .agent/check_real_db_baseline.sh         → OK: AgentPreset baseline 8 rows [1, 2, 3, 4, 5, 6, 7, 8]
```

Both browser runs (dev + production bundle) recorded in §6.2. Screenshots for every scenario×width (30 PNGs) saved under `packages/app/scripts/.p2a-shots/` as evidence artifacts.

### 6.4 Stage C scope sweep (§8.8/§9)

| Sweep | Result |
|---|---|
| Preset lifecycle writes / primary-key changes | 0 in P2A surface. The only POST/PATCH/DELETE calls in `src/` are pre-existing C1 surfaces (attachments DELETE, cache DELETE, control PATCH) — none touch presets |
| Preset/profile PATCH UI | 0 — `features/agents/` contains no PATCH/POST/create/delete calls |
| V3 imports / local drag ordering | 0 — only hit is the Hub's own "no drag order" comment |
| Heartbeat / River / Library / Memory CRUD | 0 — only hit is the required static P5 sentence (记忆管理入口将在 P5 Library 阶段提供) |
| Project workspace / Group/Settings/notification behavior | 0 hits in P2A surface |
| Server-side Conversation filtering/pagination | 0 — `listConversations()` still issues the bare global GET, no invented params |
| Second Conversation collection / create adapter / Chat page | Conversations-list adapter count = 1; init POST endpoint references = 2 (declaration + the one canonical call); `/chat/:conversationId` route count = 1; Chat feature imports of the agents feature = 0 (one-way dependency) |
| New dependency / backend / deployment edit | `packages/app/package.json`, root `package.json`, `pnpm-lock.yaml` diffs = 0 lines |
| Silent catch / fabricated empty success | 0 `catch` statements in `features/agents/*` |

### 6.5 Stage C self-adversarial checkpoint

| Scenario | Applicable / observation | Evidence |
|---|---|---|
| Width boundary both sides (767/768) | Applicable — both widths measured; bottom-bar/sidebar projections flip correctly at the breakpoint | probe runs A/B, shell assertions per width |
| Long content at every width | Applicable — dedicated long fixtures (CJK name, 170-char unbroken ASCII prompt, 300+ char names/tags) on Hub/Profile/dialog | longTextFits + overflow assertions |
| Zero-Conversation Agent lens | Applicable — preset 2 lens is empty; EmptyState renders and the create action stays operable (g045 scenario) | probe 5b |
| Error/404/invalid at narrow width | Applicable — Hub error + retry-by-Enter, Memory error independence, invalid/404 pages at 390 | probe sections 3–4 |
| Dialog at 320 with long names | Applicable — dialog rect within viewport, submit visible, own scroll owner | probe matrix |
| Selected-state non-color cue | Applicable — measured 600/400 weights + 2px focus-visible outline | probe section 2 |
| Touch emulation | Applicable — enabled for <768 during all interactions; no hover-dependent functionality (source audit of hover rules) | probe + agents.css/shell.css read |
| Physical notch safe-area inset | Not renderable in headless — mechanism (env() in CSSOM) + fallback padding verified; real-device inset measurement not executed | §6.2 + boundaries |
| 400% zoom / reflow beyond frozen widths | N/A — frozen §8.7 defines the five widths; no additional width was added | Plan §8.7 |
| Service worker interference | Applicable — production-bundle runs disable SW registration at document level for determinism (dev builds have no SW); the earlier suspected SW path defect was retracted: the 404s were `vite preview` being unable to serve the `/app/` base (nginx mapping concern), not an app bug | probe source + §6.2 |

### 6.6 Not executed / declared boundaries

- Screenshots were captured (30 PNGs) but this Builder session has no image input and did not visually review them; layout verdicts rest on the numeric measurements, the PNGs are preserved for Acceptance/Alicia inspection.
- Physical notch/home-indicator inset pixels cannot render in headless Chrome; the safe-area mechanism (CSSOM `env(safe-area-inset-bottom)` rule + 16px/20px fallback padding) is what was verified.
- Real nginx was not started; the production-bundle browser run used an equivalent local `/app/` → `dist/` static mapping (`p2a_serve_dist.mjs`).
- Browser creation scenarios submitted against intercepted fixtures only — no real backend POST occurred (isolation by default).
- Monorepo-wide build and V3 rollback regression remain deferred to the C2 gate per Plan §8.1 (no shared/V3 surface changed in P2A).
- No commit, no P2B work; Stage B/C semantics (create/caching/late-callback) were not modified.

### 6.7 Repository state at CP3

```text
staged:    3 paths (Acceptance-owned: acceptance_report.md + p2a_cp1/p2a_cp2 probes) — never edited by Builder
unstaged:  9 tracked paths (combined Stage A+B+C): app/router.tsx, features/chat/{ChatHomePage.tsx, CreateConversationDialog.tsx, api.ts, queries.ts}, main.tsx, shell/{AppShell.tsx, navigation.ts}, test/helpers.tsx
           tracked diff stat: 130 insertions / 47 deletions
untracked: 9 entries — 4 Plan docs (3 pre-existing preserved) + features/agents/ + 3 P2A test files + packages/app/scripts/
           (scripts/: p2a_browser_probe.mjs 694 lines, p2a_serve_dist.mjs 52 lines, .p2a-shots/ 30 PNGs)
Frozen Detailed Plan hash: 3b05d08738ad7aa6d7734f74c3aabad8d811b603c8297e77810ca0b97a1bc07f (unchanged)
Real DB baseline: opening 8 rows [1..8]; closing 8 rows [1..8]
```

---

## 7. §8/§9 target → Evidence observation map (final gate)

Each applicable P2A gate item maps to at least one recorded observation (automated = jsdom/probe command; browser = real-Chrome observation; source = inspected fact; unexecuted = declared).

| Plan target | Observation pointer |
|---|---|
| §8.1 commands | §6.3 (typecheck/lint/test×2/build/diff×2 exit codes + counts) |
| §8.2 Hub matrix | automated: §2.3 A-stage suite + p2a tests; browser: §6.2 hub scenarios (order g045-first, no overflow, nav active, card names); source: §2.4/§6.4 (no writes/drag/storage, no `agentHubOrder` in production) |
| §8.3 Profile matrix | automated: §2.3/§3.5; browser: §6.2 (invalid/404 distinct, bottom bar hidden at all widths, back-link/Hub recovery, error states); source: §6.4 (read-only, no PATCH) |
| §8.4 Creation matrix | automated: §5.4 CP2 (R3-accepted) + full suite; browser: §6.2 real-browser creation (bodies, single canonical navigation, both standard and g045 branches, Space on checkbox) |
| §8.5 Conversation/filter matrix | automated: §2.3 + R1 probes; browser: §6.2 (filter keyboard, selected cue, radiogroup naming); source: §6.4 (no invented params, single collection) |
| §8.6 Memory summary matrix | automated: §2.3; browser: §6.2 (memory failure explicit and independent; count/tags render; static P5 sentence source-hit only) |
| §8.7 Responsive/accessibility | browser: §6.2 full table (five widths, overflow, scroll owner, names, keyboard, non-color, long text, touch, safe-area mechanism) + 30 PNGs |
| §8.8 Regression and scope sweep | §6.4 sweep table + tracked/untracked manifest §6.7 |
| §9 Entry/integrity | §0 (C1 baseline `b1178fb` unchanged, frozen hash, DB 8 rows open/close, Alicia-approved Plan) |
| §9 Hub/Profile | §6.2 + §2.x automated |
| §9 Conversation path | §5.4 + §6.2 (single canonical init adapter/mutation, in-memory lens, no Projects Query from index — §0.1) |
| §9 Memory/scope | §6.4 (no Heartbeat/Library CRUD/preset writes) |
| §9 Quality | §6.3 commands; responsive matrix §6.2; Evidence = this file; independent acceptance: requested at CP3 (pane 3) — Builder issues no verdict |

---

## 8. R4 repair record (CP3 FAIL → repair; consecutive count 1)

### 8.1 Blocker mapping

| ID | Verified fact / root cause | Repair |
|---|---|---|
| CP3-01 P1 BROWSER-FIXTURE-MODE | Confirmed in probe source: `routeHandlers(mode, …)` received a hard-coded `'normal'` from the `Fetch.requestPaused` handler, and `modeOf` only honored `'error'`, falling back to the passed mode — so `navigate(…, 'long')` never reached the intercepted responses; every "long" scenario silently measured short data. The 344/344 run could not prove §8.7 long-content. | Handler now reads `endpointMode` directly (single source of truth set by `navigate()`). Long-scenario expectations are mode-aware (hub identity `LONG_NAME` vs `Ecki`; conversation links: 4 rows + `Project #9` + Drift vs 3 rows + `会话 321` — ordering/identity/AX constraints kept). Added pre-observations: before any size measurement, the probe proves the long fixtures are actually in the DOM (name/desc/prompt/conv/proj/tag) AND that long chips carry computed `text-overflow: ellipsis` within viewport. Screenshots re-captured; normal vs long PNG SHA256 now differ (e.g. hub 320: `8a38dbfb02…` vs `bb23d1d0fb…`). |
| CP3-01 real layout defects exposed by the now-valid long fixtures | First valid long run (dev): `profile-long@768` + `profile-dialog@768` document overflow; expanded element scan showed three over-wide elements — topbar model chip (unbroken 96-char ASCII id, 483px at 320), filter-option chip (140-char CJK Project name, 1160px), row meta chip (988px). Root: chips render as `inline-flex` with unbreakable content and no width constraint (`min-width: auto`). | Production repair, P2A-scoped only: `AgentProfilePage` renders its three chips with a new `agent-chip-clamp` class; `agents.css` adds `.agent-chip-clamp { max-width: min(52vw, 280px); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }` and constrains `.agent-filter-option { max-width: 100% }` with ellipsis on its label span. Shared C1 chip surfaces (ConversationPage, RecentConversationList) untouched — the clamp class exists only on Profile renders. |
| CP3-02 P2 stale SW comment | Probe comment still claimed the service worker 404s precached assets under `/app/` — already retracted in Evidence; the real cause is that `vite preview` cannot serve a `base: '/app/'` build (nginx owns that mapping). | Comment replaced with the accurate rationale (SW registration disabled at document level purely for measurement determinism). |

### 8.2 Verification executed (repair)

```text
vitest focused (p2a_agents + p2a_agents_projection + p2a_creation, NODE_OPTIONS=--no-experimental-webstorage)
    → 3 files / 61 tests passed / 0 failed, exit 0
pnpm typecheck → exit 0
pnpm build    → exit 0
browser probe, dev bundle (:5176)              → 374/374 assertions passed, exit 0
browser probe, production bundle (:5177, /app) → 374/374 assertions passed, exit 0
    (both runs now include fixture-presence pre-observations and chip-truncation assertions)
git diff --check → exit 0 (LF→CRLF notices only)
```

Full exo-app jsdom regression is deferred by Acceptance ("全量回归暂缓直到真实 browser 候选成立") — not run in this repair cycle.

One lint observation (neutral fact, Builder did not touch the file): `pnpm lint` now exits 1 on `packages/app/src/acceptance/p2a_cp3_fixture_probe.mjs:7:33` (`'URL' is not defined`, no-undef) — that path is Acceptance-owned (`src/acceptance/*` off-limits to Builder) and did not exist in the last exit-0 lint run. Builder-owned files produce no lint findings.

### 8.3 Corrected evidence

- §6.2 long-content row: the long-fixture observations recorded before this repair were produced with short data (fixture-mode defect) and are superseded by this repair's two 374/374 runs; all other §6.2 rows are unaffected (their assertions were mode-independent and re-executed in both runs).
- §6.1 implementation facts gain: `AgentProfilePage.tsx` chip `agent-chip-clamp` class (3 renders) and two `agents.css` truncation rules; the probe gains fixture-pre-observation and truncation assertions (694 → 762 lines).
- §6.5 checkpoint row "Long content at every width": now backed by fixture-presence + truncation assertions, not only scroll-width measurements.
- §6.7 repository state: `agents.css` and `AgentProfilePage.tsx` amended within Stage C scope (no semantic change to Stage B logic).

---

## 9. Final acceptance receipt (Builder note, recorded after R5)

- Solaire (pane 3) reported **P2A FINAL PASS — CP3 R5**: consecutive-FAIL counter cleared; CP3-01/02 closed. Independent re-execution: original 4 fixture diagnostics 4/4; complete exo-app suite **51 files / 462 passed / 0 failed/errors/skipped**; real-Chrome runs on dev and production bundles **499/499 each** (Builder's 374 + Acceptance's 125 independent DOM/viewport/hit-target observations); 40 production screenshots across five widths visually inspected via 5 contact sheets — all passed; typecheck/lint/build and pre/post-stage diff checks exit 0; real DB baseline 8 rows; the Acceptance-owned Node-globals lint finding was fixed by Acceptance (explicit builtins import) and was not counted against Builder. Acceptance report carries the R5 final §9 20/20 evidence; independent JSON + contact sheets tracked; raw screenshots retained locally.
- The fully approved Plan is complete. **No next construction phase exists.** Builder stays stopped on the passing worktree; no commit, no P2B, no capability transfer — commit authority remains a separate Alicia decision per the frozen Plan/`AGENTS.md`.
- Builder-owned files remain unstaged/untracked exactly as reported at CP3/R4; the frozen Detailed Plan hash `3b05d08738ad7aa6d7734f74c3aabad8d811b603c8297e77810ca0b97a1bc07f` is unchanged; Acceptance-owned report and probes untouched by Builder.
- Environment observation (neutral fact, no action taken by Builder): two `node` listeners remain bound to 127.0.0.1:5176 (PID 19000) and 0.0.0.0:5177 (PID 11040), both started 20:48–20:49 — after Builder's own cleanup and within the Acceptance re-verification window. Builder did not terminate processes outside its own scope; Alicia may release them or leave them as-is.
- Follow-up (same day): Alicia authorized release. Identified as Acceptance-window leftovers — `vite dev` on 5176 (PID 19000, bash wrapper 25676) and a run of the Builder's own `scripts/p2a_serve_dist.mjs` on 5177 (PID 11040, bash wrapper 19236), both spawned by the R5 re-verification runner. All four processes terminated with Alicia's authorization; ports 5176/5177/9333 verified free afterwards.
