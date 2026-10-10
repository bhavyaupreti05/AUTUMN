# ChatBot-2 Architecture

## Overview
This local chatbot operates via a layered architecture designed for low latency streaming with asynchronous generation and synchronous database persistence.

## Flow of a Chat Request
1. **Browser**: Client sends `POST /api/chat` with `{message: "...", conversation_id: "..."}`.
2. **FastAPI (`src/api/routes.py`)**: 
   - Resolves or creates the conversation ID.
   - Wraps the response in `StreamingResponse` for SSE.
3. **ChatService (`src/services/chat_service.py`)**:
   - Stores the user message to SQLite via `ConversationRepository`.
   - Calls `ContextManager.prepare_context()`.
4. **ContextManager (`src/core/context_manager.py`)**:
   - Retrieves the most recent `MAX_CONTEXT_MESSAGES` from the DB.
   - Appends the new user message.
5. **PromptBuilder (`src/core/prompt_builder.py`)**:
   - Formats the messages array into Qwen's specific ChatML string.
6. **LLMProvider (`src/llm/provider.py`)**:
   - `llama-cpp-python` is invoked with `stream=True`.
   - Yields tokens to `ChatService`.
7. **Streaming & Persistence**:
   - `ChatService` yields the chunk directly to the HTTP stream.
   - It captures the chunks in a local buffer.
   - **Post-stream**: Once the stream completes, it persists the buffered string as the `assistant` message to SQLite.

## Database Schema (SQLite)
* **conversations**: `id` (UUID PRIMARY), `title` (TEXT), `created_at` (TIMESTAMP), `updated_at` (TIMESTAMP)
* **messages**: `id` (UUID PRIMARY), `conversation_id` (UUID FOREIGN KEY), `role` (TEXT), `content` (TEXT), `sequence` (INTEGER), `created_at` (TIMESTAMP)

The `sequence` column ensures deterministic ordering across rapid multi-turn sequences without relying exclusively on timestamp granularity.
