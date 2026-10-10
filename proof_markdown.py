import sys
sys.path.append('.')
from src.services.document_service import DocumentService

# We want a chunk size of 1000 characters (default is 1000)
# We will create a text that is about 1200 characters long, with a header exactly at 800 characters.

text = "A" * 800
text += "\n\n# Chapter 2: The Awakening\n\n"
text += "B" * 400

# Convert to the format expected by _chunk_text
pages_text = [(1, text)]

doc_svc = DocumentService()
chunks = doc_svc._chunk_text(pages_text)

print("--- MARKDOWN AWARE CHUNKING PROOF ---")
for idx, chunk in enumerate(chunks):
    content = chunk['text']
    print(f"\nChunk {idx} (Length: {len(content)}):")
    # Show the first 50 and last 50 chars of the chunk
    start = content[:50].replace('\n', '\\n')
    end = content[-50:].replace('\n', '\\n')
    print(f"Start: '{start}...'")
    print(f"End:   '...{end}'")
