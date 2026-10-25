# Stage 1: Build Frontend Single Page App
FROM node:22-alpine AS client-build
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Stage 2: Python Backend Runtime
FROM python:3.12-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Pre-install llama-cpp-python using prebuilt CPU wheels when available to drastically speed up container build
RUN pip install --no-cache-dir --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cpu llama-cpp-python==0.3.35 || \
    pip install --no-cache-dir llama-cpp-python==0.3.35

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Create a non-root user (UID 1000) required by Hugging Face Spaces and container security standards
RUN useradd -m -u 1000 user
ENV HOME=/home/user
ENV PATH=/home/user/.local/bin:$PATH

# Create writable data directories for SQLite, ChromaDB, and Hugging Face model cache
RUN mkdir -p /app/data/documents /app/data/chroma /home/user/.cache/huggingface && \
    chown -R user:user /app /home/user

COPY --chown=user:user src/ ./src/
COPY --chown=user:user scripts/ ./scripts/
COPY --chown=user:user --from=client-build /app/client/dist ./client/dist

USER user

ENV PYTHONPATH=/app
ENV API_HOST=0.0.0.0
ENV API_PORT=7860
ENV PORT=7860
ENV SINGLE_WORKER_CONFIRMED=true
ENV ENVIRONMENT=staging
ENV COOKIE_SECURE=false

EXPOSE 7860

CMD ["sh", "-c", "uvicorn src.api.main:app --host 0.0.0.0 --port ${PORT:-7860} --workers 1"]
