"""Browser tests never touch the user's SQLite data."""
import os
from pathlib import Path
import sys
import tempfile
import uvicorn

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
with tempfile.TemporaryDirectory(prefix='aegis-e2e-') as folder:
    os.environ['AEGIS_DB_PATH'] = str(Path(folder) / 'test.sqlite')
    uvicorn.run('backend.aegis.main:app', host='127.0.0.1', port=int(os.environ.get('AEGIS_E2E_PORT', '8001')), log_level='warning')
