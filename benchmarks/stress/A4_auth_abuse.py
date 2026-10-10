import httpx
import asyncio
import time
from stress_utils import API_BASE

async def worker(mode):
    async with httpx.AsyncClient() as client:
        if mode == "invalid":
            res = await client.post(f"{API_BASE}/auth/login", data={"username": "bad", "password": "bad"})
            return res.status_code
        elif mode == "admin_abuse":
            # Using invalid token on admin endpoint
            res = await client.get(f"{API_BASE}/auth/admin/system-metrics", headers={"Authorization": "Bearer BAD_TOKEN"})
            return res.status_code

async def run_auth_abuse(concurrency=50, total_requests=500):
    print(f"\n--- Starting Auth Abuse Test: {total_requests} requests at {concurrency} concurrency ---")
    start = time.time()
    
    semaphore = asyncio.Semaphore(concurrency)
    
    async def run_req(mode):
        async with semaphore:
            return await worker(mode)
            
    tasks = [run_req("invalid") if i % 2 == 0 else run_req("admin_abuse") for i in range(total_requests)]
    results = await asyncio.gather(*tasks)
    
    end = time.time()
    
    from collections import Counter
    counts = Counter(results)
    
    print(f"Total time: {end - start:.2f}s")
    print(f"Status codes: {counts}")
    
if __name__ == "__main__":
    asyncio.run(run_auth_abuse())
