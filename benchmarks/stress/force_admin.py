import sqlite3

from src.config import settings
def force_admin():
    conn = sqlite3.connect(settings.DATABASE_URL)
    c = conn.cursor()
    # Check if stress_admin exists
    c.execute("SELECT id FROM users WHERE username='stress_admin'")
    row = c.fetchone()
    if row:
        c.execute("UPDATE users SET is_admin=1, status='approved' WHERE username='stress_admin'")
    else:
        from src.auth.security import get_password_hash
        c.execute("INSERT INTO users (id, username, password_hash, is_admin, status) VALUES (?, ?, ?, ?, ?)",
                  ('stress-admin-id', 'stress_admin', get_password_hash('stress_pass'), 1, 'approved'))
    conn.commit()
    conn.close()

if __name__ == '__main__':
    force_admin()
