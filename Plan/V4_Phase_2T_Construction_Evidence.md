# V4 Phase 2T Message TTS — Construction Evidence

> **Owner:** Builder (pane 4 / Ecki). Incremental, checkpoint-scoped evidence for `Plan/V4_Phase_2T_Message_TTS_Detailed_Plan.md`.
> **Not acceptance-owned:** `Plan/V4_Phase_2T_Message_TTS_acceptance_spec.md`, `Plan/V4_Phase_2T_Message_TTS_acceptance_report.md`, `packages/app/src/acceptance/**` and `Plan/evidence/p2t-acceptance/**` are never written, staged or committed from this pane.
> **Rule:** no self-PASS. Each checkpoint below records facts only; verdict belongs to the independent acceptance owner (pane 3).

---

## CP 2T-1 — Contract adapter (projection + client)

**Status:** construction complete; self-checked by Builder against the frozen Plan/acceptance criteria, current diff and executed tests. Handed off for independent acceptance. Not self-accepted. **R1 verdict FAIL (P2T-F1, T3) repaired; awaiting recheck.**

### 1. Baseline recorded before any edit (2026-09-12)

- Desktop HEAD at start: `84522606631eb569c00f97778aec53a40fb83e49`.
  - One additive docs commit ahead of the Plan planning baseline `cabb77f0…`; `8452260` touched only `ReactSheet.md` (+8/−3) and pre-dates construction.
- Backend HEAD at read-only verification: `6fd26b4a2ed265dcf06b80177bc8d61d1d1488bb`.
  - One code commit (`a518ca1a`, R2 multimodal attachment repair) sits between the Plan's B5 baseline `4e67ca07…` and this HEAD. Its only change to `agents/views.py` is `SessionAttachmentView` (`materialize_parts` → `resolve_transport`), **zero TTS/voice lines**. `memory/serializers.py`, `engines/voice/`, `memory/models.py`, `agents/urls.py` are unchanged since `4e67ca07`. **No contract drift ⇒ no stop.**
- Planning-time dirty worktree preserved byte-identical across construction (sha256 start = end):
  - `DevelopLog/DebugLog.md` `ad9dc54c…`
  - `Plan/Update_log.md` `0629f2b3…`
  - `Plan/V4_Master_Implementation_Roadmap.md` `76b22aa6…`
  - `ReactSheet.md` `b45bb0f3…` (B5 sync; not touched by this checkpoint)
  - `packages/chat-core/src/main.jsx` `014f9205…`
  - `Plan/spec/2026-09-12-message-tts-render-contract-handoff.md` `3f803f8f…`
- Frozen documents (read-only for Builder; unchanged):
  - `Plan/V4_Phase_2T_Message_TTS_Detailed_Plan.md` sha256 `1d9536e8…`, git hash-object `07ae7a0c…`
  - `Plan/V4_Phase_2T_Message_TTS_acceptance_spec.md` sha256 `fe853e88…`, git hash-object `074358bf…`
- Baseline dirty/staged snapshot: 5 modified sibling files, 2 staged frozen docs, 1 untracked handoff spec — all preserved.

### 2. Frozen-fact re-verification (read-only, before construction)

| Plan fact (§3) | Re-verified against current source | Drift |
|---|---|---|
| `MessageSerializer.get_voice`: assistant → `{available,directed,cached}`; non-assistant → `null` | `ExoCore/memory/serializers.py` (get_voice) — exact match | none |
| POST `/tts/`: 200 playable `{content_url,duration_ms}` / 202 `{status,retry_after_ms:1500}` / 404 `error:not_found` / 422 `error:ineligible_message\|no_active_profile` / 503/504/500 `failed_retryable{code,message}` | `ExoCore/agents/views.py::MessageTTSView.post` — exact match | none |
| GET `/tts/`: 200 idle / 200 playable / 202 generating / 404 / 422 / 503/504/500; invalid artifact degrades to 200 idle | `MessageTTSView.get` — exact match | none |
| content endpoint: `FileResponse` audio, `private, no-cache, max-age=0`, no Range, 404 `code:audio_artifact_missing` | `MessageTTSContentView` — exact match | none |
| Error keys inconsistent (`error` vs `code`); `machineCodeOf` ignores string `error` | `runtime/client.ts:126` (ignores `error`) — confirmed | none |
| `npm`-side anchors: `MessageRow` types.ts:92; `normalizeMessageRow` api.ts:217; trace precedent api.ts:143 | confirmed at construction time | none |
| Greenfield: `voice|tts` hits in `packages/app/src/features/chat` at HEAD | `git grep` exit 1 (zero hits) | none |
| `apiFetch`: non-2xx throws with `status`+`body`; 202 resolves (2xx) | `packages/shared/src/api.js` — confirmed | none |

### 3. Changed files (CP 2T-1)

| Path | Status | sha256 |
|---|---|---|
| `packages/app/src/features/chat/types.ts` | modified | `09d6fde4…` |
| `packages/app/src/features/chat/api.ts` | modified | `9acedacc…` |
| `packages/app/src/features/chat/tts/types.ts` | new | `e1464f11…` |
| `packages/app/src/features/chat/tts/api.ts` | new | `1baf346d…` (post-F1 repair; pre-repair `bbb41de9…`) |
| `packages/app/src/test/p2t_voice_projection.test.ts` | new | `37b0a9f0…` |
| `packages/app/src/test/p2t_voice_client.test.ts` | new | `94023013…` (post-F1 repair; pre-repair `49026a6b…`) |

Diff fingerprint (`git diff -- packages/app | sha256sum`): `bf64eab6…`. No other path touched — no UI, hook, timeline, page, CSS, backend, V3, `src/acceptance/**`, frozen doc or dependency change.

### 4. Verification executed

| Gate | Command | Result |
|---|---|---|
| V1 (CP1 initial delivery) | `NODE_OPTIONS=--no-experimental-webstorage pnpm --filter exo-app exec vitest run src/test/p2t_voice_projection.test.ts src/test/p2t_voice_client.test.ts` | 2 files / 44 tests passed, 0 fail (projection 17, client 27) |
| R1 repair (F1) focused re-run | same command | **2 files / 60 tests passed, 0 fail** (projection 17, client 43) |
| V2 | `pnpm --filter exo-app typecheck` | exit 0, 0 errors (re-run after F1: exit 0) |
| V3 | `pnpm --filter exo-app lint` | exit 0, 0 errors (re-run after F1: exit 0) |
| Neighbour regression (construction-facing) | `… vitest run src/test/api.test.ts src/test/p1d_trace_contract.test.ts src/test/p1d_cache_api.test.ts` | 3 files / 48 tests passed (re-run after F1: 48) |
| V5 full suite / V4 build / V6–V7 browser | — | **deferred to CP3** per acceptance rhythm (§3.3); not claimed here |

> Note for acceptance: Plan V1's `"src/test/p2t_*"` is not a literal vitest filter (positional args are filename filters, not globs); the executed form above passes explicit file paths from the workspace root. Acceptance probes should use explicit paths or shell expansion from `packages/app`.

### 5. Evidence mapping to CP 2T-1 gates (T1–T4)

**T1 Projection** — `p2t_voice_projection.test.ts`
- `normalizeVoiceProjection` valid payload → `toEqual({available:true,directed:false,cached:true})` **and** exact key set `['available','cached','directed']` (emotion/target/segments extra keys dropped).
- `available:false` remains a non-null truthful projection.
- 10 malformed variants (`null`/string/number/array/missing field/string-boolean/numeric-boolean/nested) → `toBeNull()`.
- Through the real `fetchMessagePage` adapter: valid assistant row projects; legacy row without field → `null`; malformed assistant voice → `null` **while `content` stays `'纯净正文'`**; user row with a valid-looking voice → `null`; system row → `null`; one malformed row does not contaminate its two neighbours.

**T2 Transport** — `p2t_voice_client.test.ts`
- POST: exact pathname `/api/agents/conversations/5/messages/42/tts/`, `method:'POST'`, `credentials:'include'`, CSRF header defined, and `JSON.parse(init.body)` **exactly `{}`** (INV-2).
- GET: same path, `method:'GET'`, `body` undefined, exactly one call (observation never triggers generation).
- POST and GET both forward the caller `AbortSignal` (captured non-null) and rethrow abort as `{name:'AbortError'}` — cancellation never becomes an outcome/UI state.

**T3 Outcomes** — 20-case `it.each` matrix + 3 boundary tests + F1 timing sweep (16 tests)
- 200 playable (POST/GET) → `playable.contentUrl` verbatim, `durationMs` 3200 / 0 (0 preserved).
- 202 generating (POST/GET) → `retryAfterMs` honored (1500 / 900 / 2700 — arbitrary positive finite values pass through).
- Malformed required `retry_after_ms` → `failed_retryable/contract` on **both** actions (see R1 repair below).
- GET 200 idle → `idle` (stable backend reset, no client `invalid_artifact` special case).
- 404 (POST/GET) → `unavailable/not_found`; a 404 whose body impersonates `playable` still maps `unavailable/not_found` (no guessing).
- 422 `ineligible_message` / `no_active_profile` → `unavailable` with both variants.
- 503 `runtime_offline` / 504 `generation_timeout` / 500 `generation_failed` → `failed_retryable` with backend copy preserved; unknown code (`corrupt_artifact`) degrades to status-implied `generation_failed`.
- Malformed 2xx: 200 `{}`, 202 `{status:'queued'}`, non-JSON 200, `playable` without `content_url` → `failed_retryable/contract` (never silent success, no fabricated URL).
- A 2xx `failed_retryable` body is never painted as success.
- Network `TypeError` → `failed_retryable/network` with transport message; non-JSON 502 → `failed_retryable/generation_failed`, `message:null`.

**T4 Scope** — `git status` shows only §3 paths plus the untouched pre-existing dirty/staged snapshot; no control/timeline/page/future-phase code exists in the diff.

### 6. Construction decisions within CP1 (frozen interpretations)

1. **2xx recognition rule (literal D3):** any 2xx whose body lacks a recognized status is `failed_retryable/contract`, including malformed 202. HTTP status governs *errors*; the body `status` governs *2xx states*.
2. **Required timing vs advisory metadata (amended after R1/F1):** a `generating` body must carry a positive finite `retry_after_ms`; a missing/null/wrong-type/nonpositive/nonfinite value makes the 2xx malformed → `failed_retryable/contract` on both actions. Only `duration_ms` is advisory and degrades to `null` (D8). The client never invents an observation schedule.
3. **Bounded taxonomy:** unknown backend codes are never surfaced verbatim; they fall back to the status-implied code. `audio_artifact_missing` is kept in the frozen taxonomy but is only producible by the content endpoint, which these adapters do not fetch (CP2 media handling stays separate).
4. **Abort ≠ state:** aborts rethrow; only network/contract/HTTP failures become outcomes.
5. **No identity pre-validation:** message/conversation identity travels in the URL only; a non-existent identity is backend `404 → unavailable`, not a client-invented state.

### 6.1 R1 repair (F1) — malformed required generating timing fails closed

**Finding:** `Plan/V4_Phase_2T_Message_TTS_acceptance_report.md` R1 / CP 2T-1 FAIL, `P2T-F1 / P1 / new` (counter 1, gate T3).

**Causal restatement:** the CP1 decoder treated required `retry_after_ms` like advisory metadata and substituted an undocumented polling default (`TTS_RETRY_AFTER_FALLBACK_MS = 1500`) for missing/null/wrong-type/nonpositive values, returning a fabricated `generating` schedule; a construction test blessed that reinterpretation. Frozen D3 requires malformed 2xx → `failed_retryable/contract`, and the Plan's advisory fallback allowance covers only `duration_ms`. The backend currently always sending 1500 is not authorization for a client default.

**Repair (F1 only):** in `tts/api.ts` the fallback constant was removed; `retryAfterOf` returns `null` unless the value is a positive finite number, and the shared `generating` decode — used by both start and read — returns `failed_retryable/contract` when it is `null`. No new polling policy, retry layer, UI or backend change.

**Generalized counter-verification (beyond the five original reports):** 7 malformed shapes (missing, null, string, boolean, 0, negative, nonfinite `1e999`) × both actions = 14 sweep cases, all assert exactly `{phase:'failed_retryable',code:'contract',message:null}` with a single request; plus non-default valid interval 2700 preserved on both actions. Preserved areas re-verified by the same run: projection/read adapter, identity-only `{}` body, abort rethrow, GET idle, 404/422/503/504/500 mapping, malformed-playable and non-JSON boundaries.

**Post-repair facts:** focused tests 60/60 (projection 17 + client 43); typecheck exit 0; lint exit 0; neighbour regression 48/48. Read-only re-execution of the Acceptance-owned probe `packages/app/src/acceptance/p2t_contract_acceptance.test.ts` (current staged revision, not edited by Builder): **23/23 passed**, i.e. the five R1 F1 cases now fail closed as required. Hashes: `tts/api.ts` `1baf346d…`, `p2t_voice_client.test.ts` `94023013…`; tracked app diff fingerprint unchanged (`bf64eab6…`).

### 7. Deferred / known limitations (nothing blocking CP1)

- Full suite, build and browser probes: CP3; not run at CP1.
- No hook/control/timeline/CSS/ConversationPage exposure (CP2–CP3).
- Live VoxCPM2 daemon remains pending: real rendering should surface truthful `runtime_offline`; not exercised here (no paid/daemon/real-DB action authorized).
- `src/acceptance/**` probes are Acceptance-owned and untouched by Builder.
- D14 `ReactSheet.md` correction stays CP3 and must be an additive one-sentence edit on top of the current B5 dirty state.

### 8. Unresolved questions

None. Construction stopped at CP1; no CP2/CP3 work started.

---

## CP 2T-2 — Control, playback and `directed` visuals

**Status:** construction complete; self-checked by Builder against the frozen Plan/acceptance criteria, the current diff and executed tests. Handed off for independent acceptance. Not self-accepted. **R3 verdict FAIL (P2T-F2, T8) repaired; awaiting recheck.**

### 9. Baseline re-verified before CP2 edits (2026-09-12, after the 2T phase-boundary dialogue compaction)

- Desktop HEAD unchanged: `84522606631eb569c00f97778aec53a40fb83e49` (no commit since CP1).
- Backend HEAD unchanged (read-only): `6fd26b4a2ed265dcf06b80177bc8d61d1d1488bb` — CP2 touches no contract surface.
- Frozen documents (Builder read-only) unchanged, sha256 start = end of CP2:
  - `Plan/V4_Phase_2T_Message_TTS_Detailed_Plan.md` `1d9536e8…`
  - `Plan/V4_Phase_2T_Message_TTS_acceptance_spec.md` `fe853e88…`
  - The staged Acceptance report is Acceptance-owned; not read as a requirement, not touched.
- Sibling dirty worktree byte-identical to the CP1 record: `DevelopLog/DebugLog.md` `ad9dc54c…`, `Plan/Update_log.md` `0629f2b3…`, `Plan/V4_Master_Implementation_Roadmap.md` `76b22aa6…`, `ReactSheet.md` `b45bb0f3…`, `packages/chat-core/src/main.jsx` `014f9205…`, `Plan/spec/2026-09-12-message-tts-render-contract-handoff.md` `3f803f8f…`.
- `git status` equals the CP1 snapshot plus exactly the CP2 paths below.
- Tracked app diff fingerprint: pre-CP2 `bf64eab6…` → post-CP2 `e78f7f50…`; the delta is exactly `packages/app/src/features/chat/MessageTimeline.tsx`.

### 10. Changed files (CP 2T-2)

| Path | Status | sha256 |
|---|---|---|
| `packages/app/src/features/chat/MessageTimeline.tsx` | modified | `da6ad449…` |
| `packages/app/src/features/chat/tts/useMessageVoice.ts` | new | `697d0b3a…` |
| `packages/app/src/features/chat/tts/MessageVoiceControl.tsx` | new | `5562732e…` (post-F2 repair; pre-repair `8cb994f6…`) |
| `packages/app/src/features/chat/tts/tts.css` | new | `e9dc5e2f…` |
| `packages/app/src/test/p2t_voice_control.test.tsx` | new | `becd2e04…` (post-F2 repair; pre-repair `4d9ee38b…`) |

Unchanged by Δ: `tts/types.ts` / `tts/api.ts` (CP1), every P1C file (`AudioPlayerBubble.tsx`, `audioPlaybackManager.ts`, `attachments/mediaUrls.ts`, `p1c_historical_rendering.test.tsx`), `ConversationPage.tsx` (CP3), `src/acceptance/**`, frozen docs, backend, V3 packages, dependencies.

### 11. Verification executed (CP2)

| Gate | Command | Result |
|---|---|---|
| CP2 focused suite | `NODE_OPTIONS=--no-experimental-webstorage pnpm --filter exo-app exec vitest run src/test/p2t_voice_control.test.tsx` | **1 file / 23 passed / 0 fail** post-F2 (pre-F2 22/22); green in repeated full-file runs |
| Cumulative P2T construction | same runner with `p2t_voice_projection.test.ts` + `p2t_voice_client.test.ts` + control file | **3 files / 83 passed** post-F2 (17 + 43 + 23; pre-F2 82) |
| P1C playback regression + CP1 contract probe | `… vitest run src/test/p1c_historical_rendering.test.tsx src/acceptance/p2t_contract_acceptance.test.ts` | 2 files / 37 passed (14 + 23) — **both files unmodified** |
| Affected neighbours (timeline consumers + integration) | `… vitest run src/test/conversation.test.tsx src/test/chat_runtime.test.tsx src/test/api.test.ts src/test/p1d_final_integration.test.tsx src/test/p1d_controls_ownership.test.tsx src/test/runtime_lifecycle.test.tsx src/test/p2_conversation_delete.test.tsx` | 7 files / **86 passed** (35 timeline consumers + 51 integration) |
| V2 | `pnpm --filter exo-app typecheck` | exit 0, 0 errors |
| V3 | `pnpm --filter exo-app lint` | exit 0, 0 errors |
| Acceptance CP1 probe (read-only execution, not edited) | included in the row above | 23/23 passed — CP1 contract gates unaffected by CP2 |
| V5 full suite / V4 build / V6–V7 browser+geometry | — | **deferred to CP3** per acceptance rhythm (§3.3); not claimed |

### 12. Evidence mapping to CP 2T-2 gates (T5–T8)

**T5 Lazy lifecycle** — `p2t_voice_control.test.tsx`
- Eligibility + no eager work: `exposes the entry only for eligible assistant rows and never auto-requests` — one entry for the single eligible assistant row (`cached:true` included), none for `available:false` / `voice:null` / user row; **zero** fetch calls and **zero** `play()` calls at mount.
- Placement contract: `mounts inside the actions cluster, ahead of the branch action` — entry is a child of `.app-msg-actions`, precedes the branch button in DOM order, cluster has exactly 2 children (no second `margin-left:auto` sibling).
- Overlays: `never renders the control for the runtime overlay or the optimistic row`.
- Click → one request → observation: `starts one request per click and observes retry_after_ms until playable` — `语音生成中` is `disabled` + `aria-busy=true`, no slider yet; request sequence is exactly `['POST','GET','GET']` with POST body `'{}'`; `play()` called exactly once at the click-originated `playable`.
- Repeat-click mutex: `collapses rapid repeat clicks into a single in-flight request`.
- GET idle reset + retry usability: `GET idle resets to the entry state and a later click starts a new request`.
- Unmount/late-response guard: `unmount aborts the flow and drops the late response` (captured `AbortSignal` flips to `aborted`, no element, no playback), and `cannot write a previous identity's late response into the next identity` (same component instance, `messageId` 71→72 while a GET is open).
- Observation bound: `stops observing at the bound and stays retryable` — with a 40 ms bound the hook settles `failed_retryable` (`generation_timeout` copy) and the read count stops growing; `ends a hung transport at the bound as a retryable timeout` — a never-settling observation still hits the bound, and a transport that ignores the abort and later resolves `playable` cannot write over the settled timeout (no play token minted).
- Retry truth: `mints a new play token for every click-originated playable arrival` (0 after failure → 1 after retry, i.e. one autoplay per user intent).
- Run isolation (D7): `stays usable while a chat run is active (no operation-lock coupling)`.
- No `visibilitychange` listener was added (not required).

**T6 Truth/UI** — `p2t_voice_control.test.tsx`
- Names: `朗读此条消息` / `语音生成中` / `播放朗读`–`暂停朗读` / `重试生成语音` / slider `朗读进度` asserted by role+name throughout; `unavailable` renders nothing (eligibility test).
- Bounded copy: `keeps a bounded failure copy and an explicit retry path` — 503 `runtime_offline` renders `语音服务未就绪`; the backend `message` text (`'daemon offline: private detail'`) never reaches the DOM; retry issues a second POST.
- No fake progress: `never invents a generation percentage or a cancel affordance` — no `取消` control and no `%` anywhere while generating.
- Media error is retryable truth: `treats a media error as retryable, never as endpoint-404 unavailability` — element `error` → `重试生成语音` (`音频加载失败`), retry POST recovers playable.
- Playback rejection: `records a playback policy rejection without faking success or synthesis failure` — `NotAllowedError` autoplay block leaves the artifact playable with an explicit play action; no retry state, no `暂停朗读`; explicit click then plays.
- URL hygiene counted here: `refuses a non-same-origin content URL as a retryable artifact failure` — foreign origin never reaches `<audio>`.

**T7 Compact/directing** — `p2t_voice_control.test.tsx`
- `adds only a visual modifier for directed rows` — `app-voice-btn` vs `app-voice-btn app-voice-btn--directed`; stripping that one token makes the two buttons' `outerHTML` identical (no added text/title/ARIA/node).
- `seeks the real media element by pointer and keyboard under the frozen slider name` — pre-metadata `aria-valuemax` comes from `duration_ms` (4), after `loadedmetadata` from the element (120); ArrowRight/Home and pointer ratio write to the real `currentTime`; `aria-valuetext` carries time, never a generation percent.

**T8 Ownership** — `p2t_voice_control.test.tsx`
- `shares one playback owner with attachment audio in both directions` — attachment audio claims playback → the TTS element is paused via `globalAudioPlaybackManager`; TTS claims it back → the attachment element is paused.
- `releases playback ownership on unmount and physically pauses the element` — the exact owned `<audio>` element receives a physical `pause()` **and** manager ownership drops to `null` (F2; repeated idempotent pauses are acceptable, membership is what matters).
- `physically pauses the owned element when the row identity changes mid-playback` — message identity switch on a live component instance stops the old element and releases ownership.
- `treats a media error as retryable…` additionally asserts the resource-loss path pauses the element before releasing ownership.
- Structural isolation facts: no TTS data is added to `attachment_ids`/`attachments_meta` (control never touches attachment surfaces), no new Query key or cache family exists (all voice state is local React state), and `AudioPlayerBubble`/`audioPlaybackManager` are unmodified (see §10).

### 13. Construction decisions within CP2 (frozen interpretations)

1. **Immediate `generating` on click:** the control shows `语音生成中` as soon as the click starts the flow, before the POST resolves. The click is the user's intent and any in-flight request is honestly "working"; every terminal state is still backend truth.
2. **Media error mapping:** `<audio>` `error` → `failed_retryable` with `audio_artifact_missing`, never `unavailable`. A DOM media error cannot reveal an HTTP body, so it never claims endpoint-404 truth (spec §4).
3. **Playback rejection policy:** `NotAllowedError` (autoplay policy) keeps the artifact `playable` with an explicit play action and never sets a playing state; `AbortError` (pause during start) is control flow; anything else is a retryable media failure. "Recorded" is satisfied by truthful state + this evidence — no telemetry/logging channel was added (out of scope).
4. **Bounded failure copy:** one whitelist string per `TtsErrorCode` (D3) rendered as the retry button's visible text; backend `message` text is never displayed.
5. **Identity reset key:** `(conversationId, messageId, available)` — deliberately not the `voice` object identity, so a non-destructive read-model reconciliation cannot destroy a live voice state (protects T9; `available` flips are still reset truthfully).
6. **`reportMediaFailure` is phase-guarded:** only `playable → failed_retryable`; duplicate or stale reports are no-ops.
7. **Polling discipline:** each wait is `min(retry_after_ms, remaining bound)` with no busy-spin; the bound is measured from the click; a GET is never issued past the bound.
8. **Hard observation bound:** the bound is also enforced by a dedicated timer created at the click. A transport that never settles (hang) is settled as `generation_timeout`, its controller is aborted, and the flow id is closed so a late resolution from a signal-ignoring transport can never produce a fake success. Without this, a hung request would keep the control in `generating` past the frozen bound.
9. **`directed` is one class on the existing button in every phase** (`idle`/`generating`/`playable`/`failed_retryable`), so the visual state exists before generation and cannot alter semantics.
10. **Playable layout reuses the same button element** and adds only slider + time + (transient) loading copy inside the same `.app-voice-control` wrapper.
11. **Physical release before ownership release (amended after R3/F2):** every release path pauses the exact owned element first (`cleanup` on unmount/identity/content-URL change, and the media-error path) and then calls `manager.stop`. `globalAudioPlaybackManager.stop` is bookkeeping-only by contract and never invokes a pause callback, and a detached media element keeps sounding — so a local pause is mandatory. Repeated pauses are idempotent (a paused element stays paused), and ownership release stays exact-owner-only.

### 13.1 R3 repair (F2) — physical playback release on unmount/identity/resource loss

**Finding:** `Plan/V4_Phase_2T_Message_TTS_acceptance_report.md` R3 / CP 2T-2 FAIL, `P2T-F2` (this checkpoint counter 1, gate T8). Independent corrected probe: 4/5; the physical-stop case expected the owned element in the `pause` calls and observed `[]` (construction/P1C/CP1 59/59, typecheck/lint 0 at that revision). The Acceptance-side mock-harness fault reported alongside is recorded as theirs, not this repair.

**Causal restatement:** the element-lifecycle effect's cleanup released playback with `globalAudioPlaybackManager.stop(playbackId)` only. That manager method is bookkeeping by contract: it clears `activeId`/`activePause` and never invokes the pause callback, which it only calls when *another* owner claims playback. A detached media element keeps sounding on its own, so after unmount (or identity/resource change) the component's exact `<audio>` element could continue playing with no owner left to stop it — the component ref is already gone, so no later path could reach it.

**Repair (F2 only, local to the TTS control):** the cleanup now calls `owned.pause()` on the exact captured element immediately before `globalAudioPlaybackManager.stop(playbackId)`. Cleanup already runs on unmount, on message-identity change (via `playbackId`) and on content-URL replacement, so all three paths physically stop. The media-error path additionally pauses before releasing. No change to `audioPlaybackManager` or any P1C file was needed: the manager kept its contract, exact-owner release stayed idempotent, and active mutual exclusion (claim → previous owner's pause callback) is untouched.

**Counter-verification:** construction tests now assert the physical stop: `releases playback ownership on unmount and physically pauses the element` (owned element's `pause` called **and** manager ownership `null`), `physically pauses the owned element when the row identity changes mid-playback`, and the media-error test asserts the resource-loss path pauses before release. Repeated pauses are accepted as idempotent (a paused element cannot be paused twice in effect); the assertion is membership, matching the probe's semantics.

**Post-repair facts:** CP2 focused 23/23; cumulative P2T construction 83/83 (17 + 43 + 23); P1C regression + CP1 contract probe 14 + 23 = 37/37 (both files unmodified); neighbours 86/86; typecheck exit 0; lint exit 0. Hashes: `MessageVoiceControl.tsx` `5562732e…`, `p2t_voice_control.test.tsx` `becd2e04…`; `useMessageVoice.ts` unchanged (`697d0b3a…`); tracked app diff fingerprint unchanged (`e78f7f50…`, still only MessageTimeline.tsx among tracked files); frozen Plan/spec and every sibling hash unchanged.

### 14. Harness determinism repair (CP2, test-only)

One construction test (`treats a media error as retryable…`) proved flaky (~1 in 5 runs): the `<audio>` listeners are attached in a passive effect while jsdom never dispatches media events on its own, so an immediately dispatched `error` could be swallowed before the flush. Fixed by awaiting a passive-effect flush (`flushEffects()`) before driving native media events; production behavior is unchanged (real browsers dispatch media events asynchronously after load starts). After the F2 revision the CP2 file ran green in every run (3 consecutive full-file runs post-F2).

### 15. Deferred / known limitations (CP2)

- `ConversationPage` exposure, integration tests (`p2t_integration.test.tsx`), D14 `ReactSheet.md` erratum, browser 320/390/1280 geometry, full suite + build: CP3, not claimed here.
- Real daemon behavior, real synthesis and real DB untouched (no daemon/paid/real-DB action authorized).
- Accepted boundaries carried from the Plan: destructive reconciliation resets a row's voice state to `idle`; no Range; no cancel; no persistent voice state.

### 16. Unresolved questions

None. Construction stopped after the F2 repair; no CP3 work started. Awaiting pane 3's independent R3 recheck of CP 2T-2.

---

---

## CP 2T-3 — Real-entry integration, regression and geometry

**Status:** construction complete; self-checked by Builder against the frozen Plan/acceptance criteria, the current diff and executed tests. Handed off for independent final acceptance. Not self-accepted.

### 17. Scope and files (CP3)

Plan §7 CP3 items 1–6. Changed in this checkpoint (previous checkpoints' files unchanged):

| File | Status | sha256 |
|---|---|---|
| `packages/app/src/features/chat/ConversationPage.tsx` | modified — `conversationId={id}` passed to `MessageTimeline` | `fc63638a…` |
| `packages/app/src/test/p2t_integration.test.tsx` | new — 5 tests, real entry through `ConversationPage` | `9c775747…` |
| `packages/app/src/features/chat/tts/tts.css` | modified — narrow-width fitting (see §21) | `5dfbe966…` (was `e9dc5e2f…`) |
| `ReactSheet.md` | modified — D14 single-sentence erratum inside §12.1 | whole-file `a80005fc…`, overlay diff still 99 insertions |
| `Plan/V4_Phase_2T_Construction_Evidence.md` | this file — CP3 sections | — |

Carried unchanged from earlier checkpoints: `types.ts`, `api.ts`, `MessageTimeline.tsx` (`da6ad449…`), `tts/types.ts`, `tts/api.ts`, `tts/useMessageVoice.ts` (`697d0b3a…`), `tts/MessageVoiceControl.tsx` (`5562732e…`), `p2t_voice_projection.test.ts`, `p2t_voice_client.test.ts`, `p2t_voice_control.test.tsx` (`becd2e04…`).

Baselines re-verified at CP3 close: desktop HEAD `8452260`, backend HEAD `6fd26b4a` (both unchanged since CP1); frozen `V4_Phase_2T_Message_TTS_Detailed_Plan.md` `1d9536e8…` and `V4_Phase_2T_Message_TTS_acceptance_spec.md` `fe853e88…` byte-identical to the CP1 record; every pre-existing dirty sibling (`DevelopLog/DebugLog.md`, `Plan/Update_log.md`, `Plan/V4_Master_Implementation_Roadmap.md`, `packages/chat-core/src/main.jsx`, `Plan/spec/2026-09-12-message-tts-render-contract-handoff.md`) untouched; tracked `packages/app` diff fingerprint `e78f7f50…` → `7623d8c8…` (delta = ConversationPage.tsx only). No commit, no stage, no acceptance-artifact edit.

### 18. T9 — route identity and reconciliation (page-level)

`src/test/p2t_integration.test.tsx`:

- `cannot write or play route A's late terminal response into route B` — conversation 31's voice row starts generating with a pending GET; the test then navigates to `/chat/32` through a router link while A's request is still open, and only afterwards resolves A's GET with a valid `playable` payload. Decisive assertions: B renders only its own lazy entry (`朗读此条消息`) and **no** playable control; `document.querySelectorAll('audio')` is 0; the manager never takes playback ownership (`ownership.filter(id => id !== null)` is empty); zero TTS requests were issued for B's own message id; A's GET count does not grow after departure (no post-unmount polling).
- `keeps the same row voice state across a non-destructive canonical replacement` — the real ordinary-send path (SSE `content` + `done`, then the runtime's own `fetchFreshWindow`/`applyFreshWindow` with `destructive=false`) replaces the canonical window. Decisive assertions: the previously playable row still shows `播放朗读` (its local state survived the replacement, no reset to idle), exactly one POST was ever issued for that row, and its media element is still mounted. Destructive reconstruction resetting to `idle` remains the explicitly accepted behaviour and is not re-tested here.

### 19. T10 — isolation, recovery and chat operability (page-level)

- `treats cached voice lazily and accepts exactly one POST on click` — `cached=true` produces zero requests before the click (no auto-request/auto-play), one POST on click, immediate playable UI, and still one POST after 40 ms (no second POST).
- `keeps a media failure retryable, recovers on an explicit POST, and never touches list, scroll or runtime` — a real `error` event on the mounted media element flips the control to `重试生成语音` with the `音频加载失败` copy (never the endpoint-404 `unavailable` state); a second explicit POST recovers playback (`posts === 2`). Isolation assertions: the canonical message-GET count is unchanged (no list refetch), the timeline scroller keeps `scrollTop = 40` (no programmatic scroll), and the article count is unchanged (no injected assistant rows).
- `turns an offline synthesis failure into a local retryable entry and leaves chat operable` — a 503 maps to `runtime_offline` → visible `语音服务未就绪` retryable entry; the composer still accepts input, the message list and the message-GET count are unchanged, and no runtime notice (`重试同步` / `运行状态未知`) appears.

### 20. T12 — full pipeline

| Gate | Command | Result |
|---|---|---|
| Full exo-app suite (construction + independent + existing acceptance) | `NODE_OPTIONS=--no-experimental-webstorage pnpm --filter exo-app test:run` | **72 files / 857 tests passed, 0 failed** |
| P2T stack re-run (4 construction files + both acceptance probes) | same runner, explicit file list | **6 files / 116 tests passed** |
| Typecheck | `pnpm --filter exo-app typecheck` | exit 0 |
| Lint | `pnpm --filter exo-app lint` | exit 0 |
| Build | `pnpm --filter exo-app build` | exit 0 |

No test was skipped, xfailed or weakened, and no existing assertion was modified in this checkpoint (only additive files plus the two wiring/CSS edits above).

### 21. T11 — real-browser geometry evidence (Builder side)

Environment: production build served from `packages/app/dist` behind a local mocked HTTP fixture (`/app/chat/7`, three voice rows: entry / playable / generating), real headless Chrome (`--headless=new`) driven over CDP with `Emulation.setDeviceMetricsOverride` at 320 / 390 / 1280 × 720. Harness: `D:/tmp/p2t_geometry_probe.mjs` (`sha256 72f6f47e3d913b36…` — outside the repository because Plan §8 lists no Builder probe path); raw run log, `measurements.json` and screenshots `p2t-geometry-{320,390,1280}.png` in `D:/tmp/p2t-geometry/`. This is Builder-side recorded evidence only — the independent measurement remains Acceptance-owned.

Measured state per width (all three controls mounted in one viewport; real pointer input, no synthetic events):

| Width | `documentElement.scrollWidth` / viewport | scroller scroll/client | control widths (entry / playing / generating) | violations |
|---|---|---|---|---|
| 320 | 320 / 320 | 320 / 320 | 20 / 48 / 20 | 0 |
| 390 | 390 / 390 | 390 / 390 | 20 / 48 / 20 | 0 |
| 1280 | 1280 / 1280 | 1064 / 1064 | 50 / 120 / 61 | 0 |

Executed at every width: `scrollWidth <= clientWidth` for the document, the `.app-scroll` container, every `.app-msg-head` and every `.app-voice-control`; every control inside the viewport; every control hit-test reachable (`elementFromPoint` returns the button or a descendant) and clicked through real CDP mouse input; the seek slider hit-test reachable with a real `aria-valuetext`; a real pointer seek that moved the actual media element (`currentTime > 0`); every control retaining its `aria-label`.

**A real defect was found and fixed here, not papered over.** The first measured run (before any CSS change) showed, with the control present: row-header overflow at 320px by 11px, and the playable control overflowing its own box by 8px at 390px and 5–8px at 320px. The same probe with `voice.available = false` (no control rendered) measured **0 violations at all three widths**, proving both findings were introduced by this slice rather than pre-existing. Cause: the row header already spends its width on role + time + model + the three existing action buttons, and a fourth action whose compact player carried a non-wrapping time readout could not shrink.

Fix, inside the slice's own `tts.css` only (no shared `.app-msg-head` / `.app-msg-actions` rule touched — that would be outside this Plan's file list): below 420px the control keeps only what carries meaning without layout room — the icon (unchanged `aria-label`/`title`), the seek slider (unchanged `aria-valuetext`, still reporting real media timing), and `min-width: min-content` so it can never draw outside its own box while the header's flexible model tag absorbs the remaining width. The full form is untouched at ≥421px (1280px still shows the visible label and `m:ss / m:ss`). Re-measured after the fix: the table above, 0 violations at all three widths.

**Amendment (R5/R6):** the responsive rule described below was found to hide the retryable reason text at touch widths (P2T-F4) and was replaced in §25; the seek sentence above was produced with a harness that fabricated Range support and is invalid — see the correction in §25. The geometry fitting decisions otherwise stand.

Known limitation recorded for the final verdict: the narrow form is a real visual trade-off at ≤420px — the visible word “朗读” and the visible time readout are not shown there (both remain available to assistive technology, and accessible names, ARIA values and seek behaviour are unchanged). Keeping the visible labels at 320px instead would require a wrap/space change in the shared header CSS, which is outside this Builder's permitted file scope and would need explicit authorization.

### 22. D14 — ReactSheet erratum

`ReactSheet.md` §12.1, one sentence only: `GET /api/agents/conversations/<cid>/messages/` → canonical `GET /api/agents/chat/<id>/`. Applied as an overlay edit inside the pre-existing uncommitted B5 block: the file's diff against HEAD is still exactly the same 99 inserted lines (no line of the sibling modification was reverted, rewritten or reordered), and the backend repository copy was not touched. The rest of §12 (POST/GET route descriptions, content URL) is unchanged.

### 23. Deferred / known limitations (CP3)

- `Plan/evidence/p2t-acceptance/**` and `src/acceptance/**` remain Acceptance-owned; nothing there was created or written from this pane.
- Accepted B5 boundaries carried over: a daemon-pending start is truthful `runtime_offline`, destructive reconciliation resets a row's voice state to `idle`, no Range/cancel/persistent voice state.
- Real daemon behaviour, real synthesis and the real database were not exercised (not authorized); the browser run uses a mocked fixture transport.
- Geometry evidence was captured against the production build; dev-server behaviour is not claimed.

### 24. Unresolved questions

None. Construction stopped after CP3. Awaiting pane 3's independent final acceptance of T1–T12.

### 25. CP3 focused repair (R5 F4 + ReactSheet Range sync) — released scope R6/R7

**Authority:** R5 FAIL (P2T-F3 spec conflict adjudicated by Alicia as Route A — backend Range; backend Route A independently PASS), then the released CP3 focused repair: (1) F4 visible bounded failure reason at 320/390 with no overflow and hit-test reachability, idle/generating/playable may stay icon-compact, `directed` stays visual-only; (2) Desktop `ReactSheet.md` §12.3 synchronized to the accepted Range contract. No shared shell CSS, no P1C file, no acceptance artifact, no backend, no dependency, no commit/push.

**Files touched in the repair**

| File | Status | sha256 |
|---|---|---|
| `packages/app/src/features/chat/tts/MessageVoiceControl.tsx` | retryable state carries `app-voice-btn--failure` (composed with `--directed`) | `4b29a36e…` (was `5562732e…`) |
| `packages/app/src/features/chat/tts/tts.css` | narrow-width `--failure` rule: 10px, wrapping, readable floor, max 104px | `b0e07dfd…` (was `5dfbe966…`) |
| `packages/app/src/test/p2t_voice_control.test.tsx` | +2 assertions on the failure state, +1 `directed`-fails test | `3efb6c59…` (was `becd2e04…`) |
| `ReactSheet.md` | §12.3 rewritten to the accepted contract; §12.1 D14 correction preserved | `1fbe531a…` (was `a80005fc…`) |
| `Plan/V4_Phase_2T_Construction_Evidence.md` | this section | — |

Untouched in the repair: `ConversationPage.tsx` `fc63638a…`, `p2t_integration.test.tsx` `9c775747…`, `MessageTimeline.tsx`, `types.ts`, `api.ts`, `tts/types.ts`, `tts/api.ts`, `tts/useMessageVoice.ts`, `p2t_voice_projection.test.ts`, `p2t_voice_client.test.ts`. Frozen Plan `1d9536e8…` / spec `fe853e88…` and desktop HEAD `8452260` unchanged; tracked `packages/app` diff fingerprint still `7623d8c8…`.

**F4 — bounded failure reason rendered at touch widths**

Mechanism: the retryable state now renders a dedicated state modifier (`app-voice-btn--failure`, composed with `--directed` when the row is directed) instead of relying on typography zeroing. The ≤420px rule keeps that one button's copy at 10px with wrapping, a 56px readable floor and a 104px ceiling, so the header's flexible model tag absorbs width instead of the truth. Idle/generating/playable keep the icon-compact form; `directed` remains a pure visual class in every state (asserted).

Measured in real Chrome (accepted 206 transport, failure row = 503 `runtime_offline`):

| Width | reason copy | computed font-size | text box | button | clipped | reachable | violations |
|---|---|---|---|---|---|---|---|
| 320 | `语音服务未就绪` | 10px | 40×27 (two lines) | 69×29 | no | yes | 0 |
| 390 | `语音服务未就绪` | 10px | 70×14 | 95×17 | no | yes | 0 |
| 1280 | `语音服务未就绪` | 11px | 77×15 | 105×21 | no | yes | 0 |

All four controls (idle / playing / generating / retryable) are present in one viewport at every width, every control is inside the viewport and hit-test reachable via `elementFromPoint` + real CDP input, and document/`.app-scroll`/every `.app-msg-head`/every `.app-voice-control` report `scrollWidth <= clientWidth` with 0 violations.

**ReactSheet §12.3 — synchronized to the accepted backend contract**

Text now states: ordinary or malformed/multi-range request → `200` (`FileResponse`) with `Accept-Ranges: bytes`; valid satisfiable single range (`start-end` / `start-` / `-suffix`) → `206` with exact `Content-Range: bytes <start>-<end>/<size>` and `Content-Length`, `end` clamped to `size-1`, `last < first` treated as malformed → full `200`; unsatisfiable (`start >= size`, zero-length suffix, empty artifact) → `416` with `Content-Range: bytes */<size>` and no audio bytes; unchanged `Content-Disposition` / `Cache-Control: private, no-cache, max-age=0`; render MIME from the artifact with `audio/wav` fallback; identity-missing → `404` `error: not_found`, invalid artifact → `404` plus `code: audio_artifact_missing`. Verified line-by-line against `agents/views.py` (`MessageTTSContentView`, `_parse_single_byte_range`) before writing. R6/R7 supersede the Plan's old no-Range statement for this endpoint; the frozen Plan file itself was not edited. The frontend-only D14 correction in §12.1 is preserved; the file's diff against HEAD grew from 99 to 102 inserted lines (all inside the pre-existing B5 block, zero deletions).

**Correction of the invalidated seek evidence (R5 F3)**

The CP3-era statement that the browser probe proved "a real pointer seek that moved the actual media element" is **invalid and superseded**: that harness had fabricated `206` / `Accept-Ranges: bytes` / `Content-Range` for an endpoint that did not implement them at the time, so it measured a contract the product did not have. The rebuilt harness now mirrors the *accepted* backend parsing faithfully (200 + `Accept-Ranges`, single-range 206 with exact headers, 416 for unsatisfiable, full 200 for malformed/multi-range) and never invents capability. Under it, at all three widths the media becomes seekable and a real pointer seek lands at ~14.5–15.0 s of the 30 s artifact (`seeked` column in `D:/tmp/p2t-geometry/measurements.json`).

| Probe facts | Value |
|---|---|
| Harness | `D:/tmp/p2t_geometry_probe.mjs`, sha256 `b1328c3aa2b7a8b0…` |
| Outputs | `D:/tmp/p2t-geometry/run.log`, `measurements.json`; screenshots `p2t-geometry-320.png` `e79727b7…`, `p2t-geometry-390.png` `be85ac68…`, `p2t-geometry-1280.png` `98f9fd2d…` |

**Pipeline after the repair**

| Gate | Command | Result |
|---|---|---|
| Focused P2T stack (4 construction files + 2 acceptance probes) | `NODE_OPTIONS=--no-experimental-webstorage pnpm --filter exo-app exec vitest run …` | **6 files / 117 tests passed** |
| Full exo-app suite | `NODE_OPTIONS=--no-experimental-webstorage pnpm --filter exo-app test:run` | **73 files / 860 tests passed, 0 failed** |
| Typecheck | `pnpm --filter exo-app typecheck` | exit 0 |
| Build | `pnpm --filter exo-app build` | exit 0 |
| Builder Chrome probe | `node D:/tmp/p2t_geometry_probe.mjs` | exit 0, 0 violations at 320/390/1280 |
| Lint | `pnpm --filter exo-app lint` | **exit 1 — 9 errors, all inside the Acceptance-owned, staged `packages/app/src/acceptance/p2t_browser_acceptance.mjs`** (`no-undef` for Node globals `Buffer`/`fetch`/`WebSocket`/`console`/`process` plus `no-empty`). Not editable from this pane (Acceptance artifact). Every file this repair touched is eslint-clean: `pnpm --filter exo-app exec eslint <those files>` → exit 0. Reported for the final verdict; the repository lint gate cannot be green while that file is inside `src/`. |

**Known limitations**

- The 320px reason wraps to two lines (button 69×29); the check is "visible, laid out, unclipped, reachable, non-overflowing", not a fixed line count.
- Adjacent narrow-width debt recorded by Acceptance as P2 (≈20×16px icon buttons, two-line branch label) was not touched, by instruction.
- Real daemon/synthesis/DB remain unexercised; the probe transport is mocked but contract-faithful.

### 26. R8 documentation-only repair (F5) — §12.3 header semantics

**Authority:** R8 = CP3 runtime/browser PASS with a documentation-only FAIL (F5). Released scope: `ReactSheet.md` §12.3 + this evidence file only. No code, test, CSS, frozen, Acceptance or backend asset touched; no test/build rerun was required or performed (candidate assets are byte-identical to the R8-verified build).

**Exact change (line-level, §12.3 only — 2 lines became 3; zero deletions elsewhere)**

Before:

```text
- 语法有效但不可满足（`start >= size`、suffix 长度为 0、资源为空）：`416` + `Content-Range: bytes */<size>`，不打开也不回传任何音频字节；
- 响应头包含 `Content-Disposition: inline; filename="msg_<id>.wav"` 与 `Cache-Control: private, no-cache, max-age=0`（非版本化稳定 URL 杜绝长缓存，确保消息编辑或重新生成后客户端立即获得最新音频）；
```

After:

```text
- 语法有效但不可满足（`start >= size`、suffix 长度为 0、资源为空）：`416` + `Content-Range: bytes */<size>`，响应体为有界 JSON 错误（`error: range_not_satisfiable`）；该分支不打开分发流、不回传任何音频字节（此前的有效性门禁可能已校验工件元信息，但不进入字节分发）；
- `Accept-Ranges: bytes` 与 `Cache-Control: private, no-cache, max-age=0` 适用于全部媒体响应（`200` / `206` / `416`）；其中 `Cache-Control` 的目的仍是非版本化稳定 URL 杜绝长缓存，确保消息编辑或重新生成后客户端立即获得最新音频；
- `Content-Disposition: inline; filename="msg_<id>.wav"` 仅适用于 `200` 与 `206`（`416` 不带该头）；
```

Findings closed by this edit: (a) 416 now documents the bounded JSON error body `error: range_not_satisfiable` alongside `Content-Range`; (b) `Accept-Ranges` + `Cache-Control` are stated for `200`/`206`/`416`; (c) `Content-Disposition` is stated for `200`/`206` only; (d) 416 is stated not to open the delivery stream or return audio bytes, with the note that the validity gate may already have validated artifact metadata.

**Hashes and counters**

| Item | Value |
|---|---|
| `ReactSheet.md` | `b6735d32…` (was `1fbe531a…`); diff vs HEAD = **103 insertions, 0 deletions**, entirely inside the pre-existing B5 block |
| Unchanged code assets | `MessageVoiceControl.tsx` `4b29a36e…`, `tts.css` `b0e07dfd…`, `p2t_voice_control.test.tsx` `3efb6c59…`, `p2t_integration.test.tsx` `9c775747…`, `ConversationPage.tsx` `fc63638a…`, `MessageTimeline.tsx` `da6ad449…` |
| Tracked `packages/app` diff fingerprint | `7623d8c8…` (unchanged) |
| Frozen Plan / spec | `1d9536e8…` / `fe853e88…` (unchanged); desktop HEAD `8452260` |
| §12.1 D14 line | intact (`GET /api/agents/chat/<id>/`) |

No commit, no push, no stage from this pane; nothing under `src/acceptance/**`, `Plan/evidence/**`, `Plan/V4_Phase_2T_Message_TTS_acceptance_report.md` or the backend repository was read-modified or written.
