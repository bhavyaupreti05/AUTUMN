import os
import time
import fitz
import uuid
import sqlite3

os.environ["RAG_ENABLED"] = "true"

from src.config import settings
from src.services.document_service import DocumentService
from src.services.retrieval_service import RetrievalService
from src.database.document_repository import DocumentRepository
from fastapi import BackgroundTasks

def create_pdf(path: str, pages: int, keyword: str):
    doc = fitz.open()
    for i in range(pages):
        page = doc.new_page()
        text = f"This is page {i+1} of a {pages} page document.\n"
        if i == pages // 2:
            text += f"The critical keyword is {keyword}."
        page.insert_text(fitz.Point(50, 50), text)
    doc.save(path)
    doc.close()

def run_validation():
    repo = DocumentRepository()
    doc_service = DocumentService()
    retrieval_service = RetrievalService()

    # Create dummy conv
    conv_id = f"test-conv-{uuid.uuid4()}"
    from src.database.connection import get_connection
    with get_connection() as conn:
        try:
            conn.execute("INSERT INTO conversations (id, title) VALUES (?, ?)", (conv_id, "Validation Conv"))
        except sqlite3.IntegrityError:
            pass
        conn.commit()

    class FakeBackgroundTasks:
        def add_task(self, func, *args, **kwargs):
            func(*args, **kwargs)

    test_docs = [
        {"name": "small.pdf", "pages": 1, "keyword": "ALPHA-1"},
        {"name": "medium.pdf", "pages": 20, "keyword": "BETA-20"},
        {"name": "large.pdf", "pages": 50, "keyword": "GAMMA-50"},
    ]

    for td in test_docs:
        print(f"\n=== Testing {td['name']} ({td['pages']} pages) ===")
        create_pdf(td['name'], td['pages'], td['keyword'])
        
        with open(td['name'], "rb") as f:
            content = f.read()
            
        t0 = time.time()
        res = doc_service.process_uploaded_file(td['name'], content, FakeBackgroundTasks())
        t1 = time.time()
        doc_id = res["document"]["id"]
        print(f"Processed in {t1-t0:.2f}s")
        
        repo.associate_document_with_conversation(conv_id, doc_id)
        
        # Check Chroma
        res_chroma = retrieval_service.vector_store.collection.get(where={"document_id": doc_id})
        print(f"Chroma Vectors inserted: {len(res_chroma['ids'])}")
        assert len(res_chroma['ids']) > 0
        
        # Retrieval Test
        query = f"What is the critical keyword for {td['name']}?"
        context = retrieval_service.retrieve_context(query, conv_id)
        if td['keyword'] in context:
            print("SUCCESS: Keyword found in context.")
        else:
            print("FAILED: Keyword not found in context.")
            
        os.remove(td['name'])

if __name__ == "__main__":
    run_validation()
