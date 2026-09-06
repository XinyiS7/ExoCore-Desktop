# V4 Phase 1B Core Chat Runtime — Independent Acceptance Report

> **Owner:** `[gpt-5.6-sol / Solaire]`
> **Checkpoint:** C1B
> **Status:** **R6 BOUNDED REPAIR PASS + GATE G EXECUTED — C1B: PASS; checkpoint commit awaiting Alicia approval**
> **Frozen authority:** `Plan/V4_Phase_1B_Core_Chat_Runtime_Detailed_Plan.md`
> **Escalation artifact:** `Plan/V4_Phase_1B_acceptance_escalation_C1B.md`
> **Frozen SHA-256:** `03d040c21c69170e97ef545c2b829b7417dc7eeae5175d0f3db13fcc946c9d0e`
> **Construction must not edit this report or `packages/app/src/test/acceptance/`.**

## 1. R1 factual summary (historical)

```text
Verdict: FAIL
Phase/checkpoint: C1B / R1
Consecutive FAIL count: 1
Repeated invariant IDs: none
Baseline: Desktop fce0d54 + staged construction diff fingerprint 6a2d117548a6eb470097421ed0d15c4c0154caf5
Gates: checked 6, passed 1, failed 5, not checked 1 (final regression gate)
Findings: new 8, residual 0, repair-regression 0, harness-defect 1, acceptance-miss 0
Tests: 85 unique app tests executed, 78 passed, 7 failed, 0 errors, 0 skipped
Full regression: deferred — multiple P1 runtime invariants already block a final candidate
Unreviewed areas: 2 — production-browser responsive/visual matrix; final four-package/backend regression pipeline
```

The 78 Construction tests pass independently. Seven Acceptance-owned behavioral probes fail for seven decisive cases. TypeScript typecheck and app lint pass after the Acceptance harness was corrected. No provider call was made by Acceptance.

### Harness correction

The first test invocation was invalid because Node `v25.7.0` exposed its experimental global web-storage object ahead of jsdom (`window.localStorage.clear` absent). This is a `harness-defect`, not a Builder failure. The same existing Construction storage test reproduced the environment fault. Acceptance reran with `NODE_OPTIONS=--no-experimental-webstorage`; the existing storage suite then passed 5/5, and the seven independent failures below reproduced against valid jsdom storage.

## 2. Review-cycle ledger

| Cycle | Checkpoint ID | Baseline | Verdict | Cause owners | Finding IDs | Supersedes/amends | Consecutive FAIL count | Repeated invariants |
|---|---|---|---|---|---|---|---:|---|
| R1 | C1B | Desktop `fce0d54` + staged diff `6a2d117548a6eb470097421ed0d15c4c0154caf5` | FAIL | Construction 8; Harness 1 | C1B-R1-01…08; H-01 | none | 1 | none |
| R2 | C1B | Desktop `fce0d54` + staged candidate `ef4afd1bed25b289625043e87335cc6563b5f690ad642ba8072dc932d0cdfea6` | FAIL | Construction 3 | C1B-R2-01…03 | Amends R1-01, R1-02, R1-04 | 2 | R1-01, R1-02, R1-04 |
| R3 | C1B | Desktop `fce0d54` + staged candidate `c1dd6ace0ee402392d564694ec15e0c6049fbe06c88c27edb8f8af1b763f62bb` | FAIL / escalation | Construction 2; Harness 1 corrected | C1B-R3-01…02; H-02 | Amends R2-01, R2-02 | 3 | R1-01, R1-02 |
| R4 | C1B | Desktop `fce0d54` + Builder-file diff fingerprint `8a7946d62f971665d1e8d5142d81a5b17c9000c68caf6ce220500615d0636636` | FAIL | Construction 2; Harness 2 corrected | C1B-R4-01…02; H-03…04 | Amends R3-01, R3-02 after approved adviser intervention | 4 | R1-01 ×4, R1-02 ×4 |
| R5 | C1B | Desktop `fce0d54` + Builder-file diff fingerprint `9989666a8e1c3aa78f225eaeca3e65546f00ce02d256f149a3955d702315412a` | FAIL / escalation epoch 2 | Construction 3; Harness 1 corrected; Acceptance guidance 1 shared | C1B-R5-01…03; H-05 | Amends R4-01, R4-02; second post-intervention FAIL | 5 | R1-01 ×5, R1-02 ×5 |
| R6 | C1B / epoch-2 Option A repair | Desktop `fce0d54` + Builder-file diff fingerprint `5e24d3c8b0e42c67f98700785324b5f6161925dde03915957eb26735680cc012` | PASS (bounded repair); final C1B held | Construction 0; Harness 1 corrected | none; H-06 | Supersedes R5-01…03; deterministic gates complete | 5 until final C1B verdict | R1-01/R1-02 repaired; no current residual |

## 3. Pinned evidence and ownership

- Desktop opening/current HEAD: `fce0d5438e49c181e62be5b573e0f9f4baa06614`.
- Outer required/current HEAD: `e7dce77ed7f6ca2d979d8fb326bd1b4d11f2b2f6`; clean.
- Backend required/current HEAD: `29368bbfcf31f64f3baa5c6ba3fec79662d6fb8a`; clean.
- Frozen Plan hash independently verified unchanged.
- Opening Acceptance baseline: `OK: AgentPreset baseline 8 rows [1..8]`.
- Construction did not edit Acceptance-owned artifacts; Acceptance created and tracked this report and its isolated probe file after handoff.
- Staged construction remains uncommitted. Backend and outer repository boundaries pass.

## 4. Findings and repair packets

### C1B-R1-01 — P1 / new / Construction: uncertain-write safety is not enforced

**Observed evidence**

- `runtime/storage.ts::saveRuntimeLease()` catches storage failure, logs a warning and returns success-by-absence; `executeTurn()` dispatches the POST anyway.
- Independent probe blocks the runtime-key write and observes one POST; required count is zero.
- Both SSE and async dispatch catches call `clearRuntimeLease()` for network failures and malformed accepted responses, erasing the uncertainty marker.
- After malformed async 2xx, the independent probe finds no lease and an enabled Send button.
- Branch bypasses the runtime lease entirely. `BranchConfirmModal` resets `submitting=false` in `finally`, so a malformed 201 identity permits another branch POST. The independent probe confirms the confirmation button is re-enabled and no operation marker survives.
- Composer clears the normal draft before request acceptance; edit mode is also cleared before a safe/uncertain result is known.
- `reconciling`, `interrupted`, `runtime_unavailable`, `reconcile_error` and unresolved terminal states are not included in the action lock, so new send/edit/regenerate/branch operations can begin before the prior outcome is acknowledged or canonically reconciled.

**Violated invariant**

Plan §6.5–§6.6, §7.1, §7.5, §9.4–§9.6 and Gate C/D/E: persist duplicate-write protection before dispatch; uncertain writes remain locked; branch uses the same operation-aware rule; draft clears only after acceptance; no automatic unsafe retry.

**Root cause — confirmed**

Lease writes have no success/failure result, and operation safety is modeled by transient React status/dialog booleans rather than one authoritative operation disposition.

**Affected sibling paths**

Normal send, edit, regenerate, SSE handshake, async acknowledgement, branch, reconciliation error, route reload, storage quota/privacy failure.

**Required outcome**

1. A required operation marker must be durably written before any write dispatch; if persistence fails, no write occurs and the user receives a visible error.
2. Proved-safe synchronous rejection may unlock and preserve the draft/action. Network/abort after dispatch, malformed 2xx, SSE protocol handshake after accepted POST and ambiguous branch success must retain an operation-aware uncertainty lock until canonical reconciliation or explicit acknowledgement.
3. New writes and persisted-message actions remain locked through submitting, active, stopping, terminal reconciliation, reconciliation failure and unresolved uncertainty.
4. Branch must participate in the same persistent write-safety contract and cannot become retryable after an ambiguous success.
5. Draft/edit content follows the Plan's accepted-versus-uncertain rules; no pre-acceptance destructive clearing.
6. Duplicate dispatch must be guarded synchronously, not only by a later React render.

**Suggested direction (non-binding)**

Make storage mutations return/throw explicit outcomes and centralize current operation/disposition in one authoritative run context. Do not add test-environment branches or sample-key exceptions.

**Chained effects**

Composer state, banners/acknowledgement, branch modal, route re-entry, storage tests and all write adapters require focused recheck.

**Preserve recommendation**

Keep V4 key namespace isolation and canonical branch `conversation_id` validation.

**Escalation trigger**

Pause if satisfying durable pre-dispatch safety would require a backend idempotency contract or a new dependency; those are outside C1B.

---

### C1B-R1-02 — P1 / new / Construction: recovery, stop and route lifecycle lose authoritative run context

**Observed evidence**

- `useChatRuntime` re-entry effect returns before registering cleanup when no lease existed at mount. An independent real-route probe starts SSE, navigates away and observes that the local fetch signal is not aborted; no stop request is expected or issued.
- Manual `resumePolling()` always restarts cursor 0 while retaining existing overlay text, so replay can duplicate prior content. It also infers destructiveness from current `editingTarget`, which has already been cleared, rather than the persisted operation.
- Poll-loop lease updates collapse regenerate into edit and replace `startedAt` on every poll.
- `not_found` clears the lease immediately and does not reconcile canonical history.
- Stop network failure is only `console.warn`; UI remains `stopping`, the Stop button is disabled, and no visible retry is available.
- Stop-404 reconciliation decides destructive reset from `editingTarget !== null`, which is false after edit dispatch.

**Violated invariant**

Plan §5.3–§5.4, §6.3–§6.6, Task 5, §9.4–§9.5 and Gate D: exact operation/token/cursor ownership, resumable transient polling, honest visible stop failures, canonical reconciliation for `not_found`, and route-unmount local cancellation without automatic stop.

**Root cause — confirmed**

Operation kind/cursor/start time are not carried by one active runtime record across callbacks; cleanup registration incorrectly depends on whether a lease existed during the mount effect.

**Required outcome**

- Route change/unmount always cancels local reader/timer and ignores late callbacks, without issuing user-stop automatically.
- Manual transient recovery resumes from the retained cursor without duplicating overlay events; full reload/re-entry intentionally rebuilds a clean overlay from cursor 0.
- Exact `send|edit|regenerate` operation survives async polling, stop races and reconciliation.
- `not_found` first performs honest canonical reconciliation and remains visible until acknowledgement; age alone never proves expiry.
- Stop failure is visible and retryable while the active run remains locked; stop 404 is treated as a race, not invented `stopped`.

**Suggested direction (non-binding)**

Use a single authoritative active-operation ref/state record consumed by poll, stop, recovery and reconciliation; register teardown unconditionally.

**Chained effects**

Polling scheduler, route effect, storage schema use, stop banner and destructive cache reset evidence must rerun together.

**Preserve recommendation**

Keep stop-before-abort behavior and epoch + Conversation late-callback guards.

**Escalation trigger**

Pause if recovery would require backend persistence across process restarts; current C1B only promises same-process token recovery.

---

### C1B-R1-03 — P1 / new / Construction: canonical reconciliation violates pagination and scrolled-reader rules

**Observed evidence**

- Normal `reconcileHistory()` calls `refetchQueries({queryKey:['messages', id], exact:false})`, refetching every cached newest-relative offset page in place. After new rows, old page parameters no longer address the same windows, creating overlap/gap risk explicitly prohibited by Plan §6.4.
- The function refetches and mutates Query data before checking `isNearBottomRef`; therefore the alleged pending window is not actually held pending and a scrolled-up reader's DOM can change underneath them.
- `applyPendingReconcile()` merely discards the overlay; it does not apply a held canonical window.
- Destructive reconciliation removes the family, but no focused Construction test proves that an active observer is rebuilt canonically and that deleted descendants cannot return through older-page navigation.

**Violated invariant**

Plan §6.4, Task 3.5, §9.6–§9.7, Risk table and Gate C/E/F.

**Root cause — confirmed**

No single newest-window merge/rebase owner was implemented; “pending reconcile” is a UI flag set after the Query mutation rather than pending canonical data.

**Required outcome**

- Normal-send reconciliation must not blindly refetch stale offset pages. It must apply one tested canonical newest-window merge/rebase policy.
- If the reader scrolled upward, incoming/reconciled newest data must not remove or reposition the current reading window before “return to latest.”
- Edit/regenerate terminal reconciliation must clear the complete Conversation message-query family and rebuild from canonical pages; truncated descendants must stay absent when older pages are loaded again.
- Reconcile failure must retain noncanonical overlay and operation lock with an explicit retry.

**Suggested direction (non-binding)**

Separate “fetch canonical newest window” from “apply to displayed/query pages”; destructive and append-only outcomes may use different application policies.

**Chained effects**

Infinite-query page parameters, load-more cursor, scroll anchor, pending banner and overlay disposal.

**Preserve recommendation**

Keep TanStack Query as persisted-row owner and runtime rows outside its server-ID pages.

**Escalation trigger**

Pause before replacing P1A pagination architecture wholesale; only the behavior-complete reconciliation boundary is authorized.

---

### C1B-R1-04 — P1 / new / Construction: protocol boundary accepts malformed data and silently drops events

**Observed evidence**

- Independent probe passes JSON object data for canonical `content`; `normalizeSSEEvent()` classifies it as answer content and returns raw JSON text. Required behavior is non-content protocol warning.
- Independent probe supplies an unknown status, malformed event item and negative cursor; `pollChatStatus()` accepts the envelope.
- Poll response validation checks only broad field types, not allowed status, nonnegative integer/monotonic cursor or event item shape.
- Poll consumption handles only `content` and `status`; unknown/malformed polling events are silently ignored rather than reported, and canonical event-kind validation is not shared with SSE.
- SSE EOF residual handling recognizes only terminal frames; a final residual content/status frame is silently discarded before interruption reconciliation.
- Structured malformed telemetry/cache payloads become empty objects without a protocol warning.
- Typed backend error `code` is lost by `classifyRuntimeError()` unless the object already has a frontend `retryClass`; `stream_crashed` becomes generic `UNKNOWN_ERROR`.

**Violated invariant**

Plan §5.2–§5.3, Task 2, §9.3–§9.5 and Gate C: strict event-kind normalization, visible malformed/unknown events, monotonic event cursor, final residual handling and machine-readable error retention.

**Root cause — confirmed**

Transport DTOs are TypeScript assertions over unvalidated JSON, and SSE/poll event application follows separate incomplete branches.

**Required outcome**

- Validate every external envelope and event at runtime: allowed status, finite nonnegative integer cursor that cannot regress, event item shape, kind-specific payload.
- Malformed/unknown events never enter answer text and produce an observable nonfatal protocol warning when safe to continue.
- Apply every residual frame through the same normalizer before declaring EOF interruption.
- SSE and polling share equivalent content/status/unknown/structured-event semantics; P1D-only data may remain internally retained/nonvisual.
- Preserve backend error code/message while assigning frontend retry class; `stream_crashed` remains reconciliation-required, not an invented edit-specific error.

**Suggested direction (non-binding)**

Create one pure normalized-event application boundary used by both transports rather than expanding both switch statements independently.

**Chained effects**

Parser, client, controller, protocol banner and polling cursor/replay tests.

**Preserve recommendation**

Keep incremental UTF-8/frame decoding, CRLF handling and object protection for valid telemetry/cache payloads.

**Escalation trigger**

Unknown future events should remain nonfatal where safe; do not turn strict validation into abort-on-every-extension without discussion.

---

### C1B-R1-05 — P1 / new / Construction: Conversation intent and persisted-target validation are not preserved

**Observed evidence**

- `ConversationSummary` omits `thinkingLevel`; `ConversationPage` cannot pass it into runtime. Independent probe loads `thinking_level:'high'` and observes POST body `thinking_level:'auto'`, silently changing the Conversation preference.
- Client adapters validate only positive integers. They do not establish that edit/regenerate targets are persisted user rows in the current Conversation or that branch targets are persisted assistant rows. Current protection is UI button placement, despite Plan §5.1/§5.5 explicitly stating that UI visibility is not request-side validation.

**Violated invariant**

Plan §5.1, §5.5, §9.6 and Gate E: preserve existing thinking level (`null`/empty → `auto`) and validate exact persisted role/Conversation membership before write.

**Required outcome**

- Normalize and carry Conversation `thinking_level`; nonempty existing values are sent unchanged, legacy null/empty maps to `auto`.
- Edit/regenerate/branch dispatch validates the selected target against current canonical persisted Message data and required role before POST. Runtime/client overlays and arbitrary positive IDs cannot qualify.

**Suggested direction (non-binding)**

Pass a validated persisted-message action descriptor from the canonical timeline/controller boundary; do not duplicate backend database logic or infer by text/index.

**Chained effects**

Conversation DTO normalization, runtime hook options, action handlers and request-body tests.

**Preserve recommendation**

Keep backend authoritative; frontend validation is a local safety gate, not a replacement for backend checks.

**Escalation trigger**

Pause if satisfying membership requires a new backend endpoint; the already loaded canonical page data should be sufficient for C1B actions.

---

### C1B-R1-06 — P1 / new / Construction: confirmation dialogs fail the frozen presentation/accessibility gate

**Observed evidence**

- New modals render `app-dialog-backdrop` and `app-dialog-foot`, but neither class exists in app CSS. The accepted P1A overlay class is `app-overlay`; the new dialogs therefore are not real modal overlays.
- Neither modal installs Escape handling, initial focus, focus containment or trigger-focus restoration.
- Construction Evidence §1.5 claims “对话框均支持 Escape 关闭与焦点返回,” which current source directly disproves.
- Composer bottom padding does not include `env(safe-area-inset-bottom)` on the detail route.

**Violated invariant**

Plan §7.1, §7.4–§7.5, §9.7 and Gate F: reachable non-obscured composer; modal focus/Escape/action labels; production-responsive behavior.

**Required outcome**

- Branch/truncation confirmations render as real bounded overlays at 320/390/767/768+ widths.
- Opening moves focus into the dialog; Tab/Shift+Tab stay within it; Escape closes when not in a committed submit; close restores the invoking action's focus.
- Error text is announced and ambiguous branch state cannot be dismissed into unsafe retry.
- Mobile composer respects bottom safe area with no horizontal overflow.

**Suggested direction (non-binding)**

Reuse the accepted P1A dialog accessibility behavior/style instead of inventing a second incomplete modal primitive; avoid unrelated shell refactor.

**Chained effects**

Both modal components, action trigger refs, CSS and responsive/accessibility tests.

**Preserve recommendation**

Keep role-correct visible labels and active-run action disabling once the lock state is corrected.

**Escalation trigger**

Pause if reuse requires changing frozen P1A behavior rather than extracting/using its already accepted interaction pattern.

---

### C1B-R1-07 — P1 / new / Construction: the live probe did not exercise the required production frontend entry path

**Observed evidence**

Construction Evidence §4 states the probe was implemented as `scratch/live_runtime_probe.py` and records direct HTTP/ORM calls. Plan §10.2 requires creating and sending through the actual V4 UI. Therefore the probe proves backend contracts and cleanup, but does not corroborate this frontend runtime/controller/composer implementation. The two-call budget is already exhausted.

**Violated invariant**

Plan §10.2–§10.3 and Gate G: actual V4 UI path for SSE and async/stop, bounded provider spend and complete cleanup.

**Root cause — confirmed**

A backend/API probe was substituted for the frozen real-entry-path frontend probe.

**Required outcome**

- Do not spend another provider call during repair.
- Preserve the direct probe as useful backend corroboration, but do not label it the C1B UI live probe.
- After all deterministic repairs pass, Acceptance must ask Alicia to choose one of: authorize the minimum additional actual-V4-UI provider probe budget, or explicitly re-baseline/accept this live limitation. Construction cannot decide this silently.

**Chained effects**

Final live evidence and Gate G remain open even after code repair.

**Preserve recommendation**

Keep its verified ORM cleanup, preset restoration, branch/API evidence and exact two-call accounting.

**Escalation trigger**

Any additional paid provider generation requires Alicia's explicit approval.

---

### C1B-R1-08 — P2 / new / Construction: documentation/evidence precision

- `ReactSheet.md` and snapshot still describe blocking-tool status as an object `{message,args…}` while backend `_format_tool_status()` returns a safe preview string. Task 1 required current emitter wording.
- Construction Evidence must retract/update claims disproved above: complete Escape/focus support, ambiguous branch retry lock, pre-and-post destructive query reset, and actual-UI live probe.
- Current Node 25 verification commands require `NODE_OPTIONS=--no-experimental-webstorage` to avoid an environment-level jsdom collision; record the exact environment/flag if the Builder reproduces it. Do not change production code to accommodate Node's test global.

This documentation/evidence correction is included in the current repair because it describes the same active contract and handoff. It is not an additional product feature.

## 5. Preserve recommendations

The following already-observed areas should remain unchanged unless a repair dependency is discussed first:

- frozen Plan and Acceptance-owned report/probes;
- backend/outer repositories and P1A deployment/PWA configuration;
- V4/V3 storage namespace separation;
- canonical branch response identity (`conversation_id`, never compatibility `session_id`);
- SSE incremental UTF-8, CRLF/LF and multi-frame decoding behavior;
- correct canonical documentation amendments for opaque async token, structured polling delta, assistant-Message branch origin and unenforced backend TTL;
- P1A read/history/create behavior and P1D reasoning-chip correction;
- no P1C/P1D/P2+ feature implementation;
- direct live probe data cleanup and eight-row preset baseline.

These are preserve recommendations, not immutable implementation files. Any necessary change requires the Plan's pause-and-discuss dependency report. Frozen Plan and Acceptance artifacts remain immutable.

## 6. Dependency-aware repair order

1. **Root operation invariant:** rebuild durable operation/disposition ownership for send/edit/regenerate/branch, storage failure and synchronous duplicate lock (R1-01).
2. **Lifecycle:** carry exact operation/token/cursor through polling, stop, unmount and `not_found` (R1-02).
3. **Protocol boundary:** strict envelopes, shared normalized event application, residual frames and error-code retention (R1-04).
4. **Canonical data:** thinking-level propagation and persisted role/membership validation (R1-05).
5. **Reconciliation:** normal append-only page merge/hold and destructive family rebuild (R1-03).
6. **UI/accessibility:** real modal behavior, focus/Escape and mobile safe area (R1-06).
7. **Construction-test honesty:** expand tests around the observable invariants; do not inspect or edit Acceptance tests.
8. **Docs/evidence:** R1-08 corrections.
9. **Focused verification only:** app typecheck/lint, Construction tests and relevant deterministic matrices. Full four-package/backend regression remains deferred until no P1 remains.
10. **No live provider call:** R1-07 awaits Alicia only after deterministic candidate convergence.

## 7. Exact R2 recheck scope

R2 will:

- verify frozen Plan/report/Acceptance probe hashes and no backend/outer delta;
- rerun the seven original independent failures first;
- inspect sibling send/edit/regenerate/branch, stop, polling, unmount, pagination and modal paths;
- run app typecheck/lint and complete Construction app tests;
- defer V3/four-package/backend full regression while any P1 remains;
- make no provider call.

## 8. Builder response required

Return:

- finding IDs mapped to changed files/symbols;
- restatement of the shared operation/lease/reconciliation invariant before editing;
- searches and match counts for lease clear/write, swallowed catches, Query message-family mutations and old modal class names;
- numeric focused test results and exact environment flags;
- unexecuted scenarios and scope deviations;
- updated Construction Evidence claims;
- staged repository state; no commit and no Builder verdict.

## 9. R2 focused re-acceptance

### 9.1 R2 factual summary

```text
Verdict: FAIL
Phase/checkpoint: C1B / R2
Consecutive FAIL count: 2
Repeated invariant IDs: R1-01, R1-02, R1-04
Baseline: Desktop fce0d54 + staged candidate ef4afd1bed25b289625043e87335cc6563b5f690ad642ba8072dc932d0cdfea6
Gates: checked 5, passed 2, failed 3, not checked 2 (production-browser/final-regression; live-provider gate)
Findings: new 0, residual 3, repair-regression 0, harness-defect 0, acceptance-miss 0
Tests: 113 unique app tests executed, 107 passed, 6 failed, 0 errors, 0 skipped
Full regression: deferred — three P1 residual invariants remain
Unreviewed areas: production-browser geometry/interaction; final V3/four-package/backend/deployment regression; actual-V4-UI paid live probe
```

R1's seven decisive probes now pass 7/7. Construction-only tests pass 100/100; typecheck and lint pass. R1-03 (pagination application split), R1-05 (thinking level and persisted-role target), R1-06 (baseline dialog behavior) and R1-08 (docs/evidence correction) close at focused level. R1-07 remains an intentionally open final live gate and consumed no additional provider call.

### 9.2 C1B-R2-01 — P1 / residual of R1-01: durable storage transitions still unlock unsafely or execute invalid records

**Observed evidence**

- All six `clearRuntimeLease()` call sites ignore its boolean result. `clearOverlayAndUnlock()` removes UI locks even when the persistent lease could not be removed.
- Independent probe forces runtime-key removal failure after terminal reconciliation. The durable lease remains, but the writer unlocks and no visible storage-recovery state exists.
- `loadRuntimeLease()` validates `operation` only as an arbitrary string and does not validate operation-specific token/cursor or finite timestamps. An injected `operation:'delete-history'` active async lease is executed as a pollable send record.
- Invalid JSON is caught and returned as `null` without removal or visible quarantine. The Construction test named “quarantines and clears” overwrites the invalid JSON with a second fixture before asserting removal, so it does not prove its title.
- `acknowledgeUncertain()` unlocks even if persistent marker removal fails. Accepted/active lease rewrites and draft clearing also ignore storage failure.
- Unknown POST outcomes do not run the Plan-required canonical history refresh; the generic network message and button label “关闭提示” do not explicitly state that the write may already have succeeded or that acknowledgement releases duplicate-write protection.
- Ambiguous branch handling retains its marker but does not refresh Recent, despite §5.5/§6.6 requiring Recent as the canonical discovery path.

**Required outcome**

1. Every safety-relevant storage transition has an explicit result. UI/runtime unlock occurs only after required marker removal succeeds; failure remains visibly locked with a retryable storage-cleanup action.
2. Lease loading distinguishes absent, valid, invalid/quarantined and storage-unavailable outcomes. Validate the exact operation enum and operation-specific fields before any poll/recovery execution. Invalid records are never executed and surface the frozen visible recovery message.
3. Active async-token/cursor persistence failure is visible; the existing pending marker must continue preventing duplicate writes.
4. Unknown write outcomes retain the durable lock, trigger canonical history/Recent refresh as applicable, and use explicit acknowledgement wording. Acknowledgement cannot unlock if marker clearing fails.
5. Ambiguous branch invalidates Recent while preserving its lock. Draft-storage cleanup failure cannot silently repopulate already accepted content as a future resend.

**Sibling recheck:** safe 4xx clear, done/stopped/error reconciliation clear, `not_found`, manual acknowledgement, branch success/ambiguity, async ack lease upgrade and accepted-draft cleanup.

**Preserve:** pre-dispatch storage failure correctly sends zero POST; R1's uncertainty-marker and synchronous double-submit protections.

### 9.3 C1B-R2-02 — P1 / residual of R1-02: Conversation transitions and awaited callbacks are not epoch/identity safe

**Observed evidence**

- Independent real-route probe starts an SSE turn in Conversation 76 and navigates directly to Conversation 77. The old reader is cancelled, but `busy/status/overlay` state is not reset for the new route; Conversation 77 still renders the old optimistic rows and Stop button.
- `reconcileCanonical()` captures the active Conversation at invocation but, after await, calls `clearOverlayAndUnlock()`, which clears storage using the *current* active Conversation. A late Conversation-76 reconciliation can therefore clear Conversation 77's lease and UI.
- `stopGeneration()` and the `not_found` path likewise mutate state after awaits without revalidating the initiating epoch and Conversation.
- `not_found` currently calls a reconciliation helper that clears the lease/run, then displays an in-memory `runtime_unavailable` warning. Independent probe confirms no durable marker remains before acknowledgement; reload loses the warning/lock.

**Required outcome**

1. On Conversation-ID change, cancel old local readers and reset only old route-local overlay/error/busy state before loading the new Conversation's own lease. Preserve the old Conversation lease for later recovery.
2. Every async continuation—terminal reconciliation, stop response/race, poll `not_found`, retry and branch completion—carries and rechecks the initiating `{epoch, conversationId}` before changing UI or clearing storage.
3. Lease clear/update helpers take the initiating Conversation explicitly; never clear via a mutable current-ID ref after an await.
4. `not_found` performs canonical reconciliation, then persists a non-executable runtime-unavailable/uncertain marker that survives reload until explicit successful acknowledgement.

**Sibling recheck:** direct chat→chat navigation during SSE, polling, stop and reconciliation; stale terminal after route change; current Conversation with its own pre-existing lease.

**Preserve:** unmount/navigation issues no automatic stop; old local reader is now correctly aborted.

### 9.4 C1B-R2-03 — P1 / residual of R1-04: strict runtime envelope validation remains incomplete

**Observed evidence**

- Canonical docs and backend emit `status` as a string, but `normalizeSSEEvent()` still accepts `{message,args…}` objects and extracts `message`. Independent probe receives `status`, not `malformed`.
- Async acknowledgement validates only a nonempty token. Independent probe returns `{message_id:'abc12345', status:'done'}` and it is accepted despite the canonical required status `processing`.
- Poll event items do not require a `delta` property; cursor validation allows nonempty events with no cursor advance, permitting replay; `error_message` type is not checked.
- Stop 200 parsing treats malformed JSON or every status value as `stop_requested`.
- HTTP adapters replace backend machine-readable body codes with generic `HTTP_ERROR`/`STOP_ERROR`, contrary to Task 2.5.

**Required outcome**

- Current SSE/poll `status` payload is string-only; object/array/number/null payloads become visible nonfatal malformed events and never expose `args`.
- Async 2xx requires both nonempty token and `status:'processing'`; malformed accepted 2xx remains an uncertain write.
- Poll validation requires each event's `delta` property, allowed `error_message` type and event-index consistency: nonempty returned events must advance cursor by the corresponding event count; regression/replay envelopes are rejected.
- Stop 200 requires parseable `{status:'stop_requested'}`; malformed accepted responses produce a visible uncertain stop state, never invented acceptance.
- Preserve machine-readable backend `code` from HTTP response bodies while assigning the frontend retry class.

**Sibling recheck:** SSE and polling valid content/status/structured events; typed stream errors; legacy bare error fallback; unknown future event warning; stop 404 terminal race.

**Preserve:** UTF-8/frame parser, R1 malformed-content protection, shared event application and typed `stream_crashed` preservation.

### 9.5 R3 dependency-aware repair order

1. Introduce one explicit storage transition/load result vocabulary; repair all safety-relevant save/clear/read callers together (R2-01).
2. Make operation completion and cleanup identity-bound; then reset/reload route-local state on Conversation changes (R2-02).
3. Complete strict adapter/normalizer validation without adding a dependency or changing backend (R2-03).
4. Add honest Construction tests for every residual and its sibling path. Do not inspect/edit Acceptance probes.
5. Run only app typecheck/lint, Construction suite and exact focused matrices. No full regression or provider call.
6. Update Evidence §8 with R2 corrections and hand back for R3.

### 9.6 Exact R3 recheck scope

- Freeze hashes for the Plan, this report and both Acceptance probe files.
- Rerun R1 7/7 and R2 6/6 first.
- Inspect all storage transitions, route/epoch continuations and runtime adapters—not only probe examples.
- Run app typecheck/lint and Construction-only tests.
- Defer production browser, full regression and UI live probe until no P1 remains.

## 10. R3 focused re-acceptance and mandatory intervention

### 10.1 R3 factual summary

```text
Verdict: FAIL — THREE-FAIL ESCALATION
Phase/checkpoint: C1B / R3
Consecutive FAIL count: 3
Repeated invariant IDs: R1-01, R1-02
Baseline: Desktop fce0d54 + staged candidate c1dd6ace0ee402392d564694ec15e0c6049fbe06c88c27edb8f8af1b763f62bb
Gates: checked 5, passed 3, failed 2, not checked 2 (production-browser/final-regression; live-provider gate)
Findings: new 0, residual 2, repair-regression 0, harness-defect 1 corrected, acceptance-miss 0
Tests: 130 unique app tests executed, 127 passed, 3 failed, 0 errors, 0 skipped
Full regression: deferred — repeated P1 storage/identity invariants remain
Unreviewed areas: production-browser geometry/interaction; final V3/four-package/backend/deployment regression; actual-V4-UI paid live probe
```

R1+R2 frozen probes pass 13/13, Construction passes 114/114, and typecheck/lint pass. R2-03 strict protocol validation closes at focused level. R3 found a common deeper defect: “retry storage” and “acknowledge uncertain” are still one callback despite representing incompatible phases, while async accepted-marker construction is non-atomic. The first R3 branch probe used an incorrect accessible label and is recorded as H-02; after the Acceptance harness was corrected, all three R3 probes failed for their intended production reasons.

### 10.2 C1B-R3-01 — P1 / residual of R2-01: accepted-run persistence and cleanup actions remain phase-unsafe

**Observed evidence**

- Async `onAccepted()` first writes `disposition:'active'` *without* `asyncToken/cursor`, then the async branch writes the real token-bearing lease but ignores failure. If that second write fails, storage contains an invalid active async lease; reload quarantines it and loses the recoverable token/duplicate-write context. Independent probe reproduces this and finds no visible storage warning.
- Every polling cursor update still ignores `saveRuntimeLease()` failure, so UI continues while durable recovery cursor silently falls behind.
- Draft-clear failure displays `STORAGE_UNAVAILABLE` but installs no draft-specific retry. The shared “重试存储操作” invokes `acknowledgeUncertain()`, which clears the active runtime lease, rebuilds history and unlocks while the SSE reader is still live. Independent probe confirms the active lease disappears.
- Branch safe-4xx cleanup calls `clearRuntimeLease()` without checking its result and sets busy false. With removal blocked, the stale pending marker remains while the confirmation button becomes retryable; the corrected independent probe observes repeat-write eligibility.
- The same generic `storageRetryRef` may mean “write pending marker,” “upgrade active token,” “clear terminal marker,” “reread storage,” or “clear draft,” but acknowledgement always follows it with marker clear + canonical refresh + unlock. Those operations do not share a valid postcondition.

**Invariant impact**

This repeats R1-01 for the third cycle: a durable operation record and UI lock do not transition together under storage failure. The implementation currently cannot tell whether a retry should continue an active run, keep an uncertain lock, clear a safely rejected operation, or only remove stale draft text.

**Required next step before repair**

No fourth patch is authorized yet. Builder must answer the obstacle-report questions in §10.4. The likely design correction is to replace the callback-shaped retry slot with an explicit storage transition/disposition model whose postcondition determines whether the run continues, remains uncertain, or may unlock; this is advisory until the obstacle report is reviewed.

**Preserve:** pre-dispatch zero-POST behavior; valid lease schema vocabulary; successful terminal clear lock; R1/R2 probes already passing.

### 10.3 C1B-R3-02 — P1 / residual of R2-02: branch continuations still bypass identity-bound completion

**Observed evidence**

- `branchFrom()` checks identity only in its success path. Its catch path persists uncertainty, invalidates Recent and calls `setStatus/setBusy` without rechecking the initiating epoch/Conversation.
- A stale successful branch explicitly clears the old lease and calls `setBusy(false)` on the current route before returning; the page-level promise can then navigate from a route the user already left.
- Safe rejection cleanup ignores clear failure as described in R3-01.

**Invariant impact**

This repeats the R1-02 requirement that *every* async continuation, including branch success/rejection/ambiguity, must prove initiating identity before mutating route UI or navigation. Storage cleanup for a stale source Conversation requires a deliberate policy and cannot use current-route state.

**Required next step before repair**

Obstacle report must state which branch completion policy was intended after route departure and why existing identity guards were not applied symmetrically. No patch until Alicia authorizes resume after intervention review.

### 10.4 Mandatory Builder obstacle report

Construction must stop with staged work preserved and answer, concretely:

1. Which invariant or implementation choice is least clear now—especially the postconditions of pending/active/uncertain marker write, token/cursor update, draft cleanup and marker clear?
2. Which runtime observation contradicted the Builder's expectation in R2?
3. Which part of the R2 packet was ambiguous, too narrow or difficult to execute?
4. What sibling path is most likely to fail next if only the three R3 probes are patched?
5. Are the frozen Plan, Acceptance requirements, browser-storage constraints or backend runtime contract internally inconsistent? If yes, identify the exact clauses/source facts; if no, state the smallest coherent state model that can satisfy them.
6. For branch completion after route departure, should the source marker remain for later reconciliation, be cleared without current-route UI mutation, or use another explicit outcome—and what evidence supports that choice?

After receiving the obstacle report, Acceptance forwards the report and intervention recommendation to Alicia. Repair remains paused until Alicia explicitly authorizes resume.

## 11. Current gate disposition

```text
C1B: FAIL (R3; consecutive FAIL count 3)
Three-FAIL intervention: ACTIVE
Construction edits/tests: PAUSED
Checkpoint commit: NOT AUTHORIZED
P1C: LOCKED
Full regression: DEFERRED
Additional live provider calls: NOT AUTHORIZED
Resume: REQUIRES ALICIA'S EXPLICIT AUTHORIZATION AFTER FORMAL INTERVENTION-PLAN REVIEW
```

## 12. R4 post-intervention re-acceptance — FAIL

### 12.1 Factual summary

```text
Verdict: FAIL
Phase/checkpoint: C1B / R4 (first recheck after approved adviser intervention)
Consecutive FAIL count: 4
Repeated invariant IDs: R1-01 ×4; R1-02 ×4
Baseline: Desktop fce0d54 + Builder-file diff fingerprint 8a7946d62f971665d1e8d5142d81a5b17c9000c68caf6ce220500615d0636636
Authority: Detailed Plan SHA-256 03d040c21c69170e97ef545c2b829b7417dc7eeae5175d0f3db13fcc946c9d0e
Gates: checked 7, passed 5, failed 2, not checked 1 (final regression gate)
Findings: new 3 P2 notes, residual 2 P1, repair-regression 0, harness-defect 2 corrected, acceptance-miss 0
Tests: 28 unique tests executed, 25 passed, 3 failed, 0 errors, 0 skipped
  - independent acceptance: 18 executed, 15 passed, 3 failed
  - focused Construction R4 invariants: 10 executed, 10 passed
Static checks: exo-app typecheck PASS; exo-app lint PASS
Full regression: deferred — two P1 runtime invariants still block a final candidate
Provider calls: none
Unreviewed areas: 3 — final four-package/backend regression; Gate G provider UI probe/waiver; production-browser visual/responsive matrix
```

Construction stayed outside Acceptance-owned files. Acceptance corrected two obsolete selector assumptions in its own R3 probe after the approved R4 authority replaced a generic storage retry with an independent draft-cleanup action and allowed one operation fact to be projected in more than one visible surface. Those are `H-03/H-04` harness defects, not Builder failures: the assertions still prove that draft cleanup cannot unlock/clear the operation and that branch clear failure remains locked with one POST. After correction, the preserved R1–R3 suite is **15/16 PASS**; the sole remaining failure is the still-valid async Stop/control invariant.

### 12.2 C1B-R4-01 — P1 / residual of R3-02: branch completion is not bound to the exact caller lifecycle

**Observed evidence**

- Independent R4 probe starts a branch, changes route before the response, then resolves success. The old source lease remains `pending` and Recent is not refreshed. The expected source-side success postcondition is conditional clear plus a positive Recent refresh, without stale navigation or current-route UI mutation.
- A second independent probe starts a branch, explicitly closes the modal, then resolves success. The page still navigates to the returned Conversation.
- `ConversationPage.handleBranchConfirm()` captures only the route epoch/Conversation and checks those around Recent invalidation/navigation. Closing the modal does not invalidate that exact caller.
- `useChatRuntime.branchFrom()` returns early on stale success before source-marker clear/Recent refresh, and its stale rejection/ambiguity path throws before applying the source Conversation's required durable outcome.
- The page-level delayed navigation continuation checks only a coarse current-page fact; it does not carry the exact branch caller identity through modal close/replacement.

**Violated invariant**

Escalation §§6.2–6.3 and §11.1 branch probe: branch uses the same operation identity/lock; route switch or modal close makes the caller stale for UI/navigation, while the captured source operation still receives the outcome-specific durable transition and positive Recent refresh. No stale callback may navigate, unlock the current route, or leave the source lease in an invalid pending state.

**Root cause — confirmed**

The implementation conflates two different guards: source-operation ownership and current caller/UI eligibility. The route epoch protects some page continuation, but there is no exact per-invocation/modal caller token, and stale UI detection aborts source-side durable completion instead of suppressing only current-route effects.

**Affected sibling paths**

Branch success, proved-safe rejection, ambiguous/network response, marker clear/persist conflict or unavailable outcome, modal close, modal target replacement, route switch before response, and delayed Recent invalidation/navigation.

**Required outcome**

1. Carry an exact caller identity for each branch invocation; modal close/replacement and route change invalidate its navigation/UI continuation.
2. Separately complete the captured source operation: success conditionally clears its exact marker; safe rejection conditionally clears; ambiguity conditionally persists uncertain. Conflict adopts/rereads the observed source fact; unavailable leaves the valid source marker recoverable.
3. Every accepted branch outcome positively refreshes Recent as specified, even when the initiating page is stale; no stale callback mutates the new route's operation state or navigates.
4. Never issue a second branch POST as recovery.

**Suggested direction — non-binding adviser guidance**

Model source durable completion and caller-side UI/navigation as two continuations with different guards. An invocation token owned by `ConversationPage` may invalidate navigation on close/replacement; it need not become a new durable schema field.

**Chained effects**

Modal close semantics, callback result shape, page-level invalidation ordering, route-unmount cleanup, and all three branch outcome classes require focused recheck.

**Verification targets**

- success after route switch: source marker cleared, Recent refreshed, no stale navigation/current-route mutation;
- success after explicit modal close: no navigation, source success postcondition still completed;
- safe rejection and ambiguity after route switch/close: correct source marker transition, no second POST;
- stale conditional clear/persist conflict: newer lease untouched and success continuation suppressed.

**Preserve recommendation**

Keep branch under the common operation lock, canonical returned `conversation_id` validation, conditional storage transitions, and at-most-once dispatch.

**Escalation trigger**

Pause before adding a global store/event bus, backend idempotency, cross-tab coordination, or a new dependency; all remain explicitly out of scope.

### 12.3 C1B-R4-02 — P1 / residual of R3-01: accepted async suspension loses Stop/control or the exact continuation

**Observed evidence**

- The preserved R3 atomic-activation probe forces failure of the conditional `pending -> active(token,cursor)` write after a valid async ACK. Storage correctly retains the valid pending lease and no invalid tokenless active lease appears, but the UI has no **Stop** button; it exposes only `重试存储操作` plus a disabled Send button.
- `deriveStatus(blocked(storage_unavailable)) -> interrupted`; `ChatComposer` renders Stop only for submitting/streaming/polling/stopping; and `stopGeneration()` accepts only `live` or retryable `stopping`. The accepted token exists in recovery memory but is not available to Stop/control.
- When an ownership precondition read fails during active-snapshot persistence, `retryStorageRead()` can persist the complete active snapshot after rereading `absent`, but then conservatively enters uncertain acknowledgement instead of executing the captured `begin-poll` continuation.
- Poll/cursor recovery uses a generic `resume-poll` continuation that returns a previously `stopping` operation to `live`; after an accepted stop this can expose another Stop action before terminal reconciliation.

**Violated invariant**

Escalation §5 mandatory async policy and the preserved stop lifecycle: after validated ACK, token+cursor become one atomic active snapshot; the first polling GET waits for durability, but Stop/runtime control remains available. Exact recovery must resume the constrained continuation without re-POST, and accepted stopping remains authoritative until terminal/reconciliation.

**Root cause — confirmed**

The authoritative blocked/read-blocked variants preserve storage retry data but not enough operation-control/continuation semantics in their projections and recovery transitions. Presentation status and `stopGeneration()` therefore treat an accepted async operation as non-stoppable, while reread/retry paths can discard whether the next action was begin-poll or preserve-stopping.

**Affected sibling paths**

Initial async active mutation failure; initial precondition-read failure followed by absent/valid/quarantined reread; cursor persist failure; poll-network retry; stop accepted before either recovery; conflict adoption; route re-entry.

**Required outcome**

1. After a validated async ACK, retain complete in-memory token/cursor and expose Stop/runtime control while the active snapshot is not yet durable; do not begin the first polling GET and do not re-POST.
2. Exact persistence/reread recovery must preserve its constrained continuation: durable active creation begins polling once; conflict adopts/rereads; unavailable remains locked and retryable; absent/valid/quarantined reread follows the authority's actual-state policy rather than collapsing every case to uncertain acknowledgement.
3. If Stop has been accepted, storage/poll recovery must preserve the stopping fact and must not expose a duplicate Stop as though the operation returned to ordinary live state.
4. No path may create a tokenless active lease or a zero-marker gap.

**Suggested direction — non-binding adviser guidance**

Carry the accepted async control payload and continuation/stopping fact inside the existing authoritative union/recovery descriptor, then derive composer controls from that union. Do not add a parallel mutable boolean.

**Chained effects**

Status projection, composer primary action, stop adapter, persistence retry, reread recovery, cursor recovery, and terminal reconciliation all need focused recheck.

**Verification targets**

- active-snapshot mutation failure: pending lease retained, Stop available, zero polling GET until durable, exact retry starts one poll and never re-POSTs;
- precondition unavailable then reread absent/valid/quarantined: correct adopted transition and continuation;
- Stop accepted before storage or polling recovery: still stopping, no duplicate Stop/POST, eventual terminal reconciliation;
- stale/newer lease conflict: observed lease untouched and no old success continuation.

**Preserve recommendation**

Keep the atomic complete token+cursor write, cursor-before-next-GET ordering, same-tab captured-owner checks, and valid pending marker on mutation failure.

**Escalation trigger**

Pause if the repair would require durable epoch schema changes, background SSE, cross-tab CAS, or backend API changes.

### 12.4 Non-blocking R4 notes

- **C1B-R4-P2-01 / new / Construction:** verified-absent pending creation `mutation_unavailable` returns authoritative idle, but the shared error banner offers `重试存储操作` even though `retryStorage()` has no operation recovery to execute. The preserved draft and enabled Send path are safe; make the message/action honest (full user-initiated Send retry) in this bounded repair if feasible.
- **C1B-R4-P2-02 / new / Construction:** a failed draft cleanup remains visible after a later successful clear because success does not reset `draftCleanupFailed`. Clear this ancillary warning on successful draft cleanup; it must remain independent from operation unlock.
- **C1B-R4-P2-03 / new / Construction:** route/unmount cleanup invokes `clearRuntimeLease(snapshot)` without consuming the conditional outcome. The callback is correctly prevented from touching the new route, so this is not currently a P1, but the call-site inventory should explicitly handle or document conflict/unavailable source-marker postconditions.

These P2 items should be included only where naturally touched by the two P1 repairs; they do not independently expand the R5 scope.

### 12.5 Preserve recommendations and bounded R5 order

Preserve the independently observed passing architecture:

- one authoritative discriminated `OperationState`; no residue of the five prior parallel truth refs;
- conditional exact-prior storage outcomes and stale-owner protection;
- no standalone predispatch retry and zero POST on marker creation failure;
- complete async token+cursor snapshot and cursor persistence before another GET;
- four-stage fresh fetch/apply/marker/release reconciliation with approved scrolled-away deferral;
- draft cleanup as an independent ancillary recovery;
- route-entry `storage_blocked_read` and exact reread;
- branch under the common operation lock and at-most-once dispatch.

Repair order:

1. Restate the two-identity branch invariant and accepted-async suspended-control invariant before editing.
2. Repair source-operation completion separately from branch caller UI/navigation.
3. Preserve accepted async control/continuation/stopping semantics through conditional persistence and reread/retry.
4. Add honest Construction probes for all listed sibling outcomes, not only the three failing examples.
5. Sync Construction Evidence and the complete lease write/clear call-site audit.
6. Run focused Construction plus R4/R3 acceptance recheck; full regression remains deferred until no P0/P1 remains.

### 12.6 R5 authorization and handback requirements

This is the **first** failed review cycle after the approved adviser intervention. The second-post-intervention escalation threshold has not been reached, so a bounded R5 repair is authorized without reopening product decisions.

**Authorized production boundary:** existing C1B runtime/branch/page/composer/banner files and directly related Construction tests/evidence only. No Acceptance-owned file may be read for implementation details or modified. No provider call, commit, P1C/P1D work, global store/event bus, backend idempotency, cross-tab/background transport, new dependency, or backend/outer repository change.

Builder handback must include:

- finding IDs and causal invariant restatement;
- exact changed files/symbols;
- lease write/clear call-site and postcondition inventory with match counts;
- numeric focused test/typecheck/lint/build results;
- explicit evidence for route-switch/modal-close branch success, rejection and ambiguity;
- explicit evidence for async active persistence failure, reread outcomes, Stop-before-recovery and stop-state preservation;
- unexecuted scenarios and any requested preserve-scope expansion.

C1B remains **FAIL**. Checkpoint commit, P1C/P1D, provider execution and full regression remain locked pending independent R5 acceptance.

## 13. R5 post-intervention re-acceptance — FAIL / escalation epoch 2

### 13.1 Factual summary

```text
Verdict: FAIL
Phase/checkpoint: C1B / R5 (second recheck after adviser intervention)
Consecutive FAIL count: 5
Repeated invariant IDs: R1-01 ×5; R1-02 ×5
Baseline: Desktop fce0d54 + Builder-file diff fingerprint 9989666a8e1c3aa78f225eaeca3e65546f00ce02d256f149a3955d702315412a
Authority: Detailed Plan SHA-256 03d040c21c69170e97ef545c2b829b7417dc7eeae5175d0f3db13fcc946c9d0e
Gates: checked 7, passed 4, failed 3, not checked 1 (final regression gate)
Findings: new 0, residual 2, repair-regression 1, harness-defect 1 corrected, acceptance-miss 0
Tests: 41 unique focused tests executed, 38 passed, 3 failed, 0 errors, 0 skipped
  - independent acceptance R1–R5: 21 executed, 18 passed, 3 failed
  - focused Construction R4+R5: 20 executed, 20 passed
Static checks: exo-app typecheck PASS; exo-app lint PASS
Full regression: deferred — three P1 runtime invariants block a final candidate
Provider calls: none
Unreviewed areas: 3 — final four-package/backend regression; Gate G provider UI probe/waiver; production-browser visual/responsive matrix
```

`H-05` was a same-baseline cardinality defect in the new Acceptance probe: the same branch uncertainty fact is deliberately projected by both runtime banner and modal. Acceptance changed only the wait selector from one element to one-or-more and reran; all three failures remained decisive.

### 13.2 C1B-R5-01 — P1 / residual of R4-02: accepted Stop is lost by initial activation/SSE continuations

**Observed evidence:** after a validated async ACK, active-snapshot persistence is forced to fail. Stop is correctly reachable and one stop POST is accepted. When storage recovers, the exact `begin-poll` retry transitions to ordinary `live`; independent evidence finds an enabled Stop button again while polling is still open. A second stop POST is therefore possible.

**Violated invariant:** accepted stopping remains authoritative until terminal/reconciliation; recovery may resume transport draining but must never regress to ordinary live or offer a duplicate Stop.

**Root cause — confirmed:** `stopPending` is stored on `RecoveryDescriptor`, but accepted-stop continuation rewriting handles only `resume-poll.preserveStop`. `begin-poll` and `continue-live` carry no stop fact, and `executeAfter()` always creates `live` for them. The same defect therefore affects initial async activation and suspended SSE activation.

**Required outcome:** every accepted-operation continuation (`begin-poll`, `continue-live`, `resume-poll`) must preserve accepted stopping through mutation retry and reread reattachment. Transport may start/continue solely to observe terminal output; Stop stays disabled/non-dispatchable and send remains locked. Stop failure remains explicitly retryable.

**Verification:** async and SSE active-persist failure → Stop once → successful exact retry/reread → transport resumes in stopping → no second stop POST → terminal reconcile. Preserve zero send re-POST and complete token/cursor durability.

### 13.3 C1B-R5-02 — P1 / repair-regression: reread ownership matches only a subset of stable owner fields

**Observed evidence:** after active-persist precondition read failure, Acceptance replaces the readable pending lease with another valid same-Conversation lease having the same operation/startedAt but different transport. `retryReread()` treats it as "our own" pending, conditionally overwrites it with the suspended async active snapshot and starts polling. The observed differing SSE owner is destroyed.

**Violated invariant:** stable durable operation owner is exactly `conversationId + operation + transport + startedAt`; a stale callback may neither overwrite nor remove a newer/different lease. Cursor/disposition/updatedAt are mutable snapshot fields, not owner substitutes.

**Root cause — confirmed:** the R5 own-pending shortcut compares only `operation` and `startedAt`; Conversation is implied by the storage key, but `transport` is omitted. The subsequent exact-snapshot CAS proves only that the observed bytes did not change between reread and set—not that they belonged to the suspended operation.

**Required outcome:** the own-pending path must require equality of every stable owner field before attempting upgrade. Any mismatch is adopted/interpreted as the observed operation; it is not force-written and executes no old continuation. Use one shared exact-owner predicate or equivalent single rule at every owner comparison.

**Verification:** vary each owner field independently (especially transport) while preserving mutable fields; observed lease remains byte-for-byte owned, old continuation does not poll/navigate/unlock, and actual observation is adopted/reconciled.

### 13.4 C1B-R5-03 — P1 / residual of R4-01: ambiguous branch discovery is skipped when uncertainty persistence fails

**Observed evidence:** an ambiguous branch POST plus verified-prior failure of `pending → uncertain` retains the valid pending marker and lock, but `queryClient.invalidateQueries(['conversations'])` is called zero times. The UI nevertheless says Recent was refreshed.

**Violated invariant:** malformed/network-ambiguous branch outcomes refresh Recent because a new Conversation may already exist, independently of whether the uncertainty marker transition succeeds. Marker non-success controls recovery/lock; it does not erase the discovery side effect.

**Root cause — confirmed:** branch ambiguity puts the Recent invalidation only inside the `persisted` arm. Mutation-unavailable, conflict and precondition-unavailable arms skip discovery even though server ambiguity is unchanged.

**Required outcome:** issue the positive Recent refresh for every ambiguous branch POST outcome (current or stale caller) exactly as the outcome matrix requires, while separately applying conditional marker semantics. No branch re-POST, no unlock on marker non-success, and no stale navigation/current-route mutation.

**Verification:** ambiguous outcome crossed with `persisted`, mutation-unavailable, conflict and precondition-unavailable, for current and stale caller; each refreshes Recent, preserves/adopts exact marker truth, and never issues a second branch POST.

### 13.5 Process diagnosis and immediate disposition

The core R4 architecture remains directionally sound and the original R4 failures now pass. The R5 failure is a cross-product completeness problem, not evidence that conditional storage or the single authoritative union must be discarded:

- Construction tested successful activation recovery and stop preservation during `resume-poll`, but not accepted Stop across `begin-poll`/`continue-live`.
- Construction added an own-pending optimization without applying the formal plan's complete stable-owner tuple.
- Branch tests covered ambiguous persistence success, but not discovery side effects when marker persistence is non-successful.
- Acceptance's R4 packet required stop preservation through recovery but did not enumerate `begin-poll` and `continue-live` as separate verification rows; ownership for this guidance gap is shared even though the production defects remain blocking.

Local source and decisive runtime probes are sufficient. No framework uncertainty or upstream-documentation question remains, so external research is unnecessary for escalation epoch 2.

Under the approved two-additional-FAIL rule, **ordinary repair is now PAUSED**. No R6 production edit is authorized until Alicia chooses an escalation disposition recorded in the escalation artifact. Recommended option: one final bounded R6 on the same checkpoint, but only after freezing the three-row cross-product matrix above and requiring tests that fail the current candidate before edits. Alternatives are a fresh Builder/model/session, decomposition into branch-discovery versus accepted-control sub-checkpoints, or closing/re-baselining C1B.

### 13.6 Preserve recommendations and locked boundaries

Preserve: single `OperationState`; conditional exact-prior storage algebra; route/modal caller token; source-result/caller-eligibility split; zero POST on predispatch storage failure; complete async token+cursor writes; cursor-before-next-GET; four-stage reconciliation and approved scrolled-away deferral; ancillary draft recovery; all 18 earlier Acceptance probes now passing.

Mechanical follow-up: remove the `[DBG70]` `console.log` left in `runtime_r5_invariants.test.tsx` and correct Construction Evidence's lease call-site count (current source sweep: 13 `persistRuntimeLease` and 6 `clearRuntimeLease` call sites; old parallel-truth vocabulary 0).

Construction must preserve all diffs, run no provider/full regression, make no commit and perform no further production edits pending Alicia's explicit epoch-2 disposition.

## 14. R6 Option A re-acceptance — bounded repair PASS / final Gate G hold

### 14.1 Factual summary

```text
Verdict: PASS for the bounded R6 repair; final C1B verdict not yet issued
Phase/checkpoint: C1B / R6 / escalation epoch 2 Option A
Consecutive FAIL count: remains 5 until final C1B PASS or explicit close/re-baseline
Repeated invariant IDs: no current residual; R1-01 and R1-02 repaired on this baseline
Baseline: Desktop fce0d54 + Builder-file diff fingerprint 5e24d3c8b0e42c67f98700785324b5f6161925dde03915957eb26735680cc012
Authority: Detailed Plan SHA-256 03d040c21c69170e97ef545c2b829b7417dc7eeae5175d0f3db13fcc946c9d0e
Deterministic gates: checked 7, passed 7, failed 0
Final Gate G: not checked — provider execution remains unauthorized pending Alicia decision
Findings: new 0 P0/P1; residual 0; repair-regression 0; harness-defect 1 corrected; P2 observations 3
Unique final regression tests: 284 passed, 0 failed/errors/skipped
  - exo-app: 163/163
  - V3 chat-core: 85/85
  - backend focused: 36/36
Additional focused subsets: Acceptance 21/21; Construction R4+R5+R6 24/24
Builds: exo-app build PASS; root recursive build PASS for app/chat-core/chronicle/council
Static: exo-app typecheck/lint PASS; git diff and cached diff checks PASS
V3 lint fingerprints: unchanged known debt — chat-core 168 problems (150E/18W), chronicle/council ESLint-config exit 2
Backend: check PASS; makemigrations dry-run PASS; pinned HEAD 29368bbf remains clean
Browser geometry: rebuilt production route PASS at 320/390/767/768 CSS px
Provider calls: none
Unreviewed/blocked area: 1 — controlled live Gate G (§10.2–§10.3)
```

### 14.2 R5 finding closure

- **C1B-R5-01 closed:** `continue-live`, `begin-poll` and `resume-poll` all carry the accepted/failed stopping fact. Independent async activation-retry evidence observes one Stop POST, then a disabled stopping control after recovery while transport drains. SSE sibling Construction evidence also passes.
- **C1B-R5-02 closed:** one `sameStableOwner` predicate compares Conversation, operation, transport and startedAt. A differing-transport valid pending lease remains untouched and executes no old polling continuation.
- **C1B-R5-03 closed:** ambiguous branch invalidates Recent before the conditional uncertainty transition, so persisted, mutation-unavailable, conflict and read-unavailable marker outcomes cannot suppress discovery; marker/UI/navigation handling remains independent.

All 21 Acceptance probes pass on the R6 fingerprint. Source sweep finds 13 runtime persist calls, 6 clear calls, one owner-comparison call site using the shared predicate, zero old parallel-truth vocabulary and zero debug logging residue.

### 14.3 Full deterministic regression and browser evidence

- `pnpm install --frozen-lockfile`: already up to date, no lockfile change.
- Exo-app full suite: 18 files, 163/163 PASS.
- Chat-core: 12 files, 85/85 PASS.
- Root recursive build: all four SPAs PASS; existing chunk/dynamic-import warnings only.
- Frozen V3 lint debt exactly matches C0/C1A: chat-core 168 problems (150 errors/18 warnings), Chronicle and Council lack ESLint 9 flat config (exit 2).
- Backend read-only checks and 36 focused tests PASS; test-double cleanup warnings do not change the successful result or backend worktree.
- Independent installed-Edge/CDP probe against the rebuilt `/app/chat/77` production route measured no horizontal overflow, composer/textbox visible with bottom exactly at viewport, `.app-scroll` as the scroll owner, no product bottom bar on detail, and the 768px sidebar switch at 320/390/767/768. `H-06`: the first 320 measurement occurred before the responsive rerender settled; Acceptance corrected the harness to set mobile metrics before navigation and wait for the detail composer. The corrected run passed all widths and cleaned its exact Edge process/profile.

### 14.4 Accepted non-blocking observations

1. A storage reread reattachment whose continuation is `ack-refresh` can require a second explicit reread before presenting acknowledgement; it remains locked and self-heals without duplicate write.
2. Reload after an accepted Stop loses the ephemeral stopping projection because stop outcome is not part of the approved durable lease schema; the active lease remains locked/recoverable and a repeated Stop is bounded by backend terminal/not-found handling.
3. Composer projects Stop during `submitting`, while the authoritative predispatch state rejects that control as a no-op. This is inert presentation drift, not a duplicate dispatch or unlock.

These are P2 follow-ups, not authorization for further C1B production edits. The R6 micro-matrix and frozen MUST behavior under review are satisfied.

### 14.5 Final Gate G hold

The Detailed Plan §10.2 and binary Gate G still require a controlled actual-V4-UI live probe or an explicit approved waiver/re-baseline. No provider call has been authorized or made. Therefore Acceptance does **not** yet write the final `C1B: PASS` line and does not authorize commit/P1C/P1D.

Alicia must choose:

- authorize the existing maximum-two-generation live probe budget, including temporary Drift Conversation, short SSE turn, one async attempt/stop race and branch verification with ORM cleanup/preset restoration; or
- explicitly waive/re-baseline Gate G while retaining deterministic frontend/backend evidence.

Construction is complete and should remain stopped. Gate G execution/waiver belongs to Acceptance and Alicia, not a new Builder repair cycle.

## 15. Gate G — live provider probe execution record

### 15.1 Alicia decision (2026-09-03)

Alicia chose Gate G **option 1 — execute the controlled actual-V4-UI provider probe** with an approved deviation: **reuse an existing conversation instead of creating one temporary Drift Conversation through the UI** (Detailed Plan §10.2 step 1, amended by this decision).

Findings that shape the reuse target:

- The real database currently contains **no zero-message conversation**; conversation 94 and the other empty shells from earlier cleanups no longer exist (ORM read-only listing of all 43 conversations).
- Nearest disposable existing candidate: conversation **72 `smoke`** — exactly one user message (`嘟。新窗口测试`, id 11089, 2026-06-23), no assistant reply; preset 5 `Ecki` (standard service, `deepseek-v4-flash`, visible); provider confirmed live on 2026-09-03 via telemetry (`raw_usage.csv`, deepseek rows on conversation 77 at 19:45 UTC).
- Conversations 102–105 (AGY/Alaric personal archives), 62/65 (real chats) and all others with content are excluded.

Cleanup contract (identical to §10.3, adapted):

- Probe-created Message rows in conversation 72 are deleted through the Django ORM afterwards, restoring 72 to its exact prior state (single message 11089).
- The branch conversation created by the probe is deleted through the ORM.
- No AgentPreset row is created, deleted or modified; closing real-DB baseline remains AgentPreset IDs 1–8.
- Transport: the V4 composer exposes an explicit SSE/async selector; probe covers one short SSE turn (intended generation 1) and one async-mode turn with immediate reload/re-entry (intended generation 2). Stop is only exercised if an active poll offers a real opportunity; otherwise classified honestly as a timing race (deterministic stop matrix remains the binary evidence).

Budget: at most two intended provider-generation attempts, per Detailed Plan §10.2. No retry beyond that without a new explicit Alicia approval.

### 15.2 Execution evidence (2026-09-03)

Environment: rebuilt production bundle (`index-CwiEG01A.js`, dist 22:24) served by nginx `:8080` against the live backend `:8000`; installed Edge headless/CDP with a fresh temporary profile; target conversation 72 `smoke` (preset 5 `Ecki`, standard, `deepseek-v4-flash`, visible). No page JS exceptions were observed.

**SSE turn — PASS (intended generation 1).** Prompt `请只回复两个字：收到` sent from the real composer in SSE mode. DOM evidence: optimistic user row; assistant streaming with incremental lengths sampled `[10, 19, 45]`; terminal assistant content `收到`. Server canonical pair: user Message 17442 (`20:53:55.011Z`, `user-input`), assistant 17443 (`20:53:55.648Z`, `deepseek-v4-flash`); telemetry row `20:53:55` (1259 in / 2 out). No duplicate content; composer cleared after acceptance.

**Branch — PASS (no generation).** From the persisted SSE assistant message: `分支` action → modal → `确认创建分支`; UI navigated to `/app/chat/118`. Server created Conversation 118 `Branch from smoke`, `parent_conversation_id=72`, preset 5, messages 17445–17447 (faithful copy: original 11089 + SSE pair), created at `20:57:01Z`. Navigation used the canonical server `conversation_id`.

**Async turn — attempted with honest classification (intended provider attempt 2; provider-side consumption unknown).** Transport select switched to `async` (value verified in the live DOM). Prompt `按顺序列出 1 到 15 的平方数，每行一个数字即可。` sent; a full page reload was triggered ~0.45 s later. Server persisted user Message 17444 (`20:55:27.569Z`). Client evidence that the ack token had reached the page before reload and the active snapshot survived: after re-entry the runtime recovered the lease, resumed polling, and replayed the buffered backend `status` event (`↗ 已发送，等待响应...`) as the observed runtime banner — i.e. lease recovery + `begin-poll` worked live. Source inspection shows this status is yielded after `LLMGateway.stream_chat(...)` is obtained but before the OpenAI-compatible stream is first iterated; therefore it proves entry into the provider boundary, not whether DeepSeek ultimately accepted/billed the request. No assistant content, provider chunk or usage telemetry row appeared in the ~90 s observation window; a single Stop was issued when the stop control became enabled (observed `正在停止生成…`), after which the runtime settled without duplicate dispatch/content. Classification: the async background consumer/provider boundary stalled before observable provider output. Exact upstream consumption is unknown; this is outside the zero-delta C1B frontend scope. The client-side async recovery/stop envelope is corroborated by the deterministic async/stop matrix (R1-01/R1-02 repair paths, 21/21 acceptance probes), which remains the binary evidence per Detailed Plan §10.2 item 4.

**Budget:** 2 of 2 approved intended provider-generation attempts were executed (SSE confirmed by telemetry; async provider consumption/billing unknown because no provider chunk or usage telemetry was observed). No third attempt was made.

**Cleanup:** Message rows 17442–17444 deleted via ORM together with one `MessageEmbedding`; Conversation 118 deleted via ORM cascade (3 messages + 1 `MessageActivity`). Conversation 72 restored to its exact prior state (single Message 11089). Closing real-DB baseline: AgentPreset IDs 1–8 OK. Edge process and temporary profile removed; a final re-check confirmed no late server-side write arrived in conversation 72 after cleanup.

### 15.3 Gate G verdict

Gate G closes **PASS** with the honest async-leg observation above: SSE live turn, canonical reconciliation, real branch creation/navigation and ORM cleanup all verified against the actual V4 UI and live provider; the async leg exercised real lease recovery after reload and exercised the stop control, while the missing server-side generation is classified honestly and the deterministic matrix remains the binary evidence.

With Gate G closed, all Detailed Plan §11 binary gates are now checked and passed on the R6 baseline. **Acceptance issues the final `C1B: PASS` line.**

### 15.4 Non-blocking backend follow-up discovered during Gate G

This probe also exposed an existing backend transport limitation outside C1B: async Stop is cooperative rather than a hard cancellation of the provider HTTP stream. `ChatStreamStopView` sets the token's `threading.Event`, while `services.py` checks that stop flag only between yielded provider chunks. The OpenAI-compatible DeepSeek client currently has a 600-second timeout. Therefore a request stalled before the first provider chunk can accept a Stop request at the ExoCore endpoint yet remain blocked inside the provider call until a chunk/error/timeout returns. This observation does not reopen C1B and requires no Desktop repair; retain it as a later backend transport/cancellation follow-up.
