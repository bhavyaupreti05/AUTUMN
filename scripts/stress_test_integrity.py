import asyncio
import aiohttp
import time
import json
import uuid

API_BASE = "http://127.0.0.1:8000/api"

async def test_chat(session, message, expected_status=None, timeout=60):
    start = time.time()
    conv_id = str(uuid.uuid4())
    
    # Create conversation
    async with session.post(f"{API_BASE}/conversations", json={"title": "Stress Test"}) as resp:
        conv_data = await resp.json()
        conv_id = conv_data["id"]
        
    try:
        async with session.post(f"{API_BASE}/chat", json={"message": message, "conversation_id": conv_id}, timeout=timeout) as resp:
            status = "UNKNOWN"
            chunks = 0
            
            async for line in resp.content:
                line = line.decode('utf-8').strip()
                if line.startswith("data: "):
                    data_str = line[6:]
                    if data_str == "[DONE]":
                        break
                    try:
                        data = json.loads(data_str)
                        if "chunk" in data:
                            chunks += 1
                        if "status" in data:
                            status = data["status"]
                        if "error" in data:
                            status = "ERROR"
                    except:
                        pass
                        
            elapsed = time.time() - start
            
            # Verify DB persistence
            async with session.get(f"{API_BASE}/conversations/{conv_id}") as c_resp:
                c_data = await c_resp.json()
                messages = c_data.get("messages", [])
                
                # Check persistence
                persisted = any(m["role"] == "assistant" for m in messages)
                
                if status == "COMPLETED" and not persisted:
                    print(f"FAILED: Completed but not persisted. Conv: {conv_id}")
                    return False
                if status == "MAX_TOKENS" and persisted:
                    print(f"FAILED: MAX_TOKENS but falsely persisted. Conv: {conv_id}")
                    return False
                if status == "ERROR" and persisted:
                    print(f"FAILED: ERROR but falsely persisted. Conv: {conv_id}")
                    return False
                    
            print(f"Success: message='{message[:20]}...', status={status}, chunks={chunks}, time={elapsed:.2f}s, persisted={persisted}")
            return True
            
    except Exception as e:
        print(f"Error during request: {e}")
        return False

async def main():
    print("Starting stress test...")
    # Make sure server is running
    async with aiohttp.ClientSession() as session:
        try:
            async with session.get(f"{API_BASE}/health") as resp:
                health = await resp.json()
                print(f"Health: {health}")
        except:
            print("Server not running on 8000. Please start the server first.")
            return
            
        print("\n--- Short Requests (20) ---")
        for i in range(20):
            await test_chat(session, f"Hello {i}. Say hi.")
            
        print("\n--- Medium Requests (20) ---")
        for i in range(20):
            await test_chat(session, f"Write a paragraph about quantum computing {i}.")
            
        print("\n--- Long Requests (10) ---")
        for i in range(10):
            await test_chat(session, f"Write a detailed essay about the history of Rome {i}.")
            
        print("\n--- RAG Requests (10) ---")
        # Assume RAG is enabled, just ask a document question
        for i in range(10):
            await test_chat(session, f"What does the document say about project X {i}?")
            
        print("\n--- MAX_TOKENS Requests (5) ---")
        # Force a very long response
        for i in range(5):
            await test_chat(session, f"Write a 3000 word essay on artificial intelligence {i}.")
            
    print("Stress test complete.")

if __name__ == "__main__":
    asyncio.run(main())
