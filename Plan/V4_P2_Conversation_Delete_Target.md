# V4 P2 supplement — Single Conversation Delete Target

Status: Alicia-authorized capability; acceptance-owned bounded target, not a reopening of P2B.
Placement: remaining P2 / before unified C2. No new phase numbering is assigned here.
Construction: Ecki (frontend). Independent acceptance: Solaire. Backend remains separately owned.

## Outcome and limits

Restore deliberate deletion of one ordinary Conversation from V4 Home Recent, Agent Profile,
and Project Detail lists. These entrances share one deletion flow and canonical cache owner.
Keep ordinary row navigation and existing filters intact. List actions must be reachable by
mouse, keyboard, and touch, including narrow/short windows and long names; no hover-only action.

This is DELETE of the conversation, not Project deletion or moving it to an archive.
Do not include rename, manual archive, batch deletion, recycle bin, undo, a new runtime
framework, V3 cleanup, or additional chat-header actions. Existing P2A/P2B acceptance stands.

## T0 — short dependency check (one checkpoint before production edits)

Read current source, not only the old audit: backend ConversationDetailView.perform_destroy,
its related-row deletion effects, runtime/storage ownership, and ReactSheet §1.2.
Return a short factual note: proposed frontend files, confirmed HTTP/error semantics,
relevant deletion side effects, busy/uncertain policy, and any backend prerequisite.
No long Plan and no round of general Plan review. Acceptance calibrates only these dependencies.

Known findings to verify/classify, not blindly copy as fixes:
- The old audit records compact_conversations --prune --yes after instance.delete().
  Do not replace it with --all/--force: that is not equivalent cleanup and could run unrelated work.
- Current local runtime leases can identify known pending/active/uncertain operations.
  Lease absence is NOT proof of backend idle, especially across tabs, ports, or clients.
- The current DELETE endpoint has no verified generation/delete conflict guard.
  Do not claim universal concurrency safety from a UI disable or preflight status request.
- Confirm cascading/SET_NULL effects (messages, branches, attachments, other references)
  before choosing confirmation copy. Do not promise all files/memories are erased.

If a backend fix is required, write a small handoff in docs/superpowers/specs/ and report
it at T0; never edit ../ExoCore or route around safety constraints. No real destructive probes.
Acceptance will resolve the prerequisite with its owner before authorizing a release candidate.

## Required behavior after T0 clearance

1. Confirmation captures immutable conversation ID + readable name. Cancel sends no DELETE.
   Make irreversible deletion clear and distinguish it from project-level archival.
2. Known busy/uncertain/unreadable runtime state must not be treated as safely idle.
   Explain the block and use the existing recovery/open path; never clear a lease to enable delete.
3. Pending confirmation permits at most one DELETE; no automatic mutation retry.
   HTTP failure remains visible. An uncertain network outcome requires a read-back before
   offering another destructive attempt; 404 is absence, not evidence that this attempt succeeded.
4. On confirmed success/confirmed absence, update the one conversation collection and its
   derived counts/lenses. Retire the target's already-existing detail/message/control caches
   and local state using their owners, without clearing other conversations or all storage.
   Inspect in-flight GET completion so a deleted row is not restored by stale data.
5. Late settlement remains bound to the submitted ID. Navigating A -> B must not close B's
   dialog, display A's error on B, or redirect B. Do not leave the current route displaying
   a successfully deleted conversation; use an existing safe landing route when applicable.
6. Dialog focus enters, stays contained (including pending), closes safely with Escape,
   and restores to a surviving trigger or sensible fallback when the deleted row disappears.

## Verification and delivery

Construction evidence: Plan/V4_P2_Conversation_Delete_Construction_Evidence.md (one file).
Acceptance owns its separate tests/report; do not modify this target or acceptance assets.
Cover all three list entrances, cancel/success/failure/uncertain outcome, repeated click,
route change + late completion, busy/recovery states, stale reads, list/count consistency,
and real-browser keyboard/touch reachability in wide-short and narrow windows.
Use isolated mocked HTTP for frontend deletion tests; no paid providers or real data deletion.
Final regression: full exo-app tests, lint, typecheck, build, git diff --check (staged + unstaged),
plus relevant creation/runtime/P2A/P2B preservation checks. Baseline preset IDs remain 1–8.

T1: stop at completed candidate and actively send the evidence to Acceptance; local output
alone is not delivery. No self-PASS, commit, cutover, or scope expansion without the corresponding
release. A bounded prerequisite hold is not a requirement for another large design document.