# Production Deployment Guide

This document describes how to deploy `chat-bot-2` (Phase 11 Release) in a single-node desktop production environment.

## Prerequisites
- **OS**: Windows (Target), Linux, or macOS
- **Runtime**: Python 3.12+
- **Hardware**: CPU with 4+ physical cores (e.g. Intel i7-8650U), minimum 16GB RAM
- **Disk Space**: ~10GB for Models and SQLite/ChromaDB Persistent Data

## 1. Installation
Clone the repository and install the production dependencies:
```bash
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

*Note: Ensure `llama-cpp-python` is compiled correctly for your target hardware if pre-compiled wheels are insufficient.*

## 2. Configuration
All operational parameters are centralized. Create a `.env` file in the root directory:
```env
# Server
API_HOST=127.0.0.1
API_PORT=8000

# Feature Flags
RAG_ENABLED=True

# Models
MODEL_FILE=qwen2.5-3b-instruct-q4_k_m.gguf

# Protection Limits
MAX_PDF_SIZE_MB=15

# Authentication
# Generate with: python -c "import secrets; print(secrets.token_hex(32))"
JWT_SECRET=<generated-64-character-hex-secret>
COOKIE_SECURE=true
ALLOWED_ORIGINS=https://your-production-origin.example
ACCESS_TOKEN_EXPIRE_MINUTES=1440
```

Generate the JWT secret with `secrets.token_hex(32)` and store it only in `/opt/chatbot-2/.env`. Set the file owner to the service user and restrict it with `chmod 600 /opt/chatbot-2/.env`. Never commit the secret or place it in deployment files.

## 3. Application Startup
Use `uvicorn` to run the FastAPI backend. It is recommended to use an orchestrator (like PM2 or a Windows Service wrapper) for process supervision in a true production setup.

> **SECURITY WARNING: Single-Worker Deployment Required**
> Because this application currently relies on an in-memory SQLite database and in-memory rate limiting (via SlowAPI and custom dicts) without a shared store like Redis, **you MUST run this application with a single worker process**. 
> Deploying with multiple workers (e.g. `uvicorn --workers 4` or Gunicorn with multiple workers) will result in each worker tracking rate limits independently, allowing attackers to trivially bypass rate limits by distributing requests.

```bash
uvicorn src.api.main:app --host 127.0.0.1 --port 8000 --workers 1
```

## 4. Application Shutdown
The application listens for standard Unix signals (`SIGTERM`, `SIGINT`). When shutting down the application (e.g. via `Ctrl+C`), Uvicorn gracefully drains existing HTTP requests and closes the SQLite and ChromaDB connections securely.

## 5. Health Verification
Verify operational readiness through the local backend health endpoint:
```bash
curl --fail --silent http://127.0.0.1:8000/api/health
```
The health response verifies that the API is reachable and reports a coarse persistence status without exposing internal exception details.
