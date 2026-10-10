import pytest
import os
import shutil
from src.core.vector_store import ChromaVectorStore

@pytest.fixture
def vector_store(tmp_path):
    persist_dir = os.path.join(tmp_path, "chroma")
    vs = ChromaVectorStore(persist_directory=persist_dir, collection_name="test_docs")
    yield vs
    if os.path.exists(persist_dir):
        shutil.rmtree(persist_dir, ignore_errors=True)

def test_add_and_search(vector_store):
    chunks = [
        {"doc_id": "doc1", "chunk_index": 0, "page_start": 1, "page_end": 1, "text": "This is a test chunk about apples."},
        {"doc_id": "doc1", "chunk_index": 1, "page_start": 1, "page_end": 1, "text": "This is another test chunk about bananas."},
        {"doc_id": "doc2", "chunk_index": 0, "page_start": 1, "page_end": 1, "text": "This chunk is about cars."}
    ]
    
    # Mock embeddings (dimensions must match query)
    embeddings = [
        [0.1, 0.2, 0.3],
        [0.1, 0.9, 0.3],
        [0.9, 0.2, 0.3]
    ]
    
    vector_store.add_chunks(chunks, embeddings)
    
    query_embed = [0.1, 0.2, 0.35]
    results = vector_store.search(query_embed, top_k=2)
    
    assert len(results) == 2
    # doc1 chunk 0 should be closest
    assert results[0]['metadata']['doc_id'] == "doc1"
    assert results[0]['metadata']['chunk_index'] == 0

def test_delete_document(vector_store):
    chunks = [
        {"doc_id": "doc1", "chunk_index": 0, "page_start": 1, "page_end": 1, "text": "chunk 1"},
        {"doc_id": "doc2", "chunk_index": 0, "page_start": 1, "page_end": 1, "text": "chunk 2"}
    ]
    embeddings = [[0.1, 0.2], [0.3, 0.4]]
    
    vector_store.add_chunks(chunks, embeddings)
    
    vector_store.delete_document("doc1")
    
    # Search for anything, should only return doc2
    results = vector_store.search([0.1, 0.2], top_k=5)
    assert len(results) == 1
    assert results[0]['metadata']['doc_id'] == "doc2"

def test_metadata_filtering(vector_store):
    chunks = [
        {"doc_id": "doc1", "chunk_index": 0, "page_start": 1, "page_end": 1, "text": "chunk 1"},
        {"doc_id": "doc2", "chunk_index": 0, "page_start": 1, "page_end": 1, "text": "chunk 2"}
    ]
    embeddings = [[0.1, 0.2], [0.1, 0.21]]
    
    vector_store.add_chunks(chunks, embeddings)
    
    results = vector_store.search([0.1, 0.2], filter_metadata={"doc_id": "doc2"}, top_k=2)
    assert len(results) == 1
    assert results[0]['metadata']['doc_id'] == "doc2"
