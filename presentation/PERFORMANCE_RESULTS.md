# Performance Results

These metrics represent empirical, benchmarked data recorded on a standard local CPU constraint profile (4 Cores / 8 Threads) during Phase 4.5 real-world evaluation.

## 1. Latency & Time-To-First-Token (TTFT)

*TTFT measures the delay between the user pressing "Send" and the very first character appearing on the screen. Latency refers to total completion time.*

### Non-RAG Operations (Standard Chat)
- **TTFT (P50)**: ~0.12s
- **TTFT (P95)**: ~0.14s
- **Total Latency (P50)**: ~11.5s (Dependent on requested output length)

### RAG Operations (Document Search Enabled)
- **TTFT (P50)**: ~0.23s
- **TTFT (P95)**: ~0.28s
*(The ~110ms overhead represents the cost of calculating semantic embeddings and querying ChromaDB).*

## 2. Generation Throughput
- **Baseline**: ~9.2 tokens / second
- **Stability**: Remains highly consistent for sustained generations (up to 500+ tokens).

## 3. Resource Utilization

### Memory (RAM)
- **Base (System + OS)**: ~2.0 GB
- **Application Idle (Model Loaded)**: ~3.4 GB
- **Peak Inference (RAG + Qwen Active)**: ~3.6 GB
- **Memory Leaks**: None detected over 50 iterations.

### CPU Utilization
- **Idle**: 0-1%
- **Inference**: ~85-95% (Fully saturates physical cores via AVX2 instructions).

## 4. Concurrency Limits
Because CPU inference is heavily bound by computational limits, concurrency behaves uniquely:
- **1 Request**: 9.2 tok/s
- **2 Requests**: Shared degradation (approx. 4.5 tok/s each), maintains acceptable UX.
- **>3 Requests**: Noticeable CPU saturation. TTFT increases significantly.
- **Conclusion**: The current architecture is ideal as a localized, single-tenant or low-concurrency internal tool.
