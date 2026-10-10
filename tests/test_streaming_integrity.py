import sqlite3
import pytest
import asyncio
from unittest.mock import MagicMock, patch
from src.services.chat_service import ChatService
from src.llm.provider import LLMProvider
from src.database.repository import ConversationRepository
from src.api.routes import save_message_feedback, MessageFeedbackRequest
from src.config import settings
import json

class MockLLMProvider(LLMProvider):
    def __init__(self, chunks, final_reason):
        self.chunks = chunks
        self.final_reason = final_reason

    def generate_stream(self, prompt, temperature=None, max_tokens=None):
        for chunk in self.chunks:
            yield {"type": "text", "content": chunk}
        if self.final_reason:
            yield {"type": "status", "status": self.final_reason}
            
    def health_check(self):
        return True

@pytest.fixture
def repo():
    r = ConversationRepository()
    # Ensure fresh state for each test if needed, though they create unique conv_ids
    return r

def test_normal_stop_completion(repo):
    provider = MockLLMProvider(["Hello", " world!"], "COMPLETED")
    service = ChatService(provider)
    conv_id = repo.create_conversation()
    
    stream = service.generate_chat_response("Hi", conv_id)
    results = list(stream)
    
    assert len(results) == 4
    assert results[0]["content"] == "Hello"
    assert results[1]["content"] == " world!"
    assert results[2]["status"] == "COMPLETED"
    assert results[3]["type"] == "message_id"
    
    messages = repo.get_messages(conv_id)
    assert len(messages) == 2 # 1 user, 1 assistant
    assert messages[0]["role"] == "user"
    assert messages[1]["role"] == "assistant"
    assert messages[1]["content"] == "Hello world!"
    assert messages[1]["status"] == "complete"

def test_max_tokens_persists_partial_message(repo):
    provider = MockLLMProvider(["This ", "is ", "long"], "MAX_TOKENS")
    service = ChatService(provider)
    conv_id = repo.create_conversation()
    
    stream = service.generate_chat_response("Tell me a story", conv_id)
    results = list(stream)
    
    assert len(results) == 5
    assert results[3]["status"] == "MAX_TOKENS"
    assert results[4]["type"] == "message_id"
    
    messages = repo.get_messages(conv_id)
    assert len(messages) == 2 # Both user and partial assistant message should be saved
    assert messages[0]["role"] == "user"
    assert messages[1]["role"] == "assistant"
    assert messages[1]["content"] == "This is long"
    assert messages[1]["status"] == "aborted"

def test_provider_exception_persists_partial_message(repo):
    class ExceptionProvider(LLMProvider):
        def generate_stream(self, prompt, temperature=None, max_tokens=None):
            yield {"type": "text", "content": "Start"}
            raise RuntimeError("LLM crashed")
            
        def health_check(self):
            return True

    provider = ExceptionProvider()
    service = ChatService(provider)
    conv_id = repo.create_conversation()
    
    stream = service.generate_chat_response("Crash it", conv_id)
    results = list(stream)
    
    assert len(results) == 3
    assert results[0]["content"] == "Start"
    assert results[1]["type"] == "error"
    assert results[2]["type"] == "message_id"
    
    messages = repo.get_messages(conv_id)
    assert len(messages) == 2
    assert messages[0]["role"] == "user"
    assert messages[1]["role"] == "assistant"
    assert messages[1]["content"] == "Start"
    assert messages[1]["status"] == "aborted"


def test_stream_emits_persisted_message_id_when_provider_closes_without_final_status(repo):
    class SilentCompletionProvider(LLMProvider):
        def generate_stream(self, prompt, temperature=None, max_tokens=None):
            yield {"type": "text", "content": "hello"}
            return

        def health_check(self):
            return True

    service = ChatService(SilentCompletionProvider())
    conv_id = repo.create_conversation()

    stream = service.generate_chat_response("Say hi", conv_id)
    results = list(stream)

    message_ids = [item["message_id"] for item in results if item.get("type") == "message_id"]
    assert len(message_ids) == 1
    assert message_ids[0] == repo.get_messages(conv_id)[-1]["id"]


def test_feedback_allows_rating_from_a_second_account(repo):
    conv_id = repo.create_conversation(title="Shared chat", user_id="user-1")
    answer_id = repo.save_message(conv_id, role="assistant", content="Answer text")

    with sqlite3.connect(settings.DATABASE_URL) as conn:
        conn.execute(
            "INSERT OR IGNORE INTO users (id, username, password_hash, status, is_admin, token_version) VALUES (?, ?, ?, ?, ?, ?)",
            ("user-2", "second-user", "hash", "approved", 0, 0),
        )
        conn.commit()

    response = save_message_feedback(
        message_id=answer_id,
        feedback=MessageFeedbackRequest(rating="negative"),
        current_user={"id": "user-2", "is_admin": False},
    )

    assert response == {"message_id": answer_id, "rating": "negative"}

    with sqlite3.connect(settings.DATABASE_URL) as conn:
        row = conn.execute(
            "SELECT user_id, rating FROM message_feedback WHERE message_id = ?",
            (answer_id,),
        ).fetchone()

    assert row == ("user-2", "negative")


def test_feedback_updates_existing_rating_without_duplicate_row(repo):
    conv_id = repo.create_conversation(title="Rating update", user_id="user-1")
    answer_id = repo.save_message(conv_id, role="assistant", content="Answer text")

    with sqlite3.connect(settings.DATABASE_URL) as conn:
        conn.execute(
            "INSERT OR IGNORE INTO users (id, username, password_hash, status, is_admin, token_version) VALUES (?, ?, ?, ?, ?, ?)",
            ("user-1", "rating-user", "hash", "approved", 0, 0),
        )
        conn.commit()

    save_message_feedback(
        message_id=answer_id,
        feedback=MessageFeedbackRequest(rating="negative"),
        current_user={"id": "user-1", "is_admin": False},
    )
    save_message_feedback(
        message_id=answer_id,
        feedback=MessageFeedbackRequest(rating="positive"),
        current_user={"id": "user-1", "is_admin": False},
    )

    with sqlite3.connect(settings.DATABASE_URL) as conn:
        rows = conn.execute(
            "SELECT user_id, rating FROM message_feedback WHERE message_id = ?",
            (answer_id,),
        ).fetchall()

    assert rows == [("user-1", "positive")]


def test_client_disconnect_persists_partial_message(repo):
    provider = MockLLMProvider(["chunk1", "chunk2", "chunk3"], "COMPLETED")
    service = ChatService(provider)
    conv_id = repo.create_conversation()
    
    stream = service.generate_chat_response("Disconnect", conv_id)
    
    item1 = next(stream)
    assert item1["content"] == "chunk1"
    
    # Simulate client disconnect
    stream.close()
    
    messages = repo.get_messages(conv_id)
    assert len(messages) == 2
    assert messages[0]["role"] == "user"
    assert messages[1]["role"] == "assistant"
    assert messages[1]["content"] == "chunk1"
    assert messages[1]["status"] == "aborted"

def test_streaming_text_preservation(repo):
    provider = MockLLMProvider(["chunk1", "chunk2"], "MAX_TOKENS")
    service = ChatService(provider)
    conv_id = repo.create_conversation()
    
    stream = service.generate_chat_response("Test", conv_id)
    items = list(stream)
    
    assert len(items) == 4
    assert items[0]["content"] == "chunk1"
    assert items[1]["content"] == "chunk2"
    assert items[2]["status"] == "MAX_TOKENS"
    assert items[3]["type"] == "message_id"

def test_abort_before_any_token_streamed(repo):
    class ImmediateExceptionProvider(LLMProvider):
        def generate_stream(self, prompt, temperature=None, max_tokens=None):
            raise RuntimeError("Crashed immediately")
            yield {} # to make it a generator
            
        def health_check(self):
            return True

    provider = ImmediateExceptionProvider()
    service = ChatService(provider)
    conv_id = repo.create_conversation()
    
    stream = service.generate_chat_response("Hello", conv_id)
    results = list(stream)
    
    messages = repo.get_messages(conv_id)
    assert len(messages) == 2, "Expected an empty assistant message to maintain alternating roles, but got none."
    assert messages[0]["role"] == "user"
    assert messages[0]["status"] == "complete"
    assert messages[1]["role"] == "assistant"
    assert messages[1]["content"] == ""
    assert messages[1]["status"] == "error"
