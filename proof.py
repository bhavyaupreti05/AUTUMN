import sys
import uuid
import sqlite3
import hashlib
import os

sys.path.append('.')
from src.services.document_service import DocumentService
from src.database.document_repository import DocumentRepository
from src.services.retrieval_service import RetrievalService
from src.api.routes import get_chat_service
from fpdf import FPDF

print("1. Creating a Q&A PDF Document (with hard-to-guess facts)...")
pdf = FPDF()
pdf.add_page()
pdf.set_font("Arial", size=12)

qa_pairs = [
    ("Q: What is the highly classified project code?", "A: The highly classified project code is 9942-OMEGA-PROTOCOL."),
    ("Q: How many thermal generators does the Antarctic Base have?", "A: The Antarctic Base operates with exactly 17 thermal generators to maintain core temperature."),
    ("Q: Who is the Chief Scientist for the underwater research facility?", "A: Dr. Alexander Sterling is the Chief Scientist leading the underwater research facility.")
]

pdf.multi_cell(0, 10, "FAQ Knowledge Base\n\n")
for q, a in qa_pairs:
    pdf.multi_cell(0, 10, q)
    pdf.multi_cell(0, 10, a)
    pdf.multi_cell(0, 10, "") # Newline for exact paragraph chunking separation

pdf.output("proof_document.pdf")

print("2. Simulating Document Upload and Smart Chunking Process...")
doc_svc = DocumentService()
conv_id = str(uuid.uuid4())
doc_id = str(uuid.uuid4())

with open('proof_document.pdf', 'rb') as f:
    content = f.read()

h = hashlib.sha256()
h.update(content)
sha = h.hexdigest()

# Manually insert into DB to bypass API upload route
conn = sqlite3.connect('data/chatbot.db')
# We need a user. Any user is fine.
user = conn.execute("SELECT id FROM users LIMIT 1").fetchone()[0]
conn.execute('INSERT INTO conversations (id, user_id, title) VALUES (?, ?, ?)', (conv_id, user, 'Proof Test'))
conn.execute('INSERT INTO documents (id, user_id, filename, sha256, size, page_count, status) VALUES (?, ?, ?, ?, ?, ?, ?)', (doc_id, user, 'proof_document.pdf', sha, len(content), 1, 'processing'))
conn.execute('INSERT INTO conversation_documents (conversation_id, document_id) VALUES (?, ?)', (conv_id, doc_id))
conn.commit()
conn.close()

doc_dir = os.path.join('data/documents', doc_id)
os.makedirs(doc_dir, exist_ok=True)
with open(os.path.join(doc_dir, 'original.pdf'), 'wb') as f:
    f.write(content)

# Trigger extraction and background chunking
doc_svc._background_ingest(doc_id, 'proof_document.pdf', content)
print("-> Document successfully processed into Vector DB!")

ret_svc = RetrievalService()
chat = get_chat_service()

questions = [
    "What is the highly classified project code?",
    "Tell me about the generators at the Antarctic base.",
    "Who is the lead at the underwater facility?"
]

print("\n================== 3. RAG Q&A PROOF ==================\n")
for q in questions:
    print(f"USER ASKED: {q}")
    print("RETRIEVING FROM VECTOR DB...")
    
    # We can fetch the raw context to prove it found the chunk
    context = ret_svc.retrieve_context(q, conv_id)
    if not context:
        print("-> [Failed to find context]")
    
    print("AI RESPONSE:")
    # We use generate_chat_response since chat_service.generate_response was removed/changed
    for item in chat.generate_chat_response(q, conv_id, user_id=user):
        if item.get("type") == "text":
            print(item["content"], end="")
    print("\n------------------------------------------------------\n")
