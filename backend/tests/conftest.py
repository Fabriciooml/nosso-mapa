import pytest
import os
from fastapi.testclient import TestClient


@pytest.fixture
def db_path(tmp_path):
    return str(tmp_path / "test.db")


@pytest.fixture
def client(db_path, monkeypatch):
    monkeypatch.setenv("DB_PATH", db_path)
    import app.database as db_module
    monkeypatch.setattr(db_module, "DB_PATH", db_path)
    db_module.init_db()
    from app.main import app
    with TestClient(app) as c:
        yield c
