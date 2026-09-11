# ExoCore V4 — Phase 2B Project Workspace & Management Detailed Plan

> **Document type:** executable implementation plan for the complete P2 Project slice; not the whole Phase 2.
> **Status:** **REVISED AFTER MINI-FORK + EXECUTION ABLATION — CONSTRUCTION NOT YET AUTHORIZED**.
> **Repository:** `ExoCore-Desktop` production changes only. Django and sibling repositories are read-only.
> **Product authority:** Alicia.
> **Plan / architecture / QC:** `[gpt-5.6-sol / Solaire]`.
> **Source research:** `[gemini / Alaric]`; targeted high-risk contract and lifecycle verification by `[gpt-5.6-sol / Solaire]` through a source scout.
> **Mini-fork razor review:** Files/Knowledge invalidation, abstract-side-effect discipline and D3/D7 ablation `[opencode-go/deepseek-v4-flash / reviewer]`; reviewed and incorporated by `[gpt-5.6-sol / Solaire]`, product-sensitive D7 ratified by Alicia.
> **Execution ablation:** stage dependency, `work_dir`, delete-cache/preview-state and evidence reductions from `Plan/V4_Phase_2B_Ablation_Execution_Review.md` `[gpt-5.6-sol / Solaire]`; approved for Plan integration by Alicia.
> **Planning baseline:** Desktop HEAD `b1178fb1a974cd848fdeaa11a7d279df920b1a0c` on `main`.
> **Accepted predecessor:** P2A PASS at `Plan/V4_Phase_2A_acceptance_report.md` R5. P2A is accepted but not committed at planning time.
> **Planning-time real-data invariant:** `AgentPreset` baseline is exactly IDs 1–8.

---

## 1. Goal and acceptance intent

P2B completes the Project-owned Chat workspace path:

```text
Chat Home
  -> Project Hub
       -> create Project
       -> open Project Detail
            -> inspect/edit Project configuration
            -> create a Conversation with this Project fixed
            -> filter this Project's Conversations by All / Agent
            -> open the canonical /chat/:conversationId page
            -> list/upload/delete Project Files
            -> inspect/edit Project Knowledge metadata
            -> preview and confirm archival Project deletion
```

The essential problem is not to mirror Agent Workspace or V3 page structure. Project is a configuration and resource-owning domain which also acts as one lens over the already canonical Conversation collection. P2B must expose that domain truth without creating a second chat implementation, merging Files with Knowledge, promising a file-opening path the backend cannot provide, or leaving Project lifecycle ownership unassigned.

### P2B acceptance intent

Alicia can:

1. enter Project Hub from Chat Home and see current non-archived Projects in backend order;
2. create a Project and immediately arrive at its canonical V4 detail route;
3. open a direct Project route and distinguish invalid ID, missing Project and load failure;
4. inspect and edit the Project's name, description, System Prompt and work directory with explicit save outcomes;
5. start a Conversation with the current Project fixed, choose an Agent, and land at the sole `/chat/:conversationId` implementation;
6. browse the same global Conversation collection filtered by `projectId`, then narrow it by All or Agent without a second collection or server endpoint;
7. list mixed uploaded and Obsidian-synced file references truthfully, upload files, and delete either numeric or `kf_` file rows;
8. inspect Project Knowledge separately from Files and edit only the backend-supported `abstract` and `keywords` fields;
9. preview Project deletion, deliberately choose which uploaded physical files are copied to recovery storage, understand that Conversations and surviving Knowledge are archived, then receive explicit success or failure;
10. use the same business implementation on desktop and mobile, with long content, keyboard focus and reachable actions preserved.

P2B is a Project-slice checkpoint, not the full C2 gate. Groups, Settings, notifications and remaining Agent configuration retain their separately assigned P2 ownership.

---

## 2. Planning-time baseline and drift boundary

### 2.1 Accepted-but-uncommitted predecessor

At planning time, P2A is accepted on top of HEAD rather than represented by a new commit. The working tree contains:

- staged P2A acceptance report/probes/screenshots;
- unstaged accepted P2A production changes in routing, shell, Chat Home, create dialog, Chat API/query integration and test helpers;
- untracked accepted Agent feature, construction tests/scripts/evidence and browser captures;
- `Plan/备忘.txt`, which is not owned by P2B.

The corrected planning-time status summary was `13` staged paths, `10` unstaged tracked paths and `89` untracked paths before this Plan was added. The original staged count of 12 missed one path; the review-time count is authoritative for this sentence. These counts are descriptive, not a permanent manifest; concurrent accepted artifacts can change them, and the authoritative P2A pins remain in the R5 acceptance report.

**Construction rule:** before the first production edit, record the then-current HEAD and dirty manifest. If P2A has been committed, use that commit as the P2B base. If it remains uncommitted, preserve the R5-approved P2A files and hashes as the predecessor checkpoint. Do not reset, restage, rewrite or absorb P2A acceptance artifacts merely to obtain a clean tree.

### 2.2 Verified high-risk facts

- Project CRUD is available at `/api/core/projects/`; list order is backend-owned and the serializer exposes `id`, `name`, `description`, `prompt`, `work_dir`, `created_at`.
- Project names are required and unique. Description, prompt and work directory may be blank.
- `GET /api/core/projects/<id>/files/` is intentionally mixed:
  - uploaded `ProjectFile`: numeric `id`, `source: "web_upload"`;
  - Obsidian-synced `KnowledgeFragment`: string `id: "kf_<id>"`, `source: "obsidian_sync"`, no physical `file`.
- Current P1D V4 rejects every mixed list containing a string ID because `ProjectFileRow.id` and `fetchProjectFiles` require a number. This is a proven compatibility blocker for P2B Files reuse, not speculative hardening.
- Nested file deletion accepts a string path key. A `kf_` key deletes the matching synced fragment; a numeric key deletes the uploaded ProjectFile path.
- There is no reliable browser file-open/download contract: absolute backend storage paths can produce unusable media URLs and synced rows have no physical file. P2B therefore owns list/upload/delete, not open/download/preview.
- Project Knowledge is `memory.KnowledgeFragment`, distinct from `MemoryPlasmid` and `HistoryChunk`. Current runtime `GET /api/memory/knowledge/?project=<id>` returns a bare array; the apparent `page_size=50` is not activated by current DRF settings. P2B must not invent pagination.
- Knowledge detail PATCH supports `abstract` and `keywords`; success does not provide a complete replacement row, so the frontend must invalidate/refetch rather than fabricate it.
- Project deletion is handled by the backend's coordinated lifecycle service. Direct Project Conversations are re-homed to `Archived Project` / `Archived Chat`; surviving Project Knowledge is re-homed to `Archived Project`. Filesystem rollback/cleanup has explicit caveats and must not be presented as perfectly atomic.
- `delete-preview` reports direct Conversation count and uploaded ProjectFile rows only. It does not enumerate all Knowledge, synced fragments or every filesystem condition.

### 2.3 Authority

1. `Plan/V4_Spec_Freeze_Index.md`;
2. `Plan/V4_Master_Implementation_Roadmap.md` §8 and capability matrix;
3. `Plan/ExoCore_V4_Single_SPA_Architecture_Spec.md` §§5.3–5.5 and acceptance principles;
4. `Plan/V4_Page_Skeleton.md` Chat hierarchy;
5. accepted C1 and P2A source/evidence;
6. current frontend/backend source and `ReactSheet.md` where it matches runtime truth.

Product semantics outrank V3 presentation. Current source outranks stale endpoint comments. A contract conflict must be reported; it must not be hidden behind permissive parsing or empty UI.

### 2.4 Minimum targeted source check before construction

Before editing, the Builder trusts the accepted Scout/review facts and reads only the current definitions it will modify or directly reuse; it does not re-scout V3 or the backend:

- V4 `router.tsx`, shell navigation/focused-route projection and Chat Home entry;
- Project/Conversation DTOs and adapters in `features/chat/{types,api,queries}` and `features/chat/control/{types,api,queries}`;
- current `CreateConversationDialog`, its mutation and both accepted Home/Profile call sites;
- `features/chat/project/ProjectFilesDrawer.tsx` and `test/p1d_project_api.test.ts` as the exact existing mixed-ID consumer/regression surface;
- P2A Agent projection patterns only where Project label/filter behavior needs alignment;
- shared Project/Knowledge endpoint wrappers and the exact `ReactSheet.md` sections to be corrected;
- only when an adapter is about to be written or a signature appears to have drifted, the exact backend read-only definition in `ProjectViewSet`, `ProjectFileViewSet`, `ProjectSerializer`, `ProjectLifecycleService` or Knowledge list/detail views.

Stop on observed drift in serializer fields, mixed file IDs, Knowledge envelope/PATCH fields, delete-preview, lifecycle outcomes or canonical creation behavior. Do not repeat broad contract research, compensate with guessed aliases or add broader validation.

---

## 3. Frozen product and architecture decisions

### D1 — P2B owns the complete Project lifecycle

**Decision:** Project create, edit and delete are included in P2B. They are not deferred to Settings. `[gpt-5.6-sol / Solaire]`

Project lifecycle is part of Project domain ownership, and the current backend contract is usable. Deferring it would leave an ownership vacuum and prevent Project capability transfer. P2B adds no backend fields or lifecycle semantics.

### D2 — Project Knowledge is an independent workspace section

**Decision:** Project Detail presents Files and Project Knowledge as separate, adjacent sections. Knowledge is not merged into the file list and is not deferred to P5. `[Alicia; gpt-5.6-sol / Solaire]`

- **Files** communicates reference source, file metadata and upload/delete operations.
- **Project Knowledge** communicates semantic title/source/tags/keywords/abstract and allows only `abstract`/`keywords` editing.
- `MemoryPlasmid` and `HistoryChunk` terminology, status and controls do not appear in this section.

The same Obsidian-origin fact may be represented by the backend in both contracts for different purposes. The UI labels each section's meaning rather than pretending the entities are one list.

Changing `abstract` starts backend asynchronous revectorization and may call the configured external embedding provider. The UI reports only that the summary was saved and background index refresh was started; it must not claim revectorization completed. This is success feedback, not a new status tracker. Frontend acceptance must exercise this path at the mocked HTTP boundary or in an isolated standard test database with the embedding provider stubbed, never by PATCHing Alicia's real KnowledgeFragment rows or triggering a paid provider call. `[opencode-go/deepseek-v4-flash / reviewer; gpt-5.6-sol / Solaire approved]`

### D3 — The P1D mixed-ID repair is included as a compatibility repair

**Decision:** widen `ProjectFileRow.id` to `number | string` and update the existing P1D file adapter to validate the verified ID forms without making `source` a second rejection gate. `[gemini / Alaric; opencode-go/deepseek-v4-flash / reviewer; gpt-5.6-sol / Solaire approved]`

This is required because a valid backend response currently crashes the accepted chat-local drawer before P2B can share that fact source. The minimum repair preserves positive numeric IDs and admits only the verified `kf_<positive integer>` string form; it is not permission to build a general coercion framework.

`source` remains presentation metadata rather than a second rejection gate. Known consistent pairs receive their normal labels; unknown or ID-inconsistent source values receive a neutral reference label while the verified ID still determines deletion routing. Do not reject an otherwise usable row solely because a future source label is unfamiliar. `[opencode-go/deepseek-v4-flash / reviewer; gpt-5.6-sol / Solaire approved]`

C1/P1D impact is explicit: the canonical Chat Project drawer must continue to load uploaded-only projects, and now must also render mixed synced rows without contract failure. Existing chat-local behavior remains read-only.

### D4 — Project Conversations are a shared-cache lens

**Decision:** Project Detail consumes `queryKeys.conversations` and selects rows whose normalized `projectId` exactly equals the current Project ID. Drift is naturally excluded. All/Agent filtering is synchronously derived from those rows. `[gemini / Alaric; gpt-5.6-sol / Solaire]`

Agent choices are deduplicated by positive `agentPresetId`; visible preset data supplies names where available, with truthful `Agent #<id>` fallback. Filter selection falls back to All if its final source row disappears after a successful data replacement, and remains All if that Agent later returns until the user selects it again.

No Project-specific Conversation fetch, copied cache, localStorage index or server filtering handoff is introduced.

### D5 — Conversation creation reuses the one dialog with fixed Project identity

**Decision:** extend the accepted `CreateConversationDialog` with a narrow `fixedProject` mode, parallel to its accepted `fixedPreset` mode. `[gemini / Alaric; gpt-5.6-sol / Solaire]`

- Project Detail supplies the already validated Project.
- Project is non-editable and Drift is unavailable in fixed mode.
- Agent remains selectable.
- g045 extension-project behavior, duplicate/ambiguous write locks, shared invalidation and canonical navigation remain owned by the existing mutation/dialog.
- Submit-time request identity is captured; later route changes or dialog closure cannot rewrite the body or navigate a new origin.

No second form, mutation, response schema or chat route is created.

### D6 — File operations do not imply file opening

**Decision:** P2B exposes list, upload and delete only. It does not render a broken “Open”, “Download” or content-preview control. `[gpt-5.6-sol / Solaire]`

Rows show source (`Web upload` / `Obsidian sync`) and available metadata. Synced rows explicitly state that no physical browser file is available. A future reliable HTTP file-serving contract is an adjacent backend concern, not a P2B blocker.

### D7 — Project deletion uses preview plus deliberate recovery choices

**Decision:** deletion first obtains `delete-preview`, then presents:

- direct Conversations that will be archived;
- uploaded files known to the preview;
- per-upload choice to copy the physical file into backend recovery storage before deleting the Project;
- clear copy that all ProjectFile database rows disappear, recovered files become detached files, and surviving Knowledge/Conversations move to archive owners.

Unchecked is the default; the final request always sends an explicit JSON `keep_file_ids` array, even when empty. Only numeric uploaded-file IDs from that confirmation session's successful preview can enter the array. `kf_` rows never enter lifecycle `keep_file_ids`. Reopening the confirmation creates a fresh session with no recovery choices selected; if preview loading is retried or replaced within a session, choices also reset. An older late preview cannot overwrite the current session. A failed DELETE does not auto-submit again.

The recovery picker exceeds V3 parity but exposes an already implemented backend safeguard against irreversible file loss. The existing audit `docs/superpowers/specs/2026-07-03-backend-session-delete-and-project-audit.md` also records that V3 omitted the DELETE body and used misleading deletion copy. Alicia explicitly ratifies this small product addition for P2B; it is not precedent for surfacing every dormant backend option. `[opencode-go/deepseek-v4-flash / reviewer; Alicia approved; gpt-5.6-sol / Solaire]`

The UI must not claim the preview is exhaustive, that recovered names are unchanged, or that a failed `file_rollback_failed` leaves filesystem state untouched. Ordinary 4xx/5xx failures retain the current Project page and show the backend error/code. On 204, invalidate affected Project, Project list, Conversation, file and Knowledge queries, then navigate to `/projects`.

### D8 — Canonical routes and Chat-area ownership

**Decision:** V4 owns `/projects` and `/projects/:projectId`. Chat Home provides the secondary entry to Project Hub. Project routes remain in the Chat product area's active navigation state; the focused mobile primary bar is hidden on Project Detail under the same shell policy as Agent Profile. `[gpt-5.6-sol / Solaire]`

No V4 alias is added for V3's singular `/project/:id` route.

### D9 — Project Hub has no speculative search or pagination

**Decision:** render the backend array in backend order, with a derived Conversation count per Project from the shared collection. No search, sorting preference, drag order or pagination is added. `[gpt-5.6-sol / Solaire]`

A Conversation-query failure does not block Project cards; counts become explicitly unavailable rather than false zero. Creating or updating invalidates the Project list; creation navigates directly to the returned Project detail and does not depend on a second local list state.

---

## 4. Scope boundary

### 4.1 Included

- `/projects` Project Hub and `/projects/:projectId` Project Detail.
- Chat Home Project entry and Chat-area active/focused-detail shell behavior.
- Typed V4 Project list/detail/create/update/delete-preview/delete adapters and Query/mutation owners.
- Project Hub loading/error/retry/empty states and derived Conversation counts.
- Project create and edit flows for `name`, `description`, `prompt`, `work_dir`.
- Fixed-Project reuse of canonical Conversation creation.
- Current-Project Conversation lens with All/Agent filter and canonical row links.
- P1D mixed ProjectFile ID compatibility repair.
- Workspace file list, upload and mixed-ID deletion.
- Separate Project Knowledge list and `abstract`/`keywords` editing.
- Project deletion preview, explicit recovery choices and archive-aware confirmation.
- Responsive/focus/long-content behavior, focused tests and construction evidence.
- Focused `ReactSheet.md` correction for the P2B contracts actually consumed: Project fields/order limits, mixed Files rows/delete-preview/delete body, and current Knowledge envelope/PATCH fields.

### 4.2 Excluded

- Backend production edits, new endpoints, schema/migration changes or new dependencies.
- Generic Agent/Project “Workspace framework”, generic CRUD framework or global form store.
- Agent configuration/editing; AgentPreset lifecycle or visibility changes.
- GroupChat, Settings, notifications, account/profile shell, River, Collection, MemoryPlasmid, History or Recall.
- Server-side Conversation filtering/pagination, Project search/pagination or custom ordering.
- File open/download/content preview; browser-local filesystem access; browsing, creating, renaming or modifying actual directories/files under `work_dir`; directory existence probes or path pickers. Editing the Project's stored `work_dir` configuration string remains included.
- Independent Project Knowledge create/delete controls, content editing, embedding controls, revectorization status UI, search or pagination. Uploading/deleting Files retains its verified Knowledge create/delete side effects.
- Optimistic Project/Knowledge deletion, offline mutation queues, cross-tab write locks or generalized cancellation infrastructure.
- Changes to V3 pages, backend lifecycle behavior, archive target semantics or `frozen_project_ids` cleanup.
- Correcting unrelated stale `ReactSheet.md` sections unless the exact P2B contract text is touched and current source proves the correction.

### 4.3 Explicit successor ownership

P2B leaves no Project ownership vacuum. After P2B PASS, Project Hub/Detail, Project lifecycle, workspace files and Project Knowledge entry are ready for the eventual full C2 transfer. Remaining P2 owners are:

- Agent configuration/management micro-slice: preset PATCH-capable fields and its independent contract/UX gate;
- Groups slice: Group list/room/runtime;
- remaining core-shell slice: Settings, user/account entry, notifications and cross-page shell behavior;
- full C2 acceptance: transfers the remaining P2 capabilities together.

P5 may later show Project Knowledge alongside other Library concepts only while preserving its distinct name/entity/operations; P5 does not replace or take over this P2 Project workspace section.

---

## 5. Architecture and state ownership

### 5.1 Feature boundary

Expected ownership, subject to small leaf-file consolidation:

```text
features/projects/
  api/types/queries          guarded Project, lifecycle and Knowledge boundaries
  projection                Project Conversation / Agent option derivation only if reuse warrants it
  ProjectHubPage             list + create entry
  ProjectDetailPage          Project coordinator
  project-local dialogs      edit, file upload/delete, Knowledge edit, Project delete
  projects.css               Project-only visual rules

features/chat/control/
  existing ProjectFileRow + adapter admit verified mixed IDs

features/chat/
  existing Conversation Query and create mutation remain canonical
  CreateConversationDialog gains fixedProject mode

app/router + shell/navigation
  route exposure and Chat-area active/focused-detail projection
```

Do not create one component/hook per section merely to match this diagram. Split only where mutation state, focus ownership or independent error boundaries justify it.

### 5.2 Query keys and invalidation

Use one canonical key family per backend fact:

- Projects list;
- Project detail by positive ID;
- Project files by positive Project ID — shared with the P1D chat-local owner rather than duplicated;
- Project Knowledge by positive Project ID; the list row already owns the editable abstract/keywords, so no Knowledge-detail Query is created by default;
- existing global Conversations and visible Presets.

A Knowledge-detail Query may be added only if construction-time contract drift proves the list no longer contains an edit-required field. Directory placement must not duplicate an existing canonical Projects list or Project-files owner.

Mutation effects:

- create Project: invalidate Projects; navigate to the confirmed returned ID;
- update Project: invalidate Projects and that Project detail;
- create Conversation: preserve the accepted shared Conversation invalidation/navigation owner;
- upload/delete file: invalidate both that Project's file query and Knowledge query because upload ingestion and either numeric/`kf_` deletion can create or remove fragments;
- edit Knowledge: invalidate that Project's Knowledge query and an existing affected detail only if such a cache already exists;
- delete Project success: invalidate the Projects collection, source Project detail/files/Knowledge, global Conversation collection, and existing cached Conversation detail/control or Knowledge-detail families whose represented ownership changed; then navigate to Hub.

The deletion result requirement is that every already-existing V4 cache whose represented Project/Agent/resource ownership changed is stale before its next consumption. Implementation must inspect the current key owners immediately before deletion work and use their appropriate family invalidation. Do not fetch hidden archive targets, create archive caches or migration maps, invalidate unrelated facts, or clear the entire QueryClient.

Do not optimistically fabricate server rows. Closing a dialog or switching Project suppresses obsolete local completion/error/navigation, but confirmed writes still perform shared cache invalidation.

### 5.3 Boundary guards

Keep guards proportional to actual risk:

- Project list must be a top-level array; Project detail/create/update must be an object with a positive numeric `id` and the verified serializer fields.
- File list must be a top-level array. IDs must be positive numbers or the verified `kf_<positive integer>` form. Unknown or ID-inconsistent `source` values use neutral presentation and do not alone turn a usable row into a contract error.
- Knowledge list must be a top-level array. Normalize only fields rendered/edited; do not build a general Knowledge validation framework.
- Delete preview must provide a non-negative Conversation count, array of numeric uploaded file summaries and non-negative total size.
- 204 operations must not attempt JSON parsing.
- Backend field errors and lifecycle `{error, code}` remain visible and are not converted to empty states.

### 5.4 Route and stale-origin rules

- Parse `projectId` as a positive base-10 integer; invalid syntax never issues Project/files/Knowledge requests.
- Missing Project (404) is distinct from network/contract failure.
- Detail, files and Knowledge are keyed by Project ID. Late Project A results must not render or mutate Project B.
- Route change resets Project-local Agent filter and closes/neutralizes mutation dialogs from the old origin.
- A mutation request captures Project ID and submitted values at submit time.
- No new global route store is needed; current router and Query ownership are sufficient.

### 5.5 Conversation presentation

Project Detail already supplies Project identity, so each Conversation row emphasizes:

- Conversation name and existing activity timestamp;
- Agent identity using visible preset name or `Agent #<id>` fallback;
- canonical link `/chat/<conversationId>`.

Rows preserve backend order. Positive Agent IDs are distinct even when names collide. Null/invalid Agent identity receives a truthful unavailable label and is included only under All; it does not create a selectable fake Agent option.

### 5.6 Files and Knowledge error independence

Project identity, Conversations, Files and Knowledge have independent loading/error/retry surfaces. A Files failure must not erase Knowledge or identity; a Knowledge failure must not claim “no knowledge”; a Conversation failure must not turn Project count/list into zero. Project-detail failure blocks child sections because their owner identity is unconfirmed.

---

## 6. User flows

### 6.1 Hub and create

1. Enter `/projects` from Chat Home.
2. Project list loads in backend order.
3. Each card shows name, optional description/work directory and Conversation count or explicit unavailable state.
4. “New Project” opens a focused dialog with required name and optional description, prompt and work directory.
5. Validation or network failure stays in the dialog with retry available.
6. Confirmed success invalidates the list and navigates exactly once to `/projects/<returned-id>`.
7. Closing or leaving before completion prevents stale local navigation/error, while a confirmed write still invalidates shared Project data.

### 6.2 Detail, edit and Conversations

1. Direct route loads exact Project detail.
2. The overview displays name, description, System Prompt and work directory; blank values are labelled honestly.
3. Edit opens a prefilled dialog. Save failure retains entered values and displays field/general errors; success refetches server truth.
4. “Start Conversation” opens the canonical dialog with Project fixed and Agent selectable.
5. All/Agent filters act only on current Project rows and never reorder them.
6. Conversation links enter the sole canonical Chat page.

### 6.3 Files

1. Files section shows uploaded and synced rows with source labels.
2. Upload accepts the existing backend multipart contract and reports pending/failure explicitly.
3. Delete confirmation names the selected row and source.
4. Numeric uploaded IDs and string `kf_` IDs pass unchanged to the nested delete endpoint.
5. Success invalidates/refetches both Files and Project Knowledge; failure keeps both displayed truths and shows the server outcome.
6. No row offers open/download when the contract cannot support it reliably.

### 6.4 Project Knowledge

1. Knowledge section lists current Project fragments separately from Files.
2. Each row shows title, source type and available tags/keywords/abstract without rendering full content.
3. Edit exposes only abstract and keywords using the backend's accepted representation.
4. Success invalidates/refetches the list; failure preserves editor input and existing displayed server truth.
5. An abstract-change success states that background index refresh started, not that it completed; keyword-only success makes no embedding claim.
6. Empty, failed and loading states remain distinct.

### 6.5 Delete Project

1. Delete action first fetches one successful preview for that confirmation session.
2. Confirmation explains archive behavior and preview limitations.
3. Each previewed uploaded file may be selected for detached recovery; every reopen or replacement preview starts unselected and late results from an older session are ignored.
4. Final confirmation sends explicit JSON `keep_file_ids` from that preview only.
5. While pending, duplicate submission is blocked; failure never auto-retries the DELETE.
6. On 204, navigate to Hub only after all existing affected cache families are marked stale.
7. On error, remain on Project Detail and display backend message/code. For `file_rollback_failed`, explicitly warn that manual filesystem inspection may be needed; do not claim a clean rollback.

---

## 7. Construction stages and holds

P2B construction is serial. A stage may proceed after its checkpoint passes the acceptance loop Alicia assigned; no repeated product approval is needed unless scope or product semantics change. Intermediate checkpoints run focused behavior and only the layout observations relevant to that stage. The complete app suite and dev/production five-width browser matrix run once on the final candidate at CP4, not mechanically after every stage.

Planned allocation is DeepSeek for Stages A/B/D and Sol for the narrow high-risk Stage C. Alicia activates or changes panes; this Plan does not dispatch them. Files shared across owners are handed off serially, never edited concurrently. Final acceptance remains owned by a fresh independent reviewer, preferably Astra when available. The Planner or a Stage C Sol Builder does not self-accept.

### Stage A — Project foundation and ordinary create/edit `[deepseek / Builder planned]`

Implement:

- routes, Chat Home entry and shell active/focused behavior;
- one canonical Project list/detail boundary;
- Project Hub and Project Detail overview;
- shared Conversation lens and All/Agent filtering;
- Project create/edit mutations and dialogs, including the stored `work_dir` string;
- explicit loading/error/retry/empty/direct-route and stale-origin behavior.

**CP1 hold — identity and state isolation:** Hub/detail/direct routes, counts, Project Conversation lens, filter persistence/fallback and ordinary create/edit must pass. No fixed-Project Conversation creation, Files/Knowledge mutations or Project deletion is exposed yet.

### Stage B — Files and Project Knowledge resource closure `[deepseek / Builder planned]`

Implement in one stage:

- mixed ProjectFile ID compatibility repair in the existing P1D boundary;
- workspace Files list/upload/numeric-or-`kf_` deletion;
- Project Knowledge list and abstract/keywords editing using list-row data by default;
- visible Files→Knowledge invalidation through both mounted consumers;
- focused `ReactSheet.md` reconciliation for the contracts now consumed.

**CP2 hold — the two resource views cannot contradict each other:** uploaded-only, synced-only and mixed rows; both deletion paths; upload; Knowledge editing; independent errors; provider-safe verification; and the P1D read-only drawer regression must pass before shared creation or destructive Project deletion begins.

### Stage C — Shared creation compatibility and archival deletion `[gpt / Sol Builder planned]`

Implement serially inside one work period:

1. fixed-Project integration in the accepted canonical create dialog and focused P1A/P2A compatibility checks;
2. only after creation checks are clean, delete-preview, fresh-session recovery choices, explicit DELETE body, affected-cache invalidation, error classes and post-success navigation.

**CP3 hold — predecessor compatibility and irreversible write:** Home selectable, Agent fixed and Project fixed creation paths remain correct; Project deletion uses only its current preview, refreshes every existing changed ownership/resource cache family, distinguishes `file_rollback_failed`, and makes no false rollback/archive promise. Stage C reports facts to the designated independent chain and does not self-award PASS.

### Stage D — Visual, regression and evidence closeout `[deepseek / Builder planned]`

Implement only final-candidate corrections within approved Project-owned styles/components, then finish:

- responsive long-content, focus, keyboard, scrolling and action reachability;
- remaining exact API-document wording;
- the single Construction Evidence checkpoint matrix and scope/ownership scan;
- complete app and dev/production five-width verification.

**CP4 / P2B final hold:** all §8 targets must pass independently with factual test/build/browser totals and explicit omissions. This does not authorize C2, commit, production cutover or another P2 slice by implication.

### Escalation triggers

Stop and ask Alicia before proceeding if:

- a reliable Files operation requires backend changes or a new serving endpoint;
- Knowledge runtime shape is paginated or materially differs from the verified bare array;
- delete-preview/lifecycle behavior no longer matches §2/D7;
- fixed-Project reuse requires a second mutation/schema or invalidates accepted P2A locking semantics;
- a Project requirement requires AgentPreset writes, V3 edits or a generic Workspace framework;
- construction needs to edit Acceptance-owned P2A artifacts or another active pane's scope.

---

## 8. Binary acceptance targets

These are verification targets/interfaces only. Test implementation details remain owned by Construction and the independent reviewer separately.

### 8.1 Baseline, ownership and scope

- [ ] Opening and closing real `AgentPreset` baseline is exactly IDs 1–8.
- [ ] P2A accepted files/artifacts are preserved except explicitly authorized shared integration files.
- [ ] No backend/V3/dependency edit and no new canonical Chat implementation exists.
- [ ] No generic Workspace/CRUD framework, Project search/pagination or file-open promise was introduced.
- [ ] Changed API/query owners are unique; source scans find no duplicate Project mutation or Conversation collection.
- [ ] `ReactSheet.md` matches the exact Project/Files/Knowledge contracts consumed by P2B without unrelated API-document churn.

### 8.2 Hub and routes

- [ ] `/projects` and positive `/projects/:projectId` are reachable from V4 navigation and direct loads.
- [ ] Project routes keep Chat active; mobile focused-detail behavior matches frozen shell policy.
- [ ] Hub preserves backend Project order and never surfaces Archived Project.
- [ ] Loading, true empty, malformed success, network failure and retry are distinguishable.
- [ ] Conversation-count failure is not displayed as zero and does not erase Project cards.
- [ ] Invalid route ID performs no child requests; 404 and request failure are distinct.

### 8.3 Project create/edit

- [ ] Create sends only supported fields, handles required/duplicate name errors and navigates once using confirmed returned ID.
- [ ] Close/route-switch late success, ordinary failure and malformed success do not alter a newer dialog/page; confirmed writes still invalidate shared data.
- [ ] Edit preserves blank allowed fields, including the stored `work_dir` string, shows field/general errors and refetches server truth after success; it performs no directory probe or filesystem operation.
- [ ] Concurrent duplicate submit is blocked without permanent lock after definite failure.

### 8.4 Project Conversation lens and creation

- [ ] Only rows with exact current positive `projectId` appear; Drift and other Projects never leak in.
- [ ] Backend Conversation order is preserved under All and Agent filters.
- [ ] Agent options derive from current Project rows, dedupe by ID and use truthful name fallback.
- [ ] A selected Agent removed by successful data replacement falls back persistently to All; pending/failed refetch alone does not erase a still-valid selection.
- [ ] Route A→B resets local filter and rejects late A-local rendering.
- [ ] Fixed-Project creation shows no Drift/project selector, leaves Agent selectable and sends the exact Project and Agent captured at submit time.
- [ ] Standard/g045 creation, extension Projects, ambiguous writes, close/switch behavior, shared invalidation and canonical `/chat/:id` navigation retain accepted P2A behavior.

### 8.5 Files and C1 compatibility

- [ ] Uploaded-only, synced-only and mixed file arrays all load without a false contract error.
- [ ] Invalid ID shapes and malformed top-level responses remain explicit contract failures; unfamiliar or ID-inconsistent source metadata renders neutrally rather than crashing the whole list.
- [ ] The accepted chat-local P1D drawer renders mixed IDs read-only without regression.
- [ ] Upload uses the existing multipart contract; success invalidates/refetches both Files and Project Knowledge, while failure remains visible.
- [ ] Numeric and `kf_` delete keys reach the correct nested endpoint unchanged; success invalidates/refetches both sections, failure retains the row and current Knowledge truth.
- [ ] No Open/Download/Preview action is exposed for unreliable URLs or synced rows.
- [ ] Files error/loading/empty state does not erase Project, Conversations or Knowledge.

### 8.6 Project Knowledge

- [ ] Knowledge request uses the current Project filter and accepts the verified bare-array runtime shape without invented pagination.
- [ ] Loading, empty, malformed success, network failure and retry are distinct.
- [ ] Files and Project Knowledge are visibly and semantically separate.
- [ ] Only abstract and keywords are editable; full content, MemoryPlasmid/History controls and create/delete are absent.
- [ ] PATCH success refetches server truth; ordinary/field failure preserves user input and prior displayed truth.
- [ ] Abstract-change success communicates only saved + background index refresh started; keyword-only success does not claim revectorization.
- [ ] Abstract PATCH verification uses mocked HTTP or an isolated standard test database with the embedding provider stubbed; no real-user fragment or paid provider is touched.
- [ ] Route switch and close prevent stale local completion from updating another Project.

### 8.7 Project deletion

- [ ] Delete always obtains a current preview before confirmation.
- [ ] Preview copy states direct Conversation archive behavior and does not claim exhaustive Knowledge/filesystem coverage.
- [ ] Recovery controls include only numeric uploaded IDs from the current successful preview; every reopen or replacement preview starts with none selected, and an older late preview cannot overwrite the new session.
- [ ] Final DELETE sends explicit JSON `keep_file_ids`, including an explicit empty array; failure never auto-retries deletion.
- [ ] Confirmation truthfully states recovered files are detached backend recovery copies and all ProjectFile rows disappear.
- [ ] Pending duplicate deletion is blocked.
- [ ] On 204, every existing V4 cache representing changed Project/Agent/resource ownership is stale before its next consumption: Projects collection, global Conversations, source detail/files/Knowledge, and existing affected Conversation control/detail or Knowledge-detail families; navigation occurs once to `/projects`.
- [ ] Deletion does not fetch/cache hidden archive targets, invent a migration map, invalidate unrelated facts or clear the whole QueryClient.
- [ ] 400/404/409/500/503 retain the Project page and expose backend message/code; `file_rollback_failed` has the stronger manual-inspection warning.
- [ ] No UI claims Conversations are erased, recovered names are guaranteed, or preview is transactional.

### 8.8 Responsive, accessibility and quality

At 320, 390, 767, 768 and 1280 CSS pixels:

- [ ] no document-level horizontal overflow in Hub, Detail or open dialogs;
- [ ] long Project/Conversation/Agent/file/Knowledge names and unbroken paths do not hide actions;
- [ ] System Prompt, description, abstract and keywords wrap without forcing the viewport wider;
- [ ] primary actions and destructive confirmations remain reachable by scroll and are not covered by fixed navigation/safe areas;
- [ ] dialogs establish focus, trap/restore it according to existing app patterns and close via Escape when safe;
- [ ] controls have accessible names, selected filter state is not color-only and destructive/recovery copy is associated with its controls;
- [ ] reduced-motion and existing shell breakpoints remain intact.

Quality pipeline:

- [ ] focused P2B construction tests pass with numeric totals;
- [ ] fresh independent acceptance probes pass with separately reported totals;
- [ ] complete `exo-app` test suite passes;
- [ ] `exo-app` typecheck, lint and production build pass;
- [ ] `git diff --check` and staged whitespace check pass;
- [ ] browser evidence covers dev and production bundle at all frozen widths;
- [ ] no paid provider call, real AgentPreset mutation, real-user KnowledgeFragment mutation or real-database fixture creation occurs.

---

## 9. Construction evidence and handoff

Construction maintains one separate `Plan/V4_Phase_2B_Construction_Evidence.md`. This is also the single builder-workflow checkpoint/matrix record; do not create parallel stage evidence files or restate the full dirty manifest in every handoff. It records facts, not verdicts:

- entry HEAD and complete dirty manifest ownership;
- exact changed files/symbols and stage mapping;
- endpoint/source drift discovered before edits;
- request/response cases exercised and numeric results;
- C1/P1D and P2A regression impact;
- focused intermediate observations and one final responsive/browser matrix with screenshot paths; screenshots prove layout, not mutation semantics;
- source searches proving absent duplicate owners/forbidden scope;
- omissions, environment limitations and adjacent issues;
- opening/closing real DB baseline results.

The independent reviewer writes and owns separate acceptance artifacts. Construction must not copy, edit or depend on raw independent test implementation. A PASS must state checked/passed/failed/not-checked counts and unresolved P0/P1 findings; “tests green” alone is insufficient.

---

## 10. Rollback and failure behavior

- Before P2B PASS, Project capabilities remain V3-primary; V4 Project routes can be removed without affecting accepted canonical Chat or P2A Agent behavior.
- Rollback removes P2B route exposure and Project-owned feature files, then restores only the shared-file deltas introduced by P2B. It does not reset or rewrite the accepted P2A working tree.
- Backend writes already confirmed before a frontend rollback remain real. Rollback must not delete created Projects/files/Knowledge to make the frontend tree look clean.
- A Project deletion is not frontend-reversible. Acceptance must use isolated test fixtures or controlled backend test data, never real AgentPreset lifecycle changes.
- If a stage fails, retain the last accepted checkpoint and repair only the failed invariant plus directly affected siblings before rerunning broader regression.

---

## 11. Adversarial razor / ablation result

Performed by `[gpt-5.6-sol / Solaire]`, challenged by `[opencode-go/deepseek-v4-flash / reviewer]`, then re-applied through the execution-ablation review after Alicia's product check.

### Kept because required or explicitly ratified

- Project CRUD: without it, Project domain ownership remains incomplete and unassigned.
- Separate Project Knowledge section: explicitly owned by P2 and semantically distinct from Files/P5 Memory.
- Mixed-ID repair: proven current backend incompatibility affecting both P2B and accepted P1D reuse.
- Files→Knowledge invalidation: required to prevent contradictory live sections after upload or either deletion path.
- Abstract edit with provider-safe verification: required product operation, without paid-call or real-user-data side effects during frontend acceptance.
- Delete preview/recovery selection: exceeds V3 parity but is explicitly ratified by Alicia because deletion is irreversible and the backend safeguard already exists.
- Fixed-Project create mode and shared Conversation lens: required Project workspace paths while preserving the canonical owners.

### Removed or rejected

- strict `source`↔ID cross-validation as a whole-list failure; valid ID forms remain checked and unfamiliar source metadata degrades neutrally;
- a default Knowledge-detail Query when list rows already contain all edit fields;
- repeated V3/backend scouting, duplicate evidence files, per-stage full-app reruns and per-stage five-width dual-environment screenshot matrices;
- generic Workspace/CRUD framework;
- Project search, custom sort and pagination;
- file open/download/preview workaround;
- Knowledge content editor, create/delete, search and fake pagination;
- optimistic cache fabrication or offline/cross-tab mutation machinery;
- backend changes to improve deletion preview or file serving;
- additional Project statistics, dashboards, activity feeds or Agent permission management;
- visual symmetry requirements copied from Agent Profile.

### Adjacent issues, not P2B scope

- reliable authenticated HTTP file serving/opening;
- richer deletion preview covering all Knowledge and filesystem preflight;
- cleanup of stale `Conversation.frozen_project_ids` after Project deletion;
- visibility of backend cleanup warnings after a 204;
- server-side Project/Conversation filtering if real volume later proves current client projection inadequate;
- cleanup of the stale Knowledge pagination wording in the backend view docstring/unused `page_size` declaration; `ReactSheet.md` already depicts the list as a bare array.

**Razor verdict:** the Plan is the minimum complete Project ownership slice supported by current contracts. Further hardening requires a demonstrated failure or Alicia's explicit scope approval.
