from typing import List, Dict
from src.database.repository import ConversationRepository
from src.config import settings

class ContextManager:
    """
    Retrieves conversation history from the database and appends the new message.
    Enforces the MAX_CONTEXT_MESSAGES limit to protect TTFT and RAM.
    """
    def __init__(self):
        self.repo = ConversationRepository()

    def prepare_context(self, conversation_id: str, new_message: str) -> List[Dict[str, str]]:
        """
        Takes the existing history up to MAX_CONTEXT_MESSAGES and truncates older messages 
        if the total context string exceeds MAX_CONTEXT_CHARS.
        """
        # Fetch the most recent N messages from the DB
        db_messages = self.repo.get_messages(conversation_id, limit=settings.MAX_CONTEXT_MESSAGES)

        filtered_messages = []
        for msg in db_messages:
            if msg.get("status", "complete") == "error":
                if filtered_messages and filtered_messages[-1]["role"] == "user":
                    filtered_messages.pop()
                continue
            if filtered_messages and filtered_messages[-1]["role"] == msg["role"]:
                filtered_messages.pop()
            filtered_messages.append(msg)
        
        # We need to enforce MAX_CONTEXT_CHARS
        messages = []
        current_chars = len(new_message)
        
        # Iterate backwards (newest to oldest) and accumulate if within limit
        for msg in reversed(filtered_messages):
            msg_len = len(msg["content"])
            if current_chars + msg_len <= settings.MAX_CONTEXT_CHARS:
                messages.insert(0, {"role": msg["role"], "content": msg["content"]})
                current_chars += msg_len
            else:
                break # Limit reached, discard older messages
                
        # The current user message was already saved to DB before calling prepare_context.
        # It is naturally included as the last element in db_messages.
        
        summary = self.repo.get_conversation_summary(conversation_id)
        if summary:
            # Inject summary at the very beginning
            messages.insert(0, {"role": "system", "content": f"Summary of earlier conversation: {summary}"})
            
        return messages
