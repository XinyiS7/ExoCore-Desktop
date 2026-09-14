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

## Checkpoint D-3 Real-Device Closure & Verification Evidence

### 1. D-3 Scope & Ingress Pre-flight (Gate D3-G01, D3-G02)
- **Authority & Release:** Alicia released CP D-3 for real-device closure, real Sandro `send_message` path, and recovery matrices.
- **Scope Integrity:** All changes strictly confined to `packages/app`. No changes to `../ExoCore/`, `../nginx/`, `../ExocoreExtension/`, or V3 packages.
- **Pre-flight Active Subscriptions Audit (Sanitized):**
  - Legacy records preserved without unauthorized modification:
    - ID 49: `Android-Home`, `install_id = None`, `domain = fcm.googleapis.com`
    - ID 32: `Tailscale-Android`, `install_id = None`, `domain = fcm.googleapis.com`
    - ID 21: `Tailscale-Mac`, `install_id = None`, `domain = fcm.googleapis.com`
  - New V4 PWA installations registered and bound to unique UUIDs:
    - ID 51: Desktop installation `install_id = 03835bcb-b4e5-476a-acc5-60b027217438`, `domain = fcm.googleapis.com`
    - ID 52: Mobile (Android) installation `install_id = a1ab4030-0e0f-4a62-8c49-6cfef298277c`, `domain = fcm.googleapis.com`
  - Total active subscriptions in backend: 5 (2 clean V4 UUIDs + 3 legacy preserved).

### 2. D-3 In-flight Fixes & Quality Enforcements
1. **API Content-Type Enforcement in `subscription.ts`:**
   - Explicitly injected `headers: { 'Content-Type': 'application/json' }` and passed native Object bodies across `subscribeToPush`, `unsubscribeFromPush`, `syncExistingSubscription`, and `sendRegisterAck`.
   - Resolved HTTP 415 `Unsupported Media Type` reported on Chrome during Web Push subscription registration.
2. **Mobile Settings Column Layout Fix in `settings.css`:**
   - Configured `.settings-layout` with `flex-direction: column` on mobile viewports (< 768px) and `flex-direction: row` on desktop viewports (>= 768px).
   - Resolved horizontal overflow where `.settings-mobile-tabs` and `.settings-content` collided side-by-side on mobile, restoring full vertical scrolling for settings panels.

### 3. Real Sandro `send_message` & End-to-End Verification (Gate D3-G03, D3-G04, D3-G05)
- **Test Target:** Conversation #95 (`暴雨`, Alessandro's Prime Conversation, `is_prime = True`).
- **Real Execution:**
  - Sandro executed `send_message` upon real user instruction.
  - Backend created canonical assistant Message `19066` and Register `2262`.
  - Recorded arrival event: `Arrival ID = 19, msg = 19066, conv = 95, src = 'send_message', reg = 2262`.
  - Push delivery engine dispatched Web Push to active subscriptions:
    - Delivery 77: Sub 51 (Desktop) -> status `sent`.
    - Delivery 78: Sub 52 (Mobile) -> status `sent`.
  - Subsequent ordinary chat interactions:
    - `Arrival ID = 20, msg = 19067, conv = 95, src = 'ordinary_chat'` (Deliveries 74..78 `sent`).
    - `Arrival ID = 21, msg = 19069, conv = 95, src = 'ordinary_chat'` (Deliveries 79..83 `sent`).
- **Real Matrix Verification by User (Alicia):**
  - **Foreground Exact (Conversation #95 focused):** Zero OS notifications, zero shell banners, silent in-place reconciliation and instant message display.
  - **Foreground Other (Other routes / Settings):** Non-blocking shell indication (`From: Alessandro`) displayed, unread badges incremented accurately.
  - **Background & Closed (Desktop Windows & Android PWA):** System Web Push notification delivered cleanly, warm/cold clicks successfully navigate to `/app/chat/95`.
  - **User Acceptance Result:** Explicit user sign-off: *"好嘞！多个场景我都测过了！非常好，用户验收pass🎉🎉"*.

### 4. Quality Pipeline & Regression Totals (Gate D3-G09)
- **Full App Regression:**
  - Total test files: 87 passed (87)
  - Total tests: 1055 passed (1055), 0 failed
- **TypeScript Typecheck:** `pnpm --filter exo-app typecheck` -> 0 errors.
- **ESLint:** `pnpm --filter exo-app lint` -> 0 errors.
- **Production Build:** `pnpm --filter exo-app build` -> 0 errors (dist/sw.js generated with injectManifest, 91 precache entries).
- **Whitespace / Git Diff Check:** `git diff --check` -> clean.

---

## Checkpoint Status
- **Current Checkpoint:** P2D CP D-3 (Final Real-Device Delivery)
- **Verdict:** READY FOR INDEPENDENT D-3 ACCEPTANCE (Candidate Final PASS). All real-device, subscription, delivery, layout, and regression invariants closed.
