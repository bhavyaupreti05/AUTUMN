import requests
import threading
import time
import json
import uuid

URL = "http://localhost:8000/api/chat"

def fire_request(req_id, token, results):
    headers = {"Cookie": f"access_token={token}", "Origin": "http://localhost:5173"}
    
    # Create conversation
    create_url = "http://localhost:8000/api/conversations"
    resp = requests.post(create_url, headers=headers, json={"title": "Test Concurrency"})
    if resp.status_code != 200:
        results[req_id] = {"status": "ERROR", "error": f"Failed to create conversation: {resp.text}"}
        return
        
    conv_id = resp.json().get("id")
    
    is_heavy = (req_id % 2 == 0)
    base_msg = f"Summarize this document {req_id}."
    if is_heavy:
        # Simulate heavy request with large context
        heavy_context = " This is additional context to make the request heavy and simulate a RAG injection. " * 50
        base_msg += heavy_context
        
    payload = {
        "message": base_msg,
        "conversation_id": conv_id
    }
    
    print(f"[Req {req_id}] Firing request (conv {conv_id}, heavy={is_heavy})... SUBMITTED at {time.time():.2f}")
    start_time = time.time()
    
    try:
        # stream=True because it's a Server-Sent Events endpoint
        response = requests.post(URL, json=payload, headers=headers, stream=True, timeout=60)
        
        status_code = response.status_code
        chunks = []
        for line in response.iter_lines():
            if line:
                chunks.append(line)
                try:
                    text = line.decode('utf-8')
                    if text.startswith("data: "):
                        data = json.loads(text[6:])
                        if data.get("type") == "debug_acquire":
                            print(f"[Req {req_id}] ({data['req_id']}) LOCK ACQUIRED at {data['time']:.2f}")
                        elif data.get("type") == "debug_release":
                            print(f"[Req {req_id}] ({data['req_id']}) LOCK RELEASED at {data['time']:.2f}")
                except Exception:
                    pass
                
        elapsed = time.time() - start_time
        print(f"[Req {req_id}] Finished in {elapsed:.2f}s | Status: {status_code} | Total Chunks: {len(chunks)}")
        if status_code == 503:
            print(f"[Req {req_id}] Got 503 Busy: {chunks}")
        results[req_id] = {"status": status_code, "time": elapsed, "chunks_len": len(chunks)}
        
    except Exception as e:
        elapsed = time.time() - start_time
        print(f"[Req {req_id}] FAILED in {elapsed:.2f}s | Error: {e}")
        results[req_id] = {"status": "ERROR", "time": elapsed, "error": str(e)}

def main():
    # Login first
    login_url = "http://localhost:8000/auth/login"
    resp = requests.post(login_url, data={"username": "bhavya05@mail.com", "password": "12345"})
    token = resp.cookies.get("access_token")
    if not token:
        print("Login failed!")
        return

    num_requests = 4
    threads = []
    results = {}
    
    print(f"Starting {num_requests} concurrent requests...")
    for i in range(num_requests):
        t = threading.Thread(target=fire_request, args=(i, token, results))
        threads.append(t)
        
    for t in threads:
        t.start()
        
    for t in threads:
        t.join()
        
    print("\n--- RESULTS ---")
    for req_id, res in results.items():
        print(f"Req {req_id}: {res}")

if __name__ == "__main__":
    main()
