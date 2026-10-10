from abc import ABC, abstractmethod
from typing import List
import os
import threading


_LOCAL_EMBEDDING_LOCK = threading.RLock()

class EmbeddingProvider(ABC):
    @abstractmethod
    def embed_texts(self, texts: List[str]) -> List[List[float]]:
        """Generates embeddings for a list of strings."""
        pass

    @abstractmethod
    def embed_query(self, text: str) -> List[float]:
        """Generates embedding for a single query string."""
        pass

class NomicEmbeddingProvider(EmbeddingProvider):
    def __init__(self):
        try:
            from nomic import embed
            self.embed = embed
        except ImportError:
            raise ImportError("Please install nomic: pip install nomic[local]")

    def embed_texts(self, texts: List[str]) -> List[List[float]]:
        # Single-chunk mitigation: gpt4all CPU bindings are highly inefficient
        # and prone to deadlocks when passing large arrays on Windows.
        # We process them one by one to ensure maximum stability and better throughput.
        if not texts:
            return []
            
        with _LOCAL_EMBEDDING_LOCK:
            all_embeddings = []
            for text in texts:
                result = self.embed.text(
                    texts=[text],
                    model="nomic-embed-text-v1.5",
                    task_type="search_document",
                    inference_mode="local"
                )
                all_embeddings.append(result['embeddings'][0])
            
        return all_embeddings

    def embed_query(self, text: str) -> List[float]:
        if not text:
            return []
        with _LOCAL_EMBEDDING_LOCK:
            result = self.embed.text(
                texts=[text],
                model="nomic-embed-text-v1.5",
                task_type="search_query",
                inference_mode="local"
            )
        return result['embeddings'][0]
