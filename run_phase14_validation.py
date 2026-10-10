import os
import time
import json
import fitz
import uuid
import re
from fastapi.testclient import TestClient

os.environ["RAG_ENABLED"] = "true"

from src.api.main import app
from src.database.connection import get_connection
from src.database.document_repository import DocumentRepository
from src.services.retrieval_service import RetrievalService
from src.config import settings

client = TestClient(app)

def create_pdf(path: str, pages: int, text_chunks: list):
    doc = fitz.open()
    for i in range(pages):
        page = doc.new_page()
        text = f"--- Page {i+1} ---\n"
        if i < len(text_chunks):
            text += text_chunks[i]
        page.insert_text(fitz.Point(50, 50), text)
    doc.save(path)
    doc.close()

def wait_for_document_ready(doc_id: str, timeout=60):
    repo = DocumentRepository()
    t0 = time.time()
    while time.time() - t0 < timeout:
        doc = repo.get_document(doc_id)
        if doc and doc["status"] == "READY":
            return True
        time.sleep(1)
    return False

def stream_chat(conv_id: str, message: str) -> tuple[str, float, float]:
    """Returns (response, ttft, end_to_end_latency)"""
    t_start = time.time()
    ttft = 0.0
    full_response = ""
    
    with client.stream("POST", "/api/chat", json={"conversation_id": conv_id, "message": message}) as response:
        for line in response.iter_lines():
            if line.startswith("data: "):
                data = line[6:]
                if data == "[DONE]":
                    break
                try:
                    payload = json.loads(data)
                    chunk = payload.get("chunk", "")
                    if chunk and ttft == 0.0:
                        ttft = time.time() - t_start
                    full_response += chunk
                except json.JSONDecodeError:
                    pass
                    
    total_time = time.time() - t_start
    if ttft == 0.0:
        ttft = total_time
    return full_response.strip(), ttft, total_time

def run_tests():
    print("=== Phase 14 Conversational RAG Validation ===")
    repo = DocumentRepository()
    retrieval_service = RetrievalService()
    
    # 1. Corpus Generation
    docA_text = [
        "Company Policy: Reimbursement limit is $1500.",
        "Manager approval is required above $500.",
        "International travel requires director approval.",
        "Submission deadline is 30 days. Expense categories include travel, lodging, and meals."
    ]
    docB_text = [
        "Technical Manual: Error E-77 indicates database synchronization failure.",
        "Recovery procedure is to restart synchronization service.",
        "Retry interval is 30 seconds. Maximum retry count is 5.",
        "Backup procedure: daily incremental backup."
    ]
    docC_text = [
        "Project Architecture: Backend uses FastAPI.",
        "Database is SQLite. Vector database is ChromaDB.",
        "Embedding model is nomic-embed-text-v1.5.",
        "LLM is Qwen2.5 3B Instruct."
    ]
    
    create_pdf("docA.pdf", 25, docA_text)
    create_pdf("docB.pdf", 45, docB_text)
    create_pdf("docC.pdf", 25, docC_text)
    
    # Upload and initialize conversations
    convA = client.post("/api/conversations", json={"title": "Conv A"}).json()["id"]
    convB = client.post("/api/conversations", json={"title": "Conv B"}).json()["id"]
    convC = client.post("/api/conversations", json={"title": "Conv C"}).json()["id"]
    
    print("\n[+] Uploading documents...")
    with open("docA.pdf", "rb") as f:
        docA_id = client.post("/api/documents", files={"file": ("docA.pdf", f, "application/pdf")}).json()["document"]["id"]
    with open("docB.pdf", "rb") as f:
        docB_id = client.post("/api/documents", files={"file": ("docB.pdf", f, "application/pdf")}).json()["document"]["id"]
    with open("docC.pdf", "rb") as f:
        docC_id = client.post("/api/documents", files={"file": ("docC.pdf", f, "application/pdf")}).json()["document"]["id"]
        
    wait_for_document_ready(docA_id)
    wait_for_document_ready(docB_id)
    wait_for_document_ready(docC_id)
    print("[+] Documents ready.")
    
    client.post(f"/api/conversations/{convA}/documents", json={"document_id": docA_id})
    client.post(f"/api/conversations/{convB}/documents", json={"document_id": docB_id})
    client.post(f"/api/conversations/{convC}/documents", json={"document_id": docC_id})
    
    metrics = {
        "direct": {"correct": 0, "total": 0},
        "unrelated": {"irrelevant_injection": 0, "total": 0, "correct_bypass": 0},
        "absent": {"refused": 0, "total": 0}
    }
    
    def log_result(cat, query, expected_in, resp, context_len):
        print(f"\n--- Category: {cat} ---")
        print(f"Q: {query}")
        print(f"Ctx Length: {context_len}")
        print(f"A: {resp}")
        success = False
        if isinstance(expected_in, list):
            success = any(e.lower() in resp.lower() for e in expected_in)
        else:
            success = expected_in.lower() in resp.lower()
            
        print(f"Pass? {success}")
        return success
        
    def get_context_size(query, conv_id):
        return len(retrieval_service.retrieve_context(query, conv_id))

    # A: Direct
    q = "What is the reimbursement limit?"
    c_len = get_context_size(q, convA)
    resp, ttft, _ = stream_chat(convA, q)
    if log_result("Direct", q, ["1500", "1,500"], resp, c_len): metrics["direct"]["correct"] += 1
    metrics["direct"]["total"] += 1

    q = "What does error E-77 indicate?"
    c_len = get_context_size(q, convB)
    resp, ttft, _ = stream_chat(convB, q)
    if log_result("Direct", q, "database synchronization failure", resp, c_len): metrics["direct"]["correct"] += 1
    metrics["direct"]["total"] += 1
    
    # B: Paraphrased
    q = "How much can I expense for reimbursement?"
    c_len = get_context_size(q, convA)
    resp, ttft, _ = stream_chat(convA, q)
    if log_result("Paraphrased", q, ["1500", "1,500"], resp, c_len): metrics["direct"]["correct"] += 1
    metrics["direct"]["total"] += 1

    # C: Multi-chunk
    q = "What approval process applies to international reimbursement claims?"
    c_len = get_context_size(q, convA)
    resp, ttft, _ = stream_chat(convA, q)
    if log_result("Multi-chunk", q, "director", resp, c_len): metrics["direct"]["correct"] += 1
    metrics["direct"]["total"] += 1

    # D: Document Summary
    q = "What are the main topics discussed in this document?"
    c_len = get_context_size(q, convA)
    resp, ttft, _ = stream_chat(convA, q)
    log_result("Summary", q, ["reimbursement", "travel"], resp, c_len)

    # E: Answer-Not-Present
    q = "What is the population of Mars?"
    c_len = get_context_size(q, convA)
    resp, ttft, _ = stream_chat(convA, q)
    success = log_result("Absent", q, ["do not have", "does not contain", "cannot answer", "not mention"], resp, c_len)
    if success: metrics["absent"]["refused"] += 1
    metrics["absent"]["total"] += 1

    # F: Unrelated Queries (Critical Test)
    q = "What is the capital of Japan?"
    c_len = get_context_size(q, convA)
    resp, ttft, _ = stream_chat(convA, q)
    print(f"\n--- Category: Unrelated ---")
    print(f"Q: {q}")
    print(f"Ctx Length: {c_len} (Should be 0 if perfectly bypassed, but threshold might allow noise)")
    print(f"A: {resp}")
    if c_len > 0:
        metrics["unrelated"]["irrelevant_injection"] += 1
    if "Tokyo" in resp:
        metrics["unrelated"]["correct_bypass"] += 1
    metrics["unrelated"]["total"] += 1

    q = "Explain Python decorators."
    c_len = get_context_size(q, convA)
    resp, ttft, _ = stream_chat(convA, q)
    print(f"\n--- Category: Unrelated ---")
    print(f"Q: {q}")
    print(f"Ctx Length: {c_len}")
    print(f"A: {resp[:100]}...")
    if c_len > 0:
        metrics["unrelated"]["irrelevant_injection"] += 1
    if "function" in resp.lower() or "decorator" in resp.lower():
        metrics["unrelated"]["correct_bypass"] += 1
    metrics["unrelated"]["total"] += 1

    # H: Follow-up
    q = "Does the limit apply internationally?"
    c_len = get_context_size(q, convA)
    resp, ttft, _ = stream_chat(convA, q)
    log_result("Follow-up", q, ["director", "yes", "approval"], resp, c_len)

    # I: Isolation
    q = "What is the reimbursement limit?"
    c_len = get_context_size(q, convC)  # ConvC has Architecture doc, not Policy doc
    resp, ttft, _ = stream_chat(convC, q)
    print(f"\n--- Category: Isolation ---")
    print(f"Q: {q} (Asked in Conv C which lacks the policy)")
    print(f"Ctx Length: {c_len} (Should be 0)")
    print(f"A: {resp}")
    
    print("\n--- Summary Metrics ---")
    print(json.dumps(metrics, indent=2))
    
    for f in ["docA.pdf", "docB.pdf", "docC.pdf"]:
        if os.path.exists(f):
            os.remove(f)

if __name__ == "__main__":
    run_tests()
