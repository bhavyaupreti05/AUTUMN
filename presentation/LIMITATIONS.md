# Known Limitations

In the interest of engineering transparency, the following technical limitations are documented. None of these constitute "bugs," but rather represent the natural boundaries of the chosen architecture.

## 1. Concurrency Bottleneck (CPU Bound)
Because ChatBot-2 is designed specifically to run locally on consumer/enterprise CPUs (via `llama.cpp` using AVX2 vector instructions) rather than massive GPU clusters, it is inherently compute-bound.
- **Limitation**: The system cannot handle dozens of concurrent heavy generation requests simultaneously without latency degradation.
- **Knee Point**: Beyond 3 concurrent requests, Time-To-First-Token (TTFT) and throughput degrade noticeably. 
- **Use Case Fit**: Ideal for single-tenant local instances or low-concurrency internal teams.

## 2. Unverified 50-Document Scale
- **Limitation**: The initial design target aimed to support up to 50 concurrent independent PDFs per conversation.
- **Status**: While single massive documents (500 pages) have been successfully benchmarked without issue, the specific scenario of ingesting 50 independent files simultaneously remains *unverified*.

## 3. PDF OCR Extractor Limits
- **Limitation**: The current PyMuPDF implementation extracts *standard embedded text*. 
- **Impact**: It does not currently perform Optical Character Recognition (OCR) on flat images, scanned documents, or complex unformatted tables. 

## 4. Context Window Size
- **Limitation**: Qwen2.5 3B has a finite attention window. To prevent memory overflow and performance collapse, ChatBot-2 strictly enforces limits.
- **Current Bound**: The context window is capped at the last 20 messages or 8000 characters. 
- **Impact**: In extremely long conversational threads, details from the very beginning of the chat will be gracefully dropped in favor of recent context.

## 5. Single-Machine State
- **Limitation**: SQLite and ChromaDB operate as local embedded databases.
- **Impact**: The application is not currently configured for multi-node horizontal scaling. It is a monolithic, highly optimized single-node deployment.
