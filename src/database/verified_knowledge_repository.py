import re
import uuid
from typing import Dict, List, Optional

from src.database.connection import get_connection


class VerifiedKnowledgeRepository:
    """Stores admin-approved corrections without changing model weights."""

    @staticmethod
    def _terms(text: str) -> set[str]:
        return {
            term for term in re.findall(r"\b[a-z0-9]{3,}\b", text.lower())
            if term not in {"the", "and", "for", "with", "that", "this", "what", "how", "are", "you"}
        }

    def save(self, user_id: str, source_feedback_message_id: str, question: str, correction: str, created_by: str) -> Dict:
        knowledge_id = str(uuid.uuid4())
        with get_connection() as conn:
            conn.execute("""
                INSERT INTO verified_knowledge
                    (id, user_id, source_feedback_message_id, question, correction, created_by)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(source_feedback_message_id) DO UPDATE SET
                    question = excluded.question,
                    correction = excluded.correction,
                    created_by = excluded.created_by,
                    is_active = 1
            """, (knowledge_id, user_id, source_feedback_message_id, question[:2000], correction[:4000], created_by))
            conn.commit()
            row = conn.execute(
                "SELECT * FROM verified_knowledge WHERE source_feedback_message_id = ?",
                (source_feedback_message_id,),
            ).fetchone()
            return dict(row)

    def find_relevant(self, user_id: Optional[str], query: str, limit: int = 3) -> List[Dict]:
        if not user_id:
            return []
        query_terms = self._terms(query)
        if not query_terms:
            return []
        with get_connection() as conn:
            # We remove the user_id strict filter to make verified learning GLOBAL for the entire organization
            rows = conn.execute(
                "SELECT * FROM verified_knowledge WHERE is_active = 1 ORDER BY created_at DESC"
            ).fetchall()
        ranked = []
        global_rules = []
        for row in rows:
            item = dict(row)
            if item['question'] == 'GLOBAL_AI_RULE':
                global_rules.append(item)
            else:
                overlap = len(query_terms & self._terms(f"{item['question']} {item['correction']}"))
                if overlap:
                    ranked.append((overlap, item))
        ranked.sort(key=lambda item: (-item[0], item[1]["created_at"]))
        return global_rules + [item for _, item in ranked[:limit]]