"""Reset a user's password without placing it in shell history."""

import getpass
import sys

from src.auth import db, security
from src.auth.password_policy import validate_password


def reset_password(username: str, password: str):
    user = db.get_user_by_username(username)
    if not user:
        raise ValueError("Unknown user")
    validate_password(password, username)
    with db.get_db_connection() as conn:
        conn.execute(
            "UPDATE users SET password_hash = ?, token_version = COALESCE(token_version, 0) + 1, failed_login_attempts = 0, locked_until = NULL WHERE id = ?",
            (security.get_password_hash(password), user["id"]),
        )
        conn.commit()


def main():
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python -m scripts.reset_password <username>")
    username = sys.argv[1].strip()
    password = getpass.getpass("New password: ")
    confirmation = getpass.getpass("Confirm new password: ")
    if password != confirmation:
        raise SystemExit("Passwords do not match")
    try:
        reset_password(username, password)
    except ValueError as error:
        raise SystemExit(str(error)) from error
    print("Password reset successfully")


if __name__ == "__main__":
    main()