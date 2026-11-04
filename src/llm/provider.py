from abc import ABC, abstractmethod
from typing import Generator, Dict, Any, List
import json
import logging
import httpx
import threading
from src.config import settings

logger = logging.getLogger(__name__)

try:
    from llama_cpp import Llama
except ImportError:
    Llama = None

class LLMProvider(ABC):
    @abstractmethod
    def generate_stream(self, prompt: str, temperature: float = None, max_tokens: int = None, is_background_task: bool = False) -> Generator[Dict[str, Any], None, None]:
        pass

    @abstractmethod
    def health_check(self) -> bool:
        pass


class QwenProvider(LLMProvider):
    def __init__(self):
        if Llama is None:
            raise RuntimeError(
                "llama-cpp-python is not installed. To run locally, install llama-cpp-python. "
                "Alternatively, set GROQ_API_KEY in your environment to use Groq cloud inference."
            )

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
        return getattr(self, "llm", None) is not None


class GroqProvider(LLMProvider):
    # Verified active Groq cloud models in priority order
    FALLBACK_MODELS = [
        "llama-3.3-70b-versatile",
        "llama-3.1-8b-instant",
    ]

    def __init__(self, api_key: str = None, model: str = None):
        self.api_key = api_key or settings.GROQ_API_KEY
        raw_model = (model or settings.GROQ_MODEL or "").strip()
        # Sanitize known decommissioned or typo models
        if "qwen3.8" in raw_model or not raw_model:
            raw_model = "llama-3.3-70b-versatile"
        self.model = raw_model
        self.endpoint = "https://api.groq.com/openai/v1/chat/completions"

    def _parse_prompt_to_messages(self, prompt: str) -> List[Dict[str, str]]:
        import re
        if "<|im_start|>" in prompt:
            messages = []
            blocks = prompt.split("<|im_start|>")
            for b in blocks:
                b = b.strip()
                if not b:
                    continue
                # Strip trailing <|im_end|> and whitespace
                b = re.sub(r"<\|im_end\|>.*$", "", b, flags=re.DOTALL).strip()
                parts = b.splitlines()
                role = parts[0].strip().lower() if parts else "user"
                content = "\n".join(parts[1:]).strip() if len(parts) > 1 else ""
                if role not in ["system", "user", "assistant"]:
                    role = "user"
                if content:
                    messages.append({"role": role, "content": content})
            if messages:
                return messages
        return [{"role": "user", "content": prompt}]

    def generate_stream(self, prompt: str, max_tokens: int = None, temperature: float = None, is_background_task: bool = False) -> Generator[Dict[str, Any], None, None]:
        if not self.api_key:
            yield {"type": "error", "error": "GROQ_API_KEY is not configured.", "status": 500}
            return

        messages = self._parse_prompt_to_messages(prompt)
        
        # Determine token budget (up to 2048 tokens for rich multi-agent outputs)
        if max_tokens is not None:
            max_tok = min(max_tokens, 2048)
        else:
            max_tok = min(settings.MAX_OUTPUT_TOKENS, 2048)

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "User-Agent": "Autumn-App/1.0",
        }

        temp = temperature if temperature is not None else settings.TEMPERATURE
        
        # Construct candidate models list with deduplication
        models_to_try = []
        for m in [self.model] + self.FALLBACK_MODELS:
            if m and m not in models_to_try:
                models_to_try.append(m)

        last_error = None
        import time

        for model_candidate in models_to_try:
            for attempt in range(2):
                curr_max_tok = max_tok if attempt == 0 else min(max_tok, 800)
                payload = {
                    "model": model_candidate,
                    "messages": messages,
                    "temperature": temp,
                    "max_tokens": curr_max_tok,
                    "stream": True,
                }

                try:
                    with httpx.Client(timeout=httpx.Timeout(120.0, connect=10.0)) as client:
                        with client.stream("POST", self.endpoint, headers=headers, json=payload) as response:
                            # If rate limited (429), pause briefly or try smaller token attempt
                            if response.status_code == 429 and attempt == 0:
                                time.sleep(1.2)
                                continue

                            # Model not found or invalid request error -> fall through to next candidate model
                            if response.status_code in (400, 404):
                                err_text = response.read().decode("utf-8", errors="replace")
                                logger.warning(f"Groq model {model_candidate} unavailable ({response.status_code}): {err_text}. Trying next fallback.")
                                last_error = f"Model {model_candidate} unavailable: {err_text}"
                                break

                            if response.status_code != 200:
                                err_text = response.read().decode("utf-8", errors="replace")
                                logger.error(f"Groq API error {response.status_code}: {err_text}")
                                last_error = err_text
                                if response.status_code == 429 and model_candidate != self.FALLBACK_MODELS[-1]:
                                    # Fallback to high-rate-limit 8b model on 429
                                    break
                                yield {"type": "error", "error": f"Groq API error ({response.status_code}): {err_text}", "status": response.status_code}
                                return

                            # Stream chunks successfully
                            final_reason = "COMPLETED"
                            for line in response.iter_lines():
                                if not line:
                                    continue
                                if line.startswith("data: "):
                                    data_str = line[6:].strip()
                                    if data_str == "[DONE]":
                                        break
                                    try:
                                        chunk_json = json.loads(data_str)
                                        choices = chunk_json.get("choices", [])
                                        if choices:
                                            delta = choices[0].get("delta", {})
                                            content = delta.get("content", "")
                                            finish_reason = choices[0].get("finish_reason")
                                            if content:
                                                yield {"type": "text", "content": content}
                                            if finish_reason:
                                                if finish_reason == "length":
                                                    final_reason = "MAX_TOKENS"
                                                else:
                                                    final_reason = "COMPLETED"
                                    except Exception as parse_err:
                                        logger.debug(f"Could not parse SSE chunk: {parse_err}")

                            yield {"type": "status", "status": final_reason}
                            return

                except Exception as e:
                    last_error = str(e)
                    logger.warning(f"Groq connection attempt {attempt} failed on {model_candidate}: {e}")
                    if attempt == 1:
                        break

        # If all Groq cloud candidates failed, attempt local fallback if available
        if Llama is not None and not is_background_task:
            logger.warning(f"All Groq candidates failed ({last_error}). Falling back to local QwenProvider.")
            try:
                local_provider = QwenProvider()
                for chunk in local_provider.generate_stream(prompt, max_tokens, temperature, is_background_task):
                    yield chunk
                return
            except Exception as local_err:
                logger.error(f"Local fallback also failed: {local_err}")

        yield {"type": "error", "error": f"Groq generation failed across all models: {last_error}", "status": 500}

    def health_check(self) -> bool:
        return bool(self.api_key)


def get_llm_provider() -> LLMProvider:
    if settings.ACTIVE_PROVIDER == "groq":
        logger.info(f"Using GroqProvider with model={settings.GROQ_MODEL}")
        return GroqProvider()
    logger.info("Using QwenProvider (local GGUF)")
    return QwenProvider()
