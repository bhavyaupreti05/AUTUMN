# Senior Review Q&A Guide

**Q1: Why did you choose Qwen2.5 3B instead of an 8B or 70B model?**
**A**: A 3B model strikes the perfect balance for local deployment. Quantized to Q4_K_M, it requires only ~3GB of RAM, ensuring it runs cleanly on standard corporate laptops alongside other applications, while still providing excellent RAG comprehension.

**Q2: What happens to our sensitive PDFs when we upload them?**
**A**: They stay on your machine. The system extracts the text using PyMuPDF locally, chunks it, and creates vector embeddings using `nomic-embed-text` locally. The resulting vector database (Chroma) is stored on your hard drive. 

**Q3: How are you handling context windows from growing infinitely?**
**A**: We implemented a `ContextManager` that enforces a strict sliding window. It retains the last 20 messages or 8000 characters, automatically pruning older conversational turns while permanently pinning the systemic instruction prompt.

**Q4: Can user A see User B's documents if they share the same machine?**
**A**: If deployed as a multi-user server, the architecture utilizes strict `conversation_id` metadata filtering at the database (SQLite) and vector (ChromaDB) levels. Vectors are completely isolated by conversation.

**Q5: Is this system capable of scaling to hundreds of users?**
**A**: No. It is intentionally designed as a single-node, localized application utilizing CPU AVX2 vectors. CPU-bound inference bottlenecks severely beyond 3-4 concurrent heavy requests.

**Q6: What is TTFT and why does it matter?**
**A**: Time-To-First-Token (TTFT) is the latency before the user sees the first word appear. We achieved ~120ms (non-RAG) using Server-Sent Events (SSE). High TTFT makes chatbots feel broken; sub-200ms TTFT makes them feel instantaneous.

**Q7: How did you verify the application doesn't hallucinate during RAG?**
**A**: We implemented strict systemic prompt grounding. During our audit phase, we tested questions explicitly absent from the text. The model reliably responds that the information is not contained in the provided documents rather than inventing facts.

**Q8: Are you using any cloud APIs for embeddings?**
**A**: No. The `nomic-embed-text-v1.5` model is downloaded and run entirely locally via the `nomic` Python package.

**Q9: Have you tested the claimed 50-document capacity?**
**A**: We have successfully benchmarked massive single documents (500+ pages). However, concurrent ingestion of 50 independent files is currently a design target and remains empirically unverified.

**Q10: What happens if the browser crashes mid-generation?**
**A**: The backend detects a broken pipe. It gracefully stops the LLM generation loop and only persists valid, finalized states to the SQLite database, ensuring no corrupted "half-messages" are saved.
