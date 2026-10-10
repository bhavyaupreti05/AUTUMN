import httpx
import uuid
import asyncio
from src.auth.security import create_access_token
from src.auth.db import create_user
from src.auth.security import get_password_hash

API_BASE = "http://localhost:8000"

async def get_admin_token():
    return create_access_token({"sub": "stress_admin"})

async def create_stress_users(admin_token, num_users=5):
    tokens = []
    for i in range(num_users):
        username = f"stress_user_{uuid.uuid4().hex[:8]}"
        password = "password123"
        try:
            create_user(username, get_password_hash(password), is_admin=False, status='approved')
            tokens.append(create_access_token({"sub": username}))
        except Exception as e:
            print(f"Failed to create {username}: {e}")
    return tokens
