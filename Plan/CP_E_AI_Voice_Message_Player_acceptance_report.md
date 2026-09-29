# CP-E — V4 AI Voice Message Player Acceptance Report

**Date:** 2026-09-29
**Status:** RELEASE CONDITION: FINAL PASS (Independent Terminal Acceptance by Solaire)
**Baseline:** `67cf5a2`
**Terminal Acceptance Commit:** `138c741`
**Commit Range:** `67cf5a2..138c741` (5 atomic commits, authored by `gemini-3.8-flash <agent@exocore.local>`, unpushed)
**Scope:** `packages/app` (V4 Desktop only; zero changes to V3/`chat-core`, backend, Runtime, TTS, or extensions)

---

## 1. Frozen Behavior Summary

1. **Canonical Attachment Contract (`attachments[]`)**:
   - `attachments[]` is the primary read model for message attachments.
   - `attachments_meta` is preserved as transitional fallback for legacy image `file_uri` and pre-CP-E fixtures.
   - Normalization via `normalizeMessageAttachments` operates fail-closed per item, preserves exact server order, rejects invalid enum/ref fields without dropping siblings, and constructs collision-safe identities (`${ref.type}:${ref.id}`).
   - Fallback semantics:
     - Canonical `[]` explicitly suppresses legacy `attachments_meta` (returns `[]`).
     - Canonical non-empty with $\ge 1$ valid item controls membership and drops malformed siblings.
     - Canonical non-empty with 0 valid items is treated as malformed payload and falls back to `attachments_meta`.
     - Legacy fallback assigns compact contiguous positions without gaps (`0, 1, ...`).

2. **Voice Message Player & Voice-Only Row**:
   - Ready assistant voice attachments (`source="voice_msg"`, `kind="audio"`, `status="ready"`, `ref.type="message_attachment"`) render in `<AudioPlayerBubble>`.
   - Voice-only assistant messages suppress the empty-message placeholder `（空消息）`.
   - Player enforces same-origin `content_url`; remote or protocol-relative sources fail closed.
   - Playback is coordinated via `globalAudioPlaybackManager` singleton for mutual exclusion across voice attachments, legacy audio, and assistant text-to-speech (read-aloud).

3. **Natural-Ended Transcript Reveal**:
   - Transcript request scoped strictly to `GET /api/agents/conversations/<cid>/message-attachments/<aid>/transcript/`.
   - Request is triggered **only** after the audio element's natural `ended` event (never on mount, play, pause, manager-forced pause, media error, or unmount).
   - Fetched at most once per mounted player; hidden on remount/refresh until next natural playback end.
   - Scoped 404, malformed response body, network failure, or abort fail closed silently without disrupting audio playback or leaking response prose.
   - Unmount or track change physically pauses `<audio>` element and releases global playback manager ownership.
   - Rerenders with changed `conversationId` update target scope via fresh ref without interrupting active playback.

---

## 2. Commit Milestones & Repair Packet History

| Commit | Type | Description |
|---|---|---|
| `002bba9` | `feat(chat)` | **E1**: Unify attachment contract with legacy meta fallback (`types.ts`, `projection.ts`, `api.ts`) |
| `802ae2a` | `feat(chat)` | **E2**: Render canonical ready voice player and voice-only row (`MessageAttachments.tsx`, `MessageTimeline.tsx`, `AttachmentImage.tsx`, `AttachmentFileCard.tsx`, `AudioPlayerBubble.tsx`) |
| `1bd1c52` | `feat(chat)` | **E3**: Reveal voice message transcript on natural playback end (`transcript.ts`, `AudioPlayerBubble.tsx`, `shell.css`, `ReactSheet.md`) |
| `fb90228` | `fix(chat)` | **R1 Repair**: Harden attachment fallback semantics, decouple player listeners from object reference churn with stable scalar identity, fix `--v4-text-dim` token, and close E3 evidence gaps |
| `138c741` | `test(chat)` | **R2 Repair**: Sharpen refresh-while-playing discrimination (immediate pause & ownership assertions), fresh-scope `conversationId` transcript fetch verification, strengthened unmount transition to null, and restored compact contiguous legacy positions |

---

## 3. Independent Verification Gates (Final PASS)

Verification executed strictly under the required Node web-storage guard:
`NODE_OPTIONS="--no-experimental-webstorage"`

### 3.1 Focused Suites (3 files, 32 tests) — PASS
- `packages/app/src/test/cp_e_attachment_contract.test.ts` (11 tests passed)
  - Collision-safe `${ref.type}:${ref.id}` keys.
  - Exact server ordering preserved (no client sorting).
  - Canonical `[]` explicitly suppresses legacy `attachments_meta`.
  - Canonical non-empty with $\ge 1$ valid item controls membership and drops malformed siblings.
  - Canonical non-empty with 0 valid items is malformed and falls back to `attachments_meta`.
  - Legacy fallback compact contiguous positions without gaps.
  - Integration with `normalizeMessageRow`.
- `packages/app/src/test/cp_e_message_timeline.test.tsx` (6 tests passed)
  - Canonical ready `voice_msg` audio renders player and suppresses `（空消息）`.
  - Text-bearing assistant row renders text alongside player.
  - User row renders `（空消息）` when text is empty.
  - Non-ready voice rows (`pending`, `failed`, malformed) render no player.
  - Sibling attachments render when voice is malformed.
- `packages/app/src/test/cp_e_voice_player.test.tsx` (15 tests passed)
  - Same-origin `content_url` enforcement; foreign origin fails closed.
  - Zero transcript requests on mount/play/pause; exactly one on natural ended.
  - Fail-closed silent handling on 404, network error, and explicit malformed bodies (`{transcript: 123}`, `{wrong: 1}`, null, non-json).
  - Media error (`error` event) never triggers transcript fetch.
  - Unmount aborts in-flight transcript fetch via `AbortSignal`.
  - Canonical non-voice audio (`source="user"`) never calls transcript endpoint.
  - Remount resets transcript visibility to hidden until next natural end.
  - Discriminating refresh-while-playing: immediate assertion that `audio.pause` is not called, playing UI state is retained, and manager ownership remains active; forced pause transition verified.
  - Fresh-scope verification: rerender with changed `conversationId` fetches transcript from new conversation scope on natural end.
  - Strengthened unmount assertion: physical `audio.pause()` plus manager ownership transition to `null`.
  - Reconcile from streaming runtime overlay to canonical message cleanly produces zero duplicate players.

### 3.2 Full App Test Suite (97 files, 1194 tests) — PASS
- All 97 test suites in `packages/app` passed (1194 tests total, 0 failed, 0 skipped).

### 3.3 Static & Quality Gates — PASS
- `pnpm --filter exo-app typecheck`: **0 errors**
- `pnpm --filter exo-app lint`: **0 warnings**
- `pnpm --filter exo-app build`: **PASS** (Vite app client build and `dist/sw.js` injectManifest generation complete)
- `git diff --check`: **CLEAN** (zero trailing whitespace, zero EOF blank line issues)
- `git status`: **Clean working tree**, ahead by 6 commits, zero push.

---

## 4. Known Non-Blocking Existing Build Warnings

1. **Vite Chunk Size Notification**:
   `(!) Some chunks are larger than 500 kB after minification.`
   Pre-existing build characteristic in `exo-app` due to heavy visualization libraries (`katex`, `cytoscape`, `mermaid-parser.core`, `index.js`). Non-blocking.
2. **Rollup Deprecation Warning in PWA Service Worker**:
   `WARN inlineDynamicImports option is deprecated, please use codeSplitting: false instead.`
   Pre-existing Vite PWA plugin bundler configuration warning. Non-blocking.
3. **React Router v7 Future Flag Warnings**:
   Logged to stderr during jsdom test execution (`v7_startTransition`, `v7_relativeSplatPath`). Standard React Router 6.x opt-in warnings. Non-blocking.

---

## 5. Delivery Sign-off

- **Release Status**: **ACCEPTED & RELEASED**
- **Repository Boundary**: Strictly respected; no changes outside `packages/app` and `Plan/`.
- **Handoff**: Cross-pane interaction to Pane 5 (`Solaire · Acceptance`) executed and approved under `wezterm-pane-interaction` protocol.
