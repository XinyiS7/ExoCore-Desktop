# SSE Stop Event — Backend Changes for Abort Fix

**Date**: 2026-07-06
**Source**: ABORT_FIX_PLAN.md (frontend-side fix in progress)
**Target repo**: ExoCore/ (Django backend)
**Depends on**: Frontend changes in ChatArea.jsx + usePollingChat.js (done)

---

## Context

The frontend "Stop" button in chat was not actually stopping backend LLM generation. The root cause was that the frontend never called `POST /api/agents/chat/<id>/stop/`. That's now fixed for async mode.

However, **SSE mode** still cannot be stopped because:
1. `views.py:170` sets `stop_event = None` for SSE mode
2. `ChatStreamStopView` requires `message_id` (which SSE mode doesn't have)

This spec describes the backend changes needed to make SSE stop work.

---

## Changes Required

### A. Create `stop_event` for SSE mode

**File**: `ExoCore/agents/views.py`, around line 170

**Current**:
```python
stop_event = threading.Event() if mode == 'async' else None
```

**Change to**:
```python
stop_event = threading.Event()  # Both SSE and async modes
```

### B. Register SSE `stop_event` in a session-level registry

The SSE path returns a `StreamingHttpResponse` immediately (line 193-200), so the `stop_event` must be stored somewhere the `/stop/` endpoint can find it later.

Create a simple session-level registry (could live in `streaming_buffer.py` alongside `StreamingBufferManager` or in a new module):

```python
# In agents/streaming_buffer.py (or new module agents/sse_registry.py)

import threading

class SSESessionRegistry:
    """Maps session_id -> stop_event for active SSE streams."""
    
    _instance = None
    _lock = threading.Lock()
    
    def __init__(self):
        self._sessions = {}  # session_id -> threading.Event
    
    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance
    
    def register(self, session_id: str, stop_event: threading.Event):
        self._sessions[session_id] = stop_event
    
    def request_stop(self, session_id: str) -> bool:
        """Set the stop event for a session. Returns True if session was found."""
        evt = self._sessions.pop(session_id, None)
        if evt is None:
            return False
        evt.set()
        return True
    
    def unregister(self, session_id: str):
        self._sessions.pop(session_id, None)
```

In `views.py`, register the stop_event before returning the SSE response:

```python
if mode != 'async':
    from agents.sse_registry import SSESessionRegistry
    SSESessionRegistry.get_instance().register(str(conversation.id), stop_event)
    
    resp = StreamingHttpResponse(
        _sse_error_guard(response_stream),
        content_type='text/event-stream',
    )
    resp['X-Accel-Buffering'] = 'no'
    resp['Cache-Control'] = 'no-cache'
    return resp
```

Also clean up the registry when the SSE stream completes (in `_sse_error_guard` or the generator's finally block):

```python
# In the generator wrapper that produces SSE events
try:
    yield from response_stream
finally:
    SSESessionRegistry.get_instance().unregister(str(conversation.id))
```

### C. `/stop/` endpoint support for session-level stop

**File**: `ExoCore/agents/views.py`, `ChatStreamStopView` (around line 270)

**Current**: Requires `message_id`, only works for async.

**Change to**: Fall back to session-level stop when no `message_id`:

```python
def post(self, request, session_id):
    from agents.streaming_buffer import StreamingBufferManager
    from agents.sse_registry import SSESessionRegistry

    token = request.GET.get('message_id', '')
    
    if token:
        # Async mode: stop via StreamingBufferManager
        buf_mgr = StreamingBufferManager.get_instance()
        ok = buf_mgr.request_stop(token)
        if ok:
            return Response({"status": "stop_requested"})
    
    # SSE mode (or fallback): stop via session registry
    sse_registry = SSESessionRegistry.get_instance()
    ok = sse_registry.request_stop(session_id)
    if ok:
        return Response({"status": "stop_requested"})
    
    return Response(
        {"error": "no active generation found for this session"},
        status=404,
    )
```

---

## Verification

1. Start an SSE chat session (default mode, not async)
2. Click Stop in the frontend — the frontend now calls `POST /api/agents/chat/<id>/stop/` without `message_id`
3. Backend should find the session in `SSESessionRegistry`, set the `stop_event`
4. The LLM thread checks `stop_event.is_set()` between chunks and stops cooperatively
5. Partial content is persisted as an assistant message

---

## Invariant Parts

- `LLMGateway.stream_chat()` — unchanged
- `_is_stopped()` check logic — unchanged
- `StreamingBufferManager` — unchanged
- `ChatStreamStopView` with `message_id` for async mode — unchanged
- API response format — unchanged
- nginx config — unchanged
