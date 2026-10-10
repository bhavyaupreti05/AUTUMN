# RAG (Retrieval-Augmented Generation) Results

ChatBot-2 employs a robust RAG pipeline allowing users to query private PDF documents completely locally.

## 1. Core RAG Pipeline Specifications
- **Extractor**: `PyMuPDF` (optimized standard text extraction).
- **Chunking**: `RecursiveCharacterTextSplitter` (1000 character chunks, 200 character overlap).
- **Embeddings**: `nomic-embed-text-v1.5` (768 dimensions).
- **Vector Store**: `ChromaDB`.
- **Retrieval Strategy**: Similarity Search (`top_k=3`).

## 2. Document Isolation (Critical Privacy Capability)
The system was audited specifically to ensure cross-document data contamination does not occur.
- **The Audit**: Document A contained "Product Alpha costs ₹100." Document B contained "Product Beta costs ₹500."
- **The Result**: The system accurately bounds semantic searches strictly to the selected `conversation_id`. The LLM exhibited **zero context leakage**; it never hallucinated pricing from Document B while operating in Document A's thread.

## 3. Scale and Capacity
- **Massive Documents**: The pipeline was successfully benchmarked ingesting a synthetic **500-page document**. Extraction, chunking, and indexing completed cleanly with no memory faults, validating the chunking logic.
- **Multi-Document Target**: The system is designed to support multiple documents per thread (Target: 50 documents). *Note: While the architecture supports this, concurrent 50-document ingestion is considered unverified at this stage.*

## 4. Grounding and Hallucination Control
Through controlled testing, the PromptBuilder enforces strict systemic rules forcing the LLM to rely *only* on provided context.
- **Answered Questions**: Model accurately extracts exact quotes and metrics from PDFs.
- **Absent Information**: Model correctly refuses to hallucinate (e.g., "The provided documents do not contain information regarding X").
