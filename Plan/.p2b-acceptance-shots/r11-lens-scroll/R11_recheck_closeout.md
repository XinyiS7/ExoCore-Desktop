### R11 recheck results (independent, post-repair) - CLOSED

- Source scope verified: only the 3 authorized files changed since R10; dist rebuilt
  (index css contains .project-filter-option{...position:relative}, .project-file-input rule gone).
- Acceptance probe EXPECT_FIXED=1 on rebuilt bundle: PASS, all 4 scenarios
  (project-lens 1000x520, agent-profile 1000x520, agent-profile 1000x360, files-upload) -
  zero document overflow and zero doc scroll through wheel/click/keyboard; selection
  behavior intact. observations-after.json in the r11-lens-scroll dir.
- Real-demo spot check (:8080 prod, real backend, read-only): project 4 squashed
  1280x480, filter bar ~900px below fold; click an agent chip + keyboard back-to-all:
  docOverflow 0 / docScrollTop 0 in every state, rows filter correctly. PASS
  (observations-demo.json).
- Full suite 60 files/667 tests 0 failed, lint 0, typecheck 0, diff --check clean
  (LF->CRLF notices only, none in the 3 touched files). Independent runner.
- Verdict: R11 CLOSED (accepted repair). R10 acceptances unchanged; the demo defect
  is resolved on both dev and prod paths with zero behavior change elsewhere.

Verdict: **R11 CLOSED - PASS after narrow repair.** Fresh acceptance round on a
user-reported defect; not counted against the CP1-CP4 consecutive-FAIL chain.