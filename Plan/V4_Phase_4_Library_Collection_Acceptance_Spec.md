# Acceptance Spec: V4 Library / Collection UI

**Source plan:** `Plan/V4_Phase_4_Library_Collection_Detailed_Plan.md` R6 (`16fd337`, blob `78686b3617ee74be0fa4e5c4cb381337426eff6d`)
**CP0 specification baseline:** `c3104c3`
**Issue:** XinyiS7/ExoCore#61
**Acceptance owner:** Solaire / `gpt-5.6-sol`
**Frozen on:** 2026-10-15
**Status:** FROZEN — Construction must not modify
**Amendment A1 (2026-10-15, Acceptance-owned):** records the frozen CP-B2 Plan/spec references only; no UI gate changed.

---

## 1. Authority and ownership

- This document is the independent Desktop acceptance contract.
- Construction must not edit this file or acceptance-owned probes after freeze.
- CP-B1 and CP-B2 backend behavior have separate acceptance specs; this contract verifies Desktop consumption and final integrated behavior.
- Exact styling is judged only against the Alicia-approved CP0 mockup recorded at freeze. No unwritten visual preference is a gate.

## 2. Scope

### Covered

- `/library` navigation, wall, filters, cursor traversal, responsive presentation, and route-backed item detail.
- Item original/representation display, metadata editing, permanent deletion, statistics/comments, and explicit view recording.
- Selecting Collection items, routing them to a G045 conversation, composing/sending card-only or text-plus-card turns, recovery, and user-message rendering.
- Shared Agent/human Collection card projection and preservation of existing Chat behavior.

### Excluded

- Archive/trash, tag administration, semantic search, random browsing, manual item creation, comment writing, Chronicle promotion, Step 5 producers, Memory management, and final bespoke Collection-card art direction.
- CP-B2's internal persistence, lock order, or Runtime implementation shape except through observable HTTP/message behavior.

## 3. Non-negotiable invariants

1. Library is a first-level Collection-only destination; it neither exposes nor implies a Memory sub-area.
2. List exposure, filtering, pagination, thumbnails, and swipe navigation never count as a view.
3. One route-backed detail opening records at most one human view for that location entry; rerender/refetch/edit does not recount.
4. Metadata edits and permanent deletion are explicit, server-confirmed, and never presented optimistically as successful.
5. Bringing items to Chat does not alter the text draft, does not turn presentation media into model input, and does not write Collection text into `Message.content`.
6. Agent and human bring-back cards normalize to one domain card and one component; descriptor/card semantics cannot drift by speaker.
7. A failed send preserves the draft, file attachments, and all Collection cards; item-specific failures identify and mark only the affected card.
8. A card-only message is sendable in both Direct and AGY conversations; edit/regenerate never carries Collection cards.
9. Already-sent cards/media remain readable after the Collection item is edited or deleted.

## 4. Required freeze artifacts

Frozen references:

```text
Issue: XinyiS7/ExoCore#61
Plan baseline: 16fd337 (blob 78686b3617ee74be0fa4e5c4cb381337426eff6d)
CP0 specification baseline: c3104c3
Approved mockup evidence: Plan/evidence/p4-library-cp0-mockup
Evidence commit: 107ece1f6d9929f09283064689135fae88c59dc3
Evidence subtree: 56f6f7ad5122119f49cd34a6b34b5aae9ca8c5fb
Canvas version: 1792093963-f8cb; Alicia approved all nine boards on 2026-10-15
Backend CP-B1 contract: ../ExoCore/Plan/Collection_Library_CP_B1_Acceptance_Spec.md
  frozen commits 6773ce2e + Amendment A1 dab2e34a; blob 5e5b9cb07b7ae3a1403b1b81305f3692e8a065b0
Backend CP-B2 Plan: ../ExoCore/Plan/Collection_Human_Bring_Back_Plan.md
  commit da7ce119; blob 96a15c145eb768e649a7807123da6af40599521b
Backend CP-B2 acceptance: ../ExoCore/Plan/Collection_Human_Bring_Back_CP_B2_Acceptance_Spec.md
  commit 9b4103b4; blob ccf6db21f41d425d2d1533ffee210cdae9c4c4f4
```

CP1–CP5 may proceed against this frozen contract. CP5 integration and acceptance remain blocked until the CP-B2 backend implementation is available; final Desktop acceptance remains blocked until CP-B2 final PASS.

## 5. Gate matrix

| Gate | Requirement | Evidence type |
|---|---|---|
| UI-A | navigation, routing, responsive wall | component + approved mockup comparison |
| UI-B | filtering and mounted cursor traversal | component/API integration |
| UI-C | detail, representations, edit/delete | component/API integration |
| UI-D | view/stat/comment behavior | component + backend integration |
| UI-E | compose, send, failure recovery | runtime/component integration |
| UI-F | unified message cards and media | projection/component integration |
| UI-G | accessibility and regressions | automated + manual keyboard sweep |
| UI-H | Direct and AGY real-entry behavior | controlled real-environment probe |

## 6. Acceptance cases

### UI-A1. Navigation and routes

- Library is enabled and active for `/library` and `/library/items/:id`.
- A direct detail URL refresh resolves the same item state; closing returns to the wall without losing its loaded traversal/scroll position.
- No Memory child or placeholder is present.

### UI-A2. Responsive wall

The same implementation presents a wide-screen grid and narrow-screen one-card scroll-snap flow. Four item kinds render without invented metadata. Empty collection, empty filter result, first-load error, continuation error, loading, and end states are distinguishable.

### UI-B1. Filters and traversal

- `kind`, `tag`, debounced `q`, `recent`, `month`, and `link` map exactly to HTTP parameters.
- Filter changes start a new mounted traversal and never reuse an old cursor.
- Continuation failure retains already loaded cards and offers retry.
- `malformed_cursor` restarts from page one and visibly reports that the list refreshed.
- Stable traversal contains no duplicated item ID.

### UI-C1. Detail and representations

All four kinds expose only contracted content. Preview/playback/extracted-text states distinguish pending, succeeded, failed, retryable, and unavailable. A failed preview does not hide an available original. Source conversation navigation uses `source.snapshot.message.conversation_id` only when the source is available.

### UI-C2. Editing

Successful PATCH updates detail and the corresponding wall card; tag changes refresh the tag list. Invalid input preserves the form and reports failure. Manual representation is available only for document extracted text and cannot submit blank content.

### UI-C3. Permanent deletion

The confirmation states permanence and affected item-owned data, defaults focus to cancel, and cannot double-submit. 204 and already-missing 404 both remove the item from the current UI; sent historical cards/media remain intact.

### UI-D1. View counting

For one route location entry, successful first detail render sends exactly one view request. StrictMode remount, query refetch, PATCH refresh, and playback inside the opened detail do not send another. A new later opening records one new view. A failed view request does not block content and visibly reports that this view was not recorded. The returned count is merged immediately into the human statistics row.

### UI-D2. Read-only social detail

Viewer rows display the backend-provided identity/counts without relabeling. Comments are chronological, read-only, and have no reply/edit/delete/like affordance.

### UI-E1. Selection and target routing

- Single and multi-select preserve first-selected order, deduplicate, and cap at five.
- Target selection lists only G045 conversations, defaults to Prime when present, and has a disabled-confirm empty state when none exist.
- Router state is consumed once; refresh/back does not add cards again.
- Leaving the conversation clears pending Collection cards under the same compose lifecycle as existing attachments.

### UI-E2. Compose invariants

Adding/removing/rejecting a Collection card never changes the text draft or existing file attachments. Card-only send is enabled. Edit/regenerate disables and excludes cards. `collection_items` is sent in UI order.

### UI-E3. Failure and recovery

For item-specific not-found/original-unavailable/empty-text errors, the stable error body identifies the failing `item_id`; only that card becomes rejected. Whole-request type/count/edit errors do not falsely blame one card. Ordinary failure and accepted-but-unpersisted recovery both restore text, files, and ordered Collection IDs without duplication.

### UI-F1. Unified cards

Assistant `assistant_artifacts[]` Collection producers and user `collection_shows[]` normalize to one `CollectionShowCard` and render through one component. Both show the shared title/reason projection; both text cards show the complete snapshotted `text` separately from `description`. Media renders once through existing message attachments. No brought-back card exposes a collect action.

### UI-F2. Deleted source resilience

After an item is deleted, its historical card text/reason and copied media remain visible. Opening its Library link reports that the source item no longer exists without damaging the historical message.

### UI-G1. Keyboard and semantics

Keyboard-only operation can reach filters, cards, narrow previous/next controls, detail close, edit, deletion confirmation, selection, and bring target confirmation. Dialog focus is trapped and restored; status is not conveyed by color alone; controls have accessible names; dynamic status uses a suitable live region.

### UI-H1. Real Direct and AGY entry paths

With dedicated test items only, verify in one Direct and one AGY G045 conversation:

- one card, multiple cards, card-only, and text card sends;
- the model receives the shared descriptor block but not copied original bytes;
- the sent user message renders the cards/media once;
- a later turn projects each historical user card block exactly once;
- the model can call `inspect_original` when it chooses.

No paid/bulk call is permitted; use the minimum turns needed and obtain Alicia's approval before any paid provider call.

## 7. Regression and safety gates

```bash
pnpm --filter exo-app test:run
pnpm --filter exo-app lint
pnpm --filter exo-app build
```

Also run the focused backend CP-B1/CP-B2 suites and migration-state gate before final integrated PASS. Reuse existing tests first; add independent probes only for uncovered MUST gates. No skip/xfail.

## 8. PASS condition

PASS only when every MUST gate clears, the approved mockup comparison has no unresolved required mismatch, relevant Chat/attachment/artifact regressions pass, and the frozen spec remains unchanged.

If CP-B2's additive `memory.UserCollectionShow` migration is pending on the real database, verdict must be `PASS / DEPLOY-PENDING` with an exact target-table CreateModel `DEPLOY_STEP`; otherwise record `DEPLOY_STEP: none`.
