# P2B independent acceptance report

Owner: Solaire, pane 3. Builders may read this report, but may not edit it or independent acceptance artifacts.

## Activation and frozen authority

Alicia's current instruction authorizes serial construction A/B/D by pane 4 and C by pane 5. It supersedes the Plan header's historical CONSTRUCTION NOT YET AUTHORIZED status and activates the assigned acceptance chain. No product criterion is changed and no Plan re-review is requested.

Frozen authority: `Plan/V4_Phase_2B_Project_Workspace_Management_Detailed_Plan.md` sections 3–8; SHA256 `4a93360627b1cde95e2bcac1c51c207ddf664309d184c0e14f332dcbbeb64082`.
Entry HEAD: `b1178fb1a974cd848fdeaa11a7d279df920b1a0c`. Full dirty manifest and predecessor/app pins: `Plan/V4_Phase_2B_acceptance_entry_baseline.json`. Existing P2A dirty work and Plan/备忘.txt are not P2B-owned.
Opening real DB baseline: OK, exactly AgentPreset IDs 1–8. No data mutation authorized for acceptance; abstract PATCH tests use mocked HTTP or isolated test DB/provider stub only.

## Serial gates

| Gate | Builder | Frozen verification scope | Next permission |
|---|---|---|---|
| CP1 / A | pane 4 DeepSeek | §7 CP1; §8.1 applicable scope, §8.2–8.3, §8.4 lens/filter/isolation; stage-relevant layout | B only after independent PASS |
| CP2 / B | pane 4 DeepSeek | §7 CP2; §8.5–8.6; Files/Knowledge mounted refresh, mixed IDs and P1D regression; exact API doc reconciliation | C handed to pane 5 after independent PASS |
| CP3 / C | pane 5 Sol | §7 CP3; §8.4 shared creation compatibility, §8.7 deletion and affected existing caches; creation checks precede deletion work | D handed back to pane 4 after independent PASS |
| CP4 / D | pane 4 DeepSeek | Entire §8; independent probes, complete app tests/typecheck/lint/build, whitespace, dev+production at 320/390/767/768/1280 | P2B only; no implicit C2/commit/cutover |

Intermediate gates use focused evidence; complete app suite and five-width dual-environment matrix are final-candidate requirements, not repeated after each micro-fix. Findings must trace to frozen requirements and inspected production paths. Gemini may advise on aesthetics; objective responsive/accessibility evidence and final logic verdict remain independently owned here. No new aesthetic MUST is introduced.

Construction evidence owner: active serial Builder, `Plan/V4_Phase_2B_Construction_Evidence.md`. Handoff must contain stage, baseline/diff pin, exact files/symbols, numeric test results, unexecuted cases and scope deviations. Builder stops at every gate; no self-acceptance. Acceptance may delegate mechanical tests/source-location collection, never its verdict.

Second FAIL of the same invariant requires a rebuilt state/path/timing matrix. Third consecutive FAIL within a gate pauses ordinary rework for diagnosis and Alicia escalation. Only distinct reviewed Builder baselines increment the counter. Fact conflicts requiring Plan changes also escalate; routine repairs do not request human permission.

Messages follow read -> send/submit -> delivery check -> wait; no acknowledgement-only messages or post-delivery polling. Shared files and exclusive test/build resources are handed off serially.

## Review-cycle ledger

No verification baseline has been submitted. CP1 pending; consecutive FAIL count 0. No product PASS/FAIL verdict has been issued.
## R1 — CP1 / Stage A — FAIL

Verdict: **FAIL**
Phase/checkpoint: CP1 / Stage A
Consecutive FAIL count: **1**
Repeated invariant IDs: none (first reviewed Builder baseline)
Baseline: HEAD `b1178fb1a974cd848fdeaa11a7d279df920b1a0c`; exact manifest/content pins in `Plan/V4_Phase_2B_acceptance_CP1_R1_baseline.json`.
Gates: checked **17**, passed **13**, failed **4**, not checked **1** (matrix below).
Findings: new **4**, residual **0**, repair-regression **0**, harness-defect **1**, acceptance-miss **0**.
Tests: **138 unique cases**, passed **128**, failed **10**, errors **0**, skipped **0**. This is 118 construction/predecessor cases plus 20 final valid independent cases; repeated same-baseline harness runs are not added to these totals.
Full regression: **deferred**. Known blockers remain; full app and five-width dual-environment matrix remain CP4 obligations. Builder's 500-test full-app run is recorded as a claim/evidence submission, not relabelled as independently rerun.
Unreviewed areas: **1 runtime area** — stage-relevant browser layout/focus/scroll observations. Source layout/focus sweep completed; full five-width matrix is CP4, not a CP1 blocker by itself.

### Gate sweep

| ID | Frozen authority / observable gate | R1 result / evidence |
|---|---|---|
| G01 | §8.1 ownership/predecessor | PASS: Plan hash matches entry; acceptance-owned report/entry unchanged before review; only 7 authorized predecessor shared files differ from 272 entry pins; others preserved. Opening baseline OK IDs 1–8. |
| G02 | §4/§7 CP1 scope | PASS: no B/C feature exposure; dependency/V3/shared-package diff sweep empty; no production edits by Acceptance. Existing unrelated skill dirty preserved. |
| G03 | §5.1–5.2 canonical owners | PASS: list remains chat/api+queryKeys.projects; detail remains control/api+control key; Conversations single collection; no extra mutation owners. |
| G04 | §8.2 routes/shell | PASS source + predecessor/focused evidence: canonical /projects and detail; Chat active and focused valid-detail policy; no V3 alias. |
| G05 | D9/§8.2 Hub states/order/count | PASS independent HTTP/DOM order, unavailable counts on Conversations failure, malformed list error/retry; construction covers loading/empty/retry. |
| G06 | §5.4/§8.2 invalid URL/404/failure separation | PASS independent invalid-URL zero requests; construction/source 404 vs request failure; absent-name malformed control fails honestly. |
| G07 | §5.3/§8.2 detail identity contract | FAIL F03: invalid numeric response identity accepted as editable owner. |
| G08 | D4/§5.5 exact-project lens/order/Agent identity | PASS source and focused cases: exact projectId, Drift excluded, stable order, ID deduplication, fallback names, canonical links. |
| G09 | D4/§8.4 filter lifecycle | PASS source and focused replacement/return/failed-refetch tests; no copied collection or server filter. |
| G10 | §8.3 ordinary create | PASS focused body, duplicate-name, pending duplicate lock, confirmed-id navigation; malformed-create lock coverage. |
| G11 | §8.3 stale create/reopened dialog | PASS independent late success cannot navigate over newer dialog; shared list refetch still occurs. |
| G12 | §8.3 edit fields/persistence boundary | PASS focused + independent exact four-field PATCH, preserved user input, same-origin success rereads server truth; no directory probe. |
| G13 | §5.2/§5.4/§8.3 late edit invalidation | FAIL F01: A PATCH followed by cached B route invalidates wrong detail origin. |
| G14 | §5.3/§6.1–6.2/§8.3 field errors | FAIL F02: non-name field messages swallowed in both form modes. |
| G15 | §6.2 step 2 overview empty labels | FAIL F04: real backend empty strings render blank rather than explicit empty labels. |
| G16 | focused quality/predecessor regression | PASS: 7 files / 118 cases, typecheck, lint, unstaged and staged whitespace checks exit 0. |
| G17 | §8.8 basic focus/wrapping source integration | PASS source only: shared dialog focus/trap/restore; name initial focus, scrolling dialog body, reachable close/action layout, Project-only wrapping rules; no browser-proof claim. |
| G18 | §7 intermediate stage-relevant browser observations | NOT CHECKED in R1; deferred while blockers remain. Entire dev/prod five-width acceptance is CP4. |

### Blocking repair packet (dependency order)

#### F01 — P1 / new — submit-origin Project detail cache is lost on route switch

- **Observed evidence:** independent runtime sequence loads A=41, starts PATCH A, switches to already-cached B=42 while request is pending, resolves success, returns to A. A still renders old `Project-41` instead of confirmed server `Saved-A`. Same failure for malformed 2xx (server write may have landed). Same-origin positive control correctly rereads `Saved-A`.
- **Violated invariant:** §5.2 confirmed writes refresh their shared facts even when dialog closes/route switches; §5.4 submit captures Project identity; §8.3 late completion isolation.
- **Root cause — confirmed:** `features/projects/queries.ts:42–61` closes over current `projectId` for completion invalidation; `ProjectDetailPage.tsx:194–201,288–291` reuses the component across params. Installed TanStack 5.102.8 pending Mutation options are updated by observer.setOptions, so resolution-time onSuccess/onError can use B closure. Runtime proves A is not refreshed. A scout's later contrary statement that an in-flight mutation always retains its callback closure is rejected: it contradicts installed MutationObserver source and the independent runtime control.
- **Affected siblings:** successful PATCH, malformed-2xx ambiguous PATCH, cached and uncached destination, close/reopen/return while write pending. Ordinary failed PATCH must not fabricate success or invalidate the wrong owner.
- **Required outcome:** body and every confirmed/ambiguous-write cache side effect remain associated with submitted A regardless of current route; returning to A consumes refreshed/stale-marked server truth. Obsolete completion must not close or alter a newer dialog/page.
- **Non-binding direction:** make submit identity available to completion handlers independently of mutable render closure; the hook/component mechanism is Builder-owned. No broad cancellation framework needed.
- **Chained effects:** mutation variables/call sites may change; rerun same-origin edit, route-switch success/error/ambiguous cases and local dialog isolation. Do not duplicate key families.
- **Verification targets:** pending A→cached B→settle→A; both valid and malformed success; observe actual returned page and request body, not just invalidate call counts.
- **Preserve recommendation:** create stale-origin suppression/shared list refresh and same-origin successful PATCH already pass.
- **Escalation trigger:** discuss before touching accepted canonical Conversation creation or replacing global Query infrastructure; neither is required by this finding.

#### F02 — P1 / new — supported non-name field errors are not visible

- **Observed evidence:** `description`, `prompt`, `work_dir` server reasons never reach the editor DOM; only generic `API 400:` remains. Independent create `work_dir` sibling fails too; name error positive control passes and entered text is retained. Actual backend `work_dir` max_length=500 supplies a reachable field-error case (`../ExoCore/core/models.py:54–56`); serializer fields are in `core/serializers.py:12–16`.
- **Violated invariant:** §5.3 backend field errors remain visible; §6.1–6.2 failures retain inputs and show field/general errors; §8.3 ordinary create/edit failure feedback.
- **Root cause — confirmed:** `ProjectFormDialog.tsx:113–126` puts all supported fields into RHF error state, but only `errors.name` is rendered (`:169`). Banner uses transport's generic message rather than those server reasons (`:151–155`, `packages/shared/src/api.js` non-2xx branch).
- **Affected siblings:** create and edit; name/description/prompt/work_dir; multiple simultaneous supported-field errors; definite-failure retry. Do not expand into unrelated global API-error redesign.
- **Required outcome:** show supported backend field reasons visibly/associated with the relevant controls (or a clear field-labelled summary), retain inputs and allow retry after definite failure. Preserve generic network/contract error visibility.
- **Non-binding direction:** render existing error state instead of adding a new error subsystem.
- **Chained effects:** shared form markup and focus/accessible-name evidence; rerun both form modes and multi-error state.
- **Verification targets:** reachable overlong work_dir in create/edit, other supported field errors, name positive control, user input retained and retry remains available.
- **Preserve recommendation:** name error display, submitted four-field body, duplicate pending lock and close token revocation already work.
- **Escalation trigger:** pause to discuss if repair requires exo-shared transport changes or backend edits; local form repair is sufficient in current evidence.

#### F03 — P1 / new — reused detail adapter accepts invalid numeric identity

- **Observed evidence:** valid route /projects/41 receiving detail id 0, -4 or 1.5 renders full Project overview and editable action, not contract error. Missing-name control correctly renders failure. URL validation therefore does not establish response identity validity.
- **Violated invariant:** §5.3 Project detail object requires positive numeric identity; §5.4 confirmed owner gate; §8.2 malformed-success failure is distinct. The integer identity requirement follows the frozen positive base-10 Project ID contract.
- **Root cause — confirmed:** existing `features/chat/control/api.ts:192–211` checks only typeof id === number and name === string. P2B lists/writes use stricter positive-integer identity validation, but Detail reuses the weaker existing boundary unchanged.
- **Affected siblings:** Project Detail and accepted P1D chat-local drawer share this GET adapter. This is a current P2B contract defect at its reused entry boundary, not permission for broad P1D refactoring.
- **Required outcome:** malformed Project identities fail explicitly and do not establish an editable owner/child section. Valid existing Project detail payloads and P1D behavior remain accepted.
- **Non-binding direction:** proportionate guard on the existing canonical detail owner; no duplicate adapter/key or generalized validation framework.
- **Chained effects:** **explicitly authorized narrow repair expansion** to `features/chat/control/api.ts::fetchProjectDetail` plus focused construction tests; rerun `p1d_project_api` and relevant drawer regression because this shared area was previously accepted. No file-ID changes before CP2.
- **Verification targets:** non-positive/fractional detail IDs on valid routes, normal positive details, malformed object/name, P1D valid Project loading.
- **Preserve recommendation:** single detail query/key owner; valid uploaded-only P1D behavior; invalid URL zero requests.
- **Escalation trigger:** broader file adapter/schema changes or changes to Acceptance/P2A probes require separate disposition; do not repair those pre-emptively.

#### F04 — P1 / new — blank configuration is not explicitly labelled

- **Observed evidence:** backend-valid description/prompt/work_dir empty strings render an empty paragraph and empty definition values. Independent assertion is wording-neutral; no particular Chinese placeholder is required.
- **Violated invariant:** §6.2 step 2 explicitly requires honest blank-value labels in the overview; CP1 owns Project configuration display. Backend blank=True/default empty-string is the ordinary payload, not an exotic malformed case.
- **Root cause — confirmed:** `ProjectDetailPage.tsx:254–257` uses nullish fallback, while the GET adapter retains `''` as a string.
- **Affected siblings:** newly created blank optional fields; edited-to-empty values; existing empty Projects; nonempty multiline text must remain unchanged.
- **Required outcome:** overview explicitly communicates absence for all three optional configuration values without altering stored string semantics; editor continues round-tripping blanks as ''. No mandatory wording or extra feature is imposed.
- **Non-binding direction:** separate display emptiness from submitted values; do not rewrite server data to placeholders.
- **Chained effects:** overview/empty state tests and final layout captures; no backend or cache redesign needed.
- **Verification targets:** server empty strings before and after edit, ordinary nonempty content, edit field remains empty rather than placeholder text.
- **Preserve recommendation:** single description presentation and four-field editor/persistence ownership.
- **Escalation trigger:** no expansion expected; discuss if proposing whitespace rewriting or changed storage semantics.

### Acceptance harness accountability

**H01 / harness-defect / Acceptance-owned, corrected on the SAME Builder baseline.** Initial sibling sweep included a synthetic `non_field_errors` response. Exact current Project serializer has no demonstrated production origin for that case; it is withdrawn as an active blocker and removed from the probe. This does not authorize hiding real general request failures and does not require new backend/global error behavior. Blank-state assertions were also made wording-neutral before final reporting. Final valid probe count is 20, not 21; controls establish same-origin server refresh, supported name errors and malformed missing-name rejection. No production edit was made to achieve those control results. Harness refinements are not additional review cycles or Builder FAILs.

### Repair order / preserve / recheck release condition

1. Fix F01 submit-origin invariant and its success/ambiguous siblings.
2. Repair F03 canonical detail guard at the explicitly approved narrow P1D shared boundary.
3. Repair F02 supported field-message presentation and F04 blank configuration presentation.
4. Add honest construction coverage, update the single Construction Evidence record; report precise scope and numeric outcomes.
5. Stop again at **CP1** and request recheck. **Stage B is NOT released.**

Focused recheck: original failing independent cases first; negative/route/cache siblings; all 38 Stage-A construction cases; relevant P1D detail/drawer cases after F03; P2A creation/Agent regression affected by shared integration; typecheck/lint/whitespace; stage-relevant layout/focus observations before CP1 release. Whole-app/five-width dual-environment matrix remains CP4 rather than repeated while blockers remain.

Preserve recommendations (not immutable production zones): Hub backend order/count-error behavior, canonical single cache owners, exact lens/filter behavior, old-create suppression, name errors, same-origin successful edit, no B/C surfaces. If a repair must change a preserved behavior area beyond the declared directly affected scopes, first state necessity, alternatives, impact and invalidated evidence to Acceptance. Do not edit frozen Plan, this report, entry/R1 baseline JSON, P2A acceptance artifacts or independent test implementation.

Builder recheck handoff requested: F01–F04 mapping; changed files/symbols; searches and match counts; exact numeric results; unexecuted scenarios; any scope deviations. No acknowledgement message needed: directly repair within the authorized boundary.

### Immutable ledger row

Cycle: R1
Checkpoint ID: CP1
Baseline: `Plan/V4_Phase_2B_acceptance_CP1_R1_baseline.json` (hash below)
Verdict: FAIL
Cause owners: Construction 4, Acceptance 1, Harness 1, Spec 0, Environment 0, Unknown 0 (Acceptance/Harness share H01; not six distinct production defects)
Finding IDs: F01, F02, F03, F04; H01 corrected/withdrawn
Supersedes/amends: none
Consecutive FAIL count: 1
Repeated invariant IDs: none; F01–F04 each first occurrence
Baseline SHA256: `824a271cbf26dadfefcd483dba9f19534a64aba88ecff380db5430a3c8729708`.

## R2 — CP1 / Stage A — PASS (Stage B released to pane 4)

Verdict: **PASS — CP1 only**
Consecutive FAIL count: **0** (reset on approved CP1 final PASS; R1 history remains).
Repeated invariant IDs: none unresolved. F01–F04 each closed on first repair baseline.
Baseline: same HEAD `b1178fb1a974cd848fdeaa11a7d279df920b1a0c`; `Plan/V4_Phase_2B_acceptance_CP1_R2_baseline.json` pins, SHA256 below. Final source-pin comparison reports **0 changed production/test pins during review**.
Gates: checked **18**, passed **18**, failed **0**, not checked **0** within CP1 (R1 G01–G18 matrix retained as stable gate IDs).
Findings this cycle: new **1 nonblocking documentation item D01**, residual **0**, repair-regression **0**, harness-defect **1 H02 corrected**, acceptance-miss **0** production findings. **No unresolved P0/P1.**
Tests: **533 unique full-app cases passed**, failed/errors/skipped **0/0/0**, **54 files**. The original independent **20/20** ran FIRST and are also included in 533; do not add them twice. P1D adapter/drawer and P2A predecessor regressions are included in that full discovery.
Browser: **8/8 focused observations** (Hub/Create/Detail/Edit at 390 and 1280, isolated built `/app/` with HTTP fixtures only). Browser scenarios are not counted as Vitest cases.
Full regression: **executed for the current CP1 candidate**. Typecheck, lint, build, both whitespace checks exit **0**. Nonfatal bundle-size/deprecated build-option and Windows LF/CRLF advisories remain.
Unreviewed areas: **0 CP1 areas**. B/C functionality and CP4 full five-width dual-environment/browser screenshot matrix are future checkpoints, not CP1 PASS claims.

### Gate closure evidence

- **G01–G06 preserved:** frozen Plan hash still matches; 153 R1 pins comparison yielded 144 unchanged / 9 changed / 0 missing (7 authorized source/test repair files, Builder Evidence, Acceptance's own report). Staged acceptance artifacts equal their worktree versions. Route/list/missing/error/zero-request controls and owner/scope checks remain valid. No P1D mixed-ID work or B/C surface is exposed.
- **G07 / F03 closed:** canonical `fetchProjectDetail` now requires integer id >0 while preserving the existing valid payload normalization. Independent route-level invalid numeric identity cases now fail honestly (contract error, no edit owner). Existing valid P1D adapter/drawer cases pass; no second GET owner introduced.
- **G08–G12 preserved:** exact lens/filter/order/name fallback and one shared collection remain; full suite covers create/edit body, ordinary failure, malformed success and pending locks. Independent old-create/reopened-dialog test still suppresses old local completion and refreshes shared Projects. Same-origin edit still refetches server truth.
- **G13 / F01 closed:** submitted `projectId` now travels in mutation variables; request target and settled invalidations use those variables. Installed TanStack execute passes the original variables to updated onSuccess/onError handlers. Independent cached A→B→settle→A succeeds for valid and malformed 2xx; existing construction sibling cases cover definite failure and an open newer B dialog. No closure-sensitive cache target remains on this repaired path.
- **G14 / F02 closed:** name/description/prompt/workDir errors are all visibly rendered; generic/banner behavior remains. Independent edit field cases and create work_dir sibling pass; multi-error/retry construction cases pass. Installed RHF built-in validation clears valid registered-field server errors on a subsequent submit, so absence of a manual clearErrors call is not a blocker.
- **G15 / F04 closed:** display-only helper labels null/empty values without changing stored strings; independent wording-neutral blank-display check passes. Editor remains blank rather than submitting placeholder text.
- **G16 quality closed:** independent-first 20/20; then complete app 533/533; build/typecheck/lint/whitespace all pass after Acceptance harness lint repairs.
- **G17–G18 browser closed for CP1:** isolated real Chromium at 390 and 1280 renders actual long Project name, description, prompt and unbroken work directory. Hub/Create/Detail/Edit document width remains inside viewport; card/open/edit controls are genuine hit targets after normal scroll-to-view; modal initially focuses name, Tab/Shift+Tab contain focus, Escape closes and focus returns to trigger; edit save is reachable by scrolling. Evidence: `Plan/.p2b-acceptance-shots/cp1/observations.json`, Acceptance-owned `packages/app/src/acceptance/p2b_cp1_browser_smoke.mjs`. No real API write was made (10 GET fixture requests).

### D01 — P2 / new / Construction documentation — correct serialization claim

`Construction_Evidence.md §2.5(1)` says TanStack queues B's submission behind A. This is not the runtime mechanism: no mutation `scope.id` is configured, so TanStack does not serialize distinct mutation executions. The shared observer's `isPending` disables the B dialog's submit while A is pending; when it settles, the local B dialog remains intact. If mutate is actually called without a scope, executions are not queued by TanStack.

**Required documentary correction at the next Evidence update / Stage B entry:** describe observed UI pending-lock behavior and remove the unsupported queue claim. No queue/scope infrastructure or new product behavior is requested. This is nonblocking documentation, not a reason to disturb the repaired implementation. The current PASS does not certify the original §2.5 explanation.

### H02 — Acceptance-owned browser harness correction; no Builder FAIL increment

The first intermediate CDP observer had incorrect Shift modifier encoding (Alt bit instead of Shift), default smooth scroll before hit-coordinate sampling, missing native keycode transport, unbounded teardown/CDP waits, and an immediate focus assertion that did not await passive cleanup. These were Acceptance transport/scheduling errors, not established production failures. Corrections use Shift bit 8, raw native key events, instant deterministic scroll-to-view, bounded calls/teardown, and observable eventual focus restoration.

CDP edit-dialog screenshot capture also stalled intermittently; exact compositor cause is **unconfirmed**. Optional intermediate screenshot capture was separated from the CP1 DOM/hit/focus smoke so it could no longer prevent those product observations. **All product assertions remain**, and the final DOM-only observer completed all eight scenarios. Earlier partial PNGs are diagnostic remnants, **not PASS evidence**. This does not waive CP4's mandatory screenshots/five-width dual-environment verification. The capture transport must be addressed for CP4. Acceptance's new script also initially caused four lint findings (unused import, Node globals, empty startup catch); all corrected and lint/typecheck rerun green. None of these same-baseline harness attempts is an additional Builder review cycle.

### Release / serial ownership

**CP1 PASS. Pane 4 is authorized to begin Stage B only**, after correcting D01 in its single Construction Evidence record. Stage B is the frozen Files+Knowledge complete linkage slice, including existing P1D mixed-ID compatibility, both mounted-view refresh paths, provider-safe Knowledge edit verification and exact consumed API-doc reconciliation. **CP2 is a mandatory stop.** No fixed-Project Conversation creation or Project deletion until CP2 passes and Stage C is explicitly handed to pane 5.

Preserve recommendation: CP1 routing, canonical cache owners, lens/filter behavior, submitted-origin mutation identity, truthful field/empty/error states. Stage B may perform its already-approved resource integration and narrow P1D mixed-ID work; any extra dependency change to a previously passing area requires necessity/impact/recheck discussion. Acceptance artifacts remain read-only to Construction.

No C2, commit, cutover, real-data write or another P2 slice is authorized. Gemini aesthetic consultation remains separate from objective quality gates. Idle pane 5 receives no message at this CP1 boundary.

### Immutable ledger row

Cycle: R2
Checkpoint ID: CP1
Baseline: `Plan/V4_Phase_2B_acceptance_CP1_R2_baseline.json`
Verdict: PASS
Cause owners: Construction 1 (D01 nonblocking documentation), Acceptance 1, Harness 1 (shared H02), Spec 0, Environment 0, Unknown 1 (optional screenshot transport cause; no product blocker)
Finding IDs: F01–F04 closed; D01 documentary correction at B entry; H02 corrected/limited as above
Supersedes/amends: R1 repaired; immutable R1 findings/history retained
Consecutive FAIL count: 0 (CP1 final PASS)
Repeated invariant IDs: none unresolved
R2 baseline SHA256: `4152fab17fcd4492f4114a44fc15cfcf8d47e92195da9525b14c72a85a6f88ad`.

## R3 — CP2 review 1 / Stage B — FAIL

Verdict: **FAIL — CP2 remains held; Stage C is not released.**
Consecutive FAIL count: **1 at CP2** (new checkpoint explicitly authorized by Plan §7 and CP1 R2 PASS; CP1 remains accepted).
Repeated invariant IDs: none within CP2. B01 is a new resource-section local-origin defect, not a reopening of the repaired CP1 mutation-handler implementation.
Baseline: `Plan/V4_Phase_2B_acceptance_CP2_R1_baseline.json`, HEAD unchanged; SHA256 below. Frozen Plan hash and staged Acceptance artifacts were checked unchanged by Construction.
Gates: checked **15**, passed **11**, failed **4**, not checked **1** (CP2 matrix below).
Findings: new **4 P1**, residual **0**, repair-regression **0**, harness-defect **1 corrected**, acceptance-miss **0**.
Tests: **139 unique cases executed**, passed **125**, failed **14**, errors **0**, skipped **0**. Construction/CP1 focused set 5 files / **113 passed**; new independent CP2 set 1 file / **26 cases, 12 passed, 14 failed**. Repeated harness runs are not counted as additional cases or review cycles.
Full regression: **deferred while blockers remain**. Builder's 567-test full-app claim is not relabelled as independent verification. Typecheck/lint and staged/unstaged whitespace passed; Acceptance fixed its own two fixture-storage type annotations before the final static pass.
Unreviewed areas: **1** — stage-relevant real-browser resource layout/hit-target observations. Keyboard defects already have independent DOM/event evidence. Complete five-width dual-environment matrix remains CP4.

### CP2 gate sweep

| ID | Frozen gate | Evidence/result |
|---|---|---|
| K01 | Ownership/predecessor/scope | PASS: Plan unchanged; Acceptance index/worktree unchanged by Builder; current scope app+exact API docs; no backend/V3/dependency changes. D01 queue claim corrected in Evidence §2.5. DB opening/closing baseline remains IDs 1–8. |
| K02 | §5.2 canonical fact owners | PASS: P1D and Files section share one projectFiles family; one Knowledge-list adapter/key; global Conversations unchanged. |
| K03 | D3 mixed identities/source metadata | PASS: valid uploaded/synced/mixed cases in focused tests; independent inconsistent/unknown source metadata renders neutral usable rows. |
| K04 | §8.5–8.6 malformed/loading/error separation | PASS: invalid file key/top-level and Knowledge envelope fail explicitly; independent Files/Knowledge failures retain other section/owner truth; construction covers loading/empty/retry. |
| K05 | D3 P1D read-only compatibility | PASS: real P1D drawer mounted beside resource sections renders mixed rows through canonical adapter; no workspace mutation surface added to drawer. |
| K06 | Files upload → both resource views | PASS independent multipart file request and confirmed response cause real mounted Files, Knowledge and P1D consumer to reread changed server truth. |
| K07 | Numeric/kf_ delete → both resource views | PASS independent endpoints preserve numeric and kf_ keys; true empty 204 resolves; both mounted sections and P1D consumer update. |
| K08 | Knowledge filtered bare-array/read fields | PASS source+HTTP fixtures: current Project filter, no pagination/detail-query invention; only supported editable fields. |
| K09 | Knowledge field preservation | FAIL B02: untouched/new phrase keywords are destructively split and can be silently submitted. |
| K10 | PATCH normal success/refetch/failure truth | PASS live-origin abstract/keyword controls return server truth after refetch; supported {error,code}/input-preservation construction paths; stale local sessions are separately failed at K12. |
| K11 | D2 truthful index-start claim | FAIL B03: backend-normalized no-change response still triggers claimed background index start. |
| K12 | §5.4/§8.6 resource route/close identity | FAIL B01: A dialogs/error states survive into cached B or a new editor; current props combine with old resource state. |
| K13 | §8.8 relevant dialog keyboard safety | FAIL B04: neither new dialog establishes focus or responds to safe Escape; source lacks Tab containment/restore implementation. |
| K14 | D2/D6 forbidden controls/provider safety | PASS: no file Open/Download/Preview, Knowledge create/delete/content/history/plasmid controls, backend write or paid-provider call by acceptance; fixtures only. |
| K15 | API docs/predecessor focused quality | PASS: ReactSheet only consumed §2.1/§3.8/§3.9; exact current backend declarations reviewed; 113 focused/predecessor cases and static checks green. |
| K16 | Stage-relevant resource browser observations | NOT CHECKED in this cycle; deferred while known blockers remain. CP4 complete matrix is still required. |

### B01 — P1 / new — resource dialogs and local outcomes survive their origin

- **Observed:** independent cached A→B route change leaves BOTH A file confirmation and A Knowledge editor open over Project B. A late upload failure appears on B. Closing a pending Knowledge edit, resolving its failure and opening a different fragment shows the old fragment's error in the new editor.
- **Frozen authority:** §5.4 route changes close/neutralize old-origin mutation dialogs and capture identity at submit; §5.2 shared write effects survive closure without stale local effects; §8.6 route/close prevents another Project receiving old local completion.
- **Confirmed root:** `ProjectFilesSection.tsx:29–30,120–127,162–167` and `ProjectKnowledgeSection.tsx:27–32,95–96,143–149` retain local row/error state without an origin boundary. Parent `ProjectDetailPage.tsx:282–285` does not remount sections when the destination detail is already cached. File confirmation can combine B projectId with A row id; Knowledge editor can send A global kfId with B projectId in mutation variables, thus misidentifying which Knowledge cache to invalidate. The shared mutation handlers correctly use their submitted variables; the caller is supplying mismatched identity.
- **Affected paths:** open-before-route-change; pending success/failure/malformed response across route switch; close/reopen or another row's editor; upload/delete status/error banners. Uncached-destination unmount alone is not sufficient evidence.
- **Required outcome:** old row/dialog/feedback cannot be operated or displayed as B/new session state. Every request and cache effect has one captured Project/resource/session origin. Closing an editor suppresses its obsolete local outcome while confirmed writes still refresh the submitted origin's shared facts.
- **Non-binding direction:** use an explicit local origin lifetime or appropriately keyed resource-section/dialog lifetime, plus session-scoped feedback. Builder chooses the mechanism; no global cancellation framework or duplicate key family is required.
- **Chained effects:** section state, mutation observers, dialog focus restoration and pending interactions. Recheck BOTH files/Knowledge and both cached/uncached destination routes; ensure detaching observers does not suppress mutation-level shared invalidation.
- **Verification:** pending A→cached B, pre-submit A dialog→B, old success/error after close, reopen same/different row, return A consumes updated truth, B untouched. Test live UI/request targets as well as cache observations.
- **Preserve recommendation:** current upload/delete dual invalidation and submitted-variable completion handlers already pass; do not unnecessarily rewrite them.
- **Escalation:** discuss before altering accepted CP1 Project create/edit or canonical Conversation mutation owners; these are not needed for the identified local-state boundary.

### B02 — P1 / new — keyword editing silently changes unrelated stored values

- **Observed:** no-edit Save with a valid keyword `project plan`, `alpha;beta` or `one,two` unexpectedly submits a PATCH instead of leaving the data unchanged. An abstract-only edit injects `keywords:['project','plan']`. Entering `new phrase` in a control labelled comma-separated submits two keywords rather than one. A plain single-token no-op positive control correctly closes with no write.
- **Frozen authority:** §6.4/§8.6 supported abstract/keywords editing with truthful prior/server state; D2/backend-supported representation. Preserving untouched data is required; the Plan never authorizes lossy keyword normalization.
- **Confirmed root:** `projection.ts:122–138` splits on commas, semicolons AND whitespace, then joins with a delimiter that is legal inside existing backend keyword strings. `ProjectKnowledgeSection.tsx:127,135–137` treats that lossy round-trip as an actual edit. Backend `../ExoCore/memory/views.py:73–78` stores the supplied list verbatim; there is no matching server normalization to justify the change.
- **Affected paths:** no-op Save, abstract-only Save, editing a different keyword while existing phrases/separator-bearing values are present; repeated editor reopen cycles.
- **Required outcome:** unedited keyword arrays remain semantically unchanged and are not spuriously PATCHed; abstract-only changes never rewrite keywords; keyword editor can preserve valid phrase values and represent intentional additions/removals without silently splitting existing entries.
- **Non-binding direction:** separate actual user edits from display formatting and use a lossless per-keyword interaction/representation. Do not choose a parser merely to pass the sample words; the invariant applies to all valid string entries. No new package required.
- **Chained effects:** presentation helper, form dirty detection, keyword-only success claim, construction projection tests. Existing helper round-trip comment/test assumptions need honest correction.
- **Verification:** phrase + separator-bearing existing values, no-op, abstract-only, intentional keyword edit, reopen/refetch; inspect exact PATCH body and returned list rather than only control text.
- **Preserve recommendation:** only two backend-supported editable fields and server refetch-on-success remain; full-content/create/delete controls stay absent.
- **Escalation:** any proposal to restrict backend-valid keyword data or change server normalization/product semantics requires discussion; do not silently narrow the contract.

### B03 — P1 / new — index-start message can contradict successful backend response

- **Observed:** existing abstract `original abstract`, submitted ` original abstract `, actual-contract response `{msg:'已保存。',updated:[]}` still shows “后台索引刷新已启动”. Normal changed-abstract and keyword-only controls pass, isolating the false claim.
- **Frozen authority:** D2 and §6.4/§8.6 require reporting only that a background index refresh actually started, not fabricating indexing status. No new status tracker is required.
- **Confirmed root:** backend `../ExoCore/memory/views.py:81–101` strips input, compares with stored abstract and starts its thread ONLY when changed; trimmed-equal input produces `updated:[]` and no job. UI `ProjectKnowledgeSection.tsx:130–146,181–187` derives its success assertion solely from raw submitted inequality, ignoring that successful backend result.
- **Affected paths:** surrounding-whitespace edits; empty/whitespace-equivalent abstracts; combined keyword change with equivalent abstract; normal actual abstract change.
- **Required outcome:** success feedback agrees with actual accepted server change semantics. A no-change/keyword-only result does not claim an index start; genuine abstract change can report saved + background started, never completed.
- **Non-binding direction:** use the existing authoritative response/change semantics or align no-op detection to verified backend normalization. Do not add polling/status infrastructure or rely on fragile prose matching.
- **Chained effects:** PATCH result consumption, saved local state (coordinate with B01), no-op detection and exact relevant ReactSheet wording. The Builder note “derive claim only from submitted patch, never updated” is an implementation choice, NOT a frozen Plan requirement.
- **Verification:** original vs whitespace-only equivalent abstract, keywords plus equivalent abstract, real abstract change; exact backend response and visible status. All probes remain mocked HTTP/provider-safe.
- **Preserve recommendation:** no paid-provider access, no real-user fragment PATCH; successful refetch and keyword-only no-index wording already work in ordinary cases.
- **Escalation:** observed actual backend change outside current `.strip()`/updated contract would require fact reconciliation; no such drift has been found.

### B04 — P1 / new — new dialogs omit basic keyboard/focus behavior

- **Observed:** both file-delete confirmation and Knowledge editor leave focus on the outside trigger. Independent safe Escape events do not close either dialog. Source confirms no initial-focus/ref, Escape handler, Tab trap or restoration wiring (`ProjectFilesSection.tsx:130–176`, `ProjectKnowledgeSection.tsx:151–231`).
- **Frozen authority:** §8.8 dialog focus, containment/restoration and safe Escape; §7 stage-relevant interaction checks. This is functional accessibility of current CP2 dialogs, not postponed aesthetic review or the CP4 full-width screenshot matrix.
- **Confirmed root:** raw role=dialog/aria-modal markup was added without the app's established behavior. Existing shared `features/chat/dialogA11y.ts:11–79` demonstrates the accepted interaction contract.
- **Affected paths:** both dialogs; open/close, keyboard traversal, safe Escape, pending completion, origin change and trigger removal.
- **Required outcome:** opening moves focus inside, Tab/Shift+Tab remain contained, safe Escape closes and normal dismissal restores the trigger when it still exists. Pending close policy must remain consistent with B01 stale-local suppression and actual write safety.
- **Non-binding direction:** reuse the accepted shared helper if suitable, rather than creating another modal subsystem; exact internal helper use is not itself a MUST.
- **Chained effects:** local callbacks/origin guards and focus cleanup; real-browser smoke should cover both after repairs, with long content/actions scrollable.
- **Verification:** both dialogs initial focus/Tab/Shift+Tab/Escape/restore; safe pending-close + late success/failure; route switch with old trigger removed. Do not weaken independent assertions to role markup alone.
- **Preserve recommendation:** named row/source confirmation and supported-only Knowledge controls remain unchanged.
- **Escalation:** discuss first if proposing changes to the shared helper affecting all accepted Chat dialogs; no global helper rewrite is currently necessary.

### Harness accountability and review coverage

Acceptance corrected two TypeScript annotations in its own mutable HTTP-fixture storage (`unknown` instead of inferred `{}`); typecheck/lint then passed. This is **H03 / harness-defect / corrected**, not a Builder repair obligation or additional review cycle. Added plain-keyword no-op control and independently exercised Escape to distinguish transport/timing from production omissions; focus assertion waits for effects. Final valid count is 26. Repeated same-baseline execution is not counted repeatedly.

Full CP2 source gate sweep completed before this batch. Browser resource geometry/hit-target observations remain explicitly unexecuted in R3; no claim of complete CP4 or “last blocker” is made.

### Repair order / exact recheck / holds

1. Rebuild the resource Project/row/dialog-session state matrix for B01 and repair the local-origin boundary, keeping mutation-level shared effects intact.
2. Repair B02 lossless keyword editing, then B03 authoritative saved/index-start feedback in that same editor.
3. Add B04 keyboard/focus behavior in both dialogs, coordinating close callbacks with B01.
4. Add honest construction regressions and fix related comments/Evidence/API wording only where these findings change facts.
5. Stop again at **CP2** and submit B01–B04 mapping, exact files/symbols, search counts, numeric results, unexecuted cases and scope changes.

Focused recheck: original 14 failing cases first, then neighboring state/phrase/normalization/keyboard paths, all Stage B construction tests, P1D shared adapter/drawer, and CP1 predecessor cases touched by resource mounting. Typecheck/lint/whitespace and stage-relevant browser checks follow after blockers clear. Complete app/five-width dual-environment run remains CP4 final-candidate work; do not repeatedly run unrelated full suites while known P1s remain.

Preserve recommendation: valid mixed-ID acceptance; neutral unknown/inconsistent source labels; one Files query shared with P1D; all three mounted-consumer refresh cases; independent load/error truth; bare-array Knowledge boundary; only supported fields; no paid/real-user data access. These are advisory passing implementation areas; pause to explain necessity/alternatives/impact before expanding repairs into an unrelated accepted area. No production code was edited by Acceptance.

Frozen Plan, Acceptance reports/baselines and independent probes remain Construction-read-only. **No Stage C handoff, no message to idle pane 5, no commit/cutover permission.**

### Immutable ledger row

Cycle: R3 (CP2 review 1)
Checkpoint ID: CP2
Baseline: `Plan/V4_Phase_2B_acceptance_CP2_R1_baseline.json`
Verdict: FAIL
Cause owners: Construction 4, Acceptance 1, Harness 1 (shared H03), Spec 0, Environment 0, Unknown 0
Finding IDs: B01, B02, B03, B04; H03 corrected
Supersedes/amends: none; new approved CP2 checkpoint after CP1 PASS
Consecutive FAIL count: 1
Repeated invariant IDs: none within CP2
CP2 R1 baseline SHA256: `a0f5394221c7d49236d200b6a8791399d6e41d98d33972460b3c1665e16c8b44`.

## R4 — CP2 review 2 — FAIL / repair-readiness hold

Verdict: **FAIL**. CP2 consecutive FAIL count **2**; CP1 remains PASS; Stage C is NOT released.
Repeated invariants: **B01 twice, B02 twice**. The original B04 initial-focus/Escape cases pass, but the new pending-lock path introduces a B04 focus regression. **Second-failure early warning is active: stop assertion-by-assertion patching, reconstruct the state/path/timing matrix before another production edit.** This is not yet the three-FAIL escalation and does not require Alicia permission.
Baseline: `Plan/V4_Phase_2B_acceptance_CP2_R2_baseline.json` (hash below), HEAD unchanged. Frozen Plan hash unchanged; Acceptance artifact index/worktree equality checked. Repair delta stays in authorized source/tests/docs; separate `packages/app/upd_tests.py` remains untracked Builder scratch.
Gates: checked **15**, passed **12**, failed **3**, not checked **1**, same K01–K16 matrix (K09/B02, K12/B01, K13/B04 failed; K11/B03 now passed; K16 general resource browser geometry remains deferred).
Findings: new P0/P1 **0**, residual **2**, repair-regression **1**, harness-defect/process correction **1 H04**, acceptance-miss production **0**. No new product requirement is introduced.
Tests: original **26/26** independent probes ran FIRST and passed; after original-invariant sibling expansion the same suite is **29 unique / 26 passed / 3 failed / 0 errors / 0 skipped**. Do not add the first 26 again.
Browser: **1 targeted pending-focus scenario failed**, isolated production bundle/local mocked PATCH; `PENDING_FOCUS {inside:false,tag:'BODY',id:''}`. No real backend/provider accessed.
Static/build: typecheck/lint, current-candidate build, staged/unstaged whitespace checks **exit 0**. Build was run specifically to ensure browser evidence matches source. Full app regression **deferred** while these blockers remain; Builder's 606-test claim is not substituted for independent closure.
Unreviewed areas: **1** CP2 general browser resource geometry/hit-target sweep. The targeted B04 browser scenario above was independently executed; full five-width dual-environment remains CP4.

### B01 / P1 / residual — Project ID equality is not a retired-session lifetime

- **Observed:** start upload (and separately numeric delete) on A; navigate to cached B, then return to cached A before failure resolves. The retired request's `retired-origin-error（RETIRED）` appears in the new A visit. Original A→B tests now pass; A→B→A exposes the remaining lifetime gap.
- **Authority:** original B01 packet and §5.4: route change retires old dialog/feedback; §5.2 shared committed effects remain, obsolete local outcomes do not. Current equality of Project IDs does not revive an already-retired UI session.
- **Confirmed cause:** `ProjectFilesSection.tsx:56–64` clears local records on route change, but per-call callbacks `:74–94` later reinsert an error carrying only Project ID; display gates `:98–100` accept it when the route returns to A. Delete callback has the same pattern. Cache invalidation correctly retains submitted A; that part should remain.
- **Required outcome:** once a resource UI origin is retired, its late local status/error cannot reattach after an A→B→A return; confirmed/ambiguous shared effects still refresh A. Distinguish request identity, Project identity and UI-session lifetime.
- **Non-binding direction:** a genuine lifetime token/remount boundary or equivalent guard, not sample-specific A/B conditions. No mandated React key/effect design.
- **Siblings/recheck:** upload and numeric/kf_ delete, success/error/ambiguous results; A→B and A→B→A, close/reopen; current-live errors must remain visible. Knowledge session handling should be swept for the same lifetime invariant.
- **Chained effects/preserve:** preserve canonical dual invalidation and captured request pairs; recheck normal local feedback and newer-session behavior. Discuss before broadening into accepted CP1/global query owners.

### B02 / P1 / residual — append still destroys a valid existing keyword

- **Observed real UI action:** stored `['one,two','keep']`; use the shipped **追加** input/button to append `extra`; Save sends **`['one','two','keep','extra']`**, not `['one,two','keep','extra']`.
- **Authority:** original R3 B02 explicitly covers “editing a different keyword while existing phrases/separator-bearing values are present” and “intentional additions/removals without silently splitting existing entries.” No-op preservation alone was never the whole requirement.
- **Confirmed cause:** `ProjectKnowledgeSection.tsx:216–221` appends into a joined text string; submit `:187–213` re-parses the ENTIRE array via `projection.ts:126–141`. Comma-bearing atomic entries are destroyed whenever another keyword is changed/appended. Backend stores the list verbatim.
- **Required outcome:** preserve all untouched atomic entries during add/remove/edit of another entry, as well as no-op and abstract-only edits. A valid comma/space/semicolon inside an existing string is data, not permission to split that string.
- **Non-binding direction:** atomic per-entry editing, an escaped/lossless representation, or any equivalent behavior-complete approach is permitted. **No full-array text box, comma-only parser, selector, helper name or exact internal representation is frozen.**
- **Siblings/recheck:** add/remove/edit around existing delimiter-bearing entries, no-op, abstract-only, duplicate/empty handling only to the extent real backend-valid strings are represented; inspect actual body and refetched truth, not named sample probes.
- **Chained effects/preserve:** helper/form/test assumptions must match the invariant; normal phrase entry and supported-only fields remain. Existing “lossless join” and chip/removal comments contradict the shipped textbox and must be corrected with the final chosen mechanism. No backend contract change or new dependency is authorized.

### B04 / P1 / repair-regression — pending Knowledge write moves focus outside the modal

- **Observed:** real Chromium opens the Knowledge editor and initially focuses its abstract; submit a fixture PATCH and keep it pending. Every dialog control becomes disabled and active element becomes **BODY**, outside `role=dialog`. The independently rebuilt bundle produces `PENDING_FOCUS {inside:false,tag:'BODY',id:''}` before the fixture response is released.
- **Authority:** original B04 / §8.8 modal focus containment, including pending lifecycle. New safe-close policy cannot remove usable modal focus ownership.
- **Confirmed cause:** `ProjectKnowledgeSection.tsx` disables all focusable elements on pending (`lockInputs`, close/append/cancel/save). The existing shared helper effect depends on `opts.locked` (`dialogA11y.ts:77`), so toggling the new lock also runs its focus-restoration cleanup and recaptures focus; with zero enabled targets it cannot put focus back inside. This regression was introduced by opting the new editor into that lock pattern; the shared helper was not modified.
- **Required outcome:** pending editor retains a valid focus position inside and coherent Tab/Shift+Tab behavior; safe-close/duplicate-write policy stays truthful. After success/error, normal controls and trigger restoration still work. Do not alter close policy merely to satisfy a probe; several policies can satisfy the frozen lifetime/safety rules.
- **Non-binding direction:** keep a suitable modal focus target or avoid losing the original focus lifetime on lock transitions; first inspect the existing helper contract. A global helper rewrite is NOT pre-authorized. If a necessary fix touches it, supply dependency/impact/recheck scope before editing.
- **Siblings/recheck:** pending success, definite error, malformed response, route retirement, safe Escape and ordinary restoration; both resource dialogs. File confirmation currently closes before DELETE starts, so its claimed pending-dialog state is not actually reached—do not invent a requirement for that absent state.
- **Preserve recommendation:** original normal-open focus/Escape controls, B03 truthful `updated` consumption, body/identity capture and independent query refresh all pass.

### B03 closed / existing passed behavior retained

The backend `updated` array now owns the saved/index-start assertion. Normal abstract/keyword and trimmed-equal cases pass, and source matches `.strip()`/thread-start semantics. Original route-to-B, old-row error isolation, no-op sample/abstract-only, normal dialog focus/Escape and mounted Files/Knowledge/P1D refresh controls now pass. These passing subpaths do not waive the residuals above.

### H04 — Acceptance accountability: probe interactions are not architecture authority

Builder Evidence §4.1/§4.3 says an atomic/chip approach was replaced to match “the probes' full-array-replacement contract.” **That contract does not exist.** The authoritative contract is the frozen Plan plus original B02 required outcome. Acceptance's first probes used the then-shipped textbox to drive behavior; that interaction encoding was too easy to mistake for a mandatory UI shape and did not independently cover the already-reported add-around-existing-entry sibling. Acceptance owns that misleading harness/process pressure.

Correction on this SAME baseline: probes now explicitly document that selectors describe current UI, not frozen architecture; the actual shipped append path has been tested and its data loss established. **If a conforming editor changes to chips/per-entry fields/etc., Acceptance will adapt its own interaction harness to that UI. Construction must not weaken lossless behavior to satisfy an old selector or raw probe expectation.** No production change is required solely to keep an old test interaction compatible. This correction does not withdraw the real B02 defect and does not create an extra Builder FAIL cycle.

Before further editing, Construction must stop describing progress in terms of “the probe contract.” The first reply must restate: authoritative data representation, causal invariant, real add/remove/edit/no-op paths, Project/resource/session timing, and forbidden bypasses. This is the second-same-invariant early warning required by the acceptance workflow.

### Documentation / source-accountability cleanup (not extra product blockers)

- “React 19.2.6 keyed siblings duplicate during cached route change” is currently an **unverified diagnosis**, not a demonstrated framework constraint. Final source has no keys; no retained minimal reproduction/library evidence establishes the broad claim. Record the observation as uncertain or provide a minimal isolated construction reproduction; do not build compensating architecture around it. Either effect- or key-based correct lifetimes remain permitted.
- Several current comments still claim page-level keys/chip editor/trim-before-submit although current code uses effect lifetime/textbox/raw abstract. Align those comments with actual final implementation.
- `packages/app/upd_tests.py` remains untracked Builder scratch despite “temp removed” claims. Remove only Builder-owned obsolete scratch during repair cleanup or explicitly account for why it remains. Acceptance will not delete it for Construction.

### Repair-readiness hold / next action

**No further production edits yet.** First send a compact rebuilt state/path/timing matrix and invariant restatement covering:
1. request identity vs UI-session retirement, especially A→B→A;
2. preservation of existing atomic keyword values while another entry is added/removed/edited; chosen lossless interaction independent of probes;
3. initial/pending/settled/closed modal focus and whether shared-helper scope expansion is needed;
4. exact files, directly affected passing behavior, invalidated evidence and intended focused verification.

Acceptance will calibrate that repair route and explicitly authorize the scoped next attempt; no Alicia permission is needed for routine convergence. Do not silently change Plan or Acceptance files. If the next distinct CP2 baseline also FAILs, the mandatory **third-FAIL adviser escalation** applies (pause ordinary patch loop, durable diagnosis, user escalation as instructed).

Full app/five-width regression remains deferred. Stage C/pane 5 receives no message at this hold.

### Immutable ledger row

Cycle: R4 (CP2 review 2)
Checkpoint ID: CP2
Baseline: `Plan/V4_Phase_2B_acceptance_CP2_R2_baseline.json`
Verdict: FAIL
Cause owners: Construction 3, Acceptance 1, Harness 1 (shared H04), Spec 0, Environment 0, Unknown 0 for blocking findings
Finding IDs: B01 residual, B02 residual, B04 repair-regression; B03 closed; H04 corrected/process pressure acknowledged
Supersedes/amends: repairs R3 partially; R3 ledger retained
Consecutive FAIL count: 2
Repeated invariant IDs: B01=2, B02=2; B04 pending-focus regression after normal-focus repair
CP2 R2 baseline SHA256: `a984d7692de638e40fd6d03f27301229fb6bddd04271180009cd7ee3e1354602`.

## R4 repair-readiness disposition — RESUME AUTHORIZED (no new verdict)

Alicia relayed Builder's missing readiness message. Acceptance reviewed the submitted R/P/S matrix, array-native keyword proposal, pending-focus lifecycle and requested shared-helper scope. **The next scoped CP2 repair attempt is authorized subject to the calibrations below.** CP2 consecutive FAIL count remains **2**; no baseline verdict/reset is created by this disposition.

### 1. B01 lifetime route — approved with precise lifetime boundary

- Required outcome: request identity remains the submitted Project/resource; shared success/ambiguous-write invalidation survives UI retirement. Local completion belongs to a continuously active UI-origin visit/session, not merely the Project ID or section component instance.
- A mounted section may survive A→B→A. Each committed origin transition retires the previous lifetime irreversibly; returning to the same ID is a new lifetime. A monotonic token captured at request start and checked before local callbacks is an approved implementation direction, not the only allowed architecture.
- Normal file-confirm closes before the request begins; its ordinary live-section error must remain visible. Do not conflate closing that confirmation with retiring the entire resource visit. Conversely, actual route/unmount/session retirement must revoke obsolete local feedback.
- Test same-live-lifetime success/error controls alongside A→B, A→B→A, close/reopen and old Knowledge editor closure/reopening the same row. Do not rely solely on assertions that React silently ignores old setters; verify visible outcomes and unaffected shared effects.

### 2. B02 array-native editor — approved; no probe-imposed textbox

- Keep the stored string array as the editing source. Untouched entries must never traverse a delimiter join/split pipeline. Index-based removal is appropriate for distinguishing duplicate entries; abstract-only/no-op behavior remains unchanged.
- Chips/per-entry editing is explicitly allowed. Existing commas, spaces, semicolons, duplicate entries and represented empty strings must be preserved when another entry changes. The submitted array must match intentional operations, not an unrelated parser's normalization.
- **Input-semantics calibration:** parsing only a clearly labelled *batch-add input* is different from parsing existing entries and may be valid, but it must not make a single legal comma-bearing keyword impossible to express. No new batch feature is required. The simpler non-binding recommendation is one append action = one literal keyword; use another equally lossless interaction if preferable. Do not require a user to discover hidden delimiter escaping.
- If an entry has an edit action, that edit affects only that entry. If list management uses remove+add instead, those operations must remain unambiguous and lossless; no particular chip/widget structure is frozen.
- Acceptance owns adapting its tests to the new interaction. Builder must not reshape the editor back to the old full-array field or alter independent probes. Report changed interaction names/controls and behavior evidence; old-selector harness failures alone are not product failures.

### 3. B04 shared helper scope — narrowly approved

**Authorized production expansion:** `features/chat/dialogA11y.ts` may move live `locked` / `closeDisabledWhileLocked` option reads to a current-value reference, removing lock-only transitions from the focus-lifetime effect dependencies while retaining the current public API and existing open/close contract. The Knowledge editor may provide an explicit focusable dialog container/pending anchor and settled-success/error focus handling.

Required behavior:
- lock/unlock alone must not restore/re-capture the trigger or strand focus on BODY;
- Escape reads the current lock policy; lock/unlock cannot leave a stale listener or duplicate close;
- pending focus remains in the modal even when normal inputs/actions are disabled; Tab/Shift+Tab remain coherent;
- normal dismissal restores the genuine available trigger; detached-route triggers must not interfere with a newer origin;
- preserve existing no-opts consumers and BranchConfirmModal locked behavior.

**Source-corrected impact count: 8 actual call sites**, not 9:
1. KnowledgeEditDialog (ProjectKnowledgeSection)
2. ProjectFilesSection delete confirmation
3. ProjectFormDialog
4. ProjectFilesDrawer
5. ImageLightbox
6. TacticalHud
7. BranchConfirmModal
8. TruncateConfirmModal

`CreateConversationDialog` has its OWN inline a11y effect, not a call to this helper. Keep it in the general P1A/P2A regression set, but do not edit it as a helper consumer.

**Important limit on the proposal's claim:** retaining `[isOpen, onClose]` does not mean cleanup occurs only on true closure. Four existing ConversationPage consumers receive inline onClose callbacks, so callback identity changes can still re-run the effect. That is pre-existing behavior; this authorization addresses lock-triggered re-entry, not a global modal lifecycle rewrite. Verify no regression on callback rerender/lock transitions; do not broaden to all callers, portal design, focus manager or onClose API changes without reporting a concrete dependency.

File-delete confirmation's close-before-request design remains allowed; remove only misleading unreachable pending-dialog claims/unused local lock wiring if appropriate. Do not add an artificial pending confirmation to satisfy a nonexistent requirement.

### 4. File/evidence scope and next verification

Allowed current repair files: `ProjectFilesSection.tsx`, `ProjectKnowledgeSection.tsx`, `projection.ts`; minimal related Project-only CSS/coordination if the chosen editor requires it; narrowly authorized `chat/dialogA11y.ts`; construction tests for the new behavior and shared-helper consumers; the single Construction Evidence record; exact B02/B03 ReactSheet wording only if affected. Remove Builder-owned `packages/app/upd_tests.py` scratch. Correct unsupported keyed-React diagnosis to an unconfirmed observation and align stale comments with actual final source.

Passing behavior to preserve: D3 mixed-ID/source-neutral display, canonical file/key owners, P1D read-only behavior, all three mounted-consumer refresh paths, B03 authoritative `updated` claims, F01 submitted variables, accepted CP1 route/lens/Hub/local isolation. Source/query/backend/ownership boundaries otherwise unchanged.

Verification order: construction's original failing invariants + full state/path matrix first; atomic add/remove/edit/no-op keyword cases (not just former samples); pending-focus tests including real-browser reproduction; all 8 helper consumers with particular attention to Branch locked transitions and the 4 unstable-onClose callers; P1A/P1D/P2A/P2B focused regression; then complete app suite/static checks on the repaired candidate. This broader full-app regression is justified by the explicitly approved shared-helper impact, not repeated while known blockers remain. CP4 still owns the full dev/production five-width screenshot matrix.

Stop at **CP2** again with required-outcome mapping, exact changed interfaces/files, numeric evidence, omissions and scope deviations. No Stage C handoff/commit/real-data/backend writes are authorized. If the next distinct CP2 candidate fails, apply the previously recorded third-FAIL adviser escalation.
## R5 entry — scope-deviation clarification hold (NOT a verdict)

Ownership/source entry check: frozen Plan unchanged; current Acceptance probe/report worktree equals its index. CP2 R4 candidate includes two edits beyond the explicitly allowed production file boundary: `chat/BranchConfirmModal.tsx` (lock-transition cancel focus) and `styles/shell.css` (global `.app-dialog:focus { outline:none }`). The last authorization listed Project-only CSS and the narrow shared helper; preserving an affected consumer was not blanket authorization to edit it. Construction Evidence §5.3 discloses the changes after editing, without a prior expansion disposition.

Under independent-acceptance §6, pause substantive recheck and further production edits until Construction supplies necessity, alternatives, exact impact and invalidated-evidence analysis, and Acceptance records a scope disposition. Preserve all diffs; no automatic revert or product FAIL. Request exact test evidence for the claimed Branch locked transitions / callback rerenders: a broad suite result does not independently prove those transitions were asserted.

Three stale-editor selector failures are expected H04 harness adaptation work, NOT three product defects or a new FAIL cycle. Acceptance retains ownership of adaptation after this scope hold is resolved. CP2 consecutive FAIL count remains **2**. No R5 verdict or Stage C release has been issued.
## R5 scope disposition — RESUME AUTHORIZED for bounded scope normalization

Builder supplied the requested A/B/C necessity, alternatives, impact and missing-evidence analysis. The scope-clarification hold is resolved with the conditions below. **This is not a CP2 verdict; consecutive FAIL count remains 2.** No prior unauthorized expansion is retroactively described as pre-authorized.

### A. BranchConfirmModal — retain the minimal anchor, now explicitly authorized

The dependency on the changed shared-helper lock lifecycle is credible and the caller-local cancel-button anchor is an appropriately bounded preservation measure. Authorize retaining/refining only this lock-transition anchor in `features/chat/BranchConfirmModal.tsx`, preserving existing cancel/Escape/duplicate-submit/ambiguous-write semantics and the helper API. Do not generalize to a focus framework or other caller edits.

Evidence calibration: Branch's actual browser lock-transition outcome is still **unverified**. The prior Knowledge browser result establishes that disabling the focused control can strand focus, not that every Branch production path inevitably does so. Source reasoning supports the bounded repair direction; it does not substitute for the required real-entry browser check or prove alternative implementations impossible.

Recheck: confirmed focused -> real pending/locked state -> in-dialog usable focus; live Escape policy; no duplicate POST; normal settlement/dismissal/available-trigger restoration; durable ambiguous-lock behavior. Retain current DOM/action policy instead of inventing a new close contract.

### B. shell.css — remove the added global suppression, no replacement suppression

Authorize deleting **only the five lines introduced by this repair** for global `.app-dialog:focus { outline:none }` in `styles/shell.css`, preserving every predecessor/sibling change. Do not reset/restore the whole shared file. No demonstrated technical need supports this global visual change.

Do not replace it with a Project-local outline suppression just because a browser displays a ring. **A visible focus ring is not a defect, and “no visible full-dialog ring” is not a frozen acceptance criterion.** The current functional requirement is coherent visible/contained keyboard focus, not hiding its indicator. Leave browser/default styling intact; any later genuine visual issue must have its own evidence and CP4 scope disposition.

### C. Construction tests and evidence — explicitly authorized, bounded

- Add Branch locked-transition focus assertion, current Escape-lock behavior and ordinary restoration to construction tests; do not claim jsdom models Chromium's native disabled-focus behavior.
- Cover callback-identity rerenders for each of the four actual inline-onClose consumers (Branch, Truncate, TacticalHud, ProjectFilesDrawer), individually or parametrized. Verify containment, functional Escape according to the current lock policy and eventual restoration. A single representative case must not be reported as all four covered.
- Preserve the current Knowledge initial/pending/success/error focus assertions; report browser coverage separately.
- Correct Construction Evidence §5.3's false transition-coverage claim explicitly; retain correction history rather than implying the old run had those assertions. Supply actual test names/assertions and fresh numeric results. The remaining no-opts consumers keep their ordinary modal regressions.
- Scope is limited to the authorized Branch anchor, removal of the added shell.css rule, relevant construction tests, and the single Construction Evidence record. Previously authorized Project/helper repairs remain preserved. Any new dependency requires another concrete scope discussion before editing.

After normalization and focused checks, stop at CP2 and send the delivery directly to pane 3 with get/send/get/submit/get verification; writing a local response alone is not delivery. No acknowledgement-only message is needed.

Acceptance will then pin the normalized candidate, adapt the three obsolete keyword UI interactions without weakening assertions, rerun the original failing behaviors and browser pending-focus reproduction, inspect sibling paths and run the required full regression if no blocker remains. Existing selector failures are H04 harness maintenance, not product FAILs. No Stage C or pane 5 intervention yet.
## R5 independent recheck progress — original failures and full suite green; verdict pending

Pinned normalized candidate: `Plan/V4_Phase_2B_acceptance_CP2_R3_baseline.json`. Entry scope checks found no remaining unauthorized delta; frozen Plan unchanged and Acceptance worktree/index matched before owner adaptation.

H04 adaptation: changed only the three obsolete keyword interactions to the shipped literal-add/index-remove controls; expected PATCH bodies and data-preservation assertions are unchanged. This is Acceptance-owned harness maintenance, not Construction rework or a FAIL cycle.

Independent execution:
- CP2 original+sibling probes: **29/29**, 0 failures/errors/skips.
- Rebuilt current bundle: exit 0.
- Real Chromium Knowledge pending-focus reproduction: **1/1**, activeElement DIV inside dialog (`inside:true`), local mocked PATCH only.
- Complete exo-app regression: **56 files / 621 tests passed**, 0 failures/errors/skips; includes the 29 independent cases (not additive).
- typecheck/lint/staged+unstaged whitespace checks: exit 0. Build warnings and LF/CRLF advisories remain non-fatal.

No CP2 verdict is issued by this progress entry. Outstanding before formal disposition: independent real-entry Branch pending-focus/browser lifecycle verification, remaining CP2 resource browser observations and final chained source/gate sweep. CP4 still owns full five-width dual-environment visual evidence. CP2 FAIL counter remains 2 until a final PASS; Stage C not released. No Builder message is sent merely for this progress update.
## R5 — CP2 review 3 — PASS

**Verdict: PASS. CP2 consecutive FAIL count resets from 2 to 0. CP1 remains PASS. Stage C is released to the user-assigned pane 5 Sol; Stage D awaits CP3.**

Baseline: `Plan/V4_Phase_2B_acceptance_CP2_R3_baseline.json`, HEAD `b1178fb1`. Final source audit found 0 production/construction-test pin drift; only owner-maintained probes/report/browser evidence changed after pinning. Frozen Plan hash remains `4a93360627b1cde95e2bcac1c51c207ddf664309d184c0e14f332dcbbeb64082`. No Builder edits to frozen acceptance assets observed. Approved Branch scope normalization and shell rule removal verified.

Gates: **16 checked / 16 passed / 0 failed / 0 not checked** for CP2's stage-specific gate matrix. Findings: new product 0, residual 0, repair-regression 0; B01/B02/B04 closed, B03 remains closed. H04 interaction maintenance completed; H05/H06 owner browser-harness corrections recorded below. Unreviewed CP2 areas: **0**. The complete CP4 five-width dev/production screenshot matrix remains explicitly outside this checkpoint.

### Evidence by gate

- K01 ownership/scope: frozen hashes and staged owner assets intact, all current production delta fits the recorded authorizations, no backend/V3/provider/dependency edits. No Stage C production surface exposed early.
- K02 canonical owners: single shared Files family (P1D + Project), one Project Knowledge family, global Conversation collection unchanged.
- K03–K05 mixed numeric/kf_ IDs, neutral inconsistent-source labels, explicit malformed/error states and P1D read-only reuse: independent probes and source sweep pass.
- K06–K07 upload/numeric-delete/synced-delete: origin-bound dual invalidation, both mounted views plus P1D consumer update; HTTP ID/multipart/204 contracts verified by probes and adapter sweep.
- K08–K10 Knowledge bare-array/allowed-write fields, atomic keyword preservation and refetched truth: 29-case owner suite includes add-around-comma-entry, no-op, abstract-only, phrase and expected body controls. Source has no join/split pipeline; duplicates/index removal and literal-add are construction-regression covered.
- K11 B03: index-start assertion derives from backend `updated`; trimmed-equal `updated:[]` does not claim an index task.
- K12 B01: old local outcomes retire through A→B and A→B→A; same-live feedback persists; captured request identity continues to own shared cache effects. Original late-upload/delete and close/reopen controls pass.
- K13 B04: normal resource focus/Escape/trigger restoration and native Knowledge pending containment pass. Native Branch pending success and ambiguous-result flows both show active enabled **取消** inside the modal; locked Escape suppressed; duplicate POST blocked. Normal available-trigger dismissal restores focus; confirmed success navigates once to canonical conversation 111; malformed success preserves the durable lock after cancellation (disabled triggers are intentionally unavailable). Construction tests additionally exercise all four callback-identity consumers and Branch's isolated stable-callback lock anchor.
- K14 forbidden controls/provider safety: no unsupported Open/Download/Knowledge create/delete surfaces; all acceptance writes target isolated local fixtures. Real DB baseline read-only check remains 8 rows, IDs 1–8.
- K15 consumed ReactSheet Project/Files/Knowledge contract text matches adapters. Adjacent historical branch wording is not broadened into CP2 scope.
- K16 stage-relevant browser resource observations: 390/1280 production bundle, Files/Knowledge mounted, delete/editor dialogs, native hit testing, containment/restoration, and document horizontal fit: **6 observations passed**. Full 320/390/767/768/1280 × dev/production screenshots remain CP4, not claimed here.

### Numeric evidence (unique, no repeated counts)

- Complete exo-app suite: **56 files / 621 tests executed, 621 passed, 0 failed/errors/skipped**. Includes **29** independent CP2 cases; do not add them again.
- Knowledge native pending-focus probe: **1 passed scenario**, `inside:true`, active DIV anchor.
- Final native browser resource+Branch probe: **8 passed observations** (6 resource/dialog geometry/hit/focus + 2 Branch success/ambiguous). Both Branch pending logs: `{tag:'BUTTON',text:'取消',disabled:false,inside:true}`. Local mock traffic only, 30 requests, 2 isolated Branch POSTs.
- Current-candidate build, final lint, typecheck, unstaged/staged whitespace checks: **exit 0**. Build chunk/deprecation and Git line-ending advisories are non-fatal.
- No production changed between the full-suite run and final browser/static checks. Only the independent browser harness was introduced/corrected; no need to inflate counts by rerunning unrelated suites for a dead mock-branch cleanup.

### Acceptance-owned harness corrections, same candidate (not Builder FAILs)

- **H04:** obsolete full-textbox selectors replaced with shipped literal-add/remove actions; original request-body/data-preservation assertions retained.
- **H05:** first Branch ambiguous-cancel probe required focus restoration to an original trigger that is intentionally disabled by the durable uncertain lease. Source proved the required *available-trigger* precondition false. Corrected same baseline: separately verify ordinary close restores an enabled trigger, and ambiguous cancellation keeps unavailable trigger disabled/lease intact. No production change or scope expansion requested.
- **H06:** sampling immediately after disabled/HTTP-start observations raced React's passive focus effect; one run still had in-dialog focus but not yet the chosen cancel anchor. Final browser probe samples after two animation frames, retaining the native enabled-target/containment checks; both real Branch paths pass. A duplicated already-covered mock route also caused a harness-only lint error; removed the unreachable branch and reran static checks successfully.

### Immutable ledger row

Cycle: R5 (CP2 review 3; includes scope normalization before verdict)
Checkpoint ID: CP2
Baseline: `Plan/V4_Phase_2B_acceptance_CP2_R3_baseline.json`
Verdict: PASS
Cause owners: Construction 0 open, Acceptance/Harness H04–H06 closed, Spec 0, Environment 0, Unknown 0 blocking
Finding IDs: B01/B02/B04 closed; B03 remains closed
Supersedes/amends: closes R4 residuals; prior FAIL rows retained
Consecutive FAIL count: 0 (reset by final CP2 PASS)
Repeated invariant IDs: B01/B02 historical repeats 2, now closed

### Stage C release condition

User-assigned pane 5 Sol may begin the frozen Plan §7 Stage C **serially**: fixed-Project canonical creation and Home/Agent/Project compatibility first; only after those checks pass, preview-gated Project archival deletion/recovery choices and required cache side effects. CP3 is the next mandatory hold. Accepted CP1/CP2 implementation is a preserve recommendation, not a frozen edit ban: necessary expansion requires prior dependency/impact discussion. Frozen Plan/probes/reports remain Acceptance-owned and immutable to Construction. No backend/real-data destructive test, commit or Stage D release is granted by this handoff.
## R6 — CP3 review 1 — FAIL

Verdict: **FAIL**. Phase/checkpoint: CP3 (Stage C). Consecutive FAIL count **1**; this is the first CP3 baseline, not a continuation of the closed CP2 counter. CP1/CP2 remain PASS. Stage D is not released.

Baseline: `Plan/V4_Phase_2B_acceptance_CP3_R1_baseline.json`; HEAD `b1178fb1`, frozen Plan hash unchanged (`4a933606…eb64082`). Entry comparison: 188 CP2 pins, 11 expected changes, 0 missing; independent assets index==worktree before owner probe authoring. Stage C production/tests/docs stay within handed-off scope.

Gates: **11 checked / 10 passed / 1 failed / 1 not checked**:
C01 ownership/scope; C02 canonical three-mode creation; C03 late-origin creation/deletion; C04 guarded preview identity; C05 fresh per-open/replacement session; **C06 latest-preview destructive eligibility FAIL**; C07 explicit numeric-only recovery body; C08 pending duplicate/Escape/local focus; C09 affected-cache stale before navigation; C10 error/rollback truth and no auto-retry; C11 consumed docs; C12 native CP3 browser lifetime/layout **not checked**. Native checks are deferred during the known destructive-safety blocker, not claimed from jsdom.

Findings: new **1 P1**, residual 0, repair-regression 0, harness-defect **1 corrected H07**, acceptance-miss 0. Unreviewed: **1**, C12 CP3 native browser observations. Full app regression **deferred** while C01 below blocks acceptance. No real destructive backend call or provider operation executed.

Tests: independent CP3 **18 executed / 14 passed / 4 failed / 0 errors / 0 skipped**; four runtime cases expose ONE invariant violation, not four separate defects. Relevant predecessor/construction regression **5 files / 75 passed / 0 failures/errors/skips**, including CP1/CP2 probes and canonical Home/Agent/Project creation checks. Total distinct tests executed in these final runs **93 / 89 passed / 4 failed** (not including superseded harness runs). Typecheck/lint and staged/unstaged whitespace checks **exit 0**.

### C01 / P1 / new — Failed latest preview still authorizes irreversible Project DELETE

**Observed evidence:**
1. Open Project archive-delete confirmation and obtain a valid preview.
2. Choose a file, then request a replacement preview.
3. The replacement returns HTTP 503, or a malformed 2xx payload.
4. UI visibly says current preview cannot be fetched and offers retry, but **确认归档并删除 is enabled**.
5. Clicking it emits a real fixture `DELETE /api/core/projects/31/` based on retained old preview data.

The same two failure variants reproduce through a query-driven background replacement, not only the manual refresh button. All four cases assert both disabled eligibility and **zero DELETE requests**; both checks fail. Initial-preview failures, successful replacement resets, late prior-session previews and retry-success recovery controls pass.

**Authority / violated invariant:** frozen D7 explicitly forbids using an older snapshot to authorize deletion after a failed preview; §6.5 requires a current successful preview before confirmation; §8.7 limits recovery IDs and destructive confirmation to the current successful confirmation session. This is an original-contract defect, not a new preview-cache architecture requirement.

**Confirmed root cause:** TanStack retains the last successful `data` when a refetch fails. The failed query has `isError=true`, but retains `data` and is no longer fetching. In `ProjectDeleteDialog.tsx`, `previewBusy` only combines pending/fetching; the confirmation button disables for `previewBusy || !data || locked`; `confirmDelete` likewise checks only data presence/fetching/mutation pending. Neither destructive entry gate rejects the failed-current-preview state. The error branch hides the rows but not the action row, so stale data can still authorize DELETE. Manual retry clears selections; background refetch can also retain hidden selected IDs. Both paths must be safe regardless of that difference.

**Required outcome:**
- A pending, failed or malformed **latest** preview cannot authorize a DELETE, even if the cache retains an older successful payload.
- Rendered button eligibility and the action-handler eligibility agree; programmatic/repeated invocation cannot bypass the state gate.
- Recovery choices are derived only from the current successful preview; failed attempts do not silently reuse hidden prior selections.
- After a new successful retry, normal confirmation resumes with fresh unselected recovery choices. Preserve explicit `keep_file_ids: []`, no auto-retry DELETE, and captured Project identity.

**Affected sibling paths / verification:** initial failure; manual replacement HTTP error/malformed 2xx; same-key automatic/query-driven refetch failure; repeated retry failure; pending retry; successful recovery with same/different file rows; fresh reopen while an old preview resolves. Include actual DELETE-count assertions, not only banner/button appearance. Query caching may keep old display data; retaining cache data itself is not forbidden, using it as destructive authorization is.

**Non-binding repair direction:** derive destructive eligibility from authoritative current-preview validity/status rather than merely non-null `data`, and use the same rule for UI and submit. A small local correction is likely sufficient. No cancellation framework, global cache purge, new lifecycle framework or duplicated adapter needed.

**Chained effects / preserve recommendations:** preserve per-open query isolation, numeric uniqueness guard, successful replacement resets, selected-body ordering/explicit empty array, origin-bound invalidation and guarded navigation, rollback warnings, all three accepted creation modes, CP1/CP2 behavior. Current evidence: 14 independent controls + 75 predecessor/construction cases pass. Cache stale-mark tests include source tree levels, direct cached conversation discovery outside the collection, affected cache controls and unrelated-Project preservation.

**Scope escalation trigger:** any required modification to accepted shared create/helper/runtime owners or frozen contracts requires prior necessity/alternatives/impact discussion. No reason for such an expansion is currently established.

### H07 — corrected independent fixture assumptions (Acceptance-owned)

Initial harness run mis-parameterized array-valued test cases and supplied an incorrect canonical init fixture/type: `superior` instead of frontend `g045`, and a flat init response rather than `{data:{conversation_id,session_name}}`; expected body also omitted existing `thinking_level:'auto'`. Corrected these against live canonical source on the SAME baseline before judging Construction. No product change requested for these assumptions; no extra FAIL cycle. Final 18-case result above excludes these invalid failures.

### Repair authorization / next handoff

**RESUME AUTHORIZED for the scoped C01 repair**, under Alicia's ongoing delegated construction authorization. Pane 5 may directly repair `ProjectDeleteDialog.tsx` and directly related Project preview-query code only if necessary, add construction tests for the state/failure matrix, and append the single Construction Evidence record. No extra human permission or separate readiness hold is needed for this first CP3 failure. Do not modify Acceptance probes/reports/Plan, backend, real data, shared helper or unrelated creation/runtime owners.

Order: root preview-validity gate -> all real failure/retry entry paths -> discriminating construction evidence -> focused validation -> independent CP3 recheck. Defer unrelated full-suite repetition while the known blocker remains; native browser/full required regression will be run on the repaired candidate. Stop again at CP3 and send factual finding mapping/files/searches/numbers/unexecuted items directly to pane 3 with receipt confirmation. Stage D stays gated.

### Immutable ledger row
Cycle: R6 (CP3 review 1)
Checkpoint ID: CP3
Baseline: `Plan/V4_Phase_2B_acceptance_CP3_R1_baseline.json`
Verdict: FAIL
Cause owners: Construction 1, Acceptance/Harness 1 corrected H07, Spec 0, Environment 0, Unknown 0 blocking
Finding IDs: C01 new/P1; H07 harness-defect corrected
Supersedes/amends: new approved checkpoint after CP2 PASS; CP2 history retained
Consecutive FAIL count: 1
Repeated invariant IDs: C01=1
## R7 — CP3 review 2 — PASS

**Verdict: PASS. C01 closed. CP3 consecutive FAIL count resets 1→0. CP1/CP2 remain PASS; Stage D released to the user-assigned pane 4 Ecki, CP4 mandatory hold.**

Baseline: `Plan/V4_Phase_2B_acceptance_CP3_R2_baseline.json`, frozen Plan `4a933606…eb64082`. Entry audit: 224 prior pins, 220 unchanged, 4 changed, 0 missing — only ProjectDeleteDialog, its construction tests, single Construction Evidence and owner report changed. No frozen-asset interference or unapproved expansion. R2 pins include the previously post-pin CP3 probe.

**Ledger label correction (Acceptance-owned):** R6 prose carried forward `b1178fb1`; the actual CP3_R1/R2 pinned HEAD is **0079a86ed894854df452e4244c78b46d697e0a2d**, matching current HEAD and the user-authored docs-only advance recorded in Construction Evidence §8.4. Frozen Plan/runtime identity did not change during C01 repair. The JSON baseline was correct; amend the prose label here without deleting history.

Gates: **12 checked / 12 passed / 0 failed / 0 not checked** for CP3 scope. Product findings: new 0, residual 0, repair-regression 0; C01 closed. H08 native-harness warm-up correction completed below. Unreviewed CP3 areas **0**. Complete product dev/production five-width visual acceptance remains CP4, not claimed by this stage signoff.

### Closure evidence

- C01 ownership and scope: hashes, declared-only repair and Acceptance index/worktree verification pass; no backend/shared-helper/runtime/create/contract edit during repair.
- C02–C03 canonical creation compatibility and stale-origin behavior: independent standard/g045 fixed-Project request-body cases, Home/Agent predecessor tests, source-origin chain and complete regression pass. Native fixed-Project opening has no Drift selector, focus enters and ordinary Escape restores the real trigger.
- C04–C05 preview identity/per-open freshness: initial malformed/nonnumeric/duplicate IDs block confirmation, older session responses cannot authorize a newer dialog, replacement success/reopen reset recovery choices.
- **C06 / finding C01:** `hasCurrentPreview` now requires data AND no pending/fetching/error. Both action handler and button use the same predicate. Latest-preview errors clear hidden recovery choices; cached historical data is not destructive authority. Original manual+background failed/malformed cases all pass; successful retry resumes unselected.
- C07 explicit numeric recovery body: subset/order/empty array verified; native retry-success submits `keep_file_ids:[]`.
- C08 pending safety: native 390/1280 deletion anchors inside the dialog with all actions locked; Tab/Shift+Tab stay inside, Escape suppressed, repeated confirmation never duplicates the request.
- C09 success side effects: independent staleness-before-local-success checks cover Projects/Conversations/source detail/files/Knowledge/tree root/levels/path, list-derived and directly cached affected Conversations plus cache controls, while unrelated Project remains untouched. Late old success refreshes shared truth without navigating a new origin. Native confirmed 204 navigates to `/app/projects`.
- C10 errors: 409 `file_rollback_failed` visibly warns to inspect server files/logs; keeps the dialog/project, no automatic DELETE retry. Native manually initiated retry can succeed; no rollback promise is fabricated.
- C11 docs: frozen consumed contract and Stage C ReactSheet/evidence remain aligned; no new doc churn needed for this local repair.
- C12 native stage observations: **12 passed** (6 each at 390 and 1280: fixed create, archive preview, failed latest-preview block, pending containment/duplicate suppression, rollback warning, successful Hub navigation). **4 DELETEs, all isolated local HTTP fixtures** (first409/manual retry204 per width), no real destructive call.

### Numeric pipeline (unique counts)

- Original independent CP3 suite: **18/18 passed**, no failures/errors/skips.
- Complete exo-app regression: **58 files / 652 executed / 652 passed / 0 failures/errors/skips**, includes the 18 cases (not additive).
- Fresh build, explicit final typecheck/lint, staged/unstaged whitespace checks: exit0. The runner initially misread slash-separated prose as a nonexistent literal script `build/typecheck/lint`; that command failed without running product checks. It then ran the actual separate scripts; final typecheck/lint were independently repeated explicitly after the browser harness. Do not describe the literal typo as a product failure or all command invocations as successful.
- Native browser: **12 observations passed**, 2 widths, local production-bundle fixture; no external providers. Real AgentPreset closing check: 8 rows / IDs1–8.

### H08 — first-install service worker reload raced the native harness (Acceptance/environment)

The initial native harness entered the delete workflow immediately in a fresh Chrome profile. Existing production SW installation/activation invokes the existing main.tsx reload handlers, so the initial page reloaded during preview retry and destroyed its dialog. Source sweep found no preview-driven close/reload path. Runtime confirmation after warm-up: `PWA_READY {navigation:'reload', controller:'http://127.0.0.1:5198/app/sw.js'}`.

Correction: wait for the real PWA's initial controlled state/reload to settle BEFORE the tested user workflow; retain the real SW and production bundle, do not disable/change product behavior. The same candidate then passes all12 observations. This is a first-install harness precondition, not C01 regression. No SW/runtime production change or new product requirement is authorized; fresh-install/update interruption itself is not claimed as tested by these steady-state dialog checks.

### Immutable ledger row
Cycle: R7 (CP3 review 2)
Checkpoint ID: CP3
Baseline: `Plan/V4_Phase_2B_acceptance_CP3_R2_baseline.json`
Verdict: PASS
Cause owners: Construction0 open; Acceptance/Environment H08 corrected; Spec0; Unknown0 blocking
Finding IDs: C01 closed; H08 corrected
Supersedes/amends: closes R6 C01, corrects R6 prose HEAD label; prior failed runtime evidence retained
Consecutive FAIL count: 0
Repeated invariant IDs: C01 historical1, closed

### Stage D release

Pane4 may perform frozen Plan §7 StageD: final-candidate Project-owned responsive/focus/keyboard/scroll/action corrections, exact consumed API-document wording, single Evidence matrix/scope scan, complete app and dev/production 320/390/767/768/1280 browser verification. StageC/CP1/CP2 accepted behavior is preserved unless a concrete dependency is discussed before scope expansion. Freeze Plan and Acceptance assets remain immutable to Construction. No new C2 scope, next P2 slice, backend/real-data destruction, commit or production cutover is implied. Final CP4 independent signoff remains required.
## R8 — CP4 review 1 — FAIL

**Verdict: FAIL. CP4 consecutive FAIL count 1.** No P2B final release, commit or cutover. Stage D introduced no production delta; the two functional findings below existed in the accepted predecessor source and were exposed by the expanded final browser sweep. Do not describe them as new Stage D regressions.

Baseline: `Plan/V4_Phase_2B_acceptance_CP4_R1_baseline.json`, HEAD0079a86, frozen Plan hash4a933606…eb64082. Stage-D entry: 236 predecessor pins, only Evidence§9 and owner R7 report differed; no source/test drift. Later 239/239 CP4 pins still match, BUT the unpinned dependency manifests/lockfile changed externally after the successful build/matrix; see E01. Selected-source pin equality does not establish equality of the whole current checkout/environment.

CP4 gate groups: **9 checked / 6 passed / 3 failed / 0 not checked**. G01 declared Builder scope/owner assets PASS; G02 functional CP1–3 regression against entry baseline PASS; G03 five widths/two environments/document geometry PASS; **G04 keyword wrapping/action visibility FAIL D02**; **G05 modal keyboard containment FAIL D01**; G06 canonical/API/source sweep PASS; G07 external-side-effect isolation/DB baseline PASS; **G08 current-checkout quality pipeline FAIL E01**; G09 evidence/stop/commit boundaries PASS. These are checkpoint grouping counts, not a claim that each group is one Plan checkbox.

Findings: new Stage-D production0, residual0, repair-regression0, **acceptance-miss2** (D01,D02); operational external baseline/dependency blocker1 (E01, editor unknown). The earlier narrower native checks and Construction's 60 screenshots did not exercise these complete cases. Acceptance owns its earlier coverage gap. CP1–3 functional/cache/write evidence remains preserved; blanket keyboard/wrap coverage claims are narrowed by this evidence.

### Numeric evidence / chronology

- Before dependency drift: fresh full suite **58 files/652 passed**, 0 failures/errors/skips; fresh typecheck/lint/build and staged/unstaged whitespace checks exit0. Production bundle built at02:11; those results are valid for that dependency state, NOT a fresh success claim for the later current checkout.
- Independent CP4 native matrix at02:14–02:15: **1750 checks / 1588 passed / 162 failed**, **80 observations/screenshots**, all5 widths × real Vite dev + controlled production PWA. All162 failing checks are Tab/ShiftTab containment in `fixed-create`; they represent one defect, not162 defects. APIs intercepted before any Vite proxy/backend; GET-only fixtures. Every other matrix check passed.
- Screenshot/source sibling review exposed D02; independent targeted native measurement against the unchanged built Project source: **2 widths checked / 0 passed / 2 failed** (320,1280), text width1576.30px in chips250/502px wide; remove button lies outside the modal body in both cases. Artifacts: `Plan/.p2b-acceptance-shots/cp4-keyword/observations.json`.
- Later static check: lint passed; **typecheck failed TS2307 `rehype-katex`**, due post-freeze manifest/installation changes. Subsequent full current-tree regression is deferred until E01 is resolved. No real DB writes/provider calls or destructive operations occurred.

### D01 / P1 / acceptance-miss — canonical fixed-Project creation lets keyboard focus escape

**Observed:** Project Detail → 开始会话 → native Tab or ShiftTab reaches background page controls while `aria-modal=true` dialog remains open. Reproduced all10 env/width combinations (320/390/767/768/1280, dev+prod). Entry focus, ordinary Escape and trigger restoration pass; boundary containment fails.

**Authority:** frozen §8.8 requires Project dialogs to establish, trap and restore focus according to established patterns. This is not a requirement for all unrelated pages to receive new visual design work.

**Confirmed root cause:** `features/chat/CreateConversationDialog.tsx` inline a11y effect handles initial focus, Escape and restore ONLY; there is no Tab handler, helper/global/inert trap elsewhere. The canonical Home, fixed-Agent and fixed-Project modes share this component. `ProjectFormDialog` (新建项目) is a DIFFERENT component and passes; Construction's edit-only Tab sweep did not cover the affected creation dialog.

**Required outcome:** while the canonical creation modal is open, forward/backward Tab wraps across currently usable dialog controls without reaching background controls, including dynamically displayed g045 permissions and pending/ambiguous submit states. Preserve current name-field initial focus, available-trigger restoration, safe Escape/close, input/error state and submit-origin semantics.

**Important preserve condition:** creation currently permits closing/Escape during pending or ambiguous result while suppressing obsolete local completion; terminal lock applies to submit, NOT to closing. Do not copy the destructive Project-delete close-lock policy here.

**Non-binding direction:** use the existing modal helper with equivalent existing close policy, or minimally complete the inline key handler. No particular helper/class placement is required. Shared helper implementation changes are not needed/authorized by this packet.

**Explicit dependency/scope authorization:** to repair this frozen Project integration gate, pane4 may narrowly edit `features/chat/CreateConversationDialog.tsx` for focus containment, plus directly relevant construction tests and the single Evidence record. This is an intentional, pre-edit expansion beyond Project-only CSS. Do NOT edit mutation/schema/identity refs/payloads/call sites/runtime/other shared dialogs. Recheck Home selectable, Agent fixed, Project fixed and g045 dynamic permissions, ordinary/pending/ambiguous close behavior; existing origin/write locks must stay intact. If that cannot be achieved within this boundary, report the concrete dependency before broader edits.

### D02 / P1 / acceptance-miss — long atomic keyword does not wrap and hides its remove action

**Observed:** `prod-320-knowledge-edit.png` visibly has a long single keyword running out of the editor body with its remove button off-screen. Native measurements on the pinned bundle:
- 320: chip250px, text1576.30px, remove-right1637.30px vs body-right303px, removeVisible=false.
- 1280: chip502px, text1576.30px, remove-right1991.30px vs body-right909px, removeVisible=false.
Both report computed whiteSpace `nowrap`. Arbitrary long strings are legitimate existing keyword data; no mutation was used to fabricate a backend restriction.

**Authority:** §8.8 explicitly requires keywords to wrap and long content not to hide actions. Internal horizontal scrolling alone is NOT a blocker (the filter row may scroll); the defect is missing required wrapping and a concealed remove control, not an aesthetic aversion to scrollbars.

**Confirmed root cause:** `<li className="app-chip project-keyword-chip">` inherits `.app-chip {white-space:nowrap}` from `styles/base.css:350`; the Project override adds `overflow-wrap:anywhere` without re-enabling wrapping. Its anonymous text flex item extends far past the constrained chip and pushes the trailing remove button out of view. Document-level width checks pass because the overflow is inside `.app-dialog-body`.

**Required outcome:** long existing keyword text wraps within the Project editor without data truncation/rewriting, while each index-specific removal action remains visible/operable. Preserve commas, spaces, duplicates, empty entries and literal-add semantics; no parser/length cap/data clipping to hide the issue.

**Non-binding direction / authorized scope:** minimal Project-owned `projects.css` and, only if needed for a proper text/control layout, ProjectKnowledgeSection chip markup. Keep base.css/global `.app-chip` unchanged; do not alter other chips or introduce a framework. Test narrow/wide dialog geometry, long atomic values and actual remove-control hit target. Re-run the keyword data-body regression so a visual repair cannot corrupt B02.

### E01 / operational blocker — post-freeze KaTeX dependency removal broke the current checkout

Facts (not attribution): CP4 entry status had manifests and lockfile clean. Later modifications removed `katex`/`rehype-katex` from `packages/app/package.json` and `packages/chat-core/package.json`; two V3 markdown renderers were edited; pnpm-lock/node_modules were reconciled. V4 `MessageContent.tsx` remains byte-identical to its pin and still imports `rehype-katex`, now absent. Current typecheck fails TS2307 at that import. Timestamps: manifests/V3 edits04:23–04:24; lock/install06:00; successful pinned build/matrix02:11–02:15 preceded them.

This is not declared Stage D work and is not automatically attributable to Ecki, Sol or a particular pane. Existing pane tails do not identify the editor. Preserve all such changes; Acceptance will NOT restore manifests, install packages, remove math rendering or rewrite V3 to make P2B pass. Whole-checkout dependency provenance/desired final state must be resolved with the external change owner. Until then, earlier green build results cannot release the current checkout.

**Construction instruction:** D01/D02 may proceed within the explicitly authorized source boundaries without touching this concurrent scope. If mechanical tests are blocked by missing dependency, record the blocker rather than editing imports/manifests/lock/node_modules. No permission for package reconciliation or a global math-renderer change is implied. Final fresh typecheck/build/full suite must be rerun after dependency consistency is restored by its owner.

### Coverage/accountability and repair route

- Amend Evidence§9's claims that all dialogs use the helper / all keyboard paths were covered. Canonical CreateConversationDialog used its own incomplete inline effect; D's edit-dialog keyboard checks do not imply creation containment.
- The **Project** five-width/two-env matrix is the frozen visual scope. A five-width sweep of every unrelated Chat/Agent page is NOT silently added. Their shared-creation behavior gets targeted compatibility regression due D01.
- Construction need not generate an extra results JSON solely for reviewer's preference: its numeric log/prose + screenshots are valid construction evidence. Acceptance's independent machine-readable results are already retained. Lack of construction JSON is not a product FAIL.
- Respect current reduced-motion/default focus styles; do not globally hide focus rings. No aesthetic preference is promoted to a blocker.
- Repair D01/D02 root behavior, add discriminatory construction checks, align Evidence, then stop CP4 and send actual handoff. Recheck originals first, affected modes/keyword cases next, final matrix+full pipeline after E01 consistency is restored. Do not repeatedly run a known-broken full suite.

**RESUME AUTHORIZED:** bounded D01/D02 repair as above; no human decision is needed for those frozen-contract corrections. E01 is a separate external-change ownership/consistency issue; do not commandeer it. No commit, cutover, backend/V3 modification, new P2 scope or Acceptance-asset edits authorized.

### Immutable ledger row
Cycle: R8 (CP4 review1)
Checkpoint ID: CP4
Baseline: `Plan/V4_Phase_2B_acceptance_CP4_R1_baseline.json` plus timestamped post-pin E01 drift record
Verdict: FAIL
Cause owners: Construction legacy integration/coverage2; Acceptance missed earlier breadth2; external dependency editor Unknown1 (E01); Spec0
Finding IDs: D01,D02 acceptance-miss/P1; E01 external operational blocker
Supersedes/amends: narrows earlier modal/wrap coverage claims, preserves prior functional evidence
Consecutive FAIL count: 1
Repeated invariant IDs: D01=1,D02=1 in CP4
### R8 in-flight preparation / E01 update (no new verdict)

Alicia instructed work to continue. D01/D02 scoped repair remains authorized; no authorization to overwrite concurrent dependency changes is inferred.

Acceptance added `p2b_cp4_creation.acceptance.test.tsx`: 9 sibling cases for Home/Agent-fixed/Project-fixed × ordinary/pending/ambiguous, checking both Tab boundaries, existing safe Escape/trigger restoration and late pending completion suppression. Tests are prepared, NOT executed against a half-edited Builder candidate.

Even file-local lint via pnpm is now blocked BEFORE eslint starts: `ERR_PNPM_JSON_PARSE`, `packages/chat-core/package.json` line30 (trailing dependency comma). This is further E01 workspace inconsistency, not a lint finding in the owner probe. No dependency/manifest/import repair attempted. Current whole-workspace verification remains blocked pending the external scope owner's resolution.

### R8 E01 closure update — authorized external change (no new verdict)

User clarified that the chat-core JSON syntax was repaired and the external KaTeX decoupling was authorized, including removal of obsolete imports from V4 main.tsx and MessageContent.tsx. E01's ownership/authorization hold is lifted; this does not close D01/D02 or reset CP4's consecutive FAIL count of 1.

Independent read-only checks: both app/chat-core manifests parse successfully with Node JSON.parse; neither declares katex/rehype-katex; the two named V4 entry/renderer files contain no remaining KaTeX runtime/CSS imports. MessageContent's math plugin wiring is also removed, so the authorized change is included in the next candidate baseline rather than described as byte-identical to the old renderer. Its old KaTeX capability comment and the app's remaining remark-math declaration are non-blocking external-scope cleanup observations, not new P2B repair requirements.

Builder is still completing native-browser assertions. No full test/build or competing browser run started against its in-progress candidate. On formal CP4 handoff: pin the updated candidate including these authorized changes, rerun D01/D02 original failures and siblings, then fresh complete regression/typecheck/lint/build and five-width/two-environment evidence. Earlier pre-decoupling greens do not substitute for this final pipeline.

## R9 — CP4 review 2 — FAIL (mechanical quality gates)

**Verdict: FAIL; consecutive CP4 FAIL count 2. D01 and D02 CLOSED.** No product P0/P1 remains in this sweep; mandatory lint and whitespace gates prevent final release. No third-FAIL escalation: these are new mechanical findings, not a second failure of D01/D02.

Baseline: `Plan/V4_Phase_2B_acceptance_CP4_R2_baseline.json`, HEAD0079a86 unchanged, frozen Plan SHA4a933606…eb64082 unchanged, 465 pins including package manifests/lock and V3 source to close R8's pin blind spot. R1 comparison: 232/239 identical, 7 changed, 0 missing: three authorized D01/D02 files, two user-authorized V4 math-decoupling files, the two owner evidence records. New test/probe assets are separately attributed. External decoupling is not attributed to P2B Construction or treated as unauthorized Stage-D scope.

Gate groups: **9 checked / 8 passed / 1 failed / 0 not checked**. G01 ownership PASS; G02 functional regression PASS; G03 five-width/dev-prod geometry PASS; G04 keyword wrapping/action reachability PASS; G05 modal keyboard contract PASS; G06 canonical/API/source sweep PASS; G07 isolated side effects PASS; G08 complete quality pipeline FAIL (M01/M02); G09 evidence/handoff/stop boundaries PASS. Unreviewed in-scope gate groups: none. Findings: new2 mechanical, residual0, repair-regression0, harness-defect0, acceptance-miss0; previous D01/D02 closed; P0/P1 outstanding0. Full regression executed, no skipped/xfail workaround.

### Fresh evidence (post-decoupling current candidate)

- P2B construction: **5 files /111 passed**, failures/errors/skips0.
- Independent P2B: **4 files /76 passed**, failures/errors/skips0. Includes new three-mode creation × ordinary/pending/ambiguous **9/9**. These focused suites overlap the full suite; counts are NOT summed as unique coverage.
- Complete exo-app: **60 files /667 passed**, failures/errors/skips0; Node25 compatibility flag `NODE_OPTIONS=--no-experimental-webstorage`, unchanged from prior accepted harness.
- Fresh exo-app production build exit0; explicit typecheck exit0. Build emitted existing chunk-size/deprecation warnings, no failure.
- Original five-width/dev+prod native matrix: **1750/1750 checks**, 80 observations/screenshots, real Vite and real controlled production PWA; API fixtures intercepted and no backend/provider traffic. Artifacts `Plan/.p2b-acceptance-shots/cp4-r2/`; R8 failures retained separately.
- Original D02 native test: **2/2 widths** passed. At320/1280 text fits250/502px chips, remove-right275/881px vs body-right303/909px, actual remove hit visible, no internal excess width. `cp4-keyword-r2/observations.json`. Independent screenshot inspection confirms wrapped literal value and visible remove at320.
- Extra native g045 dynamic-permission/pending/ambiguous sibling: **152/152 checks**, 6 observations across320/1280; real Tab/ShiftTab containment, safe Escape/trigger restoration and late-success no-navigation. `cp4-creation-r2/observations.json`.
- Lint exit1: one error in the new construction test (M01). Unstaged whitespace exit2: three whitespace-only lines in authorized external manifests (M02). Staged whitespace exit0. LF/CRLF warnings are NOT these errors.

### M01 — new / mandatory mechanical / Construction owner

`packages/app/src/test/p2b_cp4_d01_d02.test.tsx:77:19`: ESLint `no-undef`, `'React' is not defined` for a `React.ReactNode` type annotation. Runtime667/667 and tsc passing do not satisfy the separate frozen §8.8 lint gate.

Required outcome: use an explicitly imported appropriate React type without changing test assertions or production behavior. Authorized boundary: this new construction test's type import/annotation only. Do not disable lint rules, weaken assertions or change production code. Recheck file lint + full exo-app lint/typecheck; full667 suite required on final candidate.

### M02 — new / mandatory mechanical / authorized external-change owner

`git diff --check` fails on whitespace-only added lines: `packages/app/package.json:19,28` and `packages/chat-core/package.json:17`. JSON is valid and V4 dependency resolution/build succeeds; this is NOT a reappearance of E01 missing imports. Frozen §8.8 separately requires a clean whitespace check.

Explicit pre-edit authorization to current Builder for this dependency-adjacent mechanical closure: remove trailing whitespace ONLY from those three blank lines. Re-read files before editing; preserve every dependency name/version, key/order and external decoupling decision. No install, lockfile change, formatter sweep, V3 source edit or package reintroduction. This permission is not authorization to take ownership of the external math-decoupling task. Verify both JSON files parse and semantic content is unchanged, then unstaged/staged whitespace checks.

### Razor disposition / non-blocking observations

Native creation diagnostics record Chromium BODY focus when the clicked submit disables itself, before the next Tab (pending/ambiguous at both widths). This is disclosed, not hidden: **all subsequent native Tab/ShiftTab steps stay inside**, close/cancel remain usable, Escape/restoration work. Unlike CP2 B04's all-controls-disabled keyboard dead end, this is a working trapped tab sequence with a platform self-disable transition. Frozen D01 requires wrapping usable controls, not a specific anchor or continuous DOM activeElement identity at every instant. A per-consumer pending anchor is an adjacent improvement, NOT a newly promoted MUST. Reassess if a real mode has zero usable controls or a Tab reaches background controls.

External decoupling read-only notes, outside P2B release scope: V3 `chat-core/src/main.jsx` still imports KaTeX CSS despite the removed direct dependency (V3 build not executed here); V4's old KaTeX capability comment and unused remark-math declaration remain. These belong to the external task owner; no cleanup of them is authorized by M02. Do not claim this P2B/exo-app acceptance certifies V3 math-decoupling or V3 builds.

### Repair/recheck route

D01/D02 production repairs and their native evidence are preserved. **RESUME AUTHORIZED: M01/M02 only**, plus accurate Evidence update. Stop and hand off directly after correction. Acceptance will compare the final diff, rerun lint/whitespace/JSON/typecheck/full suite; if production or dependency semantics change, invalidate and rerun affected native/build evidence. Pure type-import and whitespace edits do not require manufacturing another identical80-shot browser run. No commit/cutover/further feature authorization.

Current pane discovery after restart: Acceptance=5, Ecki=6, idle Sol=7, Planner=4. Historical pane3/4/5 addresses in earlier rows are historical, not current delivery destinations.

### Immutable ledger row
Cycle: R9 (CP4 review2)
Checkpoint ID: CP4
Baseline: `Plan/V4_Phase_2B_acceptance_CP4_R2_baseline.json`
Verdict: FAIL
Cause owners: Construction1 (M01), External authorized change1 (M02), Acceptance0, Harness0, Spec0
Finding IDs: M01/M02 new mechanical; D01/D02 closed
Supersedes/amends: R8 findings closed; E01 external authorization carried forward
Consecutive FAIL count: 2
Repeated invariant IDs: D01 closed, D02 closed; M01=1,M02=1

## R10 — CP4 review 3 — PASS / P2B final acceptance

**Verdict: PASS. CP1→CP2→CP3→CP4 complete; the frozen P2B Project workspace slice is independently accepted.** Consecutive CP4 FAIL count resets from2 to0. M01/M02 closed; D01/D02 remain closed. New/residual/repair-regression/harness-defect/acceptance-miss findings: **0/0/0/0/0**. Outstanding P0/P1: **0**. In-scope unreviewed groups: **0**.

Final baseline: `Plan/V4_Phase_2B_acceptance_CP4_R3_baseline.json`. HEAD remains0079a86ed894854df452e4244c78b46d697e0a2d; frozen Plan SHA remains4a93360627b1cde95e2bcac1c51c207ddf664309d184c0e14f332dcbbeb64082. Existing P2A work/user notes remain preserved; no commit/reset/cutover or backend edit performed by Acceptance.

### Scope and repair proof

Against R9's465 pins: **460 identical /5 changed /0 missing**. The5 changes are the two owner records, the M01 test, and the two M02 manifests. **All production-source pins and lockfile unchanged.** Independent reconstruction proves the M01 test differs by only the explicit ReactElement type import and annotation, no assertion changes; adding four spaces back on the exact three blank manifest lines reproduces both original R9 SHA256 hashes. JSON semantic comparison also passes for both manifests. Dependency names/versions/order and external decoupling decisions are unchanged by this repair.

**Acceptance prose correction:** R9 mistakenly called the offending annotation `React.ReactNode`. The byte-proven original was **`React.ReactElement`**, now explicitly imported `ReactElement`. The lint diagnostic and required remedy were correct; this correction creates no extra Builder FAIL and does not rewrite the historical verdict.

### Final gate evidence — 9 checked /9 passed /0 failed /0 not checked

| Gate group / frozen authority | Evidence / result |
|---|---|
| G01 scope/ownership (§8.1) | Plan stable; D01/D02 narrow authorizations observed; M01/M02 byte-proven; external authorized math work distinguished from P2B; Acceptance assets remain reviewer-owned. PASS |
| G02 Project Hub/detail/lens/creation/files/Knowledge/deletion (§8.2–8.7) | CP1–3 prior independent contracts preserved by unchanged production pins and fresh entire suite; P2B focused111 and independent76 in R9, included in final667 suite. PASS |
| G03 five widths/two environments (§8.8) | R9 native1750/1750, 80 observations/screenshots at320/390/767/768/1280 in real Vite dev + controlled production PWA. No document overflow; action hit targets/focus/scroll observations retained. PASS |
| G04 wrapping/keyword actions (§8.8; D02) | Native320/1280 keyword2/2, text within chip and remove button visible/hit-testable; independent320 screenshot reviewed; literal/index semantics preserved. PASS |
| G05 dialogs and affected creation siblings (§8.4/§8.8; D01) | Native matrix and152/152 g045/pending/ambiguous checks; Home/Agent-fixed/Project-fixed × ordinary/pending/ambiguous9/9 in final suite; Escape, trigger restoration and late completion isolation preserved. PASS |
| G06 canonical owners/API contracts (§8.1–8.7) | Source/pin sweep preserves one Conversations collection, existing shared files owner, origin-bound invalidations, mixed-ID guard, actual backend-updated feedback and explicit numeric delete recovery. No new owner/framework/backend endpoint. PASS |
| G07 safety (§8.6/§8.8) | Tests/browser use isolated HTTP fixtures, no real destructive/Knowledge/AgentPreset writes or provider calls; closing DB baseline8 rows IDs1–8. PASS |
| G08 complete quality pipeline (§8.8) | Fresh lint/typecheck/build, both whitespace checks exit0; full60 files/667 tests pass, failures/errors/skips0. PASS |
| G09 evidence/rollback/stop boundaries (§9–§10) | Single Construction Evidence§11 and this owner report; prior failing observations retained separately; no implicit commit/deployment/root cutover authorization. PASS |

### Fresh final pipeline and retained browser evidence

- `pnpm --filter exo-app lint`: exit0.
- `git diff --check` and `git diff --cached --check`: both exit0. LF→CRLF notices are cosmetic, not whitespace failures.
- `pnpm --filter exo-app typecheck`: exit0.
- Full suite with established Node25 compatibility flag: **60 files /667 tests executed and passed; failed0/errors0/skipped0**, exit0.
- `pnpm --filter exo-app build`: exit0, including SW build. Existing >500kB chunk warnings and inlineDynamicImports deprecation remain warnings, not suppressed errors.
- R9 P2B-focused111/111 and independently authored76/76 are subsets of the final667, not extra unique tests to inflate totals.
- Native evidence is retained, **not falsely claimed rerun in R10**: only test type import and semantically identical JSON whitespace changed; all runtime source and lock pins are unchanged. R9 explicitly permitted preserving the1750-check/80-shot dev+prod matrix, D02 two-width checks and152-check native sibling run for this mechanical-only repair. The final build/full suite were still executed fresh.
- Artifacts: `Plan/.p2b-acceptance-shots/cp4-r2/`, `cp4-keyword-r2/`, `cp4-creation-r2/`. R8 failing artifacts remain in their original directories.

### Accepted limitations / adjacent scope

- This certifies the frozen P2B/V4 slice, not every external math-decoupling change, V3 build, P7 root redirect, backend filesystem behavior or actual irreversible deletion. V3's remaining KaTeX CSS import is a read-only external-task observation, not runtime-verified here; external owner should resolve it separately.
- R9's native self-disabled-submit BODY observation remains explicitly disclosed. The creation dialog retains usable close/cancel controls and correct trapped Tab/Escape behavior; no new continuous-focus-anchor design requirement is promoted into this checkpoint.
- Existing Plan adjacent issues remain deferred: authenticated file serving/opening, richer delete preview/filesystem preflight, backend frozen-project cleanup, warnings hidden behind204, future server-side filters, stale backend pagination documentation. No new scope implemented.
- Real data mutations and paid providers were intentionally not used; native tests exercised isolated fixture requests only.

### Release condition

**CP4/P2B ACCEPTANCE RELEASED.** Current Builder may record this independent PASS in the single Construction Evidence and close the work phase. No further repair/feature work is authorized. This verdict does **not** perform or silently authorize commit, push, deployment, root-route cutover, backend changes or edits to Acceptance assets. Any subsequent functional/dependency change requires a new bounded validation rather than reuse of this verdict.

### Immutable ledger row
Cycle: R10 (CP4 review3)
Checkpoint ID: CP4 / P2B final
Baseline: `Plan/V4_Phase_2B_acceptance_CP4_R3_baseline.json`
Verdict: PASS
Cause owners: Construction0, Acceptance0, Harness0, Spec0, Environment0, Unknown0
Finding IDs: M01/M02 closed; D01/D02 remain closed; no new finding
Supersedes/amends: R9 mechanical gates closed; R9 annotation prose corrected ReactNode→ReactElement
Consecutive FAIL count: 0
Repeated invariant IDs: all CP4 blocking invariants closed


---

## §R11 - Post-PASS finding: filter-chip hidden inputs escape the scroll owner (RE-OPENED for narrow repair)

### User report (demo, both dev :5176 and prod :8080)

On Project Detail, when the conversation list is long the page works normally under 全部,
but clicking an Agent filter chip shifts the WHOLE page up ~300px: the top bar is cut off at
the window edge, the bottom shows background, the wheel/scrollbar cannot restore it, and
switching the filter back to 全部 does not restore it either. Narrow screens unaffected.

### Root cause (independently established, not builder-provided)

- features/projects/projects.css:213-217 .project-filter-option input and
  features/agents/agents.css:199-203 .agent-filter-option input use
  position:absolute; opacity:0; pointer-events:none with NO positioned ancestor.
  The nearest positioned ancestor is the initial containing block, so these
  visually-hidden radios escape the single scroll owner (.app-scroll).
- Their ICB boxes therefore extend the document scrollable area even though
  body{overflow:hidden} hides the document scrollbar. Measured at 1000x520 with
  90 conversations: docScrollHeight=733 > clientHeight=520 (213px hidden overflow).
- Clicking a chip (or Arrow-key navigation) focuses the radio; Chromium scrolls the
  containing-block chain => scrolls the DOCUMENT to bring the ICB box into view
  (document scrolls 213px, top bar at -213). The user cannot undo it: no scrollbar
  exists for the document, and the app-scroll wheel only scrolls .app-scroll.
  Selecting rows still works (filter applies), which is why the list is filtered
  but the page stays offset - exactly the reported symptom.
- Same defect on Agent Profile (agents.css); manifests at squashed heights
  (360px sample: 2px shift, same mechanism). .project-file-input
  (projects.css:269-275, abs 1x1px file input) is the same family (conditional on
  content above growing). Dialog radios/checkboxes use native accent-color and are
  NOT affected (checked). ChatComposer file inputs already use the native hidden
  attribute (not affected).

### Where coverage missed this

CP4 fixtures placed the filter bar above the fold and never focused a chip while
below it; the escape only matters when the bar sits below the viewport bottom AND
an interaction focuses the chip input. This dimension is now added to the
acceptance probe: packages/app/src/acceptance/p2b_r11_lens_filter_scroll.mjs
(mock-only GET-only; scenarios: project-lens 1000x520, agent-profile 1000x520 and
1000x360, files-upload; mouse click + keyboard ArrowLeft/Right + wheel-scroll steps;
records doc overflow/scroll per state).

### Pre-fix evidence (independently re-run)

Plan/.p2b-acceptance-shots/r11-lens-scroll/observations-before.json:
- project-lens @520: hidden overflow 213px; click => docScrollTop 213; back-to-all
  (keyboard) => rows restored 90 but docScrollTop stays 213; ArrowRight same.
- agent-profile @360: overflow 2px; click => docScrollTop 2 (cannot restore).
- Mechanism validation (runtime-injected position:relative on both chip rules +
  file-input hide) satisfies every assertion: zero overflow, zero document scroll
  through all interactions: VALIDATE_FIX=1 EXPECT_FIXED=1 exit 0.

### Required narrow repair (authorized scope)

1. projects.css .project-filter-option: add position:relative (containing block
   inside the scroll owner; static-position boxes then scroll/clip with .app-scroll).
   Chip look, :has(:checked) style, focus-visible outline, tab and arrow-key
   behavior unchanged.
2. agents.css .agent-filter-option: same one-line change.
3. ProjectFilesSection.tsx + projects.css: replace the abs 1x1px file input with
   the native hidden attribute (+ tabIndex=-1 + aria-hidden), mirroring the
   shipped ChatComposer pattern; delete the CSS rule.
4. No other edits. No global CSS. No dialog/section/layout changes. No new
   dependencies. Evidence appended to the single Construction Evidence only.

### Acceptance recheck after repair (Acceptance-owned)

- Rerun p2b_r11_lens_filter_scroll.mjs with EXPECT_FIXED=1 on the rebuilt bundle:
  zero overflow + zero doc scroll in every scenario state.
- Re-run full suite + lint/typecheck/build + diff checks; real-prod(:8080) demo
  spot check at squashed height (read-only).

Verdict: **R11 re-opens the CP4 release on ONE item; everything else in CP4 stands.**
Consecutive FAIL counter unaffected (this is a fresh acceptance round).

---

### R11 recheck results (independent, post-repair) - CLOSED

- Source scope verified: only the 3 authorized files changed since R10; dist rebuilt
  (index css contains .project-filter-option{...position:relative}, .project-file-input rule gone).
- Acceptance probe EXPECT_FIXED=1 on rebuilt bundle: PASS, all 4 scenarios
  (project-lens 1000x520, agent-profile 1000x520, agent-profile 1000x360, files-upload) -
  zero document overflow and zero doc scroll through wheel/click/keyboard; selection
  behavior intact. observations-after.json in the r11-lens-scroll dir.
- Real-demo spot check (:8080 prod, real backend, read-only): project 4 squashed
  1280x480, filter bar ~900px below fold; click an agent chip + keyboard back-to-all:
  docOverflow 0 / docScrollTop 0 in every state, rows filter correctly. PASS
  (observations-demo.json).
- Full suite 60 files/667 tests 0 failed, lint 0, typecheck 0, diff --check clean
  (LF->CRLF notices only, none in the 3 touched files). Independent runner.
- Verdict: R11 CLOSED (accepted repair). R10 acceptances unchanged; the demo defect
  is resolved on both dev and prod paths with zero behavior change elsewhere.

Verdict: **R11 CLOSED - PASS after narrow repair.** Fresh acceptance round on a
user-reported defect; not counted against the CP1-CP4 consecutive-FAIL chain.