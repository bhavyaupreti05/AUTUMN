import os
import zipfile
from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from starlette.requests import Request

from src.auth.dependencies import get_current_user
from src.auth import db
from src.api.main import app
from src.services.document_service import DocumentService
from src.config import settings


def make_request():
    return Request({"type": "http", "headers": []})


def test_auth_bypass_rejected_on_network_bind(monkeypatch):
    monkeypatch.setenv("BYPASS_AUTH", "1")
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    monkeypatch.setattr(settings, "API_HOST", "0.0.0.0")

    with pytest.raises(HTTPException) as error:
        get_current_user(make_request(), None)

    assert error.value.status_code == 403


def test_auth_bypass_allowed_only_on_loopback(monkeypatch):
    monkeypatch.setenv("BYPASS_AUTH", "1")
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    monkeypatch.setattr(settings, "API_HOST", "127.0.0.1")

    user = get_current_user(make_request(), None)

    assert user["is_admin"] is True


def test_first_registration_creates_only_one_admin(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "DATABASE_URL", str(tmp_path / "bootstrap.db"))
    db.init_users_table()

    def register(index):
        return db.create_registered_user(f"bootstrap-{index}", "hash")

    with ThreadPoolExecutor(max_workers=2) as executor:
        users = list(executor.map(register, range(2)))

    assert sum(user["is_admin"] for user in users) == 1
    assert sum(user["status"] == "approved" for user in users) == 1


def test_password_reset_token_can_be_redeemed_once_concurrently(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "DATABASE_URL", str(tmp_path / "reset.db"))
    db.init_users_table()
    user = db.create_user("reset-user", "old-hash", status="approved")
    raw_token, _ = db.issue_password_reset_token(user["id"], "admin", 30)

    def redeem(index):
        return db.reset_password_with_token(raw_token, f"new-hash-{index}")

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(redeem, range(2)))

    assert sum(result is not None for result in results) == 1


def test_admin_user_lists_do_not_expose_credentials(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "DATABASE_URL", str(tmp_path / "users.db"))
    db.init_users_table()
    db.create_user("pending-user", "pending-hash")
    db.create_user("active-user", "active-hash", status="approved")

    listed_users = db.list_pending_users() + db.list_approved_users() + db.list_active_users()

    assert listed_users
    assert all("password_hash" not in user for user in listed_users)
    assert all("token_version" not in user for user in listed_users)


def test_pdf_page_limit_is_enforced(monkeypatch):
    class FakeDocument:
        page_count = 501

        def close(self):
            pass

    monkeypatch.setattr(settings, "MAX_DOCUMENT_PAGES", 500)
    monkeypatch.setattr("src.services.document_service.fitz.open", lambda _: FakeDocument())

    with pytest.raises(ValueError, match="page count"):
        DocumentService.__new__(DocumentService)._extract_text("large.pdf")


def test_docx_expansion_limit_is_enforced(tmp_path, monkeypatch):
    class FakeArchive:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def infolist(self):
            return [type("Entry", (), {"file_size": 101 * 1024 * 1024})()]

    docx_path = tmp_path / "expanded.docx"
    docx_path.write_bytes(b"not parsed")
    monkeypatch.setattr(zipfile, "ZipFile", lambda _: FakeArchive())

    monkeypatch.setattr(settings, "MAX_DOCX_UNCOMPRESSED_MB", 100)

    with pytest.raises(ValueError, match="uncompressed"):
        DocumentService.__new__(DocumentService)._extract_text(str(docx_path))


def test_cookie_authenticated_mutation_requires_origin():
    response = TestClient(app).post(
        "/api/conversations",
        json={"title": "csrf"},
        headers={"Cookie": "access_token=test-token"},
    )

    assert response.status_code == 403


def test_production_rejects_insecure_cookie_setting():
    with pytest.raises(ValueError, match="COOKIE_SECURE"):
        from src.config import Settings

        Settings(
            ENVIRONMENT="production",
            JWT_SECRET="9f4c2a7d8b1e6f305a9c7e2b4d8f1a6c3e5b7d9f2a4c6e8b1d3f5a7c9e2b4d6f",
            ALLOWED_ORIGINS="https://example.com",
            COOKIE_SECURE=False,
        )


def test_health_check_does_not_return_database_exception(monkeypatch):
    from src.api import routes

    monkeypatch.setattr(routes._repo, "list_conversations", lambda: (_ for _ in ()).throw(RuntimeError("C:/private/database.db")))
    response = TestClient(app).get("/api/health")

    assert response.status_code == 200
    assert response.json()["persistence"] == "error"
    assert "private" not in response.text