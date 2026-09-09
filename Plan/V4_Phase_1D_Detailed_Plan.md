# ExoCore V4 — Phase 1D Controls, Context & Assistant Run Trace Detailed Plan

> **Document type:** P1D executable implementation plan; limited to checkpoint C1D and the backend trace-contract handoff required by C1D.
> **Status:** **REVISED AFTER INITIAL FORK REVIEW; CONSTRUCTION NOT AUTHORIZED**.
> **Repository:** `ExoCore-Desktop` production changes only. Django and outer-repository production code are read-only.
> **Product authority:** Alicia.
> **Plan / architecture / QC:** `[gpt-5.6-sol / Solaire]`.
> **Source scout:** `Plan/V4_Phase_1D_Source_Scout.md` `[gemini / Alaric]`.
> **Initial fork review:** state-ownership, audio recovery, Project tree and trace-security corrections `[model not provided / fork reviewer]`.
> **Accepted Desktop baseline:** `54e955cbe18eb051cb829793400c042633079c0f` (C1C).
> **Planning-time backend fact baseline:** `bfd775292f5f93c82c24215a2f63fb36b54c426e`.
> **Planning-time outer baseline:** `cf64f42649eda9c7ed4eedc373bde6de5f98d561`.
> **Known Desktop delta:** untracked `Plan/V4_Phase_1D_Source_Scout.md`; unrelated local `.agents/` changes must not be absorbed.

---

## 1. Goal and acceptance intent

P1D completes the remaining frozen canonical Chat capabilities on the accepted C1C page:

```text
open Conversation
  -> inspect compact execution/cache state in the top bar
  -> open a non-reflowing Tactical HUD
  -> choose a valid model + endpoint and thinking level
  -> control cache use, memory injection and full/lite history for the next turn
  -> inspect cache truth, renew or release it with explicit outcomes
  -> choose a conversation-local Aura
  -> browse the bound Project and insert a workspace reference
  -> send through the one accepted C1B/C1C runtime
  -> inspect Thinking and ordered Tool activity in AssistantRunTrace
```

The essential problem is truthful state ownership. Backend state, per-turn target state, local preferences, runtime overlays and purely visual Aura state must not be collapsed into one settings object or duplicated inside the composer.

### C1D acceptance intent

Alicia can:

1. see and change the current turn target without selecting an incompatible or disabled endpoint;
2. persist `thinking_level` with explicit save failure/retry behavior and choose the g045-only private-memory flag for the next turn;
3. choose `full` or `lite`, cache enabled/disabled and SSE/async as correctly scoped local preferences;
4. inspect backend cache state and TTL, renew an eligible active remote cache, or release current cache/snapshot without optimistic fabrication;
5. select or edit a conversation-local Aura without making the message stream or composer jank;
6. open chat-local Project files only for a non-Drift Conversation, browse backend-owned data and insert a safe `@[relative/path]` composer reference;
7. see Assistant Thinking and Tool activity in their real run order, with active `memory_search` represented as an ordinary ToolCall and never as automatic recall;
8. switch routes or targets without old state, requests, trace events or file references entering another Conversation;
9. retain all accepted C1A–C1C behavior and keep P2/P6 outside this slice.

C1D remains a construction checkpoint. Only a later unified C1 acceptance may transfer canonical Chat ownership from V3.

---

## 2. Planning decisions

### D1 — AssistantRunTrace requires an additive backend contract

**Decision:** choose scout path **B**, but do **not** expose `Message.tool_calls` raw. `[gpt-5.6-sol / Solaire]`

Current transport cannot satisfy the frozen product requirement:

- `thinking` is text-only;
- `status` is an untyped human preview and also carries non-tool phases;
- telemetry exposes only a tool count;
- history omits `tool_calls`;
- existing persisted rows cannot reconstruct `Thinking -> ToolCall -> Thinking` order.

Construction must first create `docs/superpowers/specs/V4_P1D_Assistant_Run_Trace_Backend_Handoff.md`. A backend owner must then independently implement and accept an additive, V3-compatible contract that provides:

- an ordered realtime trace event with stable run-local item/call identity;
- tool name, lifecycle (`started | succeeded | failed`), backend-safe argument preview, safe result/error summary and duration when known;
- enough ordering information to interleave Tool activity with Thinking;
- an optional historical Assistant trace projection on Message history;
- explicit legacy/unavailable representation when old rows lack ordering data;
- backend-side sanitization and size bounds; raw tool results, secrets, local absolute paths and unrestricted arguments must not be sent merely because they exist in JSON storage.

The handoff may choose its internal persistence strategy. The frontend-required wire projection and binary behavior are frozen by the handoff, not by guessing Django implementation in this Plan. Existing SSE events and existing Message fields must remain backward compatible for V3.

**Gate:** no C1D PASS, and no claim that active `memory_search` is a structured ToolCall, until this backend contract is independently accepted and reflected in `ReactSheet.md`. The remaining P1D surfaces may be prepared only after Alicia authorizes staged construction; they do not waive this gate.

### D2 — Tactical HUD is a top-bar overlay

**Decision:** the top bar owns a compact read-only state strip plus a labelled HUD trigger. The expanded HUD is an overlay anchored below the top bar on desktop and a focus-managed top sheet on mobile. It overlays rather than reflows the message stream or composer. `[gpt-5.6-sol / Solaire]`

The composer loses the transport selector once the HUD owns it. Project files remain a separate right drawer on desktop and a full-width/bottom-safe sheet on mobile; they are not embedded into the HUD.

### D3 — Aura uses a reduced CSS layer, not Canvas

**Decision:** preserve the V3 OKLCH palette meaning, built-in light/dark palettes, conversation selection and at most three custom palettes, but replace nine blurred ribbons with at most three isolated gradient layers animated only by transform/opacity. `[gpt-5.6-sol / Solaire]`

No Canvas runtime, render loop or dependency is justified. `prefers-reduced-motion` produces a static field; unsupported/low-capability presentation remains a static gradient. Aura is decorative, pointer-inert and never becomes a scroll owner.

### D4 — Cache renew is included

**Decision:** include explicit renew because the frozen ownership row requires cache status, renew and delete. `[gpt-5.6-sol / Solaire]`

Renew is offered only when the backend reports an active cache for a remote-capable state. HTTP 409/404/network errors remain visible and do not alter displayed truth until refetch. Release handles the current backend DELETE semantics; it must not promise permanent deletion because the backend may rebuild a snapshot asynchronously.

### D5 — Invalid/dead V3 controls are retired

- No `temperature` UI or request field: current canonical serializers/chat path do not support it truthfully.
- No `galatea_mcp` field.
- No `session_id` read.
- No branch `session_type`: current branch contract accepts only `branch_from_message_id`; session history remains a per-chat-turn preference.

---

## 3. Authority and corrected source facts

### 3.1 Product authority

1. `Plan/V4_Spec_Freeze_Index.md`;
2. `Plan/V4_Master_Implementation_Roadmap.md` §7, §16–§17;
3. `Plan/V4_River_Collection_Memory_Interaction_Spec.md` §6–§7;
4. `Plan/V4_Page_Skeleton.md`;
5. P0 capability ownership rows 26, 29–34 and 54;
6. Alicia's explicit decisions.

### 3.2 Implementation facts

1. current Desktop/backend source and accepted C1C checkpoint;
2. `ReactSheet.md` and the P0 canonical snapshot;
3. source scout `[gemini / Alaric]`;
4. V3 behavior as parity evidence, not architecture to copy.

### 3.3 Planning-time corrections to scout/legacy assumptions

Current source establishes:

- model catalog is `GET /api/core/model-catalog/`, not `/api/config/models/`;
- Project tree is `GET /api/core/projects/<id>/tree/?path=...`, not `/directory/`;
- `Conversation.session_type` was removed; `session_type` is per request and is not returned by `ConversationSerializer`;
- branch accepts only `branch_from_message_id` in the canonical contract;
- shared already contains `getCacheStatus`, `renewCache` and `deleteCache`, although V4 still needs strict typed validation;
- cache GET may omit TTL fields when inactive; DELETE exists in current backend source even though `ReactSheet.md` §1.6 currently under-documents it;

Any reviewer suggestion that changes these facts or expands P1D must be recorded separately for Alicia rather than silently entering construction.

---

## 4. Scope boundary

### 4.1 Allowed P1D work

- Typed V4 adapters and TanStack Query owners for catalog, Conversation preference patch, cache, Project detail/files/tree and accepted trace DTOs.
- Conversation-local target state (`model`, `endpoint`) initialized from the current preset and live catalog.
- Persisted `thinking_level`; conversation-local g045-only memory injection flag, stored as a local preference and defaulting to enabled.
- Conversation-local `cache_enabled`, `session_type` and Aura selection; global transport preference; global custom palette library capped at three.
- Cache status/countdown/30-second calibration, renew, release and `cache_skipped` notice.
- Runtime body integration for target, memory, cache and session history fields across SSE and async ordinary/edit/regenerate sends where the backend accepts them.
- Compact top-bar state strip, overlay Tactical HUD and responsive Project files drawer.
- Workspace tree browsing, cursor-aware `@` autocomplete, `@[path]` chips/insertion and send-time conversion to `@path`.
- Canonical `AssistantRunTrace` with ordered realtime/history Thinking + Tool activity under the accepted backend handoff.
- Focused corrections to `ReactSheet.md` only when current source or the accepted backend handoff proves them.

### 4.2 Explicitly excluded

- Raw `Message.tool_calls` serialization or frontend redaction of sensitive raw results.
- Automatic recall receipt, candidate/injected records, recall scoring/feedback or Recall Lab — P6.
- Project Hub/Detail editing, Project upload/delete/knowledge management or Agent workspaces — P2.
- GroupChat, River, Library/Collection or Settings.
- Temperature, MCP/Drawer credential controls or retired fields.
- Cache creation policy redesign, global cache invalidation by agent name, offline cache control, cross-tab settings synchronization or local cache-truth snapshots.
- File content preview/editor, file upload/delete, arbitrary absolute-path insertion or browser-side filesystem access.
- Canvas/WebGL Aura, audio-reactive effects, FPS instrumentation framework or new visual dependency.
- Backend production edits from this repository.

### 4.3 Clarifications

- Target selection is Conversation-local runtime state, not backend-persisted configuration. Route change initializes a fresh target from the current preset/catalog; V4 does not claim the selection survives reload.
- `thinking_level` is backend truth. Request-affecting controls are disabled during an accepted/uncertain operation so the HUD cannot imply it changed an in-flight run.
- The g045 memory flag is a Conversation-local preference, defaults to `true`, and is sent as an explicit boolean on each g045 chat request. Non-g045 UI is absent and requests omit the field.
- `session_type` defaults to `lite` per Conversation local preference and is sent on each chat POST. It is not patched to Conversation and not added to branch.
- Cache enabled defaults to true per Conversation local preference. Backend GET remains the only cache-instance/TTL truth; no localStorage cache-status mirror is created.
- Uploaded ProjectFile rows are visible references. Only work-directory file paths support `@[path]` insertion because the current ProjectFile DTO does not provide an equivalent workspace-relative path.
- Directory selections navigate/expand; only file selections insert a token.

---

## 5. Mandatory source reading before construction

Construction records drift before editing.

### Accepted V4 foundation

- `packages/app/src/features/chat/{ConversationPage,ChatComposer,MessageTimeline,api,queries,types}.ts*`
- `packages/app/src/features/chat/runtime/{client,events,sse,types,useChatRuntime,storage}.ts`
- P1C attachment/audio target and recovery owners coupled to target or composer state
- `packages/app/src/styles/{base,shell}.css`
- current `packages/app/src/test/`, treating Acceptance-owned suites as read-only
- `packages/shared/src/{models.js,models.d.ts,api.js,api.d.ts}` and relevant endpoint wrappers

### V3 parity evidence

- `ContextCacheIndicator.jsx`, `ControlsDrawer.jsx`, `AuroraBackground.*`, `palettes.js`
- `ChatShell.jsx`, `ProjectFilesDrawer.jsx`, `FileTree.jsx`, `AutocompletePopup.jsx`
- the exact `ChatArea.jsx` paths for request construction, `cleanContentForSend`, telemetry and preference updates

### Backend read-only truth

- `agents/{urls,views,serializers,services}.py`
- `memory/{models,serializers}.py`
- `core/{urls,views,serializers}.py`
- model-catalog/provider resolver sources and focused existing tests
- the accepted AssistantRunTrace backend handoff implementation and contract

Stop and report any relevant drift in request fields, route shapes, cache status/renew/delete semantics, project tree DTOs, memory gating or trace sanitization/order. Do not compensate with guessed frontend behavior.

---

## 6. Architecture and state ownership

### 6.1 Ownership split

```text
ConversationPage coordinator
  current Conversation/preset/project identity
  HUD + project drawer open state
  composes existing runtime, controls, Aura and Project references

Conversation controls hook
  catalog backend truth
  ephemeral model/endpoint target
  PATCH-backed thinking
  local memory/cache/session/transport/Aura preferences

Cache query/control
  backend status truth + expires_at-derived countdown
  renew/release mutations + refetch

Existing C1B/C1C runtime
  the only send/stop/reconcile operation owner
  serializes one frozen dispatch-intent snapshot
  consumes normalized trace/telemetry/cache-skipped events

AssistantRunTrace
  presentation only: ordered runtime projection or canonical history projection
  no transport parsing, recall logic or backend redaction

Project-context query owner
  Project detail + uploaded files + work-directory tree
  drawer/autocomplete consume the same cached DTOs

Aura layer
  pure client visual projection; no runtime/controller ownership
```

No HUD control may create a second operation lock. No trace component may mutate canonical message pages. No drawer may duplicate project fetch state already owned by Query.

### 6.2 Dispatch snapshot

At predispatch, extend the existing immutable `DispatchIntent` with the validated effective values:

- model name and positive endpoint ID;
- thinking level;
- `cache_enabled`;
- `session_type`;
- g045-only `memory_injection_enabled`.

The same captured values must survive storage suspension/retry and feed both SSE and async paths. A later HUD change cannot mutate a pending/recovered POST. If model or endpoint is unresolved, ordinary send and audio upload are blocked with an actionable target message; no partial request is sent.

P1C audio target gating must consume the current selected target rather than independently resolving the preset default. Target protection belongs at the upload boundary `[model not provided / fork reviewer]`:

- before upload, a recorded Blob is target-neutral and remains available when target changes; recalculate capability and block upload with guidance if the new target is unsupported;
- when upload begins, capture the target and disable target changes until upload settles;
- extend the existing `AudioTurnSnapshot` with the captured target and effective P1D control values, so an uploaded-audio retry reuses the original dispatch settings without creating another recovery system.

### 6.3 Query and preference mutation rules

- Server reads rely first on exact Query keys, Query request state and supplied signals. Global catalog data may legitimately complete after a route change and remain reusable; correctly keyed cache/Project responses do not need an additional page-level epoch state machine.
- Cache display and Project/catalog loading/error/stale presentation are derived from Query data and request state. They have no second writable copy. A discriminated view model/union is allowed only as a pure projection.
- Identity checks are reserved for command-like callbacks that would mutate the current draft, insert a path, close an overlay or otherwise act on the current page after an await.
- The thinking control is disabled while its mutation is unresolved, preventing same-field request reordering.
- A definite thinking PATCH rejection retains the confirmed Query value and shows the rejection. A network failure or malformed success is an unknown save outcome: show “保存状态待确认” and refetch the exact Conversation before presenting a confirmed value. Retry remains an idempotent PATCH of the same explicit value.
- A successful thinking PATCH validates the response, updates the exact Conversation Query row and invalidates the conversation/list family only where needed.
- Thinking PATCH uncertainty does not enter the durable chat-operation lease, gain a persisted recovery record or become a second runtime transaction system.
- Local preference storage uses small typed helpers with guarded read/write and explicit fallback. Storage failure keeps the in-memory choice for the current page and shows a non-blocking warning; it does not enter the durable chat-operation lease algebra.

### 6.4 Cache model

Cache presentation is a pure validated projection of Query data and request state, not a separately writable cache state. Its business variants are:

- loading;
- active remote cache with validated `expires_at`, nonnegative `remaining_seconds`, renewals and optional snapshot;
- snapshot only;
- empty;
- unavailable/error while retaining the last confirmed display as stale.

Countdown is derived from confirmed expiry and current time; it never extends TTL locally. Active pages calibrate at most every 30 seconds, pause unnecessary polling when hidden, and refetch after a chat terminal, renew or release. Renew/release are disabled during runtime uncertainty and while their own mutation is unresolved.

`cache_skipped` maps known reasons to concise notices and preserves unknown reasons without inventing support. The notice is not answer content and does not require a new toast dependency.

### 6.5 AssistantRunTrace model

The accepted backend projection is normalized once at the API/runtime boundary into ordered trace items. UI rules:

- default collapsed summary reports only available facts (Thinking present/duration when provided, Tool count, running/failed state);
- expanded view preserves server order and tool lifecycle;
- realtime Thinking may stream as text, but completion reconciles to canonical history rather than retaining a second permanent copy;
- a tool started without a terminal update remains visibly incomplete/interrupted;
- backend-safe summaries are rendered as text/Markdown under existing content safety rules; raw HTML is not trusted;
- legacy messages may show `reasoning_content` and an explicit “tool details unavailable for this historical message”; they may not fabricate order, duration, arguments or success;
- `memory_search` uses the same ToolCall renderer, identified only by the backend tool name;
- no `UserRecallReceipt` placeholder or automatic-memory claim appears in Assistant rows.

### 6.6 Project reference model

- Project queries are enabled only for a positive `conversation.projectId` and while needed by the drawer/autocomplete; Drift issues no Project request.
- Fetch the root tree first and share that Query data between drawer and autocomplete. Expand nodes already present in the recursive root response directly. Only when the user opens a directory shell with no children loaded may the client request that exact `?path=` single level and replace that directory's children immutably. No generic incremental tree synchronizer or reusable filesystem cache framework is introduced. `[model not provided / fork reviewer]`
- Malformed, duplicate, absolute or path-traversing entries are rejected from insertion.
- Inserted token format is exactly `@[relative/path] `. Token extraction is cursor-aware and only activates for the current incomplete `@` token.
- Keyboard behavior stays inside the composer: Arrow keys move options, Enter/Tab selects, Escape closes, IME composition never sends/selects accidentally.
- Before chat dispatch, recognized `@[path]` tokens become `@path`; ordinary text and malformed bracket text remain unchanged. Optimistic content matches the exact submitted text.
- Route/project change closes the drawer/autocomplete and clears stale candidates; it does not erase the user's unrelated draft text.

### 6.7 Aura performance boundary

- At most three composited visual layers; no animated blur/filter values.
- Animation uses transform/opacity with low-frequency timing and becomes more active only while the runtime is genuinely generating.
- `prefers-reduced-motion: reduce` disables motion while retaining the selected palette.
- Aura sits behind the top bar, timeline, overlays and composer; `aria-hidden`, pointer-inert, no focusable descendants.
- Palette parsing validates IDs/colors, caps custom entries at three and falls back to the current light/dark default without crashing on corrupt storage.

---

## 7. Implementation tasks

### Task 0 — Preflight, contract handoff and hard gate

1. Record Desktop/backend/outer commits, dirty manifests and accepted C1C baseline; run the real AgentPreset baseline check.
2. Reconcile current source against §3.3 and correct only proven contract documentation gaps.
3. Create `docs/superpowers/specs/V4_P1D_Assistant_Run_Trace_Backend_Handoff.md` with the minimum additive realtime/history projection, compatibility, sanitization, bounds and binary acceptance targets from D1.
4. Hand the spec to an `ExoCore` owner. Do not edit Django from Desktop.
5. Freeze P1D construction until Alicia authorizes it and the trace contract has an accepted backend checkpoint, unless Alicia explicitly approves a staged non-trace frontend checkpoint that makes no C1D claim.

### Task 1 — Typed control/cache/project adapters

1. Extend V4 domain DTOs only with accepted trace fields required by P1D.
2. Reuse the existing live model-catalog query; strengthen DTO validation needed by selectors rather than forking shared resolver behavior.
3. Add a strict thinking PATCH adapter plus cache status/renew/delete and Project detail/files/tree adapters with explicit malformed/error outcomes.
4. Add stable Query keys, supplied signals and enabled/refetch rules; derive read presentation from Query and do not add a writable mirror or place runtime lifecycle in Query.
5. Keep raw backend/cache/project payloads out of view components.

### Task 2 — Conversation controls and dispatch integration

1. Implement one conversation-controls hook for target and correctly scoped preferences.
2. Initialize target from current preset + catalog; model changes use existing compatibility logic, endpoint choices include only configured/enabled compatible endpoints.
3. Add response-validated thinking mutation with definite-rejection versus unknown-save/refetch presentation; keep it outside chat lease machinery. Add the g045 memory flag to the existing typed Conversation-local preference helpers.
4. Extend `ChatTurnInput`, `DispatchIntent` and transport body construction with the captured P1D fields across SSE and async, including recovery continuations.
5. Feed selected target into P1C audio gating; preserve target-neutral recorded Blobs before upload, lock target during upload, and extend the existing `AudioTurnSnapshot` with original target/control settings for retry.
6. Remove transport choice from `ChatComposer`; retain all compose/send/edit/audio/attachment behavior.

### Task 3 — Tactical HUD and cache control

1. Add the top-bar state strip and labelled HUD trigger.
2. Implement the non-reflowing responsive overlay with focus entry, Escape/backdrop close and focus restoration.
3. Group target/thinking/transport, cache/history/memory and Aura controls without recreating the V3 470-line monolith.
4. Implement cache countdown/status, enable toggle, refresh, eligible renew and release with explicit mutation/error/stale states.
5. Add a small app-local notice surface for `cache_skipped` and local preference storage warnings; do not introduce a global notification framework.

### Task 4 — Aura

1. Port only the verified OKLCH interpolation/palette data needed by V4, with typed storage validation and light/dark fallback.
2. Implement the reduced CSS Aura layer and runtime-generating projection.
3. Add built-in selection, three-keypoint preview and save/update/delete for at most three custom palettes.
4. Ensure theme change, corrupt storage, route change and reduced-motion behavior are deterministic.

### Task 5 — Chat-local Project files and composer references

1. Add Project detail/files/tree Query owners gated by positive Project ID.
2. Add accessible desktop/mobile drawer with loading, empty, work-dir-missing, permission, malformed and retry states.
3. Render uploaded ProjectFile references separately from the work-directory tree; expose no edit/delete/upload action.
4. Add file-only insertion, cursor-aware autocomplete, chips and exact send-time cleanup to the existing composer without adding a second draft owner.
5. Prove drawer/autocomplete requests and callbacks cannot cross Conversation/project boundaries.

### Task 6 — Runtime trace and telemetry

1. Update SSE and polling normalization for the accepted additive trace event; retain legacy event compatibility and nonfatal unknown-event handling.
2. Extend the runtime assistant overlay with ordered trace items and validated telemetry, using the existing pure shared event application boundary.
3. Add one conversation-local telemetry projection for last-turn/session totals; reset on route change and never treat telemetry as persisted history.
4. Implement `AssistantRunTrace`, `ReasoningPanel` and ToolCall presentation outside `MessageTimeline`'s row orchestration.
5. Replace the P1D placeholder for persisted/runtime Assistant rows; reconcile to canonical history after terminal.
6. Show legacy/unavailable trace states honestly and keep automatic recall absent.

### Task 7 — Verification, evidence and handoff

1. Run focused type/lint/tests, then app and monorepo regressions in §8.
2. Execute deterministic browser checks for overlay focus, route races, target/audio coupling, cache countdown/mutations, Aura motion and Project autocomplete.
3. Run only narrowly relevant accepted backend trace tests in `../ExoCore`; no blanket backend suite is a frontend gate.
4. After deterministic PASS and Alicia authorizes provider spend, execute the bounded live probe in §9.
5. Write `Plan/V4_Phase_1D_Construction_Evidence.md` with exact contracts, matrices, command results, omissions and scope exclusions.
6. Re-run the real DB baseline and stop before independent acceptance or commit.

---

## 8. Verification targets and interfaces

No raw test implementation is frozen here. Construction and Acceptance choose independent mechanics but must prove these observable outcomes.

### 8.1 Commands

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

Use the Node storage flag only if the existing Node 25/jsdom collision reproduces; record the exact environment. No dependency or lockfile change is expected.

From `../ExoCore`:

```bash
bash .agent/check_real_db_baseline.sh
```

Run the accepted focused backend trace contract suite named by its handoff evidence. Other Django suites are conditional on a concrete contract doubt.

### 8.2 Target/preference/request matrix

Prove:

- catalog loading/error/retry/malformed states;
- preset default, one compatible endpoint, multiple compatible endpoints and no compatible endpoint;
- disabled/unconfigured/incompatible endpoints never become sendable;
- route switch reinitializes ephemeral target; globally keyed catalog completion remains reusable, while command-like late callbacks cannot alter another page/draft;
- thinking enum and PATCH success, definite rejection, unknown network/malformed outcome, exact Conversation refetch and same-value retry;
- memory control is absent for non-g045; g045 defaults to enabled, persists per Conversation locally and sends the selected boolean on every applicable turn;
- `session_type`, cache enable and transport use their exact scopes and survive only as specified;
- SSE and async bodies carry one immutable captured target/control snapshot through normal send, edit/regenerate and storage recovery;
- no body emits `temperature`, `galatea_mcp`, `session_id` or branch `session_type`;
- unresolved target emits no chat/audio POST;
- an unuploaded recorded Blob survives a compatible target change; an unsupported target blocks upload without deleting the Blob;
- target is locked/captured once audio upload starts, and uploaded-audio recovery reuses the original target/control snapshot with no second upload.

### 8.3 Cache matrix

Prove:

- loading, active, expired, snapshot-only, empty, malformed and network-stale states;
- countdown derives from confirmed expiry, reaches zero and never locally renews;
- at most 30-second active calibration and terminal refetch; hidden/unmounted page cleans timers;
- cache enable is independent from current cache existence;
- eligible renew success refetches; 404/409/network failure retains truth and is actionable;
- release success refetches and describes possible background snapshot rebuild; 404/error is not silently converted to success;
- active/uncertain chat and unresolved cache mutation exclude one another;
- known and unknown `cache_skipped` reasons produce non-answer notices in both transports;
- Conversation A cache state/timers never appear in B.

### 8.4 AssistantRunTrace matrix

Prove against the accepted backend contract:

- interleaved Thinking/Tool/Thinking ordering is identical in SSE and async;
- started/succeeded/failed/incomplete Tool lifecycles, safe previews and duration availability;
- multiple tools retain stable identity and order;
- telemetry tool count is validated as a number and does not substitute for ToolCall details;
- active `memory_search` renders through the ordinary ToolCall path;
- persisted canonical history reproduces the accepted trace projection after reconciliation/reload;
- old rows with reasoning but no structured trace remain readable and explicitly mark Tool details/order unavailable;
- malformed trace items are isolated as protocol warnings and never become answer content;
- terminal error/stopped/EOF leaves partial trace honest;
- the new ToolCall projection contains only backend-allowed, size-bounded preview fields and never passes through the raw tool object; frontend does not implement general sensitive-text detection;
- existing answer/Thinking content continues under existing rendering safety rules and is not scanned or rewritten merely because it may mention a path;
- no automatic Recall Receipt appears;
- trace expansion does not break Markdown, message actions, pagination or near-bottom scroll behavior.

### 8.5 Project files and reference matrix

Prove:

- Drift sends zero Project detail/files/tree requests and has no drawer trigger;
- bound Project loading, no work_dir, empty, permission denied, 404, malformed and retry states;
- root recursive tree is shared by drawer/autocomplete; only an unloaded directory shell triggers an exact-path single-level fetch and child replacement;
- traversal/absolute/malformed paths cannot be inserted;
- uploaded ProjectFile rows are read-only and do not masquerade as work-dir paths;
- file click inserts `@[relative/path] ` at the caret; directory click navigates/expands only;
- `@` query extraction, starts-with/contains matching, 50-result presentation cap, mouse and keyboard selection;
- IME, Enter-to-send, Shift+Enter and Escape do not conflict;
- chips reflect recognized tokens and removing a chip does not corrupt surrounding text;
- send converts only valid `@[path]` references to `@path`, and optimistic/persisted content remains coherent;
- route/project switch closes stale UI and late responses cannot insert into another draft.

### 8.6 HUD/Aura/responsive/accessibility matrix

At CSS widths 320, 390, 767 and 768+:

- top-bar summary and triggers do not overflow or hide canonical navigation;
- opening HUD does not resize the message scroll area or composer;
- HUD/top sheet and Project drawer have labelled close, focus entry/containment/restoration, Escape and safe backdrop behavior;
- request-affecting/destructive controls are disabled under runtime uncertainty; visual-only Aura remains safe;
- at most three Aura layers exist, reduced motion is static, and no layer captures input or creates scroll;
- custom palette cap/corrupt storage/theme fallback work;
- message timeline remains the only message scroll owner; P1C attachment/audio controls stay reachable;
- status is not conveyed by color alone and touch actions do not require hover.

### 8.7 Regression and scope sweep

Prove no P1D patch contains:

- raw backend tool result exposure or frontend-only redaction promise;
- automatic recall/feedback/Lab behavior;
- Project CRUD/upload/delete/editor behavior;
- temperature/MCP/legacy session alias fields;
- second runtime operation lock, second canonical message array or Query-owned streaming lifecycle;
- Canvas/WebGL/new dependency;
- V3 visual token/component import into V4;
- backend/outer/deployment/PWA production changes;
- silent catches on control/cache/project/trace paths.

---

## 9. Controlled live browser probe

The live probe corroborates integration; deterministic matrices own races and failures.

### 9.1 Data discipline

- Opening/closing AgentPreset baseline is exactly IDs 1–8.
- Reuse only archived preset 3 or 4; snapshot/restore changed fields and finish with `is_visible=false`.
- Never create/delete an AgentPreset or alter a primary key.
- Create one uniquely named temporary Conversation bound to a disposable existing Project only if its files are safe to read; otherwise use a temporary Project only with Alicia's explicit authorization and clean it through Django ORM/service rules.
- Delete temporary Conversation/messages through Django ORM and restore all reused records in guaranteed cleanup.
- No bare SQL, real user Conversation, secret logging or committed browser artifacts.

### 9.2 Bounded path

After deterministic PASS:

1. open the production-built V4 route;
2. inspect/change target, thinking, memory/history/cache preferences and Aura;
3. open one safe Project tree and insert one file reference;
4. perform at most one short provider-backed generation, only after Alicia authorizes spend, using a harmless tool call that proves ordered Thinking/Tool trace and canonical reload;
5. inspect cache status and renew/release only if the disposable run naturally creates an eligible cache; do not manufacture cache/provider failures;
6. clean all data and restore archived preset/Project state.

If provider or suitable Project use is not authorized, record the exact live omissions. C1D remains pending unless Alicia explicitly re-baselines those live gates.

---

## 10. Binary C1D gate

C1D is PASS only when every applicable item is evidenced.

### Entry/integrity

- [ ] C1C checkpoint is exact and sibling deltas are not absorbed.
- [ ] Current cache/project/control contracts match or approved corrections exist.
- [ ] AssistantRunTrace backend handoff and focused backend acceptance are PASS.
- [ ] Real AgentPreset baseline opens/closes at IDs 1–8.
- [ ] Reviewed Plan explicitly authorizes construction.

### Controls/cache

- [ ] Target compatibility, thinking persistence and g045-only memory semantics are truthful.
- [ ] Full/lite, cache enable and transport scope match §4.3.
- [ ] One immutable dispatch snapshot feeds SSE/async/recovery without dead fields.
- [ ] Cache state/countdown/calibration/renew/release/error behavior passes.
- [ ] P1C audio follows the selected target without duplicate upload or stale recording.

### Context/presentation

- [ ] HUD overlays without reflow and is accessible at all target widths.
- [ ] Aura palette/custom/reduced-motion behavior meets the reduced performance boundary.
- [ ] Drift gating, Project read states, tree browsing and safe `@[path]` insertion pass.
- [ ] No Project workspace management leaked into P1D.

### Trace/runtime

- [ ] Realtime and history preserve accepted Thinking/Tool order and lifecycle.
- [ ] `memory_search` is an ordinary ToolCall; automatic recall is absent.
- [ ] Legacy/unavailable and malformed/partial traces are explicit, not fabricated.
- [ ] Telemetry/cache notices do not contaminate answer content.
- [ ] C1B operation/reconciliation and C1C attachment/audio behavior do not regress.

### Quality/scope

- [ ] App checks, four-package build and V3 regression pass.
- [ ] Responsive/accessibility matrix passes.
- [ ] No new dependency, dead field, backend edit, P2/P6 capability or parallel state system entered the patch.
- [ ] Controlled probe is complete or Alicia explicitly re-baselined its omission.
- [ ] Independent acceptance issues `C1D: PASS` and Alicia approves the checkpoint commit.

Any unchecked applicable item means C1D FAIL. C1D PASS still does not transfer Chat ownership; unified C1 acceptance follows.

---

## 11. Evidence, checkpoint and rollback

Construction evidence records:

- exact opening commits and dirty manifests;
- accepted backend trace contract/hash/checkpoint;
- changed files grouped by adapters/state/runtime/UI/styles/tests/docs;
- state ownership and request field matrix;
- emitted cache/project/chat routes and validated payloads;
- trace ordering/sanitization/legacy evidence;
- HUD/Aura/project responsive and accessibility outcomes;
- command exit codes and numeric test counts;
- live probe authorization, spend, omissions and ORM cleanup;
- opening/closing DB baseline;
- explicit P2/P6/backend/outer exclusions;
- no Builder quality verdict and no commit before independent acceptance plus Alicia approval.

Checkpoint:

```text
accepted C1C
  + independently accepted additive backend trace contract
  + Desktop-only P1D controls/context/Aura/trace implementation
  + independent C1D acceptance
  + Alicia-approved Desktop commit
```

Rollback reverts only the P1D Desktop commit and hides the backend additive trace projection from V4 consumption; accepted C1C chat remains usable. It does not delete caches, Conversations, Messages, Projects or attachments. Additive backend compatibility must keep V3 functional. V3 remains production-primary pending unified C1.

---

## 12. Adversarial razor / ablation study

### Retained because the frozen C1D capability rows require them

- Additive structured trace backend handoff: current wire cannot represent ordered ToolCalls or active `memory_search` truthfully.
- Top-bar overlay HUD: frozen controls must remain reachable without squeezing the stream.
- Typed dispatch snapshot plus extension of the existing `AudioTurnSnapshot`: otherwise ordinary recovery or uploaded-audio retry can silently change execution target/control values.
- Response-validated thinking mutation: thinking level is backend truth, not a cosmetic selector.
- Conversation-local memory flag in the immutable dispatch snapshot: each g045 turn must carry the user's selected boolean.
- Cache renew/release with refetch: the ownership matrix explicitly requires both and backend truth can change asynchronously.
- Conversation-gated Project tree plus composer token integration: browsing without the send path would not complete the chat-local capability.
- Reduced Aura palette engine: Aura is explicitly chat-local, while reduced layers and motion fallback are the smallest safe implementation.
- Legacy trace unavailable state: existing rows physically lack ordered Tool details.

### Removed or rejected from active scope

- Pure-frontend path A as C1D completion: it would relabel generic `status` text as ToolCalls and cannot preserve order/history.
- Raw `tool_calls` exposure: unsafe, potentially huge and still insufficient for Thinking interleave.
- Canvas/WebGL Aura and nine-ribbon V3 copy.
- LocalStorage mirror of backend cache status; expiry-derived Query state is sufficient.
- Temperature, `galatea_mcp`, branch `session_type` and `session_id` compatibility reads.
- New global toast/store, cross-tab preference sync, offline controls and speculative cache policy.
- Project file preview/editor/upload/delete and P2 workspace shell.
- Frontend reconstruction of legacy Tool order, duration, arguments or results.
- Blanket backend regression suite and manufactured live failure scenarios.

### Adjacent improvements recorded, not active

- Persisting per-Conversation target choice server-side.
- Server-side project tree search/pagination for future large workspaces.
- Dedicated performance telemetry for Aura on low-end devices.
- Rich tool result viewers or downloadable artifacts after a separately reviewed safe-result contract.
- P6 automatic recall receipt and feedback.

**Razor conclusion:** P1D remains the seven frozen chat-local capabilities plus one necessary backend trace contract. Every other addition is either unsupported by the current API, owned by P2/P6, or unnecessary for C1D acceptance.

---

## 13. Plan completion rule

The initial fork review's five scope-tightening corrections are incorporated `[model not provided / fork reviewer]`: Query remains the sole read owner, recorded Blob invalidation moves to upload, existing audio recovery captures controls, Project tree follows one minimal path, PATCH uncertainty stays a lightweight refetch flow, and trace safety is limited to the new backend projection. Reviewer advice remains advisory and may correct feasibility or reduce work, but it must not expand P1D without Alicia's explicit approval.

After Alicia approves the reviewed draft, freeze the Plan hash and prepare an independent C1D acceptance contract. Construction remains locked until Alicia assigns a Builder and Task 0's backend trace gate is satisfied or Alicia explicitly authorizes a staged non-C1D checkpoint. Construction must not edit the frozen Plan/Acceptance artifacts, run unapproved provider probes or create a C1D commit before independent PASS and Alicia approval.
