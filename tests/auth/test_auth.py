import pytest
from fastapi.testclient import TestClient
from src.api.main import app
from src.config import settings

@pytest.fixture
def client():
    return TestClient(app, headers={"Origin": "http://localhost:5173"})

@pytest.fixture(autouse=True, scope="module")
def setup_auth_db():
    from src.database.connection import get_connection
    with get_connection() as conn:
        conn.execute("DELETE FROM users")
        conn.commit()
    yield
    
    with get_connection() as conn:
        conn.execute("INSERT OR IGNORE INTO users (id, username, password_hash, status, is_admin) VALUES ('mock_admin_id', 'test_admin', 'hash', 'approved', 1)")
        conn.commit()

@pytest.fixture(autouse=True)
def clear_auth_override():
    """Clear the global test auth mock for these specific auth tests"""
    app.dependency_overrides.clear()
    yield

def test_bootstrap_admin(client: TestClient):
    # First user should be admin and approved
    res = client.post("/auth/register", json={"username": "admin1", "password": "test-password-123"})
    assert res.status_code == 200
    data = res.json()
    assert data["username"] == "admin1"
    assert data["status"] == "approved"
    
def test_second_user_pending(client: TestClient):
    # Second user should be pending
    res = client.post("/auth/register", json={"username": "user2", "password": "test-password-123"})
    assert res.status_code == 200
    assert res.json()["status"] == "pending"
    
def test_pending_user_cannot_login(client: TestClient):
    # Try logging in as the pending user
    res = client.post("/auth/login", data={"username": "user2", "password": "test-password-123"})
    assert res.status_code == 401
    assert res.json()["detail"] == "Incorrect username or password"

def test_admin_approval_flow(client: TestClient):
    # 1. Login as admin to get token via cookie
    login_res = client.post("/auth/login", data={"username": "admin1", "password": "test-password-123"})
    assert login_res.status_code == 200
    assert "access_token" not in login_res.json()
    
    cookie_header = login_res.headers.get("set-cookie", "")
    assert "access_token=" in cookie_header
    assert "httponly" in cookie_header.lower()
    assert "samesite=lax" in cookie_header.lower()
    
    # 2. Check pending list (uses client's cookie jar automatically)
    pending_res = client.get("/auth/admin/pending")
    assert pending_res.status_code == 200
    pending_users = pending_res.json()["pending_users"]
    assert len(pending_users) >= 1
    
    user2_id = next(u["id"] for u in pending_users if u["username"] == "user2")
    
    # 3. Approve user2
    approve_res = client.post(f"/auth/admin/approve/{user2_id}")
    assert approve_res.status_code == 200
    
    # 4. user2 can now log in (overwrites cookie)
    user2_login = client.post("/auth/login", data={"username": "user2", "password": "test-password-123"})
    assert user2_login.status_code == 200
    
    # 5. Non-admin user2 tries to access admin routes (should fail)
    fail_res = client.get("/auth/admin/pending")
    assert fail_res.status_code == 403

def test_logout_clears_cookie(client: TestClient):
    # Login
    client.post("/auth/login", data={"username": "admin1", "password": "test-password-123"})
    
    # Logout (clears cookie)
    logout_res = client.post("/auth/logout")
    assert logout_res.status_code == 200
    
    # Protected route should 401
    res = client.get("/auth/admin/pending")
    assert res.status_code == 401


def test_cookie_secure_setting_controls_login_and_logout_attributes(client: TestClient, monkeypatch):
    monkeypatch.setattr(settings, "COOKIE_SECURE", True)
    secure_login = client.post("/auth/login", data={"username": "admin1", "password": "test-password-123"})
    assert "; Secure" in secure_login.headers["set-cookie"]

    monkeypatch.setattr(settings, "COOKIE_SECURE", False)
    insecure_login = client.post("/auth/login", data={"username": "admin1", "password": "test-password-123"})
    assert "; Secure" not in insecure_login.headers["set-cookie"]
    logout = client.post("/auth/logout")
    assert "; Secure" not in logout.headers["set-cookie"]

def test_invalid_cookie_rejected(client: TestClient):
    # Explicitly set invalid cookie
    client.cookies.set("access_token", "invalid_token")
    res = client.get("/auth/admin/pending")
    assert res.status_code == 401

def test_unauthorized_access_to_protected_route(client: TestClient):
    # Missing token
    res = client.get("/api/conversations")
    assert res.status_code == 401
