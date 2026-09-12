# B1 — Collection Storage / Attachment Provenance Backend Handoff Brief

> **Handoff type:** backend requirement brief (not implementation)
> **ID:** B1 — Attachment provenance + Collection managed storage / target identity
> **Frontend consumer phase:** P4 (Library Shell + Collection); earliest start: after C0
> **Backend owner:** `ExoCore` (Django)
> **Hard gate:** B1 PASS is required before the P4 Detailed Plan may freeze; P0 does not implement anything.
> **Status:** Drafted in P0; advisory for backend planning, non-expanding without Alicia's approval.
> **Date:** 2026-09-02 · **Sources:** `Plan/V4_Phase_0_Baseline/Canonical_API_Snapshot.json` (SN), `V3_Baseline.md` (VB), frozen specs (Freeze Index §6, River/Collection spec §4–6), Master Roadmap §10.

---

## 1. Status, ownership, and hard-gate statement

1. **Status:** Requirement brief only. No B1 code exists in either repository.
2. **Backend owner:** `ExoCore`. **Frontend consumer:** V4 P4 (Library shell + Collection browser). **Earliest start:** after C0 (can run in parallel with frontend phases P1–P3).
3. **Hard gate:** P4 Detailed Plan freeze requires the B1 contract to be implemented, independently accepted in `ExoCore`, and synchronized into both `ReactSheet.md` files. Backend completion alone never transfers frontend capability ownership.

## 2. Current source facts and evidence paths

- Attachment upload/read/delete contract: SN `attachment.upload` / `attachment.list` / `attachment.content` / `attachment.delete`; sources `agents/views.py` L886–1377, `engines/attachment_manager.py` L33–183, `memory/models.py` SessionAttachment (L478–518), `memory/serializers.py`.
- Upload envelope: ordered `results` with `ok | ok_degraded | failed`, partial success 201, all-failed 422, diagnostics allowlist `{stage, code, level, message, input_variant}`; `detail`, `storage_path`, `platform_files`, `part`, `platform_entry` never leave the server on upload (`views.py` formatters).
- Audio: multipart key `files`; form fields `model` + `endpoint`; MIME allowlist `audio/webm;codecs=opus | audio/webm`; 10 MiB bound; direct-only `resolve_session_target`; stable codes `audio_target_required / audio_model_unsupported / audio_mime_unsupported / audio_too_large`.
- Read path: `MessageSerializer.attachments_meta` items carry `content_url` (audio only) pointing to the same-conversation content endpoint; playback uses `content_url`, never `file_uri`.
- Known limitation (provenance-relevant): images may be rotated/scaled/compressed/format-normalized before storage (no guaranteed original bytes); the GET attachment list exposes `storage_path` for non-audio rows (KF-10); `SessionAttachment` cannot serve as a reliable long-term original contract (spec River#2.4, R5); delete detaches association without reference-safe GC; broadcast/bookmark paths produce highlights (ChronicleEntry kind=highlight, scope `里`) as Collection promotion candidates (SN `memory.plasmid.create`).

## 3. Problem statement and frozen product semantics

- **Frozen:** Collection = emotional collection ("想留下来"), Memory = recall substrate; different CRUD and models (Freeze Index §6.1).
- **Frozen:** `CollectionItem` = one act of collecting (occurrence, context, description, Tags, source, time); `StoredAsset` = original-byte identity, stable hash, physical lifecycle. Text items do not require an asset. Exact same bytes may reuse one StoredAsset, but collection occurrences are never deduplicated (River spec §4.4; acceptance "第十六次"）。
- **Frozen:** originals must survive deletion of the source Conversation/SessionAttachment.
- **Frozen:** typed derived material, never one undifferentiated `description` field: image = neutral description (+ future subjective impression field type reserved, P2); audio = single human-calibratable canonical transcript (no subjective listening notes persisted as STT); document = extracted text/canonical summary. Image preview processing must never overwrite the managed original.
- **Frozen:** V4 Collection first release establishes its own search-target identity and authorization by **Agent type `g045`**, never a mutable DB preset id; first release does NOT wire current `memory_search`.
- **Frozen:** no automatic global legacy-attachment import; unverified legacy `.webm` is never promoted to a Collection original (R9); historical content is added later by explicit user action.

## 4. In-scope interface requirements

1. **Reliable source identity for newly uploaded attachments** — new attachments (user upload + audio recording) obtain a provenance-usable identity/occurrence that survives later collection.
2. **Managed original root** — dedicated storage area (path/layout is backend implementation), atomic copy + verification, stable cryptographic hash.
3. **CollectionItem / StoredAsset reference relationship** — occurrence identity separate from exact-byte identity; shared-asset reuse without occurrence dedup; reference-safe deletion (deleting an Item must not delete still-referenced Assets); asynchronous GC only for unreferenced assets.
4. **Typed preview/semantic material** with explicit states: `pending / succeeded / failed / unavailable`; transcript/description/embedding rebuildable and version-tagged (embedding model identity distinguishable; delete-and-rebuild support).
5. **Authorization & read contract** — authorized original/preview access without leaking PC storage paths; authorization keyed on agent type `g045`, not preset database id; image preview never overwrites original; canonical audio transcript distinguishable from subjective commentary.
6. **Collection read interfaces for P4 UI** — four-type browse (text/image/audio/document), Tags, search (exact/stable identity surface; semantic retrieval shape TBD at B1 backend plan), recent collections, source traceability, "带去聊天" round-trip capability metadata.

## 5. Data / lifecycle invariants

- Deleting a source Conversation or its SessionAttachment must not delete accepted Collection originals.
- Deleting a CollectionItem never deletes a StoredAsset that another Item or retention policy references.
- A file's exact bytes map to one StoredAsset; each collection event keeps its own occurrence/context.
- Originals are byte-stable after atomic copy; hash verification happens at copy and on demand.
- Embeddings/derived material are rebuildable; original and canonical semantic text do not depend on one embedding model version (River spec §4.7).
- Async GC is reference-safe; no production GC run may race an in-flight collection write (locking/ordering is backend design, but the invariant is externally observable).

## 6. Authorization and privacy boundary

- Agent-type `g045` is the long-term authorization object — never a DB preset id that can change.
- Original/preview access paths must not expose server filesystem paths (contrast with today's KF-10 where GET list exposes `storage_path` for non-audio rows).
- Diagnostics/read contracts keep the V3 stripping rules: `detail`, `storage_path`, `platform_files`, `part`, `platform_entry` never reach the client on upload paths.
- Unauthorized access must be indistinguishable from not-found where the object is sensitive (follow today's unified-404 content-endpoint precedent).

## 7. Stable errors and async derivation states

- Derivation lifecycle states: `pending → succeeded | failed` (+ `unavailable` when the source material is missing); failed derivations visible, retryable, never silently presented as ready.
- Upload/collection write errors: keep the ordered per-input envelope precedent (201 partial / 422 all-failed) where multi-input; stable codes for each stage (provenance check, hash/atomic copy, derivation scheduling).
- Reference/GC errors: deleting a referenced asset is refused with a stable code (reference-safe semantics), not partially executed.
- Authorization errors: stable `403`-family codes (or unified 404 policy per sensitivity).

## 8. V3 compatibility and migration/non-migration boundary

- **Compatibility rule (Roadmap §15):** current V3 attachment/audio behavior continues to work unchanged; the new managed storage, provenance identity, and authorization structure are **additive**.
- **Non-migration boundary:** no automatic import of legacy `uploads/attachments/`; no promotion of unverified `.webm`; legacy SessionAttachment stays as-is for V3 paths; V4 Collection ingests only new, provenance-reliable content plus explicit user promotion candidates.
- Chronicle highlight rows (kind=highlight) remain the candidate feed; converting a candidate creates a Collection item with auditable origin; no destructive Chronicle migration.

## 9. Backend acceptance targets (binary, externally observable)

B1 is accepted only when an independent backend acceptance run demonstrates all of the following at interface/invariant level (no React code):

1. **Duplicate occurrences:** uploading the same bytes twice and collecting both yields two distinct CollectionItem occurrences sharing one StoredAsset; both contexts/descriptions survive.
2. **Shared assets:** deleting one Item leaves the second Item readable and the Asset present.
3. **Failed derivation:** a derivation that fails leaves an explicit `failed` state with stable error and retryability; it is never presented as ready.
4. **Source deletion:** deleting the source Conversation (and its SessionAttachment) leaves accepted Collection originals readable through the Collection read contract.
5. **Unauthorized access:** a request without `g045` agent-type authorization cannot read original/preview bytes (stable error or unified not-found), and never receives filesystem paths.
6. **GC safety:** after deleting the last referencing Item, the Asset becomes eligible for async GC; a concurrent re-collection of the same bytes during GC does not corrupt either occurrence; no in-flight write is broken.
7. **Regression:** the full V3 attachment/audio focused test set (VB §8: `SessionAttachmentUploadContractTests`, `test_audio_attachments`, `acceptance.test_audio_attachment_contract`) still passes unchanged.

## 10. Non-goals and handoff completion checklist

### Non-goals (explicitly excluded from B1)

- Wiring Collection into current `memory_search`; embedding model upgrades; multimodal same-space indexing.
- Subjective image commentary generation (field type may be reserved; generation is P2 per spec River#11).
- Global legacy attachment import/inbox; `.webm` promotion; destructive Chronicle cleanup.
- Frontend UI, Collection browser components, or any React work.
- Deciding backend table/class design (implementation choice of the backend plan).

### Handoff completion checklist (what "B1 done" means for P4)

- [ ] Accepted backend Plan in `ExoCore/Plan/` with independent acceptance spec
- [ ] Implementation + tests in `ExoCore`; migrations additive & V3-compatible
- [ ] `ExoCore/ReactSheet.md` and `ExoCore-Desktop/ReactSheet.md` synchronized with the accepted contract
- [ ] The 7 acceptance targets above PASS in the backend repo
- [ ] This brief's interface requirements are re-verified against then-current source before the P4 Detailed Plan freezes (source drift rule)

---

*Advisory note: reviewer/backend suggestions may refine implementation but cannot expand product scope without Alicia's approval.*
