import time
import requests
import json
import statistics

API_URL = "http://127.0.0.1:8000/api/chat"

prompts = [
    ("Short", "What is Python?"),
    ("Medium", "Explain how FastAPI works and why it is useful for building an API backend."),
    ("Detailed", "Explain the architecture of a local AI chatbot using an LLM, FastAPI, conversation memory, retrieval, and streaming.")
]

def run_benchmark():
    print("=== API Overhead Benchmark (Phase 2) ===")
    results = []

    # Wait for the API to be available
    try:
        requests.get("http://127.0.0.1:8000/api/health")
    except requests.exceptions.ConnectionError:
        print("API is not running. Please start the API server first:")
        print("uvicorn src.api.main:app --host 127.0.0.1 --port 8000")
        return

    # Run one warm-up request
    print("Sending warm-up request...")
    try:
        warmup_res = requests.post(API_URL, json={"message": "Warm up"}, stream=True)
        for line in warmup_res.iter_lines():
            pass # consume stream
        warmup_res.close()
    except Exception as e:
        print(f"Warm up failed: {e}")
        return

    for category, prompt in prompts:
        print(f"\n--- {category} Prompt ---")
        
        ttfts = []
        latencies = []
        throughputs = []
        
        for i in range(2): # Run 2 times for stable average
            start_time = time.time()
            first_token_time = None
            token_count = 0
            
            response = requests.post(API_URL, json={"message": prompt}, stream=True)
            
            for line in response.iter_lines():
                if line:
                    decoded_line = line.decode('utf-8')
                    if decoded_line.startswith("data: "):
                        data_str = decoded_line[6:]
                        if data_str == "[DONE]":
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
            time.sleep(1) # Give server a moment to cleanup
            
            end_time = time.time()
            
            if first_token_time is None:
                 # fallback if no tokens
                 first_token_time = end_time
                 
            ttft = first_token_time - start_time
            total_time = end_time - start_time
            gen_time = end_time - first_token_time
            tokens_sec = token_count / gen_time if gen_time > 0 else 0
            
            print(f"  Run {i+1} - TTFT: {ttft:.2f}s | Latency: {total_time:.2f}s | Throughput: {tokens_sec:.2f} tokens/s")
            
            ttfts.append(ttft)
            latencies.append(total_time)
            throughputs.append(tokens_sec)
            
        results.append({
            "category": category,
            "ttft_mean": statistics.mean(ttfts),
            "latency_mean": statistics.mean(latencies),
            "throughput_mean": statistics.mean(throughputs)
        })

    print("\n=== Benchmark Summary ===")
    for res in results:
        print(f"{res['category']} - Mean TTFT: {res['ttft_mean']:.2f}s | Latency: {res['latency_mean']:.2f}s | Throughput: {res['throughput_mean']:.2f} tokens/s")

if __name__ == "__main__":
    run_benchmark()
