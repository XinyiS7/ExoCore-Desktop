"""Independent backend FINAL regression run for delete-affected trees.
Separate DB from probe runs and sibling --keepdb workers. Fakes only; no providers.
"""
import os
import runpy
import sys
from pathlib import Path
here = Path(__file__).resolve().parent
backend = here.parents[2] / 'ExoCore'
os.chdir(backend)
sys.path.insert(0, str(backend))
sys.path.insert(0, str(here))
labels = [
    'agents',
    'memory',
    'push',
    'background_sessions',
    'bridge',
]
sys.argv = ['manage.py', 'test', *labels, '--noinput', '-v', '1', '--keepdb']
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ExoCore.settings')
from django.conf import settings
settings.DATABASES['default'].setdefault('TEST', {})['NAME'] = 'test_exocore_delete_final'
runpy.run_path(str(backend / 'manage.py'), run_name='__main__')
