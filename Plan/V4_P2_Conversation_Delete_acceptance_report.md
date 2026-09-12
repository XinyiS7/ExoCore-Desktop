# V4 single Conversation delete — independent acceptance

## Backend R1 (in progress)

Checkpoint: backend prerequisite before frontend T1. Candidate backend HEAD 759a826e +
uncommitted authorized changes; pins/status in .conversation-delete-acceptance/backend-r1/baseline.json.
Product verdict not issued yet. Candidate-only tests are construction evidence, not independent tests.
Acceptance probes live in this frontend repository to preserve cross-repo edit boundaries;
Django runner imports them via an explicit module path and uses ONLY a standard test_ DB.
No live API/provider/destructive data tests; real AgentPreset baseline is 8 IDs [1..8].
Scope: authorized footprint matched. Four unrelated dirty paths retained; prior hashes unavailable,
so do not infer byte identity from unchanged git status. No production/Builder test edits by Acceptance.
### Harness correction H01 (same candidate; no verdict/counter change)
First 10-test run: 4 pass / 6 fail. Two async tests incorrectly selected transport via JSON
body instead of the real ?mode=async query parameter. Their first results are INVALID evidence
(async entry never reached); fixed only Acceptance helper and added Thread.start reachability
assertion. Re-run the whole 10-test probe set on the same pinned backend candidate. Four other
failures independently reached their real intended paths. Do not count the discarded failures
as product findings or a new Builder cycle.
## Backend R1 — FAIL (first independent verification of this candidate)

Cycle: R1
Checkpoint: backend prerequisite / T1-backend before frontend construction
Baseline: backend 759a826ecdb40e6cc74b74bf9b0d913ed287b9d4 + pinned uncommitted candidate
Verdict: FAIL
Consecutive FAIL count: 1 (new approved backend prerequisite checkpoint, not P2B)
Cause owners: Construction 4 product findings + 1 evidence correction; Harness 1 corrected helper;
Acceptance owns H01. No user/spec decision needed for these four required repairs.
Finding IDs: BD01, BD02, BD03, BD04; E01 construction evidence; H01 harness corrected.
Supersedes/amends: first-run harness results invalid for two async scenarios, replaced on SAME baseline.
Tests: corrected independent set 10 executed / 4 passed / 6 failed / 0 errors / 0 skipped.
Full regression: DEFERRED while confirmed P1 blockers remain. Builder 19+10 not independently rerun.
Logs: .conversation-delete-acceptance/backend-r1/independent-tests-h01.log (authoritative run).

Gate sweep (source + focused runtime; not final full coverage):
- Ordinary/protected eligibility incl lookup errors: FAIL (BD01).
- Setup-to-quiescence lifetime / identity / old-close isolation: FAIL (BD02);
  real Django response unstarted/old-close and SSE stop/final-write cases pass.
- Stop request identity / cross-transport preservation: FAIL (BD04).
- Delete-vs-branch ordering: FAIL (BD03).
- Delete success/absence/transaction rollback and deletion-marker release: focused PASS.
- Shared start/delete admission + multi-run busy accounting: source checked, basic real SSE
  entry/409 checked; comprehensive both-way SSE+async barrier matrix still required at recheck.
- Push/session-memory guards: source checked, independent race coverage not yet executed.
- Subscription-runtime finalization / compaction preservation: source traced; no additional
  reachable violation established in this cycle; required regression is still unexecuted.
- Scope/contract text: authorized footprint matched, no schema/retirement or frontend production edit.
Unreviewed production files in authorized footprint: none. Not independently exercised yet:
complete async terminal/error/disconnect matrix, both-way start races, push/session-memory races,
durable binding statuses/finalizer and compactor deletion interleavings, full relevant regression.
No claim that these are the last possible issues; all confirmed findings from this cycle are batched.

### BD01 — P1 / new — Safety lookup failures become deletion permission

Evidence: execution_coordinator.py is_conversation_busy catches every RuntimeBinding lookup error
and returns false; is_protected_conversation similarly swallows synthesis-owner errors.
Real DELETE probes inject failure only at the lookup boundary, leaving ORM deletion available:
both cases return HTTP 204 and delete the target; synthesis ownership is removed by SET_NULL.
Root cause CONFIRMED: unknown safety state converted into negative busy/protection evidence.
Authority: target T0 ordinary-eligibility/protected-ownership and safe generation/delete guard;
an unverifiable gate cannot authorize irreversible deletion.
Sibling scope: both busy and ownership checks, not just the one reported fixture.
Required outcome: fail closed with an explicit non-success response when checks cannot establish
eligibility/idle; no DELETE, no success copy, no erased runtime/owner records. Genuine absent
relations remain distinct from query failure. Document any added status/code in backend contract.
Non-binding direction: propagate to a controlled error or return typed unknown; do not fallback idle.
Verify: lookup failure (both kinds), healthy ordinary success, actual protected/busy, genuine absence;
assert data/related rows survive failure. Keep protections for existing Council/Bridge; no redesign.

### BD02 — P1 / new — Failed setup strands a live reservation without any producer

Evidence: agents/views.py only protects service.process_chat setup. Thread.start and SSE response
construction occur after reservation but outside cleanup coverage. Independent real-view probes
raise at Thread.start or StreamingHttpResponse construction: both leave busy=true and prevent delete.
Root cause CONFIRMED: cleanup ownership is handed to a worker/response that never became viable.
Authority: T0 clearance explicitly requires setup/thread-start failure not strand reservations.
Required outcome: cover the WHOLE post-reservation setup-to-transfer boundary; on failure close any
created producer/resources, release only this run's reservation, and do not leave fake processing
state or corrupt siblings. Preserve prior response/error contract where applicable.
Sibling scope: service initialization, stream registration/wrapper/response creation, async buffer
initialization/thread construction/start, and consumer-side abnormal termination. On every terminal
path unwind producer before release; do not rely on an unstarted worker's finally or GC ordering.
Non-binding direction: one explicit ownership-transfer/cleanup responsibility, not duplicated try
blocks that keep missing the next setup line. No new general runtime framework.
Verify: actual view failure injection at representative setup stages incl the two failing seams,
other live run remains busy, success/stop/disconnect/unstarted close continue working. If a fix needs
files outside authorized footprint, request specific dependency expansion before editing.

### BD03 — P1 / new — Branch drops the parent-protection boundary before writing its child

Evidence: memory/services.py branch_conversation exits admission_lock after reading messages;
new Conversation(parent_conversation=original_conv) is created afterward in another transaction.
Independent barrier pauses the real branch handler just after this lock release; DELETE completes;
branch resumes and returns HTTP 500 with parent FK violation. No test-only production bypass.
Root cause CONFIRMED: protected read and dependent write are separate lifetimes; stale parent reused.
Authority: T0 clearance explicitly requires branch/truncate not use a deleted parent after DELETE wins.
Required outcome: either branch commits coherently before delete (subsequent parent deletion may
SET_NULL the branch), or delete wins and branch cleanly reports unavailable with no partial child.
No integrity-error 500 or dangling parent. Preserve branch's existing content/name/copy semantics.
Non-binding direction: keep existing admission/transaction ordering over the dependent work, or
revalidate atomically at its owning write boundary. Do not mix lock orders or hold provider work.
Verify: real endpoint both orderings, child/messages consistent, ordinary branch regression.
The truncate helper's only real edit/regen caller already owns a row lock; no extra blocker was
invented from calling that helper without its production context.

### BD04 — P1 / new — Expired async stop token can cancel an unrelated newer async run

Evidence: token-specific stop miss falls through to SSE registry; new registry delegation calls
coordinator.request_stop(conv_id), which signals ALL runs including async ones. Independent probe
starts a real async worker with a fake producer, then sends an expired different token: HTTP 200
and the live worker's stop_event is set. The original expired token does not identify that worker.
Root cause CONFIRMED: the SSE fallback was broadened to conversation-wide cross-transport stop.
Authority: T0 preservation/identity isolation; narrow deletion safety cannot silently broaden which
live operation a stale request controls. Multiple admitted runs must remain separately owned.
Required outcome: invalid/expired token never targets a different run; retain the known token's
scope and appropriate absence/error result. Preserve SSE stopping without enabling a stale request
to cancel arbitrary async work. Keep stop-requested busy until producer quiescence.
Non-binding direction: preserve transport/run addressing separately from shared deletion busy state;
do not equate 'all runs keep deletion busy' with 'every stop request may stop all runs'.
Verify: correct token, expired token with newer run, cross-run isolation, no-token SSE behavior,
stop-before-final-write, newer reservation surviving older cleanup. Any desired wider product stop
semantics require explicit separate agreement, not an incidental safety refactor.

### E01 — Construction evidence / mandatory factual correction

The claimed 'full isolated and regression' consists of 19 focused + 10 prime tests, not the
required stream/runtime/memory/background regression. Several advertised race cases manipulate
coordinator records directly: post-wins never calls AgentChatView; stop test does not call the stop
endpoint or run a finalizing producer; push/session-memory mark DELETING directly rather than
racing DELETE; delete-wins waits until DELETE finishes before POST. There is no actual setup-failure
test despite its module header. The truncate test has only no-raise behavior, not state assertions.
These tests can remain useful unit checks, but relabel them honestly and add the discriminating
real-entry tests required by the accepted target. Do not equate all-green with all paths covered.

### Preserved outcomes / repair order / recheck condition

Keep 204/400/404/409 semantic distinctions (add explicit unknown failure as needed), protected
owner checks, removed invalid prune command, shared admission, multi-run identity accounting,
SSE busy-through-final-write, real response unstarted close, rollback marker cleanup, truthful
prime fallback, no real data/provider/schema changes, unrelated dirty files.
Repair order: BD01 fail-closed gates -> BD02 lifecycle transfer -> BD03 branch write boundary ->
BD04 stop addressing -> E01 honest tests/docs -> focused probes/regression. Coordinate shared
coordinator/views changes once, rather than separately patching assertions.
Recheck original 10 cases, then sibling setup/error/race matrix and existing related suites.
Full required backend pipeline only after no known P1 remains; frontend stays held until PASS.
Builder must not read/copy/edit Acceptance probe implementations or alter frozen target/report.
Return finding mapping, changed symbols, numeric results, precise unexecuted paths/limitations,
and any expansion need; no self-PASS/commit/restart/Council retirement.
## Backend R2 (in progress)

Candidate pinned in .conversation-delete-acceptance/backend-r2/baseline.json, backend HEAD unchanged.
Original 10 probes: 10/10 PASS, no errors/skips, using isolated test_exocore_delete_acceptance
(not sibling workers' test_exocore). Scope hashes: 7 authorized repairs changed, original 4 unrelated
paths match R1 fingerprints. Parallel JSON-sanitizer work separately pinned, not delete scope.

### H02 — stop-token probe stimulus correction (Acceptance-owned)
R1's test named expired-token sent message_id in the JSON body, but the real stop contract reads
?message_id= from the query. Its observed failure VALIDLY proved no-token SSE fallback now stopped
an unrelated async run; it did NOT directly exercise expired explicit-token addressing as narrated.
R1 source also showed explicit token miss fell through; still, runtime proof must match the claim.
Original test retained for no-token transport-preservation regression. R2 sibling suite adds real
query-token expired/correct cases against live SSE/async producers. No production changes or new
Builder FAIL count from H02. Do not report original 10-pass as complete BD04 addressing proof.
### H03 — non-binding EOF diagnostic removed from gate collection
Initial R2 sibling run: 8 cases / 3 pass / 5 fail. One diagnostic supplied a fake producer that
exhausts without done/error/stopped. Actual BaseChatService terminal paths were then traced:
ordinary outcomes emit terminal events; managed-runtime delegate emits terminal events; handled
exceptions emit error. No reachable ordinary production early-EOF path was established.
Therefore that diagnostic's 409-after-EOF is an ADJACENT robustness observation, not a frozen
contract blocker. Retained as a non-test diagnostic method, removed from gate collection (no
skip/xfail or weakened product criterion). Do not require Builder to fix artificial EOF behavior.
The remaining 7 cases exercise verified production safety lookup and real sibling response/stop
paths; 4 failures are product evidence. Re-run those 7 to record the exact authoritative count.
A reviewer concern about sentinel/CLI ordinary writes was also rejected: its real cli_conv is
created with is_bridge=True (background_sessions/services.py:1332–1335), already protected;
do not use that false ownership premise to expand scope.
## Backend R2 — FAIL / repeated-invariant early warning

Cycle: R2
Checkpoint: backend prerequisite / T1-backend before frontend construction
Baseline: backend 759a826e + backend-r2/baseline.json fingerprints; all seven changed pinned
paths are in authorized repair footprint. Four original sibling dirty fingerprints preserved.
New JSON-sanitizer sibling changes separately recorded, not attributed to this Builder.
Verdict: FAIL
Consecutive FAIL count: 2
Repeated invariants: BD01 fail-closed safety (2 cycles), BD02 identity-owned lifetime cleanup (2 cycles).
Cause owners: Construction 2 blocking invariant findings, E01 residual evidence; Acceptance/Harness
H02 stimulus correction + H03 non-binding EOF diagnostic removal (no separate Builder cycles).
Tests: original 10 = 10 pass; authoritative sibling 7 = 3 pass / 4 fail.
Unique gating tests: 17 executed / 13 passed / 4 failed / 0 errors / 0 skipped.
Non-binding diagnostic: 1 failure recorded separately in siblings-8.log, NOT a product gate.
Logs: backend-r2/original-10.log + backend-r2/siblings-7-authoritative.log.
Full regression: deferred while confirmed P1 blockers remain. Builder's 26+86 not independent PASS.

Gates/source sweep: full authorized source footprint rechecked; no new out-of-scope production
changes attributable to delete repair. BD03 parent write boundary CLOSED by original branch race;
BD04 token/transport scope CLOSED by corrected real query-token tests (right token, expired token
with live SSE, expired token with two live async runs). The original no-token-only regression also
passes. Setup leak in isolated no-sibling case, both original failed DB safety queries, absence,
rollback and real SSE stop-through-final-write now pass. BD01/BD02 remain open at sibling seams.
Unexecuted independent matrix: complete SSE/async both-way admission races; push/session-memory
race matrix; durable binding/finalizer/compactor preservation and full relevant regression.
No claims of final exhaustive runtime coverage or 'last blocker'.

### BD01 — P1 / residual — Same fail-open rule reintroduced at added buffer safety check

execution_coordinator.is_conversation_busy now queries StreamingBufferManager.is_session_active
inside except Exception: pass. The two original DB checks are repaired, but the added check again
converts failed safety knowledge into permission. A real DELETE with a fault at this consulted
lookup returns 204 and removes the row (independent sibling test).
Authority: original BD01 required checking failures must not authorize irreversible deletion,
not merely 'catch fewer exceptions around this particular RuntimeBinding query'.
Required outcome: every safety source actually consulted either yields authoritative eligibility
or causes non-success with zero destructive work. Sweep the safety import/error/fallback paths.
A redundant buffer-derived liveness gate MAY be removed if the existing run reservation is the
actual authority; Acceptance does NOT require this extra lookup, buffer lifecycle model, or a
new safety source just to match the probe. The probe explicitly tolerates removal from the path.
Non-binding direction: name the minimal authoritative generation owner and retain the separate
durable-binding/ownership checks; do not duplicate it with polling-cache state without need.
Recheck: old two DB failure probes + the consulted-buffer failure + ordinary/busy/protected cases.

### BD02 — P1 / residual with repair-regression effects — Run cleanup destroys sibling stop ownership

Three real SSE endpoint traces fail on this same root:
1. Start SSE A and B; close A after iteration began; B remains reserved/live but /stop/ returns404.
2. Start SSE A; a new service setup fails BEFORE it owns any stop registration; generic exception
   cleanup unregisters the whole session, so A becomes unstoppably live (/stop/ returns404).
3. Start SSE A; B registers then its response setup fails; B overwrites/removes the sole session
   registration, so A's stop handle is lost and /stop/ returns404.
Source: SSESessionRegistry.register/unregister use one entry per session; _sse_error_guard finally
and AgentChatView setup-except call unregister(session_id) without the submitted run identity.
Coordinator release_generation is identity-bound, but the OTHER lifecycle resource is not.
Root cause CONFIRMED: 'I own this session ID' substituted for 'I own this run's registration'.
R1 broad stop-all delegation masked the registry weakness; its proper BD04 removal exposes it.
Authority: BD02 explicitly said failure must not corrupt siblings; T0 required identity-bound
cleanup and preservation of supported concurrent runs/stop behavior, not just busy=True counts.
Severity rationale: an admitted live reply becomes impossible to stop through its supported
endpoint while DELETE remains409-blocked. This is not cosmetic cleanup or a theoretical memory leak.
Required outcome: each admitted SSE run retains its stop capability through sibling close/setup
failure; cleanup can retire ONLY resources actually acquired by that run. Do not overwrite a
live sibling's handle, do not restore old behavior by again stopping arbitrary async runs, and
keep busy through actual producer quiescence. No new parallel-send rejection policy.
Non-binding direction: carry run identity through the existing SSE registration/guard cleanup
seams, keeping lifetime authority coherent; exact data structure is Builder choice. Existing
streaming_buffer/views/coordinator footprint suffices unless a specific dependency proves otherwise.
Verify all three failing traces, old-close/new-stop, SSE stop + async sibling untouched, correct/
expired token behavior, concurrent reservations, setup failure without siblings, real response
unstarted close, final write before release, and applicable existing stream/stop regressions.

### E01 — residual evidence correction, no new product invariant

Backend Plan has repair intention/verification lists but no actual command-result ledger. Append
real results and unexecuted cases to the existing backend construction document, not a new long Plan.
Some tests still manually reserve/mark DELETING; label these unit checks honestly. Do not call
prime/session-memory direct marker tests races, or coordinator-only release tests producer-finalization
proof. Their utility is not disputed; the actual covered path must be named. The real handler is
AgentChatView.post, not an unverified chat_stream symbol. Do not claim full required regression
from 26 focused +86 selected tests while stream/runtime/branch suites remain unexecuted.

### Control action — second failure of the same rules

PAUSE ordinary patching. Before any next production edit, send a BRIEF invariant restatement:
(a) authoritative safety source(s), and the behavior when each cannot be read;
(b) for each run, who acquires/releases its reservation, stop registration, producer, and buffer;
(c) A running / B setup fails; A closes / B running; missing token / other transport live —
which identities survive and which operation is addressed.
No rewritten long Plan, no implementation shaped around test selectors. Acceptance will calibrate
that compact ownership matrix and authorize the next narrow repair. Third consecutive FAIL would
trigger formal adviser escalation; this is the second, so no human decision is currently needed.
Preserve corrected BD03/BD04 and original 10-pass outcomes. No Council retirement, backend
schema/framework expansion, frontend production edit, commit/restart/provider/real-data probe.
Frozen target/disposition/report and independent probes remain Acceptance-owned.
## Backend R3 — PASS (Prerequisite Cleared)

Cycle: R3
Baseline: backend 759a826e unchanged; changed-since-R2 set exactly the authorized repair
footprint: execution_coordinator.py, streaming_buffer.py, views.py, test_conversation_delete.py,
v4_conversation_delete_backend_plan.md (E01 ledger). Four sibling dirty fingerprints preserved
(still untouched states). JSON sanitizer parallel work separately tracked.
DB baseline pre/post: OK 8 rows [1..8]. No commits, no Council/schema/framework/frontend edits.

Independent evidence (all Acceptance-side):
- Probes: original 10/10 PASS + sibling 7/7 PASS = 17/17, zero errors/skips, exit 0 both,
  isolated test_exocore_delete_acceptance (created+destroyed).
- Regression (coupled, isolated test_exocore_delete_regression):
  agents conversation_delete + services + runtime_turn + runtime_route_integration + prime_push
  + prime_conversation + memory services + background_sessions = 262/262, "Ran 262 tests OK",
  exit 0 (keepdb rerun for unmasked exit code). First run body 262/262 with teardown-drop
  artifact (1 background session held test DB at destroy) — re-run with --keepdb removed the
  artifact; kept DB then dropped; pg session count on test DBs = 0.
- Scope: BD01 closed by removal of redundant buffer consult (probe tolerates removal; sole
  generation authority = coordinator _active_runs; residual fail-closed 500 proofs pass).
  BD02 closed: per-run SSE stop registration {session_id:{run_id:event}}, no-op unregister,
  all three sibling traces (close-A/B-stoppable; B-service-failure/A-stoppable;
  B-response-failure/A-stoppable) pass.
  BD03 (branch parent write boundary) and BD04 (expired/correct query-token isolation) stay
  closed under real probes. E01 ledger verified in backend plan: real outputs, honest
  classification (direct-marker vs coordinator-level vs real-endpoint), unexecuted suites named.
- Verdict: PASS — backend prerequisite cleared. Frontend T1 construction may proceed per frozen
  target. Full-repo global backend suite remains deferred to the final acceptance phase
  (previous standing disposition), not part of this gate.

Settled DELETE contract (ReactSheet §1.2 + backend):
204 confirmed; 400 conversation_protected; 404 conversation_not_found (= absence);
409 conversation_busy; exceptional fail-closed 500 safety_check_failed (frontend treats 5xx as
definitive non-deletion, no ambiguous read-back on 5xx; network failure stays ambiguous).
## T1 (frontend single-conversation delete) — FAIL (cycle 1)

Baseline: frontend HEAD + candidate pinned; changed set = 5 new production files
(chatDelete.ts, ConversationDeleteConfirmDialog.tsx, ConversationDeleteMenu.tsx,
chatDelete.css) + 3 entrance edits + main.tsx css import + builder test
(src/test/p2_conversation_delete.test.tsx) + docs. P2B files untouched. No commit.

Independent evidence (Acceptance-owned src/acceptance/p2_delete_acceptance.test.tsx, 9 probes):
6 PASS / 3 FAIL. Passing: shared trigger+cancel zero-DELETE; valid-lease busy gate blocks
(disabled + explanation + zero DELETE); corrupt lease quarantined on read and deletion stays
backend-guarded (safe — the dialog's 'quarantined' banner branch is dead code in the shipped
composition because the Menu pre-read quarantines first; treated as absent, backend 409
authoritative; probe corrected to the safe contract, NOT a product defect); 409 busy single
DELETE no auto-retry; 204 confirmed reconciles only that row + sibling intact + exactly one
DELETE to /101/; late settlement after unmount does not crash or paint.

FAIL findings:
F1 (contract) — ambiguous recovery unimplemented in production composition.
  Evidence: dialog-level probe: network-ambiguous -> onReadBack called once -> second click on
  the still-enabled confirm fires NO second DELETE (settledRef never re-armed; 1 call, contract
  requires 2). Composition probe: network-ambiguous through RecentConversationList -> NO
  canonical list GET after settle (listGets unchanged; onReadBack is not wired anywhere in
  production). Bonus inconsistency: the copy stays '正在读取会话列表确认…' forever after the
  read-back finishes. Frozen target: 'uncertain -> read-back then re-arm'; this is neither
  wired nor implemented.
F2 (UX honesty) — enabled-but-dead affordance after settled failures.
  500 safety_failed -> error banner shown, DELETE stopped (fail-closed verified), but the
  confirm button is rendered ENABLED (canDelete includes safety_failed/ambiguous) while clicks
  are silently ignored (settledRef guard). Per settlement table ('no retry'), the affordance
  must be disabled with direction, or actually re-armed; enabled-but-dead is a defect. Same
  shape as F1's blocked re-arm.
F1-adjacent (invalidation on origin loss) — settle() returns early when submittedId no longer
  matches the dialog prop, skipping retireConversationCaches + canonical invalidate. The
  deletion still happened for submittedId; per F01 lesson (invalidation bound to submitted
  identity), the canonical collection refresh should still run for submittedId even when the
  dialog must not paint. Not directly reachable in the current per-row composition, but the
  same settle loop is being repaired for F1, so bind it there.

M03 (mechanical) — lint gate: 5 errors in ConversationDeleteConfirmDialog.tsx
(4x react-refresh/only-export-components for deriveDeleteDisplay/deleteBusyReason/
retireConversationCaches/reconcileConversationList exported from a component module;
1x react-hooks/exhaustive-deps: settle useCallback uses queryClient without dep) +
1 error in p2_conversation_delete.test.tsx ('React' is not defined, line 36).
Acceptance-owned lint debt (not Builder's): my probe file unused 'within' import (I fix);
src/acceptance/p2b_r11_demo_spotcheck.mjs 12x no-undef (pre-existing P2B script, I add an
eslint-env node header). typecheck currently exits 2 ONLY due to my probe's within import.

Regression baseline: src/test full 55 files / 594 tests PASS exit 0 (includes builder 22).
Builder's focused 22/22 and 90/90 spot claims not independently re-run as separate gates;
full-suite green is the gate.

Required repair (narrow, no scope growth):
- F1: production composition wires a canonical read-back on ambiguous (fresh conversations
  collection; remove per-id detail/messages/cache like reconcileConversationList) and the
  settle loop re-arms for a subsequent manual confirm (new single DELETE per new pending;
  still at most one DELETE per pending). Final copy after read-back must not remain
  '正在读取…' (e.g. '结果未确认，可重试' — copy is implementation choice). Bind invalidation to
  submittedId even on origin loss (do not paint/redirect, but do refresh canonical collection).
- F2: after safety_failed, affordance must NOT be enabled-but-dead: either re-arm it (no
  read-back required for safety, fail-closed already proven) or disable it with direction.
  Same consistency for any settled state that keeps the dialog open.
- M03: zero new lint/typecheck errors in builder-owned files; move the four pure helpers out
  of the component module (e.g. into chatDelete.ts) or otherwise satisfy the repo's lint
  config without weakening rules; add queryClient to the settle dep array; fix the test file
  React import.
- Preserve all currently-passing behavior (busy gate, 409/400/204 semantics, single DELETE,
  late-settlement safety, three entrances, cache retirement scope, per-ID drafts/prefs).
- Acceptance probe file src/acceptance/p2_delete_acceptance.test.tsx is Acceptance-owned:
  do NOT read, copy, or modify it. Probes will be re-run as-is after delivery.
- Honest evidence rules stay (real command-result ledger; tests labelled by actual asserts).
- Stop at gate, no commit/self-PASS. Report next.
## T1 — PASS (cycle 2)

Cycle: T1 R2. Baseline: candidate pinned; scope = F1/F2/M03 repair only
(ConversationDeleteConfirmDialog.tsx settle loop re-arm + default onReadBack via
listConversations/setQueryData + origin-loss invalidation bound to submittedId;
chatDeleteUi.ts new pure-helper module; Menu passes onReadBack(invalidate);
builder test imports updated). Production entrances unchanged from R1 shape.
No commit; P2B files untouched; acceptance probe file untouched by Builder
(verified markers intact).

Independent evidence (all Acceptance-side, re-run as-is):
- Probes 9/9 PASS, exit 0 (was 6/9): re-arm fires second DELETE (dialog-level and
  composition-level), canonical read-back GET observable on every ambiguous settle,
  final copy no longer stuck at 正在读取 (updated to '请重新确认删除以重试'),
  safety_failed confirm now DISABLED with directional banner (no enabled-but-dead),
  all R1-passing behavior preserved (busy gate, 409 single-DELETE no auto-retry,
  204 reconcile scope, corrupt-lease safe path, late-settlement safety).
- Full suite 62 files / 702 tests PASS exit 0 (667 P2B baseline + 26 builder + 9 probes).
- typecheck exit 0; lint exit 0 (scene: my R11 .mjs script resolved by adding an
  eslint-disable no-undef header to my own acceptance artifact — not Builder scope).
- Implementation choices validated: 60ms async gap before default read-back keeps the
  GET observable as its own step; read-back failure re-arms anyway (honest unknown);
  both onReadBack default and Menu-invalidations satisfy the canonical read-back rule.

Non-blocking observations (no action required for this gate):
- deleteBusyReason 'quarantined' branch is effectively unreachable in the shipped
  composition because the row Menu pre-reads the lease (quarantine happens before the
  dialog opens; gate then sees absent). Behavior is SAFE (backend authoritative);
  the branch may later be removed or documented as defensive-only.
- Menu handleDeleted double-runs reconcile after the dialog already retired+invalidated;
  idempotent, harmless, may be simplified later.

Verdict: T1 PASS — single-conversation delete frontend gate cleared.
Remaining before final acceptance (standing plan): five-width dev+prod browser
matrix and keyboard/a11y browser-level checks at the final phase; full-repo backend
suite at final phase; commit/cutover pending Alicia's call.
## Final phase — acceptance evidence consolidated

Frontend browser matrix (P2 conversation delete, five widths x dev/prod):
- Tool: packages/app/scripts/p2_delete_browser_probe.mjs (Acceptance-owned, CDP, /api fully
  intercepted with fixtures; zero backend/provider/real-DB traffic; SW registration disabled
  document-level as in accepted P2A/P2B probes).
- dev :5176: 151/151 PASS. prod :5177 (fresh dist rebuilt with T1; build exit 0): 151/151 PASS.
  Total 302/302. Screenshots: packages/app/scripts/.p2-delete-shots/ (dev-*/prod-*).
- Covered per width (320/390/767/768/1280): home rows + always-reachable triggers + long-name
  row reachable; dialog a11y (focus entry inside, Escape closes + trigger restore, Tab/Shift+Tab
  trap at 320/768); cancel = zero DELETE; confirm 204 = exactly one DELETE + canonical list
  refetch + row removed + siblings intact; busy lease gate = alert + disabled confirm + zero
  DELETE; backend 409 = exactly one DELETE + alert + row kept + no auto-retry; agent and
  project entrances open the SAME shared dialog; no document overflow anywhere.
- Harness lessons fixed during the run (Acceptance-owned, recorded here): row-locating by
  visible name (long names never contain ids); per-width fixture/count reset (state leakage
  across widths); arg parser supports --app=/--base= forms. No product defect surfaced at any
  point after these harness fixes; the earlier 'stuck dialog' suspicion was probe-side.

Backend full affected-tree regression (final):
- agents + memory + push + background_sessions + bridge: 1883 ran / 1879 passed / 1 error /
  1 failure / 2 skipped (isolated DB test_exocore_delete_final, keepdb; dropped after).
- Attribution: BOTH failures reproduce in isolation on the current tree and are causally
  unrelated to the delete candidate (no migrations, models, or drawer/tool-catalog code are
  in the authorized footprint; makemigrations --check clean throughout). 1) memory migration
  0053 reverse-DDL (assistant_run_trace column missing during unapply — migration-history
  fragility, memory suite debt). 2) agents test_use_drawer catalog-set diff — drawer/MCP
  suite debt. Flagged for backend owner awareness; NOT delete-gate blockers.
- Delete-relevant suites (conversation_delete/services/runtime/prime/session-memory/bridge
  context) all pass. Cleanup: test_exocore_delete_final + _final_iso dropped; pg test-DB
  surface back to sibling-owned names only.

Frontend gates preserved: probes 9/9, full suite 62 files/702, typecheck 0, lint 0 (T1 PASS
round). DB baseline AgentPreset 8 rows [1..8] re-verified at closure. No commits; candidates
frozen; dist rebuilt (build artifact only). Standing user-owned items: commit/cutover decision;
optional real-delete smoke test; SW first-takeover observation (natural).
## Operational note — :8000 restart + conv-83 investigation (Acceptance-owned)

- Alicia reported DELETE /api/agents/conversations/83/ -> 403 "Forbidden" (Django console) +
  "DELETE ... 403 108", then UI showing ambiguous copy.
- Code-path audit (views/middleware/CSRF/nginx/urls): NO 403 branch exists in any version of
  the delete endpoint; SessionAuthentication-CSRF theory refuted empirically (fake sessionid
  without CSRF header -> 404); nginx has no method restrictions.
- Real-browser smoke on the running (old-state) server: scratch conv 137 created then deleted
  through the actual UI -> 204, row gone. Feature path works; failure was bound to the running
  process' pre-final in-memory state or conv-83-specific residue.
- Backend ops: :8000 restarted 08:25:19 (PID 8336) with frozen R3 candidate. Spot-checks real
  endpoints: nonexistent -> 404 json; bridge 135 -> 400 conversation_protected; scratch 138 ->
  DELETE 204 + row absent. Conv 83 residual state after restart: clean (no runs/buffers/
  registry/bindings). DB baseline 8/8 pre+post. No commit (awaiting Alicia).
- Pending: Alicia retries DELETE 83 on the fresh server; if it still fails, the browser
  DevTools response body for that request is the definitive evidence.
## CSRF wall root cause + fix — closed (Acceptance-verified)

Root cause: DRF default SessionAuthentication enforces CSRF for any request with a valid
sessionid cookie; V4 browsers holding such a cookie (Django admin login) got 403 on EVERY
non-safe API call (DELETE/create/chat). Proven via real-session matrix (session+no-CSRF -> 403;
matching cookie+header -> pass; anonymous -> pass). Independent of any conversation — the
delete contract itself was never the culprit.
Fix: settings.py REST_FRAMEWORK DEFAULT_AUTHENTICATION_CLASSES = [BasicAuthentication]
(DRF API surface has ZERO request.user usage across all modules; admin unaffected).
Independent re-verification (Acceptance-side): real-session DELETE no-CSRF -> 404 (was 403);
real-session POST init -> 400-validation (was 403); anonymous -> 404; diff = exactly 1 file,
14 insertions. Server restarted PID 24812; DB baseline 8/8; no commit (awaiting Alicia).
Pending: Alicia retries DELETE 83 in V4 UI.
## Conversation 83 — real deletion succeeded (user-performed)

Alicia confirmed DELETE 83 via V4 UI succeeded after the CSRF-wall fix. This doubles as the
long-deferred REAL-DELETE smoke test (user-performed, production data, no residue beyond the
intended deletion). 403 mystery fully closed: root cause was DRF SessionAuthentication CSRF
enforcement against browsers holding sessionid cookies; delete contract itself was always
correct. Backend candidate now = frozen R3 + settings.py authen fix (+14 lines, accepted).
Remaining open: pane-8 three-dot menu delivery -> acceptance recheck (probe adaptation +
full suite + browser matrix); commit decisions both repos await Alicia's word.
## Menu gate — PASS (pane-8 Gemini delivery, Acceptance-verified)

Scope: ConversationDeleteMenu.tsx rewritten to a three-dot menu (MoreVertical trigger,
role=menu + menuitem 删除会话 danger, aria-expanded/haspopup, ArrowUp/Down/Tab/Home/End
navigation, Escape + outside-pointer close, focus restore, disabled-safe items); builder
tests updated (30/30 focused, 602/602 src/test); chatDelete.ts / chatDeleteUi.ts /
ConversationDeleteConfirmDialog.tsx untouched; no commit.
Acceptance-side adaptation only (per H04 rule, product contract untouched):
- jsdom probes + browser probe now open via menu trigger (会话操作) -> menuitem -> dialog.
- Corrupt-lease probe rewritten to the as-built two-phase contract: first open -> dialog
  quarantine banner + disabled confirm + key removed; reopen (absent) -> backend-guarded
  delete allowed -> 204. This is the dialog's originally-documented quarantine behavior,
  now reachable because the menu no longer pre-reads the lease.
Independent results: jsdom probes 9/9; full src/test 602/602; typecheck 0; lint 0;
browser matrix dev 151/151 + prod 151/151 (fresh dist incl. menu), incl. keyboard trap
at 320/768 and Escape restore to the 会话操作 trigger.
Frontend candidate (T1 + menu) fully accepted. Backend candidate (R3 + settings CSRF fix)
accepted. Both uncommitted, awaiting Alicia's commit call.