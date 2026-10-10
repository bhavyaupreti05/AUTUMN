import sys
import os
import time

sys.path.append(os.path.abspath(os.path.dirname(__file__)))
os.environ["RAG_ENABLED"] = "true"

from src.database.connection import get_connection
from src.database.document_repository import DocumentRepository
from src.services.retrieval_service import RetrievalService
from src.core.embeddings import NomicEmbeddingProvider
from src.core.vector_store import ChromaVectorStore
from src.core.prompt_builder import PromptBuilder
from src.config import settings

def run_diagnostics():
    print("--- 1. VERIFY DOCUMENT STATE ---")
    repo = DocumentRepository()
    
    docs = repo.list_documents()
    dummy_docs = [d for d in docs if d["filename"] == "dummy1.pdf"]
    
    if not dummy_docs:
        print("ERROR: dummy1.pdf not found in SQLite.")
        return
        
    doc = dummy_docs[0]
    doc_id = doc["id"]
    print(f"Document ID: {doc_id}")
    print(f"Filename: {doc['filename']}")
    print(f"Status: {doc['status']}")
    print(f"Progress: {doc['progress']}")
    print(f"Page Count: {doc['page_count']}")
    print(f"SHA-256: {doc['sha256']}")
    
    print("\n--- 3. VERIFY SQLITE ---")
    chunks = repo.get_chunks(doc_id)
    print(f"Chunk Count in SQLite: {len(chunks)}")
    
    with get_connection() as conn:
        c = conn.cursor()
        c.execute("SELECT conversation_id FROM conversation_documents WHERE document_id = ?", (doc_id,))
        convs = c.fetchall()
        
    conv_ids = [r["conversation_id"] for r in convs]
    print(f"Associated Conversations: {conv_ids}")
    
    if not conv_ids:
        print("ERROR: No conversation associated.")
        return
        
    conv_id = conv_ids[0]
    
    print("\n--- 4. VERIFY CHROMA ---")
    vs = ChromaVectorStore(settings.CHROMA_DB_PATH)
    print(f"Collection Name: {vs.collection.name}")
    print(f"Total Vector Count: {vs.collection.count()}")
    
    res = vs.collection.get(where={"doc_id": doc_id})
    print(f"Vector Count for dummy1.pdf: {len(res['ids'])}")
    if len(res['ids']) > 0:
        print(f"Sample Metadata: {res['metadatas'][0]}")
    
    print("\n--- 5. TEST RETRIEVAL DIRECTLY ---")
    retrieval_service = RetrievalService()
    query = "What are the main topics discussed in dummy1.pdf?"
    print(f"Query: {query}")
    
    t0 = time.time()
    query_embedding = retrieval_service.embedding_provider.embed_query(query)
    t1 = time.time()
    print(f"Query embedding time: {t1-t0:.3f}s")
    
    filter_metadata = {"doc_id": {"$in": [doc_id]}}
    results = retrieval_service.vector_store.search(
        query_embedding=query_embedding,
        filter_metadata=filter_metadata,
        top_k=settings.RAG_TOP_K
    )
    print(f"Chroma candidates: {len(results)}")
    
    threshold_passed = 0
    for r in results:
        dist = r['distance']
        print(f"Candidate chunk_index: {r['metadata']['chunk_index']}, dist: {dist:.4f}")
        if dist <= settings.RAG_SIMILARITY_THRESHOLD:
            threshold_passed += 1
            
    print(f"Remaining after threshold: {threshold_passed}")
    
    context = retrieval_service.retrieve_context(query, conv_id)
    print(f"Retrieved context length: {len(context)}")
    print("--- RETRIEVED TEXT ---")
    print(context)
    print("----------------------")
    
    print("\n--- 8. TEST PROMPTBUILDER ---")
    pb = PromptBuilder()
    context_msgs = [{"role": "user", "content": query}]
    final_prompt = pb.build_prompt(context_msgs, context)
    if "RETRIEVED DOCUMENT CONTEXT" in final_prompt:
        print("YES, context section present.")
    else:
        print("NO, context section NOT present.")
        
    print("\n--- 11. TEST EXACT FACT QUERY ---")
    fact_query = "What is the exact secret code mentioned in the document?"
    context_fact = retrieval_service.retrieve_context(fact_query, conv_id)
    print(f"Retrieved context length for fact query: {len(context_fact)}")
    if len(context_fact) > 0:
        print("Fact context retrieved.")
    else:
        print("Fact context NOT retrieved.")

if __name__ == '__main__':
    run_diagnostics()
