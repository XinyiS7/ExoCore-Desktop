# V4 Phase 2A — Independent acceptance

Owner: [gpt-5.6-sol / Solaire], pane 3. Construction may read, not edit this report or `packages/app/src/acceptance/p2a_cp1.acceptance.test.tsx`.

## Latest disposition

**P2A: PASS — CP3 accepted in R5.** CP1 (R2) and CP2 (R3) remain accepted. Final independent evidence: app **462/462**, fixture diagnostic **4/4**, real Chrome dev and production bundle each **499/499 observations** (374 construction + 125 Acceptance-authored); all five widths visually checked. Approved P2A construction/acceptance is complete. No automatic commit, Agent capability transfer or P2B authorization. Earlier cycles are preserved below.

## R1 — CP1 / Stage A

**Verdict: FAIL**

- Consecutive FAIL count: **1**. Repeated invariant IDs: none (FILTER-FALLBACK and PROJECT-IDENTITY each observed once).
- Baseline: HEAD `b1178fb1a974cd848fdeaa11a7d279df920b1a0c`, parent `23dea37a1df063eed855891db7c295eefeb3e17c`; 7 modified existing source/test files (+27/-5), 6 new Agent feature files and 2 new construction-test files. No production edits by Acceptance.
- Gates: checked **11**, passed **9**, failed **2**, not checked **1** (full canonical Chat/app regression execution deferred). All Stage A source paths were swept.
- Findings: new **3** (2 P1, 1 P2), residual **0**, repair-regression **0**, harness-defect **2**, acceptance-miss **0**.
- Tests: **53 unique current tests**, passed **51**, failed **2**, errors **0**, skipped **0**. This combines final independent probes (6: 4 pass/2 fail) and construction-focused tests (47: all pass). Earlier executions of revised probes are not added to unique totals.
- Full regression: **deferred** while two confirmed blockers remain. Builder's 429-test full run is not independently re-executed evidence.
- Unreviewed CP1 areas: **1**, execution of the complete canonical Chat/app regression. Stage B creation and Stage C real-browser responsive widths are outside this checkpoint, not CP1 failures.

### Authority and ownership

Alicia explicitly requested independent acceptance. The approved Detailed Plan §7 Stage A/CP1 and applicable §8/§9 govern this checkpoint. No separate independent pre-construction spec exists; this report adds no new MUST. CP1 PASS would not be full P2A PASS, commit permission, or capability transfer. Per §7, Alicia releases Stage B.

Frozen Detailed Plan SHA256, independently rechecked unchanged:
`3b05d08738ad7aa6d7734f74c3aabad8d811b603c8297e77810ca0b97a1bc07f`.

Initial other artifact hashes:
- Scout: `e0ac294b11a979d31a55c00c6fd24e4d9fb1156877f258e336e6b3f75dae8248`
- Ablation: `f94fe04424c1399bbf303266e717a314ee239619b7092c442a60fdaafbaf000d`
- Builder-owned Construction Evidence: `85a7e0124d97b135d242a28c107ec3aa8ed267461741ab274fdaaabd50f36487` (not immutable).

## Blocking findings and repair packet

### CP1-01 — P1 / new / Construction — FILTER-FALLBACK

**Observed evidence:** Independent real-Profile probe selects Project 7, removes its rows through the shared Conversation cache, waits until All is checked, then restores the Project rows. All becomes unchecked without user selection. Final probe fails at the post-restoration assertion, not the intermediate fallback.

**Violated invariant:** Detailed Plan §6.2 says the **selection** falls back to All when refetch removes the source Project row; §7 CP1 explicitly requires filter-fallback evidence. The real Profile consumes this shared cache on backend refetch/invalidation.

**Confirmed root cause:** `AgentProfilePage.tsx` retains the previous numeric `filter`; `resolveConversationFilter` only derives temporary `activeFilter`. When the same Project ID returns, the old selection silently returns. The pure helper unit test cannot establish the component state transition.

**Sibling paths:** Background refetch/invalidation, removal while another Project or Drift remains, a temporarily empty Agent lens, restoration of the same Project, route changes to another Agent (including shared Project IDs).

**Required outcome:** After a confirmed dataset update invalidates the selected Project, selection becomes All and remains All on later data refreshes unless the user selects another option. Do not erase selection merely because a request is pending or failing without a successful replacement dataset.

**Suggested direction (non-binding):** Reconcile selected state at the existing Profile-local ownership boundary; no global store, extra fetched collection or new cancellation framework is needed. Internal design is Builder-owned.

**Chained effects:** Filter state reconciliation can affect route-switch resets, empty/error rendering and refetch updates; preserve backend order and the shared Conversation cache.

**Verification targets:** Select Project; remove its final row with other rows remaining; observe All and all remaining rows; restore the former Project; observe All remains selected. Also check true-empty/refill and A→B route reset. Use component behavior, not only the projection helper.

**Preserve recommendation:** Keep existing route-keyed detail/Memory ownership, correct Agent lens, and Project options derived from that lens.

**Escalation trigger:** Pause if repair needs changing shared Query families, creation owners, or any previously passing area outside filter state/rendering; explain necessity and invalidated evidence before editing.

### CP1-02 — P1 / new / Construction — PROJECT-IDENTITY

**Observed evidence:** An actual Profile Conversation row with `projectId: 7, projectName: null` displays `Drift`. Independent probe received `row-2501/1 01:00Drift`, rather than the required `Project #7`.

**Violated invariant:** Detailed Plan D6 expressly requires Conversation rows to retain `Project #<id>` when Project identity exists but its name is unavailable; §6.5 distinguishes positive Project identity from null Drift.

**Confirmed root cause:** The row renderer uses `row.projectName ?? 'Drift'`, deciding Project identity from the display name. `deriveProjectOptions` correctly handles the same unavailable-name case, so the selector and row contradict each other.

**Sibling paths:** Positive Project rows with null/empty/whitespace-only names, in All and specific-Project views; true Drift rows; repeated IDs and duplicate names across different IDs.

**Required outcome:** Determine Drift from normalized null Project identity. For an identified Project with an unavailable name, render the frozen `Project #<id>` fallback; retain valid names. Do not make null-name Projects look like Drift.

**Suggested direction (non-binding):** Keep label semantics consistent between options and rows within the existing Agent feature; a small shared formatter is optional, not an acceptance requirement.

**Chained effects:** Display labels/accessibility names and focused row assertions; no API or shared normalization change is required by this finding.

**Verification targets:** Positive-ID null/blank names display truthful Project fallback in the real row; Drift stays Drift; valid names remain unchanged; links still target canonical `/chat/:conversationId`.

**Preserve recommendation:** Preserve positive-ID option dedupe/order, exact Agent matching, and canonical link ownership.

**Escalation trigger:** Pause before extending validation, changing DTO contracts, or touching shared Chat behavior merely to repair this local presentation rule.

## Non-blocking finding

### CP1-03 — P2 / new / Construction — incorrect dead-code rationale

`Construction_Evidence.md` §2.6 and the Profile comment claim every selectable filter yields at least one row. D6 guarantees that only for **Project options**, not the always-present Drift control. The independent probe confirms a valid zero-result Drift subset with existing Project rows.

Required documentation correction in the current repair: narrow the claimed invariant to Project options and accurately describe tested refetch coverage. Construction presently has a pure fallback helper test, not a component refetch/removal integration test.

An explicit filtered-empty explanation is a **non-binding adjacent UX recommendation**, not an added MUST. The plan does not specifically require that copy. No production change solely for that recommendation is required for CP1 PASS. Recheck: truthful comment/evidence and correct Drift subset.

## Acceptance/harness self-corrections

- **H1 / harness-defect / Harness:** First fallback probe checked the initial All state before React Query's asynchronous observer notification completed. Corrected by waiting for the observable All state, then waiting for the restored Project option before evaluating persistence. On the same unchanged Builder baseline it fails at the actual restoration step. Initial timing failure is not production evidence and adds no review cycle.
- **H2 / harness-defect / Acceptance:** First Drift probe required explicit empty-copy text. Frozen §8.5 requires the correct subset but does not specifically require that text. Retracted that blocking assertion on the same baseline; final probe checks the empty subset and absence of false zero-Agent copy. Missing explanatory copy remains advisory. No production code should be written to satisfy the retracted assertion.
- One provider 502/aborted runner invocation produced no test evidence; retried only the focused command. It adds no FAIL count.
- Scout initially supplied composite hash `93f38a9b…`; the runner could not reproduce its manifest serialization. **Do not use that composite as evidence of either stability or drift.** All 15 raw per-file SHA256 values matched individually between both collections; those values below establish the unchanged Builder baseline.

## Gate sweep and preserve evidence

| Gate | Authority | Evidence | Result |
|---|---|---|---|
| A01 Frozen boundary and scope | §7, §8.8 | Plan hash unchanged; exact diff + all six feature files inspected; no new dependencies/V3 imports/preset writes/forbidden routes | PASS |
| A02 Hub ordering and lifecycle absence | D3, §8.2 | Source copy-sort; construction focused runtime ordering, GET-only, no storage/fan-out | PASS |
| A03 Hub loading/error/retry/empty | §8.2 | Guarded list reuse, construction runtime malformed/error/retry/empty tests | PASS |
| A04 Profile route, readonly identity and errors | §8.3 | Source invalid-route early return; detail guard; construction 404/malformed/network and readonly tests | PASS |
| A05 Cross-Agent detail/filter/Memory isolation | §6.2, §8.3 | Route-keyed queries; construction switch/late-detail tests; independent late-Memory and current-row observations | PASS |
| A06 Shared backend-ordered Conversation lens | §6.2, §8.5 | Independent shared-cache update reflected in real Profile; no second fetch/Project request; construction order and exact-ID tests | PASS |
| A07 Project option derivation and subsets | D6, §8.5 | Pure source plus construction dedupe/subset tests; independent empty Drift subset | PASS |
| A08 Persistent Project disappearance fallback | §6.2, CP1 | Independent removal→All→restoration probe | FAIL CP1-01 |
| A09 Truthful Project identity in rows | D6, §6.5 | Independent null-name positive-ID row probe | FAIL CP1-02 |
| A10 Memory summary and independent failures | D5, §8.6 | Guard/aggregation source; construction count/tags/no-content/error tests; independent Memory error leaves identity/rows working | PASS |
| A11 Navigation and canonical Chat source ownership | D4, CP1 | Router/helper diff aligned; Home secondary entry; shell/nav construction tests; no duplicate Chat path/component | PASS |
| A12 Complete canonical Chat/app regression execution | CP1, §9 Quality | Source swept; Builder reports full run, but independent full run deferred while P1s remain | NOT CHECKED |

Preserve recommendations are advisory, not immutable implementation. Discuss dependent changes before editing passing areas; only Acceptance-owned artifacts are strictly off-limits to Construction.

## Executed commands and counts

Runner mechanical execution, owner-selected commands:

1. `NODE_OPTIONS=--no-experimental-webstorage pnpm --filter exo-app test:run src/acceptance/p2a_cp1.acceptance.test.tsx` — final version exit 1; 1 file, **6 tests / 4 pass / 2 fail / 0 error / 0 skip**.
2. `NODE_OPTIONS=--no-experimental-webstorage pnpm --filter exo-app test:run src/test/p2a_agents.test.tsx src/test/p2a_agents_projection.test.ts` — exit 0; **2 files / 47 pass / 0 fail/error/skip**.
3. `pnpm --filter exo-app typecheck` — exit 0.
4. `pnpm --filter exo-app lint` — exit 0.
5. `git diff --check` — exit 0; LF→CRLF warnings only.
6. `git diff --cached --check` — exit 0.

Storage flag follows the already-reproduced Node25/jsdom collision allowed by Plan §8.1; no dependency workaround was added. Paid/external APIs are mocked. No backend tests or real DB fixture writes were run. Opening real AgentPreset baseline script: OK, 8 rows IDs 1–8. Closing real AgentPreset baseline: `OK: AgentPreset baseline 8 rows [1, 2, 3, 4, 5, 6, 7, 8]`. Only the report and independent probe are staged by Acceptance; Builder files remain unstaged/untracked.

Full app tests/build, five browser widths, monorepo/V3: not rerun in this FAIL cycle. Full required CP1 app regression/build must run before CP1 PASS; Stage C browser evidence and C2 monorepo/V3 retain approved ownership/boundaries.

## Repair and recheck handoff

1. Repair FILTER-FALLBACK's actual Profile state transition, not only its helper.
2. Repair PROJECT-IDENTITY's row presentation without changing backend/shared contracts.
3. Add honest construction component coverage for the state transitions and missing-name row cases; correct the D6 dead-code/coverage claims in Builder Evidence and relevant comment.
4. Recheck the two original failing independent probes first, then their sibling cases and route-switch behavior. If clean, run the full app construction+acceptance suite, typecheck, lint, build and diff checks before PASS.

Do not edit Detailed Plan, this report or independent test implementation. Do not begin Stage B, commit, or take over another pane's scope. No raw independent test implementation is included in the repair instructions.

Builder response requested: CP1-01/02/03 mapping; changed files/symbols; source searches with counts; actual numeric test results; omitted scenarios; scope deviations and any previously passing evidence invalidated by repair.

## R1 baseline per-file evidence

Paths relative to `packages/app/`; SHA256 of raw worktree bytes. All 15 individually matched at initial and closing runner collections.

| Path | SHA256 |
|---|---|
| src/app/router.tsx | e6ea8393af507b5846c4b533d838a290f0416a2f147f1a02d8e8957367af9f1d |
| src/features/agents/AgentHubPage.tsx | 6cbcd0d1d2b9e67c3ee73210456c2a40e6edabf62d4aa352a5eb93a3d78d7fa3 |
| src/features/agents/AgentProfilePage.tsx | b1407d2c3c377665cf8d7b4aeac71faffe2b22ec4360f79eb4eea876a13cb170 |
| src/features/agents/agents.css | eabb8e3b3ff35266839e1aec8d8557577e8f69eb046be26df022c9055afb81ea |
| src/features/agents/api.ts | 48baf39b6736687c200f99bd05f706f220af4b64fd07b7b9ad2db3c6493c03fa |
| src/features/agents/projection.ts | 88c69e2c5f423fe182eae3079597f3876469c16751930ea0543add4edf1d1add |
| src/features/agents/queries.ts | c54ce4118770288646b3191845a7d2f4b7a8b492fb66c7db994eb83ff87c7b1a |
| src/features/chat/ChatHomePage.tsx | 1921b4b60186e6b1dd17510f02f54904b0bb4f938551f52eab87df5719880aac |
| src/features/chat/api.ts | 38ecb637c0290810d489eb35398b59b2279ae26c88398b3f5cc85a63487684cd |
| src/main.tsx | d91d07656f54c06961613ff8f04f5b95f2d03c913fd474a944554169f0054048 |
| src/shell/AppShell.tsx | 2fbdd65afeb7486a0c77f01167b3e0871fe2afcef47fb3ac48f710ba0a6b80ff |
| src/shell/navigation.ts | 2354cc295693c185169026616b475bf3c55ec65931078b24451aa2b3b25d2c17 |
| src/test/helpers.tsx | 55d8d1fe7c3f3773a8476c4fd3dcad5ff17806bc298060b9cfd75e280ca219c4 |
| src/test/p2a_agents.test.tsx | 6a87ec511ccba12b157bfde37751068e535082895ce6ebb8c45a147f95362675 |
| src/test/p2a_agents_projection.test.ts | 1da158f6a02de63c61f39fa9074e7970a9f0400216ef5717665cc707687a5c9a |

## Immutable verdict ledger

| Cycle | Checkpoint | Baseline | Verdict | Cause owners | Findings | Supersedes/amends | Consecutive FAIL | Repeated invariants |
|---|---|---|---|---|---|---|---|---|
| R1 | CP1 / approved §7 Stage A | b1178fb + 15-file SHA256 manifest above | FAIL | Construction 3; Acceptance 1; Harness 1; Spec 0; Environment 0; Unknown 0 | CP1-01, CP1-02, CP1-03; H1/H2 corrected within cycle | none | 1 | none; FILTER-FALLBACK 1, PROJECT-IDENTITY 1 |
| R2 | CP1 / approved §7 Stage A | b1178fb + R1 manifest with four replacements below | PASS | Construction 0; Acceptance 0; Harness 0; Spec 0; Environment 0; Unknown 0 | CP1-01/02/03 resolved; no new findings | supersedes R1 disposition; historical evidence retained | 0 | none; prior invariants closed |
| R3 | CP2 / approved §7 Stage B | b1178fb + CP2 six-file manifest below; same frozen Plan | PASS | Construction 0; Acceptance 1; Harness 0; Spec 0; Environment 0; Unknown 0 | CP2-H1 resolved; no production findings | new approved checkpoint, does not supersede CP1 | 0 | none |
| R4 | CP3 / approved §7 Stage C + final §9 gate | b1178fb + CP3 CSS f4f27213; original 694-line browser tool; pins below | FAIL | Construction 1; Acceptance 0; Harness 0; Spec 0; Environment 0; Unknown 0 | CP3-01 (construction verification defect); CP3-02 advisory | new approved checkpoint, prior CP1/CP2 retained | 1 | LONG-CONTENT-EVIDENCE 1 |
| R5 | CP3 / approved §7 Stage C + final §9 gate | b1178fb + R5 manifest below; same frozen Plan | PASS | Construction 0; Acceptance 1; Harness 0; Spec 0; Environment 0; Unknown 0 | CP3-01/02 resolved; CP3-H1 corrected by Acceptance | supersedes R4 disposition; prior CP1/CP2 retained | 0 | none; LONG-CONTENT-EVIDENCE closed |

## R2 — CP1 / Stage A recheck

**Verdict: PASS** — [gpt-5.6-sol / Solaire]

- Consecutive FAIL count: **0** (reset by final CP1 PASS). Repeated unresolved invariants: none.
- Gates: checked **12**, passed **12**, failed **0**, not checked **0**. Same A01–A12 scope as R1; no new architecture MUST.
- Findings this cycle: new/residual/repair-regression/harness-defect/acceptance-miss **0/0/0/0/0**. CP1-01, CP1-02 and CP1-03 closed.
- Tests: complete final suite **49 files / 446 unique tests executed / 446 passed / 0 failed / 0 errors / 0 skipped**. Focused reruns are included in, not added to, this total.
- Full regression: **executed** for the required CP1 exo-app scope, including independent probes and all canonical Chat construction tests.
- Unreviewed CP1 areas: **0**. Real-browser five-width checks remain Stage C; creation matrix remains Stage B; C2-wide monorepo/V3 regression remains deferred by approved Plan.

### Evidence pin and ownership check

HEAD and parent unchanged. Eleven of R1's 15 production/construction-test files are byte-identical. The four authorized repair replacements are:

| Path relative to packages/app/ | R2 SHA256 |
|---|---|
| src/features/agents/AgentProfilePage.tsx | 12389bca6c21a2c43cdf58fd42f4c8abffe1e819753067208008700fb3bf9cae |
| src/features/agents/projection.ts | 95967556892a389e7c45220c1483f3bd0abf17db36eabc9580e0239f8837051b |
| src/test/p2a_agents.test.tsx | dc7e75987a05fe81347d800b4d51cae4347ab6cd9277041e5bcfa6a542364431 |
| src/test/p2a_agents_projection.test.ts | 772a05701aa8ef342e79fb468fa555e4a2160ceee6e4b8ede046621c9852c95b |

These values were rechecked after the final pipeline and match the R2 starting collection. Detailed Plan still hashes to `3b05d08738ad7aa6d7734f74c3aabad8d811b603c8297e77810ca0b97a1bc07f`.

Before Acceptance edited its files for R2, both acceptance artifacts matched their staged R1 content with zero unstaged diff: report SHA256 `8fed670bca6005c84a17b96943e33112f252866d74a18a65d60230e0bdcd0305`; independent probe SHA256 `ce497c2634dc1b7f4e082a373aaee7e533b3672b2e2572ff16f95dbf052e8fef`. Construction did not modify them. Acceptance then added three sibling probes itself; the intermediate `AM` status on the probe was an authorized Acceptance edit, not a Builder deviation.

Builder Evidence was updated in its approved ownership zone. No production files were changed by Acceptance. No backend/deployment/dependency/shared Chat scope expansion occurred.

### Recheck and per-gate evidence

- **A08 / CP1-01:** Original removal→All→restoration probe passes unchanged. Added independent true-empty lens→refill test also retains All; switching to another Agent with the same Project ID resets selection. Independent pending/failing refetch probe confirms a still-valid Project selection survives failure/recovery, while Conversation failure remains explicit and identity/Memory stay operational. Source reconciliation updates actual local selection; the existing pure projection remains only the transient rendering guard.
- **A09 / CP1-02:** Original positive-ID/null-name row probe passes unchanged. Added independent empty-string/whitespace-name, true Drift and valid-name row observations pass. The small feature-local `projectLabel` is reused by options and rows; no general validation layer or cross-module refactor was introduced.
- **CP1-03:** Comment and Evidence now limit the guaranteed non-empty invariant to Project options. Correct zero-result Drift subset remains observable. Builder chose a small explanatory paragraph within the existing section; this does not become a new frozen requirement or new product surface.
- **A01–A07, A10–A11:** Unchanged relevant source ownership rechecked by manifest and targeted repair-source inspection. The complete suite reran all Hub/detail/error/navigation/filter/Memory/route-switch tests, including the independent shared-cache and late-Memory probes. Project-label reuse preserves option identity/order; reconciliation stays Profile-local.
- **A12:** Complete exo-app suite, typecheck, lint, build and whitespace checks now independently executed successfully. Canonical Chat remains owned by its existing implementation and routes.

### Execution sequence

All commands executed mechanically by test-runner; selection, probe authorship and verdict remain with Acceptance.

1. Original failing probes first: `NODE_OPTIONS=--no-experimental-webstorage pnpm --filter exo-app test:run src/acceptance/p2a_cp1.acceptance.test.tsx -t 'identified but unnamed|removed Project selection'` — exit 0; **2 passed**, 4 intentionally deselected by name filter. This was focused ordering, not final skip-based passing.
2. Existing independent + construction-focused tests: `NODE_OPTIONS=--no-experimental-webstorage pnpm --filter exo-app test:run src/acceptance/p2a_cp1.acceptance.test.tsx src/test/p2a_agents.test.tsx src/test/p2a_agents_projection.test.ts` — exit 0; **61 passed**, no failures/errors/skips.
3. Owner added the three in-scope sibling probes described above, then independently ran `NODE_OPTIONS=--no-experimental-webstorage pnpm --filter exo-app test:run src/acceptance/p2a_cp1.acceptance.test.tsx` — exit 0; **9 passed**, no failures/errors/skips.
4. `NODE_OPTIONS=--no-experimental-webstorage pnpm --filter exo-app test:run` — exit 0; **49 files / 446 passed / 0 failed/error/skipped**. The +3 versus Builder's 443 count is precisely the three Acceptance-owned sibling probes.
5. `pnpm --filter exo-app typecheck` — exit 0.
6. `pnpm --filter exo-app lint` — exit 0.
7. `pnpm --filter exo-app build` — exit 0. Advisory: chunk >500 kB; PWA `inlineDynamicImports` deprecation. No new dependency or build-configuration change required by CP1.
8. `git diff --check` and `git diff --cached --check` — both exit 0; LF→CRLF notices only.
9. Closing `bash .agent/check_real_db_baseline.sh` from ExoCore — `OK: AgentPreset baseline 8 rows [1, 2, 3, 4, 5, 6, 7, 8]`. No fixture writes or backend suites.

### Accepted limitations / adjacent issues

- **No full P2A PASS yet:** Stage B creation and Stage C browser/visual evidence remain mandatory later gates. No checkpoint commit or Agent capability transfer is authorized.
- Builder's sibling search recorded similar missing-name label expressions in accepted Chat surfaces (`ConversationPage.tsx`, `RecentConversationList.tsx`); neither was changed. These remain adjacent follow-up candidates, not new CP1 blockers.
- Alicia's observed V3 Project-create navigation/list-refresh issue remains a separate uninvestigated V3 issue; it is not silently added to Stage A repairs.
- Evidence wording that earlier production evidence was not invalidated is interpreted narrowly: repair-affected filter/row evidence was re-established by this full recheck; unchanged areas were not presumed valid without regression.

### Handoff

**CP1 accepted.** At R2 sign-off, Stage B awaited Alicia's release. No Stage C work, cross-pane takeover, commit or P2B permission is implied. Acceptance artifacts remain read-only to Construction.

### Subsequent Stage B release

[Alicia / approved] Alicia explicitly instructed pane 3 to release the construction GPT Sol in pane 5 under WezCoop. **Stage B is authorized** from the accepted CP1 R2 baseline, bounded by the frozen Detailed Plan §7 Stage B and §8.4. Builder stops at CP2 and returns factual evidence to Acceptance pane 3. No automatic Stage C release or commit permission. Construction evidence remains in the approved `Plan/V4_Phase_2A_Construction_Evidence.md`; frozen Plan and Acceptance-owned artifacts remain read-only.

## R3 — CP2 / Stage B first verification

**Verdict: PASS** — [gpt-5.6-sol / Solaire]. This is a new checkpoint under the approved §7 boundary, consecutive FAIL count **0**. HEAD remains `b1178fb1a974cd848fdeaa11a7d279df920b1a0c`.

Frozen Plan remains `3b05d08738ad7aa6d7734f74c3aabad8d811b603c8297e77810ca0b97a1bc07f`. At handoff the staged Acceptance report/probe had zero unstaged diff; hashes were `d3599ab7ee6b1c9d95962e13ca8746a9e8d1e6f007aaa984f0fd7388952b186c` and `060afdf40795ee27a7e1b64bc3c11906b2bc2498aff6a7464009e7b840c2a220` respectively. Construction left them untouched.

CP2-H1 / harness-defect / Acceptance: the report itself ended with an extra blank line, producing `git diff --cached --check` exit 2 at line 234. Owner corrects EOF and restages this report; no production repair and no Builder FAIL count. Prior recorded clean checks predated the final report append; they do not establish whitespace cleanliness of that later append.

Stage B baseline (raw SHA256):
- CreateConversationDialog.tsx: `f898ec95bbc746688cee0454c8887f8f1634736b78c39f3c33530a9af292d4b5`
- chat/queries.ts: `3c7b8f54ce64bf723d0fd8ab202de105f1480ef4c8d23ce2da8d9ba255821cb5`
- AgentProfilePage.tsx: `4003c051737e18428a61fba4b0874b35f778d4339a01905e1047ac57c5946cb3`
- agents.css: `21d3388e31adbf6a4e4fd206fc81b049e0dcbee4dcf04175a894c06957abeb70`
- p2a_creation.test.tsx: `70a1c3695bbd9987777632d4e3540aed927ef6aa8645b269c1d00ecd8c76a23a`
- Construction_Evidence.md: `4327db87d6b6d75d1a48bea8b4457b8f079e43a4c94462c6c77dcd88dd03121a`

### CP2 factual summary

- Gates: checked **10**, passed **10**, failed **0**, not checked **0**.
- Findings: new **0**, residual **0**, repair-regression **0**, harness-defect **1** (CP2-H1, Acceptance-owned EOF corrected), acceptance-miss **0**. No unresolved P0/P1.
- Tests: final complete suite **51 files / 462 unique tests executed / 462 passed / 0 failed / 0 errors / 0 skipped**. Includes 9 CP1 and 10 CP2 independent probes; focused runs are not added again.
- Full regression: **executed** for exo-app, including canonical Chat, Home create, Agent features and independent acceptance probes.
- Unreviewed CP2 areas: **0**. Five real-browser widths remain Stage C, not evidence claimed by CP2. C2-wide monorepo/V3 remains outside this checkpoint.

### CP2 gate evidence

| Gate | Frozen authority | Decisive evidence | Result |
|---|---|---|---|
| B01 Single creation owner and fixed Profile identity | §6.4, §7 Stage B | Real Profile opens the one canonical dialog, no Agent radio; source has two dialog mounts but only one mutation consumer and one init adapter | PASS |
| B02 Home selectable-Agent compatibility | §8.4 | Independent real Home creation with selected standard Agent succeeds; existing Home required-Agent, g045, errors, focus, duplicate and ambiguous tests rerun in full suite | PASS |
| B03 Drift/Project/g045 body and submit-time identity | §6.4, §8.4 | Independent exact standard/Drift and fixed g045 Project/permission bodies; later permission changes cannot rewrite captured body; late switched-Profile body stays original Agent | PASS |
| B04 Pending and ambiguous locks | §8.4, P1A preservation | Independent disabled pending button yields one POST; live malformed success stays terminally locked; no alias-based navigation; original Home tests also pass | PASS |
| B05 Live canonical navigation and row visibility | §8.4 | Independent Home/Profile real entry paths each produce exactly one committed `/chat/901` route, never alias `/chat/999`; shared collection contains new row and returning to matching Profile displays canonical row link | PASS |
| B06 Close invalidates local completion only | §6.4 | Independent close→reopen matrix for late success, ordinary 400, malformed 2xx: new dialog stays unlocked/error-free, no navigation; confirmed/ambiguous write still refreshes shared collection | PASS |
| B07 Same-component Agent switch isolation | §6.4, §8.4 | Independent direct route switch to cached Agent detail (not Hub-unmount shortcut), reopen on new Agent, then late success/400/malformed 2xx: no stale navigation/local error/lock; original body unchanged | PASS |
| B08 Shared invalidation survives stale origins | §6.4 | Independent close/switch success and malformed-2xx scenarios observe actual refreshed shared cache; unchanged canonical mutation owns invalidation before local callback | PASS |
| B09 Scope, ownership and CP1 preservation | §7, §8.8 | Frozen hash/acceptance ownership intact; 13/15 CP1 files byte-identical to R2, Profile/CSS changes limited to approved integration; complete CP1 probes and construction tests pass | PASS |
| B10 Complete CP2 quality pipeline | §9 Quality; independent acceptance exit | Full 462-test app suite, typecheck, lint, build, both whitespace checks all exit 0 | PASS |

### Execution and harness validity

Owner-authored `packages/app/src/acceptance/p2a_cp2.acceptance.test.tsx` contains **10** independent probes, isolated from construction tests. They mount real `ChatHomePage`/`AgentProfilePage` and the canonical dialog/mutation/API; external fetches are mocked at HTTP boundaries. A router observer counts committed destinations, not incidental detail-fetch counts. A destination marker isolates navigation behavior; existing construction real-route tests and full canonical Chat regression cover actual Conversation rendering. Pending requests are explicitly settled; completion waits establish that negative late-callback assertions are not merely sampled before completion.

1. Focused independent command: `NODE_OPTIONS=--no-experimental-webstorage pnpm --filter exo-app test:run src/acceptance/p2a_cp2.acceptance.test.tsx` — exit 0; **10/10 passed**, 0 failures/errors/skips.
2. Full `NODE_OPTIONS=--no-experimental-webstorage pnpm --filter exo-app test:run` — exit 0; **51 files / 462 passed**, 0 failures/errors/skips. Arithmetic from CP1: 446 + 6 Stage B construction tests + 10 CP2 independent probes = 462.
3. `pnpm --filter exo-app typecheck` — exit 0.
4. `pnpm --filter exo-app lint` — exit 0.
5. `pnpm --filter exo-app build` — exit 0; existing large-chunk advisory and PWA `inlineDynamicImports` deprecation only.
6. `git diff --check` and `git diff --cached --check` — exit 0 after Acceptance corrected/staged its EOF defect. The final artifact whitespace recheck after report/probe staging also returned exit 0 for both commands.
7. Frozen Plan and all five Stage B production/test hashes rechecked after pipeline: identical to the starting CP2 manifest above.
8. Closing real DB baseline: `OK: AgentPreset baseline 8 rows [1, 2, 3, 4, 5, 6, 7, 8]`. No backend suites, provider calls or fixture writes.

Source sweep verified the optional `useVisiblePresetsQuery(enabled = true)` parameter preserves all existing ordinary callers. `useCreateConversationMutation` and the API adapter were not rewritten; the only queries.ts diff is the optional enablement parameter. No second schema/dialog/adapter, dependency, backend/deployment edit, session_id read, or cross-unmount lock was introduced.

### Razor and limitations

- Origin guards stay dialog-local and address the frozen close/switch/late-state boundary. No global lifecycle framework or persistence machinery was added. Internal helper/ref preferences are not promoted to acceptance requirements.
- Profile/filter/Memory ownership stays intact; current create action does not turn the Profile index into a Project-fetch owner. The existing dialog alone requests Projects when opened.
- Stage C still owns actual responsive/focus visual measurements at 320/390/767/768/1280; jsdom runtime evidence does not substitute for them.
- CP2-H1 was Acceptance's report formatting error, not a production issue. Builder correctly declined to edit Acceptance-owned content.
- Full P2A gate, Stage C release, capability transfer and commit permission remain separate. **CP2 accepted; pane 5 remains stopped. Stage C was subsequently released to DeepSeek/pane 4 under Alicia's authorization below.**

### Stage C release and coordination correction

[Alicia / approved] Within this fully approved Plan, a successful acceptance gate automatically permits handoff to the next assigned Builder; do not request repeated user release for each passing phase. Escalate actual blockers or scope/product decisions, not routine progression. This clarification supersedes the earlier per-phase human-release interpretation; frozen product criteria and commit restrictions are unchanged.

[gpt-5.6-sol / Solaire] Released Stage C to pane 4 after CP2 PASS and confirmed message consumption. Pane 4 exceeded 200k context, so `/abstract` completed before task handoff. Initial argument-form `/abstract` was mistakenly converted by Git Bash into a path; corrected using stdin, and the erroneous path message explicitly retracted. No product scope affected.

Stage C scope: frozen §7/§8/§9 visual closeout, five real-browser widths, regression/scope evidence and unified Evidence finalization. Builder stops at CP3 and reports to pane 3 for final independent acceptance; no new user nudge is required to start verification. No P2B or commit authorization.

## R4 — CP3 / final P2A gate

**Verdict: FAIL.** No production-layout defect is proven in this cycle; the blocking defect is in Construction's browser evidence generator.

- Consecutive FAIL count: **1** at CP3. Repeated invariant IDs: none; LONG-CONTENT-EVIDENCE observed once.
- Gates: checked **11**, passed **10**, failed **1**, not checked **1** (current CP3 complete final pipeline). Source sweep covered all Stage C changes and the applicable §8/§9 boundaries; physical screenshots/real-browser long-content gate is not passed.
- Findings: new **2** (CP3-01 P1, CP3-02 P2 advisory), residual **0**, repair-regression **0**, independent harness-defect **0**, acceptance-miss **0**. CP3-01 is a **Builder-owned verification-tool defect**, not an independent-harness defect.
- Tests: **4 independent fixture-entry diagnostics executed / 0 passed / 4 failed / 0 errors / 0 skipped**. These are Node/VM diagnostics of the actual construction handler, not browser layout tests.
- Full regression: **deferred** pending valid browser evidence. Builder's two 344-assertion browser passes and 462-test app pass are recorded claims; no independent CP3 full-suite/browser rerun is claimed here.
- Unreviewed final execution areas: actual long-content layout at all five widths, complete current CP3 app/build pipeline, complete screenshot visual review (only `profile-long-320.png` was visually inspected). These are grouped under the failed browser-evidence gate and deferred final-pipeline gate, not silently marked PASS.

### CP3 evidence pin

HEAD/parent remain b1178fb/23dea37. Frozen Plan SHA256 remains `3b05d08738ad7aa6d7734f74c3aabad8d811b603c8297e77810ca0b97a1bc07f`.

At CP3 handoff all three staged Acceptance-owned files had zero unstaged diff:
- report: `8afe44f3de951667677ed32fd5ffd52f221611962c2a961b8ed8908fd57d5182`
- CP1 probe: `060afdf40795ee27a7e1b64bc3c11906b2bc2498aff6a7464009e7b840c2a220`
- CP2 probe: `6f4614e48a5cc2496e40cb45dc730cf423d2a0e95636d2f1b32ddb74eca3374e`

Stage C production delta is exactly the safe-area declarations and selected-label font weight in `agents.css`; current SHA256 `f4f27213ed588128e82fd2e3bd3c9d478ab1d2e98f2fe54304ea5b661f16500c`. Reversing those additions reproduces CP2 CSS SHA256 `21d3388e31adbf6a4e4fd206fc81b049e0dcbee4dcf04175a894c06957abeb70` exactly. All other CP1/CP2 production/construction-test pins remain unchanged. Builder added `packages/app/scripts/p2a_browser_probe.mjs` (694 lines), `p2a_serve_dist.mjs` (52 lines), and 30 PNGs; Evidence appended §6/§7. Final raw hashes: browser tool `d7de331011ca2045d2dc9a621bf50028df0d8a98296a597a82c2773c971f5366`; static server `8dc6db3838f5afe5876d81c902d18ceb7390d00d6b39063455fded40ba92b268`; Evidence `73d43384bf1e1c5a1489325fcd955f08a83c0bf2c1f83f15bfad5c68f5ed1415`. No production edits by Acceptance.

Executed `node --test packages/app/src/acceptance/p2a_cp3_fixture_probe.mjs`: exit 1, 4 failing diagnostics as described below. Both `git diff --check` and `git diff --cached --check` exit 0. Closing real DB baseline: `OK: AgentPreset baseline 8 rows [1, 2, 3, 4, 5, 6, 7, 8]`. One provider 400 interrupted the final mechanical hash/check invocation before results; retried successfully, no added review cycle.

### CP3-01 — P1 / new / Construction verification — LONG-CONTENT-EVIDENCE

**Observed evidence**

1. `p2a_browser_probe.mjs:123–129` stores endpoint mode but `modeOf` only honors `error`; all other cases return the function's `mode` parameter.
2. The real `Fetch.requestPaused` handler at lines 430–436 always passes `'normal'`. Thus `navigate(..., 'long')` never selects long preset/Conversation/Memory fixtures through that request path.
3. Independent Node/VM execution of this exact fixture-handler path (`src/acceptance/p2a_cp3_fixture_probe.mjs`) yields **4/4 failures**: Agent name `Ecki` instead of LONG_NAME; Prompt `null` instead of LONG_PROMPT; Conversation `会话 321` instead of LONG_CONV; no LONG_TAG. No source was modified by this diagnostic.
4. All five normal/long Hub screenshot pairs and all five normal/long Profile pairs have identical SHA256. For example `profile-normal-320.png` and `profile-long-320.png` both hash to `508f09832c2fab9d03e094b67c804a481f6e4aa61383e84787bf1a3b8b256497`.
5. Acceptance visually inspected `profile-long-320.png`: ordinary Ecki name, short model, `未设置 System Prompt`, short Conversation names and ordinary tags. The claimed long-content scenario did not occur.

**Violated invariant:** Frozen §8.7 requires long Prompt/Conversation/Project/Agent content at 320/390/767/768/1280 to wrap/truncate without hiding actions; CP3 requires truthful §8/§9 observation mapping. A passing normal-content measurement cannot establish this required case.

**Root cause:** **confirmed** construction fixture-routing defect. The existing long-case assertions additionally retain normal-only expectations (`Ecki` at lines 524–525; `会话 321` at 533–534), so merely changing payload routing will expose assertion assumptions that must also be corrected truthfully.

**Affected sibling paths:** Hub long identity/description; Profile long identity/model/Prompt/Conversation names/Project options/tags; fixed dialog long identity; both dev and production-bundle runs. The Project-list fixture is already long independently of the broken mode; do not conflate that partial case with verified long Profile content.

**Required outcome:** Run actual long-content payloads through the real browser entry path at all five frozen widths, independently prove those payloads reached the rendered page, then measure layout/action reachability. Preserve the original ordering/identity/AX invariants while making expectations consistent with the active dataset. Regenerate screenshots and correct Evidence mapping to actual observations. Any layout defect revealed must be reported honestly, not bypassed by shortened fixtures or weakened overflow checks.

**Suggested direction (non-binding):** Fix mode propagation in the existing construction tool; add scenario precondition observations of long text before layout checks. No new browser framework/dependency or fixture architecture is required. The independent VM diagnostic is baseline-local evidence, not a required internal function signature; Acceptance will adapt its harness if an equally valid implementation changes that signature.

**Chained effects:** All claims specifically about long presets/Prompt/Conversation/Memory and their screenshots are invalidated, including both 344/344 runs' claimed long coverage. Normal-content observations are not automatically false, but the coherent corrected browser matrix must rerun before final PASS. Existing CP1/CP2 business evidence is unchanged; full current pipeline follows once no P1 remains.

**Verification targets:** Visible long Agent text on Hub and Profile; unbroken ASCII plus multiline Prompt in Profile; long Conversation and Project names in rows/filter controls; long fixed identity in dialog; then width/scroll/keyboard/AX/action checks at every frozen width. Keep request isolation. Show run-specific numeric results and regenerated evidence, not only a new total count.

**Preserve recommendation:** Do not modify Stage A/B business logic, frozen Plan or Acceptance files. Keep the small Stage C safe-area/weight delta unless valid real-browser evidence demonstrates an approved-scope CSS repair is necessary. No production CSS repair is authorized merely to satisfy the current false fixture.

**Escalation trigger:** Pause if actual long-content failure requires changes outside approved responsive/focus/long-content styling, or shared creation/query ownership. Explain the dependency and invalidated earlier evidence before editing those areas.

### CP3-02 — P2 / new / Construction — stale SW diagnosis in tool comment

`p2a_browser_probe.mjs:418–422` still declares an adjacent P1A service-worker path defect. Evidence §6.5 line 400 explicitly retracts that inference. Correct the comment/evidence consistency during the browser-tool repair; do not claim a confirmed SW bug or repair deployment/C1 on this basis. Deterministic SW-disabled rendering may be documented as a scoped harness condition, not an actual-production/SW acceptance result. Recheck: source explanation matches the declared tested environment. Non-blocking on its own.

### CP3 grouped gate sweep

| Gate | Evidence / scope | Result |
|---|---|---|
| C01 Frozen authority and artifact ownership | unchanged Plan and untouched Acceptance artifacts | PASS |
| C02 Preset data integrity | recorded opening baselines; Acceptance closing check below | PASS |
| C03 Canonical routes and C1 owner preservation | unchanged CP1/CP2 source pins; no route/API expansion | PASS |
| C04 Hub ordering and readonly Profile | prior independently accepted behavior, unchanged relevant source | PASS |
| C05 Shared lens/filter identity and error ownership | CP1 repairs/probes unchanged; no Stage C business delta | PASS |
| C06 Creation owners and late callback isolation | CP2 source/probes unchanged | PASS |
| C07 Memory D5 and P5 scope | unchanged source; no new CRUD/surfaces | PASS |
| C08 Safe-area and non-color cue implementation | exact small CSS delta; physical inset remains explicitly untested | PASS (source/mechanism only) |
| C09 Long-content responsive/browser evidence | false long fixture selection; normal/long screenshot duplicates | FAIL CP3-01 |
| C10 Scope/dependency boundaries | only CSS plus local construction tools/evidence; no dependency/backend/V3 changes | PASS |
| C11 Handoff completeness of declared omissions | Builder explicitly discloses no image review, physical-notch/nginx limitations, no commit | PASS (does not validate incorrect long-content claim) |
| C12 Current complete final pipeline | deferred until valid browser harness/candidate | NOT CHECKED |

### Repair order and automatic recheck

1. Correct construction fixture propagation and scenario preconditions.
2. Update fixture-dependent expectations without weakening actual product gates; correct stale SW comment and invalidate false long-content evidence.
3. Run corrected real-browser matrix on dev and production bundle; capture new screenshots. Fix only real in-scope layout defects that the valid matrix exposes.
4. Return CP3 facts to pane 3: changed files/symbols, delivered fixture observations, assertion counts, screenshots, omissions, source/scope scans. No raw independent test implementation is prescribed.
5. Acceptance rechecks this finding first, then reviews screenshots and runs the complete required final pipeline before any P2A PASS. No repeated user release is required for this in-scope repair/recheck.

Frozen/do-not-modify: Detailed Plan, this report, all `src/acceptance/*`. Construction owns its two scripts and unified Evidence. No commit/P2B.

## R5 — CP3 final recheck / P2A acceptance

**Verdict: P2A PASS** — [gpt-5.6-sol / Solaire]

### Factual summary

- Checkpoint: CP3 / final frozen §9 P2A gate. Consecutive FAIL count **0**; repeated unresolved invariants **none**.
- Gates: all **20/20 §9 items checked and passed**, failed **0**, not checked **0**. R4 grouped C01–C12 also all passed on the final candidate.
- Findings this cycle: new/residual/repair-regression/acceptance-miss **0/0/0/0**; **1 Acceptance-owned harness/lint defect**, corrected within cycle (CP3-H1 below). CP3-01 and CP3-02 closed; no unresolved P0/P1.
- Final automated app tests: **51 files / 462 tests executed / 462 passed / 0 failed/error/skipped**.
- Standalone fixture diagnostics: **4 executed / 4 passed / 0 failed/error/skipped**. Combined test count **466**; do not add focused repetitions.
- Real Chrome: **dev 499/499 observations**, **production bundle 499/499 observations**, zero failed observations; each consists of **374 construction observations + 125 independently authored observations across 30 scenarios**. These are browser observations, not 998 additional unit tests or distinct product requirements.
- Visual review: **5 contact sheets / 40 production-bundle captures** (8 views × five frozen widths) inspected by Acceptance. Contact sheets retain their source filenames. Views cover ordinary/long Hub/Profile, long dialog, Home, and scrolled Profile/dialog actions. No visual blocker found.
- Full regression: **executed** for the required exo-app construction/independent acceptance/build pipeline. Unreviewed in-scope gates: **0**. Limitations below remain explicit.

### R5 baseline and ownership

HEAD `b1178fb1a974cd848fdeaa11a7d279df920b1a0c`, parent `23dea37a1df063eed855891db7c295eefeb3e17c`. Frozen Detailed Plan remains `3b05d08738ad7aa6d7734f74c3aabad8d811b603c8297e77810ca0b97a1bc07f`.

| Final artifact | SHA256 |
|---|---|
| agents.css | 5b5e48d023d5b4e60ea484583c7cc0aef812427929a9511cb4acd35661d9fc31 |
| AgentProfilePage.tsx | 9a7a40f18104cf2e13d7bbe203bfa9f1bae66eed068fb24aecac1cccfa28c1f4 |
| scripts/p2a_browser_probe.mjs | 05f358a576b7166c357ef9a287b824e9780cfe5aa0bf8ad1be9f1b4a98f647ae |
| scripts/p2a_serve_dist.mjs | 8dc6db3838f5afe5876d81c902d18ceb7390d00d6b39063455fded40ba92b268 |
| CreateConversationDialog.tsx | f898ec95bbc746688cee0454c8887f8f1634736b78c39f3c33530a9af292d4b5 |
| chat/queries.ts | 3c7b8f54ce64bf723d0fd8ab202de105f1480ef4c8d23ce2da8d9ba255821cb5 |
| acceptance/p2a_cp3_fixture_probe.mjs | c944552f30a493b45657b9eb16739a391b77179ffab101c6833602fea711f6a4 |
| acceptance/p2a_cp3_browser_observer.mjs | 0d88c9c90bb5256e2fce88a96fc16bf9a3a66787c6c24083f00d05c54a158375 |

Source paths in this table are relative to `packages/app/src/`, except `scripts/*` relative to `packages/app/`. Before R5 Acceptance edits, all four staged Acceptance artifacts equalled their index versions; Construction made no unauthorized edits. Only Acceptance adapted/extended its own probes/report. Production CSS/Profile and construction-browser hashes were independently rechecked after execution and match R5 starting pins.

### Original failures and chained recheck

- **CP3-01 closed:** the construction Fetch handler now reads the scenario's endpoint modes without the hard-coded normal override. Acceptance adapted its baseline-local Node diagnostic to the new verified three-argument handler; the original four behavioral expectations now pass. No obsolete signature requirement was imposed on Construction.
- The valid fixtures exposed actual long model/Project chip overflow. Builder repaired only three Profile-local chip renders and Agent-local CSS. Independent browser observations now verify actual long Agent/Prompt/Conversation/Project/tag text in DOM, requested CSS viewport width, document bounds and chip bounds. Full ordinary/long matrix passed at **320, 390, 767, 768 and 1280** in both bundles.
- Acceptance's observer adds an actual `elementFromPoint` hit-target check after normal scrolling for Hub card, Home Hub entry, Profile create action and dialog submit. This closes the distinction between a successful scripted `.click()` and an action that is genuinely reachable/uncovered. Long action screenshots were captured after scrolling, not inferred from document width alone.
- Construction's real-keyboard/AX checks reran: radio arrows, retry Enter, permission Space, Escape close, focus entry, accessible names, non-color selection and breakpoint navigation. CP1/CP2 independent tests and all canonical Chat tests reran against the final source.
- **CP3-02 closed:** SW comment now describes deterministic fixture/layout measurement, not a proven application service-worker defect.
- The existing safe-area CSS mechanism remains present; physical notch pixels are not claimed as tested.

### Independent browser instrument and evidence ownership

`src/acceptance/p2a_cp3_browser_observer.mjs` reuses the Builder's CDP transport/fixture scenarios, **without modifying the construction file**, and inserts Acceptance-authored DOM/viewport/hit-target assertions. The report deliberately distinguishes the 374 reused construction observations from the 125 independent ones. Source imports remain Node built-ins; no package was installed. Screenshots are redirected to Acceptance's directory and do not overwrite Builder's `.p2a-shots`.

Durable numeric browser evidence:
- `Plan/.p2a-acceptance-shots/dev/independent-observations.json`
- `Plan/.p2a-acceptance-shots/prod/independent-observations.json`

Visual contact sheets, all inspected by Acceptance:
- `Plan/.p2a-acceptance-shots/prod/contact-320.png`
- `Plan/.p2a-acceptance-shots/prod/contact-390.png`
- `Plan/.p2a-acceptance-shots/prod/contact-767.png`
- `Plan/.p2a-acceptance-shots/prod/contact-768.png`
- `Plan/.p2a-acceptance-shots/prod/contact-1280.png`

The 320/390 sheets show long identity wrapping, bounded model/filter/row labels, readable dialog fields and reachable submit. The 767/768 pair shows the approved bottom-navigation/sidebar breakpoint without displaced actions. The 1280 sheet shows bounded desktop cards/Profile/dialog. Very long readonly descriptions/Prompt can require vertical scrolling; that is accepted behavior, not concealed content or a new requirement to truncate all text.

### §9 final contract-to-evidence matrix (20 items)

| §9 item | Final independent evidence | Result |
|---|---|---|
| Entry 1 — C1 baseline/sibling isolation | unchanged owners/approved local deltas, full canonical Chat regression | PASS |
| Entry 2 — existing endpoint/contracts | approved adapters and payload inspections; CP1/CP2 probes + API tests | PASS |
| Entry 3 — preset baseline IDs 1–8 | opening records plus final Acceptance closing script below | PASS |
| Entry 4 — approved Plan | Alicia's recorded approval and phase handoffs; frozen hash unchanged | PASS |
| Hub/Profile 1 — canonical/direct routes, shared logic | real Chrome dev/production deep links and one shared React implementation | PASS |
| Hub/Profile 2 — deterministic ordering/no storage | Hub probes and unchanged copy-sort/no drag-storage source | PASS |
| Hub/Profile 3 — truthful readonly identity | CP1 tests, source, real long-DOM and visual checks | PASS |
| Hub/Profile 4 — distinct accessible states | full tests plus real Chrome AX/404/invalid/error/retry observations | PASS |
| Conversation 1 — canonical fixed creation | CP2 independent body/lock/navigation tests + real Chrome standard/g045 paths | PASS |
| Conversation 2 — shared ordered lens | CP1 cache/row tests and unchanged shared query family | PASS |
| Conversation 3 — row-derived filters, dialog-only Projects | full CP1/CP2 tests; source call ownership intact | PASS |
| Conversation 4 — no duplicate Chat/server filter | unchanged canonical adapter/routes, scope sweep | PASS |
| Memory 1 — D5 count/tags/error truth | CP1 independent + construction tests, long-DOM and Memory-error browser observations | PASS |
| Memory 2 — static route-free P5 text | source plus rendered evidence | PASS |
| Memory 3 — no Heartbeat/CRUD/Library surface | scope sweep, no corresponding changes | PASS |
| Memory 4 — no preset lifecycle/edit/order customizations | GET-only Agent surfaces and source scope checks | PASS |
| Quality 1 — focused/full tests/build | 462 app tests + 4 diagnostics; typecheck/lint/build all pass | PASS |
| Quality 2 — responsive/accessibility matrix | real browser 499/499 per bundle; five-width visual inspection | PASS |
| Quality 3 — honest evidence/omissions/ownership | unified Builder Evidence §8 plus this independent correction ledger | PASS |
| Quality 4 — independent P2A PASS before commit | this R5 owner-issued verdict; no commit performed | PASS |

### Executed pipeline and Acceptance self-correction

1. First recheck: `node --test packages/app/src/acceptance/p2a_cp3_fixture_probe.mjs` — **4/4 pass**, exit 0.
2. `pnpm --filter exo-app build` — exit 0, fresh production CSS built before browser runs. Existing large-chunk and PWA deprecation advisories only.
3. Temporary Vite server (Node direct CLI, port 5176) → `P2A_ACCEPTANCE_SHOTS=Plan/.p2a-acceptance-shots/dev node packages/app/src/acceptance/p2a_cp3_browser_observer.mjs` — exit 0, **499/499**; JSON independently records **125 assertions / 0 failures / 30 scenarios**.
4. Temporary dist mapping server (port 5177) → `MSYS_NO_PATHCONV=1 P2A_ACCEPTANCE_SHOTS=Plan/.p2a-acceptance-shots/prod node packages/app/src/acceptance/p2a_cp3_browser_observer.mjs --app http://localhost:5177 --base /app` — exit 0, **499/499**, same independent count.
5. Full final `NODE_OPTIONS=--no-experimental-webstorage pnpm --filter exo-app test:run` — exit 0, **51 files / 462 pass / 0 fail/error/skip**. Standalone fixture diagnostic rerun also **4/4**, not counted twice.
6. `pnpm --filter exo-app typecheck` — exit 0.
7. **CP3-H1 / harness-defect / Acceptance:** Node globals in Acceptance's `.mjs` files were absent from the repo ESLint browser globals. Builder correctly left them untouched. Owner imported `URL`, then explicit `process`, `Buffer`, `console` from Node built-ins. No rule suppression, weakened assertion or production change. Lint initially failed solely on these owner files; final `pnpm --filter exo-app lint` and `node --check .../p2a_cp3_browser_observer.mjs` both exit 0. Earlier browser/app results remain valid: only explicit bindings to the same Node built-ins changed, not observer assertions or production behavior. This is an in-cycle Acceptance correction, not another Builder FAIL.
8. Both `git diff --check` and `git diff --cached --check` exit 0 (LF→CRLF notices only). Final artifact staging is followed by an additional whitespace check.
9. Final `bash .agent/check_real_db_baseline.sh` from ExoCore: **OK: AgentPreset baseline 8 rows [1, 2, 3, 4, 5, 6, 7, 8]**. No test fixtures written to real DB.

Execution delegation remained mechanical: source extraction, command running and contact-sheet composition were delegated; source judgment, probe authoring, visual interpretation and verdict stayed with Acceptance owner. No unsolicited reviewer subagent was spawned.

### Accepted limitations, resource release and finish boundary

- Browser tests use intercepted fixtures and deterministic SW-disabled rendering. They establish actual Chrome layout/interaction against dev and production bundles, not live-provider behavior, a full SW lifecycle test, or actual nginx configuration validation. Deployment/SW code was not changed.
- Physical notch/home-indicator inset pixels were not measured on a device. CSS safe-area mechanism and non-notch fallback were verified; no false real-device claim.
- Monorepo-wide/V3 rollback regression remains deferred to the already-approved full C2 gate; no shared/V3/dependency scope changed here. Agent Hub/Profile capability transfer remains later, not implied by this construction acceptance.
- Ports **5176/5177/9333** were free before execution and released after; only runner-owned frontend servers/Chrome were stopped. No probe-profile Chrome processes remain. The construction tool leaves temporary Chrome profile directories (two from this Acceptance run among older ones); runner did not delete unknown/older profiles. This is a non-blocking construction-tool cleanup limitation, not retained running service or app-state failure.
- Previously recorded V3 Project-create refresh/navigation issue and accepted Chat missing-name labels remain adjacent follow-up work; not silently repaired here.
- **Approved P2A Plan execution and independent acceptance are complete. No automatic commit/P2B/new feature authorization.** Builders stop with the accepted working tree and preserve Acceptance-owned artifacts. Further implementation requires its own approved scope; final commit follows repository/user authorization, not a fabricated next phase.
