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
