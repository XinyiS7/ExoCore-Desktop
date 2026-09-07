# V4 P1C — Phase C (Task 5 + Task 6) Builder Construction Evidence

> **Builder:** Ecki (pane 4) — Phase C
> **Date:** 2026-09-07
> **Authorized by:** Solaire (pane 3) — sequential Phase C release after Phase B handoff recorded.
> **Frozen authority:** `Plan/V4_Phase_1C_Detailed_Plan.md` (SHA `acada1930…`) + `Plan/V4_Phase_1C_Attachment_Audio_acceptance_report.md` (read-only).
> **Status:** CONSTRUCTION COMPLETE — awaiting independent acceptance. Not a verdict.

---

## 1. Intake / preservation

- Preserved the complete shared-worktree candidate: Phase A files (attachments, audio recorder/target), Phase B files (audioRecoveryMachine, attemptPersistence, AudioRecoveryBar, runtime typed turn integration), all tests.
- Desktop HEAD unchanged: `12e16f6` (C1B). No commit created.
- Backend HEAD `bfd77529` untouched; outer `cf64f42` untouched (pre-existing `moonlight_garden` dirty file untouched).
- Frozen Plan 1C, acceptance report, and acceptance-owned probes: untouched.
- Backend `sia-telemetry` deletion: NOT touched/restored per coordinator instruction.
- Opening real AgentPreset baseline: `OK: 8 rows [1..8]`.

## 2. Task 5 implementation (historical rendering/playback)

### New files
| File | Role / Gate |
|---|---|
| `audio/audioPlaybackManager.ts` | One module-level mutual-exclusion owner: `play(id, pauseFn)` pauses prior owner, `stop(id)` releases, `subscribe` broadcast. Gate G. |
| `audio/AudioPlayerBubble.tsx` | Same-origin `content_url` ONLY (remote `file_uri` never used); visible 404/load/play failure (`role=alert`); accessible seek slider (`role=slider` + aria-valuemin/max/now/text) with pointer click + keyboard ArrowLeft/Right/Home/End; mutual exclusion via global manager; pause/end/error/unmount releases ownership; loading state. Gates G/I. |
| `attachments/MessageAttachments.tsx` | Canonical `attachments_meta` dispatcher only (no ID-based inference): image/audio/other by mime; rows without usable source stay as fallback cards. Gate G. |
| `attachments/AttachmentImage.tsx` | Validated `file_uri` thumbnail; load failure keeps filename fallback card visible ("图片加载失败"); zoom affordance; opens lightbox only when loadable. Gate G. |
| `attachments/ImageLightbox.tsx` | Reuses accepted `useDialogA11y`: labelled close, Escape, focus entry/containment/restoration; backdrop close ONLY on backdrop click — image click never closes. Gates G/I. |
| `attachments/AttachmentFileCard.tsx` | Safe metadata-only: display_name + type label + size; NEVER renders `storage_path`; non-clickable (no download promise — no stable same-origin document URL in contract). Gates G/I + KF-10. |
| `test/p1c_historical_rendering.test.tsx` | 12 focused tests (see §4). |

### Modified
| File | Change |
|---|---|
| `MessageTimeline.tsx` | Replaced `附件 N 个 · P1C 开放` placeholder chip with `MessageAttachments` renderers; pure attachment/audio messages no longer render `（空消息）`; empty content WITHOUT attachments still shows the placeholder; P1D reasoning chip retained; C1B actions/scroll untouched. |
| `styles/shell.css` | V4 `--v4-*`/`app-*` tokens only; lightbox/thumb/filecard/audio-bubble styles; no V3 classes or tokens. |
| `test/conversation.test.tsx` | Updated the C1B-era placeholder assertion to the Task 5 rendering behavior (file card + fallback card; chip removed). |

## 3. Task 6 verification — deterministic construction checks

| Command | Result |
|---|---|
| `pnpm --filter exo-app typecheck` | PASS |
| `pnpm --filter exo-app lint` | PASS (0 errors) |
| `NODE_OPTIONS=--no-experimental-webstorage pnpm --filter exo-app test:run` | **PASS — 232 tests / 27 files, 0 failed** |
| `pnpm --filter exo-app build` | PASS |
| `pnpm --filter exo-chat-core test:run` | PASS — 85 tests / 12 files |
| `pnpm build` (all four packages) | PASS — app/chat-core/chronicle/council Done |
| V3 lints | chat-core 151 errors = pre-existing known-dirty fingerprint (git diff proves zero V3 file changes by this slice; same count as Phase A intake); chronicle/council 0. |
| `git diff --check` / `--cached --check` | PASS (CRLF line-ending warnings only) |
| Real DB baseline (closing) | `OK: 8 rows [1..8]` |
| Provider / live browser calls | **NONE** |

### Task 5 focused matrix (12 deterministic tests)
- image thumbnail renders canonical `file_uri`; lightbox opens with labelled dialog; Escape closes and restores focus;
- missing `file_uri` / load error → visible filename fallback card, no phantom lightbox trigger;
- audio bubble binds `content_url` and NEVER the remote `file_uri`;
- audio 404/load failure `role=alert` visible; playback disabled;
- global mutual exclusion: playing a second bubble pauses the first (real two-bubble component test through the manager subscriber path); pause/end/error/unmount release ownership;
- seek slider: aria label/min/max/valuetext; keyboard ArrowRight advances; pointer ratio maps to time;
- file card: name/type/size only, `storage_path` absent, no link;
- pure attachment/audio messages show no `（空消息）`; empty-no-attachment still shows placeholder;
- mixed image+audio+file batch renders all three from canonical metadata.

### Phase A/B invariants preserved (verified via full suite)
- 213 Phase A/B + C1B tests still pass (232 total = +12 Task 5, +7 net)
- send/delete bidirectional locks, recovery snapshot/retry, attempt persistence, edit/regenerate boundary: untouched by Task 5 (rendering-only slice)

## 4. Honest omissions for Acceptance

1. **Controlled live browser probe (Plan §8): NOT executed** — requires Alicia authorization (provider spend + real browser). Deterministic matrices above own races/failures; the bounded real-browser mixed image/document/audio path, production-built route geometry, and same-origin historical playback must be run by Acceptance with Alicia approval.
2. **Responsive geometry (Gate I, widths 320/390/767/768+)** verified by code review only (flex-wrap, max-width, min-width:0, ellipsis, non-hover controls); no real viewport run without a browser probe.
3. **Playback seek keyboard coverage** verified deterministically; real-device audio timing remains in the live probe scope.
4. No waveform analysis, transcript/STT, transcoding, or download promise added (scope exclusions honored).

## 5. Scope preservation sweep (self-check)

- No model/endpoint selector, cache controls, project-file browser, `@[path]`, tool_collection controls.
- No Collection/transcript/STT/durable assets; no resumable/byte-progress claims.
- No V3 tokens/components imported into V4 (V4-only classes; icons via lucide-react already in deps).
- No backend / outer / nginx / launcher / PWA change; no new dependency; no lockfile change.
- `storage_path` never rendered/logged/used as URL.
- No silent catches on attachment/media paths (every media failure has a visible state).

## 6. File manifest (Phase C slice)

```
A packages/app/src/features/chat/audio/audioPlaybackManager.ts
A packages/app/src/features/chat/audio/AudioPlayerBubble.tsx
A packages/app/src/features/chat/attachments/MessageAttachments.tsx
A packages/app/src/features/chat/attachments/AttachmentImage.tsx
A packages/app/src/features/chat/attachments/ImageLightbox.tsx
A packages/app/src/features/chat/attachments/AttachmentFileCard.tsx
A packages/app/src/test/p1c_historical_rendering.test.tsx
M packages/app/src/features/chat/MessageTimeline.tsx
M packages/app/src/styles/shell.css
M packages/app/src/test/conversation.test.tsx
```

Plus accumulated Phase A/B/1C files (untracked, unchanged by this slice except the two modified above).

## 7. Single coherent self-check (Builder, direct)

Re-verified against the frozen Plan's Task 5/6 gate items after the final run: placeholder removed (Plan Task 5.1), canonical-metadata-only rendering (Task 5.2/§5.6), same-origin audio + mutual exclusion (Gate G), keyboard/pointer seek with labels (Gate I), metadata-only file cards (KF-10), no empty-message placeholder for pure attachment turns (acceptance intent #5), focused + final deterministic pipelines (Task 6.1–6.5), evidence written outside frozen artifacts (6.6), DB baseline closed at 8. No defects found in the self-check. Handing off to the independent acceptance owner now (not self-reviewed beyond this coherent pass).

**Phase C construction complete. Messaging pane 3 per protocol; awaiting independent acceptance (C1C) — no commit was or will be made before Acceptance PASS + Alicia approval.**