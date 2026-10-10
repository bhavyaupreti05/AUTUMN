import uuid
import datetime
from typing import List, Dict, Optional
from src.database.connection import get_connection

class ConversationRepository:
    def create_conversation(self, title: str = "New Conversation", user_id: str = None) -> str:
        conv_id = str(uuid.uuid4())
        with get_connection() as conn:
            conn.execute(
                "INSERT INTO conversations (id, title, user_id) VALUES (?, ?, ?)", 
                (conv_id, title, user_id)
            )
            conn.commit()
        return conv_id

    def tag_conversation_user(self, conversation_id: str, user_id: str) -> None:
        with get_connection() as conn:
            conn.execute(
                "UPDATE conversations SET user_id = ? WHERE id = ? AND user_id IS NULL",
                (user_id, conversation_id)
            )
            conn.commit()

    def get_conversation(self, conversation_id: str) -> Optional[Dict]:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM conversations WHERE id = ?", (conversation_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def list_conversations(self) -> List[Dict]:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM conversations ORDER BY updated_at DESC")
            return [dict(row) for row in cursor.fetchall()]
            
    def get_conversations_by_user(self, user_id: str) -> List[Dict]:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM conversations WHERE user_id = ? ORDER BY is_pinned DESC, updated_at DESC", (user_id,))
            return [dict(row) for row in cursor.fetchall()]

    def pin_conversation(self, conversation_id: str, user_id: str) -> bool:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE conversations SET is_pinned = 1 WHERE id = ? AND user_id = ?", (conversation_id, user_id))
            conn.commit()
            return cursor.rowcount > 0

    def unpin_conversation(self, conversation_id: str, user_id: str) -> bool:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE conversations SET is_pinned = 0 WHERE id = ? AND user_id = ?", (conversation_id, user_id))
            conn.commit()
            return cursor.rowcount > 0

    def delete_conversation(self, conversation_id: str) -> bool:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM conversations WHERE id = ?", (conversation_id,))
            conn.commit()
            return cursor.rowcount > 0

    def update_conversation_title(self, conversation_id: str, new_title: str, user_id: str) -> bool:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE conversations SET title = ? WHERE id = ? AND user_id = ?", (new_title, conversation_id, user_id))
            conn.commit()
            return cursor.rowcount > 0
            
    def get_conversation_summary(self, conversation_id: str) -> Optional[str]:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT summary FROM conversations WHERE id = ?", (conversation_id,))
            row = cursor.fetchone()
            return row["summary"] if row and row["summary"] else None
            
    def save_conversation_summary(self, conversation_id: str, summary: str) -> bool:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE conversations SET summary = ? WHERE id = ?", (summary, conversation_id))
            conn.commit()
            return cursor.rowcount > 0


    def get_messages(self, conversation_id: str, limit: int = None) -> List[Dict]:
        query = "SELECT * FROM messages WHERE conversation_id = ? ORDER BY sequence ASC"
        params = [conversation_id]
        
        if limit is not None:
            # We want the LAST N messages, so we order by sequence DESC, limit, then reverse in python
            query = """
                SELECT * FROM (
                    SELECT * FROM messages WHERE conversation_id = ? ORDER BY sequence DESC LIMIT ?
                ) ORDER BY sequence ASC
            """
            params.append(limit)

        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, tuple(params))
            return [dict(row) for row in cursor.fetchall()]

    def truncate_from_message(self, conversation_id: str, message_id: str) -> bool:
        with get_connection() as conn:
            cursor = conn.cursor()
            # Get sequence of the target message
            cursor.execute("SELECT sequence FROM messages WHERE id = ? AND conversation_id = ?", (message_id, conversation_id))
            row = cursor.fetchone()
            if not row:
                return False
            seq = row["sequence"]
            
            # Delete this message and all subsequent messages
            cursor.execute("DELETE FROM messages WHERE conversation_id = ? AND sequence >= ?", (conversation_id, seq))
            # Also clean up message_terms for deleted messages (handled by cascade if set up, but let's be safe)
            cursor.execute("DELETE FROM message_terms WHERE message_id NOT IN (SELECT id FROM messages)")
            
            conn.commit()
            return cursor.rowcount > 0

    def save_message(self, conversation_id: str, role: str, content: str, status: str = "complete") -> str:
        msg_id = str(uuid.uuid4())
        
        with get_connection() as conn:
            cursor = conn.cursor()
            # Determine the next sequence number
            cursor.execute("SELECT MAX(sequence) as max_seq FROM messages WHERE conversation_id = ?", (conversation_id,))
            row = cursor.fetchone()
            seq = (row["max_seq"] or 0) + 1
            
            cursor.execute(
                     """INSERT INTO messages (id, conversation_id, role, content, sequence, status)
                         VALUES (?, ?, ?, ?, ?, ?)""",
                     (msg_id, conversation_id, role, content, seq, status)
            )
            
            # Extract terms for analytics (only for user messages)
            if role == "user":
                # Get the user_id for this conversation
                cursor.execute("SELECT user_id FROM conversations WHERE id = ?", (conversation_id,))
                conv_row = cursor.fetchone()
                if conv_row and conv_row["user_id"]:
                    user_id = conv_row["user_id"]
                    
                    import re
                    content_lower = content.lower()
                    # Strip out formatted numbers (4+ digits separated by non-word chars)
                    content_lower = re.sub(r'\b(?:\d[^\w\n]*){4,}\b', '', content_lower)
                    # Strip explicit phone numbers
                    content_lower = re.sub(r'\b(?:\+\d{1,2}\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b', '', content_lower)
                    
                    words = set(re.findall(r'\b[a-z]{3,}\b', content_lower))
                    stopwords = {"the", "a", "an", "and", "or", "but", "is", "are", "was", "were", "to", "in", "for", "of", "on", "with", "as", "by", "at", "it", "this", "that", "i", "you", "we", "they", "he", "she", "what", "how", "when", "where", "why", "who", "can", "could", "would", "should", "do", "does", "did", "have", "has", "had", "be", "been", "my", "your", "their", "our", "not", "no", "yes", "if", "then", "please", "about", "from", "just", "like", "know", "there"}
                    terms = {w for w in words if w not in stopwords}
                    
                    for term in terms:
                        cursor.execute(
                            "INSERT INTO message_terms (message_id, user_id, term) VALUES (?, ?, ?)",
                            (msg_id, user_id, term)
                        )
            
            # Update conversation's updated_at
            cursor.execute(
                "UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (conversation_id,)
            )
            conn.commit()
            
        return msg_id
