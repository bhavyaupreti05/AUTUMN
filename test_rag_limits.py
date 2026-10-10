import asyncio
from src.services.retrieval_service import get_retrieval_service
from src.database.document_repository import DocumentRepository
from src.config import settings

def run_test():
    repo = DocumentRepository()
    docs = repo.list_documents()
    
    if not docs:
        print("No documents found to test with.")
        return
        
    doc_ids = [d["id"] for d in docs]
    print(f"Testing with {len(doc_ids)} documents.")
    
    service = get_retrieval_service()
    query = "What is the summary of the financial data?"
    
    # Simulate old settings
    settings.RAG_TOP_K = 10
    settings.RAG_MAX_CHARS = 3200
    old_context = service.retrieve_context(query, doc_ids)
    
    # Simulate new settings
    settings.RAG_TOP_K = 15
    settings.RAG_MAX_CHARS = 12000
    new_context = service.retrieve_context(query, doc_ids)
    
    print("\n--- RESULTS ---")
    print("OLD CONFIGURATION (Max 3200 chars):")
    print(f"Characters Retrieved: {len(old_context)}")
    print(f"Number of Chunks: {old_context.count('[Document:')}")
    
    print("\nNEW CONFIGURATION (Max 12000 chars):")
    print(f"Characters Retrieved: {len(new_context)}")
    print(f"Number of Chunks: {new_context.count('[Document:')}")

if __name__ == "__main__":
    run_test()
