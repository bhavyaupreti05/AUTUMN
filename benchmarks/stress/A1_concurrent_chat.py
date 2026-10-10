import asyncio
import httpx
import time
import json
from stress_utils import get_admin_token, create_stress_users, API_BASE

async def chat_worker(token, user_id, num_messages=5):
    latency = []
    errors = []
    
    async with httpx.AsyncClient(timeout=120.0) as client:
        # Create a conversation
        res = await client.post(
            f"{API_BASE}/api/conversations", 
            json={"title": f"Stress Conv {user_id}"},
            headers={"Authorization": f"Bearer {token}"}
        )
        if res.status_code != 200:
            errors.append(f"Failed to create conv: {res.status_code}")
            return latency, errors
            
        conv_id = res.json()["id"]
        
        for i in range(num_messages):
            start_time = time.time()
            try:
                res = await client.post(
                    f"{API_BASE}/api/chat",
                    json={"message": f"Hello from user {user_id} message {i}. Tell me a very short joke.", "conversation_id": conv_id},
                    headers={"Authorization": f"Bearer {token}"}
                )
                
                if res.status_code != 200:
                    errors.append(f"Chat error {res.status_code}: {res.text}")
                else:
                    # Drain the stream
                    async for chunk in res.aiter_text():
                        pass
                latency.append(time.time() - start_time)
            except Exception as e:
                errors.append(f"Exception: {str(e)}")
                
    return latency, errors

async def run_stress_test(num_users, messages_per_user):
    print(f"\n--- Starting Chat Stress Test: {num_users} users, {messages_per_user} messages each ---")
    admin_token = await get_admin_token()
    print("Getting user tokens...")
    tokens = await create_stress_users(admin_token, num_users)
    
    print(f"Executing {num_users} concurrent sessions...")
    start_total = time.time()
    
    tasks = [chat_worker(token, i, messages_per_user) for i, token in enumerate(tokens)]
    results = await asyncio.gather(*tasks)
    
    end_total = time.time()
    
    all_latencies = []
    all_errors = []
    for lat, err in results:
        all_latencies.extend(lat)
        all_errors.extend(err)
        
    print(f"Total time elapsed: {end_total - start_total:.2f}s")
    print(f"Total requests: {len(all_latencies) + len(all_errors)}")
    print(f"Successful requests: {len(all_latencies)}")
    print(f"Error count: {len(all_errors)}")
    
    if all_latencies:
        print(f"Average Latency: {sum(all_latencies)/len(all_latencies):.2f}s")
        print(f"Max Latency: {max(all_latencies):.2f}s")
        
    if all_errors:
        print("Sample errors:", all_errors[:5])
        
    return len(all_errors) == 0

async def main():
    # Start conservative
    await run_stress_test(5, 5)
    # Ramp up
    await run_stress_test(10, 5)
    await run_stress_test(25, 3)

if __name__ == "__main__":
    asyncio.run(main())
