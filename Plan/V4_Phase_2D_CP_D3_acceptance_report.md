# P2D CP D-3 Independent Acceptance Report

> **Owner:** Solaire / independent Acceptance
> **Checkpoint:** CP D-3 — Android/desktop closure, recovery, and P2D final evidence
> **State:** R3 CODE/AUTOMATED PASS; final real-device/recovery smoke pending; P2D Final Hold remains closed
> **Entry baseline:** `e96e4ca37c09f06fe75f8614a429ab0ca03d383c`
> **Authority:** Plan/V4_Phase_2D_Assistant_Message_Arrival_Notifications_Detailed_Plan.md §5 CP D-3, §6, §8
> **Authorization:** Alicia explicitly released CP D-3 for real-device closure, real Sandro send_message, and recovery matrix.

## 1. Frozen ownership and entry facts

- Construction may update production files, construction tests, Construction Evidence, Roadmap capability status, and Update Log only within the Plan's D-3 boundary.
- Construction must not edit packages/app/src/acceptance/**, this report, D-1/D-2 acceptance reports, backend/V3/shared/nginx, real AgentPreset data, or the B6 contract.
- Real-device evidence must be sanitized: no private message body, endpoint, p256dh/auth, token, or secret.
- Automated verification must not invoke a paid provider. The real Sandro smoke is permitted only under Alicia's explicit D-3 authorization and must be bounded to the agreed manual operation.

### Entry hashes

| Frozen asset | SHA-256 at D-3 entry |
|---|---|
| Detailed Plan | `9264e0664fd2fa3e4683d42979867b95df4958dc1ee0ca1abf76cdcbc4b84071` |
| D-1 Acceptance probe | `bfdf7b2becb075e2432e9317bca5a21d8c29d9630fd80ce82158ea86e91f39df` |
| D-2 Acceptance probe | `d84e4ed269d48f56d3f7c0d18746d98a07837ea63173ac92703f93adab9ef398` |
| D-1 Acceptance report | `4cb77fa1e69039b11a8f52ca7f5a2275bec8963341c7050b043e03b4f34de083` |
| D-2 Acceptance report | `4a07c4e17662cfaf132751da3570510f828aa6c9e010b45396c9509709b25bf2` |

## 2. Frozen D-3 gate matrix

| ID | MUST outcome | Decisive evidence |
|---|---|---|
| D3-G01 | Baseline, scope and B6 contract remain intact; no sibling/backend/new-dependency change. | Git ownership sweep; Desktop/backend §8 equivalence; manifest/dependency diff. |
| D3-G02 | Before device tests, read-only backend evidence shows exactly one expected active endpoint/installation for the device. Legacy-null, stale or duplicate active rows stop the matrix for separately authorized maintenance; P2D performs no deletion. | Sanitized row count and identity correlation; no endpoint/keys printed. |
| D3-G03 | Trusted-HTTPS installed Android PWA passes exact foreground, other foreground, visible-unfocused exact, background, closed, lock-screen, warm click and cold click with the §6.3/§6.4 notification counts and canonical route/message behavior. | Timestamped device/browser observations plus correlated sanitized event/message/dedupe IDs. Screenshot alone is insufficient for identity/dedupe. |
| D3-G04 | Desktop production PWA passes focused, unfocused and multi-window selection: one focused scoped client suppresses OS notification; hidden/nonfocused-only clients do not. | Browser observer/network evidence and visible notification count. |
| D3-G05 | One authorized real Sandro send_message yields exactly one canonical Message, one arrival event and one frontend display path; no legacy direct-Push double notification. | Sanitized positive IDs/counts from authoritative read-only sources plus Alicia-visible result; no private content. |
| D3-G06 | Denied permission, offline→online, renewal/repair, backend persistence failure, stale/deleted target and foreground recovery preserve message freshness and report truthful state without redirecting to another conversation. | State-transition observations and bounded network/status evidence. |
| D3-G07 | Warm/cold/system/App/exact ACK ownership remains correct; failures never block message/navigation; retryable and terminal states remain truthful. Approved no-client close retry failure remains best-effort. | Sanitized request counts/action/status and existing independent/production probes. |
| D3-G08 | Clearing site data creates a new installation UUID and the residual-endpoint risk is explicitly documented; no claim of automatic legacy-null merging. OEM battery optimization and DND suppression are recorded as environment state, not backend/app failure. | Before/after non-secret identity evidence and environment checklist. |
| D3-G09 | D-1/D-2 independent probes, D-3 focused construction tests, full `exo-app` regression, typecheck, lint, build, built-SW inspection and git diff --check all have zero failures with numeric totals. | Acceptance-controlled command output and production /app/ harness. |
| D3-G10 | Construction Evidence, Roadmap capability record and required Update Log are factual and mutually consistent; C2 is not self-released. | Source/report cross-check; no unsupported PASS wording or secret/private data. |

## 3. Binary verdict rule

CP D-3 receives PASS only if D3-G01 through D3-G10 all pass. Any unmet MUST, missing decisive real-device proof, unauthorized data mutation, frozen-asset edit, secret leakage, or environment-not-ready precondition produces FAIL. Environment suppression may be classified separately only when backend/app delivery is positively demonstrated.

## 4. Accepted limitations / non-goals

- Unread is installation-local; no cross-device seen synchronization.
- A retryable `notificationclose` ACK with no client is best-effort and not durable across SW lifetime.
- OEM/DND may suppress system presentation; this does not waive proof of backend arrival and app recovery.
- No server unread/seen endpoint, native Android service, notification center, Group/Council/system alerts, or C2 acceptance is included.

## 5. Review-cycle ledger

| Cycle | Checkpoint | Baseline | Verdict | Cause owners | Finding IDs | Consecutive FAIL | Repeated invariants |
|---|---|---|---|---|---|---:|---|
| R0 | P2D CP D-3 | `e96e4ca` + staged Acceptance assets | PREPARED | none | none | 0 | none |
---

## R1 — Independent verification of `0bed2fc`

```text
Verdict: FAIL
Phase/checkpoint: P2D CP D-3
Baseline: e96e4ca -> 0ca8985 -> 0bed2fc, plus untouched staged Acceptance assets
Consecutive FAIL count: 1
Gates: checked 10; passed 2; failed 8; not checked 0
Findings: new 5; residual 0; repair-regression 0; harness-defect 1; acceptance-miss 0
Focused tests: 114/114 passed (7 files); failed 0; errors 0; skipped 0
Static gates: typecheck PASS; lint PASS; build PASS; git diff --check PASS
Full regression: not run because known D3-G02/G03/G05/G06/G08/G10 blockers prevent final PASS
Unreviewed areas: none; missing evidence is explicitly classified below
```

### Acceptance-owned correction (not Builder FAIL)

The R0 report generator allowed PowerShell to interpret Markdown backticks, corrupting several code spans and hash substitutions. Acceptance corrected the report on the same baseline, restored the five true SHA-256 entry hashes, confirmed no remaining control characters, and reran `git diff --check`. Cause owner: Acceptance 1; Builder FAIL counter unaffected.

### Passing facts to preserve

- **D3-G01 PASS:** D-3 production delta is confined to `subscription.ts` and `settings.css`; evidence/log changes are scoped; no dependency, backend, V3, shared, nginx or frozen-asset edit. Desktop/backend ReactSheet 第八篇 are byte-identical: 12,435 UTF-8 bytes, SHA-256 `f4ad0067a123e2ff6a89e0c42c7ac3a15f60f4591c77184f6b6c0b78cac11d1c`.
- The HTTP 415 repair is functionally correct: four notification POST call sites now pass object bodies through the real `exo-shared/apiFetch`, which serializes JSON and sets `Content-Type: application/json`. Explicit caller headers are redundant but harmless.
- The responsive CSS repair is correctly bounded: mobile `.settings-layout` is column; desktop >=768px restores row; no second consumer exists.
- Canonical identity is positively verified read-only: Message 19066 is one assistant Message in Conversation 95; exactly one arrival 19 exists with source `send_message` and Register 2262; no duplicate `(arrival, subscription)` delivery claims.
- **D3-G07 PASS:** existing independent/construction lifecycle probes remain green, including warm/cold ACK ownership, typed navigation, retryable/terminal behavior and approved stateless close best-effort semantics.
- Focused preservation: D-1/D-2 plus P2C appearance 114/114; typecheck/lint/build/diff all PASS. Real DB AgentPreset baseline was 8 rows before and after the read-only audit.

### Blocking findings and repair packet

#### D3-R1-01 — `new` — P1 — Legacy subscription stop-condition was bypassed

**Authority:** Plan CP D-3 step 2; §6.8; D3-G02 and D3-G05.

**Evidence:** The preflight found active legacy-null subscriptions 21, 32 and 49 plus V4 subscriptions 51 and 52. Read-only DB verification shows arrival 19 created five `sent` deliveries: 69→21, 70→32, 71→49, 72→51, 73→52. Thus legacy endpoints were not merely historical rows; they participated in the real Sandro fan-out. The Plan required Construction to stop and obtain separate maintenance authorization before the matrix.

**Required outcome:** Do not mutate the real DB under P2D authority. Pause real-device retesting and ask Alicia for explicit maintenance authorization. A backend-owner maintenance action must positively identify and soft-deactivate/unsubscribe only obsolete test-device endpoints, preserve unrelated devices, run the 8-row AgentPreset baseline before/after, and report sanitized results. After the device has exactly one intended active endpoint/installation, rerun one bounded real Sandro smoke and correlate the clean delivery set.

#### D3-R1-02 — `new` — P1 — Real delivery evidence is factually wrong

**Authority:** Plan §8; D3-G05/D3-G10.

**Evidence:** Construction Evidence attributes deliveries 77/78 to arrival 19 and subscriptions 51/52. Actual arrival-19 deliveries are 69–73 to all five active subscriptions. Deliveries 77/78 belong to arrival 20, which the same paragraph also identifies as range 74–78.

**Required outcome:** Correct the IDs and disclose all legacy fan-out. Do not claim “one frontend delivery path/no double push” from the contaminated run. After authorized cleanup and rerun, record one canonical Message, one arrival, the exact sanitized delivery count/IDs, device-visible notification count, and whether any duplicate appeared. Remove full installation UUIDs from general evidence or replace them with stable redacted prefixes/hashes.

#### D3-R1-03 — `new` — P1 — Required real-device/browser matrix is incomplete

**Authority:** Plan CP D-3 steps 1/3/6; §6.4; §6.8; D3-G03/G04/G06/G08.

**Missing decisive rows:** Android visible-but-unfocused exact and lock-screen are not itemized; desktop multi-window focus selection is absent; denied permission, offline→online, renewal/repair, backend persistence failure, stale/deleted target, site-data-clear/new-installation behavior, and OEM battery/DND state are not reported as executed outcomes. “多个场景” cannot be expanded into unlisted rows.

**Required outcome:** Add an executed matrix with one row per frozen state, observed OS/App indication counts, final route/message visibility, and evidence source. Existing deterministic D-2 probes may satisfy failure/recovery rows when mapped by literal test name and production path; rows requiring OS/browser lifecycle must use sanitized Alicia/device observations. Site-data-clear may be demonstrated deterministically plus explicit residual-endpoint risk; do not create another real endpoint merely for ceremony. Record OEM battery/DND as enabled/disabled/not applicable and separate environment suppression from app/backend failure.

#### D3-R1-04 — `new` — P1 — Both real-device bug fixes lack recurrence protection

**Authority:** Project Definition of Done; Plan CP D-3 step 5 and §6.8/D3-G09.

**Evidence:** Existing fetch mocks accept both the former pre-stringified body and the repaired object path; no assertion observes the effective request media type. No construction/browser test protects the mobile column/desktop row breakpoint. Reverting either repair leaves the reported 1055 suite green.

**Required outcome:** Add focused regressions that fail on the pre-fix behavior and pass on the delivered behavior: effective JSON media type/body for the affected Push API calls, and mobile-vs-desktop settings layout at the 768px boundary. Use the real `apiFetch` path and an existing browser/CSS verification pattern; do not copy Acceptance implementation or introduce test-only production branches.

#### D3-R1-05 — `new` — P1 — Evidence/log overstate closure and misdescribe facts

**Authority:** Plan §8; D3-G10.

**Evidence:** Construction Evidence still has the D-2 title/baseline/authorization, lacks D-3 entry ownership, repeats pre-D3 test totals as D-3 proof, and self-declares all invariants closed. Update Log says `apiFetch` itself was fixed though only callers changed, says FCM was verified beyond provider `sent` truth, and asserts lock-screen without an itemized evidence row.

**Required outcome:** Rebuild the D-3 evidence section against D3-G01–G10 with factual status only. Describe the 415 repair as object bodies passed to existing `apiFetch`; distinguish provider-accepted `sent` from OS presentation; align lock-screen and other rows with actual observations. Construction may say READY FOR RECHECK, not award D-3/P2D PASS. Do not mark Core C2 released; Roadmap final status remains Acceptance-owned until PASS.

### Preserve / recheck scope

Preserve the accepted D-1/D-2 implementation and the two correct D-3 production repairs unless a focused regression exposes a real defect. Recheck: corrected evidence/log; authorized subscription maintenance record; clean bounded smoke; complete device/recovery matrix; new focused regressions; D-1/D-2/P2C preservation. Full app regression and production bundle/harness are deferred until all P0/P1 findings clear.

## R1 ledger row

| Cycle | Checkpoint | Baseline | Verdict | Cause owners | Finding IDs | Supersedes/amends | Consecutive FAIL | Repeated invariants |
|---|---|---|---|---|---|---|---:|---|
| R1 | P2D CP D-3 | `0bed2fc` | FAIL | Construction 5; Acceptance 1; Harness 0; Spec 0; Environment 0 | D3-R1-01..05 | R0 preparation; R0 formatting corrected by Acceptance | 1 | none |

### R1 user-authorized environment amendment (no new verdict cycle)

Alicia positively identified all five active subscriptions as intended current/test origins and explicitly accepted duplicate Android Push caused by keeping separate Home-LAN and Tailscale origins:

- 21: Mac / Tailscale — retain;
- 32: Android / Tailscale — retain;
- 49: Android / Home LAN — retain;
- 51: Windows V4 test installation — retain;
- 52: Android V4 test installation — retain.

Accordingly, no PushSubscription maintenance is authorized or required, and D3-R1-01 is closed by explicit product/environment re-baselining rather than data mutation. D3-G02 is amended from one physical-device endpoint to **one endpoint per intentionally retained browser origin**, with the expected active set `{21,32,49,51,52}`. Android Home/Tailscale duplicate OS presentation is an accepted multi-origin limitation, not an at-most-once failure within one installation.

D3-R1-02 remains open only for factual correction: the prior smoke expected five delivery claims (69–73), not two. Because all five are now confirmed intended, no cleanup smoke is required. The final post-contract-amendment Sandro smoke must expect one Message, one arrival, five per-subscription delivery claims, at most one OS notification per installation/origin, and one idempotent explicit-ignore Register globally per arrival.
### Backend amendment accepted / frontend R2 release

The user-approved explicit-ignore amendment supersedes the old D3-G07 navigate/dismiss ACK gate and the corresponding D-2 acceptance expectations:

- notification body/view navigates with zero Register ACK;
- system X/swipe is neutral and performs zero network request;
- only typed `ignore.allowed=true` exposes an explicit Ignore action;
- OS/shell Ignore calls `POST /api/push/assistant-arrivals/<event_id>/ignore/`, never navigates and never clears installation-local unread;
- shell failure remains visible and explicitly retryable; stateless no-client/offline OS Ignore is documented best-effort;
- backend legacy ACK endpoint remains, but V4 sends no navigate/dismiss ACK for either new or rolling legacy events.

Backend production was independently accepted at `74802208`; backend contract/docs closed at `f7bef663`. Desktop R2 construction is authorized against `Plan/spec/2026-09-14-assistant-arrival-explicit-ignore-handoff.md`. Existing Acceptance-owned D-2 probes encode the superseded ACK contract and are excluded from Builder evidence until Acceptance independently amends them; Construction must not edit them or retain dead production ACK machinery merely to satisfy obsolete probes.

All five active subscriptions `{21,32,49,51,52}` remain intentionally retained. Final smoke expects one Message, one arrival, five per-origin delivery claims, at most one presentation per installation/origin, and one global idempotent Ignore Register if Alicia deliberately uses Ignore.


---

## R2 — Frontend explicit-ignore amendment code recheck

```text
Verdict: FAIL
Phase/checkpoint: P2D CP D-3 R2 frontend amendment
Baseline: HEAD b2168089 + Builder-file diff fingerprint a0c3f23dc91095896f40dbef6ac9274c4e01cc35f09530d969225e064b9b3574
Consecutive FAIL count: 2
Repeated invariant IDs: none (R2 findings arise from the approved explicit-ignore amendment)
Gates: checked 10; passed 3 (G01, amended G02, G10); failed 2 (G07, G09); not checked 5 (G03-G06, G08 final device/recovery closure)
Findings: new 2; residual 0; repair-regression 0; harness-defect 1 corrected; acceptance-miss 0
Acceptance probes: executed 19; passed 16; failed 3; errors 0; skipped 0
Builder focused: 5 files / 81 tests passed; failed 0
Static evidence: Desktop/backend ReactSheet §8 byte-identical (9,933 chars; SHA-256 5d7da6c...); production ACK-removal search 0 matches; git diff checks PASS
Full regression: deferred because two known P1 findings and temporary acceptance exclusions prevent a final candidate
Unreviewed areas: 5 frozen final-device/recovery gates (G03-G06, G08); they remain for final smoke after code PASS
```

### Evidence pin and Acceptance harness correction

Before Acceptance amendments, Construction had not edited the frozen probes: D-1 remained `bfdf7b2b...` and D-2 remained `d84e4ed2...`, matching the entry hashes. The approved backend contract made both probes stale: D-1 fixtures lacked required `ignore`, while D-2 encoded the superseded ACK state machine. Acceptance—not Construction—owns this `harness-defect` and amended the probes, then added `packages/app/src/acceptance/p2d_d3_acceptance.test.tsx` for target/timing behavior.

Amended Acceptance hashes:

- D-1: `dde664a675b23eeeb528d084d55f74ce711704129fec7e9ebf46a00c1c2129f8`
- D-2: `4bc8a53c93ab5abcec7a25f1ec4c367dc3d25e08e1ebf9686cf6855c6e6928f7`
- D-3 timing: `6d38b0a3d4ab2ad1597672e62705424810cde62fc88529d24aff0f58234580e5`

One initial adversarial assertion required a forged `event.action='ignore'` with `ignore.allowed=false` to make zero requests. Acceptance retracted it before verdict: the browser can return only an action declared by `showNotification`, and production correctly declares Ignore only for `allowed=true`. This was reviewer hardening without a real entry path and is not counted against Construction.

### D3-R2-01 — P1 — `new` — malformed ignore 2xx is reported as successful

- **Observed evidence:** amended D-2 Acceptance probe returns `{action:'ignore'}` and a response with mismatched `event_id`; `ignoreAssistantArrival(21)` returns `ok:true`. Source at `subscription.ts:557-565` validates only the action string, makes `created` optional, and explicitly treats every other 2xx body as success.
- **Violated invariant:** ReactSheet §8.5 freezes the complete five-field response; amendment §3.7 and D3-G07 require truthful failure without losing/fabricating UI state.
- **Root cause:** **Confirmed.** The write-response adapter has no complete identity/shape validator and includes an unconditional success fallback.
- **Affected sibling paths:** active-window Shell Ignore consumes this helper. The stateless SW Ignore path remains accepted best-effort and does not use response truth for UI, so it need not gain a durable result channel.
- **Required outcome:** accept success only when `action==='ignore'`, `event_id` equals the requested positive ID, `message_id` and `conversation_id` are positive integers, and `created` is boolean. Any malformed/mismatched 2xx must return visible retryable failure; the indication and unread remain; no automatic retry/navigation/Register ACK occurs.
- **Suggested direction (non-binding):** use one pure response guard adjacent to `ignoreAssistantArrival`; preserve the existing bounded result union.
- **Chained effects:** update helper construction tests for complete valid response, missing field, wrong type and mismatched identity; keep 404/409 mappings.
- **Preserve recommendation:** object JSON body, endpoint path, bounded status mapping and secret-safe error text.
- **Escalation trigger:** if repair requires changing backend response shape or shared `apiFetch`, pause; neither is currently necessary.

### D3-R2-02 — P1 — `new` — late Ignore completion mutates the wrong active indication

- **Observed evidence:** two independent D-3 timing probes drive real `NotificationRuntime`: Ignore A remains pending, arrival B replaces the bounded shell indication, then A settles. A success unconditionally clears B (`NotificationRuntime.tsx:367-369`); A failure attaches `offline` to B (`:370-371`). The global `ignoreBusy` also disables B while A is pending (`:350-365`, `:467`). Both probes fail deterministically after `act()` harness correction.
- **Violated invariant:** amendment §3.7 and D3-G07 require Ignore failure/success to preserve Message/unread/navigation truth; D-1 bounded replacement means a newer indication is a distinct target and must not inherit another event's pending/error/completion state.
- **Root cause:** **Confirmed.** Ignore state is global booleans/text, and async completion is not guarded by the captured event identity.
- **Affected sibling paths:** old-success→new-arrival, old-failure→new-arrival, and a second event becoming actionable while the first request remains in flight. Ordinary local Close and View are otherwise healthy.
- **Required outcome:** pending/error/result state must be bound to the targeted `event_id`. If a newer indication is active, an older completion must not close it, display an error on it or leave its button busy. If the original event remains active, success closes only that event and failure remains visible/retryable. Installation-local unread is unchanged in all cases.
- **Suggested direction (non-binding):** tag ignore UI state by event identity and use identity-guarded functional state updates; do not rely on a closure-wide boolean or introduce a durable retry registry.
- **Chained effects:** recheck rapid event replacement, same-event explicit retry, success, 404/409/network failure, and View while no Ignore is pending.
- **Preserve recommendation:** one bounded indication, no automatic retry, explicit user retry, zero navigation and unread preservation.
- **Escalation trigger:** if a proposed repair requires queueing multiple banners or changing D-1 unread storage, pause for scope review.

### Harness/mechanical closeout — Acceptance owner corrected; Builder action required

The amended D-1/D-2 probes are now available and tracked. Remove all temporary exclusions for these files from `tsconfig.json`, `eslint.config.js`, and `vite.config.ts`; default typecheck/lint/test discovery must include the frozen Acceptance assets again. This is required in the current repair but is not an additional Construction P1—the exclusion was an authorized bridge while Acceptance updated its assets.

### Passing behavior to preserve

- Five Builder suites pass **81/81**.
- `ignore.allowed` is required and typed; required nullable legacy `register_ack` remains parsed but no longer drives Ignore.
- OS action is emitted only for `ignore.allowed=true`; ordinary events omit it.
- Warm/cold body click and Shell View navigate with zero Register ACK; `notificationclose` is neutral.
- ACK state machine, registry, diagnostics UI, SW ACK message and `/api/agents/registers/` production references are absent.
- Desktop/backend ReactSheet §8 is byte-identical; corrected D-3 evidence remains READY FOR RECHECK rather than self-awarding PASS.

### R3 repair and recheck order

1. Close D3-R2-01 at the response boundary.
2. Close D3-R2-02 with event-targeted async state and construction regressions.
3. Remove the three temporary Acceptance exclusions; do not edit Acceptance-owned tests/reports.
4. Recheck amended D-1, D-2 and D-3 probes first, then the five Builder focused suites.
5. Only after all focused evidence passes: typecheck, lint, build/built-SW inspection, full app regression, and final D-3 real-device/recovery smoke.

## R2 ledger row

| Cycle | Checkpoint | Baseline | Verdict | Cause owners | Finding IDs | Supersedes/amends | Consecutive FAIL | Repeated invariants |
|---|---|---|---|---|---|---|---:|---|
| R2 | P2D CP D-3 frontend amendment | `b2168089` + Builder diff `a0c3f23d...` | FAIL | Construction 2; Acceptance/Harness 1 corrected | D3-R2-01, D3-R2-02; H-R2-01 corrected | R1 backend amendment release | 2 | none |

---

## R3 — Independent code/automated recheck

```text
Verdict: CODE/AUTOMATED PASS; FINAL DEVICE HOLD
Phase/checkpoint: P2D CP D-3 R3
Findings closed: D3-R2-01, D3-R2-02
Focused recheck: 8 files / 106 tests / 106 PASS
  - Acceptance-owned D-1/D-2/D-3 probes: 19/19 PASS
  - Builder focused P2D suites: 87/87 PASS
Full exo-app regression: 89 files / 1064 tests / 1064 PASS
Static gates: typecheck PASS; lint PASS; build PASS; git diff --check PASS
Built SW: /api/agents/registers/ refs=0; assistant-arrival ignore endpoint refs=1; notificationclose handler refs=1
Remaining final gates: D3-G03, G04, G05, G06, G08 real-device/recovery evidence
```

### R3 independent findings disposition

- **D3-R2-01 CLOSED.** `subscription.ts::isValidIgnoreResponse()` accepts a 2xx success only when all frozen response facts are valid: `action==='ignore'`, exact requested `event_id`, positive `message_id`/`conversation_id`, and boolean `created`. Malformed or mismatched 2xx returns visible retryable failure and does not fabricate success.
- **D3-R2-02 CLOSED.** `NotificationRuntime` binds Ignore busy/error/completion state to the target `event_id`; an older request completion cannot close, annotate, or disable a newer indication. Same-event failure remains visible/retryable, and View during a pending Ignore remains navigable with late completion becoming irrelevant to the new route state.
- Temporary D-1/D-2 Acceptance exclusions are removed from `tsconfig.json`, `eslint.config.js`, and `vite.config.ts`; amended Acceptance assets participate in default typecheck/lint/test discovery again.
- The Builder's junction/worktree recovery claim is consistent with current filesystem truth: `packages/app/node_modules` and `packages/shared/src` are present, and independent full regression/typecheck/build all succeed. No residual deletion symptom was found.
- React `act(...)` warnings remain test-harness noise only; they produced no failed test or production invariant failure and are not a P2D blocker.

### Final Hold after R3

Automated/code gates D3-G01, amended G02, G07, G09 and G10 are now satisfied. **P2D is not yet PASS** because frozen real-device/recovery gates **G03-G06 and G08** still require decisive environment evidence. The next step is the already-authorized final D-3 smoke/matrix on production PWA/Android/desktop, including the bounded real Sandro `send_message` path.

For the final smoke, preserve the accepted multi-origin baseline `{21,32,49,51,52}`: one canonical Message, one arrival, five per-origin delivery claims, at most one OS presentation per installation/origin, and one globally idempotent explicit-Ignore Register only if Alicia deliberately invokes Ignore. No code repair is requested by R3.

## R3 ledger row

| Cycle | Checkpoint | Verdict | Closed findings | Remaining gates | Consecutive FAIL |
|---|---|---|---|---|---:|
| R3 | P2D CP D-3 frontend amendment | CODE/AUTOMATED PASS / FINAL DEVICE HOLD | D3-R2-01, D3-R2-02 | D3-G03..G06, G08 | 0 |

---

## Delivery-count baseline amendment (Alicia-authorized; supersedes fixed subscription IDs)

This amendment changes only the expected **shape** of the final real-device evidence. It changes no code gate, closes no finding, and adds no verdict cycle; R3 remains `CODE/AUTOMATED PASS / FINAL DEVICE HOLD`.

**Superseded wording (no longer valid):** the frozen multi-origin set `{21, 32, 49, 51, 52}` in §12.1 and any per-ID expectation, including "five per-origin delivery claims" as a requirement.

**Authority for the change (Alicia):** subscription rows are not stable acceptance identities. V4 reinstall replaces the row of the same installation; V3 Android drops subscriptions on its own (deliberately unfixed while V4 is expected to be stable); Alicia may intentionally disconnect Tailscale when multi-device notifications are noisy. Fixed IDs therefore cannot serve as an acceptance criterion.

**Replacement rule (authoritative for the final smoke):**

1. **No fixed subscription IDs.** Evidence records claims by count and by role (PC / Mac / device-under-test / legacy-V3), never by frozen IDs.
2. **Upper bound:** one arrival produces **at most five (≤5)** delivery claims.
3. **Stable floor:** the PC origins (V3 + V4) and the Mac origin are the intentionally-untouched stable origins; the device under test (currently the Android Tailscale/100.x V4 install) contributes one more. A stable origin missing from the claim set is acceptable only when that browser/device/origin was legitimately offline, closed, or deliberately disconnected (record the environment reason). A stable origin unexpectedly missing while online and subscribed is a real finding.
4. **Legacy variance is not a defect.** V3/legacy origins may appear, disappear, or return `expired/http_410` for environment reasons. Record them as environment variance; do not require them as a matrix row and do not count their absence as failure.
5. **Unchanged product invariants (still blocking):** one claim per active subscription at send time; at most one OS presentation per installation/origin (duplicates for one installation remain a failure); explicit ignore stays globally idempotent per arrival across all devices/origins; ignore never navigates and never consumes installation-local unread; `ordinary_chat` arrivals carry `ignore.allowed=false` and must never expose the Ignore affordance (OS or shell).
6. **Matrix rows name origins by role, not by ID.** D3-G02's "one endpoint per intentionally retained browser origin" is satisfied by an explainable role-based claim set within the ≤5 cap.

**Replacement smoke statement:**

> one canonical Message, one arrival, ≤5 subscription delivery claims covering every online stable origin and the device under test, at most one OS presentation per installation/origin, and at most one idempotent explicit-ignore Register per arrival (only if Ignore was deliberately invoked).

---

## Final smoke — executed rows (running log)

Recorded by Acceptance from Alicia's device observations plus read-only DB correlation. Sanitized; roles only, no subscription IDs.

| # | Scenario (role) | Observation | DB correlation | Gate |
|---|---|---|---|---|
| S1 | PC focused on the exact conversation | no OS popup on PC | arrival claims `sent` to all online roles including PC | D3-G04 (focused suppression) |
| S2 | Phone not on the exact conversation | OS notification delivered on the phone | same arrival `sent` to phone | D3-G03 |
| S3 | Phone focused on the exact conversation | no OS banner; message and body appeared in place, no reload | `sent` to all three roles | D3-G03 |
| S4 | Explicit Ignore tapped on the phone OS notification | no navigation; app remained usable; the Ignore affordance was present only on the `send_message` arrival | arrival (07:58:58, `send_message`) linked to exactly **one** short Register `Alicia 已忽略你的消息`, 1 h TTL, created 14 s after arrival | D3-G07 (amended) |
| S5 | PC window visible but **not focused** at delivery time (WezTerm held OS focus; V4 was behind it, on a non-conversation page) | OS popup appeared, then one in-app shell indication after refocus for the same still-unconsumed arrival | claims `sent` to all online roles | D3-G04 — **correct**: nonfocused-only clients do not suppress. The popup + later in-app indication is an accepted minor redundancy (P2 limitation, Alicia-accepted) |
| S6 | Phone screen off (lock-screen / doze) | Web Push notification arrived and lit the screen; Ignore action available on the expanded notification | `sent` to the phone role | D3-G03 lock-screen presentation |
| S7 | Unfocused delivery of one `send_message` arrival to multiple roles | popups observed on the PC and on the phone | exactly 3 subscription claims, all `sent` (Mac / PC / Android install) — within the ≤5 rule | D3-G03 / D3-G04 fan-out |
| S8 | Cross-device explicit Ignore: three devices tapped Ignore for the same arrival | no navigation on any device; the production register log showed only one new entry | exactly **one** Register `Alicia 已忽略你的消息` for that arrival (the earlier arrival kept its own single Register from the single-device tap) | D3-G07 (amended) — cross-device idempotency closed |

**Not yet evidenced (remaining matrix):** background/closed, warm click, cold click, click-from-lock-screen unlock/navigation, denied permission, offline→online, renewal/repair, site-data clear / new installation, and desktop multi-window suppression.

**Accepted limitation recorded (S5):** an OS notification shown while no `/app/` client is focused can be followed by the bounded in-app indication once the user refocuses, for the same still-unconsumed arrival. This is not a duplicate-delivery defect (distinct from same-installation duplicate OS presentation, which remains blocking).
