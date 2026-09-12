# P2T Message TTS — Independent Acceptance Spec

Status: FROZEN for CP 2T-1; later checkpoints sequentially gated.
Authority: Alicia's instruction to establish independent acceptance and assign pane 4; refined `V4_Phase_2T_Message_TTS_Detailed_Plan.md` §§4,7,9,10.
Builder: pane 4 (Ecki). Acceptance owner: pane 3 (Solaire). No Plan-review round is requested.

## 1. Ownership firewall

- Frozen plan: `Plan/V4_Phase_2T_Message_TTS_Detailed_Plan.md` (Builder read-only).
- Frozen criteria: `Plan/V4_Phase_2T_Message_TTS_acceptance_spec.md` (this file; Acceptance only).
- Independent ledger: `Plan/V4_Phase_2T_Message_TTS_acceptance_report.md` (Acceptance only; create and stage at first verification).
- Independent probes, reserved to Acceptance:
  - `packages/app/src/acceptance/p2t_contract_acceptance.test.ts`
  - `packages/app/src/acceptance/p2t_control_acceptance.test.tsx`
  - `packages/app/src/acceptance/p2t_integration_acceptance.test.tsx`
- Browser evidence: `Plan/evidence/p2t-acceptance/` (Acceptance only; screenshots and measured output when executed).
- Builder owns only implementation/test paths permitted by Plan §8 and `Plan/V4_Phase_2T_Construction_Evidence.md`. Existing sibling changes must remain intact.
- No Builder edit/stage/commit of independent artifacts. No broad `git add -A`, directory-wide commits, or inclusion of pre-existing ReactSheet changes. Commit is separately released after scope inspection, not implied by checkpoint PASS.
- At first handoff record HEAD, full status, changed-file hashes/diff fingerprint and frozen document hashes. Compare against subsequent baselines. Existing dirty files are not evidence of Builder scope violations without baseline comparison.

## 2. Checkpoint gates (Given / When / Then)

All listed outcomes are MUST within their checkpoint. Gates trace directly to the refined Plan, not a new preferred architecture.

### CP 2T-1 — contract only (Plan D2/D3/D10/D11, §7 CP1)

- T1 Projection: Given valid, missing, malformed and extra-key voice payloads for assistant/non-assistant rows, when normalized through the actual message read adapter, then only valid assistant boolean projections survive; malformed voice never changes canonical content or breaks the message list.
- T2 Transport: Given a particular conversation/message identity, when start/read is called, then the correct POST/GET endpoint and abort signal are used; POST body is exactly `{}`. No text, authoring fields, profile or client cache key; no fabricated content URL.
- T3 Outcomes: Given 200 playable, 202 generating, GET 200 idle, 404, both 422 error variants, 503/504/500 code variants, network failure and malformed success payloads, then outcomes match D3. GET idle always remains idle; 404/422 become unavailable; errors remain truthful and retryable where specified. Verify via actual adapter transport boundary, not only type declarations.
- T4 Scope: Only CP1 adapter/types/projection/construction tests and incremental Builder evidence are implemented. No control, timeline/page integration or future phase work. No frozen-artifact, backend, V3 or dependency edits.

### CP 2T-2 — control and timeline (Plan D1–D13, §7 CP2)

- T5 Lazy lifecycle: Given eligible or ineligible persisted rows and runtime overlays, when mounted, then only eligible rows expose the entry and no automatic request/play occurs (cached true included). Clicking starts one in-flight request; 202 observes retry_after_ms until terminal; GET idle resets to idle. Click-originated playable attempts playback once; retries remain usable. 90-second observation bound and unmount abort/late-response guard apply. No visibility listener requirement.
- T6 Truth/UI: Given generating, playable and retryable failures, then the five-state UI and D6 names are truthful; no generation percentage, cancel or fake time axis. A media error is retryable, not endpoint-404 unavailable. Playback rejection must not falsely show successful playback. Browser policy failure is recorded, not confused with synthesis success.
- T7 Compact/directing: Given otherwise identical directed false/true rows, then only the existing button visual modifier differs: no added text/title/ARIA/node. Compact player lives in actions cluster; pointer and keyboard seek and timing follow the real media element, with D8's allowed pre-metadata duration fallback.
- T8 Ownership: Given TTS and attachment audio (or two TTS rows), when another starts, then prior playback pauses via the existing manager. Cleanup releases playback. No attachment metadata contamination, new cache owner or P1C player refactor.
- CP2 uses MessageTimeline with explicit conversationId; production ConversationPage exposure belongs to CP3. Browser full-route probes are due at CP3, not a premature CP2 blocker.

### CP 2T-3 — real-entry integration and final regression (Plan §7 CP3, INV1–11)

- T9 Route/reconcile: Given route A with pending/rendering/playing voice, when navigating to B, then late A responses cannot write/play into B and no playback ownership remains. Non-destructive reconciliation preserves the same row's voice state; destructive reconstruction may reset to idle as explicitly accepted.
- T10 Isolation/recovery: Given an active chat run, cached voice, media failure or offline generation, when TTS is used, then chat remains operable; no injected assistant error rows, text/trace/runtime mutation, list refetch, scroll disturbance or attachment mutation. Cached click accepts immediate POST playable; media failure permits another explicit POST. Test through ConversationPage, not only isolated control fixtures.
- T11 Layout: Given 320/390/1280 viewport widths and idle/generating/playable controls, then real browser measurements show no control/header overflow and controls remain hit-test reachable. Independent measured evidence is required; jsdom and screenshots alone cannot establish geometry.
- T12 Final pipeline/docs: Entire exo-app suite (construction + independent + existing acceptance), typecheck, lint and build succeed; no failing required gate, skip/xfail substitute or weakened existing assertion. Evidence records actual counts, baseline, limitations and D14 frontend-only documentation correction.

## 3. Rhythm and handoff

1. Release CP 2T-1 only after these artifacts are frozen. Builder stops and submits checkpoint ID, baseline/diff, file list, numeric self-test results, unresolved/unexecuted cases, evidence path and scope deviations to pane 3.
2. Acceptance pins baseline, checks ownership and sweeps all current gates. Source-location work and mechanical commands may be delegated; probe design, evidence interpretation and verdict remain Solaire's.
3. CP1: independent contract probes + CP1 tests + typecheck. CP2: cumulative contract/control probes + affected construction and P1C playback regressions + typecheck/lint. These are checkpoint verdicts, not overall P2T PASS.
4. Only explicit Acceptance PASS/release permits CP2, then CP3. No automatic continuation, self-appointed alternate acceptor, or P2C work.
5. FAIL: batch all discovered blockers with gate, evidence, required outcome, affected paths and focused recheck scope. Recheck failed probes first; defer unrelated full runs while blockers remain. No production edits by Acceptance.
6. Second failure of the same invariant requires a rebuilt state/path/timing matrix. Third consecutive checkpoint FAIL suspends normal repair for diagnosis and an Acceptance-owned escalation artifact. A new session or report amendment does not reset the counter.
7. Final P2T PASS requires T1–T12 complete, full pipeline and independent browser checks. Missing required evidence means no release, not a soft PASS. Only then may next-phase/commit permissions be considered.
8. Communications: read target before sending; confirm submitted handoff once, then wait. Do not broadcast or message idle panes outside an authorized handoff/release.

## 4. Evidence isolation and accepted limitations

- Mock paid/external generation by default; no daemon startup, paid synthesis or real DB mutation is authorized by this acceptance task. Backend semantics are the accepted B5 boundary, not reimplemented/tested here.
- Runtime-offline must be tested deterministically. A live real-service probe, if safely available, records current truth; never assert the daemon must remain offline because a planning snapshot said so. Real synthesis quality/daemon infrastructure remain outside P2T PASS. Do not create real messages/presets to manufacture evidence; any required live write needs separate authorization.
- Backend GET idle is a valid retryable reset, not a fabricated invalid_artifact error. DOM media error cannot reveal an HTTP response body; evidence must not claim that a simulated media error proves an actual content HTTP 404.
- `directed` may be fixture-only. No Range, cancel, persistent voice state or unsolicited playback is promised. Browser autoplay restrictions must remain honest and leave an explicit playback action available.
- Acceptance harness defects are corrected in Acceptance scope and recorded separately, not repaired by changing production to satisfy an invalid probe.

## 5. Durable report schema

At first verify create/stage the report above. Append one row per distinct reviewed Builder baseline: cycle, checkpoint, baseline fingerprint, PASS/FAIL, cause owners, finding IDs, amendments, consecutive FAIL count and repeated invariant IDs. Include gates checked/passed/failed/not checked, executed/pass/fail/error/skip counts, full regression executed/deferred and exact unreviewed areas. No verdict exists at preparation time.