# CP-C R1 — voice error live-to-durable reconciliation

## Goal / intended behavior

Add the missing composition regression proving one live `voice_tool_error` remains visible once while canonical reconciliation replaces the runtime overlay with the durable `Message.voice_tool_errors[]` row.

## Scope

- Test-only change in `packages/app/src/test/cp_c_voice_tool_error.test.tsx` plus ReactSheet wording synchronization.
- No runtime behavior, player, transcript, CP-D, or CP-E implementation.
- Clarify that argument validation happens before attempt positioning and that artifact publication failure is a terminal generic error, not a fabricated positioned voice outcome.

## Validation

Run the CP-C focused test file, typecheck, lint, and diff checks.
