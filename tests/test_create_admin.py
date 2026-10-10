import pytest

from scripts.create_admin import create_admin
from scripts.reset_password import reset_password
from src.auth import db, security
from src.config import settings


def test_create_admin_uses_temp_database_and_refuses_duplicates(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "DATABASE_URL", str(tmp_path / "admin.db"))
    db.init_users_table()

    user = create_admin("first_admin", "temporary-password")

    assert user["username"] == "first_admin"
    assert user["is_admin"] == 1
    assert user["status"] == "approved"
    assert security.verify_password("temporary-password", user["password_hash"])

    with pytest.raises(ValueError, match="already exists"):
        create_admin("first_admin", "another-password")


def test_reset_password_cli_function_uses_temp_database(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "DATABASE_URL", str(tmp_path / "reset.db"))
    db.init_users_table()
    user = db.create_user("reset_user", security.get_password_hash("old-password-1"), status="approved")

    reset_password("reset_user", "new-password-1")

    updated = db.get_user_by_id(user["id"])
    assert security.verify_password("new-password-1", updated["password_hash"])
    assert updated["token_version"] == 1
    with pytest.raises(ValueError, match="Unknown user"):
        reset_password("missing_user", "new-password-1")
