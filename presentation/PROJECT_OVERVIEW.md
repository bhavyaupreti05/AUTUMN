# Project Overview

## The Problem
Organizations face strict data privacy requirements, compliance constraints, and network reliability issues when relying on cloud-based LLM APIs (like OpenAI or Anthropic) for internal enterprise data. Standard chatbots risk exposing sensitive intellectual property to third parties.

## The Solution
**ChatBot-2** is a 100% local, privately hosted Retrieval-Augmented Generation (RAG) assistant. It allows users to query their own private documents securely on local hardware, without compromising on response speed or intelligence.

## Objectives
- **Absolute Privacy**: Zero external network requests during inference.
- **High Performance**: Sub-250ms latency on standard consumer/enterprise hardware.
- **Enterprise UI/UX**: A modern, premium, dark-themed interface that feels like a production-grade SaaS product.

## Hardware Constraints
The system was designed to operate entirely on CPUs and consumer-grade hardware (e.g., standard laptops with 8GB-16GB RAM), avoiding the strict necessity for expensive enterprise GPUs (Nvidia A100s).

## Architecture Choices

**Why Local Inference?**
Guarantees absolute data privacy, eliminates per-token API costs, and functions fully disconnected from the internet.

**Why Qwen2.5 3B (Q4_K_M)?**
Qwen2.5 3B provides an exceptional intelligence-to-size ratio. At ~3B parameters, heavily quantized (Q4_K_M), it requires less than 3GB of RAM while matching the instruction-following capabilities of much larger previous-generation models.

**Why llama.cpp?**
`llama.cpp` (and its Python bindings) provides industry-leading CPU optimization (using AVX2/SIMD instructions) allowing the LLM to run at 9+ tokens per second on a standard CPU.

**Why FastAPI?**
FastAPI provides asynchronous request handling, excellent typing support, and built-in Server-Sent Events (SSE) streaming capabilities, which are critical for delivering a responsive chat experience.

**Why SQLite?**
SQLite is embedded, zero-configuration, and fully ACID compliant, making it the perfect lightweight choice for persisting conversation history locally without requiring a dedicated database server.

**Why RAG?**
Retrieval-Augmented Generation (RAG) allows the statically trained LLM to answer questions about dynamic, private user documents (PDFs) by dynamically fetching the relevant context at query time.

**Why ChromaDB?**
ChromaDB is a lightweight, embedded vector database. It efficiently indexes and retrieves document chunks locally without requiring complex vector infrastructure like Pinecone.

**Why SSE?**
Server-Sent Events (SSE) allows the FastAPI backend to stream generated tokens to the browser one by one, reducing perceived latency to ~120ms instead of waiting seconds for the entire response to generate.

## Password Recovery

Approved administrators can issue a single-use, expiring password-reset link for an approved non-admin user. Reset tokens are stored only as SHA-256 hashes, and redeeming or changing a password revokes older sessions through a versioned JWT claim. Locked-out administrators can use `python -m scripts.reset_password <username>` with interactive input. Production deployments must serve the SPA fallback for `/reset-password`.
