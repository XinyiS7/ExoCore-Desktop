import { useRef, useCallback } from 'react';
import { baseUrl, getCsrfToken } from 'exo-shared';

export const usePollingChat = () => {
  const isPollingRef = useRef(false);
  const pollingTimerRef = useRef(null);

  // ── Shared polling loop ──
  const pollLoop = useCallback((messageId, sessionId, signal, onDelta, resolve, reject) => {
    let currentCursor = 0;

    const cleanup = () => {
      isPollingRef.current = false;
      if (pollingTimerRef.current) clearTimeout(pollingTimerRef.current);
    };

    const onAbort = () => {
      localStorage.removeItem(`exo_async_${sessionId}`);
      cleanup();
      reject(new DOMException('Aborted', 'AbortError'));
    };
    if (signal) {
      signal.addEventListener('abort', onAbort);
    }

    const poll = async () => {
      if (!isPollingRef.current) return;
      try {
        const pollRes = await fetch(
          `${baseUrl}/api/agents/chat/${sessionId}/status/?message_id=${messageId}&cursor=${currentCursor}`,
          { headers: { 'X-CSRFToken': getCsrfToken() }, credentials: 'include', signal }
        );

        if (!pollRes.ok) throw new Error(`HTTP ${pollRes.status}`);
        const pollData = await pollRes.json();

        const events = pollData.events || (pollData.delta ? [{ delta: pollData.delta, event_type: pollData.event_type || 'content' }] : []);

        if (events.length > 0) {
          let totalDeltaLen = 0;
          events.forEach(ev => {
            const deltaStr = ev.delta || '';
            totalDeltaLen += deltaStr.length;
            if (deltaStr) {
              onDelta(deltaStr, ev.event_type || 'content');
            }
          });
          currentCursor = pollData.cursor !== undefined ? pollData.cursor : currentCursor + totalDeltaLen;
        }

        if (pollData.status === 'done' || pollData.status === 'error' || pollData.status === 'not_found') {
          localStorage.removeItem(`exo_async_${sessionId}`);
          cleanup();
          if (signal) signal.removeEventListener('abort', onAbort);
          if (pollData.status === 'error') {
            reject(new Error(pollData.error_message || 'Server error'));
          } else if (pollData.status === 'not_found') {
            reject(new Error('Async task not found or expired'));
          } else {
            resolve();
          }
          return;
        }

        if (isPollingRef.current) {
          pollingTimerRef.current = setTimeout(poll, 500);
        }
      } catch (err) {
        if (err.name === 'AbortError') return;
        localStorage.removeItem(`exo_async_${sessionId}`);
        cleanup();
        if (signal) signal.removeEventListener('abort', onAbort);
        reject(err);
      }
    };

    pollingTimerRef.current = setTimeout(poll, 500);
  }, []);

  // ── sendMessageAsync (POST + poll) ──
  const sendMessageAsync = useCallback((payload, sessionId, signal, onDelta) => {
    return new Promise((resolve, reject) => {
      isPollingRef.current = true;

      const handleError = (err) => {
        isPollingRef.current = false;
        if (pollingTimerRef.current) clearTimeout(pollingTimerRef.current);
        reject(err);
      };

      (async () => {
        try {
          const fetchOptions = {
            method: 'POST',
            headers: { 'X-CSRFToken': getCsrfToken() },
            credentials: 'include',
            signal
          };

          if (payload instanceof FormData) {
            fetchOptions.body = payload;
          } else {
            fetchOptions.headers['Content-Type'] = 'application/json';
            fetchOptions.body = JSON.stringify(payload);
          }

          const response = await fetch(`${baseUrl}/api/agents/chat/${sessionId}/?mode=async`, fetchOptions);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);

          const data = await response.json();
          const messageId = data.message_id;

          if (!messageId) throw new Error('No message_id returned');

          // Persist async task for re-entry recovery
          localStorage.setItem(`exo_async_${sessionId}`, JSON.stringify({
            message_id: messageId,
            timestamp: Date.now(),
          }));

          // Delegate to shared poll loop
          pollLoop(messageId, sessionId, signal, onDelta, resolve, reject);
        } catch (err) {
          handleError(err);
        }
      })();
    });
  }, [pollLoop]);

  // ── resumePolling (poll only, no POST) ──
  const resumePolling = useCallback((messageId, sessionId, signal, onDelta) => {
    return new Promise((resolve, reject) => {
      isPollingRef.current = true;
      pollLoop(messageId, sessionId, signal, onDelta, resolve, reject);
    });
  }, [pollLoop]);

  const abortPolling = useCallback(() => {
    isPollingRef.current = false;
    if (pollingTimerRef.current) clearTimeout(pollingTimerRef.current);
  }, []);

  return { sendMessageAsync, abortPolling, resumePolling };
};
