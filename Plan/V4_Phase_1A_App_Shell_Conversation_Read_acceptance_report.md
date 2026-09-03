# V4 Phase 1A — App Shell & Conversation Read Independent Acceptance Report

> **Owner:** `[gpt-5.6-sol / Solaire]` — independent acceptance
> **Checkpoint:** C1A
> **Status:** **C1A PASS — Alicia confirmed; paired checkpoint authorized**
> **Frozen Plan:** `Plan/V4_Phase_1A_App_Shell_Conversation_Read_Detailed_Plan.md`
> **Frozen D1:** `Plan/V4_Phase_1A_App_Shell_Navigation_Decision.md`
> **Construction evidence:** `Plan/V4_Phase_1A_Construction_Evidence.md` (Builder-owned evidence only)

## 1. Factual summary

```text
Verdict: PASS
Phase/checkpoint: V4 P1A / C1A
Consecutive FAIL count: 0; no open P0/P1 finding
Final candidate baseline: Desktop HEAD f48b4fe + product/acceptance staged candidate; outer HEAD 8836cf4 + staged diff 46585ca7…; backend 29368bbf clean
Findings: open 0; R1-01..05 and R3-01 closed; H01 corrected; P2-01 remains explicitly deferred
Tests: app 51/51 PASS; chat-core 85/85 PASS; backend focused 87/87 PASS; all four builds PASS
Known V3 lint debt: unchanged fingerprint — chat 168 problems/exit 1; chronicle exit 2; council exit 2
Browser/deployment: responsive geometry PASS; pagination anchor PASS; four dev ports + strict collision PASS; PWA/API/nginx route and mount checks PASS
Real probe: V4 UI created/navigated/read Conversation 114 through archived preset 3; ORM cleanup complete; preset restored hidden; baseline 8 rows
Unreviewed areas: none within frozen C1A scope
```

**C1A: PASS** — `[gpt-5.6-sol / Solaire]` independent acceptance; paired checkpoint authorized by `[Alicia / approved]`.

## 2. Pinned baseline and ownership

- Desktop HEAD: `f48b4feb13c75a799c9c58b453d397bf3c12fa08`
- Desktop staged-diff SHA-256 at intake: `45317b8a7cf06afe34dd39a5a89ec7861778b0a89155c2e2a2e8d98e2ed48a67`
- Outer HEAD: `8836cf4a381a1cb703f400f5816632a6e2dd581c`
- Outer staged-diff SHA-256 at intake: `2322f0cc8b46b90c05b9c932dc5fbc97b434e013e1b2314b3eda40d95d876a2b`
- Backend HEAD: `c183a2fdc5974f150a136db2f5e10c79f139d783`; worktree remained clean during R1.
- Frozen Plan SHA-256 before/after R1: `aabd786cadde4e40a43239c6fe48fa55215da247cdc82dc22d18583266091d05`
- Frozen D1 SHA-256 before/after R1: `ae45cd9a3c5616d2335d0414e218803b8535a82b71c279fc60ae0721ad600ed1`
- Frozen C0 API snapshot SHA-256 before/after R1: `61da3cf92c66f69cb83ce24830318d78b8c7d93d614ef216b87f858b10f173c8`
- Real `AgentPreset` opening/closing baseline: `OK: 8 rows [1..8]`.
- Construction did not edit the frozen Plan, D1 record, C0 snapshot, acceptance report, or backend.
- This report was created and tracked by Acceptance during R1. Construction must not modify it.
- R2 pinned Desktop staged-diff SHA-256: `492b15e20cfa222b0870b0927e060f5234b60257b9c979e6956745ab5bf46655`.
- R2 pinned outer staged-diff SHA-256: `3bab8c8e54a69fc6336822266530f6fe39203fecf9ec5e8a57448f9d47ad68e4`.
- R2 backend dependency: clean checkpoint `29368bbfcf31f64f3baa5c6ba3fec79662d6fb8a`; no Builder delta.
- R3 pinned Desktop staged-diff SHA-256: `72a2531d121bbe572c2163cd9acd08f84feccfd989ccb7e2dbea4508cb9b500b`.
- R3 pinned outer staged-diff SHA-256: `46585ca76505f91d59a262a8d89179de6d0a95f2a4251016e7596404b9bd449a`.
- R3 protected artifacts remained Construction-clean; Acceptance alone updates this report and the escalation artifact.

## 3. Independent evidence that passed

### 3.1 Package and source boundaries

- `pnpm install --frozen-lockfile`: exit 0.
- `exo-app` typecheck: exit 0.
- `exo-app` lint: exit 0.
- `exo-app` Vitest: 4 files, 46/46 PASS.
- `exo-app` build: exit 0; Vite built `/app/` assets and the service worker.
- Static source sweep found only the six allowed API families and no composer, POST-chat, SSE/status/stop, attachment upload, branch, cache-control, V3-source import, or V3 storage-key use.
- Route source has one canonical `chat/:conversationId` implementation; invalid positive-integer checks disable requests.
- Message-page merge, DTO non-mutation, explicit loading/error/404/empty states, deferred attachment/reasoning indicators, and absence of runtime mutation are source-backed and covered by passing construction tests.
- Backend and V3 production source remain outside the Desktop patch.

### 3.2 Real browser observations

Acceptance used installed Microsoft Edge headless through Chrome DevTools Protocol with an actual 390×844 mobile metrics override; no new browser dependency was installed.

- Chat Home: real 390 CSS-pixel viewport, `documentElement.scrollWidth == innerWidth == 390`; all four M1 slots fit.
- Canonical `/app/chat/95`: bottom navigation absent, deterministic `Chat Home` return present, no composer, no horizontal overflow.
- Create dialog: `role=dialog`, `aria-modal=true`, initial focus entered `#conv-name`, five currently eligible Agents loaded, Project default was Drift (`0`), and no horizontal overflow occurred.
- `/app/`, `/app/chat/95`, `/app/sw.js`, all three V3 SPA roots, and the API proxy returned 200; `/` remained 301 to `/chat/`.
- Docker mount inspection showed the current live container has chat/chronicle/council/app dist mounts.

The first fixed-window screenshot attempt was not used as evidence because headless Edge retained a larger CSS viewport than the cropped screenshot. Acceptance corrected the harness with `Emulation.setDeviceMetricsOverride` before recording responsive observations; this is not a Builder finding.

## 4. Blocking findings

### C1A-R1-01 — P1 — `new` — canonical Conversation identity is absent and the frontend fallback is race-prone

> **Contract clarification `[Alicia / approved]`:** `Conversation` is the durable local history/context container and canonical navigation identity. A runtime/external `Session` is continuity state that may bind to one local Conversation and may change model/endpoint without creating another local Conversation. Therefore a newly created local container is canonically identified as `conversation_id`, not as a durable local `session_id`.

- **Observed evidence:** Real construction probe returned 201 `{msg, data:{session_name}}` with no deterministic created-Conversation identity. Current source declares `SuperiorSessionInitSerializer.session_id` but omits it at runtime because the created `Conversation` instance has `id`, not `session_id`. `api.ts::createConversation` then performs a second list request and chooses the maximum ID among rows sharing `session_name`.
- **Violated invariant:** Frozen Plan §5.2, §6.5, Task 6.6–6.7, §17.2/§17.3 and C1A §19.1.C require a successful write to return the exact created durable local identity and navigate with it. The C0 snapshot's `data.session_id` spelling is now a compatibility claim requiring evidence, not authority to collapse Conversation and runtime Session semantics.
- **Root cause:** **Confirmed.** The endpoint omits the exact created Conversation identity and the frontend compensates by guessing. Read-only archaeology `[opencode-go/deepseek-v4-flash / Ecki]` found no persisted local Session container and no backend/test/extension/TUI dependency on init's `session_id`; it found one active production compatibility consumer: V3 `NewSessionModal.jsx`, whose navigation is already silently degraded because the alias is absent. Existing branch output provides a collision-free dual-field precedent.
- **Affected sibling paths:** Drift/Project/g045 create; list outage after a successful POST; concurrent or repeated same-name creation; preset visibility/filter changes; duplicate retry after a write whose identity could not be resolved; V3 NewSessionModal/ModalContext navigation; API docs and tests; future `RuntimeBinding` semantics.
- **Required outcome:** The endpoint must dual-emit `data.conversation_id == data.session_id == created Conversation.id`. `conversation_id` is canonical. `session_id` is retained only as an explicitly deprecated V3 compatibility alias and has no independent persisted-local meaning. V4 must require `conversation_id`, remove name/max-ID discovery, treat an absent/invalid canonical ID as a contract error, invalidate Recent without making list discovery the source of write identity, and navigate once to the returned Conversation route.
- **Handoff:** `docs/superpowers/specs/2026-09-02-v4-p1a-conversation-create-identity-handoff.md` freezes the backend boundary, verification targets, compatibility behavior and non-goals. Keep `/api/agents/sessions/init/`; do not expand into route renaming or runtime-binding redesign.
- **Chained effects:** Backend serializer and focused response-contract tests; C0 API snapshot/ReactSheet/P1A wording correction; V4 DTO/adapter/tests/dialog success flow; V3 create navigation restored without a V3 source edit.
- **Verification targets:** One controlled init returns both IDs equal to exactly one created Conversation row; Drift/Project/g045 payloads each return their own created identity; missing `conversation_id` is a visible contract failure and cannot trigger identity inference; create enters the matching canonical detail route; tests pin alias equality and deprecation.
- **Preserve recommendation:** Keep `sessions/init/` as the current route, one local Conversation across model/endpoint/runtime-binding changes, existing request/error behavior, duplicate-pending lock, cache invalidation, and the single canonical Conversation detail route.
- **Escalation trigger:** Any proposal that removes the proven V3 alias before V3 retirement, gives local `session_id` an independent persisted-container meaning, renames the route, restores AgentSession, or changes RuntimeBinding lifecycle exceeds P1A and requires explicit approval.

#### P1A-B0 backend independent acceptance — PASS

> **Decision:** `[gpt-5.6-sol / Solaire]` — backend sub-gate PASS. This closes the backend implementation portion of C1A-R1-01 only; overall C1A remains FAIL until the Desktop consumer/docs are corrected and the remaining R1 findings pass.

- **Pinned backend baseline:** HEAD `c183a2fdc5974f150a136db2f5e10c79f139d783`; staged-diff SHA-256 `cb9902dcfb5bfa139fa9e85ed64fea8e983440d40cf1a4506d08b08a58061064`; exactly four staged paths and no unstaged/untracked backend path.
- **Implementation boundary:** staged production diff is limited to `SuperiorSessionInitSerializer` output fields. `conversation_id` and deprecated `session_id` both source the created `Conversation.id`; route, view, request validation, transaction, model, service, RuntimeBinding/external-session and streaming paths are unchanged.
- **Contract documentation:** backend `ReactSheet.md` names `conversation_id` canonical, `session_id` deprecated, and records equality. Desktop contract synchronization remains part of the P1A consumer handback, not this backend patch.
- **Focused independent verification:** identity contract 10/10 PASS; AgentPreset write-lock 4/4 PASS; Django check PASS; migration drift PASS.
- **Final backend regression:** `python.exe manage.py test agents.tests -v 1` ran 1,411 tests: 1,409 passed and 2 skipped, zero failures/errors, exit 0. Expected negative-path logs did not change the test verdict.
- **Safety:** test database only; no real write probe; opening/closing real `AgentPreset` baseline remained exactly IDs 1–8; `git diff --cached --check` PASS.
- **Binary target result:** all eight backend handoff verification targets PASS by source inspection plus tests. No live real-database probe is required for the backend checkpoint; corrected controlled live creation remains mandatory at final C1A acceptance.
- **Backend checkpoint:** commit `29368bbfcf31f64f3baa5c6ba3fec79662d6fb8a` independently rechecked after commit; Plan archived, update log recorded, backend worktree clean, closing AgentPreset baseline IDs 1–8.
- **Release boundary:** P1A-B0 is complete and may be consumed by Desktop repair. This PASS does not authorize P1B, does not permit local Session persistence semantics, and does not waive removal of V4 name/max-ID guessing.

### C1A-R1-02 — P1 — `new` — mobile M1 hides the frozen phase badges

- **Observed evidence:** `shell.css` sets `.app-nav--bottom .app-phase-chip { display: none; }`. The corrected 390px browser probe confirmed Groups/River/Library all have computed badge display `none`.
- **Violated invariant:** Frozen D1 §§4.2, 5 and 7 require the three unavailable M1 destinations to remain visibly disabled **with phase badges**. C1A §19.1.B requires the shell to match D1.
- **Root cause:** **Confirmed.** Mobile projection explicitly suppresses the shared badge elements.
- **Affected sibling paths:** All mobile Chat Home/not-found/non-detail shell routes; every future phase unlock state represented by M1.
- **Required outcome:** At accepted mobile widths, all four slots fit without horizontal overflow and disabled destinations visibly communicate their P2/P3/P4-P5 availability; detail routes must still hide the whole bottom bar.
- **Suggested direction (non-binding):** Use a compact mobile badge treatment rather than hiding the badges. Preserve the single navigation data source.
- **Chained effects:** Bottom-bar height/safe-area padding, narrow-width overflow, touch target/readability, D1 browser checks.
- **Verification targets:** Computed visibility and readable text for each phase marker at narrow widths; four slots within viewport; no detail bottom bar.
- **Preserve recommendation:** Keep M1 order, semantic disabled buttons, one data model/two projections, and C1 detail behavior.
- **Escalation trigger:** If visible badges cannot fit the accepted mobile width without changing D1 IA or bar behavior, pause for D1 adjudication rather than hiding/reordering destinations.

### C1A-R1-03 — P1 — `new` — launcher validates only the app mount and can report a failed reload as success

- **Observed evidence:** `hybrid_start.ps1` computes only `$mountHasApp`. A running container with `/app` but a missing/misdirected V3 mount enters the “all mounts ready” branch. In that branch, `nginx -t` failure only logs an error and continues; `nginx -s reload` exit status is not checked before the script logs “reload … ready”.
- **Violated invariant:** Plan §16.2 and C1A §19.1.D require all four expected mounts and require the existing-container path to apply validated configuration rather than silently continue stale. Project rules also forbid silent failure.
- **Root cause:** **Confirmed.** Readiness is reduced to one destination check and the reload result is discarded.
- **Affected sibling paths:** Existing running container with missing V3 mount, wrong mount source, invalid nginx config, reload failure, and the final success/URL messaging path.
- **Required outcome:** Existing-container readiness must be based on the complete required mount set; configuration validation and reload failures must terminate/report non-success and must never print a false ready state. New/recreated/start paths must preserve the same four-mount invariant.
- **Suggested direction (non-binding):** Centralize a required destination/source mount manifest and a checked nginx validate/reload operation; keep recreation bounded to stateless nginx.
- **Chained effects:** PowerShell parser check; no-container, stopped-container, legacy-three-mount, valid-four-mount, invalid-config and reload-failure paths; Docker smoke and URL assertions.
- **Verification targets:** Each state path produces a truthful exit/result; a simulated missing V3 mount cannot pass because `/app` exists; failed `nginx -t` or reload cannot reach success messaging.
- **Preserve recommendation:** Preserve ports, certificates, PostgreSQL/Django isolation, root redirect, and bounded nginx-only recreation.
- **Escalation trigger:** Any proposed repair that changes backend/DB containers, ports, TLS, or V3 routing requires explicit scope discussion.

### C1A-R1-04 — P1 — `new` — unused `rehype-raw` is declared despite the frozen no-raw/minimal-dependency contract

- **Observed evidence:** `packages/app/package.json` declares `rehype-raw`, while source search finds no import and `MessageContent.tsx` explicitly states raw HTML is not rendered.
- **Violated invariant:** Plan §10 dependency discipline requires only justified direct dependencies; §15.5 requires safe persisted rich text without creating a raw-HTML script surface.
- **Root cause:** **Confirmed.** A reused V3 package entry was copied into the new direct dependency set although the V4 renderer intentionally does not use it.
- **Affected sibling paths:** Package manifest, app lockfile importer, dependency/audit surface.
- **Required outcome:** Remove the unjustified V4 direct dependency and update the lockfile importer without disturbing any V3 dependency that still needs the package.
- **Suggested direction (non-binding):** Manifest/lockfile cleanup only; do not add raw HTML rendering.
- **Chained effects:** Frozen install, typecheck/build, rich-text regression.
- **Verification targets:** No V4 direct/import reference; frozen install and rendering tests pass; V3 lock ownership remains intact.
- **Preserve recommendation:** Preserve Markdown/GFM, code, KaTeX and strict Mermaid behavior.
- **Escalation trigger:** A claim that persisted HTML is required would be a new product/security scope and must pause for approval.

### C1A-R1-05 — P1 — `new` — code-copy failure is silently swallowed

- **Observed evidence:** `MessageContent.tsx::CopyButton` supplies an empty clipboard rejection callback `() => {}`. The action is extra to the read-only acceptance goal and gives no failure feedback.
- **Violated invariant:** Repository execution rules prohibit empty catch/silent failure. The observable risk is a user action that can do nothing with no explanation when clipboard access is denied/unavailable.
- **Root cause:** **Confirmed.** Clipboard failure was intentionally ignored.
- **Affected sibling paths:** Missing Clipboard API, denied permission, insecure contexts, and browser clipboard rejection.
- **Required outcome:** No clipboard failure may be silently swallowed.
- **Suggested direction (non-binding):** Razor-preferred route is to remove the unrequired copy action from P1A. If retained, expose an accessible failure state without adding a notification system owned by P2.
- **Chained effects:** Rich-text UI tests and keyboard/browser checks.
- **Verification targets:** Unsupported/rejected clipboard operation is either impossible because the optional action is absent or produces explicit perceivable failure.
- **Preserve recommendation:** Preserve code readability and syntax highlighting.
- **Escalation trigger:** Do not introduce a global toast/notification architecture in P1A merely to keep this optional action.

## 5. Acceptance harness correction

### C1A-H01 — `harness-defect` — real-probe preset instruction conflicts with repository DB discipline

- **Observed evidence:** Plan §17.6 says to use an “existing visible Agent”, while root `AGENTS.md` permits real probe reuse only through archived preset ID 3 or 4 and requires temporary configuration/visibility restoration.
- **Owner:** Acceptance/Plan, not Construction.
- **Disposition:** The Builder's cleaned probe establishes the runtime envelope observation but is not sufficient as final C1A live evidence. Final Acceptance will use archived preset 3 or 4, temporarily expose it only if necessary for the Recent path, snapshot/restore all touched preset fields, force `is_visible=false` at cleanup, delete the probe Conversation through ORM, and verify the 8-row baseline. No production change is required for H01.
- **Counter effect:** This harness correction does not add a Builder FAIL and does not weaken the create-path requirement.

## 6. Non-blocking observations

### C1A-R1-P2-01 — `/app` without trailing slash returns 404

- **Status/owner:** `new`, Construction.
- **Evidence:** `/app/` is healthy, but `GET /app` returns 404 because there is no exact slash redirect.
- **Recommended outcome:** Add a canonical `/app -> /app/` redirect while retaining `/ -> /chat/`.
- **Timing:** May be included in this repair because nginx is already touched; it does not independently block C1A because the frozen public base is `/app/`.
- **Recheck:** Both paths and unchanged root redirect.

### Accepted limitation — PWA precache size

The service worker precaches 89 static entries (about 3.77 MiB), including Mermaid split chunks. Mermaid execution remains dynamically imported and no API/media response is cached. This is not promoted into a C1A blocker; bundle/precache optimization is adjacent work unless measured startup/storage harm emerges.

## 7. R2 focused re-acceptance

### C1A-R2-01 — P1 — `residual` of R1-01 — canonical ID validation and ambiguous-write retry remain unsafe

- **Observed evidence:** `createConversation()` accepts any JavaScript value whose `typeof` is `number`; therefore `0`, negative and fractional IDs pass and close the dialog before routing to an invalid Conversation path. When a 201 write returns a missing/invalid canonical identity, `CreateConversationDialog` catches the CONTRACT error, then `mutation.isPending` becomes false and the submit button is enabled again. A second click can create a duplicate durable Conversation even though the first write may already have succeeded.
- **Violated invariant:** R1-01 requires an absent/**invalid** canonical ID to fail explicitly, requires exact positive Conversation identity, and forbids retrying the write as though malformed post-write observation proved that no row was created.
- **Root cause:** **Confirmed.** Runtime validation is only `typeof === 'number'`; the dialog has no terminal ambiguous-write state and no Recent invalidation on post-write CONTRACT failure.
- **Required outcome:** Accept only a positive integer `conversation_id`. A post-write CONTRACT failure must visibly state that creation outcome is uncertain, invalidate Recent without using it to infer identity, and permanently disable repeat submission for that dialog instance while still allowing safe close/return.
- **Verification targets:** Missing, zero, negative and fractional canonical IDs each produce CONTRACT failure; no list call is used for identity; a second submit attempt after such a response leaves init POST count at one; valid canonical response still navigates once.
- **Preserve recommendation:** Preserve required canonical `conversation_id`, ignored deprecated alias, one init POST, field/network handling before an accepted write, and canonical route ownership.

### C1A-R2-02 — P1 — `residual` of R1-02 — visible badges outgrow the reserved mobile bottom-bar offset

- **Observed evidence:** Real Edge emulation shows all phase badges visible and untruncated at 320/390/767px, with no horizontal overflow. The fixed bar is approximately `69.75px` high, but `.app-main--bb` still reserves only `54px + safe-area`; approximately 16px of the content/scroll boundary remains behind the bar. At 390px detail route, the bar remains correctly absent.
- **Violated invariant:** R1-02 explicitly included bottom-bar height/safe-area padding among chained effects; D1 requires a usable stable M1 projection, not visible labels over content.
- **Root cause:** **Confirmed.** Badge visibility increased the fixed bar's intrinsic height but its paired main offset remained the pre-badge constant.
- **Required outcome:** One shared deterministic mobile bar-height contract must size both the fixed bar and main offset, including safe-area treatment, at 320/390/767px; desktop and C1 detail remain unoffset/no-bar.
- **Verification targets:** Bar height never exceeds reserved offset; final scroll content is not obscured; badges remain readable/untruncated; no horizontal overflow; 768px desktop switch and 390px detail hiding remain correct.
- **Preserve recommendation:** Preserve M1 order, phase text, semantic disabled state, one navigation data source and C1 detail behavior. Do not add runtime measurement machinery unless a fixed/shared CSS contract is proven insufficient.

### C1A-R2-03 — P1 — `residual` of R1-03 — mount comparison and non-running startup paths can still false-pass

- **Observed evidence:** `Test-NginxMounts` accepts either normalized path containing the other. A concrete wrong source ending in `dist-old` is accepted as valid (`current_comparator_accepts_wrong=True`). Normalization also drops the drive letter rather than mapping `D:/...` and `/host_mnt/d/...` to one exact canonical form. `Invoke-NginxConfigReload` is called only for an already-running, mount-complete container; stopped, newly created and recreated paths can print ready after `docker start/run` without an independently successful `nginx -t`/running-state gate.
- **Violated invariant:** R1-03 requires exact source+destination mount readiness and truthful outcomes for no-container, stopped, legacy/misdirected and running states. Failed configuration/startup must never reach ready messaging.
- **Root cause:** **Confirmed.** Substring comparison was used to compensate for incomplete normalization, and validation was attached to only one branch.
- **Required outcome:** Normalize Windows drive and Docker `/host_mnt/<drive>` forms to the same canonical path and compare exact equality. Every running/start/new/recreate path must prove the final container is running, all four exact mounts are present, and `nginx -t` succeeds before ready output; reload failure must remain fatal where reload is required.
- **Verification targets:** A wrong sibling/prefix/suffix source fails; equivalent Windows/host_mnt/case forms pass; missing any one mount fails/recreates; start/run failure, post-start non-running state, `nginx -t` failure and reload failure cannot reach success messaging; valid existing and recreated paths pass.
- **Preserve recommendation:** Preserve four-mount manifest, nginx-only bounded recreation, ports/certs/root/V3 routes and backend/DB isolation.

### R2 closures

- **C1A-R1-04 CLOSED:** V4 direct `rehype-raw` dependency/importer removed; V3-owned lock entries remain; frozen install and app checks pass.
- **C1A-R1-05 CLOSED:** optional CopyButton, clipboard imports and dead CSS removed; no notification architecture added; code readability remains.
- **R1-01 backend portion remains PASS:** checkpoint `29368bbf` is clean and the corrected archived-preset probe observed equal canonical/alias IDs with complete ORM cleanup and 8-row closing baseline.

## 8. R3 focused re-acceptance and escalation trigger

### C1A-R3-01 — P1 — `residual` of R1-02/R2-02 — shared token still understates the rendered bar

- **Observed evidence:** After rebuilding the production bundle, independent Edge emulation at 320/390/767px measured `.app-bottombar` at `67px`, `.app-main` bottom padding at `65px`, page bottom at y=`779` and fixed-bar top at y=`777`: 2px remain obscured. Labels are visible/untruncated and no horizontal overflow exists. At 768px desktop and 390px Conversation detail, the bar is absent and padding is zero as required.
- **Violated invariant:** The original R1-02 chained-effect requirement and R2-02 required the reserved content offset to be at least the fixed bar's rendered outer height at every accepted mobile width.
- **Root cause:** **Confirmed.** The `65px` arithmetic counts child content/padding and the parent border but omits the inherited transparent top/bottom borders on `.app-nav-item`. Disabled items therefore render at 66px; the parent border makes the fixed bar 67px.
- **Affected sibling paths:** Mobile Chat Home and other non-detail shell routes at 320–767px; safe-area variants use the same base mismatch. Desktop and Conversation detail are not affected.
- **Required outcome:** At every accepted mobile width, the reserved main offset must be greater than or equal to the fixed bar's actual outer height, using one deterministic shared CSS contract; no bottom content may be obscured.
- **Suggested direction (non-binding):** Either account for both child borders in the shared base height or remove those mobile vertical borders and keep the smaller contract. Avoid runtime measurement and unrelated visual redesign.
- **Chained effects:** CSS metric comments, bar/item box model, safe-area expression, 320/390/767/768 and detail browser observations.
- **Verification targets:** Computed main bottom padding is at least the rendered bar height; content/page boundary does not extend behind the bar; labels remain readable; no horizontal overflow; desktop/detail remain unoffset.
- **Preserve recommendation:** Preserve M1 order, visible phase labels, semantic disabled state, shared token approach, no ResizeObserver, and all closed R2-01/R2-03 behavior.
- **Escalation trigger:** This finding itself triggers mandatory three-FAIL adviser escalation. Construction must not edit again until the obstacle report is received and Acceptance records `RESUME AUTHORIZED`.

### R3 closures

- **C1A-R2-01 CLOSED:** positive-integer guard rejects missing/zero/negative/fractional IDs; malformed post-write envelopes are explicit ambiguous writes, invalidate Recent without identity inference, lock repeat submission, remain closable, and keep POST count at one. Focused tests pass.
- **C1A-R2-03 CLOSED:** exact canonical mount comparison replaces substring matching; mount SelfTest passes 8/8 including wrong sibling/suffix/missing/wrong-destination rejection. Source sweep confirms every start/create/recreate/running terminal path reaches the unified running + four-mount + `nginx -t` gate before final ready output; reload remains fatal on the existing-running path. Valid live-container path passed.
- **Closed R1-04/R1-05 and backend checkpoint `29368bbf` remain preserved.**

### Mandatory process action

Three-FAIL adviser intervention completed. `Plan/V4_Phase_1A_acceptance_escalation_C1A.md` received the Builder obstacle report, froze the acceptance predicate, and recorded `RESUME AUTHORIZED` for the narrow geometry repair only.

### R4 focused closure — C1A-R3-01 CLOSED

- **Scope:** Builder changed only the authorized mobile geometry ownership in `packages/app/src/styles/shell.css` plus Builder evidence: bottom-projection nav items drop the inherited transparent border; `.app-bottombar` changes from intrinsically growable `min-height` to deterministic `height` using the existing `--v4-bb-offset`. No navigation restructuring, JS measurement, backend change, P2-01 work, or closed-finding repair was reopened.
- **Independent static verification:** the relevant mobile shell uses one geometry contract from 320 through 767 CSS px; no second width-dependent rule changes `.app-main--bb`, `.app-nav--bottom`, or `.app-bottombar` before the existing 768px desktop switch. The shared token remains `65px`; `git diff --check` and cached diff check pass.
- **Independent focused execution:** `exo-app` typecheck PASS, lint PASS, Vitest **51/51 PASS**, production build PASS.
- **Independent browser evidence:** rebuilt production CSS measured at 320px with Edge/CDP: rendered bottom bar `65px`, main reserved padding `65px`, scroll/content boundary meets bar top with no overlap, phase chips remain visible/untruncated, and no horizontal overflow. Builder's separately recorded measurements at 390/767 agree (`65/65`), while 768 desktop and 390 Conversation detail remain zero-offset/no-bar. Because the same CSS geometry contract applies continuously below the 768px breakpoint, no contradictory width-specific rule exists.
- **Acceptance predicate:** `reserved main bottom offset >= rendered fixed bottom-bar outer height` is satisfied. The adviser explicitly froze this observable predicate and excluded DPR variation/new numeric targets from P1A.
- **Disposition:** **C1A-R3-01 CLOSED. Focused repair PASS.** This ends the three-FAIL repair loop; it does **not** by itself declare final C1A PASS.
- **Harness note:** the independent recheck's temporary Edge cleanup briefly used an over-broad `taskkill /IM msedge.exe`; that cleanup method is a verifier/harness discipline defect and must not be repeated. It does not alter product/source evidence. Future browser cleanup must target only probe-specific command lines/ports/profiles.

### R5 final full regression — PASS

- **Frontend:** frozen install PASS; `exo-app` typecheck/lint PASS; Vitest **51/51 PASS**; root recursive build PASS for all four packages; chat-core regression **85/85 PASS**. Frozen V3 lint debt is unchanged: chat-core 168 problems/exit 1, Chronicle exit 2 and Council exit 2.
- **Dev topology:** ports 5173/5174/5175/5176 each returned HTTP 200; a second app start failed on occupied 5176 as required; all four listener PIDs were individually released.
- **Backend:** checkpoint `29368bbf` remained clean; Django check and migration-drift check PASS; focused suite **87/87 PASS**; opening/closing AgentPreset baseline remained IDs 1–8.
- **Outer deployment:** PowerShell parser PASS; isolated mount matrix **8/8 PASS**; live `nginx -t` and reload PASS; Docker inspection showed exact chat/chronicle/council/app dist mounts. `/` remained 301 to `/chat/`; all four SPA roots, app deep link, app service worker and API proxy returned expected success responses.
- **PWA boundary:** manifest is exactly id `exocore-app`, scope/start `/app/`; built assets use `/app/`; actual browser registration and Workbox cache are scoped beneath `/app/`; no V3 route literal or API/media runtime cache was introduced; generated dist remains untracked.
- **Responsive/geometry:** independent rebuilt Edge checks at 320/390/767 CSS px and DPR 1/2/3 measured bar `65px`, reserve `65px`, overlap 0, readable badges and no horizontal overflow. At 768 desktop and 390 Conversation detail the bar is absent and offset is zero.
- **Read path:** real Conversation 95 pagination prepended an older page with exact scroll-anchor preservation (`height delta == scrollTop delta`, error 0). Loading/error/404/empty and merge behavior remain covered by passing app tests/source sweep.
- **Controlled live create:** Acceptance temporarily exposed only archived preset 3, created named Conversation 114 through the actual V4 dialog, navigated to exactly `/app/chat/114`, read matching detail and empty-history envelopes, then deleted it through ORM and restored preset 3 to hidden. Named residue is zero and the real preset baseline remains 8 rows.
- **Harness corrections:** an initial static check incorrectly expected PWA id `/app/`; frozen authority correctly says `exocore-app`, and the assertion was corrected on the same candidate. Temporary test logs created by Acceptance were removed. Neither harness issue is a product finding.

**Independent disposition:** all C1A A–E technical conditions PASS; no open P0/P1 finding remains. P2-01 (`/app` without slash) remains an unapproved, non-blocking adjacent item. `[Alicia / approved]` confirmed C1A and authorized the paired Desktop/outer checkpoints; P1B unlocks only after both commits exist and are bound in the handback.

## 9. Preserve recommendations

The following already satisfy their observed gates and should remain unchanged unless a listed repair proves the dependency and Acceptance approves the expanded recheck:

- `packages/app`, `exo-app`, port 5176 strict-port behavior, `/app/` base/scope/id.
- D1 order and layout: D-A + M1 + X1 + C1; single navigation data model; full-height detail without bottom bar.
- One canonical detail route for Recent/direct/create.
- TanStack Query ownership and lack of an unnecessary global client store.
- Message paging direction, ascending deduplicated render, terminal `has_more=false`, and route-key isolation.
- Explicit Home/detail/messages loading, error, retry, 404 and empty states.
- `sessions/init/` as the only write endpoint; no runtime/chat mutation surface.
- V3 source/PWA/routes, root redirect, backend worktree, and real AgentPreset row set.
- Additive nginx `/app/` exposure and four live mounts on the current tested container.

If Construction believes a repair must modify one of these areas, it must first report the driving finding, exact affected behavior/files, why a narrower repair fails, alternatives, impact, and evidence to rerun.

## 10. Repair and escalation disposition

The three-FAIL intervention, narrow geometry repair and final full regression are complete. No further repair is authorized or required for C1A. P2-01 remains excluded.

## 11. Frozen artifacts and release boundary

Final regression is complete. Until Alicia's release decision, Construction must not modify

- `Plan/V4_Phase_1A_App_Shell_Conversation_Read_Detailed_Plan.md`
- `Plan/V4_Phase_1A_App_Shell_Navigation_Decision.md`
- `Plan/V4_Phase_1A_App_Shell_Conversation_Read_acceptance_report.md`
- P0 frozen baseline artifacts
- backend beyond accepted checkpoint `29368bbf`

## 12. Release authorization

`[Alicia / approved]` confirmed C1A PASS and authorized the paired Desktop/outer checkpoint commits. Construction may create only those two coordinated commits, record the pair in its handback, and then stop. P1B construction remains a separate phase.

## 13. Review-cycle ledger

| Cycle | Checkpoint ID | Baseline | Verdict | Cause owners | Finding IDs | Supersedes/amends | Consecutive FAIL count | Repeated invariant IDs |
|---|---|---|---|---|---|---|---:|---|
| R1 | C1A | Desktop `45317b8a…`; outer `2322f0cc…` | FAIL | Construction 5; Backend 1; Spec/Acceptance 1; Harness 1 | R1-01..05, H01, P2-01 | R1-01 amended after Alicia clarification + completed archaeology; verdict unchanged | 1 | none |
| R1-B0 | P1A-B0 backend sub-gate | Backend `cb9902dc…` | PASS | Backend cause closed | R1-01 backend portion | Amends R1; overall C1A remains FAIL pending consumer/remaining repairs | 1 | none |
| R2 | C1A focused recheck | Desktop `492b15e2…`; outer `3bab8c8e…`; backend `29368bbf` | FAIL | Construction 3 | R1-01, R1-02, R1-03 residual; R1-04/R1-05 closed | Supersedes R1 repair status; full regression deferred | 2 | R1-01, R1-02, R1-03 |
| R3 | C1A focused recheck | Desktop `72a2531d…`; outer `46585ca7…`; backend `29368bbf` | FAIL | Construction 1 | R1-02/R2-02 residual; R2-01/R2-03 closed | Triggers mandatory three-FAIL adviser escalation; Construction paused | 3 | R1-02 (3 cycles) |
| R4 | C1A focused adviser recheck | Desktop `2a1cfc83…`; outer `46585ca7…`; backend `29368bbf` | **FOCUSED PASS** | none open in focused scope | C1A-R3-01 CLOSED | Ends three-FAIL repair loop; final full C1A regression/checkpoint still pending | 3 | R1-02 closed after intervention |
| R5 | C1A final acceptance | Desktop candidate on `f48b4fe`; outer `46585ca7…`; backend `29368bbf` | **PASS** | none | all C1A technical findings closed | `[Alicia / approved]` confirmed C1A and authorized paired checkpoint | 0 | none |
