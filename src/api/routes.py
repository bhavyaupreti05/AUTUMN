from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, BackgroundTasks, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Dict, Optional
from src.llm.provider import QwenProvider
from src.services.chat_service import ChatService
from src.database.repository import ConversationRepository
from src.database.connection import get_connection, init_db
from src.services.document_service import DocumentService
from src.database.document_repository import DocumentRepository
from src.auth.dependencies import get_current_user
from src.core.rate_limit import limiter
from src.config import settings
import json
import uuid

router = APIRouter()

# Dependency injection
_provider = None
_repo = ConversationRepository()
_doc_service = DocumentService()
_doc_repo = DocumentRepository()

import threading
_provider_lock = threading.Lock()

def get_chat_service() -> ChatService:
    global _provider
    if _provider is None:
        with _provider_lock:
            if _provider is None:
                _provider = QwenProvider()
    return ChatService(_provider)

def get_repository() -> ConversationRepository:
    return _repo

def get_doc_service() -> DocumentService:
    return _doc_service

def get_doc_repo() -> DocumentRepository:
    return _doc_repo

# Ensure DB is initialized at startup
init_db()

class CreateConversationRequest(BaseModel):
    title: str = "New Conversation"

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=12000)
    conversation_id: Optional[str] = None
    truncate_from_message_id: Optional[str] = None

class MessageFeedbackRequest(BaseModel):
    rating: str = Field(..., pattern="^(positive|negative)$")
    suggestion: Optional[str] = None
    
@router.get("/health")
def health_check():
    # Verify SQLite is reachable
    db_status = "ok"
    try:
        # Simple ping to repo
        _repo.list_conversations()
    except Exception as e:
        db_status = "error"
        
    model_loaded = _provider is not None
    
    return {
        "status": "ok", 
        "service": "chat-bot-2 backend with SQLite",
        "persistence": db_status,
        "model_loaded": model_loaded,
        "rag_enabled": settings.RAG_ENABLED
    }

@router.get("/models")
def list_models(current_user: dict = Depends(get_current_user)):
    return {
        "models": [
            {
                "id": settings.MODEL_NAME,
                "quantization": settings.QUANTIZATION
            }
        ]
    }

# --- Conversation Endpoints ---

@router.post("/conversations")
def create_conversation(req: CreateConversationRequest, repo: ConversationRepository = Depends(get_repository), current_user: dict = Depends(get_current_user)):
    conv_id = repo.create_conversation(title=req.title, user_id=current_user.get("id"))
    return repo.get_conversation(conv_id)

@router.get("/conversations")
def list_conversations(repo: ConversationRepository = Depends(get_repository), current_user: dict = Depends(get_current_user)):
    return {"conversations": repo.get_conversations_by_user(current_user.get("id"))}

@router.get("/conversations/{conversation_id}")
def get_conversation(conversation_id: str, repo: ConversationRepository = Depends(get_repository), current_user: dict = Depends(get_current_user)):
    conv = repo.get_conversation(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if conv.get("user_id") != current_user.get("id") and not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Forbidden")
    messages = repo.get_messages(conversation_id)
    return {"conversation": conv, "messages": messages}

@router.post("/messages/{message_id}/feedback")
def save_message_feedback(
    message_id: str,
    feedback: MessageFeedbackRequest,
    current_user: dict = Depends(get_current_user),
):
    with get_connection() as conn:
        message = conn.execute("""
            SELECT m.id
            FROM messages m
            WHERE m.id = ? AND m.role = 'assistant'
        """, (message_id,)).fetchone()
        if not message:
            raise HTTPException(status_code=404, detail="Assistant message not found")

        conn.execute("""
            INSERT INTO message_feedback (message_id, user_id, rating)
            VALUES (?, ?, ?)
            ON CONFLICT(message_id, user_id) DO UPDATE SET
                rating = excluded.rating,
                created_at = CURRENT_TIMESTAMP
        """, (message_id, current_user.get("id"), feedback.rating))

        source = None
        if feedback.rating == 'negative' and feedback.suggestion and feedback.suggestion.strip():
            conn.execute("""
                UPDATE message_feedback
                SET review_status = 'approved', resolution_note = ?
                WHERE message_id = ? AND user_id = ?
            """, (feedback.suggestion.strip(), message_id, current_user.get("id")))

            source = conn.execute("""
                SELECT c.user_id, answer.conversation_id, answer.sequence,
                       (SELECT question.content FROM messages question
                        WHERE question.conversation_id = answer.conversation_id
                          AND question.role = 'user'
                          AND question.sequence < answer.sequence
                        ORDER BY question.sequence DESC LIMIT 1) AS question
                FROM messages answer
                JOIN conversations c ON c.id = answer.conversation_id
                WHERE answer.id = ? AND answer.role = 'assistant'
            """, (message_id,)).fetchone()
            
        conn.commit()
        
    if feedback.rating == 'negative' and feedback.suggestion and feedback.suggestion.strip() and source and source["user_id"]:
        from src.database.verified_knowledge_repository import VerifiedKnowledgeRepository
        VerifiedKnowledgeRepository().save(
            user_id=source["user_id"],
            source_feedback_message_id=message_id,
            question=source["question"] or "",
            correction=feedback.suggestion.strip(),
            created_by=current_user["id"],
        )

    return {"message_id": message_id, "rating": feedback.rating}

@router.delete("/conversations/{conversation_id}")
def delete_conversation(conversation_id: str, repo: ConversationRepository = Depends(get_repository), current_user: dict = Depends(get_current_user)):
    conv = repo.get_conversation(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if conv.get("user_id") != current_user.get("id") and not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Forbidden")
        
    success = repo.delete_conversation(conversation_id)
    if not success:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"status": "deleted"}

@router.post("/conversations/{conversation_id}/pin")
def pin_conversation(conversation_id: str, repo: ConversationRepository = Depends(get_repository), current_user: dict = Depends(get_current_user)):
    conv = repo.get_conversation(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if conv.get("user_id") != current_user.get("id") and not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Forbidden")
        
    success = repo.pin_conversation(conversation_id, current_user.get("id"))
    if not success:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"status": "pinned"}

@router.post("/conversations/{conversation_id}/unpin")
def unpin_conversation(conversation_id: str, repo: ConversationRepository = Depends(get_repository), current_user: dict = Depends(get_current_user)):
    conv = repo.get_conversation(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if conv.get("user_id") != current_user.get("id") and not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Forbidden")
        
    success = repo.unpin_conversation(conversation_id, current_user.get("id"))
    if not success:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"status": "unpinned"}

class UpdateConversationTitleRequest(BaseModel):
    title: str

@router.patch("/conversations/{conversation_id}/title")
def update_conversation_title(conversation_id: str, req: UpdateConversationTitleRequest, repo: ConversationRepository = Depends(get_repository), current_user: dict = Depends(get_current_user)):
    conv = repo.get_conversation(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if conv.get("user_id") != current_user.get("id") and not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Forbidden")
        
    success = repo.update_conversation_title(conversation_id, req.title, current_user.get("id"))
    if not success:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"status": "updated", "title": req.title}

# --- Chat Endpoint ---

@router.post("/chat")
@limiter.limit("60/minute")
def chat_endpoint(request: Request, chat_req: ChatRequest, service: ChatService = Depends(get_chat_service), repo: ConversationRepository = Depends(get_repository), current_user: dict = Depends(get_current_user)):
    # 1. Resolve conversation
    conv_id = chat_req.conversation_id
    if conv_id:
        conv = repo.get_conversation(conv_id)
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found")
        if conv.get("user_id") != current_user.get("id") and not current_user.get("is_admin"):
            raise HTTPException(status_code=403, detail="Forbidden")
    else:
        # Create a new conversation implicitly if none provided
        # Use first 5 words as title deterministically
        words = chat_req.message.split()
        title = " ".join(words[:5]) + ("..." if len(words) > 5 else "")
        if not title.strip():
            title = "New Conversation"
        conv_id = repo.create_conversation(title=title, user_id=current_user.get("id"))

    if chat_req.truncate_from_message_id and conv_id:
        repo.truncate_from_message(conv_id, chat_req.truncate_from_message_id)

    async def event_generator():
        # First yield the conversation ID so the client knows it
        yield f"data: {json.dumps({'conversation_id': conv_id})}\n\n"
        
        try:
            stream = service.generate_chat_response(chat_req.message, conv_id, user_id=current_user.get("id"))
            from fastapi.concurrency import iterate_in_threadpool
            async for item in iterate_in_threadpool(stream):
                if await request.is_disconnected():
                    print("Client disconnected! Closing generator.")
                    stream.close()
                    break
                
                if item.get("type") == "text":
                    yield f"data: {json.dumps({'chunk': item['content']})}\n\n"
                elif item.get("type") == "message_id":
                    yield f"data: {json.dumps({'message_id': item['message_id']})}\n\n"
                elif item.get("type") == "status":
                    yield f"data: {json.dumps({'status': item['status']})}\n\n"
                elif item.get("type") == "error":
                    yield f"data: {json.dumps({'error': item['error']})}\n\n"
            if not await request.is_disconnected():
                yield "data: [DONE]\n\n"
        except Exception as e:
            # Generic error handling to prevent stack trace leakage to the client
            print(f"Chat generation error: {e}")
            yield f"data: {json.dumps({'error': 'An internal error occurred during generation.'})}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

# --- Document Endpoints ---

@router.post("/documents")
@limiter.limit("5/minute")
async def upload_document(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...), 
    doc_service: DocumentService = Depends(get_doc_service),
    current_user: dict = Depends(get_current_user)
):
    if not file.filename.lower().endswith((".pdf", ".docx", ".xlsx", ".csv")):
        raise HTTPException(status_code=400, detail="Only PDF, DOCX, XLSX, and CSV files are supported.")
        
    max_file_size = settings.MAX_PDF_SIZE_MB * 1024 * 1024
    content = bytearray()
    while chunk := await file.read(1024 * 1024):
        content.extend(chunk)
        if len(content) > max_file_size:
            raise HTTPException(status_code=413, detail=f"File too large. Maximum size is {settings.MAX_PDF_SIZE_MB}MB.")
            
    content = bytes(content)
    if not content:
        raise HTTPException(status_code=400, detail="Empty file uploaded.")
        
    try:
        result = doc_service.process_uploaded_file(file.filename, content, background_tasks, user_id=current_user.get("id"))
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"Document upload error: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred while processing the document.")

@router.get("/documents")
def list_documents(doc_repo: DocumentRepository = Depends(get_doc_repo), current_user: dict = Depends(get_current_user)):
    user_id = None if current_user.get("is_admin") else current_user.get("id")
    return {"documents": doc_repo.list_documents(user_id=user_id)}

@router.get("/documents/{document_id}")
def get_document(document_id: str, doc_repo: DocumentRepository = Depends(get_doc_repo), current_user: dict = Depends(get_current_user)):
    doc = doc_repo.get_document(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if not doc.get("user_id"):
        raise HTTPException(status_code=403, detail="Document is quarantined (orphaned) and inaccessible")
    if doc.get("user_id") != current_user.get("id") and not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Forbidden")
    return {"document": doc}

@router.delete("/documents/{document_id}")
def delete_document(document_id: str, doc_repo: DocumentRepository = Depends(get_doc_repo), doc_service: DocumentService = Depends(get_doc_service), current_user: dict = Depends(get_current_user)):
    doc = doc_repo.get_document(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if not doc.get("user_id"):
        raise HTTPException(status_code=403, detail="Document is quarantined (orphaned) and inaccessible")
    if doc.get("user_id") != current_user.get("id") and not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Forbidden")
        
    success = doc_service.delete_document(document_id)
    if not success:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"status": "deleted"}

class AssociateDocumentRequest(BaseModel):
    document_id: str

@router.post("/conversations/{conversation_id}/documents")
def associate_document(conversation_id: str, req: AssociateDocumentRequest, 
                      repo: ConversationRepository = Depends(get_repository),
                      doc_repo: DocumentRepository = Depends(get_doc_repo),
                      current_user: dict = Depends(get_current_user)):
    conv = repo.get_conversation(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if conv.get("user_id") != current_user.get("id") and not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Forbidden")
        
    document = doc_repo.get_document(req.document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    if not document.get("user_id"):
        raise HTTPException(status_code=403, detail="Document is quarantined (orphaned) and inaccessible")
    if document.get("user_id") != current_user.get("id") and not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Forbidden")
        
    doc_repo.associate_document_with_conversation(conversation_id, req.document_id)
    return {"status": "associated"}

@router.delete("/conversations/{conversation_id}/documents/{document_id}")
def detach_document(conversation_id: str, document_id: str, repo: ConversationRepository = Depends(get_repository), doc_repo: DocumentRepository = Depends(get_doc_repo), current_user: dict = Depends(get_current_user)):
    conv = repo.get_conversation(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if conv.get("user_id") != current_user.get("id") and not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Forbidden")
        
    success = doc_repo.detach_document_from_conversation(conversation_id, document_id)
    if not success:
        raise HTTPException(status_code=404, detail="Association not found")
    return {"status": "detached"}

@router.get("/conversations/{conversation_id}/documents")
def get_conversation_documents(conversation_id: str, repo: ConversationRepository = Depends(get_repository), doc_repo: DocumentRepository = Depends(get_doc_repo), current_user: dict = Depends(get_current_user)):
    conv = repo.get_conversation(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if conv.get("user_id") != current_user.get("id") and not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Forbidden")
        
    docs = doc_repo.get_conversation_documents(conversation_id)
    return {"documents": docs}
