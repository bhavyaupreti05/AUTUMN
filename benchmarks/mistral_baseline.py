import time
import psutil
import os
import json
import statistics
from huggingface_hub import hf_hub_download

def print_memory():
    process = psutil.Process(os.getpid())
    mem_info = process.memory_info()
    sys_mem = psutil.virtual_memory()
    print(f"Process Memory: {mem_info.rss / 1024**2:.2f} MB")
    print(f"System Available: {sys_mem.available / 1024**2:.2f} MB")

def run_benchmark():
    print("=== Mistral 7B Q4_K_M Minimal Benchmark ===")
    print_memory()
    
    print("\n[1] Downloading/Locating Model...")
    start_time = time.time()
    # Mistral-7B-Instruct-v0.3-GGUF
    # We will use Q4_K_M
    model_path = hf_hub_download(
        repo_id="MaziyarPanahi/Mistral-7B-Instruct-v0.3-GGUF", 
        filename="Mistral-7B-Instruct-v0.3.Q4_K_M.gguf"
    )
    print(f"Model Path: {model_path}")
    print(f"Download/Locate Time: {time.time() - start_time:.2f}s")
    
    print("\n[2] Loading Model...")
    from llama_cpp import Llama
    start_time = time.time()
    
    llm = Llama(
        model_path=model_path,
        n_ctx=2048,
        n_threads=max(1, psutil.cpu_count(logical=False)),
        verbose=False
    )
    
    load_time = time.time() - start_time
    print(f"Model Load Time: {load_time:.2f}s")
    print_memory()

    prompts = [
        ("Short", "What is Python?"),
        ("Medium", "Explain how FastAPI works and why it is useful for building an API backend."),
        ("Detailed", "Explain the architecture of a local AI chatbot using an LLM, FastAPI, conversation memory, retrieval, and streaming.")
    ]
    
    results = {
        "load_time": load_time,
        "runs": []
    }
    
    print("\n[3] Running Prompts...")
    # Run multiple iterations (e.g. 2 per prompt for a quick benchmark)
    iterations = 2
    
    for category, prompt_text in prompts:
        print(f"\n--- {category} Prompt ---")
        prompt = f"<s>[INST] {prompt_text} [/INST]"
        
        category_stats = {"ttft": [], "tokens_sec": [], "total_latency": []}
        
        for i in range(iterations):
            print(f"Iteration {i+1}...")
            start_time = time.time()
            first_token_time = None
            token_count = 0
            
            stream = llm(
                prompt,
                max_tokens=256,
                temperature=0.1,
                stream=True
            )
            
            response_text = ""
            for output in stream:
                if first_token_time is None:
                    first_token_time = time.time()
                
                chunk = output["choices"][0]["text"]
                response_text += chunk
                token_count += 1
            
            end_time = time.time()
            
            ttft = first_token_time - start_time
            total_time = end_time - start_time
            # generation time after first token
            gen_time = end_time - first_token_time
            
            # Avoid division by zero
            tokens_sec = token_count / gen_time if gen_time > 0 else 0
            
            print(f"  TTFT: {ttft:.2f}s")
            print(f"  Throughput: {tokens_sec:.2f} tokens/s")
            print(f"  Total Latency: {total_time:.2f}s")
            
            category_stats["ttft"].append(ttft)
            category_stats["tokens_sec"].append(tokens_sec)
            category_stats["total_latency"].append(total_time)
            
            if i == 0: # Print sample response once
                print(f"  Sample Output: {response_text[:100]}...\n")
                
        results["runs"].append({
            "category": category,
            "prompt": prompt_text,
            "ttft_mean": statistics.mean(category_stats["ttft"]),
            "ttft_min": min(category_stats["ttft"]),
            "ttft_max": max(category_stats["ttft"]),
            "tokens_sec_mean": statistics.mean(category_stats["tokens_sec"]),
            "latency_mean": statistics.mean(category_stats["total_latency"])
        })
        
    print("\n=== Benchmark Complete ===")
    
    with open("BENCHMARK.md", "w") as f:
        f.write("# Minimal Mistral 7B Benchmark Results\n\n")
        f.write(f"**Model Load Time:** {results['load_time']:.2f}s\n\n")
        for run in results["runs"]:
            f.write(f"### {run['category']} Prompt\n")
            f.write(f"* **Prompt:** `{run['prompt']}`\n")
            f.write(f"* **TTFT Mean:** {run['ttft_mean']:.2f}s (Min: {run['ttft_min']:.2f}s, Max: {run['ttft_max']:.2f}s)\n")
            f.write(f"* **Throughput Mean:** {run['tokens_sec_mean']:.2f} tokens/sec\n")
            f.write(f"* **Total Latency Mean:** {run['latency_mean']:.2f}s\n\n")
            
if __name__ == "__main__":
    run_benchmark()
