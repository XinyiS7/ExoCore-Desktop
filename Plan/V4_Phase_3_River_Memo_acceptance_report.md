# V4 Phase 3 River & Memo — C3 Final Independent Acceptance

Owner: Solaire. Verdict: **PASS**. Date: 2026-10-03.

## Frozen scope and decision

Behavior input: Plan/V4_Phase_3_River_Memo_acceptance_spec.md. Implementation: approved Detailed Plan, approved Alaric UI mockup and Alicia's accepted technical mappings. C3 covers the River read path and in-scope source actions, not a whole-product/P7 root switch.

CP0/KF07 and CP1–CP4 have independent PASS reports. Their repaired findings (KF07-F01/F02, CP1-F01, CP2-F01) are closed. No remaining demonstrated unmet MUST or P0/P1 blocker.

## Evidence synthesis

- CP0: invalid legacy Calendar quick-create fields/error handling independently diagnosed and repaired; no false HTTP/persistence claims from serializer probes.
- CP1: five-source identity/order/pagination/error semantics and canonical long reads verified; missing page scroll owner repaired and independently rechecked.
- CP2: Memo POST→Tags PATCH, partial success, direct reply count/real parent identity verified; same-page reset losing reply drafts corrected with page-owned lifetime, original independent probe and broader counterexamples passed.
- CP3: three-type Task CRUD/actions/date semantics, source cache synchronization, GCal boundaries and Calendar snapshot honesty verified against backend contracts and tests in two actual process timezones.
- CP4: Legacy canonical details/PATCH/permanent-delete confirmation, session deep-links and preset ownership guard, River routing/navigation verified. V3 compatibility, Groups/Library and product root remain unchanged.
- Live Memo deployment blocker: backend pane6 reported exact existing core.0028_tweet_tags applied after recorder/schema verification and schema backup; no unrelated migrations/data changes. Memo-only/full River and Memo API recovered HTTP200, and Alicia confirmed visible Memo history. This deployment repair is not a repeat B2 acceptance.
- Visual alignment: approved Alaric mockup applied; four desktop/mobile light/dark screenshots recorded. Alicia's actual-page verdict: “可以，这版挺好了”. No further aesthetic approval is pending.

## Mechanical results and precise environment boundary

Independent CP4 scoped run: 16 files/247 tests PASS; typecheck/lint/build PASS. Independent formal whole-app run: 116 files/1489 tests, zero failed/skipped/errors, exit 0, with per-process NODE_OPTIONS=--no-experimental-webstorage on Node v25.7.0.

Default Node25 run remains a recorded environment failure: 26 files/211 tests failed because experimental Node global localStorage lacked getItem/setItem in jsdom. A/B reproduced and isolated this without editing code/assertions. PASS does not claim the unqualified default script works. The process-only flag is the formal execution condition, not a waived assertion.

After visual changes Builder reported 18 files/289 tests and full 116/1489 plus typecheck/lint/build PASS under the same condition. Acceptance independently inspected display/style scope and reran the five affected files: 57/57 PASS. The original CP2 probe SHA256 remains the recorded 1c3bd12cc1322d6d368842ea1bd32cf1aeaf7e2f6ad99f3fb876e017e4c130c2.

## C14 final live evidence assessed

Source: Plan/V4_Phase_3_CP5_Live_Execution_Log.md, final read-only browser section. Builder observed the actual gateway and API, no mock/interception, no new screenshots/body transcription; CDP Network recorded zero non-GET /api/ requests.

- River 1280×900: clientHeight 900 / scrollHeight 7664; 20 actual cards; load-more intersects the viewport at scrollTop 6764. Page count growth is not inferred from this observation.
- Desktop Heartbeat drawer: settled 580×720. Low-height counterexample 580×500: reading body 425/452, actual inner scroll 0→27 while River remains at 609.
- Mobile Diary: settled 390×844 fullscreen; body 752/755, actual inner scroll 0→3 while River remains at 7353.
- Tab/Shift+Tab remain in dialog; background root inert/aria-hidden during open, restored afterward. Close button restores trigger focus and original River position.
- Separate Escape observations on desktop/mobile restore trigger and identical scrollTop (409 / 7353).
- Calendar→Task→Calendar→close, Ledger session refresh/back to River, and Legacy open/close succeeded read-only.
- Animation-in-progress/old-filter-card samples were explicitly discarded, not counted as geometry or focus evidence.

These observed measurements close the previously explicit true-browser layout/focus evidence gap. They complement rather than misrepresent jsdom's synthetic geometry. Alicia's actual visual confirmation and source/test evidence complete the frozen acceptance requirements.

## Retained limits (not hidden PASS conditions)

Task busy-focus was not observed with a real write; it remains the previously classified nonblocking browser risk, not a demonstrated failed invariant. No all-actions real-DB write matrix was required by the frozen spec or performed. GCal remote behavior/paid generation is not claimed verified; snapshot limitations and one-way sync semantics remain explicit. No claim of cross-route/browser-reload draft persistence. Untracked artifacts without historical hash baselines are not claimed immutable by timestamps.

## Release / documentation closeout

Authorize the planned C3 scope ownership/status documentation closeout using this report as verdict source. Builder may update the existing Roadmap/Freeze Index/ownership/handoff/Update_log references as applicable, preserving history and accurately distinguishing P3 from deferred domains. No product-root/P7 switch, no V3 deletion, no backend changes, no git commit without Alicia's authorization. This release closes P3; it does not automatically authorize P4 construction.

Cycle: Final R1 | Checkpoint: C3 | Verdict: PASS
Owners: Construction 0 open blockers; Acceptance final synthesis; Environment Node25 execution condition retained
Findings: all in-scope blocking findings CLOSED | Consecutive FAIL Count: 0

Canonical evidence: CP0/KF07 and CP1–CP4 independent reports; CP5 Live Execution Log; frozen behavior spec; independent scoped/full runner results. No new pipeline or duplicate test framework created for closeout.
