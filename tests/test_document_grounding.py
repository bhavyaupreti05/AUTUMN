from unittest.mock import MagicMock, patch

from src.core.prompt_builder import PromptBuilder, is_substantive_document_question
from src.services.chat_service import ChatService


def test_document_context_is_enforced_in_system_prompt():
    prompt = PromptBuilder().build_prompt(
        [{"role": "user", "content": "What does the document say?"}],
        "The document says the policy starts in 2026.",
    )

    system_prompt = prompt.split("<|im_end|>", 1)[0]
    assert "use only the retrieved document context" in system_prompt
    assert "Do not use general knowledge" in system_prompt


def test_grounded_chat_uses_low_temperature():
    provider = MagicMock()
    provider.generate_stream.return_value = iter([
        {"type": "status", "status": "COMPLETED"},
    ])
    service = ChatService(provider)
    service.repo = MagicMock()
    service.context_manager.prepare_context = MagicMock(return_value=[
        {"role": "user", "content": "What does the document say?"}
    ])
    service.prompt_builder.build_prompt = MagicMock(return_value="grounded prompt")

    with patch("src.services.chat_service.get_retrieval_service") as get_retrieval:
        get_retrieval.return_value.retrieve_context.return_value = "The document says the policy starts in 2026."
        list(service.generate_chat_response("What does the document say?", "grounded-conversation"))

    provider.generate_stream.assert_called_once_with(
        "grounded prompt",
        max_tokens=512,
        temperature=0.2,
    )


def test_prompt_builder_allows_reasoned_answers_from_context():
    prompt = PromptBuilder().build_prompt(
        [{"role": "user", "content": "When does the policy say approvals must happen?"}],
        "The policy says approvals must happen within 48 hours.",
    )

    assert "MUST reply verbatim" not in prompt
    assert "If the answer is not clearly supported by the context" in prompt


def test_prompt_builder_requests_evidence_first_and_short_answers():
    prompt = PromptBuilder().build_prompt(
        [{"role": "user", "content": "What is the deadline for approvals?"}],
        "The policy says approvals must happen within 48 hours.",
    )

    assert "evidence-first" in prompt.lower()
    assert "answer in a short, direct sentence" in prompt.lower()
    assert "state uncertainty clearly" in prompt.lower()


def test_conversational_acknowledgments_are_not_forced_into_document_fallback():
    assert not is_substantive_document_question("ok")
    assert not is_substantive_document_question("ok, thank you")
    assert not is_substantive_document_question("hello")
    assert is_substantive_document_question("What does the document say about review models?")


def test_acknowledgment_keeps_normal_conversation_prompt():
    provider = MagicMock()
    provider.generate_stream.return_value = iter([
        {"type": "status", "status": "COMPLETED"},
    ])
    service = ChatService(provider)
    service.repo = MagicMock()
    service.context_manager.prepare_context = MagicMock(return_value=[
        {"role": "user", "content": "What does the document say?"},
        {"role": "assistant", "content": "It covers review models."},
        {"role": "user", "content": "ok, thank you"},
    ])
    service.prompt_builder.build_prompt = MagicMock(return_value="normal conversation prompt")

    with patch("src.services.chat_service.get_retrieval_service") as get_retrieval:
        get_retrieval.return_value.retrieve_context.return_value = "Document context that should not trigger fallback."
        list(service.generate_chat_response("ok, thank you", "conversation"))

    service.prompt_builder.build_prompt.assert_called_once_with(
        service.context_manager.prepare_context.return_value,
        "",
    )
    provider.generate_stream.assert_called_once_with(
        "normal conversation prompt",
        max_tokens=None,
        temperature=None,
    )