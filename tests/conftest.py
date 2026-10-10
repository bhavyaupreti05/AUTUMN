import pytest
import os
os.environ.setdefault("JWT_SECRET", "9f4c2a7d8b1e6f305a9c7e2b4d8f1a6c3e5b7d9f2a4c6e8b1d3f5a7c9e2b4d6f")
os.environ.setdefault("COOKIE_SECURE", "false")
from src.config import settings
from src.database.connection import init_db
from src.api.main import app
from src.auth.dependencies import get_current_user
from src.auth.db import init_users_table

# Force all tests to use an in-memory SQLite DB or a specific test file 
# by overriding the setting BEFORE any routes or modules are loaded.
settings.DATABASE_URL = "data/test_db_suite.db"

@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    init_db()
    init_users_table()
    
    from src.database.connection import get_connection
    with get_connection() as conn:
        conn.execute("INSERT OR IGNORE INTO users (id, username, password_hash, status, is_admin) VALUES ('mock_admin_id', 'test_admin', 'hash', 'approved', 1)")
        conn.commit()
        
    # Disable rate limiter for tests to prevent 429s from failing the suite
    from src.core.rate_limit import limiter
    limiter.enabled = False
    if hasattr(limiter, '_storage') and hasattr(limiter._storage, 'reset'):
        limiter._storage.reset()
    elif hasattr(limiter, 'storage') and hasattr(limiter.storage, 'reset'):
        limiter.storage.reset()
    
    yield
    # Cleanup after all tests
    if os.path.exists(settings.DATABASE_URL):
        try:
            os.remove(settings.DATABASE_URL)
        except Exception as e:
            print(f"Cleanup failed (file locked): {e}")

@pytest.fixture(autouse=True)
def override_auth_for_tests():
    """
    Automatically mock the get_current_user dependency for all tests
    unless specifically disabled (e.g. in test_auth.py).
    """
    app.dependency_overrides[get_current_user] = lambda: {
        "id": "mock_admin_id",
        "username": "test_admin",
        "is_admin": True,
        "status": "approved"
    }
    
    from src.core.rate_limit import limiter
    if hasattr(limiter, '_storage') and hasattr(limiter._storage, 'reset'):
        limiter._storage.reset()
    elif hasattr(limiter, 'storage') and hasattr(limiter.storage, 'reset'):
        limiter.storage.reset()
    
    yield
    app.dependency_overrides.clear()
