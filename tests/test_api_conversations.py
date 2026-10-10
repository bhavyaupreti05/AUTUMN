import pytest
from fastapi.testclient import TestClient
from src.api.main import app
from src.api.routes import get_chat_service, get_repository
from src.database.repository import ConversationRepository
from unittest.mock import MagicMock

client = TestClient(app)

def test_conversations_api():
    # 1. Create
    res = client.post("/api/conversations", json={"title": "API Test"})
    assert res.status_code == 200
    conv_id = res.json()["id"]
    
    # 2. List
    res_list = client.get("/api/conversations")
    assert res_list.status_code == 200
    assert len(res_list.json()["conversations"]) > 0
    
    # 3. Get
    res_get = client.get(f"/api/conversations/{conv_id}")
    assert res_get.status_code == 200
    assert res_get.json()["conversation"]["id"] == conv_id
    assert res_get.json()["messages"] == []

    repository = ConversationRepository()
    repository.save_message(conv_id, "user", "Question")
    repository.save_message(conv_id, "assistant", "Partial", status="aborted")
    res_with_status = client.get(f"/api/conversations/{conv_id}")
    assert [message["status"] for message in res_with_status.json()["messages"]] == ["complete", "aborted"]
    
    # 4. Delete
    res_del = client.delete(f"/api/conversations/{conv_id}")
    assert res_del.status_code == 200
    
    res_missing = client.get(f"/api/conversations/{conv_id}")
    assert res_missing.status_code == 404

def test_chat_streaming_persistence():
    # Mock the chat service so we don't need actual Llama during API tests
    mock_service = MagicMock()
    mock_service.generate_chat_response.return_value = (chunk for chunk in ["Mock", " Response"])
    
    app.dependency_overrides[get_chat_service] = lambda: mock_service
    
    try:
        # Chat without conv_id (should create one with deterministic title)
        # Using a long enough string to test the truncation (first 5 words)
        prompt_text = "This is a deterministic title test that should be truncated"
        res = client.post("/api/chat", json={"message": prompt_text})
        assert res.status_code == 200
        content = res.content.decode("utf-8")
        assert 'conversation_id' in content
        
        # Verify deterministic title logic (first 5 words)
        # Extract conv_id from the first SSE chunk
        import json
        lines = content.split('\n')
        conv_id = None
        for line in lines:
            if line.startswith('data: {"conversation_id"'):
                # Extract only the JSON part before any subsequent data or newlines
                json_str = line[6:].split('\\n')[0].strip()
                data = json.loads(json_str)
                conv_id = data["conversation_id"]
                break
                
        assert conv_id is not None
        
        res_get = client.get(f"/api/conversations/{conv_id}")
        title = res_get.json()["conversation"]["title"]
        assert title == "This is a deterministic title..."
        
    finally:
        app.dependency_overrides.clear()

def test_chat_streaming_error_forwarding():
    # Mock the chat service to yield an error chunk, like it does on lock timeout
    mock_service = MagicMock()
    mock_service.generate_chat_response.return_value = (chunk for chunk in [{"type": "error", "error": "Server is busy"}])
    
    app.dependency_overrides[get_chat_service] = lambda: mock_service
    
    try:
        res = client.post("/api/chat", json={"message": "trigger error"})
        assert res.status_code == 200
        content = res.content.decode("utf-8")
        
        # Verify the error chunk is actually yielded to the client
        assert 'data: {"error": "Server is busy"}' in content
    finally:
        app.dependency_overrides.clear()
