import re
import uuid
from typing import Dict, List, Optional

from src.database.connection import get_connection


class MemoryRepository:
    """Stores only explicit, user-scoped memories outside conversation history."""

    _EXPLICIT_PATTERNS = (
        re.compile(r"^remember(?: that)?\s+(.+)$", re.IGNORECASE),
        re.compile(r"^(?:my name is|i prefer|i like|i work as|i work at)\s+(.+)$", re.IGNORECASE),
        re.compile(r"^(?:please\s+)?(?:always|from now on|going forward|in future)\s+(.+)$", re.IGNORECASE),
    )
    _SENSITIVE_TERMS = re.compile(r"\b(password|passcode|secret|token|api[ _-]?key)\b", re.IGNORECASE)
    _PROMPT_TAGS = re.compile(r"<\s*\|.*?\|\s*>", re.IGNORECASE | re.DOTALL)

    def remember_explicit(self, user_id: Optional[str], message: str, conversation_id: str) -> Optional[Dict]:
        if not user_id:
            return None

        content = None
        for pattern in self._EXPLICIT_PATTERNS:
            match = pattern.match(message.strip())
            if match:
                content = re.sub(r"\s+", " ", match.group(1)).strip(" .")
                break

        if (
            not content
            or len(content) > 500
            or self._SENSITIVE_TERMS.search(content)
            or self._PROMPT_TAGS.search(content)
        ):
            return None

        with get_connection() as conn:
            existing = conn.execute(
                "SELECT id, user_id, content, memory_type, source_conversation_id, created_at, last_used_at, is_active "
                "FROM user_memories WHERE user_id = ? AND content = ? AND is_active = 1",
                (user_id, content),
            ).fetchone()
            if existing:
                return dict(existing)

            memory_id = str(uuid.uuid4())
            conn.execute(
                "INSERT INTO user_memories (id, user_id, content, source_conversation_id) VALUES (?, ?, ?, ?)",
                (memory_id, user_id, content, conversation_id),
            )
            conn.commit()
            row = conn.execute("SELECT * FROM user_memories WHERE id = ?", (memory_id,)).fetchone()
            return dict(row)

    def find_relevant(self, user_id: Optional[str], query: str, limit: int = 5) -> List[Dict]:
        if not user_id:
            return []

        query_terms = self._terms(query)
        if not query_terms:
            return []

        with get_connection() as conn:
            rows = conn.execute(
                "SELECT * FROM user_memories WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC",
                (user_id,),
            ).fetchall()

            ranked = []
            for row in rows:
                memory = dict(row)
                overlap = len(query_terms & self._terms(memory["content"]))
                if overlap:
                    ranked.append((overlap, memory))

            ranked.sort(key=lambda item: (-item[0], item[1]["created_at"]))
            selected = [memory for _, memory in ranked[:limit]]
            if selected:
                conn.executemany(
                    "UPDATE user_memories SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?",
                    [(memory["id"],) for memory in selected],
                )
                conn.commit()
            return selected

    @staticmethod
    def _terms(text: str) -> set[str]:
        return {
            term for term in re.findall(r"\b[a-z0-9]{3,}\b", text.lower())
            if term not in {"the", "and", "for", "with", "that", "this", "what", "how", "are", "you"}
        }