from fastapi.testclient import TestClient
from src.api.main import app
from src.api.routes import get_chat_service
import json
from unittest.mock import patch, MagicMock

client = TestClient(app)

def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "chat-bot-2 backend with SQLite"
    assert "persistence" in data

def test_list_models():
    response = client.get("/api/models")
    assert response.status_code == 200
    data = response.json()
    assert "models" in data
    assert len(data["models"]) > 0

def test_chat_endpoint():
    mock_service = MagicMock()
    mock_service.generate_chat_response.return_value = ({"type": "text", "content": chunk} for chunk in ["Hello", " World"])
    
    # Override the dependency
    app.dependency_overrides[get_chat_service] = lambda: mock_service
    
    try:
        response = client.post("/api/chat", json={"message": "Test"})
        assert response.status_code == 200
        assert response.headers["content-type"] == "text/event-stream; charset=utf-8"
        
        content = response.content.decode("utf-8")
        assert 'data: {"chunk": "Hello"}' in content
        assert 'data: {"chunk": " World"}' in content
        assert "data: [DONE]" in content
    finally:
        # Clean up
        app.dependency_overrides.clear()
