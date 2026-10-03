# Legacy Acceptance Asset Retirement (test-only)

- **Date**: 2026-10-03
- **Attribution**: [GPT / Solaire pane5] — Alicia authorized aggressive legacy-test cleanup; Solaire (pane5), original Acceptance owner, explicitly approved one-off frontend script retirement. No P3 C3 rerun gate (FINAL PASS stands).

## Goal

Retire one-off P2A/P2B/P2T browser-probe scripts and the superseded CP2-B9 acceptance probe now that C3 holds, while folding the B9 probe's unique failure ordering into the surviving regression test so no coverage is lost. Keep every historical report, screenshot, fixture/helper, and normal build/test entrypoint.

## Behavior

1. Delete 17 one-off scripts (tracked except the one under untracked `Plan/Diagnostics/`):
   - `Plan/Diagnostics/v4_p3_kf07_serializer_probe.py`
   - `packages/app/src/acceptance/`: `p2a_cp3_browser_observer.mjs`, `p2a_cp3_fixture_probe.mjs`, `p2b_cp1_browser_smoke.mjs`, `p2b_cp2_browser_final.mjs`, `p2b_cp2_browser_focus.mjs`, `p2b_cp3_browser.mjs`, `p2b_cp4_browser.mjs`, `p2b_cp4_creation_browser.mjs`, `p2b_cp4_keyword_browser.mjs`, `p2b_r11_demo_spotcheck.mjs`, `p2b_r11_lens_filter_scroll.mjs`, `p2t_browser_acceptance.mjs`
   - `packages/app/scripts/`: `p2a_browser_probe.mjs`, `p2a_serve_dist.mjs`, `p2b_cp4_browser_probe.mjs`, `p2_delete_browser_probe.mjs`
   - Reference check: `rg` across the repo shows no product import, package-script entry, or test import; only historical Plan reports mention them by name (kept as history).
2. Merge the unique CP2-B9 timing — reply POST in flight → root-create reset unmounts the card → 503 settles during the cleared window → after refetch the draft / real parent target / uncertain alert are intact with exactly 1 reply POST — into `packages/app/src/test/memo_reply_lifetime.test.tsx` as one additional case, reusing the existing `installMemoServer` fixture and local helpers (`ready`/`expand`/`rootPost`/`delayRiver`). Then delete the 91-line `packages/app/src/test/acceptance/cp2_b9_reply_draft_reset.acceptance.test.tsx`.

## Scope / Non-goals

- Test-only. No production code, no new test framework/fixture, no stage/commit, no rewrite of historical PASS/hashes.
- Kept untouched: all historical reports and evidence, `Plan/Diagnostics/P3_River_Visual/` (4 PNGs), screenshot dirs under `packages/app/scripts/`, all normal `*.test.*`/`*.acceptance.test.*` except the one merged probe, shared fixtures/helpers, dev/build/test entrypoints, `Plan/.conversation-delete-acceptance/`.
- No directory is removed wholesale; only the named files.

## Validation

- Reference check: `rg` over the repo shows no product import, package-script entry, or test import of the 17 scripts; only historical Plan reports mention them by name (kept as history).
- Pre-change targeted run: `cp2_b9_reply_draft_reset.acceptance.test.tsx` + `memo_reply_lifetime.test.tsx` = 2 files / 4 tests pass, exit 0.
- Post-merge targeted run: `packages/app/src/test/memo_reply_lifetime.test.tsx` = 1 file / 4 tests pass (3 existing + 1 merged), exit 0.
- Accounting: 17 scripts = 3,112 lines; superseded B9 probe = 91 lines; merged case adds 22 lines to `memo_reply_lifetime.test.tsx` (114 → 136). Net −3,181 lines. 19 other `src/acceptance/*.test.*` files, shared fixtures/helpers, `Plan/Diagnostics/P3_River_Visual/` (4 PNGs), screenshot dirs, and package.json build/test entries all untouched.
- No real service, DB, or network used. Post-change `git status` confirms only the 16 tracked deletions (plus the two untracked-file removals), the one merged test file, and this report; no other agent's dirty files were touched.
