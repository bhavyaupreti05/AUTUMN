import json
import time
import os
import sys
import asyncio
from fastapi import BackgroundTasks

# Ensure project root is in path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.config import settings
from src.database.connection import init_db
from src.database.repository import ConversationRepository
from src.database.document_repository import DocumentRepository
from src.services.document_service import DocumentService
from src.services.retrieval_service import RetrievalService

def run_retrieval_benchmark():
    init_db()
    repo = ConversationRepository()
    doc_repo = DocumentRepository()
    
    # Force initialize RAG components without LLM BEFORE initializing services
    settings.RAG_ENABLED = True
    
    doc_service = DocumentService()
    retrieval_service = doc_service.retrieval_service # Use the same one
    
    print("Loading test PDF to measure raw retrieval capabilities...")
    pdf_path = "data/test/phase12_synthetic_20page.pdf"
    
    import hashlib
    with open(pdf_path, "rb") as f:
        content = f.read()
    
    sha256 = hashlib.sha256(content).hexdigest()
    old_doc = doc_repo.get_document_by_hash(sha256)
    if old_doc:
        doc_service.delete_document(old_doc['id'])
        print("Deleted old cached document to force fresh ingestion.")
        
    start = time.time()
    background_tasks = BackgroundTasks()
    doc_result = doc_service.process_uploaded_file(
        "phase12_synthetic_20page.pdf",
        content,
        background_tasks,
    )
    asyncio.run(background_tasks())
    doc_id = doc_result["document"]["id"]
    status = doc_result["status"]
    
    chunks_in_db = doc_repo.get_chunks(doc_id)
    print(f"Ingestion completed in {time.time()-start:.2f}s (Status: {status})")
    print(f"Chunks actually stored in SQLite: {len(chunks_in_db)}")
    
    # Associate to a test conversation
    conv_id = repo.create_conversation(title="Retrieval Test")
    doc_repo.associate_document_with_conversation(conv_id, doc_id)
    
    # Load questions
    with open("benchmarks/phase12_questions.json", "r") as f:
        questions = json.load(f)
        
    # We want to measure the exact distance Chroma returns for the absolute best matching chunk.
    # To do this, we bypass the RAG_SIMILARITY_THRESHOLD by temporarily setting it to 2.0 (accept all)
    # and fetching TOP_K = 10 to see where the correct chunk lands.
    
    original_threshold = settings.RAG_SIMILARITY_THRESHOLD
    original_top_k = settings.RAG_TOP_K
    
    settings.RAG_SIMILARITY_THRESHOLD = 2.0
    settings.RAG_TOP_K = original_top_k
    
    print("\n--- RAW DISTANCE MEASUREMENT ---")
    distances_for_correct = []
    application_hits = 0
    application_total = 0
    
    for q_data in questions:
        query = q_data["q"]
        expected = q_data["expected"]
        cat = q_data["category"]
        
        # We manually query the vector store to inspect exact distances
        if expected == "UNSUPPORTED":
            continue

        application_total += 1
        application_context = retrieval_service.retrieve_context(query, conv_id)
        if expected.lower() in application_context.lower():
            application_hits += 1
            
        associated_docs = doc_repo.get_conversation_documents(conv_id)
        doc_ids = [d['id'] for d in associated_docs]
        query_embedding = retrieval_service.embedding_provider.embed_query(query)
        results = retrieval_service.vector_store.search(
            query_embedding=query_embedding,
            filter_metadata={"doc_id": {"$in": doc_ids}},
            top_k=settings.RAG_TOP_K
        )
        
        # Check if the expected string is in the top 1 result
        top_1_distance = results[0]['distance'] if results else None
        
        # Find which result actually contained the expected string
        found_at_rank = None
        found_distance = None
        for rank, res in enumerate(results):
            if expected.lower() in res['text'].lower() or any(word in res['text'].lower() for word in expected.split()):
                found_at_rank = rank + 1
                found_distance = res['distance']
                break
                
        print(f"[{cat}] Q: {query[:40]}... | Found at Rank: {found_at_rank} | Distance: {found_distance} | Top 1 Distance: {top_1_distance}")
        if found_distance is not None:
            distances_for_correct.append(found_distance)

    print(f"\n--- APPLICATION RETRIEVAL SCORE ---\nExpected answers recovered from retrieve_context: {application_hits}/{application_total} ({application_hits / application_total * 100:.1f}%)")
            
    if distances_for_correct:
        avg_dist = sum(distances_for_correct) / len(distances_for_correct)
        max_dist = max(distances_for_correct)
        min_dist = min(distances_for_correct)
        print(f"\nDistances for successful matches - Avg: {avg_dist:.4f} | Min: {min_dist:.4f} | Max: {max_dist:.4f}")
        
        # Test what Hit@1 and Recall@3 would be for different thresholds
        print("\n--- THRESHOLD A/B TESTING ---")
        thresholds_to_test = [0.45, 0.50, 0.55, 0.60, 0.65, 0.70, 0.80]
        
        for t in thresholds_to_test:
            recovered_count = sum(1 for d in distances_for_correct if d <= t)
            recall = recovered_count / len(distances_for_correct) * 100
            print(f"Threshold <= {t:.2f} | Recall@5: {recall:.1f}%")
            
    # Reset config
    settings.RAG_SIMILARITY_THRESHOLD = original_threshold
    settings.RAG_TOP_K = original_top_k

if __name__ == "__main__":
    run_retrieval_benchmark()
