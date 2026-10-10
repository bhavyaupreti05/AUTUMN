import pytest
import sqlite3
import os
from src.auth.db import init_users_table
from src.config import settings
from src.database.connection import get_connection, init_db

def test_document_fk_constraint():
    """Verify that the documents table structurally rejects invalid user_ids"""
    
    with get_connection() as conn:
        cursor = conn.cursor()
        
        # Make sure PRAGMA foreign_keys is actually ON
        cursor.execute("PRAGMA foreign_keys")
        assert cursor.fetchone()[0] == 1, "Foreign keys are not enabled!"
        
        # Try inserting a valid document with a NON-EXISTENT user_id
        try:
            cursor.execute('''
                INSERT INTO documents (id, user_id, filename, sha256, size, page_count, status)
                VALUES ('test_doc_fk', 'THIS_USER_DOES_NOT_EXIST', 'test.pdf', 'abcdef123', 100, 1, 'ready')
            ''')
            conn.commit()
            pytest.fail("Database allowed inserting a document with an invalid user_id!")
        except sqlite3.IntegrityError as e:
            # This is expected!
            assert "FOREIGN KEY constraint failed" in str(e) or "foreign key" in str(e).lower()
            
        # Ensure that inserting with NULL works (for quarantined documents)
        cursor.execute('''
            INSERT INTO documents (id, user_id, filename, sha256, size, page_count, status)
            VALUES ('test_doc_fk_null', NULL, 'test.pdf', 'abcdef123_null', 100, 1, 'ready')
        ''')
        conn.commit()
        
        # Cleanup
        cursor.execute("DELETE FROM documents WHERE id = 'test_doc_fk_null'")
        conn.commit()


def test_legacy_documents_table_is_rebuilt_with_user_fk(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "DATABASE_URL", str(tmp_path / "legacy.db"))
    init_users_table()
    with get_connection() as conn:
        conn.execute("INSERT INTO users (id, username, password_hash, status) VALUES ('valid-user', 'valid', 'hash', 'approved')")
        conn.execute("""
            CREATE TABLE documents (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                filename TEXT NOT NULL,
                sha256 TEXT UNIQUE NOT NULL,
                size INTEGER NOT NULL,
                page_count INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status TEXT NOT NULL,
                progress REAL DEFAULT 0.0,
                summary TEXT
            )
        """)
        conn.execute("INSERT INTO documents (id, user_id, filename, sha256, size, page_count, status) VALUES ('orphan', 'missing-user', 'x.pdf', 'legacy-hash', 1, 1, 'READY')")
        conn.commit()

    init_db()

    with get_connection() as conn:
        foreign_keys = conn.execute("PRAGMA foreign_key_list(documents)").fetchall()
        orphan = conn.execute("SELECT user_id FROM documents WHERE id = 'orphan'").fetchone()
        assert any(row[2] == "users" for row in foreign_keys)
        assert orphan[0] is None
