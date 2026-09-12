"""R2 sibling probes. Real views, fake producers, isolated test_ DB only.
Does NOT inherit prior test methods; shares only fixture/entry helpers.
"""
import threading
from unittest.mock import patch
from django.test import TransactionTestCase
from rest_framework.test import APIClient
from memory.models import Conversation
from agents.streaming_buffer import StreamingBufferManager
import p2_delete_backend_r1 as prior


class DeleteBackendSiblingAcceptance(TransactionTestCase):
    setUp = prior.DeleteBackendAcceptance.setUp
    tearDown = prior.DeleteBackendAcceptance.tearDown
    post = prior.DeleteBackendAcceptance.post
    delete = prior.DeleteBackendAcceptance.delete

    def open_sse(self, events):
        def producer(**kwargs):
            events.append(kwargs['stop_event'])
            def stream():
                yield 'event: content\ndata: "live"\n\n'
                yield 'event: done\ndata: {}\n\n'
            return stream()
        response = self.post(producer)
        iterator = iter(response.streaming_content)
        next(iterator)
        return response, iterator

    def test_older_started_sse_close_keeps_newer_run_stoppable(self):
        events = []
        first, first_iter = self.open_sse(events)
        second, second_iter = self.open_sse(events)
        try:
            first.close()
            self.assertEqual(self.delete().status_code, 409)
            stopped = self.client.post(f'/api/agents/chat/{self.cid}/stop/', {}, format='json')
            self.assertEqual(stopped.status_code, 200, 'older close erased newer SSE stop registration')
            self.assertTrue(events[1].is_set(), 'newer SSE run no longer receives stop')
        finally:
            first.close()
            second.close()
        self.assertEqual(self.delete().status_code, 204)

    def test_failed_service_setup_keeps_existing_sse_stoppable(self):
        events = []
        survivor, iterator = self.open_sse(events)
        try:
            def failed(**kwargs):
                raise RuntimeError('new service setup refused')
            try:
                self.post(failed)
            except RuntimeError:
                pass
            self.assertEqual(self.delete().status_code, 409)
            stopped = self.client.post(f'/api/agents/chat/{self.cid}/stop/', {}, format='json')
            self.assertEqual(stopped.status_code, 200, 'failed run erased a stop registration it never owned')
            self.assertTrue(events[0].is_set())
        finally:
            survivor.close()
        self.assertEqual(self.delete().status_code, 204)

    def test_failed_response_setup_keeps_existing_sse_stoppable(self):
        events = []
        survivor, iterator = self.open_sse(events)
        try:
            with patch('agents.views.StreamingHttpResponse', side_effect=RuntimeError('new response refused')):
                try:
                    self.post(lambda **kwargs: iter(()))
                except RuntimeError:
                    pass
            self.assertEqual(self.delete().status_code, 409)
            stopped = self.client.post(f'/api/agents/chat/{self.cid}/stop/', {}, format='json')
            self.assertEqual(stopped.status_code, 200, 'failed response replaced/erased survivor stop registration')
            self.assertTrue(events[0].is_set())
        finally:
            survivor.close()
        self.assertEqual(self.delete().status_code, 204)

    def test_consulted_buffer_safety_lookup_error_cannot_authorize_delete(self):
        manager = StreamingBufferManager.get_instance()
        with patch.object(manager, 'is_session_active', side_effect=RuntimeError('buffer safety lookup unavailable')) as lookup:
            response = self.delete()
        # If this redundant check is removed from the safety decision, the injected fault is
        # outside the production path. Do NOT force the Builder to keep a particular mechanism.
        if not lookup.called:
            self.assertEqual(response.status_code, 204)
            return
        self.assertTrue(Conversation.objects.filter(pk=self.cid).exists(),
            f'consulted safety lookup failed yet DELETE returned {response.status_code}')
        self.assertGreaterEqual(response.status_code, 400)

    def test_expired_query_token_does_not_fallback_to_live_sse(self):
        events = []
        response, iterator = self.open_sse(events)
        try:
            stopped = self.client.post(f'/api/agents/chat/{self.cid}/stop/?message_id=expired-old-token', {}, format='json')
            self.assertEqual(stopped.status_code, 404)
            self.assertFalse(events[0].is_set(), 'expired query token fell through to active SSE')
            self.assertEqual(self.delete().status_code, 409)
        finally:
            response.close()
        self.assertEqual(self.delete().status_code, 204)

    def run_async_case(self, case):
        """Run two real async worker threads; all sleeps replaced with events + joins."""
        entered = [threading.Event(), threading.Event()]
        released = [threading.Event(), threading.Event()]
        stop_events = []
        workers = []
        counter = iter(range(2))
        real_thread = threading.Thread
        def producer(**kwargs):
            index = next(counter)
            stop_events.append(kwargs['stop_event'])
            def stream():
                try:
                    entered[index].set()
                    if not released[index].wait(8):
                        raise RuntimeError('harness barrier timeout')
                    yield 'event: done\ndata: {}\n\n'
                finally:
                    pass
            return stream()
        def thread_factory(*args, **kwargs):
            thread = real_thread(*args, **kwargs)
            workers.append(thread)
            return thread
        try:
            with patch('agents.views.threading.Thread', side_effect=thread_factory):
                responses = [self.post(producer, mode='async'), self.post(producer, mode='async')]
            self.assertTrue(all(e.wait(8) for e in entered))
            case(responses, stop_events)
            self.assertEqual(self.delete().status_code, 409)
        finally:
            for e in released:
                e.set()
            for thread in workers:
                thread.join(8)
                self.assertFalse(thread.is_alive())
        self.assertEqual(self.delete().status_code, 204)

    def test_correct_query_token_stops_only_matching_async_run(self):
        def scenario(responses, events):
            token = responses[0].data['message_id']
            response = self.client.post(f'/api/agents/chat/{self.cid}/stop/?message_id={token}', {}, format='json')
            self.assertEqual(response.status_code, 200)
            self.assertTrue(events[0].is_set())
            self.assertFalse(events[1].is_set())
        self.run_async_case(scenario)

    def test_expired_query_token_preserves_both_async_runs(self):
        def scenario(responses, events):
            response = self.client.post(f'/api/agents/chat/{self.cid}/stop/?message_id=expired-old-token', {}, format='json')
            self.assertEqual(response.status_code, 404)
            self.assertFalse(any(e.is_set() for e in events))
        self.run_async_case(scenario)

    def diagnostic_nonbinding_producer_without_terminal_event(self):
        # Faulted/truncated producer exhausts: once the actual thread has terminated, a stale
        # polling status must not become a second immortal generation reservation.
        workers = []
        real_thread = threading.Thread
        def thread_factory(*args, **kwargs):
            t = real_thread(*args, **kwargs)
            workers.append(t)
            return t
        with patch('agents.views.threading.Thread', side_effect=thread_factory):
            response = self.post(lambda **kwargs: iter(('event: content\ndata: "partial"\n\n',)), mode='async')
        self.assertEqual(response.status_code, 200)
        for worker in workers:
            worker.join(8)
            self.assertFalse(worker.is_alive())
        self.assertFalse(self.coord._active_runs.get(self.cid), 'consumer finally failed to release run')
        self.assertEqual(self.delete().status_code, 204,
            'polling processing record outlived every producer and now blocks deletion forever')