# Environment Inspection

## Hardware & OS
* **OS:** Microsoft Windows 11 Pro (10.0.26200 N/A Build 26200)
* **CPU:** Intel(R) Core(TM) i7-8650U CPU @ 1.90GHz (4 physical cores, 8 logical cores)
* **Total RAM:** 16,242 MB (16 GB)
* **Available RAM:** ~1,340 MB (1.3 GB) *Warning: Currently too low for optimal local LLM inference without closing background applications (like Brave Browser and existing Ollama servers).*
* **GPU:** NVIDIA GeForce MX130 (2GB VRAM, currently ~1GB in use)

## Software
* **Python:** 3.12.10
* **Inference Runtimes Installed:** Ollama version 0.32.15 is currently running.
* **Hugging Face Tooling / Llama.cpp:** Not currently installed in the Python environment.

## Inference Strategy Recommendation
* **Hardware Constraints:** The discrete GPU only has 2GB of VRAM, which is insufficient for offloading a large model. Therefore, **CPU-first inference** using the system's 16 GB of RAM is required.
* **Runtime:** I recommend using `llama-cpp-python` for direct Python integration to measure Time-To-First-Token (TTFT) and throughput accurately without the overhead of an external API (like Ollama).
* **Model Selection:** Mistral 7B was initially considered, but Phase 1 has been redirected to Qwen2.5 3B Instruct (Q4_K_M) because of the current CPU/RAM constraints. Qwen2.5 3B requires significantly less RAM, preventing heavy swap usage on this 16 GB machine while still aiming for high response quality.
