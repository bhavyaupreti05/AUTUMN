import time
import psutil
import os
import uuid
import sys
import numpy as np
from src.config import settings
from src.database.repository import ConversationRepository
from src.database.document_repository import DocumentRepository
from src.services.document_service import DocumentService
from src.services.chat_service import ChatService
from src.services.retrieval_service import RetrievalService
from src.core.prompt_builder import PromptBuilder
from src.core.context_manager import ContextManager
from src.llm.provider import QwenProvider

def get_memory_mb():
    process = psutil.Process(os.getpid())
    return process.memory_info().rss / (1024 * 1024)

def measure(func, *args, **kwargs):
    start = time.perf_counter()
    result = func(*args, **kwargs)
    end = time.perf_counter()
    return result, end - start

class Profiler:
    def __init__(self):
        self.metrics = []

    def run_benchmark(self, name, iterations=3, setup_func=None, run_func=None, teardown_func=None):
        print(f"--- Running Benchmark: {name} ---")
        times = []
        for i in range(iterations):
            if setup_func:
                setup_func()
            
            # memory before
            mem_before = get_memory_mb()
            
            start = time.perf_counter()
            run_func()
            end = time.perf_counter()
            
            mem_after = get_memory_mb()
            
            times.append(end - start)
            
            if teardown_func:
                teardown_func()
                
        median = np.median(times)
        p95 = np.percentile(times, 95)
        print(f"Median: {median:.4f}s, P95: {p95:.4f}s, Peak Mem: {mem_after:.2f}MB\n")
        return {"name": name, "median": median, "p95": p95, "mem": mem_after}

def profile_rag():
    print(f"Initial Memory: {get_memory_mb():.2f} MB")
    
    # Enable RAG for testing
    settings.RAG_ENABLED = True
    
    # 1. Init services
    print("Initializing services...")
    t0 = time.perf_counter()
    llm_provider = QwenProvider()
    chat_service = ChatService(llm_provider)
    doc_service = DocumentService()
    retrieval_service = RetrievalService()
    t1 = time.perf_counter()
    print(f"Services init: {t1-t0:.4f}s, Mem: {get_memory_mb():.2f} MB")

    # Upload test corpus
    print("Uploading test documents...")
    conv_id = str(uuid.uuid4())
    chat_service.repo.create_conversation("Bench Conv")
    # Actually just insert it directly
    from src.database.connection import get_connection
    with get_connection() as conn:
        conn.execute("INSERT OR REPLACE INTO conversations (id, title) VALUES (?, ?)", (conv_id, "Bench Conv"))
        conn.commit()

    docs = ["doc_small_1.pdf", "doc_small_2.pdf", "doc_large.pdf"]
    doc_ids = []
    
    for doc in docs:
        path = os.path.join("benchmarks", "test_corpus", doc)
        with open(path, "rb") as f:
            content = f.read()
        res, t = measure(doc_service.process_uploaded_file, doc, content)
        print(f"Ingested {doc} in {t:.4f}s")
        doc_id = res['document']['id']
        doc_ids.append(doc_id)
        # Associate with conv
        doc_service.repo.associate_document_with_conversation(conv_id, doc_id)

    print(f"Mem after ingestion: {get_memory_mb():.2f} MB")

    queries = [
        "What framework does this project use?", # doc_small_1
        "What is the reimbursement limit?", # doc_small_2
        "What does error code E-77 indicate?" # doc_large
    ]

    profiler = Profiler()

    def run_retrieval_step():
        q = queries[0]
        # 1. Context loading
        _, t_ctx = measure(chat_service.context_manager.prepare_context, conv_id, q)
        
        # 2. Doc association lookup
        assoc_docs, t_assoc = measure(retrieval_service.doc_repo.get_conversation_documents, conv_id)
        
        # 3. Embedding
        embed, t_embed = measure(retrieval_service.embedding_provider.embed_query, q)
        
        # 4. Chroma Search
        filter_meta = {"doc_id": {"$in": [d['id'] for d in assoc_docs]}}
        results, t_search = measure(retrieval_service.vector_store.search, embed, filter_meta, settings.RAG_TOP_K)
        
        # 5. Filtering & Context String (Mocked block of code)
        start_filt = time.perf_counter()
        context_pieces = []
        total_chars = 0
        for res in results:
            if res['distance'] <= settings.RAG_SIMILARITY_THRESHOLD:
                piece = f"[Document: {res['metadata']['doc_id']}]\n{res['text']}\n"
                if total_chars + len(piece) > settings.RAG_MAX_CHARS:
                    break
                context_pieces.append(piece)
                total_chars += len(piece)
        retrieved_context = "\n".join(context_pieces)
        t_filt = time.perf_counter() - start_filt

        # 6. Prompt building
        context_messages = chat_service.context_manager.prepare_context(conv_id, q)
        prompt, t_prompt = measure(chat_service.prompt_builder.build_prompt, context_messages, retrieved_context)
        
        return {
            "ctx_load": t_ctx,
            "doc_assoc": t_assoc,
            "embed": t_embed,
            "search": t_search,
            "filter": t_filt,
            "prompt": t_prompt,
            "prompt_len": len(prompt)
        }

    print("\n--- Running detailed boundaries (Warm) ---")
    # Warmup
    run_retrieval_step()
    
    runs = [run_retrieval_step() for _ in range(5)]
    print(f"Median Embed: {np.median([r['embed'] for r in runs]):.4f}s")
    print(f"Median Search: {np.median([r['search'] for r in runs]):.4f}s")
    print(f"Median Doc Assoc: {np.median([r['doc_assoc'] for r in runs]):.4f}s")
    print(f"Median Filter: {np.median([r['filter'] for r in runs]):.4f}s")
    print(f"Median Prompt: {np.median([r['prompt'] for r in runs]):.4f}s")
    
    # Qwen TTFT test
    def qwen_test(rag_on=True):
        if not rag_on:
            settings.RAG_ENABLED = False
            ret_ctx = ""
        else:
            settings.RAG_ENABLED = True
            ret_ctx = retrieval_service.retrieve_context(queries[0], conv_id)
            
        ctx = chat_service.context_manager.prepare_context(conv_id, queries[0])
        prompt = chat_service.prompt_builder.build_prompt(ctx, ret_ctx)
        
        ttft = 0
        t0 = time.perf_counter()
        stream = chat_service.provider.generate_stream(prompt)
        try:
            first = next(stream)
            ttft = time.perf_counter() - t0
            # consume rest
            tokens = 1
            for _ in stream:
                tokens += 1
            total = time.perf_counter() - t0
            return ttft, tokens / total
        except StopIteration:
            return 0, 0

    print("\n--- RAG OFF vs RAG ON ---")
    # Warmup Qwen
    qwen_test(False)
    
    ttfts_off = []
    toks_off = []
    for _ in range(3):
        t, s = qwen_test(False)
        ttfts_off.append(t)
        toks_off.append(s)
    print(f"RAG OFF TTFT: {np.median(ttfts_off):.4f}s, Tok/s: {np.median(toks_off):.1f}")
    
    ttfts_on = []
    toks_on = []
    for _ in range(3):
        t, s = qwen_test(True)
        ttfts_on.append(t)
        toks_on.append(s)
    print(f"RAG ON TTFT: {np.median(ttfts_on):.4f}s, Tok/s: {np.median(toks_on):.1f}")
    
if __name__ == "__main__":
    profile_rag()
