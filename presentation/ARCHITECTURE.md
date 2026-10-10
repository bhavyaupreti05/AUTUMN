# System Architecture

ChatBot-2 utilizes a decoupled, microservice-inspired architecture running strictly locally. Responsibilities are clearly partitioned to ensure scalability, security, and testability.

## 1. Request Flow (Standard Chat)
The complete end-to-end flow of a standard user message is:

`Browser → Frontend → FastAPI → ChatService → ContextManager → SQLite`
*(Backend then streams back:)*
`PromptBuilder → Qwen (llama.cpp) → SSE Stream → React/TypeScript Frontend`

## 2. Request Flow (RAG / Document Chat)
When a user queries a conversation with attached documents, the retrieval flow activates:

`ChatService → RAG Pipeline → Nomic Embeddings → ChromaDB (Similarity Search) → PromptBuilder (Context Injection) → Qwen`

## 3. Component Responsibilities

### Frontend (React + TypeScript)
- **Role**: Renders the UI and manages the Server-Sent Events (SSE) connection through React components and hooks.
- **Isolation**: Has absolute zero knowledge of the backend implementation. It consumes a generic REST API and listens to `data:` streams to update the UI.

### FastAPI Layer (`src/api/main.py`)
- **Role**: API routing, validation, and HTTP/SSE transport.
- **Isolation**: Handles web-layer concerns only. Delegates all logic to `ChatService`.

### ChatService (`src/services/chat_service.py`)
- **Role**: The core orchestrator.
- **Execution**: Coordinates fetching history from `ContextManager`, querying `RetrievalService` if documents are attached, and feeding the result to the LLM.

### ContextManager (`src/core/context_manager.py`)
- **Role**: Enforces context limits and handles database abstraction.
- **Execution**: Retrieves messages from SQLite and trims the conversation history dynamically (capped at 20 messages / 8000 characters) to ensure the LLM prompt does not overflow memory.

### SQLite (`chatbot.db`)
- **Role**: Persistent transactional storage for User, Assistant messages, and document metadata.

### Retrieval Service & ChromaDB
- **Role**: Handles semantic search.
- **Execution**: Uses `nomic-embed-text-v1.5` to convert text chunks into vectors. ChromaDB stores these locally and performs highly optimized nearest-neighbor searches isolated by `conversation_id`.

### LLM Provider (`llama.cpp`)
- **Role**: Inference execution.
- **Isolation**: Completely decoupled behind a generic `LLMProvider` interface, allowing hot-swapping to other models without changing any orchestration logic.
