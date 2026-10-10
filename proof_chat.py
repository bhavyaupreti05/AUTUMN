import sys
import uuid
import sqlite3
import os

sys.path.append('.')
from src.services.retrieval_service import RetrievalService
from src.api.routes import get_chat_service

conn = sqlite3.connect('data/chatbot.db')
doc_id = conn.execute("SELECT id FROM documents WHERE filename='proof_document.pdf' ORDER BY created_at DESC LIMIT 1").fetchone()[0]
user = conn.execute("SELECT user_id FROM documents WHERE id=?", (doc_id,)).fetchone()[0]
conv_id = conn.execute("SELECT conversation_id FROM conversation_documents WHERE document_id=?", (doc_id,)).fetchone()[0]
conn.close()

ret_svc = RetrievalService()
chat = get_chat_service()

questions = [
    "What is the highly classified project code?"
]

print("\n================== RAG Q&A PROOF (AFTER CITATION FIX) ==================\n")
for q in questions:
    print(f"USER ASKED: {q}")
    print("\nAI RESPONSE:")
    for item in chat.generate_chat_response(q, conv_id, user_id=user):
        if item.get("type") == "text":
            print(item["content"], end="")
    print("\n------------------------------------------------------\n")
