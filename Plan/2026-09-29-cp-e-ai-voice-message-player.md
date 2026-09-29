# CP-E — V4 AI Voice Message Player Construction Plan

**Status:** FROZEN + RELEASED FOR CONSTRUCTION — Alicia authorized evening preparation on 2026-09-29; implementation remains independently accepted before push.

**Authority:** `../ExoCore/Plan/send_voice_msg_Backend_Plan.md` §10 and the backend contracts recorded in `ReactSheet.md`.

**Baseline:** ExoCore-Desktop `23aee9706ee4ff9caa62ae560a57eb7a9a298fd3` (`main == origin/main`, clean at freeze time).

## 1. Goal

Add the V4 receiving-side UI for proactive assistant voice messages:

```text
canonical assistant Message
  -> unified attachments[] includes ready source="voice_msg" audio
  -> one playable audio bubble
  -> natural playback ended
  -> fetch scoped transcript once for this mounted player
  -> show the exact archived transcript below the player
```

This checkpoint is Desktop-only. It does not add a user-facing `send_voice_msg` button, change the AI tool, modify backend/Runtime/TTS, or remove the existing read-aloud feature.

## 2. Frozen product behavior

1. `attachments[]` is the canonical message attachment read model.
2. `attachments_meta` remains a transitional fallback and is not deleted in CP-E. It remains necessary for legacy/session image `file_uri` and older fixtures/consumers.
3. A ready `source="voice_msg"`, `kind="audio"` attachment renders through the existing audio player and global one-at-a-time playback owner.
4. A voice-only assistant row does not show `（空消息）`.
5. The transcript is not fetched on mount, play, pause, manager-forced pause, media error, or unmount. It is fetched only after the audio element's natural `ended` event.
6. Transcript state is local to the mounted player. It stays visible after the first successful natural end, is fetched at most once per mount, and is hidden again after page refresh/remount.
7. A scoped 404, malformed response, abort, or network failure never exposes response prose and never breaks audio playback; no transcript is shown.
8. `pending`, `failed`, malformed, or non-ready voice rows do not create a playable control or transcript request. Existing `voice_tool_errors` remains the only failed synthesis UI.
9. Runtime overlay rows never fabricate attachments. The player first appears from the canonical GET/reconcile row and appears exactly once.
10. Existing message read-aloud remains visible for text-bearing assistant messages. It and every attachment player continue sharing `globalAudioPlaybackManager`.
11. CP-E adds no pending polling: CP-D materializes a ready attachment atomically before the completed canonical Message becomes visible. Future asynchronous producers require a separate approved polling checkpoint.

## 3. Canonical DTO and normalization

Backend `Message.attachments[]` rows have:

```text
ref: {type: "session_attachment" | "message_attachment", id: positive integer}
kind: "audio" | "image" | "file"
source: bounded string (voice messages use "voice_msg")
status: "pending" | "ready" | "failed"
position: non-negative integer
display_name: string
mime_type: string | null
file_size: integer | null
content_url: string | null
duration_ms: integer | null
error_code: string | null
```

At `normalizeMessageRow`:

- parse the list fail-closed per item;
- preserve server order; never client-sort;
- reject malformed refs/enums/numeric fields without dropping message text or valid siblings;
- keep `attachments_meta` normalization/fallback;
- use `${ref.type}:${ref.id}` as the stable React/playback identity because the two backing tables can reuse numeric ids;
- canonical `attachments[]` controls membership when present and valid;
- when canonical is absent/malformed, fall back to legacy meta membership;
- for a canonical session row, legacy meta with the matching id may supply `file_uri` / `original_filename` fields absent from the unified projection; it must not override canonical status, source, kind, position, or content URL.

## 4. UI construction

### E1 — Unified attachment contract

Expected files:

- `packages/app/src/features/chat/types.ts`
- `packages/app/src/features/chat/api.ts`
- a focused attachment normalization/projection helper under `features/chat/attachments/`
- focused contract tests

Deliver:

- wire-safe unified attachment types;
- fail-closed normalization;
- canonical + legacy fallback projection;
- collision-safe identity.

### E2 — Canonical player and voice-only row

Expected files:

- `packages/app/src/features/chat/MessageTimeline.tsx`
- `packages/app/src/features/chat/attachments/MessageAttachments.tsx`
- existing image/file/audio child components only as required by the unified view type

Deliver:

- ready unified audio/image/file rendering without regressing legacy metadata;
- ready voice message audio player;
- no empty-message placeholder for attachment-only rows;
- pending/failed/malformed rows fail closed while valid siblings still render;
- no runtime-overlay player and no duplicate after canonical reconcile.

### E3 — Natural-ended transcript reveal

Expected files:

- `packages/app/src/features/chat/audio/AudioPlayerBubble.tsx`
- a narrow transcript API helper under `features/chat/audio/` or `voice/`
- focused and integration tests
- `ReactSheet.md`

Endpoint:

```text
GET /api/agents/conversations/<conversation_id>/message-attachments/<attachment_id>/transcript/
-> {"transcript": "exact archived spoken_content"}
```

Deliver:

- exact conversation/attachment-scoped URL;
- abortable fetch tied to component identity;
- first natural end triggers one request per mount;
- successful exact transcript shown below the player;
- safe silent failure/no response-body leak;
- remount/refresh hides transcript until the new player's natural end;
- legacy/non-voice audio never calls the transcript endpoint.

## 5. Acceptance targets

1. A canonical ready `voice_msg` audio row renders exactly one `<audio>` player.
2. A voice-only assistant Message renders no `（空消息）` text.
3. The player uses the backend same-origin `content_url`; unsafe/invalid URLs fail closed.
4. Transcript request count is zero before natural end and exactly one after one or repeated natural ends within the same mount.
5. Transcript text is absent before end, present after a valid response, and absent again after remount until a new end.
6. 404/malformed/network failure produces no transcript and leaks no server body.
7. Legacy audio playback still works and never fetches transcript.
8. Legacy image `file_uri` fallback still renders.
9. Mixed canonical attachments preserve server order; duplicate numeric ids across ref types do not collide.
10. Live runtime row -> done -> canonical refresh yields one player, zero duplicate overlay/player, and existing voice error reconciliation remains intact.
11. Starting voice_msg audio pauses read-aloud/another attachment; starting read-aloud pauses voice_msg audio.
12. Failed synthesis shows the existing safe `voice_tool_error` only and no player.

## 6. Non-goals

- no `send_voice_msg` composer button;
- no V3/chat-core migration or cleanup;
- no removal of `attachments_meta`;
- no pending/status polling;
- no playback-complete write-back or persistent played state;
- no transcript injection into message content/history/query cache;
- no redesign of player visuals beyond the minimum voice transcript surface;
- no backend, Runtime, TTS, notification, or read-aloud API change.

## 7. Validation

Use Node's known web-storage guard:

```bash
NODE_OPTIONS=--no-experimental-webstorage pnpm --filter exo-app test:run <focused CP-E files>
NODE_OPTIONS=--no-experimental-webstorage pnpm --filter exo-app test:run \
  src/test/p1c_historical_rendering.test.tsx \
  src/test/p1c_runtime_attachment_integration.test.tsx \
  src/test/cp_c_voice_tool_error.test.tsx \
  src/test/p2t_integration.test.tsx \
  src/test/p2t_voice_control.test.tsx
pnpm --filter exo-app typecheck
pnpm --filter exo-app lint
pnpm --filter exo-app build
```

Also run `git diff --check`. Do not weaken tests to accommodate the known Node localStorage baseline; use the guard above.

## 8. Commit and handoff

- Commit E1, E2, and E3 atomically when practical; a combined E2+E3 commit is acceptable if component typing makes separation artificial.
- Do not push.
- Stop after tests and hand off commit range, exact test counts, deviations, and screenshots only if already produced; screenshots are not a substitute for behavior tests.
