from model_benchmark import BenchmarkConfig, run_model_benchmark

def main():
    # Using Qwen2.5-3B-Instruct Q4_K_M
    # This provides an excellent balance between quality and small footprint.
    config = BenchmarkConfig(
        repo_id="Qwen/Qwen2.5-3B-Instruct-GGUF",
        filename="qwen2.5-3b-instruct-q4_k_m.gguf",
        model_name="Qwen2.5 3B",
        n_ctx=2048
    )
    
    run_model_benchmark(config)

if __name__ == "__main__":
    main()
