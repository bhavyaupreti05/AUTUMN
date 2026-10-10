import pytest
from fastapi.testclient import TestClient
from src.api.main import app
from src.auth.dependencies import get_current_user

# Mock dependencies to simulate logged-in users
def override_get_current_user_admin():
    return {
        "id": "admin_test_123",
        "username": "admin_test",
        "is_admin": True,
        "status": "approved"
    }

def override_get_current_user_normal():
    return {
        "id": "normal_test_123",
        "username": "normal_test",
        "is_admin": False,
        "status": "approved"
    }

@pytest.fixture
def client_admin():
    app.dependency_overrides[get_current_user] = override_get_current_user_admin
    yield TestClient(app)
    app.dependency_overrides.clear()

@pytest.fixture
def client_normal():
    app.dependency_overrides[get_current_user] = override_get_current_user_normal
    yield TestClient(app)
    app.dependency_overrides.clear()

def test_admin_can_list_pending(client_admin):
    # This might fail if the DB isn't mocked, but in existing tests, the DB is either mocked or initialized in memory.
    # Given we are just testing the endpoint access, we can expect a 200 OK.
    response = client_admin.get("/auth/admin/pending")
    assert response.status_code == 200
    data = response.json()
    assert "pending_users" in data
    assert isinstance(data["pending_users"], list)

def test_non_admin_cannot_list_pending(client_normal):
    response = client_normal.get("/auth/admin/pending")
    assert response.status_code == 403
    assert response.json()["detail"] == "Admin privileges required"

def test_get_me_admin(client_admin):
    response = client_admin.get("/auth/me")
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "admin_test"
    assert data["is_admin"] is True

def test_get_me_normal(client_normal):
    response = client_normal.get("/auth/me")
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "normal_test"
    assert data["is_admin"] is False
