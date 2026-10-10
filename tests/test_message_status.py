import sqlite3

from src.config import settings
from src.core.context_manager import ContextManager
from src.database.connection import init_db
from src.services.chat_service import ChatService
from src.llm.provider import LLMProvider


def test_message_status_migrates_old_schema_idempotently(tmp_path, monkeypatch):
    db_path = tmp_path / "old.db"
    monkeypatch.setattr(settings, "DATABASE_URL", str(db_path))

    with sqlite3.connect(db_path) as connection:
        connection.execute(
            "CREATE TABLE conversations (id TEXT PRIMARY KEY, title TEXT NOT NULL, user_id TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, is_pinned BOOLEAN DEFAULT 0)"
        )
        connection.execute(
            "CREATE TABLE messages (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, sequence INTEGER NOT NULL)"
        )
        connection.execute("INSERT INTO conversations (id, title) VALUES ('conversation', 'Old')")
        connection.execute(
            "INSERT INTO messages (id, conversation_id, role, content, sequence) VALUES ('message', 'conversation', 'user', 'Hello', 1)"
        )
        connection.commit()

    init_db()
    init_db()

    with sqlite3.connect(db_path) as connection:
        columns = [row[1] for row in connection.execute("PRAGMA table_info(messages)")]
        status = connection.execute("SELECT status FROM messages WHERE id = 'message'").fetchone()[0]

    assert columns.count("status") == 1
    assert status == "complete"


def test_context_drops_error_exchange_and_preserves_alternation(monkeypatch):
    messages = [
        {"role": "user", "content": "first", "status": "complete"},
        {"role": "assistant", "content": "reply", "status": "complete"},
        {"role": "user", "content": "failed one", "status": "complete"},
        {"role": "assistant", "content": "", "status": "error"},
        {"role": "user", "content": "failed two", "status": "complete"},
        {"role": "assistant", "content": "", "status": "error"},
        {"role": "user", "content": "next", "status": "complete"},
    ]
    context_manager = ContextManager()
    context_manager.repo = type("Repository", (), {"get_messages": lambda self, conversation_id, limit: messages, "get_conversation_summary": lambda self, conversation_id: None})()

    context = context_manager.prepare_context("conversation", "next")

    assert [message["role"] for message in context] == ["user", "assistant", "user"]
    assert [message["content"] for message in context] == ["first", "reply", "next"]


def test_context_keeps_aborted_message(monkeypatch):
    messages = [
        {"role": "user", "content": "question", "status": "complete"},
        {"role": "assistant", "content": "partial", "status": "aborted"},
        {"role": "user", "content": "follow-up", "status": "complete"},
    ]
    context_manager = ContextManager()
    context_manager.repo = type("Repository", (), {"get_messages": lambda self, conversation_id, limit: messages, "get_conversation_summary": lambda self, conversation_id: None})()

    context = context_manager.prepare_context("conversation", "follow-up")

    assert [message["role"] for message in context] == ["user", "assistant", "user"]
    assert context[1]["content"] == "partial"


def test_context_repairs_legacy_consecutive_user_messages():
    messages = [
        {"role": "user", "content": "orphan", "status": "complete"},
        {"role": "user", "content": "current", "status": "complete"},
        {"role": "assistant", "content": "answer", "status": "complete"},
    ]
    context_manager = ContextManager()
    context_manager.repo = type("Repository", (), {"get_messages": lambda self, conversation_id, limit: messages, "get_conversation_summary": lambda self, conversation_id: None})()

    context = context_manager.prepare_context("conversation", "follow-up")

    assert [message["role"] for message in context] == ["user", "assistant"]
    assert context[0]["content"] == "current"


def test_provider_stream_closes_before_failed_assistant_persistence(caplog):
    events = []

    class ClosingProvider(LLMProvider):
        def generate_stream(self, prompt, temperature=None, max_tokens=None):
            try:
                yield {"type": "text", "content": "partial"}
                yield {"type": "status", "status": "MAX_TOKENS"}
            finally:
                events.append("provider_closed")

        def health_check(self):
            return True

    class FailingRepository:
        def save_message(self, conversation_id, role, content, status="complete"):
            if role == "assistant":
                assert events == ["provider_closed"]
                raise RuntimeError("database unavailable")

        def tag_conversation_user(self, conversation_id, user_id):
            pass

    service = ChatService(ClosingProvider())
    service.repo = FailingRepository()
    service.context_manager.prepare_context = lambda conversation_id, message: []
    service.prompt_builder.build_prompt = lambda messages, retrieved_context: "prompt"

    list(service.generate_chat_response("question", "conversation"))

    assert events == ["provider_closed"]
    assert "Error persisting assistant message" in caplog.text