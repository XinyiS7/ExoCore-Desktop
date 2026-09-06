# ExoCore V4 — Phase 1B Core Chat Runtime Detailed Plan

> **Document type:** P1B executable implementation plan; limited to C1B.
> **Status:** **APPROVED — CONSTRUCTION AUTHORIZED** `[Alicia / 2026-09-03]`.
> **Repository:** `ExoCore-Desktop` only. Outer deployment and Django production code are read-only in P1B.
> **R1 review:** self-consistency and ablation audit `[opencode-go/deepseek-v4-flash / Ecki]`; localized factual/cache-reconciliation refinements accepted `[gpt-5.6-sol / Solaire]`.
> **Baseline checkpoints:** Desktop `fce0d5438e49c181e62be5b573e0f9f4baa06614`; outer repository `e7dce77ed7f6ca2d979d8fb326bd1b4d11f2b2f6`; backend prerequisite `29368bbfcf31f64f3baa5c6ba3fec79662d6fb8a`.
> **Product authority:** Alicia.
> **Plan / architecture / QC:** `[gpt-5.6-sol / Solaire]`.
> **Upstream gate:** C1A PASS `[gpt-5.6-sol / Solaire] [Alicia / approved]`.
> **C1B intervention amendment:** §6.4 scrolled-up reconciliation narrowly re-baselined to deferred fetch `[Alicia / approved / 2026-09-03]`; C1B R4 construction remains governed by `Plan/V4_Phase_1B_acceptance_escalation_C1B.md` and a separate Acceptance `RESUME AUTHORIZED` record.

---

## 1. Goal and acceptance intent

P1B turns the accepted P1A Conversation detail from a read-only page into a safe text-chat runtime:

```text
canonical /chat/:conversationId
  -> compose one text turn
  -> run by SSE or async + polling
  -> observe content / state / error / terminal
  -> stop an active run
  -> reconcile to persisted Message history
  -> edit or regenerate from an exact persisted user Message
  -> branch from an exact persisted assistant Message
```

The essential problem is not “add a send button.” It is to give one owner responsibility for the whole run lifecycle so that fragmented network data, route changes, retries, stop races and persisted history cannot create duplicate or cross-conversation UI state.

### C1B acceptance intent

A user must be able to:

1. send a text-only turn from the canonical V4 Conversation route;
2. see an incremental answer through the default SSE mode;
3. select async mode, reload or re-enter, and recover through token + cursor polling without duplicating content;
4. stop either transport and see an honest stopped or reconciled terminal state;
5. distinguish successful completion, backend error, network interruption, protocol error and history-sync failure;
6. edit or regenerate an exact persisted user turn without creating a duplicate user Message;
7. branch from an exact persisted assistant Message and navigate to the returned canonical Conversation identity;
8. keep all P1C/P1D capabilities visibly outside this slice;
9. leave V3 Chat production-primary until unified C1.

C1B is a construction checkpoint only. It does not transfer Chat ownership and does not authorize P1C.

---

## 2. Authority, facts and conflict handling

### 2.1 Product authority

1. `Plan/V4_Spec_Freeze_Index.md` §4;
2. `Plan/ExoCore_V4_Single_SPA_Architecture_Spec.md` §10.2–§10.3, §12–§13;
3. `Plan/V4_Page_Skeleton.md` Chat section;
4. `Plan/V4_Master_Implementation_Roadmap.md` §7 and §16;
5. `Plan/V4_Phase_0_Baseline/V3_Capability_Ownership.md`;
6. `Plan/V4_Phase_1A_App_Shell_Conversation_Read_Detailed_Plan.md` and accepted C1A artifacts;
7. Alicia's explicit decisions.

### 2.2 Implementation facts

1. current Desktop and backend source at the pinned checkpoints;
2. `Plan/V4_Phase_0_Baseline/Canonical_API_Snapshot.json`;
3. `ReactSheet.md` where it matches current source;
4. V3 Chat behavior as parity evidence, not architecture to copy.

Product authority and implementation facts do not overwrite each other. A conflict becomes either a narrowly documented contract correction or a backend handoff gate. P1B must stop rather than disguise a blocking mismatch in frontend inference.

### 2.3 Baseline invariants

- `Conversation.id` is the durable local history identity and canonical route identity.
- A polling `message_id` is an opaque, short-lived runtime token; it is not a persisted Message or Session identity.
- P1A query state remains the owner of persisted Conversation and Message rows.
- A separate runtime controller owns live events and terminal transitions; TanStack Query must not become the SSE controller.
- V4 uses only V4-namespaced local storage. It must not read, rewrite or delete V3 `exo_async_<id>` keys.
- V3 `/chat/`, V4 `/app/`, root redirect, four PWA identities and all deployment mounts remain unchanged.

---

## 3. Scope boundary

### 3.1 Allowed P1B work

- Add a text composer to the canonical Conversation detail.
- Add a small transport selector for `SSE` and `async polling`; SSE remains the default to preserve the canonical backend default and V3 baseline.
- Add a typed runtime controller, SSE decoder, polling loop, V4 runtime-lease storage and pure runtime state transitions.
- Render an optimistic local turn without fabricating server Message IDs or inserting runtime rows into the persisted Query cache.
- Reconcile every terminal/uncertain run to canonical Message history.
- Add stop, user-message edit, user-message regenerate and assistant-message branch actions. Edit is not a new scope expansion: the accepted C0 ownership mapping explicitly assigns “regenerate/edit” to P1B because both use the same `edit_message_id` runtime entry point `[gpt-5.6-sol / Solaire]`.
- Add explicit runtime, retry-safety and reconciliation states.
- Amend only P1B-relevant frontend contract documentation where current backend source disproves stale wording.
- Correct the P1A historical reasoning chip from “P1B” to “P1D”; P1D owns the visible Thinking/Run Trace surface.
- Add focused V4 tests and construction evidence.

### 3.2 Explicitly excluded

- Attachments, image paste, file upload, audio record/upload/playback or attachment recovery — P1C.
- Model, endpoint, thinking-level selection, cache controls, private-memory toggle, session-history/full-lite control, Aura, project files — P1D.
- Visible reasoning transcript, telemetry HUD, cache-skipped toast, structured tool events or `AssistantRunTrace` — P1D.
- Agent Hub, Project Hub, Groups, Settings, notifications or account pages — P2.
- Message bookmark/highlight, Collection, River, Memory, Recall Receipt.
- Branch naming, branch session-type controls or post-branch rename; the canonical branch endpoint already supplies a traceable name, and these extras are not C1B requirements.
- Automatic resend, automatic regenerate, background global run registry, cross-tab distributed locking, WebSocket/EventSource replacement or new state/dependency libraries.
- Backend model/view/service/runtime changes, outer nginx/launcher changes, PWA identity changes or V3 source refactors.
- P2-01 `/app` without trailing slash redirect.

### 3.3 Ownership after C1B

`send / SSE / polling recovery / stop / edit-regenerate / branch` are implemented in V4, but production ownership remains V3 chat-core until C1A–C1D and unified C1 all pass. C1B failure rolls back to accepted C1A without changing user data.

---

## 4. Mandatory source/config reading before construction

Construction must re-read these exact current surfaces before editing and record any drift from this Plan.

### 4.1 Accepted V4 foundation

- `packages/app/src/features/chat/ConversationPage.tsx`
- `packages/app/src/features/chat/MessageTimeline.tsx`
- `packages/app/src/features/chat/MessageContent.tsx`
- `packages/app/src/features/chat/api.ts`
- `packages/app/src/features/chat/queries.ts`
- `packages/app/src/features/chat/types.ts`
- `packages/app/src/app/AppProviders.tsx`
- `packages/app/src/app/router.tsx`
- `packages/app/src/styles/base.css`
- `packages/app/src/styles/shell.css`
- all current `packages/app/src/test/*`
- `packages/shared/src/api.js` and `packages/shared/src/api.d.ts`

### 4.2 V3 parity evidence

- `packages/chat-core/src/components/chat/ChatArea.jsx` — load/re-entry, `handleSend`, `handleStop`, edit/regenerate and branch flows;
- `packages/chat-core/src/hooks/usePollingChat.js`;
- `packages/chat-core/src/components/chat/MessageBubble.jsx`;
- `packages/chat-core/src/components/modals/BranchSessionModal.jsx`;
- relevant chat-core tests covering terminal, stop, retry and paging behavior.

V3 defects must not be copied. In particular, P1B must not:

- append unknown event payloads to assistant content;
- count polling cursors by character length;
- omit `stopped` from polling terminal handling;
- delete an async recovery token on the first transient polling failure;
- abort the stream before issuing a user-requested stop;
- swallow stop/refresh/copy errors silently;
- infer persisted IDs from timestamps, text, array position or latest-row guesses.

### 4.3 Backend read-only truth

- `../ExoCore/agents/urls.py` chat/status/stop/branch routes;
- `../ExoCore/agents/views.py` `AgentChatView`, `ChatStreamStatusView`, `ChatStreamStopView`, `ConversationBranchView`;
- `../ExoCore/agents/services.py` `_format_sse`, current event emitters and terminal handling;
- `../ExoCore/agents/streaming_buffer.py` `StreamingBufferManager` and `SSESessionRegistry`;
- `../ExoCore/memory/services.py` `ConversationService.prepare_chat_session`, truncation and branch logic;
- `../ExoCore/memory/serializers.py` `MessageSerializer`;
- `../ExoCore/agents/tests/test_services.py` terminal-event coverage;
- `../ExoCore/agents/tests/test_runtime_route_integration.py` and `test_runtime_turn.py`;
- both frontend/backend `ReactSheet.md` relevant sections.

If these facts changed after `29368bbf`, Construction pauses and reports the exact delta. It does not modify backend production code from the Desktop repository.

---

## 5. Canonical P1B API contract

### 5.1 Send / edit / regenerate

```text
POST /api/agents/chat/<conversationId>/
POST /api/agents/chat/<conversationId>/?mode=async
```

P1B request ownership is deliberately narrow:

- normal send: non-empty `content`;
- edit: exact persisted user `edit_message_id` plus non-empty replacement `content`;
- regenerate: exact persisted user `edit_message_id` plus empty `content`;
- no P1C attachment fields;
- no deprecated `galatea_mcp`;
- no model/endpoint/cache/memory/session-type controls owned by P1D;
- preserve a non-empty existing Conversation `thinking_level`; normalize legacy `null`/empty values to `auto`, matching canonical init and V3's current fallback, rather than allowing the POST default `medium` to make an unannounced choice.

The target ID must be a positive integer, belong to the current rendered Conversation data and have role `user`. UI action visibility is not a substitute for request-side validation.

### 5.2 SSE response

- Require HTTP 200, a readable body and `text/event-stream` content type.
- Parse frames incrementally across arbitrary byte/chunk boundaries and CRLF/LF separators.
- Canonical event set: `status`, `thinking`, `content`, `telemetry`, `cache_skipped`, `done`, `stopped`, `error`.
- `content`, `thinking` and current `status` payloads normalize to strings.
- `telemetry`, `cache_skipped`, `stopped` and typed `error` normalize to validated objects; legacy/bare error remains a safe fallback.
- `done`, `stopped` and `error` are mutually exclusive terminals. EOF without a terminal is an interruption, never success.
- Unknown or malformed events are not appended to answer text. Record a visible nonfatal protocol warning, continue consuming when safe, and rely on terminal history reconciliation to restore canonical persisted content.

P1B renders incremental answer content and a minimal transient runtime status. It may retain thinking/telemetry/cache-skipped payloads inside runtime state for correctness, but it does not expose their detailed P1D UI.

### 5.3 Async acknowledgement and polling

Async POST success is:

```text
{ "message_id": <opaque 8-character runtime token>, "status": "processing" }
```

Despite the legacy field name, `message_id` is not a database Message ID. Validate it as a non-empty string and never place it in a Message route/action.

Polling:

```text
GET /api/agents/chat/<conversationId>/status/?message_id=<token>&cursor=<eventIndex>
```

- statuses: `processing | done | stopped | error | not_found`;
- cursor is the server event index and must advance monotonically; never derive it from text length;
- apply returned events before applying the response terminal status;
- current backend implementation may return event `delta` as a string or, for structured event kinds such as telemetry/cache-skipped, as a JSON object. Normalize by `event_type`, not by blind string concatenation;
- `stopped` is a real terminal;
- `not_found` means the process-local buffer is absent (for example unknown token or backend process restart), not successful completion;
- current source defines `_BUFFER_TTL = 300` and stores `created_at`, but never enforces either: there is no `cleanup_expired()` implementation or age check. Actual buffer lifetime is therefore the owning process lifetime, not a working 300-second TTL `[opencode-go/deepseek-v4-flash / Ecki — source finding]`;
- V4 must not fabricate a 300-second expiry promise or silently discard a lease by local age. A visibly stale local record may be reconciled/acknowledged, but only `not_found` proves the token unavailable to the current backend process.

A transient poll/network failure keeps the validated lease and exposes retry/resume. It must not silently discard the only recovery token.

### 5.4 Stop

```text
POST /api/agents/chat/<conversationId>/stop/
POST /api/agents/chat/<conversationId>/stop/?message_id=<asyncToken>
```

- SSE: issue the session-scoped stop request while the stream is still connected; continue consuming until terminal/reconciliation. Do not abort first.
- Async: issue token-scoped stop and continue polling until `stopped`, another terminal, or an explicitly uncertain state.
- `200 {status:"stop_requested"}` means accepted request, not yet a persisted terminal.
- `404` can be a terminal race; reconcile history and show an honest status rather than inventing “stopped.”
- stop network failure remains visible and retryable while the run stays locked.
- navigation/unmount is not a user stop and must not call the stop endpoint automatically.

### 5.5 Branch

```text
POST /api/agents/conversations/<conversationId>/branch/
{ "branch_from_message_id": <persisted assistant Message.id> }
```

- Require a positive persisted assistant Message ID belonging to the current Conversation view.
- Accept only a positive top-level `conversation_id` from the 201 response as canonical navigation identity.
- Never consume the legacy `session_id` alias.
- Invalidate Recent and navigate to the canonical V4 route for the returned Conversation.
- A malformed 2xx identity is an ambiguous write: lock repeated branch submission and direct the user to Recent; do not search by branch name or maximum ID.
- Server-owned copy/truncation rules remain authoritative.

### 5.6 P1B documentation corrections

Current source requires a narrow `ReactSheet.md` and C0 snapshot amendment:

1. async `message_id` is an opaque runtime token, not an assistant Message identity;
2. polling event `delta` is a JSON value normalized by event kind, not guaranteed string for structured events;
3. branch originates from an assistant Message, not a HistoryChunk;
4. canonical status payload wording must follow actual string emitters;
5. the P1A reasoning badge must point to P1D, including its existing `conversation.test.tsx` assertion;
6. the documented 300-second polling-buffer TTL is declared but not enforced in current backend source; document process-lifetime reality without adding frontend fake expiry;
7. generator-path failures such as an invalid edit target surface through `_sse_error_guard` as stream `error` (commonly `stream_crashed`), not a synchronous edit-specific 404.

Update the frozen snapshot version/changelog rather than silently rewriting its provenance. If review finds that backend behavior should change instead, stop and create a backend handoff brief; do not widen P1B autonomously.

---

## 6. Runtime architecture

### 6.1 Ownership split

```text
TanStack Query
  persisted Conversation + Message pages

Chat runtime controller
  active transport + parser/poller + runtime overlay
  stop + edit/regenerate + terminal/retry safety
  V4 async lease / uncertainty marker

Thin UI
  composer + transport selector + message actions
  visible state/error/reconcile controls
```

The UI must not parse SSE blocks, schedule polls, manipulate cursor arithmetic, build stop URLs or write runtime storage directly.

### 6.2 Suggested file boundary

Keep the implementation local to `packages/app/src/features/chat/` and adapt names to existing style:

- `runtime/types.ts` — event, terminal, transport, lease and state contracts;
- `runtime/sse.ts` — incremental SSE frame decoder and event normalization;
- `runtime/storage.ts` — versioned V4 lease/uncertainty persistence;
- `runtime/client.ts` — raw streaming fetch, async ack, poll and stop adapters;
- `runtime/useChatRuntime.ts` — lifecycle orchestration and public commands;
- focused pure runtime helpers/reducer only where state transitions would otherwise scatter;
- `ChatComposer.tsx`, runtime status surface and the minimal branch confirmation UI;
- extend existing `api.ts`, `types.ts`, `queries.ts`, `ConversationPage.tsx` and `MessageTimeline.tsx` rather than creating a parallel Chat page.

This is a boundary, not a demand for one abstraction per bullet. Merge tiny files if clarity improves; do not collapse the controller back into `ConversationPage.tsx`.

### 6.3 Runtime state model

At minimum distinguish:

```text
idle
submitting
streaming | polling
stopping
terminal: done | stopped | error
interrupted / runtime-unavailable / protocol-warning
reconciling
reconcile-error
```

Each active epoch carries the exact `conversationId`, transport and a unique client run key. Async epochs additionally carry the opaque token and current event cursor. Every callback/event must verify its epoch and Conversation before changing state; late events from an aborted/unmounted/previous route epoch are ignored.

### 6.4 Runtime overlay, not fake persistence

- New send may render a client-keyed optimistic user row and assistant placeholder.
- Edit/regenerate may render the persisted prefix plus one runtime assistant overlay.
- Client rows use discriminated client keys; never use `Date.now()` or negative numbers as fake server Message IDs.
- Runtime rows never enter persisted message Query pages and never expose persisted-only actions.
- On a terminal or uncertain outcome, first determine whether the reader is still at latest. Do not blindly refetch all offset pages in place because newest-relative offsets can shift.
- If the user is at/near latest, fetch one fresh canonical newest history window, apply it through the single append/destructive Query owner, conditionally clear the exact runtime marker, then unlock/discard the overlay only after clear succeeds.
- If the user has scrolled away from latest, do **not fetch** and do **not apply** canonical history at terminal/uncertain time. Preserve rendered pages, viewport and runtime overlay; retain the runtime marker and operation lock; expose “return to latest” as the reconciliation trigger. No `canonical_held` payload or phase exists.
- When the user returns to latest, perform exactly one fresh offset-0 canonical fetch, apply it, conditionally clear the exact runtime marker, then unlock/discard the overlay. Fetch, apply, marker clear and UI unlock are separate ordered effects; failure at any step keeps writes locked and follows the exact captured-owner recovery contract in the C1B intervention plan.
- This deferred-fetch policy intentionally delays discovery/display of a canonical-fetch error until the user returns to latest. Alicia explicitly accepts that tradeoff in this narrow §6.4 re-baseline.
- Normal-send reconciliation may retain already loaded canonical older rows only through one tested merge/rebase owner.
- Edit/regenerate is destructive by contract. Once return-to-latest triggers application, remove/reset the entire message-query family for that Conversation and rebuild from canonical pages before older-page navigation is re-enabled. The temporary scrolled-up deferral does not make pre-truncation descendants canonical; the prior confirmation already warned that later turns will be replaced.
- A successful applied reconciliation leaves only canonical server IDs/order. Reconciliation failure preserves the overlay with an explicit “history sync failed” state and retry; it must not label the overlay canonical.

### 6.5 V4 storage contract

Use a versioned V4 namespace such as:

```text
exo:v4:chat-runtime:<conversationId>
exo:v4:chat-transport
exo:v4:chat-draft:<conversationId>
```

A runtime record contains only the minimum transport state: schema version, operation kind (`send | edit | regenerate | branch`), Conversation ID, transport, async token when acknowledged, start/update time and active/uncertain disposition. Do not persist response text, reasoning, telemetry, API keys or model credentials.

- Write a pending/uncertain operation marker immediately before dispatch, so a sudden reload cannot erase duplicate-write protection. Clear it after a proved safe synchronous rejection; replace it with the validated async lease after acknowledgement; clear it after terminal reconciliation.
- A fresh async page entry rebuilds a clean overlay by polling cursor 0, then continues from the returned cursor.
- Invalid JSON, wrong schema, wrong Conversation ID or a token proved `not_found` is quarantined/cleared with a visible recovery message, never executed blindly. Age alone is not proof of backend expiry.
- Unknown POST outcome retains the uncertainty marker across navigation/reload. Branch uses the same operation-aware safety rule rather than a dialog-only lock.
- Storage is cleared only after canonical terminal reconciliation or explicit user acknowledgement of a stale/uncertain/runtime-unavailable record.
- Draft text is conversation-scoped. Clear it only after the request is accepted; do not repopulate a persisted failed/stopped turn as an automatic resend.

No V3 storage key migration occurs in P1B.

### 6.6 Retry-safety classes

| Outcome | Retry classification | Required UI behavior |
|---|---|---|
| local validation failure | safe | keep draft/action; no request |
| synchronous non-2xx before stream/ack | safe according to returned error | show mapped error; preserve draft |
| async/SSE POST transport failure or malformed accepted response | uncertain write | persist lock; reconcile; no automatic resend |
| typed stream `error` | terminal persisted/partial | reconcile; expose exact user Message action after server IDs return |
| EOF without terminal | interrupted/uncertain | reconcile; no automatic resend |
| async transient poll failure | recoverable | retain token/cursor; offer resume |
| async `not_found` | runtime-unavailable/uncertain | reconcile; remove unusable token only after recording visible state |
| `stopped` | terminal persisted/partial | reconcile; do not restore draft automatically |
| `done` | terminal success | reconcile canonical history |
| malformed branch 2xx | ambiguous branch write | lock branch retry; refresh Recent; never infer identity |

Manual acknowledgement may unlock an uncertain send only after the UI clearly states that the backend outcome is unknown. This is not automatic retry or idempotency.

---

## 7. User interaction contract

### 7.1 Composer

- Text-only multiline composer at the bottom of canonical Chat.
- Blank/whitespace-only normal send is disabled.
- `Enter` sends; `Shift+Enter` inserts a newline; IME composition must never trigger send.
- Send is locked immediately before dispatch to prevent double-click/keypress duplication.
- During active run, the primary action becomes Stop; edit/regenerate/branch actions are disabled.
- The composer and mobile viewport respect the accepted C1A no-obscuration geometry. Do not restore the hidden mobile product bottom bar on detail routes.
- Attachment/mic/model/cache controls are absent rather than fake-enabled.

### 7.2 Transport selector

Expose a compact, clearly technical choice:

- `实时（SSE）` — default;
- `可恢复（轮询）` — async token + polling, with a short note that recovery depends on the same backend process remaining available; current source does not enforce its declared 300-second TTL.

This selector belongs to P1B transport lifecycle, not P1D model/control ownership. Persist it only under the V4 transport key.

### 7.3 Minimal runtime presentation

P1B may show:

- optimistic user text;
- incremental assistant answer text;
- latest generic backend status/progress text;
- `submitting / generating / stopping / reconciling` labels;
- safe typed error and protocol/recovery warnings;
- retry history-sync, resume polling or acknowledge-uncertain actions.

P1B must not show full reasoning, telemetry metrics, cache controls/status, tool trace or Recall UI. Existing persisted `reasoning_content` remains represented by a deferred chip labelled P1D.

### 7.4 Edit and regenerate

- Actions exist only on persisted user rows.
- Edit places the exact source content into an explicit edit mode with cancel; an existing unsent draft must be preserved and restored on cancel.
- Regenerate sends empty content with the exact user Message ID and does not consume/clear an unrelated draft.
- If the target is not the latest user turn, require confirmation that later turns will be replaced/truncated.
- Runtime overlay immediately reflects the target prefix but remains noncanonical until reconciliation.
- Error or interruption never fabricates a second user row.

### 7.5 Branch

- Action exists only on persisted assistant rows and is disabled during a run.
- Confirmation identifies the source answer and warns that a new independent Conversation will be created.
- Success navigates to one canonical detail implementation.
- Failure stays on the source Conversation with visible retry-safe/ambiguous status.
- Do not expose custom name or session type in P1B.

---

## 8. Implementation tasks

### Task 0 — Preflight and scope pin

1. Confirm Desktop HEAD exactly `fce0d5438e49c181e62be5b573e0f9f4baa06614`. The reviewed P1B Plan may be the sole pre-existing Desktop delta; pin its path/hash separately.
2. Confirm outer HEAD `e7dce77ed7f6ca2d979d8fb326bd1b4d11f2b2f6`, backend HEAD `29368bbfcf31f64f3baa5c6ba3fec79662d6fb8a`, and both are clean.
3. Run the real AgentPreset baseline script; require IDs 1–8.
4. Capture Desktop staged/unstaged/untracked manifests and hashes; FAIL on any unexplained delta beyond the approved Plan rather than absorbing unrelated work.
5. Verify ports/services before exclusive runtime probes. Announce only if another active pane is using the same server/container/test resource.
6. Re-read §4 source inventory and record line/symbol drift.
7. Keep construction locked until this Plan passes review and Alicia approves it.

### Task 1 — Freeze contract corrections

1. Amend the P1B runtime entries in `Canonical_API_Snapshot.json` with a version/changelog note, including the declared-but-unenforced TTL fact.
2. Correct matching `ReactSheet.md` runtime and branch wording.
3. Correct the reasoning deferred-phase label to P1D and update the existing `conversation.test.tsx` expectation.
4. Record generator-path `stream_crashed` semantics without claiming an edit-specific synchronous 404.
5. Do not change backend or broaden unrelated API docs.
6. If the backend facts cannot support §5, stop with a narrow handoff proposal before product code.

### Task 2 — Typed runtime adapters

1. Add exact request/response/event DTOs; avoid `any` at runtime boundaries.
2. Implement raw streaming fetch separately from JSON `apiFetch`.
3. Implement incremental SSE frame decoding and kind-specific payload normalization.
4. Implement guarded async ack, polling envelope/cursor, stop and branch adapters.
5. Map HTTP, network, typed backend, legacy backend and protocol failures into one UI-safe error vocabulary while retaining machine-readable code/retry class. Treat `stream_crashed` as an outcome requiring reconciliation—not proof that the edit target was invalid or that a partial assistant row was persisted.

### Task 3 — Runtime state and storage

1. Implement the finite lifecycle in §6.3.
2. Add epoch/Conversation guards for all asynchronous callbacks.
3. Implement client-keyed overlay merge without mutating Query pages.
4. Add versioned async lease, uncertainty marker, transport preference and draft storage.
5. Implement safe terminal/uncertain reconciliation and the near-bottom versus scrolled-up application rule from §6.4. For edit/regenerate, explicitly remove/reset the complete Conversation message-query family before canonical rebuild so truncated descendants cannot reappear from cached offset pages.
6. Keep transient poll failures resumable and cursor-monotonic.

### Task 4 — Composer and SSE path

1. Add text composer keyboard/IME behavior and immediate duplicate-submit lock.
2. Default to SSE and expose the transport selector.
3. Stream content/status through the controller into the overlay.
4. Preserve but do not visibly expand P1D event data.
5. Handle done/stopped/error/EOF and history-sync outcomes explicitly.
6. Keep the mobile detail geometry and canonical route unchanged.

### Task 5 — Async recovery and stop

1. Start async mode, validate/persist its token, and poll by event-index cursor.
2. On reload/re-entry, load canonical history first, rebuild an empty runtime overlay, replay from cursor 0 and continue without duplicate event application.
3. Retain the lease through transient failures; handle stopped/error/not_found as distinct outcomes.
4. Implement transport-aware stop ordering from §5.4.
5. Ensure route-unmount cleanup cancels only local readers/timers and cannot write late events into another Conversation.

### Task 6 — Edit, regenerate and branch

1. Add persisted-role-correct message actions.
2. Implement edit-mode draft preservation/cancel and historical truncation confirmation.
3. Implement regenerate with empty content and exact user Message ID.
4. Implement minimal branch confirmation, canonical identity validation, Recent invalidation and canonical navigation.
5. Handle ambiguous branch success without name/latest-ID lookup or repeat-submit enablement.

### Task 7 — Focused verification and evidence

1. Run formatter-equivalent/static checks already used by the package; do not add a formatter dependency.
2. Run app typecheck, lint, focused tests and full app test suite.
3. Run root four-package build and V3 chat-core regression.
4. Compare V3 lint fingerprints to C0/C1A known-dirty baselines; no new V3 lint debt.
5. Run backend read-only checks and focused existing runtime suites against the accepted backend checkpoint.
6. Execute deterministic production-browser transport harnesses for chunking, reload/re-entry, stop races and action flows. Harness implementation belongs in acceptance evidence, not this Plan.
7. Execute the controlled live probe in §10 only after all deterministic gates pass.
8. Write `Plan/V4_Phase_1B_Construction_Evidence.md`; stop before acceptance and commit.

### Task 8 — Closing and handoff

1. Re-run app/full/V3/backend/deployment-preservation checks listed in §9.
2. Re-run real DB baseline and verify all probe rows are cleaned.
3. Verify outer/backend exact HEADs and clean status.
4. Verify no generated dist, credentials, browser profiles, probe logs or real user data entered Git.
5. Stage only approved Desktop files if Alicia has authorized tracking; do not commit.
6. Hand off to independent C1B acceptance with changed-file manifest, command exits/counts, state-matrix evidence, live-probe cleanup and declared omissions.

---

## 9. Verification targets and interfaces

No raw test implementation is frozen in this Plan. Construction and Acceptance may choose harness mechanics independently, but both must prove the following observable targets.

### 9.1 Static/package commands

From `ExoCore-Desktop`:

```bash
pnpm install --frozen-lockfile
pnpm --filter exo-app typecheck
pnpm --filter exo-app lint
pnpm --filter exo-app test:run
pnpm --filter exo-app build
pnpm --filter exo-chat-core test:run
pnpm build
pnpm --filter exo-chat-core lint
pnpm --filter exo-chronicle lint
pnpm --filter exo-council lint
git diff --check
git diff --cached --check
```

Expected:

- no lockfile change unless a reviewed necessity proves one; this Plan requires no new dependency;
- app checks and tests exit 0;
- all four packages build;
- chat-core remains 85/85 or an explicitly accepted descendant baseline;
- V3 lint remains only the frozen known-dirty fingerprint, with no new issue;
- diffs are whitespace-clean.

### 9.2 Backend preservation commands

From `../ExoCore`:

```bash
bash .agent/check_real_db_baseline.sh
python.exe manage.py check
python.exe manage.py makemigrations --check --dry-run
python.exe manage.py test \
  agents.tests.test_services.StreamOutcomeTests \
  agents.tests.test_services.ChatTerminalEventTests \
  agents.tests.test_runtime_route_integration \
  agents.tests.test_runtime_turn
```

Acceptance may expand focused labels if current source shows additional directly coupled tests. Backend must remain clean at `29368bbf`; P1B does not add backend tests or production code from this repository.

### 9.3 Parser/event matrix

Prove:

- UTF-8 characters and frames split at every meaningful chunk boundary;
- LF/CRLF, multiple frames per chunk, final residual frame and `data:` joining;
- canonical payload normalization by event kind;
- structured polling delta for telemetry/cache-skipped never becomes `[object Object]` answer content;
- unknown/malformed events are visible and non-content;
- exactly one terminal wins; post-terminal events cannot mutate the overlay;
- EOF without terminal is interrupted, not done.

### 9.4 Lifecycle matrix

Prove both SSE and async paths for:

- submitting → active → done → canonical history;
- typed/legacy/bare error → visible failure → canonical partial history where present;
- user stop request → stopping → stopped/terminal reconciliation;
- stop 404 terminal race;
- history reconciliation failure and explicit retry;
- stale epoch/route change cannot update another Conversation;
- double click, repeated Enter and late callback cannot dispatch a second POST.

### 9.5 Async recovery matrix

Prove:

- validated ack writes only the V4 lease;
- reload/re-entry resumes the same token at a clean cursor-0 overlay;
- subsequent polls use monotonic server event cursor;
- already replayed events do not duplicate;
- transient offline/network failure retains token and resumes;
- `done`, `stopped`, `error`, `not_found` remain distinct;
- invalid/foreign/stale storage is not executed blindly; current-backend `not_found` is covered by unknown-token/process-reset injection rather than a fictitious TTL wait;
- no V3 `exo_async_*` key is read or changed.

### 9.6 Edit/regenerate/branch matrix

Prove:

- only persisted user rows can edit/regenerate;
- only persisted assistant rows can branch;
- edit uses non-empty content + exact user ID and restores unrelated draft on cancel;
- regenerate uses empty content + exact user ID and never creates an optimistic duplicate user row;
- historical actions warn about truncation;
- edit/regenerate terminal reconciliation resets the whole Conversation message-query family, and deleted descendants cannot reappear from cached older pages;
- branch success requires positive canonical `conversation_id` and navigates once;
- malformed branch 2xx locks retry and refreshes Recent without identity inference;
- branch HTTP 400/404/500, generator-path `stream_crashed`, typed runtime errors and network failures are represented according to their actual transport semantics.

### 9.7 Responsive/accessibility matrix

At minimum verify production build at CSS widths 320, 390, 767 and 768+:

- composer remains reachable above the mobile viewport/safe area and does not restore the product bottom bar;
- timeline is the single scroll owner and incoming content auto-scrolls only when the user is near the bottom;
- when the user has scrolled upward, streaming does not steal position and offers a return-to-latest action;
- keyboard send, Shift+Enter, IME composition, dialog focus/escape and action labels work;
- status/error/stop are not color-only;
- no horizontal overflow from composer, status or actions.

### 9.8 Scope-preservation sweeps

Prove no P1B code or UI contains:

- attachment/audio upload/record controls;
- model/endpoint/cache/memory/history/Aura/Tool Trace implementation;
- Group/River/Library destination implementation;
- imports from V3 page/component source;
- backend/outer/PWA config changes;
- raw HTML enablement or silent catches on new P1B error paths.

---

## 10. Controlled live runtime probe

The live probe is final integration corroboration, not a substitute for deterministic state-matrix tests.

### 10.1 Data discipline

- Opening and closing AgentPreset baseline must be exactly IDs 1–8.
- Never create/delete an AgentPreset or change a primary key.
- Use only archived preset 3 (`Archived Chat`, standard, low-cost `deepseek-v4-flash`).
- Snapshot all touched preset fields; temporarily set `is_visible=true` only if the actual V4 UI requires it; restore `is_visible=false` in a guaranteed cleanup path.
- Create uniquely named temporary Conversations and delete them through Django ORM after evidence capture. Confirm source, branch, Messages and related temporary rows are gone.
- No bare SQL and no real user Conversation.

### 10.2 Bounded probe path

After deterministic gates pass:

1. create one temporary Drift Conversation through the actual V4 UI;
2. send one very short SSE turn and observe incremental content, one terminal and canonical persisted Message IDs after reconciliation;
3. start one async turn, reload/re-enter while its token is active when timing permits, then request stop and observe polling terminal/reconciliation;
4. if the provider completes before stop, classify it honestly as a terminal race; do not repeatedly spend calls trying to manufacture a slow response—the deterministic stop matrix remains the binary evidence;
5. create one branch from the persisted SSE assistant Message and verify returned route/detail/parent copy behavior;
6. do not spend live provider calls on every error/edit/regenerate matrix case;
7. cleanup source and branch Conversations and restore preset 3 even if any assertion fails.

Budget: at most two intended provider-generation attempts for the standard live probe. Any retry beyond that requires Alicia's explicit approval.

### 10.3 Live probe PASS evidence

- exact request route/mode and event names, without logging secrets or full personal prompts;
- canonical server Message IDs after reconciliation;
- async token treated as opaque runtime identity only;
- stop result classified as stopped or terminal race, never rewritten;
- branch returns/navigates by exact `conversation_id`;
- ORM cleanup count, preset restoration and closing 8-row baseline.

---

## 11. Binary C1B gate

C1B is PASS only when every applicable item below is evidenced.

### A. Entry and integrity

- [ ] C1A paired checkpoints are exact; Desktop starts with no unexplained delta beyond the reviewed P1B Plan.
- [ ] Outer and backend remain at the pinned clean checkpoints.
- [ ] Real AgentPreset baseline opens and closes at IDs 1–8.
- [ ] Reviewed Plan status authorizes construction.

### B. Runtime architecture

- [ ] One controller owns stream/poll/stop/reconcile lifecycle outside presentation components and Query cache.
- [ ] Persisted Query rows and runtime overlay have distinct identities/ownership.
- [ ] Every event/callback is guarded by run epoch + Conversation.
- [ ] No new dependency or global state store was introduced.

### C. Send and terminal correctness

- [ ] Text send works through SSE and async modes.
- [ ] SSE framing/chunking and polling structured payloads normalize correctly.
- [ ] Done, stopped, error, interrupted, runtime-unavailable and reconcile-error are distinguishable.
- [ ] Unknown/malformed events never corrupt answer content.
- [ ] Every terminal/uncertain outcome reconciles or visibly fails to reconcile.
- [ ] Duplicate dispatch and unsafe automatic retry are prevented.

### D. Recovery and stop

- [ ] Async reload/re-entry uses the same validated token and cursor semantics without duplicate content.
- [ ] Transient polling failures retain recovery state.
- [ ] Stop ordering is correct for SSE and async; accepted stop is not mislabeled terminal.
- [ ] Route changes/unmounts cannot stop or mutate the wrong Conversation.
- [ ] V3 storage keys remain untouched.

### E. Conversation actions

- [ ] Edit/regenerate target exact persisted user IDs and preserve user↔answer association.
- [ ] Regenerate does not duplicate the user Message.
- [ ] Historical truncation is explicitly confirmed, the complete message-query family is rebuilt, and deleted descendants cannot reappear from cache.
- [ ] Branch targets exact persisted assistant ID and navigates only by canonical response `conversation_id`.
- [ ] Ambiguous branch success cannot trigger identity guessing or repeat submission.

### F. UX and scope

- [ ] Composer/mobile/scroll/accessibility matrix passes.
- [ ] Thinking detail is correctly deferred to P1D; no P1D trace/control UI was smuggled in.
- [ ] P1C/P2+ capabilities remain absent/disabled as frozen.
- [ ] V3 remains independently runnable and production-primary.

### G. Regression and cleanup

- [ ] App typecheck/lint/tests and four-package build pass.
- [ ] chat-core tests and V3 lint fingerprint show no regression.
- [ ] Backend focused checks pass with zero backend delta.
- [ ] Controlled live probe stays within budget and is completely cleaned.
- [ ] No generated artifacts, secrets or test logs are tracked.
- [ ] Independent acceptance issues one final `C1B: PASS` line.
- [ ] Alicia approves the Desktop checkpoint commit.

Any unchecked applicable item means C1B FAIL. A provider-completed-before-stop live race is not by itself FAIL when the deterministic stop matrix passes and the race is reported honestly.

---

## 12. Evidence and handoff contract

Construction evidence must contain:

- exact opening Desktop/outer/backend commits;
- changed-file manifest grouped by runtime/parser/storage/UI/docs/tests;
- event DTO and state-transition inventory;
- API routes/body fields actually emitted;
- V4 storage keys and cleanup rules;
- parser/lifecycle/recovery/action/responsive matrix results;
- all command exit codes and numeric test counts;
- V3 lint comparison against C0/C1A fingerprint;
- live probe request budget, terminal classifications and ORM cleanup;
- real DB opening/closing output;
- explicit list of unexecuted or inconclusive checks;
- boundary declaration for P1C/P1D/P2+, backend and outer repositories;
- no quality verdict and no commit before independent acceptance + Alicia approval.

Independent Acceptance owns its harness details and final report. Reviewer suggestions remain advisory and cannot expand this frozen scope without Alicia's approval.

---

## 13. Checkpoint and rollback

### 13.1 Checkpoint

```text
C1A baseline
  + Desktop P1B runtime/parser/storage/UI/docs/tests
  + independent C1B acceptance
  + Alicia-approved Desktop checkpoint
```

Outer stays at `e7dce77`; backend stays at `29368bbf`. C1B requires one Desktop commit ID recorded in the construction/acceptance handback. It does not create another outer or backend commit.

### 13.2 Rollback

- Revert the P1B Desktop commit; never reset or overwrite sibling work.
- Return `/app/chat/:id` to accepted P1A read-only behavior.
- Keep all persisted legitimate Conversation/Message/branch data; rollback is code/exposure only.
- Remove only V4 runtime lease/uncertainty/draft keys if their schema is no longer understood; never touch V3 keys.
- V3 remains the production fallback throughout.
- Acceptance probe data must already be deleted before checkpoint approval.

Rollback is FAIL if it requires changing backend data, removing C1A, altering nginx, or deleting real user history.

---

## 14. Risks and explicit mitigations

| Risk | Required mitigation |
|---|---|
| SSE chunks split JSON/UTF-8 frames | incremental decoder + fragmentation matrix |
| Query cache swallows runtime lifecycle | separate controller and overlay ownership |
| newest-relative offsets shift after new rows | fresh newest-window reconciliation; one tested merge/rebase owner; defer applying while reader is scrolled up |
| route switch receives late events | epoch + Conversation guards |
| stop races with abort/terminal | stop-before-abort ordering; accepted ≠ terminal; reconcile |
| async poll repeats or loses chunks | server event cursor; fresh cursor-0 overlay on re-entry; monotonic validation; no fictitious TTL expiry |
| structured poll payload becomes text | event-kind normalizer; never generic concatenation |
| unknown write outcome causes duplicate send | persisted uncertainty lock; no automatic resend |
| branch malformed success creates duplicates | ambiguous-write lock; no name/max-ID inference |
| edit/regenerate truncates later history invisibly or cache resurrects it | exact role/ID validation + confirmation + complete message-query reset/rebuild |
| P1D leaks into runtime UI | retain event data internally; defer reasoning/telemetry/cache/tool presentation |
| live provider timing makes stop flaky | deterministic stop matrix is binary; live race is bounded corroboration |

---

## 15. Adversarial razor / ablation study

### 15.1 Retained because C1B cannot pass without it

- Two transports: both are frozen P1B ownership rows; polling recovery cannot be proven through SSE alone.
- Separate runtime controller: explicit architecture requirement and necessary for lifecycle isolation.
- Runtime overlay: required to stream before server Message IDs exist without poisoning persisted Query state.
- V4 lease + uncertainty marker: required for reload recovery and duplicate-write safety.
- Terminal reconciliation: backend persists canonical partial/final Messages; frontend overlays are not authoritative.
- Edit/regenerate/branch role-correct actions: regenerate/branch are Roadmap P1B rows; accepted C0 mapping explicitly includes edit with regenerate because they share the same destructive runtime entry point.
- Minimal transport selector: no other approved P1B path can exercise async recovery before P1D controls.
- Narrow contract amendments: current source disproves the stale token/delta/branch wording.

### 15.2 Rejected as unnecessary or outside scope

- Zustand/global event bus: no proved cross-page state need beyond one versioned async lease.
- Background app-wide SSE continuation: backend SSE has no recovery token; pretending otherwise is unsafe.
- Cross-tab atomic lock/BroadcastChannel: adjacent hardening not required by frozen single-user C1B acceptance.
- New backend idempotency key: valuable adjacent design, but requires a separate backend contract and is not smuggled into P1B.
- Branch name/session type UI: not required for traceability and adds a second write/control surface.
- Visible Thinking/telemetry/tool/cache UI: P1D ownership.
- Attachment/audio stubs in composer: P1C should add real capability, not fake controls.
- Real-provider testing of every failure permutation: costly, nondeterministic and inferior to deterministic protocol matrices.
- Backend token-to-Conversation persistence redesign: current frontend can keep exact per-Conversation lease ownership; no approved security/multi-user requirement proves the redesign necessary.

### 15.3 Adjacent improvements recorded but not active

- End-to-end idempotency keys for send/edit/regenerate.
- Backend persistence or Conversation binding for async runtime tokens across process restarts.
- `/app` → `/app/` redirect (P2-01).
- Global/background multi-Conversation run management.

These items require separate approval and must not appear in the P1B patch or C1B tests.

---

## 16. Final plan completion rule

This Plan is ready for construction only after:

1. R1 review findings are incorporated without expanding P1B; F1 TTL wording and F3 destructive-query reset are closed, F2 is resolved by the accepted C0 ownership mapping, and F4 precision notes are incorporated;
2. Alicia approves the reviewed Plan;
3. the status line changes from the review-ready construction lock to an explicit construction authorization;
4. opening baselines remain exact, with no unexplained delta beyond the reviewed Plan.

Until then: do not edit `packages/app`, do not modify backend/outer code, do not run live provider probes, and do not create a P1B commit.
