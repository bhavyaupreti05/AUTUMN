import requests
import time
import uuid

URL = "http://localhost:8000/api/chat"
BASE_URL = "http://localhost:8000"

def simulate_disconnect():
    r = requests.post(f"{BASE_URL}/auth/login", data={"username": "bhavya05@mail.com", "password": "12345"})
    token = r.cookies.get("access_token")
    headers = {"Content-Type": "application/json", "Cookie": f"access_token={token}", "Origin": "http://localhost:5173"}
    
    create_url = "http://localhost:8000/api/conversations"
    resp = requests.post(create_url, headers=headers, json={"title": "Test Disconnect"})
    conv_id = resp.json().get("id")
    
    payload = {
        "message": "Summarize this document 2. This is additional context to make the request heavy and simulate a RAG injection. " * 50,
        "conversation_id": conv_id
    }
    
    print(f"[Client] Submitting heavy request...")
    try:
        response = requests.post(URL, json=payload, headers=headers, stream=True, timeout=60)
        start_time = time.time()
        for chunk in response.iter_content(chunk_size=1):
            if time.time() - start_time > 5:
                print(f"[Client] Deliberately closing connection after 5 seconds!")
                response.close() # Close socket
                break
    except Exception as e:
        print(f"[Client] Exception: {e}")

if __name__ == "__main__":
    simulate_disconnect()
