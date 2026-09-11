# ExoCore V4 — Phase 2A Agent Hub / Agent Profile Foundation Detailed Plan

> **Document type:** executable implementation plan for the P2A Agent browse/profile foundation only; not the whole P2 phase.
> **Status:** **APPROVED FOR CONSTRUCTION — serial Stage A → B → C with CP1/CP2/CP3 holds**.
> **Repository:** `ExoCore-Desktop` production changes only. Django and sibling repositories are read-only.
> **Product authority:** Alicia.
> **Plan / architecture / QC:** `[gpt-5.6-sol / Solaire]`.
> **Source research:** `[gemini / Alaric]`, reverified against current V4, V3 and backend source by `[gpt-5.6-sol / Solaire]`.
> **Mini-fork reviews:** internal-abstraction reductions `[opencode-go/deepseek-v4-flash / reviewer]`; execution ablation and three-checkpoint handoff `[gpt-5.6-sol / Solaire]`; both approved by Alicia and incorporated here.
> **Accepted Desktop baseline:** `b1178fb1a974cd848fdeaa11a7d279df920b1a0c` (unified C1 transfer record; working tree clean at planning time).
> **Planning-time real-data invariant:** `AgentPreset` baseline is exactly IDs 1–8.

---

## 1. Goal and acceptance intent

P2A establishes the truthful V4 path:

```text
Chat Home
  -> Agent Hub
  -> Agent Profile
       -> inspect identity/default model/System Prompt (read-only in P2A)
       -> create a Conversation for this fixed Agent
       -> filter this Agent's existing Conversations by All / Drift / Project
       -> open the one canonical /chat/:conversationId page
       -> inspect a read-only Memory summary and honest P5 availability notice
```

The essential problem is not copying two V3 screens. It is making Agent a reliable workspace lens over existing `AgentPreset`, `Conversation`, `Project` and `MemoryPlasmid` facts without reviving dead lifecycle controls, inventing APIs, or creating another chat implementation.

### P2A acceptance intent

Alicia can:

1. enter an Agent Hub from Chat Home and see every visible preset once;
2. rely on one deterministic order: g045 first, then ascending numeric preset ID;
3. open a directly addressable Agent Profile and distinguish invalid, missing and load-failed states;
4. see the Agent's current identity, type, default model and System Prompt without P2A pretending local edits were saved;
5. start a new Conversation with the current Agent fixed, optionally choose a Project or Drift, then land at `/chat/:conversationId` using `data.conversation_id`;
6. browse the same global Conversation collection filtered in memory by `agentPresetId`, preserving backend activity order;
7. narrow those Conversations by All, Drift or a Project label and open each in the accepted canonical Chat page;
8. see Conversation and Memory failures as explicit retryable states rather than false emptiness;
9. see a small read-only Memory count/tag summary without Heartbeat Ledger, Plasmid CRUD, or a fake Library page;
10. use the same business implementation on desktop and mobile, with the mobile primary bar hidden only on the focused Profile level.

P2A is a construction checkpoint, not capability transfer. Agent Hub/Profile remain V3-primary until the later Agent configuration slice and the full C2 gate pass.

---

## 2. Source facts and hard constraints

### 2.1 Verified contracts

- `GET /api/agents/presets/` returns visible presets only; `GET /api/agents/presets/<id>/` provides exact detail. The allowlist is `id`, `name`, `description`, `agent_type`, `default_model`, `system_prompt`, `is_visible`.
- `POST /api/agents/presets/` and `DELETE /api/agents/presets/<id>/` are permanently unavailable (`405`). Migration `agents.0040_protect_agentpreset_rows` also protects real preset row lifecycle. `[gemini / Alaric; gpt-5.6-sol / Solaire reverified]`
- Conversation listing has no Agent/Project query contract. `GET /api/agents/conversations/` returns the canonical visible ordinary Conversation array in backend activity order.
- V4 already normalizes `agent_preset_id` to `ConversationSummary.agentPresetId` and DB-null Project sentinel `0` to `projectId: null` (`Drift`).
- Canonical Conversation creation is the accepted `POST /api/agents/sessions/init/`; new code reads only `data.conversation_id`, never deprecated `session_id`.
- `GET /api/core/projects/` remains consumed only by the existing create dialog. Profile filter options can be derived from that Agent's Conversation rows because each already carries `project` identity and `project_name`; P2A needs no second Project-list dependency.
- `GET /api/memory/plasmids/?preset_id=<id>` returns a bare array and currently includes rows owned by the requested preset plus shared/global preset `2`.
- Current Memory list contract is unpaginated. P2A may aggregate this already-returned profile response; it must not add server filtering/pagination or claim this is the future P5 Library contract.
- Current V4 owns ordinary Chat at the sole canonical route `/chat/:conversationId`.

### 2.2 V3 evidence: preserve behavior, reject architecture

Useful behavior:

- Agent workspace shows identity, new-Conversation entry and Agent-filtered Conversations.
- Conversation filtering is client-side by `agent_preset_id`.
- Conversation rows expose Project context because Agent identity is already known.
- Memory is related to Agent identity.

Rejected V3 behavior:

- “New Agent” is dead against the fixed preset lifecycle.
- “Erase Entity” is dead and forbidden.
- `Heartbeat Ledger` routes to the 962-line `AgentMemory.jsx` technical ECG/ledger surface owned by P3 River, not P2A Memory.
- Plasmid editing belongs to P5 Library.
- Conversation fetch failure must not become `[]` / “No sessions yet”.
- Per-desktop localStorage drag order has no cross-device or backend truth and is not migrated.
- V3 inline profile editing, modal ownership and ad-hoc fetch effects are not copied.

### 2.3 Authority

1. `Plan/V4_Spec_Freeze_Index.md`;
2. `Plan/V4_Master_Implementation_Roadmap.md` §§8, 16–17;
3. `Plan/V4_River_Collection_Memory_Interaction_Spec.md` §2.1;
4. `Plan/ExoCore_V4_Single_SPA_Architecture_Spec.md` §§5.1–5.5;
5. `Plan/V4_Page_Skeleton.md` Chat section;
6. current accepted V4/backend source and `ReactSheet.md`.

Product semantics outrank historical V3 presentation. Current source outranks stale assumptions about available methods or fields.

---

## 3. Required decisions

### D1 — Memory landing while Library is unavailable

**Decision:** P2A shows a read-only Memory summary followed by static explanatory text: `记忆管理入口将在 P5 Library 阶段提供。` It does not render a disabled control, navigate, reserve a fake route, redirect to V3, or render Not Found. `[opencode-go/deepseek-v4-flash / reviewer; gpt-5.6-sol / Solaire approved]`

Rationale:

- P4 owns the canonical Library container/routes; P5 adds Memory to that shell.
- Creating `/library/memory` in P2A would steal P4 shell ownership or expose a dead page.
- Redirecting to Heartbeat Ledger would conflate technical events with MemoryPlasmid.
- Redirecting to V3 would violate the P2 objective of eliminating hidden V3 completion paths.

P2A therefore freezes the future handoff semantics, not a premature URL or dead control. P5 replaces the static explanation with its canonical Agent-filtered Library deep link. P2A does not claim the final Memory deep-link transfer condition.

### D2 — Read-only foundation versus configuration editing

**Decision:** P2A contains read-only identity/default-model/System-Prompt presentation, Conversation creation/indexing and Memory summary. Preset edits are a separate later Agent configuration slice and gate. `[gpt-5.6-sol / Solaire]`

The later slice must independently reverify PATCH permissions, model-catalog compatibility, save uncertainty, avatar persistence and field-specific validation before editing `name`, `description`, `default_model` or `system_prompt`. P2A adds no edit icon, editable control or optimistic local mirror.

This split is mandatory scope control, not cancellation: Agent Hub/Profile ownership remains V3-primary after P2A and cannot transfer until approved configuration behavior and the full C2 gate pass.

### D3 — Ordering

**Decision:** retire drag-and-drop and `agentHubOrder`. Sort visible presets by:

1. `agent_type === "g045"` first;
2. ascending numeric `id` for all ties.

Unknown future non-g045 types remain visible and sort by ID; they are not dropped because a frontend enum is stale. No local order is read or written. `[gpt-5.6-sol / Solaire; gemini / Alaric recommendation approved]`

### D4 — Canonical Agent routes

**Decision:** V4 owns `/agents` and `/agents/:presetId`. Chat Home provides the secondary Chat-area entry to `/agents`; Agent routes remain under the Chat product area's active navigation state. `[gpt-5.6-sol / Solaire]`

There is no V4 compatibility alias for V3's separate `/agent-hub` or `/agent/:id` paths because V4 runs under its own `/app/` basename and has no accepted external V4 links to preserve.

### D5 — Memory summary meaning

**Decision:** report only:

- the number of rows actually returned by the existing endpoint, labelled once as including shared/global Memory;
- deduplicated non-empty tags from those returned rows, deterministically sorted.

No requested/shared partition, processing-status buckets, content ticker, excerpt, trigger details, weight editing or inferred recall quality appears. Those semantics belong to P5's canonical Library contract. A non-array top-level response is a contract error; P2A otherwise trusts DRF-serialized row shapes in line with existing V4 preset/conversation adapters rather than adding a stricter row-validation subsystem. `[opencode-go/deepseek-v4-flash / reviewer; gpt-5.6-sol / Solaire approved]`

### D6 — Project filters derive from Agent Conversations

**Decision:** Project filter options are deduplicated by positive `projectId` from current `agentRows`; the first row in backend order supplies that ID's label. They require no Profile-index Project Query. `[opencode-go/deepseek-v4-flash / reviewer; gpt-5.6-sol / Solaire approved]`

This makes every Project option a guaranteed non-empty subset of the current Agent lens. The existing create dialog still owns its Project-list Query because creation must offer Projects with no existing Conversation. Conversation rows retain the minimal truthful fallback `Project #<id>` when an identified Project has no name.

---

## 4. Scope boundary

### 4.1 Allowed P2A work

- Canonical `/agents` and `/agents/:presetId` routes.
- Chat Home secondary entry into Agent Hub.
- One thin Agent feature boundary for preset detail and Memory summary; reuse existing V4 Conversation and creation owners.
- Agent Hub list with deterministic order, identity/type/description presentation and loading/error/retry/empty states.
- Agent Profile read-only identity, default model and System Prompt.
- Fixed-Agent reuse of the existing canonical Conversation creation flow.
- Agent-filtered Conversation index with All / Drift / Project filters derived from its own rows.
- Read-only Memory count/tag summary and static P5 availability text.
- Responsive/focus/navigation behavior and app-local Agent styles.
- Focused app tests, regressions and construction evidence.

### 4.2 Explicitly excluded

- Preset create/delete, visibility changes or primary-key changes.
- Preset PATCH/edit UI: name, description, avatar, type/tier, default model and System Prompt.
- `agentHubOrder`, drag/drop, cross-device custom ordering or an ordering backend handoff.
- Heartbeat Event/Ledger API, `AgentMemory.jsx`, ECG visualization, wakeups, mailbox or River projections.
- MemoryPlasmid content display, search, pagination, create/edit/delete, tag management, triggers, History or Recall Lab.
- A premature Library route/container or navigation enablement.
- Project Hub/Detail, Project files/knowledge/CRUD, or combined server-side Agent + Project filtering.
- Conversation rename/delete/archive controls in the Agent list.
- GroupChat, Settings, notifications, account/profile shell, River or Collection.
- New backend endpoints, backend production edits, new dependencies or V3 component/style imports.

### 4.3 Clarifications

- “Read-only Profile” does not make the whole page passive: starting a Conversation is an approved write through the existing canonical init mutation.
- The Agent Profile Conversation list is a lens over `queryKeys.conversations`, not a second fetched or stored collection.
- Filtering never reorders rows; backend list order remains authoritative.
- Project filter choices derive from current Agent rows, so the Conversation index introduces no Project-list request or independent Project loading/error state. Opening the existing create dialog remains allowed to run its established Project Query.
- Hub/profile empty/error states are not inferred from one another. A failed preset request is not “no Agents”; a failed Conversation request is not “no Conversations”; a failed Memory request is not “0 memories”.
- Hidden/archived presets are not surfaced because the accepted public preset queryset is visible-only.

---

## 5. Construction-time drift check

The source investigation and reviews already established §2. Before editing, each Builder reads the exact V4 files and symbols they will modify or reuse and verifies that their signatures still match this Plan; a blanket reread of V3, both backend apps or `AgentMemory.jsx` is not required.

Minimum targeted check:

- read `router.tsx`, the shell route projections, current Chat Home, Conversation queries/types and the exact `CreateConversationDialog`/creation mutation path relevant to the assigned stage;
- inspect current Agent-related test helpers and styles before extending them;
- compare HEAD and dirty manifest with the planning baseline;
- use `Plan/V4_Phase_2A_Source_Scout.md` only to locate V3/backend facts if a relevant signature or contract has drifted;
- confirm actual endpoint/method names in source immediately before adding an adapter; do not rely on memory.

Stop and report drift in preset visibility/lifecycle, list/detail shape, Conversation ordering/identity, init envelope, or Memory list inclusion semantics. Do not compensate with guessed behavior or reopen Scout suggestions already superseded by this Plan.

---

## 6. Architecture and state ownership

### 6.1 Feature structure

Expected production ownership:

```text
features/agents/
  api/types       thin preset-detail and Memory-list boundaries
  queries         Agent-specific Query keys/hooks only
  AgentHubPage    Hub orchestration and deterministic list projection
  AgentProfilePage
                  identity, Conversation lens and Memory summary composition

features/chat/
  existing queries/create mutation remain canonical
  CreateConversationDialog gains a narrow fixed-Agent mode

app/router + shell/navigation
  route exposure and Chat-area active/focused-detail projection
```

Exact leaf-component splitting may be reduced by the Builder when a component has no independent behavior. Do not create one-file abstractions solely to match this diagram.

### 6.2 Query ownership

- Hub uses the existing visible-preset list Query.
- Direct Profile uses an exact `preset(presetId)` Query and guards the response as a top-level object with numeric `id`, matching existing V4 adapter strength.
- Conversations reuse `queryKeys.conversations`; no Agent-specific fetch, copy or writable cache is introduced.
- Project options derive from those Conversation rows; only the existing create dialog uses `queryKeys.projects`.
- Memory uses `agentMemory(presetId)` and is enabled only after a valid positive route ID and confirmed visible preset detail.
- Query cancellation/signals follow current project patterns where supported. Route-keyed results must not update another Agent's profile-local filter state.
- Profile-local selected filter resets when `presetId` changes. If a refetch removes its source Project row, the derived option disappears and selection falls back to All.

### 6.3 Boundary guards

Keep guards aligned with existing V4 adapters:

- preset detail must be a top-level object with numeric `id`, then uses the verified `AgentPresetSerializer` shape;
- Memory list must be a top-level array;
- presentation receives only the Memory row count and normalized tag strings, never Plasmid content.

Do not add a general per-field/per-row validation framework. DRF owns serializer row typing; P2A only prevents malformed top-level success from becoming false empty/zero state.

### 6.4 Fixed-Agent creation

Extend `CreateConversationDialog` with a narrow fixed-Agent input rather than forking the form or mutation:

- profile supplies the already validated preset;
- fixed mode renders the Agent identity as non-editable and submits exactly that positive preset ID;
- general Chat Home mode retains its current selectable-Agent behavior;
- Project/Drift and g045 `frozen_project_ids` behavior remains the accepted P1A implementation;
- each request captures the fixed Agent at submit time; later Profile changes cannot rewrite its body;
- confirmed success retains the canonical mutation's shared Conversation-list invalidation even if the originating dialog/page has closed, because the server write remains real;
- only the still-mounted originating dialog may run its local success/navigation callback; closing it or leaving/switching Profile suppresses stale navigation and local-state updates without suppressing shared cache refresh;
- malformed 2xx keeps the existing terminal ambiguous-write lock;
- fixed mode does not add a cross-unmount/cross-refresh lock or refactor the accepted pending/ambiguous owner unless source proves the existing owner cannot satisfy this boundary.

No second creation adapter, form schema, cancellation framework or dialog is allowed.

### 6.5 Conversation and Project filtering

The pure filter projection is:

```text
agentRows = conversations where conversation.agentPresetId === preset.id
All       = agentRows
Drift     = agentRows where projectId === null
Project X = agentRows where projectId === X
```

Project filter options are deduplicated by positive `projectId` already present in `agentRows`, preserving first backend occurrence order and using that first row's `projectName`. Labels fall back to `Project #<id>` only when identity exists but a name is unavailable. Drift never becomes a fabricated Project option.

The list preserves backend order and shows activity via the existing time formatter. Opening a row always targets `/chat/<positive-id>`; there is no Agent-specific chat route or page.

### 6.6 Navigation and responsive behavior

- `/agents` is a Chat-area L1/Hub page; mobile primary navigation remains visible.
- every syntactically valid `/agents/:presetId` route is a focused L2 Profile shell, including loading, missing and hidden-preset recovery states; mobile primary navigation stays hidden without waiting for detail success. Desktop retains the shared shell sidebar.
- Chat remains active in primary navigation for `/`, `/chat/*` and `/agents/*`.
- Profile has an explicit `/agents` return link; browser history naturally returns to the source when used.
- Hub/Profile use one page scroll owner each. No nested full-page scrolling surface is added.
- At mobile widths, filters may scroll horizontally only inside their labelled filter region; the document must not overflow horizontally.

---

## 7. Construction sequence and ownership

This is a serial A → B → C build with three mandatory stops, not seven task-level handoffs. At each stage, workflow construction matrices and checkpoint observations are written once to `Plan/V4_Phase_2A_Construction_Evidence.md`; the approved Detailed Plan remains read-only. Later Plan sections reference that Evidence instead of duplicating results.

### Start gate — shared preflight

1. Apply `builder-workflow`; record Desktop HEAD, dirty manifest, accepted C1 baseline, final Plan hash and pane/file ownership in Evidence.
2. Run the opening real AgentPreset baseline and record IDs 1–8.
3. Perform the targeted §5 drift check and confirm actual interfaces immediately before use.
4. Preserve the three pre-existing untracked planning/review artifacts; do not stage or rewrite Source Scout/Execution Review during construction.

### Stage A — DeepSeek pane 4: complete read-only vertical slice (risk M)

Own Agent feature files, routes/navigation, Chat Home's Hub entry, sufficient styles and focused tests. Implement:

- top-level preset-detail and Memory-list guards plus route-keyed Queries;
- `/agents`, `/agents/:presetId`, active/focused shell projection and recoverable route states;
- deterministic Hub with no lifecycle/order/Memory fan-out controls;
- read-only Profile identity/model/System Prompt;
- shared-Conversation Agent lens with row-derived All/Drift/Project filters;
- Memory count/tags and static P5 explanation;
- independent preset, Conversation and Memory loading/error/empty states.

Do not add or wire the fixed-Agent create action in Stage A.

#### CP1 — mandatory stop: read path and isolation

Record focused evidence for shared data ownership, absence of Profile-index Project Query/Hub Memory fan-out, A → B route isolation, filter fallback, independent failures, mobile navigation depth and unchanged canonical Chat. Hand off the relevant diff and unresolved facts, then stop until Alicia releases Stage B.

### Stage B — Sol pane 5: fixed-Agent creation integration (risk H)

Ownership of integration files, especially `AgentProfilePage` and `CreateConversationDialog`, transfers exclusively to pane 5 for this stage. Read the exact accepted create owner before editing. Implement only:

- the narrow fixed-Agent dialog mode and Profile action;
- submit-time Agent capture;
- Home selectable-Agent compatibility;
- stale local navigation/state suppression after close or route/Agent change;
- retention of confirmed-success shared Conversation-list invalidation.

Do not rewrite chat API/Query ownership, add a second form/dialog, or create cross-unmount persistence machinery unless verified source makes the frozen semantics impossible; stop and report instead.

#### CP2 — mandatory stop: create compatibility and timing

Record decisive evidence for Home/Profile dual entry, g045/Drift/Project bodies, duplicate/ambiguous lock preservation, one navigation from a live origin, no stale navigation after close/switch, and retained shared refresh after confirmed success. Builder reports facts only and stops; Alicia decides release to Stage C or requests an explicit acceptance chain.

### Stage C — DeepSeek pane 4: visual closeout, regression and Evidence (risk M)

After exclusive file ownership returns to pane 4:

1. complete only necessary responsive/focus/long-content/safe-area styling;
2. execute §8 focused and full exo-app checks once at the final gate;
3. perform the scope sweep and real-browser checks at all five widths;
4. finalize the single Evidence file with exact commands, counts, unexecuted items and ownership boundary;
5. run closing real DB baseline and stop without commit or P2B work.

#### CP3 — mandatory stop: final construction handoff

All applicable §8/§9 targets must map to one Evidence observation; references may be reused and duplicate tables are not required. Distinguish automated checks from browser observations and unexecuted work. No independent acceptance is spawned unless Alicia explicitly requests it.

---

## 8. Verification targets and interfaces

No raw test implementation is frozen here. Builder and Acceptance may choose mechanics independently but must prove the following observable outcomes.

### 8.1 Commands

From `ExoCore-Desktop`:

```bash
pnpm --filter exo-app typecheck
pnpm --filter exo-app lint
pnpm --filter exo-app test:run
pnpm --filter exo-app build
git diff --check
git diff --cached --check
```

If the existing Node 25/jsdom storage collision reproduces, rerun only the affected test command with `NODE_OPTIONS=--no-experimental-webstorage` and record both attempts. No dependency or lockfile change is expected. Full monorepo build and V3 rollback regression are deferred to the full C2 gate unless a P2A patch unexpectedly touches shared/V3/workspace surfaces.

From `../ExoCore`:

```bash
bash .agent/check_real_db_baseline.sh
```

No backend suite or provider-backed request is required because P2A changes no backend contract and sends no LLM request.

### 8.2 Agent Hub matrix

Prove:

- loading, malformed top-level payload, HTTP/network error + working retry, and true empty list;
- all visible returned presets appear once, including an unknown non-g045 type;
- one or multiple g045 rows sort before all others, then all ties sort by numeric ID;
- source Query arrays are not mutated;
- no POST/DELETE preset request, create/delete button, drag handle or `agentHubOrder` storage access exists;
- card navigation uses positive preset identity and reaches the canonical Profile implementation;
- Chat primary navigation remains active and mobile bottom navigation remains visible on Hub.

### 8.3 Agent Profile matrix

Prove:

- invalid ID produces no detail/Memory request and has a clear recovery route;
- exact detail loading, 404, malformed top-level response and retryable error are distinct;
- direct URL and Hub navigation render the same page;
- null/blank description, model and System Prompt display honest fallback text;
- all displayed fields are read-only; no PATCH is emitted by Profile controls;
- Profile switch cannot show the prior Agent's identity, selected filter or Memory summary;
- mobile bottom navigation is hidden on valid focused Profile routes; desktop shell remains usable;
- return navigation targets Agent Hub and canonical Chat remains separately reachable.

### 8.4 Creation matrix

Prove:

- Chat Home's existing selectable-Agent creation behavior does not regress;
- Profile creation fixes preset ID to the currently loaded Agent and offers no Agent switch;
- Drift submits `project_id: 0`; Project selection submits the selected positive ID;
- g045 retains accepted optional `frozen_project_ids`; non-g045 omits it;
- only accepted init fields are sent; no `session_id` read or alternate Conversation POST appears;
- duplicate pending submit and malformed-success ambiguous-write remain locked as in P1A;
- confirmed success from a still-live origin navigates once to `/chat/:conversationId`, and the new row becomes visible after returning/refetch;
- request body remains bound to its submit-time Agent;
- route/Agent change or dialog close suppresses stale local navigation/state updates while preserving confirmed-success shared Conversation-list invalidation;
- no new cross-unmount/cross-refresh pending or ambiguous-write lock is claimed.

### 8.5 Conversation/filter matrix

Prove:

- the Profile issues the existing global Conversation request without invented query params;
- only exact `agentPresetId` matches appear;
- backend order is unchanged before and after filtering;
- All, Drift and every Project option derived from current Agent rows produce correct subsets;
- Drift is never represented as Project `0` in UI;
- duplicate Project IDs collapse to one option; duplicate names with different IDs remain distinct;
- the Profile Conversation index issues no Project-list request or Project-specific loading/error state; opening the existing create dialog may issue its established Project request;
- Conversation load failure is an ErrorState, never the empty copy;
- a Project option always has at least one current row; true zero-Agent-Conversations remains distinct from request failure;
- each row opens `/chat/:conversationId`; no `/agents/:id/chat/*` route or duplicate Chat component exists.

### 8.6 Memory summary matrix

Prove:

- profile-only request uses exact `preset_id` and a route switch cannot mix results;
- top-level non-array and network/HTTP errors are explicit error states;
- the displayed count equals the endpoint array length and is labelled as including shared/global Memory;
- tags are trimmed, deduplicated and deterministically ordered;
- zero rows is shown as zero, while request failure is never shown as zero;
- no requested/shared partition, processing-status bucket, Plasmid content, trigger, weight, edit/delete/create or Heartbeat data is rendered;
- the P5 sentence is static text, creates no route transition and does not enable primary Library navigation.

### 8.7 Responsive/accessibility matrix

At CSS widths 320, 390, 767, 768 and 1280:

- Hub/Profile header, identity, actions, filters and rows do not create document overflow;
- each page has one main scroll owner;
- route links, filter controls, retry actions and fixed-Agent dialog have accessible names and keyboard behavior;
- active/selected/error meaning is not color-only;
- long Prompt text and long Conversation/Project/Agent names wrap or truncate without hiding actions;
- touch paths do not depend on hover and Profile retains enough bottom safe area when the mobile bar is hidden.

### 8.8 Regression and scope sweep

Prove no P2A patch contains:

- preset lifecycle writes or primary-key changes;
- preset/profile PATCH UI;
- V3 Agent component/style imports or local drag ordering;
- Heartbeat/River/Library/Memory CRUD behavior;
- Project workspace or Group/Settings/notification behavior;
- server-side Conversation filtering/pagination assumptions;
- second Conversation collection, create adapter or ordinary Chat page;
- new dependency, backend/outer/deployment edit, silent catch or fabricated empty success.

---

## 9. Binary P2A gate

P2A is PASS only when every applicable item is evidenced.

### Entry/integrity

- [ ] Unified C1 accepted baseline is preserved and sibling deltas are isolated.
- [ ] Current preset/detail, Conversation, init, Project and Memory contracts match §2.
- [ ] Opening and closing real AgentPreset baseline is exactly IDs 1–8.
- [ ] Alicia has approved this Plan for construction.

### Hub/Profile

- [ ] `/agents` and `/agents/:presetId` are canonical, direct-openable and share desktop/mobile business logic.
- [ ] Hub ordering is g045-first then numeric ID, with no drag/order storage.
- [ ] Profile identity/model/System Prompt is truthful and read-only.
- [ ] Invalid/not-found/loading/error/retry/empty states are distinct and accessible.

### Conversation path

- [ ] Fixed-Agent creation reuses the accepted init mutation and lands at `/chat/:conversationId`.
- [ ] Agent filtering is an in-memory lens over the shared backend-ordered Conversation collection.
- [ ] All / Drift / Project filters derive solely from current Agent rows; the Conversation index adds no Project Query, while the existing create dialog retains its Project request.
- [ ] No Agent-specific Chat implementation or server filter was introduced.

### Memory/scope

- [ ] Memory summary reports only D5 count/tags and distinguishes error from zero.
- [ ] P5 availability is explicit static text and route-free.
- [ ] Heartbeat Ledger, Memory CRUD and Library shell are absent.
- [ ] Preset create/delete/edit and Agent ordering customization are absent.

### Quality

- [ ] Focused tests, full exo-app regression and app build pass; C2-wide monorepo/V3 regression remains deferred unless shared scope changes.
- [ ] Responsive/accessibility matrix passes.
- [ ] Construction evidence records exact commands, counts, omissions and unchanged ownership.
- [ ] Independent acceptance, if Alicia requests it, issues `P2A: PASS` before any checkpoint commit.

Any unchecked applicable item means P2A FAIL. P2A PASS does not transfer Agent Hub/Profile production ownership and does not authorize P2B or another P2 slice automatically.

---

## 10. Evidence, checkpoint and rollback

The following facts are recorded once in `Plan/V4_Phase_2A_Construction_Evidence.md`; §8/§9 gates reference those observations rather than duplicating matrices:

- opening commit and dirty manifest;
- frozen Plan hash;
- exact route/API calls and guarded top-level shapes;
- Hub order examples and source non-mutation evidence;
- fixed-Agent payload plus close/switch/late-success navigation and shared-refresh observations;
- Conversation-derived Project filter matrix;
- Memory count/tag aggregation matrix;
- responsive/accessibility outcomes;
- command exit codes and test counts;
- opening/closing real DB baseline;
- explicit absence of preset writes, Heartbeat, Library, Project workspace and server-filter changes.

Proposed construction checkpoint:

```text
accepted unified C1 baseline
  + Desktop-only Agent Hub/Profile read foundation
  + P2A verification PASS
  + Alicia-approved commit
```

Rollback reverts only the P2A Desktop commit and removes the `/agents` exposure. Accepted V4 Chat remains V4-primary, V3 Agent views remain production owner, and no AgentPreset, Conversation, Project or Memory data is deleted or rewritten.

---

## 11. Adversarial razor / ablation study

### Retained because P2A cannot meet its acceptance path without them

- Exact Profile route/detail query: direct links and 404/error distinction require it.
- Shared Conversation Query lens: Agent workspace requires sessions, while a new backend filter is unsupported and unnecessary.
- Fixed-Agent mode in the existing create dialog: completes Profile -> Chat without duplicating the accepted create contract.
- Conversation-derived Project labels: the frozen Agent workspace requires Project/Drift narrowing, and its rows already contain the needed facts.
- Read-only Memory count/tags: preserves the Agent-Memory relationship without inventing P5 management semantics.
- Static P5 explanation: gives Alicia an honest availability answer without adding a dead control.
- Explicit error/retry sections: V3's false empty state is a confirmed defect.

### Removed or rejected from active scope

- Preset create/delete controls: permanently dead and forbidden.
- Profile editing in P2A: not required to prove the browse/index foundation and carries separate save/model/avatar semantics.
- Hub Plasmid marquees: they multiply requests, expose content and do not satisfy the Profile summary requirement.
- Heartbeat Ledger button and `AgentMemory.jsx`: P3 River ownership.
- A placeholder `/library/memory` route or disabled P5 control: either would be dead UI or steal P4 shell ownership.
- Profile Project-list dependency and its partial-failure state machine: Agent Conversation rows already provide the complete non-empty filter option set.
- Requested/shared Memory partitions, processing buckets and row-validation framework: unrequested P5 semantics and defensive machinery.
- Drag ordering/localStorage migration: desktop-only preference with no canonical truth.
- Server Agent/Project filtering or pagination: no measured blocker and no accepted API.
- Conversation list rename/delete actions: canonical browse/open is sufficient for P2A.
- New avatar persistence work: configuration slice concern, not read-foundation acceptance.
- Generic workspace framework shared prematurely with future Project Profile: no approved second consumer yet.

### Adjacent work recorded, not active

- Agent configuration editing (name/description/default model/System Prompt, and separately approved avatar behavior).
- Project Hub/Detail and Project Knowledge ownership.
- Full P5 Agent-filtered Memory Library deep link.
- Scale-triggered server Conversation filters/pagination.
- Any product decision to customize Agent ordering across devices.

**Razor conclusion:** P2A is limited to the smallest complete Agent discovery -> Profile -> existing/new Conversation path plus a truthful Memory summary. Editing, Heartbeat, Library and speculative backend work are not necessary for this checkpoint and are removed.

---

## 12. Plan completion rule

Key source findings are attributed to `[gemini / Alaric]`; final scope, route, ordering and gate decisions are `[gpt-5.6-sol / Solaire]`. Alicia approved both simplifying reviews: R1–R4/R6 internal reductions and the C1–C4 execution clarifications are incorporated; monorepo/V3 checks move to C2 unless shared scope changes `[opencode-go/deepseek-v4-flash / reviewer; gpt-5.6-sol / Solaire]`. Reviewer advice remains advisory and must not expand P2A without Alicia's explicit approval.

Alicia explicitly authorized construction after the final execution review. Freeze this revision's hash in the independent Evidence file. Builders must use `builder-workflow`, must not edit this approved Plan, must not create a commit before the required verification/acceptance boundary, and must leave later Agent configuration and remaining P2 slices locked behind their own plans.
