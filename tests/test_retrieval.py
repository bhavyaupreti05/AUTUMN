import pytest
from src.services.retrieval_service import RetrievalService
from src.config import settings
from unittest.mock import patch, MagicMock

@pytest.fixture
def retrieval_service():
    with patch('src.services.retrieval_service.DocumentRepository') as mock_repo, \
         patch('src.services.retrieval_service.NomicEmbeddingProvider') as mock_embed, \
         patch('src.services.retrieval_service.ChromaVectorStore') as mock_vs:
        
        settings.RAG_ENABLED = True
        service = RetrievalService()
        
        # Setup mocks
        service.doc_repo = mock_repo.return_value
        service.embedding_provider = mock_embed.return_value
        service.vector_store = mock_vs.return_value
        
        yield service

def test_retrieve_context_scope_isolation(retrieval_service):
    # Setup mock to return only doc_A for conversation_A
    retrieval_service.doc_repo.get_conversation_documents.return_value = [{"id": "doc_A"}]
    
    # Mock embedding provider
    retrieval_service.embedding_provider.embed_query.return_value = [0.1, 0.2, 0.3]
    
    # Mock vector store search to check if filter was applied correctly
    def mock_search(*args, **kwargs):
        filter_meta = kwargs.get("filter_metadata")
        assert filter_meta == {"doc_id": {"$in": ["doc_A"]}}
        return []
    
    retrieval_service.vector_store.search.side_effect = mock_search
    
    retrieval_service.retrieve_context("test query", "conv_A")
    
    # Ensure vector store search was called
    assert retrieval_service.vector_store.search.called

def test_retrieve_context_no_documents(retrieval_service):
    # No associated documents
    retrieval_service.doc_repo.get_conversation_documents.return_value = []
    
    context = retrieval_service.retrieve_context("test query", "conv_A")
    
    assert context == ""
    # Should not call embeddings or vector store
    assert not retrieval_service.embedding_provider.embed_query.called
    assert not retrieval_service.vector_store.search.called

def test_rag_disabled(monkeypatch):
    monkeypatch.setattr("src.config.settings.RAG_ENABLED", False)
    service = RetrievalService()
    assert service.embedding_provider is None
    assert service.vector_store is None
    
    context = service.retrieve_context("test", "conv")
    assert context == ""

def test_retrieve_context_summary_bypass(retrieval_service):
    # Setup mock to return exactly one document, without a summary to test chunk fallback
    retrieval_service.doc_repo.get_conversation_documents.return_value = [{"id": "doc_A"}]
    retrieval_service.doc_repo.get_document.return_value = {"id": "doc_A", "summary": None}
    
    # Mock chunks in db
    retrieval_service.doc_repo.get_chunks.return_value = [
        {"chunk_index": 0, "page_start": 1, "page_end": 1, "text": "This is a full document chunk."},
        {"chunk_index": 1, "page_start": 1, "page_end": 2, "text": "This is the second chunk."}
    ]
    
    context = retrieval_service.retrieve_context("please summarize this document for me", "conv_A")
    
    # Ensure vector store search was completely bypassed
    assert not retrieval_service.vector_store.search.called
    assert not retrieval_service.embedding_provider.embed_query.called
    
    # Ensure all chunks are returned directly
    assert "This is a full document chunk." in context
    assert "This is the second chunk." in context

def test_retrieve_context_summary_direct(retrieval_service):
    # Setup mock to return exactly one document, WITH a summary
    retrieval_service.doc_repo.get_conversation_documents.return_value = [{"id": "doc_A"}]
    retrieval_service.doc_repo.get_document.return_value = {"id": "doc_A", "summary": "- Precomputed point"}
    
    context = retrieval_service.retrieve_context("please summarize this document for me", "conv_A")
    
    # Ensure it returns the pre-computed summary
    assert "Precomputed point" in context
    assert "Pre-computed Global Summary" in context


def test_retrieve_context_falls_back_when_semantic_match_is_too_strict(retrieval_service):
    retrieval_service.doc_repo.get_conversation_documents.return_value = [{"id": "doc_A"}]
    retrieval_service.doc_repo.get_chunks.return_value = [
        {"chunk_index": 0, "page_start": 1, "page_end": 1, "text": "The onboarding policy says managers must approve access within 48 hours."},
        {"chunk_index": 1, "page_start": 2, "page_end": 2, "text": "Emergency exceptions can be approved by the regional lead."},
    ]
    retrieval_service.embedding_provider.embed_query.return_value = [0.1, 0.2, 0.3]
    retrieval_service.vector_store.search.return_value = [
        {"distance": 0.8, "metadata": {"doc_id": "doc_A", "chunk_index": 0}},
    ]

    context = retrieval_service.retrieve_context("What is the approval deadline for emergency access exceptions?", "conv_A")

    assert "48 hours" in context
    assert "regional lead" in context


def test_retrieve_context_uses_configured_fallback_limit(retrieval_service, monkeypatch):
    monkeypatch.setattr(settings, "RAG_TOP_K", 6)
    retrieval_service.doc_repo.get_conversation_documents.return_value = [{"id": "doc_A"}]
    retrieval_service.doc_repo.get_chunks.return_value = [
        {"chunk_index": 0, "page_start": 1, "page_end": 1, "text": "Alpha chunk"},
        {"chunk_index": 1, "page_start": 1, "page_end": 1, "text": "Beta chunk"},
        {"chunk_index": 2, "page_start": 1, "page_end": 1, "text": "Gamma chunk"},
        {"chunk_index": 3, "page_start": 1, "page_end": 1, "text": "Delta chunk"},
        {"chunk_index": 4, "page_start": 1, "page_end": 1, "text": "Epsilon chunk"},
        {"chunk_index": 5, "page_start": 1, "page_end": 1, "text": "Zeta chunk"},
    ]
    retrieval_service.embedding_provider.embed_query.return_value = [0.1, 0.2, 0.3]
    retrieval_service.vector_store.search.return_value = [
        {"distance": 0.9, "metadata": {"doc_id": "doc_A", "chunk_index": 0}},
        {"distance": 0.88, "metadata": {"doc_id": "doc_A", "chunk_index": 1}},
        {"distance": 0.86, "metadata": {"doc_id": "doc_A", "chunk_index": 2}},
        {"distance": 0.84, "metadata": {"doc_id": "doc_A", "chunk_index": 3}},
        {"distance": 0.82, "metadata": {"doc_id": "doc_A", "chunk_index": 4}},
        {"distance": 0.8, "metadata": {"doc_id": "doc_A", "chunk_index": 5}},
    ]

    context = retrieval_service.retrieve_context("Find the relevant fact", "conv_A")

    assert "Alpha chunk" in context
    assert "Zeta chunk" in context


def test_extract_requested_pages(retrieval_service):
    assert retrieval_service._extract_requested_pages("what is on page 12?") == [12]
    assert retrieval_service._extract_requested_pages("pages 3 and 4") == [3, 4]
    assert retrieval_service._extract_requested_pages("summarize page 5-7 please") == [5, 6, 7]
    assert retrieval_service._extract_requested_pages("the third page is cool") == [3]
    assert retrieval_service._extract_requested_pages("what is on page 10 and page 12") == [10, 12]
    assert retrieval_service._extract_requested_pages("tell me about something") == []

def test_retrieve_context_prefers_keyword_overlap_when_distances_are_close(retrieval_service):
    retrieval_service.doc_repo.get_conversation_documents.return_value = [{"id": "doc_A"}]
    retrieval_service.doc_repo.get_chunks.return_value = [
        {"chunk_index": 0, "page_start": 1, "page_end": 1, "text": "The policy states emergency access exceptions require manager approval within 48 hours."},
        {"chunk_index": 1, "page_start": 1, "page_end": 1, "text": "General staff training is held every Monday morning and is unrelated to access requests."},
    ]
    retrieval_service.embedding_provider.embed_query.return_value = [0.1, 0.2, 0.3]
    retrieval_service.vector_store.search.return_value = [
        {"distance": 0.62, "document": "General staff training is held every Monday morning and is unrelated to access requests.", "metadata": {"doc_id": "doc_A", "chunk_index": 1}},
        {"distance": 0.59, "document": "The policy states emergency access exceptions require manager approval within 48 hours.", "metadata": {"doc_id": "doc_A", "chunk_index": 0}},
    ]

    context = retrieval_service.retrieve_context("What is the approval deadline for emergency access exceptions?", "conv_A")

    assert "48 hours" in context
    assert context.index("emergency access exceptions") < context.index("Monday morning")


def test_retrieve_context_prefers_exact_phrase_matches_over_generic_nearby_hits(retrieval_service):
    retrieval_service.doc_repo.get_conversation_documents.return_value = [{"id": "doc_A"}]
    retrieval_service.doc_repo.get_chunks.return_value = [
        {"chunk_index": 0, "page_start": 1, "page_end": 1, "text": "Emergency access is reviewed on Tuesday morning and is discussed in the staff handbook."},
        {"chunk_index": 10, "page_start": 1, "page_end": 1, "text": "The emergency access exceptions policy requires manager approval within 48 hours."},
    ]
    retrieval_service.embedding_provider.embed_query.return_value = [0.1, 0.2, 0.3]
    retrieval_service.vector_store.search.return_value = [
        {"distance": 0.57, "document": "Emergency access is reviewed on Tuesday morning and is discussed in the staff handbook.", "metadata": {"doc_id": "doc_A", "chunk_index": 0}},
        {"distance": 0.59, "document": "The emergency access exceptions policy requires manager approval within 48 hours.", "metadata": {"doc_id": "doc_A", "chunk_index": 10}},
    ]

    context = retrieval_service.retrieve_context("What is the deadline for emergency access exceptions?", "conv_A")

    assert "48 hours" in context
    assert "emergency access exceptions" in context
    assert context.index("48 hours") < context.index("Tuesday morning")


def test_retrieve_context_page_specific(retrieval_service):
    retrieval_service.doc_repo.get_conversation_documents.return_value = [{"id": "doc_A"}]
    retrieval_service.doc_repo.get_chunks.return_value = [
        {"chunk_index": 0, "page_start": 1, "page_end": 1, "page_number": 1, "text": "Page 1 chunk"},
        {"chunk_index": 1, "page_start": 2, "page_end": 2, "page_number": 2, "text": "Page 2 chunk"},
        {"chunk_index": 2, "page_start": 3, "page_end": 3, "page_number": 3, "text": "Page 3 chunk"}
    ]
    
    context = retrieval_service.retrieve_context("what is on page 2?", "conv_A")
    
    assert not retrieval_service.vector_store.search.called
    assert not retrieval_service.embedding_provider.embed_query.called
    assert "Page 2 chunk" in context
    assert "Page 1 chunk" not in context
    assert "Page 3 chunk" not in context

def test_retrieve_context_page_out_of_bounds(retrieval_service):
    retrieval_service.doc_repo.get_conversation_documents.return_value = [{"id": "doc_A"}]
    retrieval_service.doc_repo.get_chunks.return_value = [
        {"chunk_index": 0, "page_start": 1, "page_end": 1, "page_number": 1, "text": "Page 1 chunk"}
    ]
    
    # Fully out of bounds
    context = retrieval_service.retrieve_context("what is on page 50?", "conv_A")
    assert context == "The requested document(s) only have up to 1 pages."
    
    # Partially out of bounds
    context_partial = retrieval_service.retrieve_context("what is on page 1 and page 50?", "conv_A")
    assert "Page 1 chunk" in context_partial
    assert "[SYSTEM NOTE: Page(s) 50 were requested, but the document(s) only have up to 1 pages.]" in context_partial

def test_retrieve_context_page_old_document(retrieval_service):
    retrieval_service.doc_repo.get_conversation_documents.return_value = [{"id": "doc_old"}]
    retrieval_service.doc_repo.get_chunks.return_value = [
        # Note: missing page_number entirely to simulate old data
        {"chunk_index": 0, "page_start": 1, "page_end": 1, "text": "Old chunk"}
    ]
    
    context = retrieval_service.retrieve_context("what is on page 1?", "conv_A")
    assert "One or more of the provided documents do not support page-specific queries" in context
