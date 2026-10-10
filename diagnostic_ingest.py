import os
import time

os.environ["RAG_ENABLED"] = "true"

from src.config import settings
from src.services.document_service import DocumentService
from src.services.retrieval_service import RetrievalService
from src.database.document_repository import DocumentRepository
from fastapi import BackgroundTasks

def run_fix_test():
    repo = DocumentRepository()
    doc_service = DocumentService()
    retrieval_service = RetrievalService()

    # 1. Clear old dummy1.pdf
    docs = repo.list_documents()
    for d in docs:
        if d["filename"] == "dummy1.pdf":
            doc_service.delete_document(d["id"])
            print(f"Deleted old doc: {d['id']}")
            
    # 2. Upload a new dummy1.pdf
    dummy_pdf_content = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 53 >>\nstream\nBT /F1 12 Tf 72 712 Td (The secret code is OMEGA-99. The main topics are AI.) Tj ET\nendstream\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF"
    
    class FakeBackgroundTasks:
        def add_task(self, func, *args, **kwargs):
            print("Running background task synchronously for testing...")
            func(*args, **kwargs)

    res = doc_service.process_uploaded_file("dummy1.pdf", dummy_pdf_content, FakeBackgroundTasks())
    doc_id = res["document"]["id"]
    print(f"Uploaded new doc: {doc_id}")
    
    # 3. Associate with conversation
    conv_id = "test-conv-123"
    repo.associate_document_with_conversation(conv_id, doc_id)
    
    # 4. Check vector DB
    res_chroma = retrieval_service.vector_store.collection.get(where={"doc_id": doc_id})
    print(f"Chroma Vectors: {len(res_chroma['ids'])}")
    
    # 5. Retrieve
    query = "What are the main topics discussed in dummy1.pdf?"
    context = retrieval_service.retrieve_context(query, conv_id)
    print(f"Retrieved context length: {len(context)}")
    print("--- RETRIEVED TEXT ---")
    print(context)
    
    fact_query = "What is the secret code?"
    context_fact = retrieval_service.retrieve_context(fact_query, conv_id)
    print(f"Fact context length: {len(context_fact)}")
    print("--- FACT TEXT ---")
    print(context_fact)

if __name__ == "__main__":
    run_fix_test()
