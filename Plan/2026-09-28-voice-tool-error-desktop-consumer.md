# Memo: CP-C minimal Desktop consumer — `send_voice_msg` failure surface

- **Date**: 2026-09-28
- **Authoritative source**: `../ExoCore/Plan/send_voice_msg_Backend_Plan.md` REVISE-7
  §5.3 (live SSE + durable projection), §8 `ExoCore-Desktop — CP-C minimal failure surface`.
- **Plan-home note**: the authoritative cross-repo construction trace remains
  `../ExoCore/Plan/send_voice_msg_Backend_Plan.md`; this memo records only the bounded
  Desktop implementation slice in its owning repository.

## Goal

Consume the frozen CP-C failure contract on Desktop so a failed `send_voice_msg`
synthesis is shown honestly in the assistant row without faking any audio artifact.

## Intended behavior

1. **Live SSE**: a new additive `voice_tool_error` event carries the bounded payload
   `{position, error_code}`. It is normalized fail-closed (exact object, non-negative
   integer `position`, bounded snake_case `error_code`); anything else becomes a
   nonfatal `malformed` protocol warning and never answer text.
2. **Runtime turn**: the event accumulates on the current runtime assistant overlay,
   deduped by `position` (first outcome wins, rendered in position order). The overlay
   shows the safe notice instead of the waiting spinner when the turn has no content yet.
3. **Durable read model**: an assistant Message may carry
   `voice_tool_errors: [{position, error_code}]`. The history adapter normalizes it
   fail-closed into camel `voiceToolErrors` (per-entry validation, position dedupe,
   ordered), always `[]` for non-assistant/malformed input.
4. **Rendering**: each assistant row (canonical or live overlay) renders
   `send_voice_msg 调用失败` plus the bounded code. No tool `content`/`style`, no
   provider prose, no audio element, no attachment placeholder. A row with only voice
   errors does not fall back to `（空消息）`.
5. **Dedupe unit**: the owning row is the turn — live events dedupe on the runtime turn,
   durable entries dedupe per Message; the existing reconcile lifecycle drops the live
   overlay once the completed Message is drawn, so the code is not displayed twice.
6. **Stopped retention**: when D-C1 retains a stopped trace-only overlay, the live
   `voiceToolErrors` are carried onto the retained row (the code would otherwise be
   lost with the noncanonical content).
7. **Polling parity**: `normalizePollingEvent` accepts the same event object
   (`{event_type:"voice_tool_error", delta:{...}}`) through the shared vocabulary; the
   frozen plan only promises live SSE, so this is client-side tolerance, not a new
   backend promise.

## Scope

- Desktop only: `packages/app` consumer + focused tests + Desktop `ReactSheet.md`
  contract sync: §1.3.4 (`voice_tool_error` SSE), §12.1 (durable `voice_tool_errors[]`
  and transcript read contract), and §8.3 (voice-only arrival preview copy).
- Explicitly excluded from the Desktop slice: audio player / unified attachment
  migration / transcript-fetch timing / CP-E playback behavior; backend execution,
  ExoCore-Runtime, TTS, and frozen P2T/P1D acceptance assets.

## Validation

- Focused vitest file (`src/test/cp_c_voice_tool_error.test.tsx`) 24/24: wire guard +
  polling parity, runtime accumulation and dedupe, durable projection, canonical/live
  rendering (no `<audio>`, no `（空消息）`, no content/style leak), one real
  `useChatRuntime` SSE path, one polling path, and the D-C1 stopped retention path.
- `pnpm --filter exo-app typecheck`, scoped eslint, `pnpm build` all green.
- Full app suite with the change carries the identical 195 pre-existing failures as the
  stashed HEAD baseline (Node ≥25 `window.localStorage` shadowing; failure-name sets are
  byte-identical in both directions), plus the 24 new passing tests.

