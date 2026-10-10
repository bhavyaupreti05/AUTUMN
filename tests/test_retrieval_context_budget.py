from unittest.mock import patch

import pytest

from src.config import settings
from src.services.retrieval_service import RetrievalService


@pytest.fixture
def retrieval_service():
    with patch('src.services.retrieval_service.DocumentRepository') as mock_repo, \
         patch('src.services.retrieval_service.NomicEmbeddingProvider') as mock_embed, \
         patch('src.services.retrieval_service.ChromaVectorStore') as mock_vs:
        settings.RAG_ENABLED = True
        service = RetrievalService()
        service.doc_repo = mock_repo.return_value
        service.embedding_provider = mock_embed.return_value
        service.vector_store = mock_vs.return_value
        yield service


def test_oversized_merged_block_returns_truncated_context(retrieval_service, monkeypatch):
    service = retrieval_service
    monkeypatch.setattr(settings, "RAG_MAX_CHARS", 180)
    service.doc_repo.get_conversation_documents.return_value = [{"id": "doc_A"}]
    service.embedding_provider.embed_query.return_value = [0.1, 0.2, 0.3]
    service.vector_store.search.return_value = [{
        "id": "chunk-1",
        "text": "Relevant result",
        "metadata": {"doc_id": "doc_A", "chunk_index": 1},
        "distance": 0.1,
    }]
    service.doc_repo.get_chunks.return_value = [
        {"chunk_index": 0, "page_start": 1, "page_end": 1, "text": "Relevant fact from the uploaded document. " + "x" * 120},
        {"chunk_index": 1, "page_start": 1, "page_end": 1, "text": "Additional context. " + "y" * 120},
        {"chunk_index": 2, "page_start": 1, "page_end": 1, "text": "More context. " + "z" * 120},
    ]

    context = service.retrieve_context("find the relevant fact", "conv_A")

    assert context
    assert len(context) <= settings.RAG_MAX_CHARS
    assert "[Document: doc_A | Page 1]" in context
    assert "Relevant fact from the uploaded document." in context
    assert "[...truncated]" in context


def test_normal_size_block_keeps_existing_output(retrieval_service, monkeypatch):
    service = retrieval_service
    monkeypatch.setattr(settings, "RAG_MAX_CHARS", 1000)
    service.doc_repo.get_conversation_documents.return_value = [{"id": "doc_A"}]
    service.embedding_provider.embed_query.return_value = [0.1, 0.2, 0.3]
    service.vector_store.search.return_value = [{
        "id": "chunk-0",
        "text": "Relevant result",
        "metadata": {"doc_id": "doc_A", "chunk_index": 0},
        "distance": 0.1,
    }]
    service.doc_repo.get_chunks.return_value = [
        {"chunk_index": 0, "page_start": 1, "page_end": 1, "text": "Relevant fact."},
    ]

    context = service.retrieve_context("find the relevant fact", "conv_A")

    assert context == "[Document: doc_A | Page 1]\nRelevant fact.\n"