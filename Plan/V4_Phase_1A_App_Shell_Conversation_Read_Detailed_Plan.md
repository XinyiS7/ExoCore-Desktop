# ExoCore V4 — Phase 1A App Shell & Conversation Read Detailed Plan

> **Document type:** P1A executable implementation plan; limited to C1A.
> **Status:** **D1 PASS — approved for P1A construction**. Alicia froze `D-A + M1 + X1 + C1` on 2026-09-02; see `Plan/V4_Phase_1A_App_Shell_Navigation_Decision.md`.
> **Repositories:** `ExoCore-Desktop` (product code) + outer `ExoCore_Project` repository (additive deployment/config documentation only).
> **Baseline checkpoints:** Desktop `f48b4fe`; outer repository `8836cf4`.
> **Product authority:** Alicia.
> **Plan / architecture:** `[gpt-5.6-sol / Solaire]`.
> **Frozen upstream approval:** C0 PASS `[gpt-5.6-sol / Solaire, Alicia approved]`.
> **Accepted contract amendment P1A-B0:** backend checkpoint `29368bbf`; canonical create identity is `data.conversation_id`, while equal `data.session_id` is a deprecated V3 compatibility alias `[Alicia / approved] [opencode-go/deepseek-v4-flash / Ecki — archaeology] [gpt-5.6-sol / Solaire — handoff/acceptance]`.

---

## 1. Goal and acceptance intent

P1A establishes the first real V4 vertical slice without claiming live-chat ownership:

```text
V4 App Shell
  -> Chat Home / Recent ordinary Conversations
  -> create ordinary Conversation
  -> canonical /chat/:conversationId
  -> read persisted message history
```

The result must run beside V3 at dev port `5176` and production path `/app/`. V3 remains the production owner for every Chat capability until P1A–P1D all pass and unified C1 transfers ownership.

P1A is deliberately a **read-oriented Chat checkpoint**. It proves package identity, routing, server-state ownership, responsive shell, Conversation initialization and history reading. It does not send a message or start any chat runtime lifecycle.

### C1A acceptance intent

A user must be able to:

1. open the V4 Chat Home;
2. distinguish recent Conversation identity, Agent, Project or Drift, and last activity;
3. create a Conversation with a required Agent and optional Project;
4. open the same Conversation detail implementation from Recent or a direct URL;
5. read persisted message content and older pages without duplication or order corruption;
6. return safely to Chat Home;
7. leave all not-yet-migrated work to V3.

Passing C1A creates a construction checkpoint only. It does **not** make V4 Chat production-primary.

---

## 2. Authority, baseline, and conflict rules

### 2.1 Product authority

1. `Plan/V4_Spec_Freeze_Index.md`
2. `Plan/ExoCore_V4_Single_SPA_Architecture_Spec.md`
3. `Plan/V4_Page_Skeleton.md`
4. `Plan/V4_Master_Implementation_Roadmap.md`
5. `Plan/V4_Phase_0_Baseline/V4_Side_by_Side_Contract.md`
6. `Plan/V4_Phase_0_Baseline/V3_Capability_Ownership.md`
7. Alicia's explicit decisions

### 2.2 Implementation facts

1. current source, package manifests, Django URL configuration and serializers;
2. `Plan/V4_Phase_0_Baseline/Canonical_API_Snapshot.json`;
3. `ReactSheet.md` where it agrees with current source;
4. V3 behavior as evidence, not as architecture to copy wholesale.

A product decision and an implementation fact do not overwrite one another. A conflict becomes an explicit gate or scoped contract correction.

### 2.3 C0 baseline that must remain true

- Frozen identity: `packages/app`, `exo-app`, port `5176`, production base/scope `/app/`, PWA id `exocore-app`.
- Canonical Conversation route: `/chat/:conversationId` inside the V4 basename.
- Agent is required; Project is optional; no Project is named **Drift** and remains DB `NULL` / API sentinel `0`.
- V3 remains unchanged and independently buildable at `/chat/`, `/chronicle/`, `/council/` and ports 5173–5175.
- Root production redirect remains `/chat/` through P6.
- P1A frontend construction uses the accepted backend checkpoint `29368bbf`; no further backend production change is authorized inside the Desktop patch.

---

## 3. Entry blocker D1 — App Shell mobile navigation

### 3.1 The actual unresolved fact

`V4_Master_Implementation_Roadmap.md` states that the low-fidelity App Shell decision is frozen, but the authoritative input artifacts still leave it open:

- `V4_Spec_Freeze_Index.md` §11 lists the mobile bottom-bar composition as deferred;
- `V4_Page_Skeleton.md` lists the decision as pending;
- Questionnaire Q19 records the deliberate choice to compare a low-fidelity prototype later.

P1A must not invent this product choice.

### 3.2 D1 deliverable

Before product-source construction begins, create or approve a small decision record:

`Plan/V4_Phase_1A_App_Shell_Navigation_Decision.md`

It must freeze only:

- desktop primary-navigation presentation;
- mobile bottom-navigation items;
- where `More` lives and which not-yet-migrated destinations it exposes or disables;
- behavior when entering canonical Chat on a small screen;
- confirmation that desktop and mobile use the same routes and feature implementation.

A low-fidelity comparison may be used, but final color, typography, animation and visual polish remain outside P1A.

### 3.3 D1 gate

- **PASS:** Alicia explicitly selects the App Shell/mobile navigation behavior and the decision record is linked from this plan or its construction report.
- **FAIL:** any P1A product source is created while the navigation choice is still implicit.

The rest of this plan is executable without further architecture decisions once D1 passes.

---

## 4. Non-negotiable scope boundary

### 4.1 Allowed P1A work

- Create the independent `packages/app` React/Vite/TypeScript package.
- Add the minimum root workspace command needed to run V4 directly.
- Add strict TypeScript and clean lint/test/build gates for the new package.
- Add V4 App providers, router and responsive App Shell.
- Implement Chat Home / Recent for ordinary Conversations only.
- Implement canonical Conversation creation through `POST /api/agents/sessions/init/`.
- Implement canonical Conversation detail and paginated message-history reading.
- Add typed V4 adapters over the existing generic `exo-shared` transport.
- Add an additive `/app/` nginx location and app dist mount in the outer repository.
- Update operational documentation that would otherwise continue to claim only three SPAs/PWAs.
- Make the smallest source-backed `ReactSheet.md` Project-list field correction needed by P1A.

### 4.2 Explicitly forbidden

P1A must not implement or simulate:

- message send, SSE parsing, async polling, stop, regenerate/edit or branch (P1B);
- attachment/audio upload, rendering, playback or recovery (P1C);
- cache/model/endpoint/thinking controls, private-memory toggle, session-history controls, Aura, project files or `AssistantRunTrace` (P1D);
- Agent Hub/Profile, Project Hub/Detail, GroupChat, Settings or notifications (P2);
- River, Library, Collection, Memory management, Recall Receipt or Council;
- backend model/view/serializer/service/URL changes;
- server-side Conversation filters or pagination;
- a second global client store, speculative platform abstraction, SSR framework or UI component library;
- final visual design;
- V3 source/config edits or deletion;
- root redirect change from `/chat/` to `/app/`;
- import of V3 page/components into V4 or cross-package reach into `packages/chat-core/src`.

### 4.3 Honest partial-capability rule

P1A may receive message fields that later phases own. It must not silently pretend those capabilities are complete:

- message text and approved persisted rich text are readable in P1A;
- attachment metadata may produce a clear noninteractive deferred indicator, but no attachment content UI;
- `reasoning_content` may produce a clear deferred run-trace indicator, but P1A does not claim Thinking/Tool ownership;
- there is no enabled composer or fake send action;
- future primary destinations must be inaccessible/disabled rather than routed to empty pages that look complete.

---

## 5. Architecture and ownership decisions

### 5.1 Package layers

```text
packages/app/src/
  app/                 providers, router, route-level error boundary
  shell/               responsive App Shell and navigation projection
  features/chat/       Conversation API/types/query orchestration/pages/components
  shared/              small V4-local presentational/error utilities only
```

Rules:

- route pages remain thin;
- typed API adapters and server-state orchestration live under `features/chat`, not in views;
- ordinary server state is owned by TanStack Query;
- local dialog/form state stays local and uses React Hook Form for the dynamic create form;
- URL owns the active Conversation identity;
- no Zustand/global store is introduced because P1A has no proven cross-page client-state need;
- V3 implementation is behavioral evidence only; no source import or shared mutable state.

### 5.2 Query ownership

Use one `QueryClient` at the App provider boundary. Define stable query-key families for:

- ordinary Conversation list;
- Conversation detail by ID;
- paginated messages by Conversation ID;
- visible Agent presets;
- Projects.

Conversation creation must invalidate/update the Conversation-list cache and navigate using canonical `data.conversation_id`. Deprecated `data.session_id` exists only for V3 compatibility and must not be consumed by V4. The client must not synthesize an incomplete Conversation object or infer write identity from a subsequent list request.

### 5.3 Message paging invariant

The backend's offset counts backwards from the newest end. The V4 adapter must preserve this unusual contract:

- first page: `limit=50`, `offset=0`;
- older page offsets advance by the count already loaded;
- final render order is ascending `index_in_session`;
- overlapping/refetched rows deduplicate by message ID;
- `has_more=false` stops older-page requests;
- switching route IDs cannot leak prior Conversation messages.

TanStack Query owns fetched pages and refetch state; it does not own the future P1B runtime lifecycle.

### 5.4 Navigation and return semantics

- V4 Chat Home is the package root `/` under basename `/app/` in production.
- Canonical detail is `/chat/:conversationId`.
- `/chat` without an ID redirects to Chat Home.
- Recent/create navigation may carry an internal return target; direct-link and invalid/missing return state default to Chat Home.
- Route IDs must be positive integers before any request is made.
- A wildcard route renders a real not-found state with a Chat Home action.
- Browser refresh and nginx fallback must preserve the same detail route.

### 5.5 PWA boundary

- PWA id `exocore-app`, start URL and scope `/app/` in production.
- Its service worker is emitted only beneath `/app/` and uses V4-specific cache naming.
- P1A service worker precaches the V4 shell but does not cache `/api/` responses.
- It must not import V3 push-notification behavior; notifications belong to P2.
- Existing V3 PWA identities/scopes remain unchanged.

### 5.6 Cross-repository checkpoint clarification

`ExoCore-Desktop` is a nested Git repository; `Nginx/nginx.conf`, `hybrid_start.ps1` and root operational docs belong to the outer `ExoCore_Project` repository. Therefore “lands with the first `packages/app` commit” from the side-by-side contract means **one coordinated P1A checkpoint**, not one impossible cross-repository Git commit.

C1A requires both commit IDs to be recorded together. Neither repository may be pushed or committed without Alicia's approval.

---

## 6. Contract interfaces frozen for P1A

### 6.1 Generic transport

P1A may reuse `exo-shared/api` for same-origin URL construction, credentials, JSON/FormData handling, CSRF and normalized non-2xx errors. Because V4 is strict TypeScript, add only the declaration/export surface required to consume this generic transport safely.

Do not use or repair `conversationsApi.createConversation()`; its target is the known noncanonical GET-only list route.

### 6.2 Agent list

```text
GET /api/agents/presets/
response: bare AgentPreset array
consumed fields: id, name, description, agent_type, default_model, is_visible
```

The create selector includes visible conversational Agent presets and excludes `agent_type="user"`. No preset create/delete operation is exposed.

### 6.3 Project list

```text
GET /api/core/projects/
response: bare Project array
consumed fields: id, name
```

Current source authority is `core.serializers.ProjectSerializer`; `ReactSheet.md`'s legacy `title` wording must be corrected to `name` and the real serializer field set. P1A does not create/edit/delete Projects.

### 6.4 Conversation list/detail

```text
GET /api/agents/conversations/
GET /api/agents/conversations/<id>/
```

Consume only the C0 allowlist. Preserve `project: 0` as transport data but normalize it to `null` at the V4 feature boundary. Display `project_name` when present; otherwise display `Drift`. Resolve Agent display name by `agent_preset_id`; unresolved identity must remain explicit rather than inventing a name.

Recent ordering trusts the backend list order; the frontend must not mutate the response array in place. P1A does not add client search or server filters.

### 6.5 Conversation create

```text
POST /api/agents/sessions/init/
request: name?, preset_id, project_id, frozen_project_ids?, thinking_level="auto"
success 201: { msg, data: { conversation_id, session_id, session_name } }
identity: conversation_id is canonical; session_id is an equal deprecated V3 compatibility alias
```

Rules:

- Agent is required.
- Project omitted/cleared sends `project_id: 0` and displays the resulting Conversation as Drift.
- For `g045`, the form preserves the existing optional cross-project permission selection and sends the explicit extension IDs according to the frozen backend contract.
- For non-`g045`, `frozen_project_ids` is empty/omitted and no unusable permission UI is interactive.
- Do not send legacy `temperature` or session-type fields to init.
- Field-level 400 errors and network errors remain visible in the dialog; no alert-only or silent failure path.
- Duplicate submit is blocked while the mutation is pending.

### 6.6 Message history

```text
GET /api/agents/chat/<conversationId>/?limit=<N>&offset=<N>
response: { messages, total_count, has_more }
404: { error: "会话不存在" }
```

P1A consumes the C0 message allowlist. It renders role, content, creation time and available model/platform attribution without exposing unsupported controls. Persisted Markdown/GFM, code, math and Mermaid content must remain readable; expensive Mermaid support should be loaded only when required.

P1A does not call POST chat, status, stop, branch, attachment or cache endpoints.

---

## 7. Planned file changes

File names below define ownership, not mandatory one-component-per-file ceremony. The Builder may collapse a trivial helper into its owning module, but may not move API/runtime logic into route views.

### 7.1 Create in `ExoCore-Desktop`

```text
Plan/V4_Phase_1A_App_Shell_Navigation_Decision.md   # D1, before source work
packages/app/
  package.json
  tsconfig.json
  tsconfig.node.json
  vite.config.ts
  eslint.config.js
  index.html
  public/
    sw.js
    favicon.svg
    icon-192x192.png
    icon-512x512.png
  src/
    main.tsx
    app/App.tsx
    app/AppProviders.tsx
    app/router.tsx
    shell/AppShell.tsx
    shell/PrimaryNavigation.tsx
    features/chat/types.ts
    features/chat/api.ts
    features/chat/queries.ts
    features/chat/ChatHomePage.tsx
    features/chat/ConversationPage.tsx
    features/chat/RecentConversationList.tsx
    features/chat/CreateConversationDialog.tsx
    features/chat/MessageTimeline.tsx
    features/chat/MessageContent.tsx
    shared/AsyncState.tsx
    shared/ErrorBoundary.tsx
    styles/base.css
    styles/shell.css
    test/setup.ts
    test/                        # behavior/contract tests owned by P1A
```

### 7.2 Modify in `ExoCore-Desktop`

- `package.json` — add one canonical `dev:app` script; do not alter V3 scripts.
- `pnpm-lock.yaml` — only dependency graph changes caused by `exo-app` and typed shared transport.
- `packages/shared/package.json` — expose the generic API transport's declaration surface without changing V3 runtime behavior.
- `packages/shared/src/api.d.ts` — new declaration if the chosen package-export form requires it.
- `ReactSheet.md` — correct P1A-consumed Project list fields/provenance only.
- `AGENTS.md` — describe the temporary four-SPA side-by-side state and V4 commands without rewriting unrelated guidance.

### 7.3 Modify in outer `ExoCore_Project`

- `Nginx/nginx.conf` — additive `/app/` static location/fallback only; root remains `/chat/`.
- `hybrid_start.ps1` — add app dist validation/mount and ensure an existing nginx container can acquire the new mount safely; preserve all V3 mounts.
- `Docs/STARTUP_CHEATSHEET.md` — add V4 dev/production commands, mount and URL.
- `AGENT.md`, `AGENTS.md`, `.agent/project.md` — minimally correct the migration-time SPA/package count and port map.

### 7.4 Must not change

- any file under `../ExoCore/`, `../ExoCore-Extension/` or `packages/chat-core/src`;
- V3 package manifests, Vite configs, service workers or routes;
- root `dev:web` behavior and `scripts/dev-servers.js`; `dev:app` must remain an independent additive command;
- `pnpm-workspace.yaml` (already discovers `packages/*`);
- P0 baseline artifacts, Master Roadmap or frozen Specs, except a separately approved correction if D1 reveals a contradiction;
- root nginx redirect target.

---

## 8. Task 0 — Preflight and two-repository safety lock

### Actions

1. Run the real AgentPreset baseline check before any work.
2. Record Desktop and outer repository HEAD/status separately.
3. Record staged/unstaged/untracked manifests and hashes if either repository is dirty.
4. Confirm `packages/app` does not yet exist and ports 5173–5176 are free or identify their owners.
5. Confirm no sibling pane is actively editing the same P1A/outer config scope before touching files.
6. Re-read exact current package manifests, shared transport, V3 create/read evidence, nginx and launcher blocks.

### Required opening result

- AgentPreset baseline is exactly IDs 1–8.
- Desktop starts from C0 checkpoint `f48b4fe` or an explicitly recorded descendant.
- Outer repository starts from `8836cf4` or an explicitly recorded descendant.
- Any pre-existing dirty state is preserved and excluded from P1A ownership.
- No unclassified listener/resource conflict exists.

Any baseline failure stops construction.

---

## 9. Task 1 — Freeze D1 before source construction

1. Produce the low-fidelity comparison/decision record described in §3.
2. Keep the canonical product areas `Chat / Groups / River / Library` unchanged.
3. Make future/unmigrated entries visibly unavailable rather than creating placeholder product pages.
4. Record Alicia's explicit selection inline as `[Alicia approved]`.
5. Update this plan's status to `D1 PASS — ready for construction` without changing implementation scope.

**Checkpoint P1A-D1:** decision artifact only. If it fails, return to C0; no `packages/app` source exists.

---

## 10. Task 2 — Bootstrap the strict V4 package

### Package contract

- React 19 + Vite 8.
- TypeScript strict; production build runs type-check before Vite build.
- React Router with basename derived from `import.meta.env.BASE_URL`.
- TanStack Query for server state (**net-new direct dependency**; not present in the C0 lockfile).
- React Hook Form for Conversation initialization (**net-new direct dependency**; not present in the C0 lockfile).
- Existing V3 rich-text libraries may be reused at their locked versions where needed for message readability.
- No UI framework, state store, schema library or SSR dependency.
- ESLint supports TypeScript/React and starts with zero P1A errors/warnings unless the plan explicitly permits a rule warning (default: none).
- Vitest/jsdom and Testing Library provide package-local automated verification.

### Vite/PWA contract

- dev host remains network-accessible according to existing project practice;
- port `5176` with strict-port failure, never fallback;
- build base `/app/`, dev base `/`;
- `/api` and `/media` proxy to `127.0.0.1:8000`;
- PWA id/scope/start URL are unique to V4;
- `dist/sw.js` is emitted and navigation fallback targets `/app/index.html`;
- no API response caching and no push behavior in P1A.

### Dependency discipline

- Reuse versions already present in the lockfile for React/Vite/testing/rich-text packages.
- Treat TanStack Query, React Hook Form and any strict-TypeScript/ESLint tooling absent from the C0 lockfile as explicit net-new dependencies; record each addition rather than describing it as reuse.
- Add only dependencies justified above.
- Do not upgrade unrelated workspace packages.
- Lockfile diff must contain no unexplained removals or V3 version churn.

**Checkpoint P1A-1:** empty shell package installs, type-checks, lints, tests and builds; all V3 packages still build.

---

## 11. Task 3 — Add typed transport and server-state boundaries

1. Add the minimal TypeScript declaration/export for `exo-shared/api`.
2. Define P1A DTOs from the verified serializers/snapshot; do not invent optional fields.
3. Normalize only at the feature boundary:
   - Project sentinel `0` -> `null`;
   - API errors -> a typed UI-safe error model retaining status and field body;
   - message pages -> stable ascending rows with ID deduplication.
4. Implement feature adapters for list/detail/create/messages/presets/projects only.
5. Implement query keys/options and the create mutation outside route pages.
6. Add development-time contract guards for impossible top-level envelopes; malformed responses surface as errors rather than empty success.
7. Leave `exo-shared` legacy endpoint wrappers unchanged.

**Checkpoint P1A-2:** adapters and query orchestration pass contract verification independently of visual components.

---

## 12. Task 4 — Build the App Shell and router

1. Implement one responsive App Shell according to D1.
2. Keep navigation definition data-driven so desktop/mobile are projections of one canonical IA, not duplicated route logic.
3. Make Chat the only enabled product area in P1A; identify future areas without routing to fake pages.
4. Implement route-level error containment and a real not-found state.
5. Ensure canonical Chat detail hides any mobile bottom navigation if D1 requires full-height message space.
6. Use `100dvh`, safe-area handling and a single scroll owner per page; avoid nested full-page scroll traps.
7. Keep local storage either unused or under `exo:v4:*`; do not read/write V3 session keys.

**Checkpoint P1A-3:** shell and route behavior work at desktop/mobile widths without API success being required.

---

## 13. Task 5 — Implement Chat Home / Recent

1. Query ordinary Conversations and visible Agent presets.
2. Render backend order without mutating cached arrays.
3. Each recent row must expose:
   - Conversation name or stable fallback using its ID;
   - resolved Agent name/identity;
   - Project name or `Drift`;
   - last activity;
   - ordinary-Conversation type semantics (never GroupChat masquerading).
4. Provide explicit loading, empty, error and retry states.
5. Open the canonical detail route and pass only navigation-origin metadata, never a duplicate Conversation payload as truth.
6. Provide the create action.
7. Do not add search, Agent Hub, Project Hub or GroupChat aggregation in P1A.

**Checkpoint P1A-4:** Recent -> canonical detail navigation is stable and preserves one Conversation identity.

---

## 14. Task 6 — Implement Conversation creation

1. Load eligible Agents and Projects with independent loading/error/retry states.
2. Implement optional name, required Agent, optional primary Project and conditional g045 extension-project selection.
3. Label no primary Project as `Drift`; do not create a fake Project row.
4. Submit only the canonical init fields from §6.5.
5. Surface field, network and unexpected-envelope errors inside the dialog.
6. On success, require canonical `conversation_id`, close once, refresh/invalidate Recent and navigate to `/chat/<returned conversation_id>`; never infer identity by name/list/max-ID.
7. Treat the newly created no-message Conversation as a valid empty read state.
8. Preserve successfully created Conversations across V4 rollback; never delete user business data as rollback.

**Checkpoint P1A-5:** create -> canonical empty detail works for Drift; automated contract coverage also proves Project and g045 payload branches.

---

## 15. Task 7 — Implement canonical Conversation read path

1. Validate the route parameter before requesting.
2. Fetch Conversation detail and newest message page independently but present coherent page states.
3. Display Agent + Project/Drift context from canonical data.
4. Render persisted user/assistant/system/developer messages in `index_in_session` order.
5. Render approved rich text safely; HTML handling must not introduce script execution.
6. Add explicit empty-history, detail 404, message 404, generic error and retry behavior.
7. Implement “load older” using the offset invariant; preserve scroll position when prepending older rows.
8. Prevent stale data from a prior Conversation appearing during fast route changes.
9. Expose deferred attachment/run-trace indicators where relevant, without implementing P1C/P1D controls.
10. Provide a deterministic return-to-Chat-Home action for direct links.
11. Render no active composer and call no runtime mutation endpoint.

**Checkpoint P1A-6:** Recent/direct/create all resolve to one read implementation; paging and failure states are accepted.

---

## 16. Task 8 — Add side-by-side production exposure

### 16.1 Nginx

Add only:

- canonical slash handling for `/app` if needed;
- `location /app/` serving the V4 dist;
- SPA fallback to `/app/index.html`.

Do not alter `/`, `/chat/`, `/chronicle/`, `/council/`, `/api/`, `/media/`, TLS or proxy behavior.

### 16.2 Hybrid launcher

- recognize `packages/app/dist` and report/build consistently with existing frontend behavior;
- mount it at `/usr/share/nginx/html/app`;
- ensure an already-created `exocore-nginx` container does not silently continue without the new mount;
- when the existing container already has the required mounts, validate and reload nginx so the changed bind-mounted config actually takes effect; a running process must not continue on stale config;
- preserve ports, certificates, backend startup and all three V3 mounts;
- print V4 local/LAN/Tailscale URLs as additive information.

Container recreation, if required to apply the new mount, must be explicit, bounded to stateless nginx, and must not touch PostgreSQL/Django data.

### 16.3 Operational documentation

Update only claims invalidated by the fourth side-by-side SPA/PWA. Keep V3 as primary and label V4 `/app/` as a P1A preview/construction surface.

### 16.4 Two-repository checkpoint

Record:

- Desktop commit candidate hash/tree;
- outer repository commit candidate hash/tree;
- exact pairing in the construction report;
- rollback order.

**Checkpoint P1A-7:** `/app/` and a direct V4 detail URL are statically served while all V3 URLs and root redirect remain unchanged.

---

## 17. Verification targets — no raw test implementation in this plan

Test implementation details belong in the package's test files and acceptance record. This plan freezes only interfaces and observable targets.

### 17.1 Package/config targets

- strict TypeScript rejects unsafe DTO/use-site assumptions;
- new package lint is clean;
- V4 build emits index, manifest and service worker beneath `/app/` references;
- manifest id/scope/start URL equal the frozen values;
- dev port collision fails rather than selecting another port;
- no V3 manifest/config/source changed;
- lockfile changes are attributable to `exo-app` only.

### 17.2 API adapter targets

- correct method/path/query/body for all six P1A interfaces;
- Conversation create never targets `/api/agents/conversations/` POST;
- sentinel normalization does not mutate server DTOs;
- malformed envelope and non-2xx errors remain visible;
- 400 field bodies remain available to the form;
- message page merge is ordered, deduplicated and terminal at `has_more=false`.

### 17.3 User-path targets

- Home loading / empty / populated / error+retry;
- Recent -> canonical detail;
- direct detail -> same implementation;
- invalid ID and 404 are distinct and recoverable;
- create Drift, create with Project, and g045 permission payload semantics;
- duplicate submit prevention;
- no-message Conversation empty state;
- load older without duplicate/order/scroll regression;
- fast Conversation route switch has no stale-message flash;
- message roles and rich text remain readable;
- attachment/reasoning fields do not falsely claim migrated capability;
- no send/runtime endpoint can be triggered.

### 17.4 Responsive/accessibility targets

- keyboard-reachable navigation, dialog, retry and load-older actions;
- dialog focus entry/return and Escape behavior;
- semantic disabled treatment for future routes;
- desktop and mobile reach the same route components;
- narrow-screen Chat detail receives full usable height per D1;
- no horizontal overflow at the accepted mobile widths;
- loading/error announcements are perceivable without relying only on color.

### 17.5 Side-by-side targets

- V4 dev 5176 returns HTTP 200 and fixed-port behavior;
- V3 dev 5173–5175 remain startable;
- production `/app/` and `/app/chat/<valid-id>` return the V4 SPA;
- `/` still redirects to `/chat/`;
- `/chat/`, `/chronicle/`, `/council/` continue to return their own SPAs;
- PWA identities/scopes remain distinct;
- nginx container has all four expected dist mounts;
- stopping/hiding V4 leaves V3 usable.

### 17.6 Controlled live integration target

C1A must include one bounded real integration of the create path because create is a core user path:

- use an existing visible Agent and create one uniquely named no-message Drift Conversation through V4;
- record the returned ID and verify it appears in Recent and opens through the canonical route;
- clean the acceptance artifact through Django ORM in a guaranteed cleanup step, not through raw SQL and not through the API DELETE side-effect path;
- verify the Conversation is absent afterward and no unrelated Conversation/Message changed;
- do not create/delete/modify any AgentPreset;
- run the 8-row AgentPreset baseline before and after.

If guaranteed cleanup cannot be established, this probe is blocked rather than left as real data.

---

## 18. Required command-level evidence

The Builder records actual exit codes, durations and relevant counts. Commands may be grouped, but failures may not be hidden by shell chaining.

### 18.1 Desktop package

- frozen install (`pnpm install --frozen-lockfile`) after the lockfile is intentionally generated;
- `exo-app` type-check/build;
- `exo-app` lint;
- `exo-app` automated test run;
- `exo-app` fixed-port dev smoke;
- root recursive workspace build;
- existing chat-core 85-test regression;
- V3 isolated build smokes;
- root/V3 lint fingerprint comparison against C0 known debt.

### 18.2 Static artifact checks

- built HTML asset paths use `/app/`;
- manifest id/scope/start URL are exact;
- service worker fallback/cache names are V4-specific;
- no generated `dist/` file is staged;
- no `packages/app` import reaches into V3 source.

### 18.3 Outer repository

- PowerShell parser accepts `hybrid_start.ps1`;
- nginx configuration syntax passes in the project container/image environment;
- deployment smoke proves the five URL assertions in §17.5;
- container mount inspection proves the fourth mount;
- outer repo patch contains only approved config/docs.

### 18.4 Backend read-only/regression

- `python.exe manage.py check`;
- migration drift check;
- focused existing regression labels: `core.tests.test_core`, `agents.tests.test_agentpreset_write_lock`, and `agents.tests.test_services.AgentChatUserIdentityTests`; add another existing label only if source reading shows it directly covers init/list/message GET;
- backend remains clean at accepted checkpoint `29368bbf` with no further source/status delta from Desktop repair;
- opening and closing real AgentPreset baseline.

P1A-B0 backend production/test/docs landed separately at `29368bbf`. No further backend test or production file is created from this frontend repair plan.

---

## 19. Binary C1A PASS / FAIL gate

### 19.1 C1A PASS only when every condition is true

#### A. Entry and scope

- D1 has Alicia's explicit approval.
- C0 artifacts remain intact except the explicitly accepted P1A-B0 identity-contract amendment recorded in Snapshot v1.1; Desktop and outer baselines remain attributable.
- No P1B–P1D/P2+ capability or further backend production change entered the Desktop/outer patch.
- V3 remains production-primary and buildable.

#### B. Package and shell

- `packages/app` has the exact frozen package/runtime/PWA identity.
- strict type-check, new-package lint, tests and build pass.
- App Shell matches D1 at desktop/mobile widths with one route implementation.
- future product areas do not masquerade as completed pages.

#### C. Conversation paths

- Recent has complete loading/empty/error/retry and identity context.
- Agent-required + Project-optional/Drift creation uses only `sessions/init/`.
- g045 permission and non-g045 branches preserve canonical semantics.
- Recent, direct URL and create success enter one `/chat/:conversationId` implementation.
- message newest/older loading preserves order, uniqueness and scroll position.
- read/error/404/empty states are distinguishable.
- no runtime mutation endpoint is reachable.

#### D. Side-by-side safety

- 5176 and `/app/` work without collision.
- root still redirects to `/chat/`.
- all V3 routes/builds remain valid.
- app service worker cannot control or cache V3 route/API scope incorrectly.
- outer launcher applies the app mount to existing as well as new nginx-container state.

#### E. Data and repository integrity

- controlled create probe is fully cleaned; no unrelated data changed.
- AgentPreset baseline remains IDs 1–8.
- backend worktree is clean at accepted checkpoint `29368bbf`.
- Desktop and outer changes are separately clean, attributable and recorded.
- generated artifacts, secrets and test logs are not committed.

#### F. Acceptance and release

- independent acceptance issues one final `C1A: PASS` line;
- Alicia approves the paired checkpoint commit(s);
- only then may P1B Detailed Plan be drafted.

### 19.2 Automatic C1A FAIL

Any one of these is an automatic FAIL:

- source construction before D1 approval;
- POST to `/api/agents/conversations/` for create;
- fake Project object for Drift;
- duplicate Conversation detail implementation by entry source;
- hidden/silent API failure or malformed response treated as empty success;
- enabled send/composer/runtime action;
- attachment/audio/control/tool-trace implementation leaking into P1A;
- V3 source, route, PWA scope or root redirect changed;
- `/app/` service worker controls another SPA;
- app mount works only after undocumented manual container surgery;
- real-db probe residue or any AgentPreset write;
- backend differs from accepted checkpoint `29368bbf` or additional backend production code enters the Desktop repair;
- unexplained dependency/version churn;
- only one of the two repositories is checkpointed, leaving deployment and product code unpaired.

---

## 20. Checkpoint, commit and rollback

### 20.1 Construction checkpoints

- **P1A-D1:** navigation decision only; rollback to C0 documents.
- **P1A-1:** strict package boots/builds; no feature claim.
- **P1A-2:** typed contracts/query layer.
- **P1A-3:** shell/router.
- **P1A-4:** Recent.
- **P1A-5:** create.
- **P1A-6:** canonical read path.
- **P1A-7:** paired side-by-side deployment candidate.
- **C1A:** independent acceptance + Alicia approval.

Intermediate commits are optional and require Alicia's approval; checkpoints are evidence boundaries, not permission to auto-commit.

### 20.2 Final paired checkpoint

The construction report must bind:

```text
C1A
  Desktop commit: <packages/app + workspace/shared/docs>
  Outer commit:   <nginx + launcher + operational docs>
```

The pair is the rollback unit even though Git stores two commits.

### 20.3 Rollback

- Hide/stop only V4 exposure and return to V3-primary.
- Revert commits; never reset or overwrite sibling work.
- Reverting outer config may require recreating stateless nginx from the reverted launcher so the mount set agrees.
- Do not delete legitimate Conversations created by Alicia through V4.
- Acceptance-only probe data must already be cleaned before checkpoint approval.
- Never roll back PostgreSQL business data, Message history, attachments or cache as part of UI rollback.

---

## 21. Construction report requirements

Before independent acceptance, the Builder must provide:

- exact Desktop and outer baseline/final HEADs;
- changed-file manifest separated by repository;
- D1 decision reference;
- dependency additions and why each is necessary;
- API interfaces actually called;
- command evidence with exit codes/durations/counts;
- responsive/manual verification matrix;
- production route/PWA/mount evidence;
- live create-probe ID and cleanup proof without retaining user data;
- V3 lint-debt fingerprint comparison;
- opening/closing real-db baseline;
- known limitations and explicit confirmation that P1B–P1D remain unimplemented;
- no quality verdict from the Builder.

Independent acceptance owns the final C1A verdict.

---

## 22. Adversarial razor / ablation study

### 22.1 Retained because C1A cannot be accepted without it

- D1 navigation freeze: required by the frozen Architecture Spec and avoids inventing mobile IA.
- TanStack Query: directly implements the approved server-state boundary for list/detail/history.
- React Hook Form: justified by Agent/Project/g045 conditional create semantics and visible field errors.
- Rich-text reader: no later phase owns basic persisted message readability.
- Typed `exo-shared/api` boundary: required for strict TypeScript without duplicating CSRF/credentials transport.
- Existing-container mount handling: without it `/app/` does not become deployable on Alicia's current nginx container.
- Two-repository checkpoint: required by the actual nested Git topology.
- One controlled create integration: required to prove the central P1A write path end to end.

### 22.2 Rejected as speculative or outside accepted scope

- global search on Chat Home;
- recent Agent/Project/GroupChat sections before P2;
- generic design system or token package;
- Zustand or another global client store;
- schema-validation dependency solely for P1A DTOs;
- API/media runtime caching;
- push notifications in the V4 service worker;
- platform/Capacitor abstractions;
- backend filter/pagination changes;
- fixing V3's unused broken create wrapper;
- refactoring V3 ChatArea/MessageBubble;
- live-chat runtime, composer or controls;
- final visual polish.

### 22.3 Razor conclusion

P1A contains only the minimum infrastructure and user path needed to prove that V4 can coexist, initialize a canonical ordinary Conversation and read it reliably. Removing any retained item leaves a frozen C1A condition unverifiable; adding any rejected item expands ownership beyond the approved checkpoint.

---

## 23. Plan release state

```text
C0: PASS
P1A plan: WRITTEN
D1 App Shell navigation: PASS — `D-A + M1 + X1 + C1` [Alicia / approved]
P1A product source construction: UNLOCKED
P1B planning/construction: LOCKED until final C1A PASS
```
