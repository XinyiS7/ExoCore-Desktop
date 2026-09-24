# AGY Runtime Tool Trace — Desktop Handoff

> **Status:** READY AFTER ExoCore E-C1 ACCEPTANCE
> **Authoritative cross-repository Plan:** `../../../ExoCore/Plan/AGY_Runtime_Tool_Call_Trace_Construction_Plan.md`
> **Desktop checkpoint:** D-C1 only
> **Scope:** V4 `packages/app`; no backend/Runtime edits from this repository

## Required outcome

Consume the existing `assistant_trace` DTO without changing its shape. After a stopped managed-runtime turn:

- canonical reconciliation and lease/operation release remain authoritative;
- if the runtime assistant has a trace, retain only a non-durable trace + stopped-status projection for the current page;
- clear partial content, thinking and optimistic user state;
- if there is no trace, do not retain an empty assistant row;
- refresh/route re-entry does not restore the projection;
- the next existing predispatch streaming row replaces it naturally.

`MessageTimeline.runtimeTraceProjection()` already converts a non-streaming `started` tool to `incomplete`. Preserve that seam and add regression coverage; do not implement a second conversion path.

## Intentional amendment and preserved boundaries

This checkpoint intentionally amends only the stopped-with-trace terminal cleanup portion of:

- `Plan/spec/2026-09-20-v4-client-turn-correlation-handoff.md`;
- `Plan/V4_P2D_Closure_Issues_1_2_acceptance_report.md`.

Preserve:

- canonical apply → lease clear → operation release order;
- A+ exact optimistic-user handoff;
- stop owner, no-duplicate-POST and R5 lease algebra;
- current predispatch overlay creation and rejection cleanup;
- completed canonical assistant handoff and duplicate suppression;
- existing Assistant Run Trace DTO, renderer, default-collapsed behavior and safety.

This work does **not** retain stopped partial content/thinking and does not close the separate backend/legacy-UI scope in `../../../ExoCore/Plan/Subscription_Runtime_F4_UI_Stop_Partial_Pending.md`.

## Validation targets

- stopped with trace: lock released, trace-only row visible, active tools render incomplete;
- stopped without trace: no empty row;
- no partial content/thinking or optimistic user survives terminal release;
- refresh/route entry clears the non-durable projection;
- next predispatch replaces it; rejected predispatch follows existing cleanup and does not restore it;
- completed SSE/polling canonical handoff remains unchanged;
- R5 invariants and static/build gates remain green under the repository's frozen Node environment.

Exact commands and cross-repository acceptance gates are frozen in the authoritative Plan §7.
