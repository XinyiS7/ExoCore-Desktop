# V4 P3 — CP1 Independent Acceptance Report

Owner: Solaire. Checkpoint: CP1 read path/pagination/long-form reading only; not C3.

## R1 Verdict: FAIL

### CP1-F01 / P1 / new — River lacks a page scroll owner

Observed source chain independently verified:
- base.css:64–79: viewport roots are full-height; body overflow:hidden.
- shell.css:5–10,51–59: full-height flex shell; .app-main is flex column with min-height:0, no scroll overflow.
- AppShell.tsx:44–56: Outlet is rendered directly inside .app-main.
- RiverPage.tsx:50–64: root main.river-page has no app-page/app-scroll or private scroll owner.
- river.css:1: width/max-width/padding/flex/gap only, no height/flex shrink/overflow. Only reading drawer body has overflow-y:auto (:39).

Confirmed cause: long River content has no constrained scrolling ancestor; its minimum content height exceeds the shell, reaches body overflow:hidden, and lower cards/load-more become unreachable. Future route insertion is not a cure. Existing pages use constrained page + app-scroll or a private equivalent.

Violated outcome: approved five-source time browsing/pagination and CP1 long-form close-to-original-flow behavior must remain usable beyond one viewport (frozen input A1–A2/C14). This is a functional accessibility failure, not a naming preference.

Required repair: supply one constrained River page scroll owner consistent with the existing shell; lower content and load-more must be reachable on desktop/mobile. Drawer opening/closing must preserve that scroller's position and prevent background user interaction. Do not enable router/navigation or rewrite existing shell global scrolling to hide the defect.

Suggested direction (non-binding): reuse app-page/app-scroll with minimal layout changes, or give River an equivalent private constrained scroller. No global shell redesign, secondary nested page scrolling or new dependencies needed.

Sibling/verification targets: long stream, empty/error shelf + page, pagination control below viewport, mobile bottom-bar padding, drawer open/close restoration with the actual scroll owner. Extend Builder's own tests for scroll-owner structure and prior-position restoration; jsdom has no real layout and cannot alone establish viewport reachability. Report exact CSS constraint chain or obtain approved isolated browser evidence; no service launch required merely for this repair.

### Preserved passing areas / bounded evidence

Independent source trace confirmed: API normalization matches five source contracts; ordered composite identities; opaque cursor passthrough and load-more guard; cache reset/filter reentry path; initial and continuation source-unavailable semantics without hidden source dropping; global shelf source order; Diary target/preset/day precision; Heartbeat existing read-only detail hook and final content-only render; no raw Markdown HTML or fake word counts; no router/nav/HB/shared/backend production edits for CP1.

Independent test-runner:
- scoped river_api/river_page/shell/heartbeat_api: 4 files, 99/99 tests, zero errors/skips, exit 0;
- exo-app typecheck, lint, build: each exit 0;
- nonfatal Node localstorage warning, large bundle and PWA inlineDynamicImports deprecation.

These jsdom tests render River without real AppShell layout; green tests do not refute CP1-F01. No final full exo-app suite was run while P1 remains open. No DB/HTTP/services/GCal/paid activity or real visual acceptance is claimed.

Nonblocking: malformed continuation item currently permits bounded manual same-cursor retry (not malformed_cursor loop); some drawer assertions are weak and test-provider retry differs from production; StrictMode cache cleanup merits eventual coverage. These do not add frozen MUSTs or require refactoring now. Route and Ledger session bridge remain scheduled CP4; disabled future-stage actions are not fake working controls.

Integrity/scope: independent scout saw only existing authorized CalendarWidget tracked production modification plus untracked new CP1 assets. Untracked frozen documents lack a committed/hash pre-change baseline; no mutation allegation raised, no timestamp-only proof asserted.

## Release condition

Repair CP1-F01 only under the already-authorized CP1 construction scope; preserve passed read/data logic. Deliver changed files, rationale, decisive regression assertions and realistic shell scroll constraint evidence. No CP2/CP4 navigation advance, no C3 verdict, no acceptance-owned file writes or commit without permission.

Cycle: R1 | Checkpoint: CP1 | Baseline: uncommitted River/Diary CP1 new assets + retained KF07 repair | Verdict: FAIL
Owners: Construction 1 defect; Acceptance 1 review; Harness 0 defects; Spec 0 changes; Environment 0 blockers
Findings: CP1-F01 OPEN | Consecutive FAIL Count: 1
Evidence: Plan/V4_Phase_3_CP1_Execution_Log.md; independent scout read chain and scoped test-runner results.

---
## R2 — CP1-F01 focused recheck

Verdict: PASS for CP1 construction checkpoint; CP1-F01 CLOSED. This is not C3, live HTTP or Alicia's visual acceptance.

Independent scout confirmed the actual CSS chain: full-height roots and shell → flex:1/min-height:0 app-main → direct Outlet River root with flex:1/min-height:0/min-width:0/overflow-y:auto. Border-box sizing and mobile bottom-bar reserve share the existing token; one page scroll owner, no duplicate reserve or global shell changes. Portal drawer preserves the owner DOM node and uses background inert/focus restoration. The original missing-owner cause is removed.

Independent test-runner executed:
- new scroll regression alone: 1 file, 4/4 tests, exit 0;
- combined River API/page/scroll + shell/Heartbeat API: 5 files, 103/103 tests, no failures/errors/skips, exit 0;
- exo-app typecheck/lint/build: each exit 0.
Nonfatal Node localstorage, existing large-bundle and PWA deprecation warnings only.

Counterexamples cover two long 20-item pages/tail/load-more contained in the same owner, reading drawer open/close retaining that owner and synthetic scrollTop/focus, and empty/error states. CSS source assertions intentionally lock this Builder implementation; independent acceptance relies on the CSS semantic chain, not exact class/property spelling. jsdom synthetic height/position cannot prove real browser layout/safe-area/visual appearance; those remain final integration/visual targets, not represented as completed.

Current router/nav remain untouched; future CP4 mount must retain the validated constrained scroll-owner chain. Preserved read APIs/cache/pagination/Diary/Heartbeat behavior independently inspected. Scope integrity remains limited by untracked assets with no earlier hash baseline; no unsupported timestamp-only immutability claim.

Release: pane7 may start CP2 Memo content/Tags/thread only under the Detailed Plan and frozen behavior input. Do not advance to Task CRUD, production navigation or CP4 bridge. Complete CP2 with concrete behavior evidence and stop for independent review. C3 and final full-suite/real visual acceptance remain open.

Cycle: R2 | Checkpoint: CP1 | Baseline: repaired River private scroll owner + new Builder scroll tests | Verdict: PASS
Owners: Construction 1 repair; Acceptance 1 recheck; Harness 0 defects; Spec 0 changes; Environment 0 blockers
Findings: CP1-F01 CLOSED | Consecutive FAIL Count: 0
Evidence: Plan/V4_Phase_3_CP1_F01_Repair_Log.md; independent scout/test-runner results.
