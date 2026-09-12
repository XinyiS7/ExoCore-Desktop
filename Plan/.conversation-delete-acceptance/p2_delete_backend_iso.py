"""Isolate two final-run failures — attribution check, not a gate re-run."""
import os, runpy, sys
from pathlib import Path
here = Path(__file__).resolve().parent
backend = here.parents[2] / 'ExoCore'
os.chdir(backend); sys.path.insert(0, str(backend)); sys.path.insert(0, str(here))
labels = [
    'memory.tests.migrations.test_0053_alter_memoryplasmid_source.MemoryPlasmidSourceMigrationTest.test_migration_runpython',
    'agents.tests.test_use_drawer.UseDrawerCollectorTests.test_catalog_server_name_routes_drawer_and_keeps_snapshot_static',
]
sys.argv = ['manage.py', 'test', *labels, '--noinput', '-v', '1', '--keepdb']
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ExoCore.settings')
from django.conf import settings
settings.DATABASES['default'].setdefault('TEST', {})['NAME'] = 'test_exocore_delete_final_iso'
runpy.run_path(str(backend / 'manage.py'), run_name='__main__')