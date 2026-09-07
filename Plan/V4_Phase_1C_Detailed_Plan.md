# ExoCore V4 — Phase 1C Attachment & Audio Detailed Plan

> **Document type:** P1C executable implementation plan; limited to checkpoint C1C.
> **Status:** **REVIEWED AND FROZEN — CONSTRUCTION LOCKED PENDING ALICIA BUILDER ASSIGNMENT**.
> **Repository:** `ExoCore-Desktop` only. Django and outer-repository production code are read-only.
> **Product authority:** Alicia.
> **Plan / architecture / QC:** `[gpt-5.6-sol / Solaire]`.
> **Source scout:** `Plan/V4_Phase_1C_Source_Scout.md` `[gemini / Alaric]`.
> **Revision review:** state-transition corrections and verification pruning `[model not provided / Astra]`.
> **Desktop baseline:** `12e16f647a7b42760a947641b5dab56af5c1d2fc` (accepted C1B checkpoint).
> **Backend fact baseline:** scout `29368bbf`; planning-time HEAD `c286a84e`. The only relevant-range source delta found is in `engines/model_registry.py`, not the attachment routes/serializers. Construction must recheck current facts.
> **Planning-time known deltas:** untracked scout document in Desktop; unrelated staged backend Plan and modified outer `ExoCoreData` file are pre-existing sibling work and must not be absorbed.

---

## 1. Goal and acceptance intent

P1C completes the two frozen capability rows `attachments` and `audio_record_play` on the accepted V4 canonical Conversation page:

```text
select image/file -> upload -> inspect per-file result -> attach successful IDs to one turn
record WebM/Opus -> preview -> target-gated upload -> send
failed/interrupted audio turn -> retain uploaded ID -> retry without re-upload
persisted message -> image/lightbox, audio playback, or file card
conversation upload list -> remove one user attachment -> preserve row on 409
```

The essential problem is lifecycle ownership, not the number of buttons. Local files, object URLs, upload responses, attachment IDs, microphone resources and chat-run outcomes must remain bound to the exact Conversation and attempt.

### C1C acceptance intent

A user can:

1. select multiple images/files and see upload, success, degraded and failure outcomes per original input order;
2. send text plus successful attachments, or a valid attachment/audio turn with empty text;
3. record, stop, preview, cancel and send a supported WebM/Opus clip, with explicit unsupported/permission/size/target errors;
4. retry a failed or interrupted audio turn using the existing uploaded attachment ID without uploading the clip again;
5. read historical image, audio and file attachments without an empty-text placeholder;
6. play only one message audio item at a time and seek accessibly;
7. remove one user-uploaded Conversation attachment and receive an explicit frozen-cache message on HTTP 409;
8. switch routes without old uploads, recorder callbacks or attachment IDs entering the new Conversation;
9. retain all accepted C1A/C1B behavior and keep P1D/P2/P4 outside this slice.

C1C is a construction checkpoint only. V3 remains production-primary until P1D and unified C1 pass.

---

## 2. Authority and frozen facts

### 2.1 Product authority

1. `Plan/V4_Spec_Freeze_Index.md` §4;
2. `Plan/V4_Master_Implementation_Roadmap.md` §7, §16–§17;
3. `Plan/V4_Phase_0_Baseline/V3_Capability_Ownership.md` rows `attachments` and `audio_record_play`;
4. accepted C1A/C1B plans and checkpoint source;
5. Alicia's explicit decisions.

### 2.2 Implementation facts

1. current Desktop and read-only backend source;
2. `Plan/V4_Phase_0_Baseline/Canonical_API_Snapshot.json` attachment/runtime entries;
3. `ReactSheet.md` §1.2 and §1.7;
4. `Plan/V4_Phase_1C_Source_Scout.md` `[gemini / Alaric]`;
5. V3 behavior as parity evidence, not architecture to copy.

A source/contract conflict is reported before construction. Frontend code must not guess a replacement backend contract.

### 2.3 Wire contract that P1C must preserve

- Upload: `POST /api/agents/conversations/<id>/attachments/`, multipart field `files`; an audio-containing request also requires non-empty `model` and integer `endpoint`.
- Upload result: HTTP 201 means at least one success, including partial success; HTTP 422 means all failed/preflight rejected. Ordered `results` is the sole ownership/success source. Compatibility `attachments`/`failures` may supplement diagnostics but must never reconstruct success when `results` is missing or malformed `[model not provided / Astra]`.
- List: `GET /api/agents/conversations/<id>/attachments/`, bare mixed-source array.
- Audio content: same-origin `GET .../attachments/<attachment_id>/content/`; all invalid, foreign or non-audio cases remain indistinguishable 404.
- Delete: `DELETE .../attachments/delete/` with exactly one `{source,id}`; 204 succeeds; 409 with `frozen_in_cache:true` remains visible and does not remove the frontend row.
- Chat send: JSON `pending_attachments: number[]`; non-empty IDs make empty `content` legal. Current backend regeneration/edit does not associate newly pending attachments with the edited historical Message, so P1C must not claim that behavior.
- Message history: `attachments_meta[]` supplies `file_uri` for image presentation and same-origin `content_url` only for audio playback.
- Successful single delete also detaches that attachment ID from historical Messages; frontend list, history, composer and recovery references must converge after 204.
- Audio preflight allowlist: `audio/webm;codecs=opus`, then `audio/webm`; maximum 10 MiB.

---

## 3. Scope boundary

### 3.1 Allowed P1C work

- Typed attachment DTO validation and upload/list/delete adapters local to V4 Chat.
- Compose selection through explicit image/file controls.
- Per-input upload status: uploading, `ok`, `ok_degraded`, failed; diagnostics remain visible and successful IDs alone qualify for send.
- Conversation- and batch-bound upload guards, request abort on route departure, and object-URL cleanup.
- `pending_attachments` integration with the accepted C1B SSE and async send paths.
- Empty-text sends only when at least one successful attachment ID or a valid recorded audio clip is present.
- A narrow manager for **user-uploaded Conversation attachments** so the frozen single-delete/409 behavior remains reachable. Mixed `tool_collection` rows may be parsed but are not exposed as P1C project-file controls.
- MediaRecorder hook, target capability gate, recorded preview/cancel, 60-second cap and audio recovery.
- Historical image thumbnail/lightbox, audio player, and metadata-only file card.
- Focused docs corrections only if current source disproves the frozen attachment contract.

### 3.2 Explicitly excluded

- Model/endpoint selector, Thinking control, cache controls, cache creation/rebuild UI, private memory, session-history controls, Aura and `AssistantRunTrace` — P1D.
- Project file browser, manual server-path mounting, `@[path]` autocomplete and `tool_collection` management — P1D/P2.
- Collection/bookmark/promotion, durable asset management, transcript generation or legacy `.webm` migration — P4 or later.
- Download promises for file cards when the contract exposes no stable same-origin document content URL.
- New upload protocol, chunking protocol, resumable file upload, client-side transcoding, waveform analysis or speech-to-text.
- Global attachment store, cross-tab synchronization, offline upload queue, drag-and-drop redesign or new dependency.
- Backend, nginx, launcher, PWA identity or V3 implementation changes.

### 3.3 Clarifications that prevent accidental scope growth

- “Remove from composer” means omit that item from the pending turn. It does not silently issue backend deletion; an upload may already exist and remains manageable through the user-attachment list.
- “Delete attachment” is the existing single unlink operation, not bulk deletion and not filesystem deletion.
- File cards display safe metadata only; `storage_path` is never rendered, logged or used as a URL.
- P1C resolves the current automatic target only to validate/upload audio. It does not expose a target picker. If no valid direct audio target resolves, the microphone is unavailable with a concise reason; text and file attachment flows remain usable.
- P1C does not promise “async chunked upload”: the frozen endpoint is one multipart request. Upload progress is state-level, not byte-level.

---

## 4. Mandatory source reading before construction

Construction re-reads and records drift in these surfaces before editing.

### Accepted V4 foundation

- `packages/app/src/features/chat/{ConversationPage,ChatComposer,MessageTimeline}.tsx`
- `packages/app/src/features/chat/{api,queries,types}.ts`
- `packages/app/src/features/chat/runtime/{client,types,useChatRuntime}.ts`
- `packages/app/src/styles/{base,shell}.css`
- current `packages/app/src/test/` suites, including Acceptance-owned files as read-only
- `packages/shared/src/api.{js,d.ts}`, `models.js`, `endpoints/config.js`

### V3 parity evidence

- `packages/chat-core/src/utils/{attachmentStorage,audioRecoveryMachine,audioPlaybackManager}.js`
- `packages/chat-core/src/hooks/useAudioRecorder.js`
- `packages/chat-core/src/components/chat/{ComposeAttachmentItem,AudioComposeBar,RecoverableAudioItem,AudioPlayerBubble,MessageBubble,ChatArea}.jsx`
- directly corresponding V3 tests

### Backend read-only truth

- `../ExoCore/agents/urls.py`
- attachment upload/list/content/delete views in `../ExoCore/agents/views.py`
- `../ExoCore/memory/serializers.py` attachment metadata
- target resolver and model-catalog response sources used by audio preflight
- directly coupled existing backend tests

If current backend source has changed the request fields, diagnostics, 409 meaning, audio allowlist or content authorization after the scout baseline, stop and report the exact delta. Do not edit Django from this repository.

---

## 5. Architecture and state ownership

### 5.1 Ownership split

```text
Attachment coordinator
  selected File objects + per-input upload results
  upload abort/epoch + local preview URLs
  user-attachment list/delete state

Audio recorder + pure recovery machine
  microphone/MediaRecorder resources + recorded Blob URL
  conversation-bound uploaded audio IDs
  done/error/retry/abandon transitions

Existing C1B runtime controller
  one chat write + SSE/poll/stop/reconcile safety
  pending_attachments serialization
  narrow attempt outcome signal for audio recovery

Timeline presentation
  canonical attachments_meta only
  lightbox and playback UI
```

Uploads and media APIs must not move into `MessageTimeline` or the C1B transport parser. Conversely, the attachment coordinator must not create a second send/stop/reconciliation controller.

### 5.2 Suggested file boundary, not a file-count mandate

Keep work under `packages/app/src/features/chat/`:

- `attachments/` — DTOs/adapters, one compose coordinator/surface, historical renderer, and narrow user-attachment manager;
- `audio/` — recorder hook, pure recovery machine, playback manager, compose/recovery surface and player;
- extend existing `runtime/client.ts`, `runtime/types.ts`, `useChatRuntime.ts`, `ChatComposer.tsx`, `ConversationPage.tsx`, `MessageTimeline.tsx` and V4 CSS.

Merge small presentation files when that improves clarity. Do not reproduce the scout's proposed file tree mechanically. A minimal adjacent `exo-shared/models` declaration is allowed only if strict TypeScript cannot consume the verified shared resolver otherwise; runtime shared behavior must not be forked.

### 5.3 Compose attachment state

Each selected input has a stable client ID and exactly one visible state:

```text
uploading
ok             + positive attachment ID
ok_degraded    + positive attachment ID + warning diagnostics
failed         + no attachment ID + safe error diagnostics
```

Rules:

- map results by validated `input_index`, never filename or array-position guesses after mutation;
- missing, duplicate or malformed result ownership becomes an explicit failed/contract state;
- failed entries remain removable and never enter `pending_attachments`;
- while any retained entry is uploading, turn submission is disabled rather than racing a late result;
- request completion checks batch epoch + Conversation ID before writing UI;
- route change aborts in-flight client requests, clears compose entries, revokes previews and ignores late responses;
- removing an entry prevents later callbacks from resurrecting it;
- accepted **ordinary** chat dispatch transfers only successful IDs and clears compose UI according to the existing C1B accepted-write rule; edit/regenerate never consumes or clears newly selected compose attachments.

### 5.4 Audio target and recorder

- Fetch the live model catalog through the existing same-origin API.
- Resolve the current Conversation preset's `default_model` with the existing shared `resolveInitialSessionTarget()` behavior `[gemini / Alaric]`.
- Validate the resolved model has `audio` ability and endpoint has `file_uri` attachment transport.
- Catalog/preset load failure, null endpoint, unsupported/managed target or malformed catalog disables recording with explicit, retryable target status. It does not introduce selection UI.
- Recorder preflight order and cleanup preserve AUD-F: secure context; `getUserMedia`; supported MediaRecorder MIME; epoch guard; zero-byte rejection; 60-second stop; track and object-URL release on cancel/error/unmount.
- Recorded Blob is uploaded only when Send is requested, with `model` and `endpoint`. Size is checked before network dispatch.

### 5.5 Audio recovery and C1B integration

The recovery item is one small immutable attempt snapshot, not a second runtime. It retains the Conversation ID, attempt key, original text, the complete ordered attachment-ID set (ordinary files plus audio), the audio-ID subset, and the reconciled persistence status/exact user Message ID when known `[model not provided / Astra]`.

- Create the snapshot after all required uploads succeed and before chat dispatch. The first attempt sends its full text/ID set through the existing C1B write-safety path.
- Only an explicit `done` terminal with no runtime error clears recovery automatically.
- `error`, stopped, interrupted EOF, unknown write, reconciliation failure or safe chat rejection retains the snapshot, but retention does not imply that Retry is enabled.
- Canonical reconciliation classifies the attempt as exactly persisted, proven not persisted, or unknown. Bind an exact user Message only when that row demonstrably carries the attempt's attachment IDs; never infer it from latest position, timestamp or text.
- One-click Retry is enabled only after the runtime is safely unlocked and one of these conditions holds:
  1. **proven not persisted:** submit the original text and complete ID set as one ordinary send;
  2. **exactly persisted with no later user-authored turn on the active canonical branch:** reuse the original text/IDs and exact `edit_message_id`, replacing the failed turn and its following failed assistant output.
- If persistence is unknown, binding is ambiguous, or a later user-authored turn exists, one-click Retry stays disabled with a concise reason. The user may deliberately use the existing explicit edit flow, which truthfully warns/retains its destructive truncation semantics.
- Every retry resets prior done/error flags and makes **zero audio upload requests**.
- Abandon clears only this local snapshot; it does not pretend to delete backend attachments.
- Route change clears recovery and recorded media locally so old IDs cannot enter the new Conversation.
- C1B's durable operation lock remains authoritative. Audio retry/abandon cannot bypass an active, uncertain, stopping or reconciliation lock.

The runtime may expose one narrowly scoped, attempt-keyed outcome/persistence classification needed by this machine. It must not expose parser internals or add a parallel terminal state model.

### 5.6 Timeline, lightbox and playback

- Replace only the attachment `P1C 开放` chip; retain the P1D reasoning chip.
- Render attachments only from canonical `attachments_meta`; do not infer metadata from IDs.
- Audio uses same-origin `content_url`, never remote `file_uri`.
- Images use validated `file_uri`; load failure remains visible with filename fallback.
- Other files use a non-clickable metadata card unless a verified usable URL exists.
- Pure attachment/audio messages do not render `（空消息）`.
- Lightbox uses the accepted modal accessibility pattern: labelled close, Escape, focus containment/restoration and backdrop close without accidental image click close.
- Playback has one module-level manager. Starting one item pauses the previous item; pause/end/error/unmount releases ownership.
- Seek supports pointer and keyboard interaction with an accessible slider/control label. Fixed decorative bars are acceptable; waveform analysis is not required.
- Delete is disabled while the C1B operation is active/uncertain or the target attachment is involved in a pending upload transition. The exclusion is bidirectional: while a delete request is unresolved, ordinary send and audio recovery retry are disabled, reusing existing operation state rather than adding another lock framework `[model not provided / Astra]`.
- On 204, immediately remove the deleted ID from compose and recovery state—retiring any now-incomplete retry entry—**before** invalidating/refetching the attachment list and canonical message history. A refresh failure remains visible but must never restore or resend the already deleted ID `[model not provided / Astra]`.
- On 409, mutate none of the list, history, compose or recovery state; show the frozen-cache guidance only. Other failures likewise retain canonical state.

---

## 6. Implementation tasks

### Task 0 — Preflight and scope pin

1. Confirm accepted Desktop C1B checkpoint and record all pre-existing deltas/hashes.
2. Confirm current outer/backend HEADs and record unrelated dirty files without touching them.
3. Run the real AgentPreset baseline script and require IDs 1–8.
4. Re-read §4, compare backend attachment surfaces against scout `29368bbf`, and record relevant drift.
5. Keep construction locked until this Plan is reviewed and Alicia authorizes it.

### Task 1 — Typed wire adapters

1. Define only DTOs needed for authoritative upload `results`/diagnostics, attachment list rows, target catalog and delete errors.
2. Implement multipart upload with CSRF/credentials and full 201/422 body preservation.
3. Validate `results` ownership and positive attachment IDs before exposing success. Compatibility fields may enrich a matching failure message but never salvage a missing/malformed result.
4. Implement list and single-delete adapters; preserve 409 body fields and successful 204 handling.
5. Extend chat body construction with optional `pendingAttachments`, serialized as `pending_attachments` only after integer/positive validation.
6. Do not amend frozen docs unless source comparison proves a mismatch.

### Task 2 — Compose attachment lifecycle

1. Add image selection and general file selection entry points to the existing composer.
2. Add one coordinator for batch epochs, upload states, successful IDs and object-URL cleanup.
3. Render the four explicit states and safe diagnostics.
4. Implement remove-from-turn semantics and route-switch isolation.
5. Add a narrow user-uploaded attachment manager with list/retry/delete and explicit 409 presentation; disable destructive actions under the existing runtime uncertainty lock and do not expose server paths or project-file operations.
6. Reuse existing operation state for bidirectional exclusion: unresolved delete blocks ordinary send/retry; active/uncertain send blocks delete. On 204, purge the ID locally before refreshing list/history; refresh failure cannot restore it. On 409 or delete failure, mutate none of those states.

### Task 3 — Recorder, target gate and recovery primitives

1. Implement the AUD-F recorder hook and stable user-facing error mapping.
2. Resolve and validate the automatic current target without adding P1D controls.
3. Implement the pure Conversation-bound audio recovery snapshot/machine, including original text, complete attachment IDs, persistence classification and later-turn retry guard; implement the separate global playback manager.
4. Add recording/recorded/error compose UI and recoverable-audio retry/abandon UI.
5. Ensure unsupported target blocks only recording/audio upload, not text or ordinary file attachments.

### Task 4 — Integrate one turn with C1B runtime

1. Change the runtime send interface from text-only input to the minimum typed turn input containing content and validated attachment IDs.
2. Preserve the actual backend edit/regenerate boundary `[model not provided / Astra]`: existing historical attachments stay with the edited Message, while newly selected compose attachments are neither sent nor consumed by edit/regenerate. They remain Conversation-scoped for the next ordinary send.
3. Permit empty text only when a valid pending attachment/audio ID exists.
4. Keep send disabled during retained uploads or an unresolved delete, and prevent duplicate dispatch across click/Enter/audio Send/retry.
5. Connect attempt-keyed terminal outcomes and canonical persistence classification to audio recovery without weakening C1B operation/storage/reconciliation invariants. Do not enable one-click retry across a later user turn or an unknown/ambiguous write.
6. Show an honest optimistic attachment summary for accepted pending turns; never fabricate persisted attachment/message IDs. Revoke any transferred local preview URL at reconciliation, route departure or teardown.

### Task 5 — Historical rendering and playback

1. Replace the timeline placeholder with image/audio/file renderers.
2. Add accessible image lightbox and image-load fallback.
3. Add audio load/play/pause/end/error, keyboard seek and mutual exclusion.
4. Keep message actions and scrolling behavior from C1B intact.
5. Use only V4 `--app-*` styling; no V3 class/token copy.

### Task 6 — Verification, evidence and handoff

1. Run focused typecheck/lint/tests, then app and monorepo regression commands in §7.
2. Recheck the backend contract read-only. Run a narrowly identified backend test only if source/contract drift leaves a concrete doubt; it is not a blanket P1C gate `[model not provided / Astra]`.
3. If shared package runtime code changes, run the affected workspace regression explicitly; a declaration-only addition still receives type/build coverage.
4. Execute deterministic browser checks for route races, MediaRecorder lifecycle, partial upload, 409 and playback mutual exclusion.
5. After deterministic gates pass and Alicia authorizes any provider spend, execute the bounded live probe in §8.
6. Write `Plan/V4_Phase_1C_Construction_Evidence.md` with exact manifests/counts/omissions; stop before independent acceptance or commit.
7. Re-run the real DB baseline and verify probe cleanup.

---

## 7. Verification targets and interfaces

No raw test implementation is frozen here. Construction and Acceptance may choose independent mechanics but must prove these observable outcomes.

### 7.1 Commands

From `ExoCore-Desktop`:

```bash
pnpm --filter exo-app typecheck
pnpm --filter exo-app lint
NODE_OPTIONS=--no-experimental-webstorage pnpm --filter exo-app test:run
pnpm --filter exo-app build
pnpm --filter exo-chat-core test:run
pnpm build
pnpm --filter exo-chat-core lint
pnpm --filter exo-chronicle lint
pnpm --filter exo-council lint
git diff --check
git diff --cached --check
```

Use the Node storage flag only if the existing Node 25/jsdom collision still reproduces; record the environment exactly. Expected: app checks pass, all four packages build, V3 tests do not regress, and V3 lint adds no issue beyond the accepted known-dirty fingerprint. No dependency or lockfile change is expected.

From `../ExoCore`, the mandatory read-only database-discipline check is:

```bash
bash .agent/check_real_db_baseline.sh
```

P1C is frontend-only, so blanket Django checks, migration checks and unspecified backend suites are not hard gates. Construction verifies the coupled backend contract from source; it runs a narrowly identified existing backend test only when a concrete contract doubt remains and records why. If runtime code under `packages/shared` changes, add focused regressions for every importing workspace identified by repository search.

### 7.2 Upload/result matrix

Prove:

- one and multiple file selection and cancelled picker;
- 201 all-success, 201 partial success and 422 all-failure;
- ordered authoritative `results` ownership and malformed/missing/duplicate result handling;
- compatibility fields may enrich matching diagnostics but cannot reconstruct a success or override `results`;
- `ok_degraded` remains sendable and visibly warned;
- only positive successful IDs enter `pending_attachments`;
- pending upload blocks send; removed entry cannot reappear after completion;
- route change/abort/late response cannot mutate another Conversation;
- all object URLs are eventually revoked.

### 7.3 Send/runtime matrix

Prove both SSE and async request bodies for:

- text only: no `pending_attachments` field regression;
- text + file IDs;
- attachment-only and audio-only with empty content;
- failed-only/blank and uploading/blank remain blocked;
- edit/regenerate preserve original historical attachments but neither send nor consume newly selected compose IDs; those IDs remain for the next ordinary send;
- accepted, safe rejection, unknown write, done, error, stopped, EOF interruption and reconciliation failure preserve the existing C1B safety behavior;
- repeated click/Enter/audio Send yields at most one chat POST.

### 7.4 Recorder/recovery matrix

Prove:

- insecure context, missing media APIs, MIME unsupported, permission denied, no microphone and recorder error are explicit;
- MIME priority, 60-second stop and 10 MiB preflight;
- cancel/unmount/route switch releases tracks and prevents delayed callbacks from reviving a clip;
- zero-byte recording is rejected and object URLs are revoked;
- supported audio upload includes exact resolved `model` and integer `endpoint`;
- unresolved/unsupported target sends zero audio upload/chat requests;
- first upload success snapshots original text, complete ordered attachment IDs, audio IDs and attempt identity before chat dispatch;
- error/stopped/interruption preserves recovery; only clean `done` clears it;
- reconciliation classifies exact persistence, proven absence or unknown without positional/text guessing;
- proven-absent retry restores the complete original turn with zero second audio uploads;
- exact persisted retry is enabled only with no later user turn, reuses the complete snapshot and replaces that failed turn;
- unknown/ambiguous persistence or a later user turn disables one-click retry and explains the explicit-edit alternative;
- recovery from Conversation A is unavailable in Conversation B.

### 7.5 Rendering/delete matrix

Prove:

- image opens/closes an accessible lightbox and has a load-failure fallback;
- audio uses `content_url`, surfaces 404/load/play failure, seeks, and mutually excludes playback;
- file card shows safe name/type/size only and never `storage_path`;
- pure attachment/audio message has no empty-text placeholder;
- attachment manager exposes only user-uploaded rows in P1C;
- delete emits the exact `/delete/` route and one `{source,id}` body;
- active/uncertain runtime or a pending target transition disables delete; once delete begins, an immediate ordinary send/retry emits no chat POST until delete settles;
- on 204, local compose/recovery references are purged before canonical history/list refresh; even if that refresh fails, the deleted ID remains absent and cannot be sent;
- 409 changes no list/history/compose/recovery state and displays backend-safe guidance; 400/404/network failure likewise retain state and remain visible/retryable.

### 7.6 Responsive/accessibility matrix

At CSS widths 320, 390, 767 and 768+:

- selected items, recorder, recovery banner and toolbar remain reachable without horizontal overflow;
- touch removal controls do not rely on hover;
- upload/record/play states are not color-only;
- picker/microphone/send/lightbox/player/delete controls have stable labels;
- lightbox focus/Escape behavior and playback keyboard seek work;
- timeline remains the one scroll owner and C1B near-bottom behavior does not regress.

### 7.7 Scope-preservation sweep

Prove no P1C patch contains:

- model/endpoint selector or cache-send button;
- project path mount, project browser or `@[path]` behavior;
- Collection/transcript/STT logic;
- byte-progress/resumable-upload claims;
- V3 visual tokens/components imported into V4;
- backend/outer/deployment/PWA changes;
- new silent catches on attachment/media paths.

---

## 8. Controlled live browser probe

The live probe corroborates integration; deterministic matrices remain the binary evidence for races and failures.

### 8.1 Data discipline

- Opening/closing AgentPreset baseline is exactly IDs 1–8.
- Reuse only archived preset 3 or 4; snapshot and restore every changed field and `is_visible=false` in guaranteed cleanup.
- Never create/delete an AgentPreset or alter a primary key.
- Create one uniquely named temporary Conversation and delete it plus Messages/attachments through Django ORM after evidence capture.
- No bare SQL, real user Conversation, secret logging or committed browser artifacts.

### 8.2 Bounded path

After deterministic PASS:

1. open the actual production-built V4 route in a real browser;
2. select one tiny image and one tiny document, then record one short clip; verify all compose states and the target gate;
3. send them in one mixed attachment/audio turn, using at most **one** short generation attempt and only after Alicia explicitly authorizes it; verify canonical image/file rendering and same-origin historical audio playback;
4. verify ordinary user-attachment delete with a disposable attachment;
5. do not manufacture live 409/cache, network interruption, stop race or unsupported-browser cases; deterministic evidence owns them;
6. clean all temporary rows/files and restore the archived preset even after failure.

If provider use is not authorized, report the live audio-send omission explicitly; C1C remains pending unless Alicia approves a narrow re-baseline.

---

## 9. Binary C1C gate

C1C is PASS only when every applicable item is evidenced:

### Entry/integrity

- [ ] C1B checkpoint is exact and no sibling delta is absorbed.
- [ ] Current backend attachment contract matches or an approved correction exists.
- [ ] Real AgentPreset baseline opens/closes at IDs 1–8.
- [ ] Reviewed Plan explicitly authorizes construction.

### Attachment lifecycle

- [ ] Per-input 201/422 outcomes are correctly owned and visible.
- [ ] Only successful/degraded positive IDs are sent.
- [ ] Upload/remove/route races cannot cross Conversation boundaries.
- [ ] Single delete is bidirectionally lock-gated; 204 purges local sendable references before refresh (including refresh failure), and 409 mutates none, without exposing P1D project controls.

### Audio lifecycle

- [ ] AUD-F recorder, target gate, size/MIME limits and resource cleanup pass.
- [ ] Audio upload carries exact target fields.
- [ ] Failed/interrupted/stopped audio retains the complete original turn snapshot; clean done clears it.
- [ ] Retry makes zero duplicate audio upload, restores all original text/IDs, replaces an exact persisted failed turn only when no later user turn exists, and remains disabled for unknown/ambiguous/destructive cases.
- [ ] Historical audio is same-origin, explicitly fallible and mutually exclusive.

### Runtime/rendering

- [ ] SSE and async serialize `pending_attachments` without C1B regression.
- [ ] Attachment-only/audio-only empty-text turns work; invalid blank turns do not.
- [ ] Images/lightbox, audio and file cards render from canonical metadata.
- [ ] Edit/regenerate preserve original historical attachments and leave newly selected compose attachments for a later ordinary send.
- [ ] C1B operation lock, reconciliation, branch, scroll and route safety remain intact.

### Quality/scope

- [ ] App checks, four-package build and V3 regression pass; any concrete backend-contract doubt is resolved by a focused source/test check.
- [ ] Responsive/accessibility matrix passes.
- [ ] No new dependency, backend change, P1D/P2/P4 feature or server-path leak entered the patch.
- [ ] Controlled probe is complete or Alicia has explicitly re-baselined its omission.
- [ ] Independent acceptance issues `C1C: PASS` and Alicia approves the checkpoint commit.

Any unchecked applicable item means C1C FAIL.

---

## 10. Evidence, checkpoint and rollback

Construction evidence records:

- exact opening Desktop/outer/backend commits and dirty manifests;
- changed files grouped by adapters/state/runtime/UI/styles/tests/docs;
- upload and audio state transitions;
- actual routes, form fields and chat bodies emitted;
- result/recovery/render/delete/responsive matrix outcomes, including edit attachment retention, later-turn retry lockout and 204 cross-surface convergence;
- command exit codes and numeric test counts, plus rationale for any conditional backend/shared-package regression;
- live probe budget, omissions, ORM cleanup and opening/closing DB baseline;
- explicit P1D/P2/P4/backend/outer exclusions;
- no Builder quality verdict and no commit before independent acceptance plus Alicia approval.

Checkpoint:

```text
accepted C1B
  + Desktop-only P1C attachment/audio implementation and tests
  + independent C1C acceptance
  + Alicia-approved Desktop commit
```

Rollback reverts only the P1C Desktop commit and returns V4 to the accepted P1B text runtime. It does not delete legitimate user attachments/messages or alter V3/backend/deployment. Probe data must already be cleaned. V3 remains production-primary.

---

## 11. Adversarial razor / ablation study

### Retained because C1C cannot satisfy its frozen capability rows without them

- Ordered 201/422 handling: partial upload behavior is the attachment contract.
- Conversation/batch epochs and resource cleanup: required by P0-R11 and browser resource safety.
- Automatic target resolution: audio upload requires target fields while selector ownership remains P1D.
- Pure audio recovery snapshot and one runtime outcome/persistence bridge: duplicate upload and duplicate/destructive turn prevention are explicit transfer conditions `[model not provided / Astra]`.
- User-attachment manager: the frozen attachment row includes single delete and 409 behavior, but it is deliberately narrower than the V3 mixed project/session panel.
- Global playback manager: mutual exclusion cannot be guaranteed independently inside each bubble.
- Accessible lightbox/player states: these are the actual historical image/audio user path, not decoration.

### Removed or rejected from active scope

- Scout-proposed one-file-per-component tree as a mandate; implementation may merge small units.
- Chunked/resumable upload and byte progress; no supporting endpoint exists.
- Drag/drop zone, upload queue persistence, cross-tab coordination and offline replay.
- Client transcoding, waveform extraction, transcript/STT and audio editing.
- Tool-collection/project file management, cache rebuilding and target selectors.
- Stable document download without a verified same-origin URL.
- Live manufacture of 409, interruption and stop races.
- New backend idempotency or attachment cleanup endpoint.
- Backend support for adding new attachments during edit/regenerate; P1C instead preserves original attachments and defers new compose IDs to ordinary send `[model not provided / Astra]`.
- Blanket migration/backend-suite gates and fallback reconstruction from compatibility upload fields.

### Adjacent improvements recorded, not active

- Same-origin non-audio download/content endpoint.
- Resumable large-file upload with byte progress.
- Explicit orphan-upload cleanup policy/API.
- Collection promotion and canonical audio transcript.

**Razor conclusion:** P1C stays limited to the two frozen rows and one canonical Conversation path. It extends the accepted C1B runtime through a typed attachment-ID input and a narrow outcome signal; it does not redesign the runtime, build P1D controls or prebuild Collection.

---

## 12. Plan completion rule

Astra's review findings and final delete-ordering corrections are incorporated without expanding P1C, and the independent acceptance contract pins this reviewed Plan. The P1C scope and gates are therefore frozen.

Construction remains locked until Alicia explicitly assigns/authorizes a Builder and the Builder confirms opening source/contract baselines without absorbing sibling work. After authorization, Construction must not edit this Plan or the Acceptance-owned artifacts, run unapproved provider/live probes, or create a P1C commit before independent C1C PASS and Alicia approval.
