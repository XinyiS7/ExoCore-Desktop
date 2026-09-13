# B6 ReactSheet §8 contract sync

**Goal:** Copy the finalized B6 assistant-message-arrival backend contract into the Desktop API reference before P2D planning.

**Intended behavior:** Desktop `ReactSheet.md` §8 is byte-identical to backend `ReactSheet.md` from the `## 第八篇` heading through the separator immediately before `## 第九篇`. It replaces the obsolete `/api/push/notifications/` stub with the delivered subscription, reconciliation, canonical event, Web Push delivery, and Register ACK contract.

**Scope:** Documentation only: this memo and Desktop `ReactSheet.md` §8. Preserve §9 onward, including the existing independent §10 status hunk, and all other shared-worktree changes. No frontend/backend production code, schema, URL, or behavior changes.

**Validation:** Extract and compare both §8 blocks byte-for-byte; assert exactly one §8/§9 heading boundary; inspect the focused diff; run `git diff --check -- ReactSheet.md Plan/spec/2026-09-13-b6-section-8-contract-sync.md`.