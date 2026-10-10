import os
import requests
import uuid
import threading
import sqlite3
import time
import sys
sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = ""
TEST_PASSWORD = "test-password-123"
import pytest
import subprocess
import socket

@pytest.fixture(scope="module", autouse=True)
def live_server():
    global BASE_URL
    # Initialize real DB before starting server
    from src.database.connection import init_db
    import sqlite3
    
    # We must ensure the real DB has tables
    import os
    db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "chatbot.db"))
    # Save the original DATABASE_URL
    original_db_url = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = db_path
    init_db()
    
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as port_socket:
        port_socket.bind(("127.0.0.1", 0))
        port = port_socket.getsockname()[1]
    BASE_URL = f"http://127.0.0.1:{port}"

    # Start uvicorn on an isolated ephemeral port with the active interpreter.
    process = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "src.api.main:app", "--host", "127.0.0.1", "--port", str(port)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        env={"SINGLE_WORKER_CONFIRMED": "true", "DATABASE_URL": db_path, **os.environ}
    )
    # Wait for server to start
    for _ in range(10):
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=1):
                break
        except OSError:
            time.sleep(1)
    else:
        process.terminate()
        process.wait()
        raise RuntimeError("Live security test server did not start")
    yield
    process.terminate()
    process.wait()
    if original_db_url is None:
        os.environ.pop("DATABASE_URL", None)
    else:
        os.environ["DATABASE_URL"] = original_db_url

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "chatbot.db"))

def create_and_approve_user(prefix: str):
    username = f"{prefix}_{uuid.uuid4().hex[:8]}"
    res = requests.post(
        f"{BASE_URL}/auth/register",
        json={"username": username, "password": TEST_PASSWORD},
        headers={"Origin": "http://localhost:5173"},
    )
    assert res.status_code == 200, res.text
    
    conn = sqlite3.connect(DB_PATH)
    conn.execute("UPDATE users SET status='approved' WHERE username=?", (username,))
    conn.commit()
    conn.close()
    
    return username

def login(username: str):
    session = requests.Session()
    session.headers.update({"Origin": "http://localhost:5173"})
    res = session.post(f"{BASE_URL}/auth/login", data={"username": username, "password": TEST_PASSWORD})
    assert res.status_code == 200, res.text
    return session

def test_idor_under_load():
    print("\n--- Running IDOR Load Test ---")
    
    # Create two users
    user_a = create_and_approve_user("idor_a")
    user_b = create_and_approve_user("idor_b")
    
    session_a = login(user_a)
    session_b = login(user_b)
    
    docs_a = []
    
    # Upload 5 docs as User A concurrently
    def upload_doc():
        files = {'file': (f'test_{uuid.uuid4().hex[:4]}.pdf', b'%PDF-1.4 Fake PDF Content', 'application/pdf')}
        res = session_a.post(f"{BASE_URL}/api/documents", files=files)
        if res.status_code == 200:
            docs_a.append(res.json()["document"]["id"])
            
    threads = [threading.Thread(target=upload_doc) for _ in range(5)]
    for t in threads: t.start()
    for t in threads: t.join()
    
    print(f"User A uploaded {len(docs_a)} documents.")
    
    # Attempt to delete User A's docs as User B concurrently
    delete_statuses = []
    def delete_doc(doc_id):
        res = session_b.delete(f"{BASE_URL}/api/documents/{doc_id}")
        delete_statuses.append(res.status_code)
        
    threads = [threading.Thread(target=delete_doc, args=(doc_id,)) for doc_id in docs_a]
    for t in threads: t.start()
    for t in threads: t.join()
    
    if all(status == 403 for status in delete_statuses):
        print("✅ PASS: All concurrent cross-user deletes were rejected with 403 Forbidden.")
    else:
        print(f"❌ FAIL: Expected all 403s, got: {delete_statuses}")

def test_auth_abuse():
    print("\n--- Running Auth Abuse Test (Per-Account Lockout) ---")
    
    user_c = create_and_approve_user("abused")
    mock_ip = f"192.168.1.{uuid.uuid4().int % 255}"
    
    # Attempt 6 failed logins
    statuses = []
    for i in range(6):
        res = requests.post(f"{BASE_URL}/auth/login", data={"username": user_c, "password": "wrongpassword"}, headers={"X-Forwarded-For": mock_ip})
        statuses.append(res.status_code)
        time.sleep(0.1) # stagger slightly to ensure DB commits
        
    print(f"Failed login statuses: {statuses}")
    
    # 5 attempts should be 401, 6th attempt should be 403 (Account Locked) or 429 (slowapi global IP limit)
    if statuses[:5] == [401]*5 and statuses[5] in (403, 429):
        print(f"✅ PASS: Account successfully locked or rate-limited after 5 failed attempts (6th got {statuses[5]}).")
    else:
        print(f"❌ FAIL: Expected 5x 401 followed by 403/429, got: {statuses}")

def test_trending_terms():
    print("\n--- Running Trending Terms Privacy Test ---")
    
    conn = sqlite3.connect(DB_PATH)
    
    import random, string
    rand_suffix = ''.join(random.choices(string.ascii_lowercase, k=8))
    
    term_1_user = f"uniquetermone{rand_suffix}"
    term_2_users = f"uniquetermtwo{rand_suffix}"
    term_3_users = f"uniquetermthree{rand_suffix}"
    term_pii = "9876543210" # Should be scrubbed even if 5 users say it
    
    # Helper to insert users and messages
    def insert_users_and_msgs(term: str, user_count: int):
        for i in range(user_count):
            uid = str(uuid.uuid4())
            cid = str(uuid.uuid4())
            conn.execute("INSERT INTO users (id, username, password_hash, is_admin, status) VALUES (?, ?, ?, 0, 'approved')", (uid, f"term_user_{uuid.uuid4().hex[:6]}", "hash"))
            conn.execute("INSERT INTO conversations (id, title, user_id) VALUES (?, ?, ?)", (cid, "Conv", uid))
            conn.execute("INSERT INTO messages (id, conversation_id, role, content, sequence) VALUES (?, ?, 'user', ?, 1)", (str(uuid.uuid4()), cid, f"Hello {term} world"))
            
    insert_users_and_msgs(term_1_user, 1)
    insert_users_and_msgs(term_2_users, 2)
    insert_users_and_msgs(term_3_users, 3)
    insert_users_and_msgs(term_pii, 5)
    conn.commit()
    
    # Get analytics as admin
    admin_id = str(uuid.uuid4())
    conn.execute("INSERT INTO users (id, username, password_hash, is_admin, status) VALUES (?, ?, ?, 1, 'approved')", (admin_id, f"admin_analytics_{uuid.uuid4().hex[:6]}", "$2b$12$KIXeW9V336kHj.5M4y3l5eyhUvO6MkVX0B0kQ1O5U5zM6q5zM6q5z",))
    conn.commit()
    conn.close()
    
    # To hit the endpoint, we need a real login for this admin we just made
    # Actually wait, we inserted a fake hash. Let's just create a real admin via endpoint.
    admin_user = create_and_approve_user("real_admin")
    conn = sqlite3.connect(DB_PATH)
    conn.execute("UPDATE users SET is_admin=1 WHERE username=?", (admin_user,))
    conn.commit()
    conn.close()
    
    admin_session = login(admin_user)
    res = admin_session.get(f"{BASE_URL}/auth/admin/system-metrics")
    if res.status_code != 200:
        print(f"Failed to fetch analytics: {res.json()}")
    trending = res.json().get("trending_terms", [])
    terms = [t["term"] for t in trending]
    
    print(f"Trending terms fetched: {terms}")
    
    passed = True
    if term_1_user in terms:
        print(f"❌ FAIL: Term said by 1 user '{term_1_user}' appeared!")
        passed = False
    if term_2_users in terms:
        print(f"❌ FAIL: Term said by 2 users '{term_2_users}' appeared!")
        passed = False
    if term_3_users not in terms:
        print(f"❌ FAIL: Term said by 3 users '{term_3_users}' DID NOT appear!")
        passed = False
    if term_pii in terms:
        print(f"❌ FAIL: PII Term '{term_pii}' appeared despite scrubbing!")
        passed = False
        
    if passed:
        print("✅ PASS: Trending terms privacy filters worked perfectly.")

if __name__ == "__main__":
    # Ensure backend is running before testing
    try:
        requests.get(f"{BASE_URL}/")
    except requests.exceptions.ConnectionError:
        print("Ensure the backend is running at http://127.0.0.1:8000 before running this script.")
        exit(1)
        
    test_idor_under_load()
    test_auth_abuse()
    test_trending_terms()
