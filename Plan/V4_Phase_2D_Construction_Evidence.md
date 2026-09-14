# Phase 2D Construction Evidence (Checkpoint D-2 R5 Delivery)

## Baseline & Authorization
- **HEAD:** `42cb0be2452e08397c847ede1caa55ca47ebf887` (P2D Checkpoint D-1 accepted at R3 PASS with 83 files / 992 tests green).
- **Authorization:** Alicia authorized controlled resumption under Option ① (`Plan/V4_Phase_2D_acceptance_escalation_cp-d2.md` §8; Plan D7/D9/§11). CP D-3 remains strictly deferred.
- **R5 Controlled Deliveries Addressed:**
  1. **D2-R4-01 (Clean Module Parser Import & Zero Global Publication):** Deleted `globalThis.parseArrivalEvent` assignment from `workerContract.ts` and deleted `resolveArrivalParser` global fallback from `public/sw.js`. Production modules and tests import and invoke `parseArrivalEvent` directly; no test-oriented global mutations exist.
  2. **D2-R4-02 (Required Nullable `register_ack` Contract):** `parseArrivalEvent` enforces that `register_ack` is a required property on the arrival event. Missing property or `undefined` returns `ok: false`; explicit `null` returns `ok: true` with `register_ack: null`; valid object with positive integers `register_id` and `preset_id` returns `ok: true`. Non-positive integers or malformed objects fail closed.
  3. **D2-R4-03 (Complete Runtime Typed ACK Envelope Validation):** Introduced `isValidRegisterAck` and `isValidAckOutcome` type guards. In `NotificationRuntime.tsx`, `NOTIFICATION_NAVIGATE` validates both `register_ack` and `ack_outcome` pairing, status, finite integer `statusCode`, and string `error` before recording. Malformed ACK metadata is dropped and does not persist, but does not block navigation when `target` is valid. `SW_ACK_RESULT` also enforces full envelope validation before recording. `recordAckOutcome` provides defense-in-depth type checks.
  4. **D2-R4-04 (Strict Hydration & Send Identity Validation):** `loadAckRegistry` requires positive integer IDs (`> 0`), strict equality with recomputed key (`${register_id}:${preset_id}:${action}`), finite timestamp (`Number.isFinite(lastAttemptAt)`), and valid optional types. Corrupted or mixed records set `currentAckStorageStatus = 'corrupted'` and clear the in-memory registry, preventing any network retries. `sendRegisterAck` independently rejects non-positive IDs (`<= 0`).
  5. **D2-R4-05 (Construction Evidence Accuracy):** Removed exaggerated claims; recorded literal code facts, boundaries, and raw test metrics.

---

## Architectural Invariants & Single Ownership Truths (Forbidden Bypasses)

1. **Single Event Validator Owner:**
   - Pure parser `parseArrivalEvent` in `workerContract.ts` validates: positive integers for `event_id`, `conversation_id`, `message_id`, and `agent.id`; exact `dedupe_key === 'assistant-message:' + message_id`; exact match between top-level IDs and `target` (`kind: 'conversation_message'`, `conversation_id`, `message_id`); bounded preview (`bounded_text`, text code points <= 160); agent name trimmed code points <= 100 (fallback "Agent"); title hint trimmed code points <= 200; ISO-8601 parsable `committed_at`; and required nullable `register_ack`.
   - `contract.ts` delegates to `parseArrivalEvent` and wraps parse failures into typed `contractError`.
   - `public/sw.js` imports `parseArrivalEvent` directly from `workerContract.ts` without local validator duplication.

2. **Single Scope Derivation Owner:**
   - Service Worker cold click route is strictly derived via `new URL('chat/' + id, self.registration.scope).href`. No hardcoded `/app/` origin-absolute strings are used, allowing arbitrary registration scopes (e.g. `/preview/app/`) to navigate correctly.

3. **Single Subscription Truth Owner:**
   - Strict 201 validation requires all ReactSheet §8.1 fields: positive integer `id`, matching `endpoint`, string `p256dh`, string `auth`, string `user_agent`, string `device_name`, matching `installation_id`, `is_active === true`, `persisted === true`, and valid `created_at` / `updated_at`.
   - Silent sync on mount/focus executes real backend verification: on success, sets `persisted` and clears `repairNeeded`; on failure, sets `failed` and preserves `repairNeeded`.
   - Unsubscribe inspection error fails closed as `browser_cleanup_failed` without clearing local or backend truth.

4. **Bifurcated Register ACK Ownership (Warm vs Cold):**
   - In-flight ACK requests for `${register_id}:${preset_id}:${action}` are joined into a single Promise, preventing duplicate concurrent network requests.
   - The ACK state machine is persisted in `localStorage` under `exo:v4:ack_registry`.
   - On warm click: SW sends navigate ACK in `event.waitUntil` (SW fetch = 1) and transmits `ack_outcome` to window client via `NOTIFICATION_NAVIGATE`. Main records it as sent; canonical consume recognizes already sent and does not re-send (Main fetch = 0).
   - On cold click: SW sends zero ACK requests (`SW fetch = 0`), only calls `openWindow`. Main canonical consumption upon window load sends the navigate ACK (`Main fetch = 1`). Exactly one network request is issued across the lifecycle.
   - On notification close: SW sends dismiss ACK in `event.waitUntil` (best effort). If window clients exist, broadcasts `SW_ACK_RESULT` to record the outcome in Main registry.

---

## Architectural Matrix A: Ingress × Validator × Scope × Valid/Malformed Side Effects

| Ingress Channel | Ingress Payload / Event | Validator Owner | Scope Guard | Valid Side Effect | Malformed / Mismatch Side Effect |
|---|---|---|---|---|---|
| **SW Push** (`self.onpush`) | Raw Web Push JSON payload | `workerContract.ts::parseArrivalEvent` | Candidate window filtering: `client.url.startsWith(self.registration.scope)`. | If focused `/app/` client exists: `postMessage(ASSISTANT_ARRIVAL_HANDOFF)`, `showNotification = 0`. Else: `showNotification(title, { tag: ev.dedupe_key, data: { event: ev } })`. Tag override forbidden. | Never posts handoff. Shows generic notification: title `'ExoCore'`, body `'ExoCore有新消息'`, tag `'exocore-generic-arrival'`, `data: {}`. If payload empty: suppressed cleanly without notification. |
| **SW Notification Warm Click** (`self.onnotificationclick` with existing client) | `notification.data.event` | `workerContract.ts::parseArrivalEvent` | Candidate client filtering: `c.url.startsWith(self.registration.scope)`. Target URL: `new URL('chat/' + id, self.registration.scope).href`. | 1. SW sends `navigate` Register ACK within `event.waitUntil` (SW fetch = 1).<br>2. Focuses existing client.<br>3. Posts `NOTIFICATION_NAVIGATE(version: 1, target, register_ack, ack_outcome)`. Main records ACK as sent; canonical consume does NOT re-send. | Closes notification. Focuses root scope without sending ACK. |
| **SW Notification Cold Click** (`self.onnotificationclick` with NO existing client) | `notification.data.event` | `workerContract.ts::parseArrivalEvent` | Target URL: `new URL('chat/' + id, self.registration.scope).href` (scope-derived, clean URL without ACK params). | 1. SW sends ZERO ACK requests (`SW fetch = 0`).<br>2. Calls `openWindow(targetUrl)`.<br>3. New window loads and Main canonical `consumeExactArrivals` sends navigate Register ACK (`Main fetch = 1`). | Closes notification. Opens root scope without sending ACK. |
| **SW Notification Close** (`self.onnotificationclose`) | `notification.data.event` | `workerContract.ts::parseArrivalEvent` | N/A (stateless background) | If `register_ack` valid: sends `dismiss` Register ACK within `event.waitUntil` (best-effort). If window client exists: broadcasts `SW_ACK_RESULT`. If network fails and no client: terminates gracefully without worker persistence. | Closes silently without sending ACK. |
| **SW Sub Change** (`self.onpushsubscriptionchange`) | Browser push renewal event | N/A | Broadcasts to all window clients | Resubscribes browser via `registration.pushManager.subscribe(VAPID)`. Broadcasts `SUBSCRIPTION_REPAIR_NEEDED(version: 1)` to window clients. | N/A |
| **Main Polling** (`GET /api/push/assistant-arrivals/`) | Paginated arrival JSON | `contract.ts::validateArrivalPage` (delegates item parsing to `parseArrivalEvent`) | Same-origin API `/api/push/assistant-arrivals/` | Ingests into `localStorage`, advances contiguous cursor, invalidates query cache, displays single shell indication if non-current route. | Throws `contractError`, aborts page drain, preserves prior cursor, displays retryable sync error banner. |
| **Main SW Message Handoff** (`ASSISTANT_ARRIVAL_HANDOFF`) | `event.data` | Validates `data.version === 1` + `contract.ts::validateArrivalEvent` | In-app window context | Ingests arrival via `ingestArrivals([ev], 'push')`, invalidates query cache. If non-current conversation: displays single shell indication. | Rejects message fail-closed. No unread update, no storage write, no navigation. |
| **Main SW Message Navigate** (`NOTIFICATION_NAVIGATE`) | `event.data` | Validates `data.version === 1` + `target.kind === 'conversation_message'` + positive int `conversation_id` & `message_id` + typed `register_ack` & `ack_outcome` | In-app window context | Closes active indication, navigates via React Router to `/chat/:conversation_id`. If `register_ack` and `ack_outcome` are valid: records in ACK registry. Malformed ACK fields do not block navigation. | Rejects navigation fail-closed if target is invalid. |
| **Main SW Repair Needed** (`SUBSCRIPTION_REPAIR_NEEDED`) | `event.data` | Validates `data.version === 1` | In-app window context | Sets `repairNeeded = true` in `NotificationRuntime` context. | Ignored if `version !== 1`. |

---

## Architectural Matrix B: Capability × Permission × Browser Outcome × Backend Result × Repair × Action

| Capability (`isPushSupported`) | Permission (`Notification.permission`) | Browser Outcome (`getBrowserSubscriptionOutcome`) | Backend Result | Repair Flag (`repairNeeded`) | Action / Transition | Retained Facts & State Transition | Displayed UI Copy |
|---|---|---|---|---|---|---|---|
| False | Unsupported | `{ status: 'unsupported' }` | `none` | False | Mount / any | All actions disabled. | 浏览器不支持 Web Push，通知未启用 |
| True | `default` | `{ status: 'ok', subscription: null }` | `none` | False | Mount / Focus | No prompt on mount. Backend state remains `none`. | 权限：默认 (未询问)；凭据：未创建；后端：未登记；主按钮：启用推送通知 |
| True | `denied` | `{ status: 'ok', subscription: null }` | `none` | False | Mount / User click enable | No prompt shown. PushManager not called. | 权限：已拒绝 (denied)；状态：已拒绝；主按钮禁用 |
| True | `granted` | `{ status: 'ok', subscription: PushSubscription }` | `none` -> `checking` | False | Mount / Focus (Silent Sync) | Starts real work: POST to `/api/push/subscribe/`. If 201 valid: backend -> `persisted`, `repairNeeded = false`. If 201 invalid/network fail: backend -> `failed`. | 正在核验... -> 已持久化 (persisted: true) / 登记失败 |
| True | `granted` | `{ status: 'ok', subscription: PushSubscription }` | `persisted` | True | Mount / Focus / Retry | Silent sync runs. If successful 201: backend -> `persisted`, `repairNeeded` cleared to `false`! If fails: `repairNeeded` remains `true`. | 订阅修复状态：凭证轮换需要重新同步至后端；显示“重新同步到后端”按钮 |
| True | `granted` | `{ status: 'error', error: '...' }` | `failed` | Any | Mount / Focus / Unsubscribe | Browser subscription remains `null`, error recorded. NEVER returns success on unsubscribe! | 浏览器订阅凭证：无法读取凭据 (错误详情)；后端持久化确认：登记失败 / 未确认 |
| True | `default` / `granted` | Any | Any | Any | User click "启用推送通知" | 1. Request permission.<br>2. `pushManager.subscribe(VAPID)`.<br>3. `installation_id = getInstallationId()`.<br>4. POST `/api/push/subscribe/`.<br>5. Validate full 201 response. If valid: `persisted`, `repairNeeded = false`. | 成功：“推送通知已成功启用并已在后端持久化。” 失败：显示具体阶段错误。 |
| True | `granted` | `{ status: 'ok', subscription: PushSubscription }` | Any | Any | User click "保存设备名" | Validates Unicode code point length `<= 200`. Reuses existing subscription endpoint. POST `/api/push/subscribe/`. If valid: `persisted`. | 成功：“设备名称已保存并更新至后端。” |
| True | Any | `{ status: 'error' }` | Any | Any | User click "关闭推送通知" | Fails closed: returns `{ ok: false, error: '无法检查浏览器推送凭据状态...', phase: 'browser_cleanup_failed' }`. Does NOT clear state! | 错误：“后端退订或凭据清理失败”；不显示虚假成功。 |
| True | `granted` | `{ status: 'ok', subscription: PushSubscription }` | Any | Any | User click "关闭推送通知" | 1. Backend first: POST `/api/push/unsubscribe/`. If fails: abort, keep browser subscription, state -> `failed`.<br>2. Browser second: `subscription.unsubscribe()`. If returns `false` or throws: state -> `browser_cleanup_failed`.<br>3. If both succeed: `browserSub = null`, backend -> `none`, `repairNeeded = false`. | 成功：“已成功停用推送通知。” 失败：“后端退订失败，浏览器订阅已保留” / “后端已关闭，但浏览器本地订阅清理失败”。 |

---

## Architectural Matrix C: ACK Entry/Action × Network Owner × In-Flight × WaitUntil × Retry/Terminal × Main Handoff × Reload/Cold-Start

| Entry Point | Action | Network Owner | At-Most-Once Dedupe Key | In-Flight Concurrency Behavior | WaitUntil Lifetime Guard | Retryable vs Terminal Outcome | Main Diagnostic Handoff | Reload / Cold-Start Behavior |
|---|---|---|---|---|---|---|---|---|
| **SW Warm Click** (window client exists) | `navigate` | Service Worker | `${register_id}:${preset_id}:navigate` | Single execution per click event | Enclosed in `event.waitUntil(async () => { ... })` | 200 -> sent.<br>400/404 -> failed_terminal.<br>5xx/net -> failed_retryable. (Non-blocking). | Transmitted to window client via `NOTIFICATION_NAVIGATE(ack_outcome)`. Main records in ACK registry (`isAckSent = true`). | Recorded in `localStorage`. Canonical consume recognizes already sent and does not re-send (Main fetch = 0). |
| **SW Cold Click** (no window client exists) | `navigate` | Main Window (`NotificationRuntime`) | `${register_id}:${preset_id}:navigate` | SW issues ZERO fetch requests (`SW fetch = 0`). Only opens window. | N/A (openWindow completes SW turn) | Main canonical consume sends ACK: 200 -> sent, 400/404 -> failed_terminal, 5xx/net -> failed_retryable. | Main window naturally owns the ACK (`Main fetch = 1`). Clean URL without param pollution. | Persisted in `localStorage` under `exo:v4:ack_registry`. Exactly one network request. |
| **SW Notification Close** | `dismiss` | Service Worker | `${register_id}:${preset_id}:dismiss` | Single execution per close event | Enclosed in `event.waitUntil(async () => { ... })` | Best-effort: 200 -> sent.<br>400/404 -> failed_terminal.<br>5xx/net -> failed_retryable. Failure without client terminates cleanly without crash. | If active clients exist, broadcasts `SW_ACK_RESULT` to persist in ACK registry. | If clients open, recorded in `localStorage`. If no client, best-effort closes gracefully. |
| **Main Canonical Exact Consume** | `navigate` | Main Window (`NotificationRuntime`) | `${register_id}:${preset_id}:navigate` | Checked against persistent ACK registry. If `sent` or `in_flight`: SUPPRESSED (no-op). | Window async dispatch | If network/5xx: marks `failed_retryable` in persistent ACK registry.<br>If 400/404: marks `failed_terminal` in persistent ACK registry. | Main registry is the diagnostic owner. Exposed via `getAckDiagnostics()`. | Persisted in `localStorage` under `exo:v4:ack_registry`. Survives reloads! |
| **Main Indication Dismiss** | `dismiss` | Main Window (`NotificationRuntime`) | `${register_id}:${preset_id}:dismiss` | Checked against persistent ACK registry. If `sent` or `in_flight`: SUPPRESSED. | Window async dispatch | 200 -> `sent`.<br>400/404 -> `failed_terminal`.<br>5xx/net -> `failed_retryable`. | Main registry owns diagnostic and retry state. | Persisted in `localStorage`. |
| **Main Indication View** | `navigate` | Main Window (`NotificationRuntime`) | `${register_id}:${preset_id}:navigate` | Checked against persistent ACK registry. If `sent` or `in_flight`: SUPPRESSED. | Window async dispatch | 200 -> `sent`.<br>400/404 -> `failed_terminal`.<br>5xx/net -> `failed_retryable`. | Main registry owns diagnostic and retry state. | Persisted in `localStorage`. |
| **Window Online / Manual Retry** | `navigate` / `dismiss` | Main Window (`subscription.ts`) | Specific key in registry | Loops over entries with `status === 'failed_retryable'`. In-flight map joins any concurrent caller. | Window async dispatch | If 200: updates status to `sent`.<br>If 400/404: updates status to `failed_terminal`.<br>If error: remains `failed_retryable`. | Immediately reflected in `getAckDiagnostics()` and Settings panel. | Safe idempotency across reloads. |

---

## CP D-2 Owned File Manifest

### Created & Updated (CP D-2 R5 delivery):

1. **Worker Contract (`packages/app/src/features/notifications/workerContract.ts`):**
   - Pure parser `parseArrivalEvent` shared between worker and window contexts without global mutations.
   - Enforces required nullable `register_ack`: missing/undefined returns error; explicit null returns null; valid positive IDs returns object; invalid fails closed.
   - Exports type guards `isRecord`, `isPositiveInteger`, `isValidRegisterAck`, `isValidAckOutcome`.
   - Defines closed versioned union `SwToClientMessage`.
   - Exports `VAPID_PUBLIC_KEY` and `urlBase64ToUint8Array`.

2. **Window Contract Wrapper (`packages/app/src/features/notifications/contract.ts`):**
   - Delegates arrival validation directly to `parseArrivalEvent` and converts failures to `contractError`.
   - Zero duplicate validation rules or field checks.

3. **Production Service Worker (`packages/app/public/sw.js`):**
   - Imports `parseArrivalEvent`, `VAPID_PUBLIC_KEY`, and `urlBase64ToUint8Array` directly from `workerContract.ts`.
   - Zero duplicate validator functions and zero global fallback resolvers (`resolveArrivalParser` removed).
   - Candidate client filtering: `c.url.startsWith(self.registration.scope)`.
   - Cold click route: derived strictly from registration scope: `new URL('chat/' + arrivalEvent.target.conversation_id, self.registration.scope).href`.
   - Warm click: SW executes navigate ACK in `event.waitUntil` and passes `ack_outcome` to client via `NOTIFICATION_NAVIGATE`.
   - Cold click: SW issues zero fetch requests (`SW fetch = 0`) and opens window. Main canonical consumption owns ACK.
   - Notification close: best-effort dismiss ACK inside `event.waitUntil`. Broadcasts `SW_ACK_RESULT` if clients exist; handles network failures gracefully without worker persistence.

4. **Web Push Subscription & ACK Service (`packages/app/src/features/notifications/subscription.ts`):**
   - Complete ReactSheet §8.1 201 validation.
   - In-flight concurrency joining.
   - Persistent ACK registry backed by `localStorage` under `exo:v4:ack_registry`.
   - Strict `loadAckRegistry`: validates positive integer IDs, exact recomputed key equality, finite timestamp, and valid optional field types. Corrupted or mixed storage triggers quarantine and clears in-memory registry.
   - `persistAckRegistry`: preserves quarantined corrupt state without overwriting.
   - `recordAckOutcome`: runtime typed validation of register_ack and outcome envelopes before recording.
   - `sendRegisterAck`: independently rejects non-positive IDs (`<= 0`) without network calls.

5. **5-Layer Subscription Truth Panel (`packages/app/src/features/notifications/NotificationsPanel.tsx`):**
   - Mount and window `focus` listeners execute `syncExistingSubscription()`, clearing `repairNeeded` on success, and preserving it on failure.
   - Device name validated by Unicode code points (<= 200).
   - ACK diagnostics section displays failed attempts and storage anomalies, providing retry trigger for retryable ACKs.
   - Error messages sanitized against sensitive endpoint URLs and keys.

6. **Notification Runtime Extension (`packages/app/src/features/notifications/NotificationRuntime.tsx`):**
   - SW message listener validates:
     - `ASSISTANT_ARRIVAL_HANDOFF`: `version === 1` and `validateArrivalEvent(event)`.
     - `NOTIFICATION_NAVIGATE`: `version === 1`, valid conversation target. Only records in ACK registry if `register_ack` and `ack_outcome` pass runtime validation; malformed ACK metadata does not break navigation.
     - `SW_ACK_RESULT`: validates `version === 1`, action, `isValidRegisterAck(register_ack)`, and `isValidAckOutcome(outcome)`.
     - `SUBSCRIPTION_REPAIR_NEEDED`: `version === 1`.
   - Canonical exact consume: sends `navigate` ACK only if not already sent or pending in ACK registry.

7. **Focused Test Suites (`packages/app/src/test/`):**
   - `p2d_d2_sw_routing.test.tsx` (21 tests): Drives production `public/sw.js` directly through explicit parser injection in `loadProductionWorker`. Tests static single-validator constraint, global purity, arrival contract with missing/undefined/null/object `register_ack`, focus matrix, scope filtering, custom scope derivation, generic fallbacks, tag security, warm/cold routing bifurcation, and best-effort close.
   - `p2d_d2_settings_subscription.test.tsx` (18 tests): Tests 5-layer settings truth, negative security invariants, malformed 201 rejection, ACK deduplication and in-flight joining, non-positive `sendRegisterAck` rejection, mixed corrupted hydration retry prevention, and valid reload retry.
   - `p2d_d2_integration.test.tsx` (12 tests): Tests SW message handoff, query invalidation, single shell indication banner, banner actions, storage failure non-blocking resilience, NOTIFICATION_NAVIGATE malformed ACK envelope tolerance, and SW_ACK_RESULT runtime validation.

---

## Verifiable Test Suites & Literal Citations

### 1. Independent Acceptance Probes (`src/acceptance/p2d_d2_acceptance.test.ts` — 12/12 PASS)
- `real worker rejects malformed identity and does not let an out-of-scope focused window suppress the generic OS notice` (PASS)
- `malformed subscribe 201 cannot establish backend-persisted healthy truth` (PASS)
- `cold notification click derives its chat route from the actual registration scope` (PASS)
- `an ACK already in flight cannot start a second network request for the same event and action` (PASS)
- `failure to inspect the browser subscription cannot be reported as successful unsubscribe` (PASS)
- All 12 Acceptance-owned independent probes pass cleanly without harness defect or test failure.

### 2. D-1 Preservation Suites (34/34 PASS)
- `src/acceptance/p2d_d1_arrival_acceptance.test.tsx` (9 tests PASS)
- `src/test/p2d_d1_arrival_reconciliation.test.tsx` (25 tests PASS)

### 3. D-2 Construction Focused Suites (51/51 PASS)
- `src/test/p2d_d2_sw_routing.test.tsx` (21 tests PASS)
- `src/test/p2d_d2_settings_subscription.test.tsx` (18 tests PASS)
- `src/test/p2d_d2_integration.test.tsx` (12 tests PASS)

### 4. Focused Suite Summary
- Total focused test files: 6 passed (6)
- Total focused tests: 97 passed (97), 0 failed

### 5. Full App Regression Suite
- Total test files: 87 passed (87)
- Total tests: 1055 passed (1055), 0 failed
- Command: `$env:NODE_OPTIONS="--no-experimental-webstorage"; pnpm --filter exo-app test:run`
- Duration: 32.47s

### 6. Production Quality Gates
- **Typecheck:** `pnpm --filter exo-app typecheck` -> exit code 0 (0 errors).
- **Lint:** `pnpm --filter exo-app lint` -> exit code 0 (0 errors).
- **Build & Artifact:** `pnpm --filter exo-app build` -> exit code 0 (dist/sw.js generated with injectManifest, 91 precache entries).
- **Whitespace Check:** `git diff --check` -> exit code 0 (clean).

---

## Checkpoint D-3 Real-Device Closure & Verification Evidence (R1 factual correction + R2 explicit-ignore amendment)

### 0. Entry ownership & environment amendment

- **D-3 entry baseline:** `e96e4ca37c09f06fe75f8614a429ab0ca03d383c` → production fixes `0ca8985` → closure commit `0bed2fc` (per D-3 Acceptance report R1 ledger).
- **Subscription precondition (D3-R1-01 closed by product decision, not by data mutation):** Alicia positively identified all five active subscriptions as intended current/test origins — 21 (Mac / Tailscale), 32 (Android / Tailscale), 49 (Android / Home LAN), 51 (Windows V4 test installation), 52 (Android V4 test installation). All five retained; no maintenance write authorized. Android Home+Tailscale duplicate Push presentation is accepted multi-origin behavior. D3-G02 re-baselined to **one endpoint per intentionally retained browser origin**, expected active set `{21,32,49,51,52}`.
- **Delivery ID correction (D3-R1-02):** arrival 19 (msg 19066, conv 95, src `send_message`) created exactly five `sent` deliveries: **69→21, 70→32, 71→49, 72→51, 73→52**. Arrival 20 (msg 19067, `ordinary_chat`) owns deliveries 74–78; arrival 21 (msg 19069) owns 79–83. The prior paragraph attributing deliveries 77/78 to arrival 19 was wrong and is superseded by this correction — no "two deliveries" claim remains.
- **Redaction:** full installation UUIDs are not reproduced in evidence. Stable redacted prefixes only: sub 51 → `03835bcb…`, sub 52 → `a1ab4030…`.

### 1. D-3 Scope & Ingress Pre-flight (Gate D3-G01, D3-G02)

- D-3 production delta confined to `packages/app`; zero backend/V3/shared/nginx/dependency/real-DB edits. D3-G01 held.
- The pre-flight subscription audit was strictly read-only; real-DB AgentPreset baseline stayed 8 rows before and after.

### 2. D-3 In-flight Fixes & Quality Enforcements (D3-R1-04 / D3-R1-05 corrections)

1. **HTTP 415 repair (accurate description):** the four notification POST call sites pass native object bodies to the existing `exo-shared/apiFetch`, which serializes JSON and sets `Content-Type: application/json`. The call sites were changed; `apiFetch` itself was not modified. Redundant explicit caller headers are harmless.
2. **Mobile settings layout repair:** `.settings-layout` is column on mobile (<768px) and row on desktop (>=768px); `.settings-rail` hidden on mobile. Bounded to `settings.css`; no second consumer.
3. **Regressions added in R2 (D3-R1-04 closed):** `src/test/p2d_d2_r1_repair_regressions.test.ts` — (a) effective JSON media type and object serialization through the real `apiFetch` for subscribe / sync (updateDeviceName path) / unsubscribe / explicit-ignore call sites, failing on pre-stringified bodies; (b) mobile column vs desktop row breakpoint at 768px via brace-matched CSS source assertions, failing on a reverted layout repair.

### 3. Real-device matrix — executed rows vs deferred rows (D3-R1-03 factual status)

**Executed and observed (sanitized):**

| Row | Observation |
|---|---|
| Foreground exact (Conversation #95 focused) | zero OS notification, zero shell banner, silent in-place reconciliation |
| Foreground other (settings / other routes) | bounded shell indication + unread badge increments |
| Background & closed (Windows desktop & Android PWA) | Web Push OS notification; warm/cold clicks navigate to `/app/chat/95` |

**Provider-truth boundary:** FCM/provider reported `sent` per delivery claim. "Provider accepted/sent" is reported separately from OS-level presentation; the executed rows above are backed by Alicia's device observations, the claims themselves are provider truth only.

**Not executed at R1 — deferred to the final post-code-acceptance smoke (not claimed as done):**

- Android visible-but-unfocused exact (itemized row); lock-screen presentation (observed by Alicia but no itemized evidence row was recorded at R1); desktop multi-window focus selection; denied permission; offline→online; renewal/repair; backend persistence failure; stale/deleted target; site-data-clear / new-installation UUID; OEM battery/DND state.

The R2 construction package forbids real-device/provider smoke before code acceptance, so these rows run in the final Sandro smoke after the R2 code checkpoint.

### 4. R2 frontend amendment (explicit-ignore contract) — implemented, READY FOR RECHECK

**Authority:** `Plan/spec/2026-09-14-assistant-arrival-explicit-ignore-handoff.md` (frontend AUTHORIZED); backend accepted at `74802208`; backend docs closed at `f7bef663`. Desktop ReactSheet 第八篇 re-synced **byte-identical** to backend §8 (section diff: 0 lines).

**Production changes (packages/app only):**

- `workerContract.ts`: required typed `ignore: {allowed: boolean}`; required nullable legacy `register_ack` retained (never used to infer Ignore); `AckOutcome` / `SW_ACK_RESULT` / ACK helpers deleted.
- `public/sw.js`: adds `{action:'ignore',title:'忽略'}` only when `ignore.allowed===true`; `notificationclick` `action==='ignore'` → close + exactly one `POST /api/push/assistant-arrivals/<event_id>/ignore/` + zero navigation (missing/malformed event data → zero network, zero navigation); body/default click → typed warm/cold navigation with zero Register ACK; `notificationclose` → neutral (zero network / zero navigation / zero Register).
- `NotificationRuntime.tsx` / `NotificationsPanel.tsx`: shell 忽略 calls the same ignore endpoint — success hides the indication, leaves unread intact, never navigates; failure stays visible and explicitly retryable (bounded single request per click). 查看 navigates with zero ACK. ACK retry/registry/diagnostic UI and all SW ACK message handling removed.
- `subscription.ts`: legacy ACK state machine (sendRegisterAck, retryPendingAcks, ACK registry/storage/diagnostics) deleted; `ignoreAssistantArrival` added with bounded error mapping (invalid id / 404 / 409 / network).
- `NotificationDemoPage.tsx`: fixtures now carry `ignore` + `register_ack: null`; ACK diagnostic panel removed; demo copy documents the new semantics.

**Construction tests (migrated, 81/81):** `p2d_d1_arrival_reconciliation` (required ignore field), `p2d_d2_integration` (shell ignore/view/failure-retry semantics), `p2d_d2_settings_subscription` (ignore endpoint unit truth), `p2d_d2_sw_routing` (real `public/sw.js` harness: exactly-one ignore POST, zero navigation, actions only when allowed, body click zero ACK, close neutral, malformed fail-closed), `p2d_d2_r1_repair_regressions` (D3-R1-04).

**Frozen acceptance probes — temporary exclusion (Acceptance-owned, not edited by Construction):**

- `p2d_d2_acceptance.test.ts` encodes the superseded Register-ACK contract → excluded from tsconfig / eslint / vitest scope until Acceptance amends it (construction package item 7: "superseded and temporarily excluded").
- `p2d_d1_arrival_acceptance.test.tsx` fixtures predate the frozen required `ignore` field; measured 3 runtime failures caused solely by the missing field (reconciliation semantics unchanged) → excluded from the default vitest scope until Acceptance updates fixtures.
- All three exclusions carry cross-referencing comments in `tsconfig.json`, `eslint.config.js`, `vite.config.ts`.

### 5. R2 construction gates (scoped, all green)

- **P2D construction scope:** 5 files / 81 tests — 81/81 passed.
- **tsc** (app + node configs): 0 errors. **ESLint:** 0 errors. **Production build:** PASS (`dist/sw.js` generated, 91 precache entries).
- **Production bundle inspection:** `dist/sw.js` contains the ignore branch and the ignore endpoint; **zero** references to `/api/agents/registers/` (legacy ACK endpoint); neutral `notificationclose` handler present; the only remaining `register_ack` occurrences are the required-nullable wire validation.
- **`git diff --check`:** clean.
- **Environment note (out of R2 scope, reported for visibility):** parts of the broader `src/test` suite carry a pre-existing environment breakage unrelated to this amendment — e.g. `runtime_storage.test.ts` fails 13/13 at baseline `0bed2fc` with `window.localStorage.getItem is not a function`, verified in a detached worktree at the D-3 c

## R3 repair (D3-R2-01 / D3-R2-02 closed, mechanical exclusion removal)

**D3-R2-01 — closed at the response boundary (`subscription.ts`):**

- New pure guard `isValidIgnoreResponse(res, requestedEventId)`: success accepted ONLY when `action === 'ignore'`, `event_id` equals the requested positive ID, `message_id`/`conversation_id` are positive integers and `created` is boolean (the frozen ReactSheet §8.5 five-field truth).
- Any malformed/mismatched 2xx now returns `{ ok: false, status: 200, error: '忽略失败：服务端响应异常' }` — visible retryable failure; indication and unread remain; zero automatic retry/navigation/Register ACK. The unconditional 2xx success fallback is gone.
- Construction matrix added in `p2d_d2_settings_subscription.test.tsx`: complete valid (created true/false), mismatched identity, missing fields, wrong types, wrong action, non-object bodies — all fail closed; 404/409 mappings preserved.

**D3-R2-02 — closed with event-targeted async state (`NotificationRuntime.tsx`):**

- Global `ignoreBusy`/`ignoreError` replaced by `IgnoreUiState` tagged with the target `event_id` (`busy`/`error` phases). Busy/error render ONLY when the bound event is still the active indication.
- Completion updates are identity-guarded functional updates: success closes only the targeted event; failure annotates only the targeted event; an older completion never closes, annotates or disables a newer indication; a newer request's state is preserved while an older one settles.
- Same-event failure remains visible and explicitly retryable; View/dismiss clear bound state; late completions after View are no-ops.
- Timing regressions added in `p2d_d2_integration.test.tsx`: late success → newer indication untouched; late failure → no error/busy leak; View during pending ignore → navigation unaffected by late success.

**Mechanical closeout:** the three temporary exclusions were removed from `tsconfig.json`, `eslint.config.js` and `vite.config.ts`; default typecheck/lint/test discovery includes the amended frozen D-1/D-2 probes and the new D-3 timing probe again.

**R3 gate evidence (focused):**

- Acceptance probes: `p2d_d1_arrival_acceptance` + `p2d_d2_acceptance` (amended) + `p2d_d3_acceptance` — 19/19 passed.
- Builder focused: 5 files — 87/87 passed (81 preserved + 6 new regressions).
- tsc (app + node) 0 errors; ESLint 0 errors; production build PASS (`dist/sw.js`, 91 precache entries); built-SW inspection unchanged from R2 (zero `/api/agents/registers/` references, ignore branch present, neutral notificationclose); `git diff --check` clean.
- Full app regression and real-device smoke remain deferred per the R3 recheck order.

## Checkpoint Status

- **Current Checkpoint:** P2D CP D-3 — R3 repair of D3-R2-01 (response boundary) and D3-R2-02 (event-targeted ignore state).
- **Verdict:** **READY FOR RECHECK** — Construction does not self-award PASS. Final D-3/P2D verdict and Core C2 release status remain Acceptance-owned.
- **Post-acceptance smoke (Acceptance-owned):** one Message, one arrival, five per-origin delivery claims (expected `{21,32,49,51,52}`), at most one OS notification per installation/origin, and one idempotent explicit-ignore Register globally per arrival.
