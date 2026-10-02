# V4 Core C2 — Unified Acceptance Report

> **Checkpoint:** C2 — Workspaces + Message Voice + Core Shell/Settings + Assistant-message Notifications
> **Baseline:** Desktop `46315ac` plus accepted one-line P2T harness stabilization
> **Authority:** `Plan/V4_Master_Implementation_Roadmap.md` §8.6 / §17
> **Acceptance owner:** gpt / Solaire
> **Date:** 2026-10-01
> **Verdict:** **PASS**

```text
Cycle: R1 | Checkpoint: Core C2 | Baseline: 46315ac + harness stabilization | Verdict: PASS
Owners: Construction 0, Acceptance 0, Harness 1, Spec 0, Environment 0
Findings: C2-H01 closed | Consecutive FAIL Count: 0
```

## 1. Entry gates

| Gate | Evidence | Verdict |
|---|---|---|
| P2A Agent Hub/Profile | `Plan/V4_Phase_2A_acceptance_report.md` | PASS |
| P2B Project Workspace | `Plan/V4_Phase_2B_acceptance_report.md` | PASS |
| P2T Message TTS | `Plan/V4_Phase_2T_Message_TTS_acceptance_report.md` | PASS |
| P2C Core Shell/Account/Settings | `Plan/V4_Phase_2C_CP_C4_acceptance_report.md` | PASS |
| B5 / B6 backend contracts | predecessor acceptance artifacts referenced by P2T/P2D | PASS |
| P2D Assistant-message arrival | `Plan/V4_Phase_2D_CP_D3_acceptance_report.md` R4 | PASS |
| P2G GroupChat | explicitly deferred; V3-primary and non-blocking by frozen Roadmap | PRESERVED |

## 2. Unified observable outcomes

- V4 canonical Chat remains the owner of ordinary Conversation read/send/recovery and attachment presentation.
- Agent and Project workspaces enter the same canonical Conversation facts without hidden V3 completion pages.
- Message TTS remains click-driven, failure-isolated and single-owner for playback; text truth is unaffected.
- Account/Settings and cross-page shell routes remain available from the V4 owner.
- Canonical assistant Message arrival converges foreground reconciliation, unread/shell indication and background Web Push without duplicate Message, popup or navigation.
- Android background, lock-screen, warm/cold click, offline recovery and desktop multi-window selection are accepted in the P2D R4 matrix.
- GroupChat is not misrepresented as migrated; V3 remains its explicit owner and rollback surface.

## 3. Mechanical evidence

Accepted environment: Node `24.14.0`.

```text
P2D focused probes: 8 files / 115 tests / 115 PASS
Full exo-app regression: 102 files / 1333 tests / 1333 PASS
Typecheck: PASS
Lint: PASS
V4 production build + built-SW gates: PASS
Root workspace build: app/chat-core/chronicle/council all PASS
Git diff check: PASS
```

Built Service Worker retains the explicit-ignore branch, contains zero legacy `/api/agents/registers/` ACK route, and keeps `notificationclose` neutral.

### C2-H01 / harness-defect / CLOSED

The first Node 24 full-suite run exposed one intermittent P2T test assertion that sampled a React passive effect synchronously. Independent repeated execution reproduced the test race without a production defect. The assertion was changed to the same asynchronous `waitFor` pattern already used by the file. The exact case then passed 20/20 fresh processes and the complete suite passed 1333/1333. No production source changed.

Node 25.7.0 is not accepted for this checkpoint because its experimental global WebStorage stub masks jsdom storage APIs and creates unrelated mass failures. The repository's established V4 acceptance environment is Node 24.14.0; this is environment selection, not a product waiver.

## 4. Scope and rollback

- C2 transfers Agent/Project workspaces, Message TTS, Core Shell/Settings and assistant-message notification ownership to V4.
- P2G remains deferred and V3-primary; C2 neither deletes nor imitates GroupChat.
- V3 packages remain buildable as rollback artifacts. No Message, voice artifact, subscription, unread fact or user data was deleted for acceptance.
- No P3 River, B1 Collection, Memory Library, Recall Receipt, Capacitor or legacy retirement work entered this checkpoint.

## 5. Adjacent observation

Alicia has observed occasional V4 “polling failed” UI while connectivity appeared healthy, with immediate manual recovery. The exact banner/URL/status was not captured, so it cannot yet be assigned to P1B Chat Runtime versus P2D arrival reconciliation. Full regression and accepted recovery paths are green, and the development environment is known to produce transient 502s when imported backend Python files trigger Django autoreload. This observation is **not declared fixed or normalized**; capture the exact wording and approximate time on recurrence. It is advisory unless reproduced outside active backend reload or shown to lose/duplicate canonical data.

## 6. Final decision

All frozen Core C2 entry and exit requirements are satisfied with no open P0/P1 finding. **Core C2 PASS.**

Per Roadmap §17, the next phase plan remains gated by **B2 PASS**: `C2 PASS + B2 PASS → P3 River Detailed Plan may be written`.

## 7. Supplemental effective release — LR-01 (2026-10-02)

**Authority:** Alicia / Solaire Acceptance pane5 explicitly authorized this additive closeout; §§1–6 above preserve the original C2 history, including the then-unresolved observation. This supplement does not rewrite the original verdict or attribute every historical transient to the same cause.

The subsequently confirmed Chat lockscreen recovery defect temporarily held effective C2. It is now resolved by Desktop `0b0d4ed` and independent LR-01 R2 FINAL PASS in `Plan/V4_Chat_Foreground_Resume_acceptance_report.md` (report commit `953cae3`). R1 independently passed the full103-file/1345-test suite, typecheck/lint/build and source review. Alicia then confirmed unlocking both during transmission and after completion automatically shows progress/full reply without Continue Polling. Exact duplicate prevention remains automated evidence, not fabricated physical telemetry.

The **lockscreen-related effective C2 hold is removed; effective Core C2 PASS**. B2 remains independently PASS under only its approved exact-three existing migration-test isolation (original949/errors3, remaining946/946; excluded defects not repaired). **Effective C2 PASS + B2 PASS satisfies the P3 prerequisites, but P3 construction is not authorized and is not started.** P2G remains separately deferred/V3-primary.

Builder execution evidence stays at `Plan/V4_Chat_Foreground_Resume_execution_log.md`; construction memo is archived at `Plan/Archived/V4_Chat_Foreground_Resume_Implementation_Memo.md`; diagnosis retains original reproduction at `Plan/V4_Chat_Lockscreen_Resume_diagnosis.md`. No production change or new test/device run was made for this documentary closeout.
