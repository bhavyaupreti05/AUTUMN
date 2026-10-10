import pytest
from src.core.embeddings import NomicEmbeddingProvider

@pytest.fixture
def provider():
    return NomicEmbeddingProvider()

def test_embed_query(provider):
    query = "What framework does this project use?"
    embedding = provider.embed_query(query)
    
    assert embedding is not None
    assert isinstance(embedding, list)
    assert len(embedding) == 768  # Nomic default dimension

def test_embed_texts(provider):
    texts = ["First chunk of text.", "Second chunk of text."]
    embeddings = provider.embed_texts(texts)
    
    assert embeddings is not None
    assert isinstance(embeddings, list)
    assert len(embeddings) == 2
    assert len(embeddings[0]) == 768
    assert len(embeddings[1]) == 768

def test_deterministic_behavior(provider):
    text = "Deterministic behavior test."
    embed1 = provider.embed_query(text)
    embed2 = provider.embed_query(text)
    
    # Should be identical
    assert embed1 == embed2
