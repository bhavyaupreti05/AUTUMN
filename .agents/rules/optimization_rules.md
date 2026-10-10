---
description: "Core optimization rules and architectural constraints for the chat-bot-2 project."
---

# Project Context & CPU Constraints
This project uses a CPU-bound local LLM (Qwen 3B via llama.cpp). Because it runs on a CPU:
1. **Context Size Sensitivity:** Evaluating large prompts (KV Cache computation) is very slow. A 10,000 character prompt can take over 80 seconds just for the Time-To-First-Token (TTFT), which will cause frontend browser timeouts (typically 60s).
2. **Global LLM Lock:** The LLM is single-threaded. Foreground chat requests lock the LLM. Background tasks (like summarization) must wait for the lock.

# Optimization Rules & Best Practices

When adding features or modifying code in this repository, **you MUST automatically apply the following optimizations** without asking the user:

### 1. RAG & Retrieval Limits
- **NEVER** increase `RAG_MAX_CHARS` beyond `4000` or `RAG_TOP_K` beyond `5` in `src/config.py`. Exceeding this causes the frontend to timeout before the LLM can generate the first token.
- Keep `MAX_OUTPUT_TOKENS` high enough (e.g., `2048`) and `CONTEXT_SIZE` comfortably large (e.g., `6144`) so the model doesn't abruptly cut off mid-sentence.

### 2. Background Tasks (Map-Reduce / Summaries)
- Background LLM calls (e.g., `is_background_task=True`) **must** include robust retry loops (e.g., 10 attempts with 10-second sleeps). Foreground requests can lock the LLM for up to 60 seconds, so background tasks need a long timeout window to eventually succeed.

### 3. Document Parsing (Tables & Headings)
- **Always preserve structure:** When chunking text, always extract and prepend headings (e.g., using Regex for `#` in text, or `python-docx` heading styles).
- **Table Support:** Use `page.find_tables()` and `to_markdown()` for PDFs (PyMuPDF >= 1.23.0) to ensure tabular data is fed to the LLM as Markdown. Normal text extraction breaks tables.
- **Global Summary Outline:** The background Map-Reduce summarization prompt MUST explicitly ask the LLM to extract a "Table of Contents" / "Main Headings" list so that structural queries have access to it via the global summary cache.

### 4. Code Degradation & Proactive Fixes
- The user expects **permanent, robust fixes**. Do not use temporary patches.
- Maintain speed optimization at all times. If a new feature requires more LLM processing, ensure it doesn't degrade the existing chat responsiveness.
- **Communication:** The user prefers responses in Hinglish. Be direct, explain the "Why" behind the technical fix, and don't make them repeat their instructions.
