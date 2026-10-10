import asyncio
import httpx
import psutil
import os

def get_mem():
    for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
        try:
            cmd = proc.info['cmdline']
            if cmd and 'src/api/main.py' in ' '.join(cmd):
                return proc.memory_info().rss / 1024 / 1024
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            pass
    return 0

async def run_sustained_test():
    async with httpx.AsyncClient() as client:
        success_count = 0
        failure_count = 0
        
        print(f"Initial Server Memory: {get_mem():.2f} MB")
        
        # 50 iterations * (1 seq + 2 conc) = 150 requests total
        for i in range(50):
            # 1 sequential request
            resp = await client.post("http://127.0.0.1:8002/api/chat", json={"message": f"Hello {i}", "max_tokens": 10}, timeout=60.0)
            if resp.status_code == 200:
                success_count += 1
            else:
                failure_count += 1
                
            mem = get_mem()
            print(f"Iteration {i:02d} seq: {mem:.2f} MB")
            
            # 2 concurrent requests
            async def req(u):
                try:
                    return await client.post("http://127.0.0.1:8002/api/chat", json={"message": f"Hello {i}-{u}", "max_tokens": 10}, timeout=60.0)
                except Exception as e:
                    return e
            
            resps = await asyncio.gather(req(0), req(1))
            for r in resps:
                if isinstance(r, Exception) or r.status_code != 200:
                    failure_count += 1
                else:
                    success_count += 1
                    
            mem = get_mem()
            print(f"Iteration {i:02d} conc: {mem:.2f} MB")
            
        print(f"\nTest completed. Success: {success_count}, Failures: {failure_count}")

if __name__ == "__main__":
    asyncio.run(run_sustained_test())
