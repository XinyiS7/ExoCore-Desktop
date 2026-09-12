# Assistant Message Arrival + Android PWA Notification — Backend Handoff

> **Document type:** cross-repository product/contract handoff; not backend implementation authorization or a source-level plan.
> **Frontend owner:** `ExoCore-Desktop` P2D.
> **Backend owner:** `ExoCore` B6, to be planned and implemented by that repository's agent.
> **Product decision:** Alicia.
> **Architecture:** `[gpt-5.6-sol / Solaire]`.

## 1. Problem

Current notification behavior is producer-specific:

- `agents.tool_handlers.actions._tool_send_message()` invokes `PushService.send_to_all()`;
- `PushService.send_to_all()` may insert the body into an Agent's Prime Conversation and also sends Web Push;
- normal assistant replies persisted by ordinary live/async Chat do not pass through the same notification owner;
- V4 has no shell-level arrival mechanism for an assistant Message inserted outside the current React send lifecycle, so an already-open Conversation can remain stale.

The product truth must instead be:

> An eligible canonical assistant Message committed to an ordinary Conversation creates one logical `assistant-message-arrived` event. Producer identity does not create a second notification mechanism.

This makes Sandro `send_message`, a normal async response completed while Alicia is elsewhere, and any other explicitly eligible ordinary-Conversation assistant writer converge on one delivery contract.

## 2. Required product behavior

### 2.1 Canonical persistence is independent of Push

- Message persistence is the primary fact; Push is a derivative delivery attempt.
- Absence of subscriptions, expired subscriptions, provider failure or permission denial must not prevent or roll back a valid assistant Message.
- `send_message` may continue to choose the Agent's Prime Conversation and preserve its Register/tool-result semantics, but it must not retain a parallel direct-Push path that duplicates the general arrival event.
- The existing custom `title` may be retained only as optional presentation metadata associated with that arrival. It must not become a second event identity or a second delivery call. B6 must state whether the canonical default title is Agent name, Conversation name, or that optional hint.

### 2.2 Eligible event boundary

B6 must freeze an explicit producer inventory. The default eligible boundary is:

- newly committed, user-visible `Message` row;
- `role=assistant`;
- belongs to an ordinary canonical Conversation;
- has a stable positive Conversation ID and Message ID;
- is not rolled back, replayed, imported or maintenance-generated.

Default exclusions unless Alicia separately approves them:

- GroupChat messages;
- Council participant/synthesis messages;
- external/fake negative-ID conversations;
- migration/import/backfill/replay/test-fixture writes;
- non-user-visible empty/tool-only bookkeeping rows;
- edits to an existing Message;
- failed transaction attempts.

Regenerate/truncate behavior must use final canonical Message identity. A newly persisted replacement assistant Message may create a new arrival; removal or reread of an old row must not.

### 2.3 One event, per-device visibility decision

The backend cannot decide whether a particular PWA client is visible. It must emit one typed arrival payload per eligible Message to each valid subscription/foreground transport. Each device then applies:

| Device/PWA state | Outcome |
|---|---|
| Exact Conversation visible and active | no OS notification; notify the app to reconcile that Conversation in place |
| PWA visible on another Conversation/page | no OS notification; update shell-owned unread/list state and show an in-app indication |
| No visible PWA client, backgrounded or closed | one Android system notification |
| Notification click | canonical V4 logical navigation to that Conversation/Message context |

If multiple same-origin windows exist on one device, one exact visible Conversation client is sufficient to suppress that device's OS popup. Hidden clients do not count as foreground.

### 2.4 Foreground freshness cannot depend on Push permission

Push permission controls background system delivery, not whether canonical messages are eventually visible.

B6 must provide one of these as a frozen contract, after backend source review:

- a server-originated foreground arrival stream; or
- a bounded, visibility-aware reconciliation contract that detects external assistant Message insertion without depending on the local send operation.

The handoff intentionally does not prescribe WebSocket, SSE, long-poll, version probe or ORM signal. The backend plan must choose the smallest complete mechanism. Whatever is chosen must allow an open or refocused PWA with Push denied/expired to recover fresh Conversation state rather than remain permanently stale.

## 3. Minimum frontend-facing event contract

Names are illustrative until B6 freezes the API, but the frontend needs these semantics:

- stable event kind/version;
- canonical `conversation_id`;
- canonical `message_id`;
- Agent identity sufficient for presentation;
- bounded notification preview or explicit no-preview state;
- typed logical destination, not a V3 URL string;
- optional Register acknowledgement identity for `send_message` arrivals;
- optional presentation title hint, if retained;
- server event/commit timestamp;
- deduplication identity.

The payload must not require the frontend to infer Conversation identity from Agent identity, parse `/chat/agent/...`, or treat title/body text as identity.

The frontend will translate the logical target to canonical V4 `/app/chat/:conversationId`. Backend payloads must not hardcode V3 `/chat/conversation/...` or `/chat/agent/...` routes.

## 4. Deduplication and ordering

One canonical Message may be observed through normal runtime completion, foreground arrival, Web Push service-worker handoff, reconnect reconciliation and message-list refetch. B6 must make those observations converge.

Required outcomes:

- one rendered canonical message row;
- at most one unread increment;
- at most one system notification per subscription/device for the logical arrival;
- no second Push because the producer happened to be `send_message`;
- duplicate/retried delivery remains idempotent by stable identity;
- transaction commit precedes external visibility;
- arrival order is deterministic enough to reconcile multiple assistant Messages without dropping or replacing siblings.

Do not use title, body, timestamp proximity or “latest message” guessing as deduplication identity.

## 5. Unread / seen ownership

B6 must decide and document whether durable unread/seen state is backend-owned or device-local. It may not leave the two in an accidental mixed state.

Minimum semantics:

- unread is keyed to canonical Conversation/Message identity;
- displaying the exact active Conversation may advance seen state;
- merely having the app visible on another route does not consume unread;
- duplicate transport delivery does not increment twice;
- cold-start click and warm-client click acknowledge the same logical arrival once;
- multi-device implications are explicit.

`RegisterAckView` compatibility must be preserved for arrivals originating from `send_message`. Ordinary assistant replies need no fabricated Register unless the backend product design explicitly introduces one.

## 6. Subscription and delivery truth

- Browser subscription success is not sufficient: backend persistence must succeed before UI reports a healthy subscription.
- 410/expired subscription, browser-only subscription, backend persistence failure, zero subscription, partial delivery and total delivery failure remain distinguishable.
- Re-subscription must preserve or deliberately update device identity without creating duplicate active rows.
- Delivery result must not be reported as Message persistence result.
- Existing VAPID and Push subscription APIs remain compatible until B6 explicitly versions them.

## 7. Security and privacy

- Arrival payload exposes only the bounded fields needed for notification and navigation.
- Lock-screen preview policy must be explicit; no reasoning, hidden tool arguments, private voice-direction data or full unbounded Message content enters Push payloads.
- The ordinary API permission model remains authoritative for opening the target after a click.
- A stale/deleted/inaccessible target must fail safely; it must not redirect to an unrelated latest Conversation.

## 8. Backend acceptance targets

B6 is ready for P2D handoff only when evidence demonstrates:

1. `send_message` with zero/failed Push delivery can still preserve the intended canonical Message, while its tool result truthfully reports delivery outcome.
2. `send_message` produces one arrival/Push path, not direct Push plus generic Push.
3. A normal assistant Message persisted after live or async generation emits the same logical event shape.
4. Ineligible producers and rolled-back writes emit no event.
5. Commit timing, repeated delivery and reconnect replay are idempotent by Conversation/Message identity.
6. Multiple consecutive assistant Messages remain distinct and ordered.
7. Optional Register ACK remains linked only where valid and is idempotent.
8. Existing Message read/runtime behavior, GroupChat, Council and maintenance flows are not silently broadened.
9. Subscription states and partial/zero/failed delivery remain truthful.
10. The final API/event contract is recorded in both backend and frontend `ReactSheet.md` before P2D Detailed Plan.

These are verification targets/interfaces only; test implementation belongs to the backend repository's frozen plan and acceptance assets.

## 9. Non-goals

- Live voice API or proactive phone calls.
- Automatically playing TTS when a Push arrives.
- Moving GroupChat onto ordinary Conversation runtime.
- Notifying on every model/tool/internal row indiscriminately.
- Prescribing WebSocket/SSE/signals before backend source review.
- Rebuilding Push with Capacitor/native Android.
- Adding speculative notification analytics, channels or prioritization rules.

## 10. Handoff condition

`ExoCore-Desktop` must not implement P2D against guessed event names or payloads. The ExoCore agent must first produce and obtain approval for a B6 backend Detailed Plan grounded in current Message write paths, `PushService`, `send_message`, Register ACK and subscription lifecycle. Backend changes stay in the `ExoCore` repository; this frontend repository only consumes the accepted contract.
