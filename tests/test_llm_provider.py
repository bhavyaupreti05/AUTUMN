import pytest
from unittest.mock import MagicMock, patch
from src.llm.provider import QwenProvider
from src.config import settings

@patch("src.llm.provider.Llama")
def test_qwen_provider_health(mock_llama):
    # Setup mock
    mock_llama.return_value = MagicMock()
    
    provider = QwenProvider()
    assert provider.health_check() is True

@patch("src.llm.provider.Llama")
def test_qwen_provider_generation(mock_llama):
    mock_instance = MagicMock()
    # Mock stream response
    mock_instance.return_value = [
        {"choices": [{"text": "Hello "}]},
        {"choices": [{"text": "World"}]}
    ]
    mock_llama.return_value = mock_instance
    
    provider = QwenProvider()
    stream = provider.generate_stream("Say Hello World")
    
    result = [item for item in stream if item.get("type") == "text"]
    assert result[0]["content"] == "Hello "

def test_groq_provider_parsing():
    from src.llm.provider import GroqProvider
    provider = GroqProvider(api_key="gsk_test")
    prompt = "<|im_start|>system\nYou are a consultant.<|im_end|>\n<|im_start|>user\nWhat is EBITDA?<|im_end|>\n<|im_start|>assistant\n"
    messages = provider._parse_prompt_to_messages(prompt)
    assert len(messages) == 2
    assert messages[0] == {"role": "system", "content": "You are a consultant."}
    assert messages[1] == {"role": "user", "content": "What is EBITDA?"}

def test_groq_provider_stream():
    from src.llm.provider import GroqProvider
    provider = GroqProvider(api_key="gsk_test", model="llama-3.3-70b-versatile")
    
    fake_sse_lines = [
        b'data: {"choices":[{"delta":{"content":"EBITDA "}}]}\n',
        b'data: {"choices":[{"delta":{"content":"is earnings."},"finish_reason":"stop"}]}\n',
        b'data: [DONE]\n'
    ]
    
    class FakeResponse:
        status_code = 200
        def iter_lines(self):
            for l in fake_sse_lines:
                yield l.decode("utf-8")
        def __enter__(self):
            return self
        def __exit__(self, *args):
            pass

    class FakeClient:
        def stream(self, *args, **kwargs):
            return FakeResponse()
        def __enter__(self):
            return self
        def __exit__(self, *args):
            pass

    with patch("httpx.Client", return_value=FakeClient()):
        stream = list(provider.generate_stream("Explain EBITDA"))
        text_chunks = [item["content"] for item in stream if item.get("type") == "text"]
        assert "".join(text_chunks) == "EBITDA is earnings."
        status_items = [item for item in stream if item.get("type") == "status"]
        assert status_items[0]["status"] == "COMPLETED"

def test_get_llm_provider_factory():
    from src.llm.provider import get_llm_provider, GroqProvider, QwenProvider
    with patch.object(settings, "LLM_PROVIDER", "groq"), patch.object(settings, "GROQ_API_KEY", "gsk_test"):
        provider = get_llm_provider()
        assert isinstance(provider, GroqProvider)
