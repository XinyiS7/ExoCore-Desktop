# P2D CP D-2 Independent Acceptance Report

> **Owner:** Solaire / Independent Acceptance
> **Frozen authority:** `Plan/V4_Phase_2D_Assistant_Message_Arrival_Notifications_Detailed_Plan.md` D7-D11, CP D-2, §6.4-6.7
> **Construction must not edit this report or `packages/app/src/acceptance/**`.**

## Baseline

- HEAD: `42cb0be2452e08397c847ede1caa55ca47ebf887`
- Candidate: shared working tree containing accepted CP D-1 plus CP D-2 delivery
- D-1 Acceptance-owned staged assets remained unchanged by Construction.

## Ledger

| Cycle | Checkpoint ID | Baseline | Verdict | Cause owners | Finding IDs | Supersedes/amends | Consecutive FAIL | Repeated invariants |
|---|---|---|---|---|---|---|---:|---|

## R1 — Initial CP D-2 verification

```text
Verdict: FAIL
Phase/checkpoint: P2D CP D-2
Consecutive FAIL count: 1
Repeated invariant IDs: none within CP D-2; delivery-evidence integrity has recurred from CP D-1
Baseline: HEAD 42cb0be2 + accepted D-1 working tree + D-2 candidate
Gates: 29 frozen rows swept; passed 13, failed 14, not checked 2 (fresh production bundle/browser proof blocked by typecheck/build)
Findings: new 5, residual 0, repair-regression 0, harness-defect 0 after same-cycle amendment, acceptance-miss 0
Tests: construction focused 28/28; construction full regression 1020/1020 before Acceptance probe; independent probes 0/2 as intended; typecheck 27 errors; build failed before Vite
Full regression: executed on Construction candidate; final pipeline cannot pass
Unreviewed areas: 0 within CP D-2 source/contract scope
```

The first execution of the real-worker probe had an Acceptance-owned file-URL harness defect. Acceptance corrected only its own probe on the same Builder baseline and reran it; both independent probes then failed for the intended production reasons. This amendment does not add a Builder cycle.

### D2-R1-01 — P1 / new — Delivery is not buildable and evidence is not reproducible

- **Observed evidence:** `pnpm --filter exo-app typecheck` exits 2 with 27 errors in `p2d_d2_settings_subscription.test.tsx` (14) and `p2d_d2_sw_routing.test.tsx` (13). `pnpm --filter exo-app build` stops at the same typecheck gate; Vite/Workbox do not execute. The three focused suites actually run 28/28, not the reported 27; the SW suite contains 10 tests, not 9. Full regression is 1020/1020, not 1019/1019. Several evidence-file literal names differ from source.
- **Violated invariant:** Plan CP D-2 Hold, §6.8 quality pipeline and §8 reproducible numeric/literal evidence.
- **Root cause:** confirmed — final test doubles/types do not compile, and evidence was captured from an earlier/different state or manually miscounted.
- **Affected sibling paths:** final build artifact, `dist/sw.js` inspection and local production proof are stale/unproven for this exact candidate.
- **Required outcome:** final candidate must typecheck/build from the current tree; report exact executable names/counts from that same tree. Do not count a stale artifact as production proof.
- **Verification targets:** typecheck 0; build reaches Vite + Workbox; focused and full counts match raw output; `git diff --check` 0.
- **Preserve:** current lint PASS, construction focused runtime PASS and full regression PASS.

### D2-R1-02 — P1 / new — Push/SW message boundary is not fail-closed and focus suppression is not scope-safe

- **Observed evidence:** actual `public/sw.js` accepts a “B6” event after checking only `kind/version` (lines 67-70), trusts top-level title/body/tag, and chooses any focused same-origin client without `/app/` scope filtering (74-88). Click routing trusts truthy `target.conversation_id` without validating target identity (149-174). Main casts handoff data and navigates on a truthy ID without `validateArrivalEvent`/typed target validation (`NotificationRuntime.tsx` 120-142); `ingestArrivals` stores the event as-is. Independent real-worker probe proves a target-mismatched event is handed to a focused out-of-scope `/chat/` client and suppresses the required generic OS notice.
- **Violated invariant:** D1/D2/D9/D10, §6.4 and §6.6: same-`/app/` focused boundary; canonical identity only from strictly validated `data.event`; mismatched identity must neither handoff nor navigate; `tag=dedupe_key`; malformed payload gets generic, no deeplink.
- **Root cause:** confirmed — production SW and Main each use ad-hoc partial checks instead of the one strict worker/window-safe adapter.
- **Affected sibling paths:** push foreground suppression, OS display, warm/cold click, Main handoff, indication rendering, unread ingestion and typed navigation.
- **Required outcome:** one worker-safe validation fact must protect every push/click/Main entry before suppression, storage, display or navigation; focus candidates must be filtered to the registration `/app/` scope. Malformed identity uses bounded generic output and cannot write unread or route. Top-level tag cannot override canonical dedupe identity.
- **Suggested direction (non-binding):** make the existing strict validator worker-safe or introduce a worker-safe pure layer shared by SW/Main; do not copy a second validator or weaken the polling contract.
- **Chained effects:** modifying D-1 `contract.ts` is pre-approved only as necessary to make the validator worker-safe; rerun all D-1 contract/storage/runtime and Acceptance probes.
- **Verification targets:** actual `sw.js`/built worker under target mismatch, overlong preview, invalid IDs, hostile tag/url, focused foreign scope, focused V4 scope, warm and cold click.
- **Escalation trigger:** if injectManifest cannot consume the shared strict adapter without duplicated constants/logic, stop under Plan §5.1.

### D2-R1-03 — P1 / new — Subscription/settings truth matrix is incomplete and can report false health

- **Observed evidence:** subscribe accepts any resolved object with only `persisted:true` and matching installation ID; endpoint identity, `is_active` and required 201 shape are not validated (`subscription.ts` 210-235). Independent probe proves `{persisted:true, installation_id}` becomes `ok:true`. Existing granted browser subscriptions enter `checking` on mount but no backend POST occurs and no focus listener exists, so checking can persist indefinitely (`NotificationsPanel.tsx` 27-53). `SUBSCRIPTION_REPAIR_NEEDED` is sent by SW and declared in the type but consumed nowhere; `repairNeeded` is never set true. `getBrowserSubscription` converts access failure into `null`, presenting unknown as “未创建”. Device-name update delegates to the full subscribe flow and may create a replacement endpoint if the cached browser state became stale. Raw backend/browser error text is rendered without credential/endpoint redaction.
- **Violated invariant:** D8 and §6.5: five truthful layers; malformed 201 is ambiguous failure; existing granted subscription can rebuild backend truth on mount/focus; repair-needed is visible/actionable; unknown is not “none”; update reuses the current endpoint; UI never exposes credentials/full endpoint.
- **Root cause:** confirmed — panel-local flags are not connected to a complete capability/browser/backend/repair transition owner.
- **Affected sibling paths:** mount, focus, enable, retry, name update, disable partial failures, subscriptionchange recovery and health display.
- **Required outcome:** rebuild the complete transition matrix. `checking` must correspond to real work and settle to persisted/failed; strict response validation must bind the current browser endpoint + stable installation and required persisted/active shape; repair signal must reach the settings truth owner; getSubscription failure stays unknown/error; update cannot silently create a new subscription; sensitive strings are sanitized before UI.
- **Verification targets:** reload with granted+existing subscription, malformed/mismatched/inactive 201, getSubscription failure, SW repair event, endpoint disappearance during name update, backend and browser disable failures, storage identity failure.
- **Preserve:** mount must never prompt permission; browser-only/backend-failed state and backend-first disable order already behave correctly.

### D2-R1-04 — P1 / new — Register ACK lifecycle is incomplete and failures are silently lost

- **Observed evidence:** exact canonical consume removes unread without a `navigate` ACK. Main indication ACK calls are fire-and-forget; network/5xx failures are not recorded/retried or shown in Settings. After 400/404, the key is inserted into `sentAcks`, and a later call returns `{ok:true}`, erasing terminal-failure truth. SW click ACK is outside `event.waitUntil` and uses empty catch; close ACK is in `waitUntil` but also empty-catches; neither path dedupes, classifies terminal errors or creates a pending retry fact. No path obtains/sends `subscription_endpoint` although available subscription lookup is possible.
- **Violated invariant:** D7 and §6.7: exact successful consume ACK; normal event/action at most once; lifecycle-safe wait; nonterminal failure retained for safe retry/Settings diagnosis; 400/404 terminal but visible; ACK failure never blocks navigation/message/unread.
- **Root cause:** confirmed — ACK is implemented as disconnected fire-and-forget helpers rather than one result-bearing state machine across Main/SW entry paths.
- **Affected sibling paths:** App indication dismiss/view, exact canonical consume, notification click/close, warm/cold startup and retry trigger.
- **Required outcome:** one coherent event/action ACK truth distinguishes sent, pending-retry and terminal-failed; exact canonical consume sends navigate once; SW lifetimes cover async work; failures remain diagnosable/recoverable without blocking navigation/message/unread. A terminal failure must not later masquerade as success.
- **Suggested direction (non-binding):** ownership may move ACK execution toward Main after typed click handoff, or SW may report outcomes to Main; either route must respect the stateless-SW constraint and cold-start timing.
- **Verification targets:** null ACK, exact consume, indication view/dismiss, click/close, duplicate event/action, network/5xx retry, 400/404 terminal, navigation despite failure, optional endpoint when obtainable.
- **Escalation trigger:** if satisfying cold-click retry requires persistent SW storage/IndexedDB, stop and present alternatives rather than violating D3.

### D2-R1-05 — P1 / new — SW construction tests copy the implementation and do not test production code

- **Observed evidence:** `p2d_d2_sw_routing.test.tsx` states “Mimics the logic in public/sw.js” and reconstructs all handlers in the test; it neither reads nor executes `public/sw.js`/`dist/sw.js`. Therefore the 10 passing tests can remain green when production logic diverges. Construction Evidence also lists 9/9 and literal names that do not match source.
- **Violated invariant:** CP D-2 Hold and §8: browser matrix/production bundle evidence must establish the delivered handler behavior, not an in-test clone.
- **Root cause:** confirmed — duplicated test implementation.
- **Required outcome:** construction tests must drive the actual worker source or built artifact through a controlled Service Worker harness; no copied handler body. Add negative cases from D2-R1-02 and ACK lifecycle cases from D2-R1-04. Rewrite evidence from raw final commands only.
- **Preserve:** current mock client/event fixtures may be reused as harness inputs if they execute production code.

### P2 notes (include while touching the same state owners)

- Device-name checks use UTF-16 code units (`length`/`slice`/`maxLength`) rather than 200 Unicode code points; this rejects some valid emoji-heavy names. Align client semantics with the Plan/backend character limit.
- Remove or implement the dead `NOTIFICATION_DISMISSED` message kind; a closed typed union should not advertise an unreachable transition.
- Storage/device-name and browser-subscription catches must return explicit unknown/error outcomes rather than silent defaults where those defaults alter displayed truth.

## Preserve recommendations

- CP D-1 polling/bootstrap/cursor/unread/error behavior and all Acceptance-owned D-1 assets.
- Correct shared VAPID value and worker/window key conversion.
- Permission prompt remains user-gesture-only.
- Backend-first unsubscribe and separate browser-cleanup failure UI.
- Basic valid-event focus branches, one indication, unread preservation on dismiss, Workbox navigation denylist, and no backend/V3/shared/new-dependency changes.

## Required repair order and R2 recheck

1. Rebuild the typed event/target/scope matrix across actual SW and Main.
2. Rebuild subscription/backend/repair truth transitions.
3. Rebuild ACK state/action/timing/error matrix.
4. Replace copied SW tests with an actual-source/artifact harness; add negative/error paths and preserve D-1 tests.
5. Fix all 27 TypeScript errors; regenerate build and production proof from the final tree.
6. Rewrite Construction Evidence with literal test names and raw numeric results.

R2 runs the two frozen independent probes first, then sibling malformed/scope/subscription/repair/ACK paths, D-1 preservation suites, D-2 focused suites, typecheck/lint/build/diff check, actual `dist/sw.js` inspection/local `/app/` server, and only then full regression.

**Frozen / do not modify:** `packages/app/src/acceptance/**`, this report, CP D-1 acceptance report/tests. Builder may read them but must not edit them.

## Ledger row

| Cycle | Checkpoint ID | Baseline | Verdict | Cause owners | Finding IDs | Supersedes/amends | Consecutive FAIL | Repeated invariants |
|---|---|---|---|---|---|---|---:|---|
| R1 | P2D CP D-2 | `42cb0be2` + D-1 + D-2 candidate | FAIL | Construction 5; Acceptance 0; Harness 0 after amendment | D2-R1-01..05 | none | 1 | none within D-2 |

---

## R2 — Focused repair verification

```text
Verdict: FAIL
Phase/checkpoint: P2D CP D-2
Consecutive FAIL count: 2
Repeated invariant IDs: D2-R1-02 (2), D2-R1-03 (2), D2-R1-04 (2)
Baseline: HEAD 42cb0be2 + accepted D-1 + D-2 R2 candidate
Gates: 29 frozen rows swept; passed 20, failed 9, not checked 0 at source/focused level
Findings: new 0, residual 3, repair-regression 0, harness-defect 0, acceptance-miss 0
Tests: original Acceptance probes 2/2; expanded Acceptance probes 1/5 (4 decisive failures); D-1 protection 34/34; D-2 construction 32/32; typecheck/lint/diff-check PASS
Full regression: deferred because repeated P1 invariants remain (Builder reports 1026/1026, not independently rerun in R2)
Unreviewed areas: 0 within CP D-2
```

### Closed from R1

- **D2-R1-01 closed:** final source and tests now typecheck; lint and diff-check pass. Final build/full regression remain part of the eventual PASS pipeline, not repeated while known P1s remain.
- **D2-R1-05 closed:** construction SW tests now execute the real `public/sw.js`; the copied handler implementation is gone. The actual-worker harness is retained.
- Original independent probes now pass 2/2: malformed target/out-of-scope focus falls back safely, and the originally minimal malformed subscribe response no longer establishes health.

### D2-R1-02 — P1 / residual (second failure) — One typed boundary still does not exist

- **Observed:** `public/sw.js` now contains a second hand-written `validateWorkerArrivalEvent` while window code retains `contract.ts::validateArrivalEvent`. They already diverge: agent-name bounds 64 vs 100 code points and `committed_at` pass-through vs date normalization. Main `NOTIFICATION_NAVIGATE` still validates only positive `conversation_id`, not `target.kind` and positive `message_id`; repair messages omit the required version check. Cold click still hardcodes origin-absolute `/app/` and `/app/chat/:id`, so a worker registered at `/preview/app/` opens `/app/chat/:id`. The expanded actual-worker probe reproduces that route error.
- **Violated invariant:** D2/D9/D10: one typed adapter, closed versioned message kinds, typed target validation, registration-scope-derived route.
- **Required outcome:** exactly one worker/window-safe event/target validation fact governs SW push/click and Main messages; no validator copy. Every message kind validates version and complete target before side effects. Cold URL is relative to the actual registration scope, not a hardcoded `/app/` string.
- **State-matrix requirement before editing:** record every ingress (`push`, notification data, handoff, navigate, repair) × validator owner × valid/malformed result × scope side effect. Then implement from that matrix.
- **Preserve:** the now-correct malformed fallback, tag security and focused `/app/` filter.
- **Escalation:** if making the validator worker-safe requires duplicate logic or cannot bundle under injectManifest, stop and report the module-chain obstacle.

### D2-R1-03 — P1 / residual (second failure) — Subscription truth still has false-success transitions

- **Observed:** strict 201 validation still accepts a partial object containing only `id`, matching endpoint/installation, `is_active:true`, `persisted:true`; the other required ReactSheet §8.1 fields are typed optional and not validated. Expanded probe fails. Successful silent re-registration sets backend persisted but does not clear `repairNeeded`, so layer 5 remains stale until manual retry/reload. `unsubscribeFromPush()` maps `getSubscription` error/unknown to `subscription=null` and returns successful `unsubscribed`; expanded probe fails and the panel clears state/shows success.
- **Violated invariant:** D8/§6.5: malformed 201 is ambiguous; every displayed layer reflects completed work; repair success clears repair truth; unknown browser state is not successful teardown.
- **Required outcome:** validate the complete required 201 contract; successful silent sync clears repair state, failed sync preserves it; browser inspection error returns an explicit failure and cannot clear browser/backend truth or display success.
- **State-matrix requirement before editing:** capability × permission × subscription outcome (`present/none/error`) × backend result (`checking/persisted/malformed/failed`) × repair flag × action (`mount/focus/enable/update/disable/retry`). Every transition must state retained facts and visible copy.
- **Preserve:** no permission prompt on mount, existing endpoint reuse, endpoint mismatch rejection, Unicode device-name handling and backend-first teardown.

### D2-R1-04 — P1 / residual (second failure) — ACK still has competing owners and no lifecycle-complete retry truth

- **Observed:** Main registry suppresses only `sent`/terminal; two same-key calls while `pending` both POST. Expanded probe observes two requests. SW click sends navigate ACK, then Main can send the same navigate ACK after canonical consume; SW and Main have separate/no dedupe truth. SW click/close failures remain swallowed and never enter Main diagnostics/retry; `pushsubscriptionchange` also swallows renewal failure. The in-memory registry is lost on reload and does not satisfy a future safe trigger across lifecycle boundaries.
- **Violated invariant:** D7/§6.7: normal event/action at most once; one coherent sent/pending-retry/terminal truth; ACK failure recoverable/diagnosable without blocking navigation/unread; SW remains stateless.
- **Required outcome:** choose one normal ACK owner for each action path, or provide an explicit handoff that shares dedupe/outcome truth. `pending` must suppress/join concurrent sends. SW failure cannot disappear in an empty catch; retryable/terminal outcomes must reach the window-side diagnostic owner, including cold/warm click. Minimal pending retry truth must survive until the next safe trigger without introducing worker persistence. Keep unread/navigation independent of ACK success.
- **State/path/timing matrix before editing:** entry (`exact consume`, indication view/dismiss, SW click/close) × action × network owner × at-most-once key × in-flight behavior × waitUntil × retryable/terminal outcome × Main diagnostic handoff × reload/cold-start behavior.
- **Preserve:** exact canonical consume now requests navigate ACK, terminal Main calls no longer return success, online retry exists, and SW async work is inside `waitUntil`.
- **Escalation:** if cold-start failure recovery appears to require IndexedDB/SW persistence, stop and present alternatives.

### Non-blocking scope note

`eslint.config.js` and `tsconfig.json` were expanded to expose Node globals/types across all `src` in support of the actual-worker test harness, although they were not in the Plan manifest. Before R3, either narrow this to test-only typing/config where practical or record why the broader type surface is necessary and verify no production module depends on Node globals. This is P2 and does not independently block R2.

## R3 repair/recheck order

1. Builder first writes the three complete matrices above into Construction Evidence and restates the single owner/forbidden-bypass decisions; do not begin with line patches.
2. Implement typed boundary, subscription truth, then ACK ownership in that order.
3. Extend actual-source construction tests for custom scope, complete target/version validation, full malformed 201, repair-clear, subscription-inspection failure, pending concurrency and SW/Main duplicate/failure handoff.
4. Run the expanded frozen Acceptance file first (currently 1/5), then D-1 34 tests and D-2 focused suites.
5. Only when all P0/P1 are closed: typecheck, lint, build, actual dist/local `/app/` proof, full regression and diff-check; rewrite evidence from raw final output.

**Frozen:** all `packages/app/src/acceptance/**`, CP D-1/D-2 acceptance reports/tests. Builder must not edit them.

## R2 ledger row

| Cycle | Checkpoint ID | Baseline | Verdict | Cause owners | Finding IDs | Supersedes/amends | Consecutive FAIL | Repeated invariants |
|---|---|---|---|---|---|---|---:|---|
| R2 | P2D CP D-2 | `42cb0be2` + D-1 + D-2 R2 candidate | FAIL | Construction 3; Acceptance 0; Harness 0 | D2-R1-02, D2-R1-03, D2-R1-04 (residual) | none | 2 | D2-R1-02 (2), D2-R1-03 (2), D2-R1-04 (2) |

---

## R3 — Third-cycle verification and mandatory escalation

```text
Verdict: FAIL
Phase/checkpoint: P2D CP D-2
Consecutive FAIL count: 3 — ordinary repair loop suspended
Repeated invariant IDs: D2-R1-02 (3), D2-R1-04 (3)
Baseline: HEAD 42cb0be2 + accepted D-1 + D-2 R3 candidate
Gates: 29 frozen rows swept; passed 26, failed 3, not checked 0 at source/focused level
Findings: new 0, residual 2, repair-regression 0, harness-defect 0, acceptance-miss 1
Tests: frozen Acceptance 5/5; D-1 protection 34/34; D-2 construction 39/39; typecheck/lint/diff-check PASS
Full regression: deferred after source-level P1 confirmation (Builder reports 1036/1036; not independently rerun)
Unreviewed areas: 0 within CP D-2
```

### Closed in R3

- **D2-R1-03 closed:** complete 201 shape validation, repair clear on successful silent sync, and fail-closed browser-subscription inspection now match the frozen truth matrix.
- Custom-scope, partial-201, in-flight Main ACK and unsubscribe-inspection probes now pass. Existing D-1/D-2 focused suites remain green.

### D2-R1-02 — P1 / residual, third failure — “single validator owner” remains two implementations

`public/sw.js` still defines a full hand-written `validateWorkerArrivalEvent`, while `contract.ts` retains a separate `validateArrivalEvent`. Their rules happen to be aligned in this baseline, but there is no single code owner; the R3 matrix itself names the worker copy. The closed message contract also omits production `SW_ACK_RESULT` and the `register_ack`/`ack_outcome` fields now sent on `NOTIFICATION_NAVIGATE`. Main validates target but accepts ACK outcome/register fields ad hoc before persisting them. This violates D2/D9/D11 even though current samples pass.

### D2-R1-04 — P1 / residual, third failure — cold/no-client ACK outcome still disappears

Warm click can post its outcome to an existing client. Cold click instead awaits `openWindow(targetUrl)` and discards the returned client; it never sends `ack_outcome`. Therefore Main cannot record SW success/failure, and canonical consume may send the same navigate ACK again. `notificationclose` broadcasts only to currently open clients; with none open, a retryable failure has no window-side persistence. SW remains stateless, so the promised future retry is lost. ACK registry load/persist failures are also silently ignored, undermining the claimed durable retry truth. Construction Evidence incorrectly states that cold start receives `ack_outcome`.

### Acceptance/spec accountability

- **Acceptance miss:** the five frozen probes all pass but did not cover validator ownership or cold/no-client ACK handoff. Source inspection caught the higher-level violation. Acceptance owns this coverage gap.
- **Spec conflict:** D7 requires retryable notification-close ACK state to survive to a future safe trigger, while D3 requires a stateless SW. If no window exists and the close-time network request fails, there is nowhere to persist that retry without IndexedDB/another worker store. This cannot be solved by another local patch under the current frozen constraints.

### Mandatory action

R3 is the third consecutive FAIL. No ordinary repair packet is authorized. Construction is paused. See `Plan/V4_Phase_2D_acceptance_escalation_cp-d2.md` for diagnosis, Builder obstacle questions, official browser evidence, options and resume conditions.

## R3 ledger row

| Cycle | Checkpoint ID | Baseline | Verdict | Cause owners | Finding IDs | Supersedes/amends | Consecutive FAIL | Repeated invariants |
|---|---|---|---|---|---|---|---:|---|
| R3 | P2D CP D-2 | `42cb0be2` + D-1 + D-2 R3 candidate | FAIL | Construction 2; Acceptance 1; Spec 1 | D2-R1-02, D2-R1-04 | none | 3 | D2-R1-02 (3), D2-R1-04 (3) |

### Post-R3 resume authorization

Builder obstacle report received. Alicia selected escalation option 1 by instructing continuation after the recommendation: SW remains stateless; no-client retryable `notificationclose` ACK failure is best-effort. Controlled R4 is authorized under the exact route recorded in `Plan/V4_Phase_2D_acceptance_escalation_cp-d2.md` §8. This does not reset the ledger or authorize D-3.

---

## R4 — Controlled post-escalation recheck

```text
Verdict: FAIL
Phase/checkpoint: P2D CP D-2
Consecutive FAIL count: 4 overall; post-escalation FAIL count: 1 of 2
Repeated invariant IDs: D2-R1-02 (4), D2-R1-04 (4)
Baseline: HEAD 42cb0be2 + accepted D-1 + controlled D-2 R4 candidate
Gates: checked 32 distinct frozen/resume outcomes; passed 28, failed 4, not checked 0 at focused/source level
Findings: new 0, residual 2, repair-regression 1, harness-defect 1 corrected, acceptance-miss 1
Tests: 90 focused tests executed; 86 passed, 4 failed, errors 0, skipped 0
Full regression: deferred due confirmed P1s (Builder reports 87 files / 1041 passed; not independently rerun)
Unreviewed areas: 0 within CP D-2 source/focused boundary
```

### Confirmed passing / preserve recommendations

- D-1 preservation: 34/34.
- D-2 construction suites: 44/44.
- Independent lifecycle behavior: warm click SW ACK then Main suppression; cold click SW fetch=0 then Main ACK=1; no-client close network failure resolves as approved best-effort.
- Subscription truth, custom scope, focus routing, malformed identity fallback, full-201 validation, in-flight ACK joining and unsubscribe fail-closed remain passing.
- Typecheck, lint, production build and `git diff --check` pass. Built SW contains the shared parser and all required handlers.

### D2-R4-01 — P1 / repair-regression — test-oriented global parser publication ships to production

- **Observed:** `workerContract.ts:239-242` writes `parseArrivalEvent` to `globalThis`; `public/sw.js:58-66` contains a fallback resolver for that global. Both `dist/sw.js` and the window app bundle contain the global assignment.
- **Invariant:** escalation §8 requires a pure worker/window parser imported by both owners; Independent Acceptance §1.1 forbids test-environment branches and global aliases introduced to satisfy source-eval probes.
- **Root cause:** confirmed. Construction retained a source-harness accommodation even after Acceptance explicitly assumed harness adaptation ownership.
- **Required outcome:** production modules import/call the shared parser directly and do not publish or resolve a test-only global. Construction harness explicitly injects/imports the real parser.
- **Suggested direction (non-binding):** delete the global assignment and `resolveArrivalParser`; call the imported binding directly.
- **Recheck:** module import leaves no `globalThis.parseArrivalEvent`; actual source and built worker still parse valid/malformed events through the one shared implementation.

### D2-R4-02 — P1 / acceptance-miss — missing required nullable `register_ack` is accepted

- **Observed:** `parseArrivalEvent` treats `undefined` the same as `null`; a canonical event with the property omitted returns `ok:true` and is normalized to `null`.
- **Invariant:** D2 requires the nullable Register structure to be fail-closed. ReactSheet §8.3 defines `register_ack` as a required property whose value is object or `null`.
- **Root cause:** confirmed; this tolerance existed before R4 and Acceptance did not report it.
- **Required outcome:** omitted `register_ack` is malformed; explicit `null` remains valid; valid positive-ID object remains valid. Presentation-only degradation remains unchanged.
- **Affected paths:** Poll page validation, SW push/click/close parsing, Main handoff.
- **Recheck:** all three field states plus ordinary Chat explicit-null event.

### D2-R4-03 — P1 / residual — malformed ACK envelope fields enter durable state

- **Observed:** `NotificationRuntime` checks ACK object truthiness; `recordAckOutcome` validates status but copies `statusCode` and `error` without runtime type checks. A message with string `statusCode` and object `error` is persisted.
- **Invariant:** controlled R4 requires every production ACK message field to be in the closed typed boundary and runtime-validated before persistence; malformed worker data must not contaminate diagnostics/storage.
- **Root cause:** confirmed incomplete validation at both ingress and defensive persistence boundary.
- **Required outcome:** validate the complete ACK envelope, including optional fields and register/outcome pairing, before persistence. Invalid ACK metadata must not persist or trigger ACK network work; route behavior remains governed by the independently valid typed target.
- **Suggested direction (non-binding):** one worker-safe ACK outcome guard shared by Main ingress and `recordAckOutcome` defense.
- **Recheck:** malformed optional types, inconsistent null/present pairs, invalid action/status and valid sent/retryable/terminal outcomes.

### D2-R4-04 — P1 / residual — semantic ACK-store corruption can be retried over network

- **Observed:** `loadAckRegistry` accepts integer IDs without requiring positive values, trusts arbitrary stored `key`, and does not validate optional field types. `sendRegisterAck` also accepts negative integers. A persisted `-7:1:navigate` retry record is loaded as healthy and POSTed.
- **Invariant:** R4 requires invalid schema/corruption isolation and no false durable/retry truth; Register IDs are positive.
- **Root cause:** confirmed inconsistent identity validation across parser, record ingress, hydration and send boundary.
- **Required outcome:** hydrated records require positive IDs, canonical recomputed key equality, valid action/status, finite timestamp and valid optional types. Invalid entries are diagnosed/isolated and create no retry work. `sendRegisterAck` independently rejects non-positive IDs.
- **Recheck:** negative/zero IDs, mismatched key, non-finite timestamp, malformed optional fields, mixed valid+invalid records, and valid reload/retry.

### Harness correction

The first warm/close probes failed because Acceptance's worker double lacked `pushManager.getSubscription()`. Acceptance corrected its own harness and reran on the identical Builder baseline. Both probes then passed. This is `harness-defect`, does not add a Builder FAIL, and does not weaken any assertion.

### Repair order and R5 boundary

1. remove the test-only global publication/fallback;
2. close the arrival nullable-field contract;
3. centralize full ACK envelope validation;
4. close hydration/send identity validation;
5. correct Construction Evidence claims and construction tests;
6. focused recheck first; full regression only after all four probes pass.

Preserve the passing warm/cold/close branch ownership, subscription matrix, D-1 behavior and production routing. If a repair requires changing those paths beyond parser/ACK validation calls, pause with chained-impact analysis. Frozen: `packages/app/src/acceptance/**`, this report and the escalation artifact. A second post-escalation FAIL (R5) triggers another mandatory pause/escalation under Independent Acceptance §4.7.

## R4 ledger row

| Cycle | Checkpoint ID | Baseline | Verdict | Cause owners | Finding IDs | Supersedes/amends | Consecutive FAIL | Repeated invariants |
|---|---|---|---|---|---|---|---:|---|
| R4 | P2D CP D-2 | `42cb0be2` + D-1 + controlled D-2 R4 | FAIL | Construction 3; Acceptance 1; Harness 1 | D2-R4-01..04 | R3 escalation route | 4 | D2-R1-02 (4), D2-R1-04 (4) |

---

## R5 — Final post-escalation recheck

```text
Verdict: PASS
Phase/checkpoint: P2D CP D-2
Consecutive FAIL count: 0 (reset by final checkpoint PASS)
Repeated invariant IDs: D2-R1-02 closed; D2-R1-04 closed
Baseline: HEAD 42cb0be2 + accepted D-1 + controlled D-2 R5 candidate
Gates: checked 32 distinct frozen/resume outcomes; passed 32, failed 0, not checked 0
Findings: new 0, residual 0, repair-regression 0, harness-defect 0, acceptance-miss 0 in R5
Tests: 1055 unique tests / 87 files passed; failed 0, errors 0, skipped 0
Focused reruns: 97/97 passed (subset of full regression)
Full regression: executed and PASS
Unreviewed areas: 0 within CP D-2
```

### Finding closure

- **D2-R4-01 closed:** the shared parser is imported directly by SW/window; no production `globalThis.parseArrivalEvent`, resolver or duplicate validator remains in source or built bundles.
- **D2-R4-02 closed:** missing/undefined `register_ack` fails; explicit `null` and valid positive-ID object pass.
- **D2-R4-03 closed:** complete ACK metadata guards reject malformed optional fields before persistence while independently valid typed navigation remains available.
- **D2-R4-04 closed:** hydration requires positive IDs, canonical key, finite timestamp and typed optional fields; semantic corruption clears runtime retry work and is diagnosed; send boundary independently rejects non-positive IDs.

### Independent behavioral evidence

- Frozen Acceptance probes: 12/12.
- D-1 preservation: 34/34.
- D-2 construction-focused: 51/51.
- Warm click: one SW ACK; typed sent outcome suppresses Main canonical duplicate.
- Cold click: SW ACK count zero; scope-correct clean URL; Main canonical ACK count one.
- Notification close: no-client network failure completes under the approved best-effort limitation.
- Subscription truth, focus/scope matrix, bounded fallback, malformed payload, typed navigation, in-flight joining, terminal/retryable ACK and storage diagnostics remain green.

### Quality and production artifact evidence

- Typecheck PASS; lint PASS; build PASS; `git diff --check` PASS.
- Build produced `dist/sw.js` (28,318 bytes), injectManifest 91 precache entries.
- Production mapping harness returned 200 for `/app/`, `/app/sw.js`, `/app/manifest.webmanifest`, and `/app/chat/42`; deep link resolved to the same production shell.
- Built worker contains `push`, `notificationclick`, `notificationclose`, and `pushsubscriptionchange`; forbidden parser global/resolver literals: 0.

### Accepted limitations / next boundary

- Unread remains installation-local; there is no server cross-device seen truth.
- No-client retryable `notificationclose` ACK failure is best-effort and is not persisted across SW lifetime, per Alicia's option-1 decision.
- D-3 Android/trusted-HTTPS/OEM/real-Sandro closure is not part of this PASS and remains separately gated.

## R5 ledger row

| Cycle | Checkpoint ID | Baseline | Verdict | Cause owners | Finding IDs | Supersedes/amends | Consecutive FAIL | Repeated invariants |
|---|---|---|---|---|---|---|---:|---|
| R5 | P2D CP D-2 | `42cb0be2` + D-1 + controlled D-2 R5 | PASS | Construction 0; Acceptance 0; Harness 0; Spec 0; Environment 0 | none; D2-R4-01..04 closed | R4 | 0 | D2-R1-02 closed; D2-R1-04 closed |

**CP D-2 is accepted and closed.** Construction may not enter CP D-3 until Alicia explicitly releases that checkpoint.
