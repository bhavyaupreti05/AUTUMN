import os
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional

class VectorStore(ABC):
    @abstractmethod
    def add_chunks(self, chunks: List[Dict[str, Any]], embeddings: List[List[float]]):
        """Adds chunks and their embeddings to the vector store."""
        pass

    @abstractmethod
    def search(self, query_embedding: List[float], filter_metadata: Dict[str, Any] = None, top_k: int = 3) -> List[Dict[str, Any]]:
        """Searches the vector store for the closest chunks."""
        pass

    @abstractmethod
    def delete_document(self, doc_id: str):
        """Deletes all chunks associated with a specific document ID."""
        pass

class ChromaVectorStore(VectorStore):
    def __init__(self, persist_directory: str, collection_name: str = "chatbot_docs"):
        try:
            import chromadb
            from chromadb.config import Settings
        except ImportError:
            raise ImportError("Please install chromadb: pip install chromadb")

        # Create the client with persistence
        self.client = chromadb.PersistentClient(path=persist_directory)
        
        # Get or create the collection
        # We use a default distance function (cosine or l2 depending on chromadb version/config).
        # Chroma defaults to l2. Nomic often prefers cosine, but default works well enough usually.
        # Can be configured via metadata={"hnsw:space": "cosine"}
        self.collection = self.client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"}
        )

    def add_chunks(self, chunks: List[Dict[str, Any]], embeddings: List[List[float]]):
        if not chunks or not embeddings:
            return

        ids = []
        documents = []
        metadatas = []

        for i, chunk in enumerate(chunks):
            # Using a composite ID based on doc_id and chunk_index to ensure uniqueness
            chunk_id = f"{chunk['doc_id']}_{chunk['chunk_index']}"
            ids.append(chunk_id)
            documents.append(chunk['text'])
            
            # Metadata must be strings, ints, floats, or bools
            metadata = {
                "doc_id": chunk['doc_id'],
                "chunk_index": chunk['chunk_index'],
                "page_start": chunk['page_start'],
                "page_end": chunk['page_end']
            }
            metadatas.append(metadata)

        self.collection.upsert(
            ids=ids,
            embeddings=embeddings,
            documents=documents,
            metadatas=metadatas
        )

    def search(self, query_embedding: List[float], filter_metadata: Dict[str, Any] = None, top_k: int = 3) -> List[Dict[str, Any]]:
        where = None
        if filter_metadata:
            # ChromaDB supports where filtering, e.g., {"doc_id": {"$in": ["id1", "id2"]}}
            where = filter_metadata
            
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            where=where,
            include=["documents", "metadatas", "distances"]
        )

        retrieved_chunks = []
        if results['ids'] and results['ids'][0]:
            for i in range(len(results['ids'][0])):
                chunk = {
                    "id": results['ids'][0][i],
                    "text": results['documents'][0][i],
                    "metadata": results['metadatas'][0][i],
                    "distance": results['distances'][0][i]
                }
                retrieved_chunks.append(chunk)

        return retrieved_chunks

    def delete_document(self, doc_id: str):
        self.collection.delete(where={"doc_id": doc_id})
