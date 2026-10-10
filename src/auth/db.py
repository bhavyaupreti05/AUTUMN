import sqlite3
import uuid
import datetime
import hashlib
import secrets
from src.config import settings

def get_db_connection():
    conn = sqlite3.connect(settings.DATABASE_URL)
    conn.row_factory = sqlite3.Row
    return conn

def init_users_table():
    with get_db_connection() as conn:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                is_admin BOOLEAN NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                approved_by TEXT,
                approved_at TIMESTAMP,
                failed_login_attempts INTEGER DEFAULT 0,
                locked_until TIMESTAMP
            )
        ''')
        
        try:
            conn.execute("ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0;")
        except sqlite3.OperationalError:
            pass
            
        try:
            conn.execute("ALTER TABLE users ADD COLUMN locked_until TIMESTAMP;")
        except sqlite3.OperationalError:
            pass

        try:
            conn.execute("ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0;")
        except sqlite3.OperationalError:
            pass

        try:
            conn.execute("ALTER TABLE users ADD COLUMN expires_at TIMESTAMP;")
        except sqlite3.OperationalError:
            pass

        try:
            conn.execute("ALTER TABLE users ADD COLUMN reset_requested BOOLEAN DEFAULT 0;")
        except sqlite3.OperationalError:
            pass
            
        try:
            conn.execute("ALTER TABLE users ADD COLUMN reset_requested_at TIMESTAMP;")
        except sqlite3.OperationalError:
            pass
            
        try:
            conn.execute("ALTER TABLE users ADD COLUMN last_login TIMESTAMP;")
        except sqlite3.OperationalError:
            pass

        conn.execute('''
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                token_hash TEXT UNIQUE NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                used_at TIMESTAMP,
                created_by TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
        ''')
        conn.execute("CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_hash ON password_reset_tokens(token_hash)")
            
        conn.commit()

def count_users() -> int:
    with get_db_connection() as conn:
        row = conn.execute("SELECT COUNT(*) as count FROM users").fetchone()
        return row["count"]

def create_user(username: str, password_hash: str, is_admin: bool = False, status: str = 'pending', expires_at: str | None = None) -> dict:
    with get_db_connection() as conn:
        user_id = str(uuid.uuid4())
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        
        # If created as approved immediately, set approved_at
        approved_at = now if status == 'approved' else None
        
        conn.execute('''
            INSERT INTO users (id, username, password_hash, is_admin, status, created_at, approved_at, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (user_id, username, password_hash, is_admin, status, now, approved_at, expires_at))
        conn.commit()
        return get_user_by_id(user_id)

def create_registered_user(username: str, password_hash: str) -> dict:
    with get_db_connection() as conn:
        conn.execute("BEGIN IMMEDIATE")
        user_count = conn.execute("SELECT COUNT(*) AS count FROM users").fetchone()["count"]
        is_admin = user_count == 0
        status = "approved" if is_admin else "pending"
        user_id = str(uuid.uuid4())
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        approved_at = now if is_admin else None
        conn.execute(
            """
            INSERT INTO users (id, username, password_hash, is_admin, status, created_at, approved_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (user_id, username, password_hash, is_admin, status, now, approved_at),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return dict(row)

def get_user_by_username(username: str) -> dict:
    with get_db_connection() as conn:
        row = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
        return dict(row) if row else None

def record_failed_login(username: str, lock_minutes: int = 15):
    with get_db_connection() as conn:
        user = get_user_by_username(username)
        if not user:
            return
            
        new_attempts = user.get("failed_login_attempts", 0) + 1
        
        if new_attempts >= 5:
            locked_until = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=lock_minutes)).isoformat()
            conn.execute("UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE username = ?", (new_attempts, locked_until, username))
        else:
            conn.execute("UPDATE users SET failed_login_attempts = ? WHERE username = ?", (new_attempts, username))
            
        conn.commit()

def reset_failed_logins(username: str):
    with get_db_connection() as conn:
        conn.execute("UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE username = ?", (username,))
        conn.commit()

def record_successful_login(username: str):
    with get_db_connection() as conn:
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        conn.execute("UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login = ? WHERE username = ?", (now, username))
        conn.commit()

def bump_token_version(user_id: str) -> int:
    with get_db_connection() as conn:
        conn.execute("UPDATE users SET token_version = COALESCE(token_version, 0) + 1 WHERE id = ?", (user_id,))
        conn.commit()
        row = conn.execute("SELECT token_version FROM users WHERE id = ?", (user_id,)).fetchone()
        return row["token_version"]

def issue_password_reset_token(user_id: str, created_by: str, ttl_minutes: int) -> tuple[str, str]:
    raw_token = secrets.token_urlsafe(32)
    now = datetime.datetime.now(datetime.timezone.utc)
    expires_at = now + datetime.timedelta(minutes=ttl_minutes)
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    with get_db_connection() as conn:
        conn.execute("UPDATE password_reset_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL", (now.isoformat(), user_id))
        conn.execute(
            "INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), user_id, token_hash, expires_at.isoformat(), created_by, now.isoformat()),
        )
        conn.commit()
    return raw_token, expires_at.isoformat()

def get_valid_password_reset_token(raw_token: str) -> dict | None:
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    with get_db_connection() as conn:
        row = conn.execute(
            "SELECT * FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL",
            (token_hash,),
        ).fetchone()
        if not row:
            return None
        expires_at = datetime.datetime.fromisoformat(row["expires_at"])
        if datetime.datetime.now(datetime.timezone.utc) >= expires_at:
            return None
        return dict(row)

def reset_password_with_token(raw_token: str, password_hash: str) -> dict | None:
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    now = datetime.datetime.now(datetime.timezone.utc)
    with get_db_connection() as conn:
        conn.execute("BEGIN IMMEDIATE")
        row = conn.execute(
            "SELECT * FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL",
            (token_hash,),
        ).fetchone()
        if not row:
            return None
        expires_at = datetime.datetime.fromisoformat(row["expires_at"])
        if now >= expires_at:
            return None
        user = conn.execute("SELECT * FROM users WHERE id = ?", (row["user_id"],)).fetchone()
        if not user:
            return None
        conn.execute(
            "UPDATE users SET password_hash = ?, token_version = COALESCE(token_version, 0) + 1, failed_login_attempts = 0, locked_until = NULL WHERE id = ?",
            (password_hash, user["id"]),
        )
        conn.execute(
            "UPDATE password_reset_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL",
            (now.isoformat(), row["id"]),
        )
        conn.commit()
        return dict(user)

def mark_password_reset_token_used(token_id: str):
    with get_db_connection() as conn:
        conn.execute(
            "UPDATE password_reset_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL",
            (datetime.datetime.now(datetime.timezone.utc).isoformat(), token_id),
        )
        conn.commit()

def get_user_by_id(user_id: str) -> dict:
    with get_db_connection() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return dict(row) if row else None

def list_pending_users() -> list:
    with get_db_connection() as conn:
        rows = conn.execute(
            "SELECT id, username, is_admin, status, created_at, approved_at FROM users WHERE status = 'pending' ORDER BY created_at ASC"
        ).fetchall()
        return [dict(row) for row in rows]

def list_approved_users() -> list:
    with get_db_connection() as conn:
        rows = conn.execute(
            "SELECT id, username, is_admin, status, created_at, approved_at, last_login FROM users WHERE status = 'approved' ORDER BY username ASC"
        ).fetchall()
        return [dict(row) for row in rows]

def update_user_status(user_id: str, status: str, admin_id: str = None) -> bool:
    with get_db_connection() as conn:
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        if status == 'approved':
            res = conn.execute(
                "UPDATE users SET status = ?, approved_by = ?, approved_at = ? WHERE id = ?",
                (status, admin_id, now, user_id)
            )
        else:
            res = conn.execute(
                "UPDATE users SET status = ?, approved_by = NULL, approved_at = NULL WHERE id = ?",
                (status, user_id)
            )
        conn.commit()
        return res.rowcount > 0

def get_admin_count() -> int:
    with get_db_connection() as conn:
        row = conn.execute("SELECT COUNT(*) as count FROM users WHERE is_admin = 1 AND status = 'approved'").fetchone()
        return row["count"]

def update_user_role(user_id: str, is_admin: bool) -> bool:
    with get_db_connection() as conn:
        res = conn.execute(
            "UPDATE users SET is_admin = ? WHERE id = ?",
            (1 if is_admin else 0, user_id)
        )
        conn.commit()
        return res.rowcount > 0

def extend_user_expiry(user_id: str, minutes_to_add: int) -> bool:
    with get_db_connection() as conn:
        user = get_user_by_id(user_id)
        if not user or not user.get('expires_at'):
            return False
        
        current_expiry = datetime.datetime.fromisoformat(user['expires_at'])
        new_expiry = current_expiry + datetime.timedelta(minutes=minutes_to_add)
        
        res = conn.execute(
            "UPDATE users SET expires_at = ? WHERE id = ?",
            (new_expiry.isoformat(), user_id)
        )
        conn.commit()
        return res.rowcount > 0

def list_active_users() -> list:
    with get_db_connection() as conn:
        rows = conn.execute(
            "SELECT id, username, is_admin, status, created_at, approved_at, expires_at, last_login FROM users WHERE status = 'approved' ORDER BY username ASC"
        ).fetchall()
        return [dict(row) for row in rows]

def request_password_reset(username: str) -> bool:
    with get_db_connection() as conn:
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        res = conn.execute("UPDATE users SET reset_requested = 1, reset_requested_at = ? WHERE username COLLATE NOCASE = ?", (now, username.strip()))
        conn.commit()
        return res.rowcount > 0

def list_password_reset_requests() -> list:
    with get_db_connection() as conn:
        rows = conn.execute("SELECT id, username, reset_requested_at FROM users WHERE reset_requested = 1 ORDER BY reset_requested_at ASC").fetchall()
        return [dict(row) for row in rows]

def resolve_password_reset_request(user_id: str):
    with get_db_connection() as conn:
        conn.execute("UPDATE users SET reset_requested = 0, reset_requested_at = NULL WHERE id = ?", (user_id,))
        conn.commit()
