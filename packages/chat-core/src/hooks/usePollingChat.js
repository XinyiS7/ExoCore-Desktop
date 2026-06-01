import { useRef, useCallback } from 'react';
import { baseUrl, getCsrfToken } from '../utils/api';

export const usePollingChat = () => {
  const isPollingRef = useRef(false);
  const pollingTimerRef = useRef(null);

  const sendMessageAsync = useCallback((payload, sessionId, signal, onDelta) => {
    return new Promise(async (resolve, reject) => {
      isPollingRef.current = true;
      let currentCursor = 0;
      let messageId = null;

      const cleanup = () => {
        isPollingRef.current = false;
        if (pollingTimerRef.current) clearTimeout(pollingTimerRef.current);
      };

      const onAbort = () => {
        cleanup();
        reject(new DOMException('Aborted', 'AbortError'));
      };
      if (signal) {
        signal.addEventListener('abort', onAbort);
      }

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
        messageId = data.message_id;

        if (!messageId) throw new Error('No message_id returned');

        const poll = async () => {
          if (!isPollingRef.current) return;
          try {
            const pollRes = await fetch(`${baseUrl}/api/agents/chat/${sessionId}/status/?message_id=${messageId}&cursor=${currentCursor}`, {
              headers: { 'X-CSRFToken': getCsrfToken() },
              credentials: 'include',
              signal
            });
            
            if (!pollRes.ok) throw new Error(`HTTP ${pollRes.status}`);
            const pollData = await pollRes.json();
            
            // Handle multiple events
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

              // Increment cursor correctly
              currentCursor = pollData.cursor !== undefined ? pollData.cursor : currentCursor + totalDeltaLen;
            }

            if (pollData.status === 'done' || pollData.status === 'error') {
              cleanup();
              if (signal) signal.removeEventListener('abort', onAbort);
              
              if (pollData.status === 'error') {
                 reject(new Error(pollData.error_message || 'Server error'));
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
             cleanup();
             if (signal) signal.removeEventListener('abort', onAbort);
             reject(err);
          }
        };

        pollingTimerRef.current = setTimeout(poll, 500);
      } catch (err) {
        cleanup();
        if (signal) signal.removeEventListener('abort', onAbort);
        reject(err);
      }
    });
  }, []);

  const abortPolling = useCallback(() => {
    isPollingRef.current = false;
    if (pollingTimerRef.current) clearTimeout(pollingTimerRef.current);
  }, []);

  return { sendMessageAsync, abortPolling };
};
