from fpdf import FPDF
import requests
import time

# 1. Create a PDF with Q&A
pdf = FPDF()
pdf.add_page()
pdf.set_font("Arial", size=12)

qa_pairs = [
    ("Q: What is the secret code for the vault?", "A: The secret code for the vault is 8493-XYZ-ALPHA."),
    ("Q: How many solar panels are required for the Alpha base?", "A: The Alpha base requires exactly 42 solar panels for optimal efficiency."),
    ("Q: What is the primary directive of Operation Genesis?", "A: The primary directive of Operation Genesis is to ensure the survival of the species by terraforming Mars."),
    ("Q: Who is the lead architect of the Genesis project?", "A: Dr. Samantha Vance is the lead architect of the Genesis project."),
]

pdf.multi_cell(0, 10, "FAQ Document\n\n")
for q, a in qa_pairs:
    pdf.multi_cell(0, 10, q)
    pdf.multi_cell(0, 10, a)
    pdf.multi_cell(0, 10, "") # empty line for paragraph separation

pdf.output("test_qa.pdf")
print("Created test_qa.pdf")

# 2. Upload to the bot
import sys
sys.path.append('.')
from src.services.document_service import DocumentService
from src.database.document_repository import DocumentRepository
import uuid

doc_svc = DocumentService()
doc_repo = DocumentRepository()

# Create a fake conversation
conv_id = str(uuid.uuid4())
doc_id = str(uuid.uuid4())

# Add doc to DB manually so background task works
import sqlite3
import hashlib
h = hashlib.sha256()
h.update(b'fakecontent2')
sha = h.hexdigest()

conn = sqlite3.connect('data/chatbot.db')
conn.execute("INSERT INTO conversations (id, user_id, title) VALUES (?, ?, ?)", (conv_id, 'admin_analytics_d598a2', 'Test Conv'))
conn.execute("INSERT INTO documents (id, user_id, filename, sha256, size, page_count, status) VALUES (?, ?, ?, ?, ?, ?, ?)", 
             (doc_id, 'admin_analytics_d598a2', 'test_qa.pdf', sha, 1024, 1, 'processing'))
conn.execute("INSERT INTO conversation_documents (conversation_id, document_id) VALUES (?, ?)", (conv_id, doc_id))
conn.commit()
conn.close()

# Put the file in the right place
import os, shutil
os.makedirs(f"data/documents/{doc_id}", exist_ok=True)
shutil.copy("test_qa.pdf", f"data/documents/{doc_id}/test_qa.pdf")

print("Processing document...")
doc_svc._process_document_background(doc_id, "test_qa.pdf", f"data/documents/{doc_id}/test_qa.pdf")

print("Retrieval test:")
from src.services.retrieval_service import RetrievalService
ret_svc = RetrievalService()

context = ret_svc.retrieve_context("What is the secret code for the vault?", conv_id)
print("Context for vault code:\n", context)

context2 = ret_svc.retrieve_context("How many solar panels does Alpha base need?", conv_id)
print("Context for solar panels:\n", context2)

# Test with chat service directly
from src.services.chat_service import get_chat_service
chat = get_chat_service()
print("Chat Response for Vault:")
stream = chat.generate_response(conv_id, "admin_analytics_d598a2", "What is the secret code for the vault?")
for token in stream:
    if token.get('type') == 'text':
        print(token['content'], end='')
print("\n")
