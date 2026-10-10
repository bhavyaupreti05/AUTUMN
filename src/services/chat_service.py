from typing import List, Dict, Generator, Any
from src.llm.provider import LLMProvider
from src.core.prompt_builder import PromptBuilder
from src.core.prompt_builder import is_substantive_document_question
from src.core.context_manager import ContextManager
from src.database.document_repository import DocumentRepository
from src.database.repository import ConversationRepository
from src.database.memory_repository import MemoryRepository
from src.database.verified_knowledge_repository import VerifiedKnowledgeRepository
from src.services.retrieval_service import get_retrieval_service
import traceback
import time
import logging

logger = logging.getLogger(__name__)

# Global cache to store LLM responses for exact prompts
# This saves significant compute if a user asks the exact same question
# with the exact same retrieved context/history.
_PROMPT_CACHE: Dict[str, str] = {}
_MAX_CACHE_SIZE = 1000

import threading

class ChatService:
    def __init__(self, llm_provider: LLMProvider):
        self.provider = llm_provider
        self.context_manager = ContextManager()
        self.prompt_builder = PromptBuilder()
        self.repo = ConversationRepository()
        self.memory_repo = MemoryRepository()
        self.verified_knowledge_repo = VerifiedKnowledgeRepository()

    def generate_chat_response(self, message: str, conversation_id: str, user_id: str = None, system_prompt: str = "") -> Generator[Dict[str, Any], None, None]:
        """
        Orchestrates the chat flow with persistence:
        1. Ensure conversation exists.
        2. Save user message.
        3. Load context and build prompt.
        4. Stream from LLM.
        5. Save assistant message after stream completes successfully.
        """
        # Tag conversation with user if provided and not already set
        if user_id:
            self.repo.tag_conversation_user(conversation_id, user_id)

        # Pre-stream: Persist the user message
        self.repo.save_message(conversation_id, role="user", content=message)
        
        # Prepare context (loads history + new message)
        context_messages = self.context_manager.prepare_context(conversation_id, message)
        
        # Retrieve document context
        retrieved_context = ""
        try:
            from src.config import settings
            if settings.RAG_ENABLED:
                retrieval_service = get_retrieval_service()
                retrieved_context = retrieval_service.retrieve_context(message, conversation_id)
        except Exception as e:
            print(f"Error retrieving context: {e}")
            traceback.print_exc()

        # Only ground if actual document text was retrieved, not just the inventory header
        has_real_context = bool(retrieved_context and not retrieved_context.startswith("[Document inventory:"))
        
        # Append inventory header independently if docs exist
        try:
            document_count = len(DocumentRepository().get_conversation_documents(conversation_id))
            if document_count > 0:
                retrieved_context = (
                    f"[Document inventory: {document_count} document(s) attached to this conversation. "
                    "Use this count as the factual total when the user asks how many documents are available.]\n"
                    f"{retrieved_context}"
                )
        except Exception:
            pass

        should_ground = has_real_context and is_substantive_document_question(message)

        memory_context = ""
        verified_context = ""
        try:
            from src.config import settings
            if settings.MEMORY_ENABLED and not should_ground:
                relevant_memories = self.memory_repo.find_relevant(
                    user_id,
                    message,
                    limit=settings.MEMORY_MAX_ITEMS,
                )
                memory_context = "\n".join(f"- {memory['content']}" for memory in relevant_memories)
                memory_context = memory_context[:settings.MEMORY_MAX_CHARS]
                self.memory_repo.remember_explicit(user_id, message, conversation_id)
                verified_items = self.verified_knowledge_repo.find_relevant(user_id, message)
                verified_context = "\n".join(
                    f"- Question: {item['question']}\n  Verified correction: {item['correction']}"
                    for item in verified_items
                )
        except Exception:
            logger.exception("Memory lookup failed; continuing without memory context")

        # Grounded answers must not inherit stale assistant claims from earlier turns.
        # Keep normal conversations fully multi-turn, but make document answers depend
        # on the current question and the retrieved document evidence only.
        prompt_messages = (
            [{"role": "user", "content": message}]
            if should_ground
            else context_messages
        )
        if system_prompt:
            prompt = self.prompt_builder.build_prompt(
                prompt_messages,
                retrieved_context if should_ground else "",
                memory_context=memory_context,
                system_prompt=system_prompt,
                verified_context=verified_context,
            )
        elif memory_context or verified_context:
            prompt = self.prompt_builder.build_prompt(
                prompt_messages,
                retrieved_context if should_ground else "",
                memory_context,
                verified_context=verified_context,
            )
        else:
            prompt = self.prompt_builder.build_prompt(
                prompt_messages,
                retrieved_context if should_ground else "",
            )
            
        import hashlib
        prompt_hash = hashlib.sha256(prompt.encode('utf-8')).hexdigest()
        
        # Check semantic cache first (0 latency)
        if prompt_hash in _PROMPT_CACHE:
            logger.info(f"Cache hit for prompt hash: {prompt_hash}")
            def cached_stream() -> Generator[Dict[str, Any], None, None]:
                yield {"type": "text", "content": _PROMPT_CACHE[prompt_hash]}
                yield {"type": "status", "status": "COMPLETED"}
                # Persist the cached answer to the conversation history
                assistant_message_id = self.repo.save_message(conversation_id, role="assistant", content=_PROMPT_CACHE[prompt_hash])
                yield {"type": "message_id", "message_id": assistant_message_id}
            return cached_stream()
        
        # We need a generator wrapper to intercept the end of the stream
        def stream_with_persistence() -> Generator[Dict[str, Any], None, None]:
            assistant_response = ""
            final_status = "CANCELLED"
            start_time = time.time()
            tokens_generated = 0
            provider_stream = None
            assistant_message_id = None
            was_cancelled = False
            
            try:
                provider_stream = self.provider.generate_stream(
                    prompt,
                    max_tokens=512 if should_ground else None,
                    temperature=0.2 if should_ground else None,
                )
                for item in provider_stream:
                    if item.get("type") == "text":
                        assistant_response += item["content"]
                        tokens_generated += 1
                        yield item
                    elif item.get("type") in ["status", "debug_acquire", "debug_release", "error"]:
                        if item.get("type") == "status":
                            final_status = item["status"]
                        elif item.get("type") == "error":
                            final_status = "ERROR"
                        yield item
            except GeneratorExit:
                final_status = "CANCELLED"
                was_cancelled = True
            except Exception as e:
                print(f"Error during streaming: {e}")
                traceback.print_exc()
                final_status = "ERROR"
                yield {"type": "error", "error": "An internal error occurred during generation."}
            finally:
                if provider_stream is not None:
                    try:
                        provider_stream.close()
                    except Exception as e:
                        logger.exception("Error closing provider stream")

            if final_status == "COMPLETED":
                assistant_status = "complete"
            elif assistant_response.strip():
                assistant_status = "aborted"
            else:
                assistant_status = "error"
            try:
                assistant_message_id = self.repo.save_message(
                    conversation_id,
                    role="assistant",
                    content=assistant_response,
                    status=assistant_status,
                )
                
                if final_status == "COMPLETED" and assistant_response.strip():
                    if len(_PROMPT_CACHE) >= _MAX_CACHE_SIZE:
                        _PROMPT_CACHE.pop(next(iter(_PROMPT_CACHE)))
                    _PROMPT_CACHE[prompt_hash] = assistant_response
                    
            except Exception as e:
                logger.exception("Error persisting assistant message")

            elapsed_ms = int((time.time() - start_time) * 1000)
            print(f"[ChatService] Stream ended: conversation_id={conversation_id}, termination_reason={final_status}, tokens_generated={tokens_generated}, elapsed_ms={elapsed_ms}")
            if assistant_message_id and not was_cancelled:
                # Trigger background summarization if conversation is getting long
                if self._should_summarize(conversation_id):
                    threading.Thread(target=self._run_background_summary, args=(conversation_id,), daemon=True).start()
                yield {"type": "message_id", "message_id": assistant_message_id}

        return stream_with_persistence()

    def _should_summarize(self, conversation_id: str) -> bool:
        from src.config import settings
        messages = self.repo.get_messages(conversation_id)
        # Summarize if we have more messages than the context limit
        return len(messages) >= (settings.MAX_CONTEXT_MESSAGES + 2) and not self.repo.get_conversation_summary(conversation_id)

    def _run_background_summary(self, conversation_id: str):
        """Asynchronously summarizes old messages and saves to DB."""
        try:
            messages = self.repo.get_messages(conversation_id)
            if not messages:
                return
                
            # Take the oldest 6 messages to summarize (leaving recent ones alone)
            old_messages = messages[:6]
            if len(old_messages) < 4:
                return
                
            transcript = "\n".join([f"{m['role'].capitalize()}: {m['content']}" for m in old_messages])
            prompt = f"<|im_start|>system\nYou are a helpful AI that summarizes conversations.<|im_end|>\n<|im_start|>user\nSummarize the following conversation in 2-3 concise sentences. Focus on the main topics discussed and any key user preferences or facts.\n\n{transcript}<|im_end|>\n<|im_start|>assistant\n"
            
            summary = ""
            # is_background_task=True allows it to wait for the LLM lock without crashing
            for item in self.provider.generate_stream(prompt, temperature=0.3, max_tokens=150, is_background_task=True):
                if item.get("type") == "text":
                    summary += item["content"]
            
            summary = summary.strip()
            if summary and len(summary) > 20:
                self.repo.save_conversation_summary(conversation_id, summary)
                logger.info(f"Successfully generated and saved background summary for {conversation_id}")
                
        except Exception as e:
            logger.error(f"Failed to generate background summary: {e}")

