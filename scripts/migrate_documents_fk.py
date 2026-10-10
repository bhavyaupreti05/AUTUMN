import sqlite3
import os
import sys

# Add the project root to sys.path so we can import src.config
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from src.config import settings

def migrate_foreign_key():
    db_path = settings.DATABASE_URL
    print(f"Connecting to {db_path} to rebuild documents table...")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 1. Create the new table with the foreign key constraint
    cursor.execute("""
        CREATE TABLE documents_new (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            filename TEXT NOT NULL,
            sha256 TEXT UNIQUE NOT NULL,
            size INTEGER NOT NULL,
            page_count INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            status TEXT NOT NULL,
            progress REAL DEFAULT 0.0,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    """)
    
    # 2. Copy data from the old table to the new one, converting 'SYSTEM_ORPHAN' and invalid users to NULL
    cursor.execute("""
        INSERT INTO documents_new (id, user_id, filename, sha256, size, page_count, created_at, status, progress)
        SELECT 
            id,
            CASE 
                WHEN user_id = 'SYSTEM_ORPHAN' THEN NULL 
                WHEN user_id NOT IN (SELECT id FROM users) THEN NULL
                ELSE user_id 
            END,
            filename,
            sha256,
            size,
            page_count,
            created_at,
            status,
            progress
        FROM documents
    """)
    
    # 3. Drop the old table
    cursor.execute("DROP TABLE documents")
    
    # 4. Rename the new table
    cursor.execute("ALTER TABLE documents_new RENAME TO documents")
    
    # 5. Verify no foreign key violations
    cursor.execute("PRAGMA foreign_key_check")
    violations = cursor.fetchall()
    if violations:
        print(f"ERROR: Foreign key violations detected: {violations}")
        conn.rollback()
        conn.close()
        sys.exit(1)
        
    conn.commit()
    conn.close()
    
    print("Migration complete. Foreign key constraint added and orphans converted to NULL.")

if __name__ == "__main__":
    migrate_foreign_key()
