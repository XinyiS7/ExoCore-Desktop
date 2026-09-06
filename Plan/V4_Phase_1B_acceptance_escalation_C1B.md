# V4 Phase 1B — C1B Three-FAIL Intervention Repair Plan

> **Owner:** `[gpt-5.6-sol / Solaire]` — independent Acceptance/adviser
> **Checkpoint:** C1B
> **Escalation epoch:** 1
> **Status:** **APPROVED — BOUNDED R4 REPAIR RESUME AUTHORIZED; C1B REMAINS FAILED PENDING RE-ACCEPTANCE**
> **Authority:** independent-acceptance three-FAIL rule + amended P1B Plan + Alicia's two explicit 2026-09-03 decisions
> **Detailed Plan:** `Plan/V4_Phase_1B_Core_Chat_Runtime_Detailed_Plan.md`
> **Superseded Detailed Plan SHA-256:** `c334c126c0f4b843eef03651adb53bcd4c27fc78446ef7019c34b38feac0c776`
> **Amended Detailed Plan SHA-256:** `03d040c21c69170e97ef545c2b829b7417dc7eeae5175d0f3db13fcc946c9d0e`
> **Related report:** `Plan/V4_Phase_1B_Core_Chat_Runtime_acceptance_report.md`
> **Advisory inputs:** Builder obstacle report `[deepseek-v4-flash / Ecki]`; read-only sibling/ablation draft `[gemini-3.8-flash / Alaric]`; final source/spec adjudication `[gpt-5.6-sol / Solaire]`
> **Construction ownership:** Construction may read this artifact but must not edit it.

---

## 1. Immediate control state

C1B has received three consecutive FAIL verdicts on distinct Builder baselines. R3 remains classified as a patch chain around a correct root-cause direction rather than a coherent transition model.

Alicia has now explicitly approved both the bounded R4 repair authority and the §6.4 deferred-fetch re-baseline. Acceptance amended the Detailed Plan, pinned its new SHA-256 above and issues the separate bounded `RESUME AUTHORIZED` record in §15. Construction may resume **only** the repair/order/verification surface in §§9–12.

Construction still must not:

- edit the amended P1B Plan, Acceptance report, this escalation artifact or `packages/app/src/test/acceptance/`;
- execute provider calls, production-browser geometry, V3/four-package/backend/deployment full regression or final Gate G work during focused R4;
- commit, revert, reset, unstage or otherwise disturb the preserved staged candidate;
- begin P1C, P1D or any scope outside §§9–12.

Current evidence envelope:

- Desktop HEAD: `fce0d5438e49c181e62be5b573e0f9f4baa06614`.
- R3 Builder candidate fingerprint recorded by the report: `c1dd6ace0ee402392d564694ec15e0c6049fbe06c88c27edb8f8af1b763f62bb`.
- The preserved staged envelope contains 34 paths, including Acceptance-owned report/probes and this formal plan; it is not a replacement Builder baseline.
- Outer HEAD: `e7dce77ed7f6ca2d979d8fb326bd1b4d11f2b2f6`; backend HEAD: `29368bbfcf31f64f3baa5c6ba3fec79662d6fb8a`.
- Real `AgentPreset` baseline: 8 rows, IDs 1–8.
- Provider budget used: two direct Python/API generation attempts. They corroborate backend behavior but do not satisfy the frozen actual-V4-UI live path.

---

## 2. Three-cycle diagnosis

| Cycle | Numeric evidence | Principal outcome |
|---|---|---|
| R1 | Construction 78/78; Acceptance 1/8 before repair | Seven production failures across durable write safety, lifecycle, protocol, identity, reconciliation and modal behavior |
| R2 | Construction 100/100; R1 probes 7/7 PASS; new probes 0/6 | Durable storage transitions, route identity and strict response validation remained incomplete |
| R3 | Construction 114/114; frozen R1+R2 probes 13/13 PASS; new probes 0/3 | Generic storage recovery and branch continuation asymmetry persisted; three-FAIL rule triggered |

### 2.1 Confirmed root causes

1. `status`, `busy`, `busySyncRef`, `runRef`, `pendingReconcileRef`, modal `locked` and generic recovery callbacks act as parallel safety truths.
2. Async acceptance writes a temporary tokenless `active` record before the complete token/cursor record.
3. Canonical fetch, Query application, runtime-marker mutation and UI unlock are coupled, so a later failure can create a zero-marker or unlocked gap.
4. Branch uses the lease schema but not the same authoritative operation identity and completion discipline.
5. Draft cleanup and runtime-operation recovery are incompatible concerns but currently compete for one callback-shaped retry slot.
6. The R3 direction is therefore correct, but continuing to add statuses/retry callbacks would extend the patch chain rather than close the invariant.

### 2.2 Causal ownership

- **Construction:** created multiple manual safety owners, emitted a temporary invalid async-active shape, ignored safety-relevant storage results and guarded branch continuations asymmetrically.
- **Acceptance:** R2 did not constrain the transition algebra tightly enough and allowed implementation-shaped statuses/retries to substitute for one authoritative state. This revision corrects that process miss.
- **Harness:** H-01 and H-02 were corrected and do not explain production failures.
- **Spec/environment:** no backend or browser contradiction requires a redesign or dependency. `localStorage` is synchronous and non-transactional; application-level atomicity means one complete value per logical transition.

External research remains unnecessary. The frozen Plan, staged source, deterministic probes and obstacle report are sufficient.

---

## 3. Binding ownership rule: one authoritative operation state

### 3.1 Single discriminated truth

The active route has exactly one authoritative discriminated route-runtime union, called `OperationState` here. Its exact TypeScript names and reducer layout are non-binding, but its ownership is binding:

```text
OperationState =
  | idle
  | storage_blocked_read(conversationId, reason, rereadRecovery, suspendedOperation?)
  | predispatch(callbackIdentity, requestIntent, expectedAbsent, pendingSnapshot)
  | live(callbackIdentity, transportPayload, validRuntimeSnapshot, persistRecovery?)
  | stopping(callbackIdentity, transportPayload, validRuntimeSnapshot, stopOutcome?)
  | reconciling(callbackIdentity, outcome, stage, validRuntimeSnapshot, waitForLatest?)
  | blocked(callbackIdentity, reason, validRuntimeSnapshot, recovery?)
```

Where:

```text
stableOperationOwner = stable lease fields already present in schema:
  conversationId + operation(send|edit|regenerate|branch)
  + transport + startedAt

expectedPriorSnapshot = the full exact mutable captured snapshot:
  stableOperationOwner + disposition + updatedAt
  + async token/cursor when present

callbackIdentity = ephemeral route epoch + stableOperationOwner
                   + destructive in-memory fact

transportPayload =
  | sse(local reader/control identity)
  | async(token, cursor)
```

The route epoch is an in-memory callback guard. It is **not** assumed durable and is not part of lease matching unless a separately approved schema change explicitly persists it. Cursor, `updatedAt` and disposition changes produce a new expected snapshot but do not change the stable operation owner or callback identity. Conditional storage ownership compares the full exact `expectedPriorSnapshot`; late route callbacks additionally validate the ephemeral epoch.

`storage_blocked_read` is part of this same authoritative union even though route entry may provide no operation identity or readable snapshot. It is entered whenever route-entry read or a conditional mutation's ownership-precondition read is unavailable, locks every write action and exposes only exact reread recovery. A known in-memory operation may be retained only as suspended context, never as proof of storage ownership. A successful reread transitions from its actual outcome: `absent → idle` or identity-appropriate reconciliation of suspended context; `valid(snapshot) →` the matching recovery/locked operation interpretation; `quarantined(reason) → idle` with a safe visible warning because quarantine succeeded; another `unavailable → storage_blocked_read`. No parallel mutable storage boolean is permitted.

`live_sse` and `live_async` are therefore one semantic `live` case plus a discriminated transport payload. Any async-active snapshot is constructed atomically and completely with both token and nonnegative cursor before its single write.

The following are projections only and may never become parallel mutable safety truths:

- `busy`;
- presentation `status` text;
- `locked` / action availability;
- `hasPendingReconcile`;
- Stop visibility;
- modal confirm availability.

If a React state value and a synchronous ref mirror are both needed, they mirror the **same complete `OperationState`** and may be updated only through one identity-checked `transition(...)` boundary. No independent `setBusy`, `busySyncRef`, `runRef`, `pendingReconcileRef` or modal safety flag may unlock or reinterpret the operation.

### 3.2 The former 11 phases are an invariant checklist, not 11 mandatory states

The original labels remain useful only as semantic checks:

| Semantic condition | Required invariant; it need not be its own state variant |
|---|---|
| idle | No operation identity owns the write lock. A safe local error may still be displayed. |
| predispatch | Identity and intent exist; zero POST until the complete pending marker succeeds. |
| live SSE | Same identity owns reader, marker and lock. |
| live async | Same identity owns token, cursor, marker, polling and lock; token/cursor snapshot is complete. |
| stopping | Same live identity remains authoritative until terminal/reconciliation; accepted stop is not terminal. |
| interrupted/resumable | Same async token/cursor and lock survive; manual resume uses current in-memory cursor. |
| runtime unavailable | If a prior marker is readable, it and its lock survive until an exact transition/clear succeeds. If route-entry storage cannot be read, the authoritative `storage_blocked_read` case has neither operation identity nor snapshot and locks all writes until exact reread resolves the real outcome. |
| reconciling | Fetch, apply, marker mutation and unlock are ordered separate effects. |
| scrolled-up pending reconcile | No canonical payload is held; marker and lock remain until return-to-latest starts one fresh reconciliation. |
| uncertain | Duplicate-write protection remains durable; no re-POST. |
| terminal clear blocked | Canonical result may be visible, but marker and lock remain until exact clear succeeds. |

`canonical_held` is deleted as both payload and phase. Protocol warnings and draft cleanup are ancillary facts, not operation phases.

### 3.3 Synchronous dispatch guard

All send/edit/regenerate/branch entry points consult the same current `OperationState` before any side effect. The transition from `idle` to `predispatch` is synchronous, so same-tick double click/Enter cannot dispatch twice. Branch is not a second lifecycle.

---

## 4. Minimal storage and recovery algebra

### 4.1 Runtime storage primitives

Runtime storage exposes only these data-oriented, conditional transitions:

```text
read-runtime(conversationId)
  -> absent | valid(snapshot) | quarantined(reason) | unavailable(reason)

persist-runtime(expectedPrior, nextSnapshot, constrainedAfter)
  expectedPrior = absent                       // pending creation only
                | expectedPriorSnapshot         // every replacement
  -> persisted(nextSnapshot)
   | conflict(observedSnapshot | absent)
   | precondition_unavailable(reason)
   | mutation_unavailable(reason, verifiedExpectedPrior)

clear-runtime(expectedPriorSnapshot, constrainedAfter)
  -> cleared
   | conflict(observedSnapshot | absent)
   | precondition_unavailable(reason)
   | mutation_unavailable(reason, verifiedExpectedPriorSnapshot)
```

Pending creation succeeds only if the observed key is still absent. Every replacement and clear succeeds only if the synchronously reread value exactly matches `expectedPriorSnapshot`.

The non-success outcomes are disjoint:

- `conflict(observedSnapshot|absent)`: the ownership precondition was read successfully but differs from expected. The observed state remains untouched and must be adopted or reread; this is an ownership conflict, **not** a storage failure.
- `precondition_unavailable`: expected ownership/absence could not be read. Enter authoritative `storage_blocked_read`; never infer idle, retain/clear a marker by assumption or run a success continuation.
- `mutation_unavailable(..., verifiedExpectedPrior)`: the precondition matched, but `setItem`/`removeItem` failed. Only this outcome may claim that the verified expected prior remains (or, for verified-absent pending creation, that absence remains) and expose the exact mutation retry.

This is same-tab captured-owner validation: synchronous compare-before-set/remove on the one JavaScript execution thread. It prevents a stale callback in this app instance from overwriting or clearing a newer lease. It is **not** a cross-tab CAS guarantee and adds no BroadcastChannel, distributed lock or backend idempotency requirement.

`persist-runtime` covers pending, complete active SSE, complete active async, cursor advancement and uncertain replacement. There are no separate `active_persist`, `cursor_persist` or `uncertain_persist` callback types. The requested snapshot itself contains the complete target data and exact expected prior owner.

`constrainedAfter` is a closed data enum describing the only legal success continuation, for example:

- continue the same live operation;
- begin first polling only after the complete initial async snapshot is durable;
- resume polling from the persisted cursor;
- remain blocked awaiting acknowledgement;
- proceed to canonical result completion;
- release the exact operation;
- complete one current-route branch navigation.

It is not an arbitrary callback and cannot perform generic `clear → refresh → unlock`. The transition owner validates both callback identity and storage ownership before applying it. Only `persisted`/`cleared` may execute the constrained success continuation.

### 4.2 No standalone predispatch retry

There is no `predispatch_retry` and no marker-only retry.

Every pending-creation non-success sends **zero POSTs** and preserves the complete draft/edit/action intent, but its ownership consequence is unambiguous:

- `mutation_unavailable(..., verifiedExpectedPrior=absent)`: the key was verified absent and only the subsequent set failed. Return to `idle` with a visible safe storage error; the user may press Send/Confirm again to rerun the **whole** transaction: synchronous lock → conditional pending creation against `absent` → exactly one POST.
- `precondition_unavailable`: absence could not be verified. Enter `storage_blocked_read`; lock every write and expose exact reread. Never return idle-by-assumption.
- `conflict(observedSnapshot)`: a lease already owns this Conversation. Adopt that observed snapshot into the corresponding authoritative locked/recovery interpretation; do not remain idle and do not dispatch. (`conflict(absent)` applies only when a replacement/clear expected a non-absent snapshot; it is not a pending-creation outcome.)

A successful later marker write may never leave an orphan `pending` marker without immediately continuing that same user-initiated transaction.

### 4.3 Durable runtime shapes

| Durable snapshot | Required complete data | Executable on re-entry? |
|---|---|---|
| pending | operation identity fields, Conversation, transport, timestamps, `pending` | No; duplicate-write protection only |
| active SSE | same identity, SSE transport, timestamps, `active` | No stream recovery; reconcile/uncertain on re-entry |
| active async | same identity, async transport, nonempty token, nonnegative cursor, timestamps, `active` | Yes; clean-overlay replay starts at cursor 0 |
| uncertain | same identity, transport, known token/cursor when available, timestamps, `uncertain` | No; reconcile/discover then explicit acknowledgement |

No writer may emit tokenless or cursorless active async data. `mutation_unavailable` after a verified match leaves that expected prior marker intact; `conflict` instead leaves the differing observed snapshot/absence untouched and adopts or rereads it.

### 4.4 Independent draft-cleanup recovery

`DraftCleanupRecovery` is Conversation-bound ancillary state and may coexist with operation persistence/reconciliation recovery. It only retries removal of the exact draft key.

It must never:

- clear or replace a runtime lease;
- change `OperationState`;
- unlock send/edit/regenerate/branch;
- cancel a reader/poller;
- acknowledge uncertainty.

If draft cleanup fails while a runtime persistence transition is non-successful, both outcomes remain visible and independently actionable. Repairing either one cannot erase the other.

---

## 5. Required transition algebra and failure postconditions

Every row is an invariant. Names of state variants, reducers or helpers are not acceptance authority.

| Path / failed step | Durable marker after failure | Operation/UI after failure |
|---|---|---|
| Pending creation before dispatch | `mutation_unavailable` after verified absence leaves absence; `conflict` leaves its differing observation untouched; `precondition_unavailable` establishes nothing | Zero POST and draft/action preserved. Only verified-absent mutation failure returns idle + safe full-transaction retry; conflict adopts/rereads observation; precondition read failure enters `storage_blocked_read` |
| SSE acceptance → complete active persist | On mutation failure after exact pending match, pending remains. On conflict, the differing observed snapshot/absence remains untouched. On precondition read failure, ownership is unknown | Reader/control stay in suspended authoritative context and writes remain locked; exact mutation retry is available only for verified-prior mutation failure; conflict adopts/rereads; unknown ownership enters `storage_blocked_read` |
| Async validated 2xx → complete active persist | On mutation failure after exact pending match, pending remains; on conflict, differing observation remains untouched; on precondition read failure, ownership is unknown; never tokenless active | Token/cursor and Stop/control remain available in authoritative/suspended context; no re-POST; the **first polling GET must not begin** until the complete token+cursor active snapshot is durably persisted against the exact pending owner |
| Processing poll advances cursor → persist | On mutation failure after exact active-snapshot match, that prior snapshot remains; on conflict, differing observation remains untouched; on precondition read failure, ownership is unknown | Latest token/cursor remain suspended in memory and next GET pauses; exact mutation retry only follows verified prior, while conflict adopts/rereads and precondition read failure enters `storage_blocked_read` |
| Draft removal after acceptance | Runtime marker unchanged | Live/stop/reconcile behavior unchanged; draft-only recovery remains reachable |
| Unknown write → uncertain replacement | On mutation failure after exact prior match, that pending/active snapshot remains; on conflict, differing observation remains untouched; on precondition read failure, ownership is unknown | Locked; exact uncertain mutation retry only follows verified prior; conflict adopts/rereads; precondition read failure enters `storage_blocked_read`; acknowledgement is not yet legal |
| Terminal canonical fetch | Prior marker remains | Overlay/result and lock remain; explicit reconciliation retry |
| Canonical apply | Prior marker remains | Previously valid displayed Query state remains on failure; lock remains |
| Marker transition, including active → uncertain | Verified-prior mutation failure leaves that exact prior; conflict leaves differing observation untouched; precondition read failure establishes no owner | No zero-marker gap or success continuation; exact mutation retry only after verified prior, otherwise adopt/reread or enter `storage_blocked_read` |
| Marker clear after successful apply | Verified-prior remove failure leaves that exact marker; conflict leaves differing observation/absence untouched; precondition read failure establishes no owner | Canonical data may display, but unlock is forbidden; exact clear retry only after verified prior, otherwise adopt/reread or enter `storage_blocked_read` |
| UI completion/unlock | Reached only after required marker clear | Identity is rechecked; then and only then project `busy=false`/actions enabled |
| Explicit uncertain acknowledgement fetch/apply | Marker remains on failure | No unlock; retry the failed reconciliation step |
| Explicit uncertain acknowledgement clear | Verified-prior remove failure leaves that exact marker; conflict leaves differing observation/absence untouched; precondition read failure establishes no owner | No unlock; exact clear retry only for verified-prior mutation failure, otherwise adopt/reread or enter `storage_blocked_read` |
| Fresh async re-entry | Existing active token/cursor retained | Canonical history first; clean overlay replays same token from cursor 0 |
| Manual transient polling resume | Existing active snapshot retained | Resume from authoritative in-memory cursor, not 0 |
| SSE route departure | Conditional uncertain replacement: success stores uncertain; verified-prior mutation failure leaves exact prior; conflict leaves differing observation untouched; precondition read failure establishes no owner | Local reader cancels; no stop; writes remain locked; stale callbacks cannot mutate current route or run a success continuation |
| Stale persist/clear after a newer same-Conversation lease appears | Newer observed lease remains byte-for-byte owned; conditional transition returns `conflict(observedSnapshot)` | Stale callback performs no success continuation, unlock or navigation; authoritative route state rereads/reconciles rather than guessing ownership |
| Route-entry read unavailable | No readable snapshot is assumed absent or fabricated | Enter authoritative `storage_blocked_read`; lock all writes; exact reread alone resolves absent/valid/quarantined/unavailable |

For SSE/async `not_found`, uncertain writes, terminal outcomes and branch outcomes, marker replacement is always one conditional `setItem`-style replacement of an exactly matched valid old value; clear occurs only at the final legal release step and only against the exact expected prior snapshot. None may implement `clear old → write new`, so none may create a zero-marker gap or let a stale callback damage a newer lease.

---

## 6. Branch uses the same operation identity and lock

### 6.1 Ownership

`operation:'branch'` enters the same synchronous `idle → predispatch` transition, durable pending write and lock as send/edit/regenerate. `BranchConfirmModal` owns presentation only:

- open/closed target presentation;
- focus/Escape behavior;
- display of operation-projected errors.

It owns no independent `submitting`/`locked` safety truth. Confirm availability is derived from the authoritative operation identity/state. Closing a modal cannot clear a lease or unlock an ambiguous/clear-blocked branch.

### 6.2 Outcome matrix

| Branch outcome | Marker and operation | Current caller | Stale caller |
|---|---|---|---|
| Positive canonical `conversation_id` | Retain result in operation state; refresh Recent; clear captured source marker; unlock only after clear | Navigate exactly once only after every await revalidates caller route/epoch | Refresh Recent/clean captured source when possible; no current-route mutation or navigation |
| Safe 4xx rejection | Conditionally clear exact captured source snapshot: verified-prior remove failure leaves it; conflict leaves the differing observation untouched; precondition read failure enters storage-blocked ownership recovery | Show retryable backend error/unlock only after `cleared`; all other outcomes remain locked without stale continuation | No current-route mutation; source ownership is recovered from exact mutation result/reread |
| Malformed 2xx/network ambiguity | Conditionally persist uncertain over exact pending owner; refresh Recent; no re-POST | Stay locked; discover via Recent/ack flow | Same durable handling; no current-route mutation/navigation |
| Uncertain persist non-success | Verified-prior mutation failure leaves pending; conflict leaves differing observation untouched; precondition read failure establishes no owner | Exact mutation retry only for verified prior; otherwise adopt/reread or storage-block | Re-entry exposes source recovery/discovery |
| Success then clear non-success | Canonical result remains in operation state; storage observation follows the exact outcome above | At most one later navigation only after a conditional clear returns `cleared` and caller identity remains current | Never navigate stale caller |

### 6.3 Caller-side route/epoch guard

The runtime controller's identity guard is necessary but insufficient. `ConversationPage` captures a caller identity before confirmation and rechecks it:

1. after `branchFrom` resolves;
2. after Recent invalidation/refetch resolves;
3. immediately before `navigate`.

A route switch, modal close, target change or unmount invalidates that caller. The page must then do no stale navigation. Route change also closes/resets branch and truncation modal targets so an old target cannot appear in another Conversation.

Branch pending/uncertain re-entry refreshes Recent without issuing a branch POST. Navigation identity remains only the positive canonical `conversation_id`, never `session_id`, name or latest-ID inference.

---

## 7. Four separated reconciliation responsibilities

Construction must expose independently testable effects for an explicit captured identity:

1. **fetch canonical newest window** — network only; no Query mutation, marker mutation or unlock;
2. **apply canonical window** — the single append/destructive Query owner; no marker mutation or unlock;
3. **persist/clear runtime marker** — exact captured Conversation only; no Query mutation or unlock;
4. **complete route UI** — identity-checked projection/unlock only after required prior steps succeed.

No boolean `skipClear`, generic retry callback or helper that combines these responsibilities is acceptable. Each awaited boundary rechecks `{epoch, conversationId, operation}` before the next effect.

Failure and ownership rules:

- fetch failure: old displayed Query data, last known marker interpretation and lock remain;
- apply failure: old valid Query state, last known marker interpretation and lock remain;
- marker mutation `mutation_unavailable` after verified expected prior: that exact prior and lock remain; exact mutation retry is legal;
- marker mutation `conflict`: differing observed snapshot/absence remains untouched and is adopted/reread; this is not a storage failure and no stale success continuation runs;
- marker mutation `precondition_unavailable`: ownership is unknown; enter authoritative `storage_blocked_read` and keep writes locked;
- clear returns `cleared`: only then may identity-checked UI completion/unlock run;
- stale identity after any await: no current-route Query/UI/unlock/navigation mutation; source marker policy uses the captured stable operation owner plus exact expected prior snapshot.

Destructive edit/regenerate application still resets/rebuilds the complete Conversation message-query family so deleted descendants cannot reappear. Normal send uses one newest-window merge/rebase owner rather than refetching shifting offsets.

---

## 8. Proposed §6.4 re-baseline: scrolled-up reconciliation

This revision deliberately reverses the prior intervention draft's `fetch-then-hold` reading and deletes `canonical_held`.

### 8.1 Required behavior if Alicia approves this narrow re-baseline

When a terminal/uncertain outcome arrives while the user is no longer at latest:

1. do **not fetch** canonical history;
2. do **not apply** Query data;
3. keep the runtime marker and authoritative operation lock;
4. preserve the displayed pages, viewport and runtime overlay;
5. project only that reconciliation is pending.

When the user chooses “return to latest”:

1. recheck the captured operation/route identity;
2. perform exactly one fresh offset-0 canonical fetch;
3. apply through the append/destructive owner;
4. clear the exact runtime marker;
5. unlock/clear overlay only after clear succeeds.

If fetch or apply fails, the last known marker interpretation and lock remain. For clear: verified-prior mutation failure leaves that exact marker and permits exact retry; conflict leaves the differing observation untouched and requires adoption/reread; precondition read failure enters `storage_blocked_read`. None sends a POST or unlocks.

### 8.2 Explicit tradeoff

Deferring the fetch prevents a stale held payload and avoids background mutation while the reader is away from latest, but it delays discovery and display of canonical-fetch errors until the user returns to latest. This delayed error exposure is accepted by the proposed re-baseline. It must be visible at that time and cannot silently unlock.

Alicia explicitly approved this narrow re-baseline on 2026-09-03. Acceptance amended `Plan/V4_Phase_1B_Core_Chat_Runtime_Detailed_Plan.md` §6.4 before authorization; its superseded and amended SHA-256 values are pinned in this document header. The Detailed Plan and intervention authority now agree: scrolled-up terminal/uncertain reconciliation defers fetch/apply until return-to-latest and has no `canonical_held` design.

---

## 9. Exact repair surface after authorization

This section defines a maximum expected surface, not current authorization.

### 9.1 Production files expected

- `packages/app/src/features/chat/runtime/types.ts` — authoritative discriminated operation and data-only recovery contracts.
- `packages/app/src/features/chat/runtime/storage.ts` — `read-runtime`, `persist-runtime`, `clear-runtime` outcomes and complete durable shapes.
- `packages/app/src/features/chat/runtime/useChatRuntime.ts` — one transition owner, identity guards, storage/reconcile sequencing and branch integration.
- `packages/app/src/features/chat/queries.ts` — isolated fresh-window fetch and append/destructive application owners.
- `packages/app/src/features/chat/RuntimeStatusBanner.tsx` — projections/actions from operation state plus independent draft cleanup.
- `packages/app/src/features/chat/ConversationPage.tsx` — caller route/epoch guards and route-switch modal reset.
- `packages/app/src/features/chat/BranchConfirmModal.tsx` — removal of independent branch safety truth; presentation/accessibility only.

### 9.2 Construction-owned tests/evidence expected

Construction tests may be corrected/expanded around §11 observable invariants. `Plan/V4_Phase_1B_Construction_Evidence.md` must record:

- the authoritative state/transition inventory;
- every runtime lease read/write/clear call site and postcondition;
- every canonical fetch/apply and UI unlock call site;
- every branch continuation and caller guard;
- simultaneous ancillary/operation failure evidence;
- exact commands/counts after authorization.

Acceptance probes remain immutable and unread by Construction.

### 9.3 Pause-before-expansion

Pause before touching any other production file, backend/outer repository, API contract, dependency/lockfile, V3 source, P1C/P1D surface or Acceptance-owned artifact.

---

## 10. Preserve and forbid

### 10.1 Preserve

- all 16 frozen Acceptance probes: R1 seven + R2 six + R3 three;
- strict R2-03 async ack, poll envelope/cursor/event, stop envelope, shared normalized-event semantics and backend machine-code validation;
- stop-before-abort, retryable stop failure and no automatic stop on navigation;
- fresh async re-entry from cursor 0 and manual transient resume from current cursor;
- persisted role/Conversation action validation and `thinking_level` preservation;
- destructive query-family reset and no truncated-descendant resurrection;
- dialog focus/Escape/restore behavior and safe-area styling;
- V4-only storage namespace and no V3 key migration;
- canonical branch `conversation_id`, Recent discovery and no identity guessing;
- backend/outer checkpoints, PWA topology and all P1C/P1D/P2 exclusions.

### 10.2 Explicitly forbidden

- Redux, XState, Zustand, any global store/event bus or global run registry;
- backend idempotency/token-persistence redesign;
- cross-tab lock/BroadcastChannel or background/app-wide SSE continuation;
- a new dependency;
- arbitrary callback-style generic retry or generic success cleanup;
- standalone predispatch/marker-only retry;
- temporary active async data without token/cursor;
- `canonical_held` phase or payload;
- a second branch lock/send lifecycle or automatic branch re-POST;
- changing reload recovery from cursor 0;
- changing strict protocol behavior without a direct demonstrated dependency;
- editing Acceptance probes or weakening the 16-probe baseline;
- P1C/P1D/P2+, backend, V3, deployment or pagination-architecture expansion.

---

## 11. Invariant-based R4 acceptance matrix

No raw test implementation or enum/helper name is supplied to Construction. Probes assert observable invariants only.

### 11.1 Seven first-wave probes

1. **Accepted async snapshot atomicity:** after a validated acknowledgement, no non-success may emit tokenless/cursorless active data or send a second POST. Verified-prior mutation failure leaves pending; conflict preserves/adopts the differing observation; precondition read failure storage-blocks. Stop/control remains available from known suspended context, and zero polling GETs begin until the complete token+cursor snapshot is durably persisted against the exact pending owner.
2. **Draft cleanup isolation:** accepted SSE/async plus draft-removal failure keeps the live marker/reader or token and exposes a draft-only recovery that cannot clear/unlock the operation.
3. **Branch safe rejection with conditional-clear non-success:** exactly one POST; verified-prior remove failure leaves the captured marker, conflict preserves/adopts the differing observation, and precondition read failure storage-blocks; every case keeps the operation locked and the modal cannot create a second safety truth or permit retry before `cleared`.
4. **No operation-created marker gap for `not_found`:** canonical/reconciliation and uncertain-transition handling never clears before conditional replacement. Verified-prior mutation failure leaves the exact prior; conflict leaves its differing observation—including already-absent—untouched and adopts/rereads it; precondition read failure storage-blocks. No non-success permits a fresh writer after reload.
5. **Branch re-entry discovery:** a pending/uncertain branch marker refreshes Recent without a branch POST.
6. **Stale branch completion:** route departure before 201 prevents current-route UI/modal mutation and prevents caller-side invalidation completion from causing stale navigation; source handling stays identity-bound.
7. **Scrolled-up deferral:** terminal while away from latest performs no fetch and no apply, preserves marker/lock/viewport; return-to-latest performs one fresh fetch, then apply, clear and unlock in order.

These replace the previous first-wave wording that bound probes to implementation phase/recovery names. They do not replace or reduce the 16 frozen probes.

### 11.2 Required sibling invariants

- pending creation verified-absent mutation failure preserves draft/action, sends zero POST and user retry reruns one complete transaction; precondition read failure storage-blocks; conflict also sends zero POST but adopts/rereads the observed state instead of enabling retry;
- SSE active, async active, cursor and uncertain transitions distinguish verified-prior mutation failure (expected prior remains), conflict (differing observation remains and is adopted/reread) and precondition read failure (`storage_blocked_read`);
- poll cursor transition non-success pauses subsequent GET until the exact latest snapshot is durable against the expected prior; conflict/precondition-unavailable follows ownership recovery rather than exact mutation retry;
- terminal conditional-clear non-success after done/stopped/error and destructive edit/regenerate retains result and lock while following the exact mutation/conflict/precondition outcome;
- uncertainty acknowledgement fetch/apply failure retains last known marker interpretation and lock; conditional-clear non-success follows the exact outcome without stale continuation;
- same-route branch success plus conditional-clear non-success retains canonical result; navigation remains blocked until exact owner clear returns `cleared`, then occurs at most once;
- stale safe rejection and stale ambiguity never mutate current-route UI;
- route switch closes/resets branch and truncation modals;
- caller route/epoch is checked after branch resolution, after Recent invalidation and before navigation;
- simultaneous draft-cleanup failure and operation-storage non-success leave both recovery paths reachable;
- unmount SSE uncertain transition: verified-prior mutation failure leaves that prior safe; conflict preserves/adopts the differing observation; precondition read failure storage-blocks;
- stale persist and stale clear callbacks confronted with a newer same-Conversation lease both return conflict, preserve the newer lease and perform no success continuation;
- route-entry read unavailability locks every write without inventing identity/snapshot; reread transitions correctly for absent, valid, quarantined and repeated-unavailable outcomes;
- normal send and destructive reconciliation obey their respective Query ownership rules;
- **all** production runtime lease read/write/clear call sites have an explicit audited postcondition; no unchecked safety-relevant result remains;
- every UI unlock/action-enabled path is traceable to the authoritative operation transition after required marker clear.

### 11.3 Verification order after authorization

1. audit source call sites before code and restate the transition algebra;
2. run the seven invariant probes and sibling matrix;
3. rerun frozen R3 probes: 3/3 required;
4. rerun frozen R1+R2 probes: 13/13 required;
5. run complete Construction app tests and app typecheck/lint;
6. inspect the final lease/reconcile/branch/unlock call-site inventory;
7. stop for Acceptance verdict.

No production-browser geometry, V3/four-package/backend/deployment full regression or provider call is authorized during focused repair. Final regression is defined only after no P0/P1 remains.

---

## 12. Dependency-aware repair order after authorization

1. **Inventory before edit.** Enumerate every operation truth, runtime lease read/write/clear, draft clear, canonical fetch/apply, UI unlock, modal lock and branch continuation. Acceptance acknowledges the inventory before code.
2. **Install one operation transition owner.** Replace parallel truth variables with the discriminated `OperationState`; derive all lock/status/busy/pending projections.
3. **Reduce storage algebra.** Implement data-only `read-runtime`, conditional `persist-runtime(expectedPrior, nextSnapshot, constrainedAfter)` and conditional `clear-runtime(expectedPriorSnapshot, constrainedAfter)` with distinct success, ownership-conflict, precondition-read-unavailable and verified-prior mutation-unavailable outcomes; remove callback retries and tokenless async writes.
4. **Separate ancillary draft recovery.** Prove concurrent draft/runtime failure reachability and non-interference.
5. **Separate reconciliation effects.** Implement fetch, apply, marker mutation and unlock boundaries; enforce no-marker-gap ordering for terminal/uncertain/`not_found`.
6. **Integrate branch.** Use the same operation identity/lock and captured-source transitions; remove modal-owned safety; preserve canonical result through conditional-clear non-success while applying the exact outcome semantics.
7. **Guard the caller.** Reset route modals and guard every branch invalidation/navigation await in `ConversationPage`.
8. **Implement approved scrolled-up behavior.** Only after Alicia explicitly approves §8 re-baseline.
9. **Correct Construction tests/evidence.** Assert invariants, not enum/helper names; preserve Acceptance artifacts.
10. **Focused handback only.** Run §11.3 and return to Acceptance; no autonomous next phase.

Stop before expansion if any step appears to require a second send path, backend idempotency, global/multi-Conversation runtime state, Query pagination replacement, new dependency or unapproved frozen-Plan amendment.

---

## 13. Alicia decisions and Gate G

### 13.1 Decisions recorded

Alicia explicitly decided on 2026-09-03:

1. **APPROVED:** this revised minimal state/recovery algebra is the bounded R4 repair authority.
2. **APPROVED:** §6.4 is re-baselined so scrolled-up terminal reconciliation performs no fetch/apply until return-to-latest, accepting delayed fetch-error exposure.

Acceptance then amended the Detailed Plan §6.4 and pinned the new SHA/fingerprint before issuing §15. No contradictory authority remains.

### 13.2 Final live Gate G — later decision

No provider call is authorized now. After deterministic focused repair and final regression converge, Alicia must separately choose:

- authorize the minimum additional actual-V4-UI live provider budget; or
- explicitly re-baseline/waive the actual-UI live requirement while retaining the direct probe as backend corroboration.

This later decision does not block revising the deterministic model and must not be mixed into R4 construction.

---

## 14. Resume conditions and current disposition

Bounded R4 resume prerequisites:

- [x] three-cycle evidence and obstacle diagnosis recorded;
- [x] patch-chain classification and authoritative-state correction recorded;
- [x] conditional captured-owner storage algebra, read-unavailable route state and failure postconditions recorded;
- [x] branch caller/modal ownership and no-marker-gap rules recorded;
- [x] 16 frozen probes preserved and first-wave probes rewritten as invariants;
- [x] exclusions and call-site audit requirements recorded;
- [x] Alicia approved the revised R4 repair authority;
- [x] Alicia explicitly approved the §8 scrolled-up reconciliation re-baseline;
- [x] Acceptance narrowly amended Detailed Plan §6.4, recorded the new SHA/fingerprint and updated authority references;
- [x] Acceptance appends the separate `RESUME AUTHORIZED` record in §15 naming C1B, escalation epoch 1, pinned baseline and R4 scope;
- [x] Acceptance sent the bounded authorization to the waiting Builder pane `[Solaire / pane 3 → Ecki / pane 4 / 2026-09-03]`.

```text
C1B: FAIL (R3; consecutive FAIL count remains 3)
Three-FAIL intervention epoch: 1
Formal intervention plan: APPROVED / BOUNDED R4 AUTHORITY
Construction edits/focused tests: AUTHORIZED ONLY UNDER §§9–12
Checkpoint commit: NOT AUTHORIZED
P1C: LOCKED
Full regression: DEFERRED
Provider calls: FORBIDDEN
RESUME AUTHORIZED: YES — BOUNDED R4 ONLY
```

---

## 15. Separate Acceptance resume authorization

```text
RESUME AUTHORIZED
Checkpoint: C1B
Escalation epoch: 1
Issued by: independent Acceptance / Solaire
Alicia decisions: bounded R4 authority APPROVED; §6.4 deferred-fetch re-baseline APPROVED
Desktop code baseline: fce0d5438e49c181e62be5b573e0f9f4baa06614
Preserved R3 Builder candidate fingerprint: c1dd6ace0ee402392d564694ec15e0c6049fbe06c88c27edb8f8af1b763f62bb
Amended Detailed Plan SHA-256: 03d040c21c69170e97ef545c2b829b7417dc7eeae5175d0f3db13fcc946c9d0e
Authorized scope: this plan §§9–12 only
R4 handback: stop after focused verification for independent re-acceptance
Commit: NOT AUTHORIZED
P1C/P1D/full regression/provider calls: NOT AUTHORIZED
```

---

## 16. Escalation epoch 2 — R5 second post-intervention FAIL

> **Status:** **C1B: PASS — GATE G EXECUTED AND CLOSED; CHECKPOINT COMMIT PENDING ALICIA APPROVAL**
> **Triggered by:** R4 FAIL followed by R5 FAIL after epoch-1 adviser intervention
> **R5 Builder fingerprint:** `9989666a8e1c3aa78f225eaeca3e65546f00ce02d256f149a3955d702315412a`
> **Authority unchanged:** Detailed Plan SHA-256 `03d040c21c69170e97ef545c2b829b7417dc7eeae5175d0f3db13fcc946c9d0e`

### 16.1 Why epoch 2 triggered

R5 repaired the two directly observed R4 examples: all 18 earlier Acceptance probes now pass, and the R4/R5 Construction invariant suites pass 20/20. However, three decisive sibling combinations still violate the already-approved algebra:

| Path cross-product | Current observation | Required invariant |
|---|---|---|
| accepted Stop × initial `begin-poll`/SSE `continue-live` persistence recovery | retry resumes ordinary `live`, re-enabling Stop | accepted stopping remains authoritative through every continuation; no duplicate Stop POST |
| reread valid pending × stable-owner transport mismatch | subset match overwrites differing owner and starts old poll | exact owner is Conversation + operation + transport + startedAt; mismatch adopts observation |
| branch ambiguity × uncertain-marker mutation non-success | pending lock survives but Recent refresh is skipped | discovery refresh is independent of marker transition outcome |

This is a cross-product completeness failure, not a contradiction in the frozen Plan or browser framework.

### 16.2 Balanced cause diagnosis

- **Construction:** R5 probes covered the named success shapes but not all sibling continuation/transition outcomes. Comments and handback overclaimed complete stop preservation and call-site coverage.
- **Acceptance:** the R4 repair packet required stop preservation through recovery, but did not explicitly enumerate `begin-poll`, `continue-live` and `resume-poll` as three separate rows. This guidance gap contributed to the narrow repair.
- **Harness:** one new R5 probe initially assumed a unique visible branch-error projection; Acceptance corrected it on the same baseline. It does not explain any production failure.
- **Spec/environment:** no inconsistency found. Local source and deterministic probes fully establish the failures; external research is unnecessary.

Construction clearly understands the single-state and conditional-storage architecture. The remaining weakness is systematically crossing operation phase × recovery continuation × storage outcome × caller freshness instead of validating one representative path.

### 16.3 Proposed frozen micro-matrix if Alicia chooses same-checkpoint R6

Required outcomes only; implementation remains Construction-owned:

1. **Accepted control propagation:** `begin-poll`, `continue-live` and `resume-poll` each preserve `none | stop-failed | stop-accepted`; only `stop-failed` re-enables Stop. Successful recovery resumes transport without losing control phase.
2. **Exact owner predicate:** every own-owner decision compares all stable owner fields. Mutable disposition/updatedAt/token/cursor belong to exact expected snapshots, not owner identity. Mismatch never writes and executes no old continuation.
3. **Branch outcome separation:** Recent discovery for ambiguity is issued for `persisted | mutation_unavailable | conflict | precondition_unavailable`, current or stale caller; marker and UI/navigation postconditions remain independently conditional.
4. Preserve the 18 earlier Acceptance PASS results and all epoch-1 architecture boundaries.

### 16.4 Alicia disposition options

- **Option A — recommended:** authorize one final bounded **R6** in the same C1B checkpoint/counter, same Builder, limited to the three micro-matrix rows plus Construction-test/evidence correction. Require current-candidate failing tests before production edits.
- **Option B:** authorize R6 in a fresh Builder/model/session, using the same matrix and checkpoint counter.
- **Option C:** explicitly decompose C1B into two new approved checkpoints: runtime control/owner recovery and branch discovery/caller completion. Define whether the existing counter closes or carries forward.
- **Option D:** stop C1B and request a new architecture/prototype/re-baseline before any more production edits.

Acceptance recommends **Option A** because the core state/storage architecture is now stable, the three failures are locally proven and behavior-complete, and no backend/new dependency is needed. This recommendation is not authorization.

### 16.5 Current lock

```text
C1B: FAIL (R5; consecutive FAIL count 5)
Post-intervention FAIL count: 2
Escalation epoch: 2 ACTIVE
Construction: RESUMED ONLY UNDER §17 BOUNDED R6 AUTHORITY
Commit/P1C/P1D/full regression/provider: NOT AUTHORIZED
Resume condition: SATISFIED — Alicia selected Option A; separate authorization recorded in §17
```

---

## 17. Separate Acceptance resume authorization — escalation epoch 2 / Option A

```text
RESUME AUTHORIZED
Checkpoint: C1B (same checkpoint and consecutive-FAIL counter)
Repair cycle: R6 — final bounded attempt under escalation epoch 2
Issued by: independent Acceptance / Solaire
Alicia disposition: Option A APPROVED
Builder: same Builder / Ecki
Pinned R5 Builder fingerprint: 9989666a8e1c3aa78f225eaeca3e65546f00ce02d256f149a3955d702315412a
Detailed Plan authority SHA-256: 03d040c21c69170e97ef545c2b829b7417dc7eeae5175d0f3db13fcc946c9d0e
Authorized scope: §16.3 three-row micro-matrix plus Construction tests/evidence correction only
Commit/P1C/P1D/full regression/provider/backend/outer/new dependencies: NOT AUTHORIZED
```

### 17.1 Mandatory red-before-green precondition

Before any R6 production edit, Construction must:

1. add exactly the three behavior-complete Construction cross-product probes named in §16.3;
2. run them against the pinned R5 candidate;
3. record that all three **FAIL for the intended invariant reasons**, with numeric output and no harness error;
4. only then apply the minimum production repair.

The three red baselines must prove:

- accepted Stop survives both initial `begin-poll` and SSE `continue-live` recovery without another Stop POST;
- a reread pending lease with any differing stable-owner field, including transport, remains untouched and executes no old continuation;
- ambiguous branch discovery refreshes Recent across every uncertainty-persist outcome independently of marker/UI completion.

Construction tests may express multiple transport/storage cases inside these three invariant groups. They must not inspect, copy or modify Acceptance-owned tests.

### 17.2 Authorized production and evidence boundary

Production edits are limited to the existing C1B symbols directly implementing:

- constrained continuation/control propagation in `runtime/types.ts` and `runtime/useChatRuntime.ts`;
- exact stable-owner equality used by reread/adoption in the same runtime surface;
- branch ambiguity discovery ordering in `runtime/useChatRuntime.ts`;
- directly necessary composer/banner projection only if the state transition alone cannot satisfy the existing UI contract.

Construction may update only directly related Construction tests and `Plan/V4_Phase_1B_Construction_Evidence.md`. Remove the `[DBG70]` diagnostic and correct the lease call-site inventory while touching evidence/tests. Any need to edit another production file or alter the approved algebra requires a pause and explicit scope request.

### 17.3 R6 handback and independent recheck scope

Builder handback must include:

- the three-test RED command/result before production edits;
- exact changed files/symbols and invariant mapping;
- post-fix focused numeric tests, typecheck, lint, build and `git diff --check`;
- current `persistRuntimeLease`/`clearRuntimeLease` call-site counts;
- explicit unexecuted scenarios and deviations;
- confirmation of no Acceptance/provider/commit/backend/outer changes.

Acceptance will recheck in this order:

1. the three original R5 failing probes;
2. all 21 independent R1–R5 probes;
3. R4/R5/R6 Construction invariant suites and sibling source paths;
4. if and only if no P0/P1 remains, the required complete regression pipeline before any PASS;
5. Gate G provider execution remains separately locked pending the existing budget/waiver decision.

A focused green handback is not itself C1B PASS. Checkpoint commit remains forbidden until independent R6 acceptance and the required final pipeline complete.

---

## 18. R6 re-acceptance disposition

```text
R6 BOUNDED REPAIR: PASS
R5 findings: 3/3 CLOSED
Independent Acceptance probes: 21/21 PASS
Construction R4+R5+R6 focused probes: 24/24 PASS
Final app/V3/backend deterministic regression: PASS
Production responsive geometry: PASS at 320/390/767/768
Current P0/P1: 0
Construction: STOPPED — no additional repair authorized or required
Final C1B verdict: HELD pending Gate G provider authorization or explicit waiver/re-baseline
Commit/P1C/P1D: NOT AUTHORIZED
```

The epoch-2 Option A repair converged. The authoritative state/storage architecture is preserved; accepted stop propagation, exact stable-owner comparison and branch discovery independence satisfy §16.3. No further Builder cycle is open.

Alicia's remaining decision is solely Gate G:

1. authorize the Detailed Plan's existing maximum-two-generation controlled live probe budget and cleanup contract; or
2. explicitly waive/re-baseline the actual-V4-UI live requirement based on the complete deterministic evidence.

Only after that decision is executed and recorded may Acceptance issue the final `C1B: PASS` line and request Alicia's separate checkpoint-commit approval.

---

## 19. Gate G authorization — actual-V4-UI live probe (2026-09-03)

Alicia chose Gate G **option 1** with an approved deviation: reuse an **existing** conversation instead of creating a new temporary Drift Conversation through the UI (Detailed Plan §10.2 step 1 amended by decision).

- No zero-message conversation remains in the real DB (94 and the other empty shells were removed by earlier cleanups).
- Reuse target: conversation 72 `smoke` (standard preset 5 `Ecki`, deepseek-v4-flash, provider live today). Cleanup restores it to its exact prior state via ORM.
- Budget: at most two intended provider-generation attempts (one SSE turn, one async turn with reload/re-entry). Stop exercised only if timing permits; otherwise classified honestly.
- Post-probe: branch conversation deleted via ORM; AgentPreset rows untouched; closing baseline 8 rows.

Execution log lives in the Acceptance report §15. The final `C1B: PASS` line and checkpoint-commit request follow only after that log closes cleanly.

---

## 20. Gate G executed — C1B PASS (2026-09-03)

```text
C1B: PASS
Gate G: EXECUTED against the actual V4 UI + live provider, reused conversation 72
SSE live turn: PASS (streaming incremental, terminal, canonical pair 17442/17443, 1 generation)
Branch: PASS (Conversation 118 "Branch from smoke", parent 72, canonical navigation)
Async leg: attempted; client lease recovery + begin-poll + stop exercised live;
  async background-consumer/provider boundary stalled before observable provider output;
  exact provider consumption/billing unknown; deterministic async/stop matrix remains the binary evidence
Provider budget: 2 of 2 approved intended attempts executed; SSE usage confirmed, async provider consumption unknown
Cleanup: probe rows + Conversation 118 deleted via ORM; conv 72 restored to single Message 11089;
  AgentPreset baseline 8 rows OK; no late server-side write after cleanup
Deterministic gates: ALL PASS (R6 baseline fingerprint 5e24d3c8...)
Construction: COMPLETE AND STOPPED
Checkpoint commit: NOT YET — requires Alicia's separate approval
```

All escalation epochs are closed. Acceptance has issued the final `C1B: PASS` line in the report (§15.3). Gate G's async attempt is recorded conservatively: the provider boundary was reached, but zero provider chunk/usage telemetry means upstream billing/consumption is unknown rather than proven zero. The report also records the existing cooperative-Stop/first-chunk backend limitation as a non-blocking future follow-up. The only remaining step is Alicia's approval to create the Desktop checkpoint commit; no additional C1B construction or provider attempt is authorized.
