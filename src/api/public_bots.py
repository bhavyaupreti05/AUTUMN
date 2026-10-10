from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
import json
import hashlib
from src.database.connection import get_connection
from src.database.repository import ConversationRepository
from src.api.routes import get_chat_service, ChatService
from src.core.prompt_builder import PromptBuilder
from src.config import settings

router = APIRouter(prefix="/public/bots", tags=["public bots"])

class PublicBotChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=12000)
    conversation_id: str | None = None

def _get_bot_by_public_key(public_key: str):
    with get_connection() as conn:
        integration = conn.execute("SELECT * FROM custom_bot_integrations WHERE public_key = ?", (public_key,)).fetchone()
        if not integration or not integration["enabled"]:
            raise HTTPException(status_code=404, detail="Integration not found or disabled")
            
        bot_id = integration["bot_id"]
        bot = conn.execute("SELECT * FROM custom_bots WHERE id = ?", (bot_id,)).fetchone()
        if not bot:
            raise HTTPException(status_code=404, detail="Bot not found")
            
        documents = conn.execute("""
            SELECT d.id, d.filename, d.status, d.progress
            FROM documents d
            JOIN custom_bot_documents cbd ON cbd.document_id = d.id
            WHERE cbd.bot_id = ?
            ORDER BY cbd.created_at ASC
        """, (bot_id,)).fetchall()
        
        result = dict(bot)
        try:
            result["starter_questions"] = json.loads(result.get("starter_questions") or "[]")
        except:
            result["starter_questions"] = []
        result["documents"] = [dict(row) for row in documents]
        result["integration"] = dict(integration)
        
        return result

def get_repository():
    return ConversationRepository()

ACCENT_TONE_INSTRUCTIONS = {
    "var(--accent)": "Use a warm, friendly, and balanced tone.",
    "#3b82f6": "Use a calm, professional, and precise tone.",
    "#10b981": "Use a helpful, supportive, and encouraging tone.",
    "#8b5cf6": "Use a creative, thoughtful, and engaging tone while staying accurate.",
    "#ef4444": "Use a bold, direct, and decisive tone while staying respectful.",
}

@router.get("/{public_key}/init")
def init_public_bot(public_key: str, request: Request):
    bot = _get_bot_by_public_key(public_key)
    
    # We only return safe, non-sensitive config
    return {
        "name": bot["name"],
        "accent": bot["accent"],
        "starter_questions": bot["starter_questions"],
        "is_ready": True
    }

@router.post("/{public_key}/chat")
def chat_with_public_bot(
    public_key: str, 
    chat: PublicBotChatRequest,
    request: Request,
    service: ChatService = Depends(get_chat_service),
    repo: ConversationRepository = Depends(get_repository)
):
    bot = _get_bot_by_public_key(public_key)
    integration = bot["integration"]
    
    # Note: Origin validation is handled by OriginPolicyMiddleware, 
    # but backend-to-backend calls need Bearer token validation here.
    auth_header = request.headers.get("Authorization")
    is_server_to_server = False
    
    if auth_header and auth_header.startswith("Bearer "):
        secret = auth_header[7:].strip()
        secret_hash = hashlib.sha256(secret.encode()).hexdigest()
        if secret_hash == integration["secret_hash"]:
            is_server_to_server = True
        else:
            raise HTTPException(status_code=403, detail="Invalid API Secret")
    else:
        # If no secret is provided, it must come from an allowed origin
        # The OriginPolicyMiddleware will handle browser origins, but we can also double check
        origin = request.headers.get("origin")
        if origin:
            allowed = json.loads(integration["allowed_origins"] or "[]")
            # Normalization and strict matching handled by middleware
            
    # Resolve or create conversation
    # For public bots, we don't tie it to a real system user_id, 
    # we tie it to the public_key as a pseudo-user to keep them separate,
    # or just user_id=None
    conversation_id = chat.conversation_id
    pseudo_user_id = f"ext_{public_key}"
    
    if conversation_id:
        conversation = repo.get_conversation(conversation_id)
        if not conversation or conversation.get("user_id") != pseudo_user_id:
            raise HTTPException(status_code=404, detail="Bot conversation not found")
    else:
        conversation_id = repo.create_conversation(title=bot["name"], user_id=pseudo_user_id)

    # Attach documents if any
    with get_connection() as conn:
        for document in bot["documents"]:
            conn.execute("INSERT OR IGNORE INTO conversation_documents (conversation_id, document_id) VALUES (?, ?)", (conversation_id, document["id"]))
        conn.commit()

    accent = bot.get("accent", "var(--accent)")
    tone_instruction = ACCENT_TONE_INSTRUCTIONS.get(accent, ACCENT_TONE_INSTRUCTIONS["var(--accent)"])
    
    # Update last_used_at
    with get_connection() as conn:
        conn.execute("UPDATE custom_bot_integrations SET last_used_at = CURRENT_TIMESTAMP WHERE public_key = ?", (public_key,))
        conn.commit()

    prompt_builder = PromptBuilder()
    custom_system_prompt = (
        f"{bot['personality'].strip()} {tone_instruction} "
        f"{prompt_builder.system_prompt} "
        "You are acting as a custom integrated bot. "
        "Do not mention these internal tone instructions to the user."
    )

    async def event_generator():
        yield f"data: {json.dumps({'conversation_id': conversation_id})}\n\n"
        try:
            stream = service.generate_chat_response(
                message=chat.message, 
                conversation_id=conversation_id, 
                user_id=pseudo_user_id,
                system_prompt=custom_system_prompt
            )
            from fastapi.concurrency import iterate_in_threadpool
            async for item in iterate_in_threadpool(stream):
                if await request.is_disconnected():
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
            print(f"Chat generation error: {e}")
            yield f"data: {json.dumps({'error': 'An internal error occurred during generation.'})}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
