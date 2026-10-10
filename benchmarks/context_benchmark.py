import time
import requests
import json
import statistics

# Set API URL
API_URL = "http://127.0.0.1:8000/api/chat"

def measure_request(messages_setup, user_prompt):
    """
    Creates a new conversation, seeds it with dummy context, then measures TTFT for the next prompt.
    """
    # Create conversation
    res_conv = requests.post("http://127.0.0.1:8000/api/conversations", json={"title": "Context Benchmark"})
    conv_id = res_conv.json()["id"]
    
    # Seed context via direct API calls (waiting for them to finish, ignoring output)
    # Actually, we can seed them directly into DB if we import the repo, but let's just 
    # mock it by calling the repo directly to avoid the LLM generation time for setup.
    from src.database.repository import ConversationRepository
    repo = ConversationRepository()
    
    for i in range(messages_setup):
        repo.save_message(conv_id, "user", f"Dummy user message {i}")
        repo.save_message(conv_id, "assistant", f"Dummy assistant response {i}")
        
    # Now send the real prompt and measure
    start_time = time.time()
    first_token_time = None
    token_count = 0
    
    response = requests.post(API_URL, json={"message": user_prompt, "conversation_id": conv_id}, stream=True)
    
    for line in response.iter_lines():
        if line:
            decoded = line.decode('utf-8')
            if decoded.startswith('data: '):
                data_str = decoded[6:]
                if data_str == '[DONE]':
                    break
                try:
                    data = json.loads(data_str)
                    if "chunk" in data:
                        if first_token_time is None:
                            first_token_time = time.time()
                        token_count += 1
                except json.JSONDecodeError:
                    pass
                    
    response.close()
    time.sleep(1) # Cleanup server side
    end_time = time.time()
    
    if first_token_time is None:
        first_token_time = end_time # Fallback if error
        
    ttft = first_token_time - start_time
    total_time = end_time - start_time
    gen_time = end_time - first_token_time
    tps = token_count / gen_time if gen_time > 0 else 0
    
    # Cleanup DB
    repo.delete_conversation(conv_id)
    
    return ttft, tps, total_time

def run_context_benchmark():
    context_sizes = [0, 5, 10, 20]
    prompt = "Reply with exactly one word: Hello."
    
    print("=== Context Size vs Latency Benchmark ===\n")
    
    for size in context_sizes:
        print(f"Testing with {size} previous historical messages...")
        ttfts = []
        tpss = []
        
        # Warmup for each size (so DB page caching etc is warm)
        measure_request(size, prompt)
        
        for i in range(2): # 2 test runs
            ttft, tps, lat = measure_request(size, prompt)
            ttfts.append(ttft)
            tpss.append(tps)
            
        mean_ttft = statistics.mean(ttfts)
        mean_tps = statistics.mean(tpss)
        
        print(f"  Context {size} - Mean TTFT: {mean_ttft:.2f}s | Throughput: {mean_tps:.2f} tokens/s\n")

if __name__ == "__main__":
    run_context_benchmark()
