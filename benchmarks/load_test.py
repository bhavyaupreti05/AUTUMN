import asyncio
import httpx
import time
import json
import statistics
import sys

API_URL = "http://127.0.0.1:8002/api"

async def run_health_poll(stop_event, health_latencies):
    async with httpx.AsyncClient() as client:
        while not stop_event.is_set():
            start = time.time()
            try:
                resp = await client.get(f"{API_URL}/health", timeout=10.0)
                resp.raise_for_status()
                lat = time.time() - start
                health_latencies.append(lat)
            except Exception as e:
                health_latencies.append(time.time() - start)
            await asyncio.sleep(0.1)

async def run_chat_request(client, user_id):
    start = time.time()
    ttft = None
    total_tokens = 0
    payload = {"message": f"User {user_id} says hello, tell me a short joke."}
    
    try:
        async with client.stream("POST", f"{API_URL}/chat", json=payload, timeout=60.0) as response:
            if response.status_code != 200:
                print(f"User {user_id} error {response.status_code}: {await response.aread()}")
                return None, 0, 0
                
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    data_str = line[6:]
                    if data_str == "[DONE]":
                        break
                    
                    data = json.loads(data_str)
                    if "chunk" in data:
                        if ttft is None:
                            ttft = time.time() - start
                        total_tokens += 1
                        
    except Exception as e:
        print(f"Request failed for user {user_id}: {type(e).__name__} - {str(e)}")
        
    total_time = time.time() - start
    return ttft, total_time, total_tokens

async def run_load_test(concurrency):
    print(f"\n--- Running Load Test with Concurrency: {concurrency} ---")
    health_latencies = []
    stop_event = asyncio.Event()
    
    poll_task = asyncio.create_task(run_health_poll(stop_event, health_latencies))
    
    async with httpx.AsyncClient() as client:
        tasks = [run_chat_request(client, i) for i in range(concurrency)]
        results = await asyncio.gather(*tasks)
    
    stop_event.set()
    await poll_task
    
    # Process Chat Results
    ttfts = [r[0] for r in results if r[0] is not None]
    total_times = [r[1] for r in results]
    
    avg_ttft = statistics.mean(ttfts) if ttfts else 0
    max_ttft = max(ttfts) if ttfts else 0
    avg_total = statistics.mean(total_times) if total_times else 0
    
    # Process Health Results
    if health_latencies:
        health_latencies.sort()
        p50 = health_latencies[int(len(health_latencies) * 0.5)]
        p95 = health_latencies[int(len(health_latencies) * 0.95)]
        p99 = health_latencies[int(len(health_latencies) * 0.99)]
    else:
        p50 = p95 = p99 = 0

    print(f"Chat TTFT: Avg = {avg_ttft:.2f}s, Max = {max_ttft:.2f}s")
    print(f"Chat Total Time: Avg = {avg_total:.2f}s")
    print(f"Health Latency (ms): p50 = {p50*1000:.1f}, p95 = {p95*1000:.1f}, p99 = {p99*1000:.1f}")

async def main():
    # Warmup
    print("Warming up server...")
    async with httpx.AsyncClient() as client:
        try:
            await client.get(f"{API_URL}/health")
        except:
            print("Server not running. Please start the server first.")
            return

    for c in [4]:
        await run_load_test(c)

if __name__ == "__main__":
    asyncio.run(main())
