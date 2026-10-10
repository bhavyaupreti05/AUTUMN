from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address
import time
from collections import defaultdict
from src.auth.security import verify_token

def get_user_or_ip(request: Request) -> str:
    """Extracts username from a JWT header or cookie, falling back to IP."""
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1]
    else:
        cookies = request.cookies
        token = cookies.get("access_token") if isinstance(cookies, dict) else None

    if token:
        try:
            username = verify_token(token)
            if username:
                return username
        except Exception:
            pass

    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
        
    return get_remote_address(request)

limiter = Limiter(key_func=get_user_or_ip)

_login_attempts = defaultdict(list)

def check_username_rate_limit(username: str, limit: int = 5, window: int = 60) -> bool:
    """Returns True if allowed, False if rate limited (per-username)."""
    # Normalize the username to prevent whitespace/case bypasses
    normalized_username = username.strip().lower()
    
    now = time.time()
    user_attempts = _login_attempts[normalized_username]
    
    # Prune old attempts
    user_attempts = [t for t in user_attempts if now - t < window]
    _login_attempts[normalized_username] = user_attempts
    
    if len(user_attempts) >= limit:
        return False
        
    user_attempts.append(now)
    return True

def clear_username_rate_limit(username: str) -> None:
    """Clears the rate limit attempts for a username upon successful login."""
    normalized_username = username.strip().lower()
    if normalized_username in _login_attempts:
        del _login_attempts[normalized_username]
