# Benchmark Documentation

## Hardware & Environment
- **CPU**: Intel i7-8650U (4 Cores / 8 Threads)
- **RAM**: 16 GB System Memory
- **GPU**: NVIDIA GeForce MX130 2 GB (Not utilized, CPU-first inference)
- **OS**: Windows Desktop
- **Python**: 3.12 (assumed)
- **Dependencies**: `llama-cpp-python`, `fastapi`, `chromadb`, `pymupdf`, `nomic`

## Models
- **LLM**: Qwen2.5 3B Instruct Q4_K_M
- **Embedding Model**: nomic-embed-text-v1.5

## Execution Instructions
To run the primary RAG/Non-RAG performance benchmark:
```bash
python -m benchmarks.phase10_benchmark
```

## Statistical Methodology
- **Warmup Procedure**: The benchmark executes 1 initial "Cold" iteration to initialize the models and populate the SQLite connection pool. This iteration is discarded from the "Warm" calculations.
- **Iteration Count**: 50 iterations per test category (RAG OFF vs RAG ON).
- **Statistics**: Calculates Minimum, Mean, Median, P95, P99, and Maximum for all component boundaries. Memory (RSS) is sampled before and after execution blocks using `psutil`.
