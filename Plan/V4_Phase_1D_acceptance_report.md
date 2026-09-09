# P1D independent acceptance ledger

Owner: Astra, pane 2. Acceptance-owned: Construction may read, not edit.

## Checkpoint A / R1 — FAIL

### Factual summary

- Verdict: **Checkpoint A FAIL; do not advance the coupled runtime/trace line past A.** This is not Task 6, Checkpoint B or final C1D acceptance.
- Authority: Alicia-approved intermediate A (Task 2 + minimal HUD/cache integration); frozen Plan SHA256 `a78ea9b754d385f212eb2eba01698297204a18928d5d2172771018b28401e43f`.
- HEAD: `63ff0b6` (C1C plus skill-layout chore).
- Baseline: `packages/app/node_modules/.cache/p1d-independent/A-R1-pinned-manifest.json` and `A-R1-pinned.diff`.
- Gate groups swept: 7; 4 fail (target initialization, thinking route/save ownership, local preference retention, cache↔send exclusion); 2 with passing focused evidence (ordinary transport field serialization/unresolved gate, stable cache calibration); 1 partially verified (audio/recovery). No whole-A coverage claim is made for the partial group.
- Tests: **58 unique executed; 51 passed, 7 failed, 0 errors/skips**. Independent: 11 tests, 5 passed/6 failed. Builder's named focused suite: 47 tests, 46 passed/1 failed. Counts exclude initial mixed-baseline execution and repeated corroboration runs.
- Static: exo-app typecheck exit 0; exo-app lint exit 0; git diff --check exit 0.
- Findings: new 6 (4 P1 production, 1 P2 production, 1 construction-test defect); residual/repair-regression/harness-defect/acceptance-miss 0.
- Full regression: **deferred** while these blockers remain; no final C1D pipeline or browser/provider generation claimed.
- Remaining dynamic verification after repairs: bidirectional exclusion across ordinary/edit/regenerate/audio and same-tick actions; actual recording/HUD target-change sequence; exhaustive storage suspension/retry settings; full affected regression. Broader Project/Aura/structured trace/responsive acceptance belongs to B/final and is not silently marked PASS here.
- No production/construction/frozen file edit, no provider call, no real DB mutation, no commit. Only this independent report is staged; probes/logs are ignored cache artifacts.

### Baseline and execution discipline

At intake, DS was still finishing cache calibration and other files; changes were detected against the initial manifest. Pane 3 was asked to freeze the A candidate. Inspection was re-pinned after the changed candidate settled and the verdict run was repeated. The first mixed-baseline run does not count as a verdict/FAIL cycle. The pinned manifest stayed byte-identical through the verdict tests and checks. Frozen Plan hash remained unchanged.

Opening/closing real AgentPreset baseline: 8 rows, IDs 1–8. Backend trace is explicitly not accepted; no Task 6/C1D claim is inferred from the new handoff document.

### Ledger

| Cycle | Checkpoint | Baseline | Verdict | Cause owners | Findings | Supersedes | Consecutive FAIL |
|---|---|---|---|---|---|---|---:|
| R1 | P1D-A | A-R1-pinned-manifest.json on 63ff0b6 | FAIL | Construction 6; Acceptance 0; Harness 0; Spec 0; Environment 0; Unknown 0 | A-01–A-06 | none | 1 |

## Findings and repair packet

### A-01 / P1 / new — cache mutation and chat are not mutually excluded

**Observed:** On the actual Conversation route, start DELETE cache, leave its response pending, close HUD, enter text and press Enter. A chat POST is emitted while DELETE is still unresolved (independent A1: expected zero, observed one).

**Authority:** Plan §8.3 requires active/uncertain chat and unresolved cache mutation to exclude one another; Checkpoint A explicitly owns this integration.

**Confirmed cause:** `ConversationPage.tsx:113` creates one `useCacheControl`; `ContextCacheControl.tsx:46` creates another with its own mutation observers. Query data is shared, mutation state is not. Page's composer/runtime guard never includes the HUD mutation. Closing HUD unmounts the component owning that UI state without cancelling the actual request. The page's `controlLockRef` is only busy/audio-upload/thinking-save; no cache mutation enters it. Thus even a render-separated sequence, not merely an adversarial same-tick race, bypasses exclusion.

**Affected chains:** renew and release; HUD close/reopen; ordinary Enter/click, edit/regenerate, uploaded-audio retry and fresh recording upload; cache mutation during audio upload (HUD receives only runtime `busy`).

**Required outcome:** One authoritative pending-operation observation must exclude both directions at real command boundaries and survive HUD closure until the operation settles. Reopen must not allow another conflicting mutation. Do not create a second durable chat lease/transaction system.

**Non-binding direction:** Share the existing cache action owner at the page boundary, or consume accurately keyed mutation state; feed the same authoritative guard to command paths, not just button styling.

**Recheck:** pending renew/DELETE → close/reopen → each dispatch entry; chat/audio upload → cache actions; same-tick and render-separated cases; success/failure releases the correct guard. Preserve canonical Query cache truth and post-terminal invalidation.

### A-02 / P1 / new — delayed thinking PATCH for A overwrites B's Query row

**Observed:** Start PATCH high on Conversation 42, switch hook/page identity to 43, resolve the 42 response. Query row 43 becomes `thinkingLevel: high` although no PATCH 43 was sent; row 42 stays auto (independent A4).

**Authority:** Plan §6.3 requires exact Conversation updates and identity checks for page-mutating callbacks; §8.2 disallows late commands changing another page.

**Confirmed cause:** `useConversationControls.ts:175–201` captures route-dependent ID in mutable mutation options rather than binding the ID to each invocation/result. TanStack mutation callbacks can use the updated options after route change. `onSuccess` writes the current route key and unconditionally resets current page save state; error/retry paths similarly carry the departed request's state into the current page.

**Affected chains:** delayed success, definite rejection and unknown save; A→B→A; B starts its own save before A settles; retry of old requested value from B.

**Required outcome:** A's result updates/refetches A only. A's terminal callback cannot clear B's pending UI, set B's retry request, or write B's confirmed state. Unknown/refused outcomes must remain attached to the actual invocation.

**Non-binding direction:** Bind conversation identity and requested level into mutation variables and guard page-local side effects. This is ordinary mutation scoping, not new lease machinery.

**Recheck:** route A→B and A→B→A with delayed success/4xx/network/malformed responses and B's own save. Preserve response ID/enum validation and definite-rejection versus unknown-outcome distinction.

### A-03 / P1 / new — cached catalog can select a wrong model before preset arrives

**Observed:** Catalog is ready with first main-role model `first`; current Conversation's preset arrives later and says `desired`. Both hook probe A3 and actual route B1 show target remains `first/1`, rather than `desired/2`, without any explicit user selection.

**Authority:** Plan §4.3, Task 2 and §8.2 require initialization from the current preset/catalog; later valid explicit selections are to be retained, not transient fallback initialization.

**Confirmed cause:** `useConversationControls.ts:108–123` resolves against null/unloaded preset and adopts shared resolver's first-main fallback. Later effect treats any sendable target as an explicit valid selection and preserves it when the real preset arrives. Page has independent catalog, Conversation and preset queries, so this ordering is a normal production path.

**Affected chains:** warm catalog/cold preset or Conversation; route change; initial target and audio capability; actual billed execution target.

**Required outcome:** Distinguish unresolved initialization from a legitimate initialized/user-selected target. Arrival of current preset must establish its target unless the user actually chose another target under the allowed flow. Do not send based on an accidental transient fallback.

**Recheck:** all relevant query arrival orders, warm catalog route changes, no preset/default fallback cases supported by the contract, explicit user selection retained on harmless catalog refresh. Preserve enabled/configured/compatibility checks and target-neutral unuploaded Blob behavior.

### A-04 / P1 / new — closing HUD discards in-memory settings after storage failure

**Observed:** On actual route, make only P1D preference storage writes fail, choose `full` and confirm HUD shows full, then close/reopen HUD. It returns to lite (independent A2). Runtime lease storage is not failed by this probe.

**Authority:** Plan §6.3: storage failure keeps the in-memory choice for the current page and gives a nonblocking warning.

**Confirmed cause:** `ConversationPage.tsx:560–562` always calls `controls.refreshPreferences()` on close, which rereads old/default storage via `useConversationControls.ts:282`, overwriting the authoritative in-memory choice. The same hook already owns HUD preferences; close-time resynchronization is unnecessary.

**Affected chains:** cache enabled, session history and g045 memory preference; closing by button/backdrop/Escape; next send may carry a reverted setting.

**Required outcome:** Page-local choices survive HUD closure and remain the dispatched effective values while persistence is unavailable. Do not add another persistence/recovery system.

**Recheck:** failed writes for all three prefs → close/reopen → request body; supported persistence across route/reload; warning remains nonblocking. Preserve typed storage helpers and their explicit fallback.

### A-05 / P2 / new — confirmed thinking refetch never clears unknown-save notice

**Observed:** Real route PATCH returns malformed success, canonical GET then returns high and selector shows high, but “保存状态待确认，正在重新读取当前会话。” and retry remain forever (independent B2).

**Authority:** Plan §6.3 truthful lightweight unknown-save/refetch flow.

**Confirmed cause:** controls `onError` sets uncertain and awaits invalidation, but never resolves that local status when canonical confirmation arrives. It also does not distinguish a successful reread from a failed one in the local completion presentation.

**Required outcome:** Once an exact canonical reread succeeds, show confirmed state and end the in-progress confirmation claim. If reread fails, retain honest uncertainty/retry. Avoid unconditional idle on failed refetch.

**Recheck:** malformed/network outcome followed by successful and failed GET; incorporate invocation/route ownership fix A-02. This is part of the same small mutation lifecycle, not justification for a generalized transaction engine.

### A-06 / construction-test defect / new — declared focused suite is not green on pinned candidate

**Observed:** Builder's same five-file command now yields **46/47**, not 47/47. `src/test/chat_runtime.test.tsx:124` expects `enable_cache` (wrong wire name) and `memory_injection_enabled:true` for its standard-agent fixture. Actual body correctly uses `cache_enabled` and omits g045-only memory.

**Owner:** Construction test, not a production serialization defect and not an Acceptance harness defect. The candidate changed between earlier claim and pin; earlier 47/47 evidence cannot stand in for current results.

**Required outcome:** Correct construction test expectations to the frozen contract, preserving both positive g045 memory and negative non-g045 omission coverage. Do not change production to emit dead/wrong fields merely to satisfy this assertion.

**Recheck:** repeat five-file command, plus targeted control/audio/route integration suites after production repairs. Acceptance does not edit this construction test.

## Preserved evidence and scope advice

- Shared transport body carries model/endpoint/thinking/cache/session/g045-memory correctly in independent SSE and async probes (B3 ×2).
- Explicit null target rejects before chat POST (B4).
- Stable preset initialization plus local preference changes builds correct dispatch settings (A6).
- DS's finalized stable-dependency calibration fix passes 35-second active countdown/calibration probe (A5); the previous interval-reset implementation is not the pinned candidate.
- Existing selected audio-target capability checks and captured `AudioTurnSnapshot.dispatchSettings` cloning are source-verified; focused audio recovery suite passes. Do not infer that all actual HUD/audio/recovery interleavings are proven from this.
- Existing shared event application keeps Thinking/telemetry/cache notices out of answer content; focused runtime-events suite passes. Structured trace remains pending backend contract and outside A PASS claims.
- No recommendation requires a new generic controller, schema framework, tree synchronizer or durable preference transaction.

## Repair order and handoff

1. Fix invocation identity and target initialization (A-02/A-03).
2. Connect cache pending state and all real action guards (A-01); coordinate page/control/HUD ownership through pane 3.
3. Remove destructive close-time preference refresh (A-04) and complete thinking reread presentation (A-05).
4. Correct construction test contract expectations (A-06).
5. Rerun original independent failures, sibling boundary cases, then relevant integration regression. Full C1D remains later.

Previously passing implementation is a preserve recommendation, not frozen production. If repairs require broader changes, describe necessity and invalidated evidence to pane 3/Acceptance before proceeding. Frozen Plan and independent report/probes remain read-only to Builders. No provider/live or commit permission is granted by this FAIL.

Pane 3 remains the accompanying acceptance/coordination owner. Builders should return finding IDs, changed files/symbols, exact commands and numeric outcomes, and omissions. This packet authorizes only corrections within existing checkpoint scope; product/spec expansions require Alicia.

## Evidence paths

Under `packages/app/node_modules/.cache/p1d-independent/`:
- `a.test.tsx`, `b.test.tsx`, `vitest.config.ts` (independent; not construction targets)
- `A-R1-pinned-probes.log`: 5 pass / 6 fail
- `A-R1-focused.log`: 46 pass / 1 fail
- `A-R1-typecheck.log`, `A-R1-lint.log`, `A-R1-diffcheck.log`
- `A-R1-pinned-manifest.json`, `A-R1-pinned.diff`

Full regression, structured trace/backend suite, live/provider/browser visual checks: not run in this blocked intermediate cycle.

---

## Checkpoint A / R2 — FAIL (repair regression)

### Factual summary

- Verdict: **Checkpoint A FAIL**, consecutive checkpoint FAIL count **2**. No advance past A, live/provider or commit permission.
- Baseline: HEAD `63ff0b6`; frozen Plan unchanged at `a78ea9b754d385f212eb2eba01698297204a18928d5d2172771018b28401e43f`.
- Pinned manifest: `packages/app/node_modules/.cache/p1d-independent/A-R2-manifest.json`, SHA256 `c48cf2288b256a2d901525012d3b74c00c644291f7434996717619d606f80442`. It also pins R1 report and original independent a/b probes; no Builder alteration found. Candidate source and pinned artifacts stayed unchanged during recheck.
- Original independent repros: **11/11 passed**, run unchanged before extending coverage.
- Expanded independent: **15 tests, 12 passed / 3 failed**, 0 errors/skips. The three failures establish two production regressions; one has both hook-chain and actual route corroboration.
- Builder construction selection: **10 files, 76/76 passed**.
- Separate Project-path triage: **1 file, 7/7 passed**.
- Unique executed total: **98 tests, 95 passed, 3 failed**, 0 errors/skips. The initial repeat of the same original 11 is not added twice.
- Static: app typecheck/lint and unstaged/staged diff checks exit 0.
- Findings this cycle: repair-regression 2 (A-07/A-08, both P1); new/residual/harness-defect/acceptance-miss 0. R1 A-02–A-06 close on current evidence. A-01's original pending-cache→close-HUD→Enter repro passes; its broader operation-ownership invariant remains blocked by regressions in the guard integration.
- Gate groups: original 7 groups reassessed against the repaired delta and unchanged original tests. Target/thinking/preferences now have passing focused evidence; ordinary transport serialization and active calibration retain passing evidence. Cache route ownership and audio handoff fail. This is not an exhaustive Checkpoint B/final C1D sweep.
- Full regression: deferred because the new actual-route audio regression blocks A. Broad app/V3/build pipeline, full responsive browser checks, backend trace and provider probe are not represented as executed.
- Remaining dynamic verification: after repair, full same-tick/render-separated owner transition matrix, cache A→B→A plus concurrent distinct-conversation completions, audio upload→initial dispatch→recovery in both transports, and affected C1B/C1C regression. None is silently accepted by the 11 original passing probes.
- Opening/closing real DB baseline: AgentPreset exactly IDs 1–8. No real DB mutation/provider call/production edit/commit by Acceptance. Only independent report is staged.

### Immutable ledger row

| Cycle | Checkpoint | Baseline | Verdict | Cause owners | Findings | Supersedes | Consecutive FAIL |
|---|---|---|---|---|---|---|---:|
| R2 | P1D-A | A-R2-manifest c48cf228… on 63ff0b6 | FAIL | Construction 2; Acceptance 0; Harness 0; Spec 0; Environment 0; Unknown 0 | A-07/A-08 | R1 current-candidate disposition | 2 |

Repeated invariant early warning: operation ownership/exclusion from A-01 has failed to converge for two cycles. Before another patch, Builder should restate the **owner + phase + Conversation** matrix, not add exceptions named after probes. This is the second-FAIL early warning, not the mandatory third-FAIL intervention; the counter is not reset by 11/11 original probes.

### A-07 / P1 / repair-regression — successful audio upload is blocked from dispatching its own chat

**Observed evidence:** Independent `R2-C1` joins the actual audio recovery and runtime owners using the page's new guard wiring: upload POST succeeds, chat POST count is zero. `R2-C2` renders the actual Conversation route, uses the real recorder/composer/recovery/runtime code (only browser MediaRecorder/getUserMedia and HTTP are simulated), clicks Start→Stop→Send Audio: exactly one upload, **zero initial chat POST**. No user retry is used as a substitute for the required first send.

**Authority:** Plan §6.2/Task 2.5 and §8.2 require the audio upload target/control snapshot to continue into the same accepted C1B runtime; accepted C1C audio behavior must not regress. A-01 repair required conflict exclusion, not blocking the operation's own continuation.

**Confirmed root cause:** `ConversationPage.tsx:201–204` makes `audioRecovery.isUploading()` an external blocker for every runtime dispatch. `audioRecoveryMachine.ts:179,233,248–251` keeps uploading true while awaiting `input.dispatch`, and only clears it afterward in finally. `useChatRuntime.ts:1393` therefore rejects that owned continuation before any chat POST. This guard was added by R2; it is not a prior unreported R1 defect.

**Affected siblings:** SSE and async share this predispatch guard; mixed text+ordinary attachment+audio sends; subsequent recovery availability/state after this predispatch rejection. Current mocked dispatch tests cannot prove this ownership handoff.

**Required outcome:** A legitimate completed-upload continuation must transfer into initial chat dispatch exactly once with original settings/attachments, while unrelated send/cache/target actions remain excluded during upload and runtime operation. No duplicate upload, generic bypass flag, test-keyed special case or blanket removal of guards.

**Non-binding direction:** Make the upload→runtime ownership transition explicit at the actual handoff boundary. An operation's own next phase is not an unrelated competing operation. Reuse the current owners and refs; no new durable transaction framework is justified.

**Recheck:** real route recording+mixed send for SSE and async; pending upload blocks competing cache/send/target actions; upload completion posts once; upload failure and route departure post zero; failed chat recovery reuses original attachment/settings with zero re-upload. Preserve working original cache-close/send exclusion.

### A-08 / P1 / repair-regression — A's cache pending state is inherited by B

**Observed evidence:** `R2-C3` starts DELETE on A, leaves it pending, switches the same cache owner to B and waits for B's snapshot Query. `isOperationPending()` is still true for B. The actual page consumes that value/ref to disable B's controls and block B's runtime requests, despite no B cache mutation.

**Authority:** Plan §6.3 exact ownership and §8.3 “Conversation A cache state/timers never appear in B”; A-01 guard repair may not introduce a page-global lock across unrelated Conversations.

**Confirmed root cause:** `ConversationPage.tsx:105` supplies one unkeyed boolean ref across route changes. `useCacheControl.ts:76–80,129–131,142–148` also retains mutation observer state across the ID change and reports pending without origin filtering. Mutation variables now correctly target the originating Query on success, but mutation pending/error presentation and the shared command guard are still not Conversation-scoped.

**Affected siblings:** renew/DELETE; pending/error/success notices after route change; A→B→A; old completion while another Conversation owns a later operation. If A's request stalls, B can remain blocked indefinitely.

**Required outcome:** A's operation continues to be tracked for A and re-entry into A, but does not block or announce an operation in B. Completion of A must never release/overwrite B's unrelated pending state. Simply resetting an unowned boolean on navigation is not sufficient.

**Non-binding direction:** Scope mutation observation and command ownership to the operation's Conversation identity, using existing Query/mutation ownership or a small exact-owner representation. Do not introduce a global synchronization store or cross-tab policy.

**Recheck:** renew and release A→B→A with delayed success/error; B remains usable while A waits, A remains protected on re-entry, A completion only refreshes/changes A, and B's own pending action cannot be cleared by A completion. Preserve single page cache action ownership across HUD close/reopen.

### R1 closure / preserve recommendations

- A-01 original repro now passes: a page-owned cache action owner survives HUD closure and ordinary Enter is excluded while pending. Rejected cache promises are consumed, error remains visible and guard releases (new passing R2-C4). Preserve these behaviors, but correct A-07/A-08 without broad rollback.
- A-02: mutation ID travels with variables; original late A success updates A rather than B. Builder's delayed rejection and separate B-save tests also pass.
- A-03: preset-ready initialization closes both original hook and real-route wrong-target repros.
- A-04: removal of close-time preference reread preserves the in-memory selection under storage write failure.
- A-05: successful exact canonical reread now ends the pending-confirmation notice.
- A-06: construction body expectation now matches cache_enabled and non-g045 memory omission; named suite is green.
- Existing original event separation, ordinary SSE/async body checks, unresolved target and stable calibration remain green. These do not substitute for audio handoff integration.

### Project-path scope adjudication

The current frozen candidate's `src/test/p1d_paths.test.ts` runs **7/7**. The alleged two contradictory expectations do not reproduce:

- `"@[src/main.rs] "` has length 15; insertion after `"hello "` yields caret 6+15=21, exactly as the test expects.
- `"see @src/"` has length 9; caret 9 extracts `src/`, consistent with the incomplete-token rule.

No production or test change is warranted on this evidence. This path suite is not used as an extra A blocker. Full Project/composer acceptance remains in the previously defined B/final scope; a different alleged contradiction needs its exact failing command/assertion and baseline.

### Next repair sequence / recheck boundary

1. Before edits, restate the owner/phase/Conversation matrix for cache, upload and runtime handoff; distinguish same-operation continuation from conflicting new work.
2. Fix A-07's upload→dispatch transfer and A-08's Conversation-scoped cache pending/outcome state; coordinate shared files through pane 3.
3. Rerun original frozen probes plus new failing entry paths, sibling timing/error/route cases, then affected C1B/C1C integration tests. Do not repeatedly run unrelated full suites while these blockers are known.
4. Return exact changed files, invariant explanation, commands/counts and unexecuted cases. Do not edit the frozen Plan, independent probes or report. No scope expansion, provider/live or commit authorization is granted.

Evidence under `packages/app/node_modules/.cache/p1d-independent/`: `A-R2-original.log` (11/11), `A-R2-expanded.log` (12/15), `c-r2.test.tsx`, `A-R2-construction.log` (76/76), `A-R2-paths-triage.log` (7/7), `A-R2-typecheck.log`, `A-R2-lint.log`, `A-R2-diffcheck.log`, `A-R2-manifest.json`, `A-R2.diff`.

---

## Checkpoint A / R3 — PASS

### Factual summary and pinned candidate

**Verdict: Checkpoint A PASS.** This closes Task 2 + minimal HUD/cache integration and the A repair loop, not Checkpoint B, Task 6 or final C1D.

- HEAD: `63ff0b61d7587f0f9b4b3e5bbe7109c8ea7ff797`.
- Frozen Plan remains `a78ea9b754d385f212eb2eba01698297204a18928d5d2172771018b28401e43f`.
- Candidate: `A-R3-manifest.json`, SHA256 `ea9ef2ed69628418dc9d0cb3a29cb3ba916f706c2fd8b8a75f0c4e499b8b6269`; accompanying `A-R3-status.txt` and `A-R3.diff` record working-tree/staging boundaries.
- Compared with the R2 manifest, production changes are limited to `audio/audioRecoveryMachine.ts` and `control/useCacheControl.ts`. The other changed manifest entry is this Acceptance-owned report's previously appended R2 section. Original pinned independent a/b probes and frozen Plan remain unchanged.
- Manifest verified unchanged after post-pin regression/static/build execution and before this report append. App source and independent probes were not edited during this closeout.
- Seven A gate groups checked: **7 passed, 0 failed, 0 unchecked** at the agreed bounded intermediate-checkpoint scope. No open A findings remain: A-01–A-08 closed.
- Findings this cycle: new 0, residual 0, repair-regression 0, harness-defect 0, acceptance-miss 0.
- Independent: **4 files, 19/19 passed**, including original R1/R2 probes and R3 handoff/route-ownership probes.
- Affected construction/module regression: **11 files, 80/80 passed**.
- Unique executed total: **99/99 passed, 0 failed/errors/skips**. Repeated corroboration runs are not counted twice. Pane 3's separate 4/4 corroboration is not added to this total.
- App typecheck, lint, build and diff check: **exit 0**.
- Required bounded A pipeline: **executed**. Full app/V3/final C1D regression, real-browser visual checks and provider/live remain deferred to their approved later checkpoints, not claimed as passing here.
- Consecutive A FAIL count resets from 2 to **0** on this complete A PASS. Third-FAIL escalation was not triggered.

### Gate evidence and repair closure

| A gate group | R3 evidence / disposition |
|---|---|
| Target initialization and capability ownership | Original delayed-preset hook and actual-route probes remain green; source outside the two repaired owners is unchanged from R2. Validated target remains captured in dispatch settings rather than recomputed after upload. |
| Thinking save/route ownership | Original late response and confirmation probes plus construction ownership/PATCH tests pass. Exact originating Conversation remains the write/refetch target; no new chat transaction mechanism. |
| Local preference retention | Storage-write failure and HUD close/reopen probes remain green; the R1 close-time reread regression has not returned. |
| Cache ↔ send exclusion and route scoping | Original close-HUD pending-cache send exclusion passes. R2-C3 now allows B while A waits. R3-D2 exercises concurrent A/B operations and A→B→A: A completion does not clear B, and outcomes remain associated with their own Conversation. Rejection still releases the guard without an unhandled Promise. |
| Ordinary transport fields / unresolved target | Original serialization probes and runtime/client tests remain green; immutable controls and unresolved-target rejection are preserved. |
| Cache calibration / confirmed truth | Countdown, hidden calibration, stale confirmed data and cleanup tests pass; repair touches command ownership, not the authoritative cache Query or TTL calculation. |
| Audio / recovery integration | R2-C1/C2 now upload and dispatch once without retry. R3-D1 proves an unrelated send is blocked during upload and the owned continuation then succeeds. R3-D1b/D1c cover async handoff, including the actual Conversation route and HUD transport selection. Recovery/attachment integration regression preserves complete IDs/settings, no re-upload retry and delayed-upload departure/unmount invalidation. |

**A-07 closed:** successful upload now releases its upload-phase guard immediately before invoking runtime dispatch, without an intervening await. Runtime claims its predispatch owner synchronously. This fixes the operation blocking itself while preserving competing-command exclusion; no generic bypass or probe-keyed branch was added.

**A-08 closed:** pending invocations and mutation outcomes are associated with their originating Conversation. The page's shared boolean projects only the currently displayed Conversation; settling A recomputes that projection rather than blindly clearing B. Cache content remains Query-owned. This is a local command-ownership repair, not a second cache-data store or durable transaction system.

### Ledger

| Cycle | Checkpoint | Baseline | Verdict | Cause owners | Findings | Supersedes | Consecutive FAIL |
|---|---|---|---|---|---|---|---:|
| R3 | P1D-A | A-R3-manifest ea9ef2ed… on 63ff0b6 | PASS | Construction 0; Acceptance 0; Harness 0; Spec 0; Environment 0; Unknown 0 | none; A-01–A-08 closed | R2 current-candidate disposition | 0 |

### Limitations and permission

- “Actual route” above means deterministic rendered production route/components with simulated browser recording primitives and HTTP; it is **not** a real-device microphone or provider/browser live probe.
- No exhaustive timing permutation is claimed. The bounded repair probes, affected regression and source inspection support A closure; full storage/reload, Project/composer cross-path, structured trace and responsive/product sweep remain in the approved B/final pipeline.
- Broader Aura/Project acceptance and backend structured trace are outside A. The existing historical-image re-baseline remains unchanged. No new fallback or product re-baseline was introduced.
- **Pane 3 may release the A hold and coordinate the next approved construction phase.** Backend trace acceptance remains a separate prerequisite for its integration; no Task 6 or C1D PASS is implied.
- **No commit, provider/live or backend modification permission is granted.** Acceptance edited only this report and ignored evidence artifacts, with no production/construction edits or real DB writes.
- Opening and closing real AgentPreset baseline: exactly 8 rows, IDs 1–8.

Evidence directory: `packages/app/node_modules/.cache/p1d-independent/`. R3 logs: `A-R3-independent.log`, `A-R3-regression.log`, `A-R3-typecheck.log`, `A-R3-lint.log`, `A-R3-build.log`, `A-R3-diffcheck.log`. Probes: unchanged `a.test.tsx`, `b.test.tsx`, `c-r2.test.tsx`, plus `d-r3.test.tsx`.

---

## Final C1D acceptance — PASS

**Verdict: V4 Phase 1D PASS.** [gpt-5.6-sol / Solaire]

This verdict accepts the P1D candidate plus Alicia's final user-acceptance corrections U-01–U-06. It does not accept unrelated V3 lint debt or authorize a commit. Frozen Plan SHA256 remains `a78ea9b754d385f212eb2eba01698297204a18928d5d2172771018b28401e43f`.

### Accepted behavior

- Tactical HUD, immutable dispatch controls, cache calibration/renew/release, route ownership, audio handoff and existing C1B/C1C runtime invariants remain green.
- Aura has one page owner, three pointer-inert layers, local disclosure/edit state, reduced-motion behavior and valid list/button semantics.
- Project drawer and Composer autocomplete share the project tree; path insertion, stale-route exclusion, deep shell loading, IME and caret ownership pass.
- Structured AssistantRunTrace works across SSE, async and history; malformed trace is warning-only, legacy reasoning stays readable, tool-only and truncated-empty projections are represented truthfully, and raw `tool_calls` are absent from history serialization.
- Telemetry remains route-local and ephemeral; UI wording does not claim coverage of every accepted provider request.
- Responsive production layout retains back/title/More, target/HUD, Project and direct cache release controls without document overflow at 320/390/767/768/1280 px.
- [deepseek-v4 / Solaire Builder] U-01–U-06 add one-time initial latest positioning, a non-reflowing return-to-latest affordance, manual-bottom reconciliation, Alicia's Enter-newline/Shift+Enter-send preference, and a direct page-owned cache-release minus. The final scroll affordance is anchored to the timeline stage rather than a guessed Composer height.

### Final evidence

- Independent final focused repair recheck: **9 files / 71 tests**, all passed, no errors/skips/unhandled failures.
- Full exo-app suite after all repairs: **46 files / 382 tests**, all passed, no errors/skips/unhandled failures.
- exo-app typecheck and lint: exit 0.
- exo-app production build: exit 0; 4,366 modules and 89 PWA precache entries; only the existing chunk-size advisory.
- Earlier required gates retained on the unchanged relevant candidate: Checkpoint A independent **19/19**, affected A regression **80/80**, corrected historical C1B family **59/59**, backend AssistantRunTrace focused gate **53/53**, chat-core tests **85/85**, and monorepo production build PASS.
- Independent production-build Chrome matrix: 320/390/767/768/1280 px all had `document.scrollWidth === viewport width`; HUD focus/Escape restoration and no-reflow, Aura selection/reduced-motion, Project deep-file insertion and Trace disclosure passed. With an active cache, the direct 22 px release control remained visible at every width.
- Independent long-history Chrome check at 320 px: initial position was canonical bottom (`scrollTop=2171`, `scrollHeight=2632`, `clientHeight=461`); after scrolling away, the latest button occupied y=554.25–588.25 while Composer began at y=606.25, for **0 px overlap**.
- One Alicia-authorized live message through archived preset 3 and real `deepseek-v4-flash` emitted Thinking, `memory_search` start/terminal, telemetry and done. Persistence produced an available two-item projection; history exposed `assistant_run_trace` and omitted `tool_calls`. Temporary Conversations 131/132 and messages were removed; preset 3 was unchanged.
- Closing database baseline: AgentPreset exactly 8 rows, IDs 1–8; `memory.0055_message_assistant_run_trace` applied.
- `git diff --check` and `git diff --cached --check`: exit 0.
- Alicia's final production user check explicitly confirmed all four requested hand-feel outcomes and authorized PASS: initial latest position, bottom-button behavior, Enter/Shift+Enter behavior, and direct cache release.

### Scope disposition and omissions

- Alicia explicitly approved leaving V3 alone. Existing chat-core lint debt and chronicle/council ESLint-configuration debt are recorded as pre-existing, non-P1D and non-blocking; no P1D production path introduced those findings.
- No provider stress/load run, cross-browser matrix, real-device microphone pass or separate manual attachment pass was required. Existing deterministic attachment/audio regression remains green. The live provider probe was deliberately limited to one user message.
- Project interaction was verified through the production build in real Chrome against deterministic safe API fixtures; no real Project content was mutated for acceptance.
- No speculative hardening, new store/controller, additional persistence, V3 repair or unrelated refactor was admitted during final ablation review.
- No commit was created. Commit/release packaging remains a separate Alicia-authorized action.

### Final ledger

| Cycle | Gate | Verdict | Open P1D findings | Consecutive final FAIL |
|---|---|---|---:|---:|
| C1D-R1 | Initial deterministic/browser gate | FAIL | responsive top-bar overflow | 1 |
| C1D-R2 | Responsive recheck | PASS | 0 | 0 |
| U-R1 | Alicia hand-feel repair recheck | FAIL | U-05 button/composer overlap; U-06 delayed click | 1 |
| U-R2 | Final focused/full/browser/user recheck | **PASS** | **0** | **0** |

**Final release decision:** P1D acceptance hold is released. [gpt-5.6-sol / Solaire]
