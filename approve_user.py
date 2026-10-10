from src.database.connection import get_connection
with get_connection() as conn:
    conn.execute('UPDATE users SET status = "approved" WHERE username = "teste2e"')
    conn.commit()
