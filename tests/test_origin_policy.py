from fastapi.testclient import TestClient

from src.api.main import app


client = TestClient(app)


import uuid

def test_disallowed_origin_rejected_for_admin_approve():
    unique_user = f"origin_{uuid.uuid4().hex[:8]}"
    register = client.post(
        "/auth/register",
        json={"username": unique_user, "password": "test-password-123"},
    )
    pending_id = register.json()["id"]

    response = client.post(
        f"/auth/admin/approve/{pending_id}",
        headers={"Origin": "https://evil.example"},
    )

    assert response.status_code == 403


def test_disallowed_origin_rejected_for_conversation_delete():
    conversation = client.post("/api/conversations", json={"title": "Origin test"}).json()

    response = client.delete(
        f"/api/conversations/{conversation['id']}",
        headers={"Origin": "https://evil.example"},
    )

    assert response.status_code == 403


def test_disallowed_origin_rejected_for_login():
    response = client.post(
        "/auth/login",
        data={"username": "test_admin", "password": "test-password-123"},
        headers={"Origin": "https://evil.example"},
    )

    assert response.status_code == 403


def test_allowed_origin_passes():
    response = client.post(
        "/api/conversations",
        json={"title": "Allowed origin"},
        headers={"Origin": "http://localhost:5174"},
    )

    assert response.status_code == 200


def test_missing_origin_and_referer_passes():
    response = client.post("/api/conversations", json={"title": "No origin"})

    assert response.status_code == 200


def test_disallowed_origin_does_not_affect_get():
    response = client.get("/api/conversations", headers={"Origin": "https://evil.example"})

    assert response.status_code == 200


def test_allowed_referer_origin_passes():
    response = client.post(
        "/api/conversations",
        json={"title": "Allowed referer"},
        headers={"Referer": "http://localhost:5174/chat"},
    )

    assert response.status_code == 200


def test_disallowed_referer_origin_rejected():
    response = client.post(
        "/api/conversations",
        json={"title": "Disallowed referer"},
        headers={"Referer": "https://evil.example/chat"},
    )

    assert response.status_code == 403


def test_lookalike_origins_are_rejected():
    for origin in ("http://localhost:5173.evil.com", "http://evil.com/http://localhost:5173"):
        response = client.post(
            "/api/conversations",
            json={"title": "Lookalike"},
            headers={"Origin": origin},
        )
        assert response.status_code == 403


def test_null_origin_is_rejected():
    response = client.post(
        "/api/conversations",
        json={"title": "Null origin"},
        headers={"Origin": "null"},
    )

    assert response.status_code == 403