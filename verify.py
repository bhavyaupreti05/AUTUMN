import requests
import sqlite3
import sys

base_url = "http://localhost:8080"

def run_tests():
    session = requests.Session()
    session.headers.update({"Origin": "http://localhost:5173"})
    print("Step 2: Testing login.html")
    r = requests.get(f"{base_url}/login.html")
    if r.status_code == 200 and "ChatBot-2 Login" in r.text:
        print("PASS: login.html loaded successfully")
    else:
        print(f"FAIL: login.html returned {r.status_code}")
        return
        
    print("\nStep 3: Register first user (admin)")
    r = session.post(f"{base_url}/auth/register", json={"username": "admin_user", "password": "password123"})
    if r.status_code == 200 and r.json().get("status") == "approved":
        print("PASS: First user registered and approved")
    else:
        print(f"FAIL: First user registration failed or not approved. Resp: {r.text}")
        return
        
    # Get admin token
    r = session.post(f"{base_url}/auth/login", data={"username": "admin_user", "password": "password123"})
    if r.status_code == 200 and session.cookies.get("access_token"):
        print("PASS: Admin logged in successfully")
    else:
        print("FAIL: Admin could not log in")
        return
        
    print("\nStep 4: Register second user")
    r = session.post(f"{base_url}/auth/register", json={"username": "second_user", "password": "password123"})
    if r.status_code == 200 and r.json().get("status") == "pending":
        print("PASS: Second user registered and pending")
    else:
        print(f"FAIL: Second user registration failed or not pending. Resp: {r.text}")
        return
        
    # Attempt login as second user
    r = session.post(f"{base_url}/auth/login", data={"username": "second_user", "password": "password123"})
    if r.status_code == 401 and "Incorrect username or password" in r.text:
        print("PASS: Second user cannot log in")
    else:
        print(f"FAIL: Second user login behavior unexpected. Resp: {r.status_code} {r.text}")
        return
        
    print("\nStep 5: Admin approves second user")
    # need second user ID
    conn = sqlite3.connect("data/chatbot.db")
    c = conn.cursor()
    c.execute("SELECT id FROM users WHERE username = 'second_user'")
    user2_id = c.fetchone()[0]
    conn.close()
    
    r = session.post(f"{base_url}/auth/admin/approve/{user2_id}")
    if r.status_code == 200:
        print("PASS: Admin approved second user")
    else:
        print(f"FAIL: Admin could not approve second user. Resp: {r.status_code} {r.text}")
        return
        
    # Attempt login as second user again
    r = session.post(f"{base_url}/auth/login", data={"username": "second_user", "password": "password123"})
    if r.status_code == 200 and session.cookies.get("access_token"):
        print("PASS: Second user logged in successfully after approval")
    else:
        print(f"FAIL: Second user could not log in after approval. Resp: {r.status_code} {r.text}")
        return
        
    print("\nStep 6: API Endpoint access")
    # Unauthenticated
    r = requests.get(f"{base_url}/api/conversations")
    if r.status_code in [401, 403]:
        print("PASS: GET /api/conversations rejected unauthenticated request")
    else:
        print(f"FAIL: GET /api/conversations unauth returned {r.status_code}")
        
    r = requests.post(f"{base_url}/api/chat", json={"message": "hello"})
    if r.status_code in [401, 403]:
        print("PASS: POST /api/chat rejected unauthenticated request")
    else:
        print(f"FAIL: POST /api/chat unauth returned {r.status_code}")
        
    # Authenticated
    r = session.get(f"{base_url}/api/conversations")
    if r.status_code == 200:
        print("PASS: GET /api/conversations succeeded for authenticated user")
    else:
        print(f"FAIL: GET /api/conversations auth returned {r.status_code}")
        
    print("ALL TESTS PASSED")

if __name__ == "__main__":
    run_tests()
