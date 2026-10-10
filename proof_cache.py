import sys
import uuid
import sqlite3
import os
import time

sys.path.append('.')
from src.services.retrieval_service import RetrievalService
from src.api.routes import get_chat_service

conn = sqlite3.connect('data/chatbot.db')
doc_id = conn.execute("SELECT id FROM documents WHERE filename='proof_document.pdf' ORDER BY created_at DESC LIMIT 1").fetchone()[0]
user = conn.execute("SELECT user_id FROM documents WHERE id=?", (doc_id,)).fetchone()[0]
conv_id = conn.execute("SELECT conversation_id FROM conversation_documents WHERE document_id=?", (doc_id,)).fetchone()[0]
conn.close()

chat = get_chat_service()

question = "Who is the lead at the underwater facility?"

print("\n================== 1. FIRST RUN (No Cache) ==================")
start1 = time.time()
print(f"USER ASKED: {question}\nAI RESPONSE: ", end="")
for item in chat.generate_chat_response(question, conv_id, user_id=user):
    if item.get("type") == "text":
        print(item["content"], end="", flush=True)
dur1 = time.time() - start1
print(f"\n\n[TIME TAKEN: {dur1:.2f} seconds]")


print("\n================== 2. SECOND RUN (Cache Hit) ==================")
start2 = time.time()
print(f"USER ASKED: {question}\nAI RESPONSE: ", end="")
for item in chat.generate_chat_response(question, conv_id, user_id=user):
    if item.get("type") == "text":
        print(item["content"], end="", flush=True)
dur2 = time.time() - start2
print(f"\n\n[TIME TAKEN: {dur2:.2f} seconds]")

print(f"\nSPEEDUP: {dur1 / dur2 if dur2 > 0 else 0:.1f}x Faster!")
print("------------------------------------------------------\n")
