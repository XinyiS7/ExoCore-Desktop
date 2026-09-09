# V4 P1D Assistant Run Trace — Backend Handoff

> Owner repository: `ExoCore` (Django). This Desktop repository is read-only with respect to backend production code.
>
> Authority: frozen `Plan/V4_Phase_1D_Detailed_Plan.md` (SHA-256 `a78ea9b754d385f212eb2eba01698297204a18928d5d2172771018b28401e43f`), especially D1, §6.5, Task 6 and §8.4.
>
> Desktop planning baseline: `63ff0b61d7587f0f9b4b3e5bbe7109c8ea7ff797`.
> Backend fact baseline: `bfd775292f5f93c82c24215a2f63fb36b54c426e`.

## 1. Purpose and hard gate

Current transport cannot truthfully render ordered Assistant Thinking and Tool activity:

- realtime Thinking is emitted only as `event: thinking` text chunks;
- tool progress is flattened into human `event: status` strings;
- telemetry exposes only a tool count;
- `Message.tool_calls` stores raw `{name,args,result}` records but `MessageSerializer` omits them;
- existing rows cannot reconstruct `Thinking -> ToolCall -> Thinking` order.

The backend must provide an **additive, sanitized, bounded projection**. Do not expose raw `Message.tool_calls` and do not make the frontend detect secrets or redact arbitrary raw results.

C1D/Task 6 remains gated until this contract has independent backend acceptance and both backend and Desktop `ReactSheet.md` copies describe the accepted wire shape.

## 2. Required wire contract

Names below are the frontend-required canonical names. If implementation feasibility requires a different additive event or field name, stop and agree the replacement with the P1D owner before coding the Desktop consumer.

### 2.1 Realtime event

Keep all existing SSE/async events unchanged. Add:

```text
event: assistant_trace
data: <AssistantTraceEvent JSON object>
```

Async polling carries the identical object as:

```json
{"event_type":"assistant_trace","delta":{/* same object */}}
```

`AssistantTraceEvent` is one of:

```ts
type AssistantTraceEvent =
  | {
      version: 1;
      run_id: string;
      sequence: number;
      item_id: string;
      kind: "thinking";
      lifecycle: "delta";
      text_delta: string;
    }
  | {
      version: 1;
      run_id: string;
      sequence: number;
      item_id: string;
      kind: "tool";
      call_id: string;
      lifecycle: "started" | "succeeded" | "failed";
      tool_name: string;
      argument_preview?: string | null;
      result_summary?: string | null;
      error_summary?: string | null;
      duration_ms?: number | null;
    };
```

Rules:

1. `run_id`, `item_id` and `call_id` are opaque non-empty strings. `call_id` is stable across one tool call's lifecycle updates. A Thinking segment uses one stable `item_id` for its consecutive deltas; Thinking resumed after a ToolCall uses a new `item_id`.
2. `sequence` is a nonnegative integer, strictly increasing for every emitted trace event in one run. It defines server order for SSE and async. The same underlying run must produce the same ordered event sequence in both transports.
3. A ToolCall emits `started` before execution and at most one terminal update (`succeeded` or `failed`) with the same `item_id` and `call_id`. If execution/run ends before a terminal update, history records it as incomplete (see §2.2); the backend must not fabricate success.
4. `tool_name` is the backend-authorized declaration name. Active `memory_search` is emitted through this exact ordinary ToolCall path.
5. Existing `thinking`, `status`, `telemetry`, terminal and `cache_skipped` events remain backward compatible. `assistant_trace` is authoritative for P1D ordering. Existing `thinking` may continue for V3 compatibility but must represent the same text and must not be the only source of order.
6. Unknown future trace kinds/versions must not change the existing terminal algebra (`done XOR stopped XOR error`).

### 2.2 Historical Message projection

Add an optional read-only `assistant_run_trace` field to assistant Message history rows. User/system/developer rows return `null` or omit the field consistently; choose and document one behavior.

```ts
type AssistantRunTraceProjection =
  | {
      version: 1;
      availability: "available";
      items: Array<
        | {
            item_id: string;
            order: number;
            kind: "thinking";
            text: string;
          }
        | {
            item_id: string;
            order: number;
            kind: "tool";
            call_id: string;
            lifecycle: "started" | "succeeded" | "failed" | "incomplete";
            tool_name: string;
            argument_preview?: string | null;
            result_summary?: string | null;
            error_summary?: string | null;
            duration_ms?: number | null;
          }
      >;
    }
  | {
      version: 1;
      availability: "legacy_unavailable";
      reason: "ordering_unavailable";
    };
```

Rules:

1. `items[].order` is a unique nonnegative integer and the array is returned in ascending order.
2. Realtime terminal reconciliation/reload must reproduce the same trace item order and Tool lifecycle facts that were emitted for the run. Consecutive Thinking deltas may be compacted into one historical Thinking item without changing its position relative to Tool items.
3. A started ToolCall without a terminal update projects as `incomplete`.
4. Existing rows that lack sufficient ordering data return `legacy_unavailable`; do not infer interleaving from `reasoning_content` plus raw `tool_calls` array order.
5. `reasoning_content` remains unchanged for backward compatibility and legacy readability.
6. Empty new runs may return `available` with `items: []`; old rows whose provenance cannot be established use `legacy_unavailable`.

## 3. Safety and bounds

The projection is an allowlist, not a transformed copy of raw tool JSON.

1. Never serialize raw `Message.tool_calls`, raw args, raw results, traceback, provider payload, credentials/tokens/API keys, cookies, authorization headers, environment values, or unrestricted local absolute paths.
2. `argument_preview`, `result_summary` and `error_summary` are backend-produced plain text summaries from tool-specific safe allowlists. Unsupported tools/fields receive `null`/omission, not generic raw-string fallback.
3. Normalize control characters and ensure JSON-safe UTF-8. The frontend renders these values as text/under existing Markdown safety; no HTML is trusted.
4. Freeze explicit backend constants and test them. Required maxima:
   - `run_id`, `item_id`, `call_id`: 128 characters each;
   - `tool_name`: 128 characters;
   - `argument_preview`: 500 characters;
   - `result_summary`: 1000 characters;
   - `error_summary`: 500 characters;
   - one historical projection: 200 items maximum and 64 KiB maximum serialized JSON.
5. When bounds are exceeded, truncate safe preview text with an explicit marker or omit excess items with an explicit safe truncation indicator in the projection. Do not emit malformed partial JSON and do not leak the removed content.
6. Persistence may use a new field/model or another backend-owned structure. It must not weaken existing raw internal tool records or expose them through unrelated serializers/admin surfaces.

## 4. Coverage boundary

The additive trace must cover every ordinary chat execution path that can currently emit Thinking or execute a ToolCall, including g045 and standard service paths used by `POST /api/agents/chat/<id>/` in SSE and async modes. Bridge-only/non-chat execution is outside P1D unless it is reachable through that canonical endpoint.

No P1D backend change may add automatic recall receipts, Recall Lab data, Project CRUD, temperature/MCP controls, or frontend behavior.

## 5. Compatibility requirements

1. Existing V3 clients that ignore `assistant_trace` continue to receive current `thinking`, `status`, `content`, `telemetry`, `cache_skipped` and terminal events.
2. Existing Message fields and pagination envelopes remain unchanged except for the additive optional/read-only trace projection.
3. Async event buffering/polling preserves object payloads without stringifying them differently from existing structured events.
4. Unknown/additive trace output does not enter assistant answer `content`.
5. No migration may rewrite legacy raw rows into fabricated ordered traces.

## 6. Binary backend acceptance targets

Independent backend acceptance must provide focused deterministic evidence for all applicable rows:

- [ ] SSE and async expose identical ordered `Thinking A -> Tool started -> Tool terminal -> Thinking B` facts with strictly increasing sequence.
- [ ] Multiple tools retain stable distinct IDs; lifecycle updates target the correct call.
- [ ] succeeded, failed and started-without-terminal project honestly; stopped/error/exception paths do not fabricate completion.
- [ ] active `memory_search` is an ordinary `kind: "tool"` item.
- [ ] canonical Message reload reproduces realtime order/lifecycle after terminal persistence.
- [ ] legacy rows return `legacy_unavailable`, while `reasoning_content` remains readable.
- [ ] malformed/internal raw tool values never pass through; secrets, headers, absolute local paths, traceback and oversized raw results are absent from the wire.
- [ ] all field/item/serialized-size bounds are exercised at boundary and over-boundary values.
- [ ] g045 and standard canonical chat paths that can use tools are included.
- [ ] existing event names, terminal behavior, Message fields and V3-focused regressions remain compatible.
- [ ] both `ExoCore/ReactSheet.md` and `ExoCore-Desktop/ReactSheet.md` are updated only after the accepted implementation fixes the final wire shape.
- [ ] no live/provider call and no real-database AgentPreset mutation is required by the suite.

## 7. Required handback to Desktop

Return:

1. accepted backend commit hash;
2. final exact event and history DTO shape;
3. focused test command with numeric result and exit code;
4. sanitization/bound constants and the owning source symbols;
5. any paths that legitimately return `legacy_unavailable` or do not emit trace;
6. independent backend acceptance verdict/reference.

Desktop will normalize only this accepted allowlisted projection. Until handback arrives, it may prepare legacy Thinking/runtime plumbing but must not claim structured ToolCall or Task 6 completion.
