# V4 Conversation Delete — Backend Prerequisites Handoff

Status: backend-owned prerequisite note (T0 disposition, 2026-09-11). Frontend
construction (Ecki) is NOT started. P2B stays closed. This note does NOT
authorize real-data destructive probes, provider calls, or AgentPreset row
changes.

Owner: backend agent (separately owned). Accepted by Independent Acceptance in
`Plan/V4_P2_Conversation_Delete_T0_Disposition.md`.

## Context

Frontend must restore deliberate deletion of ONE ordinary `Conversation` from
V4 Home (`/`), Agent Profile, and Project Detail lists (shared flow, canonical
cache owner). The current REST surface is
`DELETE /api/agents/conversations/<pk>/`
(`agents.views.ConversationDetailView`, a DRF RetrieveUpdateDestroyAPIView;
queryset excludes `is_bridge=True`; DRF default 204 on destroy, no body).

## Verified deletion graph (current source, read-only)

CASCADE on deletion of a `memory.Conversation`:

| Model | Field | Effect |
|---|---|---|
| memory.Message (line 159) | conversation FK | CASCADE |
| memory.HistoryChunk (line 285) | conversation FK | CASCADE |
| memory.SessionAttachment (line 495) | conversation FK | CASCADE |
| scheduler.MessageActivity | session (conv id) | CASCADE |
| bridge.RuntimeBinding | conversation FK | CASCADE |
| council.CouncilSession | phase0_conversation | **OneToOne CASCADE — deleting phase0 deletes the ENTIRE CouncilSession** |
| council.CouncilParticipant | conversation | **OneToOne CASCADE — deletes the participant row** |

SET_NULL (rows survive, FK blanks):

| Model | Field |
|---|---|
| memory.Conversation.parent_conversation | self FK, SET_NULL (branch metadata survives) |
| memory.MemoryPlasmid.conversation | SET_NULL (plasmid survives) |
| council.CouncilSession.synthesis_conversation | SET_NULL |
| heartbeat.HeartbeatEvent.source_conversation | SET_NULL (event survives) |

Raw integer (no FK constraint, orphaned by design):
- `agents.PrivateLog.conversation_id = models.IntegerField(null=True, blank=True)` — reachability vs schema effects must be distinguished.

Not verified: vector-store/embedding cleanup (memory embed pipelines,
KnowledgeFragment rows) and physical attachment files. Confirmation copy must
not promise "all memories/files erased".

## Questions for the backend owner

1. **Ordinary-conversation eligibility.** Define which conversations may be
   deleted from these three V4 lists without unintended cascade (especially
   Council phase0, which removes an entire CouncilSession). Protect
   special-owned conversations (reject or block) WITHOUT redesigning Council
   or project lifecycle. The endpoint excludes bridge rows only — that is not
   sufficient ownership protection.

2. **Delete-versus-generation conflict.** There is no generation/delete guard
   on the endpoint (DRF default destroy; `perform_update` handles only prime
   switching). Propose the smallest feasible policy at the actual backend
   write/start boundary (e.g. reject while a RuntimeBinding is starting/active/
   indeterminate/recovery_required, or a generation is in flight). Document
   which real execution paths/deployment modes it covers. A frontend lease or
   status-then-delete check is NOT an atomic guard; local lease absence is not
   proof of backend idle. Do not build a distributed runtime framework or
   claim unsupported guarantees.

3. **Invalid prune invocation.** `ConversationDetailView.perform_destroy`
   spawns `compact_conversations --prune --yes` via subprocess, but the
   current `compact_conversations.py` command accepts only session ids /
   `--all` / `--force` — `--prune` does not exist. Resolve against the actual
   cleanup requirement and distinguish: (a) relational cascade (handled by
   Django), (b) surviving memory rows (plasmids now SET_NULL; embeddings?),
   (c) physical attachment files. Do NOT substitute `--all`/`--force`, do NOT
   blanket-sweep memory/files, do NOT add an expensive compaction operation.

4. **Response/error semantics + isolated test evidence.** Return the agreed
   policy's response/error contract (which statuses/codes for protected rows,
   busy rows, absent rows) and isolated test evidence for the agreed policy —
   without touching the real DB AgentPreset rows or making provider calls.

## Frontend expectations after clearance (not started)

- One adapter + one mutation owner + one shared confirmation flow (file
  placement is implementation choice).
- 204 → success; 404 → "already absent" (reconciles as absent, not "this
  attempt succeeded"); network/5xx → explicit `ambiguousWrite` classification
  (existing generic AppApiError does NOT auto-flag network as ambiguous).
- Busy/uncertain/quarantined/unavailable state blocks delete with an existing
  recovery path; never bulk-clear storage or erase a lease to unlock delete.
- Confirm capture: immutable `{id, name}`; at most one DELETE per pending
  confirmation; no auto retry; read-back required before re-arming after an
  uncertain outcome.
- On confirmed success/absence: retire ONLY the target's query families
  (`conversation(id)`, `messages(id)`, control cache(id)) and canonical list
  refresh; per-ID local draft/prefs ownership inspected (runtime/storage.ts,
  control/prefs.ts); no unrelated query/global clearing; stale in-flight GETs
  must not revive the row.
- Three list entrances only (Home `/`, Agent Profile, Project Detail); no
  ProjectHub rows; no rename/archive/batch/recycle-bin/undo; no new runtime
  framework on list rows; no global RiskState.