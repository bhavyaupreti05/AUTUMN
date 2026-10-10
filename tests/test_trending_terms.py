import pytest
from fastapi.testclient import TestClient
from src.api.main import app
from src.database.connection import get_connection
import datetime

client = TestClient(app)

def test_pii_terms_not_in_trending_and_gaming_vector():
    """Verify that PII patterns are scrubbed and gaming with new accounts fails"""
    
    with get_connection() as conn:
        # Create message_terms table if not exists (in case test suite runs before full init)
        try:
            conn.execute("CREATE TABLE IF NOT EXISTS message_terms (message_id TEXT, user_id TEXT, term TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)")
        except: pass
        
        now = datetime.datetime.now(datetime.timezone.utc)
        old_date = (now - datetime.timedelta(days=2)).isoformat()
        new_date = now.isoformat()
        
        # Create 3 distinct users and a conversation for each
        for i in range(1, 4):
            user_id = f"test_user_{i}"
            conv_id = f"test_conv_{i}"
            
            # User 3 is created TODAY (new account). Users 1 and 2 are OLD.
            created_at = new_date if i == 3 else old_date
            
            conn.execute("INSERT OR IGNORE INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)", 
                        (user_id, f"pii_user_{i}", "hash", created_at))
            conn.execute("INSERT INTO conversations (id, user_id, title) VALUES (?, ?, ?)", 
                        (conv_id, user_id, f"Conv {i}"))
        conn.commit()
            
    # Now that the DB connection is closed, use the repository to save messages
    from src.database.repository import ConversationRepository
    repo = ConversationRepository()
    for i in range(1, 4):
        conv_id = f"test_conv_{i}"
        pii_message = "My phone is (555) 123-4567 and my ssn is 123-45-6789. The word 'bananas' should trend."
        repo.save_message(conv_id, "user", pii_message)

    # Hit the analytics endpoint
    response = client.get("/auth/admin/system-metrics?range=monthly")
    assert response.status_code == 200
    data = response.json()
    
    trending = data.get("trending", [])
    trending_terms = [t["term"] for t in trending]
    
    # 'bananas' was said by 3 users, BUT User 3 is too new (< 24h)!
    # So distinct_users eligible is only 2 (Users 1 and 2). It should NOT trend!
    assert "bananas" not in trending_terms, "Gaming vector failed: new account counted towards trending floor!"
    
    # Now let's make User 3 old enough and re-test
    with get_connection() as conn:
        conn.execute("UPDATE users SET created_at = ? WHERE id = 'test_user_3'", (old_date,))
        conn.commit()
        
    response = client.get("/auth/admin/system-metrics?range=monthly")
    data = response.json()
    trending_terms = [t["term"] for t in data.get("trending", [])]
    
    # NOW it should trend
    assert "bananas" in trending_terms, "Floor enforcement failed: term didn't trend when 3 old users said it."
    
    # The PII tokens should NEVER be present (including fragmented ones)
    assert "555" not in trending_terms, "Formatted phone number leaked!"
    assert "123-4567" not in trending_terms, "Formatted phone number leaked!"
    assert "123" not in trending_terms, "SSN fragment leaked!"

