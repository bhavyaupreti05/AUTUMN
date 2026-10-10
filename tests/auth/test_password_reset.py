import hashlib
import sqlite3
from datetime import datetime, timedelta, timezone

import jwt
import pytest
from fastapi.testclient import TestClient

from src.api.main import app
from src.auth import db, security
from src.config import settings

ADMIN_USERNAME = "reset_admin"
ADMIN_PASSWORD = "Reset-Admin-Password-1"
USER_USERNAME = "reset_user"
USER_PASSWORD = "Reset-User-Password-1"


@pytest.fixture
def reset_client(monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    monkeypatch.setattr(settings, "COOKIE_SECURE", False)
    monkeypatch.setattr(settings, "ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:5174")
    monkeypatch.setattr(settings, "JWT_SECRET", "test-password-reset-secret-0123456789012345")
    monkeypatch.setattr(settings, "PASSWORD_RESET_TTL_MINUTES", 30)
    app.dependency_overrides.clear()
    with db.get_db_connection() as conn:
        conn.execute("DELETE FROM password_reset_tokens")
        conn.execute("DELETE FROM users")
        conn.commit()
    db.create_user(ADMIN_USERNAME, security.get_password_hash(ADMIN_PASSWORD), is_admin=True, status="approved")
    db.create_user(USER_USERNAME, security.get_password_hash(USER_PASSWORD), is_admin=False, status="approved")
    yield TestClient(app, headers={"Origin": "http://localhost:5173"})
    with db.get_db_connection() as conn:
        conn.execute("DELETE FROM password_reset_tokens")
        conn.execute("DELETE FROM users")
        conn.execute("INSERT INTO users (id, username, password_hash, status, is_admin) VALUES (?, ?, ?, ?, ?)", ("mock_admin_id", "test_admin", "hash", "approved", 1))
        conn.commit()


def login(client, username, password):
    response = client.post("/auth/login", data={"username": username, "password": password})
    assert response.status_code == 200
    return response


def test_password_policy_applies_to_registration(reset_client):
    for password, username in (("short", "new_user"), ("password123", "new_user"), ("é" * 37, "new_user"), ("same_user", "same_user")):
        response = reset_client.post("/auth/register", json={"username": username, "password": password})
        assert response.status_code == 400


def test_old_users_schema_migration_is_idempotent(tmp_path, monkeypatch):
    database_path = tmp_path / "old-users.db"
    monkeypatch.setattr(settings, "DATABASE_URL", str(database_path))
    with sqlite3.connect(database_path) as conn:
        conn.execute("CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, is_admin BOOLEAN NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, approved_by TEXT, approved_at TIMESTAMP, failed_login_attempts INTEGER DEFAULT 0, locked_until TIMESTAMP)")
        conn.execute("INSERT INTO users (id, username, password_hash, status) VALUES ('legacy', 'legacy_user', 'hash', 'approved')")
    db.init_users_table()
    db.init_users_table()
    with db.get_db_connection() as conn:
        columns = {row[1] for row in conn.execute("PRAGMA table_info(users)")}
        token_version = conn.execute("SELECT token_version FROM users WHERE id = 'legacy'").fetchone()[0]
        reset_table = conn.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'password_reset_tokens'").fetchone()
    assert "token_version" in columns
    assert token_version == 0
    assert reset_table is not None


def test_reset_token_is_hashed_and_single_use(reset_client, caplog):
    login(reset_client, ADMIN_USERNAME, ADMIN_PASSWORD)
    issued = reset_client.post(
        "/auth/admin/users/reset-user-id/reset-token",
        json={"admin_password": ADMIN_PASSWORD},
    )
    assert issued.status_code == 400

    target = db.get_user_by_username(USER_USERNAME)
    issued = reset_client.post(
        f"/auth/admin/users/{target['id']}/reset-token",
        json={"admin_password": ADMIN_PASSWORD},
    )
    assert issued.status_code == 200
    raw_token = issued.json()["token"]
    assert raw_token not in caplog.text
    with db.get_db_connection() as conn:
        row = conn.execute("SELECT token_hash FROM password_reset_tokens WHERE user_id = ?", (target["id"],)).fetchone()
    assert row["token_hash"] == hashlib.sha256(raw_token.encode()).hexdigest()

    reset = reset_client.post("/auth/reset-password", json={"token": raw_token, "new_password": "Reset-New-Password-1"})
    assert reset.status_code == 200
    reused = reset_client.post("/auth/reset-password", json={"token": raw_token, "new_password": "Reset-Other-Password-1"})
    assert reused.status_code == 400
    assert reused.json()["detail"] == "Invalid or expired reset link"


def test_change_password_revokes_old_session_and_keeps_new_session(reset_client):
    old_session = login(reset_client, USER_USERNAME, USER_PASSWORD)
    old_cookie = old_session.cookies.get("access_token")
    changed = reset_client.post(
        "/auth/change-password",
        json={"current_password": USER_PASSWORD, "new_password": "Reset-Changed-Password-1"},
    )
    assert changed.status_code == 200
    new_cookie = changed.cookies.get("access_token")
    assert old_cookie != new_cookie

    reset_client.cookies.set("access_token", old_cookie)
    assert reset_client.get("/auth/me").status_code == 401
    reset_client.cookies.set("access_token", new_cookie)
    assert reset_client.get("/auth/me").status_code == 200


def test_old_style_token_without_version_is_rejected(reset_client):
    payload = {"sub": USER_USERNAME, "exp": datetime.now(timezone.utc) + timedelta(minutes=5)}
    token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    reset_client.cookies.set("access_token", token)
    assert reset_client.get("/auth/me").status_code == 401
