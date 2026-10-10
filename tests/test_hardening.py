from fastapi.testclient import TestClient

from src.api.main import app
from src.auth.dependencies import get_current_user


def test_spa_fallback_rejects_path_traversal():
    response = TestClient(app).get("/..%2F..%2Frequirements.txt")

    assert response.status_code == 404
    assert "fastapi" not in response.text.lower()


def test_chat_rejects_oversized_message():
    response = TestClient(app).post("/api/chat", json={"message": "x" * 12001})

    assert response.status_code == 422


def test_model_metadata_requires_authentication():
    original = app.dependency_overrides.pop(get_current_user, None)
    try:
        response = TestClient(app).get("/api/models")
    finally:
        if original is not None:
            app.dependency_overrides[get_current_user] = original

    assert response.status_code == 401