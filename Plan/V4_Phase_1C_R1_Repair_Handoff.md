# V4 P1C — R1 Local Repair Handoff

> **Builder:** `[gpt-5.6-sol / Solaire]`
> **Baseline:** C1C R1 candidate on Desktop HEAD `12e16f647a7b42760a947641b5dab56af5c1d2fc`
> **Authority:** frozen Plan + acceptance contract; findings `R1-01`…`R1-07` from `packages/app/node_modules/.cache/p1c-independent/R1-result.md`
> **Status:** repair complete; ready for independent focused recheck. This is Builder evidence, not an acceptance verdict.

## Repair outcomes

| Finding | Local repair | Decisive result |
|---|---|---|
| R1-01 | Attachment manager always exposes its collapsed entry; opening initiates the real list path; empty/error states retain Refresh. | First-entry and initial-failure/retry construction path passes. |
| R1-02 | Ref-backed `refresh()` rejects reads while DELETE is unresolved; Refresh UI also disables under delete pending. Mutation epoch/lock can no longer be displaced by a list read. | DELETE + immediate refresh preserves `onDeleted`, local purge and lock release. |
| R1-03 | Upload coordinator validates the complete `results` ownership bijection before exposing any success: exact length, object row, integer in-range index and one owner per input. | Duplicate/missing/extra/malformed ownership yields no sendable ID; valid out-of-order mapping remains supported. |
| R1-04 | Audio upload now owns an AbortController plus upload epoch. Route change/unmount aborts and invalidates; completion/catch/finally check epoch + signal + Conversation before snapshot or chat dispatch. | Delayed unmount and A→B→A responses emit zero old chat dispatch and cannot revive state. |
| R1-05 | Runtime attempt context retains pre-dispatch persistence. Initial send no-write remains `proven_absent`; rejected or storage-blocked exact replacement retains exact original Message binding instead of becoming an ordinary new send. | Safe HTTP rejection and pre-POST storage failure both report the original exact binding. |
| R1-06 | Added a local media URL boundary. Audio accepts only HTTP(S) same-origin `content_url`; images accept only HTTP(S) canonical URIs. Rejected/missing values render existing safe fallbacks and never enter media `src`. | Foreign/protocol-relative audio and `file:` image are rejected; valid same-origin audio and HTTPS image remain supported. |
| R1-07 | Recorder has a synchronous pending-permission guard and per-start epoch. Obsolete grants/rejections are ignored, every obsolete granted stream is stopped, and all data/stop/error callbacks check attempt ownership. | Repeated pending Start requests one stream; cancel→new attempt cannot leak old tracks or mix OLD data into NEW Blob. |

## Files changed by this repair

Production:

- `packages/app/src/features/chat/attachments/UserAttachmentManager.tsx`
- `packages/app/src/features/chat/attachments/useUserAttachmentManager.ts`
- `packages/app/src/features/chat/attachments/useComposeAttachments.ts`
- `packages/app/src/features/chat/attachments/mediaUrls.ts` (new)
- `packages/app/src/features/chat/attachments/AttachmentImage.tsx`
- `packages/app/src/features/chat/audio/AudioPlayerBubble.tsx`
- `packages/app/src/features/chat/audio/audioRecoveryMachine.ts`
- `packages/app/src/features/chat/audio/useAudioRecorder.ts`
- `packages/app/src/features/chat/runtime/useChatRuntime.ts`
- `packages/app/src/features/chat/ConversationPage.tsx`

Construction tests:

- `packages/app/src/test/p1c_attachment_manager.test.tsx`
- `packages/app/src/test/p1c_compose_attachments.test.tsx`
- `packages/app/src/test/p1c_audio_recovery.test.tsx`
- `packages/app/src/test/p1c_runtime_attachment_integration.test.tsx`
- `packages/app/src/test/p1c_audio_recorder.test.ts`
- `packages/app/src/test/p1c_historical_rendering.test.tsx`

Frozen Plan/report and ignored independent probe source were not modified.

## Verification

| Check | Result |
|---|---|
| Focused repaired construction suites | PASS — 59/59, 6 files |
| Existing ignored R1 independent probe rerun | PASS — 16/16, 1 file; Builder rerun only, no verdict |
| App full suite | PASS — 244/244, 27 files |
| App typecheck | PASS |
| App lint | PASS |
| App production build after final source | PASS |
| V3 chat-core tests | PASS — 85/85 (run in full repair pipeline; no V3 source changed) |
| Four-workspace build | PASS (run in full repair pipeline; final subsequent hardening touched only app upload validation, followed by app typecheck/test/build) |
| `git diff --check` / cached check | PASS; existing line-ending warnings only |
| Real AgentPreset closing baseline | PASS — exactly IDs 1–8 |
| Provider/live calls | None |
| Commit | None |

## Preserve/scope statement

The repair remained inside the seven reported local seams. It did not add P1D controls, backend/V3/deployment code, a new dependency, a new lock framework, URL downloader, transcoding or alternate runtime. C1B operation/reconciliation authority and previously passing 204/409, exact binding, lightbox, playback and seek behavior were preserved.

Independent Acceptance should re-run R1-01…R1-07 and the listed sibling cases first. Provider generation and the controlled live browser probe remain outside this repair and still require Alicia's explicit authorization or re-baseline.
