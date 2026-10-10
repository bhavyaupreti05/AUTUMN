import os
import uuid
import hashlib
import shutil
import fitz  # PyMuPDF
from typing import Dict, List, Tuple
from src.database.document_repository import DocumentRepository
from src.config import settings
from src.services.retrieval_service import get_retrieval_service

class DocumentService:
    def __init__(self):
        self.repo = DocumentRepository()
        self.retrieval_service = get_retrieval_service()
        os.makedirs(settings.DOCUMENTS_DIR, exist_ok=True)


    def process_uploaded_file(self, filename: str, content: bytes, background_tasks, user_id: str = None) -> Dict:
        """
        Validates, hashes, stores, and queues for background extraction and persistence.
        """
        import re
        # Sanitize filename to prevent XSS and path traversal
        filename = re.sub(r'[^a-zA-Z0-9_.\-]', '_', filename)
        
        if len(content) > settings.MAX_PDF_SIZE_MB * 1024 * 1024:
            raise ValueError(f"File exceeds maximum size of {settings.MAX_PDF_SIZE_MB}MB")

        sha256_hash = hashlib.sha256(content).hexdigest()
        storage_hash = sha256_hash if user_id is None else f"{sha256_hash}:{user_id}"
        existing_doc = self.repo.get_document_by_hash_for_user(storage_hash, user_id)
        
        if existing_doc:
            if existing_doc["status"] in ("READY", "processed", "PROCESSED_NO_RAG"):
                return {"document": existing_doc, "status": "reused"}
            elif existing_doc["status"] == "PROCESSING":
                return {"document": existing_doc, "status": "processing_already"}
            else:
                # If FAILED, delete old entry and retry
                self.delete_document(existing_doc["id"])

        doc_id = str(uuid.uuid4())
        storage_hash = sha256_hash if user_id is None else f"{sha256_hash}:{user_id}"
        doc_dir = os.path.join(settings.DOCUMENTS_DIR, doc_id)
        os.makedirs(doc_dir, exist_ok=True)
        
        ext = os.path.splitext(filename)[1].lower()
        file_path = os.path.join(doc_dir, f"original{ext}")
        with open(file_path, "wb") as f:
            f.write(content)

        # We initially estimate page count as 0 until extracted
        self.repo.create_document(
            doc_id=doc_id, 
            filename=filename, 
            sha256=storage_hash, 
            size=len(content), 
            page_count=0, 
            status="PROCESSING",
            progress=0.0,
            user_id=user_id
        )
        
        # Enqueue background ingestion
        background_tasks.add_task(self._background_ingest, doc_id, filename, content)
        
        new_doc = self.repo.get_document(doc_id)
        return {"document": new_doc, "status": "processing"}

    def _background_ingest(self, doc_id: str, filename: str, content: bytes):
        doc_dir = os.path.join(settings.DOCUMENTS_DIR, doc_id)
        ext = os.path.splitext(filename)[1].lower()
        file_path = os.path.join(doc_dir, f"original{ext}")
        txt_path = os.path.join(doc_dir, "extracted.txt")
        
        try:
            # 1. Extraction (10% progress)
            self.repo.update_document_status(doc_id, "PROCESSING", 10.0)
            pages_text, page_count = self._extract_text(file_path)
            
            if page_count == 0 or not any(p[1].strip() for p in pages_text):
                raise ValueError("PDF contains no readable text.")

            with open(txt_path, "w", encoding="utf-8") as f:
                for pg_num, txt in pages_text:
                    f.write(f"--- Page {pg_num} ---\n{txt}\n\n")
                    
            # 2. Chunking (20% progress)
            self.repo.update_document_status(doc_id, "PROCESSING", 20.0)
            chunks = self._chunk_text(pages_text)
            
            # Save chunks to DB
            self.repo.save_chunks(doc_id, chunks)
            
            # Update page count now that we know it
            from src.database.connection import get_connection
            with get_connection() as conn:
                conn.execute("UPDATE documents SET page_count = ? WHERE id = ?", (page_count, doc_id))
                conn.commit()

            # 3. Embedding (20-95% progress)
            if settings.RAG_ENABLED:
                # We need to manually chunk this to update progress!
                texts = [c["text"] for c in chunks]
                if texts:
                    self.repo.update_document_status(doc_id, "PROCESSING", 25.0)
                    all_embeddings = []
                    total = len(texts)
                    batch_size = 16
                    for start in range(0, total, batch_size):
                        batch = texts[start:start + batch_size]
                        embeddings = self.retrieval_service.embedding_provider.embed_texts(batch)
                        if len(embeddings) != len(batch):
                            raise ValueError("Embedding service returned an incomplete batch.")
                        all_embeddings.extend(embeddings)
                        completed = start + len(batch)
                        prog = 25.0 + ((completed / total) * 70.0)
                        self.repo.update_document_status(doc_id, "PROCESSING", prog)
                    
                    # 4. Chroma Insertion
                    self.repo.update_document_status(doc_id, "PROCESSING", 95.0)
                    # We have embeddings, now insert them directly to avoid re-embedding
                    
                    ids = [str(uuid.uuid4()) for _ in chunks]
                    metadatas = [{
                        "doc_id": doc_id,
                        "chunk_index": c["chunk_index"],
                        "page_start": c["page_start"],
                        "page_end": c["page_end"],
                        "page_number": c["page_start"]
                    } for c in chunks]
                    
                    self.retrieval_service.vector_store.collection.add(
                        ids=ids,
                        embeddings=all_embeddings,
                        documents=texts,
                        metadatas=metadatas
                    )

            # Text extraction, chunks, and vector indexing are enough for retrieval.
            # Mark the document ready before optional LLM summarization so a busy
            # generation request cannot make an uploaded document appear unusable.
            final_status = "READY" if settings.RAG_ENABLED else "PROCESSED_NO_RAG"
            self.repo.update_document_status(doc_id, final_status, 100.0)

            # 5. Optional Map-Reduce Summarization
            try:
                from src.api.routes import get_chat_service
                chat_service = get_chat_service()
                
                # We group text into ~8000 character blocks to reduce prompt evaluation time per map step,
                # which allows the background task to yield the LLM lock to foreground chat requests more frequently.
                block_size = 8000
                blocks = []
                current_block = ""
                for page_num, text in pages_text:
                    if len(current_block) + len(text) > block_size and current_block:
                        blocks.append(current_block)
                        current_block = text
                    else:
                        current_block += "\n" + text
                if current_block:
                    blocks.append(current_block)
                
                block_summaries = []
                for i, block in enumerate(blocks):
                    prompt = f"Please extract the main headings, topics, and sub-headings from the following document section, followed by a brief list of concrete facts, names, and numbers. Do not use generic phrasing. Provide the headings clearly.\n\n[Document Section]:\n{block}"
                    # Use a generous token limit for summaries, and set is_background_task
                    summary = ""
                    import time
                    for attempt in range(10):
                        try:
                            stream = chat_service.provider.generate_stream(prompt, max_tokens=1000, temperature=0.3, is_background_task=True)
                            temp_summary = ""
                            for item in stream:
                                if item.get("type") == "text":
                                    temp_summary += item["content"]
                                elif item.get("type") == "status" and item.get("status") == "ABORTED_FOR_FOREGROUND":
                                    raise RuntimeError("ABORTED_FOR_FOREGROUND")
                                elif item.get("type") == "error":
                                    raise RuntimeError(f"LLM Error during map step: {item['error']}")
                            summary = temp_summary
                            break
                        except Exception as e:
                            if attempt == 9:
                                raise e
                            backoff = min(2 ** attempt, 30.0)
                            time.sleep(backoff)
                    
                    summary = summary.strip()
                    if "[Document" in summary:
                        summary = summary.split("[Document")[0].strip()
                        
                    block_summaries.append(summary)
                    
                    import time
                    time.sleep(1.0) # Yield to foreground chat requests
                
                final_summary = ""
                combined = "\n\n".join([f"--- Section {j+1} ---\n{s}" for j, s in enumerate(block_summaries)])
                prompt = (
                    "Please consolidate the following section summaries into a single cohesive overview. "
                    "You MUST format your response exactly into these two sections:\n\n"
                    "### Main Headings\n"
                    "(List the core Table of Contents or main structural topics here)\n\n"
                    "### Summary\n"
                    "(Provide a thorough, comprehensive bulleted summary of all concrete facts, names, numbers, and key points from the ENTIRE document. Do not miss any important sections.)\n\n"
                    f"[Section Summaries]:\n{combined}"
                )
                
                for attempt in range(10):
                    try:
                        stream = chat_service.provider.generate_stream(prompt, max_tokens=1500, temperature=0.3, is_background_task=True)
                        temp_final = ""
                        for item in stream:
                            if item.get("type") == "text":
                                temp_final += item["content"]
                            elif item.get("type") == "status" and item.get("status") == "ABORTED_FOR_FOREGROUND":
                                raise RuntimeError("ABORTED_FOR_FOREGROUND")
                            elif item.get("type") == "error":
                                raise RuntimeError(f"LLM Error during reduce step: {item['error']}")
                        final_summary = temp_final
                        break
                    except Exception as e:
                            if attempt == 9:
                                raise e
                            import time
                            backoff = min(2 ** attempt, 30.0)
                            time.sleep(backoff)
                    
                    final_summary = final_summary.strip()
                    # Strip reduce prompt echo if present
                    if "[Section" in final_summary:
                        final_summary = final_summary.split("[Section")[0].strip()
                    if "[Document" in final_summary:
                        final_summary = final_summary.split("[Document")[0].strip()
                
                if final_summary:
                    self.repo.update_document_summary(doc_id, final_summary)
                    
                    # 6. Embed the summary itself into the Vector Store
                    if settings.RAG_ENABLED and self.retrieval_service and self.retrieval_service.vector_store:
                        try:
                            summary_emb = self.retrieval_service.embedding_provider.embed_texts([final_summary])
                            self.retrieval_service.vector_store.collection.add(
                                ids=[f"{doc_id}_summary"],
                                embeddings=summary_emb,
                                documents=[final_summary],
                                metadatas=[{
                                    "doc_id": doc_id,
                                    "chunk_index": -1,
                                    "page_start": 1,
                                    "page_end": page_count if 'page_count' in locals() else 1,
                                    "page_number": 1
                                }]
                            )
                        except Exception as emb_err:
                            print(f"Failed to index summary for doc {doc_id} into vector store: {emb_err}")

                    print(f"Summarization SUCCESSFULLY COMPLETED for doc {doc_id}")
                    
            except Exception as summary_err:
                # If summarization fails, log it and gracefully continue so the document becomes READY
                print(f"Summarization failed for doc {doc_id}: {summary_err}")
                # We do not delete the document, it just falls back to chunk-based retrieval
            
            # Restore the searchable status after optional summarization.
            self.repo.update_document_status(doc_id, final_status, 100.0)

        except Exception as e:
            print(f"Background ingestion failed for {doc_id}: {e}")
            if os.path.exists(doc_dir):
                shutil.rmtree(doc_dir)
            self.repo.update_document_status(doc_id, "FAILED", 0.0)

    def _extract_text(self, file_path: str) -> Tuple[List[Tuple[int, str]], int]:
        """Returns list of (page_num, text) and total page count."""
        pages_text = []
        max_text_chars = settings.MAX_EXTRACTED_TEXT_MB * 1024 * 1024
        lower_path = file_path.lower()
        if lower_path.endswith(".docx"):
            import zipfile
            import docx
            with zipfile.ZipFile(file_path) as archive:
                uncompressed_size = sum(entry.file_size for entry in archive.infolist())
                if uncompressed_size > settings.MAX_DOCX_UNCOMPRESSED_MB * 1024 * 1024:
                    raise ValueError("DOCX uncompressed content exceeds the maximum allowed size.")
            doc = docx.Document(file_path)
            paragraphs_text = []
            for para in doc.paragraphs:
                if para.style and para.style.name.startswith('Heading'):
                    level = para.style.name.replace('Heading', '').strip()
                    if level.isdigit() and int(level) <= 6:
                        paragraphs_text.append(f"\n{'#' * int(level)} {para.text}\n")
                    else:
                        paragraphs_text.append(f"\n# {para.text}\n")
                else:
                    paragraphs_text.append(para.text)
            full_text = "\n".join(paragraphs_text)
            if len(full_text) > max_text_chars:
                raise ValueError("Extracted document text exceeds the maximum allowed size.")
            pages_text.append((1, full_text))
            page_count = 1
        elif lower_path.endswith(".csv"):
            import csv
            with open(file_path, "r", encoding="utf-8-sig", newline="") as source:
                rows = csv.reader(source)
                lines = [" | ".join(cell.strip() for cell in row) for row in rows if any(cell.strip() for cell in row)]
            full_text = "\n".join(lines)
            if len(full_text) > max_text_chars:
                raise ValueError("Extracted document text exceeds the maximum allowed size.")
            pages_text.append((1, full_text))
            page_count = 1
        elif lower_path.endswith(".xlsx"):
            from openpyxl import load_workbook
            workbook = load_workbook(file_path, read_only=True, data_only=True)
            sheet_text = []
            for worksheet in workbook.worksheets:
                rows = []
                for row in worksheet.iter_rows(values_only=True):
                    values = ["" if value is None else str(value).strip() for value in row]
                    if any(values):
                        rows.append(" | ".join(values))
                if rows:
                    sheet_text.append(f"[{worksheet.title}]\n" + "\n".join(rows))
            workbook.close()
            full_text = "\n\n".join(sheet_text)
            if len(full_text) > max_text_chars:
                raise ValueError("Extracted document text exceeds the maximum allowed size.")
            pages_text.append((1, full_text))
            page_count = 1
        else:
            doc = fitz.open(file_path)
            page_count = doc.page_count
            if page_count > settings.MAX_DOCUMENT_PAGES:
                doc.close()
                raise ValueError("Document exceeds the maximum allowed page count.")
            extracted_chars = 0
            for page_num in range(page_count):
                page = doc.load_page(page_num)
                page_height = page.rect.height
                blocks = page.get_text("blocks")
                page_text_parts = []
                for b in blocks:
                    if len(b) >= 7 and b[6] == 0:  # If it is a text block
                        block_text = b[4].strip()
                        if not block_text:
                            continue
                        
                        # Noise reduction: ignore small headers and footers
                        is_header = b[1] < 50 and len(block_text) < 50
                        is_footer = b[3] > page_height - 50 and len(block_text) < 50
                        
                        if is_header or is_footer:
                            continue
                            
                        page_text_parts.append(block_text)
                        
                text = "\n\n".join(page_text_parts)
                
                # Extract and append markdown tables
                try:
                    tables = page.find_tables()
                    if tables and hasattr(tables, "tables") and tables.tables:
                        for table in tables.tables:
                            if hasattr(table, "to_markdown"):
                                text += "\n\n[Table]:\n" + table.to_markdown() + "\n\n"
                except Exception as e:
                    print(f"Table extraction skipped: {e}")
                    
                extracted_chars += len(text)
                if extracted_chars > max_text_chars:
                    doc.close()
                    raise ValueError("Extracted document text exceeds the maximum allowed size.")
                pages_text.append((page_num + 1, text))
            doc.close()
            
        return pages_text, page_count

    def _chunk_text(self, pages_text: List[Tuple[int, str]]) -> List[Dict]:
        """
        Advanced Semantic Chunking: Groups paragraphs together logically.
        Preserves heading context for each chunk.
        Tracks which page a chunk started and ended on.
        """
        chunks = []
        max_chunk_size = settings.CHUNK_SIZE * 1.5 # Allow larger dynamic paragraphs to keep semantics intact
        
        full_text = ""
        page_map = [] # stores (char_start, char_end, page_num)
        
        current_idx = 0
        for page_num, text in pages_text:
            cleaned = text.strip() + "\n\n"
            start_idx = current_idx
            end_idx = current_idx + len(cleaned)
            full_text += cleaned
            page_map.append((start_idx, end_idx, page_num))
            current_idx = end_idx
            
        import re
        # Find all headings to maintain context
        heading_matches = list(re.finditer(r'\n(#{1,4})\s+(.+)', '\n' + full_text))
        
        def get_current_heading(idx):
            current = ""
            for match in heading_matches:
                if match.start() <= idx:
                    current = f"[{match.group(1)} {match.group(2).strip()}] "
                else:
                    break
            return current

        # Split text strictly by paragraph breaks (semantic boundaries)
        paragraphs = [p.strip() for p in re.split(r'\n\s*\n', full_text) if p.strip()]
        
        current_chunk_text = ""
        current_start_idx = 0
        chunk_idx = 0
        search_idx = 0
        
        for i, para in enumerate(paragraphs):
            # Find the actual start index of this paragraph in the full text
            para_idx = full_text.find(para, search_idx)
            if para_idx == -1: 
                para_idx = search_idx
            
            if not current_chunk_text:
                current_chunk_text = para
                current_start_idx = para_idx
            else:
                if len(current_chunk_text) + len(para) + 2 <= max_chunk_size:
                    current_chunk_text += "\n\n" + para
                else:
                    # Save current chunk before it gets too big
                    heading = get_current_heading(current_start_idx)
                    final_text = f"{heading}{current_chunk_text}" if heading and not current_chunk_text.startswith("#") else current_chunk_text
                    
                    end_idx = current_start_idx + len(current_chunk_text)
                    start_page = self._get_page_for_idx(current_start_idx, page_map)
                    end_page = self._get_page_for_idx(end_idx, page_map)
                    
                    chunks.append({
                        "chunk_index": chunk_idx,
                        "page_start": start_page,
                        "page_end": end_page,
                        "text": final_text
                    })
                    chunk_idx += 1
                    
                    # Start new chunk. Include a 1-paragraph semantic overlap if possible for flow.
                    prev_para = paragraphs[i-1] if i > 0 else ""
                    if prev_para and len(prev_para) < 500:
                        current_chunk_text = prev_para + "\n\n" + para
                        current_start_idx = full_text.find(prev_para, search_idx - len(prev_para) - 10)
                        if current_start_idx == -1: current_start_idx = para_idx
                    else:
                        current_chunk_text = para
                        current_start_idx = para_idx
                        
            search_idx = para_idx + len(para)
            
        # Add the remaining chunk
        if current_chunk_text:
            heading = get_current_heading(current_start_idx)
            final_text = f"{heading}{current_chunk_text}" if heading and not current_chunk_text.startswith("#") else current_chunk_text
            end_idx = current_start_idx + len(current_chunk_text)
            chunks.append({
                "chunk_index": chunk_idx,
                "page_start": self._get_page_for_idx(current_start_idx, page_map),
                "page_end": self._get_page_for_idx(end_idx, page_map),
                "text": final_text
            })

        return chunks

    def _get_page_for_idx(self, idx: int, page_map: List[Tuple[int, int, int]]) -> int:
        for start, end, pg in page_map:
            if start <= idx <= end:
                return pg
        return page_map[-1][2] if page_map else 1

    def delete_document(self, doc_id: str) -> bool:
        # DB cascade will delete chunks and associations
        success = self.repo.delete_document(doc_id)
        if success:
            doc_dir = os.path.join(settings.DOCUMENTS_DIR, doc_id)
            if os.path.exists(doc_dir):
                shutil.rmtree(doc_dir)
            if settings.RAG_ENABLED:
                self.retrieval_service.delete_document_vectors(doc_id)
        return success
