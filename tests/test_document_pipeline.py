import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch
import os
import shutil
import fitz
import csv
from openpyxl import Workbook

from src.api.main import app
from src.database.connection import get_connection
from src.database.document_repository import DocumentRepository
from src.services.document_service import DocumentService
from src.config import settings

client = TestClient(app)

@pytest.fixture(autouse=True)
def mock_chat_service():
    with patch("src.api.routes.get_chat_service") as mock_get_chat_service:
        mock_provider = MagicMock()
        mock_provider.generate_stream.return_value = [{"type": "text", "content": "- Mocked summary bullet point"}]
        mock_chat_svc = MagicMock()
        mock_chat_svc.provider = mock_provider
        mock_get_chat_service.return_value = mock_chat_svc
        yield mock_get_chat_service

@pytest.fixture(autouse=True)
def setup_db():
    # Setup
    os.makedirs(settings.DOCUMENTS_DIR, exist_ok=True)
    yield
    # Teardown
    with get_connection() as conn:
        conn.execute("DELETE FROM conversation_documents")
        conn.execute("DELETE FROM document_chunks")
        conn.execute("DELETE FROM documents")
        conn.execute("DELETE FROM messages")
        conn.execute("DELETE FROM conversations")
        conn.commit()
    if os.path.exists(settings.DOCUMENTS_DIR):
        shutil.rmtree(settings.DOCUMENTS_DIR)

def create_dummy_pdf(path: str, text: str):
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text(fitz.Point(100, 100), text)
    doc.save(path)
    doc.close()

def test_upload_and_extract_pdf():
    pdf_path = "temp_test.pdf"
    create_dummy_pdf(pdf_path, "This is a dummy test PDF for extraction and chunking.")
    
    with open(pdf_path, "rb") as f:
        res = client.post("/api/documents", files={"file": ("test.pdf", f, "application/pdf")})
        
    os.remove(pdf_path)
    
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "processing"
    assert "document" in data
    doc_id = data["document"]["id"]
    
    # Check chunks
    repo = DocumentRepository()
    chunks = repo.get_chunks(doc_id)
    assert len(chunks) > 0
    assert "dummy test PDF" in chunks[0]["text"]


def test_extract_csv_content(tmp_path):
    csv_path = tmp_path / "facts.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as source:
        csv.writer(source).writerows([["Name", "Role"], ["Asha", "Engineer"]])

    pages, page_count = DocumentService.__new__(DocumentService)._extract_text(str(csv_path))

    assert page_count == 1
    assert "Name | Role" in pages[0][1]
    assert "Asha | Engineer" in pages[0][1]


def test_extract_xlsx_content(tmp_path):
    xlsx_path = tmp_path / "facts.xlsx"
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "People"
    sheet.append(["Name", "Role"])
    sheet.append(["Asha", "Engineer"])
    workbook.save(xlsx_path)
    workbook.close()

    pages, page_count = DocumentService.__new__(DocumentService)._extract_text(str(xlsx_path))

    assert page_count == 1
    assert "[People]" in pages[0][1]
    assert "Asha | Engineer" in pages[0][1]

def test_duplicate_upload_caching():
    pdf_path = "temp_duplicate.pdf"
    create_dummy_pdf(pdf_path, "Duplicate detection test.")
    
    # Upload 1
    with open(pdf_path, "rb") as f:
        res1 = client.post("/api/documents", files={"file": ("test1.pdf", f, "application/pdf")})
        
    # Upload 2
    with open(pdf_path, "rb") as f:
        res2 = client.post("/api/documents", files={"file": ("test2.pdf", f, "application/pdf")})
        
    os.remove(pdf_path)
    
    assert res1.status_code == 200
    assert res2.status_code == 200
    
    doc1 = res1.json()
    doc2 = res2.json()

    assert doc1["document"]["id"] == doc2["document"]["id"]
    assert doc1["status"] == "processing"
    assert doc2["status"] in ("reused", "processing_already")

def test_conversation_association():
    # Create conversation
    res_conv = client.post("/api/conversations", json={"title": "Doc Test"})
    conv_id = res_conv.json()["id"]
    
    # Create Doc
    pdf_path = "temp_assoc.pdf"
    create_dummy_pdf(pdf_path, "Association test.")
    with open(pdf_path, "rb") as f:
        res_doc = client.post("/api/documents", files={"file": ("assoc.pdf", f, "application/pdf")})
    os.remove(pdf_path)
    doc_id = res_doc.json()["document"]["id"]
    
    # Attach
    res_attach = client.post(f"/api/conversations/{conv_id}/documents", json={"document_id": doc_id})
    assert res_attach.status_code == 200
    
    # List Attached
    res_list = client.get(f"/api/conversations/{conv_id}/documents")
    docs = res_list.json()["documents"]
    assert len(docs) == 1
    assert docs[0]["id"] == doc_id
    
    # Detach
    res_detach = client.delete(f"/api/conversations/{conv_id}/documents/{doc_id}")
    assert res_detach.status_code == 200
    
    res_list2 = client.get(f"/api/conversations/{conv_id}/documents")
    assert len(res_list2.json()["documents"]) == 0

def test_rag_enabled_states(monkeypatch):
    pdf_path = "temp_rag_state.pdf"
    create_dummy_pdf(pdf_path, "Testing RAG states.")
    repo = DocumentRepository()

    # Test with RAG_ENABLED=False
    monkeypatch.setattr("src.config.settings.RAG_ENABLED", False)
    with open(pdf_path, "rb") as f:
        res_false = client.post("/api/documents", files={"file": ("test_false.pdf", f, "application/pdf")})
    assert res_false.status_code == 200
    doc_id_false = res_false.json()["document"]["id"]
    doc_false = repo.get_document(doc_id_false)
    assert doc_false["status"] == "PROCESSED_NO_RAG"

    # Clean up first doc
    repo.delete_document(doc_id_false)

    # Test with RAG_ENABLED=True
    import src.services.retrieval_service
    src.services.retrieval_service._shared_service = None
    monkeypatch.setattr("src.config.settings.RAG_ENABLED", True)
    with open(pdf_path, "rb") as f:
        res_true = client.post("/api/documents", files={"file": ("test_true.pdf", f, "application/pdf")})
    assert res_true.status_code == 200
    doc_id_true = res_true.json()["document"]["id"]
    doc_true = repo.get_document(doc_id_true)
    assert doc_true["status"] == "READY"

    os.remove(pdf_path)

def test_rag_summary_bypass_integration(monkeypatch):
    monkeypatch.setattr("src.config.settings.RAG_ENABLED", True)
    
    # Create conversation
    res_conv = client.post("/api/conversations", json={"title": "Summary Test"})
    conv_id = res_conv.json()["id"]
    
    # Upload doc
    pdf_path = "temp_summary_bypass.pdf"
    create_dummy_pdf(pdf_path, "This is a specific test document containing information about XSS vulnerabilities.")
    with open(pdf_path, "rb") as f:
        res_doc = client.post("/api/documents", files={"file": ("summary.pdf", f, "application/pdf")})
    os.remove(pdf_path)
    doc_id = res_doc.json()["document"]["id"]
    
    # Attach
    client.post(f"/api/conversations/{conv_id}/documents", json={"document_id": doc_id})
    
    # Because LLM is external, we will mock the LLM Provider and just assert that the prompt builder
    # received the entire text context and not an empty string or generic string.
    with patch("src.services.chat_service.LLMProvider") as MockLLM:
        mock_instance = MockLLM.return_value
        mock_instance.generate_stream.return_value = [{"type": "text", "content": "Summary generated."}, {"type": "status", "status": "COMPLETED"}]
        
        with patch("src.core.prompt_builder.PromptBuilder.build_prompt") as mock_build_prompt:
            mock_build_prompt.return_value = "mock prompt"
            
            from src.services.chat_service import ChatService
            chat_service = ChatService(mock_instance)
            
            # Use list() to consume the generator
            list(chat_service.generate_chat_response("summarize this document", conv_id))
            
            # Verify build_prompt was called with the context containing our text
            assert mock_build_prompt.called
            call_args = mock_build_prompt.call_args
            context_messages = call_args[0][0]
            retrieved_context = call_args[0][1]
            
            # The retrieved context should now contain the pre-computed summary, not the raw chunks
            assert "- Mocked summary bullet point" in retrieved_context
            
            # It should not be empty
            assert len(retrieved_context) > 0
