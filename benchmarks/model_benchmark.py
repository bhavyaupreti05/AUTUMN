import time
import psutil
import os
import statistics
from huggingface_hub import hf_hub_download

class BenchmarkConfig:
    def __init__(self, repo_id, filename, model_name, n_ctx=2048, n_threads=None):
        self.repo_id = repo_id
        self.filename = filename
        self.model_name = model_name
        self.n_ctx = n_ctx
        self.n_threads = n_threads or max(1, psutil.cpu_count(logical=False))

def print_memory():
    process = psutil.Process(os.getpid())
    mem_info = process.memory_info()
    sys_mem = psutil.virtual_memory()
    print(f"Process Memory: {mem_info.rss / 1024**2:.2f} MB")
    print(f"System Available: {sys_mem.available / 1024**2:.2f} MB")
    return mem_info.rss / 1024**2, sys_mem.available / 1024**2

def run_model_benchmark(config: BenchmarkConfig):
    print(f"=== Benchmark for {config.model_name} ===")
    
    mem_before_load_proc, mem_before_load_sys = print_memory()
    if mem_before_load_sys < 1000:
        print("WARNING: Available system RAM is dangerously low! (< 1000 MB)")
    
    print("\n[1] Downloading/Locating Model...")
    start_time = time.time()
    try:
        model_path = hf_hub_download(repo_id=config.repo_id, filename=config.filename)
    except Exception as e:
        print(f"Failed to download/locate model: {e}")
        return
        
    print(f"Model Path: {model_path}")
    print(f"File Size: {os.path.getsize(model_path) / 1024**3:.2f} GB")
    print(f"Download/Locate Time: {time.time() - start_time:.2f}s")
    
    print("\n[2] Loading Model...")
    from llama_cpp import Llama
    start_time = time.time()
    
    llm = Llama(
        model_path=model_path,
        n_ctx=config.n_ctx,
        n_threads=config.n_threads,
        verbose=False
    )
    
    load_time = time.time() - start_time
    print(f"Model Load Time: {load_time:.2f}s")
    mem_after_load_proc, mem_after_load_sys = print_memory()

    prompts = [
        ("Short", "What is Python?"),
        ("Medium", "Explain how FastAPI works and why it is useful for building an API backend."),
        ("Detailed", "Explain the architecture of a local AI chatbot using an LLM, FastAPI, conversation memory, retrieval, and streaming.")
    ]
    
    results = {
        "model_name": config.model_name,
        "filename": config.filename,
        "file_size_gb": os.path.getsize(model_path) / 1024**3,
        "load_time": load_time,
        "mem_before_sys": mem_before_load_sys,
        "mem_after_sys": mem_after_load_sys,
        "mem_after_proc": mem_after_load_proc,
        "runs": []
    }
    
    print(f"\n[3] Running Prompts with {config.n_threads} threads...")
    iterations = 4 # 1 cold run, 3 warm runs
    
    with open(f"{config.model_name.lower().replace(' ', '_')}_quality_report.md", "w") as q_file:
        q_file.write(f"# Quality Report for {config.model_name}\n\n")
        
        for category, prompt_text in prompts:
            print(f"\n--- {category} Prompt ---")
            
            # Using ChatML-like or appropriate chat format, for general usage we'll wrap as standard instruction format
            # Llama-cpp-python has chat completion formatting, but for generic benchmark we can use raw completions or its chat API.
            # Using create_chat_completion is better for robust prompting across models.
            
            category_stats = {"ttft": [], "tokens_sec": [], "total_latency": []}
            
            for i in range(iterations):
                run_type = "Cold" if i == 0 else "Warm"
                print(f"Iteration {i+1} ({run_type})...")
                
                # Check memory during execution
                sys_mem = psutil.virtual_memory()
                if sys_mem.available / 1024**2 < 200:
                    print("CRITICAL MEMORY PRESSURE: < 200MB available. Stopping benchmark to prevent system crash.")
                    return
                
                start_time = time.time()
                first_token_time = None
                token_count = 0
                response_text = ""
                
                stream = llm.create_chat_completion(
                    messages=[{"role": "user", "content": prompt_text}],
                    max_tokens=256,
                    temperature=0.1,
                    stream=True
                )
                
                for output in stream:
                    if first_token_time is None:
                        first_token_time = time.time()
                    
                    if "content" in output["choices"][0]["delta"]:
                        chunk = output["choices"][0]["delta"]["content"]
                        response_text += chunk
                        token_count += 1
                
                end_time = time.time()
                
                ttft = first_token_time - start_time
                total_time = end_time - start_time
                gen_time = end_time - first_token_time
                tokens_sec = token_count / gen_time if gen_time > 0 else 0
                
                print(f"  {run_type} TTFT: {ttft:.2f}s")
                print(f"  Throughput: {tokens_sec:.2f} tokens/s")
                print(f"  Total Latency: {total_time:.2f}s")
                
                category_stats["ttft"].append(ttft)
                category_stats["tokens_sec"].append(tokens_sec)
                category_stats["total_latency"].append(total_time)
                
                if i == 1: # Save first warm output for quality check
                    q_file.write(f"### {category} Prompt\n")
                    q_file.write(f"**Prompt:** {prompt_text}\n\n")
                    q_file.write(f"**Output:**\n{response_text}\n\n")
                    q_file.write(f"**Tokens Generated:** {token_count}\n\n---\n")
                    
            warm_ttfts = category_stats["ttft"][1:]
            warm_tps = category_stats["tokens_sec"][1:]
            warm_lats = category_stats["total_latency"][1:]
            
            results["runs"].append({
                "category": category,
                "prompt": prompt_text,
                "cold_ttft": category_stats["ttft"][0],
                "warm_ttft_mean": statistics.mean(warm_ttfts),
                "tokens_sec_mean": statistics.mean(category_stats["tokens_sec"]), # all runs
                "warm_tokens_sec_mean": statistics.mean(warm_tps),
                "latency_mean": statistics.mean(warm_lats)
            })
            
    print("\n=== Benchmark Complete ===")
    
    with open(f"{config.model_name.lower().replace(' ', '_')}_benchmark_results.md", "w") as f:
        f.write(f"# Benchmark Results: {config.model_name}\n\n")
        f.write(f"* **File:** `{config.filename}` ({results['file_size_gb']:.2f} GB)\n")
        f.write(f"* **Model Load Time:** {results['load_time']:.2f}s\n")
        f.write(f"* **RAM Before Load:** {results['mem_before_sys']:.2f} MB available\n")
        f.write(f"* **RAM After Load:** {results['mem_after_sys']:.2f} MB available\n")
        f.write(f"* **Process Peak/Current Memory:** {results['mem_after_proc']:.2f} MB\n\n")
        
        for run in results["runs"]:
            f.write(f"### {run['category']} Prompt\n")
            f.write(f"* **Prompt:** `{run['prompt']}`\n")
            f.write(f"* **Cold TTFT:** {run['cold_ttft']:.2f}s\n")
            f.write(f"* **Warm TTFT (Mean):** {run['warm_ttft_mean']:.2f}s\n")
            f.write(f"* **Throughput (Warm Mean):** {run['warm_tokens_sec_mean']:.2f} tokens/sec\n")
            f.write(f"* **Total Latency (Warm Mean):** {run['latency_mean']:.2f}s\n\n")
