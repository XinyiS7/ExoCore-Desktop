/** Apply a streaming delta to a message object (mutates and returns the message). */
export const applyDeltaToMessage = (msg, text, eventType) => {
  if (eventType === 'thinking') {
    msg.reasoning_content = (msg.reasoning_content || '') + text;
    msg.status_text = null;
  } else if (eventType === 'reasoning') {
    const steps = [...(msg.reasoning_steps || [])];
    if (steps.length === 0 || steps[steps.length - 1] !== text) steps.push(text);
    msg.reasoning_steps = steps;
  } else if (eventType === 'status') {
    msg.status_text = text;
  } else if (eventType === 'anchor_created') {
    try {
      const parsed = typeof text === 'string' ? JSON.parse(text) : text;
      msg.new_anchors = [...(msg.new_anchors || []), parsed];
    } catch { /* ignore malformed anchor payload */ }
  } else if (eventType === 'telemetry' || eventType === 'cache_skipped' || eventType === 'assistant_trace') {
    // Dict-only events: handled by dedicated branches (telemetry panel / cache toast)
    // or have no V3 render target (assistant_trace) — never touch the message body.
  } else if (typeof text === 'string') {
    msg.content = (msg.content || '') + text;
    msg.status_text = null;
  }
  return msg;
};
