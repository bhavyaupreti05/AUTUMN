# ChatBot-2: Project Analysis & Summary Report

This document provides a comprehensive overview of the **ChatBot-2** project, intended to serve as context for Claude or other LLMs joining the development process.

## 1. Project Objective & Constraints
**ChatBot-2** is a local AI chatbot featuring Retrieval-Augmented Generation (RAG) and conversational memory. It is specifically optimized to run entirely locally on hardware with constrained resources (Intel i7-8650U, 16 GB RAM, weak discrete GPU).
- **Core Constraint:** Must perform inference on the CPU to avoid VRAM exhaustion.
- **Key Requirement:** Low-latency streaming responses with robust SQLite-backed persistence for chat history.

## 2. Architecture & Tech Stack
The system uses a layered architecture to separate concerns, primarily written in Python.

### **Core Stack:**
- **Backend / API:** FastAPI (`src/api/routes.py`) for handling HTTP requests and SSE (Server-Sent Events) streaming.
- **Database:** SQLite (persists `conversations` and `messages` for long-term memory).
- **LLM Engine:** `llama-cpp-python` (used for optimized CPU inference with `stream=True`).
- **RAG / Vector Store:** ChromaDB.

### **Data Flow:**
1. **API Layer:** Client `POST`s a message.
2. **Service Layer (`ChatService`):** Saves user message to SQLite.
3. **Context Layer (`ContextManager`):** Fetches past `MAX_CONTEXT_MESSAGES` from the DB.
4. **Prompt Builder (`PromptBuilder`):** Formats messages into the specific model's required format (e.g., ChatML for Qwen).
5. **LLM Provider:** Generates the response asynchronously.
6. **Streaming & Persistence:** The backend yields tokens directly to the HTTP stream, buffers them locally, and saves the final assistant response to SQLite upon completion.

## 3. Model Decision
Based on internal benchmarking against alternatives (like Phi-4 and Mistral 7B), the project uses **Qwen2.5 3B Instruct (q4_k_m)**.

- **Why Qwen2.5 3B?** It strikes an optimal balance between quality, speed, and RAM consumption.
- **Performance Highlights:**
  - **Cold TTFT (Time-To-First-Token):** ~0.63s - 0.83s
  - **Warm TTFT:** ~0.10s
  - **Throughput:** ~6.88 - 9.86 tokens/sec (roughly 2.5x - 3x faster than Phi-4 on this hardware).
- **Memory Consumption:** Peak process RAM is ~2.74 GB, comfortably fitting in the available ~3.2 GB system RAM overhead.

## 4. Retrieval-Augmented Generation (RAG) Capabilities
ChatBot-2 allows users to query private PDF documents locally without data leaving the machine.

- **Pipeline Specs:** 
  - Text Extraction: `PyMuPDF`
  - Chunking: `RecursiveCharacterTextSplitter` (1000 char chunks, 200 overlap)
  - Embeddings: `nomic-embed-text-v1.5`
- **Document Isolation (Privacy):** The system strictly bounds semantic searches to the active `conversation_id`. The LLM has demonstrated zero cross-document data leakage or hallucination between isolated threads.
- **Scale Tested:** Successfully ingested and queried synthetic 500-page PDF documents. The PromptBuilder enforces strict systemic rules to ground the LLM entirely on the provided RAG context, eliminating external hallucinations.

## 5. Development Standards
- **Config:** Managed via `pydantic_settings` and `.env` (`src/config.py`).
- **Tests & Benchmarks:** The `benchmarks/` and `tests/` directories contain extensive scripts used to validate TTFT, throughput, context leakage, memory bounds, and document ingestion.
