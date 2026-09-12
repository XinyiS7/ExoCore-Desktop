"""Pre-commit focused check — delete/stop coupled suites on isolated DB."""
import os, runpy, sys
from pathlib import Path
here = Path(__file__).resolve().parent
backend = here.parents[2] / 'ExoCore'
os.chdir(backend); sys.path.insert(0, str(backend)); sys.path.insert(0, str(here))
labels = ['agents.tests.test_conversation_delete', 'agents.tests.test_services', 'agents.tests.test_runtime_turn']
sys.argv = ['manage.py', 'test', *labels, '--noinput', '-v', '1', '--keepdb']
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ExoCore.settings')
from django.conf import settings
settings.DATABASES['default'].setdefault('TEST', {})['NAME'] = 'test_exocore_delete_precommit'
runpy.run_path(str(backend / 'manage.py'), run_name='__main__')
