# V4 image preview — Acceptance Report

## Ledger

```text
Cycle: R1 | Checkpoint: v4-image-preview | Baseline: de9c261 + dirty diff 433243c3 | Verdict: FAIL
Owners: Construction 1, Acceptance 0, Harness 0, Spec 0, Environment 0
Findings: F-01 | Consecutive FAIL Count: 1
```

## R1 verdict: FAIL

### F-01 / P1 / new — canonical load failure bypasses the valid legacy fallback

- **Observed evidence:** `AttachmentImage.tsx` chooses canonical `contentUrl` once. Its `onError` sets `loadFailed`, after which rendering goes directly to the failure card. When both a valid canonical URL and valid legacy `fileUri` exist, a canonical 404/network failure never attempts `fileUri`.
- **Violated invariant:** Memo F1 defines canonical URL → validated legacy fallback → failure card. A usable existing source must not be discarded merely because the preferred source fails at image-load time.
- **Root cause:** confirmed; source selection is static and load failure is a terminal boolean rather than an ordered source transition.
- **Affected sibling paths:** timeline thumbnail and lightbox share the selected source; future SessionAttachment image content URLs may be projected despite an unreadable/missing local file while a provider URI remains valid.
- **Required outcome:** with both sources valid, canonical is attempted first; if it fails to load, rendering retries exactly once with legacy `fileUri`; only failure/no availability of both sources shows the existing failure card. Invalid canonical values remain rejected before DOM use. A new attachment/source change must not retain stale failure state.
- **Suggested direction:** model the two validated candidates explicitly and advance a bounded source index/state on `onError`; do not loop or repeatedly retry the same URL.
- **Chained effects:** update thumbnail/lightbox source consistently and preserve ready filtering, same-origin canonical validation, existing legacy validation and failure-card behavior.
- **Verification targets:** decisive test with both URLs asserts canonical first, dispatches image error, then asserts legacy source; a second error reaches the card; existing foreign/protocol-relative and no-source cases remain green.
- **Preserve recommendations:** shared same-origin validator, compose lightbox behavior, object-URL ownership, backend handoff boundary and all 1318 passing regressions.

## P2 repair-window cleanup

- Replace the stale `AuditB13` backend-test reference in the dependency spec with the real session-audio acceptance module.
- Clarify ReactSheet wording that same-origin restriction applies to canonical `content_url`; legacy `file_uri` retains its existing validated HTTP(S) behavior.
- If touching compose markup, prefer phrasing-content elements inside the native button; do not expand into optimistic preview lifecycle.

## Evidence preserved

- Focused: 13/13 PASS.
- Full exo-app: 1318/1318 PASS under Node 24.14.0.
- typecheck/lint/build/diff-check: PASS.
- No sibling repository source edits.

---

## R2 recheck

```text
Cycle: R2 | Checkpoint: v4-image-preview | Baseline: de9c261 + full worktree content 60c3b094 | Verdict: PASS
Owners: Construction 0, Acceptance 0, Harness 0, Spec 0, Environment 0
Findings: F-01 closed | Consecutive FAIL Count: 0
```

### F-01 disposition: CLOSED

Independent source review and mechanical recheck confirmed:

- canonical and validated legacy candidates are ordered and deduplicated;
- canonical load failure advances exactly once to legacy;
- exhausting the final candidate shows the existing failure card;
- attachment/source identity changes discard stale failure state;
- thumbnail and open lightbox share the active candidate and both exit on exhaustion;
- invalid canonical values remain excluded before DOM use;
- backend spec references and ReactSheet canonical-vs-legacy wording are corrected.

### R2 evidence

- Focused image-preview suite: **17/17 PASS**.
- Adjacent attachment regressions: **75/75 PASS**.
- Full exo-app suite: **1322/1322 PASS** under Node `24.14.0`.
- Typecheck, lint, build and `git diff --check`: PASS.
- Worktree status unchanged by Acceptance.

### Accepted P2

Compose preview keeps pre-existing flow-content overlay `<div>` elements inside the new native button. Browsers, React, lint, accessibility tests and full regressions accept the structure; no observable defect exists. Prefer phrasing elements in a future touched-area cleanup, but this does not block release.

## Final exit decision

All frozen MUST gates pass. F-01 is closed; no P0/P1 remains. The backend SessionAttachment dependency remains accurately disclosed and intentionally out of this frontend checkpoint.
