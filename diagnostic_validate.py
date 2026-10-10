import os
import time

from src.config import settings
from src.services.document_service import DocumentService
from src.services.retrieval_service import RetrievalService
from src.database.document_repository import DocumentRepository
from fastapi import BackgroundTasks
import sqlite3

def run_validation():
    repo = DocumentRepository()
    doc_service = DocumentService()
    retrieval_service = RetrievalService()

    # 1. Clear old dummy1.pdf
    docs = repo.list_documents()
    for d in docs:
        if d["filename"] == "dummy1.pdf":
            doc_service.delete_document(d["id"])
            
    # 2. Upload a new dummy1.pdf
    dummy_pdf_content = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 53 >>\nstream\nBT /F1 12 Tf 72 712 Td (The secret code is OMEGA-99. The main topics are AI.) Tj ET\nendstream\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF"
    
    class FakeBackgroundTasks:
        def add_task(self, func, *args, **kwargs):
            func(*args, **kwargs)

    res = doc_service.process_uploaded_file("dummy1.pdf", dummy_pdf_content, FakeBackgroundTasks())
    doc_id = res["document"]["id"]
    
    conv_id_A = "conv-A-123"
    conv_id_B = "conv-B-456"
    
    # insert dummy conv to avoid foreign key failure
    from src.database.connection import get_connection
    with get_connection() as conn:
        try:
            conn.execute("INSERT INTO conversations (id, title) VALUES (?, ?)", (conv_id_A, "Test A"))
        except sqlite3.IntegrityError:
            pass
        try:
            conn.execute("INSERT INTO conversations (id, title) VALUES (?, ?)", (conv_id_B, "Test B"))
        except sqlite3.IntegrityError:
            pass
        conn.commit()
    
    repo.associate_document_with_conversation(conv_id_A, doc_id)
    
    print("\n--- 1. dummy1.pdf exact-fact query ---")
    query1 = "What is the secret code?"
    context1 = retrieval_service.retrieve_context(query1, conv_id_A)
    print(f"Retrieved: {context1[:100]}...")

    print("\n--- 2. dummy1.pdf summary query ---")
    query2 = "What are the main topics discussed in dummy1.pdf?"
    context2 = retrieval_service.retrieve_context(query2, conv_id_A)
    print(f"Retrieved: {context2[:100]}...")

    print("\n--- 3. answer-not-present query ---")
    query3 = "What is the distance to the moon?"
    context3 = retrieval_service.retrieve_context(query3, conv_id_A)
    if not context3:
        print("Empty context (Correct, threshold filtered it out)")
    else:
        print("Warning: Context retrieved for unrelated query")

    print("\n--- 4. cross-conversation isolation ---")
    context4 = retrieval_service.retrieve_context(query1, conv_id_B)
    if not context4:
        print("Empty context (Correct, isolated)")
    else:
        print("Warning: Isolation failed")
        
    print("\n--- 5. document deletion ---")
    doc_service.delete_document(doc_id)
    res_chroma = retrieval_service.vector_store.collection.get(where={"doc_id": doc_id})
    print(f"Chroma Vectors after deletion: {len(res_chroma['ids'])} (should be 0)")

if __name__ == "__main__":
    run_validation()
