"""Acceptance-owned backend probes; run only via Django test_ database runner.
No provider calls: real view/ORM/coordinator paths, fake service producers only.
"""
import threading
from contextlib import contextmanager
from types import SimpleNamespace
from unittest.mock import patch

from django.db import connection, connections, IntegrityError
from django.test import TransactionTestCase
from rest_framework.test import APIClient, APIRequestFactory
from agents.models import AgentPreset
from agents.execution_coordinator import ConversationLifetimeCoordinator
from agents.streaming_buffer import SSESessionRegistry, StreamingBufferManager
from agents.views import AgentChatView, ConversationDetailView
from bridge.models import RuntimeBinding
from council.models import CouncilSession
from memory.models import Conversation, Message


class DeleteBackendAcceptance(TransactionTestCase):
    def setUp(self):
        if not str(connection.settings_dict['NAME']).startswith('test_'):
            raise RuntimeError('SAFETY: acceptance requires Django test_ database')
        self.coord = ConversationLifetimeCoordinator.get_instance()
        self.coord._active_runs.clear()
        self.coord._deleting_convs.clear()
        SSESessionRegistry.get_instance()._sessions.clear()
        StreamingBufferManager.get_instance()._buffers.clear()
        self.preset = AgentPreset.objects.create(name='Acceptance fixture', agent_type='standard')
        self.conv = Conversation.objects.create(name='Delete target', agent_preset=self.preset)
        self.cid = self.conv.pk
        self.client = APIClient(raise_request_exception=False)
        self.factory = APIRequestFactory()
        self.url = f'/api/agents/conversations/{self.cid}/'

    def tearDown(self):
        self.coord._active_runs.clear()
        self.coord._deleting_convs.clear()
        SSESessionRegistry.get_instance()._sessions.clear()
        StreamingBufferManager.get_instance()._buffers.clear()

    def post(self, producer, mode='sse'):
        with patch('agents.views.AgentFactory.get_service', return_value=SimpleNamespace(process_chat=producer)):
            return AgentChatView.as_view()(self.factory.post(
                f'/api/agents/chat/{self.cid}/?mode={mode}', {'content':'hello'}, format='json'),
                session_id=self.cid)

    def delete(self):
        return self.client.delete(self.url)

    def test_confirmed_delete_then_absence(self):
        response = self.delete()
        self.assertEqual(response.status_code, 204)
        self.assertFalse(Conversation.objects.filter(pk=self.cid).exists())
        response = self.delete()
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()['code'], 'conversation_not_found')

    def test_runtime_guard_failure_must_not_delete(self):
        RuntimeBinding.objects.create(conversation=self.conv, runtime_kind='antigravity',
            generation=1, status=RuntimeBinding.STATUS_ACTIVE)
        # A failed safety lookup must never be interpreted as idle. ORM delete itself
        # remains operational, as after a transient lookup error / backend gate exception.
        with patch.object(RuntimeBinding.objects, 'filter', side_effect=RuntimeError('safety lookup unavailable')):
            response = self.delete()
        self.assertTrue(Conversation.objects.filter(pk=self.cid).exists(),
            f'failed busy lookup allowed destructive HTTP {response.status_code}')
        self.assertGreaterEqual(response.status_code, 400)

    def test_synthesis_guard_failure_must_not_delete(self):
        phase0 = Conversation.objects.create(name='Council fixture', agent_preset=self.preset)
        council = CouncilSession.objects.create(arbitrator_preset=self.preset,
            phase0_conversation=phase0, synthesis_conversation=self.conv)
        manager_class = type(self.conv.council_session_synthesis)
        with patch.object(manager_class, 'exists', side_effect=RuntimeError('ownership lookup unavailable')):
            response = self.delete()
        self.assertTrue(Conversation.objects.filter(pk=self.cid).exists(),
            f'failed ownership lookup allowed destructive HTTP {response.status_code}')
        council.refresh_from_db()
        self.assertEqual(council.synthesis_conversation_id, self.cid)
        self.assertGreaterEqual(response.status_code, 400)

    def test_thread_start_failure_releases_failed_setup(self):
        with patch('agents.views.threading.Thread.start', side_effect=RuntimeError('thread start refused')) as start:
            try:
                self.post(lambda **kwargs: iter(()), mode='async')
            except RuntimeError:
                pass  # failure may propagate or be mapped; safe release is the invariant
            start.assert_called_once()
        self.assertFalse(self.coord.is_conversation_busy(self.cid)[0],
            'zero started workers but reservation permanently busy')
        self.assertEqual(self.delete().status_code, 204)

    def test_response_setup_failure_releases_failed_setup(self):
        with patch('agents.views.StreamingHttpResponse', side_effect=RuntimeError('response setup refused')):
            try:
                self.post(lambda **kwargs: iter(()))
            except RuntimeError:
                pass
        self.assertFalse(self.coord.is_conversation_busy(self.cid)[0],
            'failed response setup stranded generation')
        self.assertEqual(self.delete().status_code, 204)

    def test_real_response_unstarted_close_and_old_close_preserve_new_run(self):
        first = self.post(lambda **kwargs: iter(('event: done\ndata: {}\n\n',)))
        second = self.post(lambda **kwargs: iter(('event: done\ndata: {}\n\n',)))
        try:
            self.assertEqual(self.delete().status_code, 409)
            first.close()
            first.close()
            self.assertEqual(self.delete().status_code, 409, 'old close removed newer reservation')
        finally:
            first.close()
            second.close()
        self.assertEqual(self.delete().status_code, 204)

    def test_delete_failure_unmarks_and_allows_retry(self):
        with patch.object(ConversationDetailView, 'perform_destroy', side_effect=IntegrityError('rollback fixture')):
            response = self.delete()
        self.assertEqual(response.status_code, 500)
        self.assertTrue(Conversation.objects.filter(pk=self.cid).exists())
        self.assertFalse(self.coord.is_deleting(self.cid))
        self.assertEqual(self.delete().status_code, 204)

    def test_sse_stop_remains_busy_until_actual_final_write_and_close(self):
        observed = {}
        def producer(**kwargs):
            observed['stop'] = kwargs['stop_event']
            def stream():
                try:
                    yield 'event: content\ndata: "hello"\n\n'
                finally:
                    observed['busy_at_final_write'] = self.coord.is_conversation_busy(self.cid)[0]
                    Message.objects.create(conversation_id=self.cid, role='assistant',
                        content='partial persisted', index_in_session=0)
            return stream()
        response = self.post(producer)
        try:
            next(iter(response.streaming_content))
            stopped = self.client.post(f'/api/agents/chat/{self.cid}/stop/', {}, format='json')
            self.assertEqual(stopped.status_code, 200)
            self.assertTrue(observed['stop'].is_set())
            self.assertEqual(self.delete().status_code, 409)
        finally:
            response.close()
        self.assertTrue(observed['busy_at_final_write'])
        self.assertTrue(Message.objects.filter(conversation_id=self.cid, content='partial persisted').exists())
        self.assertEqual(self.delete().status_code, 204)

    def test_async_expired_token_does_not_stop_different_live_run(self):
        entered, release, finished = threading.Event(), threading.Event(), threading.Event()
        observed = {}
        def producer(**kwargs):
            observed['stop'] = kwargs['stop_event']
            def stream():
                try:
                    entered.set()
                    if not release.wait(8):
                        raise RuntimeError('harness barrier timeout')
                    yield 'event: done\ndata: {}\n\n'
                finally:
                    finished.set()
            return stream()
        # Capture the real consumer thread for deterministic join, no sleeps.
        real_thread = threading.Thread
        workers = []
        def thread_factory(*args, **kwargs):
            t = real_thread(*args, **kwargs)
            workers.append(t)
            return t
        try:
            with patch('agents.views.threading.Thread', side_effect=thread_factory):
                response = self.post(producer, mode='async')
            self.assertEqual(response.status_code, 200)
            self.assertTrue(entered.wait(8), 'real async producer never started')
            expired = self.client.post(f'/api/agents/chat/{self.cid}/stop/',
                {'message_id':'expired-unrelated-token'}, format='json')
            self.assertFalse(observed['stop'].is_set(),
                f'expired token signalled unrelated live async run (HTTP {expired.status_code})')
            self.assertEqual(self.delete().status_code, 409)
        finally:
            release.set()
            for thread in workers:
                thread.join(8)
                self.assertFalse(thread.is_alive(), 'consumer cleanup failed')
        self.assertTrue(finished.is_set())
        self.assertEqual(self.delete().status_code, 204)

    def test_branch_lock_release_interleaves_delete_without_fk_failure(self):
        Message.objects.create(conversation=self.conv, role='user', content='u', index_in_session=0)
        ai = Message.objects.create(conversation=self.conv, role='assistant', content='a', index_in_session=1)
        left_boundary, deletion_done = threading.Event(), threading.Event()
        result = {}
        original_lock = self.coord.admission_lock
        @contextmanager
        def observed_lock(cid):
            with original_lock(cid):
                yield
            # Pause the real branch handler immediately after its admission critical section.
            # A correct implementation has committed its dependent parent write by now.
            if threading.current_thread().name == 'acceptance-branch' and cid == self.cid:
                left_boundary.set()
                if not deletion_done.wait(8):
                    raise RuntimeError('harness delete barrier timeout')
        def run_branch():
            try:
                client = APIClient(raise_request_exception=False)
                response = client.post(f'/api/agents/conversations/{self.cid}/branch/',
                    {'branch_from_message_id': ai.pk}, format='json')
                result['status'] = response.status_code
                result['body'] = response.json()
            except BaseException as exc:
                result['exception'] = repr(exc)
            finally:
                connections.close_all()
        thread = threading.Thread(target=run_branch, name='acceptance-branch')
        with patch.object(self.coord, 'admission_lock', observed_lock):
            thread.start()
            try:
                self.assertTrue(left_boundary.wait(8), 'branch did not reach boundary')
                self.assertEqual(self.delete().status_code, 204)
            finally:
                deletion_done.set()
                thread.join(8)
        self.assertFalse(thread.is_alive(), 'branch worker stranded')
        self.assertNotIn('exception', result)
        self.assertIn(result['status'], (201, 400, 404, 409),
            f'branch used a deleted parent after releasing lock: {result}')
        self.assertFalse(Conversation.objects.filter(pk=self.cid).exists())