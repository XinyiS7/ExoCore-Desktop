# Single Conversation Delete — T0 dependency disposition

Owner: Independent Acceptance (Solaire). This is dependency calibration, NOT a product FAIL
or re-review of P2B. Target remains Plan/V4_P2_Conversation_Delete_Target.md.

## Decision

T0 dependency hold. Authorize ONLY a short backend handoff note and Construction Evidence
corrections now; no frontend/backend production edits yet. No long replacement Plan required.
Write docs/superpowers/specs/2026-09-11-v4-conversation-delete-prerequisites.md, then deliver
the path and concrete owner questions to Acceptance. Backend implementation remains backend-owned.

## Corrections to the submitted facts

- 'No other FK/OneToOne' is false. Besides the three listed CASCADEs, current source includes
  scheduler.MessageActivity.session CASCADE; bridge.RuntimeBinding.conversation CASCADE;
  council.CouncilSession.phase0_conversation OneToOne CASCADE and
  CouncilParticipant.conversation OneToOne CASCADE. In particular, deleting phase0 can delete
  an entire CouncilSession. This endpoint excludes bridge rows, not all special ownership.
- SET_NULL includes Conversation.parent_conversation, MemoryPlasmid.conversation,
  CouncilSession.synthesis_conversation, and HeartbeatEvent.source_conversation.
  PrivateLog.conversation_id is a raw integer, not an FK. Distinguish reachability from schema
  effects; do not claim every relation is exposed by these three V4 lists.
- ReactSheet 1.2 lists DELETE without response detail: 204/no-body comes from DRF/source.
  Existing generic AppApiError handling does NOT automatically mark network errors ambiguous.
  Deletion must explicitly classify uncertain outcome; do not change all shared adapters for it.
- Home's canonical route is `/`; `/chat` is a compatibility redirect. ProjectHub has only
  Project cards. No ProjectHub production edit is currently justified.
- Query families in the packet are reasonable, but per-ID local draft and preferences were
  omitted. Inspect runtime/storage.ts and control/prefs.ts ownership. Never bulk-clear storage
  or erase a lease to unlock deletion. Do not invent a global RiskState framework.

## Backend handoff: bounded outcomes/questions

1. Define ordinary-conversation eligibility and protect special-owned conversations from
   unintended cascade (particularly Council). Do not redesign Council or Project lifecycle.
2. Resolve delete-versus-generation at the actual backend write/start boundary; a local lease
   or a status-then-delete check is not an atomic guard. Backend owner proposes the smallest
   feasible policy and documents which real execution paths/deployment modes it covers.
   Do not build a distributed runtime framework or silently claim unsupported guarantees.
3. Resolve the invalid prune invocation with the actual cleanup requirement. Distinguish
   relational cascade, surviving memory, and physical files. No --all/--force substitution,
   blanket memory/file sweep, or new expensive compaction operation.
4. Return endpoint response/error semantics and isolated test evidence for the agreed policy.
   Backend owner must approve its own scope before implementation; real-data destructive
   probes, provider calls, and AgentPreset row changes are not authorized by this handoff.

## Frontend calibration to retain for subsequent clearance

One API adapter + one mutation owner + one shared confirmation flow; their file placement is
an implementation choice, not a requirement to duplicate helpers across chatDelete/queries.
Three list entrances only, existing row style boundaries, construction tests/evidence.
Known active/pending/uncertain/quarantined/unavailable state blocks with an existing recovery
path. Missing lease is not positive server-idle evidence. Backend safety is still required.
Uncertain DELETE stays locked while read-back is pending/fails. Fresh absence can reconcile
as 'already absent', not 'this attempt succeeded'. Fresh presence must still pass all deletion
eligibility/busy checks; do not auto-resubmit or treat stale list data as read-back truth.
Confirmed deletion affects list counts, target caches/local state, and any already-existing
branch metadata whose ownership actually changed; no unrelated query/global clearing.
Prove stale in-flight collection/detail responses cannot revive the removed target.
Do not mount a new runtime on all list rows merely to obtain busy state.

Next action: deliver the brief backend prerequisite note and corrected evidence, not another
frontend design document. Acceptance will coordinate dependency clearance before T1 construction.
## Alicia follow-up — backend assignment and Council direction

Alicia explicitly authorizes backend pane 3 (Gemini) to own the bounded prerequisite work.
She also states an intention to retire Council. This is NOT authorization to delete Council
records, drop its models/FKs, or remove its UI in this task. No new Council features or
Council redesign belong here. Keep only the minimal existing-data/ownership protection needed
for safe ordinary-conversation deletion; full retirement requires a separate scope/data decision.
Backend reads the handoff and reports the smallest feasible policy + touched scope before edits,
then implements after this dependency checkpoint clears. Frontend stays at T0 hold.
The handoff's RuntimeBinding example is non-binding: verify it covers ordinary conversations;
bridge-only state is not proof of ordinary-chat liveness. Do not attach ordinary chat to a new
runtime framework merely to reuse that example.
## Backend T0 calibration — Alaric first proposal (not a verification verdict)

Current source/diff confirms this is a PROPOSAL: no delete-protection production edits yet.
No completed tests were claimed or supplied; proposed is_active/is_session_active do not yet exist.
No FAIL counter increment. Frontend remains on hold.

Accepted direction: ordinary eligibility guard + existing Council/Bridge data protection;
remove invalid prune subprocess, no physical-file purge/compaction; proposed 204/400 protected/
404 absent/409 busy contract. Keep GET/PATCH bridge exclusion unchanged; any destroy-only
lookup needed to distinguish protected from absent must not reopen other endpoint methods.
List phase0 exclusion is a small owning-list correction, not Council retirement.

Required dependency corrections before implementation clearance:
1. DELETE-only transaction/row lock does not serialize AgentChatView.post. Current POST reads
   Conversation, writes preferences, constructs a lazy generator, then registers/starts SSE or
   async work. Specify ONE shared admission/delete boundary and ordering: if delete wins, a
   competing start must recheck absence before preferences/history/provider work; if start wins,
   its reservation must become visible before releasing that boundary and DELETE rejects.
   No database transaction held for an entire provider stream. A minimal process-local boundary
   is a possible direction only for explicitly single-process operation; do not claim multi-worker
   safety or shared coverage for execution entrypoints that do not participate.
2. Busy must mean not yet quiescent, not merely present in current stop/poll bookkeeping.
   SSESessionRegistry.request_stop currently POPs the entry immediately, before the producer
   stops/persists. unregister(session_id) is not generation-identity-bound; overlapping starts
   can overwrite entries and older cleanup can erase a newer run. Async mark_done/error/stopped
   on receiving an event is not necessarily generator exhaustion/finalizer completion.
   Stop-requested remains busy through actual completion. Identity-bound cleanup must not release
   another run's reservation. Failed setup/disconnect/exhaustion need explicit release paths;
   do not strand idle sessions locked forever or release an active writer early.
3. Cover real paths, not mocked is_busy=True alone. Proposed tests must distinguish:
   delete-wins vs start-wins interleavings (SSE and async), stop before final persistence,
   old completion vs newer/sibling run, setup failure, normal completion/error/disconnect.
   Use synchronization barriers/events and isolated test DB/fake producer, zero paid providers;
   no sleep-only race tests. Identify background/prime push/bridge execution that can write the
   same eligible Conversation and either include its admission boundary or disclose the gap.

Return a short ordering/lifetime matrix + amended file scope and real entrypoint coverage.
No new general runtime framework, new Council work, long replacement Plan, or production edits
until this checkpoint clears. These outcomes implement the already-frozen conflict requirement.
Helpers should follow existing backend service/view separation where practical; file layout is
not the gate. Additional minimal files may be proposed now, not silently added during repair.
## Backend T0 clearance — revised shared-boundary proposal

Decision: BACKEND CONSTRUCTION AUTHORIZED within the bounded scope below. No further general
Plan-review loop is required. This is not implementation PASS; frontend T1 remains held until
backend tests and independent acceptance establish the response/safety contract.
Deployment assumption verified: hybrid_start.ps1 runs one threaded Django runserver process.
Process-local admission is accepted for that deployment ONLY; no multi-worker guarantee.

Preserve the revised delete-wins/start-wins ordering, no transaction across provider streaming,
reservation visible before any generation-side preferences/history/provider work, and rejection
of protected owners. Treat lifecycle names as conceptual, not a mandate for six persisted states.
A mutex + identity-owned active reservations can suffice; no schema/migration/state-machine framework
or permanently growing deleted-ID tombstones. Failed DELETE must not strand DELETING state.

Final source-grounded implementation conditions (inside this authorization):
- Do not silently change concurrent-send semantics to a single slot or overwrite an active run.
  Account for every admitted live run, release only its matching run_id, and keep busy while ANY
  such run can write. If rejecting parallel sends is necessary, discuss that behavior change first.
- Generator finally alone does NOT cover a StreamingHttpResponse closed before first iteration:
  Python never enters the generator's finally then. Provide idempotent response-lifetime cleanup
  for that real path, and close/unwind the underlying producer before releasing its reservation.
  Test unstarted close, begun disconnect/error, normal completion, stop-before-final-persistence,
  setup/thread-start failure, and older-run cleanup against a newer active run.
- PushService: select/recheck the prime target within the admission/write protocol, including
  a target selected just before DELETE wins. Do not leave a dead conversation URL or return a
  fictitious successful injection. Keep existing notification fallback; no prime redesign.
- An additional ordinary writer was verified: background_sessions/services.py
  _handle_session_memory selects the latest per-preset Conversation and writes a Message.
  Narrow admission + fresh-target/retry-or-explicit-failure handling is authorized there too.
  Do not change other background modes or falsely report successful injection after target loss.
- Existing branch/truncate seams in memory/services.py must not use a deleted parent instance
  after DELETE wins. Narrow shared-boundary/re-read/error handling at those seams is authorized;
  preserve branch/truncate semantics. No broad memory-service or runtime-route-gate rewrite.
- Subscription-runtime finalization may write ordinary bound conversations: preserve and test
  existing durable busy/recovery checks and row-lock finalization ordering; a stopped bridge
  request is not evidence that its ordinary binding is quiescent. If current seams require
  editing bridge internals, present that concrete dependency BEFORE widening scope.
- Chat-triggered post-done compaction has existing fresh select_for_update/CAS/update_fields
  commit seams. Preserve them and verify delete-wins causes no row resurrection; do NOT absorb
  compactor/embedding maintenance or dormant-thread cleanup into this task.

Authorized production footprint: proposed agents/execution_coordinator.py, agents/streaming_buffer.py,
agents/views.py, push/services.py; plus narrow _handle_session_memory seam in
background_sessions/services.py and branch/truncate seams in memory/services.py as above.
Tests may be added/adjusted in owning apps' tests packages; one concise backend Plan/evidence file
per local AGENTS rules, created/tracked before edits. Backend ReactSheet may document ONLY the
settled DELETE response/error contract. Frontend docs/target/acceptance assets stay read-only.
Existing unrelated dirty files must be preserved; do not clean or stage them.

Verification: isolated test DB, fake producers (no paid APIs), barrier-based both-way races for
SSE/async + prime/session-memory writes, protected-owner/absence/rollback tests, branch/truncate
preservation and response-close lifetime cases; applicable existing stream/runtime/push/memory
regression, manage.py check, migration drift check, diff checks, opening/closing real DB baseline.
Tests claim exactly what they assert; no coverage from counters or busy=True mocks alone.
At completed candidate STOP and SEND actual changed files/symbols, commands/results, unexecuted
scenarios, deployment limitations and settled HTTP contract to Acceptance pane 5. No self-PASS,
commit, server restart, real destructive probe, provider call, or Council retirement.