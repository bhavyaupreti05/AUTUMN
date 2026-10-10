"""Create the first approved administrator without placing a password in shell history."""

import getpass
from src.auth.password_policy import validate_password


def create_admin(username: str, password: str):
    from src.auth import db, security

    if not username.strip() or not password:
        raise ValueError("Username and password are required")
    validate_password(password, username.strip())
    if db.get_user_by_username(username):
        raise ValueError("A user with that username already exists")

    return db.create_user(
        username=username.strip(),
        password_hash=security.get_password_hash(password),
        is_admin=True,
        status="approved",
    )


def main():
    username = input("Admin username: ").strip()
    password = getpass.getpass("Admin password: ")
    confirmation = getpass.getpass("Confirm admin password: ")
    if password != confirmation:
        raise SystemExit("Passwords do not match")

    try:
        user = create_admin(username, password)
    except ValueError as error:
        raise SystemExit(str(error)) from error
    print(f"Created approved administrator: {user['username']}")


if __name__ == "__main__":
    main()
