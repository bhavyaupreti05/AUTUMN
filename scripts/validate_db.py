import sqlite3

def run_checks():
    print("Running SQLite Integrity Checks...")
    conn = sqlite3.connect("data/chatbot.db")
    cursor = conn.cursor()
    
    # Pragma checks
    cursor.execute("PRAGMA integrity_check;")
    print("Integrity check:", cursor.fetchone()[0])
    
    cursor.execute("PRAGMA foreign_key_check;")
    fk_issues = cursor.fetchall()
    print("Foreign key check:", "OK" if not fk_issues else fk_issues)
    
    # Check orphan messages
    cursor.execute("SELECT COUNT(*) FROM messages m LEFT JOIN conversations c ON m.conversation_id = c.id WHERE c.id IS NULL;")
    print("Orphan messages:", cursor.fetchone()[0])
    
    # Check for empty assistant messages
    cursor.execute("SELECT COUNT(*) FROM messages WHERE role = 'assistant' AND (content IS NULL OR content = '');")
    print("Empty assistant messages:", cursor.fetchone()[0])
    
    # Print stats
    cursor.execute("SELECT COUNT(*) FROM conversations;")
    print("Total conversations:", cursor.fetchone()[0])
    
    cursor.execute("SELECT COUNT(*) FROM messages;")
    print("Total messages:", cursor.fetchone()[0])
    
    conn.close()

if __name__ == "__main__":
    run_checks()
