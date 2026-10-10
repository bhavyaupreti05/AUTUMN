import uuid
from typing import List, Dict, Optional
from src.database.connection import get_connection

class DocumentRepository:
    
    def get_document_by_hash(self, sha256: str) -> Optional[Dict]:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM documents WHERE sha256 = ?", (sha256,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def get_document_by_hash_for_user(self, sha256: str, user_id: str) -> Optional[Dict]:
        if user_id is None:
            return self.get_document_by_hash(sha256)

        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM documents WHERE sha256 IN (?, ?) AND user_id = ?",
                (sha256, sha256 + ":" + user_id, user_id),
            )
            row = cursor.fetchone()
            return dict(row) if row else None

    def get_document(self, doc_id: str) -> Optional[Dict]:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM documents WHERE id = ?", (doc_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def create_document(self, doc_id: str, filename: str, sha256: str, size: int, page_count: int, status: str = "PROCESSING", progress: float = 0.0, user_id: str = None) -> str:
        with get_connection() as conn:
            conn.execute(
                "INSERT INTO documents (id, user_id, filename, sha256, size, page_count, status, progress) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (doc_id, user_id, filename, sha256, size, page_count, status, progress)
            )
            conn.commit()
        return doc_id

    def update_document_status(self, doc_id: str, status: str, progress: float):
        with get_connection() as conn:
            conn.execute(
                "UPDATE documents SET status = ?, progress = ? WHERE id = ?",
                (status, progress, doc_id)
            )
            conn.commit()
            
    def update_document_summary(self, doc_id: str, summary: str):
        with get_connection() as conn:
            conn.execute(
                "UPDATE documents SET summary = ? WHERE id = ?",
                (summary, doc_id)
            )
            conn.commit()

    def save_chunks(self, document_id: str, chunks: List[Dict]):
        """
        chunks should be a list of dicts with: chunk_index, page_start, page_end, text
        """
        records = [
            (str(uuid.uuid4()), document_id, c["chunk_index"], c["page_start"], c["page_end"], c.get("page_start"), c["text"])
            for c in chunks
        ]
        with get_connection() as conn:
            conn.executemany(
                "INSERT INTO document_chunks (id, document_id, chunk_index, page_start, page_end, page_number, text) VALUES (?, ?, ?, ?, ?, ?, ?)",
                records
            )
            conn.commit()

    def get_chunks(self, document_id: str) -> List[Dict]:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM document_chunks WHERE document_id = ? ORDER BY chunk_index ASC", (document_id,))
            return [dict(row) for row in cursor.fetchall()]

    def list_documents(self, user_id: str = None) -> List[Dict]:
        with get_connection() as conn:
            cursor = conn.cursor()
            if user_id:
                cursor.execute("SELECT * FROM documents WHERE user_id = ? ORDER BY created_at DESC", (user_id,))
            else:
                cursor.execute("SELECT * FROM documents ORDER BY created_at DESC")
            return [dict(row) for row in cursor.fetchall()]

    def delete_document(self, doc_id: str) -> bool:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
            conn.commit()
            return cursor.rowcount > 0

    def associate_document_with_conversation(self, conv_id: str, doc_id: str):
        with get_connection() as conn:
            conn.execute(
                "INSERT OR IGNORE INTO conversation_documents (conversation_id, document_id) VALUES (?, ?)",
                (conv_id, doc_id)
            )
            conn.commit()

    def detach_document_from_conversation(self, conv_id: str, doc_id: str) -> bool:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM conversation_documents WHERE conversation_id = ? AND document_id = ?", (conv_id, doc_id))
            conn.commit()
            return cursor.rowcount > 0

    def get_conversation_documents(self, conv_id: str) -> List[Dict]:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT d.* FROM documents d
                JOIN conversation_documents cd ON d.id = cd.document_id
                WHERE cd.conversation_id = ?
                ORDER BY cd.created_at ASC
            """, (conv_id,))
            return [dict(row) for row in cursor.fetchall()]
