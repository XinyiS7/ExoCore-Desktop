# P2D CP D-2 Acceptance Escalation — Epoch 1

> **Status:** CONSTRUCTION PAUSED after third consecutive FAIL. No production repair is authorized until the resume conditions below are met.
> **Owner:** Solaire / Independent Acceptance
> **Checkpoint:** P2D CP D-2

## 1. Three-cycle timeline

| Cycle | Mechanical evidence | Decisive result |
|---|---|---|
| R1 | focused 28/28; full 1020/1020; typecheck 27 errors; build FAIL | weak SW/Main validation, false subscription health, incomplete ACK lifecycle, copied SW tests |
| R2 | original probes 2/2; D-1 34/34; D-2 32/32; typecheck/lint green; expanded probes 1/5 | actual-worker harness fixed, but typed/subscription/ACK matrices still incomplete |
| R3 | Acceptance 5/5; D-1 34/34; D-2 39/39; typecheck/lint/diff green | subscription truth closed; single validator and cold/no-client ACK recovery still violate frozen architecture |

The process is not stuck on syntax. It is stuck where browser lifecycle, ownership and frozen constraints meet.

## 2. Balanced causal diagnosis

### Construction-owned

1. “Same rules in two files” was treated as “single validator owner.” The R3 evidence claims one owner while naming both `validateWorkerArrivalEvent` and `validateArrivalEvent`.
2. ACK Matrix C claims cold start receives `ack_outcome`, but the cold `openWindow()` return value is discarded and no message is sent.
3. A closed typed message union was not updated for `SW_ACK_RESULT` or the extended navigate envelope.
4. The Plan stop condition for inability to share worker-safe validation was not raised; a duplicate implementation was retained instead.

### Acceptance-owned

1. R1/R2 probes were too sample-oriented. By R3 all five passed while source-level ownership/lifecycle violations remained.
2. Earlier repair guidance required recoverable SW close failure while also preserving stateless SW, but did not isolate the no-client/offline impossibility before asking Construction to converge.

### Spec-owned

D3 says Service Worker is stateless. D7 says ACK failures retain a pending-retry fact for the next safe trigger, including notification close. When `notificationclose` fires with no window and its network request fails, localStorage is unavailable to SW and there is no client to receive state. Durable recovery requires worker-accessible persistence (normally IndexedDB), which D3 intentionally removed. Opening a window from notification close is not a valid substitute.

### Harness/environment

- Current harness is valid; all five probes pass. The remaining miss is coverage, not a false probe.
- No environment failure contributes to R3.

## 3. Official browser evidence

Grounded search used sanitized public terms only. Official MDN evidence confirms:

- `notificationclose` runs in `ServiceWorkerGlobalScope` and `event.waitUntil()` can extend only that event's work.
- `Clients.openWindow()` is tied to allowed user activation; notification click provides the relevant user interaction, notification close is not a reliable window-opening path.
- Service workers do not have `localStorage`; IndexedDB is the normal durable asynchronous storage available in worker context.

References:
- https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/notificationclose_event
- https://developer.mozilla.org/en-US/docs/Web/API/Clients/openWindow
- https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API

Conclusion: no-client/offline close-ACK retry cannot be guaranteed under both “stateless SW” and “retry next safe trigger.”

## 4. Rebuilt invariant route

### Required outcome — typed contract

A single pure worker/window-safe module owns event normalization, typed target validation and all SW message envelopes. `contract.ts` may wrap its failure result into `contractError`, but may not reimplement validation. Production message kinds and payload fields must all exist in that closed contract.

### Non-binding adviser direction

Extract a side-effect-free parser returning a discriminated `{ok,value}|{ok:false}` outcome into a worker-safe module with no `chat/api` or window imports. Window polling wraps failures for UI error reporting; SW uses the same parser directly.

### Required outcome — ACK

For click/view/consume, exactly one normal network owner must be observable across SW/Main and a cold-opened client must receive the outcome/intent before canonical consume can resend. Main persistence must surface storage corruption/unavailability rather than silently claiming durable retry.

### Product decision required — notification close

Choose one:

1. **Recommended:** notification-close ACK is best-effort inside `waitUntil`; if no client exists and the request fails, no cross-lifecycle retry is promised. Keep stateless SW and record this narrow limitation.
2. Allow a minimal IndexedDB queue for ACK outcomes only. This changes the stateless-SW architecture and adds schema/corruption/cleanup work.
3. Remove `notificationclose` ACK; only explicit App dismiss and notification click send ACK. This simplifies semantics but changes D7 behavior.

## 5. Builder obstacle report requested

Before any further edit, Builder answers:

1. Why was a second validator retained after the “single owner” requirement?
2. What module/import constraint blocked a worker-safe shared parser?
3. How was cold `openWindow()` expected to transfer `ack_outcome` to Main?
4. How was no-client `notificationclose` failure expected to survive without worker persistence?
5. Which matrix row does Builder now believe is internally inconsistent, and which route does it recommend?

## 6. Resume conditions

Construction resumes only after:

1. this artifact is tracked;
2. Builder obstacle report is received (or nonresponse recorded);
3. Alicia chooses notification-close option 1, 2 or 3;
4. Acceptance records `RESUME AUTHORIZED`, including the chosen spec amendment and recheck scope;
5. Builder restates the revised single-validator and ACK ownership matrices before editing.

Frozen assets remain `packages/app/src/acceptance/**` and all Acceptance reports/escalation artifacts.

## 7. Obstacle report and product decision

Builder obstacle report was received before resume. Builder confirmed:

- the second validator was retained to keep the frozen source-evaluation harness green instead of raising the import/harness obstacle;
- `contract.ts -> chat/api.ts` is not worker-safe, so a pure parser module is required;
- cold `openWindow()` did not actually transfer ACK outcome to Main;
- no-client/offline `notificationclose` retry is impossible without worker persistence;
- option 1 is the recommended product trade-off.

Alicia then instructed “继续施工”, accepting the immediately preceding recommended **option 1**: keep SW stateless; notification-close ACK remains best-effort when no client exists and the request fails. No IndexedDB is authorized.

## 8. RESUME AUTHORIZED — controlled R4

Authorized R4 outcomes:

1. one pure worker/window-safe arrival parser implementation; both SW and window adapter consume it;
2. closed versioned SW message contract includes every production message and ACK field;
3. warm click: SW owns navigate ACK and transfers typed outcome to the selected client;
4. cold click: SW does not send navigate ACK first; Main owns the single ACK after canonical arrival confirmation; no ACK data in URL;
5. close: SW best-effort ACK; outcome is transferred when a client exists; no-client retryable failure ends without cross-lifecycle promise;
6. ACK registry corruption/unavailability cannot be silently described as durable state;
7. evidence matrices must describe these exact branches.

Acceptance owns adaptation of the frozen source harness after handoff. Builder must not edit `src/acceptance/**`; a temporary ReferenceError in that frozen probe after importing the shared parser is not a construction failure. Builder must instead keep its real-worker production test harness current and stop at the R4 handoff. D-3 remains unauthorized.

## 9. Controlled R4 result

R4 received a binary FAIL. This is post-escalation failure 1 of 2, not a new ordinary epoch. The approved warm/cold/close ACK ownership route is now independently confirmed. Remaining blockers are bounded to: removal of a test-oriented global parser alias, required-nullable `register_ack` presence, complete ACK-envelope runtime validation, and semantic ACK-store hydration/send validation. Acceptance corrected one worker-double defect before verdict; it is not charged to Construction. See the R4 section of `Plan/V4_Phase_2D_CP_D2_acceptance_report.md` for the authoritative repair/recheck packet.

## 10. Escalation epoch closure

Controlled R5 received final PASS. All four R4 blockers are closed, the full app regression and production `/app/` mapping are independently green, and CP D-2 is accepted. The escalation epoch is closed; consecutive FAIL count resets to zero. The accepted no-client notification-close best-effort limitation remains authoritative. CP D-3 is a separate Plan gate and is not released by this closure.
