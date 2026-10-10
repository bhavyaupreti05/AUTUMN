import re
import threading
from typing import List, Dict, Any, Optional
import traceback
from src.core.embeddings import EmbeddingProvider, NomicEmbeddingProvider
from src.core.vector_store import VectorStore, ChromaVectorStore
from src.config import settings
from src.database.document_repository import DocumentRepository

_shared_service = None
_shared_service_lock = threading.Lock()

class RetrievalService:
    def __init__(self):
        self.doc_repo = DocumentRepository()
        self.embedding_provider: Optional[EmbeddingProvider] = None
        self.vector_store: Optional[VectorStore] = None
        self._retrieval_cache = {}

        
        if settings.RAG_ENABLED:
            try:
                self.embedding_provider = NomicEmbeddingProvider()
                self.vector_store = ChromaVectorStore(
                    persist_directory=settings.CHROMA_DB_PATH
                )
            except Exception as e:
                print(f"Failed to initialize RAG components: {e}")
                traceback.print_exc()
                # Continue without RAG if initialization fails
                self.embedding_provider = None
                self.vector_store = None

    def embed_and_store_chunks(self, doc_id: str, chunks: List[Dict[str, Any]]):
        """Generates embeddings for chunks and stores them in the vector db."""
        if not self.embedding_provider or not self.vector_store:
            return

        self._retrieval_cache.clear()


        # Prepare text list
        texts = [chunk['text'] for chunk in chunks]
        
        try:
            embeddings = self.embedding_provider.embed_texts(texts)
            
            # Enrich chunks with doc_id for vector store insertion
            for chunk in chunks:
                chunk['doc_id'] = doc_id

            self.vector_store.add_chunks(chunks, embeddings)
        except Exception as e:
            print(f"Error embedding and storing chunks for doc {doc_id}: {e}")
            traceback.print_exc()

    def delete_document_vectors(self, doc_id: str):
        """Deletes document vectors from the vector store."""
        if not self.vector_store:
            return
        self._retrieval_cache.clear()
        try:
            self.vector_store.delete_document(doc_id)
        except Exception as e:
            print(f"Error deleting document vectors for doc {doc_id}: {e}")
            traceback.print_exc()

    def _extract_requested_pages(self, query: str) -> List[int]:
        """
        Parses query for page numbers, e.g., 'page 12', 'pages 3 and 4', 'page 5-7', 'third page'.
        """
        query_lower = query.lower()
        pages = set()
        
        # Match 'page 5' or 'pages 3 and 4' or 'page 5-7'
        for match in re.finditer(r'\bpages?\s+(\d+(?:\s*(?:and|&|-|to|,)\s*\d+)*)\b', query_lower):
            nums_str = match.group(1)
            # Find all standalone numbers
            for num_match in re.finditer(r'\b(\d+)\b', nums_str):
                pages.add(int(num_match.group(1)))
            
            # Handle simple ranges like 5-7
            for range_match in re.finditer(r'\b(\d+)\s*-\s*(\d+)\b', nums_str):
                start, end = int(range_match.group(1)), int(range_match.group(2))
                if start <= end and end - start < 50: # prevent insane ranges
                    for p in range(start, end + 1):
                        pages.add(p)
                        
        # Match ordinals: first, second, third, etc. up to fifth
        ordinals = {"first": 1, "second": 2, "third": 3, "fourth": 4, "fifth": 5}
        for word, num in ordinals.items():
            if re.search(fr'\b{word}\s+page\b', query_lower):
                pages.add(num)
                
        return sorted(list(pages))

    def _keyword_overlap_score(self, query: str, text: str) -> int:
        """Counts how many meaningful query terms appear in the candidate text."""
        query_tokens = set(re.findall(r"[a-z0-9]+", query.lower()))
        if not query_tokens:
            return 0

        text_tokens = set(re.findall(r"[a-z0-9]+", (text or "").lower()))
        if not text_tokens:
            return 0

        stop_words = {
            "the", "a", "an", "and", "or", "of", "to", "for", "in", "on",
            "with", "by", "is", "at", "from", "what", "when", "where", "why",
            "how", "who", "which", "this", "that", "these", "those", "please",
            "tell", "me", "about", "it", "its", "be", "are", "was", "were"
        }
        meaningful_query_tokens = {token for token in query_tokens if len(token) > 2 and token not in stop_words}
        if not meaningful_query_tokens:
            return 0

        return len(meaningful_query_tokens & text_tokens)

    def retrieve_context(self, query: str, conversation_id: str) -> str:
        """
        Retrieves relevant context for a given query, restricted to documents
        associated with the specified conversation.
        """
        if not self.embedding_provider or not self.vector_store or not query:
            return ""

        cache_key = f"{conversation_id}:::{query}"
        if cache_key in self._retrieval_cache:
            return self._retrieval_cache[cache_key]

        try:
            # 1. Determine associated documents for scope filtering
            associated_docs = self.doc_repo.get_conversation_documents(conversation_id)
            if not associated_docs:
                # No documents to retrieve from
                return ""
            
            doc_ids = [doc['id'] for doc in associated_docs]
            
            # Check for summary/broad queries to bypass similarity search
            query_lower = query.lower()
            summary_keywords = ["summary", "summarize", "key points", "entire document", "all docs", "all documents", "headings", "sub-headings", "headlines", "headline", "points", "topics", "outline"]
            is_summary_query = any(kw in query_lower for kw in summary_keywords)
            
            if is_summary_query:
                context_pieces = []
                total_chars = 0
                max_chars_per_doc = settings.RAG_MAX_CHARS // len(doc_ids) if doc_ids else settings.RAG_MAX_CHARS
                
                for d_id in doc_ids:
                    doc = self.doc_repo.get_document(d_id)
                    doc_chars = 0
                    
                    # Try to use pre-computed global summary first
                    if doc and doc.get('summary'):
                        piece = f"[Document: {d_id} | Pre-computed Global Summary]\n{doc['summary']}\n"
                        if doc_chars + len(piece) <= max_chars_per_doc:
                            context_pieces.append(piece)
                            doc_chars += len(piece)
                            total_chars += len(piece)
                        continue
                        
                    # Fallback if no summary exists
                    all_chunks = self.doc_repo.get_chunks(d_id)
                    for chunk in all_chunks:
                        pg_num = chunk.get('page_number', chunk.get('page_start', '?'))
                        piece = f"[Document: {d_id} | Page {pg_num}]\n{chunk['text']}\n"
                        if doc_chars + len(piece) <= max_chars_per_doc:
                            context_pieces.append(piece)
                            doc_chars += len(piece)
                            total_chars += len(piece)
                        else:
                            break
                            
                if total_chars >= settings.RAG_MAX_CHARS - 1000 and len(context_pieces) > 1:
                    context_pieces.append("\n[SYSTEM NOTE: The documents exceeded maximum context limits. The summaries are based only on the available context window distributed evenly across documents.]")
                        
                if context_pieces:
                    return "\n".join(context_pieces)
            
            # 2. Check for page-specific requests
            requested_pages = self._extract_requested_pages(query)
            if requested_pages:
                context_pieces = []
                total_chars = 0
                max_page_available = 0
                older_docs_present = False
                
                for d_id in doc_ids:
                    all_doc_chunks = self.doc_repo.get_chunks(d_id)
                    if not all_doc_chunks:
                        continue
                        
                    # Check if older document by checking page_number existence
                    # dict.get will return None if missing, but SQLite row might have NULL or missing column if migration failed.
                    if 'page_number' not in all_doc_chunks[0] or all_doc_chunks[0].get('page_number') is None:
                        older_docs_present = True
                        break
                        
                    for chunk in all_doc_chunks:
                        pg_num = chunk.get('page_number')
                        if pg_num and pg_num > max_page_available:
                            max_page_available = pg_num
                            
                    for chunk in all_doc_chunks:
                        pg_num = chunk.get('page_number')
                        if pg_num in requested_pages:
                            piece = f"[Document: {d_id} | Page {pg_num}]\n{chunk['text']}\n"
                            if total_chars + len(piece) <= settings.RAG_MAX_CHARS:
                                context_pieces.append(piece)
                                total_chars += len(piece)
                                
                if older_docs_present:
                    return "One or more of the provided documents do not support page-specific queries because they were ingested before this feature was added. Please re-upload the document."
                    
                if not context_pieces:
                    # Requested pages exceed the document length
                    if max_page_available > 0:
                        return f"The requested document(s) only have up to {max_page_available} pages."
                    return ""
                
                # Check for partial out of bounds
                out_of_bounds = sorted([p for p in requested_pages if p > max_page_available])
                if out_of_bounds and max_page_available > 0:
                    note = f"\n[SYSTEM NOTE: Page(s) {', '.join(map(str, out_of_bounds))} were requested, but the document(s) only have up to {max_page_available} pages.]"
                    if total_chars + len(note) <= settings.RAG_MAX_CHARS:
                        context_pieces.append(note)
                    
                return "\n".join(context_pieces)
            
            # 3. Generate query embedding
            query_embedding = self.embedding_provider.embed_query(query)
            
            # 3. Search vector database with scope filtering
            filter_metadata = {"doc_id": {"$in": doc_ids}}
            results = self.vector_store.search(
                query_embedding=query_embedding,
                filter_metadata=filter_metadata,
                top_k=settings.RAG_TOP_K
            )
            
            if not results:
                return ""

            # 4. Apply similarity threshold and prefer exact keyword matches when
            # vectors land close together. This keeps valid factual chunks from being
            # dropped just because a different-but-generic passage was slightly closer.
            filtered_results = [
                res for res in results
                if res.get('distance') is not None and res['distance'] <= settings.RAG_SIMILARITY_THRESHOLD
            ]
            if not filtered_results and results:
                filtered_results = results[:min(settings.RAG_TOP_K, len(results))]

            def result_text(res: Dict[str, Any]) -> str:
                return " ".join([
                    str(res.get("text") or res.get("document") or ""),
                    str((res.get("metadata") or {}).get("text") or ""),
                    str((res.get("metadata") or {}).get("page_text") or ""),
                ])

            # Note: We rely entirely on the vector embedding's semantic similarity here.
            # We do not override with lexical keyword searches, as semantic embeddings 
            # correctly handle synonymous or re-worded concepts that lack exact keyword overlaps.

            def result_sort_key(res: Dict[str, Any]):
                text = result_text(res)
                overlap = self._keyword_overlap_score(query, text)
                distance = res.get("distance")
                if distance is None:
                    distance = 1.0
                
                # Boost semantic matches that also have lexical overlap
                # Each exact keyword overlap reduces the effective distance by 0.05
                effective_distance = max(0.0, distance - (overlap * 0.05))
                return effective_distance

            relevant_results = sorted(filtered_results, key=result_sort_key)

            relevance_by_doc_and_chunk = {}
            needed_chunks_by_doc = {}
            
            for res in relevant_results:
                meta = res['metadata']
                d_id = meta.get('doc_id') or meta.get('document_id')
                c_idx = meta.get('chunk_index', 0)
                if not d_id:
                    continue

                if d_id not in relevance_by_doc_and_chunk:
                    relevance_by_doc_and_chunk[d_id] = {}
                text = result_text(res)
                score = self._keyword_overlap_score(query, text)
                relevance_by_doc_and_chunk[d_id][c_idx] = max(
                    relevance_by_doc_and_chunk[d_id].get(c_idx, 0),
                    score
                )
                
                if d_id not in needed_chunks_by_doc:
                    needed_chunks_by_doc[d_id] = set()
                    
                # Request current, previous, and next chunk for context windowing
                needed_chunks_by_doc[d_id].add(c_idx - 1)
                needed_chunks_by_doc[d_id].add(c_idx)
                needed_chunks_by_doc[d_id].add(c_idx + 1)
            
            if not needed_chunks_by_doc:
                return ""
                
            # 5. Fetch required chunks from database and build context string
            context_pieces = []
            total_chars = 0

            def append_block(doc_id, start_page, end_page, chunk_texts):
                nonlocal total_chars

                if total_chars >= settings.RAG_MAX_CHARS:
                    return True

                page_info = f"Page {start_page}"
                if start_page != end_page:
                    page_info += f"-{end_page}"
                header = f"[Document: {doc_id} | {page_info}]\n"
                body = "\n".join(chunk_texts)
                piece = header + body + "\n"
                remaining = settings.RAG_MAX_CHARS - total_chars

                if len(piece) <= remaining:
                    context_pieces.append(piece)
                    total_chars += len(piece)
                    return total_chars >= settings.RAG_MAX_CHARS

                marker = "\n[...truncated]"
                body_budget = remaining - len(header) - len(marker)
                if body_budget <= 0:
                    return True

                candidate = body[:body_budget]
                boundaries = [
                    candidate.rfind("\n\n"),
                    candidate.rfind(". "),
                    candidate.rfind("? "),
                    candidate.rfind("! "),
                    candidate.rfind("\n"),
                ]
                boundary = max(boundaries)
                if boundary >= body_budget // 2:
                    candidate = candidate[:boundary + 1].rstrip()
                else:
                    candidate = candidate.rsplit(" ", 1)[0].rstrip()

                truncated_piece = header + candidate + marker
                context_pieces.append(truncated_piece)
                total_chars += len(truncated_piece)
                return True
            
            for d_id, indices_set in needed_chunks_by_doc.items():
                all_doc_chunks = self.doc_repo.get_chunks(d_id)
                score_by_chunk = relevance_by_doc_and_chunk.get(d_id, {})
                
                selected_chunks = [chunk for chunk in all_doc_chunks if chunk.get('chunk_index') in indices_set]
                selected_chunks.sort(key=lambda c: c.get('chunk_index', 0))
                
                blocks = []
                current_block_chunks = []
                
                for chunk in selected_chunks:
                    if not current_block_chunks:
                        current_block_chunks.append(chunk)
                    else:
                        if chunk['chunk_index'] == current_block_chunks[-1]['chunk_index'] + 1:
                            current_block_chunks.append(chunk)
                        else:
                            blocks.append(current_block_chunks)
                            current_block_chunks = [chunk]
                if current_block_chunks:
                    blocks.append(current_block_chunks)
                    
                def get_block_score(block):
                    return max(score_by_chunk.get(c.get('chunk_index', -1), 0) for c in block)
                    
                blocks.sort(key=lambda b: (-get_block_score(b), b[0].get('chunk_index', 0)))
                
                reached_limit = False
                for block in blocks:
                    start_page = block[0]['page_start']
                    end_page = block[-1]['page_end']
                    texts = [c['text'] for c in block]
                    if append_block(d_id, start_page, end_page, texts):
                        reached_limit = True
                        break
                        
                if reached_limit or total_chars >= settings.RAG_MAX_CHARS:
                    break

                if total_chars >= settings.RAG_MAX_CHARS:
                    break
            
            if not context_pieces:
                self._retrieval_cache[cache_key] = ""
                return ""
                
            final_context = "\n".join(context_pieces)
            
            self._retrieval_cache[cache_key] = final_context
            if len(self._retrieval_cache) > 1000:
                self._retrieval_cache.clear()
                
            return final_context

        except Exception as e:
            print(f"Error during retrieval: {e}")
            traceback.print_exc()
            return ""


def get_retrieval_service() -> RetrievalService:
    global _shared_service
    if _shared_service is None:
        with _shared_service_lock:
            if _shared_service is None:
                _shared_service = RetrievalService()
    return _shared_service
