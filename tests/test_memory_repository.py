from src.core.prompt_builder import PromptBuilder
from src.database.memory_repository import MemoryRepository
from src.database.repository import ConversationRepository


def test_explicit_memory_is_saved_and_retrieved_by_relevance():
    conversation_id = ConversationRepository().create_conversation("Memory test", "mock_admin_id")
    repository = MemoryRepository()

    saved = repository.remember_explicit(
        "mock_admin_id",
        "Remember that I prefer concise answers.",
        conversation_id,
    )

    assert saved is not None
    memories = repository.find_relevant("mock_admin_id", "Please keep the answer concise.")
    assert [memory["content"] for memory in memories] == ["I prefer concise answers"]


def test_memory_rejects_sensitive_explicit_statements():
    conversation_id = ConversationRepository().create_conversation("Sensitive memory test", "mock_admin_id")
    repository = MemoryRepository()

    assert repository.remember_explicit(
        "mock_admin_id",
        "Remember my password is do-not-store-this.",
        conversation_id,
    ) is None


def test_explicit_ongoing_preference_is_learned():
    conversation_id = ConversationRepository().create_conversation("Ongoing preference test", "mock_admin_id")
    repository = MemoryRepository()

    saved = repository.remember_explicit(
        "mock_admin_id",
        "From now on answer in Hindi.",
        conversation_id,
    )

    assert saved is not None
    assert saved["content"] == "answer in Hindi"


def test_ordinary_factual_question_is_not_learned():
    conversation_id = ConversationRepository().create_conversation("Question memory test", "mock_admin_id")
    repository = MemoryRepository()

    assert repository.remember_explicit(
        "mock_admin_id",
        "What is the document retention period?",
        conversation_id,
    ) is None


def test_prompt_includes_memory_only_when_provided():
    builder = PromptBuilder()
    without_memory = builder.build_prompt([{"role": "user", "content": "Hello"}])
    with_memory = builder.build_prompt(
        [{"role": "user", "content": "How should you answer?"}],
        memory_context="- I prefer concise answers",
    )

    assert "RELEVANT USER MEMORIES" not in without_memory
    assert "I prefer concise answers" in with_memory