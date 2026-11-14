import pytest
from fastapi.testclient import TestClient
from backend.aegis import store
from backend.aegis.main import app


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(store, 'DB_PATH', str(tmp_path / 'test.sqlite'))
    with TestClient(app) as c:
        yield c
