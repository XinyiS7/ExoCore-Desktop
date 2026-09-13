# Message TTS Render Contract — Backend Handoff

> **Document type:** cross-repository product/contract handoff; not backend implementation authorization and not the P2T frontend Detailed Plan.
> **Frontend owner:** `ExoCore-Desktop` P2T.
> **Backend owner:** `ExoCore` B5, to be planned, implemented and accepted in that repository.
> **Product decision:** Alicia.
> **Architecture / QC:** `[gpt-5.6-sol / Solaire]`.
> **Status:** B5 contract request — frontend construction remains blocked until B5 PASS and the accepted contract is recorded in both `ReactSheet.md` files.

---

## 1. Problem and gate status

P2T must add a thin message-level TTS consumer to the accepted V4 canonical Chat. Current backend source does not yet provide that consumer contract:

- `MessageSerializer` exposes no voice projection;
- no message-identity TTS render/status/audio endpoint exists;
- no stable TTS error taxonomy exists;
- no accepted cache identity/invalidation or permission contract exists;
- the current TTS requirement and feasibility documents describe product intent and proposed architecture, but explicitly do not freeze endpoint names;
- the later voice-direction authoring proposal reopens internal authoring details and does not authorize implementation.

The frontend must not infer these missing facts or send canonical text, emotion, target content, profile revision or cache keys. B5 must convert the settled product boundary into one stable frontend-facing contract before the P2T Detailed Plan is released.

The settled product truth is:

> An eligible canonical assistant Message may expose one lazy TTS capability. The client requests a render only by canonical Message identity; the backend owns text projection, voice/profile selection, private direction compilation, cache identity and artifact delivery. TTS remains a presentation derivative and cannot alter or block canonical text Chat.

`[gpt-5.6-sol / Solaire]`

---

## 2. Frozen frontend-visible product behavior

### 2.1 Eligible Message projection

The accepted Message read model must let the frontend determine, without guessing:

- whether a stable voice control may be shown for this Message;
- whether the Agent made a special message-level voice-direction choice;
- whether a reusable playable artifact already exists;
- whether the current artifact is still being generated, if generation is durable across requests;
- whether the current state is unavailable or retryable after failure.

The projection may be flat or nested, but its final shape and nullability must be frozen. At minimum it must preserve the semantics currently discussed as:

- `voice_available`: a control is valid for this canonical assistant Message;
- `voice_directed`: one blind-box marker may be shown;
- `voice_cached` or an equivalent render-state fact: a current valid artifact already exists.

Required eligibility rules:

- only persisted canonical assistant Messages with stable positive identity can be eligible;
- optimistic/runtime overlay rows without Message identity are not eligible;
- user, system/bookkeeping, empty/non-spoken, deleted/truncated and inaccessible Messages are unavailable;
- absence of an active usable voice profile produces a truthful unavailable projection, not a render action that predictably fails;
- malformed or unavailable optional voice projection must never make canonical Message text unreadable.

B5 must freeze whether generation state is embedded in the Message projection or obtained from a separate status resource. The frontend will not combine contradictory sources.

### 2.2 Blind-box privacy

`voice_directed` is one message-level boolean only. Normal Message reads, render responses, status responses, audio responses, SSE/tool events, error payloads and Push/arrival payloads must not expose:

- emotion/direction text;
- target text or sentence identity;
- whole-message versus local scope;
- action/stage-direction content used internally;
- segment or instruction count;
- private tool arguments or resolved voice plans.

The authoring schema may evolve independently. P2T does not depend on whether the backend ultimately uses action cues, sentence IDs, `target="last"`, exact text or another private mechanism. A change to those internals must not require a frontend contract change unless the message-level booleans themselves change meaning.

### 2.3 Lazy action

The render action must:

- address one canonical Message by identity;
- accept no client-provided Message text, emotion, target, profile, seed, cache key or artifact path;
- return or reference the current authoritative render state;
- reuse a valid current artifact rather than generating a second random artifact;
- be safe under repeated clicks, request retries and two clients requesting the same Message concurrently;
- distinguish accepted generation, already playable, retryable failure, permanent unavailability and permission/not-found outcomes;
- never create a new Chat turn or mutate `Message.content`, `attachment_ids`, memory, compaction, embedding or LLM history.

B5 must state whether the first request is synchronous or asynchronous. If asynchronous, it must freeze the status observation mechanism, terminal states, retry timing guidance and whether status survives browser reload.

### 2.4 Render lifecycle

The accepted lifecycle must map unambiguously to the frontend states:

```text
unavailable
idle
queued-or-generating
playable
failed-retryable
```

The backend may use more internal states, but the contract must specify their frontend projection. It must also specify:

- whether an accepted request may return playable immediately on cache hit;
- how the client learns that queued/generating became playable;
- whether duplicate starts return the same render/resource identity;
- whether a failed render can be retried through the same action;
- whether a stale status/resource identity returns not-found, gone, conflict or a new authoritative state;
- whether cancellation exists. If it does not, route departure only stops client observation; it must not be presented as backend cancellation.

No generation percentage is required. The frontend must not fabricate one. The visible progress bar belongs to completed audio playback time, not model generation.

### 2.5 Audio retrieval

The completed state must provide a controlled same-origin resource identity or URL that the V4 app can play with the accepted P1C playback seam.

B5 must freeze:

- the exact retrieval endpoint/resource field;
- authorization and cross-Conversation non-disclosure behavior;
- MIME type and supported browser playback format;
- missing/stale artifact behavior;
- cache headers and whether the resource URL is stable or expiring;
- whether byte ranges are supported or explicitly not supported;
- whether a later profile/content/engine revision makes an old resource inaccessible or merely non-current;
- behavior when the database row exists but the artifact file is missing or corrupt.

The artifact must not appear in `Message.attachment_ids`, `attachments_meta`, Project Files, Collection storage or any user-upload attachment lifecycle.

### 2.6 Cache identity and invalidation

The backend owns the complete cache key. B5 need not expose its internals, but must freeze observable correctness:

- repeated render of an unchanged Message/profile/voice plan/engine revision resolves to the same current artifact;
- any output-affecting change cannot silently serve an obsolete artifact;
- regenerate creates independent Message identity and independent voice state;
- truncate/delete makes removed Message voice resources inaccessible through ordinary authorization;
- future assistant-content edits, if supported, invalidate by canonical content truth;
- profile or engine revision changes have deterministic reuse/invalidation semantics;
- concurrent first renders cannot create conflicting current artifacts or expose partially written files.

The client must never decide cache validity from `created_at`, text comparison or URL reuse.

### 2.7 Permissions and non-disclosure

B5 must use the ordinary authenticated Message/Conversation permission boundary. Required outcomes:

- an accessible eligible Message can be read/rendered/played;
- inaccessible, cross-Conversation and nonexistent identities do not leak existence through distinguishable details unless the existing API policy explicitly permits it;
- a user cannot render an arbitrary historical/non-assistant row by supplying its ID;
- an audio resource cannot be fetched solely because its filesystem path or internal render ID is known;
- voice-profile management is not exposed through P2T unless separately approved.

No change may create, delete or renumber production `AgentPreset` rows. Voice-profile persistence must remain additive and respect the repository's real-database discipline.

### 2.8 Stable error semantics

B5 must freeze a bounded error taxonomy and retry guidance for at least:

- Message unavailable/ineligible;
- Message not found or inaccessible;
- no active/usable voice profile;
- voice runtime offline/unavailable;
- generation rejected or failed;
- generation timeout or still pending;
- artifact missing/corrupt/stale;
- request conflict or duplicate already in progress;
- malformed request and authentication failure.

Each error must identify whether the frontend should:

- hide/disable the control as unavailable;
- preserve the control and offer retry;
- continue observing an existing render;
- refresh canonical Message projection;
- stop without retry.

Human-readable text may accompany a stable code, but the frontend must not parse prose to choose state.

---

## 3. Compatibility and isolation requirements

B5 is additive. It must preserve:

- current Message list/history shape for consumers that ignore voice fields;
- ordinary SSE/async Chat, stop, regenerate, branch and reconciliation semantics;
- Message text, reasoning and `AssistantRunTrace` behavior;
- P1C attachment upload/render/playback/recovery;
- GroupChat and Council independence;
- V3 consumers and current production rollback routes;
- existing attachment audio content endpoints;
- database cleanup and cascade behavior for Message deletion.

TTS failure, worker absence, GPU exhaustion and audio retrieval failure must remain local to that Message voice control. None may create an assistant error Message, fail a completed text turn, clear canonical text or block opening the Conversation.

---

## 4. Minimum accepted frontend-facing contract record

Before B5 PASS, both backend and frontend `ReactSheet.md` must contain the same accepted facts:

1. exact Message projection field names, types, defaults and eligibility semantics;
2. exact render-start endpoint, method, request body and response envelope;
3. exact status/read mechanism and state enum;
4. exact playable completion criterion and resource identity/URL field;
5. exact audio retrieval endpoint and HTTP/cache/range behavior;
6. stable error codes with retryability mapping;
7. authorization/non-disclosure behavior;
8. idempotency/concurrency semantics;
9. cache reuse and invalidation behavior visible to clients;
10. privacy statement for `voice_directed` and prohibited payload fields.

Illustrative names in earlier requirement/report documents are not accepted API facts until this record exists.

---

## 5. Backend acceptance targets

B5 is ready for P2T handoff only when evidence demonstrates:

1. an eligible persisted assistant Message projects available voice state; ineligible/user/empty/inaccessible rows do not expose a usable action;
2. the client can start lazy generation using only Message identity;
3. cache hit returns the existing valid artifact without a second generation;
4. duplicate/concurrent start requests converge on one current render lifecycle;
5. queued/generating reaches one unambiguous playable or failed terminal state;
6. retryable failure can be retried without resubmitting or changing the Chat turn;
7. voice runtime offline/failure leaves canonical Message text and Chat runtime intact;
8. completed audio is authorized, browser-playable and unavailable through attachment APIs;
9. content/profile/plan/engine revision changes cannot silently reuse stale audio;
10. regenerate/truncate/delete preserve Message-identity isolation and remove ordinary access to invalidated renders;
11. normal frontend/network/SSE payloads expose only the approved message-level voice facts, never private direction details;
12. cross-Conversation/inaccessible identity probes do not bypass the ordinary permission boundary;
13. existing attachment audio, ordinary Chat, GroupChat and consumers ignoring voice fields regress cleanly;
14. the final contract and error matrix are synchronized into both `ReactSheet.md` files.

These are verification targets and interfaces only. Backend test implementation remains owned by the separate ExoCore Detailed Plan and acceptance assets.

---

## 6. Frontend release partition after B5 PASS

This section freezes planning boundaries, not source-level steps. The later P2T Detailed Plan should remain segmented so one failure cannot hide another:

### P2T-A — Contract adapter and render lifecycle

- consume the accepted Message projection;
- implement the message-identity render/status client boundary;
- establish per-Message, Conversation-safe lifecycle and retry mapping;
- prove malformed optional voice data cannot break canonical text.

### P2T-B — Voice control and playback

- place one stable control on eligible persisted assistant Messages;
- show idle/generating/playable/failed/unavailable truthfully;
- reuse P1C one-at-a-time playback ownership;
- provide playback time/progress/seek without autoplay;
- show at most one message-level directed blind-box marker.

### P2T-C — Integration and regression

- bind route change, Message refresh, cache hit and stale-artifact recovery;
- preserve scroll/reader/runtime behavior and attachment audio mutual exclusion;
- complete desktop/mobile, loading/error/retry/accessibility and C1/P2 regression;
- update construction evidence and capability ownership without claiming Core C2.

No batch transfers the full P2T capability independently. P2T passes only after A–C pass together. P2C remains the next separately planned phase; P2D remains blocked until P2C PASS and B6 PASS.

`[gpt-5.6-sol / Solaire]`

---

## 7. Non-goals

- Voice authoring tool/schema design, action-cue parsing or sentence-target prototype.
- Exposing emotion, target, scope, segment count or voice-plan internals.
- Automatic playback when a Message arrives or when Push is opened.
- Live voice conversation, microphone turn-taking, interruption or phone calls.
- User-facing acoustic sliders, arbitrary seed selection or voice-profile CRUD.
- Treating TTS as SessionAttachment, ProjectFile, CollectionItem or LLM input.
- Eager generation for every assistant Message.
- A second frontend audio-ownership manager.
- P2C Settings construction or P2D notification/arrival construction.
- Selecting WebSocket/SSE/polling for B6 foreground arrival.

---

## 8. Adversarial razor

### Retained as necessary

- Message-identity-only render action: prevents client text/direction tampering.
- Explicit status/error contract: required to show real generation versus retry state.
- Backend-owned cache identity: the client cannot know profile/plan/engine revisions.
- Controlled audio retrieval and ordinary permissions: filesystem identity cannot be a bearer token.
- Thin blind-box projection: preserves directed-voice value without leaking authoring internals.
- A–C frontend partition: separates transport lifecycle, playback UI and integration regressions while preserving one final P2T gate.

### Rejected from active scope

- Waiting for the internal voice-direction authoring R3 design before freezing the thin frontend boundary: unnecessary; internals can remain private and evolve independently.
- Requiring generation percentages, cancellation or HTTP Range unless the selected backend/runtime contract actually supports them.
- Restoring removed KaTeX/math behavior, refactoring Message markdown, or changing attachment types while adding TTS.
- Building P2D arrival refresh at the same time: it has a different backend gate and later shell dependency.
- New state-management or audio libraries: existing TanStack Query, React state and P1C playback ownership are sufficient unless source evidence later proves otherwise.

**Razor conclusion:** B5 needs only the smallest stable contract that lets V4 request, observe and play one canonical Message derivative safely. Internal authoring sophistication, proactive playback and notification arrival are not prerequisites and must not expand P2T.

---

## 9. Handoff condition

The ExoCore backend agent must first create and obtain approval for a B5 backend Detailed Plan grounded in current `Message`, serializer, Chat persistence/tool-call paths, permissions, file delivery and TTS runtime constraints. Backend production changes remain exclusively in the `ExoCore` repository.

After B5 implementation and independent acceptance PASS, synchronize the accepted interface into both `ReactSheet.md` files. Only then may `ExoCore-Desktop` release the source-level **P2T Detailed Plan**, using the A–C partition above and a fresh read of the then-current frontend source.
