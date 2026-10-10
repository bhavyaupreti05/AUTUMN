from fastapi.testclient import TestClient

from src.api.main import app
from src.api.routes import get_doc_repo, get_repository
from src.auth.dependencies import get_current_user


class ConversationRepo:
    def get_conversation(self, conversation_id):
        return {"id": conversation_id, "user_id": "user-a"}


class DocumentRepo:
    def get_document(self, document_id):
        return {"id": document_id, "user_id": "user-b"}


def test_user_cannot_attach_another_users_document():
    app.dependency_overrides[get_current_user] = lambda: {
        "id": "user-a",
        "is_admin": False,
        "status": "approved",
    }
    app.dependency_overrides[get_repository] = ConversationRepo
    app.dependency_overrides[get_doc_repo] = DocumentRepo

    try:
        response = TestClient(app).post(
            "/api/conversations/conversation-a/documents",
            json={"document_id": "document-b"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 403