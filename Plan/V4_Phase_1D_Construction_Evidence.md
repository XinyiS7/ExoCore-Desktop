# V4 P1D — Construction Evidence (Desktop Tasks 1–6)

> Working record maintained by the P1D Builders. Frozen Plan hash:
> `a78ea9b754d385f212eb2eba01698297204a18928d5d2172771018b28401e43f`
> (`ExoCore-Desktop/Plan/V4_Phase_1D_Detailed_Plan.md`). The frozen Plan and
> acceptance artifacts are NOT modified by this document or by this slice.

## 1. Start gate record (builder-workflow §1)

- Construction signal: Alicia confirmed P1D resumption via pane 3 (Solaire),
  staged non-trace frontend checkpoint. Task 6 (AssistantRunTrace UI) is
  explicitly deferred until the backend trace contract DTO freezes.
- Read artifacts: `V4_Phase_1D_Detailed_Plan.md` (full), `V4_Phase_1D_Source_Scout.md`
  (full), `packages/app/src/features/chat/{types,api,queries,ConversationPage,ChatComposer,MessageTimeline}.ts*`,
  `runtime/{types,events,storage,useChatRuntime}.ts*` (read-only), `shared/src/{api.js,models.js,models.d.ts,api.d.ts}`,
  `shared/src/endpoints/{conversations,projects}.js`, `ExoCore-Desktop/ReactSheet.md`,
  backend read-only truth: `core/{urls,views,serializers}.py`, `agents/{urls,views,serializers}.py`,
  `engines/{context_cache.py,context_cache_facade.py}`, `memory/serializers.py`,
  V3 parity: `palettes.js`, `AuroraBackground.{jsx,css}`.
- Risk level: **M** — new modules (adapters/queries/hooks/UI) with established
  patterns; no existing production file modified except additive CSS in
  `styles/shell.css` and one focused `ReactSheet.md` correction (DELETE cache,
  proven by source). Cache control hook owns timers → lifecycle matrix applied.
  Escalation triggers checked: no model/schema/migration/transaction change,
  no runtime lease interaction, no cross-tab sync.
- Dirty-work isolation: repo starts clean except untracked
  `Plan/V4_Phase_1D_Detailed_Plan.md` + `Plan/V4_Phase_1D_Source_Scout.md`
  (preserved, not staged). HEAD `63ff0b6` = accepted C1C `54e955c` + `.agents` chore.
- Pane ownership boundaries: ConversationPage / ChatComposer / MessageTimeline /
  runtime/* belong to pane 5 — this slice creates NEW files only and appends CSS.

## 2. Verified contract facts (backend source, read-only)

- Cache GET→ `{active, platform, has_snapshot, snapshot_cache_end_idx?}` when
  inactive; active adds `cache_name, model, created_at, expires_at,
  remaining_seconds, renewals, ttl_seconds`. 404 for unknown conversation.
- Cache DELETE → 204 (may spawn background rebuild thread), 404 when nothing
  active/snapshot. Both remain truthful after release.
- Cache renew POST → 200 `{ok:true, expires_at, renewals}`, 409 `{ok:false, reason}`,
  404 unknown conv (agents/views.py CacheRenewView + engines/context_cache.py
  force_renew).
- Conversation PATCH → agents.serializers.ConversationSerializer writable:
  `name`, `thinking_level`, `memory_injection_enabled` (required=False).
- Project detail → `{id,name,description,prompt,work_dir,created_at}`.
- Project files → bare array of ProjectFileSerializer rows
  `{id,name,file_type,type,size,file,url,preview_url,created_at}` (read-only).
- Project tree → `{path, entries:[{name,type:'dir'|'file',path,size?,entries?}]}`;
  root (`GET /api/core/projects/<id>/tree/`) is recursive; `?path=` returns a
  single level (no `entries` on dirs). Errors: 400 (work_dir missing / illegal
  path chars / file target / traversal), 403 permission, 404 missing path.
- Model catalog → `GET /api/core/model-catalog/` (already consumed by
  `audio/audioTarget.ts` `useModelCatalogQuery`; reused, not forked).
- shared already ships `getCacheStatus/renewCache/deleteCache`; V4 needs strict
  typed validation, so typed adapters live in `features/chat/control/`.

## 3. Construction matrix (dimensions selected)

| Dimension | Frozen answer |
|---|---|
| Invariant | Backend is the only cache/thinking/project truth; Query is the only read owner; no writable mirror; one immutable snapshot rule untouched (runtime owns it, pane 5). |
| Entry paths | HUD strip/overlay, cache control, project drawer, aura picker — all conversation-keyed; Drift (projectId null) issues zero project requests. |
| State | cache: loading/active/snapshot-only/empty/malformed/network-stale; thinking: success/definite-rejection/unknown-save; project: loading/no-work-dir/empty/permission/404/malformed/retry; aura: builtin/custom cap-3/corrupt/theme fallback. |
| Timing | 30s max calibration, pause when hidden, cleanup on unmount/route change; mutations disabled during runtime uncertainty (props from pane 5) and while unresolved. |
| Failure | Malformed responses are CONTRACT errors, never silent success; renew/release failures keep displayed truth until refetch; prefs storage failure keeps in-memory choice + non-blocking warning. |
| Ownership | adapters/queries in `control/`; aura palette engine in `aura/`; project DTO/paths in `project/`; HUD/cache controls in `hud/`; CSS appended to `styles/shell.css`. |
| Observation | Vitest adapter/hook/UI tests + typecheck + lint + build (see §6). |

## 4. Files created (this slice)

```
packages/app/src/features/chat/control/types.ts        — P1D control DTOs (cache/thinking/project, no trace)
packages/app/src/features/chat/control/api.ts          — typed adapters: cache status/renew/release,
                                                        thinking PATCH, project detail/files/tree
packages/app/src/features/chat/control/prefs.ts        — guarded conversation-local preference storage
packages/app/src/features/chat/control/queries.ts      — stable keys + cache/project/thinking hooks
packages/app/src/features/chat/control/useCacheControl.ts — countdown/30s calibration/hidden-pause/mutation lock
packages/app/src/features/chat/aura/palettes.ts        — OKLCH engine port + builtin/custom cap-3 storage
packages/app/src/features/chat/aura/AuraStage.tsx      — ≤3 transform/opacity layers, reduced-motion static
packages/app/src/features/chat/aura/AuraPicker.tsx     — selection + 3-keypoint editor + delete
packages/app/src/features/chat/hud/HudStateStrip.tsx   — top-bar compact read-only strip + trigger
packages/app/src/features/chat/hud/TacticalHud.tsx     — non-reflowing overlay, focus a11y, groups
packages/app/src/features/chat/hud/ContextCacheControl.tsx — cache enable/countdown/refresh/renew/release
packages/app/src/features/chat/project/paths.ts        — safe-path/token/isertion pure rules
packages/app/src/features/chat/project/FileTree.tsx    — presentation-only tree
packages/app/src/features/chat/project/ProjectFilesDrawer.tsx — read-only drawer, root/shared tree + single-level
packages/app/src/styles/shell.css                      — +697 additive P1D section (no existing rule changed)
packages/app/src/test/p1d_cache_api.test.ts            — 13 cases
packages/app/src/test/p1d_thinking_patch.test.ts       — 6 cases
packages/app/src/test/p1d_project_api.test.ts          — 8 cases
packages/app/src/test/p1d_paths.test.ts                — 6 cases
packages/app/src/test/p1d_prefs.test.ts                — 3 cases
packages/app/src/test/p1d_aura_palettes.test.ts        — 7 cases
packages/app/src/test/p1d_hud.test.tsx                 — 8 cases
packages/app/src/test/p1d_project_drawer.test.tsx      — 8 cases
packages/app/src/test/p1d_aura_stage.test.tsx          — 3 cases
packages/app/src/test/p1d_use_cache_control.test.tsx   — 5 cases (fake timers)
```

Not created by this slice (pane 5 / pane 3): `features/chat/controls/`,
`features/chat/trace/`, `test/p1d_runtime_events.test.ts`,
`docs/superpowers/specs/V4_P1D_Assistant_Run_Trace_Backend_Handoff.md`.

## 5. Verification executed

```
# focused P1D slice tests (my 10 files)
NODE_OPTIONS=--no-experimental-webstorage npx vitest run src/test/p1d_*.test.ts(x)
=> Test Files 10 passed (10); Tests 68 passed (68)

# typecheck (temporary tsconfig excluding pane-5 WIP test file; removed after)
=> tsc exit 0

# lint
pnpm --filter exo-app lint => eslint src/ exit 0

# build (full app typecheck + vite build)
pnpm --filter exo-app build => built in 506ms (PWA 89 precache entries)

# whitespace
 git diff --check => 0 findings (after removing trailing blank line)

# full app suite at handoff time: 46 failed / 274 passed (320)
# ALL 46 failures are P1B runtime acceptance/lifecycle tests asserting UI
# elements modified by pane 5's in-flight Task 2/6 work (transport selector
# label, “推理过程 · P1D 开放” placeholder chip, draft-cleanup copy).
# Pane-5 files are M in the shared worktree; this slice modified zero
# existing production files.
```

## 6. Declared boundaries (updated at handoff)

- Zero existing production files modified by this slice (only additive CSS).
- ConversationPage/ChatComposer/MessageTimeline/runtime/* remain pane 5;
  pane 5 has already integrated TacticalHud/HudStateStrip/ProjectFilesDrawer/
  useCacheControl/useProjectTreeRootQuery/paths — integration proof exists.
- Task 2 dispatch snapshot + audio coupling is pane 5 (observed in their WIP:
  `AudioTurnSnapshot.dispatchSettings` matches my prefs keys + HUD props).
- Task 6 trace UI deferred to DTO freeze (pane 5 has WIP `trace/` + events
  test — not reviewed here).
- Full app suite partial FAIL is pane-5 WIP; no C1D claim is made.
- No live/provider probes, no commit, no Plan/acceptance edits.
- Deferred: ReactSheet.md DELETE-cache focused correction (Task 1 scope,
  source-proven) — staged for the next slice to avoid concurrent edits with
  pane 5 on the shared doc.

## 7. Final integrated candidate evidence

> This section supersedes the interim suite result and deferrals recorded in
> §§5–6. Those sections are retained as chronological construction history.

### 7.1 Integrated production facts

- `ConversationPage.tsx` composes the single owners for conversation controls,
  cache mutation, Aura, Project tree/drawer, audio dispatch snapshots, runtime
  overlay, and canonical Query history. No second store, runtime controller, or
  trace replay path was introduced.
- `ChatComposer.tsx` consumes the shared Project tree for `@` completion and
  preserves IME, caret, duplicate-insertion, conversation/project-origin, and
  send-time dispatch conversion rules.
- `MessageTimeline.tsx` projects ordered runtime trace and canonical
  `assistant_run_trace`, including tool-only rows, legacy reasoning,
  empty/truncated behavior, and default-collapsed disclosure. Canonical history
  remains authoritative after terminal reconciliation.
- Runtime normalization accepts the versioned trace DTO through both SSE and
  async polling. Malformed trace remains warning-only and cannot become answer
  text or terminal state. Telemetry is an ephemeral route-local projection;
  its UI explicitly does not claim that every accepted provider request emitted
  telemetry.
- The page owns one `useAura` instance. The HUD receives its controlled state;
  Aura selection is persisted once. Aura choices use a labelled `role=list`,
  `role=listitem` rows, and sibling select/edit buttons; selection is expressed
  by `aria-pressed` on the select button.
- The detail top bar now has a CSS-only responsive layout. At `<=767px` it uses
  two deliberate grid rows (`back/title/more`, then state-strip/HUD/Project),
  constrains the title to one ellipsized line, and keeps the Project trigger
  horizontal. At `<=390px` non-target summary chips are visually condensed so
  the truthful target summary and full HUD trigger retain room. HUD/drawer
  positioning remains fixed overlay behavior and does not reflow the timeline
  or composer. Desktop rules at `>=768px` were not changed.

### 7.2 Acceptance-repair history

- Checkpoint A R1 findings were repaired around one page-owned cache mutation,
  same-tick locking, late thinking callback identity, preset/catalog readiness,
  storage-failure preference retention, and uncertain reread behavior. Frozen
  independent A probes subsequently executed 19/19.
- Checkpoint B R1 initially exposed 44 failures in eight historical C1B files.
  The failures occurred before dispatch because those harnesses omitted the now
  required visible preset/model catalog and still searched the Composer for the
  transport selector. Test setup was corrected to provide
  `deepseek-v4-flash` on endpoint 7 and select async through the real Tactical
  HUD. The original POST-count, lock, storage, recovery, and identity assertions
  were retained; the corrected family executed 59/59.
- The Aura leaf harness was corrected to return declared deterministic mutation
  outcomes instead of `undefined`; its assertions and production mutation
  contract were not weakened. The leaf executed 9/9 with no unhandled errors.
- The final full-suite gate found one stale P1B reasoning placeholder assertion
  in `conversation.test.tsx`. Only that harness was updated: the legacy fixture
  still omits `assistant_run_trace`, and now observes a historical trace that is
  collapsed by default and exposes `hidden reasoning` after expansion. Existing
  attachment, no-download, and composer assertions remain.
- A production-build Chrome probe found narrow top-bar overflow at 320px. The
  responsive CSS described in §7.1 replaced the five-region single row; no
  component labels, behavior, or JavaScript device detection changed.

### 7.3 Final automated evidence

```text
Focused detail integration (p1d_final_integration + shell + conversation):
  3 files / 22 tests; 0 failed, 0 errors, 0 skipped, 0 unhandled; exit 0

Full exo-app Vitest suite (NODE_OPTIONS=--no-experimental-webstorage):
  45 files / 374 tests; 0 failed, 0 errors, 0 skipped, 0 unhandled; exit 0

Historical C1B corrected family:
  8 files / 59 tests; 0 failed, 0 errors, 0 skipped, 0 unhandled; exit 0

Checkpoint-A frozen independent probes:
  4 files / 19 tests; 0 failed, 0 errors, 0 skipped; exit 0

Aura leaf isolation:
  1 file / 9 tests; 0 failed, 0 errors, 0 skipped, 0 unhandled; exit 0

pnpm --filter exo-app typecheck: exit 0, no diagnostics
pnpm --filter exo-app lint: exit 0, no diagnostics
pnpm --filter exo-app build: exit 0
  Vite 8.0.14; 4,366 modules transformed; PWA precache 89 entries
  (only the existing >500 kB chunk-size advisory)
git diff --check: exit 0, no whitespace findings
git diff --cached --check: exit 0, no whitespace findings
```

### 7.4 Externally supplied live acceptance evidence

The acceptance owner reports one authorized live message through archived
preset 3 using `deepseek-v4-flash`:

- emitted Thinking, `memory_search` started/terminal lifecycle events,
  telemetry, and done;
- persisted an `available` assistant-run projection containing two ordered
  items;
- history exposed `assistant_run_trace` and omitted legacy `tool_calls`;
- temporary Conversation 132 and its messages were deleted after the probe;
- archived preset 3 remained unchanged;
- the real `AgentPreset` baseline remained exactly IDs 1–8.

This live evidence was acceptance-owned, not executed by the Desktop Builder.

### 7.5 Declared omissions and boundaries

- The Desktop Builder did not run provider/live traffic or independently award
  acceptance; the single authorized live result in §7.4 is externally supplied.
- The Desktop Builder did not run the post-repair narrow-width Chrome geometry
  recheck. Automated behavior/static/build evidence does not substitute JSDOM
  measurements for browser layout; final browser geometry remains
  acceptance-owned.
- No provider stress, multi-run cost/load test, or cross-browser matrix was run;
  these are outside P1D acceptance scope.
- No commit was created during construction. Frozen Plan, acceptance report,
  and independent probes were not edited.
- P1C-deferred attachment behavior and P2/P6 work were not introduced by P1D.

## 8. Final user-acceptance repair ledger (U-01…U-06)

> Recorded after acceptance-oriented review (risk H: scroll lifecycle,
> pending reconciliation, dispatch semantics, top-bar cache affordance).
> Frozen Plan/acceptance assets were not edited; V3 lint was left alone per
> Alicia’s explicit approval.

### 8.1 U-01 — initial history position

- Single timeline scroll owner `.app-scroll` initializes at latest/bottom via
  one page-owned route record (`conversationId`, `initialized`, `userScrolled`,
  canonical `dataUpdatedAt` revision) and one `useLayoutEffect`, exactly once
  per route identity.
- Never fires on older-page prepend (pending-anchor guard), streaming rerender
  (query `dataUpdatedAt` unchanged), trace disclosure (no dependency), or after
  the user began scrolling (`userScrolled` flag). A→B→A re-initializes per
  identity.

### 8.2 U-02 — bottom affordance / reconciliation

- Near-bottom state (`<80px`) drives a floating “返回最新消息” affordance shown
  only when genuinely away from bottom.
- Clicking the affordance or manually reaching bottom consumes the existing
  pending reconcile exactly once (runtime `applyPendingReconcile` is
  stage-guarded and awaited); the prompt cannot remain while already at bottom.
- Streaming keeps the reader’s position unless near bottom; existing anchor
  paging is unchanged.

### 8.3 U-03 — keyboard rebaseline

- Plain Enter inserts a newline (default), Shift+Enter submits through the
  existing shared submit owner. IME no-send, autocomplete Enter/Tab selection
  while the suggestion list is active, edit/ordinary shared submit ownership,
  and button-send behavior are preserved; the visible hint was updated.

### 8.4 U-04 — direct cache release discoverability

- A compact accessible “−” trigger sits beside the top-strip cache summary,
  rendered only when release is eligible (active or snapshot-only), disabled
  under the same page-owned mutation/runtime lock, and invokes the SAME
  `useCacheControl.release` owner exactly once. No second hook/mutation owner,
  no optimistic cache truth; the full HUD release remains.

### 8.5 U-05 — affordance anchoring (first repair round)

- Initial hard-coded `bottom:118px` produced a real 34px overlap with the
  composer at 320×800 (button top 648/bottom 682 vs composer top 606.25).
- Fixed with a passive `.app-scroll-stage` (relative, flex:1, no scrolling)
  wrapping the sole `.app-scroll`; the absolute affordance anchors 12px above
  the timeline viewport bottom, i.e. directly above the actual composer at all
  widths/content states, with no second scroll owner and no hard-coded
  composer height. Loading/error flex behavior and anchor paging preserved.

### 8.6 U-06 — click-before-reconcile (first repair round)

- The affordance click now scrolls the owner to its current bottom
  SYNCHRONOUSLY, then consumes the existing pending reconcile exactly once; a
  canonical replacement landing later follows the reader only while it stays
  near bottom. Stage guard retained.

### 8.7 Final automated evidence (U repairs)

```text
Focused U + affected scroll/runtime/audio siblings:
  11 files / 93 tests; 0 failed, 0 errors, 0 skipped, 0 unhandled; exit 0

Full exo-app Vitest suite (NODE_OPTIONS=--no-experimental-webstorage):
  46 files / 382 tests; 0 failed, 0 errors, 0 skipped, 0 unhandled; exit 0

pnpm --filter exo-app typecheck: exit 0, no diagnostics
pnpm --filter exo-app lint: exit 0, no diagnostics
pnpm --filter exo-app build: exit 0
  Vite 8.0.14; 4,366 modules transformed; PWA precache 89 entries
  (only the existing >500 kB chunk-size advisory)
git diff --check: exit 0, no whitespace findings
git diff --cached --check: exit 0, no whitespace findings
```

### 8.8 Explicit omissions (U repairs)

- One test-harness timing defect was discovered and corrected (TanStack
  `mutateAsync` schedules the mutation function on a microtask; the first
  cache-release page test asserted before the DELETE fired). Fixed by awaiting
  `waitFor(releaseCalls === 1)`; production mutation ownership was not changed.
- The Builder did not run real-Chrome geometry checks; final browser geometry
  remains acceptance-owned (U-02/U-05 rechecks were independently PASS).
- No provider/live traffic, build-only preview, commit, V3 lint repair, or
  frozen-artifact edits were performed by the Desktop Builder.
