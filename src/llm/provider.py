from abc import ABC, abstractmethod
from typing import Generator, Dict, Any
from llama_cpp import Llama
from src.config import settings

class LLMProvider(ABC):
    @abstractmethod
    def generate_stream(self, prompt: str, temperature: float = None, max_tokens: int = None, is_background_task: bool = False) -> Generator[Dict[str, Any], None, None]:
        pass

    @abstractmethod
    def health_check(self) -> bool:
        pass


import threading

class QwenProvider(LLMProvider):
    def __init__(self):
        # Initialize llama.cpp model
        import uuid
        import time
        import os
        self.instance_id = str(uuid.uuid4())[:8]
        with open("scratch/lock.log", "a") as f:
            f.write(f"[{self.instance_id}] NEW PROVIDER INSTANCE CREATED at {time.time():.2f} (PID: {os.getpid()})\n")
            f.flush()
        
        self.lock = threading.Lock()
        self.llm = Llama(
            model_path=settings.MODEL_PATH,
            n_ctx=settings.CONTEXT_SIZE,
            n_threads=settings.CPU_THREADS,
            n_gpu_layers=-1, # Offload to GPU if available
            n_batch=1024,
            use_mlock=False, # Disable mlock when using GPU to avoid pinning issues
            flash_attn=False, # Disable flash attention because MX130 (Maxwell) does not support it
            verbose=False
        )
        self.pending_foreground_requests = 0

    def generate_stream(self, prompt: str, max_tokens: int = None, temperature: float = None, is_background_task: bool = False) -> Generator[Dict[str, Any], None, None]:
        import uuid
        import time
        req_id = str(uuid.uuid4())[:8]
        start_perf = time.perf_counter()
        req_type = "HEAVY" if len(prompt) > 1500 else "LIGHT"
        
        with open("scratch/lock.log", "a") as f:
            import os
            f.write(f"[{req_id}] [{req_type}] ATTEMPTING LOCK ACQUIRE at {start_perf:.7f} (PID: {os.getpid()})\n")
            f.flush()
            
        if not is_background_task:
            self.pending_foreground_requests += 1

        # Check watchdog before acquiring
        watchdog_limit = 600.0 if is_background_task else settings.LLM_LOCK_TIMEOUT_SECONDS + 60.0
        
        if self.lock.locked() and getattr(self, "lock_acquire_time", 0) > 0:
            if time.time() - self.lock_acquire_time > watchdog_limit:
                print(f"WATCHDOG: Generation locked for > {watchdog_limit}s. Cannot safely recover C++ thread. Terminating process to prevent memory corruption.")
                import os
                os._exit(1)
                    
        # Fail fast while another CPU-bound generation is running.
        lock_timeout = 10 if is_background_task else settings.LLM_LOCK_TIMEOUT_SECONDS
        if not self.lock.acquire(timeout=lock_timeout):
            if not is_background_task:
                self.pending_foreground_requests = max(0, self.pending_foreground_requests - 1)
                
            if self.lock.locked() and getattr(self, "lock_acquire_time", 0) > 0 and time.time() - self.lock_acquire_time > watchdog_limit:
                print(f"WATCHDOG: Generation locked for > {watchdog_limit}s after timeout. Cannot safely recover C++ thread. Terminating process to prevent memory corruption.")
                import os
                os._exit(1)
            else:
                with open("scratch/lock.log", "a") as f:
                    f.write(f"[{req_id}] [{req_type}] LOCK TIMEOUT at {time.perf_counter():.7f}\n")
                    f.flush()
                yield {"type": "error", "error": "Server is currently busy processing another request. Please try again later.", "status": 503}
                return
            
        try:
            self.lock_acquire_time = time.time()
            self.current_task_is_background = is_background_task
            with open("scratch/lock.log", "a") as f:
                f.write(f"[{req_id}] [{req_type}] LOCK ACQUIRED at {time.perf_counter():.7f}\n")
                f.flush()
                
            yield {"type": "debug_acquire", "req_id": req_id, "time": time.perf_counter()}
            temp = temperature if temperature is not None else settings.TEMPERATURE
            max_tok = max_tokens if max_tokens is not None else settings.MAX_OUTPUT_TOKENS
    
            stream = self.llm(
                prompt,
                max_tokens=max_tok,
                temperature=temp,
                repeat_penalty=1.15,
                stream=True
            )
    
            final_reason = "UNKNOWN"
            for output in stream:
                if is_background_task and self.pending_foreground_requests > 0:
                    final_reason = "ABORTED_FOR_FOREGROUND"
                    break
                    
                choice = output["choices"][0]
                chunk = choice.get("text", "")
                finish_reason = choice.get("finish_reason")
    
                if chunk:
                    yield {"type": "text", "content": chunk}
                
                if finish_reason:
                    if finish_reason == "length":
                        final_reason = "MAX_TOKENS"
                    elif finish_reason == "stop":
                        final_reason = "COMPLETED"
                    else:
                        final_reason = "COMPLETED" # Fallback if something else
    
            yield {"type": "status", "status": final_reason}
        finally:
            if not is_background_task:
                self.pending_foreground_requests = max(0, self.pending_foreground_requests - 1)
                
            with open("scratch/lock.log", "a") as f:
                f.write(f"[{req_id}] [{req_type}] LOCK RELEASED at {time.perf_counter():.7f}\n")
                f.flush()
            self.lock.release()

    def health_check(self) -> bool:
        # Simple health check to verify model is loaded
        return self.llm is not None
