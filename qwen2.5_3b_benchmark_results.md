# Benchmark Results: Qwen2.5 3B

* **File:** `qwen2.5-3b-instruct-q4_k_m.gguf` (1.96 GB)
* **Model Load Time:** 3.14s
* **RAM Before Load:** 5945.59 MB available
* **RAM After Load:** 3195.21 MB available
* **Process Peak/Current Memory:** 2739.99 MB

### Short Prompt
* **Prompt:** `What is Python?`
* **Cold TTFT:** 0.83s
* **Warm TTFT (Mean):** 0.10s
* **Throughput (Warm Mean):** 9.84 tokens/sec
* **Total Latency (Warm Mean):** 26.13s

### Medium Prompt
* **Prompt:** `Explain how FastAPI works and why it is useful for building an API backend.`
* **Cold TTFT:** 0.63s
* **Warm TTFT (Mean):** 0.10s
* **Throughput (Warm Mean):** 6.88 tokens/sec
* **Total Latency (Warm Mean):** 104.33s

### Detailed Prompt
* **Prompt:** `Explain the architecture of a local AI chatbot using an LLM, FastAPI, conversation memory, retrieval, and streaming.`
* **Cold TTFT:** 0.74s
* **Warm TTFT (Mean):** 0.10s
* **Throughput (Warm Mean):** 9.86 tokens/sec
* **Total Latency (Warm Mean):** 26.06s

