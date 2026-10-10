from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from src.core.rate_limit import limiter, check_username_rate_limit, clear_username_rate_limit
from src.config import settings
from src.auth import db, security, dependencies
from src.auth.password_policy import validate_password
from src.database.repository import ConversationRepository
from src.database.verified_knowledge_repository import VerifiedKnowledgeRepository
import re
from collections import Counter
import uuid
import secrets
import string
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

class UserRegister(BaseModel):
    username: str
    password: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class AdminResetTokenRequest(BaseModel):
    admin_password: str

class GenerateUserRequest(BaseModel):
    domain: str
    duration_minutes: int

class ExtendExpiryRequest(BaseModel):
    duration_minutes: int

class FeedbackReviewRequest(BaseModel):
    review_status: str
    resolution_note: str = ""

class UserSuggestionRequest(BaseModel):
    category: str
    message: str

class SuggestionReviewRequest(BaseModel):
    status: str
    resolution_note: str = ""

def _auth_cookie(response: JSONResponse, token: str):
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/"
    )

def _clear_auth_cookie(response: JSONResponse):
    response.delete_cookie(key="access_token", httponly=True, secure=settings.COOKIE_SECURE, samesite="lax", path="/")

@router.post("/register")
@limiter.limit("60/minute")
def register(request: Request, user_data: UserRegister):
    if db.get_user_by_username(user_data.username):
        raise HTTPException(status_code=400, detail="Unable to register with the supplied credentials")

    try:
        validate_password(user_data.password, user_data.username)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
        
    password_hash = security.get_password_hash(user_data.password)
    
    user = db.create_registered_user(user_data.username, password_hash)
        
    return {"id": user["id"], "username": user["username"], "status": user["status"]}

@router.post("/login")
@limiter.limit("60/minute")
def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends()):
    clean_username = form_data.username.strip()
    if not check_username_rate_limit(clean_username):
        logger.warning(f"Rate limit exceeded for username '{clean_username}' from IP: {request.client.host}")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too Many Requests for this username"
        )
        
    user = db.get_user_by_username(clean_username)
    
    if user and user.get("locked_until"):
        import datetime
        locked_until = datetime.datetime.fromisoformat(user["locked_until"])
        if datetime.datetime.now(datetime.timezone.utc) < locked_until:
            logger.warning(f"Locked account login attempt for '{form_data.username}' from IP: {request.client.host}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is temporarily locked due to multiple failed login attempts. Try again later."
            )
        else:
            db.reset_failed_logins(clean_username)

    if user and user.get("expires_at"):
        import datetime
        expires_at = datetime.datetime.fromisoformat(user["expires_at"])
        if datetime.datetime.now(datetime.timezone.utc) >= expires_at:
            raise HTTPException(status_code=401, detail="This account has expired")
            
    if not user or not security.verify_password(form_data.password, user["password_hash"]):
        if user:
            db.record_failed_login(clean_username)
        logger.warning(f"Failed login attempt for username '{clean_username}' from IP: {request.client.host}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    db.record_successful_login(clean_username)
    clear_username_rate_limit(clean_username)
        
    if user["status"] != 'approved':
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    access_token = security.create_access_token(data={"sub": user["username"], "token_version": user.get("token_version", 0)})
    
    res = JSONResponse(content={"message": "Successfully logged in"})
    _auth_cookie(res, access_token)
    return res

class ForgotPasswordRequest(BaseModel):
    username: str

class AdminRecoveryRequest(BaseModel):
    recovery_key: str
    new_password: str

@router.post("/admin-recovery")
@limiter.limit("5/minute")
def admin_recovery(request: Request, body: AdminRecoveryRequest):
    from src.config import Settings
    settings = Settings()
    if not settings.ADMIN_RECOVERY_KEY or body.recovery_key.strip().upper() != settings.ADMIN_RECOVERY_KEY.strip().upper():
        raise HTTPException(status_code=400, detail="Invalid Recovery Key")
    
    # Check if admin user exists
    user = db.get_user_by_username("admin")
    if not user:
        raise HTTPException(status_code=400, detail="Admin user does not exist")
        
    try:
        from src.auth.password_policy import validate_password
        validate_password(body.new_password, "admin")
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
        
    with db.get_db_connection() as conn:
        conn.execute(
            "UPDATE users SET password_hash = ?, token_version = COALESCE(token_version, 0) + 1, failed_login_attempts = 0, locked_until = NULL WHERE id = ?",
            (security.get_password_hash(body.new_password), user["id"]),
        )
        conn.commit()
    return {"status": "success", "message": "Admin password recovered successfully"}

@router.get("/admin/recovery-key")
def get_recovery_key(current_user: dict = Depends(dependencies.require_admin)):
    from src.config import Settings
    settings = Settings()
    return {"recovery_key": settings.ADMIN_RECOVERY_KEY}

@router.post("/forgot-password-request")
@limiter.limit("60/minute")
def request_forgot_password(request: Request, body: ForgotPasswordRequest):
    if not body.username:
        raise HTTPException(status_code=400, detail="Username is required")
    db.request_password_reset(body.username)
    return {"status": "request_recorded", "message": "If the account exists, the admin will be notified."}

@router.get("/admin/forgot-password-requests")
def get_reset_requests(current_user: dict = Depends(dependencies.require_admin)):
    return {"requests": db.list_password_reset_requests()}

@router.post("/admin/resolve-reset-request/{user_id}")
def resolve_reset_request(user_id: str, current_user: dict = Depends(dependencies.require_admin)):
    db.resolve_password_reset_request(user_id)
    return {"status": "resolved"}

@router.post("/reset-password")
@limiter.limit("60/minute")
def reset_password(request: Request, reset_data: ResetPasswordRequest):
    reset_token = db.get_valid_password_reset_token(reset_data.token)
    if not reset_token:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")
    user = db.get_user_by_id(reset_token["user_id"])
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")
    try:
        validate_password(reset_data.new_password, user["username"])
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    reset_user = db.reset_password_with_token(
        reset_data.token,
        security.get_password_hash(reset_data.new_password),
    )
    if not reset_user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")
    response = JSONResponse(content={"message": "Password reset successfully"})
    _clear_auth_cookie(response)
    return response

@router.post("/change-password")
@limiter.limit("60/minute")
def change_password(request: Request, password_data: ChangePasswordRequest, current_user: dict = Depends(dependencies.get_current_user)):
    if not security.verify_password(password_data.current_password, current_user["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    try:
        validate_password(password_data.new_password, current_user["username"])
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    new_version = db.bump_token_version(current_user["id"])
    with db.get_db_connection() as conn:
        conn.execute("UPDATE users SET password_hash = ?, failed_login_attempts = 0, locked_until = NULL WHERE id = ?", (security.get_password_hash(password_data.new_password), current_user["id"]))
        conn.commit()
    access_token = security.create_access_token(data={"sub": current_user["username"], "token_version": new_version})
    response = JSONResponse(content={"message": "Password changed successfully"})
    _auth_cookie(response, access_token)
    return response

@router.post("/feedback/suggestions")
def submit_user_suggestion(
    suggestion: UserSuggestionRequest,
    current_user: dict = Depends(dependencies.get_current_user),
):
    category = suggestion.category.strip()[:40]
    message = suggestion.message.strip()
    if not category or not message:
        raise HTTPException(status_code=422, detail="Category and suggestion are required")
    if len(message) > 2000:
        raise HTTPException(status_code=422, detail="Suggestion must be 2000 characters or fewer")
    suggestion_id = str(uuid.uuid4())
    with db.get_db_connection() as conn:
        conn.execute(
            "INSERT INTO user_suggestions (id, user_id, category, message) VALUES (?, ?, ?, ?)",
            (suggestion_id, current_user["id"], category, message),
        )
        if category == "AI Training Rule":
            conn.execute(
                "INSERT INTO verified_knowledge (id, user_id, source_feedback_message_id, question, correction, created_by) VALUES (?, ?, ?, ?, ?, ?)",
                (str(uuid.uuid4()), current_user["id"], f"global-rule-{suggestion_id}", "GLOBAL_AI_RULE", message, current_user["id"])
            )
        conn.commit()
    return {"id": suggestion_id, "status": "pending"}

@router.post("/logout")
def logout(request: Request):
    res = JSONResponse(content={"message": "Successfully logged out"})
    res.delete_cookie(
        key="access_token",
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        path="/"
    )
    return res

def _attach_last_active(users: list) -> list:
    repo = ConversationRepository()
    for u in users:
        conversations = repo.get_conversations_by_user(u["id"])
        if conversations:
            latest = max(c["updated_at"] for c in conversations if c.get("updated_at"))
            u["last_active"] = latest
        else:
            u["last_active"] = None
    return users

@router.get("/admin/pending")
def list_pending(current_user: dict = Depends(dependencies.require_admin)):
    return {"pending_users": _attach_last_active(db.list_pending_users())}

@router.get("/admin/approved")
def list_approved(current_user: dict = Depends(dependencies.require_admin)):
    return {"approved_users": _attach_last_active(db.list_approved_users())}

@router.get("/admin/users/{user_id}/conversations")
def get_user_conversations(user_id: str, current_user: dict = Depends(dependencies.require_admin)):
    repo = ConversationRepository()
    conversations = repo.get_conversations_by_user(user_id)
    
    total_msgs = 0
    for c in conversations:
        msgs = repo.get_messages(c["id"])
        visible_msgs = [msg for msg in msgs if msg.get("status", "complete") != "error"]
        c["message_count"] = len(visible_msgs)
        total_msgs += len(visible_msgs)
        
    user_overview = {
        "total_messages": total_msgs,
        "total_conversations": len(conversations),
        "last_active": conversations[0]["updated_at"] if conversations else None,
        "top_documents": []
    }
    
    with db.get_db_connection() as conn:
        docs = conn.execute('''
            SELECT d.filename, COUNT(cd.document_id) as count
            FROM conversation_documents cd
            JOIN documents d ON cd.document_id = d.id
            JOIN conversations c ON cd.conversation_id = c.id
            WHERE c.user_id = ?
            GROUP BY d.id
            ORDER BY count DESC
            LIMIT 3
        ''', (user_id,)).fetchall()
        user_overview["top_documents"] = [dict(r) for r in docs]
        
    return {"user_overview": user_overview, "conversations": conversations}

@router.get("/admin/conversations/{conversation_id}/messages")
def get_conversation_messages(conversation_id: str, current_user: dict = Depends(dependencies.require_admin)):
    repo = ConversationRepository()
    messages = repo.get_messages(conversation_id)
    return {"messages": messages}


class CreateUserRequest(BaseModel):
    username: str
    password: str

@router.post("/admin/users")
def create_admin_user(req: CreateUserRequest, current_user: dict = Depends(dependencies.require_admin)):
    existing = db.get_user_by_username(req.username)
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    try:
        validate_password(req.password, req.username)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    password_hash = security.get_password_hash(req.password)
    user = db.create_user(req.username, password_hash, is_admin=False, status='approved')
    return {"status": "created", "user_id": user["id"]}

@router.post("/admin/users/generate")
def generate_temporary_user(req: GenerateUserRequest, current_user: dict = Depends(dependencies.require_admin)):
    import datetime
    domain = req.domain.strip().lower().lstrip("@").rstrip(".")
    if not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+", domain):
        raise HTTPException(status_code=422, detail="Enter a valid domain such as example.com")
    if not 5 <= req.duration_minutes <= 43200:
        raise HTTPException(status_code=422, detail="Login time must be between 5 minutes and 30 days")

    alphabet = string.ascii_letters + string.digits
    for _ in range(5):
        username = f"guest-{secrets.token_hex(4)}@{domain}"
        if not db.get_user_by_username(username):
            break
    password = f"Bb!{secrets.choice(string.ascii_uppercase)}{secrets.choice(string.ascii_lowercase)}{secrets.choice(string.digits)}{secrets.choice('@#$%')}{''.join(secrets.choice(alphabet) for _ in range(12))}"
    expires_at = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=req.duration_minutes)).isoformat()
    user = db.create_user(username, security.get_password_hash(password), is_admin=False, status="approved", expires_at=expires_at)
    logger.info("Temporary user generated actor_id=%s target_id=%s expires_at=%s", current_user["id"], user["id"], expires_at)
    return {"username": username, "password": password, "expires_at": expires_at, "user_id": user["id"]}

@router.post("/admin/users/{user_id}/reset-token")
@limiter.limit("60/minute")
def issue_reset_token(request: Request, user_id: str, reset_data: AdminResetTokenRequest, current_user: dict = Depends(dependencies.require_admin)):
    if not security.verify_password(reset_data.admin_password, current_user["password_hash"]):
        raise HTTPException(status_code=400, detail="Invalid administrator password")
    target = db.get_user_by_id(user_id)
    if not target:
        raise HTTPException(status_code=400, detail="User not found")
    if target["id"] == current_user["id"]:
        raise HTTPException(status_code=400, detail="You cannot reset your own password from the dashboard")
    if target.get("is_admin"):
        raise HTTPException(status_code=400, detail="Admin passwords must be reset via the command line script")
    if target.get("status") != "approved":
        raise HTTPException(status_code=400, detail="Only approved users can have their password reset")
    raw_token, expires_at = db.issue_password_reset_token(target["id"], current_user["id"], settings.PASSWORD_RESET_TTL_MINUTES)
    logger.info("Password reset token issued actor_id=%s target_id=%s", current_user["id"], target["id"])
    return {"token": raw_token, "expires_at": expires_at}

@router.get("/admin/users/active")
def list_active_users(current_user: dict = Depends(dependencies.require_admin)):
    users = db.list_active_users()
    return {"active_users": _attach_last_active(users)}

@router.post("/admin/users/{user_id}/deactivate")
def deactivate_user(user_id: str, current_user: dict = Depends(dependencies.require_admin)):
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")
    target_user = db.get_user_by_id(user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    if target_user["is_admin"] and db.get_admin_count() <= 1:
        raise HTTPException(status_code=400, detail="Cannot deactivate the last remaining admin")
    
    db.update_user_status(user_id, 'deactivated', admin_id=current_user["id"])
    return {"status": "deactivated"}

@router.post("/admin/users/{user_id}/demote")
def demote_user(user_id: str, current_user: dict = Depends(dependencies.require_admin)):
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot demote yourself")
    target_user = db.get_user_by_id(user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    if db.get_admin_count() <= 1:
        raise HTTPException(status_code=400, detail="Cannot demote the last remaining admin")
    
    db.update_user_role(user_id, False)
    return {"status": "demoted"}

@router.post("/admin/users/{user_id}/promote")
def promote_user(user_id: str, current_user: dict = Depends(dependencies.require_admin)):
    target_user = db.get_user_by_id(user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    db.update_user_role(user_id, True)
    return {"status": "promoted"}

@router.post("/admin/users/{user_id}/extend")
def extend_expiry(user_id: str, req: ExtendExpiryRequest, current_user: dict = Depends(dependencies.require_admin)):
    target_user = db.get_user_by_id(user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    if not target_user.get("expires_at"):
        raise HTTPException(status_code=400, detail="User is not a temporary login")
    if not db.extend_user_expiry(user_id, req.duration_minutes):
        raise HTTPException(status_code=500, detail="Failed to extend expiry")
    return {"status": "extended"}

@router.get("/admin/system-metrics")
def get_analytics(
    range: str = 'daily',
    user_id: str = None,
    current_user: dict = Depends(dependencies.require_admin)
):
    volume = []
    top_users = []
    trending = []
    top_documents = []
    summary = {}
    
    is_scoped = user_id and user_id != 'all'
    
    with db.get_db_connection() as conn:
        # Define ranges
        date_filter = ""
        prev_date_filter = ""
        group_col = ""
        
        if range == 'hourly':
            date_filter = "datetime('now', '-24 hours')"
            prev_date_filter = "datetime('now', '-48 hours')"
            group_col = "strftime('%Y-%m-%d %H:00', m.created_at)"
        elif range == 'daily':
            date_filter = "date('now', '-30 days')"
            prev_date_filter = "date('now', '-60 days')"
            group_col = "DATE(m.created_at)"
        elif range == 'weekly':
            date_filter = "date('now', '-84 days')"
            prev_date_filter = "date('now', '-168 days')"
            group_col = "strftime('%Y-%W', m.created_at)"
        elif range == 'monthly':
            date_filter = "date('now', '-12 months')"
            prev_date_filter = "date('now', '-24 months')"
            group_col = "strftime('%Y-%m', m.created_at)"
        elif range == 'yearly':
            date_filter = "date('now', '-100 years')" 
            prev_date_filter = "date('now', '-200 years')"
            group_col = "strftime('%Y', m.created_at)"
        else:
            date_filter = "date('now', '-30 days')"
            prev_date_filter = "date('now', '-60 days')"
            group_col = "DATE(m.created_at)"

        # Helper to get stats
        def get_stat(query, params=(), is_prev=False):
            if is_prev:
                q = query.replace(">= " + date_filter, f">= {prev_date_filter} AND m.created_at < {date_filter}")
            else:
                q = query
            res = conn.execute(q, params).fetchone()[0]
            return res if res else 0

        # Summary Stats
        if is_scoped:
            q_msgs = f"SELECT COUNT(m.id) FROM messages m JOIN conversations c ON m.conversation_id = c.id WHERE c.user_id = ? AND m.status != 'error' AND m.created_at >= {date_filter}"
            total_msgs = get_stat(q_msgs, (user_id,))
            prev_msgs = get_stat(q_msgs, (user_id,), True)

            # For conversations, we approximate by filtering messages inside them for the period to be accurate, but simple created_at is fine
            q_convs = f"SELECT COUNT(m.id) FROM conversations m WHERE m.user_id = ? AND m.created_at >= {date_filter}"
            total_convs = get_stat(q_convs, (user_id,))
            prev_convs = get_stat(q_convs, (user_id,), True)
            
            # Active today
            active_today = conn.execute("SELECT COUNT(m.id) FROM messages m JOIN conversations c ON m.conversation_id = c.id WHERE c.user_id = ? AND m.status != 'error' AND DATE(m.created_at) = DATE('now')", (user_id,)).fetchone()[0]
            
            summary = {
                "total_messages": total_msgs,
                "prev_messages": prev_msgs,
                "total_conversations": total_convs,
                "prev_conversations": prev_convs,
                "total_users": 1,
                "prev_users": 1,
                "active_today": 1 if active_today > 0 else 0,
                "prev_active_today": 1 # Mock
            }
        else:
            q_msgs = f"SELECT COUNT(m.id) FROM messages m WHERE m.status != 'error' AND m.created_at >= {date_filter}"
            total_msgs = get_stat(q_msgs)
            prev_msgs = get_stat(q_msgs, (), True)
            
            q_convs = f"SELECT COUNT(m.id) FROM conversations m WHERE m.created_at >= {date_filter}"
            total_convs = get_stat(q_convs)
            prev_convs = get_stat(q_convs, (), True)
            
            total_users = conn.execute("SELECT COUNT(*) FROM users WHERE status='approved'").fetchone()[0]
            prev_users = conn.execute(f"SELECT COUNT(*) FROM users WHERE status='approved' AND created_at < {date_filter}").fetchone()[0]
            
            active_today = conn.execute("SELECT COUNT(DISTINCT c.user_id) FROM messages m JOIN conversations c ON m.conversation_id = c.id WHERE m.status != 'error' AND DATE(m.created_at) = DATE('now')").fetchone()[0]
            prev_active_today = conn.execute("SELECT COUNT(DISTINCT c.user_id) FROM messages m JOIN conversations c ON m.conversation_id = c.id WHERE m.status != 'error' AND DATE(m.created_at) = DATE('now', '-1 day')").fetchone()[0]
            
            summary = {
                "total_messages": total_msgs,
                "prev_messages": prev_msgs,
                "total_conversations": total_convs,
                "prev_conversations": prev_convs,
                "total_users": total_users,
                "prev_users": prev_users,
                "active_today": active_today,
                "prev_active_today": prev_active_today
            }

        feedback_date_filter = date_filter.replace("m.created_at", "f.created_at")
        feedback_query = f"""
            SELECT f.rating, COUNT(*) AS count
            FROM message_feedback f
            JOIN messages m ON m.id = f.message_id
            JOIN conversations c ON c.id = m.conversation_id
            WHERE f.created_at >= {feedback_date_filter}
        """
        feedback_params = []
        if is_scoped:
            feedback_query += " AND c.user_id = ?"
            feedback_params.append(user_id)
        feedback_query += " GROUP BY f.rating"
        feedback_rows = conn.execute(feedback_query, feedback_params).fetchall()
        feedback_summary = {row["rating"]: row["count"] for row in feedback_rows}
        summary.update({
            "positive_feedback": feedback_summary.get("positive", 0),
            "negative_feedback": feedback_summary.get("negative", 0),
            "feedback_total": sum(feedback_summary.values()),
        })
        
        # Top Users
        if not is_scoped:
            top_users_rows = conn.execute(f'''
                SELECT COALESCE(u.username, 'Unattributed') as username, u.id as user_id, COUNT(m.id) as count 
                FROM messages m 
                LEFT JOIN conversations c ON m.conversation_id = c.id 
                LEFT JOIN users u ON c.user_id = u.id 
                WHERE m.status != 'error' AND m.created_at >= {date_filter}
                GROUP BY COALESCE(u.id, 'unattributed')
                ORDER BY count DESC 
                LIMIT 5
            ''').fetchall()
            
            for r in top_users_rows:
                u_id = r["user_id"]
                if u_id:
                    spark = conn.execute(f'''
                        SELECT {group_col} as date, COUNT(m.id) as count
                        FROM messages m JOIN conversations c ON m.conversation_id = c.id
                        WHERE c.user_id = ? AND m.status != 'error' AND m.created_at >= {date_filter}
                        GROUP BY {group_col} ORDER BY date ASC
                    ''', (u_id,)).fetchall()
                    top_users.append({**dict(r), "sparkline": [dict(s) for s in spark]})
                else:
                    top_users.append({**dict(r), "sparkline": []})
        
        # Fetch trending terms via SQL, enforcing the minimum user floor and account age directly in the database
        min_users = 1 if is_scoped else 3
        
        term_query = f"""
            SELECT mt.term, COUNT(DISTINCT mt.user_id) as distinct_users, COUNT(mt.message_id) as count
            FROM message_terms mt
            JOIN users u ON mt.user_id = u.id
            WHERE mt.created_at >= {date_filter}
        """
        
        # Prevent gaming: user must be 24h old OR we are in scoped mode (viewing own stats)
        if not is_scoped:
            term_query += " AND u.created_at <= datetime('now', '-1 day')"
            
        term_params = []
        if is_scoped:
            term_query += " AND mt.user_id = ?"
            term_params.append(user_id)
            
        term_query += f"""
            GROUP BY mt.term
            HAVING distinct_users >= {min_users}
            ORDER BY count DESC
            LIMIT 10
        """
        
        try:
            top_words = conn.execute(term_query, term_params).fetchall()
            trending = [{"term": r["term"], "count": r["count"]} for r in top_words]
        except Exception as e:
            logger.error(f"Error fetching trending terms (message_terms might not exist yet): {e}")
            trending = []

        # Top Documents
        doc_query = f'''
            SELECT d.filename, COUNT(cd.conversation_id) as count 
            FROM documents d 
            JOIN conversation_documents cd ON d.id = cd.document_id 
            JOIN conversations c ON cd.conversation_id = c.id 
            WHERE c.created_at >= {date_filter}
        '''
        if is_scoped:
            doc_query += " AND c.user_id = ?"
            
        doc_query += " GROUP BY d.id ORDER BY count DESC LIMIT 10"
        
        top_docs_rows = conn.execute(doc_query, term_params).fetchall()
        top_documents = [{"filename": r["filename"], "count": r["count"]} for r in top_docs_rows]

        vol_query = f'''
            SELECT {group_col} as date, COUNT(m.id) as messages, COUNT(DISTINCT c.user_id) as active_users
            FROM messages m
            JOIN conversations c ON m.conversation_id = c.id
            WHERE m.status != 'error' AND m.created_at >= {date_filter}
        '''
        if is_scoped:
            vol_query += " AND c.user_id = ?"
            vol_query += f" GROUP BY {group_col} ORDER BY date ASC"
            vol_rows = conn.execute(vol_query, (user_id,)).fetchall()
        else:
            vol_query += f" GROUP BY {group_col} ORDER BY date ASC"
            vol_rows = conn.execute(vol_query).fetchall()
            
        volume = [dict(r) for r in vol_rows]

    return {
        "volume": volume,
        "top_users": top_users,
        "trending": trending,
        "top_documents": top_documents,
        "summary": summary
    }

@router.get("/admin/feedback")
def list_feedback(current_user: dict = Depends(dependencies.require_admin)):
    with db.get_db_connection() as conn:
        rows = conn.execute("""
            SELECT f.message_id, f.rating, f.review_status, f.resolution_note,
                   f.created_at, u.username, answer.content AS answer,
                   (SELECT question.content FROM messages question
                    WHERE question.conversation_id = answer.conversation_id
                      AND question.role = 'user'
                      AND question.sequence < answer.sequence
                    ORDER BY question.sequence DESC LIMIT 1) AS question
            FROM message_feedback f
            JOIN messages answer ON answer.id = f.message_id
            JOIN conversations c ON c.id = answer.conversation_id
            LEFT JOIN users u ON u.id = c.user_id
            ORDER BY f.created_at DESC
            LIMIT 100
        """).fetchall()
    return {"feedback": [dict(row) for row in rows]}

@router.patch("/admin/feedback/{message_id}")
def review_feedback(
    message_id: str,
    review: FeedbackReviewRequest,
    current_user: dict = Depends(dependencies.require_admin),
):
    if review.review_status not in {"pending", "approved", "rejected"}:
        raise HTTPException(status_code=400, detail="Invalid feedback review status")
    with db.get_db_connection() as conn:
        cursor = conn.execute("""
            UPDATE message_feedback
            SET review_status = ?, resolution_note = ?
            WHERE message_id = ?
        """, (review.review_status, review.resolution_note.strip()[:2000], message_id))
        conn.commit()
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Feedback not found")
    if review.review_status == "approved" and review.resolution_note.strip():
        with db.get_db_connection() as conn:
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
        if not source or not source["user_id"]:
            raise HTTPException(status_code=404, detail="Feedback source conversation not found")
        VerifiedKnowledgeRepository().save(
            user_id=source["user_id"],
            source_feedback_message_id=message_id,
            question=source["question"] or "",
            correction=review.resolution_note.strip(),
            created_by=current_user["id"],
        )
    return {"message_id": message_id, "review_status": review.review_status}

@router.get("/admin/suggestions")
def list_user_suggestions(current_user: dict = Depends(dependencies.require_admin)):
    with db.get_db_connection() as conn:
        rows = conn.execute("""
            SELECT s.id, s.category, s.message, s.status, s.resolution_note, s.created_at,
                   s.reviewed_at, u.username
            FROM user_suggestions s
            LEFT JOIN users u ON u.id = s.user_id
            ORDER BY s.created_at DESC
            LIMIT 100
        """).fetchall()
    return {"suggestions": [dict(row) for row in rows]}

@router.patch("/admin/suggestions/{suggestion_id}")
def review_user_suggestion(
    suggestion_id: str,
    review: SuggestionReviewRequest,
    current_user: dict = Depends(dependencies.require_admin),
):
    if review.status not in {"pending", "reviewed", "rejected"}:
        raise HTTPException(status_code=400, detail="Invalid suggestion status")
    with db.get_db_connection() as conn:
        cursor = conn.execute("""
            UPDATE user_suggestions
            SET status = ?, resolution_note = ?, reviewed_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (review.status, review.resolution_note.strip()[:2000], suggestion_id))
        conn.commit()
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    return {"id": suggestion_id, "status": review.status}

@router.get("/admin/learning-insights")
def learning_insights(current_user: dict = Depends(dependencies.require_admin)):
    with db.get_db_connection() as conn:
        repeated = conn.execute("""
            SELECT LOWER(TRIM(content)) AS question, COUNT(*) AS count,
                   MAX(created_at) AS last_seen
            FROM messages
            WHERE role = 'user' AND LENGTH(TRIM(content)) >= 12
            GROUP BY LOWER(TRIM(content))
            HAVING COUNT(*) >= 2
            ORDER BY count DESC, last_seen DESC
            LIMIT 20
        """).fetchall()
        pending_negative = conn.execute("""
            SELECT COUNT(*) AS count FROM message_feedback
            WHERE rating = 'negative' AND review_status = 'pending'
        """).fetchone()["count"]
        verified = conn.execute("SELECT COUNT(*) AS count FROM verified_knowledge WHERE is_active = 1").fetchone()["count"]
    return {
        "repeated_questions": [dict(row) for row in repeated],
        "pending_negative_feedback": pending_negative,
        "verified_corrections": verified,
    }
@router.post("/admin/approve/{user_id}")
def approve_user(user_id: str, current_user: dict = Depends(dependencies.require_admin)):
    target_user = db.get_user_by_id(user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    db.update_user_status(user_id, 'approved', admin_id=current_user["id"])
    return {"status": "approved", "user_id": user_id}

@router.post("/admin/reject/{user_id}")
def reject_user(user_id: str, current_user: dict = Depends(dependencies.require_admin)):
    target_user = db.get_user_by_id(user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    db.update_user_status(user_id, 'rejected', admin_id=current_user["id"])
    return {"status": "rejected", "user_id": user_id}

@router.get("/me")
def get_current_user_info(current_user: dict = Depends(dependencies.get_current_user)):
    return {
        "id": current_user["id"],
        "username": current_user["username"],
        "is_admin": bool(current_user["is_admin"]),
        "status": current_user["status"]
    }
