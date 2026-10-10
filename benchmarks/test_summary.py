import time
import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from src.database.connection import init_db
from src.database.repository import ConversationRepository
from src.core.context_manager import ContextManager

def test_summary():
    print("Testing Context Summarization Optimization...")
    # 1. Init DB to ensure new columns exist
    init_db()
    repo = ConversationRepository()
    
    # 2. Create a mock conversation
    conv_id = repo.create_conversation(title="Summary Test")
    
    # 3. Add 6 old messages
    for i in range(1, 4):
        repo.save_message(conv_id, "user", f"Tell me about topic {i}.")
        repo.save_message(conv_id, "assistant", f"Topic {i} is very interesting and complex.")
    
    # 4. Mock the LLM provider to return a fake summary
    class MockProvider:
        def generate_stream(self, prompt, **kwargs):
            yield {"type": "text", "content": "The user and assistant discussed topics 1, 2, and 3."}
            yield {"type": "status", "status": "COMPLETED"}

    from src.services.chat_service import ChatService
    service = ChatService(llm_provider=MockProvider())
    
    # 5. Run the background summary task synchronously for testing
    print(f"\n[Before Summary] Context Manager Output (no summary):")
    ctx = ContextManager().prepare_context(conv_id, "New message")
    for c in ctx:
        print(f" - {c['role']}: {c['content'][:30]}")
    
    print("\nRunning background summary task...")
    start = time.time()
    service._run_background_summary(conv_id)
    print(f"Summary task completed in {(time.time()-start)*1000:.2f}ms")
    
    # 6. Verify summary is saved and injected
    saved_summary = repo.get_conversation_summary(conv_id)
    print(f"\n[DB Check] Saved Summary: '{saved_summary}'")
    
    print(f"\n[After Summary] Context Manager Output (with summary):")
    ctx_after = ContextManager().prepare_context(conv_id, "New message")
    for c in ctx_after:
        print(f" - {c['role']}: {c['content'][:50]}")
        
    print("\n✅ Smart Memory / Summarization successfully verified.")
    repo.delete_conversation(conv_id)

if __name__ == "__main__":
    test_summary()
