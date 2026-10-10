import os
os.environ["RAG_ENABLED"] = "true"

from src.services.retrieval_service import RetrievalService

def run():
    retrieval_service = RetrievalService()
    
    queries = [
        "How much can I expense for reimbursement?",
        "What approval process applies to international reimbursement claims?",
        "What are the main topics discussed in this document?",
        "What is the population of Mars?"
    ]
    
    for q in queries:
        query_embedding = retrieval_service.embedding_provider.embed_query(q)
        results = retrieval_service.vector_store.collection.query(
            query_embeddings=[query_embedding],
            n_results=3,
            include=["documents", "metadatas", "distances"]
        )
        print(f"\nQuery: {q}")
        if results['distances'] and results['distances'][0]:
            print(f"Distances: {results['distances'][0]}")

if __name__ == "__main__":
    run()
