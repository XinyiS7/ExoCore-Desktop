# Assistant Arrival Explicit Ignore — B6/P2D Contract Amendment

> **Status:** BACKEND ACCEPTED at `74802208`; backend docs closed at `f7bef663`; frontend construction AUTHORIZED by Alicia under this amendment.
> **Product decision:** Alicia
> **Architecture / independent acceptance:** Solaire
> **Repositories:** backend authority in `../ExoCore`; V4 consumer in `packages/app`; no V3 expansion.
> **Reason:** canonical Prime Conversation + arrival now preserve message truth. A default short Register for every `send_message` is redundant and noisy. Register creation becomes an explicit social response only when Alicia chooses **忽略**.

## 1. Frozen observable semantics

| User event | Navigation | Local unread | New short Register |
|---|---|---|---|
| `send_message` commits and arrives, with no interaction | normal arrival behavior | normal installation-local unread rules | **none** |
| Notification body / “查看” clicked | canonical Conversation opens; seen only after canonical confirmation | consumed only by existing exact-conversation rule | **none** |
| OS notification closed with system X / swipe (`notificationclose`) | none | unchanged | **none** |
| Explicit “忽略” action clicked in OS notification | notification closes; Conversation does not open | unchanged | exactly one idempotent short Register: `Alicia 已忽略你的消息` |
| Explicit “忽略” clicked on the shell indication | indication closes; Conversation does not open | unchanged | same idempotent Register action |

Closing a popup is neutral. It must never be inferred as ignoring. Opening/seeing a message creates no AI-side receipt. “忽略” is deliberate and playful, not a server unread/seen state.

## 2. Backend contract requirements

1. `create_send_message` must still atomically create the canonical assistant Message and one `AssistantMessageArrival`, then dispatch normally, but it must not pre-create/link a short Register merely to report delivery.
2. New events keep the required nullable `register_ack` wire key for the current B6 shape; without a legacy Register its value is `null`. Message visibility, delivery, typed target, dedupe and polling remain unchanged.
3. Add one authenticated same-origin action endpoint keyed by canonical arrival identity. Recommended shape:
   - `POST /api/push/assistant-arrivals/<event_id>/ignore/`
   - body: no user-controlled Register text; optional device/installation correlation must never be trusted for target identity;
   - success: bounded JSON truth containing action `ignore`, arrival identity and whether this call created the Register;
   - missing arrival: 404; ineligible source: explicit bounded 4xx.
4. Explicit ignore is available only for `source=send_message`. Ordinary Chat completions do not create a surprise short Register in response to a notification action.
5. Under a transaction/row lock, the first valid ignore creates and links one short Register owned by the sending preset; concurrent/repeated ignore from multiple devices returns the same logical outcome and cannot create siblings.
6. Register content is server-owned fixed text: `Alicia 已忽略你的消息`. Do not include Message body, preview, title, endpoint or browser-supplied text. Use the existing processed-ACK short lifetime unless a verified backend invariant requires another bounded TTL.
7. Existing historical Register rows are not deleted or migrated; they expire naturally. Existing Register ACK endpoint may remain only for active rolling/legacy notifications, but new events and new clients must not depend on it.
8. Update backend architecture/contract docs and synchronize ReactSheet 第八篇 with Desktop after backend acceptance.

## 3. Frontend contract requirements (released only after backend PASS)

1. The canonical event exposes a typed, closed indication that explicit ignore is allowed for a `send_message` arrival. Exact field shape is frozen by the accepted backend contract; no producer/source inference from title, Agent ID or `register_ack`.
2. `showNotification` adds an `actions` entry `{ action: "ignore", title: "忽略" }` only when the event allows it. Platforms that do not render actions simply lack this affordance; no fallback reinterprets close as ignore.
3. `notificationclick` branches on `event.action`:
   - `ignore`: close notification, call the ignore action, do not navigate;
   - empty/default body click: use existing typed navigation and do not create/send a Register ACK.
4. `notificationclose` performs no network request and creates no Register.
5. Shell indication “忽略” calls the same endpoint and leaves unread intact. “查看” navigates normally and creates no Register.
6. Remove new-client navigate/dismiss ACK sends, ACK retry/diagnostic UI and dead state only after source/reference evidence shows they no longer own a current path. Do not remove the backend legacy endpoint in this amendment.
7. Failure must not lose or fabricate Message/unread/navigation truth. Active-window ignore failure is visible and explicitly retryable. A no-client/offline OS-action failure remains best-effort because the stateless SW has no durable retry store; this approved limitation must be documented.
8. Windows Chrome and Android Chrome real-device closure must distinguish notification body, system close and explicit ignore. `event.action === "ignore"` is the only OS ignore signal.

## 4. Acceptance gates

### Backend

- One real/test `send_message` produces one Message + one arrival + zero default Register; event key `register_ack` is present and null.
- Explicit ignore creates one fixed-text short Register linked to the correct arrival/sending preset.
- Repeat and concurrent ignores across device identities remain one Register.
- Ordinary-chat arrival, malformed/missing ID and wrong target cannot create a Register.
- Ignore endpoint never accepts Register text or leaks private content.
- Existing delivery success/failure, no-subscription behavior and transaction rollback remain intact.

### Frontend

- Body click: navigate=1, ignore request=0, Register ACK request=0.
- X/swipe close: navigation=0, ignore request=0, Register ACK request=0.
- Explicit OS ignore: ignore request=1, navigation=0; duplicate UI events converge safely.
- Shell ignore follows the same action and leaves unread; shell view navigates without Register creation.
- Unsupported notification actions degrade to ordinary notification/body click safely.
- Offline/no-client best-effort limitation is observable and does not block later foreground message reconciliation.
- D-1/D-2 preservation, full regression, production SW bundle and clean real-device smoke all pass.

## 5. Explicit exclusions

- No backend unread/seen or cross-device read state.
- No Register for ordinary arrival, view, navigation, system close or automatic delivery.
- No private Message content in Register/evidence.
- No IndexedDB/background-sync framework solely to guarantee offline ignore.
- No V3 notification redesign, Group/Council/system alert expansion or Core C2 self-release.

## 6. Sequencing and current D-3 relation

1. Backend owner writes its repository Plan, implements and independently accepts this B6 amendment.
2. ReactSheet copies synchronize only with the accepted backend shape.
3. Pane 2 then receives a focused frontend repair packet for SW/UI migration.
4. Separately, legacy subscription maintenance requires Alicia to identify intended devices/obsolete origins before any real-DB write.
5. Final D-3 smoke runs only after the contract amendment and subscription precondition both close. The previous R1 evidence remains historical and cannot be reused as clean single-endpoint proof.
