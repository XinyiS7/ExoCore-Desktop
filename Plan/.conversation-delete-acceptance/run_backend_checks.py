"""Run external acceptance tests in the backend Django test runner; no backend source edits."""
import os
import runpy
import sys
from pathlib import Path
here = Path(__file__).resolve().parent
backend = here.parents[2] / 'ExoCore'
if not (backend / 'manage.py').exists():
    raise RuntimeError(f'Unexpected backend root: {backend}')
os.chdir(backend)
sys.path.insert(0, str(backend))
sys.path.insert(0, str(here))
labels = sys.argv[1:] or ['p2_delete_backend_r1']
sys.argv = ['manage.py', 'test', *labels, '--noinput', '-v', '2']
# Separate test database from sibling backend workers; never reuse their --keepdb state.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ExoCore.settings')
from django.conf import settings
settings.DATABASES['default'].setdefault('TEST', {})['NAME'] = 'test_exocore_delete_acceptance'
runpy.run_path(str(backend / 'manage.py'), run_name='__main__')