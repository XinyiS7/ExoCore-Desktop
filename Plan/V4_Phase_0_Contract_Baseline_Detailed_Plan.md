# ExoCore V4 — Phase 0 Contract & Baseline Detailed Plan

> **Document type:** P0 executable documentation plan; no product implementation.  
> **Status:** Revised after P0 Detailed Plan R1 — ready for approval.  
> **Repository:** `ExoCore-Desktop`; `ExoCore` is read-only evidence only.  
> **Upstream:** `Plan/V4_Master_Implementation_Roadmap.md` §6 and C0.  
> **Author:** gpt-5.6-sol / Solaire — 2026-09-02.  
> **Product owner:** Alicia.  

---

## 1. Goal and acceptance intent

Phase 0 creates a reproducible fact base from which P1A can be planned and accepted. It does **not** create any V4 runtime or transfer any capability ownership.

P0 must produce five outcomes:

1. a reproducible V3 build/start/test/dirty-worktree baseline for `chat-core`, `chronicle`, and `council`;
2. a canonical, source-grounded API snapshot for the interfaces needed by V4;
3. a frozen V3 capability ownership matrix, including P1A–P1D takeover and rollback owners;
4. an exact side-by-side package/runtime/deployment contract for future V4 work;
5. four independent backend handoff briefs B1–B4.

C0 is binary: either every required artifact and hard invariant below is satisfied, or P0 is **FAIL** and P1A planning remains locked.

---

## 2. Non-negotiable scope boundary

### 2.1 Allowed work

- Read frontend/backend source, URL configuration, serializers, tests, build configuration, and frozen Specs.
- Run read-only environment checks, frontend builds/lint/tests, and backend checks/tests using Django's test database.
- Create the P0 evidence and handoff documents listed in §4.
- Correct only source-proven contract errors in `ReactSheet.md` for the P0 API families.
- Record known failures without fixing them.

### 2.2 Explicitly forbidden in P0

- **Do not create `packages/app`, any other V4 package, V4 routes, components, hooks, CSS, tests, or placeholder files.**
- **Do not modify backend production code, models, migrations, settings, API views, serializers, services, or backend tests.** `../ExoCore/` is read-only for this frontend-repository task.
- Do not modify root/package scripts, Vite configs, nginx, `hybrid_start.ps1`, lockfiles, or deployment configuration.
- Do not run write probes against the real database. No real Conversation, GroupChat, Task, MemoryPlasmid, attachment, push subscription, or preset may be created, edited, or deleted.
- Never create/delete an `AgentPreset`, rewrite a preset primary key, disable the protection trigger, or expose secrets/personal payloads in evidence.
- Do not fix V3 lint/test/runtime bugs, refactor `ChatArea`, or begin P1A.
- Do not write source-level plans for P1B or later phases.
- Do not implement B1–B4 in either repository; P0 creates requirement briefs only.

If a command reveals a defect, record it in the baseline with classification and owner. Stop rather than widening P0 into a repair campaign.

---

## 3. Authority and conflict rule

Use two independent evidence chains:

- **Product meaning:** `V4_Spec_Freeze_Index.md` → interaction Spec → architecture Spec → page skeleton → questionnaire.
- **Implementation fact:** current backend/frontend source and URL configuration → accepted tests/runtime evidence → `ReactSheet.md` and historical documents.

A product/source conflict becomes a contract issue or backend handoff item. Neither side silently overwrites the other.

For API facts, this precedence is mandatory:

1. mounted Django URL configuration;
2. active view/service and serializer/model behavior;
3. accepted backend tests;
4. active frontend consumer/wrapper behavior;
5. `ReactSheet.md` wording.

Known mismatches that P0 must explicitly resolve include:

- canonical Conversation creation is currently `POST /api/agents/sessions/init/`; `POST /api/agents/conversations/` and the shared `createConversation()` wrapper must not be assumed valid;
- GroupChat messages use `/api/groupchat/<id>/messages/` and broadcast uses `/broadcast/`; do not preserve the stale `/send/` description;
- Task source fields use `entry_type` and current serializer fields, not the legacy `type/recurrence/priority` shape;
- push URL configuration currently exposes subscribe/unsubscribe only; a fabricated `GET /api/push/notifications/` must not enter the snapshot. In-app notification delivery and Register acknowledgement are separate surfaces.

These corrections are documentation work only; P0 must not repair stale consumers.

---

## 4. Deliverables and file changes

### 4.1 Create

| Path | Required content |
|---|---|
| `Plan/V4_Phase_0_Baseline/README.md` | artifact index, evidence timestamp/commit, outcome summary, known blockers, final C0 checklist and sign-off |
| `Plan/V4_Phase_0_Baseline/V3_Baseline.md` | environment/worktree snapshot; build/start/lint/test results per SPA; council classification; known-failure ledger |
| `Plan/V4_Phase_0_Baseline/Canonical_API_Snapshot.json` | machine-readable canonical API snapshot in the schema frozen by §8 |
| `Plan/V4_Phase_0_Baseline/V3_Capability_Ownership.md` | frozen ownership matrix, P1A–P1D mapping, transfer condition and rollback owner |
| `Plan/V4_Phase_0_Baseline/V4_Side_by_Side_Contract.md` | future package name/location, ports/base paths, coexistence, PWA/storage isolation, checkpoint and rollback rules |
| `docs/superpowers/specs/2026-09-02-v4-b1-collection-storage-attachment-provenance-handoff.md` | B1 requirement brief |
| `docs/superpowers/specs/2026-09-02-v4-b2-river-aggregation-handoff.md` | B2 requirement brief |
| `docs/superpowers/specs/2026-09-02-v4-b3-memory-search-filter-handoff.md` | B3 requirement brief |
| `docs/superpowers/specs/2026-09-02-v4-b4-recall-observability-handoff.md` | B4 requirement brief |

### 4.2 Modify

| Path | Allowed modification |
|---|---|
| `ReactSheet.md` | only source-proven corrections for Conversation/messages/runtime, GroupChat, attachments/audio, Tasks, Memory, and notifications; add provenance/as-of reference to the P0 snapshot |

### 4.3 Delete

None.

### 4.4 Evidence hygiene

- Do not commit raw build logs, stack traces, API payload bodies, cookies, API keys, user message content, filenames, local storage paths, or database row dumps.
- Each command record contains: timestamp, working directory, command, exit code, concise result, and a stable failure fingerprint when applicable.
- Runtime/API evidence records only HTTP status, content type, top-level keys/field names, counts where non-sensitive, and redacted examples.
- Keep transient logs outside git; summarize only the evidence necessary to reproduce the result.

---

## 5. Source and configuration reading manifest

The P0 executor must read the following before writing the corresponding artifact. Symbols are used instead of fragile line numbers.

### 5.1 Frozen planning inputs

- `Plan/V4_Spec_Freeze_Index.md`
- `Plan/V4_Master_Implementation_Roadmap.md` — especially §§4, 6, 15–19
- `Plan/ExoCore_V4_Single_SPA_Architecture_Spec.md`
- `Plan/V4_River_Collection_Memory_Interaction_Spec.md`
- `Plan/V4_Page_Skeleton.md`
- `Plan/V4_Frontend_Refactor_Decision_Questionnaire.md` — rationale only
- `ReactSheet.md`

### 5.2 Workspace, build, routes, and deployment

- `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`
- `packages/{chat-core,chronicle,council,shared}/package.json`
- `packages/{chat-core,chronicle,council}/vite.config.js`
- `packages/{chat-core,chronicle,council}/src/main.jsx`
- `packages/{chat-core,chronicle,council}/src/App.jsx`
- `packages/chat-core/src/App.jsx` route table
- `packages/chronicle/src/App.jsx` route table
- `packages/council/src/App.jsx` stub state
- `../nginx/nginx.conf`
- `../hybrid_start.ps1`

### 5.3 Shared frontend transport and consumers

- `packages/shared/src/api.js` — relative base URL, credentials, CSRF, error normalization
- `packages/shared/src/endpoints/{agents,conversations,groupchat,tasks,memory,push,chronicle,heartbeat}.js`
- `packages/chat-core/src/components/chat/ChatArea.jsx`
- `packages/chat-core/src/hooks/usePollingChat.js`
- `packages/chat-core/src/utils/attachmentStorage.js`
- `packages/chat-core/src/components/chat/{AudioComposeBar,AudioPlayerBubble,ContextCacheIndicator,MessageBubble}.jsx`
- `packages/chat-core/src/views/{GroupchatList,GroupchatRoom,AgentMemory,MemoryConsole}.jsx`
- `packages/chronicle/src/hooks/useTimeline.js`
- `packages/chronicle/src/components/{TaskPanel,TaskRow,TaskCreateModal,CalendarWidget}.jsx`
- notification surfaces in all three packages: `src/main.jsx`, `src/contexts/NotificationContext.jsx`, `src/stores/notificationStore.js`, and service workers under each package's `public/`

### 5.4 Backend source — read only

Repository boundary: `../ExoCore/`.

**Root mounting**

- `ExoCore/urls.py`
- `agents/urls.py`, `groupchat/urls.py`, `tasks/urls.py`, `memory/urls.py`, `push/urls.py`

**Conversation, messages, attachments/audio, runtime**

- `agents/views.py`: `AgentChatView`, `ChatStreamStatusView`, `ChatStreamStopView`, `ConversationListView`, `ConversationDetailView`, `SessionAttachmentView`, `SessionAttachmentContentView`, `SessionAttachmentDeleteView`, `ConversationBranchView`, `ConversationCacheView`
- `agents/serializers.py`: `SuperiorSessionInitSerializer`, `ConversationSerializer`
- `memory/serializers.py`: `MessageSerializer`, `SessionAttachmentSerializer`
- `memory/models.py`: `Conversation`, `Message`, `SessionAttachment`, `HistoryChunk`
- `agents/streaming_buffer.py`, `agents/services.py`, `memory/services.py`
- relevant tests: `agents/tests/test_services.py`, `agents/tests/test_audio_attachments.py`, `agents/tests/acceptance/test_audio_attachment_contract.py`, `agents/tests/test_chat_artifacts_persistence.py`

**GroupChat**

- `groupchat/views.py`, `groupchat/serializers.py`, `groupchat/models.py`, `groupchat/services.py`
- `groupchat/tests/test_activity.py`, `groupchat/tests/test_broadcast_drawers.py`

**Tasks**

- `tasks/views.py`, `tasks/serializers.py`, `tasks/models.py`
- `tasks/tests/test_tasks.py`

**Memory**

- `memory/views.py`: `MemoryPlasmidListView`, `MemoryPlasmidDetailView`, `MemoryPlasmidTagsView`, `HistoryChunkListView`, `HistoryChunkDetailView`
- `memory/serializers.py`: `MemoryPlasmidSerializer`, `HistoryChunkSerializer`, `KnowledgeFragmentSerializer`
- `memory/models.py`: `MemoryPlasmid`, `HistoryChunk`, `KnowledgeFragment`
- `memory/tests/test_plasmid_lifecycle.py`

**Notifications**

- `push/views.py`, `push/serializers.py`, `push/models.py`
- `agents/views.py`: `RegisterAckView`
- `push/tests/test_prime_push.py`
- frontend notification/service-worker files listed in §5.3

---

## 6. Task 0 — Preflight, worktree lock, and safety record

### Actions

1. Confirm current frontend repository root, branch, HEAD, and worktree state.
2. Record the exact pre-existing frontend dirty file list. For the backend, record HEAD, the tracked/untracked status manifest, a hash of the complete tracked diff against HEAD, and a path-plus-content hash of all untracked files. Current sibling work must be treated as input, not normalized or overwritten.
3. Confirm Node, pnpm, and lockfile presence.
4. Confirm the real database AgentPreset baseline before any backend read/test command.
5. Check WezTerm panes only for concrete overlap on this Plan/baseline directory or exclusive service/port use. Do not broadcast status to idle or unrelated panes.

### Commands

Run from `ExoCore-Desktop` unless a command contains an explicit `cd`:

```bash
pwd -W
git rev-parse --show-toplevel
git branch --show-current
git rev-parse HEAD
git status --short
git diff --name-status
git ls-files --others --exclude-standard
git -C ../ExoCore rev-parse HEAD
git -C ../ExoCore status --short --untracked-files=all
git -C ../ExoCore diff --name-status HEAD
git -C ../ExoCore diff HEAD --binary --no-ext-diff | git hash-object --stdin
git -C ../ExoCore ls-files --others --exclude-standard
git -C ../ExoCore ls-files --others --exclude-standard -z | while IFS= read -r -d '' f; do printf '%s\0' "$f"; sha256sum "../ExoCore/$f"; done | sha256sum
node --version
pnpm --version
test -f pnpm-lock.yaml
cd ../ExoCore && bash .agent/check_real_db_baseline.sh
```

### Required result

- Repository is `D:/Alicia/ExoCore_Project/ExoCore-Desktop` on the intended branch/HEAD.
- Dirty and untracked inputs are recorded before P0 artifacts are added.
- Baseline script prints `OK: AgentPreset baseline 8 rows [1, 2, 3, 4, 5, 6, 7, 8]`.
- Any unexpected source change or preset baseline violation is a C0 blocker.

---

## 7. Task 1 — Capture the V3 build/start/test baseline

Write all summarized results to `Plan/V4_Phase_0_Baseline/V3_Baseline.md`.

### 7.1 Baseline record format

For every check, record:

| Field | Meaning |
|---|---|
| `surface` | chat-core / chronicle / council / workspace / backend support |
| `commit` | frontend HEAD from Task 0 |
| `dirty_context` | exact relevant pre-existing dirty files |
| `command` | exact command executed |
| `started_at` / `duration` | local timestamp and elapsed time |
| `exit_code` | integer |
| `result` | `PASS`, `KNOWN-DIRTY`, or `BLOCKER` |
| `fingerprint` | concise stable error/warning identity; never a full sensitive log |
| `owner` | current V3 owner or later takeover phase |
| `reproduction` | shortest command/path that reproduces it |

Classification is strict:

- `PASS`: command/path meets its target.
- `KNOWN-DIRTY`: reproducible pre-existing issue, non-blocking for C0/P1A, with owner and reason.
- `BLOCKER`: V3 cannot serve as a reliable P1A fallback, or the contract cannot be trusted.

A failure without classification is automatically `BLOCKER`.

### 7.2 Dependency integrity

```bash
pnpm install --frozen-lockfile
```

Expected: lockfile is accepted without tracked changes to `package.json`, `pnpm-lock.yaml`, or workspace configuration. Any lockfile mutation is a blocker and must not be staged.

### 7.3 Isolated builds and workspace build

```bash
pnpm --filter exo-chat-core build
pnpm --filter exo-chronicle build
pnpm --filter exo-council build
pnpm build
```

Verification targets:

- each command exits 0;
- each package produces `dist/index.html` and its configured PWA/service-worker artifacts;
- production bases remain `/chat/`, `/chronicle/`, and `/council/` respectively;
- the root recursive build can build the unchanged V3 workspace.

A build failure in any V3 SPA is a C0 blocker because side-by-side rollback would be untrustworthy.

### 7.4 Dev-server startup smoke

Start each command in a dedicated terminal/pane, probe it from a second terminal, then stop it with `Ctrl+C` before moving to the next package:

```bash
pnpm dev:chat -- --host 127.0.0.1 --strictPort
curl -fsS -I http://127.0.0.1:5173/

pnpm dev:chronicle -- --host 127.0.0.1 --strictPort
curl -fsS -I http://127.0.0.1:5174/

pnpm dev:council -- --host 127.0.0.1 --strictPort
curl -fsS -I http://127.0.0.1:5175/
```

Verification targets:

- each fixed port starts without falling through to another port;
- each root returns a successful HTML response;
- server shutdown releases its port;
- no source/config file changes are created.

Do not leave dev servers running after evidence capture.

### 7.5 Lint and existing frontend tests

```bash
pnpm --filter exo-chat-core lint
pnpm --filter exo-chronicle lint
pnpm --filter exo-council lint
pnpm --filter exo-chat-core test:run
```

- Record all four outcomes independently.
- `chat-core test:run` is a C0 hard check for the only existing frontend test suite.
- Lint failures may be `KNOWN-DIRTY` only when the exact fingerprint is reproducible, pre-existing, scoped, and assigned; new/unexplained failures are blockers.
- Chronicle and Council currently have no package test script. Record this as `NO_SUITE`, not as a false PASS and not as a requirement to add tests in P0.

### 7.6 Council status freeze

Record Council as one of exactly these states based on source and execution evidence:

- `deferred-stub-buildable` — expected current state: buildable/startable PWA shell, notification plumbing, “Coming in V3.1” surface, no implemented Council workspace;
- `implemented-baseline` — only if source proves real workflows exist;
- `broken-stub` — cannot build/start.

Council remains deferred regardless of backend Council endpoints. P0 must not mistake backend availability for a completed frontend.

### 7.7 Backend support checks

Run from `../ExoCore`:

```bash
bash .agent/check_real_db_baseline.sh
python.exe manage.py check
python.exe manage.py makemigrations --check --dry-run
python.exe manage.py test agents.tests.test_services.SessionAttachmentUploadContractTests agents.tests.test_audio_attachments agents.tests.acceptance.test_audio_attachment_contract groupchat.tests tasks.tests memory.tests.test_plasmid_lifecycle push.tests.test_prime_push -v 2
bash .agent/check_real_db_baseline.sh
```

Verification targets:

- both real-database baseline checks remain exactly 8 presets;
- Django check and migration drift check pass;
- focused tests run only against Django's test database and pass;
- no cloud LLM call or real database mutation is permitted;
- any test label that no longer exists must be corrected from current source before execution, not silently skipped.

### 7.8 Known-failure ledger

At minimum, classify:

- Task create's already reported V3 anomaly as a later P3 blocker/pending item unless current evidence disproves it;
- any current lint failures by package and rule;
- any stale shared wrapper/API documentation mismatch;
- Council's deferred stub status;
- any dirty working-tree input that prevents reproducible source attribution.

Known failures are not repaired in P0. A failure can remain non-blocking only if V3 fallback for P1A and the P0 contract remain trustworthy.

---

## 8. Task 2 — Produce the canonical API snapshot

Create `Plan/V4_Phase_0_Baseline/Canonical_API_Snapshot.json`, then make narrowly scoped corrections to `ReactSheet.md` where it conflicts with the accepted snapshot.

### 8.1 Snapshot format

The file must be valid UTF-8 JSON with this top-level structure. JSON is deliberate: P0 validates it with Node's built-in parser and therefore introduces no undeclared YAML parser dependency or new package. [opencode-go/deepseek-v4-flash / reviewer]

```text
snapshot_version
as_of
source_commits
product_authority
implementation_authority
transport_defaults
resources
mismatches
unavailable_or_deferred
```

Each `resources[]` entry must contain:

| Field | Required meaning |
|---|---|
| `id` | stable human-readable contract ID, e.g. `conversation.create` |
| `domain` | conversation / groupchat / attachment / runtime / task / memory / notification |
| `method` and `path` | exact mounted HTTP interface |
| `purpose` | one sentence |
| `auth_csrf` | cookie/credential and mutation-CSRF behavior |
| `path_params`, `query`, `request` | names, types, required/optional status, enums where source defines them |
| `success` | HTTP status, content type, response envelope, ordered field allowlist or stream event schema |
| `errors` | stable known statuses/codes; explicitly mark non-stable legacy errors |
| `semantics` | pagination/order/idempotency/ownership/lifecycle facts |
| `backend_sources` | URL, view/service, serializer/model symbols |
| `frontend_consumers` | shared wrapper and direct consumer paths |
| `evidence` | `source_verified`, `test_verified`, optional `runtime_read_verified` |
| `mismatch_refs` | links to stale wrapper/ReactSheet entries or empty list |
| `status` | `canonical`, `legacy`, `pending_backend`, or `consumer_mismatch` |

The snapshot must not embed full personal response examples. Schemas are field/envelope descriptions, not copied real rows.

### 8.2 Required API families

#### A. Conversation create/list/detail/messages

Freeze at least:

- `POST /api/agents/sessions/init/` as the current create path, including `preset_id`, optional `project_id=0`, optional `frozen_project_ids`, `thinking_level`, and returned session identity;
- `GET /api/agents/conversations/` list semantics and exact `agents.serializers.ConversationSerializer` fields;
- `GET/PATCH/DELETE /api/agents/conversations/<pk>/` behavior;
- `GET /api/agents/chat/<session_id>/?limit=&offset=` message history and `memory.serializers.MessageSerializer` fields;
- Drift representation: DB null project versus current frontend `project: 0` sentinel;
- no invented server-side Agent × Project pagination/filtering.

Explicitly record the stale `packages/shared/src/endpoints/conversations.js::createConversation()` POST path as a consumer mismatch; do not fix it in P0.

#### B. GroupChat

Freeze:

- list/create and detail/update/delete;
- `GET/POST /api/groupchat/<pk>/messages/`;
- `POST /api/groupchat/<pk>/broadcast/`;
- exact `name`, `prompt`, `participant_ids` and message fields from serializers;
- separate runtime/domain identity from ordinary Conversation.

#### C. Attachments and audio

Freeze:

- attachment list/upload endpoint and multipart keys;
- ordered `results` envelope, `ok | ok_degraded | failed`, partial success 201, all-failed 422, diagnostics, and fields that must never leave the server;
- audio `model` + `endpoint` preflight, accepted MIME/size boundary, stable error codes;
- audio `content_url` and same-conversation content endpoint behavior;
- batch delete body and conflict/not-found behavior;
- source limitations relevant to future B1 provenance.

#### D. SSE and async runtime

Freeze:

- message-history GET separately from chat POST;
- SSE POST mode, content type, event framing and current event names/payloads;
- async POST acknowledgement token;
- polling `message_id` + `cursor` response and terminal semantics;
- stop with and without `message_id`;
- edit/regenerate and branch request identities where current source defines them;
- typed provider error payload versus non-stable legacy errors.

Do not perform a paid/live model invocation merely to capture evidence. Source and existing tests are sufficient unless Alicia separately authorizes a live probe.

#### E. Tasks

Freeze current `ScheduleEntrySerializer`, CRUD, complete/suspend/resume, Google Calendar link/unlink, calendar snapshots, and completion history. Record actual enums/immutability and the known create anomaly separately from the declared contract.

#### F. Memory

Freeze MemoryPlasmid list/create/detail/tags, filters currently implemented, editable/read-only fields, processing lifecycle, HistoryChunk and KnowledgeFragment read/update surfaces. Mark B3 features that do not yet exist as `pending_backend`; never represent them as current endpoints.

#### G. Notifications

Separate three contracts:

1. Web Push subscription: `/api/push/subscribe/` and `/unsubscribe/`;
2. service-worker/browser delivery and local notification store behavior;
3. Register acknowledgement: `POST /api/agents/registers/<pk>/ack/`.

Explicitly list `GET /api/push/notifications/` as unavailable unless current mounted source proves otherwise.

### 8.3 Contract reconciliation

For every mismatch:

1. identify product expectation, source fact, frontend consumer fact, and old documentation claim;
2. choose the canonical current fact without changing runtime code;
3. assign any required code correction to its actual future phase or a separate bugfix;
4. update only the affected `ReactSheet.md` section;
5. include the mismatch ID in both JSON and the known-failure ledger.

No required API entry may end as `unknown`. A genuinely unresolved fact makes C0 FAIL.

---

## 9. Task 3 — Freeze V3 capability ownership

Create `Plan/V4_Phase_0_Baseline/V3_Capability_Ownership.md` by copying the Master Roadmap matrix as the starting set, then grounding every row in current frontend evidence.

### 9.1 Required columns

| Column | Requirement |
|---|---|
| `capability_id` | stable identifier |
| `user_path` | shortest user-visible path |
| `current_v3_owner` | package plus route/view/component/hook evidence |
| `baseline_status` | PASS / KNOWN-DIRTY / BLOCKER / DEFERRED-STUB |
| `disposition` | migrate / replace / defer / retire / new capability |
| `construction_gate` | P1A, P1B, P1C, P1D, P2…P8 |
| `ownership_transfer_gate` | C1 for all P1A–P1D Chat capabilities; later C gate otherwise |
| `minimum_transfer_condition` | observable behavior, not visual similarity |
| `fallback_owner` | concrete V3 route/package or disable-new-surface rule |
| `evidence_refs` | source and V3 baseline section |
| `known_gaps` | mismatch/failure IDs or empty |

### 9.2 Mandatory P1 mapping

- **P1A:** App shell/canonical route, Conversation create, Recent/list, message read path.
- **P1B:** send, SSE, async polling recovery, stop, regenerate/edit, branch.
- **P1C:** attachment and audio compose/upload/render/play/recovery.
- **P1D:** cache, endpoint/model/thinking, private memory, session history, Aura, chat-local project files, Thinking/Tool events in the generic `AssistantRunTrace`.

P1A–P1D construction checkpoints do not transfer production ownership. All remain `V3-primary` until unified C1 PASS.

### 9.3 Completeness rules

- Preserve every row from the Master Roadmap unless a source-grounded correction is recorded.
- Add a row when P0 source reading discovers a user-visible V3 capability omitted by the Roadmap.
- Do not silently merge automatic recall with active `memory_search` ToolCall.
- Keep Chronicle highlight/bookmark under V3 through P3; P4 takes only new bookmark writes.
- Keep Council deferred and independently buildable; do not assign it to GroupChat.
- Every migrated/replaced capability needs a concrete fallback owner. Every new capability needs a “disable V4 exposure” rollback.

---

## 10. Task 4 — Freeze the V4 side-by-side contract

Create `Plan/V4_Phase_0_Baseline/V4_Side_by_Side_Contract.md`. This freezes names and boundaries only; it does not create or configure them in P0.

### 10.1 Future package identity

Freeze the following for P1A unless Alicia explicitly revises it before C0:

| Item | Frozen value |
|---|---|
| directory | `packages/app/` |
| package name | `exo-app` |
| language | TypeScript strict from first source file |
| dev port | `5176`, strict; no automatic fallback |
| production base | `/app/` |
| PWA id/scope | `exocore-app` / `/app/` |
| API transport | same-origin relative `/api/*` and `/media/*`; cookie credentials + CSRF |

Rationale: `packages/app` is the eventual canonical product app rather than a disposable version-labelled package; `/app/` can coexist with V3 paths without making the permanent URL version-specific.

### 10.2 Coexistence contract

- V3 remains unchanged on ports `5173–5175` and production paths `/chat/`, `/chronicle/`, `/council/`.
- P1A may later add `dev:v4`/`dev:app`, package config, and an additive `/app/` nginx location; P0 must not add them.
- Root production redirect remains `/chat/` through P6. P7 alone may switch `/` to `/app/`.
- V4 must not overwrite V3 `dist/`, service workers, PWA scopes, route bases, or package scripts.
- Authentication cookies and backend data are shared intentionally. New V4 local-storage keys use an `exo:v4:` namespace unless a separately documented cross-app profile key is intentionally shared.
- V4 API wrappers may reuse generic `exo-shared` transport, but V3 wrappers are evidence—not automatically trusted canonical interfaces.
- Adding `packages/app` later causes workspace discovery through `packages/*`; it must not change current package resolution or lockfile before P1A.

### 10.3 Checkpoint and rollback contract

- **C0 checkpoint:** documents only; no runtime exposure and no capability ownership transfer.
- **P1A–P1D:** V4 may be directly accessible at dev 5176 or additive `/app/`, while V3 remains the official fallback.
- A P1 sub-gate failure hides/stops only the V4 exposure and returns to the latest accepted construction checkpoint; it does not delete user data.
- Unified C1 alone marks ordinary Chat V4-primary; the whole product root still waits for P7.
- P7 rollback changes root/nginx/deployment artifact back to V3; no user-data rollback.
- P8 alone may remove legacy routes/packages after Alicia ends the observation period.

The contract must include exact ownership of each future config change by phase, so P0 itself cannot be misread as authorization to edit those files.

---

## 11. Task 5 — Write backend handoff brief B1

Create `docs/superpowers/specs/2026-09-02-v4-b1-collection-storage-attachment-provenance-handoff.md`.

### Required sections

1. status, frontend consumer P4, backend owner `ExoCore`, earliest start after C0, hard-gate statement;
2. current source facts and evidence paths;
3. problem statement and frozen product semantics;
4. in-scope interface requirements;
5. data/lifecycle invariants;
6. authorization and privacy boundary;
7. stable errors and async derivation states;
8. V3 compatibility and migration/non-migration boundary;
9. backend acceptance targets;
10. explicit non-goals and handoff completion checklist.

### B1-specific contract requirements

- reliable identity/provenance for newly uploaded attachments;
- `CollectionItem` occurrence identity separate from `StoredAsset` exact-byte identity;
- managed original root, stable cryptographic hash, atomic copy and verification;
- reuse of exact bytes without deduplicating collection occurrences/context;
- text item behavior without mandatory asset;
- typed preview/semantic material with explicit pending/succeeded/failed/unavailable states;
- image preview never overwrites original; canonical audio transcript remains distinguishable from subjective model commentary;
- authorized original/preview access without leaking PC storage paths;
- reference-safe deletion and asynchronous GC; deleting a source Conversation cannot break accepted Collection originals;
- independent Collection search-target identity and authorization by Agent type `g045`, never preset database ID;
- **no current `memory_search` wiring in B1/P4**;
- no automatic global legacy attachment import and no unverified `.webm` promotion;
- additive compatibility with current V3 attachment/audio behavior.

Acceptance targets must cover duplicate occurrences, shared assets, failed derivation, source deletion, unauthorized access, and GC safety at the interface/invariant level. Do not include backend test implementation code.

---

## 12. Task 6 — Write backend handoff brief B2

Create `docs/superpowers/specs/2026-09-02-v4-b2-river-aggregation-handoff.md`.

### Required sections

Use the common ten-section structure from B1, adapted to B2.

### B2-specific contract requirements

- one canonical heterogeneous River read interface;
- source type + source ID identity and stable deeplink/capability metadata;
- canonical timezone-aware `occurred_at`;
- deterministic total ordering and global cursor/pagination with no duplicate/skip across pages;
- source CRUD remains owned by Task/Memo/Diary/Heartbeat/legacy Chronicle domains;
- Diary preview/full-read contract from canonical content;
- Memo source decision and reply tree; only thread roots participate in River global ordering;
- Task events and Open Tasks shelf derive from the same Task source;
- Heartbeat final summary is distinct from its technical ledger;
- Chronicle `milestone/moment` may project to River while uncertain history remains auditable;
- Chronicle `highlight/bookmark` is excluded from P3 takeover and remains V3-owned until P4;
- empty, partial-source failure, permission, malformed cursor, and unavailable-source semantics;
- no production fallback that asks the frontend to merge independently paginated source lists.

Acceptance targets must include tie timestamps, page boundaries, source deletion/update, empty sources, reply exclusion from the main axis, and deterministic replay.

---

## 13. Task 7 — Write backend handoff brief B3

Create `docs/superpowers/specs/2026-09-02-v4-b3-memory-search-filter-handoff.md`.

### Required sections

Use the common ten-section structure from B1, adapted to B3.

### B3-specific contract requirements

- server-side MemoryPlasmid body query and filters for Agent/preset, scope, Tags, source, processing status, and trigger state/keywords;
- deterministic pagination/cursor and total/count semantics for combined filters;
- exact editable versus read-only fields and permission errors;
- processing transitions after content edits, including visible pending/failed states;
- tag list semantics and combinations;
- History grep-like exact query with total hit count, context snippets, stable source identity, and expandable source;
- explicit separation among MemoryPlasmid, HistoryChunk, and Project Knowledge;
- no frontend full-load filtering disguised as pagination;
- no semantic History ranking experiment, automatic tag merge, or automatic parameter tuning.

Acceptance targets must cover combined filters, no-result pages, stable ordering, body edit reprocessing, failed processing, exact-match context boundaries, and unauthorized edits.

---

## 14. Task 8 — Write backend handoff brief B4

Create `docs/superpowers/specs/2026-09-02-v4-b4-recall-observability-handoff.md`.

### Required sections

Use the common ten-section structure from B1, adapted to B4.

### B4-specific contract requirements

- durable generation-attempt identity linked to the triggering user message and currently visible assistant answer;
- separate candidate and injected MemoryPlasmid records;
- hit path, explainable score/rank where applicable, and explicit rejection reason/unavailable semantics;
- isolation among original answer, regenerate attempts, and branches;
- a read contract that lets the frontend fetch the Receipt for the visible answer without exposing internal IDs as user concepts;
- persistent feedback enum: `relevant`, `irrelevant`, `content_incorrect`, `missed_recall` with display mapping to the four frozen Chinese labels;
- feedback idempotency/replacement/duplicate-submit semantics and authorization;
- automatic recall remains under the User Message; active `memory_search` remains a normal ToolCall in P1 `AssistantRunTrace`;
- feedback does not automatically modify weight, Tags, trigger keywords, or answer semantics in the first release;
- additive records that older V3 consumers can ignore.

Acceptance targets must cover regenerate/branch isolation, no-candidate runs, rejected candidates, repeated feedback, current-answer lookup, authorization, and missing observability data.

---

## 15. Common handoff quality gate

Each B1–B4 brief is complete only if it contains:

- one backend owner and one frontend consumer phase;
- exact current evidence paths;
- frozen semantic invariants and explicit non-goals;
- required resource/operation interfaces without inventing implementation classes;
- request/response identity, pagination/order/idempotency rules where applicable;
- authorization and privacy behavior;
- stable error/unavailable behavior;
- V3 compatibility rule and rollback exposure rule;
- binary backend acceptance targets stated as externally observable outcomes;
- required backend deliverables: accepted backend Plan, implementation/tests in `ExoCore`, migration compatibility where needed, and synchronized `ExoCore/ReactSheet.md` + `ExoCore-Desktop/ReactSheet.md` before the consuming frontend Detailed Plan can freeze.

Reviewer/backend suggestions remain advisory. They may refine implementation but cannot expand product scope without Alicia's approval.

---

## 16. Task 9 — Reconcile artifacts and execute C0 acceptance

### 16.1 Cross-artifact reconciliation

Verify mechanically and manually that:

- every API snapshot domain maps to one or more ownership rows;
- every P1A–P1D ownership row cites a current API/source fact and a fallback owner;
- every `pending_backend` API need maps to B1, B2, B3, or B4, or is explicitly deferred;
- side-by-side package/port/path names are identical in every P0 artifact;
- known-failure IDs are consistent across V3 baseline, API mismatches, and ownership matrix;
- `ReactSheet.md` no longer contradicts the accepted P0 snapshot on the corrected surfaces;
- no future implementation detail beyond P1A's package boundary has leaked into P0.

### 16.2 Final commands

```bash
git diff --check
git status --short
git diff --name-status
git -C ../ExoCore rev-parse HEAD
git -C ../ExoCore status --short --untracked-files=all
git -C ../ExoCore diff --name-status HEAD
git -C ../ExoCore diff HEAD --binary --no-ext-diff | git hash-object --stdin
git -C ../ExoCore ls-files --others --exclude-standard
git -C ../ExoCore ls-files --others --exclude-standard -z | while IFS= read -r -d '' f; do printf '%s\0' "$f"; sha256sum "../ExoCore/$f"; done | sha256sum
node -e "JSON.parse(require('node:fs').readFileSync('Plan/V4_Phase_0_Baseline/Canonical_API_Snapshot.json', 'utf8')); console.log('JSON OK')"
pnpm --filter exo-chat-core build
pnpm --filter exo-chronicle build
pnpm --filter exo-council build
cd ../ExoCore && bash .agent/check_real_db_baseline.sh
```

Validation targets:

- no whitespace/patch errors;
- compared with the opening manifests, only approved P0 documents and scoped `ReactSheet.md` corrections were added; pre-existing sibling changes remain untouched;
- backend HEAD, status manifest, tracked-diff hash, and untracked path/content hash exactly match opening evidence; a pre-existing dirty backend is allowed, but P0 may add, remove, or alter none of that baseline [opencode-go/deepseek-v4-flash / reviewer];
- the canonical snapshot parses successfully as JSON using Node's built-in parser;
- V3 builds still pass after documentation work;
- real AgentPreset baseline remains exactly 8 rows;
- `packages/app/` does not exist.

Record final command results and the final dirty-file allowlist in `Plan/V4_Phase_0_Baseline/README.md`.

---

## 17. Binary C0 PASS / FAIL gate

### C0 PASS only when every condition is true

#### A. Safety and scope

- [ ] Opening and closing AgentPreset baseline checks both report exactly IDs 1–8.
- [ ] No real database write probe occurred.
- [ ] Backend closing HEAD, status manifest, tracked-diff hash, and untracked path/content hash exactly match opening evidence. Pre-existing backend dirt is permitted; no P0-attributable backend delta is permitted.
- [ ] `packages/app/` and all other V4 runtime/source files are absent.
- [ ] No package, lockfile, Vite, nginx, deployment, or V3 source file changed.

#### B. V3 baseline

- [ ] `chat-core`, `chronicle`, and `council` each build and start on fixed ports 5173–5175.
- [ ] Root recursive workspace build passes.
- [ ] `chat-core test:run` passes.
- [ ] Django check, migration drift check, and focused backend tests pass.
- [ ] Lint and all known failures have explicit `PASS`/`KNOWN-DIRTY`/`BLOCKER` classification; there is no unclassified failure.
- [ ] Council is explicitly frozen as buildable deferred stub or C0 fails.
- [ ] Pre-existing and final dirty-worktree manifests are recorded without overwriting sibling work.

#### C. Canonical API snapshot

- [ ] JSON passes Node's built-in parser and contains all seven required API families.
- [ ] Every resource has backend source, frontend consumer, request/response/error semantics, and evidence status.
- [ ] Conversation create/list/message, GroupChat messages, Task fields, and notification mismatches are resolved rather than repeated.
- [ ] No nonexistent endpoint or field is labeled canonical.
- [ ] No required contract fact remains `unknown`.
- [ ] Scoped `ReactSheet.md` sections agree with the snapshot.

#### D. Ownership and coexistence

- [ ] Every Master Roadmap capability is represented with current owner, construction gate, transfer gate, minimum condition, and fallback owner.
- [ ] P1A–P1D remain V3-primary until unified C1.
- [ ] Side-by-side identity is frozen consistently as `packages/app`, `exo-app`, port 5176, base/scope `/app/`.
- [ ] Root remains `/chat/` until P7 and P8 remains the only legacy-deletion phase.

#### E. Backend handoffs

- [ ] B1–B4 exist as four independent briefs under `docs/superpowers/specs/`.
- [ ] Each brief contains all common quality-gate sections and its domain-specific invariants.
- [ ] B1 includes `g045` agent-type authorization and explicitly excludes current `memory_search` wiring.
- [ ] B2 forbids frontend heterogeneous pagination merge.
- [ ] B3 distinguishes Plasmid/History/Project Knowledge and freezes exact lookup semantics.
- [ ] B4 separates automatic recall from active ToolCall and freezes attempt/feedback identity.

#### F. Approval and release

- [ ] `Plan/V4_Phase_0_Baseline/README.md` contains a single final `C0: PASS` or `C0: FAIL` line with evidence links.
- [ ] Alicia explicitly approves C0 PASS.
- [ ] Only after that approval may `V4_Phase_1A_*_Detailed_Plan.md` be drafted.

### Automatic C0 FAIL conditions

Any one of these is sufficient for FAIL:

- V3 SPA cannot build/start, or chat-core tests fail;
- real DB baseline changes or any unauthorized real write occurs;
- P0 adds, removes, or changes any backend tracked/untracked file relative to its recorded opening baseline;
- a V4 app/package/source file is created;
- required API fact remains contradictory/unknown;
- an ownership row has no fallback owner;
- a handoff brief omits authorization, compatibility, error semantics, or binary acceptance targets;
- unexplained worktree changes appear;
- scope expands into bug fixing or B1–B4 implementation.

On FAIL, V3 remains the sole owner, P1A stays locked, and the README must identify the narrowest remediation decision. Do not continue automatically.

---

## 18. Checkpoint and rollback

### C0 checkpoint

C0 consists only of approved documentation/evidence at an Alicia-authorized commit or tag. It does not include V4 runtime code.

### Rollback

- Before C0 approval: remove/revise only the unaccepted P0 documents; do not reset or overwrite sibling changes.
- After C0 approval: revert only the C0 documentation commit if the baseline is invalidated.
- API/backend/user data are unaffected because P0 performs no production writes.
- Any source change discovered during P0 is outside rollback scope and must be handled as a separate authorized task.

---

## 19. Adversarial razor / ablation study

### Retained because required for C0

- Three-SPA isolated build/start evidence: necessary to prove V3 rollback viability.
- One machine-readable API snapshot: necessary to prevent old docs and wrappers from silently becoming authority.
- Separate ownership and side-by-side documents: one answers “who owns behavior,” the other “how runtimes coexist”; merging them would hide rollback rules.
- Four handoff briefs: B1–B4 have different backend owners/data risks and acceptance gates.
- Narrow `ReactSheet.md` reconciliation: leaving a known-active contract document false would defeat P0.

### Rejected as speculative or out of scope

- Creating `packages/app` to “test the contract”: P1A work and expressly forbidden.
- Adding frontend/backend contract tests in P0: existing source/tests are evidence; new test implementation belongs with the future owning phase/handoff.
- Running a paid live chat generation: not needed to freeze source-defined runtime interfaces.
- Fixing stale wrappers, Task creation, lint, notifications, or Council: P0 records ownership and blockers only.
- Capturing full API payloads or raw logs: unnecessary, sensitive, and noisy.
- Designing B1–B4 database tables/classes in the frontend plan: backend implementation choice, not a P0 product contract.
- Predicting P1B+ React files: prohibited by the Master Roadmap release rule.

**Razor conclusion:** the plan creates only the minimum durable facts needed to release P1A planning and independent backend handoffs. It neither scaffolds V4 nor repairs unrelated V3 debt.
