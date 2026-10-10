import asyncio
import httpx
import time
import json
import psutil
import os
import uuid
import sqlite3
import statistics
from typing import List, Dict, Any

API_URL = "http://127.0.0.1:8000"
DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "chatbot.db"))

class Metrics:
    def __init__(self):
        self.success_count = 0
        self.error_503_count = 0
        self.other_error_count = 0
        self.hang_count = 0
        self.total_times = []
        self.ttfts = []
        self.cpu_usage = []
        self.mem_usage = []
        
    def add_result(self, status, time_taken, ttft=None):
        if status == 200:
            self.success_count += 1
            self.total_times.append(time_taken)
            if ttft:
                self.ttfts.append(ttft)
        elif status == 503:
            self.error_503_count += 1
        elif status == -1:
            self.hang_count += 1
        else:
            self.other_error_count += 1

    def print_summary(self, name):
        print(f"\n=== Results: {name} ===")
        print(f"Success (200): {self.success_count}")
        print(f"Lock Timeout (503): {self.error_503_count}")
        print(f"Hangs/Timeouts: {self.hang_count}")
        print(f"Other Errors: {self.other_error_count}")
        if self.total_times:
            print(f"Total Time (s): Min = {min(self.total_times):.2f}, Max = {max(self.total_times):.2f}, Avg = {statistics.mean(self.total_times):.2f}")
        if self.ttfts:
            print(f"TTFT (s): Min = {min(self.ttfts):.2f}, Max = {max(self.ttfts):.2f}, Avg = {statistics.mean(self.ttfts):.2f}")
        if self.cpu_usage:
            print(f"CPU Usage (%): Avg = {statistics.mean(self.cpu_usage):.1f}, Max = {max(self.cpu_usage):.1f}")
            print(f"RAM Usage (MB): Avg = {statistics.mean(self.mem_usage):.1f}, Max = {max(self.mem_usage):.1f}")

def setup_users(count=10, is_admin=False):
    users = []
    # Create users directly in DB to bypass rate limits
    conn = sqlite3.connect(DB_PATH)
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    pass_hash = pwd_context.hash("pwd")
    
    # Import token generator
    import sys
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
    from src.auth.security import create_access_token
    from datetime import timedelta
    
    for i in range(count):
        user_id = str(uuid.uuid4())
        username = f"loaduser_{uuid.uuid4().hex[:6]}"
        admin_val = 1 if is_admin else 0
        
        conn.execute(
            "INSERT INTO users (id, username, password_hash, is_admin, status) VALUES (?, ?, ?, ?, 'approved')",
            (user_id, username, pass_hash, admin_val)
        )
        conn.commit()
        
        # Generate token directly
        access_token_expires = timedelta(minutes=30)
        token = create_access_token(
            data={"sub": username}, expires_delta=access_token_expires
        )
        users.append(token)

    conn.close()
    return users

async def monitor_resources(stop_event, metrics):
    # Initialize CPU measurement
    psutil.cpu_percent(interval=None)
    while not stop_event.is_set():
        await asyncio.sleep(0.5)
        cpu = psutil.cpu_percent(interval=None)
        mem = psutil.virtual_memory().used / (1024 * 1024)
        metrics.cpu_usage.append(cpu)
        metrics.mem_usage.append(mem)

async def check_health(stop_event):
    async with httpx.AsyncClient() as client:
        while not stop_event.is_set():
            try:
                await client.get(f"{API_URL}/health", timeout=5.0)
            except Exception as e:
                print(f"[Health Check Failed] {e}")
            await asyncio.sleep(2)

async def simple_chat(client: httpx.AsyncClient, token: str, metrics: Metrics):
    headers = {"Authorization": f"Bearer {token}"}
    start = time.time()
    ttft = None
    
    payload = {"message": "Hello, how are you today?"}
    try:
        async with client.stream("POST", f"{API_URL}/api/chat", json=payload, headers=headers, timeout=120.0) as response:
            if response.status_code != 200:
                metrics.add_result(response.status_code, time.time() - start)
                return
            
            full_text = ""
            async for line in response.aiter_lines():
                if line.startswith("data: ") and not line.startswith("data: [DONE]"):
                    try:
                        data = json.loads(line[6:])
                    except:
                        continue
                    if "error" in data:
                        metrics.add_result(503, time.time() - start)
                        return
                    if "chunk" in data:
                        full_text += data["chunk"]
                    if ttft is None:
                        ttft = time.time() - start
        
        # Log the full text to a file for manual verification
        with open("scratch/responses.txt", "a") as f:
            f.write(f"--- Response ---\n{full_text}\n\n")
            
        metrics.add_result(200, time.time() - start, ttft)
    except httpx.ReadTimeout:
        metrics.add_result(-1, time.time() - start)
    except Exception as e:
        metrics.add_result(500, time.time() - start)

async def rag_chat(client: httpx.AsyncClient, token: str, doc_id: str, metrics: Metrics):
    headers = {"Authorization": f"Bearer {token}"}
    start = time.time()
    ttft = None
    
    payload = {"message": "Summarize this document in detail.", "document_id": doc_id}
    try:
        async with client.stream("POST", f"{API_URL}/api/chat", json=payload, headers=headers, timeout=240.0) as response:
            if response.status_code != 200:
                metrics.add_result(response.status_code, time.time() - start)
                return
            
            async for line in response.aiter_lines():
                if line.startswith("data: ") and not line.startswith("data: [DONE]"):
                    try:
                        data = json.loads(line[6:])
                    except:
                        continue
                    if "error" in data:
                        metrics.add_result(503, time.time() - start)
                        return
                    if ttft is None and "chunk" in data:
                        ttft = time.time() - start
        metrics.add_result(200, time.time() - start, ttft)
    except httpx.ReadTimeout:
        metrics.add_result(-1, time.time() - start)
    except Exception as e:
        metrics.add_result(500, time.time() - start)

async def upload_doc(client: httpx.AsyncClient, token: str, metrics: Metrics):
    headers = {"Authorization": f"Bearer {token}"}
    start = time.time()
    pdf_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "test_pages.pdf"))
    
    try:
        with open(pdf_path, "rb") as f:
            files = {"file": ("test_pages.pdf", f, "application/pdf")}
            r = await client.post(f"{API_URL}/api/documents", headers=headers, files=files, timeout=300.0)
            metrics.add_result(r.status_code, time.time() - start)
    except httpx.ReadTimeout:
        metrics.add_result(-1, time.time() - start)
    except Exception as e:
        metrics.add_result(500, time.time() - start)

async def admin_dashboard(client: httpx.AsyncClient, token: str, metrics: Metrics):
    headers = {"Authorization": f"Bearer {token}"}
    start = time.time()
    try:
        r = await client.get(f"{API_URL}/auth/admin/approved", headers=headers, timeout=10.0)
        metrics.add_result(r.status_code, time.time() - start)
    except httpx.ReadTimeout:
        metrics.add_result(-1, time.time() - start)
    except Exception as e:
        metrics.add_result(500, time.time() - start)

async def scenario_a(users):
    print("\nStarting Scenario A: 10 concurrent simple chat messages")
    metrics = Metrics()
    
    # Start resource monitor
    stop_event = asyncio.Event()
    mon_task = asyncio.create_task(monitor_resources(stop_event, metrics))
    
    async with httpx.AsyncClient() as client:
        tasks = [simple_chat(client, users[i], metrics) for i in range(10)]
        await asyncio.gather(*tasks)
        
    stop_event.set()
    await mon_task
    
    print("\n=== Results: Scenario A (10 Simple Chats) ===")
    metrics.print_summary("Scenario A (10 Simple Chats)")
    return

async def scenario_b(users):
    print("\nStarting Scenario B: 10 concurrent heavy RAG requests")
    # First, upload 1 document to use for all RAG queries (or we can just upload once sequentially)
    print("Uploading test document for RAG setup...")
    doc_id = None
    with httpx.Client() as client:
        pdf_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "test_pages.pdf"))
        with open(pdf_path, "rb") as f:
            r = client.post(f"{API_URL}/api/documents", headers={"Authorization": f"Bearer {users[0]}"}, files={"file": ("test_pages.pdf", f, "application/pdf")}, timeout=300)
            try:
                doc_id = r.json()["document"]["id"]
            except KeyError:
                print(f"Failed to parse document ID from response: {r.text}")
            print(f"Document uploaded: {doc_id}")
    
    if not doc_id:
        print("Failed to upload document for Scenario B.")
        return

    metrics = Metrics()
    stop_event = asyncio.Event()
    mon_task = asyncio.create_task(monitor_resources(stop_event, metrics))
    health_task = asyncio.create_task(check_health(stop_event))
    
    async with httpx.AsyncClient() as client:
        tasks = [rag_chat(client, users[i], doc_id, metrics) for i in range(10)]
        await asyncio.gather(*tasks)
        
    stop_event.set()
    await mon_task
    metrics.print_summary("Scenario B (10 Heavy RAG)")

async def scenario_c(users, admin_user):
    print("\nStarting Scenario C: Mixed realistic load")
    # 6 simple chats, 2 RAG queries, 1 document upload, 1 admin dashboard
    
    print("Uploading test document for RAG setup...")
    doc_id = None
    with httpx.Client() as client:
        pdf_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "test_pages.pdf"))
        with open(pdf_path, "rb") as f:
            r = client.post(f"{API_URL}/api/documents", headers={"Authorization": f"Bearer {users[0]}"}, files={"file": ("test_pages.pdf", f, "application/pdf")}, timeout=300)
            try:
                doc_id = r.json()["document"]["id"]
            except KeyError:
                print(f"Failed to parse document ID from response: {r.text}")
    
    chat_metrics = Metrics()
    rag_metrics = Metrics()
    upload_metrics = Metrics()
    admin_metrics = Metrics()
    global_metrics = Metrics()
    
    stop_event = asyncio.Event()
    mon_task = asyncio.create_task(monitor_resources(stop_event, global_metrics))
    health_task = asyncio.create_task(check_health(stop_event))
    
    async with httpx.AsyncClient() as client:
        tasks = []
        for i in range(6):
            tasks.append(simple_chat(client, users[i], chat_metrics))
        for i in range(6, 8):
            tasks.append(rag_chat(client, users[i], doc_id, rag_metrics))
        tasks.append(upload_doc(client, users[8], upload_metrics))
        
        # Fire admin task inside the loop
        async def delayed_admin():
            await asyncio.sleep(2) # Wait a sec so lock is definitely held
            await admin_dashboard(client, admin_user, admin_metrics)
            
        tasks.append(delayed_admin())
        
        await asyncio.gather(*tasks)
        
    stop_event.set()
    await mon_task
    
    chat_metrics.print_summary("Scenario C - Simple Chat (x6)")
    rag_metrics.print_summary("Scenario C - RAG Chat (x2)")
    upload_metrics.print_summary("Scenario C - Upload (x1)")
    admin_metrics.print_summary("Scenario C - Admin Dashboard (x1)")
    print(f"\nScenario C Resource Usage:")
    print(f"CPU Usage (%): Avg = {statistics.mean(global_metrics.cpu_usage):.1f}, Max = {max(global_metrics.cpu_usage):.1f}")
    print(f"RAM Usage (MB): Avg = {statistics.mean(global_metrics.mem_usage):.1f}, Max = {max(global_metrics.mem_usage):.1f}")


async def main():
    print("Setting up users...")
    users = setup_users(10)
    admin_users = setup_users(1, is_admin=True)
    if not users or not admin_users:
        print("Failed to setup users. Is server running?")
        return
        
    await scenario_a(users)
    await scenario_b(users)
    await scenario_c(users, admin_users[0])
    
if __name__ == "__main__":
    asyncio.run(main())
