# Phase 1 Model Decision: Qwen2.5 3B Instruct

Based on the initial benchmarks run in Phase 1, we have decided to proceed with **Qwen2.5 3B Instruct** as the primary LLM for the local chatbot.

## Selected Model Details
* **Model Name:** Qwen/Qwen2.5-3B-Instruct-GGUF
* **Quantization:** `qwen2.5-3b-instruct-q4_k_m.gguf`
* **Size:** 1.96 GB

## Benchmark Results
* **Cold TTFT (Time To First Token):** ~0.63s - 0.83s
* **Warm TTFT:** ~0.10s
* **Generation Throughput (Warm):** ~6.88 - 9.86 tokens/sec

## Memory Consumption (RAM)
* **RAM After Loading:** ~3.2 GB available (out of 16 GB total)
* **Process Peak RAM:** ~2.74 GB
* **Observation:** The model fits comfortably into the system RAM without triggering memory starvation or excessive paging, even when sharing resources with the OS.

## Quality Assessment
* **Correctness & Relevance:** Highly accurate and strictly addresses prompts.
* **Instruction Following:** Excellent adherence to formats without hallucinated preamble.
* **Coherence:** Responses were fluent and logical.
* **Detail:** Exhibited surprising depth for a 3B parameter model, providing nuanced explanations of technical concepts.

## Comparison With Previous Phi-4 Baseline
In previous tests with Phi-4, output throughput hovered around 2.17 - 3.61 tokens/sec, and TTFT often took several seconds. Qwen2.5 3B is roughly 2.5x - 3x faster in generation throughput and has sub-second TTFTs on this specific hardware configuration (Intel i7-8650U, CPU inference).

## Reasons for Selecting Qwen
Qwen2.5 3B offers the optimal balance of **Good quality + low TTFT + acceptable RAM + stable CPU inference** for our Phase 1 scope. Speed was not the only determining factor; the model's ability to respond comprehensively and accurately within the tight hardware constraints makes it the best immediate choice.

## Known Limitations
As a 3B parameter model, complex logic puzzles or dense coding instructions may eventually stretch its capabilities compared to larger 7B or 14B models. The Q4_K_M quantization may slightly affect nuanced reasoning, though it was not evident in our tests.

## Future Possibility
We retain the `benchmarks/model_benchmark.py` infrastructure. If required in later phases (e.g., Phase 9 Model Routing), we can easily compare other models (like Llama-3 8B or Mistral 7B) using the same reproducible framework.
